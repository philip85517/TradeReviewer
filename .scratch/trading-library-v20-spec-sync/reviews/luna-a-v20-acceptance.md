# V2.0 静态图文预审报告（Luna A）

## 结论与边界

本报告是 V2.0 的**预审**，不是最终接受。审查模型为 `gpt-5.6-luna`，Max effort；时间为 2026-10-26（Asia/Shanghai）。本轮只审文档正文、fixture、生成器、reader、SVG 和静态参考图。依据 `acceptance-plan.md:1–12`，产品服务、鼠标/键盘/触控、真实行情回放、持久化和业务数据库检查在本轮文档范围内为 `NOT APPLICABLE`；这不是用户明确排除，也不把未实现产品功能写成 FAIL。

本次实际用 `view_image` 查看了：

- V2 当前渲染：`hcr06-final-sim-ab-1440-current.png`（1440×1000）和 `02-simulation-normal-1440-current.png`（1440×1095）。
- E 旧参考：`approved-e-sim-list-1440.jpg`、`approved-e-sim-stats-1440.jpg`；E 四图的实际查看记录在 [`luna-a-visual-reference.md`](luna-a-visual-reference.md)。

当前两个 ready 图在 1440 下的 E 外壳、模拟盘低饱和色板、层级、卡片节奏和文字可读性基本通过；但静态语义仍有阻塞项，且 1280 图与其余正文引用图尚未完成最终核对。因此当前包不能标记为最终通过。

## 版本指纹与检查命令

以下指纹是本次预审读取到的快照。工作树中 V2 源正文仍在被修订；`document-manifest.json` 尚未随当前正文重新生成，故两者指纹不一致是本预审证据的一部分。

|材料|路径|SHA-256 / 结果|
|---|---|---|
|权威逻辑规范|`docs/design-system/trading-library-design-spec.md`|`99c5c0930395e649a500a105e265e169a88636c7932949aa78bf8659ee39a3a3`|
|V2 正文（读取时）|`docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md`|`ed5a65a1edd281a5576771f0c3280e52766f3371885cd11b30f1cc3050170cd7`|
|V2 reader|`docs/design-system/baselines/2026-10-26-trading-library-v2.0/visual-spec.html`|`20c2522c3361327f99e30a6fb41b0772fac60545309139b8e8f1c4447827b9b7`|
|V2 fixture|`docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/library-design-fixture.json`|`e8af014c5029a0ba084fffebb150cdae8f242a4d520b7d6e8ae5b57eb216a3f3`|
|ready SVG：模拟列表|`source/images/hcr06-final-sim-ab.svg`|`662ae8b0cc2f09123c1501bd344d9bcb73b79dddedfd9c5c0978a2e1b432fdf0`|
|ready SVG：模拟统计|`source/images/02-simulation-normal.svg`|`1d28552ec11845f7d56a20ce5b2d0bba770374202f31cfd5b2c4659eeceb8608`|
|本轮 acceptance plan|`.scratch/trading-library-v20-spec-sync/acceptance-plan.md`|`8c56b333d1f03ed18f34c5e73ddbcdb2f19730ac3b2b59e9c25ee5abc9c80249`|
|本轮模拟列表渲染|`reviews/luna-a-v20-screenshots/hcr06-final-sim-ab-1440-current.png`|`e37bd58ac0537fa834e3de249a1a4863147dfb7277a557aab2b595c19123a4f7`|
|本轮模拟统计渲染|`reviews/luna-a-v20-screenshots/02-simulation-normal-1440-current.png`|`68ce08e3203d92c390c831e56d6d987285d3aab0ed29fcbafd9039468b524fe5`|

执行结果：

- `python3 source/test-library-metrics.py`：6 tests passed。
- `python3 source/test-homepage-template.py`：5 tests passed。
- `python3 .scratch/trading-library-v20-spec-sync/verify-package.py`：FAIL，`Source fingerprint mismatch`。这说明当前正文与已生成 reader/manifest 不是同一版本，不能把 reader 的通过当作正文已同步。
- `git diff --check`：本报告及 reference 报告无空白错误。

## 覆盖状态

