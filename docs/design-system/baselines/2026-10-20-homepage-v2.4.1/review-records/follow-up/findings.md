# 独立验收发现与复验

2026-10-21，root；文档修订范围。浏览器 CSS 视口 1280×720、DPR 2、缩放 1；验收台按 SVG 原始尺寸显示，超宽图保留横向滚动。下列首轮证据绑定表内哈希，不作为最终版通过证据。

|ID|图稿/初检哈希|发现|结论与责任|复验|
|---|---|---|---|---|
|R01|history.svg / e1afda4d5138|仍有2026（按月）、分期旧控件；胜率计数在主值下方；月份前导零；无回合文字代替背景原因提示|FAIL，history继续按round4/5传播|待复验|
|R02|holding-return.svg / d243f19805a1|来源市值125337.94、浮盈9431.24，详情125338.00、9431.00不一致；数量tooltip带CNY|FAIL，tables修正同一动线示例|局部复验 PASS，见下方记录|
|R03|visual-samples-board.svg|未来区域/缺口文字与已确认无图内文字的状态表达不一致；其余局部样式也需跟随共享源图|FAIL，root整合history/shared/tables补丁|待复验|

证据：[持仓首轮](evidence/holding-first-pass.png)、[历史首轮](evidence/history-first-pass-fail.png)。持仓首屏在本视口未见表头右缘偏移或标题汇总重叠，但不能据此跳过极值与其它关联图。

## 原型动线独立复核：贡献详情连接

- 2026-10-21，root，实际 IAB CSS 1280×720、DPR 2。
- round5/contribution.html：全部市场 → 点击 A股条 → A股标的明细（全局市场仍为全部）→ 贵州茅台详情连接占位 → 关闭并返回。
- PASS（原型范围）：返回 A股同一明细、同一页，焦点恢复贵州茅台触发按钮；详情明确注明连接占位，未当作正式交易详情验收。
- 证据：`evidence/contribution-detail-connection.png`。
- 产品数据库、正式交易详情持久化：本轮为文档更新，不适用；此记录不代表产品实现通过。

## 整页持仓汇总复核

- root 在真实浏览器检查 home-1280.svg（9209a0798744）：C 方案汇总已移至标题同行，标签与金额分层；工具区独立。数值表头和数据右边缘一致，没有标题汇总重叠。
- 证据：`evidence/home-1280-holdings-integrated.png`。仅持仓区域 PASS；整页历史和贡献区域仍待修复，不宣布整页通过。

## R02 详情示例复验

- root 在实际浏览器检查 holding-return--detail.svg（b1c18760242e）。来源行与详情的完整市值均为125,337.94 CNY，浮盈均为9,431.24 CNY；数量182.00的提示不再带货币。
- 详情卡实际渲染无重叠；全图文字矩形交叉检查未发现重叠。证据：`evidence/holding-detail-fixture-retest.png`。该结论限于静态分镜与数据一致性，不代表产品详情交互通过。

## R03 共享样例板下半部复验

- root 在实际浏览器检查 visual-samples-board.svg（fee628f98ab9），1280×720：未来与缺失采用不同背景，图内原因文字与旧斜线标记已移除；原始点列保持不变。
- D15 表头与数值右缘一致，D10 常规/窄卡主值与计数共享底部基线。此区域视觉 PASS，全图文字矩形交叉检查为空。
- 证据：`evidence/shared-board-d14-d15-d10-retest.png`。上半部与整体传播仍需最终整合验收，此处不宣告 V2.4.1 整体通过。

## 极值持仓复验

- root 在实际浏览器检查 extreme.svg（55688f39275a）：数值表头与内容共享右边缘；C 汇总和工具区分离；12.35 亿、+3456.80 万、−9.88 亿均保留两位；未知值使用 —，确定零为0.00。
- 此静态表区域 PASS。证据：`evidence/holdings-extreme-retest.png`。页脚版本身份仍交回修订，最终哈希需重新绑定。

## R04 胜率零轴误定位：FAIL

- root 实际浏览器检查 history-stats-win.svg（a68ac47dc608）：高亮横线位于25%刻度，0%在绘图区底部；金额KPI还显示+3万，未保留两位。
- 责任：history。应按各metric真实零值映射设置零线，检查胜率/回合数/金额全套关联图，不能复用金额图的固定y坐标。金额保留+3.00万。
- 证据：`evidence/history-win-zero-axis-fail.png`。此问题阻止历史图及整体验收通过，待修复复验。

## R04 零轴复验

- root 实际浏览器复验 history-stats-win.svg（f7f32106516d）和 history-stats-rounds.svg（4aa93b102202）：高亮线分别对应0%和0回合，25%/1回合恢复普通网格。金额KPI为+3.00万，已按两位小数显示。
- 横向滚动检查胜率图右侧组合选择器、未来区域与12月坐标：无控件碰撞；空回合/未来区域背景分别可辨，无图内原因文字。此两张当前指标图静态视觉 PASS，不代替四张整页传播验收。
- 证据：`evidence/history-win-zero-axis-retest.png`、`evidence/history-rounds-zero-axis-retest.png`。前次失败证据保留。

## R05 贡献几何与排序传播：FAIL

