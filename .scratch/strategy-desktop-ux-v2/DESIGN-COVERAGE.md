# 桌面 UX v2 设计覆盖矩阵

2026-09-30续行owner替换：C25–27/C28仍按批准DD06/09/12–14、INTEGRATION-07及原准确参考/旅程。comparison_ui_resume（Luna6/max）仅comparison-prototype.tsx/css、implementation/07-ui.md；comparison_runtime_resume（Luna6/max）仅running-prototype.tsx/css、implementation/07-runtime.md；acceptance_resume（Astra/low）仅reviewer07/08。root负责整页与完整状态接受。Results TSX/CSS已有按钮，本轮没有writer；必要变更先明确转交。X07-02代表图失败需先修首屏并直接独立看图，再扩展完整UI；保留旧FAIL证据。

07/C26当前X07-01静态FAIL：旧比较事件上下文可能回退M，runtime owner修复中，真实反例待补；完整接受门槛保持。

状态：已发布、用户授权实施；不修改原功能覆盖表与父票。准确源为[桌面规格](../../docs/specs/2026-09-29-strategy-desktop-ux-design.md)，行号依据2026-09-29版本；改稿后实际派发前重新校验。当前C01–C20已按各票范围通过；C21–C30的新范围待后续接受。历史回归与处理记录保留在下文及acceptance目录。

范围：评审D01–D10；UX01–UX10、E01–E12、T01–T12。窄屏D11排除。1440×900、1280×800，缩放100%；历史图DPR1，新图记录实测值。

## 需求、元素和状态分配

各图相对来源目录为 ../strategy-portfolio-backtesting/screenshots/。现有图是风格/旧状态证据，本文行内引用明确状态；未提供对应新画板时按规格文字目标与现有规范直接对照，不能声称像素批准。每行实现owner为对应任务领取后绑定的唯一owner，按执行责任表绑定；协调者负责整页一致性，独立评审者不得参与所审UI实现。