|范围|状态|证据与限制|
|---|---|---|
|权威规范与确认裁决|PASS（规则基线）|已对照 `trading-library-design-spec.md:7–129` 与 `confirmed-findings.md:5–26`。|
|V2 正文 BT01–BT10|`FAIL + NOT VERIFIED`|正文已读取到 `:391`；下列静态冲突/遗漏仍在。worker 并行修改中，需重新生成后复审。|
|模拟列表 ready 图|`FAIL`|1440 外壳可读，但图内同日编号 `#01/#05` 与当前 fixture 的 `#01/#02` 不一致；见 F-01。|
|模拟统计 ready 图|`FAIL`|数字可由当前 fixture 重算为 6/5/388/60%，回撤规则说明正确；趋势 tooltip 仍写“已平仓有效回合”，见 F-02。|
|E 视觉外壳、尺寸、色彩|PASS（静态参考/当前 1440）|当前正文第二章已补齐 E 的详细尺寸与信息 `i` 入口；当前 1440 渲染无明显裁切/重叠。实现行为仍不在本轮范围。|
|1280 可读性|`NOT VERIFIED`|虽有 1280 旅程素材，尚未对完整 V2 主状态和当前版本逐图实际渲染核对。|
|其余 SVG、十章全部图文语义|`NOT VERIFIED`|本次只在 worker 未 ready 阶段查看两张指定 ready 图；其余引用图、图板和 reader 全量一致性待 worker ready 后复审。|
|产品交互、DB、持久化|`NOT APPLICABLE`|由本轮文档静态范围决定，不是用户明确排除，也不是产品通过声明。|

## 发现

### F-01（FAIL）同日练习序号在 ready SVG/reader 中仍错误

- **原句/证据**：`visual-design.candidate.md:158` 引用 `hcr06-final-sim-ab.svg`；该 SVG 的可见文字包含 `贵州茅台 · 2026-10-15 · #01` 与 `贵州茅台 · 2026-10-15 · #05`。reader 的旧构建正文 `visual-spec.html` 的 `data-source-line="79"` 也写明“当前 fixture 的六行练习包括同标的同练习日的 `#01` 与 `#05`”。
- **规范依据**：`trading-library-design-spec.md:29` 要求同标的同日的独立练习使用稳定序号 `#01/#02`，排序不能改变编号；`confirmed-findings.md:12` 要求稳定编号和练习身份层级一致。当前 fixture 已将 E 写为 `library-design-fixture.json:333` 的 `贵州茅台 · 2026-10-15 · #02`，并在 `:787` 保留其独立 exercise id。
- **分类**：真实冲突；同时是正文、SVG、fixture、manifest 未同步的版本问题。
- **修复建议**：将 ready SVG、正文/reader 的对应文字统一为 fixture 的 `#01/#02`，重新生成所有引用图和 manifest，再用同日重复导入顺序检查编号稳定性。不要把 `practice_number: 5` 当作显示序号。

### F-02（FAIL）模拟统计趋势 tooltip 把练习趋势说成“已平仓有效回合”

- **原句/证据**：`generate-library-frames.py:625` 及当前 `02-simulation-normal.svg` 的 `<title>` 文字为“趋势口径：按日期累计已平仓有效回合的净盈亏，费用已扣除；模拟盘汇总各练习结果，不代表一个连续账户的权益曲线。” ready 图的标题却是“可计算练习累计净盈亏”。这两句把模拟统计的标题和提示口径割裂。
- **规范依据**：`trading-library-design-spec.md:81–87` 要求模拟盘汇总以每次练习为样本，内部配对只在详情或明确预览；`confirmed-findings.md:7` 明确总体按练习、不能沿用配对/回合样本。
- **分类**：真实冲突（静态 SVG/生成器文字）。
- **修复建议**：把模拟分支的 tooltip 改为按练习日期累计可计算练习净额；实盘分支才使用人的主动平仓回合。对应 journey 图和 caption 也要避免“模拟回合/已平仓回合”作为总体分母。

### F-03（FAIL）统计主体仍把模拟盘的总体样本写成有效回合

- **原句/证据**：`visual-design.candidate.md:53` 写“统计按回合样本阅读”；`:183` 写“当前模拟盘设计样例有7个有效回合、5个盈利做多回合”，并列出方向卡；`:199` 将分布轴写成“回合数”；`:210` 的模拟统计图注仍写“7个有效已平仓回合、5个保存日期”；`:223–230` 的模拟趋势/空态/粒度图注继续用回合数和保存日期。
- **规范依据**：`trading-library-design-spec.md:81–87, 97–107`：模拟总体以练习为一个样本，胜率分母是可计算练习数；收益率样本也按练习本金单独计算。`confirmed-findings.md:7,11` 要求正文、图、fixture、生成器统一 6 练习 / 5 可计算 / 1 未知。
- **分类**：真实冲突与图文遗漏的组合项。
- **修复建议**：区分实盘“主动平仓回合”与模拟“练习”全文术语；模拟统计卡、分布轴、趋势 caption、缺失/空态说明均改为练习单位。当前 fixture 的独立数字 oracle 是 6、5、1、388、60%，不能继续保留旧的 7/回合/方向卡文案。

### F-04（FAIL）未写出已确认的去重、内容变化选择与人工成果保护流程

