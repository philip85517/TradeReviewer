import { createServer, type Server, type Socket } from "node:net";
import { deflateSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";

import {
  BaoStockClient,
  BaoStockClientError,
  type BaoStockHistoryQuery,
} from "./baostock-client";

const SEPARATOR = "\x01";
const MARKER = Buffer.from("<![CDATA[]]>\n", "ascii");
const FIELDS = "date,time,code,open,high,low,close,volume,amount,adjustflag";

function crc32(value: Buffer) {
  let crc = 0xffffffff;
  for (const byte of value) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function responseFrame(
  messageType: string,
  body: string,
  compressed = false,
  newlineAfterChecksum = true,
) {
  const plain = Buffer.from(body, "utf8");
  const payload = compressed ? deflateSync(plain) : plain;
  const header = Buffer.from(
    `00.9.00${SEPARATOR}${messageType}${SEPARATOR}${String(
      payload.length,
    ).padStart(10, "0")}`,
    "ascii",
  );
  const checksum = crc32(Buffer.concat([header, payload]));
  return Buffer.concat([
    header,
    payload,
    Buffer.from(
      `${SEPARATOR}${checksum}${newlineAfterChecksum ? "\n" : ""}`,
      "ascii",
    ),
    MARKER,
  ]);
}

function loginResponse() {
  return responseFrame(
    "01",
    ["0", "success", "login", "anonymous", "20260915210000000", "0"].join(
      SEPARATOR,
    ),
    false,
    false,
  );
}

function historyResponse(
  code: string,
  page: number,
  rows: string[][],
  pageSize = 2_000,
  emptyData = false,
) {
  return responseFrame(
    "96",
    [
      "0",
      "success",
      "query_history_k_data_plus",
      "anonymous",
      String(page),
      String(pageSize),
      emptyData ? "" : JSON.stringify({ record: rows }),
      code,
      FIELDS,
      "2023-06-20",
      "2023-06-20",
      "60",
      "3",
    ].join(SEPARATOR),
    true,
  );
}

function row(code: string, time: string): string[] {
  return [
    "2023-06-20",
    time,
    code,
    "17.8500",
    "18.0400",
    "17.6800",
    "18.0200",
    "8922397",
    "159759899.0000",
    "3",
  ];
}

async function listen(
  handler: (socket: Socket) => void,
) {
  const server = createServer((socket) => {
    openSockets.add(socket);
    socket.once("close", () => openSockets.delete(socket));
    handler(socket);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server did not expose a port");
  }
  return { server, port: address.port };
}

const openServers: Server[] = [];
const openSockets = new Set<Socket>();

afterEach(async () => {
  for (const socket of openSockets) socket.destroy();
  await Promise.all(
    openServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          if (!server.listening) {
            resolve();
            return;
          }
          server.close(() => resolve());
        }),
    ),
  );
});

