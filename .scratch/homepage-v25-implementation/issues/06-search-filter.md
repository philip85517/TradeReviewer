# 06 — 搜索标的、应用附加筛选并完整返回

ID: P3
State: open
Status: in-progress
Assignee: /root/integration_g61
实现模型: gpt-6.1-sol / ultra
当前有限恢复 owner: /root/state_g61（同模型）；CR01/02/03局部独立PASS，完整筛选/四区附件/响应式仍NOT VERIFIED，正式0/3，见 `../evidence/P3/search-error-visual/ROOT-CHECKPOINT.md`。
整页视觉、完整数据流与独立接受负责人: /root
验收: 0/3；P1既有持仓工具为回归范围，不更名重置P1失败。2026-10-23 03:05 CST root按有限依赖门明确派发，见 `evidence/P3/ROOT-DISPATCH.md`。

## Scope / What to build

页头标的搜索→唯一身份结果→真实详情→普通交易集合→返回原搜索上下文，以及320px附加筛选草稿/应用/清附加/重置。全局市场、账户、期间与搜索/附加筛选的作用域保持设计定义。证券全集使用已导入交易与metadata的可知目录，不新增供应商或伪造覆盖；可见说明必须准确。

## Refs

- 原规格 `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md` HP01:113–190、HP03、HP04:295–316、HP06:436–448、HP08/HP10；current component manual Search/Filter/Select/Dialog完整相应章。
- [55项矩阵](../DESIGN-COVERAGE.md) HV25-01..13、HV25-23..30适用回归、HV25-44..49/53..55；elementID缺失沿manifest文本块，不生成原稿ID。
- 准确原图在同baseline `source/images/`：`search.svg`、`search-detail.svg`、`search--detail.svg`、`search--empty.svg`、`search-overlay-open.svg`、`search-error-frame.svg`、`detail.svg`、`filter.svg`、`multi-applied.svg`、`multi-applied--reopen.svg`、`clear-attachments.svg`、`clear-attachments--after-clear.svg`、`reset.svg`、`reset--reset.svg`、`cancel.svg`、`cancel--cancelled.svg`、`account.svg`、`holding-return.svg`。
- [视觉契约](../visual-contract.md)、[96状态精确映射](../evidence/A/CONTROL-STATE-MAP.md)、S恢复接受v2纯接口。派发前逐一核实资产文件存在，不能靠摘要或推测状态图实现。

## Blocked by

- [04 — 真实持仓最小旅程](04-holdings-journey.md)：共享导航、详情、首次整页视觉有限门已接受，整票第2轮FAIL仍保留；继续实施依据见 `evidence/P3/ROOT-DISPATCH.md`。
- [02 — 状态合同](02-state.md)：消费已独立接受v3与读取意图接口，不能另存一套applied/来源业务快照。

## 验收标准与反例

- [ ] 搜索不改变市场/账户/期间；300ms防抖、IME组词不查；loading/empty/error/long-name/重名不同exchange+class有明确唯一身份及真实结果。不能以US或provider当exchange。
- [ ] 搜索层max960px且外侧≥24px，背景inert，焦点约束/键盘结果导航/外点关闭；详情外点不关闭，Esc/关闭回原结果/滚动/焦点，来源消失回正确容器标题。
- [ ] 筛选320px；同类OR跨类AND，草稿不改变已应用页面；应用成功原子替换附件与数据，失败保留旧完整状态。Esc/外点保留草稿，切身份按原文丢弃附件草稿并保留允许日期，清附件与重置分别符合合同。
- [ ] 所有选项/清除/应用/取消/重开/长值/无结果逐项登记实际操作。清空应真实达到0行/0图点时有证据，不能只证明参数被清除。
- [ ] 详情唯一查看交易传完整identity、已应用范围/账户；ordinary库不选首回合、不带queue，返回与刷新重读真实数据后恢复UI。持仓局部查询/排序/分页/全量CSV沿P1回归不退化。
- [ ] 公共状态、overlay前中后空间、双桌面和窄屏可达性、鼠标与键盘、失败/取消分别验收；frontend-control-audit完整本票控件与条件实例。单测不替代真实旅程/视觉。

## 派发说明（解除依赖并由root明确授权后生效）

同一页面owner独占 `app/components/homepage-v25/**`、必要workspace与其测试；可复用P1已授权有限metadata读取，不增加provider/数据库schema或全局控件迁移。F/S源码、旧dashboard/replay、依赖、配置与业务DB只读。实现者不得再派代理。

输入为当前已接受bundle/known catalog/S UI；输出为唯一身份详情及相同ordinary库intent，附件与全局请求使用单一权威scope。已有真实保存/guard必须保持。root负责所有浏览器与写入隔离验收。

## 验收证据

计划 `evidence/P3/{functional,state-persistence,visual,controls}/`；版本指纹、数据/目录边界、可知证券覆盖说明、服务/隔离DB、viewport/zoom/DPR和输入方式。功能、状态链/持久化、独立视觉均NOT VERIFIED；0/3，无接受签署。

## 历史

