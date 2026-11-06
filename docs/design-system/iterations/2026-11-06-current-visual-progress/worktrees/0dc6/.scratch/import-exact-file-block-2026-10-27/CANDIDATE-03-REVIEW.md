# 候选 3 局部只读审查

审查者：completion_review，未编辑代码；2026-10-28。范围仅静态实现及既有日志，不是浏览器、视觉或整体验收。

未发现已证实需要阻止候选 3 冻结的逻辑问题。核对如下：

- `import-completion.ts`：monthly 缺口保留 pending；合法忽略项要求 disposition、ruleId、broker、category 同时匹配。
- `sqlite-store.ts` importHasPendingRows：重新核对原始 completion evidence、monthly 与汇总计数，未知排除项不能仅靠归零计数获得强成功。
- `sqlite-store.ts` importedFile：保留旧冲突或保持撤回不记录成功；零成交文件要求匹配本事务保存的完整 monthly statement 材料。
- prepare/commit 两处 legacy revision 例外要求显式 `intent.materials`，自动 history adapter 不再绕过全重复保护。
- Futu PDF error warning 会设置 blocked，enrichment 两个返回分支均保留 blocked；该证据会参与完成性判断。

非阻断补测建议：Futu/Tiger 合法忽略项的完整 API 旅程，以及错误 ruleId/broker/category 组合；当前新增合法忽略 API 旅程主要使用 CMS fixture。解析器相关定向回归已由实现接续 owner 执行，详见 PARSER-REGRESSION-03.log；本审查者没有新增或执行测试、没有数据库或浏览器操作。

报告中旧候选“任何 exclusion 都不记强成功”的限制已明确标为历史并由候选 3 替代。原 RED-07 未被覆盖；其中未知排除错误成功是生产反例，GREEN-07 随后的重试错误是固定 material version fixture 复用，当前测试以新的版本/时间重试。
