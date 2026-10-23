# 财务 A 恢复第 1/3 轮 root 独立接受：PASS（纯数据合同）

2026-10-23，/root；实现者实际 gpt-6.1-sol / ultra。用户显式恢复同一财务任务，当前恢复 **1/3 PASS**；原三候选失败、未来币种 RED、2617.548995ms FAIL 均保留。本记录不接受 P2 页面、B 规模开销或 P4 产品。

Root 已直接审查输入→FX资格修复→批内日历共享的完整产品 diff、追加测试与原测试字节保留证据。合法 future carrier 仍保留；FX 依赖由各边界和独立 current 的 eligible facts 决定，包括 unknown 暴露；闭合历史和当前不混用资格。日历 map 仅批次内、key 包含市场和精确边界，异常类型保留；原币、费用和逐证券行情/缺口判断不共用。原 standalone F 路径保持。

独立重跑：root-targeted.log **207/207 PASS**，root-independent.log 原 future-currency 反例 **1/1 PASS**，root-equivalence.log **8/8 PASS**；root-strict-tsc.log / root-eslint.log 均 exit0。源 SHA 1e64b1c23aa0d42b96331d1eb89b6ec4c16e7d26c13454edc7c7449567df0542，测试 SHA 4e65eef8d568d9a56d258e328229a7f06c9f513583b90d85f328d4902395c33a。

Root 要求两 UI Agent 停止测试/build，确认 READY 后自己按原 runner 顺序跑三形态各三 fresh process；九进程均 exit0，没有静默重试。每次保留全部 1866 fills/365 points、完整 public 字节对照和原 365 字面 oracle；未缩 fixture、换阈值或删公开字段。独立采样见 root-resume1-* 原始 JSON/log，汇总见 ROOT-BENCHMARK-SUMMARY.json。

|形态|三次 cold（ms）|最大保留缓存|
|---|---|---|
|rounds|1096.248636 / 1098.808385 / 1080.145534|53,026,188B|
|long-prefix|1045.854571 / 1035.355140 / 1215.300994|53,658,846B|
|multimarket|1953.393326 / 1932.744604 / 1925.027014|67,101,836B|

所有 27 次 repeat 最高 5.090032ms <200ms，返回同一不可变公开对象，额外 canonical 查询为0。九样本 cold≤2000ms、缓存≤67,108,864B、完整 public bytes 相等、365 oracle 全部通过。**三市场最大 cold 仅余46.607ms，缓存仅余7,028B**；预算余量很小，未来扩展必须重新测量，不能把本结果套用于新增事实索引或 B/整页耗时。

范围门：本票纯财务函数无 UI、无数据库写入，因此本票 UI/持久化 NA（范围依据），整页对应门仍 NOT VERIFIED。P2整票0/3、P1既有2/3 FAIL、其他叶子原计数不变。允许后续受控消费者使用本版本 A；任何 ledger/F 扩展先单owner派发、保留此冻结版本并独立回归，不以本 PASS 覆盖旧 FAIL 或未验收要求。