describe("BaoStock Node transport", () => {
  it("logs in anonymously, sends the documented query and decodes compressed pages", async () => {
    const requests: string[] = [];
    const { server, port } = await listen((socket) => {
      let input = "";
      socket.on("data", (chunk) => {
        input += chunk.toString("utf8");
        let newline = input.indexOf("\n");
        while (newline >= 0) {
          const request = input.slice(0, newline);
          input = input.slice(newline + 1);
          requests.push(request);
          const header = request.slice(0, 21);
          const type = header.slice(8, 10);
          if (type === "00") {
            socket.write(loginResponse());
          } else {
            const body = request.slice(21).split(SEPARATOR)[0];
            const parts = request.slice(21).split(SEPARATOR);
            const code = parts[4];
            if (body !== "query_history_k_data_plus" || !code) {
              socket.destroy(new Error("unexpected test request"));
              return;
            }
            const response = historyResponse(code, Number(parts[2]), [
              row(code, "20230620103000000"),
            ], 2_000);
            for (const chunk of [
              response.subarray(0, 7),
              response.subarray(7, 31),
              response.subarray(31),
            ]) {
              socket.write(chunk);
            }
          }
          newline = input.indexOf("\n");
        }
      });
    });
    openServers.push(server);

    const client = new BaoStockClient({
      host: "127.0.0.1",
      port,
      deadlineMs: 1_000,
    });
    const result = await client.queryHistoryKDataPlus({
      code: "SZ.000519",
      startDate: "2023-06-20",
      endDate: "2023-06-20",
    });

    expect(requests).toHaveLength(2);
    expect(requests[0]).toContain(
      `00.9.30${SEPARATOR}00${SEPARATOR}0000000024login${SEPARATOR}anonymous${SEPARATOR}123456${SEPARATOR}0`,
    );
    expect(requests[1]).toContain(
      `query_history_k_data_plus${SEPARATOR}anonymous${SEPARATOR}1${SEPARATOR}2000${SEPARATOR}sz.000519${SEPARATOR}${FIELDS}${SEPARATOR}2023-06-20${SEPARATOR}2023-06-20${SEPARATOR}60${SEPARATOR}3`,
    );
    const queryRequest = requests[1]!;
    const checksumSeparator = queryRequest.lastIndexOf(SEPARATOR);
    expect(Number(queryRequest.slice(checksumSeparator + 1))).toBe(
      crc32(Buffer.from(queryRequest.slice(0, checksumSeparator), "utf8")),
    );
    expect(result).toMatchObject({
      code: "sz.000519",
      pages: 1,
      truncated: false,
      fields: FIELDS.split(","),
      records: [row("sz.000519", "20230620103000000")],
    });
  });

  it("accepts BaoStock's empty data field as a valid empty page", async () => {
    const { server, port } = await listen((socket) => {
      let input = "";
      socket.on("data", (chunk) => {
        input += chunk.toString("utf8");
        const newline = input.indexOf("\n");
        if (newline < 0) return;
        const request = input.slice(0, newline);
        input = input.slice(newline + 1);
        if (request.slice(8, 10) === "00") {
          socket.write(loginResponse());
          return;
        }
        const parts = request.slice(21).split(SEPARATOR);
        socket.write(historyResponse(parts[4]!, Number(parts[2]), [], 2_000, true));
      });
    });
    openServers.push(server);

    const result = await new BaoStockClient({
      host: "127.0.0.1",
      port,
      deadlineMs: 1_000,
    }).queryHistoryKDataPlus({
      code: "sh.518880",
      startDate: "2024-01-01",
      endDate: "2024-01-01",
    });

    expect(result).toMatchObject({ pages: 1, truncated: false, records: [] });
  });

  it("stops at the configured page limit and marks a full final page truncated", async () => {
    let historyRequests = 0;
    const { server, port } = await listen((socket) => {
      let input = "";
      socket.on("data", (chunk) => {
        input += chunk.toString("utf8");
        const newline = input.indexOf("\n");
        if (newline < 0) return;
        const request = input.slice(0, newline);
        input = input.slice(newline + 1);
        const type = request.slice(8, 10);
        if (type === "00") {
          socket.write(loginResponse());
          return;
        }
        historyRequests += 1;
        const parts = request.slice(21).split(SEPARATOR);
        const code = parts[4]!;
        socket.write(
          historyResponse(
            code,
            Number(parts[2]),
            Array.from({ length: 2_000 }, (_, index) =>
              row(code, index === 0 ? "20230620103000000" : "20230620113000000"),
            ),
          ),
        );
      });
    });
    openServers.push(server);

    const result = await new BaoStockClient({
      host: "127.0.0.1",
      port,
      maxPages: 1,
      deadlineMs: 1_000,
    }).queryHistoryKDataPlus({
      code: "sh.600519",
      startDate: "2023-06-20",
      endDate: "2023-06-20",
    });

    expect(historyRequests).toBe(1);
    expect(result.records).toHaveLength(2_000);
    expect(result.truncated).toBe(true);
  });

  it("closes the socket and reports abort when the caller cancels a hanging response", async () => {
    let connected!: () => void;
    const connectedPromise = new Promise<void>((resolve) => {
      connected = resolve;
    });
    let closed = false;
    let resolveClosed!: () => void;
    const closedPromise = new Promise<void>((resolve) => {
      resolveClosed = resolve;
    });
    const { server, port } = await listen((socket) => {
      socket.once("close", () => {
        closed = true;
        resolveClosed();
      });
      socket.once("data", () => connected());
    });
    openServers.push(server);
    const controller = new AbortController();
    const promise = new BaoStockClient({
      host: "127.0.0.1",
      port,
      deadlineMs: 1_000,
      signal: controller.signal,
    }).queryHistoryKDataPlus({
      code: "sz.000519",
      startDate: "2023-06-20",
      endDate: "2023-06-20",
    });
    await connectedPromise;
    controller.abort();

    await expect(promise).rejects.toEqual(
      expect.objectContaining<Partial<BaoStockClientError>>({
        code: "aborted",
      }),
    );
    await Promise.race([
      closedPromise,
      new Promise((resolve) => setTimeout(resolve, 100)),
    ]);
    expect(closed).toBe(true);
  });

  it("enforces a total deadline and response byte limit", async () => {
    const { server, port } = await listen((socket) => {
      socket.once("data", () => {
        socket.write(Buffer.alloc(256, 65));
      });
    });
    openServers.push(server);
    await expect(
      new BaoStockClient({
        host: "127.0.0.1",
        port,
        deadlineMs: 500,
        maxResponseBytes: 64,
      }).queryHistoryKDataPlus({
        code: "sz.000519",
        startDate: "2023-06-20",
        endDate: "2023-06-20",
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<BaoStockClientError>>({
        code: "response-limit",
      }),
    );
  });

  it.each([
    { query: { code: "000519", startDate: "2023-06-20", endDate: "2023-06-20" } },
    { query: { code: "sz.000519", startDate: "2023-02-30", endDate: "2023-03-01" } },
    { query: { code: "sz.000519", startDate: "2023-06-21", endDate: "2023-06-20" } },
  ])("rejects invalid query input before opening a socket", async ({ query }) => {
    await expect(
      new BaoStockClient({ host: "127.0.0.1", port: 1 }).queryHistoryKDataPlus(
        query as BaoStockHistoryQuery,
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<BaoStockClientError>>({
        code: "invalid-request",
      }),
    );
  });
});
