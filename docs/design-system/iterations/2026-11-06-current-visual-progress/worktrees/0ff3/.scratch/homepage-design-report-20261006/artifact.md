# Design Report 模板只读技术蒸馏

本文件只覆盖 OOXML 结构检查、可编辑槽位和包保留规则。没有创建、修改或另存参考 DOCX，没有运行作者操作标记。页内实际视觉位置和参考图比对由主代理负责；本记录不能代替逐页渲染验收。主代理随后提供了 6 页 reference render 和目录溢出缺陷的直接视觉确认，已纳入以下补充。

## 参考与证据

- 参考 DOCX：`/Users/zhoulin/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-design-report/assets/reference.docx`
- 预览：同目录 `assets/preview.png`；本代理未查看图片，不能据此作视觉结论。
- 参考 SHA-256：`ba1e11258ff52659318a321462a5e598c7bed33cf991329eb91150788fcd1a7b`；检查前后相同。
- 运行环境：只使用 `/Users/zhoulin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3`，未安装依赖。
- 机器证据：`template-parts-inventory.json`（18 个 ZIP parts 的路径、字节长度、SHA-256、分类、全部关系）；`template-structure-evidence.json`（完整属性树和稳定 XPath）；`template-slot-map.json`（81 个段落槽）；`template-style-evidence.json`（官方 style lint）。
- 使用的官方只读检查：section_audit、style_lint、heading_audit、images_audit、fields_report、content_controls list。只读 OOXML 确认不存在脚注、尾注、评论、customXml、图表、文本框，所以这些不存在项无需额外 feature audit。
- 总计 2 个 section；主文档 74 段（body 直接子段仅 46，其他位于 TOC 或表格），页眉 5 段、两个页脚各 1 段；2 张正文表、1 张页眉表；1 张内嵌封面图；2 个 SDT；1 个 TOC field 与 1 个 PAGE field。
- 页数：**6 页，由主代理逐页渲染并直接查看后确认**。原目录缓存的逻辑第 2–5 页不等于物理页码；封面不显示页码，目录开始使用第二节页码系统。根代理应在 artifact.md 添加其实际 reference render 路径。

## 页面与 section

两节均为 US Letter 纵向：12240 × 15840 twip = 8.5 × 11 in = 215.9 × 279.4 mm。上、下、左、右页边距均为 1440 twip = 1 in = 25.4 mm；可用文本区域 9360 × 12960 twip = 6.5 × 9 in。header/footer 距边均为 720 twip = 0.5 in。未定义 columns，按单栏；未定义 gutter、titlePg 或 evenAndOddHeaders；不区分首页和奇偶页。

| Section | 稳定位置 | 起始与页码 | Header/footer |
|---|---|---|---|
| 1 封面 | `word/document.xml`，paraId `00000008` 的 `w:pPr/w:sectPr` | type 省略，Word 默认 nextPage；页码 start=1 | 没有 header 引用；default footer `rId8` → `footer2.xml`（空） |
| 2 目录与正文 | `word/document.xml`，`/w:document/w:body/w:sectPr` | explicit nextPage；页码重新 start=1 | default header `rId9` → `header1.xml`；default footer `rId10` → `footer1.xml` |

主体四个一级标题在 paraId `00000017`、`00000021`、`00000038`、`00000040`，都有显式 `pageBreakBefore=1`。不含 `w:br type=page`；不要用手工分页符替代这些段落属性，也不要删除封面结束段 `00000008`。

## 字体与段落度量

所有单位以 OOXML 为准：字号 `w:sz` 为 half-point；spacing/indent 为 twip；lineRule=auto 的 `line` 以 240 为单倍行距。Normal 没有自己的格式，继承 docDefaults：Helvetica Neue，11 pt；after=120（6 pt），line=276（1.15 倍）；默认语言 en。没有默认对齐声明，按 Word 左对齐。正文默认颜色没有显式定义；标题与许多直接格式明确为 #000000。

