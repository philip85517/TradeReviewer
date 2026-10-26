# 交易库视觉设计方案 V2.0

V2.0 是交易库视觉文档的独立设计包，身份为 `TRADING-LIBRARY-V20`，版本为 `2.0`。正文、fixture、生成器、当前 SVG 和 reader 都在本目录内，状态为**静态设计文档已验收**。两名独立 Luna 已完成语义、数字和实际渲染比对，协调者完成集成检查；见[最终验收记录](../../../../.scratch/trading-library-v20-spec-sync/FINAL-ACCEPTANCE.md)。此状态不代表产品功能已实现。

权威业务和视觉规则是[《交易库设计规范》](../../trading-library-design-spec.md)。规范阅读页由仓库根目录的 `python3 docs/design-system/build-trading-library-spec.py` 同步生成，Markdown 规范仍是权威源。正文源文件为 [`source/visual-design.candidate.md`](source/visual-design.candidate.md)，它按 BT01–BT10 组织十章内容，并明确模拟练习、实盘回合、内部配对、费用、残余估值、统计分母和返回上下文。E 参考图只用于布局、密度、层级和颜色比较；它们不替代 V2.0 语义。

## 阅读与预览

文档服务启动后，打开：

`http://127.0.0.1:3090/design-system/baselines/2026-10-26-trading-library-v2.0/visual-spec.html`

从仓库根目录启动当前设计文档服务：

```sh
./docs/design-system/baselines/2026-10-26-trading-library-v2.0/start-preview.sh
```

该服务只提供静态设计文档和图稿，不连接产品数据库。`navigation-e-prototype.html` 是 E 几何参考页，当前文档和 SVG 才是 V2.0 的可读设计基线。

## 构建与验证

在本目录执行：

```sh
python3 source/generate-library-frames.py --all
python3 source/test-library-metrics.py
python3 source/test-homepage-template.py
python3 build-visual-spec.py --source source/visual-design.candidate.md --version 2.0 --output-dir .
```

构建会更新 `source/images/*.svg`，并生成 `visual-spec.html`、`document-manifest.json` 与 `document-identity.json`。生成器在写图前校验六个模拟练习、A 残余估值未知、B–F 净额、费用只计一次、同一人工动作的技术卖出拆分和实盘回合聚合边界。测试与静态链接检查用于验证设计资产，不代表产品代码或数据库已经交付。

数字 oracle：模拟练习总数为 6，可计算样本为 5，未知样本为 1；B–F 净额为 `-104、354、-78、98、118 CNY`，合计 `388 CNY`，胜率 `60%`。A 没有明确结束估值时净额未知；如果业务另行明确结束价 140，示例净额应为 `1900 + 2800 − 23 = 4677 CNY`。

## 资产职责

- `source/library-design-fixture.json`：V2.0 模拟练习、实盘成交、状态和日期样例。
- `source/generate-library-frames.py`：生成当前逻辑 SVG；fixture 内的 LIFO 配对仅服务于可复核样例，不是生产匹配算法。
- `source/test-library-metrics.py`：检查练习样本统计、残余估值、费用、趋势分支和实盘回合边界。
- `source/test-homepage-template.py`：检查共享首页模板样例兼容性。
- `source/visual-design.candidate.md`：十章正文与图稿引用。
- `source/images/approved-e-*.jpg`：历史 E 参考图；其余 SVG 为本版当前状态与旅程图。

## 保留的业务边界

V2.0 保留以下未决事项，不为生产实现新增算法：多标的/多账户命名；练习初始资本、结束估值和历史报价的权威来源；人工主动平仓动作识别；混合方向、加仓减仓和跨日持仓的生产配对；预览列、冲突和部分导入的具体交互；缺失历史区间、账户边界和错误恢复。

V1.1、历史评论、产品代码和业务数据库均不属于本版写入范围。

