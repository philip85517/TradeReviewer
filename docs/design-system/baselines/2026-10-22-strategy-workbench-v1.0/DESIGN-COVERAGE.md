# 设计覆盖矩阵

版本：STRATEGY-DESK-V10 / 1.0，2026-10-22。只覆盖设计要求，非产品控件通过率。历史来源 Hxx 精确文件见 source/history/index.json；V25 为相邻 homepage-v2.5 的 source/visual-design.candidate.md 与 component-manual.html。协调者为所有状态链/全页视觉的责任人。Luna仅负责下列图稿，root负责正文、来源、接受；验收统一见 acceptance.md。

| 需求/元素ID | 精确来源 | 用户旅程/本次设计 | 画板/正文 | 画板负责人 | 验收证据 |
| --- | --- | --- | --- | --- | --- |
| ST15 / NAV01–03 | H04 IF01–02；H06 完整观察 | 策略库↔我的实验→实验；折叠54/展开200；外层滚动 | 第三章ST15，01-library.svg / 06-observe.svg | Luna / library_form_artboards | 浏览器图稿+来源审查 |
| ST02 / LIB01–06 | H03 SL01、10–18；H04 LIB01–11 | 完整策略/三类包，搜索筛选分页、详情返回、置顶移动/归档恢复/标签 | 第04章，01-library.svg / 02-compose.svg | Luna / library_form_artboards | 图稿+字段状态表 |
| ST03 / ASM01–06 | H03 SL04–08；H04 IF03–05 | 三包组装、版本详情、保存新版本/复制新ID、锁定引用 | 第05章，02-compose.svg | Luna / library_form_artboards | 图稿+版本矩阵 |
| ST04 / EXP01–05 | H04 IF05、09 | 草稿/未开始/暂停/完成/失败列表，显式创建 | 第06章，03-experiments.svg | Luna / library_form_artboards | 图稿+返回表 |
| ST05 / WIZ01–08 | H02 四步A、T0；H04 IF05–06 | 1时间 2策略 3预览组合（含独立资金/执行） 4确认；内联新策略返回 | 第07章，04-create.svg / 04b-select-strategies.svg / 05-confirm.svg | Luna / library_form_artboards | 四步画板+确认字段表 |
| ST06 / OBS01–08 | H06–H09；H04 WB01–08 | 完整观察、组合/指标/日期/净值/K线/检查区 | 第08章，06-observe.svg | Luna / strategy_artboards | H09同状态结构与新稿比对 |
| ST07 / TIME01–08 | H01时间规则；H02 DD02–DD16；H08 BT08 | T0→第一日可见成交→回看→最新；不泄露未来 | 第09章，07-time-states.svg | Luna / time_results_artboards | 三帧时点/图形对照 |
| ST08 / RES01–08 | H01 R04–06；H02结果/事件；H04 IF08 | 结果截止、指标/贡献/调仓→事件日→返回 | 第10章，08-results.svg | Luna / time_results_artboards | 图稿+结果口径/往返表 |
| ST09 / CMP00–05 | H02比较与派生；H04 IF08–09 | 共同有效区间、独立资金、4条高亮/其他表格、派生新实验 | 第11章，09-compare.svg | Luna / time_results_artboards | 图稿+对比矩阵 |
| ST10 / ERR01–08 | H01/H02失败与恢复；H04 IF07 | 加载/无匹配/无候选/覆盖不足/失败/落后/冲突/确认失败 | 第12章，10-states.svg | Luna / library_form_artboards | 8态图+恢复说明 |
| ST11 / RSP01–05 | H06/H10；V25共享规则 | 1440、1280、1024/1023、760/759、390布局；长文本 | 第13章，11-responsive.svg / 11-compact.svg / 11-narrow.svg | Luna / strategy_artboards | 窄屏图+断点规则；非产品响应式验证 |
| ST12 / CMPNT01–14 | V25公共契约/控件手册 | 控件8态、键盘焦点、金额/文字、各业务组合 | 第14章，12-components.svg | Luna / library_form_artboards | token/控件图与V25对照 |
| ST16 / FLOW01–08 | H04 IF04–10 | 来源恢复、版本不可变、持久化流程/错误保留设计 | 第十五章ST16，正文表格 | root | 规则审查；产品持久化NOT VERIFIED |
| ST14 / EVID01–04 | H01–H10、聊天摘要、V25 | 来源优先级、变更取舍、实施/接受边界 | 资料附录ST14，source/history/chat-findings.md | root | 来源指纹与独立审查 |
| ST01 / 研究背景与设计目标 | 本轮用户从零论述要求；H01/H02研究边界 | 为什么研究、三项目标、范围与设计成本 | 第一章；原布局规则移ST15 | root | editorial-rebuild-audit.md；独立全文审查 |
| ST13 / 设计理念与完整流程 | H04 IF04–10；本轮用户高维向低维要求 | 策略/实验/组合；身份/时间/原因；准备→创建→观察→结果→比较 | 第二章；原FLOW精确交接移ST16 | root | 研究流程表；research-model/flow截图；独立审查 |

