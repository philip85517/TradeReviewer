# 视觉样板实施计划

用户授权普通诊断、测量、设计细节、可逆样板独立完成，不另设设计参数/计划批准等待。

1. root：读取当前远端规格/参考图、运行基线、保存computed和截图、隔离SQLite在线备份。记录缺失启动包、来源版本。
2. Luna workbench：复制远端A真实LWC模型到 public/design-system-20261008/workbench，保留原数据/状态/固定框架，只增加scope CSS/统一Lucide图标/对照与复盘入口。默认recommended，?appearance=baseline为相同数据原样式。禁止修改远端原模型/业务代码。
3. Luna recall：复用原生Recall+现有f42e可选preview seam作为本地草稿参考，创建 development-only ?prototype=review-design&mode=baseline|recommended。完整fixture与阶段合同，localStorage样板repository真实保存可重载；CSS仅sample。生产默认不改。先证明真实图表S0→下一笔→S1再校准样式。
4. root：pinnedNode26通过scripts/start-local.mjs固定本次3069与显式隔离DB启动，typecheck/相关状态测试、真实浏览器鼠标/键盘/长文/窄窗/tooltip/阶段/保存返回刷新。遇到问题限样板修复。
5. independent design_audit：读取匹配状态新截图与批准参考，检查样板是否偏离合同、层级/密度/价格/原文和操作视觉；root验收 integrated UX。
6. root：规范草案、八字段诊断、control inventory、version-bound acceptance、后续固化范围、live preview/前后与代表截图一次交付。未验证单列，不将样板称生产落地。

测试范围：CSS可逆不写mirror tests；新增样板repository需 meaningful reload/persist/reset/error test；若采用新增safeStageProjection条件须测试未知决策/计数不泄露，已有Recall核心tests运行。无推送/合并。

实施记录：六项产物已形成可评审版本；root独立最终typecheck与9文件193测试PASS，独立图像审核已覆盖阶段/长文/视口，保留历次FAIL及修复。完整UI接受未完成：浏览器能力未提供实际wheel/hover/拖动/触摸的完整未来检查，编辑浮层/导出/生产SQL仍NOT VERIFIED，不能以局部PASS关闭整体票。资料、预览与startup见 docs/designs/2026-10-08-strategy-visual-system/acceptance.md。

最终回归同步：桌面fit/focus祖先scroll28与390初始回放主动作右裁旧FAIL保留；推荐CSS67e完成剩余空间flex与回放两行，真实浏览器截图/实际推进复验。功能README、任务票、覆盖和接受记录同时更新；完整未验证门仍阻止整体接受。

## 2026-10-08 完整 Workbench 入口恢复

1. root 与只读 inventory 定位实际历史组件/截图，区分完整 React 原型与紧凑 A；没有找到 GIF/视频文件，不把交互原型称作丢失动图资产。
2. root 在真实图表完成双策略三个月创建→T0→下一日最小旅程，保存新 bar/成交/持仓证据；记录 F01–F07/G01–G04 和独立 owner 后才派发。
3. Luna full_preview 增加 dev-only 入口与可选预设初始化；Luna view_guide 增加 A 中文目录和深链接，文件边界互不相交。
4. root 验收完整结果/比较三图、事件返回来源、T0/running 和两档桌面；发现目录 hidden 遮罩实际 FAIL 时，保留失败截图及 DOM 测量，按 systematic-debugging 根因修复后另拍，不覆盖旧失败。
5. benchmark_inventory 独立直接看图，并按 requesting-code-review 检查范围内最终代码；root 独立检查源差异、typecheck/lint 与 live browser，更新本次局部接受和版本绑定。原票01未验证门不受本票覆盖。
