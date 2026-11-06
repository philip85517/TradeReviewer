# 独立设计审查

审查者：design_review（未参与正文和画板制作）。日期：2026-10-23。范围为策略台视觉设计 V1.0 的历史语义、图文一致性、V2.5 公共控件与表达方式。不是产品回测功能或数据持久化验收。

## 审查边界与版本

- 参考：`source/history/H01–H08`；H09/H10为历史完整观察参考；当前公共规范为相邻 `2026-10-22-homepage-v2.5/source/visual-design.candidate.md`。
- 触发：受委托进行独立视觉/表达审查，适用 `docs/agents/frontend-control-audit.md` 的版本与证据边界要求。
- 工作树：`/Users/zhoulin/.codex/worktrees/b387/TradeReview`，未提交设计包。
- 浏览器：独立 IAB 标签，2026-10-23 新鲜打开 `http://127.0.0.1:3094/design-system/baselines/2026-10-22-strategy-workbench-v1.0/visual-spec.html`，并逐一直接查看 SVG。截图可见视窗为1280×720；1440宽SVG按原生尺寸显示，右侧超出视窗部分不算已经看过。SVG画布尺寸不冒充 CSS 视口。
- 正文初审后协调者正在补文，画板初审后作者正在修订。以下失败保留为初稿记录，不代表最终复核。
- 初稿画板生成器 SHA256：`23b823947582c15722f956cb842ff03d78caa253185da67dcff0d64e99a69239`；07b SHA256：`e6b01bb7bce6f6821ec8a894dd6fa9f2b14a6e0efa2c4bfa6ede7fcc824a53bd`。
- 不在范围：生产策略执行、业务数据库、真实写入/重开、导出程序、物理触摸及产品断点实现。均 NOT APPLICABLE，理由是本轮交付设计文档与静态画稿。README/acceptance 初稿尚未完成，不作为缺陷。

## 正文与历史语义

主体已保留四步流程、五档历史期限、计划与实际、独立资金、库与实验入口分工、三包职责与完整策略版本、复制与编辑区别、历史运行不可改写、事件来源返回、时间安全与“已看”记录。正文先解释目的和取舍，再将精确规则收起，符合聊天提出的“说人话”要求；没有将历史两个代表章节或原型通过扩大为生产完成。

| ID | 依据与必要修改 | 初审 | 复核 |
| --- | --- | --- | --- |
| TXT01 | H01 D03：TIME07需补“形成中周线标未完成，不用于默认周线信号” | FAIL；已通知协调者 | 待复读最终正文 |
| TXT02 | H04 IF08/H05 WD04：结果/比较需保留回放槽、禁用推进/速度，提供返回观察后推进 | FAIL；已通知协调者 | 待复读最终正文 |
| TXT03 | H01 D02：历史可知、证券池、交易模型覆盖分别披露；部分证券未知须显式选择剩余集合并永久标偏差 | FAIL；已通知协调者 | 待复读最终正文 |
| TXT04 | H01 D03/D06：终点超可用末端要等待或明确部分区间，期末未执行计划不倒填成交 | FAIL；已通知协调者 | 待复读最终正文 |
| TXT05 | H03 LD12：归档作用于包身份及全部版本；个人排序三类目录分别跨会话保存、置顶/普通组边界 | FAIL；已通知协调者 | 待复读最终正文 |
| TXT06 | DESIGN-COVERAGE WIZ第三步写“资金执行”，应对齐正文和历史“预览组合（含独立资金/执行）” | FAIL；已通知协调者 | 待复读最终矩阵 |

## 画稿初审发现

以下均来自真实浏览器直接可见画面，与正文及历史对照；不以源码存在或作者报告代替视觉结论。

