#!/usr/bin/env node
/**
 * Bake the D01-A table-header glyph calibration into the 27 static SVGs.
 *
 * The approved prototype computes headerBlank - valueBlank after fonts are
 * ready. This tool records those per-font/per-state results as static x
 * values because SVGs consumed through <img> do not execute scripts.
 * `--write` edits only the four CNY right-anchored header text nodes.
 * `--check` emits an independent browser acceptance fixture. Open that HTML
 * in the approved browser and read its DOM result table; SVGs consumed through
 * <img> do not execute scripts, so the saved x values remain static.
 */
import fs from 'node:fs';
import path from 'node:path';

const repairDir = path.dirname(new URL(import.meta.url).pathname);
const imageDir = path.resolve(repairDir, '../../source/images');
const checkHtmlPath = path.join(repairDir, 'table-calibration-check.html');
const headers = ['成本价(CNY)', '最新价(CNY)', '持仓市值(CNY)', '持仓浮动盈亏(CNY)'];
const fallbackValues = {
  '成本价(CNY)': '636.85',
  '最新价(CNY)': '688.67',
  '持仓市值(CNY)': '12.53 万',
  '持仓浮动盈亏(CNY)': '+9,431.24',
};

const commonAnchors = {
  '成本价(CNY)': 573.52,
  '最新价(CNY)': 682.2,
  '持仓市值(CNY)': 830.4000000000001,
  '持仓浮动盈亏(CNY)': 968.72,
};
const home1280Anchors = {
  '成本价(CNY)': 705.12,
  '最新价(CNY)': 829.2,
  '持仓市值(CNY)': 998.4000000000001,
  '持仓浮动盈亏(CNY)': 1156.3200000000002,
};
const home1440Anchors = {
  '成本价(CNY)': 791.52,
  '最新价(CNY)': 933.2,
  '持仓市值(CNY)': 1126.4,
  '持仓浮动盈亏(CNY)': 1306.72,
};
const option1280Anchors = {
  '成本价(CNY)': 679.92,
  '最新价(CNY)': 817.1999999999999,
  '持仓市值(CNY)': 1004.3999999999999,
  '持仓浮动盈亏(CNY)': 1179.12,
};
const option1440Anchors = {
  '成本价(CNY)': 766.32,
  '最新价(CNY)': 921.2,
  '持仓市值(CNY)': 1132.4,
  '持仓浮动盈亏(CNY)': 1329.52,
};

// Values measured with the approved D01-A canvas algorithm in the repository's
// Chromium runtime. They are per table font/state, rather than one generic dx.
const offsets = {
  common: {
    '成本价(CNY)': 0.6865234375,
    '最新价(CNY)': 0.7890625,
    '持仓市值(CNY)': 0.549968719,
    '持仓浮动盈亏(CNY)': 0.7685546875,
  },
  extreme: {
    '成本价(CNY)': 0.6455078125,
    '最新价(CNY)': 0.7685546875,
    '持仓市值(CNY)': 0.81596756,
    '持仓浮动盈亏(CNY)': 0.549964905,
  },
  option: {
    // Holding-option-C rows are 11px Inter and headers are 600/11px;
    // measure the actual row font, not the home table's 14px row contract.
    '成本价(CNY)': 0.12890625,
    '最新价(CNY)': 0.06982421875,
    '持仓市值(CNY)': 0.0859375,
    '持仓浮动盈亏(CNY)': -1.4501953125,
  },
};

// The first bounded repair pass used the values below. Accepting those
// positions makes --write idempotent while still rejecting an unrelated x
// edit in one of the approved SVGs.
const previousOffsets = {
  common: {
    '成本价(CNY)': 0.6865234375,
    '最新价(CNY)': 0.7890625,
    '持仓市值(CNY)': 0.3056297302246094,
    '持仓浮动盈亏(CNY)': 0.7685546875,
  },
  extreme: {
    '成本价(CNY)': 0.6455078125,
    '最新价(CNY)': 0.7685546875,
    '持仓市值(CNY)': 0.5800018310546875,
    '持仓浮动盈亏(CNY)': 0.305633544921875,
  },
  option: {
    '成本价(CNY)': 0.12890625,
    '最新价(CNY)': 0.06982421875,
    '持仓市值(CNY)': 0.0859375,
    '持仓浮动盈亏(CNY)': -1.4501953125,
  },
};