- 2026-10-23 03:23 CST：root 冻结全重载发现 owned ordinary 数据入口回归，direct scoped `/trades` 保持0标的/0回合，业务数据未丢。见 `evidence/P1/round3/ROOT-DIRECT-TRADES-DIAGNOSIS.md` 与 `evidence/P3/FROZEN-DIRECT-TRADES-DIAGNOSIS.md`。最小真实 adapter/host RED 为 ownedReads0、entries0；同数据 /home 控制 PASS。原 owner 获授权仅修冷初始化 owned read 与同代 catalog 投影/明确错误恢复，P3其他扩展暂冻结。P3仍0/3，P1仍2/3 FAIL；双窗口409验收中断，不计通过。

- 2026-10-23：root准备后续票，未解除P1依赖，未授权实施。


2026-10-23 02:36 CST：P1第二候选仍在root独立验收。02:29签署有限依赖门（evidence/P1/acceptance-2/DEPENDENCY-GATE.md）：首条真实持仓→详情→普通库→重读返回及1440/1280首张布局通过，非P1整票通过。已明确派发P2-A纯批量投影（financial_g61，合同SHA a882d59c3d6b2ed532250b207897bf0166e560426e58d6797e586faa28e7618a）与S同票恢复第2轮v3/日期/请求purpose；P2页面/P3/P4产品仍未派发。root完整Workspace回归95项为50 PASS/45 FAIL，日志evidence/P1/acceptance-2/verification/workspace-all.log，已交原owner先只读分类根因；不声称全量通过。02:31后F、02:32后S正获授权开发，后续浏览器HMR状态不得冒充freeze2证据；先前截图与有限门保留原版本效力，剩余UI验收等待消费合同重新冻结。真实保存/reload/guard、96状态及窄屏仍NOT VERIFIED。P4来源政策另见evidence/P2/data/P4-COORDINATOR-PROVENANCE-DECISION.md：无可信处置链接不默认pro-rata，未知保持未知。


## 2026-10-23 03:55–03:57 CST 有限详情复核

root实际浏览器与原稿对照核对标题/配色、120×36居中主动作及可见来源返回；当前CSS1280×720/DPR2局部PASS。准确焦点、逐层Esc与外点规则实测通过。详见 `evidence/P3/detail-visual-limited/ROOT-CHECKPOINT.md`；指定响应式及完整最终版本回归仍NOT VERIFIED。P3 0/3、P1 2/3 FAIL保持，附件未扩大实施。

## 2026-10-23 04:16 CST — 搜索控件回归重开

root 真实浏览器确认 CR01：搜索6结果实际滚动816后关闭/重开回0；CR02：目录错误区域没有结果按钮时 Enter 打开旧HKEX:2600详情。见 `evidence/P3/control-review/REPORT.md` 与 `root/` 前后截图/AX。P3 仍0/3，15项既有组件测试与单视口详情局部通过不能取消这两项FAIL。有限修复由 state_g61 准备，host 独立候选保持冻结；准确设计/owner/旅程/证据已追加 DESIGN-COVERAGE。其余状态、断点、正常动效、触控及完整P3保留NOT VERIFIED。


2026-10-23 04:43 CST：CR01/02当前Surface c6e14890…在root真实滚动/返回、pending/timeout/503键盘及恢复retry/正常Enter有限PASS，见 evidence/P3/search-recovery-fix/ROOT-CHECKPOINT.md；同态看图独立发现CR03视觉FAIL，state_g61仅获home-surface.tsx错误markup与home-surface.css一次有限候选，修后待root独立验收。当前正式0/3，完整四区附件/响应式/触控NOT VERIFIED，未授权扩大产品。


## 2026-10-23 04:51 CST — 当前候选有限复验与暂停边界

root 独立对当前 Surface84897ee2… / CSSb7160f10… / host3218407b… 执行8文件77/77测试PASS，前后输入hash一致；真实HTTP503错误态居中错误色/88×36重试、键盘不可打开旧结果、真实retry恢复与正确Enter、1440滚动关闭重开及准确HKEX:6969详情返回均有限PASS。准确参考/视口1280×720 DPR2/控制实例/证据及排除项见 `evidence/P3/search-error-visual/ROOT-CHECKPOINT.md`（各子票路径相对于执行记录目录）。当前主服务3333实际浏览器预览可见，故障代理3334已恢复normal后停止；隔离DB未重建，业务库原始表逻辑哈希一致。

P1正式2/3 FAIL、第三轮未启动；P3正式0/3，不因有限checkpoint增加或重置正式轮数。P2三市场冷约2.97秒/重复约3秒且完整图超过64MiB，性能FAIL保持；原始实现及两项授权性能候选均未达完整目标后，按已调用systematic-debugging的“Discuss with your human partner before attempting more fixes”要求等待架构讨论（既有异步问题未回复），四产品文件冻结，未增加新修复候选。建议讨论保持64MiB并验证不可变对象共享；仍只是待选择方案，未实施。P2页面/P4产品/完整附件依赖未解除。

request-body实际消费者OPEN，生产调用图只定位到app handler首次clone之前，未定位原始非GET请求消费者；旧探针预算/首页GET漏记局限及全部原失败保留，无新探针激活或猜测性框架修复。完整当前Workspace回归、整页视觉/控件/响应式/触控仍NOT VERIFIED，已知未实现功能保持FAIL。所有恢复代理实际gpt-6.1-sol / ultra，当前候选已冻结；无提交、推送、合并或发布。