| ID | 严重度 | 画稿与实际观察 | 应达到的设计 | 状态 |
| --- | --- | --- | --- | --- |
| VIS01 | P1 | 07b查看6/17，却画出6/28行情，右栏有未来事件6/21与结果截止9/13；K柱穿出绘图区覆盖标题 | 三帧全部受查看/已展开截止限制；T0与回看仅展示允许投影，未来事件不可提前露出；柱与成交在绘图区内 | FAIL，作者修订中 |
| VIS02 | P2 | 04的6/14+3个月把9/13写成名义结束；无起点时刻/时区；“初始总额20万”容易理解为共享资金 | 名义9/14、实际最后完整交易日9/13分别呈现，时刻/时区可见，独立本金口径明确 | FAIL，作者修订中 |
| VIS03 | P2 | 05确认区只写“含交易费用”，未形成完整时间/锁定版本/费用与滑点摘要 | 精确版本和执行口径可查；未知明确未提供且阻止确认，不能笼统宣称已配置 | FAIL，作者修订中 |
| VIS04 | P2 | 02新建/复制来源/保存新版本混用，筛选与退出包版本不显 | 副本新身份与编辑新版本明确分开，三包各自版本明确 | FAIL，作者修订中 |
| VIS05 | P2 | 04/05仍高亮策略库；08模式为结果/事件/对比，局部图为净值/K线；09表优先挤走主图且无共享模式槽 | 创建属于我的实验；工作台内回放观察/阶段结果/组合对比一致；结果图净值/回撤/仓位；共享框架意图保留 | FAIL，作者修订中 |
| VIS06 | P2 | 08首次建仓写7/19，07b写6/17；NAV1.0254虚线不对应曲线终点且无可核对刻度 | 同一合成实验的日期和金额自洽，轴、摘要、曲线一致 | FAIL，作者修订中 |
| VIS07 | P2 | 11窄屏资产标签与金额重叠，当日收益同样；紧凑桌面的轴标签与日期说明压字；窄屏缺图前日期 | 窄屏完整文字与数值分行、无重叠；摘要→日期→图顺序不丢失 | FAIL，作者修订中 |
| VIS08 | P2 | 12“八态例子”是八种业务异常；焦点只用文字描述 | 应展示公共默认/悬停/聚焦/按下/禁用/加载及容器空/错误，至少真实控件的焦点环、按钮和输入状态可对照 | FAIL，作者修订中 |
| VIS09 | P2 | 01仅完整策略与三类包入口；缺包目录引用数/置顶/排序/归档关键视觉；02无完整480包详情层 | 至少补一张包目录/归档及包详情关键状态，令已承诺的视觉取舍可评审 | FAIL，作者修订中 |

协调者也已独立指出06日期输入遮挡结果按钮、完成仍可展开、连续摘要未落地、正常绿色徽章等，需与以上同轮修订，避免局部图稿修好而整套语言不同。

## 证据覆盖与接受边界

| 审查项 | 已执行范围 | 当前结论 |
| --- | --- | --- |
| 历史需求与正文 | H01–H08对照全文与覆盖矩阵；必要补句已发送 | FAIL待复核上述6项 |
| 图文独立视觉 | 阅读页首屏；直接SVG 01、02、04、05、07b、08、09、11、12 | FAIL待修订复验；未见部分不宣称通过 |
| 全套最终画稿与V2.5 | 最终修订未到达 | NOT VERIFIED |
| 阅读器交互 | 本审查仅导航与截图；协调者负责全量阅读控件清单 | 不给点击覆盖率；不冒充阅读器全量通过 |
| 产品功能/持久化/物理设备 | 静态设计范围之外 | NOT APPLICABLE |

当前结论：正文方向可继续收敛；画稿存在影响历史语义和可读性的具体失败，不能以15张文件齐备宣称视觉方案已验收。需在修订版本上再次实看相关画面并留下新指纹；初稿失败记录保留。

## 第二轮：正文复核

对协调者补文进行重新读取，正文 SHA256 `548f854025a5edeb7aa4b202efee7cc8a0006ade7162083e64a1830c643856fd`。TXT01–06 均已解决：TIME07明确未完成周限制；RES07/CMP00明确只读回放槽；ERR04明确分维覆盖和显式剩余集合；WIZ01/RES08明确部分区间与未执行计划；LIB05/06明确个人偏好及全部版本归档；覆盖矩阵第三步已改预览组合。此轮文字要求结论 PASS，画稿 FAIL 不因此消除。


