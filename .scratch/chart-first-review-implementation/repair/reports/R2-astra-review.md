# R2 Text / toolbar 独立审查

2026-09-26；Astra独立只读审查。结论：**scoped acceptance-failed，以下R2-1/R2-2/R2-3需返修**。未操作浏览器、未改产品、未跑全套测试；root负责最终真实截图。已读取R2-text报告和实际4个产品文件，实际view_image查看D02 `02-chart-workspace.png`、D03 `03-structured-record.png`，对照主规格US8–12、§2第104/106/110行，元素E03/E08及字体54–55、长文115行。未把worker75通过当产品接受。

## R2-1 · P1 · 新卡永远展开，旧文字却默认折叠，capture没有接入live展开状态

`drawing-canvas.tsx:176–181,509–515`、`canonical-chart-capture.ts:263`把 `hasCardPosition || expanded` 传作textCardLayout的expanded参数。新卡都有canvasX/Y，所以参数恒true，“展开/收起”按钮只改Set/按钮文案，正文与高度不变。旧anchor drawing没有坐标，反而默认false从完整原文变两行。违反§2短卡摘要/展开及报告所称旧drawing原样行为。

独立Node执行实际text-geometry.ts：四行文本，true返回4行/92px/collapsed=false；false返回2行/50px/collapsed=true。不是仅根据命名猜测。

另外live expandedTextIds只存在DrawingCanvas本地state；ReplayChart构造CanonicalCaptureScene未读取/传入此集合。现有legacy文字点击展开后live4行，canonical仍默认2行；新增可选scene字段不等于调用方已接入。修复需区分legacy默认完整与新card默认compact，真正切换同一layout，并明确capture继承当前展开状态；测试应断言paint行数/高度和最终capture调用，不仅按钮存在或helper单测。

## R2-2 · P1 · 编辑legacy文字会偷偷新增画布位置并跳动

`drawing-canvas.tsx:534–537,771–784,726–736,489–500`：legacy anchor Text无canvasX/Y时，打开编辑器虽然x/y取当前投影，却将fields默认设0.08/0.12；commit无条件保存这两个字段。下一帧pointForDrawing只要有有限坐标就走画布位置，正文从原时间价格位置跳至画布8%/12%，并变成新anchored card。仅修改原文就改变构图，违反旧drawing兼容/编辑保留样式和锚点语义。既有identity测试只检查id/text/style，没有检查新加coords或几何，因此不会捕获。

修复：旧drawing普通编辑保持字段缺失，或在显式迁移时以当前实际投影计算等价位置；不能默认0.08/0.12。新卡拖动路径确实只改canvasX/Y且保留anchors，这个局部是正确的。

## R2-3 · P2 · 所谓bounded geometry仍会越界，编辑器不避价格轴

`text-geometry.ts:textLayout/textCardGeometry`、`drawing-canvas.tsx:249,1145–1154`：

- CJK换行预算width-4，但painter从x+6画，且未为编号/展开按钮留区。实际Node例width172、12个14px汉字留在同一行（168px），最终画到x+174，超过卡宽2px；编号位于右上且正文同一行可能与其覆盖。使用有效Canvas字体字符串解决了var字体无效，但不等于实际几何已正确。
- long expanded layout若height428而plotHeight200，geometry只把y改成4，仍返回height428；展开正文/收起控件可落在plot外。Node调用已确认，当前新卡恒expanded令此反例更容易发生。
- editor只下界clamp left=max(2,x+4)，没有上界；width虽受canvas总宽限制，用户在靠右位置创建Text时left+width仍可越过plot/价格轴。例如640px plot x620、width180会到804。D02同屏录入与E115编辑不遮轴未实现。

修复应统一正文padding、编号/控件占位与可用plot边界，长展开内容有可见且可操作的约束，编辑器按实际剩余空间定位；不能缩小字体规避。真实中文14px、21px行高、右边缘/底边缘、多行长文的浏览器比对仍unverified。

## 已确认正确与其界限

- ReplayChart未覆盖defaultTextPlacement，DrawingCanvas默认anchor，真实调用方会得到新14px、暗色背景、单击锚定默认；不是仅孤立组件默认。canvasTextFont使用有效Geist/PingFang/YaHei/system字体，live DPR与capture统一缩放；实际字体可读性仍待root。
- raw editor.value直接提交，未trim/截断；多行原文、id/recallOwnerId/textRevision/style通过spread保留。新card拖移仅移动画布位置，时间价格anchor保留，live/capture共享painter及connector几何。
- toolbar compact优先选择/Text/趋势/水平/通道/做多盈亏比，其余旧工具仍在More，工具无删除，title/aria属性存在。compact时撤销/重做/锁定/清空在More与常驻各出现一次（报告“once”不准确）；不是本次主要阻断，但应由R3结合窄屏显示策略消除重复并实测36/44px命中区。
- 没有运行产品浏览器，不能签视觉通过；R2短卡和兼容问题由源码与纯几何直接证明，必须先返修，不能等截图掩盖。

## R1历史测试状态修正

已独立读取root `R1-state-coordinator-recheck.txt` 44 passed，并检查pendingCapture/act/加载等待的测试同步修正：核心保存并发/服务端revision断言未删。R1-astra-final-gate.md已追加“具体历史失败已解决”，保留旧78/79失败事实。R1首次核心门禁继续pass，R5扩展未验保持原归属。

本报告冻结；产品文件未修改。建议owner返修后先补3类定向反例，再由root走真实新建/折叠展开/编辑legacy/边缘编辑/保存capture与重开，不以组件报告替代集成接受。
