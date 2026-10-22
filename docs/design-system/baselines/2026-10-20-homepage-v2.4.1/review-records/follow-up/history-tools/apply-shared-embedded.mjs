#!/usr/bin/env node

import { ensureRepoRoot } from './repo-root.mjs';
ensureRepoRoot(import.meta.url);
/**
 * Prepare the history/contribution child-SVG update for the four V2.4.1
 * full-page SVGs.
 *
 * This worker does not edit those shared files. Root may independently review
 * and run --apply from the repository root. --preview writes transformed SVGs
 * below work/history/evidence/shared/ for local raster comparison.
 *
 *   node .scratch/homepage-v241-repair/work/history/apply-shared-embedded.mjs --check
 *   node .scratch/homepage-v241-repair/work/history/apply-shared-embedded.mjs --preview
 *   node .scratch/homepage-v241-repair/work/history/apply-shared-embedded.mjs --apply
 */

import fs from "node:fs";
import path from "node:path";

const relativeDir = "docs/design-system/baselines/2026-10-20-homepage-v2.4.1/source/images";
const files = [
  "home-1280.svg",
  "home-1440.svg",
  "home-history-1280.svg",
  "home-history-1440.svg",
].map((name) => path.join(relativeDir, name));

const apply = process.argv.includes("--apply");
const preview = process.argv.includes("--preview");
const checkOnly = !apply && !preview;
const previewDir = path.join(
  ".scratch/homepage-v241-repair/work/history/evidence/shared",
);

function fail(file, message) {
  throw new Error(`${file}: ${message}`);
}

function attr(open, name) {
  const match = open.match(new RegExp(`${name}="([^"]+)"`));
  return match?.[1] ?? null;
}

function childBlock(source, marker, file) {
  const start = source.indexOf(marker);
  if (start < 0) fail(file, `missing child SVG marker ${marker}`);
  const tags = /<svg\b|<\/svg>/g;
  tags.lastIndex = start;
  let depth = 0;
  let end = -1;
  for (const match of source.matchAll(tags)) {
    if (match[0] === "</svg>") depth -= 1;
    else depth += 1;
    if (depth === 0) {
      end = match.index + match[0].length;
      break;
    }
  }
  if (end < 0) fail(file, `missing balanced closing tag for ${marker}`);
  return { start, end, value: source.slice(start, end) };
}

function replaceOne(value, search, replacement, file, label) {
  const count = value.split(search).length - 1;
  if (count !== 1) fail(file, `${label}: expected 1 match, found ${count}`);
  return value.replace(search, replacement);
}

function replaceRegexOne(value, expression, replacement, file, label) {
  const globalExpression = new RegExp(expression.source, `${expression.flags.replace("g", "")}g`);
  const matches = value.match(globalExpression) ?? [];
  if (matches.length !== 1) {
    fail(file, `${label}: expected 1 match, found ${matches.length}`);
  }
  return value.replace(expression, replacement);
}

function numberAttr(open, name, file) {
  const value = Number(attr(open, name));
  if (!Number.isFinite(value)) fail(file, `missing numeric ${name} on child SVG`);
  return value;
}

function textContent(value, label, fallback) {
  for (const match of value.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)) {
    const inner = match[1]
      .replace(/<title>[^<]*<\/title>/g, "")
      .trim();
    if (inner.includes(label)) return inner;
  }
  return fallback;
}

function compactValue(value) {
  const raw = String(value).replace(/[，,\s]/g, "").replace(/−/g, "-");
  const numeric = Number(raw.replace(/[^0-9.+-]/g, ""));
  if (!Number.isFinite(numeric) || Math.abs(numeric) < 10000) return value;
  const sign = numeric < 0 ? "−" : numeric > 0 ? "+" : "";
  const divisor = Math.abs(numeric) >= 100000000 ? 100000000 : 10000;
  const unit = divisor === 100000000 ? "亿" : "万";
  const compact = (Math.abs(numeric) / divisor).toFixed(2);
  return `${sign}${compact}${unit}`;
}

