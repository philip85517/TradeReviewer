# 修复覆盖矩阵

原需求：用户2026-09-27四图检查及本轮三条实施指令。原图路径均在 `/var/folders/35/254l_pjd3176pndzmz5_2l4m0000gn/T/`。详细视觉标准见visual-contract.md。新建下列局部ID仅用于本轮，不套用回放E01–E22。

| 需求/来源 | elementID | 准确参考图片文件/区域 | 状态 | owner/任务 | 交付组件 | 浏览器操作 | 预期与反例 | 证据 | 状态 |
|---|---|---|---|---|---|---|---|---|---|
| 图1/2筛选统一 | C01 | codex-clipboard-1f7dfb9e-0845-46b9-9937-2387c9c15de2.png 上两行；codex-clipboard-b98ad1e7-811f-4b4c-8462-0f10f43cdf84.png 顶部 | 当前/选中/禁用 | 实施代理/02；root整页 | library+dashboard scope | 切交易室/库、性质、账户、币种 | 同档尺寸/字色/选中态统一；保留未知来源与模拟语义 | evidence/independent-controls-final.json；library六宽截图；scope-control-primitives 两消费者 | PASS |
| 图2期间控件 | C02 | codex-clipboard-b98ad1e7-811f-4b4c-8462-0f10f43cdf84.png 近1月~全部 | 选中/自定义/窄屏 | 实施代理/02 | period controls | 切期间、展开自定义/取消、resize | 同排一致、不被旧CSS覆盖、状态不丢失 | evidence/independent-controls-results.json；accept-real.json；holding-chart六宽 | PASS |
| 图2持仓总览几何 | C03 | 同图持仓曲线；诊断DIAGNOSIS.md | 总值/盈亏/收益率；日周月；缺数据 | 实施代理/01 | holdings history | 切指标/粒度、hover/键盘、resize | 实际宽高与viewBox一致、文字不拉伸、tooltip可用；空数据不伪造 | evidence/independent-chart-final-results.json；holding-chart六宽；50项图表unit | PASS |
| 图2资产分布 | C04 | 同图右侧资产分布 | 真实数据可用/部分/无可用 | 实施代理/02保留；root状态流 | allocation | 切市场/资产类型及真实账户 | 统一局部控件；原回退与金额不变；不伪造完整饼图 | evidence/allocation-real.png；independent-final-supplement.json；完整圆环真实状态 NOT VERIFIED | PASS（实际可达状态；完整圆环 NOT VERIFIED） |
| 图3持仓可读密度 | C05 | codex-clipboard-75c70c45-a2b2-4a28-a894-ebe0b0d309a9.png 表格 | 收起/展开/搜索/分页 | 实施代理/02 | holdings | 展开详情、搜索、翻页 | 行/迷你图适度增高；11列保留；真实详情撑高；窄屏局部滚动 | evidence/holdings-expanded.png；independent-final-mobile-table-scroll.png；accept-real.json | PASS |
| 图4累计盈亏几何 | C06 | codex-clipboard-0c1a3594-98ee-4fe5-a12e-bee5c3004ee9.png 左侧图 | 有数据/空、日周月、resize | 实施代理/01 | room performance | 真实范围切换、选点、resize | 无154/138错配、点/轴/零线对齐、绘图区不被压缩 | evidence/independent-chart-final-results.json；performance-selected；unit-integrated.log | PASS |
| 图4整排比例 | C07 | 同图趋势/贡献/日历整排 | 1440/1920/1055/820/821/390 | 实施代理/01；root整页 | performance CSS | resize、切日历层级 | 容器随内容协调、无遮挡/不可达；非硬塞234px | evidence/independent-detail-repro-top/bottom-820/390；history六宽；independent-acceptance.md | PASS |
| 真实页面验收 | J01 | 本轮指令2；以上4图 | 真实实例真实选择 | 独立验收代理/03 + root | 全页 | visual-contract旅程 | 不能以mock/DOM存在代替实际交互与看图 | evidence/accept-real.json 16项PASS；independent-controls-final.json；touch-real.json | PASS |
| 真实部署数据 | D01 | 本轮指令3；conf/runtime.json | 初始/验收后 | root | API/SQLite读取 | 读取真实账户及范围 | 实际打开正式DB；原始成交/导入批次摘要不变，证券自动元数据变化单列；不新建测试库 | evidence/db-before.json / db-final.json；live-db-open.txt；db-observation.md | PASS |

模型确认后在README/票中记录实际model与effort。历史诊断截图作基线，不作本轮真实数据库验收结果。

最终证据以 FINAL-ACCEPTANCE.md 及 independent-acceptance.md 第三轮为准。此前 FAIL/HMR 截图保留。物理触摸、真实完整圆环仍 NOT VERIFIED，不以组件样本或模拟触控替代。
