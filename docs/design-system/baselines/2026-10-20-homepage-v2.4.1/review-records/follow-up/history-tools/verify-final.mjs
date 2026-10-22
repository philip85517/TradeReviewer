#!/usr/bin/env node

// Static guard for the artwork handoff. It complements the PNG evidence; it
// does not claim browser, hover, keyboard, touch, or runtime acceptance.
import fs from 'node:fs';

import { ensureRepoRoot } from './repo-root.mjs';
ensureRepoRoot(import.meta.url);
const sourceRoot = 'docs/design-system/baselines/2026-10-20-homepage-v2.4.1/source/images';
const previewRoot = '.scratch/homepage-v241-repair/work/history/evidence/shared';
const contributionFiles = fs.readdirSync(sourceRoot)
  .filter((name) => name.startsWith('contribution') && name.endsWith('.svg'));
const homeFiles = ['home-1280.svg', 'home-1440.svg', 'home-history-1280.svg', 'home-history-1440.svg'];

function fail(message) {
  throw new Error(message);
}

function child(value, marker) {
  const start = value.indexOf(marker);
  if (start < 0) fail(`missing ${marker}`);
  const tags = /<svg\b|<\/svg>/g;
  tags.lastIndex = start;
  let depth = 0;
  for (const match of value.matchAll(tags)) {
    depth += match[0] === '</svg>' ? -1 : 1;
    if (depth === 0) return value.slice(start, match.index + match[0].length);
  }
  fail(`unbalanced ${marker}`);
}

const result = { history: [], contribution: [], home: [] };
const historyFiles = [...fs.readdirSync(sourceRoot).filter((name) => name.startsWith('history') && name.endsWith('.svg')), 'journeys-year.svg'];
for (const name of historyFiles) {
  const value = fs.readFileSync(`${sourceRoot}/${name}`, 'utf8');
  const visibleLabels = (value.match(/>范围<|>展示方式</g) ?? []).length;
  const controlGroups = (value.match(/data-control="history-controls"/g) ?? []).length;
  const chevrons = (value.match(/data-icon="chevron"/g) ?? []).length;
  if (visibleLabels !== 0 || controlGroups !== 1 || chevrons !== 2) {
    fail(`${name}: history control guard failed (${JSON.stringify({ visibleLabels, controlGroups, chevrons })})`);
  }
  const annual = name === 'journeys-year.svg';
  if (annual && (!value.includes('font-size="14"') || !value.includes('<svg x="1192"') || !value.includes('<svg x="1306"') || !value.includes('<line x1="1216"') || !/<text x="1026" y="157"[^>]*text-anchor="end"/.test(value) || value.includes('<text x="748" y="178"'))) {
    fail(`${name}: annual shell coordinates/type guard failed`);
  }
  result.history.push({ name, visibleLabels, controlGroups, chevrons, annual });
}

for (const name of contributionFiles) {
  const value = fs.readFileSync(`${sourceRoot}/${name}`, 'utf8');
  const hollow14 = (value.match(/<rect\b[^>]*height="14"[^>]*fill="none"[^>]*stroke-width="2"[^>]*>/g) ?? []).length;
  const hollow12 = (value.match(/<rect\b[^>]*height="12"[^>]*fill="none"[^>]*stroke-width="2"[^>]*>/g) ?? []).length;
  if (hollow14 !== 0) fail(`${name}: hollow bar still has height=14`);
  result.contribution.push({ name, hollow14, hollow12 });
}

