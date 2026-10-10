# 视觉合同：策略台与图表优先复盘

## 范围与责任

- 任务：[`00-map-strategy-visual-acceptance.md`](issues/00-map-strategy-visual-acceptance.md)
- 规格依据：[0.7 视觉检查点](../../docs/designs/2026-10-08-strategy-visual-system/versions/0.7-20261010/README.md)、[视觉规范草案](../../docs/designs/2026-10-08-strategy-visual-system/README.md)、[完整 Workbench 恢复记录](../../docs/designs/2026-10-08-strategy-visual-system/full-workbench-preview.md)
- 整页视觉负责人：`/root`（规划期）；实现后必须指定未参与实现的独立视觉审查者。
- 跨层状态/持久化负责人：后续 07 票指定；不能由组件自测代替。
- 规划期授权差异：沿用用户已确认的 0.7 完整观察和滚动修复样板；策略 A 最小宽度与 RecallWorkspace 的响应式例外继续登记，不自动推广到另一上下文。

## 参考图、视口与状态锁定

归档截图是参考证据，真实浏览器重跑是最终证据。截图像素尺寸不直接等同 CSS 视口；每次新证据都记录 CSS viewport、浏览器缩放、DPR、滚动位置、导航状态、数据/文案版本和图表范围。

| 参考状态 | 归档图像 | 归档 CSS 视口 / DPR | 用途与限制 |
| --- | --- | --- | --- |
| 完整观察顶部 | [`observe-1440.jpg`](../../docs/designs/2026-10-08-strategy-visual-system/versions/0.7-20261010/screenshots/observe-1440.jpg) | 1440×900 / 1（按 manifest） | 宽桌面首屏层级和图表空间；必须在新鲜浏览器复核 |
| 完整观察顶部 | [`observe-1280.jpg`](../../docs/designs/2026-10-08-strategy-visual-system/versions/0.7-20261010/screenshots/observe-1280.jpg) | 1280×720 / 1（按 manifest） | 桌面窄边界、图表/面板取舍 |
| 完整观察窄屏 | [`observe-390.jpg`](../../docs/designs/2026-10-08-strategy-visual-system/versions/0.7-20261010/screenshots/observe-390.jpg) | 390×844 / 1（按 manifest） | 文档流、回放换行、长中文；不能冒充真实手机软键盘 |
| 完整观察底部 | [`observe-bottom-1280.jpg`](../../docs/designs/2026-10-08-strategy-visual-system/versions/0.7-20261010/screenshots/observe-bottom-1280.jpg) | 1280×720 / 2（按 manifest） | 页底可达性和滚动后状态；DPR 与顶部图需分开记录 |
| 当前运行 | [`live-preview.jpg`](../../docs/designs/2026-10-08-strategy-visual-system/versions/0.7-20261010/screenshots/live-preview.jpg) | 1280×720 / 2（按 manifest） | 最新真实浏览器复核线索；不能替代后续最终版本截图 |

后续实施必须补齐工作流规定的 1280×800、约 390 宽度、导航展开态和适用的真实手机软键盘证据。`1024/980`、`760/759`、`600` 是响应式断点两侧的回归宽度，不得从截图像素猜断点。

## 数据与交互状态

- 策略台 A：完整观察、运行中、T0、结果、比较；固定数据为 EMA20、2024-09-13、净值观察、三个月双策略合成数据。场景切换不能清除图表/计划角色。
- RecallWorkspace：S0 入场前、S1 持仓中、S2 退出后；阶段、市场截止、成交截止、图表范围、原判断、当前补充和复盘补记必须可单独识别。
- 代表性交互状态：默认、选中、键盘焦点、hover/active、disabled、弹层打开、长文展开、图层/工具选中、回放播放/暂停、末尾或无行情。
- 固定内容：计划入场、初始止损、止盈目标、数量、成本、原判断和多行中文批注保留完整；测试不得把“缩短文案”当响应式通过。

## 共享视觉合同候选

这些是待 02–06 决策确认的可测候选，不能在没有 Resolution 时写成生产承诺。

| 维度 | 候选规则 | 证据要求 |
| --- | --- | --- |
| 文字 | 标题 18/24/600；分区 16/24/600；正文 14/22/400；控件 13/20/500；元数据 12/18/400；价格/数量使用 Geist Mono tabular | computed style、字体加载状态、长中文截图；实际 glyph 来源和 Windows 字体单列 `NOT VERIFIED` |
| 字体链 | `Geist, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif`；数字另设 Geist Mono | 记录 Next 字体变量展开结果；不能从 `document.fonts.status=loaded` 推断每个汉字来源 |
| 色彩 | page `#0b1220`、surface `#111a2b`、elevated `#182337`、text `#e7edf6/#adbbcf/#9cacc2`、动作蓝 `#2f80ed`；主要按钮 `#2469c8/#2b72d3/#205bac` | 对真实合成背景做 computed 对比度；普通文字 ≥4.5:1，必要图形/边界 ≥3:1 |
| 语义 | 计划金色 `#f3ba2f` + 虚线；实际成交使用现有买卖标记和事实标签；盈亏沿用用户配置且保留符号/单位 | 正负、单位、颜色配置切换及色弱可读性证据 |
| 控件 | 桌面紧凑 36px；窄屏普通操作 44px；图标槽 18px Lucide、stroke 1.75；控件圆角 6，面板 8；间距词 4/8/12/16/24 | 盒模型测量、点击/键盘、焦点不裁切；31×36 和 112×36 只作为登记例外 |
| 状态 | selected/focus/disabled/expanded/empty/loading/error 可区分；focus `#8cbdff` 2px offset2；aria-pressed/selected/current 与视觉同步 | 鼠标、键盘、模拟触控、真实触摸分别记录；未执行保留 `NOT VERIFIED` |

## 上下文边界

| 上下文 | 必须保持 | 允许保留的登记例外 |
| --- | --- | --- |
| 策略台 A | nav→页头→身份→摘要→范围→图头→回放→状态→检查区的固定预算；图表是主要视觉重心 | nav 54px、检查区 320px、最小宽约 1100px；900/390 横向滚动目前是未完成移动适配，不能误报为通过 |
| RecallWorkspace | 同一工作区承载 S0/S1/S2；阶段/双截止靠近图表；图上批注、原判断和全文关联保留 | ≤1330 下移计划、图表约 480px；≤600 正常文档流、图表约 720px；390 回放六控件 44px 两行；标记碰撞与编辑浮层仍需单独验收 |
| 首页/Workbench | 复用文字、颜色、控件、图标角色 | 首页 B 的列数和比例不能直接移植到复盘；差异必须在 02/05 的 Resolution 中命名 |

## 关键行为合同

1. 回放首条实现切片必须走真实主图：隐藏未来 → 下一根/播放 → 下一决策 → Text → 回看早期 → 保存/重开；按钮存在或游标变化不算通过。
2. 行情截止和成交截止独立存储、展示和比较；Tooltip、OHLC、持仓/成交列表、摘要、统计、缩放/适配均受同一可知截止约束。
3. 用户主动查看未来历史后，来源标签、阶段和图表状态在切换、刷新、关闭重开后保留；不能重新伪装为盲态。
4. 保存、返回列表、刷新重开形成真实持久化闭环；使用显式隔离 `TRADEREVIEW_DB_PATH`，不修改共享业务库。

## 授权差异与例外登记模板

每个例外必须写明组件、上下文、理由、影响、验证视口、负责人、引入版本、退出条件和证据路径。没有这些字段，只能记为 `NOT VERIFIED`，不能以“当前样板看起来可用”关闭。
