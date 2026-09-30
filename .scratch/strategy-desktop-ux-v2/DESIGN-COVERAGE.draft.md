# 桌面 UX v2 设计覆盖草案

状态：draft，待用户确认拆分；不修改原功能覆盖表与父票。准确源为[桌面规格](../../docs/specs/2026-09-29-strategy-desktop-ux-design.md)，行号依据2026-09-29版本；改稿后实际派发前重新校验。所有实现与验收均为 **NOT VERIFIED**。

范围：评审D01–D10；UX01–UX10、E01–E12、T01–T12。窄屏D11排除。1440×900、1280×800，缩放100%；历史图DPR1，新图记录实测值。

## 需求、元素和状态分配

各图相对来源目录为 ../strategy-portfolio-backtesting/screenshots/。现有图是风格/旧状态证据，本文行内引用明确状态；未提供对应新画板时按规格文字目标与现有规范直接对照，不能声称像素批准。每行实现owner为对应任务领取后绑定的唯一owner，当前未领取；协调者负责整页一致性，独立评审者不得参与所审UI实现。

| 行ID | 需求 | elementID | 规格章节/行 | 阶段与状态 | owner/任务 | 浏览器操作 | 可观察预期与反例 | 准确参考 | 验收/计划证据 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C01 | UX02/UX09/UX10 | E01/E03/E05/E12 | DD02、DD05、DD12；125/169/260 | T0待开始 | [01 单组合工作台：推进、调仓、回看与重开](drafts/01-single-portfolio-observation.md)；owner未领取 | 进入运行→看净值→切K线 | 资产=本金、净值1、无成交/当日未开始；不造预热净值 | [creation-baseline-1440.jpg](../strategy-portfolio-backtesting/screenshots/creation-baseline-1440.jpg) | T03/T12；acceptance/01.md / screenshots/01/（计划，尚无证据） | NOT VERIFIED |
| C02 | UX02/UX03 | E03/E04/E05/E06 | DD06；177 | 首次建仓 | [01 单组合工作台：推进、调仓、回看与重开](drafts/01-single-portfolio-observation.md)；owner未领取 | 下一交易日→查看bar、摘要与持仓 | 可见新增真实bar与同日资产；日期变图不变失败 | [running-day1-1440.jpg](../strategy-portfolio-backtesting/screenshots/running-day1-1440.jpg) | T03；acceptance/01.md / screenshots/01/（计划，尚无证据） | NOT VERIFIED |
| C03 | UX03/UX09 | E04/E05 | DD06；185–200 | 播放/暂停/长区间 | [01 单组合工作台：推进、调仓、回看与重开](drafts/01-single-portfolio-observation.md)；owner未领取 | 播放→暂停→窗口外继续→resize/平移 | 暂停不推进，最新bar可见，resize保留视野 | [running-day5-1440.jpg](../strategy-portfolio-backtesting/screenshots/running-day5-1440.jpg) | T06/T12；acceptance/01.md / screenshots/01/（计划，尚无证据） | NOT VERIFIED |
| C04 | UX03/UX04 | E04/E05/E06/E07 | DD06；177–200 | 回看与已知事件导航 | [01 单组合工作台：推进、调仓、回看与重开](drafts/01-single-portfolio-observation.md)；owner未领取 | 回看T0/事件→恢复最新 | 列表与图截止V，仅导航可提示已知日期/类型；M保留 | [running-review-t0-1440.jpg](../strategy-portfolio-backtesting/screenshots/running-review-t0-1440.jpg) | T05/T06；acceptance/01.md / screenshots/01/（计划，尚无证据） | NOT VERIFIED |
| C05 | UX02/UX09 | E06/E07 | DD08、DD13；212/268 | 正常调仓/详情 | [01 单组合工作台：推进、调仓、回看与重开](drafts/01-single-portfolio-observation.md)；owner未领取 | 点事件→读原因和权重→关闭 | 中性事件、详情不挤主图；关闭焦点返回不续播 | [running-day5-1440.jpg](../strategy-portfolio-backtesting/screenshots/running-day5-1440.jpg) | T03/T12；acceptance/01.md / screenshots/01/（计划，尚无证据） | NOT VERIFIED |
| C06 | UX04/UX10 | E01/E04/E12 | DD10；242 | 单实验重开 | [01 单组合工作台：推进、调仓、回看与重开](drafts/01-single-portfolio-observation.md)；owner未领取 | 暂停→返回列表→重开 | V/M、视野和已看来源恢复；不再成交 | [running-review-t0-1440.jpg](../strategy-portfolio-backtesting/screenshots/running-review-t0-1440.jpg) | T03；acceptance/01.md / screenshots/01/（计划，尚无证据） | NOT VERIFIED |
| C07 | UX06/UX09 | E09/E12 | DD03、DD13；146/268 | 创建步骤/回退 | [02 四步创建：策略包选择、候选解释与确认进入](drafts/02-guided-creation.md)；owner未领取 | 新建→四步→进入T0→返回重开 | 一主一次、完成/当前区分；入口无成交 | [creation-ready-1440.jpg](../strategy-portfolio-backtesting/screenshots/creation-ready-1440.jpg) | T01/T12；acceptance/02.md / screenshots/02/（计划，尚无证据） | NOT VERIFIED |
| C08 | UX06/UX10 | E09/E12 | DD03；146 | 日期/资金/五期限 | [02 四步创建：策略包选择、候选解释与确认进入](drafts/02-guided-creation.md)；owner未领取 | 盘中/休市/非法输入→校验→期限 | 非法阻断、有效截止可读；未来数据不能参与 | [creation-history-1440-final.jpg](../strategy-portfolio-backtesting/screenshots/creation-history-1440-final.jpg) | T02；acceptance/02.md / screenshots/02/（计划，尚无证据） | NOT VERIFIED |
| C09 | UX07/UX09 | E10 | DD04；159–167 | 策略多选/详情/预设 | [02 四步创建：策略包选择、候选解释与确认进入](drafts/02-guided-creation.md)；owner未领取 | 选包→查看规则→修改已选预设 | 不拆条件搭建器，未选预设只读，详情不改变选中 | [creation-packages-1280-final.jpg](../strategy-portfolio-backtesting/screenshots/creation-packages-1280-final.jpg) | T01/T02/T12；acceptance/02.md / screenshots/02/（计划，尚无证据） | NOT VERIFIED |
| C10 | UX07/UX10 | E10/E12 | DD04；159–167 | 必要数据缺失 | [02 四步创建：策略包选择、候选解释与确认进入](drafts/02-guided-creation.md)；owner未领取 | 切缺字段场景→看不可用包/另一个包 | 原因就近；不把全页面禁用 | [creation-missing-1440-final.jpg](../strategy-portfolio-backtesting/screenshots/creation-missing-1440-final.jpg) | T02；acceptance/02.md / screenshots/02/（计划，尚无证据） | NOT VERIFIED |
| C11 | UX08 | E11 | DD04；165–167 | 候选分组与证据 | [02 四步创建：策略包选择、候选解释与确认进入](drafts/02-guided-creation.md)；owner未领取 | 预览→入选/规则不符/数据不足→展开行 | 计数真实为演示子集，未知不算排除 | [creation-preview-1280-final.jpg](../strategy-portfolio-backtesting/screenshots/creation-preview-1280-final.jpg) | T01/T02；acceptance/02.md / screenshots/02/（计划，尚无证据） | NOT VERIFIED |
| C12 | UX08/UX10 | E09/E11/E12 | DD04；167 | 部分覆盖确认/撤销 | [02 四步创建：策略包选择、候选解释与确认进入](drafts/02-guided-creation.md)；owner未领取 | 确认部分范围→改日期/集合/场景 | 旧确认撤销，确认页范围仍可查 | [creation-preview-1280-final.jpg](../strategy-portfolio-backtesting/screenshots/creation-preview-1280-final.jpg) | T02；acceptance/02.md / screenshots/02/（计划，尚无证据） | NOT VERIFIED |
| C13 | UX08 | E11 | DD04；167 | 无候选/目标实际 | [02 四步创建：策略包选择、候选解释与确认进入](drafts/02-guided-creation.md)；owner未领取 | 无候选创建→T0 | 目标现金100%且实际无成交；金额随本金变化 | [creation-preview-1280-final.jpg](../strategy-portfolio-backtesting/screenshots/creation-preview-1280-final.jpg) | T02；acceptance/02.md / screenshots/02/（计划，尚无证据） | NOT VERIFIED |
| C14 | UX01/UX02/UX03 | E02/E03/E05/E06/E07 | DD05；169–175 | 双组合正常同步 | [03 多组合观察：共享日期与全局联动](drafts/03-synchronized-portfolios.md)；owner未领取 | 同日切组合→查净值/持仓/事件 | 全局一致、资金独立、日期不变 | [design-review-running-1440.jpg](../strategy-portfolio-backtesting/screenshots/design-review-running-1440.jpg) | T04；acceptance/03.md / screenshots/03/（计划，尚无证据） | NOT VERIFIED |
| C15 | UX01/UX09 | E02/E05/E07 | DD05、DD13；173/268 | 跨组合残留/长名称 | [03 多组合观察：共享日期与全局联动](drafts/03-synchronized-portfolios.md)；owner未领取 | 选事件/标的→换组合→查溢出菜单 | 旧事件关闭，非持有标的明确，全部组合可达 | [design-review-running-1440.jpg](../strategy-portfolio-backtesting/screenshots/design-review-running-1440.jpg) | T04/T12；acceptance/03.md / screenshots/03/（计划，尚无证据） | NOT VERIFIED |
| C16 | UX01/UX04 | E01/E09 | DD10；242–250 | 只读配置/取消派生 | [04 配置派生：保留原实验并重开多个实验](drafts/04-fork-and-reopen-experiments.md)；owner未领取 | 配置→派生→编辑→取消→原实验 | 原V/M/账本/视野不变 | [creation-ready-1440.jpg](../strategy-portfolio-backtesting/screenshots/creation-ready-1440.jpg) | T08；acceptance/04.md / screenshots/04/（计划，尚无证据） | NOT VERIFIED |
| C17 | UX01/UX04/UX06 | E01/E02/E09/E12 | DD10、DD07；242/210 | 派生创建/多实验列表 | [04 配置派生：保留原实验并重开多个实验](drafts/04-fork-and-reopen-experiments.md)；owner未领取 | 创建派生→切回原→分别重开 | 不复制旧候选/成交；保留来源已看提示 | [running-review-t0-1440.jpg](../strategy-portfolio-backtesting/screenshots/running-review-t0-1440.jpg) | T08/T12；acceptance/04.md / screenshots/04/（计划，尚无证据） | NOT VERIFIED |
| C18 | UX05 | E03/E08/E12 | DD09、DD12；220/260 | 阶段与完整结果 | [05 单组合结果：阶段分析、完整结果与事件回看](drafts/05-results-and-process-return.md)；owner未领取 | 逐日到阶段/终点→结果→切曲线 | R明确≤可用边界，曲线和指标来自同一账本 | [running-nav-1280.jpg](../strategy-portfolio-backtesting/screenshots/running-nav-1280.jpg) | T09；acceptance/05.md / screenshots/05/（计划，尚无证据） | NOT VERIFIED |
| C19 | UX05/UX10 | E03/E08/E12 | DD09、DD12；220/260 | 零交易/未知/损益 | [05 单组合结果：阶段分析、完整结果与事件回看](drafts/05-results-and-process-return.md)；owner未领取 | 全现金或未知场景→结果明细 | 胜率不可计算、未知不填0、不伪造因果收益 | [running-year-cash-1280.jpg](../strategy-portfolio-backtesting/screenshots/running-year-cash-1280.jpg) | T09/T10；acceptance/05.md / screenshots/05/（计划，尚无证据） | NOT VERIFIED |
| C20 | UX03/UX05 | E07/E08 | DD09、DD06；238/177 | 结果与过程双向返回 | [05 单组合结果：阶段分析、完整结果与事件回看](drafts/05-results-and-process-return.md)；owner未领取 | 结果事件→过程→来源结果；普通返回过程 | 事件身份准确，R/筛选/滚动和原V按入口恢复 | [running-review-t0-1440.jpg](../strategy-portfolio-backtesting/screenshots/running-review-t0-1440.jpg) | T09/T05；acceptance/05.md / screenshots/05/（计划，尚无证据） | NOT VERIFIED |
| C21 | UX03/UX04/UX05 | E04/E08/E12 | DD07；202–210 | 快速展开确认/取消/完成 | [06 快速展开与异常恢复：取消、失败、重试和继续](drafts/06-bulk-reveal-and-recovery.md)；owner未领取 | 取消→确认→停止/继续→结果 | 取消无变化、进度真实、与逐日一致 | [design-review-running-1440.jpg](../strategy-portfolio-backtesting/screenshots/design-review-running-1440.jpg) | T07；acceptance/06.md / screenshots/06/（计划，尚无证据） | NOT VERIFIED |
| C22 | UX03/UX04/UX10 | E04/E06/E12 | DD11；252–258 | 中断/执行失败/重试 | [06 快速展开与异常恢复：取消、失败、重试和继续](drafts/06-bulk-reveal-and-recovery.md)；owner未领取 | 确定性错误→最后完整日→重试 | 无半日提交、无重复成交、已看记录不提前 | [design-review-running-1440.jpg](../strategy-portfolio-backtesting/screenshots/design-review-running-1440.jpg) | T11；acceptance/06.md / screenshots/06/（计划，尚无证据） | NOT VERIFIED |
| C23 | UX01/UX03/UX04 | E02/E03/E05/E12 | DD06 Mᵢ；181 | 排除失败组后继续/落后组 | [06 快速展开与异常恢复：取消、失败、重试和继续](drafts/06-bulk-reveal-and-recovery.md)；owner未领取 | 排除失败组→其他继续→切回落后组 | 此日不可用、旧曲线截断、显式查看Mᵢ | [design-review-running-1440.jpg](../strategy-portfolio-backtesting/screenshots/design-review-running-1440.jpg) | T11/T05；acceptance/06.md / screenshots/06/（计划，尚无证据） | NOT VERIFIED |
| C24 | UX04/UX10 | E01/E12 | DD11；256–258 | 模拟保存失败恢复 | [06 快速展开与异常恢复：取消、失败、重试和继续](drafts/06-bulk-reveal-and-recovery.md)；owner未领取 | 演示失败→保留本地→重试/重载 | 演示标识全程可见，不声称真实持久化 | [creation-ready-1440.jpg](../strategy-portfolio-backtesting/screenshots/creation-ready-1440.jpg) | T11；acceptance/06.md / screenshots/06/（计划，尚无证据） | NOT VERIFIED |
| C25 | UX01/UX05 | E02/E03/E08 | DD09；224–240 | 比较共同区间/口径差异 | [07 组合比较：共同区间、口径差异与回看](drafts/07-portfolio-comparison.md)；owner未领取 | 两组比较→看口径/共同区间→切曲线 | 差异说明，独立资金，不跨区间排名 | [creation-baseline-1440.jpg](../strategy-portfolio-backtesting/screenshots/creation-baseline-1440.jpg) | T10；acceptance/07.md / screenshots/07/（计划，尚无证据） | NOT VERIFIED |
| C26 | UX01/UX03/UX05 | E02/E07/E08/E12 | DD09；234–240 | 部分/失败/更晚单组合/来源返回 | [07 组合比较：共同区间、口径差异与回看](drafts/07-portfolio-comparison.md)；owner未领取 | 比较→选更晚单组→事件→返回比较 | 不延长失败组，不隐藏失败列；曝光来源保留 | [creation-baseline-1280.jpg](../strategy-portfolio-backtesting/screenshots/creation-baseline-1280.jpg) | T09/T10；acceptance/07.md / screenshots/07/（计划，尚无证据） | NOT VERIFIED |
| C27 | UX01/UX09 | E02/E08 | DD09；234 | 多于4曲线/长名称 | [07 组合比较：共同区间、口径差异与回看](drafts/07-portfolio-comparison.md)；owner未领取 | 图例开关→查看更多组合 | 最多突出4条不限制组合数；名称/线型辅助识别 | [creation-baseline-1280.jpg](../strategy-portfolio-backtesting/screenshots/creation-baseline-1280.jpg) | T10/T12；acceptance/07.md / screenshots/07/（计划，尚无证据） | NOT VERIFIED |
| C28 | UX09/UX10 | E01–E12 | DD13–DD14；268–281 | 全部页面视觉/演示工具/键盘 | 01–07各自owner，08独立整体验证 | 两档桌面→按关键状态看图与键盘操作 | 每票有视觉证据；正常事件不满屏黄，关键说明不藏匿 | [creation-baseline-1440.jpg](../strategy-portfolio-backtesting/screenshots/creation-baseline-1440.jpg) | T12；acceptance/NN.md / screenshots/NN/（计划，尚无证据） | NOT VERIFIED |
| C29 | UX01–UX10 | E01–E12 | TD01–TD04；307–344 | 完整集成旅程 | [08 完整桌面旅程与独立视觉验收](drafts/08-desktop-journey-acceptance.md)；owner未领取 | 新会话创建→多组→调仓→派生→结果比较→回看重开 | 不以局部报告代替整条旅程，不遗漏错误/空状态 | [creation-baseline-1280.jpg](../strategy-portfolio-backtesting/screenshots/creation-baseline-1280.jpg) | T01–T12；acceptance/08.md / screenshots/08/（计划，尚无证据） | NOT VERIFIED |