| 角色或样式 | 字号与字重 | 间距、行距、保持 |
|---|---|---|
| Normal 正文 | Helvetica Neue 11 pt regular | 段后 6 pt；1.15 倍；未定义正文首行缩进 |
| Title | 40 pt bold；继承 Helvetica Neue | 段后 5 pt；line 278 = 1.158333 倍；标题实例 keepNext=1；无边框 |
| Heading1 | 24 pt regular，#000000 | 段前 18 pt、段后 10 pt；行距继承 1.15；keepNext=1、keepLines=1 |
| Heading2 | 15 pt regular，#000000 | 段前 14 pt、段后 6 pt；行距继承 1.15；keepNext=1、keepLines=1 |
| Heading3 未使用 | 12 pt bold，#000000 | 段前 10 pt、段后 4 pt；keepNext/keepLines=1 |
| Heading4 未使用 | 继承 11 pt，italic，#0F4761 | 段前 4 pt、段后 2 pt；keepNext/keepLines=1 |
| Heading5 未使用 | 继承 11 pt，#0F4761 | 段前 4 pt、段后 2 pt；keepNext/keepLines=1 |
| Heading6 未使用 | 继承 11 pt，italic，#595959 | 段前 2 pt、段后 0；keepNext/keepLines=1 |
| Subtitle 未使用 | 14 pt，#595959 | 不要把封面副标题改套此样式；封面实际是 Normal + 直接格式 |
| 封面 metadata | 11 pt，#666666 | 段后 0，单倍行距；表格内 |
| Contents 标题 | 24 pt regular，#000000，直接格式而非 Heading1 | 段前/后均 18 pt；1.158333 倍；keepNext=1，keepLines=0 |
| TOC 12 条 | 11 pt regular，#000000，无下划线 | 段前 3 pt、段后 0；单倍；二级条目左缩进 18 pt；右对齐点状 tab stop 12000 twip |
| 无序列表 | 11 pt regular，#000000 | 左缩进 27 pt、悬挂 13.5 pt；1.15 倍；段后 5 pt；keepLines=1，keepNext=0，widowControl=1 |
| 建议编号列表 | 11 pt；每项第 1 个文字 run bold、后续 regular | 同上；段后 9 pt；保留粗体引导语与正文两个 run 角色 |
| 表头 | 9 pt bold，#000000 | 段前/后 0；line=259 = 1.079167 倍；左对齐 |
| 表正文 | 9 pt regular，#000000 | 同表头；不要误用 11 pt Normal 取代其直接格式 |
| 关键结论和附录提示 | 11 pt；短引导语 bold，后段 regular | #F2F2F2 段底纹；左边框 #595959、2 pt、距文 8 pt；左右缩进 12.95 pt；段前 8 pt、段后 10 pt；line=269 = 1.120833 倍；keepLines=1 |
| 页眉报告名 | 8.5 pt，#7A7A7A | 左对齐；段后 4 pt；1.158333 倍 |
| 页眉日期 | 8.5 pt，#7A7A7A | 右对齐；段前/后 0；单倍 |
| 页脚 PAGE | 9 pt，#7A7A7A | 右对齐；段前/后 0；1.158333 倍；不可用静态文字取代 |

直接格式很多（官方 style lint 记录 33 个直接 run 格式与 37 个直接段落格式）。只修改 named styles 并不能控制目录、表格、列表、提示块的字体与密度。参考中的提示块与页眉细线是模板设计，不能套用通用新文档“去除 callout/header”规则把它们移除。

## 表格与列表

| 组件 | 宽度与列网格 | 单元格、行与边框 |
|---|---|---|
| 封面 metadata 表，body/tbl[1]，Table1 | 固定总宽 9360 twip = 6.5 in；列 4305 / 901.6666666666654 / 4153.333333333335 twip（2.989583 / 0.626157 / 2.884259 in）；左对齐 | 1 行 3 列；中列为空白间隔；四边 padding=0；cantSplit=1；不是重复表头；无可见边框 |
| 比较表，body/tbl[2]，Table2 | 固定总宽 9120 twip = 6.333333 in；左缩进 120 twip = 0.083333 in；列 1800 / 3300 / 4020 twip（1.25 / 2.291667 / 2.791667 in） | 4 行 3 列；首行为 repeated header；每行 cantSplit=0；无固定行高；上下 padding 110 twip =5.5 pt；左右从 Table2 继承 115 twip =5.75 pt；垂直居中；表头底色 #F2F2F2，其余 #FFFFFF；所有外与内边框 #D9D9D9、0.5 pt |
| 页眉表，header1/sdt/table，Table3 | 固定 9360 twip，2 列各 4680 twip =3.25 in | 1 行；atLeast 325.74149576822384 twip =16.287075 pt；cantSplit=1；padding 全 0；垂直 top；左单元格包含标题与空段，右列日期右对齐 |

封面与页眉表的网格各含 `w:tblGridChange w:id=0` 的原始快照；这不是普通正文，不要在内容替换时自动接受/清除。TableNormal 的默认 cell margin 为四边 100 twip（5 pt），上述直接 cell margin 和 Table2 覆盖它。

`word/numbering.xml` 包含 2 套列表：numId=1 → abstractNumId=1（0 级 bullet `•`）；numId=2 → abstractNumId=2（0 级 decimal `%1.`，从 1 开始）。两者第 0 级左缩进 540 twip、悬挂 270 twip，marker 使用 Helvetica Neue。1–8 级只有空 bullet 模板，正文未使用；不要把中文层级强行套入这些空级别。保留 numbering.xml 原样，段落内保留 numPr。

## 图片与 recurring 元素

