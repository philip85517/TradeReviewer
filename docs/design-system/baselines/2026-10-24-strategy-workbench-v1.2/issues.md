# 策略台 V1.2 问题总表

2026-10-24，由公共规范、组合组件、独立视觉三个审查任务分别检查。原始发现保留；同一缺陷从样式和业务操作两个角度出现时交叉关联，不把重复发现当作更多独立缺陷。

初审对象是完整设计文档与原21张静态画板；最终补齐独立预览步骤，共22张画板与8张公共样例。表中状态记录设计修复，不表示正式业务已实现。产品交互、真实回放和数据库持久化不属于本轮验收。最终视觉结论需要绑定修复后截图和文件指纹。

## 公共样式与组合组件

| ID | 级别 | 原始问题 | 影响 | 修复负责人 | 状态 |
| --- | --- | --- | --- | --- | --- |
| SH-01 | P1 | `build-artboards.py:84–96 chrome`与`build-time-results.py:88–97 opening`仅绘54px空轨+TR，没有首页/交易库/分析/数据/策略图标、当前策略态和折叠入口。参考截图与真实组件都有导航。 | 所有使用chrome/opening的整页（见清单）；局部裁片无须假加导航 | shared_controls / library_forms / time_responsive | 已关闭；见最终复核对应图 |
| SH-02 | P2 | NAV01明确200展开/54折叠及跨页面状态；当前21图只见折叠空轨，没有展开200的渲染证据，也没有真实折叠图标。 | 整页和11-responsive/compact | shared_controls / library_forms / time_responsive | 已关闭；见最终复核对应图 |
| SH-03 | P1 | `base:51–56 pill`与`time:66–69 chip`统一24px/12px，却用于正文569行明确的SegmentedTabs（库/实验、图模式、检查区）。透明36命中不等于36px分段视觉；time chip甚至没有命中描述。 | 01、03、06、06-detail、08、09、11各版，向导状态按专属角色另判 | shared_controls / library_forms / time_responsive | 已关闭；见最终复核对应图 |
| SH-04 | P2 | base `field:66–71`及time `field:79–85`56px带框内嵌label，library `input36:32–39`和12组件稿却明确36px外label。 | 06观察/局部、08、09、11compact/narrow、时间字段局部 | shared_controls / library_forms / time_responsive | 已关闭；见最终复核对应图 |
| SH-05 | P2 | library `input36:38`、base `field:70`使用字体⌕/⌄；library:62/195/264将select当居中button，箭头附文字而非独立槽；base:180更多组合同类；库表:79用•••文字动作。V2.5:107,536以及手册108要求输入左齐独立箭头，日期日历SVG。 | 01、03、04b、06/detail、08、09、11compact/narrow；04日期缺日历 | shared_controls / library_forms / time_responsive | 已关闭；见最终复核对应图 |
| SH-06 | P2 | `build-library-forms.py:398–404` hover #34445A、pressed #1C2B3D、disabled WEAK；base button:61与time button:74也用#71829B禁用字。预期#1C2B42/#243B5C/#53647B。12截图中hover明显亮灰。 | 12-components；所有disabled按钮，06底部与08/09、11回放尤明显 | shared_controls / library_forms / time_responsive | 已关闭；见最终复核对应图 |
| SH-07 | P2 | library:321–334目标/实际仓位头值均start且13px，time compare_details:415–426三列数字均start；正文107/策略527要求共同右界14/20。 | 05-confirm、09-compare；其他数值列表应同查 | shared_controls / library_forms / time_responsive | 已关闭；见最终复核对应图 |
| SH-08 | P2 | library:75行高70、experiments:行高76、confirm:329–333行间40/底36且数值13；策略正文605却宣称数据行48，没有列明例外。两行身份有合理业务需要，不能直接压扁。 | 01、03、04b、05以及表类 | shared_controls / library_forms / time_responsive | 已关闭；见最终复核对应图 |
| SH-09 | P2 | time:421用NEG #EF7F89为最大回撤普通数字。该色V2.5仅贡献柱/图例；普通亏损为#FF8592。 | 09-compare；time中其他NEG使用按图形/文字角色复核 | shared_controls / library_forms / time_responsive | 已关闭；见最终复核对应图 |
| SH-10 | P2 | base:185/time:134的摘要标签12px；策略正文116明确14/20标签，V2.5主Metric标签实例14。当前全幅大主值/细小标签层级不符自身契约。 | 06、08、09、11摘要 | shared_controls / library_forms / time_responsive | 已关闭；见最终复核对应图 |
| SH-11 | P2 | 06主值¥102,540.84、side_check ¥56,819.15以及多处本金保持完整值；策略正文330和V2.5要求金额万/亿两位缩写、详情/聚焦完整。输入本金可完整，但只读指标/表格不能无声明全部例外。 | 06、08、09、11，05只读金额；04编辑输入不机械改 | shared_controls / library_forms / time_responsive | 已关闭；见最终复核对应图 |
| SH-12 | P2 | base chart:103/106/110以18px画净值图标题，V2.5:48固定图标题16/600；截图06主图标题与右侧模块同级。base/time文本helper大量直接传13/11无语义角色。 | 06主图及其局部；其他图标题按role盘点 | shared_controls / library_forms / time_responsive | 已关闭；见最终复核对应图 |
| CMP-01 | P1 | 策略独有组件无公共定义，引用指向不存在的共享项 | 全部 21 图；详见末尾覆盖表。公共扩展清单见下。 | root + shared_controls | 已关闭；见最终复核对应图 |
| CMP-02 | P1 | 公共手册残留首页独占规则，足以误导后续模块 | 01-library、01b-package-management、03-experiments、04b-select-strategies、05-confirm、08-results、09-compare、10-states、12-components。建议 SW08 同时给出局部重试例与首页实例边界。 | root + shared_controls | 已关闭；见最终复核对应图 |
| CMP-03 | P1 | 三包组合只显示只读摘要，缺选择/换包/有效参数编辑样例 | 02-compose、04b-select-strategies、05-confirm、12-components。 | library_forms | 已关闭；见最终复核对应图 |
| CMP-04 | P1 | 日期时间与步骤条没有角色/状态定义，资金参数仅展示而无编辑示例 | 04-create、04b-select-strategies、05-confirm、07-time-controls-detail、07-time-states、07a-t0、07b-first-day、07c-lookback、08-results、09-compare、11-compact、11-narrow、11-responsive、12-components。 | library_forms | 已关闭；见最终复核对应图 |
| CMP-05 | P1 | 多选策略行和手动排序的“操作”只有状态文字 | 01-library、01b-package-management、04b-select-strategies、12-components。 | library_forms | 已关闭；见最终复核对应图 |
| CMP-06 | P1 | 异常图把系统承诺画成按钮，且违反本页无匹配恢复规则 | 10-states、12-components，并关联所有查询、保存、运行、确认图。 | library_forms | 已关闭；见最终复核对应图 |
| CMP-07 | P2 | 共用尺寸/字级被多个本地 helper 悄悄改写，未登记业务变体 | 01-library、01b-package-management、04b-select-strategies、06-observe、07全系列、08-results、09-compare、11三张、12-components。 | shared_controls / library_forms / time_responsive | 已关闭；见最终复核对应图 |
| CMP-08 | P2 | 数值列右对齐规则在确认/比较表被忽略 | 01b-package-management、05-confirm、09-compare、12-components。 | shared_controls / library_forms / time_responsive | 已关闭；见最终复核对应图 |
| CMP-09 | P2 | 比较曲线缺线型冗余编码；贡献负色误用到K线/回撤 | 07-time-states、07a-t0、07b-first-day、07c-lookback、09-compare、12-components。 | shared_controls / library_forms / time_responsive | 已关闭；见最终复核对应图 |
| CMP-10 | P2 | 组件错误态以错误文案覆盖字段值，未体现保留输入的契约 | 04-create、02-compose、05-confirm、10-states、12-components。 | library_forms | 已关闭；见最终复核对应图 |

