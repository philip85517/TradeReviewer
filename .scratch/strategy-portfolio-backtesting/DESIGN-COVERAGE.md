# 首轮原型设计覆盖

本文件按时间追加。桌面 v2 提案已在独立目录完成原范围技术验收，见[最终记录](../strategy-desktop-ux-v2/FINAL-ACCEPTANCE.md)；下方旧文档阶段的 NOT VERIFIED 保留为历史，不覆盖该结论。2026-09-30 新策略库与稳定工作台范围以末尾两节为准，均待交互模型与实现验证。

原始来源：[规格](../../docs/specs/2026-09-29-strategy-portfolio-backtesting.md)；[视觉/场景契约](visual-contract.md)。本表只覆盖首轮信息结构原型；R01–R06 后端行为及详细创建/工作台/比较问题留在后续票，不代表整功能覆盖已完成。无批准画板，本次生成候选画面；截图在浏览器验收时保存。

| 需求/元素 | 交付区域 | 阶段/浏览器动作 | 预期及反例 | owner/任务 | 参考 | 证据 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R01/S01 | 应用导航/实验列表 | 打开入口/返回重开 | 合成集合来源可见，不读正式库 | Luna 实现 / 主协调者验收；主导航与操作顺序 | visual-contract.md；无既有画板 | prototype-acceptance.md / screenshots | PASS (prototype only) |
| R02/S03–S04 | 创建/预览 | 选时间策略并预览 | 区分候选目标和已持仓，未来隐藏 | Luna 实现 / 主协调者验收；主导航与操作顺序 | visual-contract.md；无既有画板 | prototype-acceptance.md / screenshots | PASS (prototype only) |
| R03/S05 | 播放/主图 | 下一日、播放暂停至终点 | 图形随游标实际揭示，末尾有反馈 | Luna 实现 / 主协调者验收；主导航与操作顺序 | visual-contract.md；无既有画板 | prototype-acceptance.md / screenshots | PASS (prototype only) |
| R04/S06 | 调仓事件 | 查看第五日事件 | 目标与实际调整可解释，无人工批准 | Luna 实现 / 主协调者验收；主导航与操作顺序 | visual-contract.md；无既有画板 | prototype-acceptance.md / screenshots | PASS (prototype only) |
| R05/S07 | 结果/对比 | 查看结果并切第二组合 | 展示演示净值差异并可返回 | Luna 实现 / 主协调者验收；主导航与操作顺序 | visual-contract.md；无既有画板 | prototype-acceptance.md / screenshots | PASS (prototype only) |
| R06/S02 | 策略包 | 切包/查看规则 | 完整策略说明，不做条件搭建器 | Luna 实现 / 主协调者验收；主导航与操作顺序 | visual-contract.md；无既有画板 | prototype-acceptance.md / screenshots | PASS (prototype only) |
| S08 | 返回/恢复 | 离开列表再打开 | 仅内存恢复清楚标注，刷新重置 | Luna 实现 / 主协调者验收；主导航与操作顺序 | visual-contract.md；无既有画板 | prototype-acceptance.md / screenshots | PASS (prototype only) |
| A/B | 布局/切换器 | URL切换、键盘、窄屏 | 结构不同，输入不误切方案 | Luna 实现 / 主协调者验收；主导航与操作顺序 | visual-contract.md；无既有画板 | prototype-acceptance.md / screenshots | PASS (prototype only) |

## 用户选择后的追加要求

