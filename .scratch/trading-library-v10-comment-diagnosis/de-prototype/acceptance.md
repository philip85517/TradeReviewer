# D/E 视觉样例独立验收

日期：2026-10-24。结论：PASS（仅本次独立导航比较样例）；正式方案等待用户确认。Issue06 继续开放。

实现者：Luna / de_visual_impl。验收者：root，未编辑 UI 实现；亲自操作真实 IAB 浏览器并直接查看截图，没有以实现者报告代替验收。

## 版本与范围

HTML SHA256：`b2edaa29990315e364012b560bb07d9797c7842e1fb86f19a234a0dbe718213d`。触发：用户要求实现 D/E 视觉样例；开发后执行 frontend-control-audit。范围包括独立页面全部实际控件与八种主要状态。参考为 DESIGN-COVERAGE.md 的 DE01–DE08、revision11 评论诊断与原始截图；1440×1000、1280×800，DPR1。最后恢复浏览器默认视口，重新读取正常模拟统计，保留可见交付页。

视觉确认：D 标题/模式/页签在64px顶栏，E 在其下58px行；两组选择器间距18px。1440四态内 D 模式矩形始终(232,9.5,184,44)、E 始终(138,70.5,184,44)，页签分别(434,10.5,140,42)/(340,71.5,140,42)。完整八态截图逐一直接查看，宽度变化下不横向溢出。去重标题/面包屑/来源摘要，模拟紫色边界不改变尺寸；字体、列表密度、实盘6项及模拟2×4项指标保持一致。趋势点/线/标签自然比例，趋势与分布纵向排列。

为防比较工具遮挡内容，样例底部保留104px独立区域，main独立滚动。1280×800实测main bottom=696、比较器top=715.5；列表末行与统计末行通过浏览器点击定位到视区并直接截图确认可读。此比较工具属于原型，不是拟采用的产品导航。

## 版本绑定控件覆盖

| 控件/旅程 | 操作与判定 | 证据 | 结果 |
|---|---|---|---|
| D/E前后按钮、方向键 | 两方向切换；模式/页签/日期/预览保持，URL更新；D与E刷新保留方案并重置演示状态 | browser-evidence.json checks | PASS |
| 模式2项 | 鼠标、左右键；共享当前列表/统计，选中项焦点同步，日期按模式记忆 | 八态截图、checks | PASS |
| 页签2项 | 鼠标、左右键，选中状态与日期标签正确；L/S快捷键 | 八态截图、checks | PASS |
| 日期2项 | fixture/long；实盘成交或平仓日期、模拟练习保存日期；长日期可读 | *long*1280.png、checks | PASS |
| 预览3项 | 正常/加载/空；加载无指标曲线泄漏，列表空态为暂无记录、统计为空样本 | D-loading/D-empty/E-loading/E-empty截图 | PASS |
| 来源2项及返回 | 直接进入隐藏返回；首页显示单一返回；点击明确演示反馈且留在样例 | checks direct-no-return、return-demo | PASS |
| 分布单位2项 | 初始收益率选中；金额/收益率可切换，焦点保留，分布区间/频数随单位对应 | E-stats-bottom-1280.png、浏览器实操 | PASS |
| 全局1/2、L/S | 1/2模式、L/S页签，确认状态和保留焦点 | checks shortcuts-* | PASS |
| 长内容可达 | 列表11行、模拟6练习；统计底部在main内可滚动到达，工具不覆盖内容 | E-list-bottom-1280.png、E-stats-bottom-1280.png | PASS |

控件清单无遗漏：前后2、模式2、页签2、日期1、预览1、来源2、返回1、单位2，共13个实际控件（单位仅统计显示）。市场/账户为静态展示，侧栏/表行是视觉上下文，无业务入口承诺。截图/几何并非独立视觉判断的替代；本记录同时包含直接看图判断。

## 三道门槛与边界

- 样例功能旅程：PASS，上表及 browser-evidence.json。
- 样例状态安全：PASS，共享页面选择明确标为演示提议；两模式日期隔离；无数据库写入；只持久化URL方案。
- 视觉：PASS，8态1440截图+1280长日期、模拟统计、加载/空和滚动底部直接比对。历次FAIL见 REVIEW-LOG.md，失败截图保留。
- 真实业务持久化、返回首页恢复、搜索/排序/分页/详情：NOT APPLICABLE，本次静态样例范围不实现。
- 手机、物理/模拟触摸：NOT APPLICABLE，本次只做桌面布局；未宣称验证触摸。
- 原业务功能整体验收：NOT VERIFIED，本样例不代替生产交付，也不关闭Issue06。

## 静态验证和交付

node --check：PASS。git diff --check：PASS。浏览器error/warn日志为空。旧B比较稿、正式visual-spec、正文、生成器及评论5个文件哈希全部未改变（verification.json）。截图与证据哈希见manifest.json。

预览服务3090保持运行，最终真实浏览器读取正常页面。入口：
- http://127.0.0.1:3090/design-system/baselines/2026-10-22-trading-library-v1.0/navigation-de-prototype.html?variant=D
- http://127.0.0.1:3090/design-system/baselines/2026-10-22-trading-library-v1.0/navigation-de-prototype.html?variant=E

启动：`./docs/design-system/baselines/2026-10-22-trading-library-v1.0/start-preview.sh`。

签署：root，独立接受本次比较样例；设计选择仍由用户确认。