- `word/media/image1.png`：1254 ×1254 像素、RGB；正文 `00000001` 中唯一 drawing，通过 `rId7` 引用。使用 inline（不是 floating/anchor），四向 dist 均 0；extent 为 6038850 ×5824008 EMU = 6.604167 ×6.369213 in。图略宽于 6.5 in 文本区域，先保留源值，不擅自收窄。
- picture crop：left/right=0，top/bottom=1779（各 1.779%）；图形 rect。`wp:docPr id=1 name=image1.png descr=OpenAI_Photography_2026_04`，`pic:cNvPr id=0`。固定 frame、inline 位置和居中模式是保留设计。按主代理的本次内容计划，图片内容明确变为可编辑槽：可换成真实首页截图，等比 contain 并留白，不拉伸。原图 crop 上下各 1.779% 需在 letterbox 画布中预留安全边；也可为截图显式去 crop，但这项变化必须记录并渲染比较。原参考文件仍不得改动。
- 页眉 `0000004B` 是空段，但带 #D9D9D9、0.5 pt 下边框，space=5 pt；段后 4 pt。它是设计线，不能按“空段”清理。
- 页眉内容在 tag=`goog_rdk_0`、id=`2109222018` 的 SDT 内，`lock=contentLocked`。按 OOXML 定点替换两个文本槽即可；保留 SDT 容器、锁、tag 和页眉表。该 lock 不代表禁止生成新的副本。
- 封面 footer2 为空；正文 footer1 只有 PAGE 复合域，域缓存没有可见文字。不得由文本提取结果“空白”误删。

## 目录与定位风险

目录位于 body/sdt，SDT id=`-2107746825`，无 tag/alias，gallery=`Table of Contents`、unique=1。复合域指令为 `TOC \\h \\u \\z \\t "Heading 1,1,Heading 2,2,Heading 3,3,Heading 4,4,Heading 5,5,Heading 6,6,"`；begin/instruction/separate 在 `0000000B`，end 在 `00000016`。保持其 field 与 SDT 结构。

原文件已存在两个需根据信息与渲染处理的问题：

1. 12 个目录 hyperlink 的 `w:anchor` 全部是 `_heading=`，而 11 个源 bookmark 中没有这个名字。不能把原链接视为有效。可在新副本中为 12 个目标标题新增有效、唯一的 bookmark，再把各 TOC anchor 指过去；这仅修改 document.xml，保持其余包关系。必须保持旧 bookmark，除非能证明没有引用。另需更新实际目录标题文字和页码缓存。
2. 每个 TOC 段右对齐 dot-leader tab stop=12000 twip（8.333333 in），超过正文宽 9360 twip。**主代理已在 LibreOffice 参考渲染直接确认 leader tabs 超出页面。** 成品应将 12 个 tab stop 定点改为 9360 twip（6.5 in 文本右边界），保留 right、dot、11 pt、单倍行距、3 pt 段前和二级 360 twip 左缩进。此修复不替换整个 TOC 样式系统；在 artifact.md 记录源缺陷、修复数值，并重新渲染确认点线和页码均在右边界内。

`Document.paragraphs` 仅暴露 46 个 body 直接段，不涵盖 12 个目录段、16 个正文表格段和页眉 SDT 中的槽。必须按包部件 + paraId 定位，或使用下表和 JSON 中的完整 XPath。不能用全局字符串替换“Report title”，也不能把整个 paragraph.text 设值以免破坏粗体 run、tab、field 或 drawing。

## 中文内容替换策略

建议复制参考 ZIP 后只对受控部件进行 lxml 定点修改：在每个槽既有 `w:t` 中填入中文，保留 `w:pPr`、`w:rPr`、列表、表格、section、字段、绘图和段落顺序。普通一段只有一个文字 run 的槽可以替换该 `w:t`；有粗体引导语的 `00000028`、`0000003A–3C`、`0000004A` 分别替换粗体和常规 run，不把它们合并。目录的首个 `w:t` 是标题、第二个是缓存页码，中间的 `w:tab` 必须保留。

**中文字体适配是必要技术问题。** 四个嵌入 HelveticaNeue TTF 均经直接 sfnt/cmap 检查：ASCII `TradeReview` 字母有字形，但中文“首页设计报告复盘交易”均无字形。不要因嵌入字体存在就认定中文可显示。优先保留 ascii/hAnsi=Helvetica Neue、字号、粗细、间距，只为实际中文 run（含直接格式、表格与 TOC）设置已验证可用的 `eastAsia` 字体；相应 lang=eastAsia 可设 zh-CN。选择字体后必须以 bundled renderer 确认中文字形及换行。若改 styles.xml 的 eastAsia 默认，要同步处理 document/header 内直接 rFonts，否则继承会被覆盖。将这一语言适配列为有意偏离，不去改图片或原嵌入英文字体文件。

容量是近似宽度预算，不是排版验收：11 pt 全角正文在 6.5 in 内理论约 42 字/行；40 pt 主标题约 11 字/行；24 pt H1 约 19 字/行；15 pt H2 约 31 字/行。表格 9 pt 三列扣除左右 padding 后理论约 8 /17 /21 字每行。实际中文字体、标点禁则和中西文混排会改变换行，最终以渲染为准。优先用紧凑准确的中文填充原段落数量与语义角色，避免通过缩小字号挤入长文。参考来源应真实且可核验，不足四项可删除未用项目而不能编造。

## 完整槽位表

下表覆盖每个段落，含空白、字段和图片。ID 是该部件内的 `w14:paraId`；完整 XPath、原字数与精确 properties 见 JSON。`rewrite` 表示仅文字；`preserve` 表示不可误当无内容清理；特殊 disposition 已单独说明。

