# 05 — 完整预览可向下滚动

ID: TR-VIS-05
State: closed
Status: accepted-scoped
Assignee: scroll_fix_luna
集成负责人: root（整页视觉、导航及状态）；独立审查：observe_scroll_diagnosis

## Scope / Refs

2026-10-10 用户：“整体ok，最后修复一下无法下滑的bug”。保留用户确认的0.7视觉，仅恢复完整预览文档的正常纵向滚动；完整观察/结果/比较和原版主题均适用，离开预览后原固定工作区的滚动策略不变。

- [规范§复盘工作面](../../../docs/designs/2026-10-08-strategy-visual-system/homepage-style-reuse.md:62)：自然文档滚动，不压缩图表或删内容。
- [完整恢复契约](../full-restore-contract.md)，[前轮接受](../../../docs/designs/2026-10-08-strategy-visual-system/observe-regression-20261009.md)。
- 精确参考：`../evidence/observe-regression-20261009/final4-complete-1440.jpg`（1440×900，DPR1）；本轮`../evidence/observe-scroll-20261010/before-top-1280.jpg/json`（1280×720，DPR1）。`before-metrics.json`为独立DPR2测量，不与DPR1图混为一组。
- DESIGN-COVERAGE S01–S04；无新增产品元素，沿用 E01导览/E05图表/E06菜单/E07事件抽屉。

## 根因与状态契约

实测1280×720：document.scrollHeight=1051，body overflow=hidden，预览自然高度且无独立滚动容器；native wheel与End均scrollY=0。globals.css:47为固定应用锁住body，3654–3657在≤1059恢复auto；390×844原本可wheel至844，属于保持项。滚动/窗口变化/主题/菜单关闭不改当前日期、行情与成交截止、组合或图型；滚动不调用fitContent或回放推进。无SQL写入，数据库接受NA（纯内存合成预览）；实际触屏不冒充已验证。

## 验收标准与反例

- [x] 1280×720、1440×900、1060及1059边界、390×844的上下wheel/键盘End/Home能到页底并返回顶部；新green-matrix及1280输入证据。
- [x] 完整结果/比较保持原内部滚动并可到文档底部；原版可滚动；离开原创建body hidden恢复。
- [x] 1280/390菜单与抽屉独立滚动、Escape回焦点；日期/组合/图型保持。390补图after-menu-visible-bottom完整显示末项本金。
- [x] 同状态DPR1的1280/1440/390前后几何相同；独立审查直接看图并接受，见reports/observe-scroll-review-20261010.md。
- [x] 原CSS除4行增量完全相同，其他3个呈现文件哈希不变；新build/CSS解析/diff通过，root浏览器接受、服务运行。详见新最终记录。

## 派发说明

Luna仅允许修改`app/components/strategy-prototype/full-workbench-preview.css`以及`reports/observe-scroll-implementation-20261010.md`。优先DOM范围限定的body滚动规则，保留其他页面的overflow和局部滚动；不得修改globals、TSX/状态/数据/图表wheel配置、字体/密度/框架，不再派代理、不推送。root亲自浏览器接受，独立代理审查。先读实际参考图、契约及新鲜FAIL，再最小实现。

## 历史

2026-10-10 root接受S01–S04并关闭05及04滚动重开范围。仅full-workbench-preview.css追加body:has作用域纵向滚动；新[接受/证据/启动](../../../docs/designs/2026-10-08-strategy-visual-system/observe-scroll-20261010.md)。旧FAIL与历史清单不覆盖，无生产推广或远端操作。

2026-10-10 用户认可整体视觉但报告下滑BUG；root复现桌面FAIL，04重新打开仅滚动范围，历史R01–R11接受保留。当前implementation未派发，整页滚动接受FAIL。
