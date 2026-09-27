# 主图优先复盘 · 本地验收入口

## 当前修复轮预览（2026-09-27）

当前入口为 <http://127.0.0.1:3049/>，同一 worktree、生产构建，固定使用 `repair/acceptance.sqlite`，仅含合成数据，业务库与 3022 入口不变。整体验收状态见 [最终记录](FINAL-ACCEPTANCE.md)和[R10集成](repair/reports/R10-integration.md)。下文 3047 和旧导出是此前历史入口，不代表本轮最新版。

最终构建R10，服务会话64557，2026-09-27真实浏览器复验；辅助3051/3052已停止。当前仍未整体accepted，必需真机键盘未验。

启动当前生产预览：

```bash
zsh .scratch/chart-first-review-implementation/repair/start-production-preview.sh
```

修改产品后，在此 worktree 显式隔离库构建，再停止自己启动的 3049 会话并执行以上脚本；不要终止未知进程：

```bash
PATH="/Users/zhoulin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
TRADEREVIEW_DB_PATH="$PWD/.scratch/chart-first-review-implementation/repair/build-acceptance.sqlite" \
npm run build
```

- `999999`（合成验收·可从头回放）停在首次买入前，已填计划56/52/68及1000股，尚未推进成交，供逐K/播放/下一笔体验。
- `999996`（合成验收·从头体验）是完整操作验收样本；正式完成、重开事后全局与交易库完成标记已实测。净盈亏6760 CNY、实际1.69R；草稿代表图选择与正式版本分别保存。
- `999992` 费用未知、`999993` 部分退出未平仓、`999994` 无退出、`999997` 同 K 多决策、`999998` 单根 K，用于边界核对。

真实手机软件键盘仍未验证。此预览不会发布、推送或改写正式成交。

## 历史入口与资料

工作树：`/Users/zhoulin/.codex/worktrees/f7a5/TradeReview`。预览：<http://127.0.0.1:3047/>。

本入口固定使用 `.scratch/chart-first-review-implementation/acceptance.sqlite`，包含从业务库一致性备份的数据，以及标记为“合成验收”的 999991、999992 两个测试标的。所有浏览器写入仅发生在此隔离库。项目默认配置和正式 3022 入口不变。

## 启动

在本工作树运行：

```bash
bash .scratch/chart-first-review-implementation/scripts/start-preview.sh
```

脚本优先使用本机已安装的 Node 24 运行时，固定隔离数据库并绑定 `127.0.0.1:3047`。缺少验收数据库时会停止。若端口已被占用，先核对已有进程，不要重复启动或终止其他服务。

代码修改后先执行 `npm run build`。本次验收使用 Node 24；数据库写入测试必须显式设置独立 `TRADEREVIEW_DB_PATH`。

## 体验路径

1. 交易库搜索 `999991`，展开“合成验收·费用完整”并进入回合。
2. 买入前判断：计划侧栏与主图并列；按数量、金额或仓位比例输入，查看计划线及预期 R。
3. 持仓过程：逐根揭示行情，使用图上 Text，留存阶段图；调整计划保留初始风险。
4. 事后复盘：选择各次退出，记录提前退出、原因、执行符合度与人工归因。
5. “三阶段代表图”选择各阶段快照；“导出”选择 PPTX，可导出上次完成版本或已留存草稿。

999991 的核对口径：买入 1000 股，入场 56，止损 52，目标 68；初始风险 4000 CNY，计划 3R。两次退出合计毛盈亏 6800、费用 40、净盈亏 6760，实际 1.69R。999992 用于费用未知时的缺失状态验收。

## 交付资料

- [任务与依赖索引](README.md)
- [需求规格](../../docs/specs/2026-09-25-chart-first-review-ui.md)
- [元素规范](../../docs/specs/2026-09-25-chart-first-review-ui-elements.md)
- [视觉 Demo](../../docs/designs/2026-09-25-chart-first-review/handoff/index.html)
- [已冻结的设计交接包](../../docs/deliverables/TradeReview-ChartFirst-DevHandoff-v1.0.zip)
- [真实浏览器导出的合成样本 PPTX](qa/export/TradeReview-synthetic-acceptance.pptx)
- [已核对中文字体的 PDF 预览](qa/export/font-qa/TradeReview-synthetic-acceptance.pdf)
- [项目交付工作流](../../docs/agents/development-workflow.md)

PPTX 已用 LibreOffice 离线渲染核对，未声称使用 Microsoft PowerPoint 验证。桌面窄屏模拟已检查；真实手机软件键盘仍需设备验收。
