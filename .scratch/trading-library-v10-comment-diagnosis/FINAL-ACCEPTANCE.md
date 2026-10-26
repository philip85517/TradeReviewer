# 交易库 V1.0 评论修复最终验收

## 当前：revision 11 导航问题已确认，06任务复开

[最新诊断](REVIEW-REVISION-11.md)：重复标题、导航分散及面包屑契约偏差成立；键盘焦点丢失未复现。待方案比较与修复复验，本轮仅分析。下列revision 10 PASS保留为历史证据，不代表新增问题已解决。


## 历史：revision 10 用户决策落地验收 PASS

用户确认采用 B 紧凑布局和“最差练习回撤”。正文、共享图稿及原型已同步；06/07/08 任务关闭。每个练习独立计算权益最大回撤后取最大值，全部有效才显示数值，部分覆盖、无练习及真零分别定义；当前样例缺权益路径，继续明确显示“—”，不虚构百分比。

final_design_impl 与 final_prototype_impl 实施，root 完成集成及真实浏览器操作，未参与实现的 revision10_acceptance 独立逐图复核和测试。37/37 变动图视觉通过，指标5项和首页5项测试通过，58/58文件哈希匹配；147资源链接、10原评论及历史图保真通过。所有失败与修复过程保留。

[最终独立报告](evidence/revision-10-final-decisions/INDEPENDENT-ACCEPTANCE.md) · [root验收](evidence/revision-10-final-decisions/ROOT-ACCEPTANCE.md) · [最终版本](evidence/revision-10-final-decisions/review-package.json)

source `b236d66415148decf65eba0075cd9b8d70d91a3916b9f032207274c80dbd9672`；content `8cc354c2add118c7e6c45b1a2dd037b5803e440fb73f379c512ea90700f1ea33`。

