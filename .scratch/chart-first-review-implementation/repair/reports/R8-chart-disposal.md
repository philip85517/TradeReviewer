# R8 图表销毁生命周期修复

日期：2026-09-27  
负责人：Luna 5.6 max  
集成负责人：root  
状态：`integration-pending`（等待 root 的集中 type/lint/build 与真实浏览器复核）

## 触发与根因

root 在 `999996 post → return 库 → 999999 pre → viewport reset` 的切回路径记录到 `lightweight-charts` 的 `Object is disposed`：`resizeCanvasElement → ... → RAF`。页面仍能绘制，但该错误说明旧 chart 实例在销毁后仍有 SDK 更新进入 canvas。

独立 SDK 审查（见 `R8-astra-disposal.md`）确认了调用链：当前 cleanup 先 `chart.remove()`，再对仍持有的 series 调用 `detachPrimitive()`。SDK 的 `detachPrimitive` 会无条件触发 `model.fullUpdate()`，从而在 `remove()` 已取消旧 RAF 后重新排入 RAF；canvas 已 disposed，下一次 resize/render 读取 canvas getter 即抛错。该顺序是直接根因。

同时，effect 内已排队的 ResizeObserver 交付和 visible logical range 的 microtask 没有生命周期屏障，cleanup 后仍可能读取旧 chart。动态 import 创建前已有 `disposed` 判断，保留并沿用。

## 红灯反馈环

先在 `app/components/chart/replay-chart.recall-review.test.tsx` 增加三个定向用例，再运行原实现：

- cleanup 的 detach/remove 顺序断言失败，实际为 `remove → detach`；
- cleanup 后手动交付旧 ResizeObserver，旧实现仍调用 `chart.applyOptions`；
- cleanup 后执行已排 range microtask，旧实现读取已移除 chart（测试 fake engine 记录一次 disposed range read）。

detach 用例模拟 SDK 关键语义：`detachPrimitive` 排 deferred update，`remove` 只取消已有队列；错误顺序会让 detach 在已移除 chart 上留下后续 frame，flush 时记录 `disposed chart update`。

## 实现

仅修改授权范围内的两个文件：

- `app/components/chart/replay-chart.tsx`
  - cleanup 先在活跃 series 上 `detachPrimitive`，再 `chart.remove()`；
  - cleanup 显式退订本实例的 visible logical range listener，并清空 pending range、递增 version，使旧任务失效；
  - ResizeObserver 回调、crosshair 回调和 visible logical range handler 使用 effect-local `disposed` 守卫；
  - visible logical range 的 queued microtask 在访问旧 chart 前再次检查 `disposed` 与 range version；
  - 保留现有 range pending/version 逻辑，不改变 R1 的异步 range 语义。
- `app/components/chart/replay-chart.recall-review.test.tsx`
  - 增加 SDK deferred detach/update 模拟；
  - 增加 cleanup 后旧 ResizeObserver 与 range microtask 的回归测试。

没有新增全局 error 过滤，也没有用 `try/catch` 吞掉 SDK 异常。

## 定向验证

- `npx vitest run app/components/chart/replay-chart.recall-review.test.tsx --maxWorkers=1 --reporter=dot`：22/22 通过；包含既有异步 range/resize 契约及新增 lifecycle 测试。
- `npx vitest run app/components/chart/replay-chart.test.tsx --maxWorkers=1 --reporter=dot`：21/21 通过。
- `git diff --check -- app/components/chart/replay-chart.tsx app/components/chart/replay-chart.recall-review.test.tsx`：通过。
- 未运行 build、full suite 或浏览器；root 负责真实浏览器切回合、viewport reset、390↔1440 resize 与最终错误证据复核。

## 待集成门槛

root 需要在真实浏览器中重复旧回合切换与 viewport reset，确认旧 chart 不再触发 `Object is disposed`，同时确认新回合 chart、绘图 marker、异步 range、More/计划布局继续正常。Astra 的独立 SDK 依据保存在 `R8-astra-disposal.md`。
