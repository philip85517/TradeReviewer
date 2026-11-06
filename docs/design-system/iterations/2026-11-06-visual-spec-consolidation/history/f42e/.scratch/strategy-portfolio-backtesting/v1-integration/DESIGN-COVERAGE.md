# V1 与 A 工作台融合覆盖表

范围：设计整合，用户来源为2026-09-30“这里的设计内容与‘策略工作台迭代V1’当前的设计进行融合”。[共同规格](../../../docs/specs/2026-09-30-strategy-workbench-v1-integrated-design.md)的IF01–10负责跨页规则；局部完整规格及历史验收继续有效。没有派发UI实施，所有“融合后实际浏览器证据”均为NOT VERIFIED；不能据设计对齐关闭09/11或绕过10依赖。

整页视觉/状态链设计owner为root；V1原任务负责库/创建源稿，A原任务负责工作台源稿；独立设计一致性审查为v1_design_reconciliation。后续实际实施owner必须另行在09/10/11既有流程中指定，不能把设计owner当作已派发实现者。

下表源文件行号按本轮读取版本定位，优先稳定ID；并行V1修订可能移动行号。基路径为`.scratch/strategy-portfolio-backtesting/`。源码/DOM不是视觉验收证据。

| 需求/精确来源 | elementID | 准确画板/参考图 | 阶段与旅程 | owner/承接任务 | 交付映射 | 后续浏览器操作与预期/反例 | 证据与状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| IF01；库规格SL16/LD11；模型M03 L60、M13 L343；工作台SW08/WD01 | LIB01–10、WB01 | strategy-library-wireframes/screenshots/feedback5/f01-1280.png、strategy-library-wireframes/screenshots/feedback5/f14-1440.png；F14–F18 | 库→实验列表→四步 | root设计；09/10 | 统一导航/页面职责 | tab不创建、不选策略；只在我的实验新建；反例库中用于新实验 | 本规格§2；设计审查见REVIEW.md；跨页UI NOT VERIFIED |
| IF02；模型M08 L196、M13 F18；Repair时间表 | LIB08–09、WB01–05 | strategy-library-wireframes/screenshots/feedback4/f18-1280.png；workbench-design/style-04-evidence/t0-1280.png | 确认/失败/重开 | root；10→05 | 草稿与锁定运行交接 | 将锁定→确认成功→待开始0持仓；失败留草稿；反例跳固定另一实验 | §2；实际接线NOT VERIFIED |
| IF03；模型M02 L30、M05 L106；库LD04、工作台WD06 | LIB03–05、WB01/08 | F06；workbench-design/style-04-evidence/config-1440.png | 库升级/归档→旧实验 | root；09/10/11 | 版本快照 | 名称变或库更新不改旧ID/参数；反例策略ID当组合ID | §3；实际数据链NOT VERIFIED |
| IF04；模型M05 L98、J2 L142、M11 L242 | LIB03/06–10、WB08 | F02/F03/F05/F09；workbench-design/style-04-evidence/event-1440.png | 新建保存/取消/失败，包详情层级，事件来源 | root；10/05/06 | 来源栈 | 返回保留选择/查询/焦点；事件关闭仍停该日；反例两策略落到单策略预览 | §3；实际返回链NOT VERIFIED |
| IF05；模型M05/M13视觉 L371；Repair固定预算；Style固定预算 | LIB11、WB01 | strategy-library-wireframes/screenshots/feedback4/f18-1280.png；workbench-design/style-04-evidence/complete-1280.png | 展开/收起导航→跨页 | root；09/11/10 | 共享导航状态 | 200/54由用户控制，切页不自动改变；工作台不叠40px新条；反例每页各设默认宽度 | §4；融合两种导航视觉NOT VERIFIED |
| IF06；STYLE-06 UI06-02/03；STYLE-04 ST01–05；app/globals.css | LIB11、WB01–08 | screenshots/creation-baseline-1440.jpg；workbench-design/style-04-evidence/complete-1440.png、workbench-design/style-04-evidence/pressure-1280.png | 列表/表单/图表/长名/金额/异常 | root；09/11 | 共享token及密度等级 | 原站同主题、36按钮/40输入与A工具36；不得压字删字段；两类详情宽度保留 | §4；原图1417×900 CSS未知；融合视觉NOT VERIFIED |
| IF07；STYLE-06 UI06-01/04/05；Repair UR03–08 | LIB11、WB01/04–08 | F06/F18；workbench-design/style-04-evidence/delivery-default.png | 所有产品文字/诊断区 | root；09/11 | 术语与提示 | 动词/原因可读；无V/M和画板ID；版本/费用/能力说明仍在 | §4；融合文本审计待UI，NOT VERIFIED |
| IF08；工作台WD04/05、WT-C/E；Repair最小数据契约 | WB02–08 | workbench-design/style-04-evidence/first-trade-1280.png、workbench-design/style-04-evidence/compare-1440.png、workbench-design/style-04-evidence/event-1440.png | 推进/暂停/回看/比较/事件/失败 | root；05/06 | 原子投影与视野 | 新K实际可见，成交取决于信号/执行条件；所有参与组合共同截止C=min(R,M,全部Mᵢ)；事件全区投影；反例只改日期、轴含未来 | §5；A局部历史PASS保持，融合回归NOT VERIFIED |
| IF09；模型M12 L263、M14 L377；库SL12–17/LT-K–O | LIB01–10 | F10–F13；strategy-library-wireframes/screenshots/feedback5/f01-1280.png、strategy-library-wireframes/screenshots/feedback5/f14-1440.png | 查找/整理/归档/恢复/双列表返回 | V1 owner；09/10 | 管理能力保留 | 查询与身份解耦；归档不删引用；卡片建议未自动采纳 | §6；静态范围独立，真实能力NOT VERIFIED |
| IF10；两原型README/验收；项目开发流程/10验收 | 全部 | 以上同状态来源；新增融合渲染待实施产生 | 创建→真实图→暂停→列表重开；再扩展结果链 | root集成；09/11→10→05/06 | 唯一入口与验收 | 最小真实图旅程先验收；功能、状态、视觉分开；生产隔离库另验 | §7；文档链检查见ACCEPTANCE.md；集成UI/生产NOT VERIFIED |

本轮纯文档，新增渲染对比与数据库操作NOT APPLICABLE；这不豁免未来融合UI在上表所列的NOT VERIFIED门槛。参考图只提供局部设计依据，不声称两个独立原型的数据样例相同。
