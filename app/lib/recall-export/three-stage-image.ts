import { formatThreeStageDisplayDate, MAX_EXECUTION_ROWS, THREE_STAGE_EXPORT_FRAME, THREE_STAGE_LAYOUT, threeStagePreImagePixelBudget, threeStageTextPixelWidth } from "./three-stage-manifest";
import type { ThreeStageExportManifest, ThreeStageFinancialSummary } from "./three-stage-manifest";

export class ThreeStageImageError extends Error {
  constructor(message: string) { super(message); this.name = "ThreeStageImageError"; }
}
const COLORS = Object.freeze({ page: "#0b1220", surface: "#111a2b", chart: "#101722", text: "#e7edf6", secondary: "#adbbcf", muted: "#9cacc2", divider: "#243145", action: "#2f80ed", focus: "#77aef5", target: "#f3ba2f", stop: "#b6a1e8", up: "#26a69a", down: "#ef5350" });
const FONT = "-apple-system,BlinkMacSystemFont,Segoe UI,Noto Sans CJK SC,sans-serif";
function xmlText(value: string): string {
  return Array.from(value).filter(character => { const point = character.codePointAt(0) ?? 0; return point === 9 || point === 10 || point === 13 || point >= 32; }).join("").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\x27/g, "&apos;");
}
function attr(value: string): string { return xmlText(value); }
function imageHref(value: string | null): string { return value ? " href=\"" + attr(value) + "\"" : ""; }
function textLine(value: string, x: number, y: number, color: string, size: number, weight?: number): string {
  return "<text x=\"" + x + "\" y=\"" + y + "\" fill=\"" + color + "\" font-size=\"" + size + "\"" + (weight ? " font-weight=\"" + weight + "\"" : "") + " font-family=\"" + FONT + "\">" + xmlText(value) + "</text>";
}
function financialValue(value: string | null, currency: string | null, unit = "", reason: string | null = null): string {
  const displayUnit = unit === "share" || unit === "quantity" ? "股" : unit === "unit" ? "单位" : unit === "money" ? "" : unit;
  const suffix = [displayUnit, currency].filter(Boolean).join(" ");
  if (value === null || value === "") {
    const why = reason ? `（原因：${reason}）` : "";
    return `未提供${suffix ? `（单位：${suffix}）` : ""}${why}`;
  }
  return value + (suffix ? " " + suffix : "");
}
function financialLines(financial: ThreeStageFinancialSummary): string[] {
  const metricMap = new Map(financial.metrics.map(metric => [metric.key, metric]));
  const metric = (key: string, fallback: string) => { const value = metricMap.get(key); return value ? financialValue(value.value, value.currency, value.unit, value.reason) : fallback; };
  // Full bundle IDs/digests remain in the frozen manifest and dialog index. The
  // fixed PNG uses a bounded status so a long identity cannot clip the body.
  const source = financial.bundleId ? "财务来源：已接受留存组合 · 完整财务来源见对话框记录索引" : "财务来源：未提供已接受财务真值";
  const values = "实际净盈亏 " + metric("netPnl", "未提供") + " · 已实现净盈亏 " + metric("realizedNet", "未提供");
  const holdings = "持仓浮动盈亏 " + metric("unrealizedGross", "未提供") + " · 总手续费 " + metric("totalFees", "未提供");
  const capital = financial.capitalSources[0];
  const capitalValue = capital ? financialValue(capital.amount, capital.currency) : "未提供";
  const actualLine = "实际 R " + metric("actualR", "未提供") + " · 剩余数量 " + metric("remainingQuantity", "未提供") + " · 参考资金 " + capitalValue;
  return [source, values, holdings, actualLine];
}

