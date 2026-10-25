# 用户决策落地独立验收

日期：2026-10-24。审查者：revision10_acceptance（未参与实现）。触发：用户批准 B 紧凑排列与“最差练习回撤”后的静态设计交付复验。依据 development-workflow.md、frontend-control-audit.md、ui-task-templates.md、ACCEPTANCE-SCOPE.md、REVISION-10-PLAN Tasks 5/6 及两项 brief。

## 结论与边界

当前静态设计交付：PASS。37/37 变动 SVG 已逐张直接查看真实浏览器完整截图，05 加载态首次 FAIL 经修复重拍后 PASS。原型与阅读器消费证据支持本轮受影响功能；没有把静态图中的按钮当作业务功能实现。

本轮浏览器由 root 操作及截图，独立审查者逐图视觉对照、阅读操作记录、审读差异并独立执行文件哈希与测试。审查者 CUA 无可用浏览器 surface，未声称本人直接操作浏览器；该证据分工经协调者明确确认。截图和 AX 记录的角色分开：截图用于视觉结论，实际操作/状态转换用于功能结论。

生产应用、实际权益计算引擎、业务数据库写入/持久化、物理触摸和设备触控不在本轮静态交付范围，NOT APPLICABLE。当前 fixture 缺少逐时权益，数值展示应为“— / 暂不可计算”；真实数值计算能力 NOT VERIFIED，不得据本报告声称已实现生产回撤功能。此前待用户选择的布局与回撤语义已获用户确认，不再作为未决项。

## 版本绑定

- 正文 source fingerprint：`b236d66415148decf65eba0075cd9b8d70d91a3916b9f032207274c80dbd9672`
- 完整内容 content fingerprint：`8cc354c2add118c7e6c45b1a2dd037b5803e440fb73f379c512ea90700f1ea33`
- `review-package.json`：54 个 files + 4 个 reader_runtime_files，审查者重新计算 SHA-256，58/58 匹配。
- 40 张阅读器引用图，其中 36 张改变；额外 `journeys-library-list-return-1280.svg` 明确纳入 extra_acceptance_frames，变动视觉验收分母为 37。
- 旧阶段报告保留于 `../revision-10-repair/INDEPENDENT-ACCEPTANCE.md`，此前 FAIL、R19/R20 修复与阶段限制不被本报告覆盖删除。本轮前版见 `before/`。
- 05 修复前内容指纹 `c30e6c524630e57b72cbe2cc412bcf09e95088cda3e60a399b8b5d460af55faf`；最终图与初次失败图分别保存，不能用失败图证明最终版本。

## 分门验收

| 门槛 | 结果 | 依据与适用范围 |
|---|---|---|
| Spec | PASS | 用户已选 B；全套图共享模式在上、标题左/摘要与下划线 Tab 右同排；回撤按保存日期选择练习，各练习独立完整权益路径取 MDD，再取最大值；完整/部分/空/真零规则明确。 |
| 质量 | PASS | 58 文件哈希一致；独立执行 metrics 5 tests、homepage 5 tests 均成功；git diff --check 无输出；无无用权益 helper；不以这些测试替代视觉。 |
| 功能（静态交付） | PASS | 原型默认 B，方案/模式/日期/单位/状态切换的真实 root 操作记录；阅读器当前正文和图稿消费及评论关联正确。业务计算与持久化不在范围。 |
| 交互（受影响原型/阅读器） | PASS，证据角色见表 | root 实际执行，本人审阅 AX 与截图；未变化的全套控件复验沿用上一轮，不宣称本轮重新执行 24 组合。 |
| 视觉 | PASS | 37 张变动图逐帧直接查看；1440 与 1280，列表/统计/回合集/复盘/长标题/返回焦点、完整下方趋势与分布均覆盖；原型完整长页与阅读器截图另验。 |

## 设计与语义审查

B 对照为用户选中的 `../revision-10-repair/root-final-nav-B-1440.png` 及已批准的共享视觉要求。最终模式位于标题之上；标题/副标题左对齐，已应用条件与下划线列表/统计标签同排靠右。摘要保持自然字宽，未以 textLength 压扁；长标题和 1280 边界未与摘要、Tab 碰撞。72px 侧栏、64px 顶栏、96px 内容左缘及 24px 右边距保持。下游卡片、表格、趋势、分布随页头和风险带变化同步移动，风险带到费用说明有 24px 间距。

