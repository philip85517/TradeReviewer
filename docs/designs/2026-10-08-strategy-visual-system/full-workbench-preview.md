# 完整 Workbench 视图恢复 · 2026-10-08

2026-10-09：完整预览进一步按当前首页候选校准共用视觉，见 [0.6 复用规则](homepage-style-reuse.md)。恢复与本次视觉统一分别保存验收证据；下文为原恢复范围的记录。

本次回答“旧 benchmark 的动态视图去了哪里”，恢复可达、可操作的完整预览。旧完整组件一直保留在 `app/components/strategy-prototype/`；此前当前 A 紧凑样板只接入部分分析视图。仓库未找到 GIF/MP4/WebM/APNG 资源；用户所说的“动图”很可能指可交互图表和回放，这是依据组件与资源调查的判断，不是对用户记忆的确证。

## 直接预览

- [完整工作台：净值 / 标的 K 线 / 持仓 / 调仓事件](http://127.0.0.1:3069/?prototype=strategy-workbench&view=observe&scene=complete)
- [完整结果：净值 / 回撤 / 仓位 / 损益 / 贡献 / 费用 / 成交](http://127.0.0.1:3069/?prototype=strategy-workbench&view=results&scene=complete)
- [完整比较：双组合指标与三种比较图](http://127.0.0.1:3069/?prototype=strategy-workbench&view=compare&scene=complete)
- [当前 A 样板：点击范围栏“全部视图”](http://127.0.0.1:3069/design-system-20261008/workbench/index.html)

这是开发环境中的内存合成演示。默认三个月、两种策略、各自本金 ¥100,000，完整场景已展开至 2024-09-13。顶部可以切到 T0 或第十个交易日，继续真实逐日/播放。刷新回到所选预设；切换导览会重开对应演示。完整历史布局和当前 A 的密度不同，完整分析还没有迁入 A。旧 B/C 不在本次恢复范围。

## 恢复范围与取舍

复用原 RunningPrototype、ResultsPrototype、ComparisonPrototype、图表、账本与来源恢复逻辑；增加开发入口、明确标注的预设和导览。原四步创建仍从 T0 开始，没有提前揭示行情。

当前 A 的“全部视图”提供九个切面：完整净值、标的 K 线、阶段结果、组合比较、事件列表、事件日详情、统计指标、完整明细、只读配置；以及七场景：T0、运行中、历史回看、已完成、加载、失败、长文本与六组合。导览复用既有弹层，Escape 关闭并返回打开按钮焦点。

本票保持旧完整页的信息层级和数据字段，未将旧布局强塞入 A 的固定空间预算。完整页新增顶栏和预设说明，是授权的布局差异。旧批准截图为一周数据，新样板是三个月双策略；不能称为相同数据的像素复刻。根代理另在修改前用原四步创建生成同一三个月双策略，保存 1440 对照。图表视野继续使用原组件契约，不声称所有三个月数据都同时处于屏幕可见范围。

## 实际浏览器证据

截图根：`.scratch/strategy-visual-system-20261008/evidence/`，两档桌面 1440×900 / 1280×800，DPR 1。下方链接均为本次真实运行画面，非旧图替代。

|旅程|结果与证据|
|---|---|
|完整观察两图|[净值 1440](../../../.scratch/strategy-visual-system-20261008/evidence/full-restore-observe-net-final-1440.png)、[K 线 1440](../../../.scratch/strategy-visual-system-20261008/evidence/full-restore-observe-candles-final-1440.png)、[净值 1280](../../../.scratch/strategy-visual-system-20261008/evidence/full-restore-observe-net-final-1280.png)、[K 线 1280](../../../.scratch/strategy-visual-system-20261008/evidence/full-restore-observe-candles-final-1280.png)|
|结果三图|[净值 1440](../../../.scratch/strategy-visual-system-20261008/evidence/full-restore-results-net-final-1440.png)、[回撤 1440](../../../.scratch/strategy-visual-system-20261008/evidence/full-restore-drawdown-after-1440.png)、[仓位 1440](../../../.scratch/strategy-visual-system-20261008/evidence/full-restore-position-after-1440.png)；1280 最终三图使用 `full-restore-results-{net,drawdown,position}-final-1280.png`|
|结果下方完整字段|[1440 实际滚动](../../../.scratch/strategy-visual-system-20261008/evidence/full-restore-results-lower-after-1440.png)、[1280 实际滚动](../../../.scratch/strategy-visual-system-20261008/evidence/full-restore-results-lower-final-1280.png)：两标的贡献、FIFO说明、费用、滑点、换手597.63%、14条事件；fullPage截图不代替内部滚动证据|
|比较三图|`full-restore-comparison-{net,drawdown,position}-after-{1440,1280}.png`，最终导航首屏[1440](../../../.scratch/strategy-visual-system-20261008/evidence/full-restore-comparison-net-final-1440.png)；共同截止2024-09-13、两组独立本金|
|真实推进|`full-restore-t0-after-{1440,1280}.png` / `full-restore-first-bar-after-{1440,1280}.png`：T0现金100%、无持仓 → 6月17新增实际 K 线和首次成交、现金与持仓同步|
|播放与重置|[第十日 1280](../../../.scratch/strategy-visual-system-20261008/evidence/full-restore-running-final-1280.png)；`full-restore-running-play-paused.txt` 记录6/28播放至7/12后暂停，图与资产更新；重复选择同一 T0/第十日会真正重置，见两份 `*-reset.txt`|
|来源恢复|结果首次建仓事件→6/17→返回结果，R恢复9/13，原仓位页签和筛选保留：`full-restore-result-event.txt` / `full-restore-result-return.txt`；比较事件返回原比较与仓位：`full-restore-comparison-return.txt`|
|原创建|实际再走四步创建→T0→实验列表；`full-restore-original-create-t0.txt` 证明尚未开始、零持仓、现金100%|
|导览两档与键盘|[1440](../../../.scratch/strategy-visual-system-20261008/evidence/full-restore-guide-final-1440.png)、[1280](../../../.scratch/strategy-visual-system-20261008/evidence/full-restore-guide-final-1280.png)，Tab到链接、Escape关闭与焦点返回；导览元数据实测12px/18px|
|A九切面与七场景|`full-restore-a-presets-final.json` / `full-restore-a-scenes-final.json` 保存逐项DOM，每项对应 `full-restore-a-*-final-1280.png` 和 `full-restore-a-scene-*-final-1280.png`；旧 scenario=running 和新 preview=event 刷新入口已验|
|最终直达/硬刷新|`full-restore-results-reload-final.txt` / `full-restore-comparison-reload-final.txt`，实际进入结果/比较主区；从结果切T0归一到observe并禁用结果，`full-restore-t0-from-results-final.txt`|

## 验证边界与保留的失败

根代理在最终源码独立执行：scope ESLint、`npm run typecheck`、HTML inline JS `node --check`、`git diff --check` 全部 exit 0。最终入口检查期间控制台新增 error 为零，见 `full-restore-final-console.json`。全仓 `npm run lint` **FAIL：17 errors / 1645 warnings**；16个错误来自两份已有 LWC vendor，1个来自本票未改的 RecallDesignPrototype effect。不能称全仓通过。相关原始输出在 reports/full-restore-*.txt；未重跑全部测试，既有31测试失败记录保持。

历史 FAIL 保留：导览内容存在但弹层隐藏、SSR/client SVG描述不一致导致 hydration overlay、两条新增 effect lint 失败，以及 StrictMode 下已取消 microtask 提前消费初始化标志。修复后分别重新验导览、两入口直达与硬刷新、限定 lint；旧 FAIL 截图和日志不删除、不改标成通过。最终版本和证据快照见 [full-restore-manifest.json](../../../.scratch/strategy-visual-system-20261008/evidence/full-restore-manifest.json)。部分三图与来源旅程截图拍于元数据/初始化修复前，后续未改原分析组件；清单记录捕获时间，不将所有旧图称最终源码重拍。

独立视觉审查由未实现本票的 benchmark_inventory 直接查看新图、旧批准图与修改前同数据图：[审查记录](../../../.scratch/strategy-visual-system-20261008/reports/full-restore-visual-review.md)。本次桌面入口恢复和完整页字段可达性是独立范围；原视觉规范总体票保持 open。Tooltip/wheel全未来信息覆盖、真实引擎/SQL保存、完整Text编辑/IME、导出、Windows字体与缺失启动包仍 **NOT VERIFIED**。本票演示不写数据库，业务持久化门槛 **NOT APPLICABLE**；物理/模拟触摸不在桌面恢复范围，不能据此声称移动接受。A最小宽1100与旧完整页窄窗限制保持。

当前浏览器小面板实图为399×694，仅证明服务和入口仍运行；不作桌面视觉接受，预览时需要展开面板。截图接口实际返回JPEG，即使既有文件名以.png结尾；清单按真实文件头解析格式和尺寸。初次错误的PNG头尺寸读取已在接受前修正。root依据自身实际旅程和独立视觉/代码PASS，关闭范围票02/03；规范总体票01继续open。

## 启动与后续融合

服务当前在3069运行，测试数据库为 `.data/strategy-visual-acceptance.sqlite`。在本工作树重启已有隔离环境：

```sh
TRADEREVIEW_DB_PATH="$PWD/.data/strategy-visual-acceptance.sqlite" \
WRANGLER_LOG_PATH=.wrangler/strategy-visual.log \
PATH="/usr/local/Cellar/node/26.0.0/bin:$PWD/node_modules/.bin:$PATH" \
node scripts/start-local.mjs --dev --port 3069 --hostname 127.0.0.1
```

测试文件不存在时，按 [既有接受记录](acceptance.md) 从业务库在线backup到新隔离文件；不得回落共享业务库。没有推送、合并或发布。

样板选定后，A正式融合的具体范围：结果图头复用三种图切换；检查/详情区容纳损益、贡献、费用和完整事件；比较保留共同截止、三图、独立本金和来源恢复；回放保持V/M/Mᵢ/R与图表视野契约。再将选定文字角色、焦点和图标参数推广到公共组件，并补完整业务保存→返回→刷新与对应视口独立视觉接受。此融合尚未实施。
