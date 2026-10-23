# F 第 2 轮独立验收：FAIL

协调者 /root；2026-10-22。独立创建 coordinator-round2.test.ts，固定 Node 26 / Vitest node 环境执行，5/5 反例 FAIL，见 coordinator-round2-counterexamples.log。

1. 账本持仓1份，期末估值却0份，无平仓成交时仍发布完整净额 -100；数量冲突应不可计算。
2. asOf=2026-01-31 仍接受 2027-01-01 current 价格999，泄漏未来行情。
3. 真实 entry 首日买入1份成本100、期末110，adapter 将首日成交同时 seed 到期初并再次期间 replay，期末浮盈 -90，正确应10。
4. 缺失期初成本被跳过，发布完整净额0。
5. settlement.fees 非法字符串被当0，发布完整净额10。

代码审查同时发现：多 episode 同账户证券的估值未聚合，null per-key realized 被 ??0 吞掉，coverage 只有全或无，旧/未来行情截止和时区不完整，FX 完整但行情缺失时仍误报 fx-missing。原指定期初UF100+期间realized150+期末UF0=50的成交反例仍未实际覆盖。上述项已发回实现者；下一次为最后第3轮，若必需项仍失败则暂停。
