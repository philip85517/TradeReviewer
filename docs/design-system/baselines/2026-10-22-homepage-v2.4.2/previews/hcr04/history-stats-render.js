(function (root) {
  const sum = values => values.reduce((total, value) => total + (value ?? 0), 0);
  function normalizeModel(source = {}) {
    const model = source.monthly ?? source;
    const x = model.x ?? source.x ?? [];
    const p = model.p ?? source.p ?? [];
    const w = model.w ?? source.w ?? [];
    const r = model.r ?? source.r ?? [];
    const f = model.f ?? source.f ?? [];
    const status = source.status ?? model.status ?? source.s ?? [];
    const lengths = [x.length, p.length, w.length, r.length, f.length];
    if (!lengths.every(length => length === lengths[0]) || (status.length && status.length !== x.length)) throw new RangeError('history model arrays must have equal lengths');
    return { x, p, w, r, f, status };
  }
  function series({ metric, p = [], w = [], r = [], cumulative = false, status = [] }) {
    const raw = metric === 'profit' ? p : metric === 'rounds' ? r : r.map((rounds, index) => rounds ? w[index] / rounds * 100 : null);
    let running = metric === 'win' ? null : 0;
    return raw.map((value, index) => {
      const state = status[index] ?? (value === null ? 'no-rounds' : 'normal');
      if (state === 'future-uncovered') return null;
      if (!cumulative) return state === 'no-rounds' || value === null ? null : value;
      if (state === 'no-rounds' || value === null) return running;
      if (metric === 'win') {
        const roundsThrough = sum(r.slice(0, index + 1));
        running = roundsThrough ? sum(w.slice(0, index + 1)) / roundsThrough * 100 : null;
      } else running += value;
      return running;
    });
  }
  function scale(values, metric) {
    const valid = values.filter(value => value !== null);
    const rawMin = Math.min(...valid, 0), rawMax = Math.max(...valid, 0);
    if (metric === 'win') return { min: 0, max: 100, ticks: [100, 75, 50, 25, 0] };
    if (metric === 'rounds') { const step = Math.max(1, Math.ceil((rawMax - rawMin) / 4)); const top = step * 4; return { min: 0, max: top, ticks: [top, top - step, top - step * 2, top - step * 3, 0] }; }
    const min = Math.min(0, Math.floor(rawMin * 1.2 / 1000) * 1000), max = Math.max(1000, Math.ceil(rawMax * 1.2 / 1000) * 1000), step = (max - min) / 4;
    return { min, max, ticks: [max, max - step, max - step * 2, max - step * 3, min].map(value => Math.round(value * 10) / 10) };
  }
  function xAt(index, length, width = 1000) { return index / (length - 1 || 1) * width; }
  function y(value, min, max, height = 220, inset = 10) { return inset + ((max - value) / (max - min)) * (height - inset * 2); }
  function renderChartSvg({ values, metric, status = [], dimensions = { width: 1000, height: 220 } }) {
    const currentScale = scale(values, metric), groups = []; let group = [];
    values.forEach((value, index) => { if (value === null) { if (group.length) groups.push(group); group = []; } else group.push(`${xAt(index, values.length, dimensions.width)},${y(value, currentScale.min, currentScale.max, dimensions.height)}`); });
    if (group.length) groups.push(group);
    const polylines = groups.map(points => `<polyline points="${points.join(' ')}" fill="none" stroke="var(--blue,#6ca8ff)" stroke-width="3"/>`).join('');
    const marks = values.map((value, index) => { const rawX = xAt(index, values.length, dimensions.width), state = status[index], label = state === 'future-uncovered' ? '未来未覆盖' : state === 'no-rounds' || value === null ? '无回合' : ''; const edge = rawX < 24 ? 'start' : rawX > dimensions.width - 24 ? 'end' : 'middle'; const x = edge === 'start' ? 8 : edge === 'end' ? dimensions.width - 8 : rawX; return `${value === null ? '' : `<circle cx="${rawX}" cy="${y(value, currentScale.min, currentScale.max, dimensions.height)}" r="5" fill="var(--blue,#6ca8ff)"/>`}${label ? `<text x="${x}" y="205" text-anchor="${edge}" fill="var(--yellow,#ffc66d)" font-size="11">${label}</text>` : ''}`; }).join('');
    return { scale: currentScale, svg: polylines + marks };
  }
  root.HCR04_RENDER = { sum, normalizeModel, series, scale, xAt, y, renderChartSvg };
})(typeof window === 'undefined' ? globalThis : window);