## 第二轮：图稿复核进行中（保留首轮失败）

2026-10-23 本轮重新打开 CUA 时，创建 IAB 返回 `Browser is not available: iab`，库存返回 `apps: [], browsers: []`。未使用其他浏览器绕行；以下明确区分源码对照、协调者采集的真实浏览器截图独立阅读，以及尚未看见的范围。源码不能代替视觉通过。首轮 VIS01–09 FAIL 历史记录保持不变。

本轮先复核 01–05、10、12；06/07/08/09/11 作者仍在修订，不对活动版本接受。协调者采集的 [05 修订前浏览器截图](evidence/05-before-repair.png) 已由独立审查者实看（完整左右内容，截图 1280×720，图像缩放展示）。05 SVG SHA256：`f561e3d5a20772e94653eecf7a744942ea0961e472433c61214fe03020b2e0ad`。

| ID | 本轮证据和结论 | 状态 |
| --- | --- | --- |
| VIS03 | 05 截图已显示三包精确版本、时间/时区、名义与实际结束、独立资金、费率和滑点，初轮内容缺失已补；但下方两卡的说明与首行字段压字，完整策略仅 A 对应两组资金的归属未说明 | 部分解决；仍 FAIL，待修订截图 |
| VIS05 | 05 截图业务标题虽为我的实验，顶栏仍高亮策略库；步骤已完成身份仍用绿色。模式槽相关其他画稿仍修订中 | FAIL，待修订截图 |
| VIS02 | 04 源码名义 9/14、实际 9/13、15:00/Asia/Shanghai 与两组独立本金已补；但“完整交易日”值为“9 / 13”，将日期误作数量，不符合正文完整交易日数量口径。SHA256 `3fb1845c4717e6dc564cc5592a023aa370044ccfef7cd2ad3277cc5fe18e3a72` | 仍 FAIL；视觉 NOT VERIFIED |
| VIS04 | 02 源码已区分编辑与复制、三包各有版本；当前副本来源完整策略 v1.3，详情却写“锁定引用 完整策略 v1.4”，需要说明该字段是其他引用或改为当前来源版本。SHA256 `7d9103d35b6ff0ea945a116dccacde052fc05c35d237c8565011ba16096e06fd` | 仍 FAIL；视觉 NOT VERIFIED |
| VIS08 | 12 源码已分开共享控件与容器状态，具有 default/hover/focus/pressed/disabled/loading 及 empty/error。SHA256 `5306e3ee811dc436bf1ef7c915eb7ae2829b79d9b7f3fb42b2c3a226f3000849` | 语义缺口已补；视觉 NOT VERIFIED |
| VIS09 | 新增 01b 目录/归档、02 480px 详情源码；01b SHA256 `8795a79d5173f609cc6b1f2ae579e4373d461c7626e77c46771c267856046ea0` | 画面范围已补；视觉 NOT VERIFIED |

本轮额外说明：05 只有一个完整策略版本摘要，却列策略 A/B 两组本金；应明确当前查看 A 的确认摘要或说明两组与版本的映射。此项属于确认表达一致性，不要求扩展产品功能或数据库测试。其余本轮图稿尚无独立实际可见证据，不作通过结论。

## 第三轮：协调者真实浏览器截图的独立复核

截图由 root 通过真实 CUA 浏览器采集，本审查者未制作画稿，逐一通过 view_image 直接查看全部 top/bottom。桌面截图为1280×720，原画布1440一般缩放至1100；局部920、窄屏390按原宽显示。对照H09/H10的阶段顺序及V2.5公共视觉语言，不把设计稿验收当作产品交互或持久化验收。

