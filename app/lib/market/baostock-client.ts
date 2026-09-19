import { createConnection, type Socket } from "node:net";
import { inflateSync } from "node:zlib";

const MESSAGE_SEPARATOR = "\x01";
const RESPONSE_MARKER = Buffer.from("<![CDATA[]]>\n", "ascii");
const CLIENT_VERSION = "00.9.30";
const LOGIN_REQUEST_TYPE = "00";
const HISTORY_REQUEST_TYPE = "95";
const HISTORY_RESPONSE_TYPE = "96";
const MESSAGE_HEADER_LENGTH = 21;
const HISTORY_PAGE_SIZE = 2_000;
const DEFAULT_HOST = "public-api.baostock.com";
const DEFAULT_PORT = 10_030;
const DEFAULT_DEADLINE_MS = 5_000;
const DEFAULT_MAX_PAGES = 8;
const DEFAULT_MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CODE_PATTERN = /^(?:sh|sz)\.\d{6}$/i;

export type BaoStockHistoryQuery = {
  code: string;
  startDate: string;
  endDate: string;
  frequency?: "60";
  adjustflag?: "3";
  signal?: AbortSignal;
};

export type BaoStockHistoryResponse = {
  code: string;
  fields: string[];
  records: string[][];
  pages: number;
  truncated: boolean;
};

export type BaoStockHistoryClient = {
  queryHistoryKDataPlus(
    query: BaoStockHistoryQuery,
  ): Promise<BaoStockHistoryResponse>;
};

export type BaoStockClientErrorCode =
  | "aborted"
  | "timeout"
  | "connection"
  | "protocol"
  | "response-limit"
  | "server"
  | "invalid-request";

export class BaoStockClientError extends Error {
  constructor(
    readonly code: BaoStockClientErrorCode,
    message: string,
    readonly serverCode?: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "BaoStockClientError";
  }
}

export type BaoStockClientOptions = {
  host?: string;
  port?: number;
  /** Total time for login and all paginated history responses. Capped at 5s. */
  deadlineMs?: number;
  maxPages?: number;
  maxResponseBytes?: number;
  signal?: AbortSignal;
};

type WireResponse = {
  messageType: string;
  body: string;
};

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

function messageHeader(messageType: string, body: string) {
  const bodyLength = Buffer.byteLength(body, "utf8");
  return `${CLIENT_VERSION}${MESSAGE_SEPARATOR}${messageType}${MESSAGE_SEPARATOR}${String(
    bodyLength,
  ).padStart(10, "0")}`;
}

function requestFrame(messageType: string, body: string) {
  const header = messageHeader(messageType, body);
  const headerAndBody = `${header}${body}`;
  const checksum = crc32(Buffer.from(headerAndBody, "utf8"));
  return Buffer.from(
    `${headerAndBody}${MESSAGE_SEPARATOR}${checksum}\n`,
    "utf8",
  );
}

function validDate(value: string) {
  if (!DATE_PATTERN.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === value
  );
}

function normalizedQuery(query: BaoStockHistoryQuery) {
  const code = query.code.trim().toLowerCase();
  if (!CODE_PATTERN.test(code)) {
    throw new BaoStockClientError(
      "invalid-request",
      "BaoStock 证券代码必须是 sh.###### 或 sz.######",
    );
  }
  if (!validDate(query.startDate) || !validDate(query.endDate)) {
    throw new BaoStockClientError(
      "invalid-request",
      "BaoStock 日期必须使用有效的 YYYY-MM-DD 格式",
    );
  }
  if (query.endDate < query.startDate) {
    throw new BaoStockClientError(
      "invalid-request",
      "BaoStock 起始日期不能晚于结束日期",
    );
  }
  if (query.frequency !== undefined && query.frequency !== "60") {
    throw new BaoStockClientError(
      "invalid-request",
      "BaoStock transport 目前仅支持 60 分钟频率",
    );
  }
  if (query.adjustflag !== undefined && query.adjustflag !== "3") {
    throw new BaoStockClientError(
      "invalid-request",
      "BaoStock 行情固定使用不复权 adjustflag=3",
    );
  }
  return {
    ...query,
    code,
    frequency: "60" as const,
    adjustflag: "3" as const,
  };
}

