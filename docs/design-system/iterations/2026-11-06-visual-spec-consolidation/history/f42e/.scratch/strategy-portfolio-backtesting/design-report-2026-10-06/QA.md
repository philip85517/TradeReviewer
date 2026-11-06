# 策略工作台设计评审报告验收

- 范围：设计咨询报告，未修改 UI、业务数据、既有任务验收记录或 Git 集成状态。
- 最终交付：策略工作台设计评审.docx，6 页。
- 内容：8 条建议（5 条 P1、3 条 P2）；独立内容复核通过，来源路径修正并实际存在。
- 模板：保留原页式、两节结构、字体包、样式、编号、图片、关系、页脚、字段与 rich SDT。中文 edited runs 仅设置 Heiti SC eastAsia；修复原 TOC 超出可打印宽度的 tab stop。
- 视觉：协调者逐页查看 qa-03/b_render/page-1.png 至 page-6.png 的原始尺寸。中文、标题、表格、灰色 callout、页眉页脚均可读，无裁切或重叠；目录页码与正文 2/3/4/5 一致。
- 结构：final-structural-audit.json PASS；仅 document.xml、header1.xml、settings.xml 改动。原始模板 SHA 完整。原型 build.py/index.html SHA 与评审前一致。
- 前序失败保留：qa-01 中文缺字；qa-02 多出短尾页导致目录页码不符。最终 qa-03 修正后通过。
- 字体根因：bundled headless LibreOffice 缺省不能加载 fontconfig；只为 QA 进程指定 bundled Contents/Resources/fontconfig/fonts.conf 后，三个受控字体样本及中文页眉恢复。未改系统或托管运行时，未安装字体。
- 字段：Word 实时刷新未验证；updateFields=true，缓存 TOC 通过最新 render 检查。
- 业务状态：真实保存、锁定、防重复提交、刷新重开、完整事件返回仍为 NOT VERIFIED。本报告不改变原功能验收状态。