| 部件 | paraId | 角色 | 原样式 / 原字符数 | 处理 | 内容与容量 |
|---|---|---|---|---|---|
| `document.xml` | `00000001` | 封面截图 figure | Normal / 0 | replace-asset-preserve-frame | 按主代理报告计划换入真实首页截图；保留 inline frame 与居中，等比 contain/留白，记录 crop 处理；固定 6.6042 × 6.3692 in |
| `document.xml` | `00000002` | 封面留白 | Normal / 0 | preserve | 保留空段；固定段落 |
| `document.xml` | `00000003` | 报告主标题 | Title / 12 | rewrite | 简短中文主题标题；品牌或报告范围可放副标题；一行优先；理论约 11 个全角字 |
| `document.xml` | `00000004` | 封面副标题 | Normal / 60 | rewrite | 描述对象、范围及目的；原要求最多两行；每行理论约 19 个全角字 |
| `document.xml` | `00000005` | 封面元数据中间空列 | Normal / 0 | preserve | 保持空白；固定空列 |
| `document.xml` | `00000006` | 署名 | Normal / 20 | rewrite | 真实作者或编制主体；未知时用真实可证的中性主体，不编造人名；一行优先；理论约 18 个全角字 |
| `document.xml` | `00000007` | 报告日期 | Normal / 12 | rewrite | 真实报告年月；一行 |
| `document.xml` | `00000008` | 封面结束与 section break | Normal / 0 | preserve | 保留空段及其 sectPr；不可删除 |
| `document.xml` | `00000009` | 目录标题 | Normal / 8 | rewrite | 目录；一行 |
| `document.xml` | `0000000A` | 目录上方留白 | Normal / 0 | preserve | 保留空段与度量；固定段落 |
| `document.xml` | `0000000B` | 目录条目 执行摘要 | Normal / 18 | rewrite-derived | 同步 00000017 的实际标题、最终页码与有效 bookmark；保留 tab 和 TOC 字段边界；一行；不得从原缓存猜最终页码 |
| `document.xml` | `0000000C` | 目录条目 要点 | Normal / 12 | rewrite-derived | 同步 0000001A 的实际标题、最终页码与有效 bookmark；保留 tab 和 TOC 字段边界；一行；不得从原缓存猜最终页码 |
| `document.xml` | `0000000D` | 目录条目 导言 | Normal / 13 | rewrite-derived | 同步 0000001E 的实际标题、最终页码与有效 bookmark；保留 tab 和 TOC 字段边界；一行；不得从原缓存猜最终页码 |
| `document.xml` | `0000000E` | 目录条目 主要发现 | Normal / 13 | rewrite-derived | 同步 00000021 的实际标题、最终页码与有效 bookmark；保留 tab 和 TOC 字段边界；一行；不得从原缓存猜最终页码 |
| `document.xml` | `0000000F` | 目录条目 条件与背景 | Normal / 23 | rewrite-derived | 同步 00000023 的实际标题、最终页码与有效 bookmark；保留 tab 和 TOC 字段边界；一行；不得从原缓存猜最终页码 |
| `document.xml` | `00000010` | 目录条目 证据模式 | Normal / 25 | rewrite-derived | 同步 00000025 的实际标题、最终页码与有效 bookmark；保留 tab 和 TOC 字段边界；一行；不得从原缓存猜最终页码 |
| `document.xml` | `00000011` | 目录条目 影响 | Normal / 13 | rewrite-derived | 同步 0000002A 的实际标题、最终页码与有效 bookmark；保留 tab 和 TOC 字段边界；一行；不得从原缓存猜最终页码 |
| `document.xml` | `00000012` | 目录条目 建议 | Normal / 16 | rewrite-derived | 同步 00000038 的实际标题、最终页码与有效 bookmark；保留 tab 和 TOC 字段边界；一行；不得从原缓存猜最终页码 |
| `document.xml` | `00000013` | 目录条目 结论 | Normal / 11 | rewrite-derived | 同步 0000003D 的实际标题、最终页码与有效 bookmark；保留 tab 和 TOC 字段边界；一行；不得从原缓存猜最终页码 |
| `document.xml` | `00000014` | 目录条目 附录 | Normal / 9 | rewrite-derived | 同步 00000040 的实际标题、最终页码与有效 bookmark；保留 tab 和 TOC 字段边界；一行；不得从原缓存猜最终页码 |
| `document.xml` | `00000015` | 目录条目 附录说明 | Normal / 6 | rewrite-derived | 同步 00000041 的实际标题、最终页码与有效 bookmark；保留 tab 和 TOC 字段边界；一行；不得从原缓存猜最终页码 |
| `document.xml` | `00000016` | 目录条目 来源 | Normal / 20 | rewrite-derived | 同步 00000044 的实际标题、最终页码与有效 bookmark；保留 tab 和 TOC 字段边界；一行；不得从原缓存猜最终页码 |
| `document.xml` | `00000017` | 执行摘要一级标题 | Heading1 / 17 | rewrite | 中文摘要标题；保持 Heading1 和强制另页；一行 |
| `document.xml` | `00000018` | 执行摘要首段 | Normal / 231 | rewrite | 报告主结论、设计目的、读者应理解或采取的方向；正文；按最终渲染控制密度 |
| `document.xml` | `00000019` | 执行摘要第二段 | Normal / 213 | rewrite | 支撑结论的主要关系、取舍与范围；正文；按最终渲染控制密度 |
| `document.xml` | `0000001A` | 要点小标题 | Heading2 / 11 | rewrite | 摘要中的速览小标题；一行 |
| `document.xml` | `0000001B` | 要点 1 | Normal / 90 | rewrite | 第一个主要事实或设计决定；项目符号，宜 1–2 行 |
| `document.xml` | `0000001C` | 要点 2 | Normal / 107 | rewrite | 第二个主要事实或设计决定；项目符号，宜 1–2 行 |
| `document.xml` | `0000001D` | 要点 3 | Normal / 102 | rewrite | 第三个主要事实或设计决定；项目符号，宜 1–2 行 |
| `document.xml` | `0000001E` | 背景导言小标题 | Heading2 / 12 | rewrite | 背景或目标；一行 |
| `document.xml` | `0000001F` | 导言首段 | Normal / 215 | rewrite | 项目情境和当前问题；正文 |
| `document.xml` | `00000020` | 导言第二段 | Normal / 154 | rewrite | 报告边界、用户或任务范围；正文 |
| `document.xml` | `00000021` | 主要发现一级标题 | Heading1 / 12 | rewrite | 主要发现或设计结构；保持另页；一行 |
| `document.xml` | `00000022` | 主要发现导语 | Normal / 196 | rewrite | 本章总观点；正文 |
| `document.xml` | `00000023` | 条件与背景小标题 | Heading2 / 22 | rewrite | 当前界面或设计条件；一行 |
| `document.xml` | `00000024` | 条件与背景正文 | Normal / 132 | rewrite | 有来源支持的约束或现状；正文 |
| `document.xml` | `00000025` | 证据模式小标题 | Heading2 / 24 | rewrite | 设计规律或信息结构；一行 |
| `document.xml` | `00000026` | 证据模式正文 | Normal / 136 | rewrite | 体现该规律的证据及解释；正文 |
| `document.xml` | `00000027` | 发现页留白 | Normal / 0 | preserve | 保留空段；固定段落 |
| `document.xml` | `00000028` | 关键结论提示 | Normal / 135 | rewrite | 粗体短引导语 + 常规体结论；保留两种 run 角色；宜 1–3 行 |
| `document.xml` | `00000029` | 发现页空 Heading2 留白 | Heading2 / 0 | preserve | 原模板空标题段；先保留，任何删除需记录有依据的版式偏离；固定段落；不新增目录文本 |
| `document.xml` | `0000002A` | 影响小标题 | Heading2 / 12 | rewrite | 设计影响、交互说明或约束结果；一行 |
| `document.xml` | `0000002B` | 影响导语 | Normal / 135 | rewrite | 说明下表比较维度与结论；正文 |
| `document.xml` | `0000002C` | 表头 第一列 | Normal / 5 | rewrite | 主题 / 模块等短字段；约 8 个全角字一行 |
| `document.xml` | `0000002D` | 表头 第二列 | Normal / 11 | rewrite | 观察 / 设计等字段；约 17 个全角字一行 |
| `document.xml` | `0000002E` | 表头 第三列 | Normal / 11 | rewrite | 影响 / 行为等字段；约 21 个全角字一行 |
| `document.xml` | `0000002F` | 比较表 第 1 行主题 | Normal / 5 | rewrite | 短主题名称；宜 1 行 |
| `document.xml` | `00000030` | 比较表 第 1 行观察 | Normal / 14 | rewrite | 同一主题的简洁描述；宜 1–2 行 |
| `document.xml` | `00000031` | 比较表 第 1 行影响 | Normal / 22 | rewrite | 同一主题对应影响；宜 1–2 行 |
| `document.xml` | `00000032` | 比较表 第 2 行主题 | Normal / 5 | rewrite | 短主题名称；宜 1 行 |
| `document.xml` | `00000033` | 比较表 第 2 行观察 | Normal / 14 | rewrite | 同一主题的简洁描述；宜 1–2 行 |
| `document.xml` | `00000034` | 比较表 第 2 行影响 | Normal / 17 | rewrite | 同一主题对应影响；宜 1–2 行 |
| `document.xml` | `00000035` | 比较表 第 3 行主题 | Normal / 5 | rewrite | 短主题名称；宜 1 行 |
| `document.xml` | `00000036` | 比较表 第 3 行观察 | Normal / 19 | rewrite | 同一主题的简洁描述；宜 1–2 行 |
| `document.xml` | `00000037` | 比较表 第 3 行影响 | Normal / 12 | rewrite | 同一主题对应影响；宜 1–2 行 |
| `document.xml` | `00000038` | 建议一级标题 | Heading1 / 15 | rewrite | 建议或落地路径；保持另页；一行 |
| `document.xml` | `00000039` | 建议导语 | Normal / 152 | rewrite | 建议适用范围和决策依据；正文 |
| `document.xml` | `0000003A` | 建议步骤 1 | Normal / 146 | rewrite | 粗体动作标题 + 常规说明；保留 numId 2；编号项，宜 2–3 行 |
| `document.xml` | `0000003B` | 建议步骤 2 | Normal / 126 | rewrite | 粗体动作标题 + 常规说明；保留 numId 2；编号项，宜 2–3 行 |
| `document.xml` | `0000003C` | 建议步骤 3 | Normal / 122 | rewrite | 粗体动作标题 + 常规说明；保留 numId 2；编号项，宜 2–3 行 |
| `document.xml` | `0000003D` | 结论小标题 | Heading2 / 10 | rewrite | 结论；一行 |
| `document.xml` | `0000003E` | 结论首段 | Normal / 155 | rewrite | 总结设计取舍或所需决定；正文 |
| `document.xml` | `0000003F` | 结论第二段 | Normal / 110 | rewrite | 后续动作或验收方向，不虚构承诺；正文 |
| `document.xml` | `00000040` | 附录一级标题 | Heading1 / 8 | rewrite | 附录；保持另页；一行 |
| `document.xml` | `00000041` | 附录说明小标题 | Heading2 / 5 | rewrite | 说明 / 边界等；一行 |
| `document.xml` | `00000042` | 附录说明首段 | Normal / 121 | rewrite | 范围、术语或必要补充；正文 |
| `document.xml` | `00000043` | 附录说明第二段 | Normal / 113 | rewrite | 必要补充或依据限定；正文 |
| `document.xml` | `00000044` | 来源小标题 | Heading2 / 19 | rewrite | 参考资料 / 设计依据等真实标签；一行 |
| `document.xml` | `00000045` | 来源条目 1 | Normal / 62 | rewrite-or-remove-if-unused | 真实已使用文档或设计来源；不能留下方括号占位符；项目符号，宜 1–2 行 |
| `document.xml` | `00000046` | 来源条目 2 | Normal / 66 | rewrite-or-remove-if-unused | 真实已使用文档或设计来源；项目符号，宜 1–2 行 |
| `document.xml` | `00000047` | 来源条目 3 | Normal / 67 | rewrite-or-remove-if-unused | 真实已使用文档或设计来源；项目符号，宜 1–2 行 |
| `document.xml` | `00000048` | 来源条目 4 | Normal / 61 | rewrite-or-remove-if-unused | 真实已使用文档或设计来源；项目符号，宜 1–2 行 |
| `document.xml` | `00000049` | 附录提示前留白 | Normal / 0 | preserve | 保留空段；固定段落 |
| `document.xml` | `0000004A` | 模板操作提示 | Normal / 123 | replace-with-true-report-note-or-remove | 原文为模板编辑操作，不应交付；若有真实必要说明则保留 callout 样式并替换，否则有记录地删除；宜 1–3 行 |
| `header1.xml` | `0000004B` | 页眉顶部横线段 | Normal / 0 | preserve | 保留空段和 0.5 pt 灰色下边框；固定段落 |
| `header1.xml` | `0000004C` | 页眉短报告名 | Normal / 12 | rewrite | 与主标题一致的短标题；单行；理论约 27 个全角字 |
| `header1.xml` | `0000004D` | 页眉左单元格留白 | Normal / 0 | preserve | 保留空段；固定段落 |
| `header1.xml` | `0000004E` | 页眉日期 | Normal / 4 | rewrite | 报告日期，右对齐；单行 |
| `header1.xml` | `0000004F` | 页眉结尾空段 | Normal / 0 | preserve | 保留；固定段落 |
| `footer1.xml` | `00000050` | 正文页码 | Normal / 0 | preserve-field | 保留 PAGE field 的 begin/instruction/separate/end 序列；右对齐动态页码 |
| `footer2.xml` | `00000051` | 封面空页脚 | Normal / 0 | preserve | 保留空页脚结构；固定段落 |

