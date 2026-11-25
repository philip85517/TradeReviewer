> 归档说明：以下为原验收时点的文本记录，不是本次重新验收。截图、数据库、日志及私有原件仅本地核查，不随 Git 分发；文中其文件名不是随附证据链接。

# 本轮验收结论

本轮局部修复完成，整体首页及附属页面尚未全部验收。验收root，独立视觉审查round1_review。历史FAIL原图与原记录全部保留。人读摘要见[项目报告](../2026-11-23-homepage-visual-repair.md)。

## 版本与环境

HEAD 3eb5813b7469f828339b9555194f3e98cd84d707；分支codex/homepage-performance-data-optimization；12份本轮源文件与独立接受指纹一致，另有此前19份dirty工作保留。以evidence/final-manifest.json为准。3422为本轮vinext生产构建，3421为开发；DB显式隔离acceptance.sqlite。没有操作业务库、提交或推送。最终浏览器3422/home，ready=true/pending=false，中文可见、无U+FFFD，1280×720无全页横溢。

## 独立门槛

| 门槛 | 结论 | 证据及限制 |
| --- | --- | --- |
| 已列布局修复 | PASS（局部） | 17宽实测、关键状态截图；独立review直接对照批准参考 |
| 筛选草稿/费用符号 | PASS（所列状态） | Esc各焦点/重开/应用/移除ETF；2026费4121.99无+，未知仍— |
| 持仓/日期到交易库与返回 | PASS（样本） | SNDK/Tiger/US/4成交，来源清除/返回；11-22日期空成交，settled返回reload保持query；生产再证SNDK链 |
| 图表键盘错位 | PASS（反例）；完整输入NOT VERIFIED | Home/End/左右/Esc及点击；真实hover接管未验 |
| 类型/生产构建 | PASS | tsc --noEmit exit0；vinext build五阶段exit0。首次错误CLI路径已更正，不算产品失败 |
| 相关测试 | PASS | header-controls/history/full-cutover/homepage-preview四文件56项通过；只增必要键盘反例。jsdom scrollTo警告保留 |
| 全部历史金融数据 | FAIL/OPEN | 824笔中1笔净额未知，费用亦有未知；贡献328来源对象中27项依据缺口；不用0或贡献小计冒充总额 |
| 打新完整分类 | FAIL/OPEN | 分类仍不可计算，未在视觉票改金融归类 |
| 交易库整体视觉 | FAIL/OPEN | 固定V1.0与旧200px侧栏/页头/统计组织存在差异；来源条局部接受不能代表整页 |
| 所有控件/指标/状态/触控 | NOT VERIFIED | 见CONTROL-COVERAGE，不称100% |
| 交易写入持久化 | NOT APPLICABLE（本轮代码范围） | 仅展示/读取交互改动；整套编辑/复盘/撤销写入仍未验，不免除未来写流程验收 |

无新增数据处理或性能实现，本轮不扩全仓回归或10倍压测。构建大包、opencv浏览器外置、Node module.register弃用警告保留，不构成构建失败；性能SLA未在本轮验收。

## 记录与后续

旧history-tooltip-end/home-390.jpg保留；修复后*-fixed图及JSON追加。早期date-library-return-reload.json在回程未settle即reload，不作通过，由date-return-settled.json取代。独立review早期FAIL以最终冻结局部复核逐项解除，其余NV保留。01/04/06关闭；02/03/05仍open，不用局部PASS关掉未验门槛。

下一轮：交易库V1.0整页差异；历史四指标/空态/鼠标接管；持仓右端与导出；金融缺口另循原件追查。改动后重验受影响区域。

## 预览与重启

以下记录原验收时点的预览与启动条件；原隔离快照不随 Git 分发，历史端口与运行状态不保证当前可用。

历史启动说明（不可执行）：当时使用专用隔离快照与独立端口，相关数据库仅本地核查，不随 Git 分发；该历史快照不随本文提供。当前通用开发启动在仓库根目录执行 `make dev`，固定端口3333，自动新建隔离备份；不等同于复现上述历史冻结版本。

前提：已完成本轮生产build、3422空闲。不要改为业务库，不停止其它会话3333/3419服务。