const groups = new Map([
  ['50-items--page-7.svg', { kind: 'common', anchors: commonAnchors }],
  ['50-items.svg', { kind: 'common', anchors: commonAnchors }],
  ['count-boundaries--nine-items-last-page.svg', { kind: 'common', anchors: commonAnchors }],
  ['count-boundaries.svg', { kind: 'common', anchors: commonAnchors }],
  ['count-scales--ten-items.svg', { kind: 'common', anchors: commonAnchors }],
  ['count-scales--twenty-items.svg', { kind: 'common', anchors: commonAnchors }],
  ['count-scales.svg', { kind: 'common', anchors: commonAnchors }],
  ['empty--zero-holdings.svg', { kind: 'common', anchors: commonAnchors, fallback: true }],
  ['empty.svg', { kind: 'common', anchors: commonAnchors, fallback: true }],
  ['error--update-failure.svg', { kind: 'common', anchors: commonAnchors }],
  ['extreme.svg', { kind: 'extreme', anchors: commonAnchors }],
  ['holding-option-C-large-1280.svg', { kind: 'option', anchors: option1280Anchors }],
  ['holding-option-C-large-1440.svg', { kind: 'option', anchors: option1440Anchors }],
  ['holding-option-C-normal-1280.svg', { kind: 'option', anchors: option1280Anchors }],
  ['holding-option-C-normal-1440.svg', { kind: 'option', anchors: option1440Anchors }],
  ['holding-return--after.svg', { kind: 'common', anchors: commonAnchors }],
  ['holding-return--detail.svg', { kind: 'common', anchors: commonAnchors, expectedPerHeader: 2 }],
  ['holding-return.svg', { kind: 'common', anchors: commonAnchors }],
  ['home-1280.svg', { kind: 'common', anchors: home1280Anchors }],
  ['home-1440.svg', { kind: 'common', anchors: home1440Anchors }],
  ['home-history-1280.svg', { kind: 'common', anchors: home1280Anchors }],
  ['home-history-1440.svg', { kind: 'common', anchors: home1440Anchors }],
  ['loading--stale-data.svg', { kind: 'common', anchors: commonAnchors }],
  ['loading.svg', { kind: 'common', anchors: commonAnchors, fallback: true }],
  ['local-search-pages--clear.svg', { kind: 'common', anchors: commonAnchors }],
  ['local-search-pages--one-match.svg', { kind: 'common', anchors: commonAnchors }],
  ['local-search-pages.svg', { kind: 'common', anchors: commonAnchors }],
]);

function formatNumber(value) {
  return Number(value.toFixed(9)).toString();
}

function attr(attrs, name) {
  return (attrs.match(new RegExp(`\\b${name}="([^"]+)"`)) || [])[1];
}

