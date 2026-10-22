#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const baselineRoot = path.resolve(
  new URL('../..', import.meta.url).pathname,
);
const imageRoot = path.join(baselineRoot, 'source', 'images');
const apply = process.argv.includes('--apply');

function read(name) {
  return fs.readFileSync(path.join(imageRoot, name), 'utf8');
}

function write(name, source) {
  if (apply) fs.writeFileSync(path.join(imageRoot, name), source);
}

function replaceExactOrKeep(name, source, from, to) {
  if (to !== '' && source.includes(to)) return source;
  const count = source.split(from).length - 1;
  if (count === 1) return source.replace(from, to);
  if (count === 0 && to === '') return source;
  throw new Error(`${name}: expected one repair target or its repaired form, found ${count}\n${from}`);
}

function resizeTooltips(name, expected) {
  const source = read(name);
  const re = /(<g data-component="ChartTooltip"><rect[^>]*width="264" height=")(112|132)("[^>]*>)/g;
  const matches = source.match(re) ?? [];
  const repaired = source.match(/<g data-component="ChartTooltip"><rect[^>]*width="264" height="144"/g) ?? [];
  if (matches.length === 0 && repaired.length === expected) {
    write(name, source);
    return source;
  }
  if (matches.length !== expected) {
    throw new Error(`${name}: expected ${expected} tooltip rect(s), found ${matches.length}`);
  }
  const next = source.replace(re, (_, prefix, _height, suffix) => `${prefix}144${suffix}`);
  write(name, next);
  return next;
}