第一批实看13组：01-library、01b-package-management、02-compose、03-experiments、04-create、05-confirm、06-observe、06-observe-status-detail、10-states、11-compact、11-narrow、11-responsive、12-components；截图为 `evidence/{stem}-final-top.png` 与 `-final-bottom.png`。第二批实看10组：07-time-states、07a-t0、07b-first-day、07c-lookback、07-time-controls-detail、08-results、09-compare、11-narrow、11-compact、11-responsive；截图为 `evidence/{stem}-v2-top.png` 与 `-v2-bottom.png`。另已实看 [11窄屏中部](evidence/11-narrow-v2-middle.png)，补齐1550高画面的中部证据。

| 问题 | 独立实看结论 | 本轮状态与证据 |
| --- | --- | --- |
| VIS01 | 三帧的T0、6/17新增末柱及回看分别符合查看边界；末柱、成交标记均完整位于图内；回看保留6/28来源、不投影未来成交 | 旧问题关闭；[07b](evidence/07b-first-day-v2-top.png)、[07c](evidence/07c-lookback-v2-top.png) |
| VIS02 | 名义9/14、实际9/13、15:00和时区、独立资金已修，错误交易日数量已移除；两卡说明仍压首行字段 | FAIL待修；[04](evidence/04-create-final-top.png) |
| VIS03 | A/B两组完整策略及各自三包版本已补齐，费用/滑点/时间摘要可读，说明与字段已分开 | 关闭；[05上](evidence/05-confirm-final-top.png)、[05下](evidence/05-confirm-final-bottom.png) |
| VIS04 | 480详情、来源v1.3及三包版本清楚；但选中“编辑已有策略”时主表单/动作是“创建副本” | FAIL待修；[02](evidence/02-compose-final-top.png) |
| VIS05 | 04/05归属已改我的实验；08/09三主模式、图优先、下方固定只读回放槽已落实 | 该旧问题关闭；[08](evidence/08-results-v2-top.png)、[09](evidence/09-compare-v2-bottom.png)；不抵消VIS10 |
| VIS06 | 首次成交统一6/17，净值刻度、1.0000起点和1.0254终值已修；08贡献柱越界并遮字，归因值不等于总收益；09差值需用百分点且水印被表格遮住 | 旧日期/净值问题关闭；新增贡献与单位问题继续FAIL；[08下](evidence/08-results-v2-bottom.png)、[09下](evidence/09-compare-v2-bottom.png) |
| VIS07 | 首批11窄屏仍出现ISO日期重叠、持仓行越框；v2已分开日期、金额、比例并扩高检查区。compact底部可读；responsive早期曲线穿按钮，v2已移除，作为结构示意可用 | 旧排版问题关闭；[11中](evidence/11-narrow-v2-middle.png)、[11下](evidence/11-narrow-v2-bottom.png)；局部操作缺失另列VIS10 |
| VIS08 | 已真实展示按钮默认/悬停/焦点/按下/禁用/加载，以及输入焦点/错误和容器空/错误 | 关闭；[12](evidence/12-components-final-top.png) |
| VIS09 | 目录和归档关键画面已补，但01b偏好悬条遮住确认归档按钮、左卡说明压表头 | FAIL待修；[01b](evidence/01b-package-management-final-top.png) |
| VIS10（新增P2） | 正文144行及OBS04/06要求主图净值/标的K线切换、检查区概览/调仓记录/统计指标切换；06、11compact/narrow只有三主模式，没有局部观察入口。07的K线分镜不能替代观察页可发现的操作 | FAIL待补并实看；[06](evidence/06-observe-final-top.png)、[11窄屏](evidence/11-narrow-v2-middle.png) |

01、03、05、06状态局部、10、12本轮未见新的重大可读性问题。06摘要、日期按钮与完成态禁用规则已改善，但VIS10阻断完整观察图接受。第一批图源SHA256（按该次读取记录）：

