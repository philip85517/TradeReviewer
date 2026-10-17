# V2.1 原子控件合同

本包修复文档基线中的 F01/F07/F11。每张画板都绘制真实结构，不再使用状态矩阵占位框。

## 几何与字体

- 正式字体：`ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`；中文使用平台回退，数字使用 `font-variant-numeric: tabular-nums`。
- Web Sans 只是理论候选。仓库没有字体文件，因此不纳入字形比较证据。
- 间距 token：4、8、12、16、24、32px。圆角：小控件 6px、面板/浮层 8px。焦点环 2px，外偏移 2px。
- `visible_geometry` 是视觉绘制包络，`hit_geometry` 是键盘/指针命中区。Token 视觉高 24px、命中高 36px；RetryAction 视觉高 32px、命中高 36px；StatusBadge 视觉高 24px、命中高 36px。三者都是明确例外。

## 状态覆盖

合同共有 88 格：78 格适用，10 格明确 N/A。N/A 原因同时保存在 JSON 与对应画板。

| 控件 | 画板 | 默认几何 |
|---|---|---|
| IconButton | [atom-iconbutton.svg](images/atom-iconbutton.svg) | 视觉 36×36；命中 36×36 |
| SegmentedTabs | [atom-segmentedtabs.svg](images/atom-segmentedtabs.svg) | 视觉 244×36；命中 244×36 |
| Select | [atom-select.svg](images/atom-select.svg) | 视觉 180×36；命中 180×36 |
| Popover | [atom-popover.svg](images/atom-popover.svg) | 视觉 360×132；命中 360×132 |
| Token | [atom-token.svg](images/atom-token.svg) | 视觉 104×24；命中 104×36 |
| Metric | [atom-metric.svg](images/atom-metric.svg) | 视觉 276×88；命中 276×88 |
| StatusBadge | [atom-statusbadge.svg](images/atom-statusbadge.svg) | 视觉 124×24；命中 124×36 |
| DataTable | [atom-datatable.svg](images/atom-datatable.svg) | 视觉 620×520；命中 620×520 |
| ChartTooltip | [atom-charttooltip.svg](images/atom-charttooltip.svg) | 视觉 264×112；命中 264×112 |
| EmptyState | [atom-emptystate.svg](images/atom-emptystate.svg) | 视觉 300×120；命中 300×120 |
| RetryAction | [atom-retryaction.svg](images/atom-retryaction.svg) | 视觉 110×32；命中 110×36 |

## 逐态合同明细

下表覆盖 88 格；N/A 也保留原因。每个适用状态都写出该状态自己的触发、反馈、退出、键盘路径和失败/恢复行为。