function writeStatic() {
  for (const [file, config] of groups) {
    const filePath = path.join(imageDir, file);
    const before = fs.readFileSync(filePath, 'utf8');
    const seen = Object.fromEntries(headers.map((header) => [header, 0]));
    const re = /<text\b([^>]*)>([^<]*)<\/text>/g;
    const after = before.replace(re, (whole, attrs, text) => {
      const header = text.trim();
      if (!headers.includes(header)) return whole;
      const oldX = Number(attr(attrs, 'x'));
      const expectedX = config.anchors[header];
      const accepted = [
        expectedX,
        expectedX + previousOffsets[config.kind][header],
        expectedX + offsets[config.kind][header],
      ];
      if (!accepted.some((candidate) => Math.abs(oldX - candidate) <= 1e-6)) {
        throw new Error(`${file}: ${header} has unexpected x=${oldX}; expected anchor or prior calibration for ${expectedX}`);
      }
      seen[header] += 1;
      const nextX = expectedX + offsets[config.kind][header];
      return whole.replace(/\bx="[^"]+"/, `x="${formatNumber(nextX)}"`);
    });
    for (const header of headers) {
      const expected = config.expectedPerHeader || 1;
      if (seen[header] !== expected) {
        throw new Error(`${file}: expected ${expected} ${header} header(s), found ${seen[header]}`);
      }
    }
    fs.writeFileSync(filePath, after);
    console.log(`WROTE ${file} (${Object.values(seen).reduce((a, b) => a + b, 0)} headers)`);
  }
}

