# 策略台视觉规范与真实组件样板 · 2026-10-08

2026-10-10归档授权：用户明确要求沉淀当前视觉、建立文档索引并提交远端任务分支。新增[0.7视觉检查点](../../docs/designs/2026-10-08-strategy-visual-system/versions/0.7-20261010/README.md)和[06归档任务](issues/06-visual-checkpoint-and-remote.md)，下文“不推送”为当时历史范围，本轮按新授权处理。保留整体01与生产固化未验边界；不改视觉或原证据。

基础：origin/codex/strategy-workbench-v1-design@9c2b3d209a202422c3d5aeab5969a9b093cfda92。任务分支codex/strategy-visual-system-20261008；保留另一工作树未提交草稿，不推送/合并/发布。

状态：规范草案与一套推荐系统的两个业务上下文已可评审；已验旅程/视觉比较局部PASS，完整UI接受仍NOT VERIFIED，整体票open/acceptance-failed。首次冻结A HTML3520318、原生CSS67e714f保留为历史版本；后续完整视图恢复的A HTML为4ff8a33，精确SHA/截图绑定见新增full-restore-manifest，不改写原清单。

- [规范草案](../../docs/designs/2026-10-08-strategy-visual-system/README.md)
- [八字段诊断与历史失败](../../docs/designs/2026-10-08-strategy-visual-system/diagnosis.md)
- [最终接受记录、预览与启动命令](../../docs/designs/2026-10-08-strategy-visual-system/acceptance.md)
- [精确要求/元素/owner/旅程映射](DESIGN-COVERAGE.md)
- [任务与未完成门槛](issues/01-visual-system-sample.md)
- [独立直接图像接受](reports/visual-acceptance.md)
- [源码/参考审查](reports/source-audit.md)
- [历史测试失败审查](reports/test-failure-audit.md)
- [冻结版本与证据清单](evidence/version-manifest.json)
- [完整 Workbench 恢复：预览、范围、证据与启动](../../docs/designs/2026-10-08-strategy-visual-system/full-workbench-preview.md)
- [后续恢复版本清单](evidence/full-restore-manifest.json)

## 回归与复验同步

2026-10-10 下滑修复最终：用户认可0.7视觉后，仅完整预览作用域恢复body纵向滚动。05及04重开范围closed/accepted-scoped，1280/1440/1060/1059/390真实滚轮及Home/End、菜单/抽屉、结果/比较/原版和离开预览分别接受；独立前后图比较PASS。[最新接受、活预览及启动](../../docs/designs/2026-10-08-strategy-visual-system/observe-scroll-20261010.md)。下文滚动FAIL为修前历史，整体01及生产推广NOT VERIFIED仍保留。

2026-10-10 用户“整体ok”认可当前视觉，随后报告无法下滑；root复现桌面body hidden阻止wheel与End。04重新open/acceptance-failed，新增[05滚动修复](issues/05-complete-preview-scroll.md)，DESIGN-COVERAGE S01–S04；历史视觉接受保留，滚动门槛FAIL待修。窄屏390原本可滚动，须保持。

2026-10-10严格回归最终：04重新接受并关闭（accepted-scoped）。R01–R11新鲜复验、root真实图表旅程及独立源码/直接看图分别PASS于完整观察和共享导览范围；18档主体与关键浮层已验。旧PASS、第一批断点/标签FAIL、Final3菜单越界FAIL保留，不覆盖旧图。[回归契约](observe-regression-contract-20261009.md)、DESIGN-COVERAGE最终追加表、[当前接受与活预览](../../docs/designs/2026-10-08-strategy-visual-system/observe-regression-20261009.md)、[最终清单](evidence/observe-regression-20261009/manifest.json)共同记录范围。整体01及下文原NOT VERIFIED不变。

窄屏220px图高/中文裁切、来源badge残字、重复左侧白字、390计划/成本同值角色遮挡等旧FAIL均保留；对应新图只关闭其局部问题。桌面实际适应全部/焦点引发隐藏祖先scrollTop28、阶段裁切的FAIL以≥1331 flex剩余高度修复，冻结版67e重新捕获S0/S1/价格焦点，不能用window.scrollY0代替祖先检查。390初始回放主要动作裁切的FAIL以六控件正常换行为两行修复，原DOM顺序、44px高度不变；真实下一笔仍揭示Mar9、持仓400。

现有例外：A最小宽1100/900与390未适配、200展开导航未实施；390完整原文可能盖成交marker；选中图层浮层可能盖阶段尾/轴上端。字体逐字来源/Windows、Tooltip/wheel/完整Text编辑与IME/拖动、模拟及物理触摸/手机键盘、生产SQL写链、导出仍未验证。整体不得关闭；后续推广范围见规范，需重新接受全部适用门槛。
