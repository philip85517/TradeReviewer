import '../preview/history-stats-render.js';

const { sum, series, y, renderChartSvg } = globalThis.HCR04_RENDER;
const COLORS = { bg: '#0B1019', surface: '#111A26', line: '#283448', text: '#E6EDF7', muted: '#A8B6CB', blue: '#6CA8FF', green: '#53D7A0', red: '#FF8592', yellow: '#FFC66D' };
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const fmt = value => typeof value === 'number' ? Math.abs(value) >= 1e12 ? `${(value / 1e12).toFixed(2)}万亿` : value.toLocaleString('en-US') : value;
const fullAmount = value => typeof value === 'number' ? value.toLocaleString('en-US') : value;
const metricInfo = { profit: ['净盈亏', 'CNY'], win: ['胜率', '%'], rounds: ['已平仓回合', '回合'] };

function normalizeMetric(metric) { return metric === '净盈亏' ? 'profit' : metric === '胜率' ? 'win' : metric === '已平仓回合' ? 'rounds' : metric; }

export function renderHistoryModule({ width, rootComposition, metric = 'profit', cumulative = false, status }) {
  if (![1320, 1160].includes(width)) throw new RangeError('width must be 1320 or 1160');
  const model = rootComposition.monthly;
  const normalized = normalizeMetric(metric);
  if (!metricInfo[normalized]) throw new RangeError(`unsupported metric: ${metric}`);
  const [metricLabel, unit] = metricInfo[normalized];
  const activeStatus = status ?? model.status;
  const values = series({ metric: normalized, p: model.p, w: model.w, r: model.r, cumulative, status: activeStatus });
  const pad = 24, gap = 12, contentWidth = width, cardWidth = (width - gap * 3) / 4;
  const chartY = 214, chartHeight = 320, plotX = pad + 82, plotWidth = width - pad * 2 - 82, plotTop = chartY + 66, plotHeight = 220;
  const chart = renderChartSvg({ values, metric: normalized, status: activeStatus, dimensions: { width: plotWidth, height: plotHeight } });
  const rounds = sum(model.r), wins = sum(model.w), profit = sum(model.p), fees = sum(model.f), winRate = rounds ? `${(wins / rounds * 100).toFixed(1)}%` : '—';
  const profitColor = profit > 0 ? COLORS.green : profit < 0 ? COLORS.red : COLORS.text;
  const cards = [['历史已平仓净盈亏', profit === null ? '—' : `${profit > 0 ? '+' : ''}${fmt(profit)}`, profitColor, profit === null ? '' : `${profit > 0 ? '+' : ''}${fullAmount(profit)}`], ['已平仓回合', fmt(rounds), COLORS.text, fullAmount(rounds)], ['范围胜率', winRate, COLORS.text, winRate], ['费用（已扣除）', fmt(fees), COLORS.text, fullAmount(fees)]];
  const controls = [[width - pad - 3 * 136, '2026（按月）'], [width - pad - 2 * 136, cumulative ? '累计' : '分期'], [width - pad - 136, metricLabel]];
  const text = (x, y, value, size, fill = COLORS.text, weight = '400', anchor = 'start', title = '') => `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}px" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif" font-weight="${weight}" text-anchor="${anchor}">${title ? `<title>${esc(title)}</title>` : ''}${esc(value)}</text>`;
  const rect = (x, y, w, h, fill = COLORS.surface, stroke = COLORS.line, radius = 8) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}"/>`;
  const future = activeStatus.map((state, index) => state === 'future-uncovered' ? index : -1).filter(index => index >= 0);
  const futureRuns = future.reduce((runs, index) => { const last = runs.at(-1); if (last && index === last.end + 1) last.end = index; else runs.push({ start: index, end: index }); return runs; }, []);
  const chartMarkup = chart.svg.replaceAll(/<text[^>]*>未来未覆盖<\/text>/g, '') + futureRuns.map(({ start, end }) => {
    const midpoint = (start + end) / 2;
    const x = midpoint / (model.x.length - 1 || 1) * plotWidth;
    const rangeLabel = start === end ? model.x[start] : `${model.x[start]}–${model.x[end]}`;
    return `<text x="${x}" y="205" text-anchor="middle" fill="var(--yellow,#ffc66d)" font-size="11"><title>未来未覆盖：${esc(rangeLabel)}</title>未来未覆盖</text>`;
  }).join('');
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${chartY + chartHeight + 24}" viewBox="0 0 ${width} ${chartY + chartHeight + 24}" role="img" aria-labelledby="history-title history-desc">`, `<rect width="${width}" height="${chartY + chartHeight + 24}" fill="${COLORS.bg}"/>`, '<title id="history-title">历史已平仓</title>', `<desc id="history-desc">历史统计，截至 ${esc(rootComposition.asOf)}；历史净盈亏 ${esc(fmt(profit))}，${esc(rounds)} 回合，胜率 ${esc(winRate)}，费用 ${esc(fmt(fees))}</desc>`];
  parts.push(text(pad, 32, '历史已平仓', 18, COLORS.text, '700'), text(pad, 58, `历史完成交易 · 2026年 · 截至 ${rootComposition.asOf}`, 14, COLORS.muted));
  for (const [x, label] of controls) { parts.push(rect(x, 20, 120, 36, COLORS.surface, COLORS.line, 6), text(x + 12, 43, `${label}⌄`, 14)); }
  cards.forEach(([label, value, color, title], index) => { const x = index * (cardWidth + gap); parts.push(rect(x, 82, cardWidth, 88, COLORS.surface, COLORS.line, 8), text(x + 16, 108, label, 14, COLORS.muted), text(x + 16, 145, value, 28, color, '700', 'start', title), index === 2 ? text(x + 16, 161, `${wins} / ${rounds} 盈利回合`, 11, COLORS.muted, '400', 'start', `${wins} / ${rounds} 盈利回合`) : ''); });
  parts.push(rect(0, chartY, contentWidth, chartHeight, COLORS.surface, COLORS.line, 8), text(pad, chartY + 32, `${metricLabel} · ${cumulative ? '累计' : '分期'}`, 18), text(width - pad - 20, chartY + 32, unit, 12, COLORS.muted, '400', 'end'));
  chart.scale.ticks.forEach(tick => { const gridY = plotTop + y(tick, chart.scale.min, chart.scale.max, plotHeight); const label = normalized === 'win' ? `${tick}%` : fmt(tick); const title = normalized === 'win' ? label : fullAmount(tick); parts.push(`<line x1="${plotX}" y1="${gridY}" x2="${width - pad}" y2="${gridY}" stroke="${COLORS.line}"/>`, text(plotX - 12, gridY + 4, label, 12, COLORS.muted, '400', 'end', title)); });
  parts.push(`<g transform="translate(${plotX} ${plotTop})">${chartMarkup.replaceAll('var(--blue,#6ca8ff)', COLORS.blue).replaceAll('var(--yellow,#ffc66d)', COLORS.yellow)}</g>`);
  model.x.forEach((label, index) => { const x = plotX + index / (model.x.length - 1 || 1) * plotWidth; parts.push(text(x, chartY + chartHeight - 20, label, 12, COLORS.muted, '400', 'middle')); });
  parts.push('</svg>');
  return { svg: parts.join(''), height: chartY + chartHeight + 24, width, metric: normalized, cumulative, totals: { profit, wins, rounds, fees, winRate } };
}