function normalizeHollowBars(value) {
  const get = (tag, name) => tag.match(new RegExp(`\\b${name}="([^\"]+)"`))?.[1] ?? null;
  const set = (tag, name, replacement) => {
    const pattern = new RegExp(`\\b${name}="[^"]+"`);
    if (!pattern.test(tag)) return tag;
    return tag.replace(pattern, `${name}="${replacement}"`);
  };
  return value.replace(/<rect\b[^>]*>/g, (tag) => {
    const height = Number(get(tag, "height"));
    const width = Number(get(tag, "width"));
    const x = Number(get(tag, "x"));
    const y = Number(get(tag, "y"));
    const fill = get(tag, "fill")?.toLowerCase();
    const strokeWidth = Number(get(tag, "stroke-width"));
    if (height !== 14 || fill !== "none" || strokeWidth !== 2) return tag;
    if (![width, x, y].every(Number.isFinite) || width <= 2) return tag;
    let next = tag;
    next = set(next, "x", String(x + 1));
    next = set(next, "y", String(y + 1));
    next = set(next, "width", String(width - 2));
    next = set(next, "height", "12");
    return next;
  });
}

function normalizeNegativeBarColors(value) {
  // The confirmed prototype uses EF7F89 for negative bar geometry while the
  // adjacent numeric result remains the brighter FF8592 text token. Restrict
  // this replacement to rect geometry so text colors keep their role.
  return value.replace(/<rect\b[^>]*>/g, (tag) =>
    tag.replace(/(fill|stroke)="#FF8592"/g, '$1="#EF7F89"'),
  );
}

function historyMetric(file) {
  const name = path.basename(file);
  if (name.includes("cumulative")) return "累计净盈亏";
  if (name.includes("win")) return "各期胜率";
  if (name.includes("rounds")) return "各期回合数";
  return "每月净盈亏";
}

function replaceHistoryControls(oldBlock, width, metric, file) {
  const controlPattern = /<rect x="[^"]+" y="20" width="120" height="36"[^>]*\/>\s*<text[^>]*y="43"[^>]*>[^<]*<\/text>/g;
  const matches = [...oldBlock.matchAll(controlPattern)];
  if (matches.length !== 3) {
    fail(file, `history controls: expected 3 legacy controls, found ${matches.length}`);
  }
  let next = oldBlock;
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index];
    next = next.slice(0, match.index) + next.slice(match.index + match[0].length);
  }
  const shellX = width - 322;
  const chevron = (x) => `<svg x="${x}" y="30" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" data-icon="chevron"><path d="M3 5.5l4 4 4-4" fill="none" stroke="#A8B6CB" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const metricChevronX = metric === "各期胜率" ? shellX + 156 : shellX + 170;
  const controlLabel = `范围：2026；展示方式：${metric}`;
  const shell = `<g role="group" aria-label="${controlLabel}" data-control="history-controls"><title>${controlLabel}</title><rect x="${shellX}" y="20" width="282" height="36" rx="7" fill="#111A26" stroke="#283448"/><text x="${shellX + 12}" y="43" fill="#E6EDF7" font-size="14px" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif" font-weight="400" text-anchor="start">2026</text>${chevron(shellX + 56)}<line x1="${shellX + 80}" y1="28" x2="${shellX + 80}" y2="48" stroke="#283448"/><text x="${shellX + 92}" y="43" fill="#E6EDF7" font-size="14px" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif" font-weight="400" text-anchor="start">${metric}</text>${chevron(metricChevronX)}</g>`;
  return next.slice(0, matches[0].index) + shell + next.slice(matches[0].index);
}

