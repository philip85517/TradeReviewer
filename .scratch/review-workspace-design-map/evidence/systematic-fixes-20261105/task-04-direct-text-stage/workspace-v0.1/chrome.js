(() => {
  'use strict';

  const iconHref = '../tradingview-alignment-v0.1/icons.svg#toolbar-icons';
  const tools = [
    ['GRIP', '工具条拖拽点（未实现）', 21], ['D01', '斐波那契回撤', 76], ['D02', 'Text（可演示）', 144],
    ['D03', '多头仓位', 212], ['D04', '空头仓位', 279], ['D05', '矩形', 345],
    ['D06', '箭头（待核名）', 411], ['D07', '趋势线', 479], ['D08', '位置标记', 546],
    ['D09', '位置标记', 613], ['D10', '旋转矩形', 681], ['D11', '多节点线（待核名）', 748],
    ['D12', '框内文字（待核名）', 814], ['D13', '水平射线', 884]
  ];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  const toolbar = ({ selected = '', placing = false } = {}) => `
    <div class="tv-toolbar ${placing ? 'is-placing' : ''}" role="toolbar" aria-label="图表绘图工具收藏条">
      <svg class="tv-toolbar-art" viewBox="0 0 916 68" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
        <use href="${iconHref}"></use>
      </svg>
      <div class="tv-toolbar-hotspots">
        ${tools.map(([id, label, x]) => {
          const enabled = id === 'D02';
          const active = selected === id;
          const title = enabled ? active ? placing ? 'Text 放置中 · 点击图表定位' : 'Text 编辑中 · 确认或取消后结束' : '点击后在图上定位 Text' : `${label} · 本轮未实现，仅保留候选槽位`;
          return `<button class="tv-hotspot ${selected === id ? 'is-selected' : ''} ${placing && enabled ? 'is-placing' : ''}"
            type="button" data-tool="${id}" data-toolbar-slot="${id}" aria-label="${esc(label)}"
            title="${esc(title)}" ${enabled ? `aria-pressed="${active}"` : 'disabled aria-disabled="true"'} style="--slot-x:${(x / 916 * 100).toFixed(4)}%"></button>`;
        }).join('')}
      </div>
    </div>`;

  const replay = ({ date = '2025-01-02', playing = false, speed = 1, hidden = false, status = '买入前 · 记录归属固定' } = {}) => `
    <div class="replay-bar chrome-replay ${hidden ? 'is-hidden' : ''}" data-chrome="replay" role="group" aria-label="回放控制栏" ${hidden ? 'aria-hidden="true"' : ''}>
      <div class="replay-label" role="status" aria-live="polite"><b>回放</b><small>${esc(status)}</small></div>
      <div class="replay-actions">
        <div class="replay-group replay-date-group">
          <button type="button" data-action="date" aria-label="选择日期"><svg class="replay-svg-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 9h18M16 14H8m0 0 3-3m-3 3 3 3"/></svg><span>${esc(date)}</span><span class="replay-chevron" aria-hidden="true">⌄</span></button>
        </div>
        <span class="replay-divider" aria-hidden="true"></span>
        <div class="replay-group replay-transport-group" role="group" aria-label="回放步进控制">
          <button type="button" data-action="play" aria-label="${playing ? '暂停' : '播放'}" class="replay-icon-button"><svg class="replay-svg-icon" viewBox="0 0 24 24" aria-hidden="true">${playing ? '<path d="M8 5v14M16 5v14"/>' : '<path d="m8 5 10 7-10 7z"/>'}</svg></button>
          <button type="button" data-action="step" aria-label="下一根" class="replay-icon-button"><svg class="replay-svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 5 8 7-8 7zM18 5v14"/></svg></button>
          <label class="speed-control"><span class="sr-only">播放速度</span><select data-speed aria-label="播放速度">${[0.5, 1, 2].map(value => `<option value="${value}" ${Number(speed) === value ? 'selected' : ''}>${value}x</option>`).join('')}</select></label>
          <button type="button" class="replay-unavailable" disabled aria-disabled="true" aria-label="候选槽‘天’；可能是图表周期或回放间隔，身份待核且未实现" title="候选槽：天；可能是图表周期或回放间隔，身份待核且未实现">天</button>
        </div>
        <div class="replay-group replay-candidate-group">
          <button type="button" class="replay-unavailable" disabled aria-disabled="true" aria-label="候选槽：可能是返回实时或其他回放功能；身份待核且未实现" title="候选槽：可能是返回实时或其他回放功能；身份待核且未实现"><svg class="replay-svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 5 9 7-9 7zM16 5v14M20 5v14"/></svg></button>
        </div>
        <span class="replay-divider" aria-hidden="true"></span>
        <div class="replay-group replay-project-group">
          <button type="button" data-action="next-node" aria-label="下一回放停点" aria-describedby="replay-next-stop-description" class="replay-next-node">下一回放停点 <span aria-hidden="true">→</span></button><span id="replay-next-stop-description" class="sr-only">跳转到下一个回放停点；第 33 根停在下一笔成交之前，之后停点在目标 K 线已揭示时到达；不会提前显示未来成交类型或价格。</span>
        </div>
      </div>
      <div class="replay-meta"><button type="button" data-action="hide-replay" aria-label="隐藏回放条"><svg class="replay-svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>
    </div>`;

  const review = ({ variant = 'A', scene = 'entry', hidden = false, replayHidden = false } = {}) => {
    const scenes = [['entry', '买入前'], ['holding', '持仓中'], ['exit', '结束之后']];
    if (hidden) return '<button type="button" data-action="show-review" class="review-restore-dock">恢复审阅条</button>';
    return `<div class="review-strip chrome-review" data-chrome="review">
      <div class="review-context"><span class="review-kicker">审阅</span><strong>结构 A</strong><span class="review-memory">内存刷新会重置本轮动作</span></div>
      <div class="review-controls">
      <label class="scene-control"><span class="sr-only">审阅场景</span><select data-scene aria-label="审阅场景">${scenes.map(([value, label]) => `<option value="${value}" ${scene === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      ${replayHidden ? '<button type="button" data-action="show-replay">恢复回放</button>' : ''}<button type="button" data-action="hide-review" aria-label="隐藏审阅条">隐藏</button></div>
    </div>`;
  };

  window.WorkspaceChrome = Object.freeze({ toolbar, replay, review });
})();
