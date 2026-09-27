# R4 独立领域与接线审查

2026-09-26，Astra独立只读。结论：**本次指定R4源码/领域边界局部通过，未发现新的确定阻断；不代表R4整票、持久化浏览器或视觉通过。** 未改产品、未操作浏览器/业务数据库、未跑全套。root继续实际保存重开、快照只读/PPTX和页面验收；R3接线/布局仍由其owner冻结后联合核对。

## 独立核验而非沿用worker结论

已读 `R4-evaluation.md`，实际读取manual-evaluations、manual-evaluation-projections、server-repository、document、retained-bundles、manual/actual组件、exit-evaluations、PPTX manifest/provenance及对应测试；对比repair baseline的sqlite-schema。

独立执行小定向集合：

```text
npx vitest run app/lib/recall/manual-evaluations.test.ts app/lib/recall/server-repository.test.ts app/components/recall/recall-actual-metrics.test.tsx -t 'manual|partial exit|compact' --maxWorkers=1 --reporter=dot
19:56:55 — 3 files passed, 10 tests passed, 22 skipped, 6.80s
```

跳过的22项未被算作通过；不是全套复验。Node module.register弃用警告与本次结果无关，没有当成产品失败。

## 指定边界结果

| 范围 | 独立证据与结论 |
| --- | --- |
| manual optional / 旧文档 | validator在undefined返回；freeze无manual state时保留undefined，bundle refs缺失不补造；projection用空集合无默认标签。旧absence测试通过。 |
| 单episode target | target限定scope=episode/decisionId=null，可选episodeId必须匹配；position/entry/analysis白名单无exit；全episode最多1个当前draft lineage，同lineage stable draft id，不覆盖version id。不是两套target。 |
| recordedAt和knowledge双截止 | UI以new Date实际录入时间更新recordedAt；freeze cutoffAllows只比draft.knowledgeCutoff.cursor与market cutoff、executionBoundaryForCursor两边界，不把2026实际录入时间与旧行情日期比较。历史截止允许/未来knowledge拒绝的独立测试通过。 |
| 新missing证据server拒绝 | save在CAS事务中调validateRecallManualEvaluationEvidenceChanges；当前document可达或previous/lastCompleted已有pointer才允许。新pointer直接提交而绕过client helper仍拒绝；测试确认CAS revision/投影无推进。 |
| 旧missing指针保留 | previous已存在pointer可继续保存，不改成现有其他Text；text定位包含id+revision+owner，snapshot定位id。server旧source删除后仍保留引用测试通过；只读组件显示缺失原因及原指针。 |
| reimport确认 | reconcileRecallDocument先更新decisions，再reconcile manual当前执行集合；关联集合变化→needs-confirmation。upsert已有draft不重写association为linked；explicit confirm才替换当前executionIds。freeze对needs-confirmation不生成新的manual version/ref，旧version保留。独立确认测试通过。 |
| 冻结与不可变性 | retained manual版本内容/移除受server assertImmutability保护；sourceBundle存在时精确复用其manualRevisionIds；旧source refs缺失传null不从当前draft补造；新post capture按双截止冻结，pre/holding refs为空。 |
| PPTX只读 | manifest先clone选定document，人工项只过滤bundle.manualEvaluationRevisionIds对应versions；不读draft为旧bundle补标签。provenance输出冻结refs；没有调用upsert/reconcile写回路径。 |
| partial-open / unknown fees | actual领域保留realizedNet及未扣费unrealizedGross；netPnl/actualR未平仓为null+episode-open。费用unknown只压净额/费用项，不冒充0且不抹gross。actual panel按episode-open显示分项与“尚未平仓”；独立partial exit/compact测试通过（6 USD/7 USD/缺失原因）。 |
| 同日独立退出 | list函数按decision筛执行，数量与加权均价来自该组fills；600与400不按日期合并；unknown quantity/price保留null reason，界面传入各decision选择。此前R1真实逐笔边界通过不等于R4最终评价UI已验。 |
| migration | 对比 `.scratch/chart-first-review-implementation/repair/baseline/db/sqlite-schema.ts`，diff只有manual SQL常量及migration13追加；7–12 SQL和既有migration entries未改。不能拿git HEAD的旧schema7差异误称本轮重写8–12。 |

## 接线与必须保留的验收限制

当前workspace源码已出现manual episode target、当前双截止、hasSeenFuture、readOnly与viewedBundle.manualRevisionIds、validity/error回调；这证明不是完全未接入组件，但R3 owner仍在工作，不能据此接受最终交互。manual needs-confirmation当前不冻结新人工version，而不是禁止整个复盘其他内容保存；既有显式确认按钮语义需root浏览器核对，避免用户把未纳入本次快照误认为已确认。

以下仍由root完成且状态为 **unverified**：实际历史交易后今天录入→保存重开→post留存→修改当前tags后查看旧bundle/PPTX，reimport变更→标签保持待确认→显式确认，缺失旧Text revision证据显示；open partial/unknown-fee样本在最终compact页面保留正确中文原因；D05 segmented选择/键盘/窄屏尺寸。生产数据库没有用于本次测试。

领域导出只读结论来自源码；本次未生成或打开真实PPTX，不声称导出视觉通过。最终类型/build/全量测试按root集成时版本执行，worker62通过仅历史参考。R1首次核心门禁不因本轮R4局部审查被扩大成整功能接受。

本报告冻结，无新确定返修项；保留后续真实证据联合验收。
