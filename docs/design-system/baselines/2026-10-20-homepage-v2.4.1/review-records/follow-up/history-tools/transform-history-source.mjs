import fs from 'node:fs';

import { ensureRepoRoot } from './repo-root.mjs';
ensureRepoRoot(import.meta.url);
const root = 'docs/design-system/baselines/2026-10-20-homepage-v2.4.1/source/images';
const files = [
  ['history.svg', '每月净盈亏', true],
  ['history-stats-cumulative.svg', '累计净盈亏', true],
  ['history-stats-empty.svg', '每月净盈亏', true],
  ['history-stats-win.svg', '各期胜率', true],
  ['history-stats-rounds.svg', '各期回合数', true],
  ['history-stats-error.svg', '每月净盈亏', false],
  ['history-stats-source-missing.svg', '每月净盈亏', false],
  ['history-stats-extreme.svg', '每月净盈亏', false],
];

const legacyControls = /<rect x="860" y="42" width="170" height="36" rx="7" fill="#111a26" stroke="#283448"\/><text x="884" y="66" fill="#e6edf7" font-size="14" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif" font-weight="400" text-anchor="start">[^<]*<\/text><rect x="1042" y="42" width="150" height="36" rx="7" fill="#111a26" stroke="#283448"\/><text x="1067" y="66" fill="#e6edf7" font-size="14" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif" font-weight="400" text-anchor="start">[^<]*<\/text><rect x="1204" y="42" width="180" height="36" rx="7" fill="#111a26" stroke="#283448"\/><text x="1228" y="66" fill="#e6edf7" font-size="14" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif" font-weight="400" text-anchor="start">[^<]*<\/text>/;
const chevron = (x) => `<svg x="${x}" y="50" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" data-icon="chevron"><path d="M3 5.5l4 4 4-4" fill="none" stroke="#a8b6cb" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
// Round4 D07's choice-a hides the field labels visually while preserving their
// accessible names on the controls.  Keep the same contract in the static
// SVG: one shared frame, 14px values, and independent chevrons adjacent to
// each value.  The group title/aria-label carry the hidden field names.
const shell = (metric) => `<g role="group" aria-label="范围：2026；展示方式：${metric}" data-control="history-controls"><title>范围：2026；展示方式：${metric}</title><rect x="1102" y="42" width="282" height="36" rx="7" fill="#111a26" stroke="#283448"/><text x="1114" y="65" fill="#e6edf7" font-size="14" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif" font-weight="400" text-anchor="start">2026</text>${chevron(1158)}<line x1="1182" y1="50" x2="1182" y2="70" stroke="#283448"/><text x="1194" y="65" fill="#e6edf7" font-size="14" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif" font-weight="400" text-anchor="start">${metric}</text>${chevron(metric === '各期胜率' ? 1258 : 1272)}</g>`;
const annualShell = `<g role="group" aria-label="范围：2024–2026；展示方式：每年净盈亏" data-control="history-controls"><title>范围：2024–2026；展示方式：每年净盈亏</title><rect x="1102" y="42" width="282" height="36" rx="7" fill="#111a26" stroke="#283448"/><text x="1114" y="65" fill="#e6edf7" font-size="14" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif" font-weight="400" text-anchor="start">2024–2026</text>${chevron(1192)}<line x1="1216" y1="50" x2="1216" y2="70" stroke="#283448"/><text x="1228" y="65" fill="#e6edf7" font-size="14" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif" font-weight="400" text-anchor="start">每年净盈亏</text>${chevron(1306)}</g>`;
const caption = '<text x="56" y="84" fill="#a8b6cb" font-size="14" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif" font-weight="400" text-anchor="start">按平仓时间 · 2026</text>';
const chartPanel = '<rect x="56" y="214" width="1328" height="320" rx="10" fill="#111a26" stroke="#283448"/>';
const futureZonePlain = '<rect x="1211" y="280" width="169" height="210" fill="#1d2b40" opacity="0.85"/><line x1="1211" y1="280" x2="1211" y2="490" stroke="#71829b" stroke-dasharray="4 4"/>';
const futureZone = '<rect x="1211" y="280" width="169" height="210" fill="#1d2b40" opacity="0.85" data-state="future-zone"/><line x1="1211" y1="280" x2="1211" y2="490" stroke="#71829b" stroke-dasharray="4 4"/>';