正文 `source/visual-design.candidate.md:161–167`：选择当前模拟筛选和保存日期下的练习，各练习使用包含初始权益、持仓估值与费用的完整有序轨迹；初始权益为正，估值/费用一致；peak=max(E0…Et)，DD=(peak−E)/peak，单练习取最大，再对练习取最大。缺少路径/初始值/估值或有未调整外部现金流则不可用。全部有效才展示数值，部分有效“— · 可计算 N/M 练习”，空为“— / 无练习”，真实有效零为“0.00%”。独立核对 100→120→90 为 25%，100→110→99 为 10%，汇总 25%，第二条缺失则 — / 1/2。没有把净盈亏趋势当权益路径。

图稿 02、trend-gap、trend-single 的风险带直接可见短定义与缺失说明；原型完整分行说明可读，空状态 — / 无练习。有效数值与部分覆盖是本轮已明确的设计契约，fixture 未提供权益路径，未虚构数值演示或引入生产引擎。

## 控制与旅程覆盖

操作人为 root；审查人为本报告作者。`prototype-operations.json` 记录本轮 15 步，`reader-operations.json` 记录本轮 C08/C07/C09。鼠标与键盘证据分别说明，未将 AX 节点存在视为点击成功。

| 控制/旅程 | 本轮证据与判断 | 结果 |
|---|---|---|
| 原型 fresh 默认 B | ROOT-ACCEPTANCE.md 的 fresh open；B 1440/1280 截图与源码默认项一致 | PASS |
| A/C/B 方案切换 | prototype-operations：各选中值与当前方案文案改变；A/C 为比较保留项 | PASS |
| B 方案键盘选择 | root 记录 A→Tab→Space 选 B；未声明方案组 Arrow 键行为 | PASS |
| 实盘/模拟盘模式 | keyboard mode right 导致实盘列表→模拟统计，标题、条件、指标与账户语义同步，restore live date 恢复实盘条件 | PASS |
| 列表/统计 Tab | keyboard-page-proof.json：fresh B 明确列表选中→ArrowRight 统计选中→ArrowLeft 列表选中；标题/日期口径和内容同步转换。此前 no-change AX 不用作转换依据 | PASS |
| 日期范围与视角记忆 | live date expanded→模拟→restore live date，实盘仍为扩展范围，模拟使用独立保存日期 | PASS |
| 收益率/金额 | amount distribution 显示金额已选、收益率未选，五桶改为 100 边界且频数变为 1/1/0/1/4 | PASS |
| loading/empty/error/normal | 实际状态下拉操作，loading 删除结果；empty —/无练习；error 保留条件；normal 恢复模拟统计 | PASS |
| 风险与下方完整内容 | root-prototype-B-sim-stats-{1440,1280}-full.png 直接视觉复核，完整说明、趋势、分布可读 | PASS |
| 阅读器 B/回撤正文消费 | root-reader-BT02.png、reader-operations 中公式/coverage/算例；两表未被正文打断 | PASS |
| C07/C08/C09 定位 | reader-operations.json 显示当前整图关联及原图历史入口；root-reader-C08.png 当前新 B 图完整嵌入 | PASS |
| 阅读器其他既有控件/首页 C10 | 当前 runtime 哈希不变，沿用此前 reader/首页原尺寸/1280 接受记录；本轮不重复全阅读器操作 | 继承 PASS |
| 静态图日期/搜索/刷新/分页/行入口/返回 | 逐帧仅验外观、条件文本、焦点和恢复态，不宣称实际业务点击或保存 | 视觉 PASS；业务功能 N/A |
| 触控、真实业务保存与重新加载 | 无本轮授权/实现范围，不借原型推断 | N/A |

## 失败历史与修复复验