function wrapFinancialLine(value: string): string[] {
  const lines: string[] = [];
  let current = "";
  let width = 0;
  for (const character of Array.from(value)) {
    const nextWidth = threeStageTextPixelWidth(character, 11);
    if (current && width + nextWidth > 416) {
      lines.push(current);
      current = character;
      width = nextWidth;
    } else {
      current += character;
      width += nextWidth;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function financialSummaryLines(financial: ThreeStageFinancialSummary): string[] {
  return financial.bundleId ? financialLines(financial).flatMap(wrapFinancialLine) : [];
}

function summaryFitsBelowBody(stage: ThreeStageExportManifest["stages"][number], summaryLines: readonly string[]): boolean {
  const remaining = THREE_STAGE_LAYOUT.cardY + THREE_STAGE_LAYOUT.cardHeight - (THREE_STAGE_LAYOUT.contentTop + stage.contentPixelHeight);
  return remaining >= summaryLines.length * 14 + 12;
}

function bodyRows(manifest: ThreeStageExportManifest, index: number): readonly ThreeStageExportManifest["stages"][number]["contentRows"][number][] {
  return manifest.stages[index].contentRows.filter(row => row.placement !== "before-image");
}

function assertFixedTextFits(manifest: ThreeStageExportManifest, financial: readonly string[]): void {
  const title = `${manifest.instrument.name} · ${manifest.instrument.symbol}`;
  const rightHeader = `${manifest.instrument.currency} · ${manifest.source === "completed" ? "正式版本" : "草稿版本"}`;
  const generatedAt = formatThreeStageDisplayDate(manifest.generatedAt);
  const provenance = `来源 ${manifest.source === "completed" ? "正式版本" : "草稿版本"} · 文档修订 ${manifest.documentRevision}`;
  const footer = `记录 ${manifest.allRecordIndex.length} 条 · ${manifest.acceptedBundleId ? "已接受版本组合" : "未提供已接受版本组合"}`;
  const hasStageOverflow = manifest.stages.some((stage, index) => stage.contentPixelHeight > stage.contentPixelBudget || bodyRows(manifest, index).reduce((height, row) => height + row.lines.length * (row.kind === "text" ? THREE_STAGE_LAYOUT.textLineHeight : THREE_STAGE_LAYOUT.metaLineHeight), 0) > stage.contentPixelBudget);
  const hasPreImageOverflow = manifest.stages.some(stage => stage.contentRows.filter(row => row.placement === "before-image").reduce((height, row) => height + row.lines.length * THREE_STAGE_LAYOUT.metaLineHeight, 0) > threeStagePreImagePixelBudget());
  if (manifest.contentOverflow || hasStageOverflow || hasPreImageOverflow || manifest.executions.length > MAX_EXECUTION_ROWS || threeStageTextPixelWidth(title, 23) > 900 || threeStageTextPixelWidth(rightHeader) > 360 || threeStageTextPixelWidth(`${provenance} · 生成于 ${generatedAt === "时间未知" ? manifest.generatedAt : generatedAt}`, 12) > 1368 || threeStageTextPixelWidth(footer, 11) > 1368 || financial.some(line => threeStageTextPixelWidth(line, 11) > 500)) {
    throw new ThreeStageImageError("content-overflow：固定 1440×810 画布无法容纳完整导出文本");
  }
  const summaryLines = financialSummaryLines(manifest.financial);
  if (summaryLines.length > 0 && !manifest.stages.some(stage => summaryFitsBelowBody(stage, summaryLines))) {
    throw new ThreeStageImageError("content-overflow：固定 1440×810 画布无法容纳财务摘要");
  }
  for (const execution of manifest.executions) {
    if (threeStageTextPixelWidth(formatThreeStageDisplayDate(execution.executedAt)) > 220 || threeStageTextPixelWidth(`${execution.quantity} 股`) > 115 || threeStageTextPixelWidth(`${execution.price} ${execution.currency}`) > 150 || threeStageTextPixelWidth(`${execution.fee} ${execution.currency}`) > 175) {
      throw new ThreeStageImageError("content-overflow：固定 1440×810 画布无法容纳完整成交字段");
    }
  }
}
function renderStageRows(manifest: ThreeStageExportManifest, index: number, summaryStageIndex: number, summaryLines: readonly string[]): string {
  const stage = manifest.stages[index];
  const x = THREE_STAGE_LAYOUT.cardX + index * (THREE_STAGE_LAYOUT.cardWidth + THREE_STAGE_LAYOUT.cardGap);
  const imageX = x + THREE_STAGE_LAYOUT.imageXInset; const contentX = x + THREE_STAGE_LAYOUT.contentXInset;
  const image = stage.imageDataUrl ? "<image x=\"" + imageX + "\" y=\"" + THREE_STAGE_LAYOUT.imageY + "\" width=\"" + THREE_STAGE_LAYOUT.imageWidth + "\" height=\"" + THREE_STAGE_LAYOUT.imageHeight + "\" preserveAspectRatio=\"xMidYMid meet\"" + imageHref(stage.imageDataUrl) + "/>" : "<rect x=\"" + imageX + "\" y=\"" + THREE_STAGE_LAYOUT.imageY + "\" width=\"" + THREE_STAGE_LAYOUT.imageWidth + "\" height=\"" + THREE_STAGE_LAYOUT.imageHeight + "\" fill=\"" + COLORS.chart + "\"/><text x=\"" + contentX + "\" y=\"" + (THREE_STAGE_LAYOUT.imageY + 122) + "\" fill=\"" + COLORS.muted + "\" font-size=\"14\" font-family=\"" + FONT + "\">" + xmlText(stage.snapshotId ? "未保存可验证 PNG" : "该阶段尚无已留存快照") + "</text>";
  let y: number = THREE_STAGE_LAYOUT.preImageTop;
  const beforeImage = stage.contentRows.filter(row => row.placement === "before-image").map(row => row.lines.map(line => textLine(line, contentX, y += THREE_STAGE_LAYOUT.metaLineHeight, COLORS.secondary, 12)).join("")).join("");
  y = THREE_STAGE_LAYOUT.contentTop;
  const rows = bodyRows(manifest, index).map(row => { const size = row.kind === "text" ? 14 : 12; const lineHeight = row.kind === "text" ? THREE_STAGE_LAYOUT.textLineHeight : THREE_STAGE_LAYOUT.metaLineHeight; const color = row.kind === "warning" ? COLORS.target : row.kind === "meta" ? COLORS.secondary : COLORS.text; return row.lines.map(line => textLine(line, contentX, y += lineHeight, color, size)).join(""); }).join("");
  const summary = index === summaryStageIndex ? summaryLines.map((line, lineIndex) => textLine(line, contentX, THREE_STAGE_LAYOUT.cardY + THREE_STAGE_LAYOUT.cardHeight - (summaryLines.length - lineIndex) * 14 - 10, COLORS.secondary, 11)).join("") : "";
  const titleY = THREE_STAGE_LAYOUT.cardY + 28;
  return "<g><rect x=\"" + x + "\" y=\"" + THREE_STAGE_LAYOUT.cardY + "\" width=\"" + THREE_STAGE_LAYOUT.cardWidth + "\" height=\"" + THREE_STAGE_LAYOUT.cardHeight + "\" rx=\"8\" fill=\"" + COLORS.surface + "\" stroke=\"" + COLORS.divider + "\"/><text x=\"" + (x + 16) + "\" y=\"" + titleY + "\" fill=\"" + COLORS.text + "\" font-size=\"18\" font-weight=\"600\" font-family=\"" + FONT + "\">" + xmlText(stage.title) + "</text>" + beforeImage + image + rows + summary + "</g>";
}
export function buildThreeStageSvg(manifest: ThreeStageExportManifest): string {
  const { width, height } = THREE_STAGE_EXPORT_FRAME; const financial = financialLines(manifest.financial); const summaryLines = financialSummaryLines(manifest.financial); assertFixedTextFits(manifest, financial); const summaryCandidates = manifest.stages.map((stage, index) => ({ stage, index })).filter(({ stage }) => summaryFitsBelowBody(stage, summaryLines)); const summaryStageIndex = summaryLines.length === 0 ? -1 : summaryCandidates.reduce((selected, candidate) => selected < 0 || candidate.stage.contentPixelHeight > manifest.stages[selected].contentPixelHeight ? candidate.index : selected, -1); const cards = manifest.stages.map((_, index) => renderStageRows(manifest, index, summaryStageIndex, summaryLines)).join(""); const tableX = 24; const tableWidth = width - 48;
  const rows = manifest.executions.map((execution, index) => { const y = THREE_STAGE_LAYOUT.tableFirstRowY + index * THREE_STAGE_LAYOUT.tableRowHeight; const fill = index % 2 === 0 ? COLORS.surface : COLORS.chart; const sideColor = execution.side === "buy" ? COLORS.up : COLORS.down;
    return "<rect x=\"" + tableX + "\" y=\"" + (y - 20) + "\" width=\"" + tableWidth + "\" height=\"" + THREE_STAGE_LAYOUT.tableRowHeight + "\" fill=\"" + fill + "\"/><text x=\"36\" y=\"" + y + "\" fill=\"" + COLORS.text + "\" font-size=\"14\" font-family=\"" + FONT + "\">" + xmlText(formatThreeStageDisplayDate(execution.executedAt)) + "</text><text x=\"385\" y=\"" + y + "\" fill=\"" + sideColor + "\" font-size=\"14\" font-family=\"" + FONT + "\">" + (execution.side === "buy" ? "买入" : "卖出") + "</text><text x=\"558\" y=\"" + y + "\" fill=\"" + COLORS.text + "\" font-size=\"14\" font-family=\"" + FONT + "\">" + xmlText(execution.quantity) + " 股</text><text x=\"802\" y=\"" + y + "\" fill=\"" + COLORS.text + "\" font-size=\"14\" font-family=\"" + FONT + "\">" + xmlText(execution.price) + " " + xmlText(execution.currency) + "</text><text x=\"1120\" y=\"" + y + "\" fill=\"" + COLORS.text + "\" font-size=\"14\" font-family=\"" + FONT + "\">" + xmlText(execution.fee) + " " + xmlText(execution.currency) + "</text>";
  }).join("");
  const title = manifest.instrument.name + " · " + manifest.instrument.symbol; const rightHeader = manifest.instrument.currency + " · " + (manifest.source === "completed" ? "正式版本" : "草稿版本"); const provenance = "来源 " + (manifest.source === "completed" ? "正式版本" : "草稿版本") + " · 文档修订 " + manifest.documentRevision; const footer = "记录 " + manifest.allRecordIndex.length + " 条 · " + (manifest.acceptedBundleId ? "已接受版本组合" : "未提供已接受版本组合"); const displayedGeneratedAt = formatThreeStageDisplayDate(manifest.generatedAt);
  const tableHeader = "<line x1=\"" + tableX + "\" y1=\"" + (THREE_STAGE_LAYOUT.tableHeaderY + 14) + "\" x2=\"" + (tableX + tableWidth) + "\" y2=\"" + (THREE_STAGE_LAYOUT.tableHeaderY + 14) + "\" stroke=\"" + COLORS.divider + "\"/><text x=\"36\" y=\"" + THREE_STAGE_LAYOUT.tableHeaderY + "\" fill=\"" + COLORS.muted + "\" font-size=\"12\" font-family=\"" + FONT + "\">成交时间</text><text x=\"385\" y=\"" + THREE_STAGE_LAYOUT.tableHeaderY + "\" fill=\"" + COLORS.muted + "\" font-size=\"12\" font-family=\"" + FONT + "\">方向</text><text x=\"558\" y=\"" + THREE_STAGE_LAYOUT.tableHeaderY + "\" fill=\"" + COLORS.muted + "\" font-size=\"12\" font-family=\"" + FONT + "\">数量</text><text x=\"802\" y=\"" + THREE_STAGE_LAYOUT.tableHeaderY + "\" fill=\"" + COLORS.muted + "\" font-size=\"12\" font-family=\"" + FONT + "\">价格</text><text x=\"1120\" y=\"" + THREE_STAGE_LAYOUT.tableHeaderY + "\" fill=\"" + COLORS.muted + "\" font-size=\"12\" font-family=\"" + FONT + "\">手续费</text>";
  return "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"" + width + "\" height=\"" + height + "\" viewBox=\"0 0 " + width + " " + height + "\"><rect width=\"" + width + "\" height=\"" + height + "\" fill=\"" + COLORS.page + "\"/><text x=\"24\" y=\"52\" fill=\"" + COLORS.text + "\" font-size=\"23\" font-weight=\"600\" font-family=\"" + FONT + "\">" + xmlText(title) + "</text><text x=\"1416\" y=\"52\" text-anchor=\"end\" fill=\"" + COLORS.secondary + "\" font-size=\"14\" font-family=\"" + FONT + "\">" + xmlText(rightHeader) + "</text><text x=\"24\" y=\"75\" fill=\"" + COLORS.muted + "\" font-size=\"12\" font-family=\"" + FONT + "\">" + xmlText(provenance + " · 生成于 " + displayedGeneratedAt) + "</text>" + cards + tableHeader + rows + "<text x=\"1416\" y=\"804\" text-anchor=\"end\" fill=\"" + COLORS.muted + "\" font-size=\"11\" font-family=\"" + FONT + "\">" + xmlText(footer) + "</text></svg>";
}
export async function createThreeStagePngBlob(manifest: ThreeStageExportManifest): Promise<Blob> {
  assertFixedTextFits(manifest, financialLines(manifest.financial));
  if (typeof document === "undefined" || typeof Image === "undefined") throw new ThreeStageImageError("当前环境无法生成 PNG");
  const canvas = document.createElement("canvas"); canvas.width = THREE_STAGE_EXPORT_FRAME.width; canvas.height = THREE_STAGE_EXPORT_FRAME.height; const context = canvas.getContext("2d");
  if (!context) throw new ThreeStageImageError("当前浏览器不支持 PNG 画布");
  const source = new Blob([buildThreeStageSvg(manifest)], { type: "image/svg+xml" }); const sourceUrl = URL.createObjectURL(source);
  try { const image = new Image(); await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new ThreeStageImageError("三阶段 SVG 无法载入 PNG 画布")); image.src = sourceUrl; }); context.drawImage(image, 0, 0, THREE_STAGE_EXPORT_FRAME.width, THREE_STAGE_EXPORT_FRAME.height); return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new ThreeStageImageError("PNG 编码失败")), "image/png")); } finally { URL.revokeObjectURL(sourceUrl); }
}