[设计预览](http://127.0.0.1:3090/design-system/baselines/2026-10-22-trading-library-v1.0/visual-spec.html) · [B布局原型](http://127.0.0.1:3090/design-system/baselines/2026-10-22-trading-library-v1.0/navigation-options.html)。服务3090运行；重启命令：`./docs/design-system/baselines/2026-10-22-trading-library-v1.0/start-preview.sh`。

本次交付为静态设计及演示原型；生产权益计算和业务持久化不在范围，触控未验证。原评论内容、状态和历史未改；未提交、推送或合并。旧采集tab日志来源未确诊，新原型/阅读器tab日志为空，详见验收限制。

## 历史：revision 10 候选阶段

**候选阶段状态（评论 revision 10）：候选阶段修复与独立验收通过，最终设计仍有两项用户决策待定。** 已提供A/B/C导航比较稿；完成模拟盘多空指标、费用说明、横向分布及首页模板一致性。05首页修复关闭；06/07/08保留open，等待布局选定、最大回撤口径及相应最终同步。10条原评论、状态和历史完整保留。

[设计阅读器](http://127.0.0.1:3090/design-system/baselines/2026-10-22-trading-library-v1.0/visual-spec.html) · [导航布局比较](http://127.0.0.1:3090/design-system/baselines/2026-10-22-trading-library-v1.0/navigation-options.html) · [独立验收](evidence/revision-10-repair/INDEPENDENT-ACCEPTANCE.md) · [协调者阅读器验收](evidence/revision-10-repair/ROOT-READER-ACCEPTANCE.md)

本轮实现由 navigation_impl、design_impl、home_impl 承担；未参与实现的 revision10_acceptance 进行独立审查与真实浏览器验收，root负责集成和最终阅读器复验。5项首页与4项指标测试通过，24个正常布局/模式/页面/宽度组合及异常状态、条件恢复、鼠标/键盘已检查。最后的工具栏遮挡、首页日期坐标/空行图标、BT02表格回归均修复后复验；原FAIL证据保留。

候选source `40d4cfc9cb9d443270f41ff96c5a5b6902276e7f628d8c0c242ccbc6f53dbd63`；content `ce8873acaca197ac0cec3eda7f43221ce56c786066e6537fb073508f8e11b35d`。57文件后验一致；40张引用图、147本地资源/链接检查通过。产品业务应用与数据库不在本次静态设计范围；触控未验证。导航候选通过不代表用户已选定方案，回撤仍显示缺数据与待确认原因。

服务3090保持运行；从仓库根目录重启：

```sh
./docs/design-system/baselines/2026-10-22-trading-library-v1.0/start-preview.sh
```

## 历史：revision 6修复与验收

**最终状态：PASS，2026-10-24。** 5项诊断问题关闭；独立审查的R01–R13全部处理。第二轮公共首页偏差经第三轮修复和同状态视觉复验通过，前两轮FAIL与截图保留于下方历史及原报告。

实现者 `/root/integration_repair`；未参与实现的独立审查者 `/root/final_independent_review`；协调与阅读器验收 `/root`。范围为静态设计正文、40张引用图、8组分镜、统一样例和最终可评论阅读器。既有行文修订保持；6条用户评论仍为原状态，没有自动解决。

最终source `8aca7949a1b05d56d27a7472115d45b9c25a07013fe3961a03883a2dd3bd1c58`；content `7584f36adeab139fc67a50b5894e7bc9afaf894a73aeb1a10716f6a04f198182`。冻结包见 [review-package](evidence/repair-round-3/review-package.json)，最终 [53文件后验](evidence/reader-final/version-after.json)全部匹配。

| 门槛 | 最终状态 | 证据 |
|---|---|---|
| 静态设计、业务口径与完整旅程 | PASS | [第三轮独立报告](evidence/independent-round-3/REVIEW.md)：R01–R13处理；40图逐项覆盖 |
| 同状态视觉、公共规范与1440/1280 | PASS | 第三轮实际重看4张改动首页及7邻接帧；其余SHA不变图继承第二轮实际浏览器证据 |
| 统一样例与独立数值核算 | PASS | [配对/费用/统计](evidence/repair-round-3/independent-data.json)、[估值/待复盘/缺失反例](evidence/repair-round-3/independent-valuation-state.json) |
| 原开篇与第一章保留 | PASS | [正文检查](evidence/repair-round-2/root-prose-check.json)、[第三轮差异](evidence/repair-round-3/root-delta-check.json) |
| 阅读器真实交互 | PASS | [协调者验收](evidence/reader-final/REVIEW.md)：33目录、40分镜及原尺寸图、8组控制、键盘及长图操作 |
| 6原评论、历史原图与语义定位 | PASS | 6评论逐项定位、4原图实际打开、刷新/重开/重载；[浏览器记录](evidence/reader-final/comments.json)、[字节保真](evidence/reader-final/integrity.json) |
| 最终版本/链接/浏览器预览 | PASS | 53/53 SHA一致，146本地资源和锚点有效；manifest与浏览器内完整一致；本轮无新增warn/error |
| 产品业务服务/数据库/物理触控 | N/A | 本次仅静态设计与阅读器；没有开发产品或写业务数据库，不据图稿宣称产品功能实现 |

[当前预览](http://127.0.0.1:3090/design-system/baselines/2026-10-22-trading-library-v1.0/visual-spec.html)。本轮静态服务保持运行；重启命令（仓库根目录）：

```sh
./docs/design-system/baselines/2026-10-22-trading-library-v1.0/start-preview.sh
```

问题关闭与当前README同步更新。未提交、推送、合并或发布。阅读器明确排除项、工具观察限制及目录页尾scrollspy实际行为见协调者报告；没有将未检查项记为PASS。

## 历史：第二轮当时的验收状态（原记录保留）

当前状态：**第二轮独立验收未通过，正在修正 R03 公共首页偏差**。此记录不替代历史诊断或首帧证据。

## 第二轮版本与已执行检查

当前实现者 `/root/integration_repair`；独立审查者 `/root/final_independent_review`；阅读器集成 `/root`。文件版本锁定在 [review-package](evidence/repair-round-2/review-package.json)：source `8aca7949a1b05d56d27a7472115d45b9c25a07013fe3961a03883a2dd3bd1c58`，全内容 `d4988792a3324265749fdc3eded376ba8d084bf2585b76a4380a2548a5a11703`。范围为40张图、8组分镜，49个交付文件及4个阅读器运行文件。

| 门槛 | 当前状态 | 直接证据 |
|---|---|---|
| 构建、链接与原6评论保真 | PASS | [integrity.json](evidence/repair-round-2/integrity.json)；共享revision 6未改变 |
| 独立成交配对/费用/统计计算 | PASS | [independent-data.json](evidence/repair-round-2/independent-data.json) |
| 独立估值、待复盘状态与缺失反例 | PASS | [independent-valuation-state.json](evidence/repair-round-2/independent-valuation-state.json) |
| 既有开篇与第一章保留 | PASS | [root-prose-check.json](evidence/repair-round-2/root-prose-check.json) |
| 独立视觉与R01–R13复验 | FAIL：R03未完全修复 | 40/40实际图检；[公共下半参考](evidence/independent-round-2/reference-home-v25-bottom.png)与[候选下半](evidence/independent-round-2/candidate-home-bottom.png)；其他12项已处理 |
| 最终阅读器操作与评论定位 | NOT VERIFIED | [操作前登记](READER-ACCEPTANCE-PLAN.md)、[控件清单](evidence/repair-round-2/reader-registration.json) |

旧审查者的浏览器会话不可用，已交接给新独立Agent；[HANDOFF](evidence/independent-round-2/HANDOFF.md)不作为视觉通过证据。

第三轮仅修正4张首页的公共控件和图形表达，其他36图保持不变。独立审查者已保存 [版本后验](evidence/independent-round-2/version-final-review-after.json)，允许实现者解冻。当前未关闭任何问题；修复后仍须独立复验和最终阅读器操作。

范围：静态设计正文、全部受影响引用图、样例和文档阅读器集成。产品交易服务、实际数据库写入与物理触控不属于这次修复；不据静态图宣称产品行为已实现。

## 历史：第一轮门槛与失败

| 门槛 | 当前状态 | 证据 |
|---|---|---|
| 整页母版1440/1280 | 阶段接受 | evidence/repair/first-1440-revised.jpg、first-1280-revised.jpg；不代表其他图 |
| 扩展全部状态 | FAIL | EXPANSION-REVIEW-01.md；evidence/expansion-round-1/ |
| 样例独立数值核算 | PASS（当前fixture） | check-design-data.py；evidence/repair/independent-data.json；图值仍待对账 |
| 构建与6评论语义定位 | NOT VERIFIED | 待最终源文冻结后构建 |
| 完整阅读器控件登记与操作 | NOT VERIFIED | 待最终构建 |
| 独立Agent视觉/规范/内容验收 | FAIL（第一轮） | evidence/independent/REVIEW.md，R01–R13；35图/44文件；整合修复后复验 |

后续只追加版本明确的复验结论；不能删除本轮失败历史或提前关闭票。
