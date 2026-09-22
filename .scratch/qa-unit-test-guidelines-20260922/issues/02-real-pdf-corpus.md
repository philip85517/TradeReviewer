# 02 - 真实 PDF corpus 验收入口

What to build: 增加通过环境变量指定真实招商证券 PDF 目录的可选测试，验证 dispatcher、PDF 提取和月结单证据链。

Blocked by: 01 - 解析器与回放回归

Status: complete

Acceptance:

- [x] 未设置 corpus 环境变量时测试安全跳过。
- [x] 设置目录后逐份验证格式识别、记录唯一性、正数量/价格和月结单证据存在。
- [x] 测试输出不打印账户号、完整账单或敏感文本。
- [x] 测试说明使用方式，不将个人绝对路径写入代码。

Verification: `CHINA_MERCHANTS_CORPUS_ROOT='/Users/zhoulin/Documents/交易/A股' npx vitest run app/lib/import/china-merchants-corpus.test.ts` — 9 files, 45 pages, 433 records, 537 positions, 0 review-required, 0 inconsistent-balance diagnostics.