- **原句/证据**：当前 `visual-design.candidate.md:91–130` 的日期、搜索和刷新章节没有重复导入、等价格式/行顺序变化、内容变化后的更新/新建选择，也没有人工笔记/截图/批注保护或“待核对”边界；全文 `rg` 未找到“重复导入/更新原练习/新建练习/待核对”这一组规则。BT10 `:384–389` 只保留 O02 和默认值待确认。
- **规范依据**：`trading-library-design-spec.md:27–45` 已确认：格式或行顺序变化仍算等价重复；内容变化先由用户选择更新或新建；更新保护人工成果，受影响部分标记待核对；`confirmed-findings.md:13,25–26` 要求这些原则进入正文、图、fixture/生成器复核，不能用免责声明替代。
- **分类**：确认规则遗漏，不是待定项。
- **修复建议**：在 BT03 增加导入确认、等价判重、变化选择和人工保护的用户可见边界；在 BT04/BT07 或对应分镜补充打开原练习、不新增编号/统计、更新后受影响区域待核对的文案。具体匹配算法和冲突 UI 仍可保持未决，不能删掉已确认的原则。

### F-05（FAIL）练习边界被无依据收窄为“一次练习对应一个标的”

- **原句/证据**：`visual-design.candidate.md:134` 写“**一次练习对应一个标的**，可以包含多个交易回合”。
- **规范依据**：`confirmed-findings.md:21` 明确不采纳“必须一标的”的约束；多标的练习的名称、方向和拆分仍待定。权威规范 `trading-library-design-spec.md:127` 也把跨账户/证券边界列为未决，不能由设计样例推出生产限制。
- **分类**：真实冲突，过度确定未决规则。
- **修复建议**：改成“一个导入文件构成一个练习；多标的呈现、命名和拆分仍待确定”，并保留当前单标的 fixture 作为样例假设，不把它写成产品约束。

### F-06（FAIL）整体净额公式没有在 V2 正文明确表达，且 A 的内部配对说明容易冒充总体结果

- **原句/证据**：当前正文没有 `净额 = ...` 的整体公式；`visual-design.candidate.md:153` 只写“50 股回合净值 990.00、30 股回合净值 894.00、已平仓合计 1884.00”，并写“所有回合、趋势和分布图由 ... 成交配对派生”。生成器 `generate-library-frames.py:287–321` 实际按练习计算 `realized_gross + floating - fees`，但图文合同没有把这个整体层级写清楚。
- **规范依据**：`trading-library-design-spec.md:89–95` 要求整体净额为未扣费已实现 + 未扣费剩余浮动 − 费用一次；缺少余仓估值时整体未知，不能用已实现部分冒充练习结果；`confirmed-findings.md:10,20` 特别要求修复部分结果冒充整体的问题。
- **分类**：口径遗漏，且现有“趋势和分布由配对派生”会造成样本层级冲突。
- **修复建议**：在 BT05 明写整体公式、费用来源已含费时的等价净额、余仓未知态；将 A 的 990/894 仅放在详情/内部配对说明，明确它们不构成练习总体统计。统计趋势和分布改由练习派生。

### F-07（FAIL）模拟日期又退回“保存日期/导入文件保存日期”语义

- **原句/证据**：`visual-design.candidate.md:177–181` 将模拟列表/统计日期写成“导入文件中保存的练习日期”“保存日期”；`:210, :223–230, :276` 的图注和返回快照继续使用“练习保存日/保存日期”。
- **规范依据**：`trading-library-design-spec.md:47–61` 区分练习日期、历史交易区间和导入时间；练习日期是用户实际进行练习的日期，必须在导入前有效，`saved_date` 不能直接当真实来源；正式列表没有未知日期分支。`confirmed-findings.md:9` 要求三种日期分离。
- **分类**：真实冲突/残留旧文案。
- **修复建议**：所有模拟主状态和趋势 caption 改为“练习日期”；历史成交区间与导入时间只在详情/来源追溯处显示。若 fixture 使用 `imported_at` 或保存字段，应注明它是样例来源，不当作统计归属。

### F-08（FAIL）fixture、ready SVG 和 reader 的样本口径不同步

- **原句/证据**：fixture `:169, :333` 当前是同日 `#01/#02`，`simulation_accounts:777–790` 也列出六个练习；但 ready SVG 仍显示 `#01/#05`。同时 candidate `:41` 已写 6/5/1/388/60%，而 reader 的已构建正文 `visual-spec.html` 仍含 `data-source-line="183"` 的 7 回合旧文案，manifest fingerprint 为 `34f1...`，不等于当前正文指纹。
- **规范依据**：`acceptance-plan.md:10–12` 要求所有 SVG 文字与章节一致并记录包指纹；`confirmed-findings.md:26` 明确“仅改正文或添加免责声明”不能掩盖图中旧口径。
- **分类**：包版本/引用一致性 FAIL。
- **修复建议**：以当前正文和 fixture 为唯一生成输入，重新生成所有 SVG、reader、manifest、identity；运行 package checker 后再审。报告中不要把当前 reader 旧构建当作正文已经通过。

