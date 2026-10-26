# 首轮独立验收 FAIL
2026-10-24，root 未编辑 UI 实现。真实浏览器 1440×1000 DPR1。
证据 screenshots/first-failed-1440.png，first-failed.html（实现者保留）。
- E06：实盘主区也为 #111E2C、卡片 #162332。根因模拟盘 CSS 未限定模式。
- E01：第二行 y42 被64px页头遮挡，模式控件 y48.5；页签被推到右侧。根因旧 margin:-22px 与新 padding-top:0 叠加、后置 margin-left:auto。
- E03：费用解释仍常驻；实盘错误出现最差练习回撤，模拟会重复；opacity 隐藏仍暴露 tooltip，缺原型说明。根因在旧正文之前插入而非替换。
- E04：侧栏非指定参考图标/尺寸/节奏。
- E07：全部 KPI 白色，positive/negative 样式没有接到节点。
- E08：按钮标签无依据改成长名称，旧隐藏比较器残留。
以上均交回 e_refine_impl 修复；新版本需独立复验。此记录不被最终 PASS 覆盖。
