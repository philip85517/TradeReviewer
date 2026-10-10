# 0.7 归档检查 · 2026-10-10

本轮仅归档当前视觉、建立文档索引并提交任务分支，不新增视觉或行为。root 独立执行以下检查；独立归档审查者未实现本轮文档。原整体票 01、生产固化和历史 FAIL / NOT VERIFIED 保留。

|检查|当前结果|证据与范围|
|---|---|---|
|类型检查|PASS，exit 0|`npm run typecheck`；[完整日志](logs/typecheck.log)|
|相关单元测试|PASS，9 文件 / 193 项，exit 0|下列九个文件；[完整日志](logs/focused-unit.log)|
|构建和项目集成检查|PASS，5 项，exit 0|`npm test` = `npm run build` + rendered-html / local-dev-storage / focused-review-ui；[完整日志](logs/build-and-integration.log)|
|当前真实浏览器|PASS：完整观察实际渲染；控制台 error 查询为空|[1280×720 / DPR2 新截图](screenshots/live-preview.jpg)、[DOM 测量与时点](live-preview.json)：EMA20、body overflow-y auto、文档 1051px / 视口 720px、7 个图表 canvas|
|此前滚动和直接视觉比较|沿用本轮之前接受，未重新执行全矩阵|[滚动接受](../../observe-scroll-20261010.md)：5 档真实 wheel / Home / End、局部菜单/抽屉、跨视图与独立前后图；本次四张归档图与原件字节一致，四个当前呈现源文件 SHA 与该接受清单相同|
|归档清单、相对文件链接|PASS|85 个源文件、5 张图、5 个旧 manifest 与验证日志 SHA256 相符；73 条当前文档相对链接可达；3 个排除项仍保留原字节并被 Git ignore|
|源码/公开样板/当前文档格式检查|PASS，exit 0|`git diff --cached --check -- README.md app public docs`，仅排除版本页原始 logs 目录|
|包含原始报告与日志的全暂存格式检查|FAIL，exit 2，按原件保留|80 项均为原始报告/日志的尾空白或文件末空行，涉及 14 个报告/日志文件；源代码与当前文档无此问题。不改写冻结报告或原始测试输出来消除该记录|
|独立归档审查与提交范围|PASS，checkpoint_audit 只读独立核对|[独立报告](../../../../../.scratch/strategy-visual-system-20261008/reports/checkpoint-archive-audit-20261010.md)：仅本任务源码、主题、公开离线素材、规范/证据与索引；3 个本地业务原件不在暂存区。没有数据库、账单、凭据或临时基线副本|
|归档提交与远端分支|PASS，push exit 0，ls-remote SHA 相符|[573e58b](https://github.com/philip85517/TradeReviewer/commit/573e58b253c54d7050a192068ff44c7f95a4d2ef) 到 `codex/strategy-visual-system-20261008`，正确 upstream 已设置；[实际回执](remote-receipt.json)。本回执另作纯文档提交，交付前再核对最终分支 HEAD|
|全量单元测试 / 全仓库 lint|本轮 NOT VERIFIED|历史全量失败保留，见[测试失败审查](../../../../../.scratch/strategy-visual-system-20261008/reports/test-failure-audit.md)；不能用本轮相关测试替代全量结果|
|生产写入链、物理或模拟触摸、Windows/逐字字体、全量 Tooltip / 未来信息审计、IME/手机键盘|NOT VERIFIED，范围不扩大|继续按[整体接受记录](../../acceptance.md)与[本轮严格回归](../../observe-regression-20261009.md)理解|
|新数据库写流程接受|NOT APPLICABLE|本轮没有新写流程；预览使用隔离数据库和合成样板，不修改共享业务库|
|master 合并 / 生产发布|NOT APPLICABLE|用户仅授权当前任务分支推送|

相关单元测试命令：

```sh
npm run test:unit -- \
  app/components/design-prototype/recall-design-prototype.test.ts \
  app/components/recall/recall-prototype-price-roles.test.ts \
  app/components/chart/drawing-canvas.test.tsx \
  app/components/chart/drawing-canvas.recall-review.test.tsx \
  app/components/chart/replay-chart.test.tsx \
  app/components/chart/replay-chart.recall-review.test.tsx \
  app/components/recall/recall-workspace.test.tsx \
  app/components/recall/recall-integration.recall-review.test.tsx \
  app/components/trade-review-workspace.recall-bridge.test.tsx
```

执行时使用已安装的 Node 26 与仓库 `node_modules/.bin`。Node DEP0205 提示和 vinext 路由静态分类提示保留在日志中，不影响本次退出码。

预览 URL：[完整观察](http://127.0.0.1:3069/?prototype=strategy-workbench&view=observe&scene=complete)。本轮启动时为 `127.0.0.1:3069`，使用 `.data/strategy-visual-acceptance.sqlite` 的显式 `TRADEREVIEW_DB_PATH` 隔离覆盖；数据库与运行缓存不入库。服务留在运行中，进程号只代表本机检查时点，不是版本合同。

在检出分支的工作树中复现：

```sh
npm install
TRADEREVIEW_DB_PATH="$PWD/.data/strategy-visual-acceptance.sqlite" npm run dev -- --port 3069 --hostname 127.0.0.1
```

归档源码以 [manifest.json](manifest.json) 的 SHA256 为准；包含该文件的 Git 提交是版本绑定，不在 manifest 中写自身提交 SHA。历史清单保留接受时点的文档与源码哈希，后续文档索引修改不反写旧清单。[remote-exclusions.json](remote-exclusions.json)明确远端提交中有意排除、本地保留的旧业务测量。
