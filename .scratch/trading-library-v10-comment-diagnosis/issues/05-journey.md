# 05 — 补齐进入、详情与返回分镜

ID: TLV10-DIAG-05
State: closed
Status: accepted
Priority: P1
Assignee: home_impl
集成负责人: /root

## 当前复核：C10 修复验收通过（评论 revision 10）

4帧复用首页V2.5完整源模板并绑定同一fixture，保留网格、正号、密度和控件。修复了实际估值接口、零线、月份边界、空行动作、日期横坐标与返回焦点。独立Agent在1440整页逐区对照，root检查1280阅读器嵌入和进入/返回分镜，阶段验收PASS。

- [x] 首页4帧复用同一来源，检查网格、符号、密度、控件和间距。
- [x] 来源条件进入与返回分镜一致，样例数值未为视觉相似而伪造。
- [x] 未实现者独立视觉验收及root真实阅读器复验。

[独立报告](../evidence/revision-10-repair/INDEPENDENT-ACCEPTANCE.md) · [root报告](../evidence/revision-10-repair/ROOT-READER-ACCEPTANCE.md)。关闭的是静态设计修复票，未改变用户评论状态。下方保留旧验收和FAIL历史。

## 历史验收（2026-10-24，revision 6）

PASS；协调者 `/root` 接受修复并关闭本票。首页→普通实盘列表→对象回合集→实际复盘容器→逐层返回；练习A/B及待复盘独立分支；来源、数量、焦点连续。

| 验收项 | 证据 |
|---|---|
| 本票设计要求及反例 | [第三轮独立报告](../evidence/independent-round-3/REVIEW.md)，R01/R02/R03/R05/R06/R13；其引用的第二轮实际视觉/几何证据按SHA不变继承 |
| 修复前设计范围、视口、空间和状态 | [visual-contract](../visual-contract.md)、[整合交接](../INTEGRATION-REPAIR-BRIEF.md)、[覆盖矩阵](../DESIGN-COVERAGE.md) |
| 原评论与上下游分镜真实阅读器操作 | [协调者报告](../evidence/reader-final/REVIEW.md)、[40帧动作](../evidence/reader-final/frames.json)、[6评论定位](../evidence/reader-final/comments.json) |
| 版本/原评论保真及独立审查 | [53文件后验](../evidence/reader-final/version-after.json)、[完整性](../evidence/reader-final/integrity.json)；审查者未参与实现 |

最终content `7584f36adeab139fc67a50b5894e7bc9afaf894a73aeb1a10716f6a04f198182`。产品运行/持久化验收不适用于静态图稿修复；没有自动解决用户评论。下方FAIL、未实施和open记录均为历史版本，完整保留。

## Scope / What to build

设计待补：入口卡片无首页宿主；下一步跳到库内待复盘筛选，主线到达和详情阶段缺失。

修复方案：普通入口、日期入口、库内待复盘分别成线；补全完整宿主中的普通到达、对象选择、回合集、复盘及逐层返回。 诊断阶段仅记录缺陷；当前已获用户授权进行静态设计修复，产品代码与业务数据库不在本轮范围。

## Refs

- [诊断报告](../DIAGNOSIS.md)、[覆盖矩阵](../DESIGN-COVERAGE.md)、[审计记录](../AUDIT.md) 的 D05。
- 交易库权威正文：`docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/visual-design.candidate.md`。
- 公共规范：`docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md`。
- 精确条款：BT06 第165–195行；HP11 第71行。
- elementID：`handoff@state-demo-4-1`。
- 当前问题图：`docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/images/handoff.svg`；这是问题基线，不是修复完成后的批准设计。

## Blocked by

None。原依赖 [01 — 补齐交易库整页框架](01-page-shell.md) 已同轮验收关闭；以下历史保留原先依赖关系。

## 验收标准与反例

- [x] 每帧标明触发、变化和保留项；普通入口不带待复盘；返回可核对来源范围、位置与焦点。
- [x] 修复前补齐实际影响范围的完整状态稿、视口、信息顺序、空间预算与控件状态；对照公共规范，不静默简化规则。
- [x] 在真实阅读器中复验原评论路径及相邻上下游分镜；截图、源图hash和正文版本对应，评论锚点可定位。
- [x] 未实现图稿的审查者在同尺度、同状态下独立比较；保存几何和可见字形证据。
- [x] 反例：文字说不是默认目的地，但演示仍从普通入口直接跳待复盘；擅自新增详情中间页或双栏。

## 历史诊断证据（当时状态）

- 当前观察：FAIL；[原问题证据](../evidence/handoff.jpg)，内容版本见 [source manifest](../evidence/version-source.json)。
- 修复后：NOT VERIFIED，未实施；未来证据需在本票追加，保留本次失败证据。
- 产品功能与持久化：NOT APPLICABLE于本次静态设计诊断，不能替代后续产品验收。
- 协调者接受：未接受修复。

## 派发说明

已按 IMPLEMENTATION-PLAN.md 派发给 visual_repair；该实施者负责整页图稿和唯一样例，协调者负责构建与评论语义定位。禁止修改业务数据库或自动解决用户评论。

## 历史

2026-10-24：根据共享评论revision 6及真实浏览器证据建立问题，状态open / diagnosed。

2026-10-24 后续：用户批准修复与独立验收，按 IMPLEMENTATION-PLAN.md 进入实施。此前诊断范围与 FAIL 证据保持为历史；本次未验收前仍为 open。

## 扩展图集复核

初次全图扩展未获接受，见 [EXPANSION-REVIEW-01.md](../EXPANSION-REVIEW-01.md)。原始五项票保持 open；修复仍由 visual_repair 负责，完成后独立复验。

## 第二轮整合交接

第一轮独立验收FAIL后，整合实施者更换为 `/root/integration_repair`，保留前述失败历史。本轮40图已冻结并构建，版本见 [review-package](../evidence/repair-round-2/review-package.json)；独立验收由 `/root/final_independent_review` 执行。旧审查者浏览器会话不可用，其 [交接记录](../evidence/independent-round-2/HANDOFF.md) 仅确认文件版本及静态内容，不代表视觉接受。本票在独立视觉与协调者阅读器检查完成前继续保持 open。
