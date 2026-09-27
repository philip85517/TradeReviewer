# R1 frame 独立审查

2026-09-26；gpt-6-astra / low。范围：`recall.css`、`trade-review-workspace.tsx` 和关联测试的 R1 frame 变更。结论：**scoped acceptance-failed：3 项可由 CSS 层叠确定的问题需修复；R1 整体仍未验收。** 未操作浏览器、未写数据库、未改产品代码、未运行全量测试。

## 依据及版本边界

已读 repair/PLAN.md、STATE-CONTRACT.md、DESIGN-COVERAGE.md、reports/R1-frame.md。CSS 对照 `repair/baseline/app/components/recall/recall.css`，修复新增从现文件413行开始；父工作区与测试同时核对实际 git diff 和实现报告，未将所有既有未提交修改归因本票。baseline 未包含 trade-review-workspace.test.tsx，测试归属以报告指出的 frame 测试/helper 为界。动态工作区正在集成，以下行号对应本次读取。

依据：元素规范第56–57、110–114行，E01/E19/E22；主规格102–109行。D02/04/05已于准备阶段实际查看。headerActions尚待state owner接入及临时cast移除是已知集成事项，不重复列为新发现。

## 发现

### F1 · P1 · 新的两列规则覆盖可用容器宽度断点

`app/components/recall/recall.css:630–636,673–681`。

旧规则347–354行在 `@container recall-work (max-width:1105px)` 下置表单并把趋势缩到220px。新增630行 `.recall-chart-and-plan.plan-open` 与旧348行同 specificity、声明更晚，所以重新设置两列；634行又明确侧栏 `grid-column:2`。新增673行仅在**浏览器视口**≤1105px补回单列。

因此1440px桌面展开应用导航、或展开Recall导航而可用工作区≤1105px时，容器断点仍将趋势变为220px，但两列被强制保留，侧栏继续占320px，违反根据可用空间转上下布局的既定合同，也破坏之前已工作的导航展开状态。不是待浏览器确认才存在的选择器歧义；层叠结果可直接确定。应在同一个有效容器断点内处理列数/侧栏grid位置，避免viewport条件覆盖。

修复验收：1440与1280的应用导航展开/收起及Recall导航展开，测工作区宽度、列数、轴与表单位置；确认不足640绘图区+轴+工具+14沟槽+侧栏时下置。需root真实浏览器补证，当前unverified。

### F2 · P2 · 新展开快照高度规则仍输给旧96px规则

`app/components/recall/recall.css:664–670` 对照393–397行。

旧选择器 `.recall-layout.nav-collapsed .recall-main > .recall-snapshot-panel` specificity 为(0,4,0)，1134px及以上容器生效且max-height为96px。新展开选择器 `.recall-main > .recall-snapshot-panel[open]` 仅(0,3,0)，即使位于后面也不能覆盖。因此实现报告“已覆盖旧高度”对导航收起的常见桌面路径不成立；阶段图仍陷入96px盒。应消除旧限制或以统一规则正确覆盖，而非再叠不生效的低优先级样式。

修复验收：1440桌面Recall导航收起后打开代表图及全部快照，记录computed max-height与实际client/scroll height；三图可读空间与主图/滚动可达性另作视觉判断。不能只断言CSS文本出现560px。

### F3 · P2 · 新统一高度将窄屏阶段按钮降回36px

`app/components/recall/recall.css:470–473` 对照281行附近的旧窄屏阶段规则及689–693行。

新增 `.recall-header .recall-phases button` 的min-height使用固定36px变量；其specificity高于旧≤900px和≤600px中的 `.recall-phases button { min-height:44px }`。末尾窄屏修正规则只列header action、header-controls按钮/select和snapshot summary，遗漏阶段按钮。结果窄屏阶段导航min-height恢复36px，违反触控命中至少44px。应纳入阶段按钮或在窄屏设置统一变量，并核对宽度命中区。

修复验收：390px三个阶段按钮computed height与实际命中框均≥44px，键盘焦点不被44px grid行裁切；只测底栏按钮不足以解除本项。

## 非阻断审查观察与剩余证据

- 外层顶栏/布局带在Recall主界面隐藏并把原处理器传入slot的方向符合E01；未发现本次新增数据库或原始成交写入。
- `recallFrameActive`在市场hydration之前即为true，加载状态会暂时隐藏返回/检查入口且还没有Recall header。建议补慢加载路径保证返回可达；本轮未将其升级为阻断缺陷，需确认产品预期。
- 当前新增frame测试证明DOM中无旧顶栏且按钮存在，未证明按钮属于Recall header、可点击返回/打开原对话框，也不能验证上述CSS。建议scoped行为用例补实际操作，视觉由root测量。
- 字段14px和间隔token集中化有助于一致性，但不能仅由新声明推断所有组件计算样式符合；退出/修订/代表选择、资金summary、关闭按钮的最终尺寸仍需逐项测量。
- storyboard与全部快照仍是两个独立details，紧凑入口收敛属于state/R3集成，需要按默认占高继续对照；本审查不把尚未完成的共享JSX当frame新缺陷。
- DESIGN-COVERAGE当前E01和US02仍仅标R3，与PLAN将初次frame移入R1不完全一致；协调者应加R1初次门槛与R3后续完整范围，避免证据归属遗漏。

## 分层结论

| 层 | 结论 |
| --- | --- |
| frame代码/规格审查 | fail，F1–F3待修 |
| frame行为自动化 | 未独立重跑；实现报告仅RED及lint，headerActions集成后需GREEN |
| 真实浏览器/同状态视觉 | unverified，按root指示未操作 |
| 回放状态/成交绘制 | 本次未审，不推出任何结论 |
| R1整体/feature | 未接受 |

修复后请提供actual diff、scoped GREEN及root尺寸/截图证据；Astra再复核CSS层叠及对应规格。保留本报告，不覆盖历史发现。
