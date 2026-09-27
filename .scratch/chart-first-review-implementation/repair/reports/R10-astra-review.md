# R10 计划价格辅助按钮独立审查

2026-09-27，`gpt-6-astra / low`。只读冻结source、CSS、测试及R10-plan-price-action.md；未操作浏览器、运行测试或修改产品。**源码限定pass，当前不签视觉通过。**

- `replay-chart.tsx`辅助按钮仍调用原fitPlanPrices，仅class和定位变为chart-stage内left76/bottom48。原right76/top36位于右价格轴标签附近；新位置离开该右上标签区，没有改变计划priceToCoordinate或成交锚点。
- DrawingToolbar是chart-shell内独立48px列（窄屏44），chart-stage在其右侧chart-column中；按钮left76是相对stage，并非从整个shell最左起，因此不覆盖绘图工具列。
- 既有“适应全部”按shell left52/bottom8定位；新按钮在stage bottom48，桌面最小36，窄屏44。两者并不共用锚点，新按钮在更右、更上位置，源码没有直接重叠关系；实际位置/尺寸仍须最终DOM确认。
- `.recall-plan-price-action`提供深蓝底/边框/12px辅助文字、桌面min-height36，既有max-width700规则提供44命中；现coarse规则仅列规模/summary，未包含此辅助按钮。没有新占高行或缩小主图尺寸；按钮仍为可聚焦的原生button。
- fitPlanPrices仍只合并safePlanLines与截至cursor已知行情、显式setVisibleRange价格范围，不修改time logical range或游标。既有测试新增class/left/bottom断言，点击后继续断言68目标进入价窗、未来高点不进入、原时间范围不变。Luna43通过归实现者，本代理未重复执行。

发现一个限域触控缺口：viewport>700且pointer:coarse时，此新class仍为36px，当前coarse选择器不包含它；按元素规范触屏控件44px要求，应将该class加入coarse规则，不涉及位置/计划逻辑重构。390截图本身不能关闭宽触屏这一缺口。本修复把原轴标签碰撞移开，但固定左下按钮不能仅从source证明在真实390窄图/量能区/长注释中完全合适；等待root最终1280/390截图，核对金色入场价完整、按钮36/44、适应全部/工具可达和无新增遮轴。旧R9-preview-ready失败图保留；不要以43测试通过代替视觉。

## 粗指针源码补验

独立重读当前 `@media(pointer: coarse)`，`.recall-plan-price-action` 已加入min-height44选择器，且位于基础36规则之后。此前>700宽触屏缺口源码关闭，不扩张成物理设备验收。最终实际1280/390视觉仍等待root新构建图；真实重导链独立结论见 `R10-astra-reimport.md`。

## 最终构建视觉与运行证据：限定接受

已实际打开并独立查看 `R10-default-before-fit.png`、`R10-fitted-390.png`、`R10-fitted-1440.png`、`R10-preview-ready.png`，不是以源码或测试代替视觉：

- 默认1280×720：辅助按钮位于图内左下量能区域，root实测x219/y548/90×36；右侧金色入场56与止损52完整，没有原right76/top36的碰撞。目标68在默认价格视野外符合显式适应计划价格前的状态。
- 390：辅助按钮x129/y360/90×44；68/56/52均进入价格窗且金色轴标签完整。辅助按钮与左侧绘图工具、下方“适应全部”有独立位置，未观察到互相覆盖，主图仍220px。
- 1440拟合图：按钮远离右侧价格轴；蓝色十字线51.92瞬时覆盖52附近属于光标标签，不是本次按钮碰撞。最后无十字线的1280预览明确显示68/56/52三个金色价标均完整，关闭此歧义。
- parent真实点击适应计划价格后，行情/成交截止仍为pre-entry，未推进回放；截图可见相同阶段/截止。`R10-browser.json`记录新构建验证时段newErrors=[]。本代理未操作浏览器。

独立读取root运行证据：`R10-coordinator-tests.txt`两文件43/43；`R10-runtime.txt`5/5、fail0；typecheck/lint/build日志与root退出码0记录一致。旧R9失败截图及本报告早期待验记录保留，以上为后续闭环证据。

**R10按钮价格可读性修复限定接受**：源码位置、36/44规则、最终桌面/390图像、真实fit行为及运行证据相互一致。真实PDF重导关联闭环另见 `R10-astra-reimport.md`，该项此前unverified现已限域关闭，不将仍needs-confirmation的回合误称completed。

当前本代理审查范围内，仍明确required且unverified的最小项为**真实手机软件键盘打开时的输入/可见区域/滚动可达验收**；390桌面模拟和coarse CSS不能替代。未发现另一项由本轮证据确定、尚未关闭的required缺口。此结论不是整个feature accepted，也不把历史已关闭项重新列为待办。