## 视觉复核

视觉审查以当前SVG的新鲜浏览器渲染为准，旧截图只提供历史线索。管理偏好区域实际文字重叠单列 VIS-01；其他共享样式发现归入对应 SH/CMP 条目。曾从旧截图怀疑的创建字段、管理Toast、窄屏底部问题，经当前源复核已撤回，不列作当前失败。

| ID | 级别 | 问题 | 所有者 | 状态 |
| --- | --- | --- | --- | --- |
| VIS-01 | P1 | 01-library 管理偏好说明与“当前列表”重叠 | library_forms | 已关闭；见library最终复核 |
| VIS-02 | P2 | 常驻设计解释、过量抬高表面及嵌套边框削弱信息层级 | 各画板负责人，root整体复核 | 已关闭；见三批最终复核 |

## 完整审查依据

- [公共规范审查与21图指纹](evidence/audit/shared.md)
- [策略组合组件审查与状态样例要求](evidence/audit/components.md)
- [独立视觉审查](evidence/audit/visual.md)
- [需求与画板覆盖契约](DESIGN-COVERAGE.md)

54px折叠、200px展开和48px顶栏是已批准策略尺寸，并非本轮缺陷。修复其图标、状态和示例；不把首页72/64、固定八行、旧数量徽章和唯一恢复入口机械迁入策略台。两行身份列表72px为SW05的明确业务扩展，普通单行表继续48px。