## Package 保留分类

推荐成品变更边界：`word/document.xml`（内容、目录修复、必要中文 run 字体、克隆追加证据页）、`word/header1.xml`（两个文字槽、必要中文 run 字体）、`word/media/image1.png`（按计划用首页截图替换封面媒体，保留固定 frame）；如需全局中文默认字体适配，`word/styles.xml` 可作有限例外。追加证据图片时，`word/_rels/document.xml.rels` 允许只增加新关系，原有关系完整不变。所有其余原 ZIP part 应以原始 bytes 复制，且对每个保留 part 比较 SHA-256。保留相同 part 名和原 relationship Id，不能用全新 Document() 重建来近似。

必须保持原样的 parts：`word/footer1.xml`、`word/footer2.xml`、`word/numbering.xml`、`word/settings.xml`、`word/fontTable.xml`、`word/_rels/fontTable.xml.rels`、`_rels/.rels`、4 个 `word/fonts/*.ttf`、`word/theme/theme1.xml`、`[Content_Types].xml`（新增 PNG 仍使用已有默认项）。`word/styles.xml` 除明确记录的 eastAsia/language 必要适配外保持所有度量、样式与继承。

内部关系共 14 条（root 1、document 9、fontTable 4）；全部为包内关系，无 External target。document 的 rId1 theme、rId2 settings、rId3 fontTable、rId4 numbering、rId5 styles、rId7 图片、rId8 空封面 footer、rId9 header、rId10 正文 footer 必须保留。没有 rId6 并非错误，不要重排 ID。4 个字体嵌入关系的 fontKey 是全零 GUID，subsetted=0；保持原样。原 ZIP 没有 docProps，不能据此编造作者等元数据。

