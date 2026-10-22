import { writeFileSync } from 'node:fs';
import { contributionFixture, getContributionSource } from '../preview/contribution-fixture.mjs';

const palette = { bg: '#111A26', raised: '#162233', line: '#283448', text: '#E6EDF7', muted: '#A8B6CB', weak: '#71829B', blue: '#6CA8FF', gain: '#53D7A0', loss: '#FF8592' };
const keys = ['cn', 'hk', 'us'];

function allocate(target, weights) {
  const sum = weights.reduce((n, x) => n + x, 0);
  const values = weights.map((w) => Math.trunc(target * w / sum));
  const remainder = target - values.reduce((n, x) => n + x, 0);
  for (let i = 0; i < Math.abs(remainder); i += 1) values[i % values.length] += remainder > 0 ? 1 : -1;
  return values;
}
function format(value) { const sign = value < 0 ? '-' : value > 0 ? '+' : ''; const amount = Math.abs(value); if (amount >= 1e8) return `${sign}${(amount / 1e8).toFixed(2)}亿`; if (amount >= 1e4) return `${sign}${(amount / 1e4).toFixed(2)}万`; return `${sign}${amount.toLocaleString('en-US')}`; }
function full(value) { return `${value < 0 ? '-' : ''}${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CNY`; }
function valueColor(value, positive = palette.gain) { return value > 0 ? positive : value < 0 ? palette.loss : palette.text; }
function esc(value) { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'); }
function text(x, y, value, size = 14, fill = palette.text, weight = 400, anchor = 'start', title = '') { return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Arial,'PingFang SC',sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${title ? `<title>${esc(title)}</title>` : ''}${esc(value)}</text>`; }
function control(x, y, width, label, active = false) { return `<rect x="${x}" y="${y}" width="${width}" height="36" rx="6" fill="${active ? '#243B5C' : palette.raised}" stroke="${active ? palette.blue : palette.line}"/><text x="${x + width / 2}" y="${y + 23}" text-anchor="middle" font-family="Arial,'PingFang SC',sans-serif" font-size="14" fill="${palette.text}">${esc(label)}</text>`; }
function legend(x, y, label, color, outline = false) { return `<rect x="${x}" y="${y - 10}" width="14" height="10" rx="5" fill="${outline ? 'none' : color}" stroke="${color}" stroke-width="${outline ? 2 : 0}"/><text x="${x + 22}" y="${y}" font-family="Arial,'PingFang SC',sans-serif" font-size="12" fill="${palette.muted}">${label}</text>`; }

export function layoutMarketSegments(market, zero, track, max) {
  const scale = (value) => Math.abs(value) / max * track;
  const realizedWidth = scale(market.realized);
  const floatingWidth = scale(market.floating);
  const positiveFloatingX = zero + Math.max(market.realized, 0) * track / max;
  const negativeFloatingX = zero - Math.abs(Math.min(market.realized, 0) + Math.min(market.floating, 0)) * track / max;
  return {
    realized: { x: market.realized >= 0 ? zero : zero - realizedWidth, width: realizedWidth },
    floating: { x: market.floating >= 0 ? positiveFloatingX : negativeFloatingX, width: floatingWidth }
  };
}
/** Build from the shared preview fixture; rootComposition supplies the selected range identity. */
export function buildContributionSvg(width, rootComposition = {}) {
  if (![1320, 1160].includes(width)) throw new RangeError('width must be 1320 or 1160');
  const mode = rootComposition.mode === 'historical' ? 'historical' : 'current';
  const source = getContributionSource(mode, rootComposition.sourceId);
  const range = rootComposition.range ?? source.range;
  const kind = rootComposition.kind ?? 'long';
  const allMarkets = keys.map((code) => ({ code, ...source.markets[code] }));
  const total = allMarkets.reduce((n, x) => n + x.total, 0);
  const realized = allMarkets.reduce((n, x) => n + x.realized, 0);
  const floating = allMarkets.reduce((n, x) => n + x.floating, 0);
  const left = 32; const right = width - 32; const zero = Math.round(width * 0.52); const track = Math.round(width * 0.30); const max = Math.max(...allMarkets.map((x) => Math.max(Math.max(x.realized, 0) + Math.max(x.floating, 0), Math.abs(Math.min(x.realized, 0) + Math.min(x.floating, 0)))), 1); const rowsY = 306;
  const rows = allMarkets.map((market, i) => { const y = rowsY + i * 72; const segments = layoutMarketSegments(market, zero, track, max); const realizedX = segments.realized.x; const realizedWidth = segments.realized.width; const floatingX = segments.floating.x; const floatingWidth = segments.floating.width; const realizedColor = valueColor(market.realized); const floatingColor = market.floating < 0 ? palette.loss : palette.blue; const floatingBar = mode === 'current' && market.floating ? `<rect x="${floatingX}" y="${y - 10}" width="${floatingWidth}" height="10" rx="0" fill="none" stroke="${floatingColor}" stroke-width="3"><title>浮盈变化 ${full(market.floating)}</title></rect>` : ''; return `${text(left, y + 5, market.name, 14)}${market.realized ? `<rect x="${realizedX}" y="${y - 13}" width="${realizedWidth}" height="14" rx="1" fill="${realizedColor}"><title>已实现 ${full(market.realized)}</title></rect>` : ''}${floatingBar}${text(right, y + 5, format(market.total), 14, valueColor(market.total), 700, 'end', full(market.total))}`; }).join('');
  const title = mode === 'historical' ? '历史已平仓贡献' : '当前期间贡献'; const summaryColor = valueColor(total); const rangeText = mode === 'historical' ? range.label : `${range.label} · 已实现 + 浮盈变化`; const openFilter = mode === 'current' ? control(left + 520, 130, 124, '仅看未平仓') : ''; const chartLegend = mode === 'current' ? `${legend(zero - 126, 222, '已实现', palette.gain)}${legend(zero - 24, 222, '浮盈变化', palette.blue, true)}` : legend(zero - 58, 222, '已实现', palette.gain); const footerSummary = mode === 'historical' ? `已实现 ${format(realized)}` : `已实现 ${format(realized)} · 浮盈变化 ${format(floating)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="610" viewBox="0 0 ${width} 610"><rect width="${width}" height="610" rx="8" fill="${palette.bg}"/><rect x="1" y="1" width="${width - 2}" height="608" rx="8" fill="none" stroke="${palette.line}"/>${text(left, 36, title, 18, palette.text, 700)}${text(right, 36, format(total) + ' CNY', 18, summaryColor, 700, 'end', full(total))}${text(left, 58, rangeText, 12, palette.muted)}${control(left, 70, 92, '当前期间', mode === 'current')}${control(left + 100, 70, 104, '历史已平仓', mode === 'historical')}${text(left, 124, '分类', 12, palette.weak)}${control(left, 130, 70, '做多', kind === 'long')}${control(left + 78, 130, 70, '做空', kind === 'short')}${control(left + 156, 130, 70, '打新', kind === 'ipo')}${text(left + 280, 124, '排序', 12, palette.weak)}${control(left + 280, 130, 112, '盈利最高 ↓', true)}${control(left + 400, 130, 112, '亏损最大 ↑')}${openFilter}${text(left + 680, 124, '全局市场', 12, palette.weak)}${text(left + 680, 152, '全部市场', 14, palette.text, 700)}${chartLegend}${text(left, 264, '市场', 12, palette.weak)}${text(right, 264, '合计', 12, palette.weak, 400, 'end')}<path d="M${zero} 276V500" stroke="${palette.muted}"/>${rows}${text(left, 548, '合计', 14, palette.text, 700)}${text(right, 548, format(total) + ' CNY', 14, summaryColor, 700, 'end', full(total))}${text(left, 574, footerSummary, 12, palette.muted)}${text(right, 574, '市场合计', 12, palette.muted, 400, 'end', full(total))}</svg>`;
}

if (process.argv[1]?.endsWith('build-contribution-module.mjs')) { const currentRange = { from: '2026-01-01', to: '2026-10-15', label: '本年 · 当前表现日期 2026-01-01 — 2026-10-15' }; const historicalRange = { from: '2026-01-01', to: '2026-10-15', label: '历史范围 2026 · 只统计已平仓回合' }; writeFileSync('integration/contribution-module-1320.svg', buildContributionSvg(1320, { mode: 'current', range: currentRange })); writeFileSync('integration/contribution-module-1160.svg', buildContributionSvg(1160, { mode: 'current', range: currentRange })); writeFileSync('integration/contribution-module-history-1320.svg', buildContributionSvg(1320, { mode: 'historical', range: historicalRange })); writeFileSync('integration/contribution-module-history-1160.svg', buildContributionSvg(1160, { mode: 'historical', range: historicalRange })); }
