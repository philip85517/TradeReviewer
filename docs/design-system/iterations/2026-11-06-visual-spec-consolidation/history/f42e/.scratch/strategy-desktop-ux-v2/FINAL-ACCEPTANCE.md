# 策略桌面 UX v2 最终验收

2026-09-30；状态：**ACCEPTED（桌面原型技术验收）**。root完整旅程与Astra独立最终审查均PASS，01–08任务全部接受。

本交付是批准的TradeReview桌面交互原型：合成数据、会话内存，刷新重置。支持四步创建、独立本金多组合、逐日行情揭示、调仓/部分成交/未成交回看、配置派生、异常恢复、结果分析与共同区间/非同步比较。真实行情/财报集合、真实引擎、API/DB持久化、插件开发、窄屏不在本轮范围；原产品需求仍保留，未将原型计算当作生产回测。

## 预览与启动

[打开策略交互原型](http://127.0.0.1:3047/?prototype=strategy-create&variant=A)。交付前真实浏览器tab6重新加载已确认空列表可新建、error/warn日志为空；服务PID47927继续监听127.0.0.1:3047。刷新会丢弃原型实验，页面始终说明此边界。两档接受尺寸1440×900/1280×800、DPR1、100%；临时override收尾已恢复用户浏览器默认。

在当前工作区启动：

```sh
cd /Users/zhoulin/.codex/worktrees/0972/TradeReview
TRADEREVIEW_DB_PATH="$PWD/.scratch/strategy-portfolio-backtesting/prototype-isolated.sqlite" npm run dev -- --hostname 127.0.0.1 --port 3047
```

本服务已运行，不必重复启动。显式隔离DB用于原型验收，业务数据库和conf/runtime.json共享路径保持原样；无推送、合并、发布。

## 独立门槛

| 门槛 | 结果 | 证据 |
| --- | --- | --- |
| 批准需求/元素/旅程 | PASS（root与独立总审） | [逐项设计覆盖](DESIGN-COVERAGE.md)、[完整旅程](acceptance/08.md) |
| 功能与时间安全 | PASS | 01–07各acceptance；08实际V/M/Mi/R、checkpoint、事件来源返回、隐藏快捷键、reload |
| 完整浏览器端到端 | PASS | [08](acceptance/08.md)新会话J1–J7/B1–B4；六组未改模块明确引用07最终同版本证据 |
| 独立视觉 | PASS（独立最终签署） | [reviewer-08](acceptance/reviewer-08.md)，1440/1280创建/运行/调仓/回看/异常/结果/比较；X08-01修后关闭 |
| TypeScript | PASS | final-typecheck.log，exit0 |
| ESLint限定变更 | PASS（0error/2warning） | final-eslint.log；stage/selectedStrategy未使用参数警告保留，非阻断 |
| 构建 | PASS | final-build.log；最终CSS修后、隔离DB env，exit0 |
| 差异空白 | PASS | git diff --check exit0 |
| 全量单测 | NOT PASS（既有基线失败） | [完整归因](acceptance/test-verification.md)；原验收39失败及基线归因保留；最新master整合后2720通过/1失败/6跳过，唯一失败在未修改master同样复现；未改测试/超时掩盖 |
| 业务DB持久化/真实引擎/窄屏/触屏 | NOT APPLICABLE | 批准本轮是桌面内存原型，不代表正式产品豁免 |
| 输入方式 | 鼠标/键盘PASS；物理IME未实测 | 实际Space/Tab/ShiftTab/Escape/Home/End/arrows、真实拖动；composition守卫静态确认，与物理IME证据区分 |
| 用户设计认可 | 尚待用户试用反馈 | 技术验收不替代用户认可，不添加额外审批门槛 |

## 修复与责任

多位实现者按唯一文件owner使用gpt-6-luna/max；独立审查gpt-6-astra/low（用户称Astra Light，工具提供low）；root负责完整体验和真实浏览器操作。最后关闭的缺陷包括比较M回退、首屏日期轴裁切、Single仓位串组/筛选丢事件、交易定位后来源入口消失、来源scroll重置、过小关键字体、相同回撤标签重叠，以及1280 T0时间栏溢出。所有旧FAIL/截图保留；05/07受影响票按实际回归重新接受。

[07最终比较证据](acceptance/07.md) / [07独立复核](acceptance/reviewer-07.md)；[08最终完整旅程](acceptance/08.md) / [08独立复核](acceptance/reviewer-08.md)。截图分别位于screenshots/07与screenshots/08。原规格/Wayfinder父票保持未关闭，后续生产开发另按原产品规格推进。

## 2026-09-30 远端整合补充

此前“无推送、合并、发布”为原验收交付时的历史状态。用户随后明确授权提交远端分支并合并 master；已先合入最新 master、推任务分支并创建 [PR #35](https://github.com/philip85517/TradeReviewer/pull/35)。本轮整合复验及限制见 [REMOTE-INTEGRATION.md](REMOTE-INTEGRATION.md)，既有验收历史与失败证据保留。最终远端合并和本地 master 同步结果以 PR 与当前聊天记录为准。

## 2026-09-30 第一轮用户反馈（后续范围）

用户指出当前实验列表缺独立策略库，要求完整策略由标的筛选、买入信号、止盈止损三类包组成，实验选择已有策略、可就地新建及复制历史策略；先给交互模型再设计开发。已写入[增补规格](../../docs/specs/2026-09-30-strategy-library-and-experiments.md)、[09 交互模型](../strategy-portfolio-backtesting/issues/09-strategy-library-interaction-model.md)和[10 原型](../strategy-portfolio-backtesting/issues/10-strategy-library-creation-prototype.md)。

本次仅文档，未变更已验收代码，旧技术接受和失败证据原样保留；新增策略库、三类组装与复制/新建返回均 NOT VERIFIED，未获用户模型或整功能接受。不得用本报告关闭新增票。此补充没有重新验证预览服务或原测试结论。

同轮用户补充当前工作台与 TradingView 截图，要求先比较控件/布局风格并沉淀稳定布局方案。见[方案正文](../../docs/specs/2026-09-30-strategy-stable-workbench-design.md)、[11 交互模型](../strategy-portfolio-backtesting/issues/11-stable-workbench-interaction-model.md)和[新增覆盖](../strategy-portfolio-backtesting/DESIGN-COVERAGE.md#稳定工作台反馈2026-09-30)。固定框架、底部回放条与紧凑摘要均待新模型/原型验证；本报告的旧视觉 PASS 不签署这些变化通过。尚未测量当前抖动原因或新方案位移，不将设计反馈当作代码回归结论。
