# 完整 Workbench 下滑修复：独立源码与视觉审查

日期：2026-10-10。审查者：observe_scroll_diagnosis，未参与实现。范围：TR-VIS-05、DESIGN-COVERAGE S01–S04，保留用户已确认的 0.7 / Final4 视觉。结论：本轮限定修复 **PASS**，无待修复的范围内源码或视觉问题。

本审查直接阅读源码、冻结版本差异、原始测量及截图，并直接查看匹配视口的画面。浏览器原生滚轮、键盘和点击由协调者 root 执行；本审查没有操作浏览器，不将 root 的输入验证表述为审查者亲自输入。实现、实际输入、状态证据和视觉比较分别评价。

## 参考与根因

已阅读当前项目工作流、任务拆分与 UI 接受要求、`observe-regression-contract-20261009.md`、`full-restore-contract.md`、`homepage-style-reuse.md` 0.7、问题 05 和 S01–S04。首屏以本轮修复前的同状态图为直接对照，并对照前轮 `final4-complete-1440.jpg`、`final4-menu-bottom-390.jpg` 与确认的抽屉视觉。

桌面根因明确：`app/globals.css:44–47` 设置 body `overflow: hidden`；`app/page.tsx:32–35` 的完整预览直接返回 `FullWorkbenchPreview`，没有普通应用内部滚动容器。统一主题 `workbench-visual-theme.css:359–365` 让 `.running-prototype` 使用自然高度、`overflow: visible`。1280×720 实测文档高 1051，但滚轮及 End 后 `scrollY` 均为 0，页面下方信息不可达。原始失败证据保留。

≤1059px 已有全局媒体规则恢复 body `overflow: auto`（`globals.css:3654–3657`），因此 390 窄屏本来可滚动；此次窄屏属于保持验证，不能称为新修好的窄屏故障。

## 源码审查：PASS

相对本轮 `before-source.css`，唯一源码增量是 `full-workbench-preview.css:1–4`：

```css
body:has(.full-workbench-preview) {
  overflow-y: auto;
}
```

冻结内容之外的 CSS 字节不变。当前 CSS SHA-256 为 `9f98afeaf2bc4cc23dcaf5e08f8931f2fac4566f3f8cc5c75767934d592b9e6e`；修复前为 `a8922b03e0c413b2e4cf9e7c57ab3c7ed38b1da4bbc92138eaee9558113a9570`。`full-workbench-preview.tsx`、`workbench-visual-theme.css`、`running-prototype.tsx` 与前轮 `final-source` 冻结文件逐字节一致。

作用域由实际存在的预览容器限定；完整观察、结果、比较及原版主题都使用该容器，离开预览后不匹配。桌面 x 方向仍为 hidden；窄屏原有 auto 策略保留。没有增加 JS 滚动代理、wheel/touch 拦截、回放推进、fitContent、日期截止或数据库代码。菜单和抽屉的局部 overflow、尺寸、焦点处理原样保留；图表自身滚轮处理也未改变。

## 接受证据

以下证据均在 `/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/observe-scroll-20261010/`，文件名后的 JSON 是真实浏览器测量，JPG 是对应画面。

