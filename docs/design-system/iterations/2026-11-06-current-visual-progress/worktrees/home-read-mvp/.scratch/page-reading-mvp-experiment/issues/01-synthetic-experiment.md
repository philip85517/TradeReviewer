# 01 — 用独立合成库比较摘要准备与分页读取

ID: page-reading-synthetic-experiment
State: closed
Status: accepted (synthetic experiment only)
Assignee: mvp_experiment
集成负责人: root

## Scope / Refs

本轮协调者明确委派的一次性合成实验；关联 `.scratch/page-reading-mvp-wayfinder/issues/03-mvp.md` 的候选实验范围和 `docs/backend-design/page-reading-architecture-review-2026-10-29.md` 问题2–4。它不领取或关闭原 HITL 票，不绕过原票依赖；正式合同与用户判断仍待原流程。

只写 `.scratch/page-reading-mvp-experiment/`，不改产品。详见 [覆盖契约](../DESIGN-COVERAGE.md)、[可复现方法](../README.md)、[结果](../RESULTS.md)。无产品UI影响，视觉/控件检查不适用。

## Blocked by

无：仅本轮明确授权的合成沙箱实验，不是原03-mvp的正式验收。

## 验收标准与自测

- [x] 两组确定性合成样本、独立SQLite和一条命令；见 [README](../README.md)。
- [x] 三主路线＋组合筛选各9次，首次准备、写入、重建、重启、CPU/RSS/空间/字节；见 [冻结原始值](../results/2026-10-29-run-03.json)。
- [x] 两组各15个正确性检查及两个新进程持久化读通过；见 [结果](../RESULTS.md)。
- [x] 首轮失败保留，第二轮完整重跑；独立复核后第三轮补齐覆盖；见 [运行历史](../RUN-HISTORY.md)。
- [x] 产品、暂停范围、真实baseline、页面一秒和HITL判断明确NOT VERIFIED。
- [x] 协调者独立复跑并签署；见 [独立验收记录](../INDEPENDENT-ACCEPTANCE.md)。

## 验收证据

最终命令exit 0。冻结脚本hash匹配JSON；30个检查PASS、72个读取样本、2个新进程首读。该条是实现者自测记录；独立验收证据另见下方。实验分支未推送。

协调者接受：合成实验范围通过；真实链路、页面一秒及暂停任务均未验收，见 [独立验收记录](../INDEPENDENT-ACCEPTANCE.md)。

第三轮最终脚本hash：`eaeac44724a44124114494aeb7723da13a655f66c4ccdfe85b76db5212dae31c`；文件已冻结并经协调者独立复跑。
