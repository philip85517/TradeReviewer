# 三项修订独立复核（第 4 轮）

日期：2026-10-31。范围仅限第 3 轮列出的 T15 分母、T10 配对序号/余量、导入详细粒度表拆分。只读核对最新两份候选稿；未读取数据库、运行 UI 或执行持久化/并发/性能验证。只新增本报告。

## 结论

| 项目 | 状态 | 本轮判断 |
| --- | --- | --- |
| T15 分布分母 | **已修，未决按要求保留** | 主稿和矩阵均保留“当前范围全部有效闭合回合”作为规范分母，同时明确“有效回合”与当前指标可计算资格的关系尚待澄清；缺失时需标不可算/不完整，不能擅自缩小分母。两处没有实质矛盾。 |
| T10 配对序号及余量 | **部分修** | 主稿规则段和矩阵行均明确了顺序/序号与开放余量；但主稿核心字段明细行尚未同步列出这两项，作为字段清单时不完整。建议同步字段行，免得实现者只照详细表落字段。 |
| 导入粒度与关联表 | **部分修** | 主稿已拆出批次、材料、材料版本、观察、来源成交链接、计划、选择、回执及效果关联；但详细表重复出现“来源材料版本”，且主稿未明确区分矩阵 I02 的 `RawRow` 与 `SourceObservation` 的身份/关系。关系方向大体补上，精确 cardinality/唯一性范围仍需在物理 schema 评审确认。 |

## 逐项证据

### 1. T15：已修分母与资格的表述层次，保留指标资格未决

矩阵 T15 当前写明分母固定为当前范围全部有效回合，同时指出“有效”与指标不可算的资格关系仍待澄清；不可算时标记不可计算/不完整，不另行缩小分母。主稿 §5.166 保留有效闭合回合作为分母，§5.172 继续保留收益率分母、边界与缺失资格待正式细化。矩阵的新增解释把这两层区分开，故本轮未发现彼此冲突。[矩阵 T15/T17](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-field-mapping.candidate.md:93>)、[主稿财务与分布合同](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:166>)、[主稿待细化项](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:172>)

**仍未决且应保持未决：** 某回合纳入“有效闭合回合”总体，但缺少选中单位（收益率或金额）的计算输入时，桶占比/总量是否只能呈不完整状态、如何展示 `share`，还未被批准规则具体化。当前两稿没有把这类输入假定为完整，也没有证据证明线上实现采用该规则；本轮不将其视为已实现正确。

### 2. T10：配对序号与余量已写入字段矩阵，主稿详细字段行待同步

主稿 §5.111 明确模拟 LIFO 配对需保存双方成交 ID、配对数量、顺序、规则版本和余量；矩阵 T10 已加 `allocationOrdinal` 及 `openRemainder.quantity,status`，并保留示例中的两份配对和 70 股未平仓。因此第 3 轮指出的核心字段遗漏已经在规则段和逐控件映射中修复。[主稿 LIFO 合同](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:111>)、[矩阵 T10](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-field-mapping.candidate.md:88>)

主稿 §5.146 的详细字段表目前仍只写“关联记录包含成交ID、配对数量和角色”，没有列 allocation ordinal 或余量。它未否定 §5.111，但与新增的明确字段合同不一致完整度。建议把序号和开放余量字段同步到这行；若余量只作派生值，应在那里说明由成交数量减配对总量可确定性重建。稳定排序依赖的低精度/同日歧义仍属既有未决项，不应由序号字段伪造事实顺序。[主稿回合关联详细行](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:146>)、[当前成交字段的时间精度限制](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-field-mapping.candidate.md:24>)

### 3. 导入粒度表：关系拆分已落地，但有重复行和 raw-row/observation 边界缺口

主稿 §5.136–143 已拆成导入批次、来源材料、来源材料版本、来源观察、来源与成交关联、审核计划、审核选择、提交回执及效果。表中已写材料版本属于材料、观察归属材料版本、观察与成交多对多、计划绑定 batch/材料版本及输入依据、选择归属特定计划、回执绑定 request/plan 且效果引用目标和动作。这回应了第 3 轮要求的主要关联方向。[主稿详细粒度表](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:135>)

仍需收尾两点：

1. §5.135 与 §5.138 都有一行“来源材料版本”，字段大量重复。保留一行作为版本实体清单，或明确两行分别表示不同对象/视图；当前容易造成候选 schema 重复定义。
2. 映射矩阵 I02 把 `RawRow(rowId,materialVersionRef,locator)` 作为解析粒度；主稿详细表的 `SourceObservation` 同时承载 locator/raw 字段，却没有 `RawRow` 行或其与 observation 的身份关系。若二者是同一对象，应统一术语；若 observation 是更广的证据实体，应补候选关系及各自 grain。不要在迁移前把“一个 observation 必然就是一行成交”写成规则。

依据：[主稿详细表 §5.135–143](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:135>)、[矩阵 I02 与 I05–I14](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-field-mapping.candidate.md:135>)、[当前来源谱系字段与边界](</Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-field-mapping.candidate.md:26>)。

## 验收边界

本轮确认的是文档修订位置与相互表述，不批准物理表结构、唯一键、业务数值规则或运行实现。T15 的缺失资格、T10 在低精度时间下的稳定先后、RawRow 与 SourceObservation 的粒度仍须按规范/来源证据定案；产品页面、真实数据库内容、保存后 reload、回放、异步故障和性能仍未验证。
