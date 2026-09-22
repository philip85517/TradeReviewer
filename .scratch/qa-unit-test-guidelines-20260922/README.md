# QA 单元测试规范与 A 股解析回归

## 任务索引

- [x] [01 - 解析器与回放回归](issues/01-parser-ledger-regressions.md)
- [x] [02 - 真实 PDF corpus 验收入口](issues/02-real-pdf-corpus.md)
- [x] [03 - QA 编写规范](issues/03-qa-guidelines.md)

## 范围

- 修复招商证券 PDF 测试 fixture 对缺失证券余额的错误默认值。
- 覆盖 PDF 解析、持仓重建和交易回合三个关键 seam。
- 增加可选真实 PDF corpus 测试，不写死个人路径、不提交敏感账单。
- 将极端值、领域不变量和金融数据缺失语义沉淀到项目 QA 规范。

## 验收记录

- 相关测试命令与结果：`app/lib/import/china-merchants.test.ts` 15/15 通过；真实 A 股 corpus 9 份、45 页、433 条记录、537 条持仓证据通过。
- 相关扩大回归：4 个文件通过、1 个 corpus 文件默认跳过；109/110 测试通过。
- 真实 corpus：已设置 `CHINA_MERCHANTS_CORPUS_ROOT` 单独运行并通过。
- 类型检查与构建：`npm run typecheck`、`npm run build`、`git diff --check` 均通过。
- 全量 `npm run test:unit`：200 个测试文件通过、3 个跳过、6 个文件失败；其中 BOC parser 为缺失既有 fixture，其余为并行全量下的既有 UI/部署超时或不稳定项。单独复跑这 5 个失败文件为 140/140 通过。
- 新规范文档：[docs/agents/qa-unit-test-guidelines.md](../../docs/agents/qa-unit-test-guidelines.md)。
