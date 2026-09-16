const http = require('node:http');
const { URL } = require('node:url');

function json(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store'
  });
  response.end(payload);
}

function createApiServer({ config, orchestrator }) {
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const supplied = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (config.api.token && supplied !== config.api.token) {
      json(response, 401, { ok: false, error: 'Não autorizado.' });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/status') {
      json(response, 200, { ok: true, state: orchestrator.publicState() });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/scenes') {
      json(response, 200, { ok: true, scenes: config.scenes });
      return;
    }
    const match = url.pathname.match(/^\/api\/scenes\/([a-z0-9_-]+)\/apply$/);
    if (request.method === 'POST' && match) {
      try {
        const result = await orchestrator.applyScene(match[1]);
        json(response, result.ok ? 200 : 207, result);
      } catch (error) {
        json(response, error.message.includes('ainda') ? 409 : 400, { ok: false, error: error.message });
      }
      return;
    }
    json(response, 404, { ok: false, error: 'Rota não encontrada.' });
  });
  return {
    start: () => new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(config.api.port, config.api.host, () => resolve(server.address()));
    }),
    stop: () => new Promise((resolve) => server.close(resolve))
  };
}

module.exports = { createApiServer };