function abortedError(reason?: unknown) {
  return new BaoStockClientError(
    "aborted",
    reason instanceof Error && reason.message
      ? reason.message
      : "BaoStock 行情请求已取消",
    undefined,
    reason instanceof Error ? { cause: reason } : undefined,
  );
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) throw abortedError(signal.reason);
}

function composeSignals(signals: Array<AbortSignal | undefined>) {
  const active = signals.filter(
    (signal): signal is AbortSignal => signal !== undefined,
  );
  const controller = new AbortController();
  const listeners = active.map((signal) => {
    const listener = () => {
      if (!controller.signal.aborted) controller.abort(signal.reason);
    };
    if (signal.aborted) listener();
    else signal.addEventListener("abort", listener, { once: true });
    return { signal, listener };
  });

  return {
    signal: controller.signal,
    cleanup() {
      for (const { signal, listener } of listeners) {
        signal.removeEventListener("abort", listener);
      }
    },
  };
}

function socketConnection(
  host: string,
  port: number,
  signal: AbortSignal,
): Promise<Socket> {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port });
    let settled = false;

    const cleanup = () => {
      socket.off("connect", onConnect);
      socket.off("error", onError);
      signal.removeEventListener("abort", onAbort);
    };
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const onConnect = () =>
      finish(() => {
        socket.setNoDelay(true);
        resolve(socket);
      });
    const onError = (error: Error) =>
      finish(() =>
        reject(
          new BaoStockClientError(
            "connection",
            `BaoStock 服务器连接失败：${error.message}`,
            undefined,
            { cause: error },
          ),
        ),
      );
    const onAbort = () =>
      finish(() => {
        socket.destroy();
        reject(abortedError(signal.reason));
      });

    socket.once("connect", onConnect);
    socket.once("error", onError);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function writeSocket(socket: Socket, payload: Buffer, signal: AbortSignal) {
  throwIfAborted(signal);
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      socket.off("error", onError);
      signal.removeEventListener("abort", onAbort);
    };
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const onError = (error: Error) =>
      finish(() => reject(error));
    const onAbort = () =>
      finish(() => {
        socket.destroy();
        reject(abortedError(signal.reason));
      });
    socket.once("error", onError);
    signal.addEventListener("abort", onAbort, { once: true });
    socket.write(payload, (error?: Error | null) => {
      if (error) finish(() => reject(error));
      else finish(resolve);
    });
  });
}

class WireFrameReader {
  private buffer = Buffer.alloc(0);
  private readonly frames: Buffer[] = [];
  private readonly pending: Array<{
    resolve: (frame: Buffer) => void;
    reject: (error: unknown) => void;
    cleanup: () => void;
  }> = [];
  private terminalError: unknown;
  private disposed = false;

  constructor(
    private readonly socket: Socket,
    private readonly maxResponseBytes: number,
    private readonly signal: AbortSignal,
  ) {
    // Install the data listener before the first write. Node may receive a
    // response as soon as the request leaves the kernel; keeping one reader
    // attached avoids a write/read listener gap and queues complete frames.
    socket.on("data", this.onData);
    socket.on("error", this.onError);
    socket.on("close", this.onClose);
  }

  private takeFrame() {
    const markerIndex = this.buffer.indexOf(RESPONSE_MARKER);
    if (markerIndex < 0) return undefined;
    if (markerIndex > this.maxResponseBytes) {
      throw new BaoStockClientError(
        "response-limit",
        `BaoStock 响应超过 ${this.maxResponseBytes} 字节上限`,
      );
    }
    const frame = this.buffer.subarray(0, markerIndex);
    this.buffer = this.buffer.subarray(markerIndex + RESPONSE_MARKER.length);
    return frame;
  }

  private drain() {
    while (this.frames.length > 0 && this.pending.length > 0) {
      const frame = this.frames.shift()!;
      const request = this.pending.shift()!;
      request.cleanup();
      request.resolve(frame);
    }
    if (this.terminalError !== undefined) {
      while (this.pending.length > 0) {
        const request = this.pending.shift()!;
        request.cleanup();
        request.reject(this.terminalError);
      }
    }
  }

  private fail(error: unknown) {
    if (this.terminalError !== undefined) return;
    this.terminalError = error;
    this.drain();
  }

