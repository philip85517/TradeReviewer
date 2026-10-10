# 完整 Workbench 恢复：独立视觉与代码审查

审查者：benchmark_inventory；未参与实现。2026-10-08。本轮只写本报告；未启动服务、未操作共享浏览器。root 负责实际旅程与最终功能接受。

## 审查范围与 Declined to judge

源码只审查新增 `full-workbench-preview.tsx/css`、`RunningPrototype` 的 `initialPreview/initialView` seam、`app/page.tsx` 新开发路由，以及 public A 新导览/preview 参数。对照基础 `9c2b3d209a202422c3d5aeab5969a9b093cfda92` 的 working diff，未使用 HEAD~1。

未判断以下内容：

- `review-design`、Recall 及其他本轮并行变更；旧账本、结果、比较组件的完整业务算法审计。
- 浏览器鼠标/键盘动作链、焦点真实移动、事件返回来源后筛选/截止保持、同 query 重置、原创建实际旅程。审查者不操作浏览器，这些功能 gates 由 root 单独接受；截图或源码不能替代动作链。
- 真实引擎、SQL/生产持久化、物理触摸、1100px 以下布局。合同是纯内存桌面合成恢复；本票为 NOT APPLICABLE，不覆盖其他票原有 NOT VERIFIED。
- 每个 A 预设和状态在 1440 下的完整矩阵。本轮直接查看全部 1280 边界截图，并查看 1440 目录/K线代表截图；不声称已查看不存在的完整双档矩阵。

## 范围内结论

**本票独立视觉审查 PASS；范围内代码审查 PASS，无未解决的范围内 findings。** 完整版观察、结果、比较、T0/首步和运行中均有真实图表截图；当前 A 九切面及七状态全部有直接看图证据。独立审查不等于整体项目完成接受。

历史 FAIL 均保留在下文，最终修复有独立源码及后续实际截图依据。DOM、worker 报告和代码存在性不替代本报告的视觉判断。全仓 lint 最终仍 **FAIL：17 errors / 1645 warnings**，不能被本票 scoped PASS 覆盖。

## 合同、参考与授权差异

已读取 `full-restore-contract.md`、`issues/02-full-workbench-preview.md`、`issues/03-workbench-view-guide.md`、`DESIGN-COVERAGE.md` F01–07/G01–04，以及：

- `docs/specs/2026-09-29-strategy-desktop-ux-design.md` DD05–09 / TD01–02。
- `docs/specs/2026-09-30-strategy-stable-workbench-design.md` WD06。
- `.scratch/strategy-portfolio-backtesting/workbench-design/STYLE-04-CONTRACT.md`。

直接查看的恢复前参考：本次 `evidence/full-restore-before-{results,drawdown,position,comparison,t0,first-bar}-1440.png` 六图；旧完整原型 `.scratch/strategy-desktop-ux-v2/screenshots/integration/{results,comparison,t0,first-bar}-1280.png` 四图，以及 `screenshots/05/stage-drawdown-fixed-1440.png`、`stage-weights-1280.png`。

直接查看的 STYLE04 参考：`style-04-evidence/complete-{1440,1280}.png`、`t0-1280.png`、`running-1280.png`、`pressure-1280.png`、`failure-1280.png`、`result-1280.png`、`compare-1280.png`、`event-1280.png`、`config-1440.png`。

新完整入口使用三个月双策略预设，旧完整参考部分是一周 fixture；比较布局、层级、截止和可读性，不比较收益数值/曲线像素。新增独立导览取代完整原型旧外层200px展开导航，是已登记的独立历史布局入口；不称旧壳像素等同，也不误判为当前 A 54px rail 的回归。当前 A 的54px rail、横栏、44px图头/回放、320px右侧详情预算保持。

图片均用 `view_image` 原始尺寸逐张查看。本文记录图片像素尺寸；100%缩放、viewport/DPR由 root 浏览器测量记录证明，审查者不从图片推断未提供的浏览器参数。

追加证据注意：审查者额外查看 `full-restore-delivery-actual.png`，其实际为399px窄面板，控制在窄宽度挤压；它不作为上列桌面PASS依据，也不声称移动端通过。首次 `full-restore-manifest.json` 的多项 `pixel_dimensions=[65536,4292542531]` 明显有误，已通知root修证据元数据；源码SHA独立一致。该元数据问题不替代实际逐张看图，也不把窄面板升格为桌面截图。

## 直接看图与视觉 gates

以下文件均在 `.scratch/strategy-visual-system-20261008/evidence/`，所有列出的展开形式均已直接查看。