## 根代理需补齐的验收与未解决项

- **本代理未独立视觉验收**：主代理确认已渲染查看全部 6 页，且目录 tab 确实溢出。主代理承担 reference/preview 比对、真实页内空白比例和成品逐页视觉验收。
- **NOT VERIFIED 成品**：中文字体落地与无缺字，所有页渲染，长中文换行、表格行高、封面标题占用与页眉/页码位置；需要实际成品。
- **已发现原问题**：TOC 12 个 anchor 无目标；应在新副本中修复有效导航，最终目录页码必须对照成品。
- **必须确认**：最终文档所有 placeholder、Lorem/拉丁样文、模板操作提醒均已替换或移除；没有通过写入整个 paragraph 清除字段、图像、run 分层或 section。
- **结构比对**：保持 2 section、原有四个 Heading1 强制另页、封面固定 frame、3 张表的布局度量、页眉 SDT 与 2 个 footer parts；封面换截图和新增证据页按下面的克隆规则显式记录。crop 如变化需记录原因并检查截图未被切边。
- **包比对**：对照 inventory 验证所有 preserve-only part 的原始 SHA-256，原始参考文件最终 hash 仍匹配；本代理未触碰参考。
- **供 artifact.md 采用**：本文件和 JSON 是技术输入，不是最终执行合同。主代理需要合并其亲自看的 reference render/preview、最终内容计划及允许偏离，再开始作者操作。