function replaceShell(value, replacement, metricX) {
  if (value.includes(replacement)) return value;
  const start = value.indexOf("<rect x=\"1102\" y=\"42\"");
  const end = start < 0 ? -1 : value.indexOf("<rect x=\"56\" y=\"94\"", start);
  if (start < 0 || end < 0) return value;
  return value.slice(0, start) + replacement + value.slice(end);
}

function compactAmount(value) {
  const raw = String(value).replace(/[，,\s]/g, '').replace(/−/g, '-');
  const numeric = Number(raw.replace(/[^0-9.+-]/g, ''));
  if (!Number.isFinite(numeric) || Math.abs(numeric) < 10000) return value;
  const sign = numeric < 0 ? '−' : numeric > 0 ? '+' : '';
  const divisor = Math.abs(numeric) >= 100000000 ? 100000000 : 10000;
  const unit = divisor === 100000000 ? '亿' : '万';
  return `${sign}${(Math.abs(numeric) / divisor).toFixed(2)}${unit}`;
}

function compactNetCard(value) {
  return value.replace(
    /(<text x="76" y="157"[^>]*><title>)([^<]+)(<\/title>)([^<]*)(<\/text>)/,
    (_, prefix, title, close, visible, suffix) => {
      const compact = compactAmount(title);
      return `${prefix}${title}${close}${compact}${suffix}`;
    },
  );
}

function compactAxisAmount(value) {
  const raw = String(value).replace(/[，,\s]/g, '').replace(/−/g, '-');
  const numeric = Number(raw.replace(/[^0-9.+-]/g, ''));
  if (!Number.isFinite(numeric) || Math.abs(numeric) < 10000) return value;
  const sign = numeric < 0 ? '-' : '';
  const divisor = Math.abs(numeric) >= 100000000 ? 100000000 : 10000;
  const unit = divisor === 100000000 ? '亿' : '万';
  return `${sign}${(Math.abs(numeric) / divisor).toFixed(2)}${unit}`;
}

function compactAmountAxis(value) {
  return value.replace(
    /(<text x="(?:126|94)"[^>]*>)([-+−]?\d[\d,]*)(<\/text>)/g,
    (_, prefix, number, suffix) => `${prefix}${compactAxisAmount(number)}${suffix}`,
  );
}

function emphasizeZeroLine(value, zeroY) {
  return value.replace(
    /<line x1="140" y1="(290|340|390|440|490)" x2="1380" y2="\1" stroke="#(?:283448|a8b6cb)"\/>/g,
    (_, y) => "<line x1=\"140\" y1=\"" + y + "\" x2=\"1380\" y2=\"" + y + "\" stroke=\"" + (Number(y) === zeroY ? "#a8b6cb" : "#283448") + "\"/>",
  );
}

const normalEmptyZones = [
  '<rect x="196.36" y="280" width="112.73" height="210" fill="#30291e" opacity="0.65" data-state="empty"/>',
  '<rect x="534.55" y="280" width="112.73" height="210" fill="#30291e" opacity="0.65" data-state="empty"/>',
  '<rect x="872.73" y="280" width="112.73" height="210" fill="#30291e" opacity="0.65" data-state="empty"/>',
].join('');

function addNormalEmptyZones(value) {
  if (value.includes('data-state="empty"')) return value;
  return value.replace(futureZone, `${normalEmptyZones}${futureZone}`);
}

function addFullStateZone(value, state, fill, opacity) {
  if (value.includes(`data-state="${state}"`)) return value;
  const zone = `<rect x="140" y="280" width="1240" height="210" fill="${fill}" opacity="${opacity}" data-state="${state}"/>`;
  return value.replace(chartPanel, `${chartPanel}${zone}`);
}