| 行ID | 需求 | elementID | 规格章节/行 | 阶段与状态 | owner/任务 | 浏览器操作 | 可观察预期与反例 | 准确参考 | 验收/计划证据 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C01 | UX02/UX09/UX10 | E01/E03/E05/E12 | DD02、DD05、DD12；125/169/260 | T0待开始 | [01 单组合工作台：推进、调仓、回看与重开](issues/01-single-portfolio-observation.md)；owner见执行责任表 | 进入运行→看净值→切K线 | 资产=本金、净值1、无成交/当日未开始；不造预热净值 | [creation-baseline-1440.jpg](../strategy-portfolio-backtesting/screenshots/creation-baseline-1440.jpg) | T03/T12；acceptance/01.md / screenshots/01/（已有root与独立审查证据） | PASS（本票范围，08集成已复验） |
| C02 | UX02/UX03 | E03/E04/E05/E06 | DD06；177 | 首次建仓 | [01 单组合工作台：推进、调仓、回看与重开](issues/01-single-portfolio-observation.md)；owner见执行责任表 | 下一交易日→查看bar、摘要与持仓 | 可见新增真实bar与同日资产；日期变图不变失败 | [running-day1-1440.jpg](../strategy-portfolio-backtesting/screenshots/running-day1-1440.jpg) | T03；acceptance/01.md / screenshots/01/（已有root与独立审查证据） | PASS（本票范围，08集成已复验） |
| C03 | UX03/UX09 | E04/E05 | DD06；185–200 | 播放/暂停/长区间 | [01 单组合工作台：推进、调仓、回看与重开](issues/01-single-portfolio-observation.md)；owner见执行责任表 | 播放→暂停→窗口外继续→resize/平移 | 暂停不推进，最新bar可见，resize保留视野 | [running-day5-1440.jpg](../strategy-portfolio-backtesting/screenshots/running-day5-1440.jpg) | T06/T12；acceptance/01.md / screenshots/01/（已有root与独立审查证据） | PASS（本票范围，08集成已复验） |
| C04 | UX03/UX04 | E04/E05/E06/E07 | DD06；177–200 | 回看与已知事件导航 | [01 单组合工作台：推进、调仓、回看与重开](issues/01-single-portfolio-observation.md)；owner见执行责任表 | 回看T0/事件→恢复最新 | 列表与图截止V，仅导航可提示已知日期/类型；M保留 | [running-review-t0-1440.jpg](../strategy-portfolio-backtesting/screenshots/running-review-t0-1440.jpg) | T05/T06；acceptance/01.md / screenshots/01/（已有root与独立审查证据） | PASS（本票范围，08集成已复验） |
| C05 | UX02/UX09 | E06/E07 | DD08、DD13；212/268 | 正常调仓/详情 | [01 单组合工作台：推进、调仓、回看与重开](issues/01-single-portfolio-observation.md)；owner见执行责任表 | 点事件→读原因和权重→关闭 | 中性事件、详情不挤主图；关闭焦点返回不续播 | [running-day5-1440.jpg](../strategy-portfolio-backtesting/screenshots/running-day5-1440.jpg) | T03/T12；acceptance/01.md / screenshots/01/（已有root与独立审查证据） | PASS（本票范围，08集成已复验） |
| C06 | UX04/UX10 | E01/E04/E12 | DD10；242 | 单实验重开 | [01 单组合工作台：推进、调仓、回看与重开](issues/01-single-portfolio-observation.md)；owner见执行责任表 | 暂停→返回列表→重开 | V/M、视野和已看来源恢复；不再成交 | [running-review-t0-1440.jpg](../strategy-portfolio-backtesting/screenshots/running-review-t0-1440.jpg) | T03；acceptance/01.md / screenshots/01/（已有root与独立审查证据） | PASS（本票范围，08集成已复验） |
| C07 | UX06/UX09 | E09/E12 | DD03、DD13；146/268 | 创建步骤/回退 | [02 四步创建：策略包选择、候选解释与确认进入](issues/02-guided-creation.md)；owner见执行责任表 | 新建→四步→进入T0→返回重开 | 一主一次、完成/当前区分；入口无成交 | [creation-ready-1440.jpg](../strategy-portfolio-backtesting/screenshots/creation-ready-1440.jpg) | T01/T12；acceptance/02.md / screenshots/02/（已有root与独立审查证据） | PASS（本票范围，08集成已复验） |
| C08 | UX06/UX10 | E09/E12 | DD03；146 | 日期/资金/五期限 | [02 四步创建：策略包选择、候选解释与确认进入](issues/02-guided-creation.md)；owner见执行责任表 | 盘中/休市/非法输入→校验→期限 | 非法阻断、有效截止可读；未来数据不能参与 | [creation-history-1440-final.jpg](../strategy-portfolio-backtesting/screenshots/creation-history-1440-final.jpg) | T02；acceptance/02.md / screenshots/02/（已有root与独立审查证据） | PASS（本票范围，08集成已复验） |
| C09 | UX07/UX09 | E10 | DD04；159–167 | 策略多选/详情/预设 | [02 四步创建：策略包选择、候选解释与确认进入](issues/02-guided-creation.md)；owner见执行责任表 | 选包→查看规则→修改已选预设 | 不拆条件搭建器，未选预设只读，详情不改变选中 | [creation-packages-1280-final.jpg](../strategy-portfolio-backtesting/screenshots/creation-packages-1280-final.jpg) | T01/T02/T12；acceptance/02.md / screenshots/02/（已有root与独立审查证据） | PASS（本票范围，08集成已复验） |
| C10 | UX07/UX10 | E10/E12 | DD04；159–167 | 必要数据缺失 | [02 四步创建：策略包选择、候选解释与确认进入](issues/02-guided-creation.md)；owner见执行责任表 | 切缺字段场景→看不可用包/另一个包 | 原因就近；不把全页面禁用 | [creation-missing-1440-final.jpg](../strategy-portfolio-backtesting/screenshots/creation-missing-1440-final.jpg) | T02；acceptance/02.md / screenshots/02/（已有root与独立审查证据） | PASS（本票范围，08集成已复验） |
| C11 | UX08 | E11 | DD04；165–167 | 候选分组与证据 | [02 四步创建：策略包选择、候选解释与确认进入](issues/02-guided-creation.md)；owner见执行责任表 | 预览→入选/规则不符/数据不足→展开行 | 计数真实为演示子集，未知不算排除 | [creation-preview-1280-final.jpg](../strategy-portfolio-backtesting/screenshots/creation-preview-1280-final.jpg) | T01/T02；acceptance/02.md / screenshots/02/（已有root与独立审查证据） | PASS（本票范围，08集成已复验） |
| C12 | UX08/UX10 | E09/E11/E12 | DD04；167 | 部分覆盖确认/撤销 | [02 四步创建：策略包选择、候选解释与确认进入](issues/02-guided-creation.md)；owner见执行责任表 | 确认部分范围→改日期/集合/场景 | 旧确认撤销，确认页范围仍可查 | [creation-preview-1280-final.jpg](../strategy-portfolio-backtesting/screenshots/creation-preview-1280-final.jpg) | T02；acceptance/02.md / screenshots/02/（已有root与独立审查证据） | PASS（本票范围，08集成已复验） |
| C13 | UX08 | E11 | DD04；167 | 无候选/目标实际 | [02 四步创建：策略包选择、候选解释与确认进入](issues/02-guided-creation.md)；owner见执行责任表 | 无候选创建→T0 | 目标现金100%且实际无成交；金额随本金变化 | [creation-preview-1280-final.jpg](../strategy-portfolio-backtesting/screenshots/creation-preview-1280-final.jpg) | T02；acceptance/02.md / screenshots/02/（已有root与独立审查证据） | PASS（本票范围，08集成已复验） |
| C14 | UX01/UX02/UX03 | E02/E03/E05/E06/E07 | DD05；169–175 | 双组合正常同步 | [03 多组合观察：共享日期与全局联动](issues/03-synchronized-portfolios.md)；owner见执行责任表 | 同日切组合→查净值/持仓/事件 | 全局一致、资金独立、日期不变 | [design-review-running-1440.jpg](../strategy-portfolio-backtesting/screenshots/design-review-running-1440.jpg) | T04；acceptance/03.md / screenshots/03/（已有root与独立审查证据） | PASS（本票范围，08集成已复验） |
| C15 | UX01/UX09 | E02/E05/E07 | DD05、DD13；173/268 | 跨组合残留/长名称 | [03 多组合观察：共享日期与全局联动](issues/03-synchronized-portfolios.md)；owner见执行责任表 | 选事件/标的→换组合→查溢出菜单 | 旧事件关闭，非持有标的明确，全部组合可达 | [design-review-running-1440.jpg](../strategy-portfolio-backtesting/screenshots/design-review-running-1440.jpg) | T04/T12；acceptance/03.md / screenshots/03/（已有root与独立审查证据） | PASS（本票范围，08集成已复验） |
| C16 | UX01/UX04 | E01/E09 | DD10；242–250 | 只读配置/取消派生 | [04 配置派生：保留原实验并重开多个实验](issues/04-fork-and-reopen-experiments.md)；owner见执行责任表 | 配置→派生→编辑→取消→原实验 | 原V/M/账本/视野不变 | [creation-ready-1440.jpg](../strategy-portfolio-backtesting/screenshots/creation-ready-1440.jpg) | T08；acceptance/04.md / screenshots/04/（已有root与独立审查证据） | PASS（本票范围，08集成已复验） |
| C17 | UX01/UX04/UX06 | E01/E02/E09/E12 | DD10、DD07；242/210 | 派生创建/多实验列表 | [04 配置派生：保留原实验并重开多个实验](issues/04-fork-and-reopen-experiments.md)；owner见执行责任表 | 创建派生→切回原→分别重开 | 不复制旧候选/成交；保留来源已看提示 | [running-review-t0-1440.jpg](../strategy-portfolio-backtesting/screenshots/running-review-t0-1440.jpg) | T08/T12；acceptance/04.md / screenshots/04/（已有root与独立审查证据） | PASS（本票范围，08集成已复验） |
| C18 | UX05 | E03/E08/E12 | DD09、DD12；220/260 | 阶段与完整结果 | [05 单组合结果：阶段分析、完整结果与事件回看](issues/05-results-and-process-return.md)；owner见执行责任表 | 逐日到阶段/终点→结果→切曲线 | R明确≤可用边界，曲线和指标来自同一账本 | [running-nav-1280.jpg](../strategy-portfolio-backtesting/screenshots/running-nav-1280.jpg) | T09；acceptance/05.md / screenshots/05/（已有root与独立审查证据） | PASS（本票范围，08集成已复验） |
| C19 | UX05/UX10 | E03/E08/E12 | DD09、DD12；220/260 | 零交易/未知/损益 | [05 单组合结果：阶段分析、完整结果与事件回看](issues/05-results-and-process-return.md)；owner见执行责任表 | 全现金或未知场景→结果明细 | 胜率不可计算、未知不填0、不伪造因果收益 | [running-year-cash-1280.jpg](../strategy-portfolio-backtesting/screenshots/running-year-cash-1280.jpg) | T09/T10；acceptance/05.md / screenshots/05/（已有root与独立审查证据） | PASS（本票范围，08集成已复验） |
| C20 | UX03/UX05 | E07/E08 | DD09、DD06；238/177 | 结果与过程双向返回 | [05 单组合结果：阶段分析、完整结果与事件回看](issues/05-results-and-process-return.md)；owner见执行责任表 | 结果事件→过程→来源结果；普通返回过程 | 事件身份准确，R/筛选/滚动和原V按入口恢复 | [running-review-t0-1440.jpg](../strategy-portfolio-backtesting/screenshots/running-review-t0-1440.jpg) | T09/T05；acceptance/05.md / screenshots/05/（已有root与独立审查证据） | PASS（本票范围，08集成已复验） |
| C21 | UX03/UX04/UX05 | E04/E08/E12 | DD07；202–210 | 快速展开确认/取消/完成 | [06 快速展开与异常恢复：取消、失败、重试和继续](issues/06-bulk-reveal-and-recovery.md)；owner见执行责任表 | 取消→确认→停止/继续→结果 | 取消无变化、进度真实、与逐日一致 | [design-review-running-1440.jpg](../strategy-portfolio-backtesting/screenshots/design-review-running-1440.jpg) | T07；acceptance/06.md / screenshots/06/（已有root及独立审查） | PASS（06范围，08集成已复验） |
| C22 | UX03/UX04/UX10 | E04/E06/E12 | DD11；252–258 | 中断/执行失败/重试 | [06 快速展开与异常恢复：取消、失败、重试和继续](issues/06-bulk-reveal-and-recovery.md)；owner见执行责任表 | 确定性错误→最后完整日→重试 | 无半日提交、无重复成交、已看记录不提前 | [design-review-running-1440.jpg](../strategy-portfolio-backtesting/screenshots/design-review-running-1440.jpg) | T11；acceptance/06.md / screenshots/06/（已有root及独立审查） | PASS（06范围，08集成已复验） |
| C23 | UX01/UX03/UX04 | E02/E03/E05/E12 | DD06 Mᵢ；181 | 排除失败组后继续/落后组 | [06 快速展开与异常恢复：取消、失败、重试和继续](issues/06-bulk-reveal-and-recovery.md)；owner见执行责任表 | 排除失败组→其他继续→切回落后组 | 此日不可用、旧曲线截断、显式查看Mᵢ | [design-review-running-1440.jpg](../strategy-portfolio-backtesting/screenshots/design-review-running-1440.jpg) | T11/T05；acceptance/06.md / screenshots/06/（已有root及独立审查） | PASS（06范围，08集成已复验） |
| C24 | UX04/UX10 | E01/E12 | DD11；256–258 | 模拟保存失败恢复 | [06 快速展开与异常恢复：取消、失败、重试和继续](issues/06-bulk-reveal-and-recovery.md)；owner见执行责任表 | 演示失败→保留本地→重试/重载 | 演示标识全程可见，不声称真实持久化 | [creation-ready-1440.jpg](../strategy-portfolio-backtesting/screenshots/creation-ready-1440.jpg) | T11；acceptance/06.md / screenshots/06/（已有root及独立审查） | PASS（06范围，08集成已复验） |
| C25 | UX01/UX05 | E02/E03/E08 | DD09；224–240 | 比较共同区间/口径差异 | [07 组合比较：共同区间、口径差异与回看](issues/07-portfolio-comparison.md)；owner见执行责任表 | 两组比较→看口径/共同区间→切曲线 | 差异说明，独立资金，不跨区间排名 | [creation-baseline-1440.jpg](../strategy-portfolio-backtesting/screenshots/creation-baseline-1440.jpg) | T10；acceptance/07.md / screenshots/07/（root最终及独立Astra证据） | PASS（07及08最终签署） |
| C26 | UX01/UX03/UX05 | E02/E07/E08/E12 | DD09；234–240 | 部分/失败/更晚单组合/来源返回 | [07 组合比较：共同区间、口径差异与回看](issues/07-portfolio-comparison.md)；owner见执行责任表 | 比较→选更晚单组→事件→返回比较 | 不延长失败组，不隐藏失败列；曝光来源保留 | [creation-baseline-1280.jpg](../strategy-portfolio-backtesting/screenshots/creation-baseline-1280.jpg) | T09/T10；acceptance/07.md / screenshots/07/（root最终及独立Astra证据） | PASS（07及08最终签署） |
| C27 | UX01/UX09 | E02/E08 | DD09；234 | 多于4曲线/长名称 | [07 组合比较：共同区间、口径差异与回看](issues/07-portfolio-comparison.md)；owner见执行责任表 | 图例开关→查看更多组合 | 最多突出4条不限制组合数；名称/线型辅助识别 | [creation-baseline-1280.jpg](../strategy-portfolio-backtesting/screenshots/creation-baseline-1280.jpg) | T10/T12；acceptance/07.md / screenshots/07/（root最终及独立Astra证据） | PASS（07及08最终签署） |
| C28 | UX09/UX10 | E01–E12 | DD13–DD14；268–281 | 全部页面视觉/演示工具/键盘 | 01–07各自owner，08独立整体验证 | 两档桌面→按关键状态看图与键盘操作 | 每票有视觉证据；正常事件不满屏黄，关键说明不藏匿 | [creation-baseline-1440.jpg](../strategy-portfolio-backtesting/screenshots/creation-baseline-1440.jpg) | T12；acceptance/NN.md / screenshots/NN/（各票及08实际/独立证据） | PASS（08最终签署） |
| C29 | UX01–UX10 | E01–E12 | TD01–TD04；307–344 | 完整集成旅程 | [08 完整桌面旅程与独立视觉验收](issues/08-desktop-journey-acceptance.md)；owner见执行责任表 | 新会话创建→多组→调仓→派生→结果比较→回看重开 | 不以局部报告代替整条旅程，不遗漏错误/空状态 | [creation-baseline-1280.jpg](../strategy-portfolio-backtesting/screenshots/creation-baseline-1280.jpg) | T01–T12；acceptance/08.md / screenshots/08/（各票及08实际/独立证据） | PASS（08最终签署） |