function historyCards(oldBlock, width, file) {
  const rectPattern = /<rect x="[^"]+" y="82" width="[^"]+" height="88"[^>]*\/>/g;
  const rects = [...oldBlock.matchAll(rectPattern)];
  if (rects.length !== 4) fail(file, `history cards: expected 4 cards, found ${rects.length}`);
  const narrow = width === 1160;
  const cardWidth = narrow ? 278 : 321;
  const cardHeight = narrow ? 104 : 88;
  const gap = 12;
  const blocks = rects.map((rect, index) => {
    const start = rect.index;
    const end = index + 1 < rects.length
      ? rects[index + 1].index
      : oldBlock.length;
    return oldBlock.slice(start, end);
  });
  return blocks.map((block, index) => {
    const label = block.match(/<text[^>]*y="108"[^>]*>([^<]+)<\/text>/)?.[1]?.trim();
    const valueNode = block.match(/<text([^>]*)y="145"[^>]*>([\s\S]*?)<\/text>/);
    if (!label || !valueNode) fail(file, `history card ${index + 1}: missing label/value`);
    const valueInner = valueNode[2];
    const valueTitle = valueInner.match(/<title>([^<]*)<\/title>/)?.[1] ?? valueInner.replace(/<[^>]+>/g, "").trim();
    const visibleValue = index === 0 ? compactValue(valueInner.replace(/<title>[^<]*<\/title>/g, "").trim()) : valueInner.replace(/<title>[^<]*<\/title>/g, "").trim();
    const valueAttrs = valueNode[1];
    const valueFill = valueAttrs.match(/fill="([^"]+)"/)?.[1] ?? "#E6EDF7";
    const denominator = index === 2 ? textContent(block, "盈利回合", "— / — 盈利回合") : "";
    const cardX = index * (cardWidth + gap);
    const rightX = cardX + cardWidth - 16;
    const title = label.replace("历史已平仓净盈亏", "已平仓净盈亏");
    const denominatorMarkup = index === 2
      ? narrow
        ? `<text x="${rightX}" y="130" fill="#A8B6CB" font-size="11px" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif" font-weight="400" text-anchor="end">盈利回合</text><text x="${rightX}" y="145" fill="#A8B6CB" font-size="11px" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif" font-weight="400" text-anchor="end"><title>${denominator}</title>${denominator.replace(/\s*盈利回合\s*$/, "")}</text>`
        : `<text x="${rightX}" y="145" fill="#A8B6CB" font-size="11px" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif" font-weight="400" text-anchor="end"><title>${denominator}</title>${denominator}</text>`
      : "";
    return `<rect x="${cardX}" y="82" width="${cardWidth}" height="${cardHeight}" rx="8" fill="#111A26" stroke="#283448"/><text x="${cardX + 16}" y="108" fill="#A8B6CB" font-size="14px" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif" font-weight="400" text-anchor="start">${title}</text><text x="${cardX + 16}" y="145" fill="${valueFill}" font-size="28px" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif" font-weight="600" text-anchor="start"><title>${valueTitle}</title>${visibleValue}</text>${denominatorMarkup}`;
  }).join("");
}

function axisNumber(value) {
  const normalized = String(value)
    .replace(/[，,\s]/g, "")
    .replace(/−/g, "-");
  const match = normalized.match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))(万|亿)?$/);
  if (!match) return Number.NaN;
  const multiplier = match[2] === "亿" ? 100000000 : match[2] === "万" ? 10000 : 1;
  return Number(match[1]) * multiplier;
}

function embeddedZeroY(value, file) {
  const ticks = [];
  const pattern = /<line x1="106" y1="([0-9.]+)" x2="[^"]+" y2="\1" stroke="[^"]+"\/><text x="94" y="[^"]+"[^>]*><title>([^<]+)<\/title>[^<]*<\/text>/g;
  for (const match of value.matchAll(pattern)) {
    const numeric = axisNumber(match[2]);
    if (Number.isFinite(numeric)) ticks.push({ y: Number(match[1]), value: numeric });
  }
  if (ticks.length < 2) fail(file, "history chart: cannot read at least two axis ticks for zero-line interpolation");
  const exact = ticks.find((tick) => tick.value === 0);
  if (exact) return exact.y;
  const ordered = [...ticks].sort((a, b) => a.y - b.y);
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const a = ordered[index];
    const b = ordered[index + 1];
    if ((a.value > 0 && b.value < 0) || (a.value < 0 && b.value > 0)) {
      return a.y + ((0 - a.value) * (b.y - a.y)) / (b.value - a.value);
    }
  }
  fail(file, "history chart: axis ticks do not bracket zero");
}

