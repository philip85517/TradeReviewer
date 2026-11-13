# Homepage Mock First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 用户已确认方案并选择由当前主模型实施；保持该执行方式。

**Goal:** 在当前工程选择性迁入首页展示代码，通过可替换展示接口和确定Mock数据验证正式设计及核心往返路径。

**Architecture:** 新增`/preview/homepage`，不加载旧工作台。展示合同与Mock读取实现分开；卡片、曲线、日期控件适配候选叶子代码，持仓、详情与请求宿主重新组合。Mock先证明展示及交互，后端模型与真实性能留下一阶段。

**Tech Stack:** 现有React 19、TypeScript、Decimal、lucide、CSS、Vitest/Testing Library、vinext；不新增依赖。

**Spec:** [.scratch/code-reuse-value-20261113/FRONTEND-FIRST.md](../../../.scratch/code-reuse-value-20261113/FRONTEND-FIRST.md)，用户于2026-11-13确认；[逐项设计覆盖](../../../.scratch/code-reuse-value-20261113/frontend-mock/DESIGN-COVERAGE.md)。

## Global Constraints

- 首轮：当前表现四卡、曲线、期间、市场/账户、最新持仓及搜索/排序/分页/导出、详情、模拟交易集合和返回；历史、贡献、新全局实体搜索和附加筛选暂缓。
- 正式V2.5：导航72px、页头64px、内容左右24px、模块间24px/内部16px；四卡88px；持仓标题48/表头40/行48/页脚48、八行槽、列25/8/10/11/11/15/14/6%；账户176×36px。
- 对照1440×1000、1280×800、100%缩放；不得静默改变正式规格。模拟/物理触控证据分列，不以鼠标冒充。
- 金额保留十进制字符串；未知不是零；浏览器不重算财务。范围、结果版本、业务时点一致；期间不改变当前市值和最新持仓。
- `conf/runtime.json`、旧首页和业务库不修改。当前3333服务属于本工作树，先核对显式隔离库后复用；需要重启时按`npm run dev`规则。特殊验收显式隔离库。
- 固定Node26.0.0/SQLite3.53.0。无新依赖，无push/merge/publish。
- 实施者root（用户选择当前主模型，模型与reasoning继承会话、不覆盖）；整体视觉和状态负责人root；最终视觉由未实施UI的独立审查者直接对图。

## Review Focus

- 过期请求/取消/失败：只提交最新完整视图，旧币种/范围标签与金额共同保留；Task2增加乱序和取消测试。
- 同代码不同交易所或账户：详情和集合使用完整身份；Task1/2验证跨对象拒绝与返回。
- 搜索末页/中文组词：过滤和排序回页1，取消日期不改变已应用值；Task2验证。
- 空/未知/大金额：八槽不跳，unknown不画零线，完整精度和导出保留；Task1/2验证。
- 刷新/直达/返回：还原已应用范围、页码、对象与来源焦点，草稿不进入URL；Task2验证。

---

### Task 1: 可替换展示合同与确定Mock读取

**Files:**
- Create: `app/components/homepage-preview/display-contract.ts`
- Create: `app/components/homepage-preview/mock-source.ts`
- Test: `app/components/homepage-preview/mock-source.test.ts`

**Interfaces:**
- Produces: `HomeRequest`（market/accountId/period/query/sort/direction/page），`Amount`（value/currency/reasons/coverage/originals/fxSource），`HomeView`（stamp、metrics、series、holdings、scope options），`HoldingDetail`、`TradeCollection`。
- Produces: `HomepageSource.readHome(request, signal): Promise<HomeView>`、`readHolding(stamp, holdingId, signal): Promise<HoldingDetail>`、`readTrades(stamp, holdingId, signal): Promise<TradeCollection>`、`exportHoldings(request, signal): Promise<string>`、`repair(request, signal): Promise<{remainingReasons: string[]}>`。
- Produces: `createMockSource({scenario, delayMs?, failNext?}): HomepageSource`；`scenario`为`normal/empty/one/five/nine/ten/twenty/fifty-pages/extreme/gaps/unknown/partial`。默认today固定2026-10-15；场景控件在产品画布外。
- HTTP数量、URL与数据库表不由这些读取方法决定；不导入候选财务模型、proof或storage。

- [ ] 写测试：过滤只返回匹配结果；9条末页1条；导出包含完整9条而不是当前页；本月/本年期间结果不同但当前市值和持仓不变；未知为null，零为`"0"`；同代码不同交易所详情不串；AbortSignal停止读取。
- [ ] Run: `npx vitest run app/components/homepage-preview/mock-source.test.ts`。Expected: FAIL（新模块尚不存在）。保存RED日志。
- [ ] 实现上述类型和读取方法，8行分页、确定场景、稳定身份、范围/版本/时点；Mock数据预先给定财务结果，仅进行样例选择、表格筛选排序及CSV格式化。
- [ ] Run同一命令。Expected: 全部PASS。记录Mock仅证明接口/模拟行为的边界。
- [ ] 仅提交该任务文件：`feat: define homepage presentation source and mock scenarios`。

### Task 2: 首页核心旅程、正式展示与状态恢复

