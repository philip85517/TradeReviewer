# 完整观察统一版 · 回归修复契约

2026-10-09；用户要求严格 review 并调整。用户已授权独立完成普通测量与可逆样板，不需再次批准候选参数。只修复当前完整观察及共享预览导览的回归，不推广生产、不修改另一个首页工作树、不提交远端。root 为整页视觉及完整状态/数据流 owner。

## 精确参考与比较条件

- 项目开发流程、分解标准、UI 接受模板及 issue tracker；DD05–DD09：`docs/specs/2026-09-29-strategy-desktop-ux-design.md:175–243`，WD06–07：`docs/specs/2026-09-30-strategy-stable-workbench-design.md:166–178`。
- 当前首页候选 `0ff3/TradeReview/docs/design-system/TradeReview-首页拉齐-v0.2.md` 与当前真实参考截图，见既有 `style-unification-contract-20261009.md`；复用角色与 token，不迁移首页网格。
- 当前新鲜失败截图及 DOM/computed：`evidence/observe-regression-20261009/before-complete-{1440,1280,760,601,390}.{jpg,json,txt}`，菜单、事件抽屉、持仓选中同目录。旧验收证据保留；本次中间断点的 FAIL 推翻有关完整响应式已接受的结论。
- 同 complete/EMA20/2024-09-13/净值、相同合成数据与 chart range，1440×900、1280×800、760×800、601×800、390×844，DPR1。复测另覆盖 320、600、759、980、981、1023、1024；按实际实现断点增补两侧。selected、focus、菜单、抽屉另存状态图。

## 授权的具体修复

1. R01/E01 E12：导览紧凑单行，较窄可局部横滚；场景/视觉比较与完整说明放入可展开的原生 details，默认关闭，summary 明示当前场景/样式/合成演示。保留所有入口、原文、参数、刷新语义；业务合成数据提示继续可见。只折叠预览工具，不折叠业务判断或价格。
2. R02/E01 E04 E05：观察页采用自然文档高度，不使用预览条下面额外 100dvh 的内层页面滚动；各业务区不可 flex 压缩。进度恢复与主体共享 max-width1240/外边距。保留图表原高度，不靠缩小图表换首屏。
3. R03/E02 E03 E06：顶部四核心 KPI 保留24/32/500；持仓明细市值、现金、净值与重复总资产使用14/22/500，完整数字/中文名称/数量。模块18/26/600，正文14/22，辅助12/18。主次按任务角色决定，不把所有金额都放大。不改盈亏配置，实际已测 positive 为 #26a69a，疑似被覆盖的源码判断不成立。
4. R04/E01–E07：用同一窄窗边界处理观察 header/timebar/grid/control，不再出现600与759断层。可将图表与侧栏在≤1023顺序叠放，维持图表优先；≥1024保留旧图表+320侧栏。此值是候选，根据真实图表可用宽度校准。窄控件最小44高、独立图标44×44；桌面36高/36×36。
5. R05/E02：所有宽度重要 KPI 与价格禁止 ellipsis、hidden 裁切。空间不足自然换行，≤1023两列，≤359单列。不得删掉收益百分比或改短固定金额。
6. R06/E04 E06 E07 E12：恢复区显式继承正确中文 fallback 链与14/22；组合名/菜单标题14/22、辅助12/18；抽屉正文/成交主字段14/22，辅助12/18。消除现有13px、10px偶然覆盖。例外仅真实图表轴12及预览辅助12。
7. R07/E05 E06 E07：持仓选中真实四边1px selected border（#3797ff）+底景，保留可见焦点2px/offset2；箭头/关闭采用现有Lucide18/stroke1.75，点击框36²/44²，不全局套图表SVG。菜单、选中、focus、disabled独立验证。
8. R08/E04 E05 E07 E08：不修改运行模型、回放 cutoff、事件、金额、状态机、保存链、chart init/effects/range。样式切换不重挂；真实T0→下一日揭示bar/成交、运行播放、来源返回、关闭抽屉、长菜单必须复验；共享导览需检查结果/比较桌面与390。

## 分工与接受门槛

### 第一批 final 实际视觉 FAIL 后的有界补充（实现前）