未生成/未检查画板在实际接受记录保留NOT VERIFIED，不以本表计划代替完成证据。静态画板中按钮是设计元素，不伪称可操作原型；阅读器可操作控件另外登记。

## 2026-10-23 全文论述修订

用户要求建立清楚的总分论述，说明各章目标与取舍，再安排规则、参数和引用。该范围覆盖导读与ST01–ST14全部正文，逐章问题和接受项见[editorial-audit.md](editorial-audit.md)。本轮Luna/library_form_artboards负责初稿分组，root负责最终全文改写与整合接受，design_review负责独立内容复核；原画板和业务元素映射保持不变，生产UI及数据库不适用。

| 附属修复ID | 依据与参考 | owner | 旅程/验收 |
| --- | --- | --- | --- |
| DOC-RULES-01 | 本轮“规则、参数分组”要求；source正文14处details为精确内容参考 | time_results_artboards修复；root接受；design_review视觉复核 | 逐一展开→分段/标题/表格正确→收起；代表性展开截图对照正文，1280×720 |
| DOC-ANCHOR-01 | 现有单块评论身份及章节目录契约 | 同上 | 保留单一评论描述符，内部标题不污染目录，不重复ID；生成验证+浏览器章节跳转 |

触发为阅读器渲染变更。仅检查这14个折叠及相邻导航/锚点；未改变的图稿、分镜和评论写入保留原验收，不计入本轮控件分母。物理触摸、交易数据库及产品状态链不适用，因本轮只涉及文档正文显示。

## 2026-10-24 全文结构重建

范围为导读和全部叙事，从认知框架重新组织15主章与资料附录。root负责全文、图文顺序、构建及集成接受；editorial_structure_review独立审查结构、语义和浏览器截图。原74元素与各自来源不变，ST15承接NAV布局规则，ST16承接FLOW交接规则；ST01改为背景/目标，ST13提前说明理念与完整流程。所有规则块逐字保留，图片路径和内容未改。逐章问题、V2.5对照及新结构见editorial-rebuild-audit.md。

| 本轮检查ID | 依据/范围 | owner | 操作与证据 |
| --- | --- | --- | --- |
| DOC-STRUCTURE-02 | 本轮完整论述要求；V2.5第一至十章与附录 | root重写；独立审查者接受 | 原导读+14章扫描、新15章+附录全文审查；editorial-rebuild-review.md |
| DOC-NAV-02 | 新目录62链接，含标题/16章/45子标题 | root | 鼠标逐项跳转，目标标题可见；reader-navigation.json |
| DOC-RULES-02 | 原14规则块，新排序 | root | 14鼠标展开、14 Enter收起；reader-details.json |
| DOC-DEMO-02 | 创建与回放各3帧，位置和上下文变化 | root | 重播到首帧、逐帧前进、返回上一帧；reader-storyboards.json |

触发为完整文档结构重排，未修改阅读器实现或样式。检查范围是文档阅读，不把SVG业务按钮作为可用产品控件；高级评论、评论写入、分镜自动播放实现未改，沿用旧证据而不计入本轮分母。生产UI与数据库门为NOT APPLICABLE于本轮文档编辑；产品实现原NOT VERIFIED保留。