## 每项验收场景的主责任

补充异常执行状态（同样需要独立证据）：

| 行ID | 需求/元素 | 规格章节/行 | 阶段与状态 | owner/任务 | 浏览器操作与可观察预期 | 准确参考 | 验收/计划证据 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C30 | UX04/UX05/UX09；E05/E06/E07/E12 | DD08 212–218行；DD11 252–258行 | 完整交易日内部分成交/未成交 | [06 快速展开与异常恢复](issues/06-bulk-reveal-and-recovery.md)；owner见执行责任表 | 演示部分成交→查看原因、计划/实际及账本；成交、现金、持仓一致，不能当作中断产生的未提交半日状态 | [运行事件参考](../strategy-portfolio-backtesting/screenshots/running-day5-1440.jpg)；新异常按文字契约验收 | T11/T12；acceptance/06.md / screenshots/06/（已有root及独立审查） | PASS（06范围，08集成已复验） |

| 验收场景 | 主任务 | 复验责任 |
| --- | --- | --- |
| T01 创建闭环 | [02 四步创建：策略包选择、候选解释与确认进入](issues/02-guided-creation.md) | 03与08检查新工作台接入后的双组合 |
| T02 草稿与数据边界 | [02 四步创建：策略包选择、候选解释与确认进入](issues/02-guided-creation.md) | 04派生时重走，08串联 |
| T03 最小真实图表 | [01 单组合工作台：推进、调仓、回看与重开](issues/01-single-portfolio-observation.md) | 所有依赖票保住；08整体验证 |
| T04 全局组合联动 | [03 多组合观察：共享日期与全局联动](issues/03-synchronized-portfolios.md) | 06落后组/07比较/08整体验证 |
| T05 双截止与前视 | [01 单组合工作台：推进、调仓、回看与重开](issues/01-single-portfolio-observation.md) | 03/05/06/07各自新揭示入口，08集成 |
| T06 时间与视野 | [01 单组合工作台：推进、调仓、回看与重开](issues/01-single-portfolio-observation.md) | 03/06/08复验新增动作 |
| T07 快速展开 | [06 快速展开与异常恢复：取消、失败、重试和继续](issues/06-bulk-reveal-and-recovery.md) | 08全旅程 |
| T08 配置派生 | [04 配置派生：保留原实验并重开多个实验](issues/04-fork-and-reopen-experiments.md) | 08全旅程 |
| T09 结果闭环 | [05 单组合结果：阶段分析、完整结果与事件回看](issues/05-results-and-process-return.md) | 06/07新增入口，08全旅程 |
| T10 比较边界 | [07 组合比较：共同区间、口径差异与回看](issues/07-portfolio-comparison.md) | 05负责单组空/未知语义，08全旅程 |
| T11 异常恢复 | [06 快速展开与异常恢复：取消、失败、重试和继续](issues/06-bulk-reveal-and-recovery.md) | 07比较消费失败状态，08全旅程 |
| T12 桌面/键盘 | 01–07逐票验收 | [08 完整桌面旅程与独立视觉验收](issues/08-desktop-journey-acceptance.md)独立整页复验 |

