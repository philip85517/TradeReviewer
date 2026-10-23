# P3 root 有界实浏览器清单：搜索 → 详情 → 普通集合 → 来源

这是计划与局部证据索引，**不是执行结果或正式接受**。reviewer `/root/state_g61`，实际 GPT6.1 Ultra。版本/已证实两项 FAIL/旧 host 边界见 `REPORT.md`。root 是真实操作与独立验收 owner，integration 是 host/Workspace owner；Surface 修复须另获授权。不得把本清单勾选为 P3 0/3 以外的结论。

## 开始条件和证据方式

1. 等最终 Surface/host/session/catalog/Workspace 冻结，保存 dirty 源 hash、时间与所服务 worktree。当前报告 Surface `914f13c9…`，旧 host `74d765fe…` 不继承到正在修复版。
2. root 记录实际服务启动命令/会话、端口/URL、新鲜打开时间；任何写入使用显式 `TRADEREVIEW_DB_PATH` 的既有隔离验收库。本文没有启动服务或创建库。root 两项失败证据来自 tab7/3334；新验收不假定仍是该实例。request-body 观察器保持未激活。
3. 保存当前 market/accounts/applied period、目录数据截止、holding query/sort/page、home/results 两个 scrollTop、selected full identity、触发 ID。目录是已导入交易+已存资料，不能宣称全市场；无合适同代码异交易所/ETF/长名样本则该状态 NV，不能伪造证券身份。
4. CSS viewport、100% 浏览器缩放、DPR 独立记录；建议正文已计划的 1440×1000、1280×800，900/600 宽断点两侧（901/899、601/599），窄屏390；高度548上下要检查详情末尾可达。原图像素不是 CSS viewport。若工具无法实现视口，保留 NV，不用截图尺寸补造。
5. 每步保留 AX/截图前后；动效另留正常轨迹 during、rect/scroll；受控错误必须有可辨认恢复时机及代理已撤回证据。不要把工具 CDP 超时当点击成功或应用无响应。
6. 鼠标、真实键盘、桌面 IME、模拟触控、物理触控分别记结果。合成组件事件不能顶替；没有触屏设备仍记真实 NV。本文无用户授权排除窄屏/键盘/动效。

原稿根目录 `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/`。下表简写：

- **S**：正文 HP03:130–160 `HOME-HP03-B019` / `HV25-07..10`；manual:370–455；`images/search.svg`、`search-overlay-open.svg`、`search-detail.svg`。
- **E**：`search--detail.svg` 是无结果；`search--empty.svg` / `search-error-frame.svg` 是请求错误，不按名字颠倒。
- **D**：HP04:312–322 + HP03 详情（HV25-09及共享持仓来源要求）；`detail.svg`、`holding-return{,--detail,--after}.svg`。正文主按钮居中120×36裁定保留。
- **R**：HP06:434–464、附录2:646–668（HV25-44/45/46/53/55）；`journeys-library-entry.svg`、`library-return.svg`、`hcr06-final-return.svg`。URL 目标 live/market/accounts/date/full symbol；source snapshot 只恢复 UI，不暗中过滤库或切 queue。
- **T**：HP09:467–515（HV25-47/48/49/50）最新请求/15s/正常与 reduced 动效；`search-motion{,-before-frame,-during-frame,-after-frame}.svg`、`search-overlay-reduced-motion.svg`。
- 测试 **ST**=`search-surface.test.tsx`，**HT**=`home-surface.test.tsx`，**HOST**=`use-homepage-host.test.tsx`，**CAT**=`catalog-model.test.ts`，**SM**=`session-model.test.ts`。所有引用来自 `frozen-source/`，既有日志未在本任务重跑。

## 范围内控件登记（23 个稳定父 ID）

每个父 ID 的状态不是都要求八种；适用状态已明确。重复结果必须登记 `S06/<完整 item.key>`，原值按钮登记 `D04/<quantity|cost|marketValue|pnl|quote>`；root 冻结数据后附这两类的实际业务键集合，不能用“首项”代替身份。此局部登记只覆盖首条切片；A 的全量96状态记录不被改写，后续附件也不是全票 N/A。