| 控件 / 状态 | 适用 | 尺寸 | 触发 | 反馈 | 退出 | 键盘 | 失败 / 恢复 |
|---|---:|---|---|---|---|---|---|
| IconButton · 默认 (default) | 是 | 36x36 visible; 36x36 hit | 查看详情图标动作：进入页面或恢复默认值 | 查看详情图标动作：显示稳定默认内容与可操作边界 | 查看详情图标动作：激活、悬停或聚焦进入下一状态 | Tab 到达；Enter/Space 激活 | 查看详情图标动作：数据缺失显示明确占位并保留上下文 |
| IconButton · 悬停 (hover) | 是 | 36x36 visible; 36x36 hit | 指针进入按钮；立即 120ms 高亮，tooltip 仅延迟 300ms | 按钮立即变亮；300ms 后显示 tooltip | 指针离开按钮或 tooltip 关闭 | 键盘不依赖 hover；Tab 可进入同一动作 | 错误 tooltip 显示原因；保持动作可重试 |
| IconButton · 聚焦 (focus) | 是 | 36x36 visible; 36x36 hit | 查看详情图标动作：Tab 或 Shift+Tab 将焦点移入 | 查看详情图标动作：显示 2px 焦点环与当前值，焦点可见 | 查看详情图标动作：Tab 离开、Enter/Space 激活或 Esc 取消 | Tab/Shift+Tab 移动；Esc 取消 | 查看详情图标动作：焦点环不遮挡内容；失败后焦点留在原控件 |
| IconButton · 按下 (pressed) | 是 | 36x36 visible; 36x36 hit | 查看详情图标动作：指针按下并完成 click，或按 Enter/Space | 查看详情图标动作：显示 pressed 反馈并提交一次动作 | 查看详情图标动作：动作完成、取消或返回稳定状态 | Enter/Space 只提交一次；Esc 取消未提交动作 | 查看详情图标动作：重复提交被锁住；失败恢复默认并保留错误原因 |
| IconButton · 禁用 (disabled) | 是 | 36x36 visible; 36x36 hit | 查看详情图标动作：权限、不可用数据或父级表单明确设置禁用 | 查看详情图标动作：降低对比度且不响应指针/键盘激活 | 查看详情图标动作：权限恢复或父级表单重新启用 | Tab 跳过；Enter/Space 不产生动作 | 查看详情图标动作：禁用原因必须由相邻文案说明，不伪造成功 |
| IconButton · 加载 (loading) | 是 | 36x36 visible; 36x36 hit | 点击查看动作后请求 pending | 显示旋转环与更新中；锁定重复点击 | 请求完成或错误 tooltip 出现 | Tab 保持顺序；Enter/Space 在 pending 期间不重复提交 | 超时保留按钮；错误 tooltip 提供重新查看入口 |
| IconButton · 空 (empty) | N/A | N/A | 不渲染 | 不渲染 | 不渲染 | 不适用 | 图标动作始终有明确动作名；没有空 payload 状态 |
| IconButton · 错误 (error) | 是 | 36x36 visible; 36x36 hit | 查看动作返回错误 | 显示错误图标与原因 tooltip | 关闭 tooltip 或再次激活查看 | Tab 到错误说明与重试；Enter/Space 重试；Esc 关闭说明 | 错误原因保留；再次激活重新请求 |
| SegmentedTabs · 默认 (default) | 是 | 244x36 visible; 244x36 hit | 分段选择（方向键切换）：进入页面或恢复默认值 | 分段选择（方向键切换）：显示稳定默认内容与可操作边界 | 分段选择（方向键切换）：激活、悬停或聚焦进入下一状态 | Tab 到达；方向键/Home/End 选择；Enter/Space 提交 | 分段选择（方向键切换）：数据缺失显示明确占位并保留上下文 |
| SegmentedTabs · 悬停 (hover) | 是 | 244x36 visible; 244x36 hit | 指针进入单一分段；立即 120ms 高亮目标段 | 仅目标段 hover 边框/底色变化，选中段保持选中 | 指针离开目标段 | 键盘不依赖 hover；Tab 到达后方向键切换 | 不提交、不改变选中段；离开后恢复 |
| SegmentedTabs · 聚焦 (focus) | 是 | 244x36 visible; 244x36 hit | 分段选择（方向键切换）：Tab 或 Shift+Tab 将焦点移入 | 分段选择（方向键切换）：显示 2px 焦点环与当前值，焦点可见 | 分段选择（方向键切换）：Tab 离开、Enter/Space 激活或 Esc 取消 | 方向键/Home/End 移动；Enter/Space 提交；Esc 取消 | 分段选择（方向键切换）：焦点环不遮挡内容；失败后焦点留在原控件 |
| SegmentedTabs · 按下 (pressed) | 是 | 244x36 visible; 244x36 hit | 分段选择（方向键切换）：指针按下并完成 click，或按 Enter/Space | 分段选择（方向键切换）：显示 pressed 反馈并提交一次动作 | 分段选择（方向键切换）：动作完成、取消或返回稳定状态 | Enter/Space 只提交当前分段；Esc 取消 | 分段选择（方向键切换）：重复提交被锁住；失败恢复默认并保留错误原因 |
| SegmentedTabs · 禁用 (disabled) | 是 | 244x36 visible; 244x36 hit | 分段选择（方向键切换）：权限、不可用数据或父级表单明确设置禁用 | 分段选择（方向键切换）：降低对比度且不响应指针/键盘激活 | 分段选择（方向键切换）：权限恢复或父级表单重新启用 | Tab 跳过；方向键与 Enter 不产生选择 | 分段选择（方向键切换）：禁用原因必须由相邻文案说明，不伪造成功 |
| SegmentedTabs · 加载 (loading) | 是 | 244x36 visible; 244x36 hit | 点击分段后请求 pending | 保留旧选中段并显示请求中标记 | 请求成功切换，或失败回滚旧段 | 方向键可读当前分段；Enter/Space 在 pending 期间不重复提交 | 迟到响应按 generation 丢弃；失败显示回滚原因 |
| SegmentedTabs · 空 (empty) | N/A | N/A | 不渲染 | 不渲染 | 不渲染 | 不适用 | 分段组始终至少包含一个分段 |
| SegmentedTabs · 错误 (error) | 是 | 244x36 visible; 244x36 hit | 分段请求失败 | 保留旧选中段并显示失败文案 | 按方向键重新选段或再次 Enter 提交 | Tab 到错误文案；方向键恢复旧分段；Enter 重试 | 迟到响应丢弃；失败回滚到旧段 |
| Select · 默认 (default) | 是 | 180x36 visible; 180x36 hit | 账户选择菜单：进入页面或恢复默认值 | 账户选择菜单：显示稳定默认内容与可操作边界 | 账户选择菜单：激活、悬停或聚焦进入下一状态 | Tab 到达；Enter/Space 打开菜单；方向键选项 | 账户选择菜单：数据缺失显示明确占位并保留上下文 |
| Select · 悬停 (hover) | 是 | 180x36 visible; 180x36 hit | 指针进入选择框；立即 120ms 高亮 | 选择框底色变化，不打开菜单 | 指针离开选择框或点击打开 | 键盘不依赖 hover；Tab 后 Enter 打开菜单 | 值保持不变 |
| Select · 聚焦 (focus) | 是 | 180x36 visible; 180x36 hit | 账户选择菜单：Tab 或 Shift+Tab 将焦点移入 | 账户选择菜单：显示 2px 焦点环与当前值，焦点可见 | 账户选择菜单：Tab 离开、Enter/Space 激活或 Esc 取消 | 方向键移动菜单选项；Enter 选择；Esc 返回触发器 | 账户选择菜单：焦点环不遮挡内容；失败后焦点留在原控件 |
| Select · 按下 (pressed) | 是 | 180x36 visible; 180x36 hit | 账户选择菜单：指针按下并完成 click，或按 Enter/Space | 账户选择菜单：显示 pressed 反馈并提交一次动作 | 账户选择菜单：动作完成、取消或返回稳定状态 | 方向键移动；Enter 选择账户；Esc 关闭菜单 | 账户选择菜单：重复提交被锁住；失败恢复默认并保留错误原因 |
| Select · 禁用 (disabled) | 是 | 180x36 visible; 180x36 hit | 账户选择菜单：权限、不可用数据或父级表单明确设置禁用 | 账户选择菜单：降低对比度且不响应指针/键盘激活 | 账户选择菜单：权限恢复或父级表单重新启用 | Tab 跳过；Enter/Space 不打开菜单 | 账户选择菜单：禁用原因必须由相邻文案说明，不伪造成功 |
| Select · 加载 (loading) | 是 | 180x36 visible; 180x36 hit | 账户列表请求 pending | 显示加载账户中与旋转 cue，保留当前值 | 请求完成打开可选项，或显示错误重试 | Tab 保持选择顺序；Enter/Space 在加载期间不重复打开 | 失败保留旧值并保持重试按钮可达 |
| Select · 空 (empty) | 是 | 180x36 visible; 180x36 hit | 账户列表为空 | 显示暂无可选账户与导入账户 CTA | 点击/Enter 导入账户，或 Esc 返回 | Tab 到导入账户 CTA；Enter 执行导入；Esc 返回 | 导入失败保留空原因与 CTA |
| Select · 错误 (error) | 是 | 180x36 visible; 180x36 hit | 账户列表读取失败 | 保留当前值、错误文案和重试按钮 | 点击/Enter 重试，或 Esc 返回 | Tab 到重试；Enter/Space 重试；Esc 返回旧值 | 重试失败保持旧值与重试入口 |
| Popover · 默认 (default) | 是 | 360x132 visible; 360x132 hit | 标的搜索浮层：进入页面或恢复默认值 | 标的搜索浮层：显示稳定默认内容与可操作边界 | 标的搜索浮层：激活、悬停或聚焦进入下一状态 | Tab 到触发器；Enter 打开并聚焦搜索字段 | 标的搜索浮层：数据缺失显示明确占位并保留上下文 |
| Popover · 悬停 (hover) | 是 | 360x132 visible; 360x132 hit | 指针进入触发器；立即 120ms 高亮，浮层不因 hover 自动打开 | 触发器高亮；点击后才打开 360px 浮层 | 指针离开或点击外部 | 键盘不依赖 hover；Tab 到触发器后 Enter 打开 | 外部点击关闭且不改草稿 |
| Popover · 聚焦 (focus) | 是 | 360x132 visible; 360x132 hit | 标的搜索浮层：Tab 或 Shift+Tab 将焦点移入 | 标的搜索浮层：显示 2px 焦点环与当前值，焦点可见 | 标的搜索浮层：Tab 离开、Enter/Space 激活或 Esc 取消 | Tab 循环搜索与结果；Shift+Tab 回触发器；Esc 关闭 | 标的搜索浮层：焦点环不遮挡内容；失败后焦点留在原控件 |
| Popover · 按下 (pressed) | 是 | 360x132 visible; 360x132 hit | 标的搜索浮层：指针按下并完成 click，或按 Enter/Space | 标的搜索浮层：显示 pressed 反馈并提交一次动作 | 标的搜索浮层：动作完成、取消或返回稳定状态 | Enter 提交搜索；Esc 关闭浮层 | 标的搜索浮层：重复提交被锁住；失败恢复默认并保留错误原因 |
| Popover · 禁用 (disabled) | 是 | 360x132 visible; 360x132 hit | 标的搜索浮层：权限、不可用数据或父级表单明确设置禁用 | 标的搜索浮层：降低对比度且不响应指针/键盘激活 | 标的搜索浮层：权限恢复或父级表单重新启用 | Tab 跳过不可用触发器；Enter 不打开 | 标的搜索浮层：禁用原因必须由相邻文案说明，不伪造成功 |
| Popover · 加载 (loading) | 是 | 360x132 visible; 360x132 hit | 搜索提交后请求 pending | 搜索字段保留草稿并显示查询中 cue | 请求完成更新结果，或显示错误重试 | Tab 保持搜索字段；Enter 在 pending 期间不重复查询 | 失败保留草稿与重试按钮 |
| Popover · 空 (empty) | 是 | 360x132 visible; 360x132 hit | 搜索无匹配结果 | 显示没有匹配结果与清除搜索动作 | 清除搜索、改写查询或点击外部关闭 | Tab 到清除搜索；Enter 清除；Esc 返回触发器 | 清除失败保留原查询和空原因 |
| Popover · 错误 (error) | 是 | 360x132 visible; 360x132 hit | 搜索校验失败 | 保留草稿、错误原因和重试按钮 | 重试、Esc 关闭或点击外部关闭；非模态可退出 | Tab 到重试；Enter/Space 重试；Esc 关闭错误 | 失败不改变已提交范围；外部点击可关闭 |
| Token · 默认 (default) | 是 | 104x24 visible; 104x36 hit | ETF 删除命中区：进入页面或恢复默认值 | ETF 删除命中区：显示稳定默认内容与可操作边界 | ETF 删除命中区：激活、悬停或聚焦进入下一状态 | Tab 到 36px 删除命中区；Enter/Space 删除 | ETF 删除命中区：数据缺失显示明确占位并保留上下文 |
| Token · 悬停 (hover) | 是 | 104x24 visible; 104x36 hit | 指针进入删除命中区；立即 120ms 高亮 | 仅删除图标变红/高亮，token 文本保持 | 指针离开命中区 | 指针进入删除命中区；键盘仍由 Tab 到达 | 不提交删除 |
| Token · 聚焦 (focus) | 是 | 104x24 visible; 104x36 hit | ETF 删除命中区：Tab 或 Shift+Tab 将焦点移入 | ETF 删除命中区：显示 2px 焦点环与当前值，焦点可见 | ETF 删除命中区：Tab 离开、Enter/Space 激活或 Esc 取消 | Tab 到删除区；Enter/Space 删除；Esc 取消 | ETF 删除命中区：焦点环不遮挡内容；失败后焦点留在原控件 |
| Token · 按下 (pressed) | 是 | 104x24 visible; 104x36 hit | ETF 删除命中区：指针按下并完成 click，或按 Enter/Space | ETF 删除命中区：显示 pressed 反馈并提交一次动作 | ETF 删除命中区：动作完成、取消或返回稳定状态 | Enter/Space 只删除一次；Esc 取消 | ETF 删除命中区：重复提交被锁住；失败恢复默认并保留错误原因 |
| Token · 禁用 (disabled) | N/A | N/A | 不渲染 | 不渲染 | 不渲染 | 不适用 | 已提交 token 可移除；权限应禁用父级表单 |
| Token · 加载 (loading) | 是 | 104x24 visible; 104x36 hit | 点击删除后删除请求 pending | 保留 ETF token 并显示 pending 反馈 | 删除成功移除，或失败恢复 token | Tab 保持顺序；Enter/Space 在删除 pending 期间不重复提交 | 锁定重复删除；失败恢复原 token 与焦点 |
| Token · 空 (empty) | 是 | 104x24 visible; 104x36 hit | token 集合为空 | 不渲染 token；焦点返回筛选入口 | 返回筛选入口或添加 token | 集合为空；焦点返回筛选入口；无 token 命中区 | 空集合不创建删除焦点；筛选入口保持可达 |
| Token · 错误 (error) | 是 | 104x24 visible; 104x36 hit | 删除请求失败 | 保留 ETF 并显示移除失败原因 | 再次激活删除或离开错误状态 | Tab 到删除区；Enter/Space 重试删除；Esc 保留 token | 失败恢复原 token、删除命中区与焦点 |
| Metric · 默认 (default) | 是 | 276x88 visible; 276x88 hit | 净盈亏口径详情：进入页面或恢复默认值 | 净盈亏口径详情：显示稳定默认内容与可操作边界 | 净盈亏口径详情：激活、悬停或聚焦进入下一状态 | Tab 到详情动作；Enter 打开口径 | 净盈亏口径详情：数据缺失显示明确占位并保留上下文 |
| Metric · 悬停 (hover) | 是 | 276x88 visible; 276x88 hit | 指针进入指标详情 affordance；立即 120ms 提示 | 指标值不变，仅详情入口高亮 | 指针离开详情入口 | 键盘不依赖 hover；Tab 到详情动作 | 不发起请求、不改变指标值 |
| Metric · 聚焦 (focus) | 是 | 276x88 visible; 276x88 hit | 净盈亏口径详情：Tab 或 Shift+Tab 将焦点移入 | 净盈亏口径详情：显示 2px 焦点环与当前值，焦点可见 | 净盈亏口径详情：Tab 离开、Enter/Space 激活或 Esc 取消 | Tab 进入口径详情；Esc 关闭并返回指标 | 净盈亏口径详情：焦点环不遮挡内容；失败后焦点留在原控件 |
| Metric · 按下 (pressed) | N/A | N/A | 不渲染 | 不渲染 | 不渲染 | 不适用 | 指标有详情动作，但没有持久 pressed 状态 |
| Metric · 禁用 (disabled) | N/A | N/A | 不渲染 | 不渲染 | 不渲染 | 不适用 | 指标是只读信息，使用不可用/错误文案，不使用 disabled |
| Metric · 加载 (loading) | 是 | 276x88 visible; 276x88 hit | 指标数据请求 pending | 保留旧值并显示骨架/加载反馈 | 请求完成更新值，或显示原因 | Tab 保持指标顺序；Enter 不重复请求 | 超时保留旧值；不将 pending 显示为 0 |
| Metric · 空 (empty) | 是 | 276x88 visible; 276x88 hit | 当前范围没有可计算指标 | 显示破折号与口径说明，不显示 CTA | 切换范围或返回上一筛选 | Tab 到替代说明；Esc 返回 | 范围切换失败保留破折号与上下文 |
| Metric · 错误 (error) | 是 | 276x88 visible; 276x88 hit | 指标计算失败 | 保留指标区域并提供“查看原因”入口 | 点击原因入口或返回上一范围 | Tab 到原因；Enter 打开原因详情；Esc 返回 | 不显示 0；原因入口保留失败上下文 |
| StatusBadge · 默认 (default) | 是 | 124x24 visible; 124x36 hit | 更新时间状态徽标：进入页面或恢复默认值 | 更新时间状态徽标：显示稳定默认内容与可操作边界 | 更新时间状态徽标：激活、悬停或聚焦进入下一状态 | Tab 到达；Enter 打开详情 | 更新时间状态徽标：数据缺失显示明确占位并保留上下文 |
| StatusBadge · 悬停 (hover) | 是 | 124x24 visible; 124x36 hit | 指针进入 badge；立即 120ms 高亮，详情提示延迟 300ms | badge 高亮并在延迟后显示更新时间 | 指针离开 badge | 键盘不依赖 hover；Tab 到达 badge | 提示失败保持 badge 文案 |
| StatusBadge · 聚焦 (focus) | 是 | 124x24 visible; 124x36 hit | 更新时间状态徽标：Tab 或 Shift+Tab 将焦点移入 | 更新时间状态徽标：显示 2px 焦点环与当前值，焦点可见 | 更新时间状态徽标：Tab 离开、Enter/Space 激活或 Esc 取消 | Tab 到达；Enter 打开原因；Esc 关闭详情 | 更新时间状态徽标：焦点环不遮挡内容；失败后焦点留在原控件 |
| StatusBadge · 按下 (pressed) | 是 | 124x24 visible; 124x36 hit | Enter/Space 激活状态徽标详情 | 打开更新时间或过期原因详情 | Esc 关闭详情并返回 badge | Enter 打开详情；Esc 关闭详情 | 详情失败保持 badge 原文案 |
| StatusBadge · 禁用 (disabled) | N/A | N/A | 不渲染 | 不渲染 | 不渲染 | 不适用 | 状态是只读指示器，不使用 disabled |
| StatusBadge · 加载 (loading) | 是 | 124x24 visible; 124x36 hit | 状态刷新请求 pending | 显示更新中 badge，不伪造更新时间 | 刷新成功显示时间，或显示过期原因 | Tab 到达；Enter 不重复刷新 | 失败保留更新中/过期原因，不显示成功 |
| StatusBadge · 空 (empty) | 是 | 124x24 visible; 124x36 hit | 没有可显示的更新时间或状态 | 显示暂无状态 badge | 数据出现或离开上下文 | Tab 到达只读暂无状态；Enter 打开说明 | 缺失继续显示暂无状态 |
| StatusBadge · 错误 (error) | 是 | 124x24 visible; 124x36 hit | 状态刷新失败 | 显示过期·原因 badge | 聚焦打开原因或离开 badge | Tab 到达；Enter 打开过期原因；Esc 关闭详情 | 保留过期原因，不提供不存在的重试按钮 |
| DataTable · 默认 (default) | 是 | 620x520 visible; 620x520 hit | 持仓行、表头排序与分页：进入页面或恢复默认值 | 持仓行、表头排序与分页：显示稳定默认内容与可操作边界 | 持仓行、表头排序与分页：激活、悬停或聚焦进入下一状态 | Tab 顺序：搜索、表头、8 行查看、分页 | 持仓行、表头排序与分页：数据缺失显示明确占位并保留上下文 |
| DataTable · 悬停 (hover) | 是 | 620x520 visible; 620x520 hit | 指针进入单一表格行；立即 120ms 高亮目标行 | 仅目标行高亮，表头/其他行不变 | 指针离开该行 | 指针进入行；键盘 Tab 仍按搜索→表头→行→分页 | 不改变排序、分页或行数据 |
| DataTable · 聚焦 (focus) | 是 | 620x520 visible; 620x520 hit | 持仓行、表头排序与分页：Tab 或 Shift+Tab 将焦点移入 | 持仓行、表头排序与分页：显示 2px 焦点环与当前值，焦点可见 | 持仓行、表头排序与分页：Tab 离开、Enter/Space 激活或 Esc 取消 | Tab 进入表头/行操作；Enter 排序或查看；Esc 取消 | 持仓行、表头排序与分页：焦点环不遮挡内容；失败后焦点留在原控件 |
| DataTable · 按下 (pressed) | 是 | 620x520 visible; 620x520 hit | 持仓行、表头排序与分页：指针按下并完成 click，或按 Enter/Space | 持仓行、表头排序与分页：显示 pressed 反馈并提交一次动作 | 持仓行、表头排序与分页：动作完成、取消或返回稳定状态 | Enter 激活排序/查看/分页；Esc 取消未提交动作 | 持仓行、表头排序与分页：重复提交被锁住；失败恢复默认并保留错误原因 |
| DataTable · 禁用 (disabled) | 是 | 620x520 visible; 620x520 hit | 持仓行、表头排序与分页：权限、不可用数据或父级表单明确设置禁用 | 持仓行、表头排序与分页：降低对比度且不响应指针/键盘激活 | 持仓行、表头排序与分页：权限恢复或父级表单重新启用 | Tab 跳过禁用操作；Enter 不排序或查看 | 持仓行、表头排序与分页：禁用原因必须由相邻文案说明，不伪造成功 |
| DataTable · 加载 (loading) | 是 | 620x520 visible; 620x520 hit | 排序、分页或查询请求 pending | 保留 8 行槽位；分页槽位置灰且不可用 | 成功替换 8 行并恢复分页，或保留旧表显示错误 | Tab 保留搜索、表头和分页顺序；Enter 不重复请求 | 迟到响应丢弃；错误保留旧表并提供重试 |
| DataTable · 空 (empty) | 是 | 620x520 visible; 620x520 hit | 当前范围无持仓行 | 行区显示空原因，分页槽位显示 0 项且不提供分页按钮 | 切换范围、导入或清除筛选 | Tab 到空原因与下一步；Enter 切换范围或导入 | 下一步失败保留查询范围与空原因；不创建虚假的第 1 页 |
| DataTable · 错误 (error) | 是 | 620x520 visible; 620x520 hit | 表格请求失败 | 保留旧表、错误条和重试动作 | 点击/Enter 重试或离开错误条 | Tab 到旧表和重试；Enter/Space 重试；Esc 关闭原因 | 迟到响应丢弃；失败继续保留旧表 |
| ChartTooltip · 默认 (default) | 是 | 264x112 visible; 264x112 hit | 图表数据点提示：进入页面或恢复默认值 | 图表数据点提示：显示稳定默认内容与可操作边界 | 图表数据点提示：激活、悬停或聚焦进入下一状态 | Tab 聚焦图表；方向键移动数据点 | 图表数据点提示：数据缺失显示明确占位并保留上下文 |
| ChartTooltip · 悬停 (hover) | 是 | 264x112 visible; 264x112 hit | 指针进入数据点；立即 120ms 显示点反馈 | 数据点高亮，tooltip 内容按 300ms 延迟显示 | 指针离开数据点 | 指针进入数据点；键盘用方向键选择点 | 无数据点时不插值，移除旧 tooltip |
| ChartTooltip · 聚焦 (focus) | 是 | 264x112 visible; 264x112 hit | 图表数据点提示：Tab 或 Shift+Tab 将焦点移入 | 图表数据点提示：显示 2px 焦点环与当前值，焦点可见 | 图表数据点提示：Tab 离开、Enter/Space 激活或 Esc 取消 | 方向键切换数据点；Esc 移除 tooltip | 图表数据点提示：焦点环不遮挡内容；失败后焦点留在原控件 |
| ChartTooltip · 按下 (pressed) | 是 | 264x112 visible; 264x112 hit | 图表数据点提示：指针按下并完成 click，或按 Enter/Space | 图表数据点提示：显示 pressed 反馈并提交一次动作 | 图表数据点提示：动作完成、取消或返回稳定状态 | Enter 固定当前点；Esc 解除固定 | 图表数据点提示：重复提交被锁住；失败恢复默认并保留错误原因 |
| ChartTooltip · 禁用 (disabled) | N/A | N/A | 不渲染 | 不渲染 | 不渲染 | 不适用 | 图表不可用时不显示 tooltip |
| ChartTooltip · 加载 (loading) | 是 | 264x112 visible; 264x112 hit | 图表行情请求 pending | 保留日期并显示行情加载中与旋转 cue | 行情完成显示值，或显示缺口原因 | Tab 保持图表顺序；方向键不读取未就绪点 | 不显示旧 tooltip 数值冒充新值 |
| ChartTooltip · 空 (empty) | 是 | 264x112 visible; 264x112 hit | 该日期缺少行情 | 显示缺行情原因，不插值 | 切换数据点或 Esc 移除 tooltip | Tab 到缺口说明；Esc 移除 tooltip | 缺口继续明确显示，不伪造数值 |
| ChartTooltip · 错误 (error) | 是 | 264x112 visible; 264x112 hit | 该数据点读取失败 | 显示缺口原因入口，不提供重试按钮 | 聚焦/点击原因入口或 Esc 移除 tooltip | Tab 到缺口原因；Esc 移除过期 tooltip | 保留缺口原因；不显示过期或成功数值 |
| EmptyState · 默认 (default) | 是 | 300x120 visible; 300x120 hit | 空结果下一步 CTA：进入页面或恢复默认值 | 空结果下一步 CTA：显示稳定默认内容与可操作边界 | 空结果下一步 CTA：激活、悬停或聚焦进入下一状态 | Tab 到切换市场 CTA；Enter/Space 执行 | 空结果下一步 CTA：数据缺失显示明确占位并保留上下文 |
| EmptyState · 悬停 (hover) | 是 | 300x120 visible; 300x120 hit | 指针进入切换市场 CTA；立即 120ms 高亮 | 仅 CTA 高亮，空原因不变 | 指针离开 CTA | 指针进入 CTA；键盘仍由 Tab 到 CTA | 不触发导航 |
| EmptyState · 聚焦 (focus) | 是 | 300x120 visible; 300x120 hit | 空结果下一步 CTA：Tab 或 Shift+Tab 将焦点移入 | 空结果下一步 CTA：显示 2px 焦点环与当前值，焦点可见 | 空结果下一步 CTA：Tab 离开、Enter/Space 激活或 Esc 取消 | Tab 聚焦 CTA；Enter/Space 执行；Esc 返回 | 空结果下一步 CTA：焦点环不遮挡内容；失败后焦点留在原控件 |
| EmptyState · 按下 (pressed) | 是 | 300x120 visible; 300x120 hit | 空结果下一步 CTA：指针按下并完成 click，或按 Enter/Space | 空结果下一步 CTA：显示 pressed 反馈并提交一次动作 | 空结果下一步 CTA：动作完成、取消或返回稳定状态 | Enter/Space 只提交 CTA 一次；Esc 取消 | 空结果下一步 CTA：重复提交被锁住；失败恢复默认并保留错误原因 |
| EmptyState · 禁用 (disabled) | N/A | N/A | 不渲染 | 不渲染 | 不渲染 | 不适用 | CTA 有独立禁用原因；empty state 本身不禁用 |
| EmptyState · 加载 (loading) | N/A | N/A | 不渲染 | 不渲染 | 不渲染 | 不适用 | loading 使用父级区块骨架；不与 empty state 同时显示 |
| EmptyState · 空 (empty) | 是 | 300x120 visible; 300x120 hit | 查询范围无结果 | 显示空原因与切换市场 CTA | 点击/Enter 切换市场或导入交易 | Tab 到切换市场 CTA；Enter/Space 执行下一步 | 下一步失败保留查询上下文与空原因 |
| EmptyState · 错误 (error) | 是 | 300x120 visible; 300x120 hit | 空态数据读取失败 | 显示数据暂不可用与切换市场 CTA | 点击 CTA 切换范围或返回 | Tab 到 CTA 与错误原因；Enter/Space 重试或切换市场 | 失败保留错误上下文，不伪造无结果 |
| RetryAction · 默认 (default) | 是 | 110x32 visible; 110x36 hit | 异常上下文重试按钮：进入页面或恢复默认值 | 异常上下文重试按钮：显示稳定默认内容与可操作边界 | 异常上下文重试按钮：激活、悬停或聚焦进入下一状态 | 错误上下文 Tab 到重试；Enter/Space 执行 | 异常上下文重试按钮：数据缺失显示明确占位并保留上下文 |
| RetryAction · 悬停 (hover) | 是 | 110x32 visible; 110x36 hit | 指针进入重试按钮；立即 120ms 高亮 | 按钮高亮但不提交请求 | 指针离开按钮 | 指针进入重试按钮；键盘仍由 Tab 到达 | 不改变错误上下文 |
| RetryAction · 聚焦 (focus) | 是 | 110x32 visible; 110x36 hit | 异常上下文重试按钮：Tab 或 Shift+Tab 将焦点移入 | 异常上下文重试按钮：显示 2px 焦点环与当前值，焦点可见 | 异常上下文重试按钮：Tab 离开、Enter/Space 激活或 Esc 取消 | Tab 聚焦重试；Enter/Space 执行；Esc 取消 | 异常上下文重试按钮：焦点环不遮挡内容；失败后焦点留在原控件 |
| RetryAction · 按下 (pressed) | 是 | 110x32 visible; 110x36 hit | 异常上下文重试按钮：指针按下并完成 click，或按 Enter/Space | 异常上下文重试按钮：显示 pressed 反馈并提交一次动作 | 异常上下文重试按钮：动作完成、取消或返回稳定状态 | Enter/Space 只重试一次；Esc 取消 | 异常上下文重试按钮：重复提交被锁住；失败恢复默认并保留错误原因 |
| RetryAction · 禁用 (disabled) | 是 | 110x32 visible; 110x36 hit | 异常上下文重试按钮：权限、不可用数据或父级表单明确设置禁用 | 异常上下文重试按钮：降低对比度且不响应指针/键盘激活 | 异常上下文重试按钮：权限恢复或父级表单重新启用 | Tab 跳过重试；Enter/Space 不提交 | 异常上下文重试按钮：禁用原因必须由相邻文案说明，不伪造成功 |
| RetryAction · 加载 (loading) | 是 | 110x32 visible; 110x36 hit | 点击/Enter 重试后请求 pending | 显示重试中并阻止重复提交 | 成功移除错误入口，或失败恢复重试按钮 | Tab 保持顺序；Enter/Space 在 pending 期间不重复提交 | 迟到响应丢弃；失败恢复按钮与错误原因 |
| RetryAction · 空 (empty) | N/A | N/A | 不渲染 | 不渲染 | 不渲染 | 不适用 | 重试只在错误上下文中渲染 |
| RetryAction · 错误 (error) | 是 | 110x32 visible; 110x36 hit | 错误上下文已建立且重试可用 | 显示异步重试按钮 | 点击/Enter 进入 loading，或 Esc 离开 | Tab 到重试；Enter/Space 重试；Esc 关闭原因 | 失败恢复按钮；保留具体错误原因 |

这是静态设计合同；浏览器/产品执行仍是独立验收门槛。

机器可读源文件：[atom-contract.json](atom-contract.json)。几何参考：[geometry-tokens.svg](images/geometry-tokens.svg)。
