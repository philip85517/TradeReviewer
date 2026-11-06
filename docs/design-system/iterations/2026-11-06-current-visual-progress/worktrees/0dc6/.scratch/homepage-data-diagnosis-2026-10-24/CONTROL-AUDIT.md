# 桌面局部读取旅程诊断

- 触发：用户要求诊断首页无交易信息，对比旧交易库及失败状态；适用 frontend-control-audit.md。
- 范围：首页读取终态、普通交易库交易性质选择、首页进入交易库、返回首页及这几条路径的数据/错误状态；不是整页设计交付或全控件巡检。
- 负责人：root，未实现本轮产品代码；不以 worker 报告签收。
- 版本：C4 884源码冻结文件无变化，9入口资源hash相同；[版本/运行绑定](VERSION-AND-DATABASE.json)。PID60461，4392，显式candidate.sqlite副本；路径及原始数据核对见同文件。
- 视口：本轮截图1440×1000 CSS，DPR1，最终DOM rootZoom=1、scroll0/0；首次发现的319px页面只作为起始状态，**不作为桌面验收证据**。
- 参照：用户要求“旧库已有导入，首页需可诊断读取”，当前既有UI文案/状态；未新增布局，无正常数据V2.5视觉还原PASS声明。

| ID | 控件/状态及操作 | 应观察到的结果 | 实际结果 | 证据 | 结论 |
| --- | --- | --- | --- | --- | --- |
| C01 | 普通交易库→返回首页 | 能读取终态并区分成功/失败 | 两次终态timeout；期间无数据，持仓0 | home-desktop.jpg、home-warm-desktop.jpg、home-final-full-AX.txt | 数据旅程FAIL，复现覆盖 |
| C02 | 首页超时后→进入交易库 | 传递首页范围且能解释数据差异 | URL含scope=live/market=all；0标的0回合 | home-scoped-trades.jpg、home-scoped-trades-AX.txt、PROBE.json | 导航PASS；与普通库语义不一致 |
| C03 | 左侧交易库→普通共享范围 | 进入普通库 | /trades，无首页query，原选中模拟盘4标的/32回合 | trades-before-AX.txt、后续DOM与分类探针 | 导航PASS；前一文件仅起始窄屏，不作桌面布局证据 |
| C04 | 普通库交易性质下拉→实盘 | 核对原已导入实盘显示 | 232标的/732回合，列表存在持仓中项目 | legacy-live-trades.jpg、legacy-live-trades-AX.txt | 普通库可见性PASS，不能证明严格财务资格PASS |

局部操作场景4/4已执行且有证据；这里的覆盖率不等于功能通过率，也不等于全部控件覆盖。性质选择只测本次需要的实盘和已有模拟状态，未全面测试其他选项/账户/市场组合。

| Finding | 观察及影响 | 类型/严重性 | 跟踪 |
| --- | --- | --- | --- |
| F01 | 同写实盘却普通库非零、首页集合0；缺显式性质 | 数据资格合同，主要 | issues/02-source-semantics.md |
| F02 | 首页读取超时，不发布新结果 | 功能，阻断 | issues/03-timeout.md |
| F03 | timeout后仍“期间数据读取中”；持仓显示暂无并建议导入 | 失败状态表达，主要 | issues/04-failure-observability.md |
| F04 | 历史区明确not-wired | 既有未接线范围，非数据库丢失 | DIAGNOSIS.md；不创建修复完成结论 |

空间观察：直接查看home-desktop与legacy-live桌面截图；首页保留顶栏、指标、曲线槽和持仓表，未以窄屏冒充。没有对照批准正常财务状态的原稿、没有量化动画/布局移动；视觉还原 **NOT VERIFIED**，不从无溢出推断通过。

输入证据：浏览器语义click/selectOption实际操作。未测独立键盘、模拟触控、物理触屏，均 **NOT VERIFIED**；本次诊断不需以这些输入证明读取因果。保存/导入/持久化写入门槛 **NOT APPLICABLE**，因为没有执行写流；原始业务库只读。取消、刷新后的完整财务数据、全部控件及正常态视觉未测，不能作为产品完成。

最终root裁决：诊断范围已完成；首页功能及整体1秒目标 **FAIL**，正常态视觉 **NOT VERIFIED**。本轮未修复，不增加任何实施候选轮次。当前最终页 [首页](http://127.0.0.1:4392/home) 仍显示同一timeout终态，服务保留运行。
