# TradeReview · 主图优先复盘开发交付包

v1.0 · 2026-09-25 · 用户已确认阶段拆分 · 待开发规格

从 [阅读入口](index.html) 开始。需求定义见 [REQUIREMENTS.md](REQUIREMENTS.md)，元素和风格标准见 [UI-ELEMENTS.md](UI-ELEMENTS.md)。HTML 与 Markdown 内容由同一来源生成。

## 已确认方案

买入前记录价格/仓位计划；持仓过程在图上记录心态并查看只读计划；事后按每次退出记录执行评价。侧栏参与布局，价格轴位于主图右缘、表单左侧。窄屏改为上方趋势＋下方独立滚动表单。

保持现有深蓝灰、蓝色交互、Geist/Lucide 规范；图表继承用户显示和配色设置。demo 用默认青涨红跌，合成数据不代表真实账户。

## 文件导航

| 内容 | 文件 |
| --- | --- |
| 需求规格，44 条用户故事、数据字段与验收契约 | [HTML](requirements.html) / [Markdown](REQUIREMENTS.md) |
| 元素规范，22 类元素、令牌、尺寸与状态 | [HTML](elements.html) / [Markdown](UI-ELEMENTS.md) |
| 完整视觉 demo，含七个画板 | [打开 demo](demo/index.html#stage1) |
| 七张最终图与一张窄屏验收图 | images/ |
| 后续开发任务 | [TASK.md](TASK.md) |
| 本轮检查与待开发边界 | [VERIFICATION.md](VERIFICATION.md) |
| 现有风格和业务证据 | [SOURCES.md](SOURCES.md) |
| 领域与工作流背景快照 | references/ |
| 文件清单与 SHA-256 | manifest.json，verify.py |

## 打开与启动

解压后直接打开 index.html；HTML、图片和 demo 均是本地资源，无 CDN、网络字体或安装依赖。建议使用 Python 3 本机静态服务：

```bash
python3 serve.py --port 8855
```

打开终端打印的 http://127.0.0.1:8855/ 。使用 Ctrl+C 停止此服务。端口已占用时选择另一未占用端口，不终止其他程序。运行 `python3 verify.py` 校验全部包内文件。

## 审阅顺序

1. demo 的买入前与事后侧栏：直接改价、切换退出评价，观察主图仍可见。
2. 阅读需求中的阶段边界、字段字典、保存/版本/指标口径。
3. 对照元素规范和 images/ 审核尺寸、配色及响应式。
4. 根据 TASK.md 领取后续实施，产品写入验收需隔离数据库。

## 实现边界与版本

demo 的数字和文字仅在当前页面保存；刷新恢复样例。图上部分绘图按钮仅展示位置。导出画板是固定样例，未生成 PPTX；服务端持久化、冲突恢复、完整绘图/拖线、业务精度、数据库查询与真实手机键盘均待开发。

本包是已确认设计的开发依据，不代表产品功能完成。A 是最终布局，B/C 仅为探索档案。以主规格确定行为，以元素规范确定外观；历史背景不能覆盖最终规格。若实施发现差异，应记录决策并升版。

仓库权威文件：docs/specs/2026-09-25-chart-first-review-ui.md 与 docs/specs/2026-09-25-chart-first-review-ui-elements.md。本包为二者的 v1.0 便携快照，仅重写相对链接；基线 b166d5626c72f2e0a4a7be98d89eb28bf1a036f3。后续修订需同步源文档、demo、配图、manifest 与包版本。
