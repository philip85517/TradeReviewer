# 首页读取优化：设计与验收覆盖

> 最新状态：恢复第5/5轮已结束，整体FAIL并暂停；下文早期轮次保留为历史。最新结果见[第5轮汇总](write-precompute/ROUND-5.md)。

**整体未通过；恢复阶段4/5已接受持久当前组结果接口，原07关闭，后台与完整一秒仍未通过。** 原性能试改5/5和恢复历史保留。原UI审计触发为数据库优化引起首页状态/数据接线变化。协调者root拥有完整用户体验、视觉一致性、数据流和最终接受。原后端Sol6.1 Ultra `/root/server_read_diagnosis`，原前端Sol6.1 Ultra `/root/homepage_read_diagnosis`，原独立Luna6 Max `/root/independent_acceptance`。

准确参考根：`docs/design-system/baselines/2026-10-22-homepage-v2.5/source/`；文字规格`visual-design.candidate.md`。H01–H32为本功能沿用的登记分组，不声称是原稿字面编号。

|需求 / 元素|精确参考图片（images下）|旅程 / owner|接受证据|结论|
|---|---|---|---|---|
|完整≤1秒 PERF01|home-1440.svg、home-1280.svg|冷/热、重启、修订后首读 / root|FINAL-ACCEPTANCE.md|FAIL：命中477.8/325ms不完整；修订后16.3s且45s未展示|
|范围/账户/搜索/筛选 H01-H06|account.svg、search.svg、search-detail.svg、filter.svg|选项及取消、搜索、应用 / 前端|CONTROL-AUDIT.md J01/02/07|取消与搜索局部PASS；全部选项应用NOT VERIFIED|
|期间、指标、曲线 H07-H11|chart-hover.svg、chart-gap.svg、home-1440.svg|期间变化、缺口/指标详情 / 前端|CONTROL-AUDIT.md J08/09；独立报告|局部取消PASS；完整指标/曲线FAIL，全部期间NOT VERIFIED|
|持仓方案C H12-H18|holding-option-C-normal-1440.svg、holding-option-C-normal-1280.svg、50-items--page-7.svg、holding-return.svg|20行、8槽、搜索/分页/详情/导出 / 前端|CONTROL-AUDIT.md J03–06|0结果及1→2→1页PASS；数量完整性FAIL；末页/排序/导出NOT VERIFIED|
|历史与贡献 H19-H28|home-history-1440.svg|历史当前模式、下钻 / root|workspace not-wired；独立报告|FAIL：基线已有未接线，不能排除后算完整页通过|
|导航与恢复 H29-H32|library-return.svg、error--update-failure.svg|交易库→返回→刷新；导入门槛 / 前端|CONTROL-AUDIT.md J10/11；wire单测|真实往返FAIL；导入持久闭环NOT VERIFIED|
|持久结果与版本 DB01|专家报告第2章；实施说明第2–3章|命中/失效/失败/重启 / 后端|77项协调者回归；SQL审计；生产浏览器|局部PASS；真实金额逐项对账NOT VERIFIED；并发按用户暂停|

最终978文件内容指纹f4ad4d0c…1e86d3、服务4395及历史交互版本限制见[最终验收](FINAL-ACCEPTANCE.md)。[控件审计](CONTROL-AUDIT.md)公开实际范围，不声称100%。用户要求桌面，本次窄屏范围排除；其他断点未验不改为通过。财务/Bars/并发暂停，原数据保护保持。

## 恢复阶段：共用计算契约验证

本阶段仅新增独立探测测试和文档，不修改页面、控件、产品接线或业务库。因此新增阶段的图片、elementID、浏览器与视觉验收不适用；上表原有FAIL/NOT VERIFIED继续有效。协调者root仍负责后续完整旅程和一秒验收。