for (const name of homeFiles) {
  const value = fs.readFileSync(`${previewRoot}/${name}`, 'utf8');
  const history = child(value, '<svg x="96" y="1130"');
  const contribution = child(value, '<svg x="96" y="1712.0"');
  const sortFaces = (contribution.match(/<rect x="312" y="134" width="112" height="28"/g) ?? []).length;
  const sortNeutral = (contribution.match(/<rect x="312" y="134" width="112" height="28" rx="6" fill="#111A26" stroke="#283448"\/>/g) ?? []).length;
  const sortTextArrow = (contribution.match(/盈利最高\s*↓/g) ?? []).length;
  const oldLoss = (contribution.match(/亏损最大/g) ?? []).length;
  const sortHits = (contribution.match(/data-hit-area="36" data-control="sort-profit"/g) ?? []).length;
  const checkbox = (contribution.match(/data-visual="checkbox"/g) ?? []).length;
  const openHits = (contribution.match(/data-hit-area="36" data-control="open-only"/g) ?? []).length;
  const marketGroups = (contribution.match(/role="combobox"[^>]*data-control="market-scope"/g) ?? []).length;
  const marketFaces = (contribution.match(/data-visual="market-select-face"/g) ?? []).length;
  const marketHits = (contribution.match(/data-hit-area="36" data-control="market-scope"/g) ?? []).length;
  const marketChevrons = (contribution.match(/data-icon="market-chevron"/g) ?? []).length;
  const oldOpenButton = (contribution.match(/<rect x="552" y="134" width="124" height="28"[\s\S]*?仅看未平仓/g) ?? []).length;
  const openDisabled = (contribution.match(/data-control="open-only" data-state="unchecked"/g) ?? []).length;
  const disabledVisual = (contribution.match(/data-visual="checkbox" data-disabled="true"/g) ?? []).length;
  const categoryVisuals = (contribution.match(/data-visual="category"/g) ?? []).length;
  const selectedUnderlines = (contribution.match(/data-visual="category-selected"/g) ?? []).length;
  const expectedDisabled = name.includes('home-history-');
  const expectedRealizedLegend = expectedDisabled ? '仅已实现（历史模式）' : '已实现（实心）';
  const legendRealized = (contribution.match(new RegExp(expectedRealizedLegend, 'g')) ?? []).length;
  const legendFloating = (contribution.match(/浮盈变化（中空）/g) ?? []).length;
  const negativeText = (contribution.match(/fill="#FF8592"/g) ?? []).length;
  const negativeRectToken = (contribution.match(/<rect[^>]+(?:fill|stroke)="#FF8592"/g) ?? []).length;
  const hollow14 = (contribution.match(/<rect\b[^>]*height="14"[^>]*fill="none"[^>]*stroke-width="2"[^>]*>/g) ?? []).length;
  const expectedFloatingLegend = expectedDisabled ? 0 : 1;
  const expectedNegativeText = expectedDisabled ? 0 : 1;
  const disabledAttribute = contribution.includes('aria-disabled="true"');
  const expectedDisabledVisual = expectedDisabled ? 1 : 0;
  if (sortFaces !== 1 || sortNeutral !== 1 || sortTextArrow !== 0 || oldLoss !== 0 || sortHits !== 1 || checkbox !== 1 || openHits !== 1 || marketGroups !== 1 || marketFaces !== 1 || marketHits !== 1 || marketChevrons !== 1 || oldOpenButton !== 0 || openDisabled !== 1 || disabledAttribute !== expectedDisabled || disabledVisual !== expectedDisabledVisual || categoryVisuals !== 3 || selectedUnderlines !== 1 || legendRealized !== 1 || legendFloating !== expectedFloatingLegend || negativeText !== expectedNegativeText || negativeRectToken !== 0 || hollow14 !== 0) {
    fail(`${name}: contribution preview guard failed (${JSON.stringify({ sortFaces, sortNeutral, sortTextArrow, oldLoss, sortHits, checkbox, openHits, marketGroups, marketFaces, marketHits, marketChevrons, oldOpenButton, openDisabled, disabledAttribute, expectedDisabled, disabledVisual, expectedDisabledVisual, categoryVisuals, selectedUnderlines, expectedRealizedLegend, legendRealized, legendFloating, expectedFloatingLegend, negativeText, expectedNegativeText, negativeRectToken, hollow14 })})`);
  }
  const chevrons = (history.match(/data-icon="chevron"/g) ?? []).length;
  const legacyLabels = (history.match(/无回合|未来未覆盖/g) ?? []).length;
  const zeroLines = [...history.matchAll(/<line x1="106" y1="([0-9.]+)" x2="[^"]+" y2="\1" stroke="#A8B6CB" data-state="zero-line"\/>/g)];
  const tickLines = (history.match(/<line x1="106" y1="[0-9.]+" x2="[^"]+" y2="[0-9.]+" stroke="#283448"\/>/g) ?? []).length;
  if (chevrons !== 2 || legacyLabels !== 0 || zeroLines.length !== 1 || Number(zeroLines[0][1]) !== 470 || tickLines !== 5) {
    fail(`${name}: history preview guard failed (${JSON.stringify({ chevrons, legacyLabels, zeroLines: zeroLines.length, zeroY: zeroLines[0]?.[1] ?? null, tickLines })})`);
  }
  result.home.push({ name, sortFaces, sortHits, sortTextArrow, marketFaces, marketHits, marketChevrons, checkbox, disabledVisual, categoryVisuals, selectedUnderlines, expectedRealizedLegend, legendRealized, legendFloating, hollow14, chevrons, legacyLabels, zeroY: Number(zeroLines[0][1]), tickLines });
}

console.log(JSON.stringify(result, null, 2));
