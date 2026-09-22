# 03 - 集成与真实页面验收

What to build: 在独立数据库上重新导入真实招商证券 PDF，验证收益与页面筛选，并保持预览服务运行。

Blocked by: None

Status: complete

Acceptance:

- [x] 原始 PDF 未被修改；本轮仅读取用户目录下的 PDF。
- [x] 用真实招商证券 PDF 复核隔离环境；159608、512560、513010 的月结单余额证据均能恢复期初/期末持仓，A 股/招商证券流水与持仓证据中无负数量。
- [x] A股 ETF 按 A股归类，ETF 仅作为次级资产类型筛选。
- [x] 相关自动化、类型检查、构建通过：本轮相关测试 174/174，工作区筛选回归 1/1，`npm run typecheck`，`npm run build`。
- [x] 真实浏览器验收通过：A股筛选显示 5 个当前持仓，A股 + ETF 显示 4 个当前持仓；目标 A 股负数量 0，服务保持运行。
- [ ] 全量测试仍有仓库原有 BOC parser fixture 缺失：`.scratch/trading-room-implementation/reports/boc-source.html`，与本次修复无关。

预览：`http://127.0.0.1:3023/`
