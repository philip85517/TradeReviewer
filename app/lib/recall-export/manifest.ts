import { marketTimeZone, marketTradingDate } from "../market/trading-date";
import type { NormalizedDrawing } from "../chart/drawings";
import type {
  RecallDocument,
  RecallSnapshot,
} from "../recall/types";
import type { TradeEpisode, TradeExecution } from "../trades/types";
import type {
  RecallExportFile,
  RecallExportManifest,
  RecallExportOptions,
  RecallExportOrder,
  RecallExportSnapshot,
  RecallExportSource,
  RecallExportTextEntry,
  RecallExportWarning,
} from "./types";

const PNG_SIGNATURE = [
  0x89, 0x50, 0x4e, 0x47,
  0x0d, 0x0a, 0x1a, 0x0a,
];
const KNOWN_MARKET_TIME_ZONES = new Set([
  "US",
  "HK",
  "CN-SH",
  "CN-SZ",
]);

export class RecallExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecallExportError";
  }
}

type TextOccurrence = {
  snapshotId: string;
  drawing: NormalizedDrawing;
  textRevision: string;
  ownerId: string;
  key: string;
};

type SourceSelection = {
  source: RecallExportSource;
  document: RecallDocument;
};

export function selectRecallExportDocument(
  document: RecallDocument,
  source: RecallExportSource = "draft",
): SourceSelection {
  if (source === "completed") {
    if (!document.lastCompleted) {
      throw new RecallExportError("没有可导出的上次完成版本");
    }
    return { source, document: document.lastCompleted };
  }
  return { source, document };
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (ArrayBuffer.isView(value)) return value;
  for (const key of Reflect.ownKeys(value)) {
    const child = (value as Record<PropertyKey, unknown>)[key];
    if (child !== null && typeof child === "object" && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return Object.freeze(value);
}

function stableTextHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function textRevisionOf(drawing: NormalizedDrawing) {
  return drawing.textRevision === undefined
    ? `legacy-${stableTextHash(drawing.text ?? "")}`
    : String(drawing.textRevision);
}

function sanitizeSegment(value: string | undefined, fallback: string) {
  const sanitized = (value ?? fallback)
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, "_")
    .replace(/[. ]+$/g, "")
    .trim();
  return sanitized || fallback;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function validTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value;
  } catch {
    return "UTC";
  }
}

function episodeTimeZone(episode: TradeEpisode) {
  const sourceTimeZone = episode.executions
    .map((execution) => execution.source.sourceTimezone?.trim())
    .find((value): value is string => Boolean(value));
  if (sourceTimeZone) {
    const timeZone = validTimeZone(sourceTimeZone);
    return { timeZone, fallback: timeZone === "UTC" && sourceTimeZone !== "UTC" };
  }

  const market = episode.instrument.market.toUpperCase();
  const timeZone = marketTimeZone(market);
  return {
    timeZone,
    fallback: !KNOWN_MARKET_TIME_ZONES.has(market),
  };
}

function dateParts(timestamp: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(new Date(timestamp))
    .filter((part) => part.type !== "literal")
    .reduce<Record<string, string>>((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});
  return parts;
}

function formatTimestamp(timestamp: string | undefined, timeZone: string) {
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) return "未知";
  const parts = dateParts(timestamp, timeZone);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} (${timeZone})`;
}

function markdownText(value: string) {
  return value.replace(/([\\`*_{}\[\]()<>#+.!|])/g, "\\$1");
}

function markdownTableText(value: string) {
  return markdownText(value).replace(/\r?\n/g, " ");
}

function decodeBase64(value: string): number[] {
  const normalized = value.replace(/[\t\n\r ]/g, "");
  if (!normalized || normalized.length % 4 === 1 || /[^A-Za-z0-9+/=]/.test(normalized)) {
    throw new RecallExportError("留存图片不是有效的 Base64 数据");
  }
  const output: number[] = [];
  for (let index = 0; index < normalized.length; index += 4) {
    const a = base64Value(normalized[index]);
    const b = base64Value(normalized[index + 1]);
    const c = normalized[index + 2] === "=" ? 0 : base64Value(normalized[index + 2]);
    const d = normalized[index + 3] === "=" ? 0 : base64Value(normalized[index + 3]);
    if (a < 0 || b < 0 || c < 0 || d < 0) {
      throw new RecallExportError("留存图片不是有效的 Base64 数据");
    }
    output.push((a << 2) | (b >> 4));
    if (normalized[index + 2] !== "=") output.push(((b & 15) << 4) | (c >> 2));
    if (normalized[index + 3] !== "=") output.push(((c & 3) << 6) | d);
  }
  return output;
}