| 图源 | SHA256 |
| --- | --- |
| 01-library | `0c56cb6b6e0ae940fc04adba81e2ad4b39fa69d403f2fc055300da0411afbec2` |
| 01b-package-management | `4245891d4a7a2c9935449bbf990e4afe788239c0d0f525fa8aed2f679cee7567` |
| 02-compose | `0376be31f54c51f8354d4c3d770d311ff5ccfbb37245cb3d89a564a18e4e0822` |
| 03-experiments | `00ed2256bb242b0fd0b207aef9a532cb0d0ce3f5f846287695aff305c0b0beda` |
| 04-create | `14efc3c07161b64c1a8065eb891c0be8b8ccdfb38cf0ed877244d5f37d2c5108` |
| 05-confirm | `4d2e18ca9da8b18d185de5a91c2ee5ee92fea232d0875664e55b4169eafd7570` |
| 06-observe | `25023d17d476f886c05ba2bb8b9917665594e213821dd1b099b430944aa41002` |
| 06-observe-status-detail | `92a40d71b44438edbbeb5dcf25b7152c6c7117d6327e2ec2f9504dbc7e768ff2` |
| 10-states | `35136e36a30190e7acf7a5abe3ecb9c5e04eb44160756d9c83ad1a8125dbb519` |
| 11-compact（首批） | `0149938e2c95e1fd05e732cab55e983a8d75790e59400a84fc4c644e32c10089` |
| 11-narrow（首批） | `fb4303613d6f6dea9a357eec8a9ca5caaa9403fe27c8383c4f1e2e0363345ae8` |
| 11-responsive（首批） | `d7ba4e5ec969ff6cab33fe1a3fb3966f9c11207344e33d9594d54fae296a3bd6` |
| 12-components | `05ad3dfa7ece5030062719f43003c6dda8e31d972324be421886fdb19112fb01` |

数值独立核对：读取example-data.json；本金100000×净值1.0254084=102540.84，显示收益2.54%；A峰值1.018到0.985424恰为-3.20%；B末值1.0184对应1.84%。06/08/09主净值曲线与此一致，08贡献另有失败已退回。此核对仅针对虚构画稿的跨图一致性。

当前仍待：01b/02/04修订；04b选择策略画面补齐四步视觉；08贡献/09差值修订；06及11观察局部控件。不得因上述局部PASS将整个包签为接受。


## v3 library/forms and v2 time-state fingerprints

01b / 02 / 04 / 04b: PASS. VIS02 / VIS04 / VIS09 closed after independently viewing all v3 top and bottom browser screenshots. Earlier FAIL evidence remains above. 04b now visibly covers multi-selection, three-package versions, independent capital, inline-create entry and return-preservation intent. This does not validate runtime behavior.

| Image | SHA256 | Screenshots |
| --- | --- | --- |
| 01b-package-management | `4bf7f8762d8e5ba09fb764f7b708c553b52a3759a70408d5f503cb0792a434ea` | [top](evidence/01b-package-management-v3-top.png) / [bottom](evidence/01b-package-management-v3-bottom.png) |
| 02-compose | `1773bae8fdbd65ab6190f318ab7eeb2863834d5d97e03bd185dcc40f2852e385` | [top](evidence/02-compose-v3-top.png) / [bottom](evidence/02-compose-v3-bottom.png) |
| 04-create | `4262056f8d7f406634cc96192221b3defffd9a49a60c30b8d56344e686d44fc4` | [top](evidence/04-create-v3-top.png) / [bottom](evidence/04-create-v3-bottom.png) |
| 04b-select-strategies | `9e4875ce45d25b4989776d78740827a6b55ff5f107343e05b388fb97825000fa` | [top](evidence/04b-select-strategies-v3-top.png) / [bottom](evidence/04b-select-strategies-v3-bottom.png) |
| 07-time-states | `7fe05817f22ca748fa8698f3ce98a703d1ffe4b61fae524292386dd586dd279e` | [top](evidence/07-time-states-v2-top.png) / [bottom](evidence/07-time-states-v2-bottom.png) |
| 07a-t0 | `59d8b854c89003ab0cfc6ce4846efbb570a636a146b53e3efab98d20ebd8f86a` | [top](evidence/07a-t0-v2-top.png) / [bottom](evidence/07a-t0-v2-bottom.png) |
| 07b-first-day | `71f6fa26a3a65cfca6d87ec321f5a72707dd1f8f49ead4455bbd16e72609af89` | [top](evidence/07b-first-day-v2-top.png) / [bottom](evidence/07b-first-day-v2-bottom.png) |
| 07c-lookback | `3e222976f2e04594c62ee6e2d6801692e57abaee8b6a388ed6c0d122dfb807d8` | [top](evidence/07c-lookback-v2-top.png) / [bottom](evidence/07c-lookback-v2-bottom.png) |
| 07-time-controls-detail | `a924ce3d53c571c14de5f0cad069fad6110be764f41c956af0b07db558e2ea74` | [top](evidence/07-time-controls-detail-v2-top.png) / [bottom](evidence/07-time-controls-detail-v2-bottom.png) |
| 11-compact | `0149938e2c95e1fd05e732cab55e983a8d75790e59400a84fc4c644e32c10089` | [top](evidence/11-compact-v2-top.png) / [bottom](evidence/11-compact-v2-bottom.png) |
| 11-narrow | `fb4303613d6f6dea9a357eec8a9ca5caaa9403fe27c8383c4f1e2e0363345ae8` | [top](evidence/11-narrow-v2-top.png) / [bottom](evidence/11-narrow-v2-bottom.png) |
| 11-responsive | `d7ba4e5ec969ff6cab33fe1a3fb3966f9c11207344e33d9594d54fae296a3bd6` | [top](evidence/11-responsive-v2-top.png) / [bottom](evidence/11-responsive-v2-bottom.png) |

