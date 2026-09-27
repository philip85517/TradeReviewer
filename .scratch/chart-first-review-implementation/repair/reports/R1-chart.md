# R1 chart implementation report

日期：2026-09-26  
范围：`ReplayChart` 回放视野、E07 成交标记、canonical capture 的成交标记一致性。

## 具体变更

- `ReplayChart` 接受可选 `revealRequest: { id, time }`。请求只在对应 id 第一次成功定位时消费；目标数据尚未进入传入的已揭示 candles 时保留请求，待数据更新后重试。主动请求按当前逻辑范围平移，保留时间跨度；初次挂载的空范围从已揭示 `focusRange` 或已知 candles 建立，避免先 fit 成单根 K 后被普通 fit 覆盖。
- 普通 `setData`、元数据刷新、resize 和侧栏重渲染继续保存原逻辑/时间范围。主动请求才会推进范围。`autoScale: false` 的价格窗只按目标已揭示 candle 或已揭示成交价扩展，不扫描未来 candles。
- 没有完整 K 线但已经揭示的、有真实秒级成交时间和有限成交价的执行，使用实际 `executedAt` 注册为 lightweight-charts candlestick 的 `{time}` whitespace 点，再按真实时间轴绘制。不会构造未完成 OHLC，也不会映射到上一根已完成 K；日期-only、下单时间、暗盘或未知价格继续不创建时间轴标记。
- 新增 `app/lib/chart/marker-geometry.ts`，由 live 与 capture 共同构造去重排序时间轴并投影 marker 时间。已知真实时间点走精确轴坐标；只有已知点之间允许插值，末端不估计交易 cadence。单 K 加有效成交可形成两个真实轴点；单 K 加未知时间明确不可投影。
- E07 改用 lightweight-charts primitive 的真实坐标覆盖层，绘制实心菱形和动作文字；同 K 的每笔成交都有独立 marker、稳定横向偏移、按 side 纵向 22px 分槽和独立 `executionIds`，买/卖/买与 600/400 的顺序、文字可读性和点击身份不会被 side 聚合覆盖。成交动作根据显式 long/short effect、稳定成交序和已知数量推导，未知数量或未确认方向不会声称“清仓”。primitive 提供 `autoscaleInfo`，主动 reveal 的手动价格窗会纳入截至 cutoff 的最新已揭示成交事实价，普通刷新不改价格窗。新增可选 `onExecutionSelect(executionId)`，只接受当前已揭示 marker ID；live/capture painter 与 hit-test 共享横纵偏移。
- `canonical-chart-capture.ts` 导出同一 `drawExecutionMarkers` painter。交互图和截图都使用相同实心菱形、文字、偏移和真实 whitespace 时间投影，marker capture 不再回退到旧 K。
- 回放推进修复了 cutoff 与 K 轴坐标的边界：`revealRequest.time` 是该根 K 的知识截止/收盘时刻，可能晚于轴上登记的 K 开盘时刻。主动导航现在以 cutoff 对应的最后已知 K 的真实 `time` 为必选锚点，并与截至 cutoff 已登记的成交事实点取最晚目标；只有 cutoff 自身是显式 whitespace 轴点时才使用它，不会外推到未来 K。连续追加十几根、最后一次没有新成交的播放仍会逐根前移并保持跨度。
- 回放返回早期数据时，`logicalRangeForUpdatedCandles` 不再把旧视野两端都 nearest 到最后一根而压缩成两根巨宽 K。若映射后的跨度小于旧跨度，保留最新已知时间锚点（含 fractional right padding）并平移原跨度；随后新的 reveal target 仍可在这段稳定窗口上主动平移。forward append、prepend history 和普通刷新保持原有映射。
- 共享 marker painter 在 live 使用 pane 宽度、capture 使用同一投影宽度；当右侧标签会进入价格轴时，把文字移到菱形左侧，避免“卖出”等动作标签被右轴裁掉。
- 同 K 的最后一笔成交若带 `offsetX: +18` 越过 plot pane 右缘，新增 `markerDisplayGeometry` 以 pane 内 anchor 为条件 clamp diamond 的实际中心；offscreen anchor 不吸附到边缘。live painter、canonical capture 和 primitive hit-test 共用该几何，因此 diamond、文字和可点击区域保持同一实际位置，逐笔 ID 与 22px lane 不变。

## 红绿与验证

修复前的定向基线为 3 个 chart/capture 文件、25 项通过；根因症状是主动追加数据仍恢复旧 viewport。先加入主动 reveal、固定价格窗、marker click、未知库存和 whitespace 成交的回归断言，再实现上述行为。随后针对 Astra C1–C3 先加入红测：primitive autoscale、同 K 600/400 逐笔动作/偏移、cutoff 与 execution time 不相等时的事实价、真实时间轴跨日期 gap/capture/single-K。

最终命令及结果（上一阶段 marker/reveal/rewind 修复）：

```text
npx vitest run app/lib/chart/marker-geometry.test.ts app/components/chart/replay-chart.test.tsx app/components/chart/replay-chart.recall-review.test.tsx app/components/chart/canonical-chart-capture.test.ts --maxWorkers=1 --reporter=dot
4 files passed, 48 tests passed

npx tsc --noEmit --pretty false
exit 0

npx eslint app/lib/chart/marker-geometry.ts app/lib/chart/marker-geometry.test.ts app/components/chart/replay-chart.tsx app/components/chart/replay-chart.test.tsx app/components/chart/replay-chart.recall-review.test.tsx app/components/chart/canonical-chart-capture.ts app/components/chart/canonical-chart-capture.test.ts
exit 0
```

