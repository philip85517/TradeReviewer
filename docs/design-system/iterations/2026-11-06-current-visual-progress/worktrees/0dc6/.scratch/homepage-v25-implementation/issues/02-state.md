# 原子快照与导航恢复合同

ID: homepage-v25-state
State: closed
Status: accepted (pure contract only; resumed round 2)
Assignee: /root/state_g61
Model: gpt-6.1-sol / ultra
集成负责人: /root
Acceptance rounds: historical 3/3 FAIL; resumed 2/3 PASS

## Scope / What to build

新建首页专用纯状态模型：desired/draft/applied、请求 generation+scope key 双匹配、提交整组原子更新、失败保旧应用与草稿、15秒超时重试合同。身份改变关闭/丢旧附加草稿，取消保草稿；清附加和恢复默认不改日期。

完整来源快照带版本，仅存 UI 状态：市场账户、期间、历史范围、持仓查询排序页、贡献双模式局部状态、滚动与焦点。支持持久化往返、对象消失回标题。URL /home 与 /trades 参数解析/序列化：live/market/accounts/rangeMode/from/to/date/symbolIdentity；显式 URL 到达即应用，非法账户/证券不能静默扩大。禁止 queue=pending-review。

## Refs

设计根 docs/design-system/baselines/2026-10-22-homepage-v2.5/。读 source/visual-design.candidate.md HP01:7–39、HP03:161–190、HP06:432–464、HP09:465–502、附录2:646–668；source/images/journeys-library-entry.svg、library-return.svg、error--update-failure.svg。DESIGN-COVERAGE.md HV25-01/06/11..13/29/42/44..49/53/55 的纯状态合同归本票，UI 归各 P 阶段。无原 elementID，以 manifest 定位。

读 app/components/trade-review-workspace.tsx、dashboard-browse-preferences.ts、trading-room-pending.ts 和 library-browse-state.ts 的真实接口，输出接入说明。只读历史 Wayfinder HITL 票，不代用户关闭。

## Blocked by

None

## 验收标准与反例

- [ ] 原子提交、失败保旧及草稿、A→HK→US 乱序、generation/scope 任一不匹配均忽略，重试新编号。
- [ ] 身份改变与取消语义不同；clear/reset 日期不变；只读持仓允许浮盈为0。
- [ ] 显式 URL 直达/刷新、日期/证券唯一身份，非法账户报错，无 queue；字段单一权威。
- [ ] 完整来源状态序列化往返、无业务对象缓存、对象消失焦点回标题；版本/损坏输入防护。
- [ ] RED/GREEN 定向测试及真实消费接口说明。

## 派发说明

只允许写入 app/lib/reviews/homepage-v25-state.ts、同名 .test.ts 和 evidence/S/。不得改 workspace、共享类型、产品页面或数据库。不提交，不再派代理，不启动服务。依赖协调者安装；固定 Node；读 TDD/writing-good-tests；只跑定向测试，协调者统一全量。

本票纯合同不构成 UI 接受。最多3轮协调者验收，第三轮失败暂停；只报告 implementation-ready。

报告 evidence/S/report.md。

## 验收证据

2026-10-23 00:49 CST：恢复第1轮纯合同独立接受PASS。协调者完整代码/接口审查、原6项反例、7个独立合同、含相邻模块98测试与严格类型检查均通过，绑定冻结源码ddceb3cb…；见 [接受记录](../evidence/resume-2026-10-23/S-fix/acceptance-1.md)。本票关闭只解除P1纯状态依赖；真实页面往返、持久化、数据原子提交及视觉仍NOT VERIFIED。

2026-10-23：用户明确要求先debug、后修复并完成后续开发，恢复本票。历史上限与失败不撤销，恢复过程见 ../RESUME-2026-10-23.md。协调者已在未改源码版本重新复现6项检查5失败，完整审查根因后已授权原任务 TDD 修复；目前修复中，恢复验收仍0/3。新证据写入 evidence/resume-2026-10-23/S-fix/，不覆盖历史。

第 1、2、3 轮 FAIL，见 evidence/S/acceptance-1.md、acceptance-2.md、acceptance-3.md。已达到用户上限，暂停迭代；保留源码和反例。第3轮仍丢应用筛选快照、遗漏历史图模式、nested 白名单不完整及全账户名单衔接错误。P1 未派发；产品功能/持久化/视觉 NOT VERIFIED。

2026-10-23 02:48 CST：S 同票恢复第2/3轮纯合同由root独立接受，135定向相邻+16独立反例、strict tsc/lint与冻结hash均PASS。见[接受记录](../evidence/resume-2026-10-23/S-fix/acceptance-2.md)。消费者3FAIL明确转integration接线；真实整页仍NOT VERIFIED。
