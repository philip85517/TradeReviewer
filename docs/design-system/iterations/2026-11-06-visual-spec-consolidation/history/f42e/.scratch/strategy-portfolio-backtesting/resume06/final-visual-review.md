# 修订06独立视觉复核（历史 FAIL 保留）

审查者：style06_final_visual，未参与 UI 实现。只读取规格、参考图、root 获取的浏览器截图和测量，不控制共享浏览器，不改生成器、数据库或 Git。当前结论为 **PASS（限定桌面静态19板视觉/规格）**，见[末次正式复验](#末次正式复验pass2026-10-06限定桌面静态视觉)；下方 FAIL 仅指第三轮历史，正文原样保留。root 仍负责整页接受与完整来源旅程；真实检索、保存、运行继续 **NOT VERIFIED**。

## 第三轮冻结版本：FAIL

读取版本由 root 冻结并重新加载。build.py Git blob `a8021c6cca291c058bc9c848ff81312d34f77d25`；index.html Git blob `01690adfd9984098e2e72fa1a1f61aac1929f3c3`。SHA256 分别为 `51c72e8fbb085799716dcbd25fd339458695926b6d8c51a6b769481b04747e41`、`3238804f17865e2ad44f1372eb05ff9dad8798f15ac9c8e24c61b489820215eb`，见 [source-verification.json](failed-03/source-verification.json)。这是第三轮失败版本；后续修改必须另行冻结、重取证据并在本报告追加复验，不能覆盖这项结论。

依据：当前 AGENTS.md、docs/agents/development-workflow.md、docs/agents/ui-task-templates.md、feature DESIGN-COVERAGE.md、strategy-library-wireframes/STYLE-06-CONTRACT.md。2026-10-06 契约补充已读取：copycallout/order-banner/library-origin-note 为正文14/22；控件提示可用 helper 色，控件值/中性按钮 main 色；滚动正文面板也用16px内间距，无20px例外。

### 直接读取的参考与对应关系

使用 view_image(original) 直接读取以下8张原始图片，没有仅凭 DOM 或工人报告给视觉结论。

| 精确参考（相对 feature 目录） | 实际像素 | 对应状态和比对目的 |
| --- | --- | --- |
| screenshots/creation-baseline-1440.jpg | 1417×900 | 原站深蓝风格、文字/链接层次、薄边框；CSS视口/DPR未知，只作风格参考，不作像素对齐 |
| strategy-library-wireframes/screenshots/feedback4/f18-1280.png | 1280×800 | F18四步骤、确认信息双栏、版本/首推前无交易 |
| strategy-library-wireframes/screenshots/feedback4/f15-1280.png | 1280×800 | F15起点表单、研究期限和右摘要 |
| strategy-library-wireframes/screenshots/feedback4/f09-1280.png | 1280×800 | F09只读详情抽屉、上下文、返回而不应用 |
| strategy-library-wireframes/screenshots/feedback3/f10-1280.png | 1280×800 | F10目录筛选、七列表格、分页密度 |
| strategy-library-wireframes/screenshots/feedback3/f11-1280.png | 1280×800 | F11两组排序、置顶/普通独立顺序与保存取消 |
| strategy-library-wireframes/screenshots/feedback5/f01-1280.png | 1280×800 | F01单列策略卡、每卡三类包 |
| strategy-library-wireframes/screenshots/feedback5/f14-1440.png | 1440×900 | F14单列五种实验状态与状态动作 |

授权变化：顶部设计工具由历史展开条收为独立40px、默认折叠，产品主体因此上移；普通字段/按钮/边框、字体颜色及用户文案依修订06统一。保留200px侧栏、48px身份栏、40px业务tab、深蓝、四步、单列卡与三类包。未授权重排或删减旧结构。本轮未见结构简化。

### 直接读取的第三轮渲染证据

截图在 `resume06/screenshots/` 读取，root 后归档为 [failed-03/screenshots](failed-03/screenshots/)，55张逐文件 SHA256 与读取处副本相同。首屏、滚底与边界各自为对应状态，未用全页拼接替代固定视口。以下55张全部以 view_image(original) 直接读取：

| 类型 | 精确文件集合（failed-03/screenshots/ 下） | CSS视口与实际PNG像素 |
| --- | --- | --- |
| 19页首屏，两档共38张 | f01-1280.png / f01-1440.png；f02-1280.png / f02-1440.png；f03-1280.png / f03-1440.png；f04-1280.png / f04-1440.png；f05-1280.png / f05-1440.png；f06-1280.png / f06-1440.png；f07-1280.png / f07-1440.png；f08-1280.png / f08-1440.png；f09-1280.png / f09-1440.png；f10-1280.png / f10-1440.png；f11-1280.png / f11-1440.png；f12-1280.png / f12-1440.png；f13-1280.png / f13-1440.png；f14-1280.png / f14-1440.png；f15-1280.png / f15-1440.png；f16-1280.png / f16-1440.png；f17-1280.png / f17-1440.png；f18-1280.png / f18-1440.png；f19-1280.png / f19-1440.png | 1280×800 / 1440×900，DPR1，scale1，100% |
| 长正文末尾11张 | f02-1280-scrolled.png；f03-1280-scrolled.png；f09-1280-scrolled.png；f10-1280-scrolled.png；f11-1280-scrolled.png；f12-1280-scrolled.png；f13-1280-scrolled.png；f14-1280-scrolled.png；f15-1280-scrolled.png；f18-1280-scrolled.png；f19-1280-scrolled.png | 1280×800，DPR1，scale1 |
| 响应边界6张 | f10-1299.png；f10-1301.png；f12-1299.png；f12-1301.png；f18-1299.png；f18-1301.png | 1299×800 / 1301×800，DPR1，scale1 |

条件来自 [browser-checks.json](failed-03/browser-checks.json)、[scroll-checks.json](failed-03/scroll-checks.json)、[boundary-checks.json](failed-03/boundary-checks.json)。长正文由 root 的 native mouse wheel 滚到末尾；本审查者只独立读图，不将 root 的鼠标证据说成本人操作或键盘/触摸证据。root 记录19页根部无横向溢出、11项滚底 PASS，仅作辅助测量。

### 未关闭问题

| 问题 | ID / 证据 | 实际与要求 | 结论 |
| --- | --- | --- | --- |
| 滚动正文仍用旧内边距 | UI06-02；F03/F09两档及滚底，F13两档及滚底；对应 panels 测量 | drawerbody、archive-panel-body padding20px，契约16px。内部卡已有16px，容器差异仍可见 | FAIL |
| 短操作词被拆字 | UI06-02/03；[f10-1301.png](failed-03/screenshots/f10-1301.png)，对照 f10-1299.png | 第一行“有备注 查看详情”把“情”单独换行，边界密度不稳；需完整短语换行，不缩小字号 | FAIL |
| 控件保留多组旧中性色 | UI06-03；F02/F10/F11/F13/F15/F19等两档；controls 测量 | input/search/select #b6c5d9、neutral action #d9e4f2、move-field #aec1d7、archive-reason #9fb1c8、普通filterchip #b7cbe4等。提示应 helper，值/中性操作 main，不能视为状态专色 | FAIL |
| 直接章节仍为卡标题字号 | UI06-03；[f09-1280.png](failed-03/screenshots/f09-1280.png)、[f09-1280-scrolled.png](failed-03/screenshots/f09-1280-scrolled.png)、F13两档/滚底；headings 测量 | F09“规则如何工作/命名预设与有效参数/数据与适用范围/版本与来源”和F13“会受到的影响/现有引用与复制规则/归档理由/恢复路径”等独立章节14/22，应16/24 | FAIL |
| 工程身份表述仍在产品区域 | UI06-04；F08两档、[f10-1280-scrolled.png](failed-03/screenshots/f10-1280-scrolled.png)、F12两档/滚底/边界 | F08“使用独立身份”；F10“按不同完整策略身份去重”；F12“稳定身份/策略身份/实验身份”。应表达单独策略保存、同一策略多个版本只计一次、包编号及策略/实验计数，保留原语义 | FAIL |

补充统一项已告知 root：crumb 文字13px但 lineHeight=normal，辅助层应明确13/20；`.note`13/20为辅助层，当前secondary#a9b9ce，建议依helper#93a3b9统一。此项由 root 按语义确认纳入修复，不以测量替代可见视觉问题。F13 archive-reason已14/20、80px，**字号/高度合规**，此前读图疑似13px已纠正，仅旧色失败。

### 各门范围结论

| 门 | 第三轮结果 | 证据与限制 |
| --- | --- | --- |
| UI06-01导航间距 | PASS（限定静态视觉） | 19页独立项、8px gap；F02五级、F18四级两档完整；当前项主色、父项次色；没有手工空格撑宽的视觉形态 |
| UI06-02组件/面板 | FAIL | 常规字段40、按钮36、textarea80、1px/6px、卡16已符合；滚动容器20和F10边界拆字仍失败 |
| UI06-03文字/颜色 | FAIL | 页标题22/30、卡14/22、正文14/22、辅助13/20、metadata12/18大体建立；F12章节16/24已修。上列章节和中性控件消费者仍未统一 |
| UI06-04用户文案 | FAIL | debug编号/游标/产品静态后缀与成功态失败设计说明已清；F07四个独立状态保留。身份工程表述仍需修正 |
| UI06-05静态业务含义 | PASS（文字/状态呈现范围） | 锁定版本、查看不应用、归档全部版本与已有引用、来源保存取消、缺数据理由、信号与成交分层、首次推进前无交易、零费/分股/合成/日历假设仍可见。未编造阈值或宣称真实完整回测 |
| 结构和响应 | PASS，F10短链接除外 | F01/F14单列，F01三类包，F15主表单+摘要，F18双栏四步，F09右抽屉，F10七列表格，F11两组均保留；F12/F18在1299/1301仍完整 |
| 长正文末尾视觉 | PASS，面板间距/章节除外 | F02/F19三包尾注和来源底栏；F03候选与固定底栏；F09只读返回；F10表末/分页；F11保存取消；F12引用；F13理由/恢复；F14完成/失败；F15期限；F18假设均可见 |
| 真实检索/保存/运行 | NOT VERIFIED | 19页为静态画板，不将链接或呈现状态当成功能实现 |
| 数据库/真实持久化 | NOT APPLICABLE | 本轮只改静态生成器，没有业务接线；不能覆盖将来真实写流程验收 |
| 本审查者键盘操作 | NOT VERIFIED | 本审查只读图，不声明本人交互验收；鼠标滚动证据保持独立 |
| 仿真触摸/物理触摸 | NOT APPLICABLE | 本轮沿用桌面静态画板，移动与真实触摸不在契约范围；未用鼠标替代触摸证据 |

旧 [failed-01/visual-review.md](failed-01/visual-review.md)、[failed-02/visual-review.md](failed-02/visual-review.md) 与第三轮归档均保留。第三轮已告知 root 和实现 owner 修复；末次复验必须追加新哈希及直接读图证据。

## 末次正式复验：PASS（2026-10-06，限定桌面静态视觉）

最终 build.py Git blob `64bd1fa9d9b2269b5492c3ea3c0d8cb674f9ab92`；index.html Git blob `04571acd9928499838fcc499ea760bbdc429190a`。SHA256 分别为 `b2ef5d51b40109edcd1614090f3707e5a79143d7ead493252c40266a57fa28f8`、`3255408033915d9f92624ab50d92371739ce53f99958351a20a3e6c241313701`，见 [source-verification.json](source-verification.json)。审查者读取当前源文件字节计算 SHA256，与最终冻结一致。

再次以 view_image(original) 直接读取上表8张原始参考：creation-baseline-1440.jpg（实际1417×900，仅风格）；feedback4 F18/F15/F09、feedback3 F10/F11、feedback5 F01（均1280×800）；feedback5 F14（1440×900）。比对计入40px折叠设计工具条及修订06统一样式/用户措辞的授权变化，保留原结构和状态。

最终直接读图55张：38首屏（19板×1440×900、1280×800）、11实际滚底（1280×800）、F10/F12/F18的6张1299/1301×800边界图。精确文件、图像尺寸与 SHA256 见 [image-metadata.json](image-metadata.json) 的 `final-visual-comparison` 组；本审查者核对该组55个当前文件哈希均一致。`restored-f14-before-1280.png` 是恢复前历史图，不属于最终验收；另外3张静态路径/工具图及1张预览也不计入这55张。

实际 CSS 视口如上，DPR1、visualViewport scale1（100%），见 [browser-checks.json](browser-checks.json)、[scroll-checks.json](scroll-checks.json)、[boundary-checks.json](boundary-checks.json)。55张实际像素为1280×800共30张、1440×900共19张、1299×800和1301×800各3张。文件名虽为 .png，实际编码均为 **JPEG**；历史表“PNG像素”仅指实际截图尺寸，编码表述在此修正。保持原字节，未缩放、裁切、拼接或改图。视觉结论来自参考和渲染直接比对，DOM/token/无溢出只作辅助证据。

| 门 | 最新结论 | 直接复验结果 |
| --- | --- | --- |
| UI06-01 | PASS | 19板导航项/分隔符8px、13/20；F02五级与F18四级长路径完整，当前项/父项颜色层次正确 |
| UI06-02 | PASS | 字段40、按钮36、理由80、边框1/圆角6、面板16；F03/F09/F13滚动正文20px已改16。package-table/order-group圆角6；F10-1301完整“查看详情”换行，未拆字；选中外尺寸保持 |
| UI06-03 | PASS | 页22/30、章节16/24、卡/正文14/22、辅助13/20、metadata12/18和主/次/辅助/链接色一致；F09/F13章节、普通控件中性色、crumb行高及note辅助色失败均关闭。F04/F11/F16正文语义保持 |
| UI06-04 | PASS | F08单独策略保存、F10去重统计、F12包编号及策略/实验计数均用用户表达；归档改为“新选择不可用”“归档后，不能新增选择此包”。F07四状态保留；产品区域未见调试编号或工程说明 |
| UI06-05 | PASS（静态呈现） | 锁定版本、查看不应用、归档全部版本及已有引用、新草稿/复制/新版本确认、来源保存取消、缺数据、信号/成交分层、首次推进前无交易及模拟假设保持，未缩减规则或编造阈值 |
| 整页结构/密度/边界 | PASS（本审查范围） | 深蓝、200px侧栏、48px身份栏、40px业务tab、四步骤保持。F01单列三卡与三类包、F14单列五状态、F09右抽屉、F10七列、F11两组、F15表单/摘要、F18双栏均保留；6边界无重大差异 |
| 长正文末尾视觉 | PASS | 11实际滚底逐一直接读取；来源底栏、选择/只读返回、分页、顺序保存取消、引用、归档理由/恢复、实验状态与研究假设完整可读 |
| 真实检索/保存/运行 | NOT VERIFIED | 静态画板和链接不能证明真实业务接线 |
| 数据库/真实持久化 | NOT APPLICABLE（本轮） | 本轮限定静态生成器；未来核心写流程仍需隔离数据库验收 |
| 本审查者鼠标/键盘操作 | NOT VERIFIED | 本人只读图；root 的鼠标滚动、静态链接/键盘证据独立归 root |
| 仿真触摸/物理触摸 | NOT APPLICABLE | 桌面静态范围，未用鼠标或截图替代触摸 |

第三轮全部失败及末尾补充圆角/归档措辞均关闭，未发现尚未关闭的重大视觉差异。failed-01、failed-02、failed-03及上方第三轮 FAIL 原文继续保留。本结果是独立视觉/规格 scoped PASS，root 仍须结合代码审查、静态旅程及最终验收记录签署整页接受。
