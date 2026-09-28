# 01 控件密度、比例与共享实现诊断

State: closed
Status: accepted
Assignee: coordinator
集成负责人: coordinator
Blocked by: 无；原阻塞已通过用户授权Playwright、本机依赖补齐解决

## What to build / Scope

诊断用户四张截图中的控件视觉问题，检查底层代码复用；不修改产品实现。

## Refs

用户2026-09-27四张截图；当前代码1e4921f；[诊断记录](../README.md)。

## 验收

- [x] 静态组件/样式来源检查，证据见诊断记录。
- [x] 当前代码匹配截图数据状态的真实浏览器复现，见 [证据](../DIAGNOSIS.md)。
- [x] 可运行红灯命令与输出，见 [日志](../repro.log)。
- [x] 最小复现及单变量验证，见 [实验](../audit-results.json)。

## 反例与证据

持仓迷你图默认保留SVG比例，不能因为容器高度27px就认定图形被非等比压缩。表格td height不是最大高度。3033属于其他工作树，不能替代当前代码验收。详细环境与证据见诊断记录。

诊断 accepted 不表示产品修复 accepted；两个SVG比例检查仍FAIL。原受阻记录保留于README。