## 用户故事覆盖

下表为首要交付责任；08重新覆盖全部故事但不能替代前票实现。

| 用户故事编号 | 首要任务 |
| --- | --- |
| 1 | [01 单组合工作台：推进、调仓、回看与重开](issues/01-single-portfolio-observation.md) |
| 2 | [04 配置派生：保留原实验并重开多个实验](issues/04-fork-and-reopen-experiments.md) |
| 3 | [02 四步创建：策略包选择、候选解释与确认进入](issues/02-guided-creation.md) |
| 4 | [02 四步创建：策略包选择、候选解释与确认进入](issues/02-guided-creation.md) |
| 5 | [02 四步创建：策略包选择、候选解释与确认进入](issues/02-guided-creation.md) |
| 6 | [02 四步创建：策略包选择、候选解释与确认进入](issues/02-guided-creation.md) |
| 7 | [02 四步创建：策略包选择、候选解释与确认进入](issues/02-guided-creation.md) |
| 8 | [02 四步创建：策略包选择、候选解释与确认进入](issues/02-guided-creation.md) |
| 9 | [01 单组合工作台：推进、调仓、回看与重开](issues/01-single-portfolio-observation.md) |
| 10 | [02 四步创建：策略包选择、候选解释与确认进入](issues/02-guided-creation.md) |
| 11 | [02 四步创建：策略包选择、候选解释与确认进入](issues/02-guided-creation.md) |
| 12 | [02 四步创建：策略包选择、候选解释与确认进入](issues/02-guided-creation.md) |
| 13 | [02 四步创建：策略包选择、候选解释与确认进入](issues/02-guided-creation.md) |
| 14 | [02 四步创建：策略包选择、候选解释与确认进入](issues/02-guided-creation.md) |
| 15 | [02 四步创建：策略包选择、候选解释与确认进入](issues/02-guided-creation.md) |
| 16 | [02 四步创建：策略包选择、候选解释与确认进入](issues/02-guided-creation.md) |
| 17 | [02 四步创建：策略包选择、候选解释与确认进入](issues/02-guided-creation.md) |
| 18 | [02 四步创建：策略包选择、候选解释与确认进入](issues/02-guided-creation.md) |
| 19 | [02 四步创建：策略包选择、候选解释与确认进入](issues/02-guided-creation.md) |
| 20 | [02 四步创建：策略包选择、候选解释与确认进入](issues/02-guided-creation.md) |
| 21 | [02 四步创建：策略包选择、候选解释与确认进入](issues/02-guided-creation.md) |
| 22 | [03 多组合观察：共享日期与全局联动](issues/03-synchronized-portfolios.md) |
| 23 | [03 多组合观察：共享日期与全局联动](issues/03-synchronized-portfolios.md) |
| 24 | [01 单组合工作台：推进、调仓、回看与重开](issues/01-single-portfolio-observation.md) |
| 25 | [01 单组合工作台：推进、调仓、回看与重开](issues/01-single-portfolio-observation.md) |
| 26 | [01 单组合工作台：推进、调仓、回看与重开](issues/01-single-portfolio-observation.md) |
| 27 | [01 单组合工作台：推进、调仓、回看与重开](issues/01-single-portfolio-observation.md) |
| 28 | [01 单组合工作台：推进、调仓、回看与重开](issues/01-single-portfolio-observation.md) |
| 29 | [01 单组合工作台：推进、调仓、回看与重开](issues/01-single-portfolio-observation.md) |
| 30 | [01 单组合工作台：推进、调仓、回看与重开](issues/01-single-portfolio-observation.md) |
| 31 | [01 单组合工作台：推进、调仓、回看与重开](issues/01-single-portfolio-observation.md) |
| 32 | [01 单组合工作台：推进、调仓、回看与重开](issues/01-single-portfolio-observation.md) |
| 33 | [01 单组合工作台：推进、调仓、回看与重开](issues/01-single-portfolio-observation.md) |
| 34 | [06 快速展开与异常恢复：取消、失败、重试和继续](issues/06-bulk-reveal-and-recovery.md) |
| 35 | [01 单组合工作台：推进、调仓、回看与重开](issues/01-single-portfolio-observation.md) |
| 36 | [01 单组合工作台：推进、调仓、回看与重开](issues/01-single-portfolio-observation.md) |
| 37 | [06 快速展开与异常恢复：取消、失败、重试和继续](issues/06-bulk-reveal-and-recovery.md) |
| 38 | [05 单组合结果：阶段分析、完整结果与事件回看](issues/05-results-and-process-return.md) |
| 39 | [05 单组合结果：阶段分析、完整结果与事件回看](issues/05-results-and-process-return.md) |
| 40 | [05 单组合结果：阶段分析、完整结果与事件回看](issues/05-results-and-process-return.md) |
| 41 | [07 组合比较：共同区间、口径差异与回看](issues/07-portfolio-comparison.md) |
| 42 | [05 单组合结果：阶段分析、完整结果与事件回看](issues/05-results-and-process-return.md) |
| 43 | [05 单组合结果：阶段分析、完整结果与事件回看](issues/05-results-and-process-return.md) |
| 44 | [04 配置派生：保留原实验并重开多个实验](issues/04-fork-and-reopen-experiments.md) |
| 45 | [04 配置派生：保留原实验并重开多个实验](issues/04-fork-and-reopen-experiments.md) |
| 46 | [01 单组合工作台：推进、调仓、回看与重开](issues/01-single-portfolio-observation.md) |
| 47 | [06 快速展开与异常恢复：取消、失败、重试和继续](issues/06-bulk-reveal-and-recovery.md) |
| 48 | [01 单组合工作台：推进、调仓、回看与重开](issues/01-single-portfolio-observation.md) |
| 49 | [01 单组合工作台：推进、调仓、回看与重开](issues/01-single-portfolio-observation.md) |
| 50 | [01 单组合工作台：推进、调仓、回看与重开](issues/01-single-portfolio-observation.md) |

