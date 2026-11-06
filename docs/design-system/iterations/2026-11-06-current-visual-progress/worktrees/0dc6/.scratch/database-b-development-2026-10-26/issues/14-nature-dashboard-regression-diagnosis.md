# 14 — 原性质模型72项与仪表盘70项失败的完整归因

ID: DBB-14
State: open
Status: in-progress
Assignee: /root/dbb_nature_dashboard_candidate1_sol
Coordinator: /root

## 范围
承接原中央 NATURE-MODELS 72 + DASHBOARD-UI 70，共142项原FAIL。此前只有2代表的成对诊断已限定接受，剩余140尚未证明。此票用于完整逐项追溯，不重置同一原问题的计数；目前实际修复0/5，原代表诊断不是修复候选。财务P1/F07、Bars及首页性能保持暂停，不因本票恢复。

## 规格与输入
B设计 docs/backend-design/database-module-design.candidate.md §5.1/5.2（身份与证据）、§7（读取）、§9.3（DB-01）；原实施计划Task7/8。精确范围为中央 root-20261027-2 的 failure-groups、failure-inventory、原始日志和full-manifest中的上述两组9文件。不得以测试名称或两个代表外推142项。既有 nature-pair-diagnosis 与专属Luna报告只能支持各自代表范围。

## 验收条件
- 每项保留原名称、错误、stack、日志范围、实际输入（成员性质、账户、run、原始精度及证据）、最先分叉和未达行为。
- 区分缺乏明确性质的测试输入、外层与成员冲突、真实产品偏差、其他未知；不以默认补live让测试绿。
- 当前/中央/884逐文件字节绑定；源码相同不等于历史环境通过或失败；原两个代表注明已有运行证据，余项仍静态。
- 模块调用链和统一最小候选方案，精确文件/测试/共享helper影响及反例；涉及财务实现的建议仅记录暂停，不实施。
- 专属Sol6.1Ultra诊断与独立Luna5.6Max审查，root最后裁定。诊断不接受产品/UI/持久化。

## 派发限制
已派Sol6.1Ultra dbb_nature_dashboard_sol只读诊断。禁止运行应用/测试/服务/HTTP/browser/任何数据库，禁止读取/复制/hash受保护业务库或sidecars，禁止make dev/npmdev/远端；不改产品、测试、配置或共享tracking。唯一输出为 evidence/task-8/nature-dashboard-diagnosis-1/ 与专属Sol报告。只读文档自身UI门不适用，原应用门仍FAIL/NOT VERIFIED。后续修复须先由root结合独立Luna复核裁定，累计最多5轮。


## Root静态裁定与候选1/5

Sol/Luna静态诊断限定接受；root独立机械核对142/142。授权精确90测试输入/契约候选，52排除项保留：036、038–070、096–112、134。8文件，产品不改，037 Recall持久化未接受。brief及evidence/task-8/nature-dashboard-diagnosis-1/root-ruling-1.md为依据。原142FAIL/未知保留，实际候选1/5，最多5轮。


### 2026-10-27 DBB14候选1封存：定向运行通过，类型检查失败

Sol6.1Ultra的唯一精确90项运行90 PASS，关联5文件68 PASS；静止源码窗口下唯一原生类型检查exit2，报两处新增反例的tradingNature值 simulation 不符合兼容字段 simulated 联合类型。113有限源冻结前后一致，guard及sidecars均未创建；类型日志SHA cc4eb1ee2b40f2845c10e26c7d5b63a43636420d1dffe47d8ceb16fa446ab8ca。候选1/5按FAIL封存，禁止原轮修正/重跑，等待专属Luna独立审查与root下一轮裁定。精确通过证据不替代类型门或产品验收，原142FAIL/52排除项及全套FAIL保留。

工作区strict adapter候选2已解除类型检查静止窗口继续实施；四项TV诊断已封存，专属Luna5.6Max只读复核中，尚未授权TV产品修复。财务与Bars继续暂停。

### 2026-10-27 DBB14候选2运行门通过，独立审查待完成

Sol两处合法兼容枚举修正已按唯一候选运行：exact90 90PASS/0FAIL；在adapter明确无源码修改/测试进程、TV设计封存后的静止窗口，一次原生tsc exit0。root另执行一次独立exact90，90PASS/0FAIL、113有限源稳定、guard及sidecars不存在，日志SHA256 `813fdf0f1775ad6c97917bcf6b7a8edc06b60a076ca2784600413f5116e3c660`。68关联项按明确裁定复用候选1的封存结果，其75项依赖全部相同。候选1 FAIL保留，候选2仍待专属Luna最终审查，整体及52排除/037Recall/产品门未接受。候选2证据 `evidence/task-8/nature-dashboard-repair-2/`，root独立子目录 `root-candidate-2/`。