  private readonly onData = (chunk: Buffer) => {
    if (this.disposed) return;
    this.buffer = Buffer.concat([this.buffer, chunk]);
    if (this.buffer.length > this.maxResponseBytes + RESPONSE_MARKER.length) {
      this.fail(
        new BaoStockClientError(
          "response-limit",
          `BaoStock 响应超过 ${this.maxResponseBytes} 字节上限`,
        ),
      );
      this.socket.destroy();
      return;
    }
    try {
      let frame: Buffer | undefined;
      while ((frame = this.takeFrame()) !== undefined) {
        this.frames.push(frame);
      }
      this.drain();
    } catch (error) {
      this.fail(error);
      this.socket.destroy();
    }
  };

  private readonly onError = (error: Error) => {
    if (!this.disposed) {
      this.fail(
        new BaoStockClientError(
          "connection",
          `BaoStock 服务器连接失败：${error.message}`,
          undefined,
          { cause: error },
        ),
      );
    }
  };

  private readonly onClose = () => {
    if (!this.disposed) {
      this.fail(new BaoStockClientError("connection", "BaoStock 连接提前关闭"));
    }
  };

  read() {
    throwIfAborted(this.signal);
    if (this.frames.length > 0) return Promise.resolve(this.frames.shift()!);
    if (this.terminalError !== undefined) {
      return Promise.reject(this.terminalError);
    }

    return new Promise<Buffer>((resolve, reject) => {
      let settled = false;
      const onAbort = () => {
        if (settled) return;
        settled = true;
        this.signal.removeEventListener("abort", onAbort);
        const index = this.pending.findIndex((request) => request.resolve === resolve);
        if (index >= 0) this.pending.splice(index, 1);
        reject(abortedError(this.signal.reason));
      };
      const cleanup = () => {
        this.signal.removeEventListener("abort", onAbort);
        settled = true;
      };
      this.pending.push({ resolve, reject, cleanup });
      this.signal.addEventListener("abort", onAbort, { once: true });
      this.drain();
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.socket.off("data", this.onData);
    // Keep error/close listeners through destroy so a late socket error is
    // handled; they are removed once the socket reports close.
    const cleanup = () => {
      this.socket.off("error", this.onError);
      this.socket.off("close", this.onClose);
      this.socket.off("close", cleanup);
    };
    if (this.socket.destroyed) cleanup();
    else {
      this.socket.once("close", cleanup);
      this.socket.destroy();
    }
  }
}

function decodeWireResponse(frame: Buffer, maxResponseBytes: number): WireResponse {
  if (frame.length < MESSAGE_HEADER_LENGTH) {
    throw new BaoStockClientError("protocol", "BaoStock 响应头长度不足");
  }
  const header = frame.subarray(0, MESSAGE_HEADER_LENGTH).toString("ascii");
  const firstSeparator = header.indexOf(MESSAGE_SEPARATOR);
  const secondSeparator = header.indexOf(
    MESSAGE_SEPARATOR,
    firstSeparator + MESSAGE_SEPARATOR.length,
  );
  if (firstSeparator !== 7 || secondSeparator !== 10) {
    throw new BaoStockClientError("protocol", "BaoStock 响应头格式无效");
  }
  const messageType = header.slice(firstSeparator + 1, secondSeparator);
  const bodyLengthText = header.slice(secondSeparator + 1);
  if (!/^\d{10}$/.test(bodyLengthText)) {
    throw new BaoStockClientError("protocol", "BaoStock 响应体长度无效");
  }
  const bodyLength = Number(bodyLengthText);
  const bodyStart = MESSAGE_HEADER_LENGTH;
  const bodyEnd = bodyStart + bodyLength;
  if (!Number.isSafeInteger(bodyLength) || bodyEnd > frame.length) {
    throw new BaoStockClientError("protocol", "BaoStock 响应体不完整");
  }
  const trailer = frame.subarray(bodyEnd).toString("ascii");
  // The public server omits the newline after the login checksum but keeps it
  // after compressed history responses. Both forms precede the CDATA marker
  // that the frame reader already removed.
  if (!/^\x01\d+\n?$/.test(trailer)) {
    throw new BaoStockClientError("protocol", "BaoStock 响应校验尾格式无效");
  }

  let payload = frame.subarray(bodyStart, bodyEnd);
  if (messageType === HISTORY_RESPONSE_TYPE) {
    try {
      payload = inflateSync(payload, { maxOutputLength: maxResponseBytes });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ERR_BUFFER_TOO_LARGE"
      ) {
        throw new BaoStockClientError(
          "response-limit",
          `BaoStock 解压响应超过 ${maxResponseBytes} 字节上限`,
        );
      }
      throw new BaoStockClientError(
        "protocol",
        "BaoStock 压缩响应无法解压",
        undefined,
        { cause: error },
      );
    }
  }
  return {
    messageType,
    body: payload.toString("utf8"),
  };
}

function responseParts(response: WireResponse, expectedType: string) {
  if (response.messageType !== expectedType) {
    throw new BaoStockClientError(
      "protocol",
      `BaoStock 响应类型无效：期望 ${expectedType}，实际 ${response.messageType}`,
    );
  }
  const parts = response.body.split(MESSAGE_SEPARATOR);
  if (parts.length < 2) {
    throw new BaoStockClientError("protocol", "BaoStock 响应体字段不足");
  }
  if (parts[0] !== "0") {
    throw new BaoStockClientError(
      "server",
      parts[1] || `BaoStock 服务器返回错误 ${parts[0]}`,
      parts[0],
    );
  }
  return parts;
}

function parseHistoryResponse(
  response: WireResponse,
  expectedCode: string,
) {
  const parts = responseParts(response, HISTORY_RESPONSE_TYPE);
  if (parts.length < 13) {
    throw new BaoStockClientError("protocol", "BaoStock 历史响应字段不足");
  }
  const code = parts[7];
  const fieldsText = parts[8];
  if (
    typeof code !== "string" ||
    code.toLowerCase() !== expectedCode.toLowerCase() ||
    typeof fieldsText !== "string" ||
    fieldsText.trim() === ""
  ) {
    throw new BaoStockClientError("protocol", "BaoStock 历史响应标的或字段不匹配");
  }
  let records: unknown;
  if ((parts[6] ?? "").trim() === "") {
    // The official ResultData.setData treats an empty data field as an empty
    // page. BaoStock uses this for valid no-history responses.
    records = [];
  } else {
    let decoded: unknown;
    try {
      decoded = JSON.parse(parts[6] ?? "");
    } catch (error) {
      throw new BaoStockClientError(
        "protocol",
        "BaoStock 历史响应记录不是有效 JSON",
        undefined,
        { cause: error },
      );
    }
    records = (decoded as { record?: unknown })?.record;
  }
  if (
    !Array.isArray(records) ||
    !records.every(
      (record) =>
        Array.isArray(record) &&
        record.every((value) => typeof value === "string"),
    )
  ) {
    throw new BaoStockClientError("protocol", "BaoStock 历史响应记录格式无效");
  }
  const fields = fieldsText.split(",").map((field) => field.trim());
  if (
    fields.some((field) => field === "") ||
    records.some((record) => record.length !== fields.length)
  ) {
    throw new BaoStockClientError("protocol", "BaoStock 历史响应列数不匹配");
  }
  const currentPage = Number(parts[4]);
  const pageSize = Number(parts[5]);
  if (
    !Number.isInteger(currentPage) ||
    currentPage < 1 ||
    !Number.isInteger(pageSize) ||
    pageSize < 1
  ) {
    throw new BaoStockClientError("protocol", "BaoStock 历史响应分页字段无效");
  }
  return { code, fields, records, currentPage, pageSize };
}

export class BaoStockClient implements BaoStockHistoryClient {
  private readonly host: string;
  private readonly port: number;
  private readonly deadlineMs: number;
  private readonly maxPages: number;
  private readonly maxResponseBytes: number;
  private readonly signal?: AbortSignal;

