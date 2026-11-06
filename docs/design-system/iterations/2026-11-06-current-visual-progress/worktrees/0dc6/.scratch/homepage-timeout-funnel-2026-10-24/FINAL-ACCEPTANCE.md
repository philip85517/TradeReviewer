# 首页超时漏斗：主代理独立验收

State: closed
Status: accepted（仅诊断范围）
Owner / Accepted by: /root
Date: 2026-10-24

用户触发：通过 systematic-debugging 建立访问超时漏斗，定位财务读取在哪一环超时。范围是当前源码与真实业务数据快照的桌面首读诊断；没有实现产品修复。依据 [范围矩阵](DESIGN-COVERAGE.md) 和 [结论报告](DIAGNOSIS.md)。

## 版本与执行

HEAD `58bf0d90e68ddc634de180b3f5c3d16a089f0eb3` + [原 dirty 源码 manifest](BASELINE-MANIFEST.json)；观测副本绑定 [complete manifest](COMPLETE-SOURCE-MANIFEST.json) 和 [完整补丁](COMPLETE-INSTRUMENTATION.patch)。Node 26.0.0 / SQLite 3.53.0，vinext/Vite 8.0.13，隔离快照 `complete.sqlite`，4391。session `1792813199721-gessxk125rl`，generation 2 / requestId 2。

主代理独立完成：环境和数据库保护检查；真实浏览器首读；截图/AX/geometry 保存；冻结原始日志；从 trace 重新计算每层漏斗、236 请求归属与首次越界；审阅 worker 插桩差异。Astra 独立复核者没有实现这些插桩，另外逐项只读复算并直接对照保存的截图：[INDEPENDENT-REVIEW.md](INDEPENDENT-REVIEW.md)。其数据库不访问边界不视为本项通过；数据库保护由主代理证据单独承担。

## 必需诊断门槛

| 门槛 | 结论 | 独立证据 |
| --- | --- | --- |
| 原产品文件与观测版本保护 | PASS | [最终 SHA-256 核验](FINAL-SOURCE-VERIFICATION.json)：887/884 文件，changed/missing 均空；与独立复核一致 |
| 服务实际连接隔离库 | PASS | [lsof / 监听](RUNTIME-ISOLATION.json)：4391 PID35334 连接 complete.sqlite；3333 PID29149 保持原路径 |
| 原业务数据保护 | PASS（限定区间/五表） | [BUSINESS-AFTER](BUSINESS-AFTER.json)：03:32:11.568→03:43:58.667 UTC，executions/import_batches/trade_revisions/reviews/instruments 行数和逻辑 SHA 一致；其他表/更长时间 NOT VERIFIED |
| 日志完整与同请求关联 | PASS | 冻结 browser seq1–3921、8 batch、重复/缺号/transport failure 0；server request id；[ACK](complete-collector-ACK.json) |
| SQLite→API→HTTP→contract→bundle→domain→守卫 | PASS | [trace](complete-trace.json)、[指标](FUNNEL-METRICS.json)；父子与并行不重复求和；部分 SQLite 子操作和非 helper 请求未细分，限制已明确 |
| 首次越界与拒收位置 | PASS（诊断） | sourceEncode 14,204.1→15,252.1 ms 包含 15,000 截止；afterDomain 17,541 ms；计时器晚2,628 ms；7,735 ms longtask |
| 桌面终态与源码/log 一致 | PASS（复现证据） | 真实 1440×900，[截图](complete-desktop.png)、[AX](complete-desktop-AX.txt)、[geometry](complete-desktop-geometry.json)；无窄屏替代 |
| 完整样本结论独立复算 | PASS | root build-funnel.py + Astra 独立复算：无阻断错误，236 请求连续seq193…428，与3个后台发起区分 |
| 原产品无插桩精确耗时 / warm / CPU采样 | NOT VERIFIED | 本轮没有该对照；只报告单完整观测样本 |
| 全量 TypeScript 检查 | FAIL（现有错误） | Recall测试 viewport/exact、Env.DB；原始输出保留；服务端17文件语法检查 PASS，不代替全量检查 |
| 首页成功应用财务范围 | **FAIL（产品现状）** | afterDomain拒收，新财务范围未接受；不得表述为“财务修复完成” |

## 桌面局部控件与状态覆盖表

适用前端审计触发：超时及读取链诊断。视口 1440×900；A股/全部账户/范围全部。覆盖自动首读及相关终态，未进行任何鼠标点击、键盘、模拟触摸或物理触摸操作，未触发写流程。

| ID / 页面元素 | 当前版本证据与观察 | 产品状态 / 覆盖结论 |
| --- | --- | --- |
| DA01 / 页面入口与市场账户 | AX URL与A股选中、全部账户一致；geometry1440×900，scrollWidth1440 | PASS：诊断场景绑定；筛选交互 NOT VERIFIED |
| DA02 / 全局读取错误 | 顶部“读取已超时，新范围未应用。”与host reject/render一致 | **FAIL：首读超时**；诊断复现 PASS |
| DA03 / 当前表现四指标 | 四项均 `—`，原因控件金额未知，timeout | **FAIL：财务数据未应用**；原因弹层交互 NOT VERIFIED |
| DA04 / 期间选择 | 本年/月/周及“期间数据读取中”均禁用 | **FAIL：失败后仍呈 loading 终态**；状态证据已保存，未修复 |
| DA05 / 日曲线 | “期间数据尚未就绪” | **FAIL：本次没有财务曲线**；图表键盘/回放不在范围 |
| DA06 / 持仓 | 初始0条/当前范围暂无持仓，金额排序与导出禁用 | 数据正确性 NOT VERIFIED；不能由失败后的空态断言真实无持仓 |
| DA07 / 历史与进入交易库 | 历史显示尚未接入、交易库入口存在 | 历史保持旧暂停；入口点击/返回 NOT VERIFIED，未改接线 |

全页所有控件、与V2.5参考图逐状态视觉保真、responsive 边界及核心写入/返回/重载：**NOT APPLICABLE 于本次诊断接受**（未修改产品UI或交付这些功能）。这不代表相关产品门槛已通过；没有把诊断截图等同视觉交付验收。回放 action/cutoff/viewport 合同同样 N/A，本轮无回放实现。

首个 cold 采样因 console 500 条截断的漏斗继续 **NOT VERIFIED**；后续完整样本独立保存，没有覆盖历史失败。P1/F07、ContributionBars 3/3 FAIL / paused 保留；没有恢复、重置或增加其候选轮次。诊断 01 可关闭，原功能验收及上述产品 FAIL 继续存在，不据此关闭产品任务。
