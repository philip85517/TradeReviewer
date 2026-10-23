# 搜索 CR01 / CR02 有限独立复验

记录：2026-10-23 04:41 CST；独立接受者 /root。P3 正式 0/3，未启动整票验收。原失败保留在 `../control-review/REPORT.md`。

## 版本、触发与排除

Surface `c6e14890fe36eb99e2dd03ba43608f7ced1ad482bdb57a757e09b8884f4d30b6`，CSS `d34b54ab5eb9b5232847607d3b5c94e9b93833da3703b2292793066e6dff43d1`，host `3218407b84c45656989bc0a2ac700c9741e6c55135f55ed2873e7ed2b968b167`。依赖与实现者有限范围见 `SOURCE-MANIFEST.freeze.json`；root 组合测试见 P1 `navigation-deadline/root-06-navigation-surface-77.json`。CR03 后续新版本必须另验，不覆盖本冻结证据。

触发：开发改变搜索控件/状态接线；覆盖真实关闭/重开、结果滚动、详情返回、pending/error 键盘、retry 与 ready 后 Enter。实际 CSS viewport **1280×720、DPR2**，鼠标与键盘；其他断点、模拟触控、物理触控、正常动效及完整附件保留 NOT VERIFIED。该局部行为不写业务数据库，不以组件 callback 代替已有核心持久化门。

## 版本绑定覆盖表

|控件/旅程|证据|结论|
|---|---|---|
|CR01 搜索6，真实 wheel 到1440，关闭、重开|`root-scroll-before.ax.txt/.png`、`root-scroll-closed.ax.txt`、`root-scroll-reopen.ax.txt/.png/.json`；重开 top=1440、query=6、focus=搜索标的|有限 PASS|
|详情来源返回准确非零滚动与焦点|`root-native-detail-return.ax.txt/.json`：原 top1322，真实鼠标点击思摩尔国际 HKEX:6969，详情来源返回后 top1322、focus/current 均准确证券 ID|有限 PASS|
|CR02 pending Enter/ArrowDown|`root-pending-enter.ax.txt` 与 P1 `navigation-deadline/root-window02-loading-keys.ax.txt`：无详情，仍输入/原查询|有限 PASS|
|CR02 timeout 错误 Enter/ArrowDown|`root-timeout-error-keys.ax.txt/.png`：无结果按钮，detail0，输入焦点/query6保留|有限 PASS|
|CR02 实际HTTP503错误 Enter/上下箭头|`root-http503-before-keys.ax.txt`、`root-http503-after-keys.ax.txt/.png`：无详情，错误可见，输入焦点/query6/来源URL保留|有限 PASS|
|恢复正常代理→局部重试→ready→Enter|`root-http503-retry-ready.ax.txt` 为loading过渡；`root-http503-retry-ready-settled.ax.txt` 为真实ready，`root-recovered-enter-detail.ax.txt/.png` 为中国铝业 HKEX:2600准确详情|有限 PASS|
|CR03 HTTP503错误态与原稿视觉|直接查看上述503截图及 `../reference-readback/search-error-frame.png`；当前白色信息/默认重试挤在左上，原稿居中错误色/88×36按钮|**FAIL，已交同owner单一候选**|
|全 P3 / 四区附件 / 全部96状态与响应式|未实施或未核对|NOT VERIFIED|

root 同次冻结的8文件77测试PASS（含独立搜索恢复测试），不以测试抵消 CR03 真实视觉 FAIL。详情首次语义 click 的1440→1322不据此判缺陷：该动作可能先滚动目标，缺少紧邻点击的原值；随后实际坐标鼠标1322→1322独立确认了有限来源返回。

## 原稿对照与当前处置

root 直接查看 `root-scroll-reopen.png` 与原稿派生 `../reference-readback/search.png`；正常结果舞台在当前单视口做有限对照。错误态独立 FAIL 的准确合同、参考、文件 owner 与预期已写入 DESIGN-COVERAGE 及 `../search-error-visual/ROOT-DISPATCH.md`。不将其悄悄视为授权偏差。CR03 只允许 Surface 错误 markup 与实际 `home-surface.css` 局部样式的一个候选；键盘守卫、query/selection/scroll/source 均需回归。

P1 仍正式2/3 FAIL；P3 正式0/3。四区附件依赖 P2/P4 原子合同，未扩大产品派发。原失败、采样局限与所需未验证门保持明确。