**Files:**
- Create: `app/preview/homepage/page.tsx`
- Create: `app/components/homepage-preview/homepage-preview.tsx`
- Create: `app/components/homepage-preview/use-homepage-preview.ts`
- Create: `app/components/homepage-preview/location-state.ts`
- Create: `app/components/homepage-preview/holdings.tsx`
- Create: `app/components/homepage-preview/holding-detail.tsx`
- Create: `app/components/homepage-preview/metric-cards.tsx`、`metric-cards.css`
- Create: `app/components/homepage-preview/performance-chart.tsx`、`performance-chart.css`
- Create: `app/components/homepage-preview/period-selector.tsx`、`period-selector.css`
- Create: `app/components/homepage-preview/homepage-preview.css`
- Test: `app/components/homepage-preview/homepage-preview.test.tsx`
- Test: `app/components/homepage-preview/location-state.test.ts`

**Interfaces:**
- Consumes: Task1全部展示类型和`HomepageSource`；所有读取从同一source进入。
- Produces: `HomepagePreview({source?, initialScenario?})`；`useHomepagePreview(source)`拥有完整committed view、pending/error/cancel、request generation、detail/collection读状态、已应用URL状态。
- Produces: `parseLocation(search: string): PreviewLocation`、`serializeLocation(state: PreviewLocation): string`，仅恢复已应用市场/账户/期间/搜索/排序/页码/详情或集合身份/场景；校验不合法值并给确定默认，不读取localStorage或DB。
- Produces: `MetricCards({view,status})`、`PerformanceChart({series,reportCurrency,unavailableReason?})`、`PeriodSelector`受控草稿/应用/取消；持仓操作最终改变读取请求与可见行，不只触发callback。

- [ ] 写真实组件行为测试：加载四卡和八槽→查看指定对象→查看其集合→返回恢复来源；readHome失败保留旧市场/金额；晚到旧响应不覆盖新视图；取消请求；日期取消不应用；查询/排序回页1；无数据禁导出；键盘图表六字段及缺口不造零；URL合法/非法、refresh/直达恢复。
- [ ] Run: `npx vitest run app/components/homepage-preview`。Expected: 新组件/位置模块缺失导致FAIL；保留RED。
- [ ] 从冻结候选提取账本中的六个卡片/曲线/期间文件，适配Task1小合同，删除旧stamp/proof/逐标的证据依赖；保留图形算法及受控交互，修正浮层不得推动页面。
- [ ] 实现新宿主、持仓与焦点锁定详情/模拟集合、取消/15秒手动恢复、完整CSV下载；新请求Abort上一条并以generation/identity拒绝迟到响应。期间仅成功后原子替换，返回及popstate恢复；详情外点不关闭。
- [ ] 新增独立route和外置Mock控制（场景、慢读、下一次失败），不挂旧workspace或改根入口。标明暂缓功能，无假装可用的按钮。
- [ ] Run: `npx vitest run app/components/homepage-preview`、`npm run typecheck`。Expected: PASS；已有基线失败单独保留。
- [ ] 第一个完整画面出现即在真实浏览器对照规范，保存1440/1280正常态及详情、期间、末页/空/缺口/极值截图与尺寸。先修关键展示差异再扩状态。
- [ ] 提交本任务文件：`feat: add isolated homepage mock preview journey`。

### Task 3: 全范围操作核对、独立审查和交付记录

**Files:**
- Modify: `.scratch/code-reuse-value-20261113/frontend-mock/DESIGN-COVERAGE.md`
- Create: `.scratch/code-reuse-value-20261113/frontend-mock/INTERFACES.md`
- Create: `.scratch/code-reuse-value-20261113/frontend-mock/FINAL-ACCEPTANCE.md`
- Create: `.scratch/code-reuse-value-20261113/frontend-mock/REUSE-COST.md`
- Create: `.scratch/code-reuse-value-20261113/frontend-mock/evidence/*`

**Interfaces:**
- Consumes: Task2运行页面、Task1接口、37需求/41控件模板/既有公共状态登记及正式参考。
- Produces: 最终内容manifest、版本绑定的实际控件全集与操作结果、独立直接视觉对照、接口消费者/字段/状态/后端待答表、实际提取改造成本账本、仍运行的预览链接与启动命令。

- [ ] Run: `npx vitest run app/components/homepage-preview`、`npm run typecheck`、`npm test`、针对新目录eslint。Expected: PASS；保留基线和新增警告。
- [ ] 真实鼠标/键盘操作全部本轮适用控件和条件项，动态实例按固定Mock集合完整登记；保存前中后尺寸、scope/身份/URL/返回/refresh结果。鼠标、键盘与触控证据分开。
- [ ] 创建最终源码SHA清单，冻结服务/浏览器环境和场景。独立reviewer检查整个新增模块并直接将运行截图与正式图对照；允许其读取/操作浏览器，不写实现。
- [ ] 重要问题由root修复，新增反例RED→GREEN，复跑受影响旅程；UI视觉问题仍需独立视觉复验，不能自签。
- [ ] 更新验收/覆盖/成本/接口文档；只有全部适用门槛有证据才标Mock阶段accepted。真实财务、后端、持久化与真实性能保持NOT VERIFIED。
- [ ] 最后真实浏览器新鲜打开预览，确认服务仍在运行；交付可点击URL及`npm run dev`启动说明。没有用户请求不推送、合并或发布。

## Self-review

用户已确认的顺序、原始设计与首轮边界均对应上述任务；接口同名同形，后端未提前锁定。mock-source负责数据，hook负责发布和恢复，三个展示叶子负责局部交互；root拥有所有实现文件，不并发写入。真实数据和1秒验收明确保留下一阶段。
