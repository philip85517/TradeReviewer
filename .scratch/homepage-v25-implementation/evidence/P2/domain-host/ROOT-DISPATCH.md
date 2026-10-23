# 分域 owned read 与原子数据槽 — 新增受控 host 能力

2026-10-23 11:00 CST；实际 gpt-6.1-sol / ultra，owner /root/metrics_candidate2，root负责完整体验、独立接受与持久化。新增未实施period/history host能力0/3，不重置P1 2/3 FAIL、任何原host来源/导航FAIL或其它leaf轮数。历史统计卡首候选和旧MetricCards第三候选冻结。不得再派agent。

先读当前AGENTS、development-workflow/task-decomposition/frontend-control-audit/ui-task-templates/issue-tracker；适用systematic-debugging/TDD/verification技能。原批准设计 source/visual-design.candidate.md HP02:193–252、HP05:349–432、HP06:434–465、HP09:467–515，公共来源为 docs/design-system/baselines/2026-10-22-homepage-v2.5/。准确参考images/period.svg、journeys-year.svg、history-stats-error.svg、loading--stale-data.svg、error--update-failure.svg、library-return.svg；对应HV25-14..22/33..43/44..49/53/55，HOME-HP02-B001/B020/B024、HOME-HP05-B001、HOME-HP06-B018/B016、HOME-HP09-B001/B028。原稿无逐控件稳定ID则沿用矩阵locator并注明。先完整读S三域、session/host及其测试，Workspace read bundle/onReadAccepted/返回调用链只读、gap-map/原host接受记录。

允许写且唯一owner：app/components/homepage-v25/session-model.ts、session-model.test.ts、use-homepage-host.ts、use-homepage-host.test.tsx、本domain-host证据。禁止改S/financial/A/B/leaf/Surface/Workspace/storage/schema/provider/旧证据/共享README；不启停服务、不写DB、不重benchmark。新增能力不能把现存全局导航/来源恢复变成第四轮修复。若发现原冻结host问题，先只读报root。

先提交精确TypeScript接口/现存调用方兼容与原子提交方案，不写产品代码；root确认后再真实RED。期望：显式opaque period/history数据槽与typed domain read context，各域token全匹配后整包提交，UI日期/年份标签和本域所有下游数据同一React提交。S已是请求接受权威，不在host另造日期/状态引擎。normal全局接口兼容现有Workspace，ambient options.data仍仅初始化seed。global owned source/currency切换需能一次替换完整已提交global/current/period/history bundle；global开始使旧域失效，晚到/取消/超时不得调用accepted-bootstrap或写数据。

period应用只更新前三期间卡/期间曲线/当前贡献的opaque槽，当前市值/持仓与历史不变；history只更新历史四卡/历史图/历史贡献槽，不动当前区、不强制切贡献mode。独立period/history可并发，source全局读覆盖后旧token失效；同域新请求覆盖旧请求。UI-only mode/filter/sort/drill/page不触发IO、不重置请求的原15秒截止。pending/error保留旧完整日期与数据；失败重试相同draft，取消恢复applied；每域原始deadline/错误/重试/取消独立；无global busy时其它域不误拦。

source/UI序列化继续不存业务金额或图点。保留来源只读恢复、collection-only route数据、deleted-account fallback、ordinary /trades不继承首页附加过滤、不预选固定首个episode、guard/popstate的现有行为。onReadAccepted只在owned matching accepted后执行，区分分域结果上下文；不得把period/history业务结果误传旧Workspace full-bootstrap。需要可选typed callbacks时给出调用方迁移合同，不隐式cast。review/drawing CAS及daily-only merge在Workspace保持原样，此票只定义未来接线接口。

验收journey：同一source下同时启动periodP/historyH，H先接受仅换H完整槽+range；P后接受仅换P完整槽+period；全局换source后P/H旧响应不写、callback不执行；UI-only切mode不延长两域15秒；失败/取消/超时保留旧槽、明确retry；global正常与collection/source-return既有回归保留全部业务断言。针对各反例写实际hook和session测试并先RED，不靠实现镜像。strict依赖tsc/lint，报告exact include/命令/日志/hash/diff。

此票无可见新UI，视觉/鼠标/数据库写纯范围NA；hook非金融真实数据end-to-end只有限接受。完整Surface/实际曲线/真实读写返回/reload/同状态视觉继续NV由root后续接线接受，不能把callback通过称整页完成。冻结IMPLEMENTATION-READY前做有限自查；root最多3正式轮，第三失败或必需NV暂停。
