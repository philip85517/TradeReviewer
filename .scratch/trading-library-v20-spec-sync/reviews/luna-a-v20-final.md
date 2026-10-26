# Luna A：交易库 V2.0 最终静态图文与逻辑复核

日期：2026-10-26  
复核模型：GPT-5.6 Luna，Max（按任务要求）  
结论：**PASS（仅适用于文档、静态图例、fixture、生成器和 reader；无新的业务逻辑阻断）**。

## 范围、方法与边界

依据 `.scratch/trading-library-v20-spec-sync/acceptance-plan.md:1-12`，本轮复核了：

- 权威 `docs/design-system/trading-library-design-spec.md` 全文、已确认 findings，以及 V2.0 正文 `source/visual-design.candidate.md` 的 BT01–BT10 十章；
- V2.0 fixture、生成器、契约测试、reader、manifest/identity、README 与 implementation report；
- 当前 41 张 SVG 的 XML、文字、viewport、模式/单位/返回标签；
- 1440 与 1280 的尺寸/覆盖合同；以及 E 的四张批准 JPG：`approved-e-live-list-1440.jpg`、`approved-e-live-stats-1440.jpg`、`approved-e-sim-list-1440.jpg`、`approved-e-sim-stats-1440.jpg`。四张 E JPG 已实际查看；当前 SVG 以最终 XML/文字和 viewport 直接核对，reader 的新鲜浏览器视觉/链接检查仍由 root 的验收范围负责。

本轮没有把产品鼠标/触屏、数据库写入、真实行情回放、持久化或生产算法当作文档验收项。它们按 acceptance plan 第 3 行属于 N/A；这不是声称产品已经实现，也不是用户排除这些后续 gate。未决的真实输入来源、行为识别、方向分类、资本/估值来源等仍按规范保留为未决，不扩大为冲突。

## 冻结证据

协调者提供并核对的最终内容指纹如下，报告保留原值：

| 资产 | 指纹 |
|---|---|
| V2.0 source | `dd25c5dab416ff1c24b1abd02fdd8212b79ae90eb5456846a7c3e59f751aca43` |
| reader | `134f6a313c831e0ebe293e086e0ae294ff187b4669ac1b70137220c0c87d717d` |
| generator | `d3ad5ffd6a31fb7fa0f9b8bd9573e649d2998c97c9c16fdbd1a50cece8923d09` |
| fixture | `d3a9639acb518a95a94924c568d9b957831679838c8f43c8eb897e967e72951e` |
| canonical | `99c5c0930395e649a500a105e265e169a88636c7932949aa78bf8659ee39a3a3` |
| manifest | `da89028cc159c7e6512ef93e8dede498af85cf2b0ca473bb98e4d9180965a1da` |

复核命令和结果：

- `python3 .scratch/trading-library-v20-spec-sync/verify-package.py`：通过；`blocks=322`、`imageOccurrences=44`、`checkedReferences=130`、`preservedV11Files=89`、`preservedCommentStores=1`、`errors=[]`。
- `python3 source/test-library-metrics.py`：8 tests OK。
- `python3 source/test-homepage-template.py`：5 tests OK。
- 当前 41 张 SVG 全部 XML 解析通过；`git diff --check` 通过。
- viewport 覆盖为 3 张 `1280×800`、21 张 `1440×1000`，其余为自然纵向增长的 `1440×1047/1095/1123/1187/1211`，以及 4 张 `1440×2346` 首页长图。正文第二章 `visual-design.candidate.md:61-72` 的 1440/1280、96px 左 rail、24px 右余量、无裁切、自然纵向增长和字体/色彩合同均有对应覆盖。

## 逐项逻辑与图文复核

以下是最终包中最容易与旧 V1.1 文字混淆的规则及当前证据。每项均为已合规，未发现需要在 V2.0 追加修复的冲突。

