# root 窄屏高度链修复有限复验

2026-10-23。触发：首页布局开发后真实滚轮/详情路径回归。唯一 CSS owner /root/responsive_shell（gpt-6.1-sol / ultra），root 独立浏览器检查。P1 正式仍 2/3 FAIL；此记录不重置或增加正式轮数，不等于整页接受。

绑定 home-surface.css SHA256 `28af46a70f2583e63e3296a2532da4a6f5f74d0fbb5b0a861ab6a86563e65b4d`。精确改动及原稿/selector根因见 `../P1/round3/responsive-shell/SCROLL-DIAGNOSIS.md`、`HEIGHT-CHAIN-IMPLEMENTATION-READY.md`。在 max759 内修复 100dvh 与两层 min-height:0，保留 overscroll containment。此前 CSS765c… 的 R06 FAIL 保留于 ROOT-RESPONSIVE-PARTIAL-0536.md，不能覆盖为旧版本通过。

环境：既有隔离 .data/tradereview-test.sqlite、无探针 3333、IAB tab9；真实 A股74持仓/50标的/全部账户/全期间。无业务写入，未重建 DB。actual viewport390×844与759×844，DPR1。

|控件/状态|root 真实动作及 DOM 结果|证据|有限结论|
|---|---|---|---|
|R06-390纵向|[180,500]真实 wheel down1：inner844；up0.5：inner422；document scrollY始终0，横向586保留；inner client670/scroll1712|root-390-wheel-fixed.png|此坐标下/上 PASS；两端边界未测|
|R09-390详情关闭|第2页P1 09/SSE:600101准确详情→实际Esc；inner422、横向586、原行焦点恢复|本窗口实际 AX/DOM 工具记录|有限功能PASS|
|R06-759纵向|改为759×844，inner711/1708、起始422；真实wheel down0.3→675；doc0、横向217|root-759-wheel-fixed.png及同名ax.txt|有限功能/壳视觉PASS|
|R07-390横向|改回390×844，inner675/doc0；真实向右wheel0.7：横向217→490|本窗口实际DOM工具记录|有限PASS|
|R09-390准确库入口|真实P1 09/SSE:600102行→详情→查看交易；准确 /trades?scope=live&market=a&accounts=*&rangeMode=all&symbol=SSE%3A600102；真实普通库1标的/4回合|root-390-trades.ax.txt|进入准确普通集合有限PASS|
|R09返回首页|准备点击前 Workspace/host 产品HMR；当前页转读取中，旧元素被拒绝|本窗口AX/工具记录|NOT VERIFIED；不把旧版本/HMR后状态计成功|

root 已直接看两张修复截图；header和导航常驻、下方表格和分页可达。桌面此前截图只绑定旧CSS765c；新规则不匹配desktop是源码事实，不替代当前版本直接视觉复验。全控件、键盘等价、滚动端点、完整库返回/reload、notice恢复、触控/真机软键盘和整页原稿比对仍 NOT VERIFIED。request-body消费者OPEN；期间/历史占位不算设计实现。