|Gate|实际截图与观察|结论|
|---|---|---|
|V01 / F01–02：完整观察与预设说明|`full-restore-observe-{net,candles}-final-{1440,1280}.png`：真实净值曲线、K线、建仓/再平衡标记、T0/V线、持仓与事件均可读；两档无新增横向裁切。完整截止9/13。新12px/18px说明明确合成、已展开、刷新及切换重置边界；1280净值图已向下滚动，不将顶部离屏误判为遮挡。|PASS|
|V02 / F03–04：结果三图|`full-restore-results-net-final-1440.png`、`full-restore-{drawdown,position}-after-1440.png`、`full-restore-results-{net,drawdown,position}-final-1280.png`：区间→覆盖→四项摘要→三图+右侧损益的原层级保留；回撤负值区、仓位标的/现金图例、R=9/13与图下读数清晰。|PASS|
|V03 / F05：完整分析内容|`full-restore-results-lower-after-1440.png`、`full-restore-results-lower-final-1280.png`：实际滚动后贡献拆分、费用/滑点、换手口径、再平衡事件列表完整可见，非只有标题；焦点环可见。`full-restore-result-event-after-1440.png`：触发/已知原因、旧/目标/实际权重、成交费用与来源返回入口可读。返回动作本身另验。|PASS|
|V04 / F06：比较三图|`full-restore-comparison-{net,drawdown,position}-after-{1440,1280}.png` 六图及 `full-restore-comparison-net-final-1440.png`：口径矩阵、共同区间、R=9/13、实线/虚线双曲线、负值回撤、单组合仓位选择和现金图例清晰；无横向裁切。部分图已滚动以完整展示主图。|PASS|
|V05 / F07：阶段与真实推进|`full-restore-t0-after-{1440,1280}.png`、`full-restore-first-bar-after-{1440,1280}.png`：T0截止6/14、现金100%、无持仓/事件；首步6/17真实新bar、首次建仓标记、A/B持仓出现。`full-restore-running-after-1440.png`、`full-restore-running-play-after-1440.png`、`full-restore-running-final-1280.png`：运行预设6/28，播放后7/12有更多真实bar/事件与持仓；1280截止6/28，没有未来轴/主图。截图显示状态差异，动作链另验。|PASS|
|V06 / G01–02：目录、入口与布局|`full-restore-guide-final-{1440,1280}.png`：完整/当前两组区分明确，历史深切面未迁入 A 的说明可读，九预设及七状态均存在；12/18次级字号修正。1280内部滚动使底部关闭按钮需滚动，顶部X可见；未误认截断为不可达。`full-restore-a-candles-1440.png`及最终1280 K线与STYLE04预算对应。|PASS|
|V07 / G03–04：A全部切面与状态|`full-restore-a-{overview,candles,results,compare,events,event,metrics,detail,config}-final-1280.png` 九图；`full-restore-a-scene-{t0,running,review,complete,loading,error,pressure}-final-1280.png` 七图：完整净值/K线、结果摘要、共同比较、事件列表/日投影、指标费用、明细与配置可读。加载为明确占位；失败保留身份/最后完整日/原因；pressure长标题省略且金额、持仓和截止不挤压栏位。相同状态旧STYLE04参考无新增布局回归；不声称完成1440全矩阵。|PASS（所列桌面证据范围）|

已查看但被最终图替代的旧 after 仍保留：`full-restore-guide-after-{1440,1280}.png`、`full-restore-results-after-1280.png`、`full-restore-results-after-1280-full.png`、`full-restore-results-after-1440.png`。旧1280 fullPage只显示到贡献/事件标题，曾为 NOT VERIFIED；最终真实下部滚动图关闭该视觉缺口。

## 最终源码与代码 gates

最终五文件SHA256经审查者独立重新计算：

|文件|SHA256|
|---|---|
|`app/page.tsx`|`a57b648f9b98fee573505f60623000c1422b75cde0de713c0fc5c707718e25c3`|
|`app/components/strategy-prototype/running-prototype.tsx`|`2aa19e1aa980837455e4018b97c0b2a85fc2cdb6ab2dff669d668dc3a98f8989`|
|`app/components/strategy-prototype/full-workbench-preview.tsx`|`e4229c54deb238c3402e593c741c53a3c6e91390717d45b47dc5ced7d3bef8cf`|
|`app/components/strategy-prototype/full-workbench-preview.css`|`809d895322c61399d060fc796c397bea7924aeada635bc5fa0a2a51b22308bdd`|
|`public/design-system-20261008/workbench/index.html`|`4ff8a3374f3d8e59deeefafe7e8cabe01fc6bed8a59ff9ac255617332043c235`|

