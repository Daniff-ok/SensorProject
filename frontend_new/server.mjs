import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const backend = new URL(process.env.SENSOR_BACKEND || 'http://127.0.0.1:3000');
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/dashboard.css', ['dashboard.css', 'text/css; charset=utf-8']],
  ['/tokens.css', ['tokens.css', 'text/css; charset=utf-8']],
  ['/base.css', ['base.css', 'text/css; charset=utf-8']],
  ['/dashboard.js', ['dashboard.js', 'text/javascript; charset=utf-8']],
]);
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method !== 'GET') { res.writeHead(405, { Allow: 'GET' }); res.end(); return; }
  if (['/api/latest', '/api/hourly', '/api/daily'].includes(url.pathname)) {
    try {
      const upstream = await fetch(new URL(url.pathname + url.search, backend), { signal: AbortSignal.timeout(7000), headers: { Accept: 'application/json' }, redirect: 'error' });
      res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store' });
      res.end(await upstream.text());
    } catch { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: { code: 'backend_unavailable', message: 'Go server is unavailable' } })); }
    return;
  }
  const asset = assets.get(url.pathname);
  if (!asset) { res.writeHead(404); res.end('Not found'); return; }
  try { const data = await readFile(path.join(root, asset[0])); res.writeHead(200, { 'Content-Type': asset[1], 'Cache-Control': 'no-store' }); res.end(data); }
  catch { res.writeHead(500); res.end('Unable to read frontend asset'); }
}).listen(port, '127.0.0.1', () => console.log(`Dashboard: http://127.0.0.1:${port}\nDemo: http://127.0.0.1:${port}/?source=demo\nAPI proxy: ${backend.origin}`));
