# Performance 任务报告

日期：2026-09-21

## 修改路径

- `app/components/dashboard/room-performance.tsx`
  - 趋势线、点、零线、Y 轴刻度与 X 轴刻度统一使用同一组带 padding 的坐标映射。
  - 端点不再贴边；空值保留原始点索引，曲线遇到空值分段，不跨缺口连线。
  - 多币种曲线只从该币种首次出现的期间开始绘制，避免把累计 map 初始化的 0 当作真实点。
  - 悬停、焦点、点击和 Enter/Space 键盘操作使用同一份趋势点详情；详情包含期间收益、累计收益、样本、胜负和日期。
  - 图例仅显示实际绘制的“累计收益”；期间收益留在点详情和趋势数据详情。
  - 选中日历日期后显示汇总金额、可信样本和胜率；范围变化后清理越界日期/趋势点选择，保持趋势/日历视图和日/周/月选择。
  - 窄屏日格显示短日期、盈亏状态和短样本状态，完整金额与统计保留在下方详情。
- `app/components/dashboard/room-performance-chart.ts`
  - 新增专用 chart 几何辅助：domain、padding、点坐标、断点线段、零线、抽样刻度。
- `app/components/dashboard/room-performance.module.css`
  - 图表轴标签使用可读的 CSS 文本层并与 SVG 几何共用坐标；轴标签抽样，未用整页 overflow 隐藏掩盖溢出。
  - 320/390px 日格改用短日期/状态；月/年卡片调整标题、金额、辅助信息字号层级；详情汇总在窄屏改为单列。
- `app/components/dashboard/room-performance.test.tsx`
  - 新增多币种延迟起点、padding/零线/刻度对齐、悬停/焦点/点击一致、2026-02-25 `+¥50,360.44` 汇总详情、范围变化清理选择等行为测试。
- `app/components/dashboard/room-performance-chart.test.ts`
  - 覆盖空值断点不连线及点索引不偏移。
- `app/lib/reviews/trading-room-calendar.ts`
  - 当前 model 与完整历史范围发现分离，all-years 不再隐式替换 month/custom/YTD 的 scope。
- `app/lib/reviews/trading-room-calendar.test.ts`
  - 新增跨年 scope/历史发现、all-years→YTD 汇总、累计末值、末点、custom 越界和默认 today 边界回归。

## 实际测试命令与结果

先以失败测试复现：

```text
npx vitest run app/components/dashboard/room-performance.test.tsx
结果：16 tests，11 passed，5 failed。
失败集中在多币种点索引错配、preserveAspectRatio/padding/刻度缺失、悬停详情缺失、窄屏状态/完整汇总缺失、范围变化后残留日期。
```

最终定向验证：

```text
npx vitest run app/components/dashboard/room-performance.test.tsx app/components/dashboard/room-performance-chart.test.ts
结果：2 个测试文件，18 tests passed，0 failed。
```

```text
git diff --check -- app/components/dashboard/room-performance.tsx app/components/dashboard/room-performance.module.css app/components/dashboard/room-performance.test.tsx app/components/dashboard/room-performance-chart.ts app/components/dashboard/room-performance-chart.test.ts
结果：无输出，检查通过。
```

```text
rg -n "zeroLinePosition|linePath\(|pointCoordinates\(" app/components/dashboard/room-performance.tsx
结果：No legacy chart helper calls
```

Vitest 仅报告 Node 的既有 `module.register()` deprecation warning；没有测试 warning/failure。按任务分工未运行 typecheck/build，交由主协调者集中执行。

## 问题/未完成项

- 先前 640×220 固定 viewBox 方案经 320px 实测未通过：实际 SVG 约 164×56px，圆点约 2px，横轴完整标签重叠，Y 轴标题与金额重叠；该“完成”状态已被本轮反馈推翻。
- 本轮已改为容器宽度驱动 viewBox、固定 190px 绘图高度、短轴标签按宽度抽样、独立竖排 Y 轴标题和透明触控命中区；主协调者仍需 reload 独立浏览器，在 1440/1280/390/320px 复验真实 CSS 尺寸、标签间距、命中区和日历内部是否侵入相邻格子。
- `.dailyGrid` 才使用日号/单字状态/`N笔`紧凑显示；`.periodGrid` 保留月份/年份、完整金额和统计，不应用 daily compact 文本。
- 未修改 `review-dashboard`、`holdings`，未提交、push 或 merge。
- 当前工作树原有其他用户改动保持不变。

## 独立审查 R1/R6/R7 修复

