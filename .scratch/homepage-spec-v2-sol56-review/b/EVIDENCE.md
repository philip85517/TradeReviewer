# 审查证据清单

## 基线

- Git HEAD：`6406092fa49fa1420ca3c1af04b414e1d675cf75`
- V2 目录在审查时为未跟踪工作树内容；结论绑定当前文件内容，不声明其已提交身份。
- 原始评论：`docs/design-system/baselines/2026-10-15-homepage-v1.0/reviews/2026-10-16/COMMENTS.md`、`HOME-DOC.json`。
- 规范：`docs/agents/frontend-control-audit.md`、V2 `visual-design.md`、`comment-review.md`、`DESIGN-COVERAGE.md`。

## 已目视检查的渲染图（29/29）

|章节|源图|
|---|---|
|HP05（11）|`holdings-0.svg`, `holdings-5.svg`, `holdings-10.svg`, `holdings-20.svg`, `holdings-50.svg`, `holdings-last-page.svg`, `holdings-no-match.svg`, `holdings-name-tooltip.svg`, `holdings-extreme.svg`, `holding-detail.svg`, `local-search.svg`|
|HP06（9）|`history.svg`, `contribution-0.svg`, `contribution-5.svg`, `contribution-10.svg`, `contribution-20.svg`, `contribution-50.svg`, `contribution-market.svg`, `contribution-history.svg`, `library-handoff.svg`|
|HP07/动效（9）|`state-loading.svg`, `state-updating.svg`, `state-stale.svg`, `state-no-fx.svg`, `state-partial.svg`, `state-error.svg`, `cold-error.svg`, `retry-result.svg`, `motion.svg`|

所有源图位于 `docs/design-system/baselines/2026-10-16-homepage-v2.0/images/`。使用仓库已安装的 `sharp` 将 SVG 渲染到 `/tmp/tradereview-sol56-b-render/*.png`，逐张通过图像查看器检查。`qlmanage` 在沙箱中无法创建 Quick Look helper，故未作为证据链。未看项：0。

## 关键可复查文字证据

- `visual-design.md:226,236`：贡献展开要求“按钮附近”保持视线。
- `images/motion.svg`：同一动作写“旧列表顶端作为滚动锚点”“按钮随列表底部向下”“不自动滚动到页底”。
- `visual-design.md:238`：日期路由带 `market`；队列路由不带 `market`；同段又承诺刷新不丢市场。
- `images/library-handoff.svg`：队列进入交易库后继承“美股”，但图中未给出来源或中间状态。
- `visual-design.md:208`：历史区要求年份折叠、空年、0 复盘等；`history.svg` 未画这些状态。
- `visual-design.md:280`：要求 scope 原子替换/失败保持旧 scope；现有异常图没有 scope 身份、回滚或乱序响应分镜。
- `comment-review.md:294-302`：C25 响应称重试不进入主浏览路径；`cold-error.svg` 主内容中央仍出现“查看错误原因并重试”。

中央文案没有明确控件边界；证据只支持“可操作性未定义”，不支持断言第二入口可点击或会并发。`state-stale.svg` / `state-error.svg` 的浮层临时覆盖部分背景属于常见 tooltip 表现，未列为缺陷。

## 检查限制

这是设计稿审查。没有把静态 SVG 当成真实交互证据，没有以文档内既有 PASS 代替独立判断。产品运行、数据库、持久化、真实浏览器键鼠/触控均不适用。窄屏按 C34/C38 排除；D01 保持待决定。
