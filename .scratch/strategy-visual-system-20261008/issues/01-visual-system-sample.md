# 策略台视觉规范与真实组件样板

State: open
Status: acceptance-failed
Assignee: root
集成负责人: root
Blocked by: none

## What to build / Scope

基于此前已推送origin/codex/strategy-workbench-v1-design@9c2b3d2，主动诊断策略台与原生复盘，以实际组件形成一套推荐视觉规范和可逆样板。包括最新截图/computed测量、八字段问题、完整中文/阶段/双截止/原判断与补充、同态前后比较、独立接受和推广范围。仅样板；不授权生产修复、远端推送/合并/发布。

触发：用户要求检查页面、布局、控件/视觉和实际样板，且本轮改变frontend控件及state wiring，适用前端控制与视觉空间审计。checkpoint缺该流程文件，root读取origin/master@7a5d137版。整体票acceptance-failed的原因是必需的部分交互仍NOT VERIFIED，区别于已修复的样板FAIL。

## Refs

- [精确规格/参考图/owner/旅程映射](../DESIGN-COVERAGE.md)
- [设计规范](../../../docs/designs/2026-10-08-strategy-visual-system/README.md)
- [八字段诊断](../../../docs/designs/2026-10-08-strategy-visual-system/diagnosis.md)
- [最终接受记录与运行命令](../../../docs/designs/2026-10-08-strategy-visual-system/acceptance.md)
- [独立审阅](../reports/visual-acceptance.md)
- [证据源版本](../evidence/version-manifest.json)

## 验收标准

- [x] 远端checkpoint隔离分支、在线backup测试库，真实baseline和最新运行测量：[接受环境](../../../docs/designs/2026-10-08-strategy-visual-system/acceptance.md)。缺失启动包专项NOT VERIFIED。
- [x] 八字段问题和可执行参数/例外：[诊断](../../../docs/designs/2026-10-08-strategy-visual-system/diagnosis.md)、[规范](../../../docs/designs/2026-10-08-strategy-visual-system/README.md)。
- [x] S0→S1真实目标bar/成交，S2双截止/清仓，原判断与S1全文保留：[覆盖记录](../../../docs/designs/2026-10-08-strategy-visual-system/acceptance.md)。
- [x] 样板保存→返回→刷新，实际计划及退出评价留存：[持久化证据](../evidence/recall-persistence-reload-1440.jpg)、[退出刷新DOM](../evidence/recall-exit-persistence-after-reload.dom.txt)。不称生产SQL通过。
- [x] 桌面/断点/900/390、实际Tab价格焦点与初始回放主动作修复：[最新焦点](../evidence/recall-final-v05-price-focus-1440.jpg)、[390静止六控件](../evidence/recall-v05-wrap-s1-390-full.jpg)、[真实推进](../evidence/recall-v05-wrap-action-390-full.jpg)；独立范围接受见报告。
- [x] root typecheck/9文件193测试、最终CSS parse与diff：[验证摘要](../evidence/root-verification.txt)。历史全量31FAIL保留且未重跑。
- [x] 新鲜真实浏览器预览与服务仍运行、启动方法：[预览/启动](../../../docs/designs/2026-10-08-strategy-visual-system/acceptance.md)。
- [ ] Tooltip/列表/摘要/真实wheel缩放的完整未来检查；现有已知序列投影PASS不能代替完整UI旅程。
- [ ] Text完整编辑/IME/拖动与浮层/轴/marker碰撞规则；现有可读角色PASS不能关闭所有遮挡状态。
- [ ] 真实hover/active、Windows逐字字体、模拟/物理触摸、手机键盘、生产SQL写链与三阶段导出。

## 反例、失效及复验

旧FAIL留存在诊断及独立报告：220px图高裁全文；来源badge残字；左侧重复计划字穿Text；390同值成本/计划角色不清；桌面fit/focus隐藏祖先scroll28；390默认回放主动作右裁。后两项先使旧接受失效，已同步功能README/覆盖/接受记录，最终67e CSS以flex剩余高度及回放两行修复并复验。局部复验不关闭整体票。长Text盖390成交marker及选中浮层盖轴/阶段尾登记为探索例外，正式推广前须解决/明确接受。