function emitCheckHtml() {
  const repoRoot = path.resolve(repairDir, '../../../../../../');
  const prototypeHtml = fs.readFileSync(path.join(repoRoot, '.scratch/homepage-v241-repair/visual-options/round2/index.html'), 'utf8');
  // Escape markup delimiters before embedding source text in this script so
  // an SVG/prototype </script> cannot terminate the acceptance fixture early.
  const checkData = JSON.stringify({
    headers,
    fallbackValues,
    prototypeHtml,
    svgs: Object.fromEntries([...groups].map(([file]) => [file, fs.readFileSync(path.join(imageDir, file), 'utf8')])),
    groups: [...groups].map(([file, config]) => ({
      file,
      kind: config.kind,
      anchors: config.anchors,
      expectedPerHeader: config.expectedPerHeader || 1,
    })),
  }).replace(/</g, '\\u003c');
  const html = `<!doctype html>
<meta charset="utf-8">
<title>C01 table glyph calibration acceptance</title>
<style>
  :root { color-scheme: dark; font: 14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; background:#101827; color:#E6EDF7; }
  body { margin:0; padding:24px; }
  h1,h2 { margin:0 0 10px; font-weight:600; }
  p { color:#A8B6CB; margin:6px 0 14px; }
  .reference { max-height:480px; overflow:auto; border:1px solid #34435B; border-radius:10px; padding:14px; margin:0 0 18px; background:#151F30; }
  .reference-grid { display:grid; grid-template-columns:minmax(700px,1fr) minmax(700px,1fr); gap:16px; min-width:1450px; }
  figure { margin:0; }
  figcaption { color:#A8B6CB; margin:0 0 6px; }
  iframe, .reference img, .home-reference-frame { display:block; width:100%; height:420px; border:1px solid #34435B; background:#0D1420; object-fit:contain; overflow:hidden; }
  iframe { width:1440px; }
  .home-reference-frame > svg { display:block; width:100%; height:100%; }
  .results { border-collapse:collapse; width:100%; }
  th,td { border-bottom:1px solid #28364A; padding:6px 8px; text-align:left; white-space:nowrap; }
  th { color:#A8B6CB; font-weight:500; position:sticky; top:0; background:#101827; }
  .pass { color:#53D7A0; } .fail { color:#FF7B8B; }
  .detail { color:#A8B6CB; font-size:12px; }
  pre { white-space:pre-wrap; color:#A8B6CB; }
</style>
<h1>C01 table glyph calibration acceptance</h1>
<p>Font-ready canvas measurement of visible text nodes. Every file below reports the residual at the right edge; fallback means the state has no numeric row glyph for that column.</p>
<section class="reference" aria-label="Approved reference comparison">
  <h2>Approved reference comparison (scroll)</h2>
  <div class="reference-grid">
    <figure><figcaption>D01-A approved prototype</figcaption><iframe id="prototype" title="D01-A approved prototype"></iframe></figure>
    <figure><figcaption>source/images/home-1440.svg</figcaption><div id="home-reference" class="home-reference-frame" role="img" aria-label="home-1440 SVG reference"></div></figure>
  </div>
  <pre id="prototype-result">D01-A reference: waiting for fonts…</pre>
</section>
<pre id="summary">Waiting for measurements…</pre>
<table class="results"><thead><tr><th>status</th><th>file</th><th>header occurrence</th><th>visible header</th><th>visible value</th><th>fallback</th><th>residual px</th><th>actual x</th><th>target x</th></tr></thead><tbody id="results"><tr><td colspan="9">Measuring after document.fonts.ready…</td></tr></tbody></table>
<script>
const DATA = ${checkData};
const prototype = document.getElementById("prototype");
const homeReference = document.getElementById("home-reference");
const resultBody = document.getElementById("results");
const prototypeResult = document.getElementById("prototype-result");
const summary = document.getElementById("summary");
const ctx = document.createElement("canvas").getContext("2d");
const visibleText = (element) => [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join("").trim();
const measureBlank = (text, font) => { ctx.font = font; ctx.textAlign = "left"; const m = ctx.measureText(text); return m.width - m.actualBoundingBoxRight; };
const styleFont = (style) => style.fontWeight + " " + style.fontSize + " " + style.fontFamily;
const num = (element, name) => Number(element.getAttribute(name));
const waitForFrame = async () => {
  // srcdoc may finish before a load listener is installed. Poll the actual
  // DOM for the approved prototype marker so the result never reports a
  // false empty reference due to an about:blank/load race.
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (prototype.contentDocument?.querySelector(".ink-header")) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("D01-A iframe did not expose .ink-header within 3s");
};
async function measurePrototype() {
  try {
    prototype.srcdoc = DATA.prototypeHtml;
    homeReference.innerHTML = DATA.svgs["home-1440.svg"];
    await waitForFrame();
    await prototype.contentDocument.fonts.ready;
    // The prototype registers its own fonts.ready callback. Let that callback
    // run before reading its calibrated x/dataset.adjust values.
    for (let attempt = 0; attempt < 150; attempt += 1) {
      const pending = [...prototype.contentDocument.querySelectorAll(".ink-header")]
        .filter((element) => DATA.headers.includes(element.textContent.trim()))
        .some((element) => !element.dataset.adjust);
      if (!pending) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const frameDoc = prototype.contentDocument;
    const ref = [...frameDoc.querySelectorAll(".ink-header")]
      .filter((element) => DATA.headers.includes(element.textContent.trim()))
      .map((element) => {
        const header = element.textContent.trim();
        const style = frameDoc.defaultView.getComputedStyle(element);
        const headerFont = styleFont(style);
        const valueFont = "400 14px " + style.fontFamily;
        const adjustment = measureBlank(header, headerFont) - measureBlank(element.dataset.value, valueFont);
        return { header, x: Number(element.dataset.anchor) + adjustment, anchor: Number(element.dataset.anchor), adjust: adjustment.toFixed(3), font: headerFont, valueFont, fallback: false };
      });
    prototypeResult.textContent = "D01-A reference after fonts.ready (same glyph-edge algorithm)\\n" + JSON.stringify(ref, null, 2);
  } catch (error) { prototypeResult.textContent = "D01-A reference unavailable: " + error; }
}
async function measureFile(entry) {
  const svgText = DATA.svgs[entry.file];
  const host = document.createElement("div");
  host.innerHTML = svgText;
  const svg = host.querySelector("svg");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:absolute;left:-100000px;top:0;width:1px;height:1px;overflow:hidden;visibility:hidden";
  document.body.append(host);
  await document.fonts.ready;
  const elements = [...svg.querySelectorAll("text")];
  const records = [];
  for (const header of DATA.headers) {
    const headers = elements.filter((candidate) => visibleText(candidate) === header && getComputedStyle(candidate).textAnchor === "end");
    headers.forEach((element, occurrence) => {
      const x = num(element, "x");
      const y = num(element, "y");
      const headerStyle = getComputedStyle(element);
      const rowCandidates = elements.filter((candidate) => {
        const candidateText = visibleText(candidate);
        return getComputedStyle(candidate).textAnchor === "end" && candidateText && candidateText !== header && num(candidate, "y") > y && Math.abs(num(candidate, "x") - entry.anchors[header]) < 0.01;
      }).sort((a, b) => num(a, "y") - num(b, "y"));
      const row = rowCandidates[0];
      const value = row ? visibleText(row) : DATA.fallbackValues[header];
      const valueStyle = row ? getComputedStyle(row) : headerStyle;
      const headerFont = styleFont(headerStyle);
      // D01-A intentionally measures the visible row value in the home-table
      // 14px regular contract after document.fonts.ready. Keep option-C's
      // approved 11px Inter row contract intact because its reference uses a
      // different table state/font.
      const valueFont = row
        ? (entry.kind === "option" ? styleFont(valueStyle) : "400 14px " + headerStyle.fontFamily)
        : "400 14px " + headerStyle.fontFamily;
      const valueX = row ? num(row, "x") : entry.anchors[header];
      const targetX = valueX + measureBlank(header, headerFont) - measureBlank(value, valueFont);
      records.push({ file: entry.file, occurrence: occurrence + 1, header, value, fallback: !row, actualX: x, targetX, residual: x - targetX, headerFont, valueFont });
    });
  }
  host.remove();
  return records;
}
async function run() {
  await measurePrototype();
  const all = [];
  for (const entry of DATA.groups) {
    try { all.push(...await measureFile(entry)); } catch (error) { all.push({ file: entry.file, occurrence: 0, header: "ERROR", value: String(error), fallback: false, actualX: NaN, targetX: NaN, residual: NaN }); }
  }
  resultBody.innerHTML = all.map((record) => {
    const pass = Number.isFinite(record.residual) && Math.abs(record.residual) <= 0.001;
    const status = pass ? "PASS" : "FAIL";
    return "<tr><td class=\\\"" + (pass ? "pass" : "fail") + "\\\">" + status + "</td><td>" + record.file + "</td><td>" + record.occurrence + "</td><td>" + record.header + "</td><td>" + record.value + "</td><td>" + record.fallback + "</td><td>" + (Number.isFinite(record.residual) ? record.residual.toFixed(6) : "NaN") + "</td><td>" + (Number.isFinite(record.actualX) ? record.actualX.toFixed(9) : "NaN") + "</td><td>" + (Number.isFinite(record.targetX) ? record.targetX.toFixed(9) : "NaN") + "</td></tr>";
  }).join("");
  const byFile = new Map();
  for (const record of all) {
    if (!byFile.has(record.file)) byFile.set(record.file, []);
    byFile.get(record.file).push(record);
  }
  summary.textContent = [...byFile].map(([file, records]) => file + " | " + records.map((record) => record.header + " residual=" + (Number.isFinite(record.residual) ? record.residual.toFixed(6) : "NaN") + " fallback=" + record.fallback).join(" ; ")).join("\\n");
  document.body.dataset.status = all.every((record) => Number.isFinite(record.residual) && Math.abs(record.residual) <= 0.001) ? "PASS" : "FAIL";
}
run().catch((error) => { resultBody.innerHTML = "<tr><td colspan=\\\"9\\\" class=\\\"fail\\\">ERROR " + error + "</td></tr>"; document.body.dataset.status = "FAIL"; });
</script>`;
  fs.writeFileSync(checkHtmlPath, html);
  console.log(`WROTE ${path.relative(repairDir, checkHtmlPath)}`);
}

const mode = process.argv[2] || '--check';
if (mode === '--write') writeStatic();
else if (mode === '--check' || mode === '--emit-check') emitCheckHtml();
else {
  console.error('Usage: calibrate-table-headers.mjs --write|--check|--emit-check');
  process.exitCode = 2;
}
