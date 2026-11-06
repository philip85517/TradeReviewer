# V1.2 设计覆盖与修复契约

触发：2026-10-24用户要求多个Agent全面review公共规范并修复。范围：原21张静态设计画板及新增05-preview独立第3步、完整正文、公共扩展样例、阅读器呈现。没有生产业务控件或数据库写入；图中按钮为设计元素。阅读器目录、14规则折叠和创建4帧、时间3帧分镜实际操作另记 acceptance.md。

整页视觉/跨文件集成负责人：root。数据/持久化负责人：root（本次N/A，example-data.json必须原样保留）。独立视觉审查：audit_visual（不参与实现）。实现：Luna gpt-5.6-luna，默认推理effort。

## 引用优先级与取舍

用户本轮要求优先；V2.5 source/visual-design.candidate.md #sitewide-visual/#chapter-HP08 是颜色、字级、控件和状态唯一基础；source/images/home-1440.svg 提供导航图标形状与选中表面（旧交易库数量badge已被正文废止，不继承）。source/images/atoms.svg、visual-samples-board.svg 和source/component-manual.html是局部对照。

NAV01沿用H04折叠54/展开200/顶栏48，其宽高不是公共颜色/控件例外，公共原文明确首页72/64属于首页布局。保留这些策略业务尺寸，补全同源图标、当前策略高亮、展开/折叠样例与名称。共享样式不变；策略扩展用SW01–SW08公开说明依据、代价和适用范围。

共享实现接口：新 source/shared-primitives.py 提供 icon(x,y,name,size=16,color=...), nav_rail(height,expanded=False), button(x,y,label,w,primary=False,disabled=False), segmented(x,y,label,w,selected=False), select_control(x,y,value,w,kind='select',disabled=False)。所有函数返回SVG字符串，不I/O。模式tab为36px/14px；静态badge/token保持24px/12px。公共色及图标同源，禁止Unicode符号替代控件图标。状态、参数和解释写入文档或专属说明图，不堆在常规产品整页中。

比较视口：1440整页、1280紧凑、390窄屏；局部画板920原尺寸。每张截图包括完整画板或上/下段；SVG固有尺寸与CSS视口分别记录。静态稿无法证明真实响应式断点、产品交互或物理触摸，不把它们写成PASS。

## 页面/元素/所有者映射

业务元素原始精确来源与状态链按V1.0 DESIGN-COVERAGE.md首表及本版source/history/index.json完整保留；这里覆盖原21张及新增预览画板与本轮公共修复。

