# 独立复核第 5 轮：两项定点修订

复核范围严格限定为本轮指定的两处：模拟回合分配是否记录配对序号与未平仓余量；RawRow 与 SourceObservation 的粒度/持久化边界是否在主稿和字段矩阵中一致，且重复的材料版本明细是否已移除。未扩大到其他设计项，也未验证产品运行行为。

## 结论

| 项目 | 状态 | 证据与判断 |
| --- | --- | --- |
| 模拟 LIFO 分配的序号及余量 | **已修** | 主稿回合明细行要求分配记录保存成交 ID、配对数量、角色和配对序号，并另存未平仓余量及状态（`view-driven-data-model.candidate.md:147`）；LIFO 例子也明确保存配对顺序、规则版本和 70 股余量（同文件 `:113`）。字段矩阵 T10 对应列出 `allocationOrdinal`、`openRemainder.quantity,status`、费用分摊和规则版本，并复述 100+50 卖 80 的两组配对及 70 股开放量（`view-field-mapping.candidate.md:88`）。两处口径一致。 |
| RawRow / SourceObservation 粒度、材料版本重复行 | **已修** | 主稿定义 RawRow 为原始输入片段或浏览器草稿，SourceObservation 为材料版本中识别出的来源信息；说明二者可一对多/多位置引用、RawRow 不必单独持久化、截图/裁剪/未确认 OCR 草稿留在浏览器（`view-driven-data-model.candidate.md:109`）。矩阵采用相同定义和边界（`view-field-mapping.candidate.md:130-132`），I02 将 RawRow 用作解析输入候选（同文件 `:137`）。主稿详细对象表中“来源材料版本”只出现一行，随后以独立“来源观察”行表达观察粒度（`view-driven-data-model.candidate.md:138-141`）；未发现重复版本行造成的冲突。 |

## 未验证边界与停止条件

上述结论只说明两个候选文档已写入且彼此一致，不证明当前实现已按此行为运行，也不批准物理表结构。主稿仍明确 RawRow 是否独立持久化由来源规范决定；矩阵也将当前 worker/内存行为标为未直接核验（`view-field-mapping.candidate.md:143`）。本轮没有检查数据库、浏览器或运行时，因此不将这些状态提升为已验证。

本轮两项均已修且未发现范围内矛盾；依任务要求停止后续迭代。