覆盖的回归包括：保持当前时间跨度推进到新 K、初次空范围与 focusRange、手动价格窗纳入新价格、cutoff 后 execution fact price、真实 whitespace 轴点、跨交易日 gap 的统一投影、单 K 无 cadence 外推、同 K 多笔逐笔身份/横纵分槽与动作文本、未知数量不误报清仓、仅已揭示 marker 可点击、屏幕/捕获共享 painter，以及 primitive autoscale 价格扩展。

本次先进播放症状先用红测复现：连续 reveal 的 cutoff 晚于每根 K 的开盘时间时，旧实现第一步保持 `to=1.5`，没有达到新 K 的逻辑位置。绿化后同一用例连续推进第 3 至第 15 根 K，并在第 3 根加入最后一笔成交、之后继续无新成交推进；每步都达到目标索引且时间跨度不变，在同一轮定向命令中与既有 43 项断言共同通过。卖出标签右轴裁切也新增共享 painter 的边界测试并通过。

本次返回早期视野先用红测复现：旧窗口 `{from: 6.25, to: 9.25}` 收缩到前 4 根已知 K 后，映射结果跨度降为 `0.25`；修复后保留 `3` 的 span 与 `{from: 0.25, to: 3.25}` 锚点，再 forward reveal 到完整数据末端得到 `{from: 6, to: 9}`。该回归覆盖 rewind → return → forward 连串，未改变主动 targetcandle 推进逻辑。

本轮 ResizeObserver 时序先用真实轻量图表语义的异步 setter 红测复现：`setVisibleLogicalRange` 只排下一次 paint，height-only ResizeObserver 随后读取旧 range 并回写，导致 reveal 的末根 K 被旧窗口覆盖；restore 与同帧 width resize 也会被旧 getter 覆盖。绿化后 `ReplayChart` 以组件持有的 pending logical range 为单一权威，width resize 在 `applyOptions` 前取 stable/pending range 并只对 width 变化重申，height-only 不再写时间范围；range-change 回调只在实际提交或用户导航后清理 pending。测试 mock 还让 `applyOptions({ width })` 先改变底层 range，确认恢复的是 resize 前窗口而非 applyOptions 后 getter 的值。新增三条定向回归分别覆盖末根 reveal + height resize、restore + width resize 同帧、以及无 pending 时纯 width resize 保窗。

本轮真实浏览器诊断又复现一个独立的末根边界：`setData` 立即让 LWC getter 从 `27..60` 暂时变为 `28..61`，但 data effect 已排队的 preservation range 仍是 `27..60`；reveal 读取暂态 getter，误判目标 logical 61 已在视野并跳过 request，最终 queued preservation 把末根推到右侧外。修复后 reveal 以 pending logical range 优先计算当前/seed range，主动目标会覆盖 data preservation。新增回归模拟该即时 getter shift + 异步 queued preservation + reveal 同帧。

本轮最新定向命令及结果：

```text
npx vitest run app/components/chart/replay-chart.recall-review.test.tsx -t "setData shifts the getter|height resize races|same-frame width resize|stable range on a width" --maxWorkers=1 --reporter=verbose
1 file passed, 4 tests passed, 13 skipped

npx vitest run app/components/chart/replay-chart.test.tsx app/components/chart/replay-chart.recall-review.test.tsx app/components/chart/canonical-chart-capture.test.ts app/lib/chart/marker-geometry.test.ts --maxWorkers=1 --reporter=dot
4 files passed, 52 tests passed

npx tsc --noEmit --pretty false
exit 0

npx eslint app/components/chart/replay-chart.tsx app/components/chart/replay-chart.recall-review.test.tsx app/components/chart/canonical-chart-capture.ts app/components/chart/canonical-chart-capture.test.ts app/lib/chart/marker-geometry.ts app/lib/chart/marker-geometry.test.ts
exit 0

git diff --check
exit 0
```

本次 C2 边界先用红测复现：同 K `清仓` marker 的 `offsetX: +18` 使 diamond 超出 `maxX`，hit-test 仍按未修正位置计算。绿化后共享几何将中心 clamp 到 `maxX - radius`，diamond 右顶点落在 pane 边界内，capture 绘制与 live hit-test 命中同一中心；边界、offscreen 保持和命中回归均通过。

## 限制与待验收项

- 本轮没有启动真实浏览器或生成新的 1440 截图；root/Astra 仍需用真实 lightweight-charts 验证同 K 清仓 diamond 完整落在 pane 内且可点击、holding→pre-entry 返回后的实际 K 数、阶段 viewport restore 时序、连续播放至 Sep24 的视野前移、首买 Aug10 whitespace marker 位于实际时间右侧、以及 RO 修复后的末根可见、回早期窗口和 width-only 保窗。单元测试已覆盖 live/capture/hit-test 共同 marker 几何、`{time}` 数据构造、连续 cutoff 导航、收缩后往返和真实 LWC 异步 setter 语义，真实浏览器仍是最终坐标证据。
- 同 K 不再聚合成单一可点击 marker；每笔成交有独立身份。多个成交决策的更高层 decision 映射仍由 state owner 的 `onExecutionSelect` 回调处理。
- 未执行全量 build、全量单元测试或跨浏览器验证；本报告仅覆盖 R1 chart/capture 范围。
- 当前 `npx tsc --noEmit --pretty false` exit 0；scoped ESLint 与 `git diff --check` 也通过。本轮没有把此前阶段类型迁移中的中间阻断状态计入当前验证。