## 第四轮：v4 包管理、选择策略、结果与对比

由 root 通过 CUA 采集，本审查者独立查看以下全部 top/bottom 截图。root 对01b高度、04b文案、09单位的整合修改纳入本轮独立复核。四张画稿视觉 PASS；先前失败证据继续保留。

| 图稿 | 独立结论 | 图源 SHA256 | 实看截图 |
| --- | --- | --- | --- |
| 01b-package-management | 归档确认未受遮挡，个人偏好提示与目录表分开，水印已移出卡片；VIS09保持关闭 | `66c00c066636c50a43c2f291226f252bb9aab58c585c55f8ccfaf7ee9c52d76b` | [上](evidence/01b-package-management-v4-top.png) / [下](evidence/01b-package-management-v4-bottom.png) |
| 04b-select-strategies | 多选、三包版本、两组独立本金、就地新增及返回保留意图清楚；产品内像素工程文案已移除 | `a4f862e5760e05dbb7ae6718a868e513716708c22640c26b0e6eecf4aba5198a` | [上](evidence/04b-select-strategies-v4-top.png) / [下](evidence/04b-select-strategies-v4-bottom.png) |
| 08-results | 贡献柱在独立绘图区内，负值位于零线下，标签不压回放槽；精确归因3.08924−0.42−0.1284+0=2.54084个百分点，显示舍入一致；VIS06全部关闭 | `f050ee51e37f63ecc884a74919526df7c8e4b39abda6285931727b567960ad31` | [上](evidence/08-results-v4-top.png) / [下](evidence/08-results-v4-bottom.png) |
| 09-compare | 收益和回撤差值使用“百分点”，费用差值为金额；水印已移出表格，图轴与固定只读回放区完整 | `d10aad7ff3f68141cfa5cd1cd3bc52bf8d45d8494b4f165666695d4c8aeebb32` | [上](evidence/09-compare-v4-top.png) / [下](evidence/09-compare-v4-bottom.png) |

证据绑定说明：早期并行修图阶段的图源指纹是读取时工作区状态，不能据此逆推此前失败截图对应的精确旧图源；失败截图本身为保留证据。以上v4指纹在本轮实看后立即读取。当前仍未关闭VIS10，等待06及11局部观察控件修订后的真实截图；不签整包接受。

## 最终独立签署：设计范围 PASS（2026-10-23）

