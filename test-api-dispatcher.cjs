const assert = require('node:assert/strict');
const { ROUTE_KEYS, createApiDispatcher, normalizeRoute } = require('./lib/api-dispatcher.cjs');

const response = () => ({
  statusCode: null, body: null,
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

  for (const route of ['../../lib/supabase-auth-service.cjs', 'projects\\list', 'projects//list', '/projects/./list', ['projects/list'], undefined]) {
    const res = response();
    await dispatch({ method: 'GET', query: { route } }, res);
    assert.equal(res.statusCode, 404, String(route));
    assert.equal(res.body.success, false);
  }
  assert.equal(normalizeRoute('/projects/list/'), 'projects/list');
  console.log(`API dispatcher maps ${ROUTE_KEYS.length} allowlisted routes and rejects malformed paths.`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