工作区adapter候选3静止窗口已解除，唯一harness.test.ts开始统一修正，27项只允许运行一次；不把候选2的17PASS/9FAIL改称通过。TV只读设计已封存，专属Luna独立审查进行中；尚未授权TV实现或修改原四项UI断言。财务P1/F07、Bars继续暂停，无中央全套/build/新运行验收。

## Root：DBB14 候选2/5限定接受

交易性质及仪表盘的90项授权输入迁移限定通过。Sol exact90为90/90，root独立同90为90/90，native tsc通过；专属Luna 5.6 Max的规格、设计/测试合理性和有限证据三门均PASS。68反例在75文件依赖闭包未变的条件下复用原68/68，未当作新运行。两处修正仅将兼容字段改为合法值simulated，保留与显式live矛盾时归unknown的反例。候选1 FAIL及2/5累计轮次保留。

root独立日志SHA256：813fdf0f1775ad6c97917bcf6b7a8edc06b60a076ca2784600413f5116e3c660；证据nature-dashboard-repair-2/root-candidate-2/。专属报告task-8-nature-dashboard-luna-candidate-review-2.md。worker seal与root六项独立证据分别限定，不把辅助manifest冒充seal绑定。

此接受只覆盖测试输入迁移与定向合同，不代表DBB14产品通过。52排除、037 Recall持久化、真实HTTP/写入返回reload、浏览器/视觉和完整首页≤1秒继续未验收；038–070为图表marker/label/geometry等断言，不能误称为运行时性能优化。财务P1/F07、Bars继续暂停；中央原244FAIL结果保留，未作相减。

### DBB14候选3/5：图表测试输入迁移授权

root全文复核task-8-chart-contract-luna-design-review-1.md；Spec、Design及静态Evidence限定PASS。授权原Sol6.1Ultra仅改room-performance.test.tsx：DBB14-038至070的33callback/54callee明确opt-in成员live；其余9callback/14callee逐字保护，原实参/金额/断言/metadata缺失不动。B§5.1/5.2/7/9.3及chart-contract-design-1/design-coverage.json为逐项准确映射，非新视觉设计。专属Luna5.6Max独立审查，root独立同冻结目标复验；不得以测试输入变更修改生产性质规则或图表算法。

触发范围为既有图表测试输入合同迁移，真实控件、持久化、真实chart、桌面视觉仍NOT VERIFIED，不以jsdom替代。本候选有限运行77目标（42 RoomPerformance、3 chart、31 nature、1 scope）；首FAIL封存，累计3/5，不重置。90/68既有证据未作新运行；原候选1FAIL、原33FAIL历史/其余排除及中央全套FAIL保留。财务/Bars暂停、完整首页≤1秒NOT VERIFIED。


### DBB14 候选3/5：验证选择失败，停止封存

唯一GREEN进程退出0，但实际执行0，97项全部skip（目标77＋排除20），因此验收FAIL，不能称77通过。静态根因：Vitest4.1.10 testNamePattern使用getTaskFullName(task)，仅suite/title；worker误用带文件路径的task.fullName生成锚定pattern。Root独立读取runner/report源码并生成77实例/76唯一的目标multiset，与去文件前缀后的worker静态名单一致。两个相同{}参数化标题保留多重性，不改测试名。无断言FAIL不等于功能PASS。

候选3未重跑、未tsc；worker正封存，源码及原失败保留。下一候选若授权只能修正运行器，app源冻结；仍累计最多5轮。独立Luna审查和root裁定待完成。财务/Bars暂停，整体NOT ACCEPTED。


### 当前：图表候选4/5限定接受

候选3错误过滤名造成零执行/97skip的FAIL保留；候选4零app/test写入，仅修运行器输入。Sol77/77，root同冻结独立77/77，两个同名实例分别覆盖、20排除明确，唯一native tsc exit0。专属Luna三门PASS，root核对29项封存证据一致并限定接受，见task-8-chart-contract-root-acceptance-4.md。真实chart/控件/持久化/视觉、Recall及完整首页一秒仍NOT VERIFIED，整体票保持open。后续TV/SBUI需新冻结，不能直接复用旧70源。财务P1/F07、Bars暂停。
