# S 第 3 轮独立验收：FAIL，任务暂停

协调者 /root；2026-10-22。第 3 轮为用户授权上限，不进入第 4 轮，也不换票绕过。保留实现和前三轮证据。

独立复跑提交的定向测试：7/7 PASS（coordinator-round3-vitest.log）。这些测试未覆盖下述实际失败。固定 Node 26 执行 coordinator-round3.mjs，6 项反例检查中 5 项 FAIL，非法日期拒绝 PASS；实际结果及文件 SHA256 见 coordinator-round3-counterexamples.json。

- 成功 apply 后，snapshot.scope 仍含 attachments，而 snapshot.attachments 仍为旧值。应用 categories=[long]、openOnly=true 后编码/解码得到空 categories、openOnly=false，回返或刷新会丢已应用筛选。
- encode 仅对 scope/attachments 显式投影，holdings 等 nested object 仍直接 spread；businessRows 注入会出现在序列化字符串中，未履行上轮要求的 UI-only 白名单。
- history 仅 from/to/year，无历史图 chartMode，不能保存并恢复原设计四模式。已补期间 preset、搜索和每模式下钻字段，不能抵消这一缺项。
- accounts=* 在提供真实已知账户列表 allowedAccounts=[real-account] 时被拒绝；全账户特殊值未与真实账户校验边界衔接。

已完成：纯状态接口、generation/request counter、迟到响应和超时保护、日期校验、URL 范围约束、快照版本与大部分字段、对象消失回退辅助函数。以上仅为保留进展，不构成本票接受；report.md 中 implementation-ready 和白名单描述为实现者报告，不能覆盖本记录。

阻塞：P1 依赖 S 的原子范围与来源快照合同，保持未派发；P2/P3/P4/P5 随依赖阻塞。未接入生产组件，不触碰业务数据库，无产品功能、持久化或视觉通过声明。