## 不适用与证据边界

- 不新增生产schema/API/真实数据库写入：内存原型范围，正式功能要求未删除。
- 保存失败只做明确标注的合成恢复交互；不可据此打勾正式持久化。
- 窄屏、触屏专项为用户本轮明确暂缓，不作为本次验收阻塞。
- 文字、代码/DOM断言和worker报告不能代替真实图表或视觉检查；拆票阶段仅检验结构；实施后的真实图表、浏览器与独立视觉证据按各票acceptance记录，不能由模型断言替代。

## 执行责任表

| 任务 | 实现唯一 owner | 整页视觉及状态集成 | 独立验收 | 可写范围 |
| --- | --- | --- | --- | --- |
| 01 | /root/desktop_workbench_01 · gpt-6-luna/max | /root | Astra/low | running-prototype.tsx/css、运行专用新模块、implementation/01.md |
| 02 | /root/desktop_creation_02 · gpt-6-luna/max | /root | Astra/low | creation-prototype.tsx/css、implementation/02.md |
| 03–07 | 依赖接受后绑定 Luna6/max owner | /root | Astra/low | 派发前明确 |
| 08 | /root | /root | Astra/low | 验收文档及截图 |

冻结接口：RunningDraft 和 RunningPrototype 的 draft/visible/onList/onReady/onStatus 保持兼容。01不得修改创建文件，02不得修改运行文件。不改普通业务页、共享样式、API、数据库。浏览器当前唯一控制者为 /root，审查者需取得交接。

