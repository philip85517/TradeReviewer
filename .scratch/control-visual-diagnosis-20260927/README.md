# 控件视觉诊断（2026-09-27）

当前状态：诊断完成，产品缺陷未修复。详见 [最终诊断](DIAGNOSIS.md) 和 [诊断验收](FINAL-ACCEPTANCE.md)。

以下保留上轮受阻时的历史记录（后续已由用户授权的Playwright实测补齐），不代表当前仍受阻。

## 范围与证据

用户四张截图：交易库筛选、交易室筛选及持仓总览/资产分布、当前持仓表格、历史表现趋势。截图是症状参考，不代表批准了新的尺寸设计。

代码基线：1e4921f。任务：[01 诊断](issues/01-diagnosis.md)。

## 已确认的静态事实

- 交易库 `app/components/library/library-scope-controls.tsx` 使用原生 radio/fieldset；交易室 `app/components/dashboard/review-dashboard.tsx:943` 使用 aria-pressed button 及 select，两者不是同一展示组件。共享范围类型不等于共享控件。
- 交易库账户 select：`app/components/library/trade-library.css:133`，32px 高、13px 字号；交易库搜索区 `app/globals.css:5477`，35px 高、12px 字号。交易室 `review-dashboard.module.css:1278` button 最小高度 26px、10px 字号；`:1281` select 高29px、10px 字号。颜色和圆角也由各自规则定义。
- 持仓历史控件通过 periodSlot 后代选择器再次设置密度：`room-holdings-history.module.css:126`，桌面按钮 min-height 23px、9px 字号；后续规则将字体改为9.5px。不能只查看父组件 periodTabs 判断最终样式。
- 持仓表格 `room-holdings.module.css:79` td 声明 height 42px、padding 5px；表格单元格高度不是最大高度，不能据此宣称实际行高恒为42px。`:93` 迷你 SVG 声明88×27px；`room-holdings.tsx:244` viewBox 100×32，未使用 preserveAspectRatio="none"，不能把它直接认定为非等比压扁。
- 历史表现 `room-performance.module.css:305` 在 min-width 821px 将三列卡片设为234px，`:326` 将SVG设为138px。`room-performance.tsx:709` 累计盈亏SVG使用 preserveAspectRatio="none"。这些规则需与运行时 viewBox、宽度、级联规则一起测量，尚未证明截图根因。

## Computer Use 与环境记录

上一轮已真实打开3033并获取截图/AX，确认是交易室，但该服务来自另一个工作树1545，账户B2完整样例/HKD，初始浏览器窄屏；不是用户截图的匹配状态，不作为当前代码的根因证据。

已对正式数据库进行只读 SQLite backup，输出 `/private/tmp/tradereview-controls-diagnosis.sqlite`。曾启动3044隔离服务，遇到缺少pptxgenjs/jszip导致页面加载失败。恢复后Computer Use工具已不在可调用工具列表，无法继续实际浏览器测量。离线依赖安装ENOTCACHED；在线安装无输出等待后已中断，不能声称安装成功。node_modules是从1545复制的本地依赖，不是符号链接。

## 尚未完成

- 匹配截图的桌面视口、浏览器缩放、全部账户/CNY/今年状态。
- 最终 computed style、SVG CTM 比例、文字/圆点变形与容器裁切测量。
- 资产分布当前数据状态与比例图回退语义复核。
- 红灯可复现命令、最小化复现、单变量实验及根因结论。

遵循 diagnosing-bugs：没有 red-capable 复现命令，不进入根因假设验证或修复阶段。本轮用户要求诊断，不进行未经验证的视觉重构。
