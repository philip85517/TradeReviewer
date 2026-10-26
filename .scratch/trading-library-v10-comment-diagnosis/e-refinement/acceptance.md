# E 样例最终验收
State: closed
Status: accepted
日期：2026-10-24。实现集成：root；真实浏览器功能验收：root；独立源码与视觉验收：e_independent_acceptance。
候选：`docs/design-system/baselines/2026-10-22-trading-library-v1.0/navigation-e-prototype.html`
SHA256：`3b1068e9d156aa27af5a00cbaf676451dc492c38c0f47426b57a6cd3037c6025`。

## 触发、范围与排除
用户七项调整涉及导航、整体模式底色、说明交互和盈亏颜色，因此触发 frontend-control-audit。覆盖本独立桌面静态样例的全部可操作控件、四主页面及正常/加载/空状态。市场/身份为只读展示，侧栏为视觉上下文，不是业务导航；没有生产导航、数据库请求、保存、错误重试。数据库持久化/生产写流 N/A（纯固定 fixture 样例）；手机适配、模拟触摸与物理触摸 NOT VERIFIED 且在本轮范围外。鼠标及键盘证据单独登记。

## 版本绑定控件覆盖
|控件族与元素|范围分母|已验证行为|证据|结果|
|---|---|---|---|---|
|mode-live / mode-simulation|2控件×2页面|鼠标、左右箭头；保留页面；各模式日期记忆；工作区换色且按钮几何稳定|browser-evidence.json、geometry-evidence.json|PASS|
|page-list / page-stats|2控件×2模式|鼠标、左右箭头；日期语义切换，11笔成交/6次练习/6或8指标|同上|PASS|
|date-range|1控件×2模式×2选项|fixture/long切换，模式返回记忆，刷新回默认|browser-evidence.json|PASS|
|preview-select|1控件×4主态×3选项|12种正常/加载/空状态，无旧数据残留|browser-evidence.json|PASS|
|measure-rate / measure-amount|2控件×2统计页|分布改变，KPI与趋势不变；刷新回收益率|browser-evidence.json、verification.json|PASS|
|fee / trend / distribution帮助|3入口×2统计页|鼠标打开、Esc关闭，内容正确、弹层边界内|browser-evidence.json、screenshots/*help*|PASS|
|drawdown-help|1入口×模拟统计|未知值保留，口径解释不拼账户；点击/Esc|同上|PASS|
|prototype-help|1入口×全局|移入被动文字触发hover、移出关闭；键盘focus/blur；click/Esc；底部向上展示|browser-evidence.json、prototype-hover-1440.png、prototype-help-1280.png|PASS|

控件族共8类，实际控制元素13个（模式2、页面2、日期1、预览1、分布2、说明5）；说明在两个统计页有7个业务实例加1个全局实例。覆盖分母以表内状态为准，不把固定导航图标计为可操作控件。

## 各验收门槛
- 功能 PASS：51次命名状态检查；两模式四主态和12种预览状态；日期、分布、刷新链路正确。
- 状态安全 PASS：新旧fixture语义完全一致；量纲切换不改累计值；6个保护文件hash一致。
- 视觉 PASS：独立审查见 INDEPENDENT-ACCEPTANCE.md。1440×1000、1280×800四态；1239/1241断点；五类浮层和滚动终点。截图工具可能缩放输出，CSS视口以geometry为准，参考缩放差异在独立报告中保留。
- 几何 PASS：10条实际DOM记录；模式控件均x96/y70.5/184×44；无页面横向溢出；实盘深黑蓝、模拟蓝灰整片表面切换。
- 运行 PASS：node --check通过；fresh-console.json中全新tab17四态无error/warn。旧tab15的12:45:23 TypeError属于third-failed.html，未删除历史，当前候选12:55校验通过。
- 持久化 N/A：静态样例没有数据库、网络写入或账户操作。

## 历史与处理
first-failure.md、second-failure.md、third-failure.md 及对应文件/截图保留。前两次为样式覆盖、说明外露/边界、图标和颜色错误；第三次整页重写引入live访问exercises异常。root恢复可用E状态模型后集中修正样式和说明；独立Agent复核最终hash。初始测试脚本曾把声明间的URL查询变量误抓入fixture，已修正提取方式后语义比较PASS，不是页面回归。

## 交付与后续
预览：http://127.0.0.1:3090/design-system/baselines/2026-10-22-trading-library-v1.0/navigation-e-prototype.html
服务：127.0.0.1:3090，Python PID58155，最终浏览器重新打开成功。
启动：`./docs/design-system/baselines/2026-10-22-trading-library-v1.0/start-preview.sh`。
仅接受样例实现；E选择已有用户决定，新的蓝灰底色/边缘视觉提案仍待用户确认后才进入正式设计与生产实现。