| ID / 定位（Surface 冻结行） | 前置 / action / 输入 | 预期本地与全局 / 可见反馈与布局 | 适用状态；原稿 | 现有证据及未核实边界 |
| --- | --- | --- | --- | --- |
| S01 `#hp-symbol-search`:248 | 首页任一合法 applied scope；鼠标/Tab+Enter打开 | 焦点入输入；背景+侧栏 inert；全局范围不改；首页位置不跳 | default/hover/focus/pressed，pending打开；S/T | ST:30–45 焦点合成；root 既有鼠标；真实键盘打开/120ms hover NV |
| S02 searchbox:309 | 输入名称/代码，pause/IME/Enter | 299ms未提交、300ms提交；IME不抢确认；只目录查询不改scope；不可对隐藏旧候选开详情 | blank/typing/composing/settled/loading/error/long；S/E/T | ST:30–45 fake timers；CR02 error Enter **FAIL**；真实IME/其余hidden状态NV |
| S03 清除标的搜索:309 | 非空query；鼠标/Tab+Enter或Space | 只清query/selected/resultscroll；输入留焦；无迟到debounce重灌，scope不变；空query禁用 | enabled/disabled/hover/focus/pressed；S/E | 无独立当前clear回归；真实NV |
| S04 关闭标的搜索:308 | 搜索开；鼠标/Enter，Esc等效另测 | 关闭、恢复真实入口焦点；重开query/selected/非零resultscroll保留 | default/focus/pressed；S | ST:46–67只查query；CR01重开scroll **FAIL** |
| S05 search backdrop:293 | 搜索开无detail；点击外部 | 关闭搜索；不意外改范围；详情在时不得穿透关闭 | open/detail stacked；S | no对应search outside test；真实NV |
| S06 结果 `#hp-symbol-encode(key)`:311 | settled visible结果；鼠标/Enter/Space | 精确key进入详情；name/code/official exchange/currency/真实类别可见；unknown identity可解释但交易禁用 | normal/hover/focus/selected/long/identity-unknown；S | ST:46–80，CAT:13–38合成；root ROKU/AAPL局部，类别冲突/长名NV |
| S07 results region:310 | >1屏结果；实际wheel/滚动 | 仅内部滚动；输入/页底固定；detail关闭、search关开、ordinary来回均恢复 | overflowing/selected/restore；S/R/T | ST:81–108仅detail留DOM；CR01关开816→0 **FAIL** |
| S08 结果方向导航:300–306 | 输入/结果焦点；↑↓HomeEnd | 只当前可选结果导航，身份可见；IME不被抢焦；输入HomeEnd仍编辑 | keyboard/empty/loading/error/composing；S | 无当前arrow回归；CR03/04静态风险，真实NV |
| S09 search Tab循环:294–299 | 搜索开；Tab/ShiftTab/Esc | 焦点不落inert背景；Esc仅当前层；关闭后真trigger | open/empty/loading/error；S | 无完整search trap现有测试；detail trap不等于此PASS |
| S10 search error 重试:311 | error；鼠标/Enter | query/source保留，变loading，禁重复；成功可见新目录；失败不伪造empty | error/loading/disabled/recovery；E/T | HOST失败重试仅Hook；root error EnterFAIL不是retryPASS；真实重试NV |
| D01 详情关闭:318 | search或holding详情开；X/Enter | 返回正确来源的精确trigger，非默认title，解除inert后焦点 | normal/focus/pressed；S/D | ST:46–67、HT:78–92合成；root search Esc局部 |
| D02 detail backdrop:315 | 任一详情；外点 | 不关闭、不传到search/backstage、不改scope | open/stacked；S/D | ST:56–57、HT:70–71；root单视口外点局部 |
| D03 detail Tab/Esc:315–317 | 有/无禁用forward；Tab/ShiftTab/Esc | 围绕当前可用项闭环；tooltip Esc先关tooltip、下一Esc关detail、再Esc关search | known/unknown/pending/tooltip；S/D | ST:94–98、HT:40–45；root trap/两Esc局部；全部禁用组合NV |
| D04 原值5实例 Value:33–64,319–324 | 数量/成本/市值/PnL/最新价；hover/focus/click/Enter/Space/Esc | 显示真实完整原值/币种/符号，真0不当unknown；null解释原因；可固定和关闭 | normal/zero/unknown/long/signed/focus/hover/pinned；D | HT:122–146仅合成pointer/touch；真实0/long/复制/触屏NV |
| D05 查看交易:328 | 完整身份；鼠标/键盘 | 唯一主前往动作；按当前applied scope/date进入ordinary全目标，不取first episode；unknown/pending/navigation禁用 | enabled/disabled/loading/guard refused；S/D/R | ST:68–80 callback；SM集合；root ROKU honestempty局部；真实guard/pendingNV |
| D06 返回原来源:329 | 搜索非零scroll或持仓非默认页；鼠标/键盘 | 只退详情；恢复query/sort/page/scroll/selected/exacttrigger，不触发普通库导航 | search/holdings/source missing；S/D/R | ST:81–108/HT:104–120合成；root search scroll0局部；非零真实NV |
| D07 更新数据:327 | 真实unknown原因；点击 | 保当前对象/来源，明确pending；不捏造数值；实际保存/新读链由P1证实 | unknown/enabled/loading/disabled/error/retry；D/T | 无本切片真实持久化结果；按钮可见不算PASS，写入需隔离库 |
| D08 消失对象 fallback:158–164 | 新read移除当前完整identity | detail关闭，说明原因，焦点到搜索结果标题或持仓标题；不借另一对象 | removed/conflict/unchanged refresh；S/D/R | HT:47–59仅holding；搜索删除真实NV |
| R01 普通库回首页 | 从D05到ordinary；真实首页导航 | fresh read后UI snapshot恢复；目标URL与source职责独立；缺对象正确fallback | ready/pending/error/timeout/retry；R/T | root stableA/ROKU局部；pending/新hostNV |
| R02 离开guard取消 | 有真实未保存工作再导航 | URL/页/来源/旧commit不变；search detail仍在；holding路径另回归 | dialog/cancel；R/T | ST:68–75只callback refusal；真实guardNV |
| R03 离开guard接受 | 同R02选择接受 | 唯一最新导航与源快照；不由旧读抢回；完整target | dialog/accept/pending；R/T | HOST合成；真实NV |
| R04 浏览器Back/Forward | ordinary/home indexed history | compensating pop等待guard；取消留原entry；接受fresh read；不增乱栈 | back/forward/cancel/accept/no-index；R/T | HOST mock pop不等于browser；真实NV |
| R05 浏览器reload | source返回pending或settled | URL权威、catalog后校验、source不被旧all覆盖；loading/error可见 | cold/settled/pending/failed/reload；R/T | root稳定reload局部；NR01–06历史Hook不能替真实pending结果 |

