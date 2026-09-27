import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const modeFile = path.join(directory, "fault-mode.json");
const listenPort = Number.parseInt(process.env.FAULT_PROXY_PORT ?? "3051", 10);
const upstream = new URL(
  process.env.FAULT_UPSTREAM_ORIGIN ?? "http://127.0.0.1:3049",
);

const recallSavePath = "/api/storage/recall";
const supportedModes = new Set(["http500", "http409"]);

function readMode() {
  try {
    const value = JSON.parse(fs.readFileSync(modeFile, "utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { mode: "pass", remaining: 0 };
    }
    const mode = value.mode;
    if (mode === "pass") return { mode: "pass", remaining: 0 };
    if (!supportedModes.has(mode)) return { mode: "pass", remaining: 0 };
    // This harness deliberately accepts only a single-shot budget. Anything
    // else fails open so a stale control file cannot create repeated faults.
    const remaining = value.remaining === undefined
      ? 1
      : value.remaining === 1
        ? 1
        : 0;
    return { mode, remaining };
  } catch {
    // A missing or malformed control file fails open to normal proxying.
    return { mode: "pass", remaining: 0 };
  }
}

function writeMode(mode, remaining) {
  const temporary = `${modeFile}.${process.pid}.tmp`;
  fs.writeFileSync(
    temporary,
    `${JSON.stringify({ mode, remaining })}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  fs.renameSync(temporary, modeFile);
}

function consumeOneShot(mode) {
  const nextRemaining = mode.remaining - 1;
  try {
    writeMode(nextRemaining > 0 ? mode.mode : "pass", nextRemaining);
    return true;
  } catch {
    // Do not synthesize a repeatable fault if the control file cannot be reset.
    return false;
  }
}

function sendSyntheticFault(response, mode) {
  const status = mode === "http409" ? 409 : 500;
  const body = JSON.stringify({
    error: mode === "http409"
      ? { code: "conflict", message: "Synthetic stale Recall revision" }
      : { code: "storage-unavailable", message: "Synthetic Recall save failure" },
  });
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body),
    "content-type": "application/json; charset=utf-8",
  });
  response.end(body);
}

function proxyRequest(request, response) {
  const headers = { ...request.headers };
  headers.host = upstream.host;
  const upstreamRequest = http.request(
    {
      hostname: upstream.hostname,
      port: upstream.port || 80,
      path: request.url,
      method: request.method,
      headers,
    },
    upstreamResponse => {
      response.writeHead(
        upstreamResponse.statusCode ?? 502,
        upstreamResponse.headers,
      );
      upstreamResponse.pipe(response);
    },
  );
  upstreamRequest.on("error", () => {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    const body = JSON.stringify({
      error: {
        code: "upstream-unavailable",
        message: "Recall upstream unavailable",
      },
    });
    response.writeHead(502, {
      "cache-control": "no-store",
      "content-length": Buffer.byteLength(body),
      "content-type": "application/json; charset=utf-8",
    });
    response.end(body);
  });
  request.on("aborted", () => upstreamRequest.destroy());
  request.pipe(upstreamRequest);
}

const server = http.createServer((request, response) => {
  let pathname;
  try {
    pathname = new URL(request.url ?? "/", "http://recall-proxy.local").pathname;
  } catch {
    proxyRequest(request, response);
    return;
  }

  const isRecallSave = request.method === "PUT" && pathname === recallSavePath;
  const mode = isRecallSave ? readMode() : { mode: "pass", remaining: 0 };
  if (isRecallSave && mode.remaining > 0 && consumeOneShot(mode)) {
    // Do not read, record, or forward the request body for a synthetic fault.
    request.resume();
    sendSyntheticFault(response, mode.mode);
    return;
  }
  proxyRequest(request, response);
});

server.on("clientError", (_error, socket) => socket.destroy());
server.listen(listenPort, "127.0.0.1", () => {
  process.stdout.write(
    `Recall fault proxy listening on 127.0.0.1:${listenPort} -> ${upstream.origin}\n`,
  );
});

function close() {
  server.close(() => process.exit(0));
}

process.once("SIGINT", close);
process.once("SIGTERM", close);