## 每项验收场景的主责任

补充异常执行状态（同样需要独立证据）：

| 行ID | 需求/元素 | 规格章节/行 | 阶段与状态 | owner/任务 | 浏览器操作与可观察预期 | 准确参考 | 验收/计划证据 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C30 | UX04/UX05/UX09；E05/E06/E07/E12 | DD08 212–218行；DD11 252–258行 | 完整交易日内部分成交/未成交 | [06 快速展开与异常恢复](drafts/06-bulk-reveal-and-recovery.md)；owner未领取 | 演示部分成交→查看原因、计划/实际及账本；成交、现金、持仓一致，不能当作中断产生的未提交半日状态 | [运行事件参考](../strategy-portfolio-backtesting/screenshots/running-day5-1440.jpg)；新异常按文字契约验收 | T11/T12；acceptance/06.md / screenshots/06/（计划） | NOT VERIFIED |

| 验收场景 | 主任务 | 复验责任 |
| --- | --- | --- |
| T01 创建闭环 | [02 四步创建：策略包选择、候选解释与确认进入](drafts/02-guided-creation.md) | 03与08检查新工作台接入后的双组合 |
| T02 草稿与数据边界 | [02 四步创建：策略包选择、候选解释与确认进入](drafts/02-guided-creation.md) | 04派生时重走，08串联 |
| T03 最小真实图表 | [01 单组合工作台：推进、调仓、回看与重开](drafts/01-single-portfolio-observation.md) | 所有依赖票保住；08整体验证 |
| T04 全局组合联动 | [03 多组合观察：共享日期与全局联动](drafts/03-synchronized-portfolios.md) | 06落后组/07比较/08整体验证 |
| T05 双截止与前视 | [01 单组合工作台：推进、调仓、回看与重开](drafts/01-single-portfolio-observation.md) | 03/05/06/07各自新揭示入口，08集成 |
| T06 时间与视野 | [01 单组合工作台：推进、调仓、回看与重开](drafts/01-single-portfolio-observation.md) | 03/06/08复验新增动作 |
| T07 快速展开 | [06 快速展开与异常恢复：取消、失败、重试和继续](drafts/06-bulk-reveal-and-recovery.md) | 08全旅程 |
| T08 配置派生 | [04 配置派生：保留原实验并重开多个实验](drafts/04-fork-and-reopen-experiments.md) | 08全旅程 |
| T09 结果闭环 | [05 单组合结果：阶段分析、完整结果与事件回看](drafts/05-results-and-process-return.md) | 06/07新增入口，08全旅程 |
| T10 比较边界 | [07 组合比较：共同区间、口径差异与回看](drafts/07-portfolio-comparison.md) | 05负责单组空/未知语义，08全旅程 |
| T11 异常恢复 | [06 快速展开与异常恢复：取消、失败、重试和继续](drafts/06-bulk-reveal-and-recovery.md) | 07比较消费失败状态，08全旅程 |
| T12 桌面/键盘 | 01–07逐票验收 | [08 完整桌面旅程与独立视觉验收](drafts/08-desktop-journey-acceptance.md)独立整页复验 |

