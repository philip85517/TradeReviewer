# 交易室实施与交付记录

状态：9 张任务完成，独立 QA 最终通过；预览与验证结果在当前聊天交付。

## 交付范围

9 张本地任务已发布并完成。两名 gpt-5.6-luna / max 子代理按不重叠文件开发、自测；独立同模型 QA 对照 spec 审查、构造反例并复验。协调者审查实际代码并亲自完成浏览器验收。

范围包括四类互斥分类与全局汇总、自然月日期、实盘/模拟运行隔离、趋势/三级日历、当前持仓、成本收益率/自然月胜率、四类独立本金、最新中行折算价及四维数据质量。

## 预览与启动

- 预览：[http://localhost:3030/](http://localhost:3030/)
- 工作区：`/Users/zhoulin/.codex/worktrees/247d/TradeReview`
- 数据库：`.scratch/trading-room-implementation/acceptance.sqlite`，正式库的 SQLite 一致性备份；所有写入验收均在副本或专用样例库。
- 服务：session 57273、PID 34449，绑定 127.0.0.1:3030，保留运行。
- 最后检查：2026-09-19 21:29–21:30 CST，HTTP 200；真实浏览器显示新首页，console errors 为 []。
- 默认本月没有已平仓回合是该备份数据的实际结果；切“今年至今”可查看 62 个可信已平仓回合。

停止服务后，确认 3030 空闲，在该工作区运行：

```bash
TRADEREVIEW_DB_PATH="$PWD/.scratch/trading-room-implementation/acceptance.sqlite" npm run dev -- --hostname 127.0.0.1 --port 3030
```

## 验证结果

- 最终覆盖 **190 个测试文件、1730 项通过，5 项既有跳过**。集中全量 `npm run test:unit -- --maxWorkers=2` 首先得到 189 文件通过，唯 workspace 旧测试 helper 失败；修正 helper 的新首页入口后，以单 worker/default timeout 独立重跑该文件 **69/69 通过**。没有将非零退出的原全量命令写成一次性全绿。
- 原失败原因：历史 fixture 在 6 月，新首页默认 9 月；测试 `getAllByRole` 强制查询不存在的旧日历按钮。仅改为 `queryAllByRole`，无当前月样本时走真实交易库入口；原 fixture 日期和复盘断言保留。
- 早一轮并行资源竞争出现默认 5 秒超时。原始日志保留；deploy 53/53、refresh 7/7、storage-boundary 3/3、workspace 69/69 均在默认超时下复验通过。未提高项目超时配置。
- `npm run typecheck`：exit 0（`09-typecheck-final.log`）。
- `npm run build`：exit 0（`09-build-final.log`）；保留依赖的 externalized Node module / build classification 提示，无构建错误。
- `node --test tests/rendered-html.test.mjs tests/local-dev-storage.test.mjs tests/focused-review-ui.test.mjs`：5/5 通过（`09-runtime-final.log`）。
- 52 个新增/修改 app TS/TSX 文件 ESLint `--quiet`：exit 0（`09-changed-lint.log`）；`git diff --check` 通过。
- 正式库六张受保护表最后校验 **UNCHANGED**，包括 1857 条原始成交，见 `09-protected-final.log` 和 `protected-baseline.json`。

## 浏览器与独立 QA

- 1280px 桌面、390px 窄屏均无横向溢出；390px 下 clientWidth=scrollWidth=375（滚动条占宽）。截图：`09-preview-desktop.png`、`09-preview-390.png`。最终页面：`09-preview-final.txt`，错误记录：`09-browser-errors.json`。
- 真实备份今年至今：62 个可信回合、人民币估算 29143.03，原币小计与日历一致。默认实盘/全部分类/本月/趋势；高级筛选和收益质量明细折叠。
- 固定样例验证成本1%/本金2%、全部已填本金101200、缺本金回退、ETF市场细筛回退、模拟run隔离、币种确认、保存刷新持久化。
- 持仓同股票不同账户能打开对应回合；质量明细按 episode 定位账户，微软两笔成交与补录/编辑可用。
- 旧汇率失败提示、无汇率原币展示、真实 BOC 连续刷新、质量明细同页刷新同步已验证。daily retry 单条 SPY 从持仓质量2/5更新为3/5，源不支持项不会进入重试队列。
- QA 样例 3040 使用 `qa/qa-fixture-v4.sqlite`，已包含验收操作产生的隔离修改。3040/3041 临时样例服务均已停止；3030 用户预览保持运行。
- 独立 Luna 的浏览器工具没有可绑定表面，因此由协调者实际操作并保存 DOM/截图，Luna 独立核对界面证据、spec、源码与反例。未声称子代理亲自控制浏览器。

独立结论见 [09-qa.md](09-qa.md)；实施方式见 [项目开发工作流](../../../docs/agents/development-workflow.md)。原始失败与开发中临时500已保留在历史记录，修复后重新验证。未推送、合并或发布远端。

当前聊天交付：随最终回复提供预览、结果及本文启动说明。
