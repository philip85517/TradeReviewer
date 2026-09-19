# 本地性能验收夹具

仅协调者浏览器验收用，不是产品入口，不写交易数据。导入实际 `TradeLibrary`，由独立 Vite production build 打包。766回合取隔离数据库bootstrap的成交/复盘状态；5000回合按已有分布复制，证券/回合/成交标识加后缀，保留范围结构。使用全部交易性质覆盖最宽数据量。无行情图表、父工作台及服务器网络耗时，不把本组件测量宣称为整站端到端性能。

私有夹具位于 ignored `.data/library-ux/performance-fixture.json`。来源仅本机隔离3031端口；不发布/上传。运行需要先生成该文件（`/api/storage/bootstrap`仅保留executions/reviews/reviewStates）。

```bash
npx vite build --config .scratch/trade-library-implementation-20260919/performance/vite.config.ts
npx vite preview --config .scratch/trade-library-implementation-20260919/performance/vite.config.ts
```

仅绑定127.0.0.1:3032。生产组件完成后再构建测量。页面保持可见、桌面固定视口；先暖机，清空测量，再20次打开关闭抽屉、20次筛选。捕获阶段event起点到双requestAnimationFrame结束，日志呈现在页面“测量结果”。此计时是包含绘制等待的近似上界，不等同于INP。p95采用nearest-rank，不含自动化RPC耗时；环境、样本、冷暖状态与异常必须记录。最终产品在3031独立做真实浏览器路径验证。

补充诊断：原生日志同时记录 `domCommitMilliseconds`（事件到交易库 DOM 首次提交后的 MutationObserver 检查点）与 `milliseconds`（事件到两次 rAF）。前者用于区分组件计算/提交和浏览器绘制调度等待，不能冒充真正绘制完成或 INP。计时期间不立即抓取整页 AX/DOM 快照，改为小范围读取测量日志，随后再核对结果范围。若浏览器调度或系统负载异常，保留样本并注明无有效最终性能结论；不得只选择较快指标宣称原绘制目标通过。