| 记录 | 首次结论 | 最终复验 |
|---|---|---|
| F01 | 风险短定义缺失；未被消费者使用的 helper 对 0/负权益及 NaN 边界错误 | 删除无关 helper；正文契约补全，图稿短定义直接可见。PASS |
| F02 | tabs 独立一行不符 B；后续摘要碰撞；再后续 textLength 压扁文字，连续 FAIL | 自然字宽槽位重排；所有 37 帧及 1280 实际截图 PASS，旧失败截图保留 |
| F03 | 风险带加高但下游未推进，卡间距仅 6px | 风险带后推进 110px，最终图显示 24px 间距。PASS |
| F04 | 原型未说明全部有效、部分覆盖、空练习 | 分行正文与空态补全，1440/1280 完整截图 PASS |
| F05 | 05 首次加载仍显示真实净盈亏曲线/金额/日期，状态与骨架不一致。原 generator trend 调用位置约 526 行 | 最终 `generate-library-frames.py:528–529` loading 传空点；直接看最终 05 图，只保留加载网格与“正在加载…”。PASS。原证据 `05-loading-FAIL.png` 保留 |
| 包范围遗漏 | 额外 1280 返回图最初未入包，无法把已有检查绑定最终版本 | 纳入 files/extra_acceptance_frames，真实 1280×800 截图独立复验 PASS；最终分母 37 |
| ENV01 | 旧 3090 服务挂起 | root 重启任务服务，真实浏览器恢复；不归类产品控件问题 |

## 逐帧视觉覆盖与最终指纹

每行均直接打开 `frames/<文件名>.png` 查看完整图，非仅 DOM、自动尺寸检查或拼接缩略图。截图操作者 root，独立视觉审查者 revision10_acceptance。除明确 1280 图为 1280×800 外，真实浏览器视口为 1440×900；fullPage 保留自然增长的完整画布。视口记录见 capture-results.json；额外 1280 图由 root 补采并纳入正式包。

| SVG / 截图链接 | 视口 | SVG SHA-256（前 12 位；完整值见包） | 独立视觉结论 |
|---|---|---|---|
| [01-live-normal.svg](frames/01-live-normal.svg.png) | 1440×900 | `bbe16e1906f3` | PASS |
| [02-simulation-normal.svg](frames/02-simulation-normal.svg.png) | 1440×900 | `9ff404337977` | PASS |
| [03-distribution-selected.svg](frames/03-distribution-selected.svg.png) | 1440×900 | `5f51e50773f0` | PASS |
| [04-return.svg](frames/04-return.svg.png) | 1440×900 | `43654cc3a4b4` | PASS |
| [05-loading.svg](frames/05-loading.svg.png) | 1440×900 | `8efb3d208751` | PASS（F05 修复复验） |
| [06-empty.svg](frames/06-empty.svg.png) | 1440×900 | `d1ba2724938c` | PASS |
| [07-error.svg](frames/07-error.svg.png) | 1440×900 | `3b1c1d601f04` | PASS |
| [08-extreme.svg](frames/08-extreme.svg.png) | 1440×900 | `a7789ce2babd` | PASS |
| [09-missing-input.svg](frames/09-missing-input.svg.png) | 1440×900 | `7ed7e1d73ca3` | PASS |
| [distribution-amount.svg](frames/distribution-amount.svg.png) | 1440×900 | `a70bb5cdf89d` | PASS |
| [hcr06-final-pending-library-1280.svg](frames/hcr06-final-pending-library-1280.svg.png) | 1280×800 | `fc8f9848a942` | PASS |
| [hcr06-final-pending-library.svg](frames/hcr06-final-pending-library.svg.png) | 1440×900 | `dd76955b2e27` | PASS |
| [hcr06-final-replay-a1.svg](frames/hcr06-final-replay-a1.svg.png) | 1440×900 | `57673b97cf41` | PASS |
| [hcr06-final-replay-a2.svg](frames/hcr06-final-replay-a2.svg.png) | 1440×900 | `ffa8b0076292` | PASS |
| [hcr06-final-replay-b1.svg](frames/hcr06-final-replay-b1.svg.png) | 1440×900 | `edc8fe847b18` | PASS |
| [hcr06-final-return.svg](frames/hcr06-final-return.svg.png) | 1440×900 | `43654cc3a4b4` | PASS |
| [hcr06-final-rounds-a.svg](frames/hcr06-final-rounds-a.svg.png) | 1440×900 | `47c222f17a47` | PASS |
| [hcr06-final-sim-ab.svg](frames/hcr06-final-sim-ab.svg.png) | 1440×900 | `e8ff4afd6ddf` | PASS |
| [journeys-date-1280.svg](frames/journeys-date-1280.svg.png) | 1280×800 | `9b874238b2a1` | PASS |
| [journeys-date-month.svg](frames/journeys-date-month.svg.png) | 1440×900 | `5dc49295837d` | PASS |
| [journeys-date.svg](frames/journeys-date.svg.png) | 1440×900 | `50073744ee94` | PASS |
| [journeys-library-list-return-1280.svg](frames/journeys-library-list-return-1280.svg.png) | 1280×800 | `ed5370f65683` | PASS |
| [journeys-library-list-return.svg](frames/journeys-library-list-return.svg.png) | 1440×900 | `0df9c20b7eea` | PASS |
| [journeys-library-list.svg](frames/journeys-library-list.svg.png) | 1440×900 | `0a5f49e1ace2` | PASS |
| [journeys-library-replay.svg](frames/journeys-library-replay.svg.png) | 1440×900 | `e275630c1b0a` | PASS |
| [journeys-live-rounds-return.svg](frames/journeys-live-rounds-return.svg.png) | 1440×900 | `e043dc66dffb` | PASS |
| [journeys-live-rounds.svg](frames/journeys-live-rounds.svg.png) | 1440×900 | `c92890f1b4a3` | PASS |
| [journeys-rounds-a-return.svg](frames/journeys-rounds-a-return.svg.png) | 1440×900 | `4fe9301927fa` | PASS |
| [journeys-rounds-b.svg](frames/journeys-rounds-b.svg.png) | 1440×900 | `f6f8a2100c0c` | PASS |
| [journeys-simulation-return.svg](frames/journeys-simulation-return.svg.png) | 1440×900 | `00efa6727b53` | PASS |
| [journeys-trend-empty.svg](frames/journeys-trend-empty.svg.png) | 1440×900 | `d1ba2724938c` | PASS |
| [journeys-trend-gap.svg](frames/journeys-trend-gap.svg.png) | 1440×900 | `700f88d5337e` | PASS |
| [journeys-trend-month.svg](frames/journeys-trend-month.svg.png) | 1440×900 | `bf5a481407f9` | PASS |
| [journeys-trend-single.svg](frames/journeys-trend-single.svg.png) | 1440×900 | `5bec085e8a7d` | PASS |
| [journeys-trend-year.svg](frames/journeys-trend-year.svg.png) | 1440×900 | `c7e31ae7be66` | PASS |
| [journeys-view-restore.svg](frames/journeys-view-restore.svg.png) | 1440×900 | `0df9c20b7eea` | PASS |
| [journeys-view-simulation.svg](frames/journeys-view-simulation.svg.png) | 1440×900 | `e8ff4afd6ddf` | PASS |

