> 归档说明：以下为原验收时点的文本记录，不是本次重新验收。截图、数据库、日志及私有原件仅本地核查，不随 Git 分发；文中其文件名不是随附证据链接。

# 当前设计与验收索引：最终补充

2026-11-24。参考原稿、owner 和元素映射沿用下方派发前记录；最终接受改由 [最新验收](home-visual-complete-20261124--FINAL-ACCEPTANCE.md)、[R01–R11 独立核销](home-visual-complete-20261124--resume-reconcile--FINAL-CLOSURE.md) 与 最终版本绑定（本地核查，不随 Git 分发） 判定。72 产品文件 hash `1f72c517…`，PID 22566。此前 48 文件 manifest 和“最终浏览器未验”均是历史状态。

| 元素/职责 | 最新接受证据 | 限定结论 |
|---|---|---|
| HP-01/HP-11、HP-03：首页壳层与范围 | R04/R11；`final-v4-home-*`、`final-delivery-home-all-ytd` | 对应状态及 390/断点/1280/1440 视觉、返回通过 |
| HP-02/04/05：金额、持仓、历史贡献 | R04；四金额键盘、CSV、市场路线、分页/横滚 | 具名鼠标/键盘通过，hover NV |
| LIB 与 REVIEW：来源、回合、阶段、图表、绘图、记录 | R01/02/05/06/07/08 | 已登记固定动作核销；未来可见性、实际图/成交、写入/返回/重载各保留独立证据 |
| ANALYSIS：来源身份与写入 | R10 | 七类风险路线及具名写入通过；544/531 数据绑定仍 NV |
| DATA/SETTINGS：导入、现金、本金、行情/汇率、历史 | R03/R09/R11 | 适用冻结实例与断点视觉通过；外部条件/非零迁移 NV |
| NAV-ROOM-HOME | 导航映射（本地核查，不随 Git 分发；本归档未收录原始材料）、v5 最终真实返回 | /home 及来源 URL/市场/期间通过；旧内部 dashboard 路径不扩大断言 |
| DATA-FX-SOURCE | FX 映射（本地核查，不随 Git 分发；本归档未收录原始材料）、`final-v5-fx-*` | 390/599/600/601、1280/1440 下部静态视觉可读 |

root 接受跨组件集成；独立审查由未实现对应 UI 的代理直接审图。设备、工具和条件 NV 不签 PASS。下方是历史派发表和当时门槛，保留精确原稿和范围；冲突时以本段具名新证据为准。

---

## 历史派发表

# 当前整合版的设计与验收索引

2026-11-24补充整合索引；各子任务派发前已有的设计表见 首页（本地核查，不随 Git 分发；本归档未收录原始材料）、交易库（本地核查，不随 Git 分发；本归档未收录原始材料）、数据与设置（本地核查，不随 Git 分发；本归档未收录原始材料）。此表不追认未做过的浏览器验收，也不代替逐控件清单。

触发：用户要求从真实首页开始，继续修复并检查所有可达层级和控件。范围包含弹窗、下钻、交易库、复盘、分析、数据、设置、导入和导出。用户未排除窄屏或某类控件。未开放导航保留禁用登记；每种输入方式独立记录。

root负责整页视觉一致性、跨页面状态与实际持久化接受；局部实现者不能自签视觉通过。最终源码绑定 manifest（本地核查，不随 Git 分发），历史证据只适用于各自版本与数据边界。

## 参考与比较条件

