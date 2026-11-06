# 10 — 同请求真实原始采集收据

State: closed
Status: accepted
Assignee: /root/astra_source
Model: gpt-6-astra / ultra
验收: 1/3 PASS（纯模块）；root独立接受，每票至多3轮。历史任务计数保持。

范围：仅新增financial-acquisition.ts及test；不改已接受S1、Workspace、host或fx-service。IO仍唯一Workspace。

规范/方案：[冻结依据](../evidence/resume-2026-10-24/source/astra/RAW-SOURCE-MAPPING.md)；准确元素/原spec/图像、owner、旅程和证据映射见 [DESIGN-COVERAGE](../DESIGN-COVERAGE.md) 当前Astra切片表及原55行。

- [x] 先systematic-debugging/根因与边界，再真实业务RED→GREEN。
- [x] 完整源码、严格依赖类型、lint与邻接回归候选证据。
- [x] root独立公共接口反例和版本绑定接受；101回归+5独立检查PASS，strict/lint exit0，见 [第1轮](../evidence/resume-2026-10-24/source/astra/acquisition/ROOT-ACCEPTANCE-1.md)。
- [x] 后续产品接线、真实数据与UI接受明确另列NOT VERIFIED，不由纯模块PASS代替。

本切片无UI/IO，纯模块UI/DB检查不适用；真实首页/四区/持久化/视觉仍NOT VERIFIED。ContributionBars3/3 FAIL继续暂停，无第四补丁。不得push/merge/publish，不动业务库。
