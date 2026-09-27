# R10 最终集成检查

2026-09-27，Luna gpt-5.6-luna/max实施，Astra gpt-6-astra/low独立复核，root真实浏览器。整体仍待真实手机软件键盘验收。

## 价格辅助动作

旧right76/top36覆盖入场金色价标（R9-preview-ready.png）；新left76/bottom48位于图表内左下辅助区，复用navy surface，未改变fitPlanPrices和图表/侧栏/顶底栏尺寸。桌面36px，窄屏及pointer:coarse44px（Astra指出宽触屏缺口后已补齐）。

- 默认1280×720测量button x219/y548/w90/h36；[实际点击前](R10-default-before-fit.png)，与右轴标签分离。
- 点击后计划68/56/52全在主图可见，行情与成交截止均未推进。
- 390×844测量x129/y360/w90/h44；[窄屏](R10-fitted-390.png)。与右金色标签分离，位于时间轴上方，工具栏未被挡。
- [1440×900](R10-fitted-1440.png)有鼠标十字线51.92；这不是按钮碰撞。最后鼠标移出后[正常窗口最终图](R10-preview-ready.png)三价完整。
- [R10-browser.json](R10-browser.json)新构建验收期间error=[]。不称宽触屏真实设备已验；coarse44为源码检查。

## 自动化和数据

root独立chart43/43（R10-coordinator-tests.txt），type/lint/build exit0，最终构建runtime5/5（R10-typecheck/lint/build/runtime.txt）。前序R9保存相关root7/7、worker53/53；R7/R6未受影响结果按各报告限定复用，不把历史失败全仓日志改写全绿。

[R10-final-state.json](R10-final-state.json)：原25成交SHA1b79e6e605b493b4e0ce7833094824c807680c972166a83a1a3f0b8aefd12b36不变，quick_check ok。999996正式完成图文、净6760/实际1.69R完整。999999预览计划56/52/68/1000未推进，基线见R9-fresh-preview-state.json，本轮仅fit/resize。

## 本轮补齐的异常链

[R8集成](R8-integration.md)关闭图表销毁异常、实际500保留/重试和旧引用显示；[R9集成](R9-integration.md)关闭真实409显式重载旧输入；[真实PDF重导](R10-real-reimport.md)关闭修订导入→待确认→确认→重开的来源链。各自有Astra独立报告，不由任一局部通过替代全功能接受。

## 运行

最终生产预览 http://127.0.0.1:3049/ ，服务会话64557，当前worktree f7a5，显式repair/acceptance.sqlite；最终真实浏览器已打开并保留。临时3051/3052均停止。启动见../../RUNBOOK.md；业务3022未改，无提交/推送/合并。

结论：当前已发现的实现缺陷均已有修复及限定证据；必需真实手机软件键盘仍unverified，无设备证据/无豁免，故整体integration-pending，不能签署feature accepted。LibreOffice实际PPTX渲染通过，不声称原生Microsoft PowerPoint兼容验收。
