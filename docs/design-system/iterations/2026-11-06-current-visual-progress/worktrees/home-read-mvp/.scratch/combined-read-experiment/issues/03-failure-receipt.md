# 03 — 复制失败回执的既有案例修复

ID: combined-read-failure-receipt
State: closed
Status: accepted
Assignee: copy_fix
集成负责人: 主协调者

## 范围与依据

用户授权先修复，并明确本轮测试仅覆盖此前复现案例。对应 [FR01–FR02](../FAILURE-RECEIPT-COVERAGE.md) 与 [原始复现](../reviews/measurement-03/REPRO-20261029.md)。仅使用合成文件，不运行真实规模实验，不访问或修改业务数据库。无前端改动，浏览器及视觉验收不适用。

## Blocked by

无；本票仅修复既有合成案例，原真实规模测量任务保持暂停。

## 验收标准

- [x] 对已复现案例，先证明回归测试在修复前失败，再证明修复后通过；检查真实调用链的失败回执，保留原复制错误。[实现记录](../measurement/candidate-04/evidence/WORKER-REPORT.md)
- [x] 独立验收者与协调者各自复核变更、可执行证据和限制；不把修复通过误称为整套测量或一秒目标通过。[独立验收](../reviews/measurement-04/REPORT.md)、[协调者复核](../reviews/measurement-04/COORDINATOR.md)
- [x] 保留第三轮冻结候选和失败历史。原测量任务继续暂停，任何真实规模实验需单独满足原有门槛。[协调者复核](../reviews/measurement-04/COORDINATOR.md)

## 派发与轮次

Sol 6.1 Ultra 承担独立候选的实现；Luna 6 Max 独立验收；协调者最终验收。此次恢复后的候选最多三轮，超限暂停并记录原因；历史三轮失败保留。修改限隔离实验工作树及合成数据，不提交、不推送。

## 验收证据

2026-10-29 协调者接受本票单一合成案例，第 1 轮通过。[完整证据与限制](../reviews/measurement-04/COORDINATOR.md)。初始身份取得前失败的相邻分支仍可能误报通过，本票未覆盖，完整测量工具与真实规模实验不通过本票放行。