function base64Value(value: string | undefined) {
  if (!value) return -1;
  const code = value.charCodeAt(0);
  if (code >= 65 && code <= 90) return code - 65;
  if (code >= 97 && code <= 122) return code - 71;
  if (code >= 48 && code <= 57) return code + 4;
  if (value === "+") return 62;
  if (value === "/") return 63;
  return -1;
}

function isStructurallyValidPng(bytes: readonly number[]) {
  if (bytes.length < 33 || PNG_SIGNATURE.some((value, index) => bytes[index] !== value)) return false;
  let offset = PNG_SIGNATURE.length;
  let hasHeader = false;
  let hasEnd = false;
  while (offset + 12 <= bytes.length) {
    const length = (
      (bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]
    ) >>> 0;
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7],
    );
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > bytes.length) return false;
    if (type === "IHDR") {
      if (length !== 13) return false;
      const width = ((bytes[offset + 8] << 24) | (bytes[offset + 9] << 16) | (bytes[offset + 10] << 8) | bytes[offset + 11]) >>> 0;
      const height = ((bytes[offset + 12] << 24) | (bytes[offset + 13] << 16) | (bytes[offset + 14] << 8) | bytes[offset + 15]) >>> 0;
      if (width === 0 || height === 0) return false;
      hasHeader = true;
    }
    if (type === "IEND") {
      if (length !== 0 || chunkEnd !== bytes.length) return false;
      hasEnd = true;
      break;
    }
    offset = chunkEnd;
  }
  return hasHeader && hasEnd;
}

function retainedPngBytes(dataUrl: string): number[] {
  const comma = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || comma < 0) {
    throw new RecallExportError("留存快照缺少可导出的图片数据");
  }
  const metadata = dataUrl.slice(5, comma).toLowerCase();
  if (!metadata.split(";").includes("base64") || !metadata.startsWith("image/png")) {
    throw new RecallExportError("留存快照图片必须是 Base64 PNG");
  }
  const bytes = decodeBase64(dataUrl.slice(comma + 1));
  if (!isStructurallyValidPng(bytes)) {
    throw new RecallExportError("留存快照不是有效 PNG，已停止导出以避免生成伪图片");
  }
  return bytes;
}

function selectSnapshots(
  snapshots: readonly RecallSnapshot[],
  order: RecallExportOrder | undefined,
) {
  const ids = order?.snapshotIds ?? snapshots.map((snapshot) => snapshot.id);
  const expected = new Set(snapshots.map((snapshot) => snapshot.id));
  if (ids.length !== snapshots.length || new Set(ids).size !== ids.length || ids.some((id) => !expected.has(id))) {
    throw new RecallExportError("导出预览的快照顺序已过期，请重新打开预览");
  }
  const byId = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  return ids.map((id) => byId.get(id) as RecallSnapshot);
}

function deriveTextOccurrences(snapshots: readonly RecallSnapshot[]) {
  const bySnapshot = new Map<string, TextOccurrence[]>();
  const previous = new Map<string, { text: string; revision: string; ownerId: string }>();
  for (const snapshot of snapshots) {
    const entries: TextOccurrence[] = [];
    for (const drawing of snapshot.drawings) {
      if (drawing.tool !== "text" || typeof drawing.text !== "string") continue;
      const textRevision = textRevisionOf(drawing);
      const prior = previous.get(drawing.id);
      const ownerId = drawing.recallOwnerId?.trim()
        || (prior && prior.text === drawing.text && prior.revision === textRevision
          ? prior.ownerId
          : snapshot.decisionId);
      const key = `${drawing.id}\u0000${textRevision}\u0000${ownerId}`;
      entries.push({ snapshotId: snapshot.id, drawing, textRevision, ownerId, key });
      previous.set(drawing.id, { text: drawing.text, revision: textRevision, ownerId });
    }
    bySnapshot.set(snapshot.id, entries);
  }
  return bySnapshot;
}

function orderedTextOccurrences(
  occurrences: readonly TextOccurrence[],
  requestedIds: readonly string[] | undefined,
) {
  if (!requestedIds) return [...occurrences];
  if (requestedIds.length !== occurrences.length || new Set(requestedIds).size !== requestedIds.length) {
    throw new RecallExportError("导出预览的文字顺序已过期，请重新打开预览");
  }
  const byKey = new Map<string, TextOccurrence>();
  const byId = new Map<string, TextOccurrence>();
  for (const occurrence of occurrences) {
    byKey.set(occurrence.key, occurrence);
    if (byId.has(occurrence.drawing.id)) byId.delete(occurrence.drawing.id);
    else byId.set(occurrence.drawing.id, occurrence);
  }
  const result = requestedIds.map((id) => byKey.get(id) ?? byId.get(id));
  if (result.some((occurrence) => !occurrence)) {
    throw new RecallExportError("导出预览的文字顺序已过期，请重新打开预览");
  }
  return result as TextOccurrence[];
}

