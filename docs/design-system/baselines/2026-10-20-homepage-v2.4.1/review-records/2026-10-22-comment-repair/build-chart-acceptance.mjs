#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const reportRoot = path.resolve(new URL('.', import.meta.url).pathname);
const baselineRoot = path.resolve(reportRoot, '../..');
const imageRoot = path.join(baselineRoot, 'source', 'images');
const outputPath = path.join(reportRoot, 'chart-acceptance.html');

const artifacts = [
  ['chart-hover.svg', 'Chart hover · pointer', 'C02 / C03'],
  ['chart-hover--keyboard.svg', 'Chart hover · keyboard', 'C02 / C03'],
  ['atom-charttooltip.svg', 'Shared ChartTooltip · eight states', 'C02 / C03'],
  ['chart-gap.svg', 'Chart gap · missing-data info', 'C03'],
  ['history.svg', 'History · monthly', 'C04 / C05'],
  ['history-stats-cumulative.svg', 'History · cumulative', 'C04 / C05'],
  ['history-stats-empty.svg', 'History · empty', 'C04 / C05'],
  ['history-stats-error.svg', 'History · error', 'C04 / C05'],
  ['history-stats-extreme.svg', 'History · extreme', 'C04 / C05'],
  ['history-stats-rounds.svg', 'History · rounds', 'C04 / C05'],
  ['history-stats-source-missing.svg', 'History · source missing', 'C04 / C05'],
  ['history-stats-win.svg', 'History · win', 'C04 / C05'],
  ['journeys-year.svg', 'History · yearly', 'C04 / C05'],
];

function escapeAttribute(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
}