- `app/lib/reviews/trading-room-calendar.ts`：`buildTradingRoomCalendar` 始终尊重传入的当前 scope，包括 month、YTD、近三个月和 custom；新增只读 `findTradingRoomHistoryRange`，仅供发现“全部年份”按钮要跳转的完整历史范围。helper 未传 `asOf` 时使用与 builder 相同的 `roomTodayKey(new Date())`，不被历史 custom 结束日裁剪。
- `app/components/dashboard/room-performance.tsx`：当前 model 与历史范围发现解耦；“全部年份”显式使用完整 history range，外部切到 YTD 后仍可恢复跨年汇总。
- `app/components/dashboard/room-performance.tsx`：用内部 period 请求签名区分组件自身导航与外部 scope 变化；外部本月/YTD/近 3 月变化保留当前 view 但重置 calendar level 为 month，内部全部年份与下钻仍保留目标 level。
- `app/components/dashboard/room-performance.tsx`：周趋势刻度始终显示短起止日，避免同月各周都退化为同一个 `2026-09` 标签。
- `app/components/dashboard/room-performance.tsx`：单一未换算趋势序列使用实际原币种键（例如 USD），仅人民币合计场景使用 CNY。
- 新增回归覆盖：默认本月→全部年份、外部 YTD/本月/近 3 月→month、全部年份恢复、范围外 custom 不越界、默认 today 历史发现，以及同月自然周刻度、单 USD 无 FX 序列。

## 本轮修复后的状态

代码与定向行为测试已更新，浏览器验收尚未由本任务完成；因此本报告不把本轮标记为最终 UI 验收完成，等待主协调者复验后再更新最终完成声明。

本轮新增/更新覆盖：

- 容器宽度与固定可读绘图高度的响应式 viewBox；坐标、刻度和零线仍共用 geometry。
- 轴标签短化（如 `09-02`、`09月`、周范围）并按窄宽抽样为 2/3/4 个。
- 可见圆点与半径更大的透明点命中区分离，悬停/焦点/点击详情保持一致。
- 320px 日格仅显示日号、单字盈亏状态和最多 `N笔`；2026-02-25 详情仍保留完整 `+¥50,360.44`、样本数和胜率。

集成反馈修复：`room-performance-chart.ts` 的 geometry options 已从 `as const` 字面量 Partial 改为宽泛的 number padding 输入，解除 `room-performance.tsx` 的 3 个 padding typecheck 错误。修复后再次运行定向测试：2 个文件、21 tests passed；定向 `git diff --check` 无输出。typecheck/build 仍留给主协调者集中执行。

最新真实路径修复：ResizeObserver 已从依赖 `effect[]` 改为稳定 callback ref。初始空样本没有 `chartStage` 时不再丢失 observer；后续空→有趋势图、日历/趋势切换挂载图表时会重新测量容器宽度。新增回归覆盖 320px 宽度挂载路径；最终定向测试为 2 个文件、22 tests passed。typecheck/build 仍留给主协调者集中执行。

最新窄屏收缩：移除 `.chartAxisLayout` 的 52px 独立列及可视“纵轴/横轴”标题，chartStage 使用整块可用宽度；金额刻度、日期刻度和 SVG 图表仍保留 aria 标签，geometry 左 padding 继续为金额刻度预留空间。最终定向测试仍为 2 个文件、22 tests passed，`git diff --check` 通过。

最终 320px 几何修正：最长 Y 轴金额标签曾从图框左边界伸出；geometry 的 `padding.left` 已保守固定为 72px，320px callback-ref 回归断言验证左 padding 达到约 22.5%（不再使用 34px）。最终定向测试：2 个文件、22 tests passed；`git diff --check` 通过。

独立审查 R1/R6/R7 定向回归：

```text
npx vitest run app/lib/reviews/trading-room-calendar.test.ts app/components/dashboard/room-performance.test.tsx app/components/dashboard/room-performance-chart.test.ts
结果：3 个测试文件，36 tests passed，0 failed。
```

```text
git diff --check -- app/lib/reviews/trading-room-calendar.ts app/lib/reviews/trading-room-calendar.test.ts app/components/dashboard/room-performance.tsx app/components/dashboard/room-performance.test.tsx
结果：无输出，检查通过。
```

本任务未运行 typecheck/build，按分工留给主协调者；浏览器最终验收仍由主协调者独立 reload 后完成。

最新 R1 状态行为回归：外部期间变化会保留趋势/日历 view 并重置 calendar level；组件内部 period 导航通过签名匹配保留 all-years/year/month 目标层级。定向测试仍为 3 个文件、36 tests passed。
