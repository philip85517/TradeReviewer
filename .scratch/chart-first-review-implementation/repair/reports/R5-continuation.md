# R5 续验记录（2026-09-26）

协调者使用 3049 生产预览和 `repair/acceptance.sqlite` 合成库；当前构建记录为 `R5-build-latest.txt`（20:44）。后续修复必须重新构建再验收。整体仍未接受。

## 已实际补验

- 999992 进入事后：净盈亏、实际 R 均为“费用待补齐”，分母仍明确 4000 CNY；无伪造零费用。截图 `R5-unknown-fees-1440.png`。
- 焦点位于关闭侧栏按钮时按 Esc：侧栏 `isVisible=false`，入口 `aria-expanded=false`，`document.activeElement` 为文字“计划侧栏”的 BUTTON。E09 焦点返回通过。
- 999992 pre、侧栏关闭：T 后点击图表右下 (1310,745)，字号 32、保存宽度 36，录入三行中文。编辑器宽度独立为 220，但右界 1423 越过实际绘图区右界 1341，遮盖价格轴；116px 高的 shell 滚动后样式栏离开可见区。`R5-text-edge-editor-1440.png`，E08 仍失败。Esc 已取消本次草稿，未提交新图形。
- 手动价格轴调整后，999992 连续两次下一决策到 8/14 减仓：目标 64 卖出完整可见，持仓 400，不含 8/20 最终退出，`R5-manual-price-before.png` / `R5-manual-price-after.png`。实际留存 `R5-stored-manual-window.png` 保持双截止和持仓，但 capture 的文字未采用 live 的 pane 右界，进入价格轴；E05/E07 捕获仍失败，已交 chart owner。
- 新增一笔仅在隔离库的 999990 合成首买 30 元，原 24 条逐字段不变，见 `R5-low-price-fixture.json`。fresh pre → 下一决策，价格轴从已知 50–56 区域扩至容纳 30 元，菱形可见；`R5-low-price-before.png` / `R5-low-price-after.png`。右端“买入”文字与黄色成本标签相交，Astra 确认 E07 文字不完整，交同一 owner。
- 999996 More → 三阶段代表图，选 pre 决策1 / holding 决策2 / post 决策3；选择未改变 post 阶段、行情截止9/24和成交截止8/20。`R5-storyboard-1440.png`。但后续“全部记录与快照（6）”入口 top=1071.5 超出900视口，点击失败；replay-bar height551/scrollHeight866，More body705.5且overflow visible，祖先main/layout overflow clip、body hidden。E22 可达性失败，交 workspace owner 完成当前修复后处理 CSS；不能以代表图渲染成功宣称完整体验通过。
- 999996 工作版本隔离测试：手动把回合标签“仓位”改成“判断”，Text `drawing-1790426380329-3t0cx` 改为“理性复盘 B：这是未留存的工作修改。\n已有 A 快照与其仓位标签必须保持不变。”，Ctrl+Enter，只自动保存草稿，不留存。Astra 将只读核对旧 A bundle/图文/标签与工作 B 的独立性。最终表按规格§4取已留存全局版本；旧错误全局并不冒充有效 A 总结，需修复后再次正式留存并做后续草稿隔离。

## 仍需收口

1. 完成操作从决策/全局入口统一保留完整历史、post-review 和人工证据，保存后重开保持一致；旧错误 bundle 和截图保留，不覆盖。
2. 窄屏/桌面标题与导出按钮布局，三阶段区域、长内容和价格轴尺寸实测。
3. Text 编辑器使用真实 plot bounds，32px/36px 及窄屏不遮轴。
4. 代表图选择、A 留存/B 工作草稿隔离、真实新 PPTX 下载与逐页渲染。
5. 受影响自动化、最终 type/build/runtime、匹配状态视觉、数据完整性和运行中预览交付。

真实手机软件键盘仍 unverified，没有用户批准豁免。历史 2406 项单测通过、三个失败文件后续 66+76 项复验通过并不替代以上项目；保留各次原始日志。
