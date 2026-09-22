# 首页验收修复进度

计划：本目录7个独立任务。

最终状态：completed。6项修复及整体验收完成；独立审查R1—R9全部关闭。最终完整Vitest1898通过、5跳过、0失败断言，仅既有BOC套件缺fixture而初始化失败；类型/构建/diffcheck通过。真实浏览器及原始数据复核、预览/重启详情见acceptance-report.md。以下保留执行历史。

- 基线：ccc5关联工作树，codex/review-remote-master-20260920分支；开始前已有未提交修改，全部保留。
- 实现A：任务01/02，独占room-performance组件、样式、测试及其新建图表辅助文件。
- 实现B：任务04/06，独占review-dashboard组件、样式、测试。
- 实现C：任务03/05，独占holdings组件/模型/测试及workspace行情回调集成与相关测试。
- 协调者：任务发布、原始数据库审计与隔离、接口约定、独立审查、浏览器几何验收和最终验证。
- 接口：行情重试可返回Promise结果但保持调用端兼容；如需增加诊断输入，由C通知协调者安排B接入，禁止跨所有权编辑。
- 阶段：已发布任务，开始实现；未进行任何提交/推送/合并。

## 实际执行

- 实现A（Luna）：Darwin / 01a0c3f6-413b-7761-90c1-085f53fd69dd。
- 实现B（Luna）：Ampere / 01a0c3f6-422e-79a2-b63a-10a6aa05b366。
- 实现C（Luna）：Hume / 01a0c3f6-4353-7d21-8349-2c354c3e897f。
- 开始前定向基线：6文件70测试通过。
- 原始layout-review.sqlite：1857笔；按id排序完整executions行SHA256 = 59d30c24be886fb241495c0fb5bdbb78a8a2e017e95327b51d0588898886e9cb。
- 工作树tradereview.sqlite为空库（0笔，空内容SHA256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855），因此不能用于有数据验收。
- SQLite一致性backup：/tmp/tradereview-acceptance-20260921.nMxvK1/review.sqlite，1857笔且内容摘要相同。
- 新验收服务：127.0.0.1:3003，当前工作树，使用上述backup；原3002服务保持。
- 负仓只读复核：000893只有卖出500；159608买20000卖30000；512560买20000卖42400；513010对应账户只有卖92400（另账户买卖60000不能串用）。四者均无明确开空/期初负持仓证据。这里只能判定需核对，不能断言真实账户有空头或自动补写数据。

## 集成与首轮反例

- B完成04/06后继续接入C共享接口：qualityInput中marketDataStatuses、marketDataDailyStatuses、marketDataLabels、marketDataJobs同时传入质量用holdings模型和持仓面板；重试回调返回void或Promise<void>。需覆盖状态变化时模型重算。
- A首轮18测试通过不构成视觉验收：协调者在320px测到SVG仅164×56.375、点2.05px，末端长日期标签覆盖多个刻度。已退回响应式几何、短刻度及触控目标修复。
- 窄屏日历首轮将月/年金额也替换成盈亏状态，且日号02-25仍换两行。已要求仅dailyGrid简写，日格显示日号，periodGrid保留金额。
- 实测已通过的局部路径：全部年份→2026→2月→25日，详情完整显示+¥50,360.44、2个可信样本、50%胜率；下钻未出现日期编辑器；今年至今/美股筛选仍保留日历，持仓同步为1个。
- C代码中长原因重复、历史开空证据可能先于当前数量判断，已交回负责人补反例与修复。最终独立验收尚未完成。

## 独立审查与集中验证第一轮

- 独立审查者Bernoulli（01a0c40c-a56c-7eb0-9bef-004c24edb752）给出R1—R9，见independent-review.md；全部交回原负责人。A负责R1/R6/R7，B负责R2/R9，C负责R3/R4/R5/R8。
- A扩展拥有calendar模型及测试以保证scope一致；B扩展拥有quality-details组件/测试/样式以及workspace.test.tsx4150旧定位单行；C拥有workspace refresh测试及必要retry helper。其余边界保持。
- 类型检查/构建第一轮已通过。全量Vitest maxWorkers=2：201文件通过、4失败、2跳过；1876测试通过、3失败、5跳过；270.37秒。
- 原始失败全部保留：boc-parser套件缺.scratch/trading-room-implementation/reports/boc-source.html（该测试未修改；主仓与历史cc9c/e7ec也未找到此fixture）；workspace旧分类aria-label断言；global失败详情未限定容器导致重复匹配；chart测宽回归在运行中变更后的边距断言失败。后三项分别交B/C/A复验修正。
- 浏览器实测成功：甘李药业行情重试出现进行中，再返回日线报价68.91及浮盈亏-711.00；界面提示重试成功。实际写入仅在独立数据库。
- 320日格最终日号25/盈/2笔，clientWidth=scrollWidth=30，内部内容无折行溢出；390格clientWidth=scrollWidth=38。月/年格保留完整金额。
- 桌面1440/1280主筛选标签与控件顶部一致；1440图表Y刻度偏差0、X锚点最大误差0.014px。点约8×8；320最终svg224×190，Y标签72px安全边距；390为286×190且三个日期刻度互不重叠。
- 原库复核：仍1857笔，executions摘要与基线完全相同。
