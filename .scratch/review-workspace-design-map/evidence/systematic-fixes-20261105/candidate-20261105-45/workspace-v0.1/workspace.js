(() => {
  const params = new URLSearchParams(location.search);
  const variant = 'A';
  const legacyScene = params.get('scene') || 'entry';
  const normalizeScene = scene => scene === 'exit' ? 'exit' : scene === 'entry' ? 'entry' : 'holding';
  const initialScene = normalizeScene(legacyScene);
  const root = document.querySelector('#app');
  const state = {
    variant: 'A',
    scene: initialScene,
    tradeId: '600000-3',
    left: true,
    right: true,
    revealed: 28,
    playing: false,
    textMode: false,
    textPlacing: false,
    editingText: '',
    textAnchor: null,
    notice: false,
    recordsOpen: false,
    exitPrompt: false,
    workspaceClosed: false,
    scaleMode: 'quantity',
    playbackSpeed: 1,
    replayHidden: false,
    reviewHidden: false,
    tradeFilter: '',
    dateOpen: false,
    dateDraft: '',
    slot: 'D02',
    pendingAnchor: null,
    textEditId: null,
    detailsKey: '',
    detailsOpen: false,
    modalReturnFocus: null,
    focusAfterRender: null
  };
  const baseBars = Array.from({ length: 62 }, (_, i) => {
    const base = 43 + i * 0.18 + Math.sin(i / 4) * 2.5 + Math.sin(i / 11) * 4;
    const close = base + Math.sin(i * 1.7) * 1.15;
    const open = base + Math.cos(i * 1.3) * 1.1;
    return {
      time: Date.UTC(2025, 0, 2 + i) / 1000,
      open, close,
      high: Math.max(open, close) + 1.4 + (i % 3) * 0.25,
      low: Math.min(open, close) - 1.2 - (i % 4) * 0.2,
      value: 240 + ((i * 83) % 270) + Math.round(Math.abs(Math.sin(i)) * 180)
    };
  });
  const tradeFixtures = {
    '600000-3': { symbol: '示例股份', code: '600000', round: '第3次交易', buyDate: '2025-02-03', timeframe: '日线', currency: 'CNY', funds: '200000', source: '手填参考', firstQty: 1000, addQty: 600, partialQty: 800, finalQty: 800 },
    '600000-2': { symbol: '示例股份', code: '600000', round: '第2次交易', buyDate: '2025-01-06', timeframe: '日线', currency: 'CNY', funds: '180000', source: '账户快照', firstQty: 800, addQty: 400, partialQty: 600, finalQty: 600 },
    '600000-1': { symbol: '示例股份', code: '600000', round: '第1次交易', buyDate: '2024-12-02', timeframe: '日线', currency: 'CNY', funds: '160000', source: '手填参考', firstQty: 600, addQty: 300, partialQty: 400, finalQty: 500 }
  };
  const barsForFixture = fixture => {
    const start = Date.parse(`${fixture.buyDate}T00:00:00Z`) - 28 * 86400000;
    return baseBars.map((bar, index) => ({ ...bar, time: (start + index * 86400000) / 1000 }));
  };
  let bars = barsForFixture(tradeFixtures['600000-3']);
  const makeDraft = () => ({
    plan: { direction: 'long', entry: '56.00', stop: '52.00', target: '68.00', quantity: '1000', amount: '56000', percent: '28', scaleMode: 'quantity', scaleUi: { unavailable: false, invalidSource: null } },
    funds: { value: '200000', currency: 'CNY', source: '手填参考' },
    text: { value: '等待确认：回踩后仍守住初始风险。', anchor: null },
    ratings: { discipline: 'unrated', opportunity: 'unrated', position: 'unrated', experience: 'unrated' },
    earlyExit: 'unrated', reason: '', adherence: 'unrated', judgment: '持仓继续观察，退出条件尚未触发。', errors: {}
  });
  const drafts = Object.fromEntries(Object.keys(tradeFixtures).map(id => [id, Object.fromEntries(['entry', 'holding', 'add', 'partial', 'exit', 'resume'].map(scene => [scene, makeDraft()]))]));
  Object.keys(tradeFixtures).forEach(id => Object.values(drafts[id]).forEach(draft => { draft.funds.value = tradeFixtures[id].funds; draft.funds.source = tradeFixtures[id].source; }));
  state.drafts = drafts;
  // The review scene may say “持仓中” after the first fill, but its draft still
  // belongs to the entry node until the add event is revealed. This keeps the
  // entry plan and its Text/ratings attached to the same node while the market
  // replay advances through the holding interval.
  const textRecords = Object.fromEntries(Object.keys(tradeFixtures).map(id => [id, []]));
  const currentTexts = () => textRecords[state.tradeId];
  const textValueAt = text => {
    if (!text) return '';
    const cutoff = textCutoff();
    if (!Array.isArray(text.history)) return text.createdAt == null || text.createdAt <= cutoff ? (text.value || '') : '';
    const version = text.history.filter(item => item.at <= cutoff).sort((a, b) => a.at - b.at).at(-1);
    return version ? version.value : '';
  };
  const saveTextVersion = (text, value, at) => {
    if (!Array.isArray(text.history)) text.history = [{ at: text.createdAt ?? at, value: text.value || '' }];
    const existing = text.history.findIndex(item => item.at === at);
    if (existing >= 0) text.history[existing] = { at, value };
    else text.history.push({ at, value });
    text.history.sort((a, b) => a.at - b.at);
    text.value = textValueAt(text);
  };
  const currentText = () => { const text = state.textEditId != null ? currentTexts()[state.textEditId] : currentTexts()[0]; return text ? { ...text, value: textValueAt(text) } : { value: '', anchor: null }; };
  const nodeId = () => state.revealed >= 49 ? 'exit' : state.revealed >= 41 ? 'partial' : state.revealed >= 33 ? 'add' : 'entry';
  const currentDraft = () => state.drafts[state.tradeId][nodeId()] || state.drafts[state.tradeId].entry;
  const currentFixture = () => tradeFixtures[state.tradeId] || tradeFixtures['600000-3'];
  const planDraft = () => ['holding', 'partial', 'exit'].includes(state.scene) ? state.drafts[state.tradeId].entry : currentDraft();
  const scaleUi = () => planDraft().plan.scaleUi || (planDraft().plan.scaleUi = { unavailable: false, invalidSource: null });
  const currentScaleMode = () => planDraft().plan.scaleMode || state.scaleMode || 'quantity';
  Object.defineProperty(state, 'plan', { get: () => planDraft().plan });
  const eventIndexes = { buy: 28, add: 33, partial: 40, exit: 48 };
  const eventBar = key => bars[eventIndexes[key]];
  const eventDate = key => new Date(eventBar(key).time * 1000).toISOString().slice(0, 10);
  const eventPrice = key => eventBar(key).close.toFixed(2);
  const tools = [
    ['D01', '斐波那契回撤', '44 0 68 68'], ['D02', 'Text（可演示）', '110 0 68 68'],
    ['D03', '多头仓位', '181 0 68 68'], ['D04', '空头仓位', '248 0 68 68'],
    ['D05', '矩形', '312 0 68 68'], ['D06', '箭头（待核名）', '378 0 68 68'],
    ['D07', '趋势线', '445 0 68 68'], ['D08', '位置标记', '511 0 68 68'],
    ['D09', '位置标记', '578 0 68 68'], ['D10', '旋转矩形', '647 0 68 68'],
    ['D11', '多节点线', '712 0 68 68'], ['D12', '框内文字', '782 0 68 68'],
    ['D13', '水平射线', '848 0 68 68']
  ];
  let chartRef = null;
  let candleRef = null;
  let volumeRef = null;
  let resizeObserver = null;
  let rightScrollResizeObserver = null;
  let playTimer = null;
  let priceLines = [];
  let cutoffPriceLine = null;
  let crosshairAxisLabelHidden = false;
  let markerRef = null;
  let pendingFollow = false;
  let overlayChartEl = null;
  let overlayRefresh = null;

  const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const dateLabel = () => new Date(bars[Math.max(0, state.revealed - 1)].time * 1000).toISOString().slice(0, 10);
  const sceneNames = { entry: '入场前计划', holding: '持仓中', exit: '结束之后评价' };
  const sceneName = () => sceneNames[state.scene] || '场景审阅';
  const sceneCutoff = () => ({ entry: 28, holding: 31, exit: 49 }[state.scene] || 31);
  const sceneStatus = () => state.scene === 'holding'
    ? state.revealed >= 41 ? '部分退出已显示 · 最终退出仍隐藏' : '持仓中 · 后续成交尚未揭示'
    : ({ entry: '首次成交前 · 计划信息', exit: '退出后 · 结果与评价可见' }[state.scene] || '场景审阅');
  const slotLabel = () => `节点 · ${dateLabel()}`;
  const replayStopNotice = () => state.revealed === 33 ? `已停在下一笔成交之前 · ${dateLabel()}` : `已到达已揭示的回放停点 · ${dateLabel()}`;
  const noNextReplayStopNotice = () => state.revealed >= bars.length
    ? `已到当前样本末尾 · ${dateLabel()} · 没有下一个复盘停点`
    : `没有下一个复盘停点 · 当前已揭示至 ${dateLabel()}`;
  const textCutoff = () => bars[Math.max(0, state.revealed - 1)]?.time || 0;
  const textKnown = text => text && (text.createdAt == null || text.createdAt <= textCutoff()) && text.anchor && text.anchor.time <= textCutoff();
  const visibleTexts = () => currentTexts().filter(textKnown);
  const activeAnchor = () => { const text = state.textEditId != null ? currentText() : null; const anchor = state.pendingAnchor || (text && text.anchor) || state.textAnchor; return anchor && anchor.time <= textCutoff() ? anchor : null; };
  const anchorLabel = (anchor = activeAnchor()) => anchor ? `${new Date(anchor.time * 1000).toISOString().slice(0, 10)} · ${anchor.price.toFixed(2)}` : slotLabel();
  const anchorStyle = (anchor = activeAnchor(), clamp = true) => {
    if (!anchor || !chartRef || !candleRef) return 'left:42%;top:32%';
    const chartEl = document.querySelector('#chart');
    if (!chartEl) return clamp ? 'left:42%;top:32%' : 'display:none';
    const timeScale = chartRef.timeScale();
    const timeX = timeScale.timeToCoordinate(anchor.time);
    const logical = Number(anchor.logical);
    const fractional = Number.isFinite(logical) && Math.abs(logical - Math.round(logical)) > 1e-6;
    let logicalX = null;
    if (fractional) {
      // `logicalToCoordinate` can return 0 for a fractional logical index when
      // the time scale has not resolved that index in its current data range.
      // Resolve fractional positions from the actual revealed bars instead.
      const lower = Math.floor(logical);
      const upper = Math.ceil(logical);
      const lowerBar = bars[lower];
      const upperBar = bars[upper];
      const lowerX = lowerBar && timeScale.timeToCoordinate(lowerBar.time);
      const upperX = upperBar && timeScale.timeToCoordinate(upperBar.time);
      if (lowerX != null && upperX != null) {
        logicalX = lowerX + (upperX - lowerX) * (logical - lower);
      } else if (lowerX != null && lower > 0) {
        const previousBar = bars[lower - 1];
        const previousX = previousBar && timeScale.timeToCoordinate(previousBar.time);
        if (previousX != null) logicalX = lowerX + (lowerX - previousX) * (logical - lower);
      } else if (upperX != null && upper + 1 < state.revealed) {
        const nextBar = bars[upper + 1];
        const nextX = nextBar && timeScale.timeToCoordinate(nextBar.time);
        if (nextX != null) logicalX = upperX + (nextX - upperX) * (logical - upper);
      }
    }
    const x = fractional ? (logicalX ?? timeX) : timeX;
    const y = candleRef.priceToCoordinate(anchor.price);
    const axisWidth = chartRef.priceScale('right').width();
    const plotRight = chartEl.clientWidth - axisWidth;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return clamp ? 'left:42%;top:32%' : 'display:none';
    if (!clamp && (x < 0 || x > plotRight || y < 0 || y > chartEl.clientHeight)) return 'display:none';
    const left = clamp ? Math.max(12, Math.min(x, plotRight - 250)) : x;
    const top = clamp ? Math.max(12, Math.min(y, chartEl.clientHeight - 130)) : y;
    return `left:${left}px;top:${top}px`;
  };
  const textMarkup = () => visibleTexts().map(text => { const index = currentTexts().indexOf(text); const value = textValueAt(text); if (state.textMode && state.textEditId === index) return ''; return `<svg class="chart-text-leader" data-text-leader="${index}" aria-hidden="true"><path /></svg><span class="chart-text-anchor" data-text-anchor="${index}" aria-hidden="true"></span><div class="chart-text" style="${anchorStyle(text.anchor, false)}" data-action="text-edit" data-text-id="${index}" role="button" tabindex="0" aria-label="编辑图上文字：${esc(value)}，锚点 ${esc(anchorLabel(text.anchor))}" title="按 Enter 或空格编辑"><b>${esc(value)}</b><small>Text · ${anchorLabel(text.anchor)}</small></div>`; }).join('');
  const keyboardPlacement = () => {
    const logicalValue = Number(state.keyboardLogical);
    const logical = Math.min(state.revealed - 1, Math.max(0, Number.isFinite(logicalValue) ? logicalValue : state.revealed - 1));
    const nearestBar = bars[Math.round(logical)] || bars[state.revealed - 1];
    const price = Number(state.keyboardPrice);
    return `<div class="placement-prompt keyboard-placement" role="group" aria-label="键盘定位图上文字"><p>使用时间位置与价格定位（可在 K 线之间）；也可用鼠标直接点图。只可选已揭示范围。</p><label>时间位置 <input type="range" min="0" max="${Math.max(0, state.revealed - 1)}" step="0.1" value="${logical}" data-keyboard-logical aria-label="图表时间位置，可在 K 线之间" /><output data-logical-date>${new Date(nearestBar.time * 1000).toISOString().slice(0, 10)} · ${logical.toFixed(1)}</output></label><label>价格 <input type="number" step="0.01" value="${Number.isFinite(price) ? price.toFixed(2) : bars[state.revealed - 1].close.toFixed(2)}" data-keyboard-price aria-label="图表价格" /></label><div><button data-action="text-place-confirm">定位并编辑</button><button data-action="text-cancel">取消</button></div></div>`;
  };
  const tradeMarkerSpecs = () => [
      { key: 'buy', index: 28, label: '首次买入', position: 'belowBar' },
      { key: 'add', index: 33, label: '加仓', position: 'aboveBar' },
      { key: 'partial', index: 40, label: '部分退出', position: 'aboveBar' },
      { key: 'exit', index: 48, label: '退出', position: 'aboveBar' }
    ];
  const tradeMarkerMarkup = () => tradeMarkerSpecs().filter(spec => state.revealed > spec.index)
    .map(spec => `<span class="chart-trade-marker-leader" data-trade-marker-leader="${spec.key}" aria-hidden="true"></span><span class="chart-trade-marker-label marker-${spec.key}" data-trade-marker="${spec.key}" aria-label="已揭示成交：${spec.label}">${spec.label}</span>`).join('');
  const revealedMarkerGeometry = () => {
    if (!chartRef || !candleRef) return [];
    const spacing = chartRef.timeScale().options().barSpacing;
    // Match Lightweight Charts' marker helpers: odd-rounded, clamped marker
    // size, even marker stack size, and a three-pixel minimum stack gap.
    const oddMarkerPixel = value => {
      const rounded = Math.ceil(value);
      return rounded % 2 === 0 ? rounded - 1 : rounded;
    };
    const clampedSpacing = Math.min(Math.max(spacing, 12), 30);
    const markerOddSize = oddMarkerPixel(clampedSpacing);
    const markerSizeEven = markerOddSize % 2 === 0 ? markerOddSize : markerOddSize - 1;
    const markerGap = Math.max(oddMarkerPixel(clampedSpacing * 0.1), 3);
    const arrowHalf = (oddMarkerPixel(Math.min(Math.max(markerSizeEven, 12), 30)) - 1) / 2;
    const stack = { aboveBar: markerGap, belowBar: markerGap };
    let stackTime = null;
    return tradeMarkerSpecs().filter(spec => state.revealed > spec.index).map(spec => {
      const bar = bars[eventIndexes[spec.key]];
      if (bar.time !== stackTime) {
        stack.aboveBar = markerGap;
        stack.belowBar = markerGap;
        stackTime = bar.time;
      }
      const x = chartRef.timeScale().timeToCoordinate(bar.time);
      const edgePrice = spec.position === 'aboveBar' ? bar.high : bar.low;
      const priceY = candleRef.priceToCoordinate(edgePrice);
      if (!Number.isFinite(x) || !Number.isFinite(priceY)) return null;
      const centerY = priceY + (spec.position === 'aboveBar' ? -markerSizeEven / 2 - stack[spec.position] : markerSizeEven / 2 + stack[spec.position]);
      stack[spec.position] += markerSizeEven + markerGap;
      // ArrowDown/ArrowUp extend by arrowHalf in both axes. Two pixels of
      // safety margin account for the library's bitmap pixel alignment.
      const extent = arrowHalf + 2;
      return { ...spec, x, centerY, extent, arrowRect: { left: x - extent, right: x + extent, top: centerY - extent, bottom: centerY + extent, critical: true } };
    }).filter(Boolean);
  };
  const revealedMarkerRects = () => {
    const labelRects = [...(document.querySelectorAll('.chart-trade-marker-label') || [])].map(element => {
    if (!element.getClientRects().length || getComputedStyle(element).display === 'none') return null;
    const chartBounds = document.querySelector('#chart')?.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    if (!chartBounds) return null;
    return { left: rect.left - chartBounds.left - 5, right: rect.right - chartBounds.left + 5, top: rect.top - chartBounds.top - 5, bottom: rect.bottom - chartBounds.top + 5 };
    }).filter(Boolean);
    return [...revealedMarkerGeometry().map(marker => marker.arrowRect), ...labelRects];
  };
  const nearestOverlayEdge = (x, y, left, top, width, height) => ({
    x: Math.max(left, Math.min(x, left + width)),
    y: Math.max(top, Math.min(y, top + height))
  });
  const overlayLeaderHitsRect = (start, end, rect) => {
    let tMin = 0;
    let tMax = 1;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    for (const [p, q] of [[-dx, start.x - rect.left], [dx, rect.right - start.x], [-dy, start.y - rect.top], [dy, rect.bottom - start.y]]) {
      if (p === 0) { if (q < 0) return false; continue; }
      const t = q / p;
      if (p < 0) tMin = Math.max(tMin, t);
      else tMax = Math.min(tMax, t);
      if (tMin > tMax) return false;
    }
    return true;
  };
  const overlayLeaderRoute = (start, end, obstacles, safeRight, safeTop, safeBottom) => {
    const padding = 5;
    const expanded = obstacles.map(rect => ({ ...rect, left: rect.left - padding, right: rect.right + padding, top: rect.top - padding, bottom: rect.bottom + padding }));
    const candidates = [[start, end]];
    const xs = [...new Set([start.x, end.x, ...expanded.flatMap(rect => [rect.left, rect.right])].map(value => Math.max(4, Math.min(value, safeRight - 4))))];
    const ys = [...new Set([start.y, end.y, ...expanded.flatMap(rect => [rect.top, rect.bottom])].map(value => Math.max(safeTop + 2, Math.min(value, safeBottom - 2))))];
    for (const x of xs) candidates.push([start, { x, y: start.y }, { x, y: end.y }, end]);
    for (const y of ys) candidates.push([start, { x: start.x, y }, { x: end.x, y }, end]);
    let best = null;
    for (const points of candidates) {
      const path = points.filter((point, index) => index === 0 || Math.hypot(point.x - points[index - 1].x, point.y - points[index - 1].y) > 0.5);
      let criticalHits = 0;
      let hits = 0;
      for (let index = 1; index < path.length; index++) {
        for (const obstacle of expanded) {
          if (overlayLeaderHitsRect(path[index - 1], path[index], obstacle)) {
            hits++;
            if (obstacle.critical) criticalHits++;
          }
        }
      }
      const length = path.slice(1).reduce((total, point, index) => total + Math.hypot(point.x - path[index].x, point.y - path[index].y), 0);
      const score = criticalHits * 1e12 + hits * 1e9 + length * 4 + path.length * 4;
      if (!best || score < best.score) best = { path, score, length, criticalHits, hits };
    }
    return best;
  };
  const applyOverlayLeaderPath = (element, path) => {
    if (!element) return;
    element.style.left = '0px';
    element.style.top = '0px';
    element.style.width = '100%';
    element.style.height = '100%';
    element.style.transform = 'none';
    const svgPath = element.querySelector('path');
    if (svgPath) svgPath.setAttribute('d', path?.length ? `M ${path.map(point => `${point.x} ${point.y}`).join(' L ')}` : '');
    element.style.display = path?.length > 1 ? '' : 'none';
  };
  const placeTextOverlay = (x, y, width, height, safeRight, obstacles, safeTop, safeBottom, routeRight = safeRight) => {
    const min = 10;
    const minTop = safeTop + min;
    const maxLeft = safeRight - width;
    const maxTop = safeBottom - height - min;
    if (maxLeft < min || maxTop < minTop) return null;
    const clampLeft = value => Math.max(min, Math.min(value, maxLeft));
    const clampTop = value => Math.max(minTop, Math.min(value, maxTop));
    const preferredLeft = clampLeft(x + 12 + width <= safeRight ? x + 12 : x - 12 - width);
    const preferredTop = clampTop(y - height / 2);
    const lefts = [...new Set([preferredLeft, clampLeft(x + 12), clampLeft(x - width - 12), clampLeft(x - width / 2), min, maxLeft,
      ...obstacles.flatMap(obstacle => [clampLeft(obstacle.left - width - 8), clampLeft(obstacle.right + 8)])])];
    const tops = [...new Set([preferredTop, clampTop(y - height - 18), clampTop(y + 18), clampTop(y - height / 2 - 36), clampTop(y - height / 2 + 36), minTop, maxTop,
      ...obstacles.flatMap(obstacle => [clampTop(obstacle.top - height - 8), clampTop(obstacle.bottom + 8)])])];
    let best = null;
    for (const left of lefts) for (const top of tops) {
      let overlap = 0;
      let collisions = 0;
      let criticalCollisions = 0;
      for (const obstacle of obstacles) {
        const w = Math.max(0, Math.min(left + width, obstacle.right) - Math.max(left, obstacle.left));
        const h = Math.max(0, Math.min(top + height, obstacle.bottom) - Math.max(top, obstacle.top));
        const area = w * h;
        if (area > 0) collisions += 1;
        if (area > 0 && obstacle.critical) criticalCollisions += 1;
        overlap += area;
      }
      const edge = nearestOverlayEdge(x, y, left, top, width, height);
      const leaderRoute = overlayLeaderRoute({ x, y }, edge, obstacles, routeRight - 8, safeTop, safeBottom);
      const leaderLength = leaderRoute?.length || 0;
      const anchorRect = { left: x - 7, right: x + 7, top: y - 7, bottom: y + 7 };
      const anchorCovered = Math.min(left + width, anchorRect.right) > Math.max(left, anchorRect.left)
        && Math.min(top + height, anchorRect.bottom) > Math.max(top, anchorRect.top);
      const leaderCollisions = leaderRoute?.hits || 0;
      const criticalLeaderCollisions = leaderRoute?.criticalHits || 0;
      const preferenceDistance = Math.hypot(left - preferredLeft, top - preferredTop);
      const score = (anchorCovered ? 1e12 : 0) + criticalCollisions * 1e12 + criticalLeaderCollisions * 1e12 + collisions * 1e9 + overlap * 1000 + leaderCollisions * 100 + leaderLength * 4 + preferenceDistance;
      if (!best || score < best.score) best = { left, top, score, overlap, collisions, anchorCovered, leaderCollisions, criticalLeaderCollisions, leaderPath: leaderRoute?.path || [] };
    }
    return best;
  };
  const updateTextOverlayPositions = () => {
    const chartEl = document.querySelector('#chart');
    if (!chartEl || !chartRef || !chartEl.clientWidth || !chartEl.clientHeight) return;
    const axisWidth = chartRef.priceScale('right').width();
    const plotRight = chartEl.clientWidth - axisWidth;
    const axisLabelReserve = Math.min(84, Math.max(68, axisWidth * 0.88));
    const planAxisObstacles = [...[state.plan.target, state.plan.entry, state.plan.stop].map(Number), Number(bars[state.revealed - 1]?.close)]
      .filter(value => Number.isFinite(value) && value > 0)
      .map(value => candleRef.priceToCoordinate(value))
      .filter(Number.isFinite)
      .map(y => ({ left: Math.max(0, plotRight - axisLabelReserve), right: chartEl.clientWidth, top: y - 12, bottom: y + 12, critical: true }));
    // Price-line axis labels sit at the plot edge and can visually extend
    // leftward; reserve a small part of the plot for their titles and values.
    const cardRight = plotRight - Math.min(80, Math.max(64, axisWidth * 0.84));
    const margin = 10;
    const cardMaxRight = cardRight - margin;
    const availableCardWidth = Math.max(0, cardMaxRight - margin);
    const chartBounds = chartEl.getBoundingClientRect();
    const mainPane = chartRef.panes?.()[0];
    const paneElement = mainPane?.getHTMLElement?.();
    const paneRect = paneElement?.getBoundingClientRect();
    const paneTop = paneRect ? paneRect.top - chartBounds.top : 0;
    const paneHeight = paneRect?.height || mainPane?.getHeight?.() || Math.max(0, chartEl.clientHeight - 30);
    // The volume series uses the bottom 18% of the shared pane; keep cards
    // above that region and above the time scale/date axis.
    const safeTop = Math.max(0, paneTop);
    const safeBottom = Math.max(safeTop, Math.min(chartEl.clientHeight - 28, paneTop + paneHeight * 0.80));
    const toolStrip = chartEl.parentElement?.querySelector('.tv-toolbar, .tool-strip');
    const toolbarRect = toolStrip?.getBoundingClientRect();
    const toolbarObstacle = toolbarRect && toolbarRect.width && toolbarRect.height ? {
      left: toolbarRect.left - chartBounds.left, right: toolbarRect.right - chartBounds.left,
      top: toolbarRect.top - chartBounds.top, bottom: toolbarRect.bottom - chartBounds.top
    } : null;
    const rectOf = element => {
      const rect = element?.getBoundingClientRect();
      return rect && rect.width && rect.height ? { left: rect.left - chartBounds.left, right: rect.right - chartBounds.left, top: rect.top - chartBounds.top, bottom: rect.bottom - chartBounds.top } : null;
    };
    const readoutElement = chartEl.parentElement?.querySelector('[data-crosshair-price-readout]');
    const readoutRect = readoutElement?.style.display !== 'none' ? rectOf(readoutElement) : null;
    const anchorPoints = currentTexts().map((text, index) => ({ text, index })).filter(item => textKnown(item.text)).map(({ text, index }) => {
      const match = anchorStyle(text.anchor, false).match(/left:([\d.-]+)px;top:([\d.-]+)px/);
      return match ? { x: Number(match[1]), y: Number(match[2]), index } : null;
    }).filter(Boolean);
    const anchorObstacle = (point, radius = 8) => ({ left: point.x - radius, right: point.x + radius, top: point.y - radius, bottom: point.y + radius, critical: true });
    const activeAnchorValue = state.pendingAnchor || (state.textMode ? activeAnchor() : null);
    if (activeAnchorValue) {
      const match = anchorStyle(activeAnchorValue, false).match(/left:([\d.-]+)px;top:([\d.-]+)px/);
      if (match) anchorPoints.push({ x: Number(match[1]), y: Number(match[2]), index: null });
    }
    const markerAnchorObstacles = anchorPoints.map(point => anchorObstacle(point, 10));
    const markerLabelElements = [...(chartEl.parentElement?.querySelectorAll('.chart-trade-marker-label') || [])];
    const markerGeometry = revealedMarkerGeometry();
    const arrowObstacles = markerGeometry.map(marker => marker.arrowRect);
    const spacing = chartRef.timeScale().options().barSpacing;
    const candleObstacles = bars.slice(0, state.revealed).map(bar => {
      const x = chartRef.timeScale().timeToCoordinate(bar.time);
      const high = candleRef.priceToCoordinate(bar.high);
      const low = candleRef.priceToCoordinate(bar.low);
      if (![x, high, low].every(Number.isFinite) || x < 0 || x > plotRight) return null;
      const halfWidth = Math.min(12, Math.max(2, spacing * 0.35));
      return { left: x - halfWidth, right: x + halfWidth, top: Math.min(high, low) - 2, bottom: Math.max(high, low) + 2 };
    }).filter(Boolean);
    const placedMarkerLabels = [];
    markerLabelElements.forEach(element => {
      const spec = tradeMarkerSpecs().find(item => item.key === element.dataset.tradeMarker);
      if (!spec) return;
      const marker = markerGeometry.find(item => item.key === spec.key);
      if (!marker) { element.style.display = 'none'; return; }
      const { x, centerY, extent } = marker;
      element.style.display = '';
      const width = element.getBoundingClientRect().width;
      const height = element.getBoundingClientRect().height;
      const gap = 5;
      // Keep labels attached to visible arrows. Clamping an off-screen Bar's
      // label to the plot edge makes it appear to belong to unrelated data.
      if (x < 0 || x > plotRight || centerY < safeTop || centerY > safeBottom) {
        element.style.display = 'none';
        const leader = chartEl.parentElement?.querySelector(`[data-trade-marker-leader="${spec.key}"]`);
        if (leader) leader.style.display = 'none';
        return;
      }
      const baseTop = spec.position === 'aboveBar' ? centerY - extent - gap - height : centerY + extent + gap;
      const maxLeft = Math.max(0, plotRight - width - 6);
      const maxTop = Math.max(safeTop, safeBottom - height);
      const clampLeft = value => Math.max(4, Math.min(value, maxLeft));
      const clampTop = value => Math.max(safeTop, Math.min(value, maxTop));
      const otherCards = [...(chartEl.parentElement?.querySelectorAll('.chart-text, [data-text-editor]') || [])].map(rectOf).filter(Boolean);
      if (readoutRect) otherCards.push({ ...readoutRect, critical: true });
      const nearbyObstacles = [...arrowObstacles, ...candleObstacles, ...placedMarkerLabels, ...markerAnchorObstacles, ...planAxisObstacles, ...(toolbarObstacle ? [toolbarObstacle] : []), ...otherCards];
      const candidates = [
        [x - width / 2, baseTop],
        [x - width / 2, baseTop + (spec.position === 'aboveBar' ? -1 : 1) * (height + 7)],
        [x - width / 2, baseTop + (spec.position === 'aboveBar' ? -1 : 1) * (height * 2 + 14)],
        [x - width - extent - gap, centerY - height / 2], [x + extent + gap, centerY - height / 2],
        ...nearbyObstacles.flatMap(obstacle => [
          [obstacle.left - width - gap, baseTop],
          [obstacle.right + gap, baseTop],
          [x - width / 2, obstacle.top - height - gap],
          [x - width / 2, obstacle.bottom + gap]
        ])
      ].map(([left, top]) => ({ left: clampLeft(left), top: clampTop(top) }));
      // Plan/last-price axis labels are candidate anchors and hard collision
      // obstacles, not merely hints for generating candidate positions.
      const obstacles = [...arrowObstacles, ...candleObstacles, ...placedMarkerLabels, ...markerAnchorObstacles, ...planAxisObstacles, ...(toolbarObstacle ? [toolbarObstacle] : []), ...otherCards];
      let best = null;
      candidates.forEach(candidate => {
        const rect = { left: candidate.left, right: candidate.left + width, top: candidate.top, bottom: candidate.top + height };
        const area = obstacles.reduce((sum, obstacle) => sum + Math.max(0, Math.min(rect.right, obstacle.right) - Math.max(rect.left, obstacle.left)) * Math.max(0, Math.min(rect.bottom, obstacle.bottom) - Math.max(rect.top, obstacle.top)), 0);
        const anchorOverlap = markerAnchorObstacles.reduce((sum, obstacle) => sum + (Math.min(rect.right, obstacle.right) > Math.max(rect.left, obstacle.left) && Math.min(rect.bottom, obstacle.bottom) > Math.max(rect.top, obstacle.top) ? 1 : 0), 0);
        const edge = nearestOverlayEdge(x, centerY, candidate.left, candidate.top, width, height);
        const dx = edge.x - x;
        const dy = edge.y - centerY;
        const length = Math.hypot(dx, dy);
        const start = length ? { x: x + dx / length * (extent + 2), y: centerY + dy / length * (extent + 2) } : { x, y: centerY };
        const connectorHits = obstacles.filter(obstacle => overlayLeaderHitsRect(start, edge, obstacle)).length;
        const anchorConnectorHits = markerAnchorObstacles.filter(obstacle => overlayLeaderHitsRect(start, edge, obstacle)).length;
        const directionMismatch = spec.position === 'aboveBar' ? candidate.top + height > centerY : candidate.top < centerY;
        const distance = Math.hypot(candidate.left + width / 2 - x, candidate.top + height / 2 - centerY);
        const score = (anchorOverlap + anchorConnectorHits) * 1e12 + area * 1e6 + connectorHits * 1e7 + (directionMismatch ? 1e5 : 0) + distance;
        if (!best || score < best.score) best = { ...candidate, score, rect, edge, start, length };
      });
      if (best) {
        element.style.left = `${best.left}px`;
        element.style.top = `${best.top}px`;
        const leader = chartEl.parentElement?.querySelector(`[data-trade-marker-leader="${spec.key}"]`);
        if (leader) {
          leader.style.left = `${best.start.x}px`;
          leader.style.top = `${best.start.y}px`;
          leader.style.width = `${Math.max(0, best.length - extent - 2)}px`;
          leader.style.transform = `rotate(${Math.atan2(best.edge.y - best.start.y, best.edge.x - best.start.x)}rad)`;
          leader.style.display = best.length > extent + 3 ? '' : 'none';
        }
        placedMarkerLabels.push(best.rect);
      }
    });
    const markers = revealedMarkerRects();
    const obstacles = [...markers];
    if (readoutRect) obstacles.push({ ...readoutRect, critical: true });
    if (toolbarObstacle) obstacles.push(toolbarObstacle);
    const occupiedCards = [];
    const occupiedTextLeaders = [];
    const textCards = [...(chartEl.parentElement?.querySelectorAll('.chart-text') || [])]
      .sort((a, b) => b.textContent.trim().length - a.textContent.trim().length);
    textCards.forEach(element => {
      const index = Number(element.dataset.textId);
      const text = currentTexts()[index];
      if (!text) return;
      const position = anchorStyle(text.anchor, false);
      if (position === 'display:none') {
        element.style.display = 'none';
        const anchorDot = chartEl.parentElement.querySelector(`[data-text-anchor="${index}"]`);
        const leader = chartEl.parentElement.querySelector(`[data-text-leader="${index}"]`);
        if (anchorDot) anchorDot.style.display = 'none';
        if (leader) leader.style.display = 'none';
        return;
      }
      const match = position.match(/left:([\d.-]+)px;top:([\d.-]+)px/);
      if (!match) return;
      const x = Number(match[1]);
      const y = Number(match[2]);
      element.style.display = '';
      if (availableCardWidth < 80) {
        element.style.display = 'none';
        const anchorDot = chartEl.parentElement.querySelector(`[data-text-anchor="${index}"]`);
        const leader = chartEl.parentElement.querySelector(`[data-text-leader="${index}"]`);
        if (anchorDot) anchorDot.style.display = 'none';
        if (leader) leader.style.display = 'none';
        return;
      }
      element.style.maxWidth = `${Math.min(280, availableCardWidth)}px`;
      element.style.maxHeight = `${Math.max(60, safeBottom - safeTop - 20)}px`;
      element.style.overflowY = 'auto';
      const width = element.getBoundingClientRect().width;
      const height = element.getBoundingClientRect().height;
      const otherAnchorObstacles = anchorPoints.filter(point => point.index !== index).map(anchorObstacle);
      const placement = placeTextOverlay(x, y, width, height, cardMaxRight, [...obstacles, ...occupiedCards, ...occupiedTextLeaders, ...otherAnchorObstacles], safeTop, safeBottom, plotRight);
      if (!placement) { element.style.display = 'none'; return; }
      const { left, top } = placement;
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
      occupiedCards.push({ left, right: left + width, top, bottom: top + height, critical: true });

      const anchorDot = chartEl.parentElement.querySelector(`[data-text-anchor="${index}"]`);
      const leader = chartEl.parentElement.querySelector(`[data-text-leader="${index}"]`);
      if (anchorDot) {
        anchorDot.style.display = '';
        anchorDot.style.left = `${x - 4}px`;
        anchorDot.style.top = `${y - 4}px`;
      }
      if (leader) {
        applyOverlayLeaderPath(leader, placement.leaderPath);
        const thickness = 6;
        for (let segment = 1; segment < placement.leaderPath.length; segment++) {
          const from = placement.leaderPath[segment - 1];
          const to = placement.leaderPath[segment];
          occupiedTextLeaders.push({ left: Math.min(from.x, to.x) - thickness, right: Math.max(from.x, to.x) + thickness, top: Math.min(from.y, to.y) - thickness, bottom: Math.max(from.y, to.y) + thickness, critical: true });
        }
      }
    });
    const editor = chartEl.parentElement?.querySelector('[data-text-editor]');
    if (editor) {
      const anchor = state.pendingAnchor || activeAnchor();
      const position = anchor ? anchorStyle(anchor, false) : 'display:none';
      const match = position.match(/left:([\d.-]+)px;top:([\d.-]+)px/);
      const editorWidth = Math.min(255, availableCardWidth);
      const editorMaxRight = cardRight - margin;
      const editorMinLeft = margin;
      const editorWidthMinimum = 180;
      const editorDot = chartEl.parentElement.querySelector('[data-text-editor-anchor]');
      const editorLeader = chartEl.parentElement.querySelector('[data-text-editor-leader]');
      if (availableCardWidth < editorWidthMinimum) {
        editor.style.display = 'none';
        if (editorDot) editorDot.style.display = 'none';
        if (editorLeader) editorLeader.style.display = 'none';
      } else {
        editor.style.display = '';
        editor.style.width = `${editorWidth}px`;
        editor.style.maxWidth = `${availableCardWidth}px`;
        editor.style.maxHeight = `${Math.max(120, safeBottom - safeTop - 20)}px`;
        editor.style.overflowY = 'auto';
        const width = editor.getBoundingClientRect().width;
        const height = editor.getBoundingClientRect().height;
        const hasAnchor = !!match;
        const x = hasAnchor ? Number(match[1]) : (editorMinLeft + editorMaxRight) / 2;
        const y = hasAnchor ? Number(match[2]) : chartEl.clientHeight / 2;
        const ownAnchorIndex = anchorPoints.find(point => Math.hypot(point.x - x, point.y - y) < 1)?.index;
        const editorAnchorObstacles = anchorPoints.filter(point => point.index !== ownAnchorIndex).map(anchorObstacle);
        const placement = placeTextOverlay(x, y, width, height, editorMaxRight, [...obstacles, ...occupiedCards, ...occupiedTextLeaders, ...editorAnchorObstacles], safeTop, safeBottom, plotRight);
        if (!placement) {
          editor.style.display = 'none';
          if (editorDot) editorDot.style.display = 'none';
          if (editorLeader) editorLeader.style.display = 'none';
          return;
        }
        const { left, top } = placement;
        editor.style.left = `${left}px`;
        editor.style.top = `${top}px`;
        if (editorDot) {
          editorDot.style.display = hasAnchor ? '' : 'none';
          if (hasAnchor) { editorDot.style.left = `${x - 4}px`; editorDot.style.top = `${y - 4}px`; }
        }
        if (editorLeader) {
          applyOverlayLeaderPath(editorLeader, hasAnchor ? placement.leaderPath : []);
        }
      }
    }
  };
  const scheduleTextOverlayPositions = () => requestAnimationFrame(() => requestAnimationFrame(updateTextOverlayPositions));
  const updateSceneForReveal = () => {
    const previousScene = state.scene;
    if (state.revealed >= 49) state.scene = 'exit';
    else if (state.revealed > 28) state.scene = 'holding';
    else state.scene = 'entry';
    state.textAnchor = currentTexts().at(-1)?.anchor || null;
    if (state.scene !== previousScene) {
      state.right = state.scene === 'holding' ? false : true;
      enforceSidebarExclusion();
      syncSceneUrl();
    }
  };
  const syncSceneUrl = () => {
    const url = new URL(location.href);
    if (url.searchParams.get('scene') === state.scene) return;
    url.searchParams.set('scene', state.scene);
    history.replaceState({}, '', url);
  };
  state.revealed = sceneCutoff();
  if (initialScene === 'holding') state.right = false;
  if (initialScene === 'exit') state.right = true;
  const viewportBand = () => window.innerWidth < 800 ? 'fallback' : window.innerWidth < 1107 ? 'narrow' : window.innerWidth < 1292 ? 'compact' : 'wide';
  const enforceSidebarExclusion = (preferred = 'right') => {
    if (window.innerWidth < 1292 && state.left && state.right) {
      if (preferred === 'left') state.right = false;
      else state.left = false;
    }
  };
  const applyViewportPolicy = (force = false) => {
    const band = viewportBand();
    const changed = state.viewportBand !== band;
    state.mobileFallback = band === 'fallback';
    if (force || changed) {
      state.viewportBand = band;
      if (band === 'compact') state.left = false;
      if (band === 'narrow' || band === 'fallback') { state.left = false; state.right = false; }
    }
    enforceSidebarExclusion();
    return changed;
  };
  applyViewportPolicy(true);
  const syncPlaybackButton = () => {
    const button = document.querySelector('[data-action="play"]');
    if (!button) return;
    button.setAttribute('aria-label', state.playing ? '暂停' : '播放');
    const svg = button.querySelector('svg');
    if (svg) svg.innerHTML = state.playing ? '<path d="M8 5v14M16 5v14"/>' : '<path d="m8 5 10 7-10 7z"/>';
  };
  const pausePlayback = () => {
    const wasPlaying = state.playing;
    if (playTimer) clearInterval(playTimer);
    playTimer = null;
    state.playing = false;
    syncPlaybackButton();
    if (wasPlaying) {
      state.notice = `播放速度 ${state.playbackSpeed}x · 已暂停`;
      const actionNote = root.querySelector('.action-note');
      if (actionNote) actionNote.textContent = state.notice;
    }
  };
  const followLatest = () => {
    if (!chartRef) return;
    const end = state.revealed - 1;
    chartRef.timeScale().setVisibleLogicalRange({ from: Math.max(0, end - 34), to: Math.min(bars.length - 1, end + 2) });
  };
  const ensureReplayPriceVisibility = () => {
    if (!chartRef || !candleRef || state.revealed <= 0) return;
    const priceScale = chartRef.priceScale('right');
    if (priceScale.options().autoScale !== false) return;
    const range = priceScale.getVisibleRange();
    const target = bars[state.revealed - 1];
    if (!range || !target || !Number.isFinite(range.from) || !Number.isFinite(range.to) || !Number.isFinite(target.high) || !Number.isFinite(target.low)) return;
    const span = Math.max(Math.abs(range.to - range.from), 0.01);
    const padding = span * 0.04;
    const nextFrom = Math.min(range.from, target.low - padding);
    const nextTo = Math.max(range.to, target.high + padding);
    if (nextFrom !== range.from || nextTo !== range.to) {
      priceScale.setVisibleRange({ from: nextFrom, to: nextTo });
    }
  };

  const toolStrip = () => { const activeTool = state.textPlacing || state.textMode ? state.slot : ''; return window.WorkspaceChrome?.toolbar ? window.WorkspaceChrome.toolbar({ selected: activeTool, placing: state.textPlacing }) : `<div class="tool-strip" aria-label="绘图工具收藏条">${tools.map(([id, label, crop]) => `
    <button class="tool ${id === activeTool ? 'is-selected' : ''}" data-tool="${id}" ${id !== 'D02' ? 'disabled' : ''} ${id === 'D02' ? `aria-pressed="${id === activeTool}"` : ''}
      aria-label="${label}" title="${id === 'D02' ? '先在图上定位，再编辑 Text' : `${label} · 本轮未实现，仅保留候选槽位`}"
      ><svg viewBox="${crop}" aria-hidden="true"><use href="../tradingview-alignment-v0.1/icons.svg#toolbar-icons"></use></svg></button>`).join('')}</div>`; };

  const tradeVisible = id => { const fixture = tradeFixtures[id]; const haystack = `${fixture.round} ${fixture.buyDate} ${fixture.code}`.toLowerCase(); return !state.tradeFilter || haystack.includes(state.tradeFilter.toLowerCase()); };
  const leftPanel = () => `<aside class="sidebar left-panel ${state.left ? '' : 'is-collapsed'}" aria-label="示例股份交易回合列表">
    <div class="side-head"><div><span class="eyebrow">REVIEW QUEUE</span><h2>交易列表</h2></div>
      <button class="icon-btn" data-action="toggle-left" aria-label="${state.left ? '收起' : '展开'}交易列表">${state.left ? '‹' : '›'}</button></div>
    <div class="trade-filter"><input data-filter aria-label="筛选交易回合" placeholder="筛选日期或次数" value="${esc(state.tradeFilter)}" /><button data-action="clear-filter">清除</button></div><div class="trade-list">${Object.entries(tradeFixtures).map(([id, fixture], index) => `<button ${tradeVisible(id) ? '' : 'hidden style="display:none"'} class="trade ${state.tradeId === id ? 'active' : ''}" data-trade="${id}"><span class="status-dot ${index === 0 ? 'live' : ''}"></span><span class="trade-copy"><b>${fixture.round}</b><small>示例股份 / 600000 · 买入 ${fixture.buyDate}</small></span><span class="trade-state">${index === 0 ? '复盘中' : '已记录'}</span></button>`).join('')}${Object.keys(tradeFixtures).every(id => !tradeVisible(id)) ? '<p class="empty-state">没有匹配交易，请清除筛选。</p>' : ''}</div>
    <button class="side-foot" data-action="records" data-modal-trigger="records-left"><span>记录与快照</span><span class="count">3</span></button>
  </aside>`;

  const decimalValue = raw => {
    const match = String(raw ?? '').trim().match(/^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/);
    if (!match) return null;
    let digits = `${match[2]}${match[3] || ''}`.replace(/^0+/, '') || '0';
    let exponent = Number(match[4] || 0) - (match[3] || '').length;
    if (!Number.isSafeInteger(exponent)) return null;
    while (digits.length > 1 && digits.endsWith('0')) { digits = digits.slice(0, -1); exponent += 1; }
    const sign = match[1] === '-' && digits !== '0' ? '-' : '';
    return `${sign}${digits}e${digits === '0' ? 0 : exponent}`;
  };
  const faithfullyRepresented = (raw, number) => Number.isFinite(number) && decimalValue(raw) !== null && decimalValue(raw) === decimalValue(number.toString());
  const safeDerivedText = value => {
    if (!Number.isFinite(value) || (value !== 0 && Math.abs(value) < 0.005)) return null;
    const text = value.toFixed(2);
    return /[eE]/.test(text) || !Number.isFinite(Number(text)) ? null : text;
  };
  const decimalParts = raw => {
    const match = String(raw ?? '').trim().match(/^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/);
    if (!match) return null;
    const fraction = match[3] || '';
    const exponent = Number(match[4] || 0);
    if (!Number.isSafeInteger(exponent) || fraction.length + Math.abs(exponent) > 10000) return null;
    let coefficient = BigInt(`${match[2]}${fraction}` || '0');
    let scale = fraction.length - exponent;
    if (scale < 0) { coefficient *= 10n ** BigInt(-scale); scale = 0; }
    if (match[1] === '-') coefficient = -coefficient;
    return { coefficient, scale };
  };
  const decimalPositive = value => Boolean(value && (value.denominator ? value.numerator > 0n : value.coefficient > 0n));
  const decimalAbsDiff = (a, b) => {
    if (!a || !b) return null;
    const scale = Math.max(a.scale, b.scale);
    const left = a.coefficient * 10n ** BigInt(scale - a.scale);
    const right = b.coefficient * 10n ** BigInt(scale - b.scale);
    return { coefficient: left >= right ? left - right : right - left, scale };
  };
  const decimalMultiply = (a, b) => a && b ? { coefficient: a.coefficient * b.coefficient, scale: a.scale + b.scale } : null;
  const decimalDivideFixed = (a, b, digits = 2) => {
    if (!a || !b || b.coefficient === 0n) return null;
    const sign = (a.coefficient < 0n) === (b.coefficient < 0n) ? 1n : -1n;
    const numerator = (a.coefficient < 0n ? -a.coefficient : a.coefficient) * 10n ** BigInt(digits + b.scale);
    const denominator = (b.coefficient < 0n ? -b.coefficient : b.coefficient) * 10n ** BigInt(a.scale);
    let quotient = numerator / denominator;
    if ((numerator % denominator) * 2n >= denominator) quotient += 1n;
    return { coefficient: sign * quotient, scale: digits };
  };
  const decimalDivideExact = (a, b) => {
    if (!a || !b || b.coefficient === 0n) return null;
    let numerator = a.coefficient * 10n ** BigInt(b.scale);
    let denominator = b.coefficient * 10n ** BigInt(a.scale);
    if (denominator < 0n) { numerator = -numerator; denominator = -denominator; }
    return { numerator, denominator };
  };
  const decimalFixedText = (value, digits = 2) => {
    if (!value) return null;
    const negative = value.coefficient < 0n;
    const absolute = negative ? -value.coefficient : value.coefficient;
    const divisor = value.scale > digits ? 10n ** BigInt(value.scale - digits) : 1n;
    let rounded = absolute / divisor;
    if (divisor > 1n && (absolute % divisor) * 2n >= divisor) rounded += 1n;
    if (value.scale < digits) rounded *= 10n ** BigInt(digits - value.scale);
    const digitsText = rounded.toString().padStart(digits + 1, '0');
    const split = digitsText.length - digits;
    const whole = digitsText.slice(0, split) || '0';
    const fraction = digitsText.slice(split).padEnd(digits, '0');
    return `${negative ? '-' : ''}${whole}${digits ? `.${fraction.padEnd(digits, '0')}` : ''}`;
  };
  const rationalFixedText = (value, digits = 2) => {
    if (!value || value.denominator === 0n) return null;
    const negative = value.numerator < 0n;
    const absolute = negative ? -value.numerator : value.numerator;
    const factor = 10n ** BigInt(digits);
    let rounded = (absolute * factor) / value.denominator;
    if ((absolute * factor) % value.denominator * 2n >= value.denominator) rounded += 1n;
    const digitsText = rounded.toString().padStart(digits + 1, '0');
    const split = digitsText.length - digits;
    return `${negative ? '-' : ''}${digitsText.slice(0, split) || '0'}${digits ? `.${digitsText.slice(split).padEnd(digits, '0')}` : ''}`;
  };
  const rationalNonZero = value => Boolean(value && value.numerator !== 0n);
  const decimalSafeText = value => {
    if (value?.denominator) {
      const text = rationalFixedText(value, 2);
      return text && (rationalNonZero(value) === false || text !== '0.00') ? text : null;
    }
    const text = decimalFixedText(value, 2);
    return text && (value.coefficient === 0n || text !== '0.00') ? text : null;
  };
  const decimalPercentText = value => {
    if (value?.denominator) {
      const text = rationalFixedText(value, 2);
      return text === '0.00' && rationalNonZero(value) ? '<0.01' : text;
    }
    const text = decimalFixedText(value, 2);
    return text === '0.00' && value?.coefficient !== 0n ? '<0.01' : text;
  };
  const decimalMoneyText = value => {
    if (value?.denominator) {
      const text = rationalFixedText(value, 2);
      return text === '0.00' && rationalNonZero(value) ? '<0.01' : text;
    }
    const text = decimalFixedText(value, 2);
    return text === '0.00' && value?.coefficient !== 0n ? '<0.01' : text;
  };
  const decimalSmallText = value => {
    if (value?.denominator) {
      const text = rationalFixedText(value, 2);
      return text === '0.00' && rationalNonZero(value) ? '<0.01' : text;
    }
    const text = decimalFixedText(value, 2);
    return text === '0.00' && value?.coefficient !== 0n ? '<0.01' : text;
  };
  const divisionIsApproximate = (numerator, denominator, rounded) => {
    if (!numerator || !denominator || !rounded || denominator.coefficient === 0n) return false;
    const left = numerator.coefficient * 10n ** BigInt(denominator.scale + rounded.scale);
    const right = rounded.coefficient * denominator.coefficient * 10n ** BigInt(numerator.scale);
    return left !== right;
  };
  const decimalNumber = value => {
    if (value?.denominator) {
      const number = Number(value.numerator) / Number(value.denominator);
      return Number.isFinite(number) ? number : NaN;
    }
    const text = decimalFixedText(value, 12);
    const number = text == null ? NaN : Number(text);
    return Number.isFinite(number) ? number : NaN;
  };
  const planValues = () => {
    const draft = planDraft();
    const p = draft.plan;
    const entryD = decimalParts(p.entry), stopD = decimalParts(p.stop), targetD = decimalParts(p.target), fundsD = decimalParts(draft.funds.value);
    const rawScale = currentScaleMode() === 'amount' ? p.amount : currentScaleMode() === 'percent' ? p.percent : p.quantity;
    const scaleRaw = scaleUi().unavailable && scaleUi().invalidSource !== currentScaleMode() ? '' : rawScale;
    const scaleD = decimalParts(scaleRaw);
    const entry = Number(p.entry), stop = Number(p.stop), target = Number(p.target), funds = Number(draft.funds.value), scale = Number(scaleRaw);
    const scalePositive = decimalPositive(scaleD);
    const pricePositive = [entry, stop, target].every(value => Number.isFinite(value) && value > 0) && [entryD, stopD, targetD].every(decimalPositive);
    const priceRepresentable = [['entry', entry], ['stop', stop], ['target', target]].every(([key, value]) => String(p[key] ?? '').trim() === '' || faithfullyRepresented(p[key], value));
    let quantityD = currentScaleMode() === 'amount' && scalePositive && decimalPositive(entryD)
      ? decimalDivideExact(scaleD, entryD)
      : currentScaleMode() === 'percent' && scalePositive && decimalPositive(entryD) && decimalPositive(fundsD)
        ? decimalDivideExact(decimalMultiply(fundsD, scaleD), { coefficient: 100n * entryD.coefficient, scale: entryD.scale })
        : currentScaleMode() === 'quantity' ? decimalParts(scaleRaw) : null;
    const quantityRoundedD = currentScaleMode() === 'amount' && scalePositive && decimalPositive(entryD)
      ? decimalDivideFixed(scaleD, entryD)
      : currentScaleMode() === 'percent' && scalePositive && decimalPositive(entryD) && decimalPositive(fundsD)
        ? decimalDivideFixed(decimalMultiply(fundsD, scaleD), { coefficient: 100n * entryD.coefficient, scale: entryD.scale })
        : quantityD;
    const quantity = decimalNumber(quantityD);
    const quantityText = decimalSmallText(quantityD);
    const scaleSafe = currentScaleMode() === 'quantity' ? decimalPositive(quantityD) && Number.isFinite(quantity) : scalePositive && quantityText !== null;
    const positive = pricePositive && scaleSafe;
    const ordered = positive && priceRepresentable && (p.direction === 'long' ? stop < entry && entry < target : p.direction === 'short' ? target < entry && entry < stop : false);
    const baseValid = positive && priceRepresentable && ordered && ['long', 'short'].includes(p.direction);
    const amountD = baseValid ? (currentScaleMode() === 'amount' ? scaleD : currentScaleMode() === 'percent' ? decimalDivideExact(decimalMultiply(fundsD, scaleD), { coefficient: 100n, scale: 0 }) : decimalMultiply(entryD, quantityD)) : null;
    const percentD = baseValid && decimalPositive(fundsD) ? (currentScaleMode() === 'percent' ? scaleD : decimalDivideExact(decimalMultiply(amountD, { coefficient: 100n, scale: 0 }), fundsD)) : null;
    const priceRisk = decimalAbsDiff(entryD, stopD), priceReward = decimalAbsDiff(targetD, entryD);
    const riskD = baseValid ? currentScaleMode() === 'amount'
      ? decimalDivideExact(decimalMultiply(priceRisk, scaleD), entryD)
      : currentScaleMode() === 'percent'
        ? decimalDivideExact(decimalMultiply(decimalMultiply(priceRisk, fundsD), scaleD), { coefficient: 100n * entryD.coefficient, scale: entryD.scale })
        : decimalMultiply(priceRisk, quantityD) : null;
    const rewardD = baseValid ? currentScaleMode() === 'amount'
      ? decimalDivideExact(decimalMultiply(priceReward, scaleD), entryD)
      : currentScaleMode() === 'percent'
        ? decimalDivideExact(decimalMultiply(decimalMultiply(priceReward, fundsD), scaleD), { coefficient: 100n * entryD.coefficient, scale: entryD.scale })
        : decimalMultiply(priceReward, quantityD) : null;
    const ratioD = baseValid && priceRisk?.coefficient !== 0n ? decimalDivideFixed(priceReward, priceRisk) : null;
    const amount = decimalNumber(amountD), percent = decimalNumber(percentD), risk = decimalNumber(riskD), reward = decimalNumber(rewardD), ratio = decimalNumber(ratioD);
    const amountText = decimalMoneyText(amountD), percentText = decimalPercentText(percentD), riskText = decimalMoneyText(riskD), rewardText = decimalMoneyText(rewardD), ratioText = decimalSafeText(ratioD);
    const calculationSafe = [[quantityD, quantityText], [amountD, amountText], [percentD, percentText], [riskD, riskText], [rewardD, rewardText], [ratioD, ratioText]].every(([value, text]) => value == null || text !== null);
    const valid = baseValid && calculationSafe;
    const quantityApproximate = currentScaleMode() === 'amount'
      ? divisionIsApproximate(scaleD, entryD, quantityRoundedD)
      : currentScaleMode() === 'percent'
        ? entryD && divisionIsApproximate(decimalMultiply(fundsD, scaleD), { coefficient: 100n * entryD.coefficient, scale: entryD.scale }, quantityRoundedD)
        : false;
    return { p, entry, stop, target, quantity, quantityText, quantityApproximate, funds, risk, reward, amount, percent, ratio, amountText, percentText, riskText, rewardText, ratioText, valid, baseValid, calculationSafe, ordered, positive, pricePositive, priceRepresentable, scalePositive, scaleSafe };
  };
  const syncFundingPresentation = () => {
    const draft = planDraft();
    const summary = root.querySelector('[data-plan-details] summary b');
    const metadata = root.querySelector('[data-plan-details] > p');
    if (summary) summary.textContent = `¥${draft.funds.value || '未填写'}`;
    if (metadata) metadata.textContent = `币种 ${draft.funds.currency} · ${draft.funds.source || '未填写'}`;
    const values = planValues();
    const metrics = root.querySelectorAll('.metrics .gold');
    if (metrics[0]) metrics[0].textContent = values.riskText == null ? '待补齐 · 未计算' : `¥${values.riskText}`;
    if (metrics[1]) metrics[1].textContent = values.ratioText == null
      ? '待补齐 · 未计算'
      : `${values.ratioText}R · ${values.ratioText}:1`;
  };
  const planFields = () => { const v = planValues(); const p = v.p; const modeLabel = { quantity: '数量', amount: '金额', percent: '仓位' }[currentScaleMode()]; const rawModeValue = currentScaleMode() === 'quantity' ? p.quantity : currentScaleMode() === 'amount' ? p.amount : p.percent; const modeValue = scaleUi().unavailable && scaleUi().invalidSource !== currentScaleMode() ? '' : rawModeValue; const ratio = v.ratioText == null ? '待补齐 · 未计算' : `${v.ratioText}R · ${v.ratioText}:1`; const riskDisplay = v.riskText == null ? '待补齐 · 未计算' : v.riskText.startsWith('<') ? `<¥${v.riskText.slice(1)}` : `¥${v.riskText}`; const error = !v.pricePositive ? '请填写有限正数；空值不绘制计划线。' : !v.priceRepresentable ? '价格超出图表数值精度，已保留原输入但不绘制对应计划线，也不计算计划金额与风险。' : !v.scaleSafe ? '规模无法安全计算 · 未计算（已保留原输入）。' : !v.calculationSafe ? '无法安全计算 · 未计算（已保留原输入）。' : '价格顺序与方向不一致；做多需止损＜入场＜目标，做空相反。'; const localNotice = typeof state.notice === 'string' && state.notice.startsWith('已切换按数量') ? `<small class="scale-note">${esc(state.notice)}</small>` : ''; return `<fieldset class="plan-fields"><legend>交易计划</legend><div class="direction-row" role="group" aria-label="交易方向"><span>方向</span><button type="button" data-direction="long" aria-pressed="${p.direction === 'long' ? 'true' : 'false'}" class="${p.direction === 'long' ? 'selected' : ''}">做多</button><button type="button" data-direction="short" aria-pressed="${p.direction === 'short' ? 'true' : 'false'}" class="${p.direction === 'short' ? 'selected' : ''}">做空</button></div><label>计划入场<span class="input-wrap"><input data-plan="entry" data-field="entry" value="${esc(p.entry)}" aria-label="计划入场" /><em>CNY</em></span></label><div class="two-col"><label>初始止损<input data-plan="stop" data-field="stop" value="${esc(p.stop)}" aria-label="初始止损" /></label><label>止盈目标<input data-plan="target" data-field="target" value="${esc(p.target)}" aria-label="止盈目标" /></label></div><fieldset id="scale-options" role="radiogroup" aria-labelledby="scale-options-label"><legend id="scale-options-label">计划规模 · ${modeLabel}</legend><div class="segmented"><button type="button" role="radio" aria-checked="${currentScaleMode() === 'quantity'}" tabindex="${currentScaleMode() === 'quantity' ? '0' : '-1'}" data-scale="quantity" class="${currentScaleMode() === 'quantity' ? 'selected' : ''}">按数量</button><button type="button" role="radio" aria-checked="${currentScaleMode() === 'amount'}" tabindex="${currentScaleMode() === 'amount' ? '0' : '-1'}" data-scale="amount" class="${currentScaleMode() === 'amount' ? 'selected' : ''}">按金额</button><button type="button" role="radio" aria-checked="${currentScaleMode() === 'percent'}" tabindex="${currentScaleMode() === 'percent' ? '0' : '-1'}" data-scale="percent" class="${currentScaleMode() === 'percent' ? 'selected' : ''}">按仓位</button></div><label>计划${modeLabel}<input data-plan="quantity" data-field="quantity" value="${esc(modeValue)}" aria-label="计划${modeLabel}" /><small class="unit">${currentScaleMode() === 'quantity' ? '股' : currentScaleMode() === 'amount' ? 'CNY' : '%'}</small></label>${localNotice}</fieldset><details data-plan-details open><summary>参考资金与来源 <b>¥${esc(currentDraft().funds.value || '未填写')}</b></summary><div class="two-col"><label>资金值<input data-funds="value" data-field="funds" value="${esc(currentDraft().funds.value)}" /></label><label>来源<input data-funds="source" data-field="funds-source" value="${esc(currentDraft().funds.source)}" /></label></div><p>币种 ${esc(currentDraft().funds.currency)} · ${esc(currentDraft().funds.source || '未填写')}</p></details>${v.valid ? '' : `<p class="field-error">${error}</p>`}<div class="metrics"><div><span>初始风险</span><b class="gold">${riskDisplay}</b></div><div><span>预期收益 / 风险</span><b class="gold">${ratio}</b></div></div></fieldset>`; };
  const readonlyPlan = () => { const v = planValues(); const percentText = v.percentText && v.percent !== 0 && Math.abs(v.percent) < 0.01 ? '<0.01' : v.percentText; const amountText = v.amountText?.startsWith('<') ? `<¥${v.amountText.slice(1)}` : v.amountText; return `<div class="readonly-card"><b>原计划（只读）</b><p>方向：${v.p.direction === 'short' ? '做空' : '做多'} · 入场 ¥${esc(v.p.entry || '未填写')} · 止损 ¥${esc(v.p.stop || '未填写')} · 目标 ¥${esc(v.p.target || '未填写')}</p><p>数量 ${v.quantityText == null ? '未计算' : `${v.quantityText} 股`} · 金额 ${amountText == null ? '未计算' : amountText} · 仓位 ${percentText == null ? '未计算' : `${percentText}%`}</p></div>`; };
  const nodeSummary = () => {
    const f = currentFixture();
    if (state.scene === 'holding') return `<div class="readonly-card"><b>已知持仓事实</b><p>首次买入：${eventDate('buy')} · ${f.firstQty} 股 · ¥${eventPrice('buy')}</p><p>${state.revealed > eventIndexes.add ? `加仓成交：${eventDate('add')} · ${f.addQty} 股 · ¥${eventPrice('add')}` : '加仓成交：尚未揭示'}</p>${state.revealed >= 41 ? `<p>部分退出：${eventDate('partial')} · ¥${eventPrice('partial')}</p><p>最终退出与盈亏：尚未揭示</p>` : '<p>后续成交与最终盈亏：尚未揭示</p>'}</div>`;
    if (state.scene === 'exit') return `<div class="readonly-card"><b>已完成交易事实</b><p>首次买入：${eventDate('buy')} · ¥${eventPrice('buy')} · ${f.firstQty} 股</p><p>最终平仓：${eventDate('exit')} · ¥${eventPrice('exit')} · ${f.finalQty} 股</p></div>`;
    return '';
  };
  const exitEvaluation = () => { const d = currentDraft(); return `<fieldset><legend>是否提前退出</legend><div id="early-options" class="segmented" role="radiogroup" aria-label="是否提前退出">${['unrated','yes','no','uncertain'].map(x => `<button type="button" role="radio" aria-checked="${d.earlyExit === x}" tabindex="${d.earlyExit === x ? '0' : '-1'}" data-early="${x}" class="${d.earlyExit === x ? 'selected' : ''}">${x === 'unrated' ? '未评价' : x === 'yes' ? '是' : x === 'no' ? '否' : '不确定'}</button>`).join('')}</div></fieldset><label>退出原因<textarea data-judgment="reason" aria-label="退出原因">${esc(d.reason)}</textarea></label><label>计划符合度<select data-judgment="adherence"><option value="unrated" ${d.adherence === 'unrated' ? 'selected' : ''}>未评价</option><option value="yes" ${d.adherence === 'yes' ? 'selected' : ''}>符合</option><option value="partial" ${d.adherence === 'partial' ? 'selected' : ''}>部分符合</option><option value="no" ${d.adherence === 'no' ? 'selected' : ''}>不符合</option></select></label><div class="rating-grid">${[['discipline','纪律'],['opportunity','机会'],['position','仓位'],['experience','体验']].map(([k,l]) => `<label>${l}<select data-rating="${k}"><option value="unrated" ${d.ratings[k] === 'unrated' ? 'selected' : ''}>未评分</option><option value="insufficient" ${d.ratings[k] === 'insufficient' ? 'selected' : ''}>资料不足</option>${[1,2,3,4,5].map(n => `<option value="${n}" ${d.ratings[k] === String(n) ? 'selected' : ''}>${n} / 5</option>`).join('')}</select></label>`).join('')}</div></fieldset>`; };
  const rightBody = () => { const form = state.scene === 'entry' ? planFields() : readonlyPlan(); const process = state.scene === 'entry' ? '' : nodeSummary(); return `<p class="helper">${sceneStatus()} · ${state.scene === 'entry' ? '连续表单' : state.scene === 'exit' ? '结果与评价' : '原计划只读'}</p>${form}${process}${state.scene === 'exit' ? exitEvaluation() : ''}`; };
  const rightPanel = () => { const holding = state.scene === 'holding'; return `<aside class="sidebar right-panel ${state.right ? '' : 'is-collapsed'} ${holding ? 'holding-rail' : ''}" aria-label="当前节点编辑">
    <div class="side-head"><div><span class="eyebrow">NODE / A</span><h2>${sceneName()}</h2>${state.scene === 'holding' ? '' : '<span class="right-scroll-hint" data-right-scroll-hint role="status" aria-live="polite" hidden>↓ 可继续向下查看</span>'}</div>${holding ? '' : `<button class="icon-btn" data-action="toggle-right" aria-label="${state.right ? '收起' : '展开'}节点编辑">${state.right ? '›' : '‹'}</button>`}</div>
    <div class="node-scroll">${state.scene === 'holding' ? '<div class="holding-rail-note">持仓过程在图上标注</div>' : `${rightBody()}<div class="unknown-note">未知信息保持未揭示，不使用零值代替。</div>`}</div>
    ${state.scene === 'holding' ? '' : `<button class="text-entry ${state.textMode ? 'active' : ''}" data-action="text-entry"><span class="text-icon">T</span><span><b>图上 Text</b><small>${state.textPlacing ? '点击图表放置文字' : state.textMode ? `已定位 ${anchorLabel()} · 编辑中` : '点击工具条 T 后先在图上定位'}</small></span><span class="chev">›</span></button>`}
  </aside>`; };

  const syncRightScrollHint = () => {
    const panel = root.querySelector('.right-panel');
    const scroller = panel?.querySelector('.node-scroll');
    const hint = panel?.querySelector('[data-right-scroll-hint]');
    const workspace = root.querySelector('.workspace');
    if (!scroller || !hint) return;
    const visible = workspace?.classList.contains('right-open') && getComputedStyle(scroller).visibility !== 'hidden';
    const overflows = scroller.scrollHeight > scroller.clientHeight + 1;
    const hasMoreBelow = scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 1;
    hint.hidden = !(visible && overflows && hasMoreBelow);
  };
  const observeRightScrollHint = () => {
    if (rightScrollResizeObserver) rightScrollResizeObserver.disconnect();
    const panel = root.querySelector('.right-panel');
    const scroller = panel?.querySelector('.node-scroll');
    if (!panel || !scroller) return;
    scroller.addEventListener('scroll', syncRightScrollHint, { passive: true });
    if (typeof ResizeObserver === 'function') {
      rightScrollResizeObserver = new ResizeObserver(syncRightScrollHint);
      rightScrollResizeObserver.observe(scroller);
      rightScrollResizeObserver.observe(panel);
    }
    syncRightScrollHint();
  };

  const planLineSpecs = () => {
    const plan = planDraft().plan;
    return [
      { key: 'stop', label: '止损', value: plan.stop, lineStyle: 2 },
      { key: 'entry', label: '入场', value: plan.entry, lineStyle: 0 },
      { key: 'target', label: '目标', value: plan.target, lineStyle: 1 }
    ].flatMap(spec => {
      const price = Number(spec.value);
      return spec.value != null && String(spec.value).trim() !== '' && Number.isFinite(price) && price > 0 && faithfullyRepresented(spec.value, price)
        ? [{ ...spec, price }]
        : [];
    });
  };
  const planViewBudget = () => {
    const visibleBars = bars.slice(0, state.revealed);
    if (!visibleBars.length) return null;
    const low = Math.min(...visibleBars.map(bar => bar.low));
    const high = Math.max(...visibleBars.map(bar => bar.high));
    const span = high - low;
    const padding = span > 0 ? span * 2 : Math.max(Math.abs(high) * 0.03, 0.01);
    return { minValue: low - padding, maxValue: high + padding };
  };
  const planLineInViewBudget = spec => {
    const range = planViewBudget();
    return Boolean(range && spec.price >= range.minValue && spec.price <= range.maxValue);
  };
  const planLineLegend = () => {
    const specs = planLineSpecs();
    const p = planDraft().plan;
    const roles = [{ key: 'stop', label: '止损' }, { key: 'entry', label: '入场' }, { key: 'target', label: '目标' }];
    const invalid = roles.filter(role => String(p[role.key] ?? '').trim() !== '' && !faithfullyRepresented(p[role.key], Number(p[role.key])));
    return `<div class="plan-line-legend" role="group" aria-label="计划线图例">${roles.map(role => {
      const spec = specs.find(item => item.key === role.key);
      const warning = invalid.some(item => item.key === role.key);
      return spec ? `<span class="plan-line-item${planLineInViewBudget(spec) ? '' : ' plan-line-item--offscreen'}"><i class="plan-line-swatch plan-line-swatch--${spec.key}" aria-hidden="true"></i><span>${role.label} ¥${spec.price.toString()}${planLineInViewBudget(spec) ? '' : ' · 未纳入自动缩放'}</span></span>` : warning ? `<span class="plan-line-item plan-line-item--invalid" aria-label="${role.label}输入 ${esc(p[role.key])} 因图表精度限制未绘制"><i class="plan-line-swatch plan-line-swatch--${role.key}" aria-hidden="true"></i><span>${role.label} · 精度超限，未绘制</span></span>` : '';
    }).join('') || '<span class="plan-line-empty">计划线 · 未设置</span>'}</div>`;
  };
  const chartPanel = () => `<section class="chart-panel"><div class="chart-head"><div class="chart-head-instrument"><span class="eyebrow">MARKET / SYNTHETIC FIXTURE</span><strong>${currentFixture().symbol} / ${currentFixture().code}</strong><span class="divider">·</span><span>${currentFixture().timeframe}</span></div>${planLineLegend()}<span class="chart-note">${state.revealed < bars.length ? `已揭示 ${state.revealed} 根 · 未来信息已隐藏` : '已到样本末尾'}</span></div>
    <div class="chart-wrap"><div id="chart"></div><span data-crosshair-price-readout aria-hidden="true" style="display:none;position:absolute;z-index:8;pointer-events:none;padding:4px 7px;border:1px solid #8392a7;border-radius:4px;background:#101722;color:#e7edf5;font:600 11px/1.2 sans-serif;white-space:nowrap"></span>${tradeMarkerMarkup()}${toolStrip()}
    ${textMarkup()}
      ${state.textPlacing ? keyboardPlacement() : ''}
      ${state.textMode ? `<svg class="chart-text-leader" data-text-editor-leader aria-hidden="true"><path /></svg><span class="chart-text-anchor" data-text-editor-anchor aria-hidden="true"></span><div class="text-callout" data-text-editor style="left:10px;top:10px"><b>Text · ${anchorLabel(state.pendingAnchor || activeAnchor())}</b><textarea id="textInput" aria-label="图上 Text 内容">${esc(state.editingText)}</textarea><div><button data-action="text-cancel">取消</button><button class="primary" data-action="text-confirm">确认</button></div></div>` : ''}
    </div></section>`;
  const replay = () => window.WorkspaceChrome?.replay ? window.WorkspaceChrome.replay({ date: dateLabel(), playing: state.playing, speed: state.playbackSpeed, hidden: state.replayHidden, status: sceneStatus() }) : '';
  const dialog = (title, body, extraClass = '') => `<div class="dialog-backdrop" data-modal-backdrop><section class="records-panel modal-dialog ${extraClass}" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"><h2 id="modal-title">${title}</h2>${body}</section></div>`;
  const recordsPanel = () => { const d = currentDraft(); const ratingLabels = { discipline: '纪律', opportunity: '机会', position: '仓位', experience: '体验' }; const ratingValues = { insufficient: '资料不足' }; const ratings = Object.entries(d.ratings).filter(([, value]) => value !== 'unrated').map(([key, value]) => `${ratingLabels[key] || key}：${ratingValues[value] || value}`).join('、') || '暂无评分'; const note = state.scene === 'exit' ? d.reason : '中途仅保留已揭示成交事实'; return state.recordsOpen ? dialog('查看记录', `<b>${esc(currentFixture().symbol)} / ${esc(currentFixture().code)} · ${esc(currentFixture().round)}</b><p>当前场景：${sceneName()} · ${dateLabel()}</p><p>买入前计划：右侧 A 计划表单</p><p>Text：${esc(currentTexts().filter(textKnown).map(textValueAt).filter(Boolean).join('；') || '暂无')}</p>${state.scene === 'exit' ? `<p>退出原因：${esc(note || '暂无')}</p><p>评分：${esc(ratings)}</p>` : ''}<button data-action="records">返回工作区</button>`, 'records-dialog') : ''; };
  const datePanel = () => state.dateOpen ? dialog('选择回放日期', `<label for="replay-date">回放日期</label><input id="replay-date" type="date" data-date-input value="${esc(state.dateDraft)}" min="${bars[0] ? new Date(bars[0].time * 1000).toISOString().slice(0, 10) : currentFixture().buyDate}" max="${bars[bars.length - 1] ? new Date(bars[bars.length - 1].time * 1000).toISOString().slice(0, 10) : currentFixture().buyDate}" /><p class="dialog-error" role="alert" ${state.dateError ? '' : 'hidden'}>${esc(state.dateError || '')}</p><div class="dialog-actions"><button data-action="date-cancel">取消</button><button class="primary" data-action="date-confirm">确认日期</button></div>`, 'date-panel') : '';
  const exitPanel = () => state.exitPrompt ? dialog('退出工作区？', `<p>当前内容仅保存在内存草稿中。</p><div class="dialog-actions"><button data-action="resume-workspace">继续工作</button><button data-action="confirm-exit">退出到交易列表</button><button data-action="records">查看记录</button></div>`, 'exit-dialog') : '';
  const reviewStrip = () => window.WorkspaceChrome?.review ? window.WorkspaceChrome.review({ variant: state.variant, scene: state.scene, hidden: state.reviewHidden, replayHidden: state.replayHidden }) : '';

  const syncChart = () => {
    if (!candleRef || !volumeRef) return;
    const data = bars.slice(0, state.revealed);
    candleRef.setData(data);
    volumeRef.setData(data.map(bar => ({ time: bar.time, value: bar.value, color: bar.close >= bar.open ? '#53bfa988' : '#e9697288' })));
    if (cutoffPriceLine) candleRef.removePriceLine(cutoffPriceLine);
    const cutoffBar = data[data.length - 1];
    cutoffPriceLine = cutoffBar ? candleRef.createPriceLine({ price: cutoffBar.close, color: cutoffBar.close >= cutoffBar.open ? '#53bfa9' : '#e96972', lineWidth: 1, lineStyle: 0, axisLabelVisible: true }) : null;
    priceLines.forEach(line => candleRef.removePriceLine(line));
    priceLines = [];
    planLineSpecs().forEach(spec => {
      priceLines.push(candleRef.createPriceLine({ price: spec.price, color: '#d7ae64', lineWidth: 1, lineStyle: spec.lineStyle, axisLabelVisible: false }));
    });
    if (markerRef) { markerRef.setMarkers(tradeMarkerSpecs().filter(spec => state.revealed > spec.index).map(spec => ({ time: eventBar(spec.key).time, position: spec.position, color: spec.key === 'buy' ? '#6ca8ff' : spec.key === 'add' ? '#d7ae64' : '#ff8592', shape: spec.key === 'buy' ? 'arrowUp' : 'arrowDown' }))); }
    if (pendingFollow) {
      followLatest();
      ensureReplayPriceVisibility();
      pendingFollow = false;
    }
  };

  const draw = () => {
    const el = document.querySelector('#chart');
    if (!el || !window.LightweightCharts) return;
    chartRef = LightweightCharts.createChart(el, {
      layout: { background: { type: 'solid', color: '#101722' }, textColor: '#8392a7' },
      grid: { vertLines: { color: '#1c2634' }, horzLines: { color: '#1c2634' } },
      rightPriceScale: { borderColor: '#273345', minimumWidth: 96, scaleMargins: { top: 0.08, bottom: 0.2 } },
      timeScale: { borderColor: '#273345', timeVisible: false, secondsVisible: false },
      crosshair: { mode: 0 }, handleScroll: true, handleScale: true
    });
    candleRef = chartRef.addSeries(LightweightCharts.CandlestickSeries, { upColor: '#53bfa9', downColor: '#e96972', borderVisible: false, wickUpColor: '#53bfa9', wickDownColor: '#e96972', lastValueVisible: false, priceLineVisible: false, autoscaleInfoProvider: original => { const info = original(); if (!info?.priceRange || !Number.isFinite(info.priceRange.minValue) || !Number.isFinite(info.priceRange.maxValue)) return info; const budget = planViewBudget(); if (!budget) return info; const prices = planLineSpecs().map(spec => spec.price).filter(price => price >= budget.minValue && price <= budget.maxValue); return prices.length ? { ...info, priceRange: { ...info.priceRange, minValue: Math.min(info.priceRange.minValue, ...prices), maxValue: Math.max(info.priceRange.maxValue, ...prices) } } : info; } });
    // Marker primitives add autoscale margins derived from bar spacing. That
    // margin changes when the sidebars change chart width, even when the
    // numeric price range is unchanged. Keep markers visible, but prevent
    // their dynamic padding from changing the user's vertical price mapping.
    markerRef = LightweightCharts.createSeriesMarkers ? LightweightCharts.createSeriesMarkers(candleRef, [], { autoScale: false }) : null;
    volumeRef = chartRef.addSeries(LightweightCharts.HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'volume', color: '#53bfa9', lastValueVisible: false });
    chartRef.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 }, visible: false });
    syncChart();
    chartRef.timeScale().fitContent();
    updateTextOverlayPositions();
    scheduleTextOverlayPositions();
    chartRef.timeScale().subscribeVisibleLogicalRangeChange(() => updateTextOverlayPositions());
    crosshairAxisLabelHidden = false;
    chartRef.subscribeCrosshairMove(param => {
      updateTextOverlayPositions();
      const readout = el.parentElement?.querySelector('[data-crosshair-price-readout]');
      const point = param?.point;
      const price = point && candleRef.coordinateToPrice(point.y);
      if (!point || !Number.isFinite(price)) {
        if (crosshairAxisLabelHidden) chartRef.applyOptions({ crosshair: { horzLine: { labelVisible: true } } });
        crosshairAxisLabelHidden = false;
        if (readout) readout.style.display = 'none';
        return;
      }
      const nearbyPlan = [...[state.plan.entry, state.plan.stop, state.plan.target].map(Number), Number(bars[state.revealed - 1]?.close)].filter(value => Number.isFinite(value) && value > 0)
        .some(value => { const y = candleRef.priceToCoordinate(value); return Number.isFinite(y) && Math.abs(y - point.y) < 20; });
      if (nearbyPlan) {
        if (!crosshairAxisLabelHidden) chartRef.applyOptions({ crosshair: { horzLine: { labelVisible: false } } });
        crosshairAxisLabelHidden = true;
        if (readout) {
          const plotRight = el.clientWidth - chartRef.priceScale('right').width();
          const chartBounds = el.getBoundingClientRect();
          const rectOf = element => {
            const rect = element?.getBoundingClientRect();
            return rect && rect.width && rect.height ? {
              left: rect.left - chartBounds.left, right: rect.right - chartBounds.left,
              top: rect.top - chartBounds.top, bottom: rect.bottom - chartBounds.top
            } : null;
          };
          const obstacles = [
            ...revealedMarkerRects(),
            ...(el.parentElement?.querySelectorAll('.chart-text, [data-text-editor], .chart-text-anchor, [data-text-editor-anchor], .chart-trade-marker-label, .tv-toolbar, .tool-strip') || [])
          ].map(item => item instanceof Element ? rectOf(item) : item).filter(Boolean);
          const candleRects = bars.slice(0, state.revealed).map(bar => {
            const x = chartRef.timeScale().timeToCoordinate(bar.time);
            const high = candleRef.priceToCoordinate(bar.high);
            const low = candleRef.priceToCoordinate(bar.low);
            if (![x, high, low].every(Number.isFinite) || x < 0 || x > plotRight) return null;
            const halfWidth = Math.min(12, Math.max(2, chartRef.timeScale().options().barSpacing * 0.35));
            return { left: x - halfWidth, right: x + halfWidth, top: Math.min(high, low) - 2, bottom: Math.max(high, low) + 2 };
          }).filter(Boolean);
          readout.textContent = `十字线 ¥${price.toFixed(2)}`;
          readout.style.display = '';
          const width = readout.getBoundingClientRect().width;
          const height = readout.getBoundingClientRect().height;
          const minLeft = 4;
          const readoutRight = plotRight - Math.min(84, Math.max(68, chartRef.priceScale('right').width() * 0.88));
          const maxLeft = Math.max(minLeft, readoutRight - width - 4);
          const minTop = 4;
          const maxTop = Math.max(minTop, el.clientHeight - height - 30);
          const clampLeft = value => Math.max(minLeft, Math.min(value, maxLeft));
          const clampTop = value => Math.max(minTop, Math.min(value, maxTop));
          const lefts = [...new Set([clampLeft(point.x + 14), clampLeft(point.x - width - 14), clampLeft(point.x - width / 2), minLeft, maxLeft,
            ...[...obstacles, ...candleRects].flatMap(rect => [clampLeft(rect.left - width - 8), clampLeft(rect.right + 8)])])];
          const tops = [...new Set([clampTop(point.y - height - 14), clampTop(point.y + 14), clampTop(point.y - height / 2), minTop, maxTop,
            ...[...obstacles, ...candleRects].flatMap(rect => [clampTop(rect.top - height - 8), clampTop(rect.bottom + 8)])])];
          let best = null;
          for (const left of lefts) for (const top of tops) {
            let overlap = 0;
            let collisions = 0;
            for (const rect of obstacles) {
              const area = Math.max(0, Math.min(left + width, rect.right) - Math.max(left, rect.left))
                * Math.max(0, Math.min(top + height, rect.bottom) - Math.max(top, rect.top));
              if (area > 0) collisions += 1;
              overlap += area;
            }
            let candleOverlap = 0;
            for (const rect of candleRects) {
              candleOverlap += Math.max(0, Math.min(left + width, rect.right) - Math.max(left, rect.left))
                * Math.max(0, Math.min(top + height, rect.bottom) - Math.max(top, rect.top));
            }
            const distance = Math.hypot(left + width / 2 - point.x, top + height / 2 - point.y);
            const score = collisions * 1e12 + overlap * 1000 + candleOverlap * 250 + distance;
            if (!best || score < best.score) best = { left, top, score };
          }
          if (best) {
            readout.style.left = `${best.left}px`;
            readout.style.top = `${best.top}px`;
            // Re-route Text leaders after the readout reaches its final rect;
            // otherwise the first pass only sees the previous cursor position.
            updateTextOverlayPositions();
          }
        }
      } else {
        if (crosshairAxisLabelHidden) chartRef.applyOptions({ crosshair: { horzLine: { labelVisible: true } } });
        crosshairAxisLabelHidden = false;
        if (readout) readout.style.display = 'none';
      }
    });
    overlayChartEl = el;
    overlayRefresh = () => updateTextOverlayPositions();
    el.addEventListener('pointermove', overlayRefresh, { passive: true });
    el.addEventListener('wheel', overlayRefresh, { passive: true });
    el.addEventListener('pointerup', overlayRefresh, { passive: true });
    chartRef.subscribeClick(param => {
      if (!state.textPlacing || !param.point) return;
      const price = candleRef.coordinateToPrice(param.point.y);
      const rawLogical = Number(chartRef.timeScale().coordinateToLogical(param.point.x));
      if (!Number.isFinite(rawLogical) || rawLogical < 0 || rawLogical > state.revealed - 1) {
        state.notice = '请选择已揭示范围';
        render();
        return;
      }
      const logical = rawLogical;
      const bar = bars[Math.round(logical)] || bars[state.revealed - 1];
      if (!Number.isFinite(price) || !Number.isFinite(logical) || !bar || bar.time > textCutoff()) {
        state.notice = '请选择已揭示范围';
        render();
        return;
      }
      const time = bar.time;
      state.pendingAnchor = { time, price, logical, label: new Date(time * 1000).toISOString().slice(0, 10) };
      state.textEditId = null;
      state.textPlacing = false;
      state.textMode = true;
      state.editingText = '';
      state.notice = '已定位到图表时间与价格 · 编辑文字后确认或取消';
      render();
    });
    observeChart(el);
  };
  const chartViewport = () => {
    if (!chartRef) return null;
    const time = chartRef.timeScale();
    const price = chartRef.priceScale('right');
    const timeLogical = time.getVisibleLogicalRange();
    const priceRange = price.getVisibleRange();
    const autoScale = price.options().autoScale !== false;
    return {
      timeLogical: timeLogical && Number.isFinite(timeLogical.from) && Number.isFinite(timeLogical.to) ? { ...timeLogical } : null,
      priceRange: priceRange && Number.isFinite(priceRange.from) && Number.isFinite(priceRange.to) ? { ...priceRange } : null,
      autoScale
    };
  };
  const restoreChartViewport = viewport => {
    if (!chartRef || !viewport) return;
    const time = chartRef.timeScale();
    const price = chartRef.priceScale('right');
    if (viewport.timeLogical) time.setVisibleLogicalRange(viewport.timeLogical);
    if (!viewport.priceRange) return;
    // setVisibleRange() implicitly disables auto-scale in Lightweight Charts.
    // Restore the user's mode after applying the saved numeric window so a
    // sidebar resize cannot accidentally turn auto-scale into a permanent lock.
    price.setVisibleRange(viewport.priceRange);
    price.setAutoScale(viewport.autoScale !== false);
  };
  const observeChart = (el, restoreViewport = null) => {
    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = new ResizeObserver(() => {
      const viewport = chartViewport();
      chartRef?.resize(el.clientWidth, el.clientHeight);
      restoreChartViewport(viewport);
      updateTextOverlayPositions();
      scheduleTextOverlayPositions();
    });
    resizeObserver.observe(el);
    chartRef?.resize(el.clientWidth, el.clientHeight);
    restoreChartViewport(restoreViewport);
  };
  const disposeChart = () => {
    if (overlayChartEl && overlayRefresh) { overlayChartEl.removeEventListener('pointermove', overlayRefresh); overlayChartEl.removeEventListener('wheel', overlayRefresh); overlayChartEl.removeEventListener('pointerup', overlayRefresh); }
    overlayChartEl = null;
    overlayRefresh = null;
    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = null;
    if (chartRef) chartRef.remove();
    chartRef = null;
    candleRef = null;
    volumeRef = null;
    markerRef = null;
    priceLines = [];
    cutoffPriceLine = null;
  };

  const focusTargetForRender = key => {
    if (!key) return null;
    if (key === 'control-toggle-left' || key === 'control-toggle-right' || key === 'control-step' || key === 'control-next-node' || key === 'control-play') {
      const action = key.slice('control-'.length);
      return root.querySelector(`[data-action="${action}"]`);
    }
    if (key.startsWith('control-trade:')) {
      const tradeId = key.slice('control-trade:'.length);
      const trade = [...root.querySelectorAll('[data-trade]')].find(element => element.dataset.trade === tradeId);
      if (trade?.getClientRects().length && getComputedStyle(trade).visibility !== 'hidden') return trade;
      return root.querySelector('[data-action="toggle-left"]') || root.querySelector('[data-action="play"]');
    }
    if (key.startsWith('control-action:')) {
      const actionName = key.slice('control-action:'.length);
      const target = root.querySelector(`[data-action="${actionName}"]`);
      if (target?.getClientRects().length && getComputedStyle(target).visibility !== 'hidden') return target;
      // A hidden bar can remove the requested restore control from the DOM.
      // Prefer the restore control that is actually visible, then a stable
      // workspace control; never leave focus at the document body.
      const visibleRestore = [...root.querySelectorAll('[data-action="show-review"], [data-action="show-replay"]')]
        .find(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
      return visibleRestore || root.querySelector('[data-action="toggle-left"]') || root.querySelector('[data-action="toggle-right"]') || root.querySelector('[data-action="date"]');
    }
    if (key.startsWith('control-trigger:')) {
      const target = root.querySelector(`[data-modal-trigger="${key.slice('control-trigger:'.length)}"]`);
      if (target?.getClientRects().length && getComputedStyle(target).visibility !== 'hidden') return target;
      return root.querySelector('[data-modal-trigger="records"]') || root.querySelector('[data-action="toggle-left"]') || root.querySelector('[data-action="toggle-right"]');
    }
    if (key.startsWith('control-tool:')) return [...root.querySelectorAll('[data-tool]')].find(element => element.dataset.tool === key.slice('control-tool:'.length));
    if (key.startsWith('control-text:')) return [...root.querySelectorAll('[data-text-id]')].find(element => element.dataset.textId === key.slice('control-text:'.length));
    if (key.startsWith('control-scene:')) { const scene = key.slice('control-scene:'.length); return [...root.querySelectorAll('[data-scene]')].find(element => (element.tagName === 'SELECT' ? element.value : element.dataset.scene) === scene); }
    if (key.startsWith('control-rating:')) return [...root.querySelectorAll('[data-rating]')].find(element => element.dataset.rating === key.slice('control-rating:'.length));
    if (key.startsWith('control-judgment:')) return [...root.querySelectorAll('[data-judgment]')].find(element => element.dataset.judgment === key.slice('control-judgment:'.length));
    if (key.startsWith('control-scale:')) return [...root.querySelectorAll('[data-scale]')].find(element => element.dataset.scale === key.slice('control-scale:'.length)) || root.querySelector('[data-scale][tabindex="0"]');
    if (key.startsWith('control-early:')) return [...root.querySelectorAll('[data-early]')].find(element => element.dataset.early === key.slice('control-early:'.length)) || root.querySelector('[data-early][tabindex="0"]');
    if (key === 'control-speed') return root.querySelector('[data-speed]');
    if (key === 'closed-workspace') return root.querySelector('[data-action="resume-workspace"]');
    if (key === 'date') return root.querySelector('[data-action="date"]');
    if (key === 'text-tool') return root.querySelector('[data-tool="D02"]');
    if (key === 'direction-long') return root.querySelector('[data-direction="long"]');
    if (key === 'direction-short') return root.querySelector('[data-direction="short"]');
    if (key === 'text-placement') return root.querySelector('[data-keyboard-logical]');
    if (key === 'text-input') return root.querySelector('#textInput');
    if (key.startsWith('text-')) return root.querySelector(`[data-text-id="${key.slice(5)}"]`);
    return root.querySelector(`[data-modal-trigger="${key}"]`);
  };

  const focusRenderedTarget = target => {
    if (!target || !target.isConnected || target.disabled || target.closest('[inert]')) return false;
    if (!target.getClientRects().length || getComputedStyle(target).visibility === 'hidden') return false;
    target.focus();
    return document.activeElement === target;
  };

  const render = () => {
    applyViewportPolicy();
    enforceSidebarExclusion();
    if (state.mobileFallback) { disposeChart(); root.innerHTML = '<main class="workspace-exit"><div class="records-panel"><b>当前窗口较窄</b><p>请返回桌面宽度继续审阅 TradeReview 工作区。</p><a class="button" href="../../visual-spec.html">返回阅读页</a></div></main>'; return; }
    if (state.workspaceClosed) { disposeChart(); root.innerHTML = '<main class="workspace-exit"><div class="records-panel"><b>已退出 TradeReview 工作区</b><p>当前草稿仍只保存在内存中。</p><button data-action="resume-workspace">返回工作区</button></div></main>'; bind(); if (state.focusAfterRender === 'closed-workspace') { root.querySelector('[data-action="resume-workspace"]')?.focus(); state.focusAfterRender = null; } return; }
    const existingChart = document.querySelector('#chart');
    const viewKey = `${state.tradeId}/${state.scene}/${state.variant}`;
    const existingDetails = root.querySelector('[data-plan-details]');
    if (state.detailsKey === viewKey && existingDetails) state.detailsOpen = existingDetails.open;
    else if (state.detailsKey !== viewKey) { state.detailsKey = viewKey; state.detailsOpen = false; }
    const existingScroll = root.querySelector('.node-scroll');
    const scrollTop = existingScroll ? existingScroll.scrollTop : 0;
    const restoreViewport = chartRef && !pendingFollow ? chartViewport() : null;
    const modalOpen = state.recordsOpen || state.dateOpen || state.exitPrompt;
    const reviewMarkup = reviewStrip();
    const inertReviewMarkup = modalOpen ? reviewMarkup.replace('class="review-strip chrome-review"', 'class="review-strip chrome-review" inert').replace('class="review-restore-dock"', 'class="review-restore-dock" inert') : reviewMarkup;
    if (rightScrollResizeObserver) { rightScrollResizeObserver.disconnect(); rightScrollResizeObserver = null; }
    root.innerHTML = `<main class="workspace ${state.left ? 'left-open' : ''} ${state.right ? 'right-open' : ''}" ${modalOpen ? 'inert' : ''}>${leftPanel()}<div class="main-column"><header class="topbar"><button class="back" data-action="exit" data-modal-trigger="exit-back" aria-label="返回交易库">‹</button><div class="instrument"><b>${currentFixture().symbol} / ${currentFixture().code}</b><small>${currentFixture().timeframe} · 合成演示行情</small></div><span class="stage-label">${sceneName()}</span><span class="save-state">● 内存草稿</span><button class="top-link" disabled title="原型不导出">导出</button><button class="top-link" disabled title="本原型没有更多动作">更多</button><button class="top-link" data-action="records" data-modal-trigger="records">记录</button><button class="close" data-action="exit" data-modal-trigger="exit-close" aria-label="关闭工作区">×</button></header><div class="info-row">${state.notice && !(typeof state.notice === 'string' && state.notice.startsWith('已切换按数量')) ? `<span class="action-note">${esc(state.notice === true ? '此处为内存演示。' : state.notice)}</span>` : ''}<span class="market-info">复盘起点 ${new Date(bars[0].time * 1000).toISOString().slice(0, 10)} · 行情截止 ${dateLabel()} · 成交截止：${sceneStatus()}</span><b>${state.scene === 'holding' ? '图上自由标注 · 持仓中' : `记录对象：${sceneName()}`}</b></div>${chartPanel()}${replay()}</div>${rightPanel()}</main>${recordsPanel()}${datePanel()}${exitPanel()}${inertReviewMarkup}`;
    bind();
    const modal = root.querySelector('[role="dialog"]');
    if (modal) {
      const target = state.focusAfterRender === 'date' ? modal.querySelector('[data-date-input]') : modal.querySelector('button, input, [tabindex="0"]') || modal;
      target?.focus();
      state.focusAfterRender = null;
    } else if (state.focusAfterRender) {
      const target = focusTargetForRender(state.focusAfterRender);
      focusRenderedTarget(target);
      state.focusAfterRender = null;
    }
    const nextDetails = root.querySelector('[data-plan-details]');
    if (nextDetails) nextDetails.open = state.detailsOpen;
    const nextScroll = root.querySelector('.node-scroll');
    if (nextScroll) nextScroll.scrollTop = scrollTop;
    observeRightScrollHint();
    const mount = root.querySelector('#chart');
    if (existingChart && chartRef) {
      mount.replaceWith(existingChart);
      syncChart();
      observeChart(existingChart, restoreViewport);
      updateTextOverlayPositions();
      scheduleTextOverlayPositions();
    } else {
      draw();
    }
  };

  const action = (type, payload) => {
    if (type === 'clear-filter') state.tradeFilter = '';
    if (type === 'records') { pausePlayback(); if (state.recordsOpen) { state.recordsOpen = false; state.focusAfterRender = state.modalReturnFocus || 'records'; state.modalReturnFocus = null; } else { if (!state.recordsOpen && !state.dateOpen && !state.exitPrompt) state.modalReturnFocus = payload || 'records'; state.recordsOpen = true; state.dateOpen = false; state.exitPrompt = false; state.focusAfterRender = 'dialog'; } }
    if (type === 'exit') { pausePlayback(); if (!state.exitPrompt) state.modalReturnFocus = payload || 'exit'; state.exitPrompt = true; state.recordsOpen = false; state.dateOpen = false; state.focusAfterRender = 'dialog'; }
    if (type === 'confirm-exit') { state.exitPrompt = false; state.workspaceClosed = true; state.focusAfterRender = 'closed-workspace'; pausePlayback(); }
    if (type === 'resume-workspace') { state.exitPrompt = false; state.workspaceClosed = false; state.focusAfterRender = state.modalReturnFocus || 'exit'; state.modalReturnFocus = null; }
    if (type === 'toggle-left') { state.left = !state.left; if (state.left && window.innerWidth < 1292) state.right = false; state.focusAfterRender = 'control-toggle-left'; }
    if (type === 'toggle-right') { state.right = !state.right; if (state.right && window.innerWidth < 1292) state.left = false; state.focusAfterRender = 'control-toggle-right'; }
    if (type === 'step') { pausePlayback(); state.revealed = Math.min(bars.length, state.revealed + 1); updateSceneForReveal(); pendingFollow = true; state.notice = `已揭示 ${dateLabel()} · ${sceneName()}`; state.focusAfterRender = 'control-step'; }
    if (type === 'next-node') {
      pausePlayback();
      const stops = [{ revealed: 33 }, { revealed: 41 }, { revealed: 49 }];
      const next = stops.find(node => node.revealed > state.revealed);
      if (next) { state.revealed = next.revealed; updateSceneForReveal(); pendingFollow = true; state.notice = replayStopNotice(); }
      else state.notice = noNextReplayStopNotice();
      state.focusAfterRender = 'control-next-node';
    }
    if (type === 'play') {
      state.focusAfterRender = 'control-play';
      if (state.playing) pausePlayback();
      else {
        state.playing = true;
        state.notice = `播放速度 ${state.playbackSpeed}x · 正在播放`;
        syncPlaybackButton();
        playTimer = setInterval(() => {
          const activeElement = document.activeElement;
          const focusWasInsideWorkspace = root.contains(activeElement);
          const playbackControlHadFocus = activeElement?.matches('[data-action="play"]');
          const focusedTrigger = focusWasInsideWorkspace ? activeElement?.dataset.modalTrigger : null;
          const focusedSpeed = focusWasInsideWorkspace && activeElement?.matches('[data-speed]');
          const focusedTool = focusWasInsideWorkspace ? activeElement?.dataset.tool : null;
          const focusedTextId = focusWasInsideWorkspace ? activeElement?.dataset.textId : null;
          const focusedAction = focusWasInsideWorkspace ? activeElement?.dataset.action : null;
          const focusedScene = focusWasInsideWorkspace ? activeElement?.dataset.scene : null;
          const focusedTrade = focusWasInsideWorkspace ? activeElement?.dataset.trade : null;
          if (document.activeElement?.matches('input,textarea,[contenteditable="true"]') || state.textMode || state.revealed >= bars.length) { pausePlayback(); render(); return; }
          state.revealed += 1;
          updateSceneForReveal();
          pendingFollow = true;
          if ([33, 41, 49].includes(state.revealed)) { pausePlayback(); state.notice = replayStopNotice(); }
          state.focusAfterRender = playbackControlHadFocus ? 'control-play' : focusedTrigger ? `control-trigger:${focusedTrigger}` : focusedSpeed ? 'control-speed' : focusedTool ? `control-tool:${focusedTool}` : focusedTextId != null ? `control-text:${focusedTextId}` : focusedAction ? `control-action:${focusedAction}` : focusedScene ? `control-scene:${focusedScene}` : focusedTrade ? `control-trade:${focusedTrade}` : null;
          render();
        }, 700 / state.playbackSpeed);
      }
    }
    if (type === 'text-entry') {
      pausePlayback();
      state.textMode = false;
      state.textPlacing = true;
      state.pendingAnchor = null;
      state.textEditId = null;
      state.editingText = '';
      state.keyboardLogical = state.revealed - 1;
      state.keyboardPrice = bars[state.revealed - 1].close;
      state.focusAfterRender = 'text-placement';
      state.notice = 'Text：可鼠标点图，或用键盘设置时间位置与价格';
    }
    if (type === 'text-edit') { pausePlayback(); state.pendingAnchor = null; state.textPlacing = false; state.textMode = true; state.textEditId = payload == null ? 0 : Number(payload); state.editingText = currentText().value; }
    if (type === 'text-place-confirm') { const logical = Math.max(0, Math.min(state.revealed - 1, Number(state.keyboardLogical))); const price = Number(state.keyboardPrice); const bar = bars[Math.round(logical)] || bars[state.revealed - 1]; if (Number.isFinite(price) && price > 0 && bar.time <= textCutoff()) { state.pendingAnchor = { time: bar.time, price, logical, label: new Date(bar.time * 1000).toISOString().slice(0, 10) }; state.textEditId = null; state.textPlacing = false; state.textMode = true; state.editingText = ''; state.notice = '已定位到图表时间与价格 · 编辑文字后确认或取消'; } else { state.notice = '请输入有效价格，并选择当前已揭示的时间范围'; state.focusAfterRender = 'text-placement'; } }
    if (type === 'text-cancel') { const focusId = state.textEditId; state.textMode = false; state.textPlacing = false; state.pendingAnchor = null; state.editingText = ''; state.textEditId = null; state.textAnchor = currentTexts().at(-1)?.anchor || null; state.notice = 'Text 操作已取消 · 已确认文字保留'; state.focusAfterRender = focusId == null ? 'text-tool' : `text-${focusId}`; }
    if (type === 'text-confirm') { if (!state.editingText.trim()) { state.notice = '请输入文字后再确认'; state.focusAfterRender = 'text-input'; } else { let focusId = state.textEditId; if (state.textEditId == null) { const createdAt = textCutoff(); currentTexts().push({ value: state.editingText, anchor: state.pendingAnchor, createdAt, history: [{ at: createdAt, value: state.editingText }] }); focusId = currentTexts().length - 1; } else saveTextVersion(currentTexts()[state.textEditId], state.editingText, textCutoff()); state.textAnchor = currentTexts().at(-1)?.anchor || null; state.pendingAnchor = null; state.textEditId = null; state.textMode = false; state.textPlacing = false; state.editingText = ''; state.notice = 'Text 已确认 · 再次选择 T 可单次放置下一条'; state.focusAfterRender = `text-${focusId}`; } }
    if (type === 'hide-replay') { state.replayHidden = true; state.focusAfterRender = 'control-action:show-replay'; }
    if (type === 'show-replay') { state.replayHidden = false; state.focusAfterRender = 'control-action:hide-replay'; }
    if (type === 'hide-review') { state.reviewHidden = true; state.focusAfterRender = 'control-action:show-review'; }
    if (type === 'show-review') { state.reviewHidden = false; state.focusAfterRender = 'control-action:hide-review'; }
    if (type === 'date') { pausePlayback(); if (state.dateOpen) { state.dateOpen = false; state.focusAfterRender = state.modalReturnFocus || 'date'; state.modalReturnFocus = null; } else { state.modalReturnFocus = 'date'; state.dateOpen = true; state.recordsOpen = false; state.exitPrompt = false; state.dateDraft = dateLabel(); state.dateError = ''; state.focusAfterRender = 'date'; } }
    if (type === 'date-cancel') { state.dateOpen = false; state.dateError = ''; state.focusAfterRender = state.modalReturnFocus || 'date'; state.modalReturnFocus = null; }
    if (type === 'date-confirm') { pausePlayback(); const index = bars.findIndex(bar => new Date(bar.time * 1000).toISOString().slice(0, 10) === state.dateDraft); if (index < 0) { state.dateError = '请选择样本范围内的有效日期。'; state.focusAfterRender = 'date'; render(); return; } state.textMode = false; state.textPlacing = false; state.pendingAnchor = null; state.editingText = ''; state.revealed = index + 1; updateSceneForReveal(); pendingFollow = true; state.notice = `日期已定位：${dateLabel()} · ${sceneStatus()}`; state.dateOpen = false; state.dateError = ''; state.focusAfterRender = state.modalReturnFocus || 'date'; state.modalReturnFocus = null; }
    render();
  };

  const bind = () => {
    root.querySelectorAll('[data-action]').forEach(element => element.addEventListener('click', () => action(element.dataset.action, element.dataset.textId || element.dataset.modalTrigger)));
    root.querySelectorAll('[data-modal-backdrop]').forEach(backdrop => backdrop.addEventListener('click', event => {
      if (event.target !== backdrop || !state.dateOpen) return;
      event.preventDefault();
      root.querySelector('[role="dialog"]')?.focus();
    }));
    root.querySelectorAll('[role="dialog"]').forEach(dialog => dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab' || document.activeElement !== dialog) return;
      const controls = [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
        .filter(control => control.getClientRects().length && getComputedStyle(control).visibility !== 'hidden');
      if (!controls.length) return;
      event.preventDefault();
      (event.shiftKey ? controls.at(-1) : controls[0]).focus();
    }));
    root.querySelectorAll('[data-text-id]').forEach(element => element.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action('text-edit', element.dataset.textId); } }));
    const filter = root.querySelector('[data-filter]');
    if (filter) { filter.addEventListener('input', event => { pausePlayback(); state.tradeFilter = event.target.value; const caret = event.target.selectionStart; render(); const nextFilter = root.querySelector('[data-filter]'); if (nextFilter) { nextFilter.focus(); const nextCaret = Math.min(caret == null ? nextFilter.value.length : caret, nextFilter.value.length); nextFilter.setSelectionRange(nextCaret, nextCaret); } }); filter.addEventListener('focus', pausePlayback); }
    root.querySelectorAll('[data-tool]').forEach(element => element.addEventListener('click', () => { if (element.dataset.tool === 'D02') action('text-entry'); }));
    root.querySelectorAll('[data-trade]').forEach(element => element.addEventListener('click', () => { pausePlayback(); state.tradeId = element.dataset.trade; bars = barsForFixture(currentFixture()); state.scene = 'entry'; state.revealed = 28; state.right = true; enforceSidebarExclusion(); syncSceneUrl(); pendingFollow = true; state.textMode = false; state.textPlacing = false; state.pendingAnchor = null; state.textEditId = null; state.textAnchor = currentTexts().at(-1)?.anchor || null; state.notice = `已切换回合：${currentFixture().round} · 入场截止`; state.focusAfterRender = `control-trade:${state.tradeId}`; render(); }));
    root.querySelectorAll('[data-scene]').forEach(element => element.addEventListener(element.tagName === 'SELECT' ? 'change' : 'click', () => { pausePlayback(); state.textMode = false; state.textPlacing = false; state.pendingAnchor = null; state.editingText = ''; const nextScene = normalizeScene(element.value || element.dataset.scene); const phaseChanged = nextScene !== state.scene; state.scene = nextScene; state.revealed = sceneCutoff(); if (phaseChanged) { state.right = nextScene === 'holding' ? false : true; enforceSidebarExclusion(); } pendingFollow = true; state.textAnchor = currentTexts().at(-1)?.anchor || null; state.notice = `场景审阅：${sceneName()} · 后续信息按阶段隐藏`; syncSceneUrl(); state.focusAfterRender = `control-scene:${state.scene}`; render(); }));
    root.querySelectorAll('[data-speed]').forEach(button => button.addEventListener(button.tagName === 'SELECT' ? 'change' : 'click', () => { pausePlayback(); state.playbackSpeed = Number(button.value || button.dataset.speed); state.notice = `播放速度 ${state.playbackSpeed}x · 已暂停`; state.focusAfterRender = 'control-speed'; render(); }));
    const dateInput = root.querySelector('[data-date-input]');
    if (dateInput) { dateInput.addEventListener('focus', pausePlayback); dateInput.addEventListener('input', event => { state.dateDraft = event.target.value; state.dateError = ''; }); dateInput.addEventListener('change', event => { state.dateDraft = event.target.value; state.dateError = ''; }); }
    const selectScale = button => { const draft = planDraft(); const previousMode = currentScaleMode(); const values = planValues(); const nextMode = button.dataset.scale; const validSource = values.baseValid && values.calculationSafe; const safeText = text => text && !text.startsWith('<') ? text : ''; draft.plan.scaleMode = nextMode; if (scaleUi().unavailable && scaleUi().invalidSource === nextMode) { scaleUi().unavailable = false; scaleUi().invalidSource = null; state.notice = ''; state.focusAfterRender = `control-scale:${button.dataset.scale}`; render(); return; } if (nextMode === 'quantity' && previousMode !== 'quantity') { if (validSource && values.quantityText && !values.quantityText.startsWith('<')) { draft.plan.quantity = values.quantityText; scaleUi().unavailable = false; scaleUi().invalidSource = null; } else { scaleUi().unavailable = true; if (!scaleUi().invalidSource) scaleUi().invalidSource = previousMode; } state.notice = validSource && values.quantityText && values.quantityApproximate ? '已切换按数量：数量按两位小数近似，后续结果按该数量计算。' : !validSource ? '当前金额/仓位来源无法安全派生数量，已清空数量显示；原始来源仍保留。' : ''; } else if (nextMode === 'amount' && previousMode !== 'amount') { if (validSource) { const derived = safeText(values.amountText); if (derived) { draft.plan.amount = derived; scaleUi().unavailable = false; scaleUi().invalidSource = null; } else { scaleUi().unavailable = true; if (!scaleUi().invalidSource) scaleUi().invalidSource = previousMode; } } else { scaleUi().unavailable = true; if (!scaleUi().invalidSource) scaleUi().invalidSource = previousMode; } state.notice = ''; } else if (nextMode === 'percent' && previousMode !== 'percent') { if (validSource) { const derived = safeText(values.percentText); if (derived) { draft.plan.percent = derived; scaleUi().unavailable = false; scaleUi().invalidSource = null; } else { scaleUi().unavailable = true; if (!scaleUi().invalidSource) scaleUi().invalidSource = previousMode; } } else { scaleUi().unavailable = true; if (!scaleUi().invalidSource) scaleUi().invalidSource = previousMode; } state.notice = ''; } else if (nextMode === previousMode && scaleUi().unavailable && scaleUi().invalidSource === nextMode) { scaleUi().unavailable = false; scaleUi().invalidSource = null; state.notice = ''; } else if (nextMode !== 'quantity') state.notice = ''; state.focusAfterRender = `control-scale:${button.dataset.scale}`; render(); };
    root.querySelectorAll('[data-scale]').forEach(button => { button.addEventListener('click', () => selectScale(button)); button.addEventListener('keydown', event => { const buttons = [...root.querySelectorAll('[data-scale]')]; const index = buttons.indexOf(button); const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : event.key === 'Home' ? -index : event.key === 'End' ? buttons.length - 1 - index : 0; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectScale(button); } else if (delta || event.key === 'Home' || event.key === 'End') { event.preventDefault(); selectScale(buttons[(index + delta + buttons.length) % buttons.length]); } }); });
    root.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => { planDraft().plan.direction = button.dataset.direction; state.focusAfterRender = `direction-${button.dataset.direction}`; render(); }));
    const selectEarly = button => { currentDraft().earlyExit = button.dataset.early; state.focusAfterRender = `control-early:${button.dataset.early}`; render(); };
    root.querySelectorAll('[data-early]').forEach(button => { button.addEventListener('click', () => selectEarly(button)); button.addEventListener('keydown', event => { const buttons = [...root.querySelectorAll('[data-early]')]; const index = buttons.indexOf(button); const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : event.key === 'Home' ? -index : event.key === 'End' ? buttons.length - 1 - index : 0; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectEarly(button); } else if (delta || event.key === 'Home' || event.key === 'End') { event.preventDefault(); selectEarly(buttons[(index + delta + buttons.length) % buttons.length]); } }); });
    root.querySelectorAll('[data-rating]').forEach(select => { select.addEventListener('focus', pausePlayback); select.addEventListener('change', () => { currentDraft().ratings[select.dataset.rating] = select.value; state.focusAfterRender = `control-rating:${select.dataset.rating}`; render(); }); });
    root.querySelectorAll('[data-judgment]').forEach(input => { const saveJudgment = () => { if (input.dataset.judgment === 'reason') currentDraft().reason = input.value; else if (input.dataset.judgment === 'adherence') currentDraft().adherence = input.value; else currentDraft().judgment = input.value; }; input.addEventListener('focus', pausePlayback); input.addEventListener('input', saveJudgment); input.addEventListener('change', () => { saveJudgment(); if (input.tagName === 'SELECT') { state.focusAfterRender = `control-judgment:${input.dataset.judgment}`; render(); } }); });
    root.querySelectorAll('[data-funds]').forEach(input => { input.addEventListener('focus', pausePlayback); input.addEventListener('compositionstart', pausePlayback); input.addEventListener('input', event => { const caret = event.target.selectionStart; currentDraft().funds[input.dataset.funds] = input.value; syncFundingPresentation(); render(); const nextInput = root.querySelector(`[data-funds="${input.dataset.funds}"]`); if (nextInput) { nextInput.focus(); const nextCaret = Math.min(caret == null ? nextInput.value.length : caret, nextInput.value.length); nextInput.setSelectionRange(nextCaret, nextCaret); } }); });
    root.querySelectorAll('[data-plan]').forEach(input => {
      input.addEventListener('focus', pausePlayback);
      input.addEventListener('compositionstart', pausePlayback);
      input.addEventListener('input', event => {
        pausePlayback();
        const key = event.target.dataset.plan;
        const value = Number(event.target.value);
        const caret = event.target.selectionStart;
        if (key === 'quantity' || (currentScaleMode() === 'amount' && key === 'quantity') || (currentScaleMode() === 'percent' && key === 'quantity')) { scaleUi().unavailable = false; scaleUi().invalidSource = null; }
        if (currentScaleMode() === 'amount' && key === 'quantity') currentDraft().plan.amount = event.target.value;
        else if (currentScaleMode() === 'percent' && key === 'quantity') currentDraft().plan.percent = event.target.value;
        else currentDraft().plan[key] = event.target.value;
        if (key === 'quantity' || (key === 'entry' || key === 'stop' || key === 'target')) state.notice = '';
        syncChart();
        render();
        const nextInput = root.querySelector(`[data-plan="${key}"]`);
        if (nextInput) {
          nextInput.focus();
          const nextCaret = Math.min(caret == null ? nextInput.value.length : caret, nextInput.value.length);
          nextInput.setSelectionRange(nextCaret, nextCaret);
        }
      });
    });
    const input = root.querySelector('#textInput');
    if (input) {
      input.focus();
      input.addEventListener('focus', pausePlayback);
      input.addEventListener('compositionstart', pausePlayback);
      input.addEventListener('input', event => { pausePlayback(); state.editingText = event.target.value; });
    }
    const logicalInput = root.querySelector('[data-keyboard-logical]');
    if (logicalInput) logicalInput.addEventListener('input', event => { state.keyboardLogical = Number(event.target.value); const bar = bars[Math.round(state.keyboardLogical)]; const output = root.querySelector('[data-logical-date]'); if (output && bar) output.textContent = `${new Date(bar.time * 1000).toISOString().slice(0, 10)} · ${state.keyboardLogical.toFixed(1)}`; });
    const priceInput = root.querySelector('[data-keyboard-price]');
    if (priceInput) priceInput.addEventListener('input', event => { state.keyboardPrice = event.target.value; });
  };

  document.addEventListener('keydown', event => {
    const modal = root.querySelector('[role="dialog"]');
    if (modal) {
      if (event.key === 'Escape') { event.preventDefault(); if (state.dateOpen) action('date-cancel'); else if (state.exitPrompt) action('resume-workspace'); else if (state.recordsOpen) action('records'); return; }
      if (event.key === 'Tab') { const items = [...modal.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(item => item.getClientRects().length); if (!items.length) { event.preventDefault(); modal.focus(); return; } const first = items[0], last = items.at(-1); if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { event.preventDefault(); first.focus(); } }
      if (event.key === 'Enter' && event.target.matches('[data-date-input]')) { event.preventDefault(); action('date-confirm'); }
      return;
    }
    if (event.key === 'Escape' && (state.textMode || state.textPlacing)) { event.preventDefault(); pausePlayback(); const focusId = state.textEditId; state.textMode = false; state.textPlacing = false; state.pendingAnchor = null; state.textEditId = null; state.textAnchor = currentTexts().at(-1)?.anchor || null; state.editingText = ''; state.notice = 'Text 操作已取消 · 已确认文字保留'; state.focusAfterRender = focusId == null ? 'text-tool' : `text-${focusId}`; render(); }
  });
  window.addEventListener('resize', () => { if (applyViewportPolicy()) render(); else syncRightScrollHint(); });
  render();
})();