| 需求 / 准确规格 | 对象 / 阶段 | owner | 可观察预期与反例 | 证据 | 结论 |
| --- | --- | --- | --- | --- | --- |
| 共用实际计算；补充设计第三章 | 买100、卖40；逐笔与批量同一时点 | Sol calculation_contract | 应余60，分次与批量业务值相同；单独卖出不能冒充完整账户 | [实际输出](resume/calculation-root-evidence.json)、[独立审查](resume/calculation-review-round2.md) | PASS：现有全量入口的当前结果；后台/局部复用NOT VERIFIED |
| 范围隔离和完整性；补充设计第三章 | 第二账户、标的和模拟成交 | Sol calculation_contract | 目标行不混入其他组；必须识别全局缺口对合计的影响 | [全局反例与定位](resume/contract-review.md#计算边界的定位证据) | PASS：B缺口使A合计不可用，规则未变；没有证明独立局部复用 |
| 原件及修正保护；补充设计第二章 | 六份CSV、代表PDF、只读原库 | Sol source_contract | 真实解析后计数；SHA256匹配或明确未核验，不能只凭名称 | [来源审查](resume/source-review.md)、[原库保护](resume/root-safety.json) | PASS：资料分级及保护；完整旧库文件身份/实际导入刷新NOT VERIFIED |
| 独立审查与接受；首项计划Task3 | 测试、报告、原库及产品文件指纹 | 每个任务单独Luna / root接受 | 实际重跑，不把资料验证视为后台完成 | [协调者接受](resume/contract-review.md#最终接受)、[第二轮](resume/ROUND-2.md) | PASS：门槛接受；原产品FAIL不变 |

恢复第1轮比较器漏比规则印记，未接受；第2轮只修探针并以单字段反例先红后绿。[原失败](resume/ROUND-1.md)保留。所有真实build的series为空，非空曲线及完整历史仍NOT VERIFIED；未改产品，本轮不宣称95%分支覆盖率或新的UI成绩。

## 全库校验与分组准备复用（恢复第3/5轮，窄原型接受）

|需求 / 精确参考|对象 / owner|验收与反例|状态|
|---|---|---|---|
|补充设计第三章：共用模块、不增公式；决策票六项|全库凭据、组事实、ordinary准备、页面组合 / Sol group_reuse；root集成|新增B或B缺口时A准备复用；合计资格仍与未改builder一致；买100卖40→60、修订卖20→80|PASS（准备原型）；34对逐项相同，B缺口仍正确降级。[root](group-reuse/root-acceptance.md) · [Luna](group-reuse/luna-review.md)|
|补充设计第三、六章：依赖和异常|账户费用、模拟运行、显示/复盘、行情/FX、到期、fallback / 同一Sol|明确失效与真实canonical计数；保守重算不称局部优化通过；独立Luna及root|PASS（受测内存范围），95%分支覆盖NOT VERIFIED；[证据](group-reuse/root-fresh-summary.json)|

本候选仅scratch生成机械变体，产品app、接口、控件、数据接线均不变。UI参考图/elementID、桌面浏览器和视觉门槛不适用本票；原整页FAIL仍有效。派发前已读实际源码、补充设计及当前工作流，禁止以本候选替代首页/交易库完整一秒验收。

|尚未满足的原07要求|对象 / owner|当前实际|结论|
|---|---|---|---|
|补充设计第三、四章：基础结果与组合|持久组结果schema/恢复版本、页面组合；root继续协调原票|只缓存normalized/canonical准备，行每次fresh，opaque handle不能持久保存|NOT VERIFIED，原07 open / acceptance-failed|
|补充设计第七章：真实性能|跨请求有效期、真实全库、后台发布、完整首页和交易库|精确Date.now导致真实请求通常miss，本轮没有接线或重测桌面|原FAIL保留；不得以小例计数/耗时关闭父目标|

本轮新增4点合成series的逐字段等价PASS，只补齐原型历史投影反例；真实旧库非空历史和产品曲线仍NOT VERIFIED。使用隔离内存SQLite，975产品文件未变，44冻结worker文件未变。恢复已用3/5；下一候选仍原07第4/5轮，不新增计数。验收入口证据路径副作用列Minor/deferred，独立副本规避并保留机械diff。[简明结果](group-reuse/ROUND-3.md)。


## 持久当前组结果：第4/5轮派发原始登记（最终验收见下一节）

准确规格：写后计算补充设计第三、六、七章及原票07六项；执行计划`docs/superpowers/plans/2026-11-06-homepage-persistent-group-results.md`，派发前已读原规格/源码/当前工作流。

|原需求 / 对象|owner|用户旅程与可观察证据|当前状态|
|---|---|---|---|
|07.1 四层模型、字段版本、唯一公式|Sol persistent_seam_diagnosis；root集成|保存真实native金融结果，重启恢复；机械生成可逆且漂移拒绝|待验证|
|07.2/3 数值与全库资格|同上|60/720/120→80/960/160；B缺口时A真磁盘命中而合计仍降级；全builder业务深比较与4点series|待验证|
|07.4 时间/依赖/异常|同上|秒钟推进命中；成交截止、收盘、换日失效；FX fresh；附加证据fallback；损坏/版本/I/O/容量安全回原路径|待验证|
|07.5 实际工作量与范围|同上|两独立进程读取同一结果SQLite；native求值/磁盘命中/字节与仍执行工作分别记录|待验证；不证明整页≤1秒|
|07.6 独立验收与数据保护|fresh Luna6 Max；root独立接受|各自独立证据目录，975产品/旧44冻结文件SHA保护；无原库访问|待验证|

本轮无产品UI、控件、路由、状态接线变更，元素ID/视觉稿/浏览器不适用此隔离原型。历史端点与持仓canonical facts仍走原逻辑，不声称完整行缓存；原全部FAIL/NOT VERIFIED和5/5历史保留。阶段已用3/5，提交本候选时记4/5。

## 第4/5轮最终覆盖与接受

以下为上述派发项的最终结论，取代该轮“待验证”，不抹除第3轮及原产品失败。准确规格仍为补充设计第三、六、七章、原票六项和本轮计划；源码与候选SHA见[root签署](group-results/root-acceptance.md#接受签署)。无产品UI和数据状态接线变化，elementID/图片/浏览器对本隔离实验不适用；原H01–H32、PERF01与DB01未验证部分仍有效。

|需求 / 处理对象|owner|可观察结果与反例|证据 / 最终结论|
|---|---|---|---|
|07.1 四层模型、字段/版本及唯一公式|Sol persistent_seam_diagnosis；root集成|真实原币结果落盘，恢复Decimal；生成器可逆且两类源码漂移拒绝|[模型](group-results/MODEL.md)、[保护](group-results/root-fresh-verify/verification.json)：PASS|
|07.2/3 数值与全库组合|同上|60/720/120→80/960/160；B缺口时A实际结果命中、合计仍unknown；4点series等价|[root74对](group-results/root-fresh-summary.json)、[Luna](group-results/luna-review.md)：PASS，限受测接口|
|07.4 时间、依赖与异常|同上|后一秒命中且新cursor；截止/收盘/换日失效；FX fresh；复杂附加证据、损坏/真实I/O/容量回原计算|[依赖](group-results/DEPENDENCIES.md)、[主批](group-results/root-fresh-run/candidate/evidence.json)：PASS；95%分支覆盖NOT VERIFIED|
|07.5 实际工作量与边界|同上|主批恢复29/求值52；另一进程实际读取同盘2条；准备/历史/持仓仍执行，不冒称整行或整页缓存|[root摘要](group-results/root-fresh-summary.json)：PASS（计数及边界），真实全库/整页≤1秒仍未验证|
|07.6 独立接受及保护|fresh Luna6 Max；root|各自新目录复跑74对；975产品/旧44/本轮127与128冻结无变；原库不访问|[Luna](group-results/luna-review.md)、[root](group-results/root-acceptance.md)：PASS；[原票](issues/07-global-proof-group-results.md)closed / accepted|

后续沿用原[写后提前计算任务](issues/02-on-demand-rebuild.md)；没有新建重复票或重置轮次。下一性能候选5/5，完整首页和交易库依然FAIL；其后台/持久化/桌面控制与视觉证据不得由本表代替。


## 写后后台接线：第5/5轮开发前登记

本轮触发为首页读取与处理状态接线，不重做布局。准确原稿仍为本页参考根；已读文字规范第二、八、十章及附录二，默认尺寸/信息层级/8槽不变。root承担整页视觉与完整数据流，Sol backend_loop负责Task1、Sol native_results负责Task2，fresh Luna分别独立审查。比较视口先1440×900和1280×800，1440×1000另补原稿规格对照；100%缩放，DPR实测登记。窄屏沿用本任务用户桌面排除，触屏无证据不声称通过。

|需求/规格|元素与准确images参考|完整用户旅程、owner|反例/证据计划|状态|
|---|---|---|---|---|
|补充设计第三四章/DB01|后台对象无视觉元素；首页home-1440.svg|写入/回滚→待办→独立计算→同版本发布 / backend_loop+root|未读首页前写入、回滚、失败恢复/过时不发表；backend-report及root独立SQLite证据|NOT VERIFIED|
|补充设计第五六章/DB01|批量进度API，无新增控件|旧修正副本批量与单笔共用计算 / backend_loop+root|超过两批、取消、重启、同截面金额和事实摘要；独立报告|NOT VERIFIED|
|第八章/第十章异常状态、H29-H32|error--update-failure.svg、library-return.svg|首次处理中/更新失败→取消或重试→返回刷新 / backend_loop；root视觉|不能显示假零或新标签旧数；202/Abort测试、浏览器前中后截图与geometry|NOT VERIFIED|
|第三章全局范围、H01-H06|account.svg、filter.svg、search.svg、search-detail.svg|范围/账户/筛选/搜索应用取消→读新版本 / root|本轮受影响状态与选项逐项登记；迟到响应不得串范围|NOT VERIFIED|
|当前表现H07-H11|chart-hover.svg、chart-gap.svg、home-1440.svg|期间应用、loading/缺失/失败、指标/曲线 / root|原未接线和缺数据FAIL保留，不拿占位作为完整首屏|NOT VERIFIED|
|持仓H12-H18|holding-option-C-normal-1440.svg、holding-option-C-normal-1280.svg、50-items--page-7.svg、holding-return.svg|20行、8槽、搜索/分页/详情→返回 / root|正常/无匹配/分页及范围变化；快照和真实持久读取分别证据|NOT VERIFIED|
|历史贡献H19-H28|home-history-1440.svg|历史切换/读取 / root|原历史not-wired保持FAIL，不从series端点推定历史tab完整|FAIL（既有）|
|导航H29-H32/PERF01|library-return.svg、home-1440.svg、home-1280.svg|首页→交易库→返回/Back/刷新 / root|交易库独立计时，默认预热不代替直接交易库；保留全程网络/截图|NOT VERIFIED|
|当前组模型、补充设计第三六章|内部对象无新控件，金额继承对应原稿|60→80、B缺口与A命中、跨秒/截止、重启恢复 / native_results+root|deep业务比较、真实磁盘命中计数，复杂组fallback；native-report和独立复跑|NOT VERIFIED|
|原完整≤1000ms/PERF01|home-1440.svg、home-1280.svg及交易库已批准规范|冷/热/重启/写后首读 / root|每组20样本，等待202计入；未知/空曲线/不完整不能算通过|原FAIL，本轮待测|

此登记不是新轮次或新的accepted承诺；原试改5/5、恢复4/5及原控件表保留。实现结束再冻结最终版本与真实操作清单/分母，当前没有新浏览器通过证据。

### 独立审查后的取消传播补充（冻结前）

对应原稿第八/十章及H01、H07、H29–H32；准确异常/返回图片与上表一致，不改布局和15秒预算。独立审查发现生产消费者未把取消信号交给客户端：超时、换范围、离开后旧202轮询仍继续。根因和逐路径证据见`write-precompute/root-cancellation-diagnosis.md`。

唯一实施owner为Sol backend_loop，仅拥有`app/components/homepage-v25/use-homepage-host.ts`及其测试、`app/components/trade-review-workspace.tsx`的三处读取接线、`app/components/trade-review-workspace.homepage-view.test.tsx`。先保存四文件修复基线，等待root全量回归结束后，按公开入口RED→GREEN实施。其余产品文件冻结；signal作为独立函数末参，不进入请求JSON。

验收分别检查：全局初读/第二读共用最早deadline和signal；期间/历史独立替换取消；超时/已接受离开/停用/卸载停止实际fetch轮询；guard拒绝仍保留有效读取；旧promise不能清除新owner或发布数据。root负责完整旅程，原实施者之外的Luna独立审查delta；桌面加载、错误、重试和离开前中后证据仍必须补齐。当前状态NOT VERIFIED，不重置性能轮次，也不覆盖批量进度与取消的既有Spec FAIL。


## 第5/5轮最终证据与覆盖修订

以上“开发前登记”是计划，不是通过声明。最终产品指纹`2a94e2aa6b58d5c15499581184ced492ab27bee103436c61dc1814b2c4e26ef0`；root协调，Sol6.1 Ultra实现，Luna6 Max独立审查。准确原稿、owner和旅程沿用上表，不修改默认尺寸、信息层级或8槽要求。

|原要求/元素|最终证据|接受范围与状态|
|---|---|---|
|DB01写后待办/独立后台/版本发布|write-precompute/luna-backend-review.md，125项及真实进程证据|限定PASS；批量逐对象进度和取消已入队任务FAIL|
|普通组结果与资格分离|write-precompute/luna-native-review.md、real-equivalence-v2-candidate.json|模块PASS；不代表完整一秒|
|H01/H07/H29–H32取消和错误|luna-cancellation-review.md附录、final-browser-cancellation.json|107项受控PASS；实际15.966秒后继续请求FAIL|
|H02/H03取消、H12搜索、H15首条详情、H16三页|CONTROL-AUDIT第8节及final-ui-journey.json|限定操作PASS；其他选项/详情仍NOT VERIFIED|
|H07–H11当前表现、H19–H28历史|最终桌面截图、luna-desktop-review.md|完整数据缺口FAIL；缺失不补零|
|H29交易库/返回/reload、PERF01|final-write-first-read-1440.json、journey-trades及journey-real-return系列|FAIL：写后约22.8秒，交易库超过16秒仍加载|
|视觉密度与空间|最新home-1440/1280参考与最终截图、独立视觉报告|FAIL：图表区高约92px；旧版归因NOT VERIFIED|
|真实CSV UI导入持久闭环、20样本、95%分支|本轮没有充分证据|NOT VERIFIED，不以API改名或定向单测替代|

最终功能、端到端、视觉与性能分开记录，整体FAIL。恢复5/5耗尽，原HOME-DB-COLD暂停，不新增同义票。完整证据与启动见[第5轮](write-precompute/ROUND-5.md)。
