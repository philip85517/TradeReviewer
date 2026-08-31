# TradeReview

一个本地优先的历史交易复盘工具。它把券商成交组织为交易回合，并在隐藏未来行情、未来成交和最终盈亏的前提下逐根回放 K 线，帮助用户重新经历当时的判断与风险。

## 当前可用能力

- TradingView 风格的专业图表工作区
- 导入的交易回合与演示交易共用逐根回放、绘图、持仓统计和复盘笔记
- 公开来源覆盖交易区间时，会缓存真实 `15m` 行情；`1H`/`4H` 由真实 `15m` 聚合，`1W` 由真实日线聚合
- 15 分钟、1 小时、4 小时、日线和周线切换；缺少底层行情的周期会禁用并说明原因
- 上一根、下一根、自动播放和跳至下一成交
- 已揭示持仓、移动平均成本、已实现/浮动/净盈亏、收益率和费用
- 买卖成交箭头与成本线
- 趋势线、水平线、价格标注、文字和盈亏比绘图工具
- 绘图撤销、重做、清空以及保存到本机 SQLite
- 交易计划、失效条件、目标区间和最大风险记录
- 富途 XLS/XLSX、Tiger PDF 和招商证券 PDF 按文件内容自动识别，并在浏览器本地解析
- 独立的“导入成交截图”入口，支持已适配的 Tiger/富途成交截图版式以及 JPG、PNG、WebP 多文件选择
- 截图导入会逐行复核账户、来源时区和 OCR 证据；低置信度或缺失字段必须确认或修正后才能导入
- 逐行诊断、股票/ETF 分类、股票名称自动补全和交易回合分组
- 单一“导入交易记录”入口，解析后先展示区间、成交、股票和排除项统计
- 左侧只按“股票名称（代码）”展示有成交的股票，导入批次从独立历史入口查看
- 导入股票在本机持久化，可选择查看逐笔成交、源时区和行情补齐状态
- 无需 API Key 的美股、港股和 A 股真实日线补齐，以及公开来源实际覆盖范围内的真实 `15m` 补齐
- 导入成交、复盘记录、行情和建议统一保存在部署目录挂载的 SQLite；完整缓存命中时不会请求外部数据源
- 导入后自动追补缺口，也可在单只股票上手动触发增量更新

## 隐私与数据边界

- `trades/` 下的原始券商文件被 Git 忽略，不会进入提交或部署。
- 富途 XLS/XLSX、Tiger PDF 和招商证券 PDF 均只在浏览器中解析，原始文件不会上传；确认导入后，结构化成交会写入本机 SQLite 服务。
- 截图 OCR 首次使用时从应用同源地址下载模型和运行文件，随后完全在浏览器本地推理；所选截图、完整 OCR 文本、识别中间结果和待确认草稿不会上传，也不会写入浏览器持久化存储。确认导入的成交只会保留有限的来源追踪信息，例如原始时间文本、时区、图片序号和行位置边界。
- 浏览器 `localStorage`/IndexedDB 仅作为一次性迁移与短期回滚副本；正常复盘、设置、绘图、建议和行情均从本机 SQLite 读取。
- 演示行情和成交由服务端按游标逐步揭示；完整未来序列不会进入客户端包。
- 演示股票使用确定性演示数据；导入股票只显示其自身缓存的真实历史行情，两者不会混合。
- 同源服务会接收确认后的结构化成交、账户标识、复盘笔记、绘图和行情请求，并持久化到部署目录挂载的 SQLite；原始券商文件、截图和完整 OCR 文本仍只在浏览器侧处理，不会上传。
- 当前公开行情优先使用腾讯接口，A 股备用东方财富，港/美股备用 Yahoo Finance。它们无需 Key，但不承诺可用性、授权或商业用途；页面会展示实际来源和抓取时间。
- 来源拒绝访问、限流或格式异常时会保留旧缓存，不会绕过访问控制或循环重试。

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
npm install
npm run dev
```

打开 `http://localhost:3000/`。

### Tiger OpenAPI 本地配置

仅当需要 Tiger OpenAPI 作为已配置行情源时，额外执行以下命令：

```bash
python3 -m pip install -r requirements-tiger.txt
TIGER_OPENAPI_CONFIG=/absolute/path/tiger_openapi_config.properties npm run dev
```

- Tiger 配置文件必须放在仓库外部，并通过 `TIGER_OPENAPI_CONFIG` 指向绝对路径。
- 固定版本的官方 SDK 在 `private_key_pk8` 和 `private_key_pk1` 同时存在时，会优先解析 `private_key_pk8`。
- 只有美股和港股的日线、`1h` 请求会优先尝试 Tiger；其他市场或周期继续走现有公开行情源。

## Docker Compose 部署

生产部署使用 Docker Compose，默认目标为 `/Users/zhoulin/projects/TradeReview`。第一次 `make deploy` 会自动初始化本机配置、SQLite、备份、日志和目标侧运维入口；如需预先编辑配置，可先运行 `make deploy-config`。日常命令包括 `make deploy-code`、`make deploy-status`、`make deploy-backup`、`make deploy-restore BACKUP=/absolute/path/to/backup.sqlite`、`make deploy-rollback` 和 `make deploy-down`。完整的凭据排除、失败恢复、保留策略、备份事务和 SQLite/浏览器数据边界见 [部署指南](deploy/DEPLOYMENT.md)。

## 验证

```bash
npm run test:unit -- app/api/market-data/daily/route.test.ts app/api/market-data/intraday/route.test.ts app/lib/market/sync-service.test.ts --run
npm run test:unit
npm run typecheck
npm run lint
npm run build
npm test
```

## 主要技术

- React 19、TypeScript、vinext/Vite
- TradingView Lightweight Charts（Apache-2.0）
- SheetJS XLSX、PDF.js
- Decimal.js
- SQLite（部署目录挂载持久化；浏览器 IndexedDB 仅用于一次性迁移）
- Vitest 与 Testing Library

## 当前限制

- 当前只识别已适配的富途、Tiger 和招商证券对账单版式；加密 PDF、扫描件或券商改版后的未知表格可能无法解析。
- 截图导入目前只支持已适配的 Tiger/富途成交列表版式；未知版式会被拒绝。OCR 会受截图清晰度、裁剪、缩放、遮挡和券商界面改版影响，导入前仍需按证据图逐行核对，无法确认的低置信度字段不会自动猜测或放行。
- 自动导入只保留股票和 ETF 成交；基金、外汇、债券、回购、现金及无法确认的资产会在确认页列为排除项。
- 无 Key 的公开来源可能无法覆盖较早的分钟历史；应用只启用实际缓存覆盖的周期，不承诺固定的历史盘中覆盖范围，也不提供实时或盘口数据。
- 无 Key 的公开来源可能临时限流或改变格式；这时应用会降级为已有缓存。
- 当前绘图工具集为首批插件，图层面板和更多斐波那契/通道工具将在后续迭代。
- 这是单机/单用户本地部署，SQLite 文件是唯一业务数据源；尚无云端跨设备同步。
- “模式洞察”不在本次交付范围内。