| 画板 | 业务元素/旅程 | 精确参考 | 修复所有者 | 证据目标 |
|---|---|---|---|---|
| 01-library.svg | LIB01–06/NAV01–03 | H03 SL01、10–18；H04 LIB01–11；V2.5 atoms.svg、home-1440.svg | Luna/library_forms | evidence/final/01-library.png，规范对照与独立复审 |
| 01b-package-management.svg | LIB03–06 | H03 SL10–18；H04 LIB01–11；V2.5 atoms.svg | Luna/library_forms | evidence/final/01b-package-management.png，规范对照与独立复审 |
| 02-compose.svg | ASM01–06 | H03 SL04–08；H04 IF03–05；V2.5 atoms.svg | Luna/library_forms | evidence/final/02-compose.png，规范对照与独立复审 |
| 03-experiments.svg | EXP01–05 | H04 IF05、09；V2.5 visual-samples-board.svg | Luna/library_forms | evidence/final/03-experiments.png，规范对照与独立复审 |
| 04-create.svg | WIZ01、05–08 | H02 四步A、T0；H04 IF05–06；V2.5 atoms.svg | Luna/library_forms | evidence/final/04-create.png，规范对照与独立复审 |
| 04b-select-strategies.svg | WIZ02、05–08 | H02 四步A；H04 IF05–06；V2.5 atoms.svg | Luna/library_forms | evidence/final/04b-select-strategies.png，规范对照与独立复审 |
| 05-preview.svg | WIZ03、05–08 | H02 四步C；H04 IF05–06；V2.5 atoms.svg | Luna/library_forms | evidence/final/05-preview.png，预览与确认分离 |
| 05-confirm.svg | WIZ04–08 | H02 四步D；H04 IF05–06；V2.5 atoms.svg | Luna/library_forms | evidence/final/05-confirm.png，规范对照与独立复审 |
| 06-observe-status-detail.svg | OBS01–08/NAV01–03 | V2.5 home-1440.svg/atoms.svg；H06–09观察 | Luna/shared_controls | evidence/final/06-observe-status-detail.png，规范对照与独立复审 |
| 06-observe.svg | OBS01–08/NAV01–03 | V2.5 home-1440.svg/atoms.svg；H06–09观察 | Luna/shared_controls | evidence/final/06-observe.png，规范对照与独立复审 |
| 07-time-controls-detail.svg | TIME01–08 | H01 时间规则；H02 DD02–DD16；H08 BT08；V2.5 atoms.svg | Luna/time_responsive | evidence/final/07-time-controls-detail.png，规范对照与独立复审 |
| 07-time-states.svg | TIME01–08 | H01 时间规则；H02 DD02–DD16；H08 BT08；V2.5 atoms.svg | Luna/time_responsive | evidence/final/07-time-states.png，规范对照与独立复审 |
| 07a-t0.svg | TIME01–08 | H01 时间规则；H02 DD02–DD16；H08 BT08；V2.5 atoms.svg | Luna/time_responsive | evidence/final/07a-t0.png，规范对照与独立复审 |
| 07b-first-day.svg | TIME01–08 | H01 时间规则；H02 DD02–DD16；H08 BT08；V2.5 atoms.svg | Luna/time_responsive | evidence/final/07b-first-day.png，规范对照与独立复审 |
| 07c-lookback.svg | TIME01–08 | H01 时间规则；H02 DD02–DD16；H08 BT08；V2.5 atoms.svg | Luna/time_responsive | evidence/final/07c-lookback.png，规范对照与独立复审 |
| 08-results.svg | RES01–08 | H01 R04–06；H02 结果/事件；H04 IF08；V2.5 visual-samples-board.svg | Luna/time_responsive | evidence/final/08-results.png，规范对照与独立复审 |
| 09-compare.svg | CMP00–05 | H02 比较与派生；H04 IF08–09；V2.5 visual-samples-board.svg | Luna/time_responsive | evidence/final/09-compare.png，规范对照与独立复审 |
| 10-states.svg | ERR01–08 | H01/H02 失败恢复；H04 IF07；V2.5 atoms.svg | Luna/library_forms | evidence/final/10-states.png，规范对照与独立复审 |
| 11-compact.svg | RSP01–05/OBS04/TIME06 | H06/H10；正文 ST11 断点表；V2.5 #sitewide-visual | Luna/time_responsive | evidence/final/11-compact.png，规范对照与独立复审 |
| 11-narrow.svg | RSP01–05/OBS04/TIME06 | H06/H10；正文 ST11 断点表；V2.5 #sitewide-visual | Luna/time_responsive | evidence/final/11-narrow.png，规范对照与独立复审 |
| 11-responsive.svg | RSP01–05/OBS04/TIME06 | H06/H10；正文 ST11 断点表；V2.5 #sitewide-visual | Luna/time_responsive | evidence/final/11-responsive.png，规范对照与独立复审 |
| 12-components.svg | CMPNT01–14 | V2.5 #sitewide-visual、#chapter-HP08、atoms.svg、component-manual.html | Luna/library_forms | evidence/final/12-components.png，规范对照与独立复审 |

## 公共扩展

| ID | 职责与来源 | 页面引用 | 所有者/证据 |
|---|---|---|---|
| SW01 | 紧凑/展开导航；H04 NAV、V2.5导航图标 | NAV01与所有整页 | shared_controls；公共样例+所有整页 |
| SW02 | 日期边界复合字段；V2.5日期输入36高，H01时间语义 | WIZ/OBS/TIME | shared_controls定义，三组引用 |
| SW03 | 四步向导；H02四步 | WIZ01–08 | shared_controls定义，library_forms引用 |
| SW04 | 三包选择槽与版本；H03/H04 | ASM01–06 | 同上 |
| SW05 | 多选策略/两行研究表；H03/H04 | LIB/EXP/WIZ | 同上 |
| SW06 | 连续摘要与检查区；H06观察 | OBS01–08/RSP | shared_controls定义，time_responsive复用 |
| SW07 | 回放时间与三模式；H01/H02 | TIME/RES/CMP | shared_controls定义，time_responsive引用 |
| SW08 | 局部查询、说明层、恢复；V2.5基础/H04业务范围 | LIB/ASM/ERR | shared_controls定义，library_forms引用 |

公共样例目录 docs/design-system/shared/strategy-workbench-v1.2/：独有复合组件的外观、尺寸、状态、键盘与恢复；不覆盖公共默认值。root负责V2.5入口与策略全文逐章链接。

## 复核后的契约补充

V10确认四步业务不合并。为清楚表达当前步骤，新增05-preview.svg独立第3步，05-confirm.svg只表示第4步。新增画板由library_forms负责，引用WIZ04与H01/H02；证据evidence/final/05-preview.png。此为补齐已批准流程的分镜表达，不改变产品流程。所有原21图继续复核，总计22图。

## 最终集成责任与接受

最初Luna任务边界保留于上表。第二轮发现后，root接管跨文件视觉集成、10张库/表单修订、公共SW03/04/05、06和响应式日期/数据修复；独立审查者未实施这些变更。所有最终图与对应公共样例的截图、hash及PASS分别见三批最终报告和acceptance.md。产品数据流负责人不适用，本轮没有业务实现。
