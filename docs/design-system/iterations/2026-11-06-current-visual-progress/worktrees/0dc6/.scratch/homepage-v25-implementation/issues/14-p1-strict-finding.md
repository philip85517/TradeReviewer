# P1 发现 — 新增编辑会话测试未通过 strict

ID: P1-STRICT
State: open
Status: acceptance-failed
Assignee: /root
Implementation owner: /root/astra_integration_design — gpt-6-astra / ultra
Parent: [P1](04-holdings-journey.md)
Iteration: inherited P1 3/3 FAIL; paused; no new repair allowance

## 范围、触发与证据

这是同一P1最后候选的质量问题记录，不是新实现任务。`recall-integration.recall-review.test.tsx`新增测试导致全项目strict exit2，8项错误；80项运行测试PASS不证明类型有效。独立命令、源码指纹、具体行号和范围见[检查点](../evidence/resume-2026-10-24/source/qualifier-repair/F07-acceptance/retained-summary-diagnosis/session-design/root-independent/ROOT-CHECKPOINT.md)。后续lint未运行，不能写成PASS。

## 根因与统一方案

[只读诊断](../evidence/resume-2026-10-24/source/qualifier-repair/F07-acceptance/retained-summary-diagnosis/session-design/implementation/STRICT-FAILURE.md)：一处把viewport放入不含该字段的working对象，七处把不支持的exact参数传给role查询；Vitest默认只转译。下一候选应一次修正这8个测试API使用点，保持业务断言与产品类型，不加cast或skip。当前未实施，用户三轮上限继续适用。

## 后续接受条件

- 用户明确恢复同一耗尽任务后，冻结一个候选；全项目strict、相应运行测试及原计划lint全部有效通过。
- 更新源码指纹和P1最终记录；本发现关闭不能替代P1真实持久化、完整控件和参考视觉接受。
- 这是测试类型问题，本记录本身不新增UI设计；相关产品交互仍沿原编辑会话设计及原P1覆盖矩阵验收。