### 01样式职责转交

2026-09-29：01状态实现继续由desktop_workbench_01拥有TSX/running-model；running-prototype.css转交desktop_workbench_style_01（Luna6/max）作为同票有界子任务，禁止双方同时写CSS。该样式拆分不是新增横向产品票；01仍以完整实际旅程统一接受。root整页视觉/状态集成责任不变。

## 当前执行与证据补充（覆盖上文计划状态，不删除历史）

01/02已接受，逐AC真实证据见acceptance/01.md、02.md及reviewer-01/02.md；C01–C13及其范围内C28局部门槛已验证，后续集成须回归。

| 票/覆盖 | 唯一实现owner | 精确可写范围 | 批准规格与图片/操作/证据 |
| --- | --- | --- | --- |
| 03 / C14–C15、相关C28 | desktop_workbench_01，Luna6/max | running-prototype.tsx/css、running-model.ts、implementation/03.md | 沿用上文逐行DD05/06、E02–07、design-review-running参考；双组同日切换/图表状态/更多组合；acceptance/03.md与screenshots/03/ |
| 04 / C16–C17、相关C28 | desktop_creation_02，Luna6/max | creation-prototype.tsx/css、implementation/04.md | 沿用DD10/07/06、E01/E09/E12、ready/review参考；派生→取消/创建→重开原/新；acceptance/04.md与screenshots/04/ |
| 05 / C18–C20、相关C28 | desktop_workbench_style_01，Luna6/max | 新增results-prototype.tsx/css、results-model.ts、implementation/05.md | 沿用DD09/12/06、E03/E07/E08/E12、nav/yearcash参考；R截止→三曲线/指标→事件→来源结果/原过程；acceptance/05.md与screenshots/05/ |

root为三票整页视觉与状态闭环owner，Astra/low独立验收。共享接口与禁止项见INTEGRATION-03-05.md。原01 CSS子任务已结束，CSS写权归03唯一owner。

- X01-03 scoped regression：01初始净值日期在盘中/休市起点误用行情截止日；01局部reopened，历史接受保留，03–05已在实施但最终接受须等此项复验。仅修初始Snapshot为实际T0日期，不扩展已知行情；目标证据为盘中/周末净值与K线分界及结果起始区间。当前 NOT VERIFIED。

- 当前：04/05 root ACCEPTED（acceptance/04/05+reviewer）。03剩X03-02长名称active tab横向可见性P2，owner修复；06待03接受。01 X01-03模型/浏览器已修，最终记录随03收口；整体未完成。

