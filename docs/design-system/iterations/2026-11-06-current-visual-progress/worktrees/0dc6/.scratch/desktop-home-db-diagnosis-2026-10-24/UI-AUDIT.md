# 桌面首页诊断：版本绑定的局部前端审计

Trigger: 用户要求“当前验收确保验收当前的桌面版本……诊断问题”。
Scope: 首页数据加载/范围值/终态/空态/历史接线；仅一个只读原因弹层操作。当前版见 [manifest](CONTENT-MANIFEST.json)，CSS 1440×900 / DPR1，原始 `live/a/*/all` URL，现有真实库用户页面。
Reference: 用户当前桌面要求、既有首页实现状态契约；没有新增设计稿。本轮不作整页视觉保真交付。
Owner / independent acceptance: /root；两名 Astra 只读审计运行数据与源码，均未实现本轮 UI。

| ID | 定位与前置 | 操作/预期 | 真实证据 | 状态 |
| --- | --- | --- | --- | --- |
| D01 | 首页 1440×900 | 受支持 viewport.set；核对 innerWidth/Height、DPR、截图 | BROWSER-ENVIRONMENT.json、DESKTOP-HOME.jpg | PASS：桌面条件成立 |
| D04 | 顶部 A股、全部账户，原 URL | 只读核对所选范围；未切换 | DESKTOP-DOM.txt | PASS：所读 URL/选择吻合；不代表数据已应用 |
| D05-A | 顶部全局 alert、指标、期间、曲线 | 只读检查终态应一致 | DOM、截图、源码 | FAIL：timeout 与“读取中”并存 |
| D05-B | 当前持仓表 | 未接受来源时不应声称已核对真实空集 | DOM、workspace seed/ready 链 | FAIL：首读超时显示“暂无持仓” |
| D05-C | 历史已平仓 region | 核对真实接线状态 | DOM 与 hardcoded reservation/reloadHistory | FAIL：整页开发要求下尚未接线；本轮只诊断 |
| D06-open | 期间净盈亏“查看原因” | 鼠标点击，应打开口径详情且保留原状态 | METRIC-REASON-DOM.txt、METRIC-REASON.jpg | PASS：弹层打开，显示 timeout/无 view |
| D06-close | 弹层“关闭详情” | 鼠标点击，关闭并回焦 | [关闭后真实 DOM](FINAL-DESKTOP-DOM.txt)，来源按钮 active、无 dialog | PASS |

实际鼠标点击覆盖仅 D06-open、D06-close：2/2，结果 2/2 PASS。只读观察不计作点击；该分母不能表示整页控件覆盖。临时视口设置不计作产品控件点击。

排除项：本轮窄屏、全控件/全部状态普查、写入/返回/刷新旅程、交易库导航、行情/汇率修复按钮、完整视觉设计对照。真实库刷新不是本轮已验证项目；原因是已知 bootstrap 自动写入及此前审批拒绝，不能以更换 URL 绕过。

键盘、模拟触控、物理触控、本轮新初始化网络时序均 NOT VERIFIED。没有进行写流程，持久化验收 NOT APPLICABLE（诊断范围，不是产品写流程已通过）。浏览器仅抓到当前控制台空列表，不能据此证明全程无错误。截图显示首屏视觉，完整滚动区域文本由 DOM 证明；本轮未声明下方区域已完成视觉对照。

整页验收：FAIL / 保持 open。诊断结论不构成实现接受；旧窄屏交易库数字不能证明桌面首页通过。
