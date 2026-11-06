# 有效模拟预览取消后不留下证券元数据

ID: TL20-I10-PREVIEW-METADATA-SAFETY
State: closed
Status: accepted
Assignee: import_preflight_ui_sol
集成负责人: root
Owner role: DATA
Priority: P0

## Scope / What to build

修复 Task28 真实验收发现的 `I10-PF-SAFETY-001-METADATA-PREVIEW-WRITE`：TradingView 模拟预览在确认前通过 enrich → resolver → metadata repository 写 instruments，取消仍留下新标的。禁止以缓存例外缩小“拒绝/取消全表不变”合同。只修此实际状态链，不实施完整练习保存/新 UI。原 Task28 冻结证据与失败不改。

## Refs

- [精确修复合同](../evidence/dispatch/preview-metadata-safety-requirements.md)、[原合同](../evidence/dispatch/import-preflight-ui-requirements.md)。
- [独立 Luna 初验](../evidence/I10-preflight-ui/reviewer/task-28-import-preflight-ui-report.md)、[实际 DB 前态](../evidence/I10-preflight-ui/db-reject-only.json)、[新标的取消后](../evidence/I10-preflight-ui/db-fresh-preview-cancel.json)。
- [设计矩阵](../DESIGN-COVERAGE.md)：DATE-IMPORT / TL20-IMPORT-DATE、ERROR-INVALID-DATE / TL20-STATE、TL20-RETRY。原 D7–61/V116–159、365–369 与真实错误基线沿用，不新增布局。

## Blocked by

None. 本票为 Task28 验收缺陷修复；Task28 因本问题保持 open，不能反向设置关闭依赖。

## 验收标准

- [ ] 用实际 repository 路径有意义地先红后绿；未缓存标的、已缓存需刷新、迟到请求、证券手工确认与重试均不能在确认前写入 metadata。
- [ ] 取消/被替换/拒绝/无变化重导/保存失败不写 metadata；真实成功确认仍保留已有的证券名称与可用 metadata 缓存语义，缓存失败不得把已提交成交伪装成未保存。
- [ ] 普通 TradingView 与其补充导入接线均覆盖；其他来源行为不扩大改动；错误重试保留原输入。
- [ ] root 在显式隔离 DB 用全新未缓存标的执行预览→取消→导航/reload，逐表摘要全部不变；成功导入→返回/reload 可重读已保存内容。
- [ ] 新版本冻结，专属不同 Luna 独立代码/规格/质量与截图复验；root 实际控件、状态安全、视觉分别结论；原 FAIL 历史保留。

## 轮次 / 证据

派发后、实现冻结前的实际可达性补充：补充入口指向既有通用input，其accept只列xlsx/xls/pdf。Task28组件用applyAccept:false仅证明后续逻辑。root允许在同一workspace input加入既有dispatcher支持的csv/text-csv，保留原类型/多选语义，不新增UI。单独记录 `I10-PF-ENTRY-002-CSV-ACCEPT`，0/5；真实补充验收必须正常.csv，不靠伪扩展或合成change。

2026-10-27 root 与 Luna 独立确认同一来源链，修复/重验 0/5。原Sol已领取并开始首次修复；修复+复验尚未结束。原拒绝本身全表不变，但有效新标的预览取消使 instruments 1→2，其他表不变。最多5轮，超过则停止该问题与依赖并记录。实现者 Sol6.1Ultra，专属不同验收者 Luna5.6Max。

2026-10-28 root 在冻结修复版本接受本票有限合同，见[接受记录](../evidence/I10-preview-metadata/acceptance.md)。专属不同 Luna r3 SPEC/QUALITY PASS，root 134 项回归、真实隔离 DB 与同态视觉；原 FAIL/旧记录保留。稳定 metadata/CSV-accept 问题各 1/5 已解决，raw 35 PASS / 3 NV 仍单列；不接受完整 I10/V2.0。