## 用户故事覆盖

下表为首要交付责任；08重新覆盖全部故事但不能替代前票实现。

| 用户故事编号 | 首要任务 |
| --- | --- |
| 1 | [01 单组合工作台：推进、调仓、回看与重开](drafts/01-single-portfolio-observation.md) |
| 2 | [04 配置派生：保留原实验并重开多个实验](drafts/04-fork-and-reopen-experiments.md) |
| 3 | [02 四步创建：策略包选择、候选解释与确认进入](drafts/02-guided-creation.md) |
| 4 | [02 四步创建：策略包选择、候选解释与确认进入](drafts/02-guided-creation.md) |
| 5 | [02 四步创建：策略包选择、候选解释与确认进入](drafts/02-guided-creation.md) |
| 6 | [02 四步创建：策略包选择、候选解释与确认进入](drafts/02-guided-creation.md) |
| 7 | [02 四步创建：策略包选择、候选解释与确认进入](drafts/02-guided-creation.md) |
| 8 | [02 四步创建：策略包选择、候选解释与确认进入](drafts/02-guided-creation.md) |
| 9 | [01 单组合工作台：推进、调仓、回看与重开](drafts/01-single-portfolio-observation.md) |
| 10 | [02 四步创建：策略包选择、候选解释与确认进入](drafts/02-guided-creation.md) |
| 11 | [02 四步创建：策略包选择、候选解释与确认进入](drafts/02-guided-creation.md) |
| 12 | [02 四步创建：策略包选择、候选解释与确认进入](drafts/02-guided-creation.md) |
| 13 | [02 四步创建：策略包选择、候选解释与确认进入](drafts/02-guided-creation.md) |
| 14 | [02 四步创建：策略包选择、候选解释与确认进入](drafts/02-guided-creation.md) |
| 15 | [02 四步创建：策略包选择、候选解释与确认进入](drafts/02-guided-creation.md) |
| 16 | [02 四步创建：策略包选择、候选解释与确认进入](drafts/02-guided-creation.md) |
| 17 | [02 四步创建：策略包选择、候选解释与确认进入](drafts/02-guided-creation.md) |
| 18 | [02 四步创建：策略包选择、候选解释与确认进入](drafts/02-guided-creation.md) |
| 19 | [02 四步创建：策略包选择、候选解释与确认进入](drafts/02-guided-creation.md) |
| 20 | [02 四步创建：策略包选择、候选解释与确认进入](drafts/02-guided-creation.md) |
| 21 | [02 四步创建：策略包选择、候选解释与确认进入](drafts/02-guided-creation.md) |
| 22 | [03 多组合观察：共享日期与全局联动](drafts/03-synchronized-portfolios.md) |
| 23 | [03 多组合观察：共享日期与全局联动](drafts/03-synchronized-portfolios.md) |
| 24 | [01 单组合工作台：推进、调仓、回看与重开](drafts/01-single-portfolio-observation.md) |
| 25 | [01 单组合工作台：推进、调仓、回看与重开](drafts/01-single-portfolio-observation.md) |
| 26 | [01 单组合工作台：推进、调仓、回看与重开](drafts/01-single-portfolio-observation.md) |
| 27 | [01 单组合工作台：推进、调仓、回看与重开](drafts/01-single-portfolio-observation.md) |
| 28 | [01 单组合工作台：推进、调仓、回看与重开](drafts/01-single-portfolio-observation.md) |
| 29 | [01 单组合工作台：推进、调仓、回看与重开](drafts/01-single-portfolio-observation.md) |
| 30 | [01 单组合工作台：推进、调仓、回看与重开](drafts/01-single-portfolio-observation.md) |
| 31 | [01 单组合工作台：推进、调仓、回看与重开](drafts/01-single-portfolio-observation.md) |
| 32 | [01 单组合工作台：推进、调仓、回看与重开](drafts/01-single-portfolio-observation.md) |
| 33 | [01 单组合工作台：推进、调仓、回看与重开](drafts/01-single-portfolio-observation.md) |
| 34 | [06 快速展开与异常恢复：取消、失败、重试和继续](drafts/06-bulk-reveal-and-recovery.md) |
| 35 | [01 单组合工作台：推进、调仓、回看与重开](drafts/01-single-portfolio-observation.md) |
| 36 | [01 单组合工作台：推进、调仓、回看与重开](drafts/01-single-portfolio-observation.md) |
| 37 | [06 快速展开与异常恢复：取消、失败、重试和继续](drafts/06-bulk-reveal-and-recovery.md) |
| 38 | [05 单组合结果：阶段分析、完整结果与事件回看](drafts/05-results-and-process-return.md) |
| 39 | [05 单组合结果：阶段分析、完整结果与事件回看](drafts/05-results-and-process-return.md) |
| 40 | [05 单组合结果：阶段分析、完整结果与事件回看](drafts/05-results-and-process-return.md) |
| 41 | [07 组合比较：共同区间、口径差异与回看](drafts/07-portfolio-comparison.md) |
| 42 | [05 单组合结果：阶段分析、完整结果与事件回看](drafts/05-results-and-process-return.md) |
| 43 | [05 单组合结果：阶段分析、完整结果与事件回看](drafts/05-results-and-process-return.md) |
| 44 | [04 配置派生：保留原实验并重开多个实验](drafts/04-fork-and-reopen-experiments.md) |
| 45 | [04 配置派生：保留原实验并重开多个实验](drafts/04-fork-and-reopen-experiments.md) |
| 46 | [01 单组合工作台：推进、调仓、回看与重开](drafts/01-single-portfolio-observation.md) |
| 47 | [06 快速展开与异常恢复：取消、失败、重试和继续](drafts/06-bulk-reveal-and-recovery.md) |
| 48 | [01 单组合工作台：推进、调仓、回看与重开](drafts/01-single-portfolio-observation.md) |
| 49 | [01 单组合工作台：推进、调仓、回看与重开](drafts/01-single-portfolio-observation.md) |
| 50 | [01 单组合工作台：推进、调仓、回看与重开](drafts/01-single-portfolio-observation.md) |

## 不适用与证据边界

- 不新增生产schema/API/真实数据库写入：内存原型范围，正式功能要求未删除。
- 保存失败只做明确标注的合成恢复交互；不可据此打勾正式持久化。
- 窄屏、触屏专项为用户本轮明确暂缓，不作为本次验收阻塞。
- 文字、代码/DOM断言和worker报告不能代替真实图表或视觉检查；本轮只检验草稿结构、映射、链接与DAG，不执行产品测试。