## 最小有界操作集（12 个 journey，逐步留结果）

| Journey / 覆盖ID | 真实序列 | 字面观察 / 必须保存的反例 | 当前结果范围 |
| --- | --- | --- | --- |
| J01 开关/底层保护 S01/04/05/09 | 固定非默认scope和home scroll；先鼠标打开、X关闭、外点；再Tab+Enter开、键盘闭环、Esc退 | 输入焦点、真实trigger焦点、sidebar/home inert及rect；scope/title/77或当前数均不改；详情叠层时不穿透 | 部分既有鼠标；完整组合NV |
| J02 输入语义 S02/03/08 | 输入不同query；299/300边界由测试，浏览器观察300ms反馈；实际中文IME候选↑↓+确认；settled后立即改query再X | composition期间不搜索/抢焦，结束后300ms；X后blank无迟到query，scope不改；等待态Enter不得开旧详情 | debounce合成PASS；真实IME/clearNV |
| J03 四种“没结果” S02/03/10 | 分别blank、非空无匹配、真空catalog、readerror；每项记同区域before/after | 对应“输入名称…”/“没有匹配…”/“尚无可知证券…”/“证券目录读取失败…”不同；错误有重试，不显示伪0/空数据；error/loading Enter无详情 | error Enter CR02 FAIL，其余NV |
| J04 非零结果滚动 S04/06/07 | query6；实际滚至816或记录另一非0；开详情→X；再滚→开详情→source action；随后关search→重开 | 每段独立记录scrollTop、selected identity、query、activeElement；输入/页底不被结果滚动带走；重开仍非0 | CR01关开FAIL；其余非零真实NV |
| J05 详情四卡和原值 D01–04/06 | ROKU metadata-only与1个已持仓 known；依次焦点/hover/Enter/Space原值；Esc层级、Tab/ShiftTab、外点 | 四卡顺序数量/成本/市值/浮盈亏，最新价账户天数次层；unknown/真0/大数有全原值解释；只有一个前往；不把无持仓写0 | 单metadata-only/单视口局部；完整原值NV |
| J06 精确身份 S06/D05/08 | 同代码异exchange或stock/ETF、invalid metadata、合并多instrument IDs、长中文；缺fixture记NV | 每按钮完整exchange+symbol+class，不借first账户/回合；unknown可看解释但查看交易disabled；对象消失回正确标题并保query | CAT纯模型PASS；真实边界NV |
| J07 普通目标与稳定来源 D05/R01/R05 | A股全部账户/非默认date→跨市场ROKU→查看交易→reload ordinary→返回→ready→reload home | ordinary `scope=live, market=a, accounts=*, full symbol=NASDAQ:ROKU:stock`且date保留，诚实空/原因、无queue；来源query/非0scroll/selected/trigger恢复；附件不暗中过滤 | rootA/ROKU稳定scope/query局部；非0/date组合NV |
| J08 pending来源保护 R01/05 | 稳定A出发作正例；另cold/trades首次读失败→returnA ownedread未完→只滚动/输入→硬reload | UI-only source仍A，旧committed不能写回成all；不把NR04条件漏掉，也不冒称它是原Recall根因；新host hash绑定 | 旧Hook4PASS2RED；真实/新hostNV |
| J09 read失败/15s/晚响应 S02/10/D05/R01 | root受控read延迟/失败；确认旧scope/data；超15s；retry成功；再让旧响应返回 | “读取已超时，新范围未应用。”/失败可见；pending禁前往，Enter不打开隐藏候选；retry恢复来源，旧响应不提交；只读错误和更新数据失败分开 | CR02错误EnterFAIL；剩余NV |
| J10 leave guard及history D05/R02–04 | 用真实未保存工作，search forward取消/接受；再holding forward取消；browserBack/Forward重复 | 取消不关原详情/不改URL/source；接受只新一笔；补偿pop后history索引与地址一致 | 搜索callback拒绝合成PASS；真实均NV |
| J11 shared持仓来源回归 D01/05/06/08 | 持仓query非空、sort非默认、page2、home scroll非0；eye详情→返回；新读对象不变/删除 | 回原持仓行页/排序/查询/scroll和eye trigger；删除回“当前持仓（最新）”不是搜索标题；ordinary目标无selectedEpisode | HT合成；真实NV |
| J12 可比视觉/动效 全S/D | normal/loading/empty/error/selected/long；指定宽高与断点两侧；正常动效三帧，再reduced | stage max960/window-48、独立scroll、背景不可交互；detail四卡/主按钮/末尾来源动作可达；160ms开关、120ms hover、reduced即时；rect before/during/after及截图 | root1280×720/DPR2旧局部；其他视口、正常轨迹NV |

