# 09 — 关闭日历史汇率三槽转换

State: closed
Status: accepted
Assignee: /root/astra_finance
Model: gpt-6-astra / ultra
验收: 1/3 PASS（纯模块）；root独立接受，每票至多3轮。历史任务计数保持。

范围：仅F及同名test；原F seam3/3 PASS不重开。无持久缓存/展示舍入/账本复制。

规范/方案：[冻结依据](../evidence/P4/historical-fx/CONTRACT.md)；准确元素/原spec/图像、owner、旅程和证据映射见 [DESIGN-COVERAGE](../DESIGN-COVERAGE.md) 当前Astra切片表及原55行。

- [x] 先systematic-debugging/根因与边界，再真实业务RED→GREEN。
- [x] 完整源码、严格依赖类型、lint与邻接回归候选证据。
- [x] root独立公共接口反例和版本绑定接受。
- [ ] 后续产品接线、真实数据与UI接受单独记录，不由纯模块PASS代替。

本切片无UI/IO，纯模块UI/DB检查不适用；真实首页/四区/持久化/视觉仍NOT VERIFIED。ContributionBars3/3 FAIL继续暂停，无第四补丁。不得push/merge/publish，不动业务库。

root新验收：[第1轮接受](../evidence/P4/historical-fx/ROOT-ACCEPTANCE-1.md)：389+6测试，strict/lint与原固定9性能样本全部通过；页面门独立。