- root复核贡献中空柱：rect高度14加两侧描边2，实际可见外高16，与实心14不一致。应内缩描边，外高保持14，保留真实数据宽度。
- 四张整页贡献嵌入仍使用并排排序按钮，与已确认单个排序下拉框加独立未平仓筛选不一致。
- 责任：history；待独立复验，未闭环前不接受整页。

## 交易库练习表格复验

- root实际浏览器检查hcr06-final-sim-ab.svg（98a9733b23eb）：日期/市场/搜索/刷新与下方表头分离，无重叠；同标的同日两次练习各自保留practiceId，分别2与1个有效回合。
- 此静态分镜区域PASS，证据：`library-practice-retest.png`。不代表产品筛选和数据写入验收。

## R06 年度卡与贡献控件残留：FAIL

- root 实际浏览器检查 journeys-year.svg（0335490bde29）：D07 组合选择器已去除可见字段名，箭头均在边框内；但 D10 的 9 / 14 盈利回合仍位于 64.3% 下方，未同步已确认的 A 方案右侧同基线。证据：`evidence/annual-d10-fail.png`。
- tables 独立复核四张 home 预览：D10 A/窄 B 通过；D11 排序面仍为旧蓝色填充、未平仓仍为胶囊；D12 缺少实心/中空图例身份。详见工作报告 `work/tables/history-embedded-preview-review.md`。
- root 源码复核还发现嵌入补丁将负数文本颜色随柱色一并替换；应将柱形颜色与数值文字颜色分开处理。
- 均退回 history，必须修复后重新生成预览并绑定新哈希；局部通过不升级为整页通过。

## 贡献模式与分页复验

- root 实际浏览器核对 round5 原型：历史模式保留禁用的“仅看未平仓”复选框；切回当前期间恢复 A股明细；10项按8行分页，第二页2项、下一页禁用，返回市场层恢复三市场汇总。
- 原型范围 PASS，证据 `evidence/contribution-history-disabled.png`、`evidence/contribution-page2.png`。这些是已有批准原型的验证，不代表静态整页传播或产品实现自动通过。

## R07 局部搜索清空分镜页脚：FAIL

- shared 独立实际浏览器复核23张表格图，22张通过；local-search-pages--clear.svg（2294ed552ce1）卡片底边y520，页脚基线y518，页脚与卡片贴压。
- 已交tables修复，修复后由shared再次独立实际渲染；前次截图保留在工作目录 evidence/tables-review/browser。

## R07 root 复验

- 清空搜索分镜文档页脚移至卡片外，基线544；裁切范围同步至画布560，分页与产品卡片不变。
- root 实际浏览器复验 e10217122ce5：页脚完整可见，与卡片分离，表头/数值对齐保留。证据 `evidence/local-clear-footer-retest.png`。待 shared 独立复验最终哈希。

## R08 整页嵌入金额零轴：FAIL

- root 检查最新 home-1280 预览：历史金额刻度为9000、6500、4000、1500、−1000，高亮线仍落在1500，而非真实0。局部指标图R04通过不能覆盖整页中不同刻度范围的嵌入图。
- 退回history，四张整页应按原刻度范围线性插值定位真实零线，不改变原series。排序文字仍含向下字符与SVG箭头重复，也一并清理。

## 最终整合复验（2026-10-21）

- R01/R03/R04：局部历史、共享样例板已复验；19张历史/贡献及23张表格独立逐图报告见 independent-shared/REPORT.md。
- R02/R07：同一详情fixture与清空页脚最终通过；R07当前hash e10217122ce5，独立复验通过，旧FAIL保留。
- R05/R06：四张整页已应用最终补丁；排序为中性单下拉框、复选框独立，柱形外高14；年度卡3c4ef7647ecd在真实浏览器显示主值与计数同基线，计数完整在卡内。证据 evidence/annual-d10-final.png。
- R08：整页原1500刻度恢复普通网格，真实0线位于1500和−1000之间（嵌入局部y470），未改原series。root实际浏览器复验home-history-1280 f5a947389865和home-1440 bcb180ebf38b；当前/历史图例、禁用checkbox、布局位置通过。证据 evidence/home-history-final.png、evidence/home-current-final.png。
- 以上为文档静态图稿与批准原型的范围结论，不代表产品业务实现完成。最终覆盖与排除范围以 final-acceptance.md 为准。

## 最终覆盖补查

- F-BOARD-CLIP-01：样例板外层背景高1060而画布1720，造成左侧白条。root将背景补齐1720；shared同视口Chrome独立复验PASS，root实际浏览器底部复验PASS。最终源hash见board-hashes.json，截图evidence/board-background-final.png。旧FAIL保留在independent-shared。
- 曲线补查：8张既有图纳入覆盖；chart-scale轴精度和chart-gap/period旧页脚被发现遗漏。缺失斜向虚线桥与正文断线规则冲突，由root连同金额轴阈值及period自然期间词完成修正，tables独立复核全部8图通过；最终证据见independent-tables/chart-fixes-final-review.md。root实际浏览器复验三张受影响代表图，截图为evidence/period-final.png、chart-gap-final.png、chart-scale-final.png。