## 主代理内容计划的允许适配与证据页复用

主代理已明确本次计划：用真实首页截图替换封面椅子摄影，并追加截图证据页。以下为保留设计系统的可执行规则，不能理解为无边界扩展版式。

1. **封面 figure 槽**：优先仍使用 rId7 → media/image1.png，并替换该媒体的 bytes；drawing 固定 frame 为 6038850 ×5824008 EMU，居中 inline，不改变封面页面系统。截图按 frame 比例等比 contain，周围留白，保持完整画面。若保持源方形媒体和上下 1.779% crop，内容需放在中间可见带内（约 1254 ×1209 像素）；不要让 crop 切掉浏览器 UI 或页面边缘。不要把截图强拉伸成接近正方形。主代理应决定并记录是否保留 crop，最终以截图细节可读和封面版式相符为准。
2. **追加页结构**：在最后 `body/sectPr` 前插入克隆页面组件，继续属于第 2 section，继承相同 header/footer 和连续 PAGE；不要克隆 `00000008` 的 section break，也不要复制最终 sectPr 成新节。用现有 Heading1（24 pt、段前 18/段后 10 pt、keepNext/keepLines=1）作为证据页标题，并设置 pageBreakBefore=1；说明用原 Normal，必要的小标题用原 Heading2。
3. **追加 figure**：复用现有 inline drawing/picture 结构和居中段落模式，按可用 6.5 ×9 in 页面区域及标题/正文占用确定比例一致的 frame。若直接保留封面 frame，应确认加上标题和说明后仍在一页；不可把封面段前后空白机械复制成大间隙。只使用真实截图和简短真实说明。图名、descr 应写为具体页面或状态，避免沿用摄影描述。
4. **唯一标识与关系**：给新增段落新的唯一 w14:paraId；所有新增 `wp:docPr/@id`（以及 picture nonvisual id 若使用）应唯一；新增图片使用新 media 路径和未占用 relationship ID。原关系 ID/target 不改变。PNG 的 Content_Types 默认项原已存在，所以新增 PNG 通常无需修改 `[Content_Types].xml`；仅确需新格式时增加必要项，绝不重建整张列表。
5. **导航**：如果证据页作为 Heading1 出现在目录，新增对应目录行须克隆原 TOC 一级项的外观，配真实标题、有效 bookmark、最终页码，保留总体 TOC SDT/field 结构。若仅作为附录内证据页，则在 artifact.md 明确其导航层级，不能让新增内容和目录不一致。
6. **包验收**：允许新增 media parts 和关系；image1.png、document.xml、header1.xml、有限 styles.xml/关系增量属于预期变化。其余 preserve-only part 的 SHA 必须与原 inventory 匹配。额外记录成品 parts 清单，以区分新增证据媒体与意外丢失的原 parts。

## 本次最终作者契约（2026-10-06）