保留 `final-complete-*` 第一批证据，不覆盖。独立审查在 759px / 390–320px 看图发现新 FAIL；原 R01–R08 源码 PASS 不代表整页接受。

9. R09/E01 E04 E05：759px 现有 chart y951 对比760px y598，1px宽差产生353px位移。取消 unified header/timebar/chart-heading 与共享预览 context 在759整批强制列排；按组件真实内容容量自然换行，保持DOM顺序、完整文案、44px窄点击框及既有图高。760/759 图表位置差应≤60px，601/600不得重叠，390/320仍全内容可达。不得用缩小文字/图表实现。≥1024侧栏320px契约按真实CSS复核；必要时 scoped override 修正旧296px覆盖。
10. R10/E05 E07：第一批 `final-complete-{390,360,359,320}-full.jpg` 中重复“再平衡”在图上碰撞。授权仅调整 unified 图表 marker **文字呈现**：保留每个事件日期、点/箭头、颜色、完整事件详情及截止数据；按实际时间坐标和文字宽度保留不碰撞的完整类型标签，最新/当前事件优先。其他重复类型文字可由密度规则省去，所有事件点与完整侧栏/抽屉仍可定位阅读；不得省略价格或判断。原版保持原标记。因窗口缩放与图表视野变化需要刷新文字，R08允许复用既有 annotation/range/resize 回调更新 marker 呈现，除此之外禁止改变init、mode切换、viewport恢复、数据切片、逻辑范围、状态机、业务handlers与保存链。主题切换不重挂、不fit。320/390净值与K线、T0→下一日、播放、主题切换保留日期/范围及来源返回分别复验；独立审查必须直接看图验证标签不碰撞。可新增纯标签几何helper及边界测试，由同一Luna独占；若不新增则仍四文件。

实现owner仍Luna；root整页及状态责任；独立审查者按同数据同范围比较第一批FAIL与final2新截图。任何未解决FAIL阻止本票完成。

唯一实现：Luna `gpt-5.6-luna`，high。允许修改四文件：`full-workbench-preview.tsx`、`.css`、`workbench-visual-theme.css`（观察 scope 与共享合法字体角色；禁止扩大结果/比较布局）、`running-prototype.tsx`（仅图标呈现与辅助class，不改handlers/state/data）。报告 `reports/observe-regression-implementation-20261009.md`。root 独立运行 typecheck、scope lint、相关现有模型测试；浏览器新鲜截图/computed与实际旅程。独立 visual reviewer 直接看前后图，未参与实现。功能/状态/视觉分别接受；任何 in-scope FAIL 或必验 NOT VERIFIED 阻止本票完成。

物理触摸、Windows逐字实际字体、完整 Tooltip/wheel 前视审计、生产SQL写链、其他原型/生产全局推广不在此回归修复范围，保留原 NOT VERIFIED，不以本票 PASS 覆盖。

## 执行顺序

- [x] root 新鲜复现并保存源码/图片/测量；两个只读独立审查。
- [x] reopening 04、coverage、README 和既有接受记录同步；实现前冻结本合同。
- [x] Luna按R01–R11有界修复；root复核源码与真实净值/K线逐日旅程。
- [x] 18档断点、代表状态、实际声明字体/尺寸/代表对比度、长内容及共享工具复验；逐字字体保留NV。
- [x] 独立直接看图复验关闭V01–V11；最终源码和图像清单冻结，活预览实查且服务保持运行。

## Final3 浮层回归补充（实现前）

11. R11/E06：root 真实 final3-more-menu-390.jpg / JSON 发现菜单 x=-260.57、宽366，仅右侧105px可見；由 R09 更多组合容器 width:auto 且落到左侧独行、原绝对定位 right:0 仍锚按钮导致。仅授权 unified≤759 菜单与定位容器 CSS 修正，以整个 portfolio-selector 可用宽度为锚，菜单完整落在当前 viewport/侧边距内，保留文案、原 width/max-height、滚动/handler/焦点行为。实现同一 Luna、仅 theme CSS；root 必验320/390/601/759与760/1280，长名称选择、末项键盘滚动、Escape回焦点；独立直接看图。保留 final3 失败，新的 final4-menu 状态不覆盖。主矩阵/真实旅程 CSS 不受影响可复用 final3，限定 diff/源码重新确认。