function emphasizeEmbeddedZeroLine(value, file) {
  const zeroY = embeddedZeroY(value, file);
  // A prior candidate could have marked the nearest tick as the zero line.
  // Remove that derived marker first so rerunning the patch moves it to the
  // interpolated coordinate instead of accumulating duplicate lines.
  const withoutDerivedZero = value.replace(
    /<line x1="106" y1="[0-9.]+" x2="[^"]+" y2="[0-9.]+" stroke="[^"]+" data-state="zero-line"\/>/g,
    "",
  );
  const pattern = /<line x1="106" y1="([0-9.]+)" x2="([^"]+)" y2="\1" stroke="[^"]+"\/>/g;
  let count = 0;
  let x2ForZero = null;
  let exactTick = false;
  const next = withoutDerivedZero.replace(pattern, (_, y, x2) => {
    count += 1;
    x2ForZero ??= x2;
    const isZero = Math.abs(Number(y) - zeroY) < 0.01;
    exactTick ||= isZero;
    const stroke = isZero ? "#A8B6CB" : "#283448";
    return `<line x1="106" y1="${y}" x2="${x2}" y2="${y}" stroke="${stroke}"/>`;
  });
  if (count !== 5) fail(file, `history chart: expected 5 horizontal axis lines, found ${count}`);
  if (exactTick) return next;
  if (!x2ForZero) fail(file, "history chart: zero-line x2 coordinate missing");
  const zeroLine = `<line x1="106" y1="${zeroY}" x2="${x2ForZero}" y2="${zeroY}" stroke="#A8B6CB" data-state="zero-line"/>`;
  const anchor = '<g transform="translate(106 280)">';
  return replaceOne(next, anchor, `${zeroLine}${anchor}`, file, "history chart interpolated zero-line insertion");
}

function cleanSeriesInPlace(oldBlock, file) {
  const groupPattern = /(<g transform="translate\(106 280\)">)([\s\S]*?)(<\/g>)/;
  const match = oldBlock.match(groupPattern);
  if (!match) fail(file, "history chart: missing original series group");
  const elements = match[2].match(/<polyline\b[^>]*>|<circle\b[^>]*>/g) ?? [];
  if (elements.length === 0) fail(file, "history chart: original series is empty; no fallback data permitted");
  const body = match[2]
    .replace(/<text\b[^>]*>(?:<title>[^<]*<\/title>)?(?:无回合|未来未覆盖)<\/text>/g, "")
    .replace(/stroke-width="3"/g, 'stroke-width="2"')
    .replace(/\br="5"/g, 'r="3"');
  return oldBlock.replace(groupPattern, `${match[1]}${body}${match[3]}`);
}

function emptyZonesFromLabels(value, width) {
  const plotLeft = 106;
  const chartRight = width - 24;
  const step = (chartRight - plotLeft) / 11;
  const labels = [...value.matchAll(/<text x="([0-9.]+)" y="205"[^>]*>无回合<\/text>/g)];
  return labels.map((match) => {
    const center = plotLeft + Number(match[1]);
    const x = Number((center - step / 2).toFixed(2));
    const zoneWidth = Number(step.toFixed(2));
    return `<rect x="${x}" y="280" width="${zoneWidth}" height="210" fill="#30291E" opacity="0.65" data-state="empty"/>`;
  }).join("");
}