各组检查包括：正常实盘/模拟指标与日期归属；横条分布收益率/金额、下钻选中和返回焦点；加载/空/错/极端/缺失；趋势缺口、无成交日、单点、月/年；实盘列表与练习列表；A/B 练习身份、不同回合复盘、开仓上下文、返回行焦点；待复盘过滤与 1280 长标题边界。完整长页的底部均实际看过。

## 不变项与验证记录

审查者独立比对 before：fixture、homepage-template.py、四张首页 SVG（handoff、journeys-home-entry、library-return、journeys-library-return）、comments-snapshot.json 均字节相同；开篇及 BT01 完整相同。原始 TRADING-LIBRARY-V10.json 与当前 comments-snapshot.json 字节相同，10 条原评论、状态及原文保留。

独立运行：`PYTHONDONTWRITEBYTECODE=1 python3 .../source/test-library-metrics.py`（5 tests OK）；同方式 test-homepage-template.py（5 tests OK）；`git diff --check -- docs/design-system/baselines/2026-10-22-trading-library-v1.0`（通过）。这些只支持质量/静态契约门槛，视觉结论来自逐帧截图。

预览：<http://127.0.0.1:3090/design-system/baselines/2026-10-22-trading-library-v1.0/visual-spec.html>。原型：<http://127.0.0.1:3090/design-system/baselines/2026-10-22-trading-library-v1.0/navigation-options.html>。root 本轮实际浏览器读取；服务由该基线的 start-preview.sh 提供（会话 68821）。本报告不执行评论写入、不改变评论状态、不提交代码。

### 最终补充证据

独立审阅 `keyboard-page-proof.json`，fresh B 的列表→统计→列表由实际 ArrowRight/ArrowLeft 操作完成，选中、焦点、标题、日期口径和内容都发生对应转换，补齐了早期 no-change AX 的证据缺口。`fresh-tab-console.json` 中新原型/阅读器 tab 日志均为空。root 报告旧采集 tab 曾出现 animation-in-undefined 日志，当前新 tab 无法复现；该来源未独立确诊，NOT VERIFIED，不将新 tab 结果扩写成旧 tab 全程零错误。
