const assert = require('node:assert/strict');
const { ROUTE_KEYS, createApiDispatcher, normalizeRoute } = require('./lib/api-dispatcher.cjs');

const response = () => ({
  statusCode: null, body: null,
  setHeader() {},
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

(async () => {
  const handlers = Object.fromEntries(ROUTE_KEYS.map((route) => [route, async (req, res) => {
    res.status(209).json({ route, method: req.method, query: req.query });
  }]));
  const dispatch = createApiDispatcher({ handlers });
  for (const route of ROUTE_KEYS) {
    const res = response();
    const req = { method: 'POST', query: { route, id: 'preserved' } };
    await dispatch(req, res);
    assert.equal(res.statusCode, 209, route);
    assert.equal(res.body.route, route);
    assert.equal(res.body.method, 'POST');
    assert.equal(res.body.query.id, 'preserved');
  }

  for (const route of ['auth/register', 'auth/recover', 'auth/invitations', 'projects/guests', 'projects/tables']) {
    const res = response();
    await dispatch({ method: 'POST', query: { route } }, res);
    assert.equal(res.statusCode, 209, route);
    assert.equal(res.body.route, route);
  }

  for (const route of ['../../lib/supabase-auth-service.cjs', 'projects\\list', 'projects//list', '/projects/./list', ['projects/list'], undefined]) {
    const res = response();
    await dispatch({ method: 'GET', query: { route } }, res);
    assert.equal(res.statusCode, 404, String(route));
    assert.equal(res.body.success, false);
  }
  assert.equal(normalizeRoute('/projects/list/'), 'projects/list');
  const deployedDispatch=(await import('./api/index.js')).default;
  for(const route of ['projects/passes','public/pass']) {
    assert(ROUTE_KEYS.includes(route),'Door route must be explicitly allowlisted');
    const res=response();
    await deployedDispatch({method:'GET',query:{route},headers:{}},res);
    assert.equal(res.statusCode,405,'Actual lazy wrapper imports and executes');
    assert.equal(res.body.code,'METHOD_NOT_ALLOWED');
  }
  console.log(`API dispatcher maps ${ROUTE_KEYS.length} allowlisted routes and rejects malformed paths.`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
