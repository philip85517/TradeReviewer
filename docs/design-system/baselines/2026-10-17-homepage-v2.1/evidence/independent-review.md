# 首页视觉规范 V2.1 独立复核

复核日期：2026-10-17（Asia/Shanghai）  
复核对象：`docs/design-system/baselines/2026-10-17-homepage-v2.1/`  
复核触发：用户要求按 12 项审查问题修订首页视觉规范，并要求独立检查原子控件、用户旅程、39 条原评论与实际渲染图。  
当前结论：**12 项修订均通过静态设计复核。** 39 条评论为 36 PASS、1 PENDING_DECISION、2 EXCLUDED。C18 保持待决定；C34/C38 按用户指示排除窄屏。

## 方法、范围与排除

本次复核按 `docs/agents/frontend-control-audit.md` 记录范围和证据。我读取了原 12 项问题、V1 的 39 条评论 JSON、V2.1 正文、原子合同、旅程合同、评论响应清单及生成器；将 11 张原子 SVG、7 张旅程 SVG、2 张首页主稿渲染为 PNG，并逐张直接查看像素结果。证据文件在 `.scratch/homepage-spec-v2.1/evidence/`；所审源文件 SHA-256 清单在 `evidence/evidence-sha256.txt`。

这是**静态设计规范复核**。没有修改设计，也没有检查产品实现、真实浏览器交互、数据库、持久化或触控设备。因此产品功能、运行时焦点、真实滚动和持久化验收均为 **NOT VERIFIED**，不能由这些分镜替代。本轮桌面范围是 1440×1000 与 1280×800；窄屏按 C34/C38 排除。D01 仅对应 C18。

## 12 项结论

| 项 | 结论 | 独立证据与判断 |
|---|---|---|
| F01 原子控件八态 | **PASS（静态）** | 合同有 11×8=88 行（78 applicable、10 N/A），并为每行给 trigger/feedback/exit/keyboard/recovery。最终重渲染的 DataTable disabled 已降低整格对比、禁用查看图标并显示“查看/分页不可用 · 权限不足”，与合同一致。 |
| F02 贡献展开锚点 | **PASS（静态）** | 最终 `journey-contribution.svg` 用 8 帧真实画出 10→15→20、20→25→30、收起前 30/中 15/后 10；每帧有真实行、首行/按钮局部坐标、`scrollTop=S` 与 focus 11/21/10，并规定 200ms、反向续播和 reduced-motion。 |
| F03 交易库交接 | **PASS（静态）** | `journey-library.svg` 显示 market/scope/accounts 与 queue/date 两类 URL、刷新保持、非法 market 回退全市场及返回焦点/滚动。`comment-review.md` C32/C33 也已同步完整 accounts、直开、刷新和返回。 |
| F04 范围与日期竞态 | **PASS（静态）** | `journey-scope.svg` 展示 committed A、候选 B、候选 C、迟到 B 丢弃、失败回 A、局部重试成功和无缓存初载失败；市场/币种/账户/实模拟整组一致，日期变化不改“最新持仓”口径。局部异常框中的重试是失败状态入口，不要求在稳定主界面增加按钮。 |
| F05 曲线缺口 | **PASS（静态）** | `journey-gap.svg` 的缺口是实际可聚焦入口，显示无行情/无汇率原因、覆盖数、不插值、失败保留和关闭后焦点返回。 |
| F06 历史边界 | **PASS（静态）** | `journey-history.svg` 覆盖年份选择、空年不伪造 0% 胜率、0 待复盘但保留 38 个已平仓回合、市场同步、历史贡献进入和关闭返回。 |
| F07 尺寸与命中区 | **PASS（静态）** | 原子合同与几何板统一桌面 36px 命中区，并明确 Token、RetryAction、StatusBadge 等例外；图标、行高、表头/分页尺寸与本轮桌面范围一致。没有宣称 44px 触控合规。 |
| F08 搜索与低频查看 | **PASS（静态）** | `journey-search.svg` 覆盖打开、清空仍保持弹层、无匹配与清除入口、候选详情、局部范围不污染全局、Esc/× 关闭、焦点返回和长名称 tooltip；旧 `local-search.svg` 也显示本地 280px 搜索和 8 行恢复。 |
| F09 日期快捷与非期末 | **PASS（静态）** | `journey-date.svg` 覆盖快捷范围、草稿、应用中保留旧数据、10-14 非期末浮层、失败/重试、成功提交和取消；数值满足 7440 + 10012 − 6252 = 11200，当前持仓仍取最新市值。 |
| F10 无汇率异常 | **PASS（静态）** | `state-no-fx.svg` 使用中性破折号和琥珀提示，保留原币 USD；未用绿色正收益表达未知折算结果。 |
| F11 字体与几何候选 | **PASS（静态）** | `tokens.svg` 明确采用系统字体栈、概念 Web Sans 未落文件、等宽候选被拒；`geometry-tokens.svg` 与 motion 图给出几何、32px 行距、反向/中断与 reduced-motion。 |
| F12 旧统计与 D01 映射 | **PASS（静态）** | 正文已撤销 V2 的旧 R4/“37 PASS”肯定结论；D01 只关联 C18。C28/C32/C33 是已确定的交易库迁移，不属于 D01。最终统计必须依据本报告重新生成。 |

