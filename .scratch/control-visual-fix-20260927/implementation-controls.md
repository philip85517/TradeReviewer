# 02 — 控件一致性与持仓密度实现报告

State: closed
Status: accepted
实施: controls（gpt-6-luna / max）
集成负责人: root
参考: `visual-contract.md`、`DESIGN-COVERAGE.md`、`.scratch/control-visual-diagnosis-20260927/DIAGNOSIS.md`、原图1/2/3

## 实现

- 新增 `app/components/scope/scope-control-primitives.tsx` 和配套 CSS module。范围控件共享深色背景、边框、选中文字和焦点 token；单选组保留原生 radio，分段性质选择使用 `aria-pressed` 按钮，期间选择使用 tabs 语义，原生 select 共用 34px / 13px 标准档。实际消费者为交易库范围栏和交易室顶部范围/期间控件。
- 交易库保留“来源未知”radio及性质变化时清空账户和模拟运行的原有语义。模拟运行文本框沿用相同控件 token。交易室性质、账户、模拟运行和计价控件接入共享 primitive；期间组使用统一 28px / 11px 紧凑档，移除了旧 `.periodTabs button` 尺寸覆盖。筛选开关在粗指针下为 44px 高。
- 实际检查发现原生 `legend` 在浏览器中被单独放在单选项上方。为匹配参照图同行标签，视觉标题改用装饰性 `span`，同时保留 fieldset 的 `aria-label` 分组名称和原生 radio 语义。最终真实页面标题和选项垂直中心相差 0px。
- 持仓表格行基准高度从 42px 调为 48px，迷你走势图由 27px 调为 32px；紧凑桌面断点维持所有11列和局部横向滚动，行详情、搜索与分页保留。最近记录里的屏幕阅读器时间文本仍保留，但通过一个局部定位上下文约束绝对定位，避免逃出表格并撑宽整页。
- 资产分布仍使用原金额、分母、覆盖和缺失状态。全卡缺口、分组完整 note、每个分类的长原因、现金 missing reasons 与两个现金 money-view note 都用默认收起的 disclosure 展示；现金原因在同一处去重汇总。展开内容限高并可滚动，因此不会隐藏或删除模型信息，也不会让真实缺失原因把整页撑到多屏。保留“未知币种不纳入已知币种分母”、多空说明、完整覆盖/可信小计和现金状态。

## 验证

- **RED/GREEN：** 先添加资产分布长原因、现金原因及交易室范围 primitive 的断言；初次运行按预期在实现前失败。随后通过 `npm run test:unit -- app/components/library/trade-library.test.tsx app/components/dashboard/review-dashboard.test.tsx app/components/dashboard/room-holdings.test.tsx app/components/dashboard/room-allocation.test.tsx`：4个文件、111项测试通过。包含真实 radio 性质切换回调、未知来源、完整现金说明、未知币种组说明和局部持仓交互测试。
- `npm run typecheck` 通过；`git diff --check` 通过。
- 以 Playwright 打开真实页面 `http://127.0.0.1:3044`，1440×1000、DPR 1。截图：[`controls-library-after.png`](evidence/controls-library-after.png)、[`controls-room-after.png`](evidence/controls-room-after.png)。可交互 radio 顺序为模拟盘→实盘→来源未知；三态都能选中。单选组可见标题与选项垂直中心差 0px，radio 行高34px，账户 select 高34px。
- 同一真实页面默认资产分布卡高392px，保留11个持仓列；全卡、分组和现金相关的全部4处说明默认收起，其中现金 disclosure 收纳1777条原因。浏览器文档宽度在1440、821、820、390视口分别为1440、821、820、390，无整页水平溢出。测量和操作记录见 [`controls-real.json`](evidence/controls-real.json)。
- 独立粗指针 context 使用 Playwright `hasTouch`，视口保持1440px，从而将输入方式与窄屏宽度分开。性质分段高42px；筛选开关、资产分布维度、交易库未知来源 radio、账户 select、模拟运行输入均高44px。证据：[`coarse-controls-real.json`](evidence/coarse-controls-real.json)。触控为浏览器模拟，未声称物理触屏验证；图表真实 tap 另见 [`touch-real.json`](evidence/touch-real.json)。
- 原图1/2/3已与最终真实页面截图直接对照：共用控件继续采用深色底、细边框、蓝色选中态；当前持仓行/迷你图空间增加但保留完整列；资产分布默认说明紧凑且真实缺失事实可展开。工作者视觉预检不替代 Astra 的独立整页对照。

## 三项验收门槛

**范围控件及表格行为：实现自测 PASS。** 本票单测通过，真实页面验证了模拟/实盘/未知来源切换；实际测得标准控件34px、粗指针目标42–44px。持仓表保留11列，相关搜索、分页、详情组件测试通过。证据见本报告验证段与 `controls-real.json`。

**参考图与整页视觉：实施预检 PASS；独立验收 NOT VERIFIED。** 真实截图是在1440×1000、DPR1获取，并按原图1/2/3核对层级、控件密度、行高和资产分布。821/820/390整页宽度检查通过。1920×1080、1055×900及其它全页响应式比较由root/Astra整体验收；实施者的截图对比不是独立验收。若Astra发现不匹配，保持任务 open 并补证复验。

**真实数据与状态安全：NOT VERIFIED（协调者负责）。** 本票没有修改业务数据含义或增加业务写入路径，Playwright只用页面筛选控件；真实应用打开时已有的证券元数据自动解析/持久化仍会发生。基线观察证明成交与导入批次摘要一致、证券计数一致而证券元数据摘要有变化；详情在 [`db-observation.md`](evidence/db-observation.md)。不得据此声称整个数据库零变化，也不替代root的最终对账。

本报告仅将实现标为 `implementation-ready`，保持 `State: open`。独立页面视觉对照、完整整页行为和数据对账仍由集成负责人核验。
