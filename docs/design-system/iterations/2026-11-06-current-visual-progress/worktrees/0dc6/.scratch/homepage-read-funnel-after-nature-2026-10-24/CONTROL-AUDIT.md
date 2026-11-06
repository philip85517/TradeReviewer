# 当前读取状态局部审计

触发：用户要求确认首页不展示的当前卡点；适用 frontend-control-audit。Owner/root 独立观察，无本轮 UI 实现者。范围：交易库已有实盘计数、返回首页、首页重载后的读取/失败显示。排除：全控件清单、修复按钮执行、导入、复盘写入、播放、窄屏适配、键盘和触控。只读诊断不授权修复，不称完整UI交付。

版本：evidence/HTTP-VERSION.json 固定全部源码/构建 hash；HEAD58bf0d9，dirty 候选与性质验收相同。数据库为 preview.sqlite 隔离副本。未执行写控件、未改数据库或产品代码；本轮没有重新做全库逻辑摘要审计。

视觉要求：按用户要求使用1440×1000桌面，检查现有桌面导航、四卡、曲线、持仓层级中的实际数据状态，不实施视觉设计变更。最初自然视口截图实际304px宽，原文件home-desktop.jpg仅作被排除的窄屏观察，不能作为桌面证据；随后显式设1440×1000、重载、观察和截图，最终以desktop-1440x1000.jpg为准。root已直接看图，确认桌面横排卡片与左侧导航，超时/空槽可见；未声明对V2.5全部视觉设计重新验收。

|ID/旅程|版本绑定证据|诊断检查|产品行为|
|---|---|---|---|
|C01 实盘库计数|trades-AX.txt|PASS，226标的726回合；该初始AX不单独证明桌面尺寸|性质子范围结果仍非零|
|C02 返回首页|home-initial-AX.txt、home-settled-AX.txt|PASS，记录读取→超时；此次自然视口不计桌面证据|首页FAIL，未展示财务|
|C03 桌面重载|desktop-initial-AX.txt、desktop-settled-AX.txt、desktop-1440x1000.jpg|PASS，1440×1000真实浏览器复现|首页FAIL，超时、指标—、持仓空槽|
|C04 日志与异常|browser-errors.json、服务SERVER.log|未捕获额外error；不是无异常保证|unknown/unavailable不抛错，详FUNNEL|

问题继续归入原诊断 issues/02、03、04及暂停财务任务；不创建重复修复候选。范围内首页产品失败明确保留，不因诊断成功标为通过。