function update(file, metric, includeFuture) {
  const path = `${root}/${file}`;
  const before = fs.readFileSync(path, 'utf8');
  let after = before;
  if (legacyControls.test(after)) after = after.replace(legacyControls, shell(metric));
  after = replaceShell(after, shell(metric), 1288);
  after = after.replace(/<text x="56" y="84" fill="#a8b6cb" font-size="14" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif" font-weight="400" text-anchor="start">[^<]*<\/text>/, caption);
  after = after.replaceAll('历史已平仓净盈亏', '已平仓净盈亏');
  after = compactNetCard(after);
  after = after.replace(/<text x="748" y="178" fill="#a8b6cb" font-size="11" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif" font-weight="400" text-anchor="start">(<title>[^<]*<\/title>[^<]*)<\/text>/, '<text x="1026" y="157" fill="#a8b6cb" font-size="11" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif" font-weight="400" text-anchor="end">$1</text>');
  after = after.replace(/<text[^>]*>无回合<\/text>/g, '');
  after = after.replace(/<text[^>]*>未来未覆盖<\/text>/g, '');
  after = after.replace('<line x1="140" y1="440" x2="1380" y2="440" stroke="#283448"/>', '<line x1="140" y1="440" x2="1380" y2="440" stroke="#a8b6cb"/>');
  after = after.replace(/>(0[1-9])月</g, (_, month) => `>${Number(month)}月`);
  after = after.replaceAll(futureZonePlain, futureZone);
  while (after.includes(futureZone + futureZone)) after = after.replace(futureZone + futureZone, futureZone);
  after = compactAmountAxis(after);
  const zeroY = file.includes("cumulative") || file.includes("win") || file.includes("rounds")
    ? 490
    : file.includes("extreme")
      ? 390
      : 440;
  after = emphasizeZeroLine(after, zeroY);
  if (['history.svg', 'history-stats-win.svg', 'history-stats-rounds.svg'].includes(file)) {
    after = addNormalEmptyZones(after);
  }
  if (file === 'history-stats-empty.svg') {
    after = after.replace(futureZone, '');
    after = addFullStateZone(after, 'empty', '#30291e', '0.65');
  }
  if (file === 'history-stats-source-missing.svg') {
    after = addFullStateZone(after, 'missing', '#423125', '0.55');
  }
  if (includeFuture && file !== 'history-stats-empty.svg' && !after.includes('data-state="future-zone"')) {
    after = after.replace(chartPanel, `${chartPanel}${futureZone}`);
  }
  if (after === before) {
    console.log(`${file}: already synchronized`);
    return;
  }
  fs.writeFileSync(path, after);
  console.log(`${file}: ${before.length} -> ${after.length}`);
}

for (const [file, metric, includeFuture] of files) update(file, metric, includeFuture);

// The static contribution canvases document data states. The market → symbol →
// detail → return journey is verified in the prototype/browser evidence and is
// intentionally kept out of the product canvas so it cannot become a second
// visible contribution zone or a fake in-product event log.
for (const file of [
  'contribution-current-a-share.svg',
  'contribution-historical-a-share.svg',
]) {
  const path = `${root}/${file}`;
  const before = fs.readFileSync(path, 'utf8');
  const after = before.replaceAll(' · 全部市场 > A股 > 标的明细 > 详情 > 返回', '');
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log(`${file}: removed journey annotation from canvas`);
  }
}

// A hollow contribution bar uses the same 14px outer height as a solid bar.
// Because SVG strokes are centered on the rect edge, the opening must be inset
// on every side before the stroke is drawn.  This keeps the visible geometry
// at 14px high and prevents the outlined segment from extending its value.
function normalizeHollowBars(value) {
  const get = (tag, name) => tag.match(new RegExp(`\\b${name}="([^\"]+)"`))?.[1] ?? null;
  const set = (tag, name, replacement) => {
    const pattern = new RegExp(`\\b${name}="[^"]+"`);
    if (!pattern.test(tag)) return tag;
    return tag.replace(pattern, `${name}="${replacement}"`);
  };
  return value.replace(/<rect\b[^>]*>/g, (tag) => {
    const height = Number(get(tag, 'height'));
    const width = Number(get(tag, 'width'));
    const x = Number(get(tag, 'x'));
    const y = Number(get(tag, 'y'));
    const fill = get(tag, 'fill')?.toLowerCase();
    const strokeWidth = Number(get(tag, 'stroke-width'));
    if (height !== 14 || fill !== 'none' || strokeWidth !== 2) return tag;
    if (![width, x, y].every(Number.isFinite) || width <= 2) return tag;
    let next = tag;
    next = set(next, 'x', String(x + 1));
    next = set(next, 'y', String(y + 1));
    next = set(next, 'width', String(width - 2));
    next = set(next, 'height', '12');
    return next;
  });
}

// Apply the same geometry rule to every current contribution canvas, including
// mixed-sign and state fixtures. Frozen historical copies are outside this
// source/images directory and are intentionally untouched.
for (const file of fs.readdirSync(root).filter((name) => name.startsWith('contribution') && name.endsWith('.svg'))) {
  const filePath = `${root}/${file}`;
  const before = fs.readFileSync(filePath, 'utf8');
  const after = normalizeHollowBars(before);
  if (after !== before) {
    fs.writeFileSync(filePath, after);
    console.log(`${file}: normalized hollow-bar outer geometry`);
  }
}

{
  const path = `${root}/contribution-current-a-share.svg`;
  const before = fs.readFileSync(path, 'utf8');
  const after = before.replace(
    '实心已实现 / 空心浮盈',
    '已实现（实心）/ 浮盈变化（中空）',
  );
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log('contribution-current-a-share.svg: clarified legend labels');
  }
}

