> 归档说明：以下为原验收时点的文本记录，不是本次重新验收。截图、数据库、日志及私有原件仅本地核查，不随 Git 分发；文中其文件名不是随附证据链接。

# 本轮控件登记及验证

触发：用户要求首页及其附属子页面逐轮视觉检查和修复。范围为完整首页登记，以及持仓详情、日期详情、贡献下钻、首页进入交易库和返回这些读取旅程。所有权root；独立视觉审查round1_review。版本HEAD 3eb5813b7469f828339b9555194f3e98cd84d707，dirty文件精确版本见evidence/final-manifest.json；不以HEAD冒充工作区版本。

服务3421开发、3422本轮生产构建，均显式使用`.data/home-visual-repair-20261123/acceptance.sqlite`隔离库；不使用业务库。默认all/all账户/本年/全部历史；专项选2026明确记录。DPR1。17个实测宽度390–1440见responsive-final-measured.json。最终浏览器恢复默认1280×720。

## 登记与分母

基础完整登记保存于`../home-visual-audit-20261123/evidence/control-inventory.csv`与对应CONTROL-COVERAGE.md：原初态436项包含326日期热点、12历史热点、基础控件/焦点等，含6个禁用项。该旧清单不是本轮点击分母；日期随快照变动，动态实例按业务日期/证券ID识别。本轮没有逐点测试326日期或12年份所有选项，不给全控件通过率。

新增/扩展登记：历史年份面板（4范围种类、单年/起止年/取消/应用）、历史图键盘热点与独立横滚面；持仓详情（关闭/查看交易/费用依据/核对历史平仓）；日期详情（关闭/查看交易）；贡献下钻（市场/分页/证券详情/返回）；交易库来源区（说明/返回/清除）；搜索结果区（输入/清除/关闭/结果/失败重试）。下表按用户旅程合并重复实例，不汇总成伪精确百分比。

## 实际执行

| 区域 | 实际操作及结果 | 状态/证据 | 尚未验证 |
| --- | --- | --- | --- |
| HEADER-FILTER | 触发器/checkbox/应用按钮处Esc关闭并回焦；重开保留ETF草稿；外部关闭。应用ETF后出现chip，再移除；切US丢弃旧市场草稿 | PASS：filter-interactions.json、holdings-search-sort-filter.json、header-controls测试 | 面板清附加/恢复默认、复盘/未平仓各组合；基金为capability禁用 |
| HEADER-ACCOUNT | 打开/选招商6476/显示6476，再选全部；Esc关闭；US候选匹配市场 | 样本PASS：root实际操作；联动见filter-interactions.json | 其余账户逐项、错误/重试 |
| HEADER-SEARCH | 搜SNDK，等待实际闪迪US结果；清除×及Esc关闭 | 样本PASS：root实际操作 | 结果打开、键盘选择、失败/歧义 |
| PERIOD | 自定义起日改11-01后取消，已应用范围不变 | 取消PASS：date-return-settled.json配套实操 | 年/月/周逐项、自定义应用/非法范围 |
| CURRENT-CHART | End/Enter固定有效日11-22；金额两位小数；单日查看交易，周日无成交为空；返回等ready后刷新保留query/排序 | PASS：performance-date-fixed-1440.jpg、date-library-1440.jpg、date-return-settled.json | 动态每点/未来缺口、纯hover、全部口径详情；未settle即reload不作通过 |
| HOLDINGS | All/US/CN/HK settled行48、八槽、历史Y1134稳定；搜索无结果→清除；市值/浮盈排序；SNDK详情→交易库→返回 | 样本PASS：market-geometry.json、holdings-search-sort-filter.json、holding-detail-loaded-1440.png、library-return-result.json | 窄屏最右列、导出下载、长身份hover；快照仅1页，翻页禁用 |
| HISTORY-RANGE/FEE | 全部/单年2026/今年2026应用及取消；2026净47725.67、82笔、46/82、费4121.99无+；历史贡献同步 | PASS：history-year-390.jpg、home-accepted-1440.jpg、production-final-browser.json、production-history-contribution-390.jpg | 任意年/区间/非法范围/失败；全部历史净额及费用未知 |
| HISTORY-KEYBOARD | Home2015/End2026、左右年份、Enter/Space/Esc、点击2017，提示与焦点一致 | 键盘/点击PASS：history-keyboard-final.json、history-tooltip-end-fixed-390.jpg；生产production-history-end-390.jpg | 真实纯hover接管、4指标/所有点、空态/长数值 |
| CONTRIBUTION | 当前↔历史；2026历史全部/多/空/打新点击；A股下钻10项，分页8→2+6空槽→返回；芯片159813详情；排序选择 | 操作样本PASS：contribution-interactions.json、contribution-closed-detail-390.jpg；打新数据缺口仍OPEN | 当前各分类、本地仅看未平仓、所有证券/tooltip/排序组合 |
| LIBRARY-SOURCE | SNDK→Tiger/US/4成交；1440/390来源与36px动作分开；清除仅去日期；返回恢复筛选/焦点/滚动 | PASS：library-source-after-1440/390.jpg、library-return-result.json；生产production-library-1440.jpg及最终JSON | 其它交易库控件、整页V1.0、编辑/撤销/复盘写入 |
| RESPONSIVE | 17宽无全页横溢；1280±1 selector x857；1101导出right1060在标题内；390/600标题上下排，601/1440双列 | 所列布局PASS：responsive-final-measured.json、contribution-heading-final.json、home-accepted-*.jpg、独立review | 其它内容长度/错误/加载组合；横滚局部不等于全列操作 |

证据路径相对于evidence/。root直接看生产1440首页、390历史贡献与1440交易库；独立审查者直接比较批准参考与冻结候选截图。实现者报告不替代上述证据。

## 排除及未验证

本轮不点击一键修复/导入/撤销/编辑/完成复盘，不改原交易事实；这些写流程不因读链通过而接受。主图回放和全套复盘编辑不在首页附属读取路径。未开放导航按说明登记。物理触控、模拟触控、软件键盘均NOT VERIFIED；鼠标点击、键盘、滚动证据分别记录，不能互代。

整页结论：**局部修复通过，完整功能/视觉验收未完成**。未验项保留，不将旧436项分母或18次旅程沿用为本轮覆盖率。
