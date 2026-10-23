// Acceptance-only loopback transport injection; no database access.
import http from 'node:http';
import net from 'node:net';
import { appendFileSync, readFileSync } from 'node:fs';
const base = new URL('./', import.meta.url);
const controlFile = new URL('navigation-fault-control.json', base);
const record = value => appendFileSync(new URL('navigation-fault-requests.jsonl', base), JSON.stringify({ at: new Date().toISOString(), ...value }) + '\n');
const server = http.createServer((req, res) => {
  const isFx = req.method === 'GET' && req.url === '/api/trading-room/fx';
  const config = JSON.parse(readFileSync(controlFile, 'utf8'));
  if (isFx && config.failFx) {
    record({ method: 'GET', route: '/api/trading-room/fx', status: 503, injected: true });
    res.writeHead(503, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ error: { code: 'acceptance-fx-read-failed' } }));
    return;
  }
  const forward = () => {
    if (res.destroyed) return;
    const upstream = http.request({ hostname: '127.0.0.1', port: 3333, path: req.url, method: req.method, headers: req.headers }, incoming => {
      if (isFx) record({ method: 'GET', route: '/api/trading-room/fx', status: incoming.statusCode, delayMs: config.delayFxMs ?? 0, injected: false });
      res.writeHead(incoming.statusCode ?? 502, incoming.headers); incoming.pipe(res);
    });
    upstream.on('error', error => { record({ route: isFx ? '/api/trading-room/fx' : '<other>', transportError: error.code }); if (!res.headersSent) res.writeHead(502); res.end(); });
    req.pipe(upstream);
  };
  if (isFx && config.delayFxMs > 0) {
    record({ method: 'GET', route: '/api/trading-room/fx', phase: 'delay-start', delayMs: config.delayFxMs });
    setTimeout(forward, config.delayFxMs);
  } else forward();
});
server.on('upgrade', (req, socket, head) => {
  const upstream = net.connect(3333, '127.0.0.1', () => {
    upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${req.rawHeaders.reduce((result, value, i, all) => i % 2 === 0 ? result + value + ': ' + all[i + 1] + '\r\n' : result, '')}\r\n`);
    if (head.length) upstream.write(head); socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy()); socket.on('error', () => upstream.destroy());
});
server.listen(3334, '127.0.0.1', () => record({ proxy: 'ready', port: 3334, upstream: 3333, databaseAccess: false }));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
