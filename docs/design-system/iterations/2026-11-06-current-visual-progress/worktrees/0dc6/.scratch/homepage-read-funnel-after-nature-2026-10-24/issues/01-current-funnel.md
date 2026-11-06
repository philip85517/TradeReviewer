# 01 — 性质修复后的当前读取漏斗诊断

ID: homepage-current-funnel-20261024
State: closed
Status: accepted
Assignee: root
集成负责人: root

## Scope / What to build

只读核验性质子票接受状态、运行版本、当前接口和领域读取链，以及真实桌面最终状态。不是修复票，不替代首页验收。

## Refs

- 用户本轮“是否已经验收通过，更新现在的数据读取漏斗”。
- [漏斗报告](../FUNNEL.md)、[局部UI审计](../CONTROL-AUDIT.md)、[性质验收](../../homepage-nature-contract/FINAL-ACCEPTANCE.md)。

## Blocked by

诊断无实施依赖。原财务、Bars修复保持暂停，不因本票closed解除。

## 验收标准与反例

- [x] 源码/构建逐文件hash匹配限定验收版本：HTTP-VERSION.json。
- [x] 当前两API1868条完整成交对象摘要一致，性质计数非零：HTTP-VERSION.json、PROBE.json。
- [x] 区分Node代理计时与真实浏览器，保留后置ECONNRESET失败日志：FUNNEL.md。
- [x] 固定1440×1000重新加载并直接看图，明确首页仍FAIL：CONTROL-AUDIT C03。
- [x] 财务完整性231缺口、20行未发布、历史not-wired均记录，暂停轮数不变：FUNNEL.md。

root 接受本票诊断证据；不代表产品通过，不启动任何修复。
