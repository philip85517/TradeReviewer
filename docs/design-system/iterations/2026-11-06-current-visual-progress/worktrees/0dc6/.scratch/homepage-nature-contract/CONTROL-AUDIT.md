# 桌面局部控件与状态接线验收

触发：本次性质协议修复影响前端筛选、列表、复盘队列和首页范围库接线。适用规范：docs/agents/frontend-control-audit.md。范围为性质三选项、列表/回合页签、相邻复盘入口、首页范围跳转及刷新/返回。不是整页100%审计。

版本：候选1首轮通过；HEAD 58bf0d9 + evidence/VERSION.json，source c83eb5797bfdc30ebf674ce94a24a3f56774fb2f205072bb5f515b29aeb4366c，build 4cdacf39e1ee22aaf636b4b58650853aa0bb1a4789b2af9861c6394cc98a4a5e。FINAL-INVARIANTS证明验收后源码/构建未变。基线4392旧C4，1440×1000 CSS px / DPR1；截图before-live.jpg像素1440×1000，未缩放。root为未实现产品代码的独立验收人、整体视觉和跨层数据负责人。

无新增CSS或元素；参照修复前同态before-live.jpg和既有交易库设计。预期保留主导航、页头、性质/账户/计价/搜索横排、标的/回合页签、筛选、金额说明、汇总、表格的层级和密度。性质切换可以改变条数/数据/空态，不能意外移动页头或隐藏主要操作。1440×1000与1280×800为桌面检查范围。响应式窄屏、触控、行情/Bars舞台不属于本票。没有新增持久化写流，保存/失败/冲突验证N/A；浏览器仍用显式隔离库。

## 控件登记和验收计划

|ID|定位/前提|动作及预期|状态/空间|证据|结果|
|---|---|---|---|---|---|
|C01|交易性质：实盘|真实下拉选择；规则证据合格交易可见|selected；页头筛选位置稳定|after-live-AX.txt/jpg：226标的726回合|PASS|
|C02|交易性质：模拟盘|选择后只有模拟，不混实盘；原32回合稳定|selected|after-simulation-AX.txt/jpg：4标的32回合|PASS|
|C03|交易性质：来源未知|人工无证据交易保留未知，不漏进实盘|selected/unknown|after-unknown-AX.txt/jpg：6标的6回合；混合原成员整体unknown|PASS|
|C04|按回合浏览页签|性质正确，精确回合可达|active，表格预期更换|after-episodes-AX.txt；226/726|PASS|
|C05|单回合复盘及返回|当前性质队列/回合身份正确，原链接可达|detail/navigation|黄金ETF 2026/7/28原第6回合；review-loaded-AX.txt/jpg、review-return-AX.txt|PASS（单回合入口；非全队列遍历）|
|C06|首页范围交易库入口|live范围历史交易非零，与同范围解析一致|scope+selected|home-scoped-settled-AX.txt/jpg：live/all/*/all，226/726|PASS|
|C07|刷新当前范围库|URL/范围正确、记录仍可见|reload/loading/normal|home-scoped-reload-AX.txt、final-desktop.jpg：URL保持、226/726|PASS|
|C08|返回首页再进入|范围沿用，独立财务错误不伪装为空数据修复|navigation/error|home-initial/home-settled-AX.txt，home-scoped-settled-AX.txt；原首页超时明确可见|PASS（导航）；完整财务态FAIL|

登记分母8条旅程，性质选项分母3项；不能以此声称所有控件或组合通过。动态重复列表使用实际抽样精确对象ID，不枚举764个回合操作；全体回合身份/成员通过独立领域探针验证。鼠标/语义select与键盘分别记录，未验证键盘/触控不算通过。

## 修复前几何

1440×1000，DPR1，scroll0；main sidebar右边界x201.59375。

|容器|x|y|width|height|
|---|---:|---:|---:|---:|
|交易性质|225.59375|159.5|120|36|
|交易库页面头部|201.59375|57.5|1238.40625|151|
|交易库浏览视图|225.59375|208.5|1190.40625|39|
|交易库常用筛选|225.59375|267.5|1190.40625|74|
|当前筛选绩效汇总|225.59375|413.5|1190.40625|89.8984375|

修复前观察：232标的732实盘回合；原broker-only显示会将6条无可审计补录作为实盘。本票允许基于证据收紧分类造成数据条数调整，不允许通过改历史ID或删记录完成分类。

## 独立视觉验收结果

root直接查看修复前before-live.jpg与修复后after-live.jpg、after-simulation.jpg、after-unknown.jpg、home-scoped-settled.jpg、final-desktop.jpg，并查看1280×800的desktop-1280.jpg。1440同态下上述五个容器的边界与基线数值相同，表头、筛选横排、密度与层级保留；数据变化符合性质收紧。1280维持桌面侧栏，范围控件和搜索按原响应规则换行，主要操作可见，scrollWidth/bodyWidth/innerWidth均1280，没有横向溢出；与1440现有视觉约定比较无新增主要偏差。本票没有新增样式或授权设计偏离。

8/8限定旅程完成，3/3性质选项通过真实selectOption选择；页面按钮/页签用真实语义click。键盘、emulated/physical touch、系统下拉弹层完整视觉、全队列遍历、留存证据编辑旅程均NOT VERIFIED且不属于本票声明。无新增核心写流，持久化写验收N/A；实际进入旧复盘会在隔离库更新2条reviews.updated_at，所有其他review字段与原始业务数据保持，证据PREVIEW-REVIEW-DIFF.json与FINAL-INVARIANTS.json。未写业务原库。CONSOLE.json为[]，不代表已消除首页显示的超时。

## 状态适用性
normal/selected适用；expanded为原生下拉选项（语义select不证明系统弹出菜单完整视觉）；empty通过组合筛选若适用检查，不注入假数据；loading/error保留真实首页现有异步错误观察，不恢复暂停财务任务；ambiguous为混合性质领域反例，使用业务测试；longtext沿用真实长中文标的/数值渲染；不新增hover或动画契约。
