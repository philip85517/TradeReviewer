// Acceptance-only loopback transport fault. Never opens or writes any database.
import http from 'node:http';
import net from 'node:net';
import { appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const controlPath = fileURLToPath(new URL('./recall-fault-control.json', import.meta.url));
const logPath = fileURLToPath(new URL('./recall-fault-requests.jsonl', import.meta.url));
const episodeId = 'episode:%5B%22p1-count-09%3ACN-SH%3A600100%3Alive%22%2C%222026-10-20T16%3A05%3A00.000Z%22%2C%22buy%22%2C%2220.125%22%2C%22100%22%5D:1';
const record = value => appendFileSync(logPath, JSON.stringify({ at: new Date().toISOString(), ...value }) + '\n');
function forward(req, res, body) {
  const upstream = http.request({ hostname: '127.0.0.1', port: 3333, path: req.url, method: req.method, headers: req.headers }, incoming => {
    if (req.url?.startsWith('/api/storage/recall')) record({ method: req.method, path: req.url, status: incoming.statusCode, injected: false });
    res.writeHead(incoming.statusCode ?? 502, incoming.headers);
    incoming.pipe(res);
  });
  upstream.on('error', error => {
    record({ method: req.method, path: req.url, transportError: error.code });
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { code: 'proxy-upstream-unavailable', message: 'Acceptance upstream unavailable' } }));
  });
  if (body) upstream.end(body); else req.pipe(upstream);
}
const server = http.createServer(async (req, res) => {
  if (req.method !== 'PUT' || req.url !== '/api/storage/recall') { forward(req, res); return; }
  const chunks = [];
  try {
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const input = JSON.parse(body.toString('utf8'));
    const control = JSON.parse(readFileSync(controlPath, 'utf8'));
    if (control.failRecall === true && input.document?.episodeId === episodeId) {
      record({ method: req.method, path: req.url, status: 503, injected: true, expectedRevision: input.expectedRevision, seedEpisode: true });
      res.writeHead(503, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ error: { code: 'storage-unavailable', message: 'Acceptance-only injected transport failure' } }));
      return;
    }
    forward(req, res, body);
  } catch (error) {
    record({ method: req.method, path: req.url, proxyError: String(error) });
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { code: 'acceptance-proxy-error', message: 'Fault control or body invalid' } }));
  }
});
server.on('upgrade', (req, socket, head) => {
  const upstream = net.connect(3333, '127.0.0.1', () => {
    upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${req.rawHeaders.reduce((result, value, i, all) => i % 2 === 0 ? result + value + ': ' + all[i + 1] + '\r\n' : result, '')}\r\n`);
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
});
server.listen(3334, '127.0.0.1', () => record({ proxy: 'ready', port: 3334, upstream: 3333, databaseAccess: false }));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
