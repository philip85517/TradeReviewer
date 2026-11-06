# 在真实导入入口拒绝错误文件并定位全部问题原行

ID: TL20-I10-PREFLIGHT-UI
State: closed
Status: accepted
Assignee: import_preflight_ui_sol
集成负责人: root
Owner role: DATA
Priority: P0

## Scope / What to build

选择 TradingView 模拟 CSV → 完整源预检 → 文件名/历史时间/CSV 错误全部可见 → 无预览与写入 → 更名或修正文件后重试，可进入既有有效预览再取消。只接拒绝链路，沿用现有正常解析、证券确认和预览。完整练习保存、身份、重导、编号和更新策略仍未实施，不能关闭 I10。[精确合同](../evidence/dispatch/import-preflight-ui-requirements.md)约束真实入口和全部受影响状态。

## Refs

- [业务规范](../../../docs/design-system/trading-library-design-spec.md) L7–61；[V2.0](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md) L116–159、365–369。
- [用户真实日期规则](../../trading-library-v11-design-decisions/comments/TL11-D02/2026-10-26-resolution.md)：文件名唯一有效日期；历史时间错误定位全部原行并阻止导入。
- [矩阵](../DESIGN-COVERAGE.md) DATE-IMPORT / TL20-IMPORT-DATE、ERROR-INVALID-DATE / TL20-STATE、TL20-RETRY；[局部登记](../evidence/I10-preflight-ui/CONTROL-AUDIT.md)。数据管理错误状态没有独立批准画板，采用已记录错误反馈要求与[真实旧版同态基线](../evidence/I10-preflight-ui/baseline-error-1440.png)，不能冒充 V2.0 整页视觉验收。

## Blocked by

- [从完整 TradingView 文件预检全部原行并比较内容](27-tradingview-practice-source.md)

## 验收标准与反例

- [ ] 真正 dispatcher/模拟 parser 消费全部 bytes；零/多/无效文件名日期失败，改名有效后继续，不接受人工日期救济。
- [ ] 早于有效配对的坏日期/空时间及多行 cell 对应原物理行全部显示；没有有效子集预览、enrich 或保存，补充入口不吞掉预检错误。
- [ ] 证券缺失仍用原确认入口，文件名失败不能被该入口绕过；正常执行 ID 与财务解析/旧源 parser 不变；迟到请求不能覆盖新文件状态。
- [ ] 错误关闭、更正重试、有效预览取消、导航返回与刷新可恢复；隔离 DB 导入相关表的逻辑摘要保持不变。
- [ ] 自动触发局部控件审计：DOM/AX/source 登记、版本/分母、真实鼠标与键盘、前中后几何、1440/1280/约390与关键断点两侧；不同输入证据分开。独立 Luna 直接查看同态参考与实际截图，分别功能/安全/视觉结论。
- [ ] 实施者 Sol6.1Ultra、专属不同 Luna5.6Max 双审；root 亲自真实浏览器复验、独立代码审查与相应回归。失败/未验证保留，最多5轮稳定问题修复。

## 派发说明

唯一实现者 import_preflight_ui_sol；专属不同 import_preflight_ui_acceptance_luna；root 负责整页视觉一致性、全数据流与最终集成。允许写入仅精确合同的5个现有代码/测试文件及 evidence/I10-preflight-ui/worker/。禁止改前置源模块、schema/API、原旧 parser、样式、业务 DB、Git 或共享文档。新设计问题先报 root，不自行简化。

## 验收证据

局部基线与合成文件见 evidence/I10-preflight-ui/；前置已接受，领取后派发，全部新运行门仍 NOT VERIFIED。

## 历史

2026-10-26 root 阅读实际选择文件与 parseImport/补充导入调用链，在唯一日期决策后准备真实拒绝纵向切片；Task27 接受前不派发实现。

2026-10-26 Task27 已由专属不同Luna与root接受，root领取本票至 import_preflight_ui_sol；根负责真实浏览器/数据库安全和整页视觉，独立Luna冻结后审查。

2026-10-28 root 在冻结修复版本接受本票有限合同，见[接受记录](../evidence/I10-preview-metadata/acceptance.md)。专属不同 Luna r3 SPEC/QUALITY PASS，root 134 项回归、真实隔离 DB 与同态视觉；原 FAIL/旧记录保留。稳定 metadata/CSV-accept 问题各 1/5 已解决，raw 35 PASS / 3 NV 仍单列；不接受完整 I10/V2.0。