| ID | 当前证据 | 规范依据与判定 |
|---|---|---|
| C01 练习/回合/配对分层 | 正文 `visual-design.candidate.md:38,136,144` 明确一次导入文件是一项模拟练习；实盘回合是人的主动平仓；内部配对、实际成交行、余仓是不同单位。SVG 的模拟页使用“练习数”，实盘页使用“回合数”。 | canonical `trading-library-design-spec.md:7-19,63-87`。合规；没有把部分盈亏或余仓冒充整体练习/回合统计。 |
| C02 主动平仓与技术配对 | 正文 `:155,159` 明确一次主动卖出可形成两条内部配对但只形成一条实盘回合，余仓仍未平仓；`human_action_id` 只是设计边界，不冒充生产识别。 | canonical `:63-79`。合规；技术配对没有被当作人的多个回合。 |
| C03 日期口径 | 正文 `:116,128,178-183,212,285` 分离练习日期、历史成交日期、导入时间；模拟使用确认练习日期，实盘列表使用成交日期，实盘统计/趋势使用回合平仓日期；无效/歧义日期须导入前补填/确认。 | canonical `:47-61`。合规；当前 V2 SVG/reader 没有把 `保存日期`、`文件内保存日期` 当模拟统计口径。 |
| C04 去重、稳定编号和人工保护 | 正文 `:146` 覆盖等价重复（账户、标的、练习日期及全部内容，含格式/列/行序）、无法匹配记录、稳定 `#01/#02`、重复复用身份、变化先选择更新/新建、历史/人工成果保护和 pending review。最终 SVG 无错误的 `#05` 或重新编号文本。 | canonical `:27-45`。合规；没有用免责声明替代确认规则。 |
| C05 净额、费用、余仓未知 | 正文 `:157,200` 及模拟统计 SVG `02-simulation-normal.svg` 对应“未扣费已实现毛盈亏 + 未扣费残余浮动毛盈亏 − 费用一次”；缺结束估值保持未知，不补零或当前报价。数值 388、4677 和缺失输入分支与 fixture/test 一致。 | canonical `:89-95`。合规；未发现“已扣浮盈再扣费用”或费用重复扣除。 |
| C06 统计分母与日期趋势 | 正文 `:191-200,204-216,241-245` 明确模拟总数 6、可计算 5、未知 1、胜率 3/5=60%，收益率样本独立；最差练习回撤取单次练习最大 MDD，实际权益来源仍未决。`09-missing-input.svg` 与 `journeys-trend-gap.svg` 保留总数/未知数，不删除缺失练习。 | canonical `:21-25,81-109`。合规；最差练习规则已确认，只有真实输入来源未决。 |
| C07 模式和返回链 | 正文 `:258-262`、`:161-169` 分开模拟“练习详情 → 内部配对 → 配对回放 → 返回练习详情”和实盘“标的回合集 → 回合复盘 → 返回回合集”。当前 `hcr06-final-replay-a1/a2/b1.svg` 使用“返回练习详情”，`journeys-library-replay.svg` 使用“返回回合集”。 | canonical `:7-19,63-87` 与正文第六章。合规；没有全局替换导致实盘/模拟模式混淆。 |
| C08 缺失、未知、空态 | 正文 `:304,313,316,325,328` 把实盘无已平仓回合、模拟无可显示内部配对、结果未知和导入日期验证分开。最终 `06-empty.svg` caption 已为“模拟盘范围无练习”，且明确与已有练习但无内部配对/结果未知区分；它确实对应模拟统计空态。 | canonical `:47-61,81-95`。合规；此前空态 caption 问题已关闭，不构成当前阻断。 |
| C09 账户与资金边界 | 正文 `:101,200,298,402-405` 保留一个模拟账户可含多项练习、不拼连续账户权益；初始资本、结束估值、历史报价来源和多账户/多标的命名仍未决。 | canonical `:21-25,125-129`。合规；没有把旧 fixture 的金额解释成生产账户曲线。 |
| C10 视觉合同与语义层级 | 正文 `:61-72,76-87` 规定 E 外壳、密度、尺寸、颜色、信息 i 和 1440/1280 边界；四张 E JPG 实际查看到深色 rail/header、二级 tabs、卡片层级、蓝色控件、正负颜色和模拟/实盘统计层级，当前 V2 SVG 文字与模式单位相符。 | E 只提供几何/密度/颜色；正文 `:7,85,382` 明确 V2 语义以正文和当前 SVG 为准。合规；没有把 E 历史业务文字照抄为 V2 规则。 |

## 唯一的非阻断观察项

**OBS-A-01（范围文案风险，不是业务逻辑冲突）**：V2 README 第 3 行原句为：

> “状态为 `implementation-ready`，供协调者进行独立链接、索引和视觉复核。”

这句容易让未读上下文的读者把静态包状态理解成产品已实现。当前 README 第 19 行已说明“该服务只提供静态设计文档和图稿，不连接产品数据库”；`.scratch/trading-library-v20-spec-sync/implementation-report.md:3,56-58` 也明确“不代表最终验收”及产品 UI/DB/浏览器 gate 不适用；正文 `visual-design.candidate.md:354-378,410` 把产品验收写成未来要求。因此它不构成当前逻辑阻断，也不能据此声称产品实现通过。建议后续将状态文案收窄为“static-review-ready”或补上“静态设计资产已 ready，不代表产品实现”。本轮不修改实施文件。

## 已核对但不纳入业务冲突的内容

`navigation-e-prototype.html:100,105-106` 仍有旧的视觉样例文字，例如模拟“练习保存日期”、7 个有效回合、2272 等。它是旧业务样例，但正文 `visual-design.candidate.md:85,132,298,382` 和 V2 README 第 19 行把该页限定为 E 几何/密度参考；当前 V2 正文、reader 和 41 张 SVG 才是语义基线。因此这属于已声明的 reference-only 内容，不能作为 V2 业务冲突。类似地，旧 V1.1 基线保留其历史资产，不替代本次 V2 语义基线。

以下边界在 BT10 `visual-design.candidate.md:402-408` 和 canonical `:125-129` 中仍明确为未决，本轮不把它们扩展成 FAIL：多标的/多账户命名和分组、初始资本/结束估值/报价真实来源、人的主动平仓识别、混合方向/加减仓/跨日生产分类、预览列与冲突详情、部分导入/历史缺口/账户边界/错误恢复。

## 最终签署

在给定冻结指纹下，V2.0 静态文档、图例、fixture、生成器和 reader 可签署通过；没有新的 confirmed blocker。`06-empty.svg` 的模拟练习空态已与实际图义一致。保留 OBS-A-01 供协调者决定是否改善包状态措辞。此结论不覆盖产品浏览器、控制器、数据库、持久化或真实回放验收，且不把静态图稿描述成已实现产品。