function transformTooltipGroups(name, source, expectedFirstY, delta) {
  const firstYs = new Map(expectedFirstY.map((value) => [value, (expectedFirstY.filter((item) => item === value).length)]));
  let cursor = 0;
  let output = '';
  let transformed = 0;
  while (true) {
    const start = source.indexOf('<g data-component="ChartTooltip"', cursor);
    if (start < 0) {
      output += source.slice(cursor);
      break;
    }
    output += source.slice(cursor, start);
    const tags = /<\/?g\b[^>]*>/g;
    tags.lastIndex = start;
    let depth = 0;
    let end = -1;
    let match;
    while ((match = tags.exec(source)) !== null) {
      if (match[0].startsWith('</')) depth -= 1;
      else depth += 1;
      if (depth === 0) {
        end = tags.lastIndex;
        break;
      }
    }
    if (end < 0) throw new Error(`${name}: unterminated ChartTooltip group`);
    const segment = source.slice(start, end);
    const firstText = segment.match(/<text\b[^>]*\by="(-?\d+(?:\.\d+)?)"/);
    if (!firstText) {
      output += segment;
    } else {
      const firstY = Number(firstText[1]);
      if (firstYs.has(firstY) && firstYs.get(firstY) > 0) {
        firstYs.set(firstY, firstYs.get(firstY) - 1);
        output += segment
          .replace(/(<text\b[^>]*\by=")(-?\d+(?:\.\d+)?)/g, (_, prefix, value) => `${prefix}${Number(value) + delta}`)
          .replace(/(<svg\b[^>]*\by=")(-?\d+(?:\.\d+)?)/g, (_, prefix, value) => `${prefix}${Number(value) + delta}`);
        transformed += 1;
      } else {
        const repairedBaseline = expectedFirstY.find((value) => value + delta === firstY && firstYs.get(value) > 0);
        if (repairedBaseline !== undefined) {
          firstYs.set(repairedBaseline, firstYs.get(repairedBaseline) - 1);
          output += segment;
        } else {
          throw new Error(`${name}: unexpected ChartTooltip first text baseline ${firstY}`);
        }
      }
    }
    cursor = end;
  }
  const remaining = [...firstYs.values()].reduce((sum, value) => sum + value, 0);
  if (remaining !== 0) throw new Error(`${name}: expected ${remaining} tooltip content group(s) to shift`);
  return { source: output, transformed };
}

function resizeSharedAtom(source) {
  const re = /(<g data-component="ChartTooltip"><rect[^>]*width="264" height=")(112|124)("[^>]*>)/g;
  const matches = source.match(re) ?? [];
  const repaired = source.match(/<g data-component="ChartTooltip"><rect[^>]*width="264" height="124"/g) ?? [];
  if (matches.length === 0 && repaired.length === 7) return source;
  if (matches.length !== 7) {
    throw new Error(`atom-charttooltip.svg: expected seven 264px tooltip shells, found ${matches.length}`);
  }
  return source.replace(re, (_, prefix, _height, suffix) => `${prefix}124${suffix}`);
}

const normalStatus = {
  'chart-hover.svg': [
    [
      '<text x="1000.0" y="274" font-size="12" fill="#A8B6CB" font-weight="400" text-anchor="end">汇率✓ 行情✓</text>',
      '',
    ],
  ],
  'chart-hover--keyboard.svg': [
    [
      '<text x="380" y="592" font-size="12" fill="#A8B6CB" font-weight="400" text-anchor="end">汇率✓ 行情✓</text>',
      '',
    ],
  ],
  'atom-charttooltip.svg': [
    [
      '<text x="296" y="158" font-size="12" fill="#A8B6CB" font-weight="400" text-anchor="end">汇率✓ 行情✓</text>',
      '',
    ],
    [
      '<text x="836" y="158" font-size="12" fill="#A8B6CB" font-weight="400" text-anchor="end">汇率✓ 行情✓</text>',
      '',
    ],
    [
      '<text x="296" y="403" font-size="12" fill="#A8B6CB" font-weight="400" text-anchor="end">汇率✓ 行情✓</text>',
      '',
    ],
    [
      '<text x="836" y="403" font-size="12" fill="#A8B6CB" font-weight="400" text-anchor="end">汇率✓ 行情✓</text>',
      '',
    ],
  ],
};

const historyFiles = [
  'history.svg',
  'history-stats-cumulative.svg',
  'history-stats-empty.svg',
  'history-stats-error.svg',
  'history-stats-extreme.svg',
  'history-stats-rounds.svg',
  'history-stats-source-missing.svg',
  'history-stats-win.svg',
  'journeys-year.svg',
];
const title = '<text x="56" y="68" fill="#e6edf7" font-size="18" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif" font-weight="600" text-anchor="start">历史已平仓</text>';
const infoIcon = (x, y) => `<svg x="${x}" y="${y}" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="#6CA8FF" stroke-width="1.5"/><path d="M12 10v6M12 7h.01" fill="none" stroke="#6CA8FF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const infoGroup = (label, x, y) => `<g role="img" aria-label="${label}" data-icon="info"><title>${label}</title>${infoIcon(x, y)}</g>`;
const info = `<g role="img" aria-label="统计口径说明" data-control="history-scope-info" data-icon="info"><title>统计日期取平仓时间；仅统计已平仓回合</title>${infoIcon(162, 56)}</g>`;

if (apply) {
  for (const [name, expected] of Object.entries({
    'chart-hover.svg': 2,
    'chart-hover--keyboard.svg': 2,
  })) {
    const resized = resizeTooltips(name, expected);
    const firstY = name === 'chart-hover.svg' ? [264] : [582];
    const shifted = transformTooltipGroups(name, resized, firstY, 10);
    write(name, shifted.source);
  }

  let atom = resizeSharedAtom(read('atom-charttooltip.svg'));
  atom = transformTooltipGroups(
    'atom-charttooltip.svg',
    atom,
    [148, 148, 393, 393, 638, 883, 883],
    10,
  ).source;
  atom = replaceExactOrKeep(
    'atom-charttooltip.svg',
    atom,
    '<text x="182" y="614" font-family="ui-sans-serif, -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif" font-size="11px" font-weight="400" fill="#A8B6CB" text-anchor="start">外观 264×112 · 命中 264×112</text>',
    '<text x="182" y="614" font-family="ui-sans-serif, -apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif" font-size="11px" font-weight="400" fill="#A8B6CB" text-anchor="start">外观 264×124 · 命中 264×124</text>',
  );

  for (const [name, replacements] of Object.entries(normalStatus)) {
    let source = read(name);
    for (const [from, to] of replacements) source = replaceExactOrKeep(name, source, from, to);
    write(name, source);
  }

  const atomTooltips = atom.match(/<g data-component="ChartTooltip"><rect[^>]*width="264" height="124"/g) ?? [];
  if (atomTooltips.length !== 7 || atom.includes('width="264" height="132"')) {
    throw new Error('atom-charttooltip.svg: shared tooltip shell must remain fixed at 264×124');
  }
  const abnormalStatus = [
    [
      '<text x="836" y="648" font-size="12" fill="#FFC66D" font-weight="400" text-anchor="end">行情加载中</text>',
      infoGroup('行情加载中', 820, 640),
    ],
    [
      '<text x="296" y="893" font-size="12" fill="#FFC66D" font-weight="400" text-anchor="end">行情缺失</text>',
      infoGroup('行情缺失', 280, 885),
    ],
    [
      '<text x="836" y="893" font-size="12" fill="#FFC66D" font-weight="400" text-anchor="end">汇率缺失</text>',
      infoGroup('汇率缺失', 820, 885),
    ],
  ];
  for (const [from, to] of abnormalStatus) atom = replaceExactOrKeep('atom-charttooltip.svg', atom, from, to);
  write('atom-charttooltip.svg', atom);

  for (const name of historyFiles) {
    let source = read(name);
    source = replaceExactOrKeep(name, source, title, `${title}${info}`);
    const subtitle = name === 'journeys-year.svg'
      ? '<text x="56" y="84" fill="#a8b6cb" font-size="14" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif" font-weight="400" text-anchor="start">按平仓时间 · 2024–2026</text>'
      : '<text x="56" y="84" fill="#a8b6cb" font-size="14" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif" font-weight="400" text-anchor="start">按平仓时间 · 2026</text>';
    source = replaceExactOrKeep(name, source, subtitle, '');
    write(name, source);
  }

  let gap = read('chart-gap.svg');
  gap = replaceExactOrKeep(
    'chart-gap.svg',
    gap,
    '<text x="462.0" y="321" font-size="12" fill="#FFC66D" font-weight="400" text-anchor="start">数据缺失 · 金额 —</text>',
    `<g role="img" aria-label="数据缺失 · 金额 —" data-icon="info"><title>数据缺失 · 金额 —</title>${infoIcon(462, 313)}<text x="482.0" y="321" font-size="12" fill="#FFC66D" font-weight="400" text-anchor="start">数据缺失 · 金额 —</text></g>`,
    1,
  );
  write('chart-gap.svg', gap);
}

if (!apply) {
  // The checks below are intentionally source-level; browser/runtime state is outside this repair.
  for (const name of ['chart-hover.svg', 'chart-hover--keyboard.svg']) {
    const source = read(name);
    if (source.includes('汇率✓ 行情✓')) throw new Error(`${name}: normal status marker remains`);
    if ((source.match(/<g data-component="ChartTooltip"><rect[^>]*width="264" height="144"/g) ?? []).length !== 2) {
      throw new Error(`${name}: expected two 264×144 tooltip shells`);
    }
  }
  const atom = read('atom-charttooltip.svg');
  if (atom.includes('汇率✓ 行情✓')) throw new Error('atom-charttooltip.svg: normal status marker remains');
  if ((atom.match(/<g data-component="ChartTooltip"><rect[^>]*width="264" height="124"/g) ?? []).length !== 7) {
    throw new Error('atom-charttooltip.svg: shared tooltip shell must remain fixed at 264×124');
  }
  for (const name of historyFiles) {
    const source = read(name);
    if (source.includes('按平仓时间 ·')) throw new Error(`${name}: redundant range subtitle remains`);
    if (!source.includes('data-control="history-scope-info"')) throw new Error(`${name}: scope info marker missing`);
  }
  const infoSources = [
    'chart-hover.svg',
    'chart-hover--keyboard.svg',
    'atom-charttooltip.svg',
    'chart-gap.svg',
    ...historyFiles,
  ].map(read);
  if (infoSources.some((source) => source.includes('ⓘ'))) throw new Error('info marker still uses a font glyph');
  const iconPattern = /<svg[^>]*width="16" height="16" viewBox="0 0 24 24"[^>]*aria-hidden="true"[^>]*><circle[^>]*\/><path[^>]*\/><\/svg>/;
  if (infoSources.filter((source) => source.includes('data-icon="info"')).some((source) => !iconPattern.test(source))) {
    throw new Error('an info marker is missing the 16px circle/path SVG icon');
  }
  const gap = read('chart-gap.svg');
  if (!gap.includes('data-icon="info"')) throw new Error('chart-gap.svg: missing-data info marker missing');
}

console.log(`${apply ? 'Applied' : 'Validated'} chart comment repair source changes.`);
