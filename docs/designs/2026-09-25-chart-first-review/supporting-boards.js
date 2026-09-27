(function (global) {
  'use strict';

  var css = `

  .supporting-kicker{font:12px ui-monospace,SFMono-Regular,monospace;letter-spacing:.08em;color:#9d8062;text-transform:uppercase}
  .supporting-title{font:28px/1.1 Georgia,serif;margin:6px 0;color:#1e2940}
  .supporting-intro{color:#687386;max-width:760px;margin:0 0 18px}
  .supporting-board .supporting-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
  .supporting-board .supporting-panel{position:relative;overflow:hidden;background:#fffaf1;border:1px solid #d9d4c8;border-radius:15px;box-shadow:0 14px 32px rgba(35,39,45,.1)}
  .supporting-panel h3{margin:0;font-size:16px;color:#1e2940}.supporting-panel .panel-copy{padding:15px 16px 13px}.supporting-panel .panel-copy p{margin:5px 0;color:#687386;font-size:12px}
  .supporting-panel .panel-stage{position:relative;margin:0 12px;height:300px;border-radius:10px;background:#101c31;overflow:hidden}
  .supporting-panel .panel-stage .chart{position:absolute;inset:0;width:100%;height:100%;min-height:0;display:block}
  .supporting-panel .panel-stage .float-card{position:absolute;z-index:2;right:13px;top:15px;width:132px;padding:10px;border:1px solid #e5c58f;border-radius:8px;background:#fff6e4;color:#1e2940;font-size:12px;box-shadow:0 7px 15px #06112766}
  .supporting-panel .panel-stage .float-card b{display:block;font-size:14px;color:#8a6430;margin:3px 0}.supporting-panel .panel-stage .float-card small{color:#687386}
  .supporting-panel .panel-stage .right-card{position:absolute;z-index:2;right:0;top:0;bottom:0;width:28%;padding:13px 10px;background:#172640ee;border-left:1px solid #53617b;color:#edf1f4;font-size:12px}.supporting-panel .right-card b{display:block;color:#f3c671;margin:4px 0 12px}.supporting-panel .right-card span{display:block;color:#91a0b6}
  .supporting-panel .panel-stage .bottom-成交表{position:absolute;z-index:2;left:0;right:0;bottom:0;height:25%;padding:7px 11px;background:#0c1729ee;border-top:1px solid #53617b;color:#dce5ef;display:grid;grid-template-columns:repeat(3,1fr);gap:7px;align-items:center;font-size:12px}.supporting-panel .bottom-成交表 div{border-left:2px solid #72c6c9;padding-left:7px}.supporting-panel .bottom-成交表 b{display:block;color:#f3c671;font-size:13px}
  .supporting-panel .panel-notes{padding:12px 16px 16px;font-size:12px;line-height:1.5}.supporting-panel .panel-notes strong{color:#567b68}.supporting-panel .panel-notes em{color:#9e685f;font-style:normal}.supporting-panel .panel-notes p{margin:3px 0}
  .supporting-board .supporting-legend{margin-top:17px;padding:14px 17px;border-left:3px solid #9db8a5;background:#f3ece0;border-radius:0 10px 10px 0;color:#515b63;font-size:12px}.supporting-legend ol{margin:7px 0 0;padding-left:20px}.supporting-legend li{margin:4px 0}
  .supporting-board .export-grid{display:grid;grid-template-columns:repeat(2,minmax(520px,1fr));gap:16px}.supporting-board .export-slide{position:relative;min-width:0;aspect-ratio:16/9;padding:15px;background:#101c31;border:1px solid #314560;border-radius:12px;color:#edf1f4;box-shadow:0 14px 32px rgba(16,28,49,.15)}.export-slide h3{font-size:14px;margin:0 0 9px;color:#f4f2e9}.export-slide .slide-meta{color:#91a0b6;font-size:12px;display:flex;justify-content:space-between;margin-bottom:7px}.export-slide .chart{display:block;width:100%;height:calc(100% - 42px);min-height:0;background:#101c31}.export-slide.table-slide{overflow:auto}.export-slide table{width:100%;border-collapse:collapse;font-size:12px;margin-top:9px}.export-slide th,.export-slide td{padding:7px 6px;border-bottom:1px solid #334962;text-align:left}.export-slide th{color:#9db8a5;font-weight:600}.export-slide td{color:#e8edf3}.export-slide .table-note{color:#91a0b6;font-size:12px;margin-top:11px;line-height:1.45}
  @media(max-width:1000px){.supporting-board .supporting-grid{grid-template-columns:1fr 1fr}.supporting-board .export-grid{grid-template-columns:1fr;}.supporting-board .export-slide{min-width:0}}
  @media(max-width:640px){.supporting-board .supporting-grid{grid-template-columns:1fr}.supporting-panel .panel-stage{height:280px}.supporting-board .export-slide{aspect-ratio:16/9}.supporting-board .export-grid{grid-template-columns:1fr}}
  `;

  function chartMarkup(reveal, aria) {
    return '<svg class="chart supporting-chart" data-reveal="' + reveal + '" viewBox="0 0 1120 560" role="img" aria-label="' + aria + '"><g class="chart-grid"></g><g class="series"></g><g class="annotations"></g></svg>';
  }

  function panelMarkup(letter, title, description, overlay, pros, cons) {
    return '<article class="supporting-panel"><div class="panel-copy"><span class="supporting-kicker">方案 ' + letter + '</span><h3>' + title + '</h3><p>' + description + '</p></div><div class="panel-stage">' + chartMarkup(60, title + ' D60 图表') + overlay + '</div><div class="panel-notes"><p><strong>优势：</strong>' + pros + '</p><p><em>取舍：</em>' + cons + '</p></div></article>';
  }

  function makeOverview() {
    return '<div class="supporting-kicker">01 / 布局探索 · 图表优先</div>' +
      '<h2 class="supporting-title">已确认 A：图表与阶段侧栏同屏。</h2>' +
      '<p class="supporting-intro">同一笔 DEMO-L 合成通道、同一 D60 截止点。A 为最终开发方案；B / C 仅保留设计取舍记录，不作为本期替代路线。</p>' +
      '<div class="supporting-grid">' +
      panelMarkup('A · 已确认', '图表 + 阶段侧栏', '侧栏作为工作区固定一列；主图和价格轴始终同时可见。', '<div class="right-card"><span>阶段 1 · 买入前计划</span><b>56 / 52 / 68</b><span>数量 1,000 · 风险 ¥4,000</span><span>可编辑，未含执行评价</span></div>', '图表与阶段输入同屏，价格上下文稳定。', '并排空间不足时侧栏下置折叠。') +
      panelMarkup('B', '图表 + 紧凑行内快改', '用价格轴旁的短指标条就地修改，保留图表宽度。', '<div class="float-card"><small>计划入场</small><b>56.00</b><small>止损 52 · 目标 68</small><small>计划 3.00R</small></div>', '少量字段可快速调整。', '不适合承载完整阶段表单。') +
      panelMarkup('C', '图表 + 临时底部成交表', '按事件顺序呈现实际动作，保留成交量区的呼吸空间。', '<div class="bottom-成交表"><div><b>D60</b>入场计划</div><div><b>3R</b>目标风险</div><div><b>—</b>后续未揭示</div></div>', '成交顺序与数量一眼可比。', '底部展开时会压缩成交量区域。') +
      '</div><div class="supporting-legend"><strong>评价依据</strong><ol><li>图表保持主视线，暂时信息不永久占用布局空间。</li><li>计划和评价分别进入对应阶段；价格轴与录入区分开，数字保留单位和分母。</li><li>这组三联图是设计取舍判断，不是用户研究或性能测量证据。</li></ol></div>';
  }

  function makeExport() {
    return '<div class="supporting-kicker">06 / 导出分镜 · 版式提案</div>' +
      '<h2 class="supporting-title">三张时间快照，一张可独立阅读的表。</h2>' +
      '<p class="supporting-intro">所有图表固定同一 x/y 映射：D01–D80、价格 36–76；每页只增加揭示窗口。这是设计分镜，不宣称已经生成 PPT 文件。</p>' +
      '<div class="export-grid">' +
      '<article class="export-slide"><div class="slide-meta"><span>01 · 入场判断</span><span>D60 截止</span></div>' + chartMarkup(60, 'D60 入场判断导出图') + '</article>' +
      '<article class="export-slide"><div class="slide-meta"><span>02 · 持仓过程</span><span>D69 截止</span></div>' + chartMarkup(69, 'D69 持仓过程导出图') + '</article>' +
      '<article class="export-slide"><div class="slide-meta"><span>03 · 事后复盘</span><span>D80 完整</span></div>' + chartMarkup(80, 'D80 事后复盘导出图') + '</article>' +
      '<article class="export-slide table-slide"><h3>04 · 计划 / 实际摘要</h3><table><thead><tr><th>项目</th><th>计划</th><th>实际 / 结果</th></tr></thead><tbody>' +
      '<tr><td>入场 / 数量</td><td>56 / 1,000</td><td>入场 56 / 1,000</td></tr><tr><td>止损 / 目标</td><td>52 / 68</td><td>计划风险 ¥4,000 · 3R</td></tr><tr><td>参考资金 / 仓位</td><td>¥200,000 / 28%</td><td>记录分母保留</td></tr><tr><td>退出</td><td>—</td><td>减仓 600 @64；平仓 400 @61</td></tr><tr><td>均价 / 费用</td><td>—</td><td>62.80 / ¥40</td></tr><tr><td>净 P&amp;L / 风险</td><td>—</td><td>¥6,760 / 1.69R</td></tr><tr><td>提前退出</td><td>按目标退出</td><td>是 · D68 风险收缩（用户评价）</td></tr><tr><td>目标实现</td><td>¥12,000（毛）</td><td>56.3%（净 / 毛）</td></tr>' +
      '</tbody></table><p class="table-note">行为标签仍属于用户判断：仓位 / 入场 / 退出 / 判断。没有自动因果结论。</p></article>' +
      '</div><div class="supporting-legend"><strong>分镜说明</strong><ol><li>页 1 / 2 / 3 是同一合成通道在 D60、D69、D80 的实际 SVG 图表。</li><li>页 4 保留数量、金额、资本分母、费用和 缺失状态，可离开图表独立阅读。</li><li>导出页沿用设计中的计划虚线、实际菱形和“复盘补记”来源语义。</li></ol></div>';
  }

  global.buildSupportingBoards = function (renderChart) {
    var overview = document.getElementById('overview');
    var exportBoard = document.getElementById('export');
    if (!overview || !exportBoard || typeof renderChart !== 'function') return false;
    var old = document.getElementById('supporting-board-style');
    if (old) old.remove();
    var style = document.createElement('style');
    style.id = 'supporting-board-style';
    style.textContent = css;
    document.head.appendChild(style);
    overview.classList.add('supporting-board');
    exportBoard.classList.add('supporting-board');
    overview.innerHTML = makeOverview();
    exportBoard.innerHTML = makeExport();
    Array.prototype.forEach.call(document.querySelectorAll('#overview .supporting-chart, #export .supporting-chart'), function (svg) {
      renderChart(svg);
    });
    return { overviewCharts: overview.querySelectorAll('.supporting-chart').length, exportCharts: exportBoard.querySelectorAll('.supporting-chart').length };
  };
})(window);
