# 评审视觉原型 · 修订07

当前状态：本轮桌面视觉原型已接受。用户2026-10-06确认固定底部操作栏，并要求优先视觉、暂不实现真实代码。

[最终验收](FINAL-ACCEPTANCE.md) · [视觉契约](visual-contract.md) · [逐项设计覆盖](DESIGN-COVERAGE.md) · [原型源码改动前字节](before/manifest.json)

修订固定62px创建操作栏、预览与实际检查层级、五状态实验卡、选择身份、名称/长详情入口，以及A工作台的V/M/R/C信息和事件关闭/来源返回。F16嵌套历史按钮、只读原因截断、图表事件空白等历史失败已修复，失败记录继续保留。

root真实浏览器功能与页面内存旅程、独立源码审查、独立直接视觉比较分别PASS；创建与A仍为独立样例。未接入实际数据/日历/运行能力，刷新重置样例。09/11不关闭，真实接线与持久化门槛仍NOT VERIFIED。

[浏览器记录](reports/browser-acceptance.md) · [独立视觉报告](reports/visual-review.md) · [独立源码报告](reports/source-review.md) · [命令结果](verification.json) · [72张选择帧与版本](freeze.json) · [最终交付检查](delivery-check.json)

## 本地启动

在TradeReview worktree运行：

```sh
python3 .scratch/strategy-portfolio-backtesting/strategy-library-wireframes/build.py
python3 -m http.server 3063 --bind 127.0.0.1 --directory .scratch/strategy-portfolio-backtesting
```

创建视觉稿：[我的实验与四步创建](http://127.0.0.1:3063/strategy-library-wireframes/#f14)

A工作台：[稳定工作台A](http://127.0.0.1:3063/workbench-design/?variant=A)

服务只提供本地静态原型，不访问业务数据库。当前3063服务保持运行；如端口被其他服务占用，选其他端口，不关闭未知服务。最终浏览器检查时间见验收记录。
