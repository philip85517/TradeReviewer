# Task3a 已有 Text 双击：只读根因与最小修复设计

状态：诊断与待审核设计；**未改产品/测试，未运行浏览器、HTTP、SQLite 或测试**。Task3a 冻结、A02 原 FAIL 保留且持久化 NOT VERIFIED；Task3v/3b 未放行。本报告不将一次观测推广成所有尺寸均已复现，也不将截图等待失败解释成服务器保存失败。

## 已证据与可验证几何

`E/task3a-existing-edit-first-diagnosis.md` 与原结果 `E/b01-ui-task3a-root-existing-edit-first/result.json` 记录：既存文字为 anchor、原 anchor 时间/价格不为空、canvasX/Y 缺失；真实双击 `x=519.8, y=486.0567796895738`。第一 pointerdown 命中 CANVAS，随后第二 pointerdown/click 命中刚出现的“自由”，后续 dblclick 命中“锚定”。新文本已在本地部分绘制，但截图等待超时发生在 SAVE 之前；两个完整段落存在输入框断言中，不能虚构后续完整 paint 或持久化成功。原结果的二次数据安全断言与提前退出不相符，按原诊断分别保留。

源码链：`app/components/chart/drawing-canvas.tsx:909–926` cursor 指针首按命中未锁 Text 后立即创建编辑器，使用**文字几何原点** `textGeometry.x/y`，没有保留实际点击点；`:611–649` 把编辑器放在 `left=clamp(x+4)`, `top=clamp(y−24)`，`:1343–1383` 将 36px 桌面样式栏置于 shell 顶部，首按钮为“自由”。该按钮 `:1392–1409` 真的切换 `placement` 并写 canvasX/Y；`:844–877` 随后以该 placement 构造 replace，故它会改变锚点语义。此前浏览器可见 `fillText` 第一行位置 `(511.8,491.0568)`；这是绘制文字基线而非 DOM 盒子测量，但结合 canvas 文字水平 padding 8px、字号及首按位于第一行，可解释点击落入紧邻其上生成的样式栏。具体按钮边界应以新真实浏览器 `getBoundingClientRect`/`elementFromPoint` 记录，不能由该间接计算冒充实测。stage capture 的 `fromTextEditor` 会让新控件接到原生事件；它不是重复事件被 Canvas 误认后的独立写入。

单击即可编辑是既有公开合同，不能等 dblclick 或延迟开启。故障是**新可操作控件在第一次点击位置下出现**，不是“必须双击”或文字换行本身的问题；单纯让测试改单击、Expand、缩短文字或允许位置变化不能修掉误操作。

## 拟议最小修复（待 root 扩权）

仅建议 `app/components/chart/drawing-canvas.tsx` 和对应公开测试 `app/components/chart/drawing-canvas.test.tsx`；不改 page/controller/client/后端或共享 CSS。Canvas 是共享组件且当前冻结，产品写入需 root 明确批准与新的 raw-before/manifest；新测试文件如更合适亦须先明确白名单。一个根因一次修改，不改变 Canvas 事件捕获、textarea 键盘/IME、blur、绘图命令或格式/anchor 的既有协议。