function slug(value) {
  return value.replace(/\.svg$/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function embedSvg(file) {
  const source = fs.readFileSync(path.join(imageRoot, file), 'utf8').trim();
  const id = slug(file);
  const prefix = `accept-${id}-`;
  const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  const namespaced = ids.reduce((current, original) => {
    const next = `${prefix}${original}`;
    const token = escapeRegExp(original);
    return current
      .replace(new RegExp(`id="${token}"`, 'g'), `id="${next}"`)
      .replace(new RegExp(`url\\(#${token}\\)`, 'g'), `url(#${next})`)
      .replace(new RegExp(`(aria-(?:labelledby|describedby)="[^"]*)\\b${token}\\b`, 'g'), `$1${next}`)
      .replaceAll(`href="#${original}"`, `href="#${next}"`);
  }, source);
  return namespaced.replace(
    /^<svg\b/,
    `<svg data-acceptance-artifact="${escapeAttribute(file)}" id="art-${id}"`,
  );
}

const navigation = artifacts.map(([file, label, comments]) => `
        <a href="#${slug(file)}"><span>${label}</span><small>${comments}</small></a>`).join('');

const sections = artifacts.map(([file, label, comments]) => `
      <section class="artifact" id="${slug(file)}" data-file="${escapeAttribute(file)}">
        <div class="artifact-heading">
          <div>
            <p class="eyebrow">${comments}</p>
            <h2>${label}</h2>
            <p class="source-name">source/images/${file}</p>
          </div>
          <a class="back" href="#top">回到目录 ↑</a>
        </div>
        <div class="artwork" aria-label="${escapeAttribute(label)}">
          ${embedSvg(file)}
        </div>
        <div class="measurements" data-measurements-for="${escapeAttribute(file)}">
          <p class="measure-loading">正在读取 SVG 用户坐标与文字 bbox…</p>
        </div>
      </section>`).join('\n');

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>V2.4.1 chart comment repair · source acceptance</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #080d14;
      --surface: #101925;
      --surface-2: #162233;
      --line: #283448;
      --text: #e6edf7;
      --muted: #a8b6cb;
      --accent: #6ca8ff;
      --good: #53d7a0;
      --warn: #ffc66d;
      --bad: #ff8a8a;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif;
      line-height: 1.5;
    }
    a { color: var(--accent); }
    .shell { width: min(1480px, calc(100% - 40px)); margin: 0 auto; }
    header { padding: 36px 0 24px; border-bottom: 1px solid var(--line); }
    .eyebrow { margin: 0 0 4px; color: var(--accent); font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    h1 { margin: 0; font-size: clamp(24px, 3vw, 40px); line-height: 1.15; }
    .lede { max-width: 860px; margin: 12px 0 0; color: var(--muted); font-size: 15px; }
    .legend { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 18px; color: var(--muted); font-size: 13px; }
    .legend span::before { content: ""; display: inline-block; width: 8px; height: 8px; margin: 0 6px 1px 0; border-radius: 50%; background: var(--good); }
    .legend .warn::before { background: var(--warn); }
    nav { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; padding: 20px 0 36px; }
    nav a { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); text-decoration: none; }
    nav a:hover, nav a:focus-visible { border-color: var(--accent); background: var(--surface-2); }
    nav small { color: var(--muted); font-size: 11px; }
    .artifact { scroll-margin-top: 18px; margin: 0 0 52px; padding: 20px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); }
    .artifact-heading { display: flex; justify-content: space-between; align-items: start; gap: 16px; margin-bottom: 16px; }
    h2 { margin: 0; font-size: 20px; }
    .source-name { margin: 4px 0 0; color: var(--muted); font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
    .back { white-space: nowrap; font-size: 12px; }
    .artwork { overflow: auto; padding: 12px; border: 1px solid var(--line); border-radius: 8px; background: #0b1019; }
    .artwork > svg { display: block; width: 100%; min-width: 760px; height: auto; }
    .measurements { margin-top: 14px; }
    .measure-loading { margin: 0; color: var(--muted); font-size: 13px; }
    .measure-summary { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 10px; }
    .pill { display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px; border-radius: 999px; background: #0b1019; color: var(--muted); font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; }
    .pill.good { color: var(--good); }
    .pill.warn { color: var(--warn); }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; min-width: 900px; font-size: 12px; }
    th, td { padding: 8px 10px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
    tr:last-child td { border-bottom: 0; }
    th { color: var(--muted); font-weight: 600; background: #0c141f; }
    td code { color: var(--text); font: 11px ui-monospace, SFMono-Regular, Menlo, monospace; }
    .status-good { color: var(--good); font-weight: 700; }
    .status-warn { color: var(--warn); font-weight: 700; }
    footer { padding: 0 0 48px; color: var(--muted); font-size: 12px; }
  </style>
</head>
<body>
  <main class="shell" id="top">
    <header>
      <p class="eyebrow">V2.4.1 · C02 / C03 / C04 / C05</p>
      <h1>Chart comment repair · source acceptance</h1>
      <p class="lede">本页内嵌 owner 范围内的 13 个 source SVG。下方测量在浏览器加载后读取 SVG 用户坐标：tooltip 外框、可见文字 bbox、四边剩余内边距（验收下限 12px），以及是否被 root viewBox 或祖先 clipPath 裁剪。它供 3088 端口的 CUA 视觉复核使用。</p>
      <div class="legend"><span>green：矩形与文字完整相交，未检测到裁剪</span><span class="warn">amber：矩形越过 viewBox 或祖先 clipPath</span></div>
    </header>
    <nav aria-label="图表锚点目录">${navigation}
    </nav>
    ${sections}
    <footer>生成器：build-chart-acceptance.mjs · 数据来自当前 source/images 文件 · 测量不会修改 source SVG。</footer>
  </main>
  <script>
    (() => {
      const EPSILON = 0.01;
      const MIN_PADDING = 12;
      const fmt = (value) => Number.isFinite(value) ? value.toFixed(2).replace(/\\.00$/, '') : '—';
      const attrNumber = (element, name) => Number.parseFloat(element.getAttribute(name));
      const viewBoxOf = (svg) => {
        const values = (svg.getAttribute('viewBox') || '').trim().split(/[ ,]+/).map(Number);
        if (values.length === 4 && values.every(Number.isFinite)) return { x: values[0], y: values[1], width: values[2], height: values[3] };
        return { x: 0, y: 0, width: attrNumber(svg, 'width'), height: attrNumber(svg, 'height') };
      };
      const point = (matrix, x, y) => new DOMPoint(x, y).matrixTransform(matrix);
      const boxInRoot = (element, svg) => {
        const local = element.getBBox();
        // getCTM() can include the rendered CSS scale when the fixture SVG is
        // fluid. Cancel the root SVG's screen transform so every measurement
        // is reported in that asset's own viewBox/user units.
        const rootScreen = svg.getScreenCTM ? svg.getScreenCTM() : null;
        const elementScreen = element.getScreenCTM ? element.getScreenCTM() : null;
        const matrix = rootScreen && elementScreen
          ? rootScreen.inverse().multiply(elementScreen)
          : (() => {
              const rootCtm = svg.getCTM ? svg.getCTM() : null;
              const elementCtm = element.getCTM ? element.getCTM() : null;
              if (!elementCtm) return null;
              return rootCtm ? rootCtm.inverse().multiply(elementCtm) : elementCtm;
            })();
        if (!matrix) return { x: local.x, y: local.y, width: local.width, height: local.height };
        const points = [
          point(matrix, local.x, local.y),
          point(matrix, local.x + local.width, local.y),
          point(matrix, local.x, local.y + local.height),
          point(matrix, local.x + local.width, local.y + local.height),
        ];
        const xs = points.map(({ x }) => x);
        const ys = points.map(({ y }) => y);
        return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
      };
      const union = (boxes) => {
        if (!boxes.length) return null;
        const left = Math.min(...boxes.map((b) => b.x));
        const top = Math.min(...boxes.map((b) => b.y));
        const right = Math.max(...boxes.map((b) => b.x + b.width));
        const bottom = Math.max(...boxes.map((b) => b.y + b.height));
        return { x: left, y: top, width: right - left, height: bottom - top };
      };
      const intersection = (a, b) => {
        const left = Math.max(a.x, b.x);
        const top = Math.max(a.y, b.y);
        const right = Math.min(a.x + a.width, b.x + b.width);
        const bottom = Math.min(a.y + a.height, b.y + b.height);
        return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
      };
      const contains = (outer, inner) => inner.x >= outer.x - EPSILON && inner.y >= outer.y - EPSILON && inner.x + inner.width <= outer.x + outer.width + EPSILON && inner.y + inner.height <= outer.y + outer.height + EPSILON;
      const clipBoxes = (tooltip, svg) => {
        const boxes = [];
        let node = tooltip;
        while (node && node !== svg) {
          const clip = node.getAttribute && node.getAttribute('clip-path');
          const match = clip && clip.match(/url\\(#([^)]*)\\)/);
          if (match) {
            const definition = document.getElementById(match[1]);
            const shapes = definition ? [...definition.querySelectorAll('rect, path, polygon, circle, ellipse')] : [];
            const shapeBoxes = shapes.map((shape) => boxInRoot(shape, svg));
            if (shapeBoxes.length) boxes.push(union(shapeBoxes));
          }
          node = node.parentElement;
        }
        return boxes;
      };
      const measureTooltip = (tooltip, svg, index) => {
        const rect = tooltip.querySelector(':scope > rect');
        if (!rect) return { index, missing: true };
        const rectBox = boxInRoot(rect, svg);
        const texts = [...tooltip.querySelectorAll(':scope > text')];
        const textBoxes = texts.map((text) => boxInRoot(text, svg));
        const textUnion = union(textBoxes);
        const rowYs = [...new Set(texts.map((text) => Number.parseFloat(text.getAttribute('y'))).filter(Number.isFinite).map((y) => Number(y.toFixed(3))))];
        const view = viewBoxOf(svg);
        const rootBox = { x: view.x, y: view.y, width: view.width, height: view.height };
        const clips = [rootBox, ...clipBoxes(tooltip, svg)];
        const firstClip = clips.find((clip) => !contains(clip, rectBox));
        const visibleArea = clips.reduce((area, clip) => intersection(area, clip), rectBox);
        const clipped = Boolean(firstClip) || visibleArea.width < rectBox.width - EPSILON || visibleArea.height < rectBox.height - EPSILON;
        return {
          index,
          rectBox,
          textUnion,
          textCount: texts.length,
          rowCount: rowYs.length,
          rowYs,
          leftPad: textUnion ? textUnion.x - rectBox.x : null,
          rightPad: textUnion ? rectBox.x + rectBox.width - textUnion.x - textUnion.width : null,
          bottomPad: textUnion ? rectBox.y + rectBox.height - textUnion.y - textUnion.height : null,
          topPad: textUnion ? textUnion.y - rectBox.y : null,
          paddingOk: textUnion ? [textUnion.x - rectBox.x, rectBox.x + rectBox.width - textUnion.x - textUnion.width, textUnion.y - rectBox.y, rectBox.y + rectBox.height - textUnion.y - textUnion.height].every((value) => value >= MIN_PADDING - EPSILON) : false,
          clipped,
          clipReason: clipped ? (firstClip ? '越过 viewBox/clipPath' : '可见交集小于外框') : '未检测到裁剪',
        };
      };
      const metricRow = (metric) => {
        if (metric.missing) return '<tr><td>tooltip ' + metric.index + '</td><td colspan="8" class="status-warn">缺少外框 rect</td></tr>';
        const b = metric.rectBox;
        const t = metric.textUnion;
        const status = metric.clipped ? '<span class="status-warn">CLIPPED</span>' : '<span class="status-good">完整</span>';
        const paddingStatus = metric.paddingOk ? '<span class="status-good">≥12 四边</span>' : '<span class="status-warn">不足 12</span>';
        return '<tr>' +
          '<td><code>#' + metric.index + '</code></td>' +
          '<td><code>(' + fmt(b.x) + ', ' + fmt(b.y) + ') · ' + fmt(b.width) + '×' + fmt(b.height) + '</code></td>' +
          '<td>' + metric.rowCount + ' 行 / ' + metric.textCount + ' text</td>' +
          '<td><code>' + (t ? '(' + fmt(t.x) + ', ' + fmt(t.y) + ')–(' + fmt(t.x + t.width) + ', ' + fmt(t.y + t.height) + ')' : '—') + '</code></td>' +
          '<td><code>' + fmt(metric.leftPad) + ' / ' + fmt(metric.rightPad) + '</code></td>' +
          '<td><code>' + fmt(metric.topPad) + ' / ' + fmt(metric.bottomPad) + '</code></td>' +
          '<td>' + paddingStatus + '</td>' +
          '<td>' + status + '</td>' +
          '<td>' + metric.clipReason + '</td>' +
          '</tr>';
      };
      const measureArtifact = (section) => {
        const svg = section.querySelector(':scope > .artwork > svg');
        const output = section.querySelector('.measurements');
        if (!svg || !output) return;
        let metrics = [];
        try {
          metrics = [...svg.querySelectorAll('[data-component="ChartTooltip"]')].map((tooltip, index) => measureTooltip(tooltip, svg, index + 1));
        } catch (error) {
          output.innerHTML = '<p class="status-warn">测量失败：' + String(error).replace(/[<&>]/g, '') + '</p>';
          return;
        }
        const clipped = metrics.filter((metric) => metric.clipped).length;
        const paddingFailures = metrics.filter((metric) => !metric.missing && !metric.paddingOk).length;
        const measured = metrics.filter((metric) => !metric.missing);
        const summary = '<div class="measure-summary">' +
          '<span class="pill">tooltip shells: ' + metrics.length + '</span>' +
          '<span class="pill">measured: ' + measured.length + '</span>' +
          '<span class="pill ' + (paddingFailures ? 'warn' : 'good') + '">' + (paddingFailures ? paddingFailures + ' padding failures' : 'all pads ≥12') + '</span>' +
          '<span class="pill ' + (clipped ? 'warn' : 'good') + '">' + (clipped ? clipped + ' clipped' : 'no clip detected') + '</span>' +
          '</div>';
        if (!metrics.length) {
          output.innerHTML = summary + '<p class="measure-loading">此图稿没有 ChartTooltip shell；保留图稿视觉检查。</p>';
          return;
        }
        const table = '<div class="table-wrap"><table><thead><tr><th>shell</th><th>rect bbox（root user coords）</th><th>rows / text</th><th>text bbox union</th><th>left / right pad</th><th>top / bottom pad</th><th>padding ≥12</th><th>clip</th><th>说明</th></tr></thead><tbody>' + metrics.map(metricRow).join('') + '</tbody></table></div>';
        output.innerHTML = summary + table;
      };
      const run = () => document.querySelectorAll('.artifact').forEach(measureArtifact);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(run); else window.addEventListener('load', run, { once: true });
      window.addEventListener('resize', run);
    })();
  </script>
</body>
</html>
`;

fs.writeFileSync(outputPath, html);
console.log(`Wrote ${outputPath}`);