## 原子图逐图检查

| 原子 | 结论 | 直接查看 PNG 的结果 |
|---|---|---|
| IconButton | PASS | 36×36、hover/focus/pressed、禁用、loading、error 与键盘说明可辨。 |
| SegmentedTabs | PASS | hover/pressed 只作用单一 segment，焦点、loading、empty/error 有独立反馈。 |
| Select | PASS | pressed 菜单只列账户，不混入 market/scope；方向键、Esc 和错误恢复齐全。 |
| Popover | PASS | 八态画板完整，非模态搜索可 Tab 离开；关闭和错误恢复有明确路径。 |
| Token | PASS | empty 明确 N/A，loading 有可见 pending/spinner；删除命中区与恢复路径成立。 |
| Metric | PASS | 骨架、空值“—”、错误详情与只读 N/A 状态对应。 |
| StatusBadge | PASS | 键盘打开详情成立；只读 disabled/empty 保留 N/A 原因，没有虚构 CTA。 |
| DataTable | PASS | 8 行/槽位及总画布容纳八态；disabled 格明显降低对比，查看图标变灰，并在分页区域给出“查看/分页不可用 · 权限不足”；loading 分页灰置；empty 显示“0 项 · 无可用分页”，不再伪造第 1 页。 |
| ChartTooltip | PASS | loading 有可见提示，empty/error 不伪造金额，键盘路径与图表入口对应。 |
| EmptyState | PASS | 0 持仓、无结果、无贡献文案与 CTA 状态清楚。 |
| RetryAction | PASS | 32px 可见/36px 命中、loading 防重复、成功移除及播报路径清楚。 |

## 旅程图逐图检查

| 旅程 | 结论 | 直接查看 PNG 的结果 |
|---|---|---|
| contribution | PASS | 8 帧真实行完整覆盖 10→20、20→30 与收起前/中/后；32px 节奏、按钮坐标、scrollTop、焦点、反向中断和 reduced-motion 均可核对。 |
| library | PASS | 两类 URL、直开/刷新、非法 market、返回焦点与滚动均可见。 |
| scope | PASS | A/B/C 竞争、late B ignore、回滚、手动重试和无缓存错误均可见。 |
| gap | PASS | 实际缺口入口、原因浮层、重试失败与焦点返回均可见。 |
| history | PASS | 年份、空年、零复盘、市场、历史贡献和返回均可见。 |
| search | PASS | 清空、无匹配、详情、关闭和焦点返回均为真实控件分镜。 |
| date | PASS | 快捷范围、草稿、非期末详情、失败/重试、成功/取消均可见。 |

## 39 条评论状态

机器可读逐条记录见 `comment-coverage.json`。最终统计为：36 PASS、1 PENDING_DECISION、2 EXCLUDED。C18 是唯一待决定项；C34/C38 是用户明确排除的窄屏项。PASS 只表示静态设计响应通过，不表示产品实现通过。

## 中间 FAIL 与关闭记录

独立复核没有把生成成功或合同计数当作通过。在最终 PASS 前共退回三处实际渲染问题：

1. DataTable disabled 初稿与 default 近似、仍用蓝色可操作图标且没有相邻禁用原因。最终稿降对比、图标灰置并补“权限不足”，复验关闭。
2. 贡献旅程初稿只有 10→20 与反向收起，没有验收要求的 20→30。最终稿扩为 8 帧，补 20→25→30 以及对应坐标、scrollTop 和焦点，复验关闭。
3. DataTable empty 初稿仍显示“第 1 页/分页”，与 0 项冲突；loading 的分页也像可用。最终稿改为“0 项 · 无可用分页”并灰置 loading 分页，合同 JSON 同步，复验关闭。

同时，`comment-review.md` C32 初稿漏 `accounts`，C33 未写直开/刷新/返回；最终逐条响应已与 F03 URL 合同同步。以上修订后的 PNG 已重新直接查看，最终 SHA-256 清单已覆盖最新 SVG/合同。

## 最终边界

本轮没有剩余的静态设计阻塞。C18/D01 仍需用户决定是否保留历史持仓日期；这不影响已完成的曲线缺口交互合同。C34/C38 的窄屏设计继续排除。产品实现之后仍须独立完成真实浏览器的功能、视觉、状态安全与持久化验收；本报告不预判其结果。