- Reference render: `reference-render/page-1.png` 至 `page-6.png`，主代理逐页直接查看。
- 输出为 `TradeReview-首页交互视觉评审.docx`；保持两个 section、Letter 纸型、四边 1in、页眉/页脚引用、原列表/表格样式、嵌入字体、主题和所有原关系。
- 章节槽：摘要=总判断与已做好的部分；发现=三项高优先问题与影响表；建议=三阶段次序和验收；附录=走查条件/验证边界/真实来源。添加两个“问题详解”页和两页“视觉证据”，使用 source Heading1/Heading2/Normal/inline drawing 克隆模式，不新增 section。
- 附加段落允许克隆现有类型，分配唯一 paraId/bookmark/drawing id；新图片可增加关系和 content type，不替换原表格或编号系统。
- 封面图槽替换为真实桌面首屏截图；使用 DrawingML fillRect 等比 contain，固定 frame 保留，上下留白，不做像素修饰。证据页插入原截图原字节，保持比例。删除 cover 原图 crop，记录为可替换 figure 槽适配。
- 内容中文化：保留 Helvetica Neue 的 ascii/hAnsi，东亚字体设 Heiti SC（系统 STHeiti Light.ttc 可用，以最终渲染验证中文）；不缩字号。
- 目录原缺陷修复：right tab=9360twip，保留 SDT/field/run、补唯一 bookmark 和 anchor；新增标题按既有目录段落克隆；更新缓存页码。Word 未用于更新，settings 定点设置 updateFields=true（允许变更原 preserve settings 分类，仅此项），最终渲染页码核对。
- 仅 document.xml、header1.xml、styles.xml（eastAsia）、settings.xml（updateFields）、image1.png（封面截图）、document relationships（新增图片）、Content_Types（必要时新图格式）为编辑/增量白名单；其他已有 ZIP parts byte-for-byte 保留。
- 原空 Heading2/留白是原设计，保留；正文事实缺口不使用虚构内容补足。
- 报告的检查边界与证据时间是审计方法本身，必须列明；没有用户研究、不估算效率收益，不把 CUA 超时当成应用失败。

### 作者契约补充（首次生成前）
- 视觉证据扩展为三页：用户图 1、桌面复盘区、并排窄屏。预计成品 11 页（含封面），以渲染为准；不改变模板的页面系统。
- 封面 JPEG 仅无损转换为 PNG 容器以复用原 PNG part；不改变截图像素内容。其余证据图片直接保存原字节。
- 页内插图按比例缩放，窄屏两图各 2.75in 宽，以避免正文越界；原图可在 Word 中放大检查。

## 最终渲染与验收记录（2026-10-06）

- 成品：`artifacts/design-report/TradeReview-首页交互视觉评审.docx`，11 页。正文为 3 项 P1、5 项 P2，含优先级、建议、验收条件、验证边界及原图/现场截图证据。
- 封面 contain 实现修正：v1 的 `fillRect` 在本地渲染器中未保持截图比例；v2 改为 DrawingML `srcRect` 上下负值 -19438，保持原 frame，等比显示截图并留白。封面 JPEG→PNG 后 RGB 像素一致。此项取代前述 fillRect 实现，不改变版式契约。
- 中文渲染修正：显式设置 bundled LibreOffice 的 `FONTCONFIG_FILE` 与 `FONTCONFIG_PATH`，使用已有 Heiti SC；未安装字体或修改运行时。v1 中文缺失已在 v2/v3 消除，旧失败证据保留。
- 目录：新增 8 个 Heading 2 缓存条目后共 25 项，均连接有效书签。v3 仍为 11 页，页脚从目录 1 至证据末页 10；目录页码与渲染对应。未声称 Microsoft Word 引擎已更新字段。
- 主代理逐页检查：v2 页 1、3–9，v3 页 2、10、11。v2/v3 的其余 10 页 PNG SHA256 完全一致，因此覆盖最终全部 11 页；无缺字、裁切、表格越界、图片变形或意外空白页。独立模板审阅者另直接查看 v2 全部 11 页。
- 内容独立复核通过：已修正金额范围跨卡混用、通知与待复盘计数混用的风险，并明确周/月不对市值求和、分布图负值/零分母/方向未知的条件。没有必须修改的内容问题。
- 包保留检查：原参考 SHA256 未改变；18 个原 parts 保留，7 个白名单 parts 修改，其余 11 个 byte-for-byte 相同；2 个 section、原表格尺寸、页眉页脚和原关系保留。详见 `package-verification.json`。
- 报告边界仍保留 NOT VERIFIED：历史日期选择、键盘 End、物理触摸、屏幕阅读器、缩放/动态效果偏好、实际颜色对比度、手工行情更新和写入持久化。它们不是本次报告交付的已通过产品验收项。
- 本次仅交付 DOCX；渲染中间件、QA 图片、脚本和差异记录均留在 scratch，不作为交付物。
- 最终独立模板复核（v3）：25 项目录覆盖所有有文本的 H1/H2，25 个锚点唯一、有效且目标文字匹配，页码与渲染一致；原漏 8 个 H2 的必须修正项已关闭。ZIP 完整性通过，无新增必须修正项。