## 06 派发责任与精确覆盖（前置01–05均accepted）

批准路径/行号/图保持上文C21–C24/C30/C28原表；操作、反例与证据位置不变。共同接口：[INTEGRATION-06.md](INTEGRATION-06.md)。

| 覆盖 | 唯一实现owner与写入 | 集成与用户旅程/证据 | 状态 |
| --- | --- | --- | --- |
| C21 / UX03/04/05 E04/E08/E12 | desktop_workbench_01运行TSX/CSS、新running-recovery-session.ts；desktop_workbench_style_01仅新recovery-prototype.tsx/css受控UI | root；确认取消→实际完整日展开→停止/成功进入结果；acceptance/06.md+screenshots/06 | NOT VERIFIED |
| C22–23 / UX01/03/04/10 E02–06/E12 | desktop_workbench_01同上runtime状态/每组Mi唯一；style owner仅子UI | root；故障安全边界→retry/exclude→其他继续→落后组不可用/显式Mi；同06证据 | NOT VERIFIED |
| C24 / UX04/10 E01/E12 | desktop_workbench_01内存checkpoint状态；style owner仅工具反馈 | root；模拟savefail→本地/旧checkpoint→retry/reload保留最远曝光；同06证据 | NOT VERIFIED |
| C30 / UX04/05/09 E05–07/E12 | desktop_creation_02仅running-model.ts执行override/nextExecutionCursor；style owner仅results-model及results-prototype TSX/CSS口径消费；runtime owner接入/存每组override | root；partial/unfilled计划/实际/现金/持仓与结果同账本；数值+browser+两档图 | NOT VERIFIED |
| C28相关06状态 / UX09/10 E01–12 | 各owner精确互斥范围见契约；root整页视觉/状态责任；Astra/low独立 | 1440×900及1280×800，DPR1/100%；确认/进行/失败/落后/事件恢复；非真实DB、窄屏N/A | NOT VERIFIED |

报告implementation/06-runtime.md、06-ledger.md、06-ui.md。未自看渲染不得声称视觉PASS；root单票统一接受，不能把子任务完成当用户旅程完成。

## 06 续行与范围内验收失败（2026-09-29）

01–05接受保持；06当前acceptance-failed、07/08待依赖。X06-01排除Mi=T0组合批量无结果已局部修代码，待首日故障真实路径闭环。新增X06-02：root直接查看execution-failure-1280.png与lagging-1440.png，确认常驻恢复/演示入口加两张重复反馈卡，把主图与日期轴推到首屏之外；属于DD02/DD11/DD13、C22–23/C28范围内视觉FAIL。

续行所有权：/root/recovery_layout_06（gpt-6-luna/max）仅recovery-prototype.tsx/css及implementation/06-layout-repair.md；不写runtime/model/results/creation。修复时保留所有原因、日期、归属、retry/exclude/最后完整日与列表动作，合并相同组合的重复反馈、降低常驻区占高，不缩小关键字或主图。root仍负责整页/完整状态，/root/acceptance_final（gpt-6-astra/low）独立直接对照。准确参考：screenshots/06/{confirm,execution-failure,lagging}-{1440,1280}.png与screenshots/reference/tradereview-{1440,1280}.png；图为修前事实，不能覆盖删除。修后截图使用fixed后缀。验收证据acceptance/06.md、reviewer-06.md。

## 06 X06-03 独立视觉回归

X06-02主图修复两档已由Astra直接看图通过（failure-fixed/lagging-fixed）；新X06-03/P2：failure-fixed-1280右侧“已看后续”覆盖调仓事件标题/导航。06继续acceptance-failed。唯一修复owner /root/recovery_layout_06（Luna6/max）新增授权仅running-prototype.css与implementation/06-layout-repair.md；不改父状态或账本。root整页责任，Astra独立检查fixed2图及事件可达性，原失败图保留。

## 07 派发与责任（06已由root ACCEPTED）

01–06接受，07实施中，08待07依赖；整体未接受。准确批准引用保持C25–27/C28原表及INTEGRATION-07.md。

| 覆盖/元素 | 唯一实现owner/写入 | 旅程与证据 | 状态 |
| --- | --- | --- | --- |
| C25–27，UX01/03/05/09/10 E02/03/07/08/12；DD06 177–200/DD09 220–240/DD12–14 260–281 | /root/comparison_runtime_07，Luna6/max：仅running-prototype.tsx/css、implementation/07-runtime.md | 入口R=min(sourceV/R,共同Mi)→比较→显式更晚单组→准确事件/返回上下文；root实际browser，acceptance/07.md | NOT VERIFIED |
| 相同C25–27的只读呈现，相关C28 | /root/recovery_layout_06新07任务，Luna6/max：仅comparison-prototype.tsx/css、新comparison-model.ts（必要时）、results-prototype.tsx/css比较按钮、implementation/07-ui.md | 同轴归一化净值/回撤/仓位、口径矩阵、最多4线+6组可达；same screenshots/07、reviewer-07.md | NOT VERIFIED |

root为整页视觉及完整会话接线验收owner；/root/acceptance_final Astra/low独立审查。精确图片参考screenshots/reference/tradereview-{1440,1280}.png及05修后结果图，规格不是像素新画板。1440×900/1280×800 DPR1/100%，sidebar/蓝主动作/6–8圆角/12–14关键字体/36控件。无授权新增布局偏差；窄屏/生产DB N/A。先渲染代表性屏经独立审查，再扩展/修复。禁止双方交叉写文件；UI owner不再拥有running CSS，交回runtime07唯一。