function localDateForEpisode(episode: TradeEpisode, timeZone: string) {
  const executionDates = episode.executions
    .map((execution) => execution.executedAt)
    .filter((value) => Number.isFinite(Date.parse(value)));
  const first = executionDates.sort((left, right) => Date.parse(left) - Date.parse(right))[0]
    ?? episode.startedAt;
  // marketTradingDate intentionally falls back to UTC for unknown markets;
  // that would discard a recorded statement timezone. Use the explicit source
  // timezone whenever the market has no authoritative exchange timezone.
  const market = episode.instrument.market.toUpperCase();
  if (!KNOWN_MARKET_TIME_ZONES.has(market)) {
    const parts = dateParts(first, timeZone);
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  return marketTradingDate(first, market);
}

function elapsedLabel(episode: TradeEpisode) {
  if (!episode.endedAt) return "截至本次导出仍持仓";
  if (episode.executions.some((execution) => execution.source.timePrecision === "date-only")) {
    return "日期精度不足";
  }
  const start = Date.parse(episode.startedAt);
  const end = Date.parse(episode.endedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "未知";
  const totalSeconds = Math.floor((end - start) / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const values = [];
  if (days) values.push(`${days}天`);
  if (hours) values.push(`${hours}小时`);
  if (minutes) values.push(`${minutes}分钟`);
  if (seconds || values.length === 0) values.push(`${seconds}秒`);
  return values.join("");
}

function statusLabel(status: RecallDocument["status"]) {
  if (status === "completed") return "已完成";
  if (status === "needs-confirmation") return "待重新确认";
  return "进行中";
}

function warningMessages(
  document: RecallDocument,
  timeZone: string,
  timeZoneFallback: boolean,
) {
  const warnings: RecallExportWarning[] = [];
  if (!document.snapshots.some((snapshot) => snapshot.decisionId === "global")) {
    warnings.push({ code: "no-global-snapshot", message: "尚未留存全局总结图，导出将省略 global.png。" });
  }
  for (const decision of document.decisions) {
    if (!document.snapshots.some((snapshot) => snapshot.decisionId === decision.id)) {
      warnings.push({
        code: "missing-snapshot",
        decisionId: decision.id,
        message: `决策 ${document.decisions.indexOf(decision) + 1} 尚未留存快照。`,
      });
    }
  }
  if (document.snapshots.some((snapshot) => snapshot.decisionId === "unassigned")) {
    warnings.push({
      code: "unassigned-snapshot",
      message: "存在尚未分配决策的留存快照。",
    });
  }
  if (document.status !== "completed") {
    warnings.push({
      code: "unfinished",
      message: `${statusLabel(document.status)}复盘可导出已有留存内容，但不会确认回合完成。`,
    });
  }
  const hasWorkingDecisionDrafts = (document.working.decisionDrafts ?? [])
    .some((draft) => draft.drawings.length > 0);
  if (
    document.working.drawings.length > 0 ||
    (document.working.editingContext?.drawings.length ?? 0) > 0 ||
    hasWorkingDecisionDrafts
  ) {
    warnings.push({
      code: "working-content-excluded",
      message: "当前工作图或阶段编辑上下文仍有未留存绘图；导出仅包含已留存快照文字和图片。",
    });
  }
  if (timeZoneFallback) {
    warnings.push({
      code: "timezone-fallback",
      message: `未找到交易所或来源时区，已使用 ${timeZone}；请在文档中核对时间。`,
    });
  }
  return warnings;
}

function markdownExecutionRows(executions: readonly TradeExecution[]) {
  if (executions.length === 0) return "暂无成交记录。";
  const rows = executions.map((execution) => [
    execution.executedAt,
    execution.side === "buy" ? "买入" : "卖出",
    execution.quantity,
    execution.price,
    execution.fee,
  ]);
  return [
    "| 时间 | 方向 | 数量 | 价格 | 手续费 |",
    "| --- | --- | ---: | ---: | ---: |",
    ...rows.map((row) => `| ${row.map(markdownTableText).join(" | ")} |`),
  ].join("\n");
}

function buildMarkdownDocument(
  manifest: RecallExportManifest,
  document: RecallDocument,
  episode: TradeEpisode,
) {
  const lines = [
    `# ${markdownText(episode.instrument.name || episode.instrument.symbol)}（${markdownText(episode.instrument.symbol)}）复盘`,
    "",
    `- 标的：${markdownText(episode.instrument.name || episode.instrument.symbol)} / ${markdownText(episode.instrument.symbol)} / ${markdownText(episode.instrument.market)}`,
    `- 回合标识：${markdownText(episode.id)}`,
    `- 账户：${markdownText(episode.accountLabel)}`,
    `- 起始时间：${formatTimestamp(episode.startedAt, manifest.timezone)}`,
    `- 结束时间：${episode.endedAt ? formatTimestamp(episode.endedAt, manifest.timezone) : "截至本次导出仍持仓"}`,
    `- 时区：${manifest.timezone}`,
    `- 状态：${statusLabel(manifest.status)}`,
    `- 导出时间：${formatTimestamp(manifest.generatedAt, manifest.timezone)}`,
    `- 持仓时长：${elapsedLabel(episode)}`,
  ];
  const missing = manifest.warnings.filter((warning) => warning.code === "missing-snapshot");
  lines.push(`- 缺失快照：${missing.length ? missing.map((warning) => warning.message).join("；") : "无"}`);
  if (manifest.warnings.length > 0) {
    lines.push("", "## 导出提示");
    for (const warning of manifest.warnings) lines.push(`- ${markdownText(warning.message)}`);
  }

  const textByKey = new Map(manifest.textEntries.map((entry) => [entry.key, entry]));
  const grouped = new Map<string, RecallExportSnapshot[]>();
  for (const snapshot of manifest.snapshots) {
    const list = grouped.get(snapshot.decisionId) ?? [];
    list.push(snapshot);
    grouped.set(snapshot.decisionId, list);
  }
  for (const decision of document.decisions) {
    const snapshots = grouped.get(decision.id) ?? [];
    lines.push("", `## 决策 ${pad(document.decisions.indexOf(decision) + 1)}`);
    lines.push("", markdownExecutionRows(episode.executions.filter((execution) => decision.executionIds.includes(execution.id))));
    if (snapshots.length === 0) {
      lines.push("", "尚未留存快照。");
      continue;
    }
    snapshots.forEach((snapshot, index) => {
      lines.push("", `### 快照 ${pad(index + 1)} · ${snapshot.timeframe}`, "", `![${snapshot.timeframe}](${snapshot.imagePath})`);
      const entries = snapshot.textIds
        .map((key) => textByKey.get(key))
        .filter((entry): entry is RecallExportTextEntry => Boolean(entry && entry.sourceSnapshotId === snapshot.id));
      if (entries.length > 0) {
        lines.push("", "#### 文字");
        for (const entry of entries) {
          const references = entry.snapshotIds
            .map((snapshotId) => manifest.snapshots.findIndex((candidate) => candidate.id === snapshotId) + 1)
            .filter((index) => index > 0)
            .map((index) => `快照${pad(index)}`)
            .join("、");
          lines.push("", `**${markdownText(entry.text)}**`, `> 归属：${markdownText(entry.ownerId)}；修订：${markdownText(entry.textRevision)}；出现于：${references}`);
        }
      }
    });
  }

  const globalSnapshots = grouped.get("global") ?? [];
  if (globalSnapshots.length > 0) {
    lines.push("", "## 全局总结");
    for (const snapshot of globalSnapshots) {
      lines.push("", `![全局总结](${snapshot.imagePath})`);
      const entries = snapshot.textIds
        .map((key) => textByKey.get(key))
        .filter((entry): entry is RecallExportTextEntry => Boolean(entry && entry.sourceSnapshotId === snapshot.id));
      for (const entry of entries) lines.push("", `**${markdownText(entry.text)}**`);
    }
  }
  const unassigned = grouped.get("unassigned") ?? [];
  if (unassigned.length > 0) {
    lines.push("", "## 待分配快照");
    for (const snapshot of unassigned) lines.push("", `![${snapshot.timeframe}](${snapshot.imagePath})`);
  }

  return `${lines.join("\n")}\n`;
}

export function createRecallExportManifest(
  inputDocument: RecallDocument,
  episode: TradeEpisode,
  options: RecallExportOptions = {},
): RecallExportManifest {
  const selection = selectRecallExportDocument(inputDocument, options.source ?? "draft");
  const document = selection.document;
  const { timeZone, fallback: timeZoneFallback } = episodeTimeZone(episode);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(generatedAt))) {
    throw new RecallExportError("导出时间无效");
  }
  const snapshots = selectSnapshots(document.snapshots, options.order);
  if (options.order?.textIdsBySnapshot) {
    const providedIds = Object.keys(options.order.textIdsBySnapshot);
    const expectedIds = new Set(snapshots.map((snapshot) => snapshot.id));
    if (
      providedIds.length !== snapshots.length ||
      providedIds.some((id) => !expectedIds.has(id)) ||
      snapshots.some((snapshot) => !Object.prototype.hasOwnProperty.call(options.order?.textIdsBySnapshot, snapshot.id))
    ) {
      throw new RecallExportError("导出预览的文字顺序已过期，请重新打开预览");
    }
  }
  const textOccurrences = deriveTextOccurrences(document.snapshots);
  const textEntries: RecallExportTextEntry[] = [];
  const entriesByKey = new Map<string, RecallExportTextEntry>();
  const textIdsBySnapshot = new Map<string, string[]>();

  for (const snapshot of snapshots) {
    const requested = options.order?.textIdsBySnapshot?.[snapshot.id];
    const occurrences = orderedTextOccurrences(textOccurrences.get(snapshot.id) ?? [], requested);
    const ids: string[] = [];
    for (const occurrence of occurrences) {
      let entry = entriesByKey.get(occurrence.key);
      if (!entry) {
        entry = {
          key: occurrence.key,
          drawingId: occurrence.drawing.id,
          textRevision: occurrence.textRevision,
          ownerId: occurrence.ownerId,
          text: occurrence.drawing.text ?? "",
          snapshotIds: [snapshot.id],
          sourceSnapshotId: snapshot.id,
        };
        entriesByKey.set(occurrence.key, entry);
        textEntries.push(entry);
      } else if (!entry.snapshotIds.includes(snapshot.id)) {
        entry.snapshotIds = [...entry.snapshotIds, snapshot.id];
      }
      ids.push(entry.key);
    }
    textIdsBySnapshot.set(snapshot.id, ids);
  }

  const decisionCounts = new Map<string, number>();
  const decisionIndex = new Map(document.decisions.map((decision, index) => [decision.id, index + 1]));
  const manifestSnapshots: RecallExportSnapshot[] = snapshots.map((snapshot) => {
    const imagePath = snapshot.decisionId === "global"
      ? "images/global.png"
      : `images/${pad(decisionIndex.get(snapshot.decisionId) ?? 0)}_${pad((decisionCounts.get(snapshot.decisionId) ?? 0) + 1)}_${sanitizeSegment(snapshot.timeframe, "snapshot")}.png`;
    decisionCounts.set(snapshot.decisionId, (decisionCounts.get(snapshot.decisionId) ?? 0) + 1);
    return {
      id: snapshot.id,
      decisionId: snapshot.decisionId,
      timeframe: snapshot.timeframe,
      imagePath,
      textIds: textIdsBySnapshot.get(snapshot.id) ?? [],
    };
  });

  const firstDate = localDateForEpisode(episode, timeZone).replace(/-/g, "");
  const instrumentName = sanitizeSegment(episode.instrument.name, sanitizeSegment(episode.instrument.symbol, "未命名标的"));
  const symbol = sanitizeSegment(episode.instrument.symbol, "未知代码");
  const baseName = `${instrumentName}_${symbol}_${firstDate}`;
  const markdownName = `${baseName}_复盘.md`;
  const imageFiles: RecallExportFile[] = snapshots.map((snapshot, index) => ({
    path: manifestSnapshots[index].imagePath,
    kind: "image",
    mimeType: "image/png",
    bytes: retainedPngBytes(snapshot.imageDataUrl),
  }));
  const warnings = warningMessages(document, timeZone, timeZoneFallback);
  const manifestWithoutMarkdown = {
    source: selection.source,
    folderName: baseName,
    baseName,
    markdownName,
    timezone: timeZone,
    generatedAt,
    status: document.status,
    files: imageFiles,
    snapshots: manifestSnapshots,
    textEntries,
    warnings,
  } satisfies Omit<RecallExportManifest, "files"> & { files: RecallExportFile[] };
  const markdown = buildMarkdownDocument(manifestWithoutMarkdown, document, episode);
  const files: RecallExportFile[] = [
    ...imageFiles,
    {
      path: markdownName,
      kind: "markdown",
      mimeType: "text/markdown; charset=utf-8",
      bytes: Array.from(new TextEncoder().encode(markdown)),
    },
  ];
  return deepFreeze({ ...manifestWithoutMarkdown, files });
}

export function buildRecallMarkdown(manifest: RecallExportManifest) {
  const file = manifest.files.find((candidate) => candidate.kind === "markdown");
  if (!file) throw new RecallExportError("导出清单缺少 Markdown 文件");
  return new TextDecoder().decode(Uint8Array.from(file.bytes));
}