- 首页：[V2.5正文](../../design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md)，当前期间1440稿（本地核查，不随 Git 分发）、历史1440稿（本地核查，不随 Git 分发）及对应1280稿。比较1440×1000、1280×800；390×844与639/640/641、1023/1024/1025两侧验证现有响应式规则。
- 交易库：[V2.0正文](../../design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，批准实盘列表稿（本地核查，不随 Git 分发）。比较1440×1000、1280×800及390×844。
- 复盘：[交互规格](../../specs/2026-09-25-chart-first-review-ui.md) Implementation Decisions §2、§3、§6、§7及[元素E01–E22](../../specs/2026-09-25-chart-first-review-ui-elements.md)，最终参考图（本地核查，不随 Git 分发）。比较1440×900、1280×800、390×844及实际容器断点两侧；手机软件键盘需真机证据。
- 分析、数据与设置：沿用当前已有的字段、标签和页面规范，详见各子任务设计表与 剩余清单（本地核查，不随 Git 分发；本归档未收录原始材料）。未补充新的视觉设计，不将源码外观当作已批准稿。

所有比较需记录CSS视口、100%缩放、DPR、选中对象、日期、展开状态、滚动位置。截图像素尺寸不代替CSS视口。新生产版尚无这些完整条件下的浏览器截图。

## 需求与元素映射

| ID / 范围 | 精确约束 | 实现owner / 接受owner | 用户旅程与验收证据 | 当前结论 |
|---|---|---|---|---|
| HP-01/HP-11，首页壳层 | V2.5布局表：72px导航、64px头栏、外边距24px、模块间距24px | 前轮实现 / root | 市场、账户切换前中后；旧轮截图与最终同态对照 | 最终视觉NOT VERIFIED |
| HP-03，全局范围 | V2.5页头与市场账户联动；保留真实身份和取消语义 | 已有实现 / root | 搜索、筛选、日期应用/清除→下钻→返回/reload；operations.json | 有限实操；最终映射及复验未全 |
| HP-02，指标/当前图表 | V2.5当前表现、图表：金额千分位、两位；原币原精度可查 | homepage_full_control_audit、chart_accessible_amount_fix / root | 焦点Home→日期→金额详情→原精度；home-full/REPORT.md、chart-accessibility-fix.md | 浮点尾数原FAIL保留；代码/定向测试PASS，最终浏览器未验 |
| HP-04，持仓 | V2.5持仓48px行、8行预算、完整名称代码与价格 | 前轮实现 / root | 分市场逐项详情、费用、配对、查看交易及返回 | 六持仓局部证据；部分明细/分页待验 |
| HP-05，历史/贡献 | V2.5历史章节；当前用户已确认默认全部历史、共用年份、分类包含全部 | 已有本地实现 / root | 全部/年份、4指标、分类、市场、分页及精确小计说明 | 48年度+624月度点有限实操；完整列表、最终视觉待验 |
| LIB-SHELL-* | V2.0 §2导航72/页头64/二级栏58、内容x96/right24 | library_shell_fix / root | 首页→交易库，市场/筛选/来源条和窄屏；issues/01-library-shell.md | 原壳层FAIL保留；修复后匹配截图NOT VERIFIED |
| LIB-SOURCE-CLEAR-URL | 清除来源日期后返回、reload不能从旧URL复活；保留账户/标的/返回入口 | library_shell_fix / root | 自定义8月→库→清除→回合→返回→reload；scope测试与root日志 | 定向测试PASS；最终版本重验待做 |
| LIB-VALUATION | 首页真实数据合同；有效本地raw日收与已验证拆股，未知不猜 | library_shell_fix / root | 603087、518880、SNDK逐样核算→详情→返回/reload | 算法26项测试含于74项；实际新版展示待验 |
| E01–E22，复盘完整控件 | 复盘元素表和阶段/截止/未来可见/视野合同 | 既有实现；局部library_shell_fix / root | CTVA逐根→下一决策→计划保存→快照→完成→返回/reload | 核心CTVA实操通过；所有工具/实例/反例未全 |
| E19/E22，记录空间 | 复盘Implementation Decisions §2紧凑底栏与记录入口；本次稳定图表/记录可滚动目标 | library_shell_fix / chart_accessible_amount_fix静态独立复核、root实体验收 | 同阶段展开/折叠，价格轴/侧栏/末条记录/键盘；issues/03-review-record-height.md | 静态复核PASS；最终视觉/滚动NOT VERIFIED |
| ANALYSIS-STRIP-IDENTITY | 点选必须进入对应证券与回合；不改变收益x坐标；可见按钮36/44px及6px间隔 | homepage_full_control_audit / root | 密集0.36/0.48点→华虹1347/雅迪1585；390/1280 | root有限实操PASS；其余点与最终同态视觉待验 |
| ANALYSIS-IPO-LABEL | 沿用可读证券名称、代码、交易日；内部ID只用于路由 | homepage_full_control_audit / root | 4个IPO证据入口逐一进入 | 当时版本有限实操PASS；最终复验待做 |
| DS-CASH-390 | 原表单完整字段和编辑操作，窄屏不裁切；局部表格可聚焦横滚 | data_settings_audit / root | 新建→离开→reload，窄屏创建/编辑及表格滚动 | 保存已有证据；CSS修复后390视觉未验 |
| DS-HISTORY-UNKNOWN | 缺失/无效计数显示—；真实0保留 | data_settings_audit / root | 224批次→旧格式详情→关闭返回 | 旧行空白FAIL保留；新测试PASS，最终新版未验 |
| DS/AN/IMPORT/EXPORT其余控件 | 逐条表单、展开、确认/取消、重试和实际保存/下载 | 已有实现 / root | data-settings/final-report.md与REMAINING-DATA-CONTROLS.md | 仅有限范围实操；不得据日志数量声称全量 |

| LIB-CANONICAL-TITLE | 2026-09-19 trading-room-domain §模拟账户/模拟导入来源；CANONICAL-GROUPING-DIAGNOSIS.md | data_settings_resume实施 / root独立验收 | 模拟盘→TradingView→展开天通回合；统一账户标题，不生成unknown/UABD；legacy run标题保持 | 组件测试11PASS；root最终浏览器视觉待验。仅标题修复，不改变账户、回合或FIFO |

| E-ACTUAL-POSITION-ORDER | statement-evidence.ts:422–430：transaction-position为自身成交后的库存边界，须以fragment+explicit sourceOrder建立顺序；不制造时间/费用 | data_settings_resume实施 / root接受 | 518880第4回合post→实际结果与持仓；最小两笔小样RED/GREEN、真实只读路径、resume-data/518880-POSITION-GAP-FIX.md | ledger+actual-metrics70PASS，真实诊断由false position-gap恢复episode-open/15500；最终build后浏览器NOT VERIFIED。不修原件/第3回合 |

| E-DRAWING-LAYERS-VISIBILITY | 复盘交互规格 §2/§3/§6 图层管理与时间边界：隐藏图形应可再次显示，未来及其他周期图形不提前暴露 | page_queue_reconcile实施 / root独立验收 | 518880第4回合 post→图层→隐藏矩形→显示；全部隐藏后关闭并重新打开面板；切换阶段/游标验证边界 | 原版真实FAIL保留：resume-root/layer-hidden-removed-from-panel.jpg、operations-resumed.json；组件小样覆盖隐藏/显示、全部隐藏重开、未来和其他周期，最终构建后的浏览器及阶段切换 NOT VERIFIED |

## 偏差与放行

无新授权的视觉简化。交易库旧统计/模拟盘业务差异保留登记，不能用本轮壳层修复冒称已实现。保留后续业务来源/返回能力，在正常内容流中布局。复盘固定图表预算是待实体验收的修复方案，不自称设计原文。

功能、端到端持久化、独立视觉分别验收；最终存在必需NOT VERIFIED，当前不放行。完整剩余项见 [覆盖状态](home-visual-complete-20261124--COVERAGE-STATUS.md)与全层级任务（本地核查，不随 Git 分发；本归档未收录原始材料）。