|Gate|范围内源码结论|
|---|---|
|C01 开发专用与原创建|PASS：新入口有 `NODE_ENV !== production` gate；scene/view受限，T0规范为observe。原创建分支保持；未传preview仍从T0初始化。|
|C02 状态/账本复用|PASS：只初始化原cursors、各Mi及暴露记录，经原enterResults/enterComparison进入。没有第二套分析或回放状态机；账本/来源恢复函数未改。|
|C03 未来边界与重置|PASS（源码）：T0/running最大截止受限；完整预设说明显式；resetNonce使同场景再次选择也重挂原会话。root实际reset/场景切换记录另附，不由源码代替。|
|C04 返回来源与焦点|PASS（源码）：原结果/比较返回上下文保持；guide记录原opener、关闭恢复与Escape处理。实际鼠标/键盘焦点链由root另验。|
|C05 A参数与旧链接|PASS（源码）：无query默认complete；旧scenario链接保留；preview显式按既有setScenario/setTab/switchChartMode/enterEvent动作打开，未重写数据/截止。完整/原创建有准确dev入口。|
|C06 SSR与StrictMode|PASS（源码）：useSyncExternalStore的serverSnapshot=false保证SSR/首次hydration一致占位后挂原Running；初始视图microtask先检查cancelled/ref，再提交ref并进入目标视图。StrictMode首setup清理不再吞掉第二setup的初始导航。最终结果/比较实际截图正常；root另提供最终硬刷新记录。|

独立运行 `./node_modules/.bin/eslint app/page.tsx app/components/strategy-prototype/running-prototype.tsx app/components/strategy-prototype/full-workbench-preview.tsx`：**exit 0，无输出**。审查者未运行全仓typecheck/inline-JS/diff检查；root报告这些 scoped 命令exit0，最终接受记录需附命令/退出码，不能把空日志本身当退出码证据。

## 保留的历史 FAIL 与修复依据

1. **目录隐藏层 FAIL**：`full-restore-guide-1440.png`点击后未显示弹窗。`openViewGuide`补 `els.modal.hidden=false`；最终两档目录图直接显示完整内容，修复 PASS。旧图不删除。
2. **SSR hydration FAIL**：`full-restore-hydration-fail-1440.png`脚本错误覆盖页面。旧SSR渲染隐藏ComparisonChart SVG title存在差异；新wrapper先输出一致占位、随后client挂原组件。最终结果/比较图无错误层；root最终entry/reload记录及console检查另存。旧FAIL不改写。
3. **[P2] A目录11px辅文 FAIL**：A `3309bf4a…`的 `.view-guide-grid small`低于STYLE04 ST02/U02。A `4ff8a337…`修12px/18px；`guide-final`两档直接看图 PASS。旧after仍保留。
4. **同场景重选反例**：旧wrapper key只有scene/view，router.replace相同query可能保留当前state。`09887d4a…`加入resetNonce，最终 `e4229c54…`保留；源码修复 PASS。root `full-restore-t0-reset.txt` / `running-reset.txt`实际接受独立归属。
5. **[P2] wrapper默认small过小 FAIL**：旧CSS `09ba7532…`只设颜色，约10px常驻预设边界不清楚。新CSS `809d8953…`明确12/18，最终1440观察/结果/比较和1280观察/运行/结果顶部说明直接看图 PASS。
6. **[P1] StrictMode吞掉初始导航 FAIL**：running `cc740f5c…`在排microtask前提交ref；StrictMode清理取消首任务，第二setup因ref=true跳过。审查者指出本地Next默认App StrictMode及React passive-effect disconnect/reconnect反例。最终 `2aa19e1a…`把ref提交移入未取消callback，源码修复 PASS；最终结果/比较首屏直接看图正常。root提供 `full-restore-{results,comparison}-reload-final.txt` 与 `full-restore-comparison-entry-final-1440.txt`证明最终浏览器reload，本文不将旧同步effect截图代替这轮证据。
7. **全仓 lint FAIL 保留**：历史 `full-restore-repository-lint-historical-fail.txt`为19 errors /1645 warnings；最终 `full-restore-repository-lint.txt`仍17 errors /1645 warnings（16 vendor与既有Recall effect）。本票三TSX scoped eslint exit0不等于全仓通过。

## 独立审查未验证与最终接受归属

审查者的功能旅程 gate 保持 **NOT VERIFIED BY THIS REVIEWER**：完整入口硬刷新、实际导航、事件→来源恢复、选择/筛选保持、播放暂停、同query重置、原创建与鼠标/键盘焦点操作。root已提供对应运行记录和截图；root须在其最终接受记录中独立接受，不能将本报告的视觉/源码 PASS 替代这些 gates。

本轮未发现仍未修复的范围内严重视觉差异或代码缺陷。恢复的强项是直接复用完整原型原图表/分析/上下文，并通过清楚的历史入口和合成预设边界保留当前 A 的布局。结论仅覆盖上列文件、冻结SHA和实际看过的截图。
