# P4 财务边界裁定

2026-10-23，root。依据 `PRE-DISPATCH-CONTRACT.md`（SHA256 `1140ad8c6430562f2f6cb6478f1244717ef07ad5215058eda41784dcf095b803`）、V2.5 HP05 和真实 canonical/F 接口。本记录关闭实施口径，**尚未派发 P4 产品实施，也不构成验收**；同票仍 0/3。

1. **关闭回合**：同一完整 account/instrument/nature/run 的 canonical 数量事实，累计加仓→部分减仓→归零构成一个业务回合。部分减仓不增加关闭回合；反向成交关闭旧方向一个回合并开启新方向。IPO、转仓等非成交事件不得伪造成交或重复回合。episode 用于稳定关联；与 canonical 事实冲突时保留原因并 fail closed，数量/关闭事实覆盖与金额覆盖分别表达，不以更新时间冒充平仓日。
2. **历史已扣费用**：所选已关闭回合最终净结果承担的已分配 entry/exit/IPO 费用。实际发生日 FeeFacts 独立保留，不能用 P2 期间发生费用代替或重写发生日。mixed H08 第一次部分卖出承担费用 5，尚不是已关闭 instrument 回合；最终归零才一个回合，累计承担费用 10。未知费用不抹除已知回合数，但净结果和所扣费用须传播未知。
3. **历史 FX**：每个回合按其上海关闭业务日、满足 pair/known/published/fetched 截止的严格历史汇率转换。policy/version 固定，同一转换事实复用于四卡、月/年桶、累计与历史贡献。缺历史 journal 则未知，禁止最新 FX 回填或混用范围终点换算。
4. **胜负与排序**：胜负按 canonical 全精度原币净结果 `> 0`，持平计入分母；未知净结果不得当亏损或删掉分母，胜率覆盖须单独表达。展示归零不改金融胜负。排序已知值在前、未知在后，相等值以完整 identity 稳定排序。
5. **普通库范围**：从历史详情进入普通库仍采用当前已应用全局 scope/date，不能暗改为 history range。保持现有普通库入口与返回合同。

既定混合来源规则继续有效：无可信 disposal→lot 关联不默认 FIFO/pro-rata/整标的 IPO；canonical 总额可知与来源分类未知是合法组合。

下一步仅授权 state_g61 提交最小只读 canonical fact seam 提案及字面 oracle；P2 候选仍未接受，ledger/F/API 的扩展须另获明确文件授权。S 继续冻结。原始失败、验收轮数及产品 NOT VERIFIED 保留。
