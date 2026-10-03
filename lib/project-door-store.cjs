'use strict';
const { OperationError } = require('./project-operations-store.cjs');
const { signCredential, verifyCredential, digestCredential } = require('./door-credential.cjs');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function invalid() { throw new OperationError(422,'INVALID_INPUT','Revisa proyecto, boleto y cantidad.'); }
function unavailable() { return new OperationError(502,'STORE_UNAVAILABLE','Resultado sin confirmar. Conserva la solicitud y reintenta la misma operación.'); }
function uuid(value) { if (typeof value !== 'string' || !UUID.test(value)) invalid(); return value; }
function object(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k=>!allowed.includes(k))) invalid();
}
function validate(input, publicRead, secret) {
  if (publicRead) { object(input,['credential']); return { action:'public', ...verifyCredential(input.credential,secret), credential:input.credential }; }
  const action = input?.action;
  const extras = { context:[], issue:['operationId','name','passes','tableId','immediate'], inspect:['credential'],
    admit:['credential','operationId','count'], revoke:['credential'] };
  if (!extras[action]) invalid();
  object(input,['action','projectId',...extras[action]]);
  const out = { action, projectId:uuid(input.projectId) };
  if (action==='context') { signCredential(out.projectId,out.projectId,secret); return out; }
  if (action === 'issue') {
    out.operationId = uuid(input.operationId);
    if (typeof input.name !== 'string' || !input.name.trim() || [...input.name.trim()].length>160 ||
      !Number.isInteger(input.passes) || input.passes<1 || input.passes>20 || typeof input.immediate!=='boolean') invalid();
    out.name = input.name.trim(); out.passes = input.passes; out.immediate = input.immediate;
    out.tableId = input.tableId === null || input.tableId === undefined ? null : uuid(input.tableId);
    out.ticketId = out.operationId; out.credential = signCredential(out.projectId,out.ticketId,secret);
  } else {
    const decoded = verifyCredential(input.credential,secret);
    if (decoded.projectId !== out.projectId) invalid();
    out.ticketId = decoded.ticketId; out.credential = input.credential;
    if (action==='admit') {
      out.operationId = uuid(input.operationId);
      if (!Number.isInteger(input.count) || input.count<1 || input.count>20) invalid();
      out.count = input.count;
    }
  }
  return out;
}
function validResult(action,r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return false;
  if (action==='context') return typeof r.projectName==='string' && typeof r.canIssue==='boolean' && r.canAdmit===true &&
    Object.keys(r).length===3;
  if (action==='revoke') return Object.keys(r).length===2 && UUID.test(r.ticketId) && r.revoked===true;
  if (action==='admit') return Object.keys(r).length===6 && UUID.test(r.ticketId) && UUID.test(r.operationId) &&
    Number.isInteger(r.count) && r.count>0 && r.count<=20 && Number.isInteger(r.admitted) && r.admitted>=r.count &&
    Number.isInteger(r.remaining) && r.remaining>=0 && Number.isFinite(Date.parse(r.confirmedAt));
  const publicKeys=['name','passes','admitted','remaining','expiresAt','revoked','projectName','tableName'];
  const allowed= action==='public' ? publicKeys : [...publicKeys,'ticketId','guestId','projectId'];
  return Object.keys(r).length===allowed.length && Object.keys(r).every(k=>allowed.includes(k)) &&
    typeof r.name==='string' && typeof r.projectName==='string' && (r.tableName===null || typeof r.tableName==='string') &&
    Number.isInteger(r.passes) && r.passes>=1 && r.passes<=100 && Number.isInteger(r.admitted) && r.admitted>=0 && r.admitted<=r.passes &&
    r.remaining===r.passes-r.admitted && typeof r.revoked==='boolean' && Number.isFinite(Date.parse(r.expiresAt)) &&
    (action==='public' || [r.ticketId,r.guestId,r.projectId].every(v=>UUID.test(v)));
}
async function operatePass({ input, publicRead=false, config, accessToken,
  secret=process.env.INVITTA_PASS_QR_SECRET, fetchImpl=fetch }) {
  const data=validate(input,publicRead,secret);
  const body={ p_project:data.projectId };
  if (data.action==='issue') Object.assign(body,{p_operation:data.operationId,p_name:data.name,p_passes:data.passes,p_table:data.tableId,p_immediate:data.immediate,p_digest:digestCredential(data.credential)});
  else if (data.action!=='context') {
    body.p_ticket=data.ticketId;
    if (data.action!=='revoke') body.p_digest=digestCredential(data.credential);
    if (data.action==='admit') Object.assign(body,{p_operation:data.operationId,p_count:data.count});
  }
  let response,result;
  try {
    response=await fetchImpl(`${config.url}/rest/v1/rpc/invitation_pass_${data.action}`,{
      method:'POST', cache:'no-store', redirect:'error', signal:AbortSignal.timeout(15000),
      headers:{apikey:config.publishableKey,Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'}, body:JSON.stringify(body)
    });
    result=await response.json();
  } catch (_) { throw unavailable(); }
  if (!response.ok) {
    const codes={ '42501':[403,'FORBIDDEN','No tienes permiso para operar este proyecto.'],
      P0001:[409,'CONFLICT','La intención cambió o no quedan suficientes pases. Verifica el boleto.'],
      P0002:[404,'TICKET_UNAVAILABLE','El boleto no existe, venció o fue revocado.'],
      '23503':[422,'INVALID_INPUT','La mesa no pertenece al proyecto.'], '23514':[422,'INVALID_INPUT','Revisa los datos y el saldo admitido.'] };
    if (response.status===401) throw new OperationError(401,'UNAUTHENTICATED','Inicia sesión de nuevo.');
    if (codes[result?.code]) throw new OperationError(...codes[result.code]);
    throw unavailable();
  }
  if (!validResult(data.action,result)) throw unavailable();
  if (['issue','inspect'].includes(data.action) && (result.projectId!==data.projectId || result.ticketId!==data.ticketId)) throw unavailable();
  if (['admit','revoke'].includes(data.action) && result.ticketId!==data.ticketId) throw unavailable();
  if (data.action==='admit' && (result.operationId!==data.operationId || result.count!==data.count)) throw unavailable();
  if (data.action==='context') return {context:result};
  if (data.action==='admit') return {admission:result};
  if (data.action==='revoke') return {revocation:result};
  return {pass:result,...(data.action==='issue' ? {credential:data.credential} : {})};
}
module.exports={operatePass,validate,validResult};