|范围|结果|证据与审查判断|
|---|---|---|
|S01 完整观察上下滚动|PASS（root 原生输入；独立核对记录）|`green-matrix.json`：1440×900 到底 213、1060×800 到底 257、1059×800 到底 257、390×844 到底 1296；均等于各自文档最大滚动量，Home=0、End=最大值、向上 wheel 返回 0。1280×720 的 `green-1280-wheel.json` 与 `green-1280-keyboard-up.json` 为 0→331→0。|
|S01 下方信息可见|PASS（直接看图）|`after-bottom-1280.jpg`、`after-bottom-390.jpg`：图表截止说明、持仓 A/B 数量与价格、现金和总资产、完整多行事件说明均可读；没有缩图或删除内容来规避高度。|
|S02 结果/比较/原版|PASS（root 输入记录及直接看图）|`after-results-top/bottom/document-bottom`：结果内部 0→468（1188−720），文档再到 106（826−720）；`after-compare-top/inner-bottom/document-bottom`：比较内部 0→577（1297−720），文档到 106。下方归因/成交和比较执行事件可见。`after-original-top/inner-bottom/document-bottom`：原版文档到 106，既有内部尺寸未改。|
|S02 离开预览|PASS（作用域源码与 root 测量）|`after-leave-original-create.json`：body `overflow: hidden`，文档/视口均高 720，完整预览容器已移除；规则没有残留到原创建页面。|
|S03 菜单局部滚动|PASS（root 输入记录及直接看图）|1280：`after-menu-bottom-1280` 菜单 scrollTop=53，window=0；390：`after-menu-visible-bottom-390` window=129.5，菜单内部到底 26，rect y323.5+h430=753.5，小于视口 844，最后“EMA 与现金配置组合四”及 ¥90,000 完整可见。|
|S03 抽屉局部滚动|PASS（root 输入记录及直接看图）|1280 抽屉 0→263，页面保持 331；390 抽屉 0→130，页面保持 1296。`after-drawer-top/bottom-{1280,390}`：原因、当时可知依据、计划/实际权重、A/B 成交价、费用估值说明和关闭操作可达，背景不因局部滚动移动。|
|S03 Escape、状态及恢复页面滚动|PASS（root 记录；视觉与源码辅助核对）|`menu-close.json` 关闭且回焦点“更多组合”；`green-after-menu-close.json` 页面随后可 0→331。`drawer-close.json` 关闭且回焦点原事件，日期仍为 2024-09-13、window=331。画面中 EMA20、净值类型、截至 9/13、总资产 ¥102,540.84 保持；状态和图表代码逐字节未改。|
|S04 首屏保真|PASS（独立直接比图）|匹配的 1440×900、1280×720、390×844 三组 before/after 均为 DPR1、同 fixture、同阶段、同图表范围、scrollY=0。标题、文字换行、金额、控件、间距、图表及侧栏布局未见变化。测量也显示匹配节点 rect 完全相同；1440 图表 874×360、1280 为 862.8125×320、390 为 348×280，均未压缩。|
|构建|PASS（root 执行；独立读日志）|root 报告新构建 exit 0；`reports/observe-scroll-build-20261010.txt` 记录 vinext Build complete。构建通过不替代上面各项浏览器与视觉接受。|

直接首屏对照文件：`before-top-1440.jpg ↔ after-top-1440.jpg`、`before-top-1280.jpg ↔ after-top-1280.jpg`、`before-390.jpg ↔ after-top-390.jpg`。这些匹配截图已由本审查者逐张打开，不依据总分或 DOM 断言代替视觉判断。下方和抽屉、菜单截图亦已逐张打开。

## 保留的失败与证据边界

- **FAIL（历史、已修复）**：修复前桌面原生 wheel / End 均停在 0；证据继续保留，不覆写为 PASS。
- **FAIL（探针断言，不是产品滚动失败）**：`green-results-wheel.json` 原始 `pass:false` 仍保留。其断言要求 document 变化，但输入实际落在结果内部滚动区，文档保持 0；`after-results-bottom.json` 证明内部到 468，后续 header 区域输入与 `after-results-document-bottom.json` 证明文档到 106。不能把该原始布尔值改写，也不能以它推断结果页不能下滑。
- **NOT VERIFIED（旧截屏的完整可见性）**：`after-menu-bottom-390.jpg` 的 window=3，菜单底到 880，超出 844 视口，单凭该图不能声称最后选项 ¥90,000 完整可见。root 补充页面空白边缘原生滚轮和菜单内部滚轮，形成 `after-menu-visible-bottom-390`；补充图已直接核对，完整可见性现为 PASS。两份证据均保留。
- **NOT VERIFIED**：物理触屏及 emulated touch 本轮没有证据，不冒充原生鼠标/键盘验证。跨浏览器、操作系统常驻滚动条配置亦未扩展验证。
- **NOT APPLICABLE**：本轮只改纯合成内存预览的 CSS，不涉及写入、返回重载的持久化流；数据库接受不适用。未改的全量回放、历史分析和 Tooltip 内容继续沿用前轮记录，本轮不声称重新完成这些接受。

本结论仅接受本轮滚动修复和 S01–S04。未发现修改字号、图高、密度、层级或状态的偏离，也未发现新的范围内视觉问题；不替代协调者对整项 UI 交付、预览服务存活及项目记录的最终接受。