{
  const path = `${root}/contribution-states.svg`;
  const before = fs.readFileSync(path, 'utf8');
  const after = before.replace(
    '市场汇总 → A股 → 标的明细 → 详情连接占位 → 返回；全量合计与明细逐市场对账；极值为独立压力情景。',
    '全市场与 canonical 明细逐市场对账；极值为独立压力情景。',
  );
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log('contribution-states.svg: removed journey annotation from canvas');
  }
}

const yearPath = `${root}/journeys-year.svg`;
const yearBefore = fs.readFileSync(yearPath, 'utf8');
let yearAfter = yearBefore;
if (legacyControls.test(yearAfter)) {
  yearAfter = yearAfter.replace(legacyControls, annualShell);
}
yearAfter = replaceShell(yearAfter, annualShell, 1310);
yearAfter = yearAfter.replace(/<text x="56" y="84" fill="#a8b6cb" font-size="14" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif" font-weight="400" text-anchor="start">[^<]*<\/text>/, '<text x="56" y="84" fill="#a8b6cb" font-size="14" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif" font-weight="400" text-anchor="start">按平仓时间 · 2024–2026</text>');
yearAfter = yearAfter.replaceAll('历史已平仓净盈亏', '已平仓净盈亏');
yearAfter = yearAfter.replace('>每月净盈亏</text>', '>每年净盈亏</text>');
// D10-A keeps the annual win-rate denominator on the same bottom baseline as
// the 64.3% value, right aligned within its 321×88 card. The old annual
// fixture left it below the card value at y=178; preserve its title/data and
// move only the presentation node.
yearAfter = yearAfter.replace(
  /<text x="748" y="178"([^>]*)>([\s\S]*?)<\/text>/,
  '<text x="1026" y="157"$1>$2</text>',
);
yearAfter = yearAfter.replace('<line x1="140" y1="440" x2="1380" y2="440" stroke="#283448"/>', '<line x1="140" y1="440" x2="1380" y2="440" stroke="#a8b6cb"/>');
yearAfter = compactAmountAxis(yearAfter);
yearAfter = emphasizeZeroLine(yearAfter, 440);
yearAfter = compactNetCard(yearAfter);
const monthLabels = /<text x="[^>]+" y="526" fill="#a8b6cb" font-size="11" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif" font-weight="400" text-anchor="middle">\d+月<\/text>/g;
const annualLabels = '<text x="140" y="526" fill="#a8b6cb" font-size="11" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif" font-weight="400" text-anchor="middle">2024</text><text x="760" y="526" fill="#a8b6cb" font-size="11" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif" font-weight="400" text-anchor="middle">2025</text><text x="1380" y="526" fill="#a8b6cb" font-size="11" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif" font-weight="400" text-anchor="middle">2026</text>';
const annualLabelTags = /<text x="(?:140|760|1380)" y="526" fill="#a8b6cb" font-size="11" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif" font-weight="400" text-anchor="middle">20(?:24|25|26)<\/text>/g;
if ((yearAfter.match(annualLabelTags) || []).length !== 3) {
  yearAfter = yearAfter.replace(monthLabels, '').replace(annualLabelTags, '');
  yearAfter = yearAfter.replace('</svg>', `${annualLabels}</svg>`);
}
if (yearAfter === yearBefore) {
  console.log('journeys-year.svg: already synchronized');
} else {
  fs.writeFileSync(yearPath, yearAfter);
  console.log(`journeys-year.svg: ${yearBefore.length} -> ${yearAfter.length}`);
}
