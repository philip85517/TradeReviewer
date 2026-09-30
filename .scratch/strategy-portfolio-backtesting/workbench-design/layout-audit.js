// Opt-in, read-only layout evidence for the standalone prototype; no application state access.
(() => {
  if (new URLSearchParams(location.search).get('audit') !== '1') return;
  const selectors = ['.topbar','.identity','.summary','.design-strip','.workspace','.plot','.replay','.inspect'];
  const report = document.createElement('output');
  report.id = 'layoutAuditReport';
  report.style.cssText = 'position:fixed;bottom:0;left:0;z-index:9999;max-width:100%;background:#08101b;color:#fff;font:10px monospace;pointer-events:none';
  document.body.append(report);
  let baseline, frames = 0, maxShift = 0, violations = 0, maxOverflow = 0;
  const visited = new Set();
  function measure() {
    const boxes = selectors.map(selector => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return [r.x,r.y,r.width,r.height];
    });
    baseline ||= boxes;
    const delta = Math.max(...boxes.flatMap((box,i) => box.map((n,j) => Math.abs(n-baseline[i][j]))));
    maxShift = Math.max(maxShift,delta);
    if (delta > 1) violations++;
    maxOverflow = Math.max(maxOverflow,document.documentElement.scrollWidth-innerWidth,document.documentElement.scrollHeight-innerHeight);
    visited.add(document.querySelector('[data-view][aria-selected="true"]')?.textContent + ' / ' + document.querySelector('#scenarioSelect').value + ' / ' + document.querySelector('#inspectTitle').textContent);
    frames++;
    report.textContent = JSON.stringify({frames,maxShift,violations,maxOverflow,viewport:[innerWidth,innerHeight],visited:[...visited]});
    requestAnimationFrame(measure);
  }
  requestAnimationFrame(measure);
})();