  constructor(options: BaoStockClientOptions = {}) {
    this.host = options.host ?? DEFAULT_HOST;
    this.port = options.port ?? DEFAULT_PORT;
    this.deadlineMs = Math.min(
      5_000,
      Math.max(1, Math.floor(options.deadlineMs ?? DEFAULT_DEADLINE_MS)),
    );
    this.maxPages = Math.max(
      1,
      Math.floor(options.maxPages ?? DEFAULT_MAX_PAGES),
    );
    this.maxResponseBytes = Math.max(
      MESSAGE_HEADER_LENGTH + RESPONSE_MARKER.length,
      Math.floor(options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES),
    );
    this.signal = options.signal;
  }

  async queryHistoryKDataPlus(
    query: BaoStockHistoryQuery,
  ): Promise<BaoStockHistoryResponse> {
    const request = normalizedQuery(query);
    const deadlineController = new AbortController();
    const composed = composeSignals([
      this.signal,
      request.signal,
      deadlineController.signal,
    ]);
    const deadlineTimer = setTimeout(() => {
      deadlineController.abort(
        new BaoStockClientError(
          "timeout",
          `BaoStock 请求超过 ${this.deadlineMs}ms 截止时间`,
        ),
      );
    }, this.deadlineMs);
    let socket: Socket | undefined;
    let reader: WireFrameReader | undefined;
    try {
      throwIfAborted(composed.signal);
      socket = await socketConnection(this.host, this.port, composed.signal);
      reader = new WireFrameReader(
        socket,
        this.maxResponseBytes,
        composed.signal,
      );

      const loginBody = ["login", "anonymous", "123456", "0"].join(
        MESSAGE_SEPARATOR,
      );
      await writeSocket(
        socket,
        requestFrame(LOGIN_REQUEST_TYPE, loginBody),
        composed.signal,
      );
      responseParts(
        decodeWireResponse(await reader.read(), this.maxResponseBytes),
        "01",
      );

      const records: string[][] = [];
      let fields: string[] | undefined;
      let pages = 0;
      let truncated = false;
      for (let page = 1; page <= this.maxPages; page += 1) {
        throwIfAborted(composed.signal);
        const historyBody = [
          "query_history_k_data_plus",
          "anonymous",
          String(page),
          String(HISTORY_PAGE_SIZE),
          request.code,
          "date,time,code,open,high,low,close,volume,amount,adjustflag",
          request.startDate,
          request.endDate,
          request.frequency,
          request.adjustflag,
        ].join(MESSAGE_SEPARATOR);
        await writeSocket(
          socket,
          requestFrame(HISTORY_REQUEST_TYPE, historyBody),
          composed.signal,
        );
        const current = parseHistoryResponse(
          decodeWireResponse(await reader.read(), this.maxResponseBytes),
          request.code,
        );
        pages += 1;
        if (current.currentPage !== page) {
          throw new BaoStockClientError(
            "protocol",
            `BaoStock 返回了错误页码：期望 ${page}，实际 ${current.currentPage}`,
          );
        }
        if (!fields) fields = current.fields;
        else if (fields.join(",") !== current.fields.join(",")) {
          throw new BaoStockClientError(
            "protocol",
            "BaoStock 分页响应字段不一致",
          );
        }
        records.push(...current.records);
        if (current.records.length < current.pageSize) break;
        if (page === this.maxPages) {
          truncated = true;
          break;
        }
      }
      return {
        code: request.code,
        fields: fields ?? [
          "date",
          "time",
          "code",
          "open",
          "high",
          "low",
          "close",
          "volume",
          "amount",
          "adjustflag",
        ],
        records,
        pages,
        truncated,
      };
    } catch (error) {
      if (error instanceof BaoStockClientError) {
        if (
          composed.signal.aborted &&
          error.code === "aborted" &&
          deadlineController.signal.aborted &&
          deadlineController.signal.reason instanceof BaoStockClientError &&
          deadlineController.signal.reason.code === "timeout"
        ) {
          throw deadlineController.signal.reason;
        }
        throw error;
      }
      if (composed.signal.aborted) {
        const reason = composed.signal.reason;
        if (reason instanceof BaoStockClientError) throw reason;
        throw abortedError(reason);
      }
      throw new BaoStockClientError(
        "connection",
        error instanceof Error
          ? `BaoStock 请求失败：${error.message}`
          : "BaoStock 请求失败",
        undefined,
        error instanceof Error ? { cause: error } : undefined,
      );
    } finally {
      clearTimeout(deadlineTimer);
      composed.cleanup();
      reader?.dispose();
      socket?.destroy();
    }
  }
}

export function createBaoStockClient(options: BaoStockClientOptions = {}) {
  return new BaoStockClient(options);
}
