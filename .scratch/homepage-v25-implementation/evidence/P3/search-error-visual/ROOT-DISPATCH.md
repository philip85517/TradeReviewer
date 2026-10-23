

## 2026-10-23 04:39 CST — 搜索错误状态视觉 CR03（原 P3 同票）

root 直接对照当前实际 `evidence/P3/search-recovery-fix/root-http503-after-keys.png` 与已批准 `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/search--empty.svg`（1100×690）及 `search-error-frame.svg`（1100×820，带说明框），明确 FAIL：错误白字/重试位于结果区左上，原稿为居中错误色提示及88×36描边重试。Surface c6e14890… / CSS d34b54ab… 的功能检查不抵消该差距。P3正式0/3，P1正式2/3 FAIL保持，未开始新正式轮次。

|需求/elementID/准确规格|准确参考|状态/旅程|owner与范围|预期及证据|当前|
|---|---|---|---|---|---|
|HV25-08；HOME-HP03-B019，无原elementID；正文130–160，manual370–455的加载/错误/恢复规则|上述精确两SVG的GlobalEntitySearch第三组；直接已看派生reference-readback/search-error-frame.png|真实目录读取503→输入保持→重试→恢复可选结果；另核loading/empty不混同|state_g61仅home-surface.tsx的搜索失败markup及home-surface.css局部错误样式；root唯一浏览器、整页视觉及完整数据流负责人|舞台960/两侧24、输入结果锚点/滚动不变；错误提示在结果区按参考居中，error token；重试88×36/6px圆角/描边；保查询/错误原因/键盘不可选隐藏结果；实际1280×720 DPR2先对照，不声称其他断点。证据evidence/P3/search-error-visual/，原失败不覆盖|视觉FAIL；修后NV|

仅授权一个有限视觉候选；不得改host、S、session、目录、Workspace、依赖、既有测试或数据库，不添加假loading/假网络/新业务状态。已验证搜索键盘与恢复测试作为受保护回归。无新业务写入，数据库写入门对该局部修复NOT APPLICABLE；实际导航/查询恢复/重试及独立视觉仍适用。无用户授权设计差异。原四区附件和P2/P4仍未放行。

派发：直接读当前workflow、frontend-control-audit、task-decomposition与ui-task-templates；实际原SVG和上述规格、相关当前CSS/markup，再给根因与一次有限候选。保持错误原因和查询的可见语义；不删既有文本来绕过行为测试。原图的中心锚点、16px错误色和88×36重试是比较依据，若现有原因文案长度不同，保留可见原因，不扩大状态模型。先交implementation-ready、完整diff/源码SHA及既有29项定向回归、有限lint结果；静态CSS外观不写假组件几何测试。不得自签视觉PASS或再派代理；root完成真实503/恢复与看图。物理触控/其他断点未执行必须NV。源码冻结后停工等root。
