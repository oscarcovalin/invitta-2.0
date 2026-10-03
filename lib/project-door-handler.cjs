'use strict';
const { resolveRequestSession } = require('./request-auth-session.cjs');
const { OperationError } = require('./project-operations-store.cjs');
const { assertOrigin,parseBody } = require('./project-operations-handler.cjs');
function createDoorHandler({authService,operate,publicRead=false}) {
  return async (req,res) => {
    res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
    if (req.method!=='POST') { res.setHeader('Allow','POST'); return res.status(405).json({success:false,code:'METHOD_NOT_ALLOWED',error:'Método no permitido.'}); }
    try {
      if (!publicRead) assertOrigin(req,authService);
      const input=parseBody(req.body);
      let config,accessToken;
      if (publicRead) { config=authService.getAuthConfig(); accessToken=config.publishableKey; }
      else {
        const session=await resolveRequestSession({req,res,authService});
        if (session.user.is_anonymous===true) throw new OperationError(403,'FORBIDDEN','Se requiere una cuenta profesional.');
        ({config,accessToken}=session);
      }
      const result=await operate({input,config,accessToken,publicRead});
      return res.status(input.action==='issue' && !publicRead ? 201 : 200).json({success:true,...result});
    } catch (error) {
      const status=[401,403,404,409,422,503].includes(error?.status) ? error.status : 502;
      const codes={401:'UNAUTHENTICATED',403:'FORBIDDEN',404:'NOT_FOUND',409:'CONFLICT',422:'INVALID_INPUT',503:'NOT_CONFIGURED',502:'STORE_UNAVAILABLE'};
      return res.status(status).json({success:false,code:error instanceof OperationError ? error.code : codes[status],
        error:error instanceof OperationError ? error.message : 'No fue posible confirmar la operación. Verifica el estado antes de reintentar.'});
    }
  };
}
module.exports={createDoorHandler};