### F-09（NOT VERIFIED）实盘回合/成交/配对/余仓的完整图文映射仍需全包复核

- **证据**：正文 `:38, :140–155` 已有“人的主动平仓”与 100+50→卖80 的例子，但当前 ready 图只覆盖模拟列表和模拟统计；实盘列表、回合详情、回放和返回图尚未在本轮实际渲染核对。
- **规范依据**：`trading-library-design-spec.md:63–79` 要求一次人的主动平仓形成一个回合，技术拆单、配对份数和成交条数分开，余仓不要求清零；`confirmed-findings.md:8,16` 要求实盘示例和返回/详情边界同步。
- **分类**：未决核对范围，不把它写成已通过或产品 FAIL。
- **修复建议**：worker ready 后逐张查看实盘列表、rounds、replay、return SVG；确认图中文字没有把 50+30 分配写成两次人的主动平仓。自动识别行为仍保持未决。

### F-10（NOT VERIFIED）“最差练习回撤”规则已确认，真实权益输入来源仍未决

- **当前证据**：正文 `:185–191` 明确取每个练习单次最大回撤中的最大值，且 ready `02-simulation-normal.svg` tooltip 写“取所选练习中最大的单次练习权益回撤，不把不同练习拼成一个账户”；当前样例缺路径所以显示破折号。
- **规范依据**：`trading-library-design-spec.md:21–25` 已确认单练习最大回撤；`trading-library-design-spec.md:127` 只把初始资金/估值的真实来源列为未决。
- **分类**：规则 PASS，输入来源 NOT VERIFIED。不能再把“最差练习取单次最大”列为未决。
- **修复建议**：保留现有规则文字；最终报告只标真实权益路径、初始资金和估值来源待明确，并检查缺路径时不补零。

### F-11（NOT VERIFIED）reader 与当前正文/图片的构建同步未完成

- **证据**：`verify-package.py` 返回 `Source fingerprint mismatch`；`document-manifest.json` 的 `sourceFile` 指向当前正文路径，但 manifest fingerprint 仍为 `34f1...`，而本次读取的正文是 `ed5a...`。reader 仍渲染旧的 7 回合、`#05` 和旧统计文案。
- **分类**：版本构建未验证。
- **修复建议**：worker 完成正文后一次性运行 README 的四条构建命令，核对 `document-identity.json`、manifest、所有引用 SVG 的 hash，再重新生成本报告需要的 1440/1280 截图。

## 已核对且当前可保留的部分

- `visual-design.candidate.md:38` 已正确写出练习样本、实盘回合、内部配对和实际成交行四个单位，并将未平仓数量作为状态指标；早期“说三个列四个”的问题已修正。
- `visual-design.candidate.md:61–70` 已把 E 的 1440×1000/1280×800、自然增长、96/24 内容边界、字号、220 搜索、36 动作、320 浮层、图标尺寸、模拟色板和状态色写入；早期详细尺寸遗漏已修正。
- `visual-design.candidate.md:87` 已使用信息 `i` 入口并保留 36px 命中区、16px 图标、280px 浮层和完整口径说明；早期“问号图标”问题已修正。
- `visual-design.candidate.md:116` 已写明练习日期需在导入完成前有效，缺失日期只能停留在导入校验阶段，正式列表不显示未知练习日期；这条日期原则本身通过，但后文“保存日期”残留仍触发 F-07。
- `visual-design.candidate.md:185–191` 与 ready 模拟统计图的回撤说明符合“所选练习中单次最大”的已确认规则；只保留真实权益路径来源未决。
- 当前 `02-simulation-normal.svg` 的可见指标 6 个练习、5 个可计算样本、388.00 CNY、60.00%、费用 40.00 与当前 fixture 数字可重算相符；这只证明当前这张图的数字 oracle，不能抵消趋势 tooltip 和正文旧文案问题。
- 两张当前 1440 渲染与四张 E JPG 的外壳比较中，侧栏/顶栏/二级栏、模拟低饱和背景、指标→趋势→分布层级和自然长页均可读；截图证据见本报告列出的两个 `-current.png` 文件。

## 后续接受条件

worker ready 后，重新生成正文/reader/manifest/所有引用 SVG，再执行一次独立全量复核：BT01–BT10、fixture、generator、全部图文引用、实盘/模拟主状态和详情/回放/返回图；实际查看 1440 与 1280 主要图。最终报告需保留本次 findings 的 PASS/FAIL/NOT VERIFIED 历史，不因产品交互或数据库在文档范围外而伪造通过。
