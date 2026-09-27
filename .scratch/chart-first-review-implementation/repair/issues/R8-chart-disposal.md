# R8 — 回合切换和尺寸变化后不再绘制已销毁图表

ID: chart-first-repair-R8
State: closed
Status: accepted
Assignee: luna_r7_layout (gpt-5.6-luna / max)
集成负责人: root；独立验收 astra_r7_acceptance (gpt-6-astra / low)

## Scope 与依据

E04/E09/E20 图表生命周期安全；原始需求的回看、保存重开和响应式行为。沿用主规格、元素表及02/07画板，不修改批准设计。仅允许 replay-chart.tsx 及相关图表生命周期测试；不得破坏R1异步视野/下一根揭示契约。

## 真实反例

2026-09-27 06:13:20 Asia/Shanghai，生产3049、repair/acceptance.sqlite、CUA tab3：999996事后回到交易库，进入999999买入前并恢复视口过程中，控制台出现 `Error: Object is disposed`。堆栈为 lightweight-charts `resizeCanvasElement → chart draw → requestAnimationFrame`，页面仍绘制。重新按390→回库→打开999999→1440操作一次没有新增同类日志，不能因此抹去第一次错误。

当前嫌疑：cleanup先chart.remove后series.detachPrimitive；同时已排队ResizeObserver/range微任务仍有旧chart引用。必须通过SDK真实调用链与保持异步语义的测试确认，不通过catch吞异常或过滤console。

## 接受标准

- [ ] 所有订阅和primitive在chart销毁前清理，不在已销毁chart上重新排绘制。
- [ ] 已排队旧回调在cleanup后不再读写chart，重开新实例不受旧回调影响。
- [ ] 回放/resize/返回早期受影响定向测试通过；原始红日志保留。
- [ ] 最新构建实际回合切换及resize无新增disposed错误，真实图表仍正确。
- [ ] root复验+Astra独立审查完成，数据摘要不变。

## 证据

待报告 `../reports/R8-chart-disposal.md`、`../reports/R8-astra-disposal.md` 及root浏览器记录。R7 More与三阶段布局局部通过继续有效，整体仍未接受；真机软件键盘仍unverified。

## 协调者限定接受（2026-09-27）

仅本生命周期缺陷接受。root最终构建真实切回合/resize无新增异常，43项图表及runtime5项通过；Astra独立核对。见[集成证据](../reports/R8-integration.md)。整体仍受R9与未验证项阻塞。