第五轮由 root 通过真实 CUA 采集截图，非作者审查者逐一查看06-observe、06-observe-status-detail、11-compact、11-narrow、11-responsive的v5顶部与底部，以及11-narrow-v5-middle。06、1280紧凑桌面和390窄屏均已出现可辨认的“净值 / 标的K线”入口及检查区“概览 / 调仓记录 / 统计指标”入口；没有文字与控件遮挡。三主模式与局部切换区分清楚，摘要→日期→图表→回放/检查区的阅读层级保持；完整图、坐标、净值终点和回放说明仍可读。1440图净高360、1280图净高320、窄屏图净高280的空间未被新增控件挤占。11-responsive是重排结构示意，完整观察操作以11-compact和11-narrow为准。VIS10关闭。

最终正文重新读取，SHA256为`10f454f689da2234a4267d90889e97e8ac40a4a3dbc96e687fb98c92f9068a9a`。四步、历史可知数据、名义/实际结束、目标/实际、三包及版本锁定、个人偏好与归档、回放截止与未来信息边界、阶段结果与对比、异常和响应式规则保留；新增第二步画稿已关联正文。历史H01–H10及V2.5对应的已发现缺口均已解决，先前TXT01–06、VIS01–10的FAIL记录作为迭代证据保留，不再是当前未决事项。

| 接受维度 | 最终结论 | 依据与边界 |
| --- | --- | --- |
| 历史语义及设计表达 | PASS | 原型/聊天/沉淀规则与正文对照，必要边界补齐；解释用途与取舍，没有以工程字段代替用户说明 |
| 公共视觉与布局 | PASS | 全部21张画稿已独立实看最新采用版本；主色、盈亏语义、层级、控件状态、长画面和窄屏可读性接受 |
| 合成示例一致性 | PASS | 起点、首次成交、名义/实际终点、本金、净值、回撤、归因与比较差值跨图核对 |
| 阅读器完整交互 | 本报告不签署 | 本报告签署图文设计；阅读器控件实际点击与导航由协调者另留验收证据 |
| 生产功能、运行时状态、数据库和真实设备触控 | NOT APPLICABLE | 交付为静态视觉设计方案，未实施策略引擎或生产界面；静态按钮与分镜不证明功能、持久化或回放实现 |

独立接受人：design_review（未参与画稿及正文实现）。当前设计审查范围内没有未解决的重大缺陷。此结论仅绑定下列图源指纹及对应截图；后续实质修改需要重开受影响项。

### 最终21图版本与证据清单

所有截图均由root采集、由本审查者独立查看。下表采用每张图最近一次已实看的证据版本；11窄屏另含[中部完整图证据](evidence/11-narrow-v5-middle.png)。`final`是第一批截图文件名，不表示由作者自行签署。

