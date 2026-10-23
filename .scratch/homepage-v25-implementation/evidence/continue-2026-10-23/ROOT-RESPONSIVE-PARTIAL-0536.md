# 第三候选：root 响应式有限复核与滚轮重开

2026-10-23 05:36 CST。触发：首页 UI 开发后独立检查。CSS 765c420c5d5f6eac81e56626786b4421fdd39925dcb071facac7561446493fbf；其余版本延用本目录此前冻结记录。本记录不构成 P1 正式第三轮：P1仍2/3 FAIL。

环境：无探针3333服务、既有 .data/tradereview-test.sqlite；IAB tab9、真实 A股74持仓/50标的、全部账户、rangeMode=all。无业务写入。精确桌面参考为原 source/images/home-history-1440.svg、home-history-1280.svg 与 HP11 的导航72、header64、24px外边/间距、520px持仓预算；未接入期间/历史占位不算原图整页符合。窄屏未提供独立移动原图，依现行应用约定与核心操作可达性验证。

## 有限控件/状态结果

|登记ID|真实动作与结果|证据|结论|
|---|---|---|---|
|R01 页头390|账户行落在105px页头内，不再越底；导航69px横条|root-390-after.png|局部视觉PASS|
|R02 导航390|鼠标展开导航，选择项完整可见；关闭|root-390-navigation.png|鼠标PASS；键盘关闭焦点未接受|
|R03 账户390|鼠标展开176px宽、最大320px高的选项|root-390-account.png|展开PASS；全部选项未逐个执行|
|R04 搜索390|鼠标打开342px舞台；实际Esc关闭，焦点hp-symbol-search|root-390-search.png|此开关/Esc有限PASS|
|R05 断点与桌面|实际759/760/900/901/1440×1000/1280×800看图；desktop72/64保持|root-responsive-after.json，root-各宽-after.png|壳/持仓位置有限PASS；非整页视觉PASS|
|R06 纵向滚轮390|[180,500] wheel down后document仍377.5，child仍0；此前PageDown能使document824|root-390-page-down.png及本次实际DOM记录|FAIL；owner responsive_shell诊断|
|R07 横向滚动390|真实wheel right使hp-home-scroll.scrollLeft586，可见右端详情和分页|root-390-holdings-right.png|鼠标横向PASS|
|R08 分页390|鼠标下一页1/10→2/10，8行正确替换|root-390-page2.png|鼠标有限PASS|
|R09 详情390|page2首行打开准确SSE:600101/P1 09行；342×790舞台，四卡可见，主动作可达；Esc回原row焦点/第2页/水平586|root-390-detail.png|开关与局部视觉PASS；库往返尚未本次执行|

此局部登记9项均有真实动作或直接同态视觉结果；8项有限PASS，R06 FAIL。状态/选项全集、全部74动态行、完整原稿状态、鼠标/键盘等价、emulated/physical touch和真机软件键盘均未覆盖，不能报整页100%。保存及普通库返回/reload保留既有版本边界，本次不复用旧证据称当前全部通过。

## 首偏差

390时 app-content/host/surface/background height1817，hp-home-scroll clientHeight=scrollHeight1712、overflowY auto、overscrollY contain、scrollTop0。document owns vertical scroll，但内层contain阻止wheel传递。PageDown与水平滚动分别成立不能覆盖纵向鼠标失败。root已交唯一CSS owner只读核对原高度链；修复前不得声明响应式完成。完整数据状态和视觉门仍NOT VERIFIED。