## 独立视觉问题逐项记录

| ID | 级别 | 当前源问题 | 状态 |
| --- | --- | --- | --- |
| V01 | P1 | 管理偏好中的两行文字重叠 | 已关闭；见最终复核对应图 |
| V02 | P2 | 导航壳缺项且同一导航重复 | 已关闭；见最终复核对应图 |
| V03 | P2 | 产品画面常驻设计与实现解释，压低任务信息密度 | 已关闭；见最终复核对应图 |
| V04 | P2 | 普通信息过量使用raised层与卡内卡 | 已关闭；见最终复核对应图 |
| V05 | P2 | 分段控件视觉尺寸与公共控件不符 | 已关闭；见最终复核对应图 |
| V06 | P2 | 文本字阶散落13px/11px，小控件字重偏重 | 已关闭；见最终复核对应图 |
| V07 | P2 | 数字列未遵循字形右沿对齐 | 已关闭；见最终复核对应图 |
| V08 | P2 | 图标使用文字替身且搜索图标过小 | 已关闭；见最终复核对应图 |
| V09 | P2 | 控件矩阵悬停色偏离公共token | 已关闭；见最终复核对应图 |
| V10 | P2 | 预览与确认混在同一产品帧，步骤状态不清晰 | 已关闭；见最终复核对应图 |
| V11 | P2 | 实验列表行高显著偏离公共表格密度 | 已关闭；见最终复核对应图 |
| V12 | P3 | 紧凑与窄屏图表重复标题及重叠边框层次 | 已关闭；见最终复核对应图 |
| V13 | P3 | 异常状态示例将无需操作的状态画成动作按钮 | 已关闭；见最终复核对应图 |

## 修复过程中发现的问题与关闭证据

下列编号带批次前缀，与初审SH/CMP编号区分。各报告保存原始发现、失败版本和逐项截图，不将重复发现累计为独立缺陷数。

| 批次 | 复验发现 | 最终结果与证据 |
| --- | --- | --- |
| R2-L01–L15 | 文字重叠、预览误含提交、表头右界、时区标签、选择器越界、首行挤压、只读详情编辑、模式尺寸、行高、勾选矛盾、空列、表面层级、错误间距、恢复按钮、工程说明 | 15项关闭，见[library逐项表](evidence/reviews/strategy-v12-library-final-review.md) |
| R2-C01–C07 | 参数缺实际控件、日期边界、排序状态、重复清除、离开草稿缺例、包详情混入本金、最新日仍突出返回 | 7项关闭，见[public与观察页逐项表](evidence/reviews/strategy-v12-shared-final-review.md)；原报告保留SH-01–07编号 |
| R2-T01–T09 | 负贡献方向、窄屏回放越界、结构示意压缩、内容删减、日期映射、交集误可编辑、失败原因、结果局部模式、表格行高 | 9项关闭，见[time逐项表](evidence/reviews/strategy-v12-time-final-review.md) |
| F-T10 | 9/13检查区误用6/17持仓比例 | 已关闭；11两图统一55.4%/34.6%、5.68万/3.54万，现金1.03万 |
| F-T11 | 时间局部图通用禁用示例与R未生成上下文不清 | 已注明为独立状态样例，见07-time-controls-detail最终图与time复核 |

初审发现已在本版设计范围关闭；不存在以正式产品尚未实现为理由掩盖的静态视觉失败。产品真实点击、回放与持久化没有被本次静态样例证明，详见[验收边界](acceptance.md)。
