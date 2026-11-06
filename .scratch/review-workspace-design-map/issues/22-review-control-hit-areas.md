# 顶栏小控件命中区低于现有空间约定

ID: review-audit-22
State: open
Status: acceptance-failed
Assignee: unassigned
集成负责人: coordinator
Priority: P3
Blocked by: 无

## Scope / What to build

核对返回交易库、关闭工作区和侧栏折叠控件的实际命中区域，以及彼此间距。此票仅记录审阅发现，不构成修复授权。

## Refs

- [独立审阅报告与持仓截图](../evidence/independent-design-review-20261028/REPORT.md)。
- [现有桌面公共控件空间约定](../evidence/immersive-layout/DESIGN-COVERAGE.md)。

## 验收标准与反例

- [ ] 逐项记录实际可点击边界；至少符合当前公共控件 36 CSS px 的高度约定，不以图标视觉大小代替命中区域。
- [ ] 以 36×36 CSS px 作为待讨论的命中区建议，并检验相邻控件不重叠；如采取不同尺寸，记录设计取舍。
- [ ] 鼠标与键盘分别留证；未经真实触控测试不得宣称触控通过。

反例：仅扩大 SVG 外观，而真实按钮的点击边界仍保持约 22px 高。

## candidate-v37 版本绑定观察（2026-10-29）

版本清单及哈希见[candidate-v37 manifest](../evidence/review-fixes-20261028/candidate-v37/manifest.json)。协调者的真实浏览器几何记录 [v37-audit-ax.json](../evidence/review-fixes-20261028/coordinator/v37-audit-ax.json) 显示：1108×800 入场时日期、播放、单步、下一停点动作条和关闭回放区域可见，`replay-actions` 为 430×36 CSS px、`replay-meta` 为 40×36；1280×800 入场动作条为 516×36，持仓态为 540×36。1108/1280 入场到持仓时播放按钮 x 坐标变化约 0.33px。独立静态截图审阅 [final-review-v37](../evidence/review-fixes-20261028/final-review-v37/REPORT.md) 认为所示 1108 回放控件可见且未明显重叠，但明确未测命中尺寸、键盘或触控。

这些几何数据是协调者记录的 DOM 布局尺寸，不等于实际可点击边界，也不覆盖本票指定的返回交易库、关闭工作区、左右栏切换按钮。相邻控件不重叠、36×36 热点、鼠标/键盘操作及触控仍未验证；不得把独立静态截图审阅写成独立命中测试。本票保持 open / acceptance-failed。