## 07 第二阶段精确拆分（代表屏门槛已过）

2026-09-30：Astra直接比较representative-fixed-1440/1280与reference，X07-02限定代表屏首屏门槛PASS；root实测plot top434.02，高360/320，bottom794.02/754.02，DPR1。日期轴完整；1280滑块位于首屏底边，后续添加常驻内容必须重验。旧FAIL保留，07整体尚未接受。

- C25–27/DD09/E08曲线：comparison_runtime_resume（Luna6/max）转为仅新增comparison-chart.tsx/css及implementation/07-chart.md的writer，running TSX/CSS冻结。输入公开ResultAnalysis与显式显示的series，不接runtime时钟。真实NAV/DD/标的+现金历史仓位，HTML12px坐标与SVG导线对齐，360/320高度。root测试图与数值，Astra直接看图。
- C25–27/E02/E03/E07/E08/E12整体：comparison_ui_resume（Luna6/max）仍仅comparison-prototype.tsx/css及implementation/07-ui.md；集成chart接口、指标在曲线前、6组最多4线legend、分组/执行事件筛选+事件source-return、local state/scroll按entryId重置且返回保留、数据范围/版本/unknown/无基准。根协调者为整页/完整状态owner。
- Charts frozen接口：export type ComparisonChartMode = 'net-value'|'drawdown'|'allocation'; export type ComparisonChartSeries = {id:PortfolioId;name:string;analysis:ResultAnalysis;color:string;dash:string}; export function ComparisonChart({series,mode,currentDate,empty}: {series:ComparisonChartSeries[];mode:ComparisonChartMode;currentDate:string;empty:boolean})。UI为仓位模式只传一个明确选中的组合series，NAV/DD传最多4条；chart不拥有筛选、游标或其它页面state。
- 无新依赖/生产数据/数据库/窄屏；props主接口不变。精确参考与验收仍为本文件原表、INTEGRATION-07、acceptance/07与screenshots/07，最终08等待07全部接受。

## 07 完整UI接线发现（2026-09-30）

X07-03/P1，root与Astra静态独立确认：仓位图使用持久allocationPortfolioId，Single进入EMA较晚区间后可能仍显示quality；dropdown可直接换其它组合而不改运行owner单组身份。要求单组仓位由selectedPortfolioId决定，显式切换由同一runtime action处理。

X07-04/P2：从同步筛选quality后进入EMA Single，事件仍被旧portfolioFilter滤掉，而disabledselector显示EMA。Single忽略旧同步filter，返回同步保留原filter。两项交唯一comparison_ui_resume修，当前FAIL，browser未复现，最终修后实测关闭。root另要求零曲线选择不能伪标T0、未知partialReduction不可填0，现金权重1位小数；均在本07已授权契约内。

07仍open / acceptance-failed；08等待依赖。图表与runtime已冻结，UI正在修复；历史PASS只适用各自范围。

## 2026-09-30 最终交互复验缺陷

X07-03/04：root实际Single EMA7/12仓位归属、事件忽略旧quality筛选通过，最终冻结复验待收口。X07-05/P2：root实际比较→6/21部分成交→交易B，抽屉关闭且来源返回入口消失；Astra静态确认DD09违规，同时局部重开05的交易定位后来源返回。唯一runtime owner comparison_runtime_resume修复running TSX/CSS。X07-06/P2：失败Mi/预设/排除原因10–10.5px，小于DD13关键12px；UI owner修复。X07-07/P2：root实测同entryId2、单组EMA7/12、仓位、partial事件筛选，scroll290→事件→返回来源比较后scroll0；UI owner修复hidden后覆盖scroll记录。

准确引用：DD06 177–200、DD09 220–240、DD13 268–276；C19/C20/C26/C28，E04/E07/E08/E12。前序证据保留，05仅上述source-return局部重开，07仍acceptance-failed，08未放行。root负责实际路径与两档视觉，Astra独立对照。

2026-09-30 root：07 AC01–07 ACCEPTED（acceptance/07.md、reviewer-07第十一阶段）。X07-01–08关闭，05来源返回局部回归重新ACCEPTED。01–07均接受；08开始全新冻结版本集成验收，整体尚未接受。

2026-09-30 X08-01/P2：08新鲜T0-1280时间条回看控件裁切，07仅新增入口布局局部重开；Luna6/max comparison_runtime_resume仅running CSS修复，root实际两档/Astra独立复验。08整体未接受，其余已接受证据保留。

2026-09-30 X08-01修复关闭：root derived-t0-1280实际timebar无横向溢出、date selector全可见；Astra reviewer08第二阶段直接对照两档T0、主图/日期轴PASS。CSS-only无状态变更；07重新ACCEPTED，08继续验收。

## 最终覆盖签署
2026-09-30 root ACCEPTED：C01–30、UX01–10、E01–12、T01–12在acceptance/08.md最终索引逐项对账，reviewer-08独立AC02/03签署。所有适用设计/状态/浏览器/独立视觉门槛PASS；确切N/A/物理IME未测/全量单测基线FAIL见FINAL-ACCEPTANCE.md，不误称生产验收。旧表后续历史为实施过程，当前状态以本签署为准。