| 需求/元素 | 范围 | 参考与责任 | 验收 | 状态 |
| --- | --- | --- | --- | --- |
| V01：兼容现有 TradeReview 设计风格 | 当前 A 和后续创建、运行、结果原型及正式页面 | [用户追加约束](comments/strategy-visual-03/2026-09-29-resolution.md#用户追加约束与现有-tradereview-风格兼容)；后续主协调者负责整页一致性，派发前绑定实现者 | 匹配视口直接对照现有应用框架、组件、密度与关键状态；既有 PASS 不代替此项 | 本轮创建页PASS；后续运行/结果仍待验收 |

## 第二轮创建原型覆盖（派发前）

准确来源与逐项交互见 [创建契约](creation-visual-contract.md)。未批准像素画板；现有应用截图为视觉参考。

| ID | 规格/参考 | owner | 旅程/预期与反例 | 证据 | 状态 |
| --- | --- | --- | --- | --- | --- |
| C01 | S01/S08；creation-visual-contract.md 对应行 | Luna实现/主协调者整页验收 | 列表新建→回退→重开；内存草稿可达 | creation-acceptance.md + screenshots/creation-* | PASS（prototype only，用户待反馈） |
| C02 | S03/D03；creation-visual-contract.md 对应行 | Luna实现/主协调者整页验收 | 输入日期时间→盘中/周末截止；不偷用完整未来日线 | creation-acceptance.md + screenshots/creation-* | PASS（prototype only，用户待反馈） |
| C03 | R02/D03；creation-visual-contract.md 对应行 | Luna实现/主协调者整页验收 | 盲看切换→截止说明；创建不泄漏未来 | creation-acceptance.md + screenshots/creation-* | PASS（prototype only，用户待反馈） |
| C04 | R01/R03/S03；creation-visual-contract.md 对应行 | Luna实现/主协调者整页验收 | 数据集合/本金/五档期限→摘要同步 | creation-acceptance.md + screenshots/creation-* | PASS（prototype only，用户待反馈） |
| C05 | R06/S02/D04；creation-visual-contract.md 对应行 | Luna实现/主协调者整页验收 | 规则说明/多选/调仓预设→两个独立组合 | creation-acceptance.md + screenshots/creation-* | PASS（prototype only，用户待反馈） |
| C06 | S02/D02；creation-visual-contract.md 对应行 | Luna实现/主协调者整页验收 | 缺必需数据→包禁用，其他包可用 | creation-acceptance.md + screenshots/creation-* | PASS（prototype only，用户待反馈） |
| C07 | S03/D02；creation-visual-contract.md 对应行 | Luna实现/主协调者整页验收 | 部分覆盖→显式确认→修改后撤销 | creation-acceptance.md + screenshots/creation-* | PASS（prototype only，用户待反馈） |
| C08 | S04/D03；creation-visual-contract.md 对应行 | Luna实现/主协调者整页验收 | 候选与目标/实际分离→可知依据/金额 | creation-acceptance.md + screenshots/creation-* | PASS（prototype only，用户待反馈） |
| C09 | S04；creation-visual-contract.md 对应行 | Luna实现/主协调者整页验收 | 无候选→现金100%→创建 | creation-acceptance.md + screenshots/creation-* | PASS（prototype only，用户待反馈） |
| C10 | S03/S04；creation-visual-contract.md 对应行 | Luna实现/主协调者整页验收 | 编辑→失效旧预览→创建→重开 | creation-acceptance.md + screenshots/creation-* | PASS（prototype only，用户待反馈） |
| V01 | 用户风格约束/creation-baseline-1440.jpg；creation-visual-contract.md 对应行 | Luna实现/主协调者整页验收 | 同视口与现有应用框架/密度对比 | creation-acceptance.md + screenshots/creation-* | PASS（prototype only，用户待反馈） |
| V02 | 创建契约；creation-visual-contract.md 对应行 | Luna实现/主协调者整页验收 | 1440/1280/1059/1060/390布局与CTA | creation-acceptance.md + screenshots/creation-* | PASS（prototype only，用户待反馈） |

## 回测工作台第一切片（派发前）

| ID | 来源与参考 | owner/组件 | 旅程及反例 | 证据 | 状态 |
| --- | --- | --- | --- | --- | --- |
| W01 | running-visual-contract.md W01；规格S05/S06/S08与D03；creation-baseline-1440.jpg及creation-preview-1280-final.jpg | running_integration / running-prototype与creation接线；主协调者独立验收 | 准备页开始→运行T0；配置不得丢失 | running-acceptance.md / screenshots/running-* | PASS（prototype only，用户待反馈） |
| W02 | running-visual-contract.md W02；规格S05/S06/S08与D03；creation-baseline-1440.jpg及creation-preview-1280-final.jpg | running_integration / running-prototype与creation接线；主协调者独立验收 | 逐日/播放/末尾；新增真实bar可见 | running-acceptance.md / screenshots/running-* | PASS（prototype only，用户待反馈） |
| W03 | running-visual-contract.md W03；规格S05/S06/S08与D03；creation-baseline-1440.jpg及creation-preview-1280-final.jpg | running_integration（TSX）+ creation_visual（CSS）；主协调者独立验收 | 主图切换与1440/1280/390视觉；控件常驻 | running-acceptance.md / screenshots/running-* | PASS（prototype only，用户待反馈） |
| W04 | running-visual-contract.md W04；规格S05/S06/S08与D03；creation-baseline-1440.jpg及creation-preview-1280-final.jpg | running_integration / running-prototype与creation接线；主协调者独立验收 | 首次/周期调仓/hold/现金；资金账本守恒 | running-acceptance.md / screenshots/running-* | PASS（prototype only，用户待反馈） |
| W05 | running-visual-contract.md W05；规格S05/S06/S08与D03；creation-baseline-1440.jpg及creation-preview-1280-final.jpg | running_integration / running-prototype与creation接线；主协调者独立验收 | 双游标回看恢复/事件定位；不漏未来 | running-acceptance.md / screenshots/running-* | PASS（prototype only，用户待反馈） |
| W06 | running-visual-contract.md W06；规格S05/S06/S08与D03；creation-baseline-1440.jpg及creation-preview-1280-final.jpg | running_integration / running-prototype与creation接线；主协调者独立验收 | 列表重开/配置失效/刷新；仅内存 | running-acceptance.md / screenshots/running-* | PASS（prototype only，用户待反馈） |

## 桌面 UX v2 提案覆盖（文档阶段，未派发）

依据：[设计方案](../../docs/specs/2026-09-29-strategy-desktop-ux-design.md)，评审 D01–D10；用户明确排除 D11 窄屏，并确认完整桌面旅程验收。既有 PASS 仅证明旧原型状态，不证明新提案。所有实现 owner 未分派；文档协调者为 Codex。后续派发前按实际批准画面补齐准确行号/状态截图和单一 owner，不能拿本表摘要代替正文。

共同参考：screenshots/creation-baseline-1440.jpg 为既有风格，screenshots/design-review-running-1440.jpg 为旧运行问题定位；两者都不是新布局批准画板。新设计适用视口只含 1440×900、1280×800。

| 需求/元素 | 精确规格章节 | 所属旅程/可观察结果与反例 | 后续设计任务/owner | 验收依据与证据状态 |
| --- | --- | --- | --- | --- |
| UX01 / E01–E02 | DD01、DD05、DD10 | 切组合同日联动，不共享本金、不残留旧事件 | 工作台/比较；owner未分派 | T01/T04/T08；NOT VERIFIED |
| UX02 / E03、E05–E06 | DD02、DD05、DD12 | 默认净值、摘要、持仓变化；T0不伪造收益日 | 工作台；owner未分派 | T03/T04/T12；NOT VERIFIED |
| UX03 / E04–E05 | DD06 | 推进→回看→返回最新；新bar可见，不泄漏未来轴/事件 | 工作台；owner未分派 | T03/T05/T06；NOT VERIFIED |
| UX04 / E01、E04、E12 | DD07、DD10–DD11 | 快速展开取消/中断、编辑派生、原实验重开 | 工作台；owner未分派 | T07/T08/T11；NOT VERIFIED |
| UX05 / E07–E08 | DD08–DD09、DD12 | 结果→比较→事件回看→返回来源；部分数据不伪装完整 | 比较结果；owner未分派 | T09/T10；NOT VERIFIED |
| UX06 / E09 | DD03 | 四步创建→待开始，按钮语义一致、回退输入保留 | 创建收敛/完整交接；owner未分派 | T01/T02/T12；NOT VERIFIED |
| UX07 / E10 | DD04 | 显式多选→预设→规则详情；未选预设不可编辑 | 创建收敛；owner未分派 | T01/T02/T12；NOT VERIFIED |
| UX08 / E11 | DD04 | 入选/规则不符/数据不足分组，目标/实际分离 | 创建收敛；owner未分派 | T01/T02；NOT VERIFIED |
| UX09 / E01–E12 | DD02、DD13 | 两档桌面五种运行状态及创建/结果；键盘焦点和数字颜色一致 | 整页视觉；owner未分派 | T12；NOT VERIFIED |
| UX10 / E12 | DD14 | 原型标签常驻、工具折叠、关键缺失就近可见 | 全流程；owner未分派 | T02/T11/T12；NOT VERIFIED |
| 跨区域接口/完整状态 | DD06、DD09–DD11、DD15 | V/M/Mᵢ/R和返回来源一致；失败组合不能延伸旧持仓 | 完整会话接线；owner未分派 | T01–T12；NOT VERIFIED |

本轮文档核对见 desktop-spec-verification.md；产品数据库验证不适用于本次文档交付，正式功能要求未撤销。窄屏本轮明确 OUT OF SCOPE，不新增改版或专项验收。

## 第一轮策略库反馈（2026-09-30）

来源：[新规格](../../docs/specs/2026-09-30-strategy-library-and-experiments.md)，SL01–SL15、LD01–LD10、LT01–LT03/LT-J–M。新增反馈后以章节/ID稳定定位；下表旧行号仅保留初版定位，实施前须刷新为最终版本。旧 PASS 只证明各自原型范围，不覆盖新增策略库。

准确图片：`references/2026-09-30-round1-experiment-list.png`（下表简称图 1）为用户当前缺口截图，2348×1346 像素，CSS 视口/DPR/缩放未知；参考顶部导航和实验卡区域。`screenshots/creation-baseline-1440.jpg` 为现有 TradeReview 风格；`.scratch/strategy-desktop-ux-v2/screenshots/08/create-strategy-1440.png` 和 `create-strategy-1280.png` 为旧策略选择状态。新增布局无批准画板，09 必须先提供模型并记录用户反馈，10 派发前绑定具体批准图；不能由实现者自行删减。

语义区域（尚非像素元素契约）：LIB01 策略库/实验导航，LIB02 完整策略列表与详情，LIB03 三类包组装与历史复制，LIB04 实验选择与新建返回，LIB05 运行锁定策略/版本与来源摘要，LIB06 策略包说明/细节与来源返回，LIB07 大量包的查询、标注、统计、置顶/移动和归档恢复。保留旧 E09–E12 与运行状态元素，新模型只补充本轮范围。

下表 owner 表示任务责任：09 已由 Codex 主协调者负责模型、整页画板及完整返回流程，见下方模型产物映射；10 尚未派发，未来指定的单一实现者负责原型，10 主协调者同时负责整页视觉与完整会话流并独立接受，另指派未实现 UI 的视觉审查者。进入实施前必须填入具体代理及精确文件范围。下表功能证据列仍为计划位置，不是已存在通过证据。

| 覆盖 ID / 需求与规格行号 | elementID | 准确画板/图片与区域 | 阶段与状态 | owner / 任务 | 交付区域 | 浏览器操作/模型走查 | 预期与反例 | 证据计划 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SL-C01 / SL01 L23；LD01 L88–90 | LIB01 | 图 1 顶部导航；新画板由09产出 | 空实验、空库 | 09协调者→10实现者 | 策略入口 | 无实验→策略库→返回我的实验 | 两者独立可达；不可仅有实验列表 | 09模型/resolution；10浏览器与截图 | NOT VERIFIED |
| SL-C02 / SL02 L24；LD02 L92–96 | LIB02、LIB04 | 图 1 实验卡；旧create-strategy两档图 | 库有策略、新实验、不同区间 | 09协调者→10实现者 | 库与实验选择 | 同一策略用于两个区间；多策略比较 | 策略复用、独立资金、不同运行；不可覆盖结果 | LT-A/B；10旅程；06比较 | NOT VERIFIED |
| SL-C03 / SL03 L25；LD03 L98–102 | LIB04 | 图 1 新建实验按钮为旧入口；新返回图由09产出 | 实验草稿、新建成功 | 09协调者→10实现者 | 就地新建接线 | 已填时间/期限/本金/选择→新建→返回 | 自动选中新策略且草稿保持；不得重置 | LT-C；10浏览器与状态证据 | NOT VERIFIED |
| SL-C04 / SL03；LD03 L100 | LIB03、LIB04 | 新取消/错误状态由09产出，无旧图 | 未保存、取消、保存失败 | 09协调者→10实现者 | 编辑与返回 | 修改后取消；模拟保存失败并恢复 | 取消保留原选择、失败保留输入；半成品不得混入可运行列表 | LT-C/F；10失败恢复证据 | NOT VERIFIED |
| SL-C05 / SL04 L26；LD05 L110–114 | LIB03 | 新筛选包槽由09产出，无旧图 | 形态包、财务/规模包 | 09协调者→10实现者 | 筛选包选择/说明 | 选择与阅读包、查看脚本扩展说明 | 命名包封装，不拆原子项；脚本能力不能冒称已执行 | LT-D；09模型/10截图 | NOT VERIFIED |
| SL-C06 / SL05 L27；LD02 L96 | LIB03、LIB05 | 新买入槽与无信号状态由09产出 | 形态/规则买入、候选无信号 | 09协调者→10实现者；05承接 | 买入包及事件 | 选择信号包→候选预览→无信号演示 | 入围、信号和成交分开；不能入围即持仓 | LT-D/F/G；10/05旅程 | NOT VERIFIED |
| SL-C07 / SL06 L28；LD06 L116–120 | LIB03、LIB05 | 新固定/移动退出槽由09产出 | 固定、移动、脚本扩展 | 09协调者→10实现者；05承接 | 退出包及规则说明 | 替换固定/移动包→核对摘要/原因 | 三类均明确；不擅定阈值、日内先后和成交价 | LT-D/G；09决策/10/05证据 | NOT VERIFIED |
| SL-C08 / SL07 L29；LD02/LD07 L122–126 | LIB03、LIB04 | 新缺包/不兼容状态由09产出 | 完整、缺包、不兼容、缺数据、无候选 | 09协调者→10实现者 | 完整策略校验 | 各异常→原因→修正/返回 | 定义有效与区间可运行分开；未知不作规则失败 | LT-F；10错误/空状态图 | NOT VERIFIED |
| SL-C09 / SL08 L30；LD04 L104–108 | LIB02、LIB03 | 新历史复制状态由09产出 | 来源策略/历史版本、复制、保存/取消 | 09协调者→10实现者 | 复制与来源 | 复制→替换一包→保存/取消→返回来源 | 新身份与来源明确，旧策略/实验不变；不复制成交 | LT-E；10状态证据 | NOT VERIFIED |
| SL-C10 / SL02/SL08；LD04/LD08 L128–132 | LIB05；旧E04/E07/E08 | v2既有运行/结果参考；新来源摘要由09产出 | 运行锁定、结果回看、旧包不可执行 | 10接线协调者→05/06；01正式持久化 | 运行与历史追溯 | 创建→推进→结果→库变更→重开旧实验 | 锁定旧版本，时间/暴露保留；不得偷偷升级或改旧账本 | LT-G/H；05/06；01隔离库证据 | NOT VERIFIED |
| SL-C11 / SL09 L31；LD01 L88–90 | 不适用：过程门槛 | 09/11对齐后的模型为10的前置参考 | 模型反馈、视觉细化、原型交接 | 09/11协调者→10协调者→07 | 任务依赖与交接 | 走查09与11→10→05→06→07 | 模型先行，真实用户反馈；不可用本轮发布当设计通过 | 各票resolution、frontier | NOT VERIFIED |
| SL-C12 / SL11；LD09；LT-I | LIB01–LIB06、旧E09–E12 | creation-baseline-1440.jpg；v2 create-strategy两档；F01–F09最终参考 | 桌面1440×900/1280×800；空/编辑/选中/错误/包详情首屏与末尾 | 09协调者→10整页协调者＋独立视觉审查者 | 整页密度与现有风格兼容 | 匹配状态直接对照主题、字体、侧栏、间距、边框、控件、焦点；查详情再返回 | 页面延续现有视觉语言；返回常驻；不能仅以深色或DOM判定通过 | 09修订静态审阅；10独立视觉及键盘证据 | NOT VERIFIED（功能/最终视觉） |
| SL-C13 / SL10；LD09；LT-J | LIB06、LIB02–LIB05 | M11/F03/F09；feedback2/f09-1440.png、f09-1280.png及scrolled/return图 | 目录、组装、选择、完整策略详情、锁定实验 | 09主协调者→10完整会话owner | 包详情及逐层返回 | 点入指定包版本→规则/参数/数据/适用范围→返回来源，键盘/浏览器返回分开验证 | 查看不选包/升级；搜索/滚动/待选/草稿/运行保持，历史值不替换最新版 | M11状态表、09反馈resolution；10 LT-J完整旅程 | NOT VERIFIED（业务操作） |
| SL-C14 / SL12；LD10；LT-K | LIB07 | M12/J4；F10目录、F12标签备注；截图feedback3/f10-1440.png与f10-1280.png | 三类目录、多页、搜索/筛选/排序、空/无匹配、返回 | 09主协调者（模型/整页）→10完整会话owner | 查找及标注 | 搜索标签/名称→分页→详情→返回→改标签备注 | 匹配数及原处返回；标签不改变执行版本；置顶不越过筛选 | 本轮静态审阅；10 LT-K；正式隔离库刷新 | NOT VERIFIED（业务操作） |
| SL-C15 / SL13；LD10；LT-K | LIB06/07 | M12统计表；F10使用列、F12统计/引用明细；feedback3/f12两档 | 包级/版本级/历史、已知/未知 | 09主协调者→10完整会话owner | 统计与时间元数据 | 查看使用数→引用明细→某策略→原包 | 按策略身份去重；版本子集/历史分列；开发/导入/发布分开；未知不作0 | 10 LT-K口径与多层返回；本轮样例只审设计 | NOT VERIFIED（业务操作） |
| SL-C16 / SL14；LD10；LT-L | LIB07 | M12移动规则；F10置顶、F11整理；feedback3/f11两档 | 个人置顶、两组手动顺序、跨页、保存/取消/失败 | 09主协调者→10完整会话owner | 置顶和移动 | 查询中置顶→整理全部该类包→移动至N→保存/取消→回查询 | 非手动排序不可直接移动；取消不提交；原查询恢复；不改变业务顺序 | 10 LT-L鼠标/键盘分开；正式偏好重开 | NOT VERIFIED（业务操作） |
| SL-C17 / SL15；LD10；LT-M | LIB06/07 | M12归档/恢复；F12详情、F13确认；feedback3/f13两档 | 有引用/无引用/统计未知、活动草稿、失败、恢复 | 09主协调者→10完整会话owner | 单包生命周期 | 归档→保留原引用→已归档查找→恢复→原身份 | 全版本归档不删历史；新槽位禁选；已有策略可继续使用；复制显式确认；恢复普通组末尾 | 10 LT-M；正式隔离库引用/快照不变证据 | NOT VERIFIED（业务操作） |

正式持久化 LT-H 属于 01 后续生产切片：策略和实验保存→返回→刷新/重开必须使用隔离 SQLite；标签/备注/归档和个人排序同样须验证真实保存。此轮文档与未来合成原型不得签署该门槛通过。回放相关动作继续按既有截止/视野/暴露来源表，不因新增策略库重置任何已保存运行。

### 09 模型产物映射（修订 03，规模化管理反馈）

本轮模型/画板 owner：Codex 主协调者。独立模型复核：strategy_todo_audit；独立截图审阅：verify_compaction_config。只负责文档，不把角色名当作任务 10 的实施派发。正文见[交互模型](strategy-library-interaction-model.md)，真实浏览器截图位于 `strategy-library-wireframes/screenshots/fNN-1440.png` 和 `fNN-1280.png`，NN 与下表画板号完全对应；[审阅记录](strategy-library-model-review.md)区分静态检查与下游未验证门槛。

| 覆盖与语义区域 | 模型准确章节 | 画板/区域与本轮可观察证据 |
| --- | --- | --- |
| SL-C01 / LIB01 | M01、M03–M04、J1 | [F01](strategy-library-wireframes/index.html#f01)：策略库/我的实验并列，完整策略及三类目录 |
| SL-C02 / LIB02、04 | M02、J1 | [F01](strategy-library-wireframes/index.html#f01)、[F05](strategy-library-wireframes/index.html#f05)：可复用版本与每组合独立本金 |
| SL-C03 / LIB03、04 | J2、M05 | [F02](strategy-library-wireframes/index.html#f02)来源/保存去向；[F05](strategy-library-wireframes/index.html#f05)返回成功、原选择和新策略并存 |
| SL-C04 / LIB03、04 | J2、M09–M10 | [F02](strategy-library-wireframes/index.html#f02)底部取消；[F07](strategy-library-wireframes/index.html#f07)保存失败与输入保留；取消变更提示由 J2 规定 |
| SL-C05 / LIB03 | M06 | [F02](strategy-library-wireframes/index.html#f02)第一槽；[F01](strategy-library-wireframes/index.html#f01)财务规模样例；脚本/命名包说明 |
| SL-C06 / LIB03、05 | M02、M06、M09 | [F02](strategy-library-wireframes/index.html#f02)第二槽；[F01](strategy-library-wireframes/index.html#f01)规则入场样例；无信号/未成交由状态表规定 |
| SL-C07 / LIB03、05 | M06–M07 | [F03](strategy-library-wireframes/index.html#f03)固定、移动及脚本退出；当前与待选分开 |
| SL-C08 / LIB03、04 | M06–M07、M09 | [F07](strategy-library-wireframes/index.html#f07)缺包和区间缺数据；其他异常由 M09 逐项规定 |
| SL-C09 / LIB02、03 | J3、J3-L、M08 | [F04](strategy-library-wireframes/index.html#f04)历史版本/复制；[F08](strategy-library-wireframes/index.html#f08)旧整体包显式映射 |
| SL-C10 / LIB05 | M05、M08 | [F06](strategy-library-wireframes/index.html#f06)锁定定义、复制策略与派生实验分开；具体来源返回见 M05 表 |
| SL-C11 / 过程 | 第 8 节、09 任务 | [用户反馈](comments/strategy-visual-09/2026-09-30-feedback-resolution.md)认可整体并提出两项条件；新增画板反馈与09/11对齐未完成，10继续阻塞 |
| SL-C12 / LIB01–06 | M04、M10、第 7 节 | 初版F01–F08截图保留；修订F09两档及滚动/返回态在screenshots/feedback2，独立静态风格对照见审阅记录；最终功能/视觉仍留给下游 |
| SL-C13 / LIB06 | M11、M05 | [F03](strategy-library-wireframes/index.html#f03)“说明与细节”→[F09](strategy-library-wireframes/index.html#f09)→原选择列表，顶部及底部返回常驻；各来源和状态保留见M11 |
| SL-C14 / LIB07 | M12/J4 | F10大量包目录、F12标签备注，所有统计均标设计样例 |
| SL-C15 / LIB06/07 | M12统计表 | F10使用数、F12当前/历史引用与开发/版本发布时间 |
| SL-C16 / LIB07 | M12置顶与移动 | F11独立整理模式、两组位置和保存/取消；原查询返回契约 |
| SL-C17 / LIB06/07 | M12归档与恢复 | F12管理入口→F13影响确认→取消回详情；恢复/失败/已有引用语义见正文 |

修订03静态画板派发：`library_scale_boards`（gpt-5.6-luna）只编辑 `strategy-library-wireframes/build.py` 与生成 `index.html`，依据 M12/F10–F13 和上述 SL-C14–17；其他文件由主协调者维护。沿用现有200px侧栏、48px身份栏、字体/深色/蓝色控件；1440×900与1280×800核对密度及返回常驻。不授权修改业务应用、数据库、09/11生命周期或自动提交。整页与状态模型 owner：主协调者；无产品持久化实现。独立截图审查：verify_compaction_config，不参与画板写入。

整体模型认可已有真实用户依据，新增规模管理需求已纳入；具体新画板尚待用户审阅。模型表达/静态渲染检查与功能接受分开；SL-C01–17 的真实业务状态仍为 NOT VERIFIED。09保持open，本轮没有接受10或11。

## 稳定工作台反馈（2026-09-30）

来源：[风格比较与设计方案](../../docs/specs/2026-09-30-strategy-stable-workbench-design.md)：差异表 L13–26、SW01–SW10 L36–45、WD01–WD07 L100–177、WT01–WT03 L181–212。行号定位本稿，ID/章节为稳定定位。图 1/图 2 业务对象、原始像素与截图尺度不同，不能做像素相等比较或由截图认定运行时抖动根因。

准确参考简称：**W图1** = [当前工作台](references/2026-09-30-round1-workbench-current.png)，2460×1498 像素，待开始/T0/单组合/净值；**W图2** = [TradingView](references/2026-09-30-round1-tradingview-reference.png)，2864×1662 像素，重点图下红框回放带及连续工具区。两图 CSS 视口/DPR/缩放未知。**旧基线** = [TradeReview 1440 截图](screenshots/creation-baseline-1440.jpg)。11 要产出新模型画板；实施前用其具体批准状态替换“待11产出”，不能把问题截图当批准画板。

语义元素：WB01 身份/模式，WB02 四项摘要带，WB03 主图及局部工具，WB04 图下回放条，WB05 固定状态位，WB06 右侧检查区，WB07 可展开明细，WB08 配置/菜单。LIB01–05 继续由上节约束。

责任：本次文档协调者为 root；后续11领取协调者负责模型，05/06领取协调者分别负责完整工作台/比较体验，10负责新创建接线。整页视觉与完整会话流由后续主协调者分别明确单一 owner，另指派未实施 UI 的视觉审查者。尚未分配新的实现代理或写入文件，以下是任务责任/证据计划，不是实施派发或通过记录。实现前必须回填具体 owner、批准画板与互斥文件范围。

| 覆盖 ID / 需求与规格行号 | elementID | 准确图片/区域 | 阶段与状态 | owner / 任务 | 交付区域 | 浏览器操作/模型走查 | 可观察预期与反例 | 证据计划 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SW-C01 / SW01；WD01 L100–104 | WB01、LIB01 | W图1页头/组合；W图2顶工具带；新画板待11 | 库/列表/创建/工作台 | 09/11模型→10/05协调者 | 共同框架锚点 | 库→创建→工作台→列表重开 | 导航、标题和返回锚点稳定；不把所有内容强塞相同空图表 | 09/11模型合并；10/05完整旅程 | NOT VERIFIED |
| SW-C02 / SW02；WD02 L106–121 | WB02、WB03 | W图1四指标卡/主图；W图2图表主体；新画板待11 | T0/运行/暂停/回看/完成 | 11模型→05整页owner | 摘要与主图 | 数字更新、切组合和日期 | 四指标固定行、主图两档最小高度；不因金额变长换行 | WT-B/D；05两档截图/几何记录 | NOT VERIFIED |
| SW-C03 / SW03；WD03 L123–131 | WB04 | W图2红框日期/播放/单步/速度；W图1时间条 | 待开始/播放/暂停/末尾/结果 | 11模型→05实现owner | 图下回放 | 播放暂停、下一日、调速度、返回最新 | 播放暂停同槽、单步独立、点击区≥36；结果禁用仍保留槽位 | WT-A/F；控件状态表、键盘及录像 | NOT VERIFIED |
| SW-C04 / SW04；WD03 L126–128、WD04 L150 | WB01、WB03、WB04、WB08 | W图1时间长条/恢复区；W图2分组工具带 | 观察/结果/比较/净值/K线/展开取消 | 11模型→05/06协调者 | 操作分组与低频动作 | 切模式→更多→展开→取消→返回观察 | 推进与查看分组，低频可发现；不能删恢复路径或静默推进 | WT-A/C/G；05/06完整旅程 | NOT VERIFIED |
| SW-C05 / SW05；WD02 L116–118、WD05 L152–158 | WB05、WB06、WB07 | W图1右侧持仓/事件/空状态；新画板待11 | 空/加载/长错误/失败/重试 | 11模型→05整页及会话owner | 固定状态与检查区 | 缺数据/执行失败→详情→重试/排除 | 错误可读可恢复，原完整投影保留；不插横幅挤走主图、不隐藏失败 | WT-B/D/G；两档异常图/过渡记录 | NOT VERIFIED |
| SW-C06 / SW06；WD04 L133–150 | WB01–WB06 | W图1日期与主图；旧v2状态契约DD06/DD09；新画板待11 | 推进/回看/下一已知事件/回到最新 | 11模型→05会话owner | 截止/可见性/视野 | 连续推进超初始视野→回看→定位事件 | 新bar实际可见，V/M/Mᵢ/R分离，过去不漏未来；不只改游标文字 | WT-C/E；真实图表及来源记录 | NOT VERIFIED |
| SW-C07 / SW07；WD04 L142–143、WD06 L162、WD07 L175 | WB03、WB06、WB07 | W图2底明细面板仅分区参考；结果/完整事件详情图待11 | 结果/比较/单组更晚区间/事件返回 | 11模型→06协调者 | 结果/比较与来源 | 结果→事件日观察→关闭详情→返回来源→展开明细 | 全工作区投影至事件日、M/Mᵢ不变；完整解释在320px可读；返回恢复R/筛选/滚动/视野 | WT-C；06截图/状态/来源旅程 | NOT VERIFIED |
| SW-C08 / SW08；WD06 L164 | WB01、WB08、LIB05 | W图1查看配置入口；新三类包来源图待09/11 | 只读配置/查库/复制/派生/关闭 | 09/11模型→10/05会话owner | 策略身份与配置 | 看锁定配置→查当前库→返回旧实验 | 锁定包版本保持，关闭焦点归位且不自动播放；不覆盖原运行 | WT-G、LT-E/G；10/05状态证据 | NOT VERIFIED |
| SW-C09 / SW09；WD03 L125–131 | WB01–WB08 | W图2紧凑控件；旧基线字体/主题；新焦点图待11 | hover/focus/禁用/输入/IME | 11模型→05/06实现owner及独立审查者 | 可读性与键盘 | Tab/Space/Escape、输入中文、关闭详情 | 中文名称/禁用原因可读，关键字≥12；不靠hover解释一切、不误播放 | WT-F；鼠标/键盘与物理IME分开记录 | NOT VERIFIED |
| SW-C10 / SW10；WT02 L189–198、WD05 L156 | WB01–WB06与绘图区 | W图1/W图2为方向；11匹配画板待产出 | 两档同DPR/缩放/导航；连续全状态 | 05/06协调者＋独立视觉审查者 | 几何与过渡验收 | 连续切换并逐态采样、查看中间帧 | 非主动重排≤1CSSpx目标；无塌陷，回早期日/切组合不得暂留越界旧图；最终两图一致不能证明过程 | WT-A–G；录像/边界表/两档对照 | NOT VERIFIED |
| SW-C11 / SW02/05/09；WD02/05；WT-D L207 | WB01、WB02、WB05–WB07 | W图1当前密度；压力状态画板待11 | 长策略名/六组/大金额/长表/长错误 | 11模型→05/06整页owner | 内容压力与滚动归属 | 换最长名称、金额、错误；滚明细 | 外框不换行、信息完整可达、图表不低于最小值；不缩字掩盖 | WT-B/D；两档截图与滚动证据 | NOT VERIFIED |
| SW-C12 / SW10；WD07 L166–177；下一步L233–235 | WB01–WB08、LIB01–LIB05 | W图1/2＋旧基线；待09/11合并批准图 | 模型→原型→完整交接 | 09/11→10/05/06→07协调者 | 设计依赖与原证据边界 | 核对替代关系、授权偏差、全部journey | 先模型后开发，功能/安全/视觉独立接受；不以旧PASS或新文档代替UI | resolution、frontier、07完整交接 | NOT VERIFIED |

本轮无浏览器/图表/位移新证据。1440×900 与1280×800的尺寸、≤1CSSpx容差是模型验证目标；主动resize、应用导航/明细展开及跨内容类型例外按WT02分别记录。业务库验收本轮不适用，正式写入链仍按隔离库验证；窄屏本轮未授权改版。

## 11 视觉交互模型派发（2026-09-30）

用户授权开始视觉交互设计，11 由 root 领取。SW-C01–12 的本轮模型覆盖、状态与反例逐项对应 [画板契约](workbench-design/README.md#画板契约与文件所有权)：原图1/图2与 WD01–07 为输入，候选 A/B/C 不作已批准设计。WB01–08 初版由 workbench_visual_model（Luna）在独立 `workbench-design/index.html` 内实现，冻结后root串行修正；root 为整页视觉及完整内存场景流 owner，workbench_design_comparison 为未实施画板的独立审查者。只有 root 写文档/证据；不修改应用代码或既有原型。

本轮证据落 `workbench-design/evidence/`，每行初始 NOT VERIFIED；这里只验证视觉模型操作和布局，真实图表、生产回测和数据库仍是下游门槛。用户选型待真实反馈，不能因画板可运行而关闭11。

## 11 本轮模型交付（2026-09-30）

[画板说明](workbench-design/README.md)记录A/B/C候选、实际尺寸、准确参考、所有权与待选差异。[检查记录](workbench-design/ACCEPTANCE.md)保留首轮FAIL、修正和独立截图复验PASS。root完成两档浏览器关键模型路径；A的主图、回放、状态和320px检查区在采样状态位置一致，控件槽位最终读数见证据。SW-C02–05/07/09/11已有模型截图与部分操作证据；SW-C06/10仅完成有限合成模型采样，真实图表/连续过渡帧仍NOT VERIFIED；SW-C01/08/12的09导航合并、完整应用链路与用户批准仍NOT VERIFIED。上表实施验收列保持未通过，模型证据不能替代05/06/10。

推荐A；B图高缩短、C覆盖图表右缘是候选取舍，未获用户授权作为正式偏离。11保持open / integration-pending，用户决定后再记录独立resolution和批准画板，不能直接进入生产实施。

## 11 第二轮：A 已选，清晰度门槛重开（2026-09-30）

准确参考：[用户标注图](references/2026-09-30-round2-workbench-feedback.png)；原 TradingView 参考不变。[独立评审](workbench-design/REVIEW-02.md)是本轮发现及建议来源，[决定记录](comments/strategy-visual-11/2026-09-30-a-selection-and-clarity-review.md)只确认 A 布局。root 负责整页与完整状态整合；本轮只读审查不派发实现，后续唯一实现 owner 待分配；ui_clarity_review / chart_semantics_review 为独立审阅者。

| 评审ID → 需求 / 元素 | 精确区域与状态 | 旅程与验收证据 | 当前结论 |
| --- | --- | --- | --- |
| 用户选A → SW01/02 / WB01–06 | A 固定主图、右侧详情方向 | 用户“选择A”及决定记录 | PASS（布局选择） |
| UR01–02 → SW02/06 / WB03 | A K线完成态，两档截图 review-02-evidence/a-candle-complete-1440.png、a-candle-complete-1280.png | 8px实体及133/111px间距；最小OHLC→推进→回看；后续核对标的/周期/轴 | FAIL；修订未实施 |
| UR03–04 → SW03/09 / WB03–05 | 用户红框图表工具、回放日期/速度/最新 | 单步→回看→返回最新；图标动作；名称/禁用原因；浏览器+源码记录 | FAIL；修订未实施 |
| UR05 → SW04/07 / WB01/03/06 | review-02-evidence/a-results-inherited-candle-1440.png、a-compare-inherited-candle-1440.png | K线→结果/比较→事件→来源返回；图形/图例/标签/对象/截止一致 | FAIL；修订未实施 |
| UR06 → SW05/06 / WB04/06/08 | T0与6/19无下一已知事件；源码L353/357 | 无事件→继续一日，不诱导展开未来；完成态无后续有准确反馈 | FAIL；修订未实施 |
| UR07–08 → SW01/04/09 / WB01/04–06/08 | 用户红框场景、模式、检查区及时间上下文 | 首次进入→明确对象/日期/下一步；收起开发工具，业务时间仍完整 | FAIL（专家评估）；用户任务测试NOT VERIFIED |
| 09合并 → SW08/10 / LIB01–05/WB01/08 | 库/实验/工作台共同导航与策略身份 | 09/11共同契约后交10/05/06 | NOT VERIFIED |

上文历史模型 PASS 不覆盖本表 FAIL。下一次实施派发前补具体修订画板、实现文件 owner 和证据路径；当前不能关闭11或宣布已修复。

第三轮的桌面原型修复已由 root 在真实浏览器完成并整合，repair_acceptance_review 作为未参与实现的视觉复核者直接检查最终截图后通过 UR01–08 的桌面修复范围。上述证据仍不关闭 11：最终持仓/现金汇总补充已由 final_supplement_review 独立复核通过；09 共享导航整合、正式实现/隔离持久化和首次用户任务研究仍待完成。

## A 方案确认修复（2026-09-30 第三轮）

用户确认修复 UR01–08；逐项来源与状态转移见 [修订契约](workbench-design/REPAIR-03-CONTRACT.md)。root 负责整页/状态集成及真实浏览器验收，repair_workbench（Luna）唯一实现 owner，独立 reviewer 负责读图。

| ID/规格 | elementID | 精确参考/状态 | owner/交付 | 浏览器旅程与反例 | 证据 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| UR01–02 / SW02、WD02 | WB03 | REVIEW-02 UR01–02；accepted-first-trade-1280.png、accepted-long-run-1280.png、accepted-complete-k-1280.png、accepted-t0-review-1280.png | root final integrator；Luna initial implementation | T0历史→推进→长窗口→回看；独立 OHLC，未来不入图/轴 | continuous-frames-1440.json、continuous-frames-1280.json；1440×900 与 1280×800，DPR1 | PASS（桌面原型修复，含持仓补充复核） |
| UR03 / SW03、WD03–04 | WB04 | round2-workbench-feedback 底部红框；accepted-first-trade-1280.png、accepted-long-run-1280.png | root final integrator；Luna initial implementation | 播放/暂停/逐日/回看/最新/末尾；动作有文字且槽位固定 | accepted-geometry-1440-compare.json、accepted-geometry-1440-event.json | PASS（桌面原型修复，含持仓补充复核） |
| UR04 / SW04、SW09 | WB03 | 同图图表右上红框；accepted-complete-k-1440.png、accepted-complete-k-1280.png | root final integrator；Luna initial implementation | 文字切换、真实缩放/说明；无伪交互 | accepted-complete-k-1440.png；真实 Lightweight Charts 运行记录 | PASS（桌面原型修复，含持仓补充复核） |
| UR05 / SW06–07、WD06 | WB01/03/06 | REVIEW-02 结果/比较截图；accepted-complete-k-1440.png、accepted-event-1440.png、accepted-zoom-pan-before-1440.png、accepted-zoom-pan-return-1440.png | root final integrator；Luna initial implementation | K线→结果→比较→事件→来源→观察；标签数据一致，恢复视野 | accepted-geometry-1440-compare.json、accepted-geometry-1440-event.json | PASS（桌面原型修复，含持仓补充复核） |
| UR06 / SW05、WD04 | WB05/06 | REVIEW-02 UR06；accepted-t0-review-1280.png、accepted-event-1440.png | root final integrator；Luna initial implementation | T0/无后续/末尾；不诱导揭示未来，完成态有准确反馈 | accepted-failure-boundary-1280.png、accepted-failed-excluded-1440.png | PASS（桌面原型修复，含持仓补充复核） |
| UR07 / SW04、WD01 | WB01/05/08 | round2 图场景红框；accepted-pressure-1280.png | root final integrator；Luna initial implementation | 默认 A 工具关闭；无全局方向键切版；长名/多组合保持可读 | continuous-frames-1440.json、continuous-frames-1280.json | PASS（桌面原型修复，含持仓补充复核） |
| UR08 / SW01、SW09、WT02 | WB01–08 | round2 所有红框/TradingView参考；accepted-pressure-1280.png、accepted-event-1440.png | root final integrator；Luna initial implementation；repair_acceptance_review 独立视觉复核 | 两档业务时间/来源/压力/错误；稳定且可读 | 1440：218 帧、最大框架位移 0、overflow 0；1280：269 帧、最大框架位移 0、overflow 0；browser warnings/errors 为空 | PASS（桌面原型修复，含持仓补充复核） |

## 09 修订04 · 实验入口归属（2026-09-30）

用户要求实验的创建、选择和使用策略全部归“我的实验”；取代修订01–03的库内“用于新实验”提案，不改任务11范围。规格依据：模型M13（含用户原话）、SL16/LD11/LT-N；参考图：`screenshots/creation-baseline-1440.jpg`、`../strategy-desktop-ux-v2/screenshots/08/create-strategy-1280.png`、`strategy-library-wireframes/screenshots/feedback3/f10-1440.png`和`f10-1280.png`。新截图目录为`strategy-library-wireframes/screenshots/feedback4/`。

| 需求 / elementID | 精确设计 / 状态 | owner / 交付 | 浏览器旅程与反例 | 证据 / 状态 |
| --- | --- | --- | --- | --- |
| SL16 / LIB01、02 | M13；F01/F04管理入口、全局业务tabs | 主协调者整页/模型；Luna画板 | 库无新建实验/用于实验；tab切F14不创建；F19保存只归库 | feedback4/f01、f04、f19两档及1280滚底；静态布局/来源PASS，保存状态NOT VERIFIED |
| SL16 / LIB08 | M13；F14列表、空态/状态说明 | 同上 | 我的实验可达；新建→F15，草稿与已有运行的重开语义区分 | feedback4/f14两档首屏/末尾；静态PASS，研究区间缺口FAIL已修复并保留before-fix图 |
| SL16 / LIB09 | M13；F15–F18同一策略四步样例 | 同上 | 列表→起点→主动选库中策略→预览→确认；上一步不串样例、不自动成交 | feedback4/f15–f18两档及journey-links.json；静态路径/独立视觉PASS，F16数据可用性FAIL已修复，真实选择/保存NOT VERIFIED |
| SL03/16 / LIB03、04、06 | M13/J2；F02/F03/F09实验来源，F05成功后态，F19无来源 | 同上 | 实验内新建/包详情逐级退回；取消保持原选择；库来源不出现实验保存CTA | feedback4/f02/f03/f09两档首屏/末尾及返回路径；静态PASS，业务状态NOT VERIFIED |

派发只允许 library_scale_boards、续作finish_entry_boards（均为gpt-5.6-luna，先后交接）修改`strategy-library-wireframes/build.py`及生成`index.html`；所有模型/spec/票由root唯一维护。不派生代理、不自动提交、不触业务库。样例导航可点击，保存/运行仍静态；相同当前状态对照1440×900、1280×800。独立视觉审查由未实施画板的entry_visual_review执行；真实持久化N/A（仅文档），任务10功能仍NOT VERIFIED。09继续open，10仍被09/11阻塞。

## 09 修订05 · 列表工具栏与卡片审视（2026-09-30）

规格：SL17 / 模型M14（稳定标题定位）；本次用户明确要求两页顶部搜索、筛选、排序，并要求卡片评估建议。原稿为修订04 F01/F14的两档截图；既有产品基线仅作风格参考。root负责整页和跨页语义；本轮无数据接线或数据库写入；finish_entry_boards（Luna）只改生成器及HTML，entry_visual_review只读独立审图。卡片重构不在本轮实施范围。

| 需求 / elementID | 精确参考与状态 | owner / 交付 | 浏览器旅程与反例 | 证据 / 状态 |
| --- | --- | --- | --- | --- |
| SL17 / LIB10 | M14；feedback4/f01-1440.png、f01-1280.png；完整策略3条默认列表 | Luna工具栏；root整页 | 业务tab进入F01，顶部能辨识搜索/筛选/排序及方向；不出现实验CTA | feedback5/f01两档、after-measurements.json、journey-links.json；静态布局/导航及独立视觉PASS |
| SL17 / LIB10 | M14；feedback4/f14-1440.png、f14-1280.png；实验5状态列表 | 同上 | 业务tab进入F14，工具栏同层级，不挤出排序；新建仍指向F15 | feedback5/f14两档及相同JSON；静态布局/导航及独立视觉PASS |
| SL17 / LIB01、LIB08 | M14；F01/F14两档现有卡片 | root评估；独立reviewer复核 | 测量卡高/首屏密度，分析冗余及动作；建议不冒充已实施 | feedback5/before-measurements.json与before-f01/f14两档；strategy-library-card-ui-review.md评估已交付，卡片重构未实施 |
| SL17 / LIB10功能 | M14查询组合/返回/空态；任务10 | 后续任务10；本轮不接线 | 真实搜索筛选排序→详情→返回，保留列表状态；不得更改运行或版本 | NOT VERIFIED（后续功能原型） |

授权差异：仅两页顶部工具栏补齐与一致性调整；卡片不变。1440×900、1280×800、100%缩放/DPR1比较。静态链接导航与视觉是本轮门槛；持久化 NOT APPLICABLE（无业务写入），移动端和真实触屏仍未验证。09/10生命周期不变。

## 工作台 A 风格对齐（2026-09-30 第四轮）

用户要求与原网页一致，重新打开本轮视觉门槛；第三轮证据仍作为行为基线。逐项来源、准确截图、所有权、旅程、反例与证据计划见 [STYLE-04-CONTRACT](workbench-design/STYLE-04-CONTRACT.md)。下表保留实施前映射，最终证据见 [第四轮验收](workbench-design/STYLE-04-ACCEPTANCE.md)：

| 需求 / 元素 | 精确来源 / 状态 | owner / 交付 | 用户旅程与反例 | 证据 / 状态 |
| --- | --- | --- | --- | --- |
| ST01 / WB01–08 | contract ST01；globals.css L3–29；creation-baseline-1440.jpg | style_alignment（Luna）样式；root整页/状态 | 完成→模式切换；原站暗色细线，无新亮蓝皮肤 | style-04-evidence/complete-{1440,1280}.png；PASS |
| ST02 / WB01/04/05/08 | contract ST02；layout.tsx字体、原站品牌；pressure状态 | 同上 | 长名/数值仍可读，真实品牌与字体一致，不缩字 | pressure-1280.png；PASS |
| ST03 / WB01/03/04/05/06 | contract ST03；globals.css L851–969/L1866–1890；配置与事件 | 同上 | 主次/选中/禁用/焦点有统一语义，动作保留文字 | running-1280.png、event-1440.png、config-1440.png；PASS |
| ST04 / WB03/04 | contract ST04；globals.css图表与涨跌；第三轮真实K线 | 同上 | T0→新K/成交→回看→最新；只换图表主题，不改时间/间距 | t0-1280.png、first-trade-1280.png、compare-1440.png；PASS |
| ST05 / WB01–08 / WT02 | contract ST05；REPAIR-03固定几何；1440/1280/1300断点两侧 | root实际浏览器；original_style_audit独立视觉 | 结果/比较/事件/失败/压力同框架，≤1px非主动位移；无裁切 | geometry.json、failure-1280.png、visual-review.md；PASS |

ST01–05本轮桌面原型验收通过：root实际操作功能/状态与稳定性，original_style_audit独立直接看图；本地字体与许可证由root补齐。两档前后外框变化0px，连续采样4466/2112帧位移及溢出均0；1299/1301断点另行看图通过。正常预览无audit采样文字，3051服务保持运行。任务11仍open / integration-pending，09导航与正式持久化不在本轮范围。

## 09 修订06 · 元素规范与用户文案（2026-09-30）

用户指出面包屑空格、输入/线框尺寸、字体颜色和debug文案问题，重新检查全19张画板的一致性。实施前完整映射见[STYLE-06-CONTRACT](strategy-library-wireframes/STYLE-06-CONTRACT.md)：UI06-01–05 / LIB11，包含准确参考、两档视口、授权差异、owner及旅程。root负责整页与跨页语义，finish_entry_boards中间稿后中断，finish_style06（gpt-5.6-luna / medium）接手唯一实现build.py/index.html，entry_visual_review独立直接读图；其他共享文档由root维护。

| 范围 / 元素 | 参考与状态 | 用户旅程 / 证据计划 | 状态 |
| --- | --- | --- | --- |
| UI06-01 / LIB11 导航 | 契约UI06-01；F18四级、F02五级、其他17页 | CSS间距一致，当前项明确，原返回路径；feedback6截图/geometry | NOT VERIFIED |
| UI06-02–03 / LIB11 控件/文字 | 契约UI06-02–03；两档表单、列表、详情、归档 | 40px表单、36px按钮、正文层级/边框一致，无裁切；独立视觉对照 | NOT VERIFIED |
| UI06-04–05 / LIB06–11 文案 | 契约UI06-04–05；F01–F19 | 产品区移除工程说明；版本/数据/费用/归档语义保留；来源和返回不变 | NOT VERIFIED |

真实保存/搜索/运行不在静态范围，仍NOT VERIFIED；无数据库写入，持久化NOT APPLICABLE。任务09保持open / prototype-feedback；不因视觉修订关闭模型决策票或启动任务10。
