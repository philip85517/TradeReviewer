# CR03 单一视觉候选的因果与范围

2026-10-23；执行者 state_g61，实际模型 gpt-6.1-sol / ultra。原 P3 同票；正式 0/3 不变。本文件在产品补丁前写入。root 已确认派单误写的 CSS 名应为实际 `app/components/homepage-v25/home-surface.css`。

## 原始复现与单一假说

root 的 `../search-recovery-fix/root-http503-after-keys.png` 是真实 HTTP503 下的失败截图：结果区左上显示白色原因文字和小重试按钮。与本次直接查看的 `../reference-readback/search-error-frame.png` 及完整原 SVG 内容一致的比较结论是视觉 FAIL。该截图是 root 既有证据，本代理没有重新打开浏览器、请求接口或操作数据。

当前 Surface 错误分支仅有裸 `div[role=alert]`、普通段落、普通按钮。结果容器仍是正常流，段落继承 14px 白色正文；按钮没有专属宽度和背景。单一假说：错误区缺失局部布局/文字/按钮样式，非搜索状态或目录数据问题。有限候选只增加错误 wrapper 和重试的类名，并仅为这些类写 CSS；保留原因原文、role、query、onReload 和已有键盘保护逻辑。

## 精确原稿与预期

- `visual-design.candidate.md:130–160`（HP03 / HOME-HP03-B019）、`component-manual.html:370–455`：搜索加载/失败/恢复必须可区分；失败保留查询和原因，可重试；Esc/关闭与既有恢复规则仍适用。
- 原 `source/images/search--empty.svg` 第三个 GlobalEntitySearch 与 `search-error-frame.svg`：舞台 960×610；结果矩形 928×430；文字中心 x550、基线相对结果顶部150，字号16、错误色 `#FF8592`；重试 x506、相对结果顶部180、88×36、圆角6、背景 `#111A26`、描边 `#283448`、文字14 `#E6EDF7`。
- 结果区原错误组合的中心略高于几何中心；采用局部满高 flex 的中心布局，并用底部80px留白形成约40px上移，接近原稿相对位置。保留现有较长原因文案，允许折行；不删除文案以追求短标题宽度。
- 不修改舞台、输入、结果容器及其滚动尺寸。默认/hover/active/focus 样式继续使用已有按钮状态，局部按钮仅明确原稿静态尺寸、颜色、边框。

## 验证及独立边界

root 已有真实视觉 RED 为本次修复依据；禁止改既有测试，也不新增 jsdom 假几何断言。补丁后运行受保护的既有 29 项搜索/Surface/目录定向回归及 Surface 有限 lint，记录完整输出/命令/真实退出状态，核对原测试哈希不变。它们只证明逻辑回归，不证明 CSS 外观。

实际1280×720、DPR2下的503错误图、原因/查询保留、重试恢复、键盘仍不能选择隐藏结果、loading/empty不混同，以及匹配状态的原稿视觉比较均待 root 独立实测。其他断点、物理触控仍 NOT VERIFIED。本代理不签 visual PASS 或 accepted，不修改共享 tracker。局部无业务写入，持久化写入门对该补丁 NOT APPLICABLE；完整搜索旅程门仍适用。