| Image | SHA256 | Evidence version | Browser screenshots |
| --- | --- | --- | --- |
| 01-library | `0c56cb6b6e0ae940fc04adba81e2ad4b39fa69d403f2fc055300da0411afbec2` | final | [top](evidence/01-library-final-top.png) / [bottom](evidence/01-library-final-bottom.png) |
| 01b-package-management | `66c00c066636c50a43c2f291226f252bb9aab58c585c55f8ccfaf7ee9c52d76b` | v4 | [top](evidence/01b-package-management-v4-top.png) / [bottom](evidence/01b-package-management-v4-bottom.png) |
| 02-compose | `1773bae8fdbd65ab6190f318ab7eeb2863834d5d97e03bd185dcc40f2852e385` | v3 | [top](evidence/02-compose-v3-top.png) / [bottom](evidence/02-compose-v3-bottom.png) |
| 03-experiments | `00ed2256bb242b0fd0b207aef9a532cb0d0ce3f5f846287695aff305c0b0beda` | final | [top](evidence/03-experiments-final-top.png) / [bottom](evidence/03-experiments-final-bottom.png) |
| 04-create | `4262056f8d7f406634cc96192221b3defffd9a49a60c30b8d56344e686d44fc4` | v3 | [top](evidence/04-create-v3-top.png) / [bottom](evidence/04-create-v3-bottom.png) |
| 04b-select-strategies | `a4f862e5760e05dbb7ae6718a868e513716708c22640c26b0e6eecf4aba5198a` | v4 | [top](evidence/04b-select-strategies-v4-top.png) / [bottom](evidence/04b-select-strategies-v4-bottom.png) |
| 05-confirm | `4d2e18ca9da8b18d185de5a91c2ee5ee92fea232d0875664e55b4169eafd7570` | final | [top](evidence/05-confirm-final-top.png) / [bottom](evidence/05-confirm-final-bottom.png) |
| 06-observe | `c3a19740ff5f56f607b70b6d01e03da5160d0f48d0dfd6121385f9c28b75ebe7` | v5 | [top](evidence/06-observe-v5-top.png) / [bottom](evidence/06-observe-v5-bottom.png) |
| 06-observe-status-detail | `ebc080427911f409cec15fba5907a99a146d7172aa52020bfce49c235a6edd53` | v5 | [top](evidence/06-observe-status-detail-v5-top.png) / [bottom](evidence/06-observe-status-detail-v5-bottom.png) |
| 07-time-states | `7fe05817f22ca748fa8698f3ce98a703d1ffe4b61fae524292386dd586dd279e` | v2 | [top](evidence/07-time-states-v2-top.png) / [bottom](evidence/07-time-states-v2-bottom.png) |
| 07-time-controls-detail | `a924ce3d53c571c14de5f0cad069fad6110be764f41c956af0b07db558e2ea74` | v2 | [top](evidence/07-time-controls-detail-v2-top.png) / [bottom](evidence/07-time-controls-detail-v2-bottom.png) |
| 07a-t0 | `59d8b854c89003ab0cfc6ce4846efbb570a636a146b53e3efab98d20ebd8f86a` | v2 | [top](evidence/07a-t0-v2-top.png) / [bottom](evidence/07a-t0-v2-bottom.png) |
| 07b-first-day | `71f6fa26a3a65cfca6d87ec321f5a72707dd1f8f49ead4455bbd16e72609af89` | v2 | [top](evidence/07b-first-day-v2-top.png) / [bottom](evidence/07b-first-day-v2-bottom.png) |
| 07c-lookback | `3e222976f2e04594c62ee6e2d6801692e57abaee8b6a388ed6c0d122dfb807d8` | v2 | [top](evidence/07c-lookback-v2-top.png) / [bottom](evidence/07c-lookback-v2-bottom.png) |
| 08-results | `f050ee51e37f63ecc884a74919526df7c8e4b39abda6285931727b567960ad31` | v4 | [top](evidence/08-results-v4-top.png) / [bottom](evidence/08-results-v4-bottom.png) |
| 09-compare | `d10aad7ff3f68141cfa5cd1cd3bc52bf8d45d8494b4f165666695d4c8aeebb32` | v4 | [top](evidence/09-compare-v4-top.png) / [bottom](evidence/09-compare-v4-bottom.png) |
| 10-states | `35136e36a30190e7acf7a5abe3ecb9c5e04eb44160756d9c83ad1a8125dbb519` | final | [top](evidence/10-states-final-top.png) / [bottom](evidence/10-states-final-bottom.png) |
| 11-compact | `793ea7ceaee42c6e9935410952fe1c5d51b47d12ea4142766dd05b63f563e208` | v5 | [top](evidence/11-compact-v5-top.png) / [bottom](evidence/11-compact-v5-bottom.png) |
| 11-narrow | `0a165a0cc4bf96434ff19d353564867a159d08fda8916b6f832d43c006d99053` | v5 | [top](evidence/11-narrow-v5-top.png) / [bottom](evidence/11-narrow-v5-bottom.png) |
| 11-responsive | `d7ba4e5ec969ff6cab33fe1a3fb3966f9c11207344e33d9594d54fae296a3bd6` | v5 | [top](evidence/11-responsive-v5-top.png) / [bottom](evidence/11-responsive-v5-bottom.png) |
| 12-components | `05ad3dfa7ece5030062719f43003c6dda8e31d972324be421886fdb19112fb01` | final | [top](evidence/12-components-final-top.png) / [bottom](evidence/12-components-final-bottom.png) |
