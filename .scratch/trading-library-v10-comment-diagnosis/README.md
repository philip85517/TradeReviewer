# 交易库 V1.0 评论诊断与修复

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

**当前状态：修复与最终验收通过（2026-10-24）。** 5项静态设计问题已关闭；独立Agent复验R01–R13全部处理。协调者完成最终构建的33目录、40分镜/原尺寸图、8组播放与键盘、6评论定位及4历史原图检查。原6评论内容、状态和历史完整保留。

- [最终验收与预览](FINAL-ACCEPTANCE.md)
- [第三轮独立Agent报告](evidence/independent-round-3/REVIEW.md)
- [协调者真实浏览器验收](evidence/reader-final/REVIEW.md)
- [诊断结论与根因](DIAGNOSIS.md) · [设计覆盖矩阵](DESIGN-COVERAGE.md) · [审计记录](AUDIT.md)

| 问题 | 状态 | 最终实现 / 独立验收 |
|---|---|---|
| [01 — 补齐交易库整页框架](issues/01-page-shell.md) | closed / accepted | integration_repair / final_independent_review |
| [02 — 统一工具栏视觉与对齐](issues/02-toolbar.md) | closed / accepted | integration_repair / final_independent_review |
| [03 — 统一实盘与模拟盘切换](issues/03-view-switch.md) | closed / accepted | integration_repair / final_independent_review |
| [04 — 呈现可信的趋势与统一样例](issues/04-trend-data.md) | closed / accepted | integration_repair / final_independent_review |
| [05 — 补齐进入、详情与返回分镜](issues/05-journey.md) | closed / accepted | integration_repair / final_independent_review |

协调者为 `/root`。范围限静态设计及阅读器集成；产品代码、业务数据库与评论状态不在修改范围。共享评论revision 6，共6条，其中4条图稿评论和2条此前行文评论。

## 修复与验收历史

原实现者 `/root/visual_repair` 的扩展图集复核及第一轮独立验收FAIL，证据见 [集成检查](EXPANSION-REVIEW-01.md)、[第一轮独立报告](evidence/independent/REVIEW.md)。整合实现者 `/root/integration_repair` 按 [交接要求](INTEGRATION-REPAIR-BRIEF.md)修复后，第二轮仍发现R03公共首页偏差，见 [第二轮独立报告](evidence/independent-round-2/REVIEW.md)。第三轮仅修正4张首页，独立复验及协调者阅读器验收全部通过。

[实施计划](IMPLEMENTATION-PLAN.md)与[适配约定](visual-contract.md)保留；较早文件中的FAIL、open或NOT VERIFIED均指其记录版本，不覆盖最终验收结果。未提交、推送或合并。