1. 对**由既有 Text 指针命中开启**的 editor 暂存首个实际画布坐标（使用现有 `pointFromClient` 转换，与绘图和 plot 坐标一致），只用于编辑器临时摆放；不写入 drawing、anchor、canvasX/Y，也不用于重置 editor。新建文字和程序化其他入口沿用其各自现有语义。该点击点在编辑器生命周期内稳定，输入内容/字号变化后每次测量仍需避免覆盖，不因每次字符更新抖动焦点。
2. 计算可见 plot 内的编辑器位置和工具条朝向：优先既有布局附近、保证点击点落在编辑器的 textarea 可交互区域，而非新生工具按钮；位置不足时在保持 36px 控件、textarea 至少完整一行、边界内可滚动和当前卡片锚点不变的前提下，选择相反的样式栏方向或合适的可见偏移。不能只把工具栏固定移动到下方：长卡点击下半行、窗口/价格轴边界、字号变化和 canvas-positioned 卡仍可能命中它。实际候选选择应基于点击点、shell 和 toolbar 几何，而不是只基于绘图原点，也不能把画布外坐标纳入。
3. **空间不足的明确边界**：极小 plot、点击接近轴/边缘，或完整 textarea 与 36px 工具栏加 hint 无法同时放下时，现有约束可能使所有候选都不能让该点落入 textarea。不得用任意定时延迟或吞掉全部第二次点击，亦不得声称简单翻转工具条普遍有效；实现前先以真实可用 plot 尺寸及最小字体列候选几何。若同一 shell 内无解，向 root 报告精确反例并申请最小范围/设计裁定，不能无证假设极小尺寸不会出现。用户有意移动指针点击样式/定位按钮或用键盘激活时，原动作和 focus/blur 必须可用。
4. 原有 toolbar 与文本框均保持可访问；不把整个 editor 盖成无交互层。对原生连续点击，只应因首次坐标现在落在 textarea 而得到普通文本框行为；编辑器 autofocus、选择光标、compositionRef、Escape/Enter、真实 blur 提交与控制区保活不变。Text 格式、id、recall owner/revision、anchor 与 canvasX/Y 存在性仅在用户明确修改对应项时变化。

## 首个公开事件红测与反例

拟在 `drawing-canvas.test.tsx` 使用真实 `DrawingCanvas` 公共 props，非直接调用内部 frame helper：给定足够大的 plot、既有 anchor Text（原 anchor 非空、无 canvasX/Y，具有独立 id、颜色、背景、字号、宽度与 owner），在其第一行靠前的**实际可命中绘制范围**派发 stage/canvas 第一 `pointerdown`，断言立即出现并聚焦 textarea；以首次坐标检查所渲染 shell/style bar 与 textarea 的可推导盒子，断言该点不落入 toolbar，落入 textarea。当前 y−24 + 顶部 36px 情形将先红。随后对坐标所落的实际目标派发第二 `pointerdown`/`pointerup`/`click`，输入多行、Ctrl/Meta+Enter；公开 `onCommand` 只收到一次 replace，id/owner/anchor/placement/字体/背景/宽度不变，canvasX/Y 仍缺失，内容完整。

**测试真实性限制**：当前 Vitest/jsdom 没有布局引擎和可信的坐标命中；直接对 `textarea` 调 `fireEvent` 不能证明该坐标会命中它。首红可从公开组件渲染后的 inline 几何计算或经过明确说明的局部测试命中适配器得到，但不能把它说成真实浏览器 hit-test。独立真实 Chrome 验收需使用实际同一坐标 mouse.dblclick，采集首/次原生 target、实际 textarea/style bar DOMRects 和 `elementFromPoint`，再核对 replace/SAVE 返回的原 anchor 元组；不得拦截点击、手工指定 textarea 或改文字来通过。

有区分度的边界，在首红/绿后按授权定向覆盖，不重复已有测试：

- 同一绘制文字第一行、第二行和长卡靠边点；分别位于 plot 顶/底/左/右的 anchor 和已有 canvas-positioned 文字，较小 plot、32px 字号、变化后的重排。控件仍在边界内并可触及，不能遮住价格轴；无解点明确报告而不伪装 PASS。
- 打开后主动从另一个坐标点击“改为自由文字”、再使用“定位”，确实按原协议改变 placement；键盘 Tab/Enter 与原 controls 保活测试继续通过。单击后焦点保留，textarea 外普通 blur 提交一次，Escape/组合中 Escape、中文 IME、换行/Meta Enter、画布只读 guard 各自不回归。
- 保持既有 `drawing-canvas.recall-review.test.tsx` 中窄 plot、右下边界、大字体、legacy anchor、显式位置切换行为的约束；在 root 允许的定向范围内运行适量受影响 Canvas 测试，不运行 STOPPED Recall workspace 或全套。两者名字不同，不将它们混称。

真实 A02 完成证明还需独立私库走现有单击及同坐标双击、编辑→保存→返回→reload→重开，验证完整文字和精确原身份/格式/anchor；目标表与源表变化按已批准规范检查。只读诊断不授权该执行。