function makeHistoryChild(oldBlock, file) {
  if (oldBlock.includes("<!-- history-sync:v2.4.1 -->")) {
    return emphasizeEmbeddedZeroLine(oldBlock, file);
  }
  const open = oldBlock.match(/^<svg[^>]*>/)?.[0];
  if (!open) fail(file, "history child has no opening SVG tag");
  const width = numberAttr(open, "width", file);
  const height = numberAttr(open, "height", file);
  if (height !== 558) fail(file, `history child height changed unexpectedly: ${height}`);
  if (width !== 1160 && width !== 1320) {
    fail(file, `history child width must be 1160 or 1320, found ${width}`);
  }

  let next = oldBlock.replace(open, `${open}<!-- history-sync:v2.4.1 -->`);
  const emptyZones = emptyZonesFromLabels(next, width);
  next = replaceHistoryControls(next, width, historyMetric(file), file);
  next = next.replace(/(<text x="24" y="32"[^>]*font-weight=")700(?![0-9])/g, "$1600");
  next = next.replace(/历史完成交易 · 2026年 · 截至 2026-10-15/g, "按平仓时间 · 2026");
  next = next.replace(/历史已平仓净盈亏/g, "已平仓净盈亏");
  next = next.replace(/(<text x="24" y="246"[^>]*font-size=")18px("[^>]*font-weight=")400/g, "$116px$2600");
  next = next.replace(/(<text x="24" y="246"[^>]*>)[^<]*(<\/text>)/, `$1${historyMetric(file)}$2`);
  next = cleanSeriesInPlace(next, file);
  next = emphasizeEmbeddedZeroLine(next, file);
  next = next.replace(/(<text[^>]*y="514"[^>]*>)(0?)(\d{1,2})(<\/text>)/g, (_, prefix, _leading, number, suffix) => `${prefix}${Number(number)}月${suffix}`);
  const cardStart = next.indexOf('<rect x="0" y="82"');
  const chartStart = next.indexOf('<rect x="0" y="214"', cardStart);
  if (cardStart < 0 || chartStart < 0) fail(file, "history cards/chart boundary missing");
  const cardPrefix = next.slice(0, cardStart);
  const cardSuffix = next.slice(chartStart);
  const cardRegion = next.slice(cardStart, chartStart);
  next = `${cardPrefix}${historyCards(cardRegion, width, file)}${cardSuffix}`;
  const chartRect = next.match(/<rect x="0" y="214" width="[^"]+" height="320"[^>]*\/>/);
  if (!chartRect) fail(file, "history chart card missing");
  const plotLeft = 106;
  const chartRight = width - 24;
  const step = (chartRight - plotLeft) / 11;
  const futureWidth = Number((step * 1.5).toFixed(2));
  const futureX = Number((chartRight - futureWidth).toFixed(2));
  const future = `<rect x="${futureX}" y="280" width="${futureWidth}" height="210" fill="#1D2B40" opacity="0.85" data-state="future-zone"/><line x1="${futureX}" y1="280" x2="${futureX}" y2="490" stroke="#71829B" stroke-dasharray="4 4" data-state="future-boundary"/>`;
  const zones = `${emptyZones}${future}`;
  next = next.replace(chartRect[0], `${chartRect[0]}${zones}`);
  return next;
}

function makeHitAreas(oldBlock) {
  const controls = [
    [32, 70, "category-long"],
    [110, 70, "category-short"],
    [188, 70, "category-new"],
    [312, 112, "sort-profit"],
  ];
  return controls
    .filter(([x]) => oldBlock.includes(`<rect x="${x}" y="134"`))
    .map(([x, width, control]) => `<rect x="${x - 4}" y="130" width="${width + 8}" height="36" rx="6" fill="none" stroke="none" data-hit-area="36" data-control="${control}"/>`)
    .join("");
}

function categoryVisuals(value, file) {
  const pattern = /<rect x="(32|110|188)" y="134" width="70" height="28" rx="6" fill="([^"]+)" stroke="([^"]+)"\/>/g;
  const matches = [...value.matchAll(pattern)];
  if (matches.length !== 3) {
    fail(file, `contribution category controls: expected 3 visual controls, found ${matches.length}`);
  }
  return value.replace(pattern, (_, x, fill) => {
    const selected = fill.toLowerCase() === "#243b5c";
    const underline = selected
      ? `<line x1="${Number(x) + 6}" y1="162" x2="${Number(x) + 64}" y2="162" stroke="#6CA8FF" stroke-width="2" data-visual="category-selected"/>`
      : "";
    return `<rect x="${x}" y="134" width="70" height="28" rx="6" fill="none" stroke="none" data-visual="category"/>${underline}`;
  });
}

function addGlobalMarketControl(value, file) {
  if (value.includes('data-control="market-scope"')) return value;
  const label = '<text x="712" y="152" text-anchor="start" font-family="Arial,\'PingFang SC\',sans-serif" font-size="14" font-weight="700" fill="#E6EDF7">全部市场</text>';
  if (!value.includes(label)) {
    fail(file, "contribution global market value anchor disappeared");
  }
  // Round 5 keeps the semantic label visible and gives the select its own
  // 28px visual face inside a 36px hit area. The chevron is independent of
  // the text so the static artwork cannot read as a text-only selector.
  const control = '<g role="combobox" aria-haspopup="listbox" aria-label="全局市场：全部市场" data-control="market-scope"><rect x="760" y="130" width="120" height="36" rx="6" fill="none" stroke="none" data-hit-area="36" data-control="market-scope"/><rect x="764" y="134" width="112" height="28" rx="6" fill="#111A26" stroke="#283448" data-visual="market-select-face"/><text x="774" y="153" text-anchor="start" font-family="Arial,\'PingFang SC\',sans-serif" font-size="14" font-weight="400" fill="#E6EDF7">全部市场</text><svg x="850" y="140" width="16" height="16" viewBox="0 0 14 14" aria-hidden="true" data-icon="market-chevron"><path d="M3 5.5l4 4 4-4" fill="none" stroke="#A8B6CB" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></g>';
  return replaceOne(value, label, control, file, "contribution global market selector");
}

function makeContributionChild(oldBlock, file) {
  if (oldBlock.includes("<!-- contribution-sync:v2.4.1 -->")) {
    // A root apply may have landed the earlier revision before the global
    // market selector patch. Augment that already-synchronised child safely.
    let next = addGlobalMarketControl(oldBlock, file);
    next = next.replace(
      /(<text x="368" y="153"[^>]*>)盈利最高 ↓(<\/text>)/,
      "$1盈利最高$2",
    );
    return next;
  }
  const open = oldBlock.match(/^<svg[^>]*>/)?.[0];
  if (!open) fail(file, "contribution child has no opening SVG tag");
  const height = numberAttr(open, "height", file);
  if (height !== 610) fail(file, `contribution child height changed unexpectedly: ${height}`);
  let next = oldBlock.replace(open, `${open}<!-- contribution-sync:v2.4.1 -->`);
  next = next.replace(
    /(<text x="32" y="36"[^>]*font-size="18"[^>]*font-weight=")700("[^>]*>)/,
    "$1" + "600" + "$2",
  );
  next = normalizeNegativeBarColors(next);
  const secondSort = '<rect x="432" y="134" width="112" height="28" rx="6" fill="#162233" stroke="#283448"/><text x="488" y="153" text-anchor="middle" font-family="Arial,\'PingFang SC\',sans-serif" font-size="14" fill="#E6EDF7">亏损最大 ↑</text>';
  if (next.includes(secondSort)) {
    next = replaceOne(next, secondSort, "", file, "contribution secondary sort option");
  }
  const sortLabelWithArrow = '<text x="368" y="153" text-anchor="middle" font-family="Arial,\'PingFang SC\',sans-serif" font-size="14" fill="#E6EDF7">盈利最高 ↓</text>';
  const sortLabel = '<text x="368" y="153" text-anchor="middle" font-family="Arial,\'PingFang SC\',sans-serif" font-size="14" fill="#E6EDF7">盈利最高</text>';
  const legacyOpenOnly = '<rect x="552" y="134" width="124" height="28" rx="6" fill="#162233" stroke="#283448"/><text x="614" y="153" text-anchor="middle" font-family="Arial,\'PingFang SC\',sans-serif" font-size="14" fill="#E6EDF7">仅看未平仓</text>';
  const historyMode = file.includes("home-history-");
  const checkboxFill = historyMode ? "#71829B" : "none";
  const checkboxStroke = historyMode ? "#71829B" : "#A8B6CB";
  const openOnly = `<g role="checkbox" aria-checked="false" aria-disabled="${historyMode ? "true" : "false"}" aria-label="仅看未平仓" data-control="open-only" data-state="unchecked" data-disabled="${historyMode ? "true" : "false"}"><rect x="428" y="130" width="120" height="36" rx="6" fill="none" stroke="none" data-hit-area="36" data-control="open-only"/><rect x="432" y="140" width="16" height="16" rx="3" fill="${checkboxFill}" stroke="${checkboxStroke}" stroke-width="1.5" data-visual="checkbox" data-disabled="${historyMode ? "true" : "false"}"/><text x="455" y="153" text-anchor="start" font-family="Arial,'PingFang SC',sans-serif" font-size="14" fill="${historyMode ? "#A8B6CB" : "#E6EDF7"}">仅看未平仓</text></g>`;
  if (next.includes(legacyOpenOnly)) {
    next = replaceOne(next, legacyOpenOnly, openOnly, file, "contribution open-only checkbox");
  } else if (!next.includes('data-control="open-only"')) {
    if (!next.includes(sortLabel) && !next.includes(sortLabelWithArrow)) fail(file, "contribution open-only insertion anchor disappeared");
    if (next.includes(sortLabelWithArrow)) next = replaceOne(next, sortLabelWithArrow, sortLabel, file, "contribution sort text arrow");
    next = replaceOne(next, sortLabel, `${sortLabel}${openOnly}`, file, "contribution open-only checkbox");
  }
  if (next.includes(sortLabelWithArrow)) {
    next = replaceOne(next, sortLabelWithArrow, sortLabel, file, "contribution sort text arrow");
  }
  const sortChevron = '<svg x="402" y="141" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" data-icon="sort-chevron"><path d="M3 5.5l4 4 4-4" fill="none" stroke="#A8B6CB" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const activeSort = '<rect x="312" y="134" width="112" height="28" rx="6" fill="#243B5C" stroke="#6CA8FF"/>';
  const neutralSort = '<rect x="312" y="134" width="112" height="28" rx="6" fill="#111A26" stroke="#283448"/>';
  if (next.includes(activeSort)) {
    next = replaceOne(next, activeSort, neutralSort, file, "contribution sort neutral surface");
  }
  if (next.includes(sortLabel) && !next.includes('data-icon="sort-chevron"')) {
    next = replaceOne(next, sortLabel, `${sortLabel}${sortChevron}`, file, "contribution single-sort chevron");
  }
  next = next.replace(
    /(<text x="(?:32|312)" y="124"[^>]*font-size=")14("[^>]*font-weight=")600/g,
    "$1" + "12" + "$2" + "400",
  );
  const firstCategory = '<rect x="32" y="134" width="70" height="28" rx="6" fill="#243B5C" stroke="#6CA8FF"/>';
  const firstSort = neutralSort;
  if (!next.includes('data-control="sort-profit"')) {
    next = replaceOne(next, firstCategory, `${makeHitAreas(next)}${firstCategory}`, file, "contribution category/sort hit areas");
    if (!next.includes(firstSort)) fail(file, "contribution sort control disappeared");
  }
  next = categoryVisuals(next, file);
  next = addGlobalMarketControl(next, file);
  next = normalizeHollowBars(next);
  // The embedded child uses the same legend contract as round 5, but its
  // x-anchors differ from the standalone contribution artwork. Match the
  // standalone labels by content so all four host widths receive the same
  // wording without touching row labels or numeric annotations.
  const realizedLegend = historyMode ? "仅已实现（历史模式）" : "已实现（实心）";
  next = replaceRegexOne(
    next,
    /(<text\b[^>]*\by="222"[^>]*>)已实现(<\/text>)/,
    `$1${realizedLegend}$2`,
    file,
    "contribution realized legend",
  );
  if (!historyMode) {
    next = replaceRegexOne(
      next,
      /(<text\b[^>]*\by="222"[^>]*>)浮盈变化(<\/text>)/,
      "$1浮盈变化（中空）$2",
      file,
      "contribution floating legend",
    );
  }
  if (next.includes("当前期间贡献") && !next.includes('data-legend="floating"')) {
    const floating = /<rect x="[^"]+" y="212" width="14" height="10" rx="5" fill="none" stroke="#[A-Fa-f0-9]+"[^>]*\/>/;
    const floatingMatch = next.match(floating);
    if (floatingMatch) {
      next = replaceRegexOne(next, floating, `${floatingMatch[0].replace(/stroke="#[A-Fa-f0-9]+"/, 'stroke="#53D7A0"').replace('/>', ' data-legend="floating"/>')}`, file, "contribution floating legend token");
    } else {
      const floatingLegend = '<rect x="575" y="212" width="14" height="10" rx="2" fill="none" stroke="#53D7A0" stroke-width="2" data-legend="floating"/><text x="597" y="222" font-family="Arial,\'PingFang SC\',sans-serif" font-size="12" fill="#A8B6CB">浮盈变化</text>';
      next = replaceRegexOne(next, /<text x="[^"]+" y="222"[^>]*>已实现<\/text>/, `${floatingLegend}$&`, file, "contribution floating legend");
    }
  }
  return next;
}

function transform(file, source) {
  const history = childBlock(source, '<svg x="96" y="1130"', file);
  const contribution = childBlock(source, '<svg x="96" y="1712.0"', file);
  if (history.start >= contribution.start) fail(file, "history/contribution child order is not preserved");
  const nextHistory = makeHistoryChild(history.value, file);
  const nextContribution = makeContributionChild(contribution.value, file);
  const viewBoxes = (value) => [...value.matchAll(/viewBox="[^"]+"/g)].map((m) => m[0]).filter((token) => token !== 'viewBox="0 0 14 14"');
  const beforeViewBoxes = viewBoxes(source);
  const updated = source.slice(0, history.start)
    + nextHistory
    + source.slice(history.end, contribution.start)
    + nextContribution
    + source.slice(contribution.end);
  const afterViewBoxes = viewBoxes(updated);
  if (JSON.stringify(beforeViewBoxes) !== JSON.stringify(afterViewBoxes)) fail(file, "viewBox changed");
  for (const marker of ['<svg x="96" y="1130"', '<svg x="96" y="1712.0"']) {
    if (source.split(marker).length - 1 !== 1 || updated.split(marker).length - 1 !== 1) {
      fail(file, `expected one ${marker} marker before and after edit`);
    }
  }
  const changed = nextHistory !== history.value || nextContribution !== contribution.value;
  return { source: updated, changed };
}

fs.mkdirSync(previewDir, { recursive: true });
let failures = 0;
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  try {
    const result = transform(file, source);
    if (!result.changed) {
      console.log(`${file}: already synchronized`);
      if (preview) fs.writeFileSync(path.join(previewDir, path.basename(file)), source);
      continue;
    }
    if (checkOnly) {
      console.log(`${file}: pending structural history/contribution sync (no files changed)`);
    } else if (preview) {
      const output = path.join(previewDir, path.basename(file));
      fs.writeFileSync(output, result.source);
      console.log(`${file}: wrote preview ${output}`);
    } else {
      fs.writeFileSync(file, result.source);
      console.log(`${file}: applied structural history/contribution sync`);
    }
  } catch (error) {
    failures += 1;
    console.error(error instanceof Error ? error.message : error);
  }
}
if (failures) process.exitCode = 1;

