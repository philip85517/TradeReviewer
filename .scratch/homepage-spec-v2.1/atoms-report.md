# V2.1 原子控件修订报告

状态：implementation-ready；等待独立审查。

范围是 F01、F07、F11 的静态设计修订。本包包含一个生成器、11 张独立组件画板、几何 token 画板和机器可读状态合同；不修改产品、冻结的 V2 生成器或 V2.1 页面/旅程文档。

## 覆盖

- 11 张组件画板：`docs/design-system/baselines/2026-10-17-homepage-v2.1/images/atom-*.svg`。
- 8 states per board: default, hover, focus, pressed, disabled, loading, empty, error.
- JSON 共 88 格：78 格适用，10 格明确 N/A 并记录原因。N/A 集合精确为：IconButton/SegmentedTabs/RetryAction 的 empty；Token/Metric/StatusBadge/ChartTooltip/EmptyState 的 disabled；Metric 的 pressed；EmptyState 的 loading。
- 复杂控件使用真实几何：DataTable 为表头 40px、8 行各 48px、分页 48px 的 8 槽表格，总表面高度 520px；Metric 高 88px；Popover 宽 360px；ChartTooltip 为 264×112（超过 192×80 最低要求）；EmptyState 为 300×120。
- 每个适用格都记录精确尺寸、触发、反馈、退出、键盘路径和失败/恢复行为；JSON 还记录视觉与命中几何及 SVG 证据锚点。

## F07/F11 决定

正式字体为系统字体栈 `ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`，中文使用平台回退，数值使用等宽数字。Web Sans 因没有字体文件仍是理论候选，明确不纳入字形比较证据。

几何画板记录 4/8/12/16/24/32px 间距、6/8px 圆角、2px 焦点环及 2px 外偏移，并区分视觉包络与交互边界。Token 视觉高 24px、命中高 36px；RetryAction 视觉高 32px、命中高 36px；其他桌面动作目标使用 36px。

## 验证

Command:

```text
python3 docs/design-system/baselines/2026-10-17-homepage-v2.1/build-atom-revision.py
```

结果：成功。后续 JSON 检查报告 `entries=88`、`applicable=78`、`na=10`、`svg boards=11`，必填合同字段无缺失。已检查生成 SVG 的 viewBox、标签和结构；浏览器/产品交互及独立视觉比较仍须由协调者/审查者完成，当前为 NOT VERIFIED。

## 注意事项

画板是文档样本，不声明运行时键盘、指针、动画、持久化或浏览器通过。生成器有意使用已批准的系统字体声明，精确字形光栅化仍取决于审查平台。协调者应在最终 HP08 正文中链接这些画板，并保留功能与视觉两条独立验收门槛。