上述每个 journey 是有界数据/状态集合，不能用一次容器可见作为通过。J06 需要 root 记录实际全身份实例集合；J12 同一状态比原图，不把开/关两帧叫同态比较。root 可先完成阻塞 CR01/02 与 J07–09，再补其余必需项，但未做仍 NV，不能换成 N/A。

## root 填表与覆盖口径

每个控件/状态/输入变体另存一条：`ID / source hash / dataset+key / prerequisite / action / expected / actual / rect+scroll / local→parent→global→URL / persistence-or-return / error-cancel / evidence / status`。动态实例 ID 如 `S06/HKEX:2600:stock`、`D04/cost`，离开guard选项也独立。

- 原局部登记：23个父控件，12条journey；**父ID数不是已执行状态分母**。root 先固定业务键与适用状态/输入集合，再计算分母。
- 本代理真实UI执行：0。root交来的 CR01/02 两项 FAIL 可计各自真实执行状态，不能扩张成对应父控件全部状态已覆盖。
- 不混用历史版本/不同viewport数据：点击覆盖=真实操作且结果有证据状态数/应点击状态数；尝试率另记；状态覆盖、PASS率独立计算。尚未建完整执行表，所以这里不制造百分比。
- 后续修复需保留本目录 root FAIL 原件，在新目录/文件追加 GREEN；任何源更改后重查受影响旅程及源码manifest，不覆盖 start/end。
- 本文为只读审计交付，不提供“服务仍在运行/产品已完成”的保证；最终UI交付预览、启动命令与三门放行由root按项目工作流另行记录。
