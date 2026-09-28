# 01 — 图表几何实现报告

State: closed
Status: accepted
实施: charts（gpt-6-luna / max）
集成负责人: root
参考: 原始图2与图4（路径见 `DESIGN-COVERAGE.md`）；`visual-contract.md`；`.scratch/control-visual-diagnosis-20260927/DIAGNOSIS.md`

## 实现

- 新增 `app/components/dashboard/use-observed-chart-size.ts`。持仓和历史表现图分别观察真实 SVG/绘图区的宽度与高度，并用同一组数值生成 `viewBox` 和点、轴、零线坐标；保留 `preserveAspectRatio="none"`，因为坐标空间现在与显示盒相同。
- 持仓图的绘图 memo 同时依赖实测 `geometry`；宽度或高度变化都会重建曲线坐标与日期轴。
- 持仓图桌面绘图区由 134px 增至 220px，窄屏为 190px。窄屏提示框保留在图下方自然流动，因此读数不会盖住后续控件或卡片。指标、期间、粒度按钮统一为 28px 高、11px 字。
- 历史表现工作区绘图区为 220px，窄屏为 240px；移除 234px 固定卡高与 138px SVG 覆盖，让表现、贡献和日历卡片由实际内容撑高并在桌面网格中自然对齐。工作区趋势按钮统一为 28px 高、11px 字。
- 两图的关键控件使用 `pointer: coarse` 时至少为 44×44px：包括持仓指标/期间/粒度、持仓 tooltip 关闭与日期选择，以及业绩视图、趋势粒度和日历导航。粗指针真实浏览器模拟仍待整页验收。
- 历史表现密集点的指针进入、移动与实体点击按 SVG 坐标选最近绘制点；键盘聚焦、Enter/Space 和键盘合成 click 仍选择其对应点。保留 44px 直径触摸命中圆及原有指标、期间、tooltip、空数据提示和部分估值说明。

## 验证

- **RED**：宽高同步回归重现原 SVG 尺寸错误；持仓 resize 回归额外确认 viewBox 更新后曲线 path 和末端日期轴必须一起更新。密集历史点回归重现原行为：进入后方重叠命中圆却错误选择后方月份。
- **GREEN**：`npm run test:unit -- app/components/dashboard/room-performance.test.tsx app/components/dashboard/room-holdings-history.test.tsx` 通过，2 个文件、50 项测试全部通过。回归覆盖持仓图宽高变化后的 path/日期轴坐标、业绩图仅高度变化、重叠鼠标点最近选择、命中圆 22px 半径及键盘精确选择。
- `npm run typecheck -- --pretty false` 与 `git diff --check` 通过。

## 三项验收门槛

**组件行为与几何：NOT VERIFIED。** 单元回归覆盖实测宽高、持仓 path/日期轴重算、重叠点最近选择、鼠标连续移动和键盘精确选择。独立真实浏览器第一轮在正式服务 `http://127.0.0.1:3044` 验证了 1440/1920/1055/821/820/390 六种宽度：持仓 viewBox 与绘图区一致，日期轴末端为绘图区宽度减 14，path 随宽度变化；业绩点鼠标和键盘均选择真实的 2015 年 4 月首点。持仓真实曲线 mouse tooltip、键盘日期/ Escape、日周月指标结果也通过；默认读数保留真实缺失估值说明。证据：`evidence/independent-chart-final-results.json`、`evidence/accept-real.json`。本轮最后新增 `onMouseMove`/`onPointerMove` 以修复同一重叠圆内移动时 tooltip 不更新；独立验收将重新截图并检查连续 hover，尚待回报。粗指针实际操作也仍待验证，因此本门槛保持 NOT VERIFIED。

**参考图与多视口视觉：NOT VERIFIED。** 图2/图4已按任务要求直接查看；本票没有宣称像素级还原。六种宽度的几何和轴末端已通过首轮脚本，但独立视觉比较及本轮 hover 修复后的 fresh 截图待 Astra 回报。整页此前 821、820、390 的横向溢出已定位于持仓表格的绝对定位 visually-hidden 内容逃出滚动容器，控件负责人修复后仍需整页验收；资产分布高度、窄屏 tooltip 流动位置及粗指针命中区也等待集成复验。证据：`evidence/accept-real-first.log`、`evidence/overflow-first.json`、`evidence/independent-chart-final-results.json`。

**数据与状态安全：NOT VERIFIED。** 浏览器使用用户指定的正式 SQLite 部署库，没有注入样本或主动执行交易、导入、删除、复盘保存、账户编辑。页面已有的证券元数据解析会自动 `PUT /api/storage/trades`：成交与导入批次摘要保持一致，证券条目数一致但元数据摘要变化；依据见 `evidence/db-observation.md`。该行为不是本票引入，本票也不宣称整库零变化。独立视觉审查、所有要求视口的页面溢出复验、粗指针模拟及全量集成仍未完成。

本票只进入 `implementation-ready`，保持 open；不能据此接受本票全部视觉验收或整个功能。第一轮浏览器 PASS 不包含刚加入连续 hover 的 fresh 截图，也不证明触控命中、全页视觉或整页横向溢出验收已完成。
