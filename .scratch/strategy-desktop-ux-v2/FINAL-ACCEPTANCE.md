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
| 全量单测 | NOT PASS（既有基线失败） | [完整归因](acceptance/test-verification.md)；39失败全量，三文件单跑剩12且全部未修改HEAD同样失败，无当前独有失败；未改测试/超时掩盖 |
| 业务DB持久化/真实引擎/窄屏/触屏 | NOT APPLICABLE | 批准本轮是桌面内存原型，不代表正式产品豁免 |
| 输入方式 | 鼠标/键盘PASS；物理IME未实测 | 实际Space/Tab/ShiftTab/Escape/Home/End/arrows、真实拖动；composition守卫静态确认，与物理IME证据区分 |
| 用户设计认可 | 尚待用户试用反馈 | 技术验收不替代用户认可，不添加额外审批门槛 |

## 修复与责任

多位实现者按唯一文件owner使用gpt-6-luna/max；独立审查gpt-6-astra/low（用户称Astra Light，工具提供low）；root负责完整体验和真实浏览器操作。最后关闭的缺陷包括比较M回退、首屏日期轴裁切、Single仓位串组/筛选丢事件、交易定位后来源入口消失、来源scroll重置、过小关键字体、相同回撤标签重叠，以及1280 T0时间栏溢出。所有旧FAIL/截图保留；05/07受影响票按实际回归重新接受。

[07最终比较证据](acceptance/07.md) / [07独立复核](acceptance/reviewer-07.md)；[08最终完整旅程](acceptance/08.md) / [08独立复核](acceptance/reviewer-08.md)。截图分别位于screenshots/07与screenshots/08。原规格/Wayfinder父票保持未关闭，后续生产开发另按原产品规格推进。
