# TradeReview

一个本地优先的历史交易复盘工具。它把券商成交组织为交易回合，并在隐藏未来行情、未来成交和最终盈亏的前提下逐根回放 K 线，帮助用户重新经历当时的判断与风险。

## 当前可用能力

- TradingView 风格的专业图表工作区
- 15 分钟、1 小时、4 小时、日线和周线切换
- 上一根、下一根、自动播放和跳至下一成交
- 已揭示持仓、移动平均成本、浮动盈亏、收益率和费用
- 买卖成交箭头与成本线
- 趋势线、水平线、价格标注、文字和盈亏比绘图工具
- 绘图撤销、重做、清空以及浏览器本地保存
- 交易计划、失效条件、目标区间和最大风险记录
- 富途 XLSX 在浏览器本地解析、重复检测、诊断和交易回合分组

## 隐私与数据边界

- `trades/` 下的原始券商文件被 Git 忽略，不会进入提交或部署。
- 富途文件只在浏览器中解析，不会上传。
- 当前复盘草稿使用浏览器 `localStorage` 保存在本设备。
- 图表中的行情为确定性演示数据，不能用于真实投资判断。
- 导入的真实成交会完成解析与分组，但在接入合法历史行情数据源前不会与演示行情混合。

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
npm install
npm run dev
```

打开 `http://localhost:3000/`。

## 验证

```bash
npm run test:unit
npm run typecheck
npm run lint
npm run build
npm test
```

## 主要技术

- React 19、TypeScript、vinext/Vite
- TradingView Lightweight Charts（Apache-2.0）
- SheetJS XLSX
- Decimal.js
- Vitest 与 Testing Library

## 当前限制

- Tiger 与招商证券 PDF 适配器尚未进入首个垂直切片。
- 尚未连接真实的美股、港股和 A 股历史行情提供商。
- 当前绘图工具集为首批插件，图层面板和更多斐波那契/通道工具将在后续迭代。
- 数据默认只保存在当前浏览器，尚无跨设备同步。
