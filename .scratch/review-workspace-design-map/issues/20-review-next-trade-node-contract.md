# 下一成交节点的名称与停点契约不一致

ID: review-audit-20
State: open
Status: acceptance-failed
Assignee: unassigned
集成负责人: coordinator
Priority: P1
Blocked by: 无

## Scope / What to build

统一“下一成交节点”的用户预期、实际停点及成交 Bar 可见性。原有验收明确记录 33 根停在加仓前、34 根出现加仓；本问题是名称与停点设计冲突，不能仅凭数字判断为越界错误。此票仅记录审阅发现，不构成修复授权。

## Refs

- [审阅报告与 33/34 根截图](../evidence/independent-design-review-20261028/REPORT.md)。
- [旧验收 C05](../evidence/immersive-layout/revision-01/acceptance.md) 和 [真实回放状态 R05](../evidence/immersive-layout/revision-01/DESIGN-COVERAGE.md)。

## 最新复开记录（candidate-v10）

2026-10-29：独立视觉报告 [final-review-v10](../evidence/review-fixes-20261028/final-review-v10/REPORT.md) 对冻结版 candidate-v10 判定 FAIL：成交文字标签遮挡箭头尖端，Text 卡片还会遮住加仓箭头并使标签与 Bar 脱节。本票保持 open / acceptance-failed，需在同一冻结版本复验成交前停、成交揭示帧及箭头/标签/Text 相对位置。对应清单：[candidate-v10 manifest](../evidence/review-fixes-20261028/candidate-v10/manifest.json)。报告限定为冻结 v10，后续运行目录改动须另行冻结复核；历史 PASS 仅适用于其旧版本和样本。

candidate-v11 追加（2026-10-29）：据协调者提供的独立审阅发现，v11 所审图片中成交箭头遮挡有所改善；此为局部静态观察，不关闭本票。Text 与 Bar 的空间关联仍受另一条标注卡重叠影响（细节见[问题 17 的 v11 记录](17-review-text-overlay-state.md)）；完整节点旅程和各阶段标记可见性仍待同版复验。候选清单：[candidate-v11 manifest](../evidence/review-fixes-20261028/candidate-v11/manifest.json)，正式 v11 报告待归档。

## 验收标准与反例

- [ ] 先明确每个动作停在成交前、成交 Bar 或成交后；按钮名称、提示、标记及数据截止表达同一语义。
- [ ] 在真实图表验证首次买入、后续成交和最终平仓的逐步/跳转轨迹，目标 Bar 或交易按所选契约可见，未来信息不提前显示。
- [ ] 持仓不新增右侧加仓/减仓判断表单；阶段、视野、返回/回看行为有证据。

反例：保留“下一成交节点”文案但未说明当前停在成交前，或仅验证内部索引而未比较实际图表。

candidate-v33 追记：选择播放速度后启动播放，按钮显示“暂停”但提示仍为“已暂停”，与实际状态矛盾，见 [画面](../evidence/review-fixes-20261028/coordinator/v33-play-start.jpg) 与 [操作记录](../evidence/review-fixes-20261028/coordinator/v33-audit-ax.json)。该版 33/34/41/49 的局部静态审阅结果见 [独立报告](../evidence/review-fixes-20261028/final-review-v33/REPORT.md)；播放/暂停、输入暂停及自动停点须在后续同一冻结版真实复测，本票保持开放。

## candidate-v37 版本绑定观察（2026-10-29）

本节绑定 [candidate-v37 manifest](../evidence/review-fixes-20261028/candidate-v37/manifest.json)。协调者真实浏览器操作记录 [v37-audit-ax.json](../evidence/review-fixes-20261028/coordinator/v37-audit-ax.json) 包含 `journey-29`、`journey-33`、`journey-34`、`journey-41`、`journey-49`，记录了从首次买入到最终退出的旅程节点。独立审阅者只对协调者采集的对应截图作静态比较：[33 根](../evidence/review-fixes-20261028/coordinator/v37-journey-33.jpg)显示停在下一笔成交前；[34 根](../evidence/review-fixes-20261028/coordinator/v37-journey-34.jpg)显示加仓；[41 根](../evidence/review-fixes-20261028/coordinator/v37-journey-41.jpg)显示部分退出；[49 根](../evidence/review-fixes-20261028/coordinator/v37-journey-49.jpg)显示退出与评价面板。报告 [final-review-v37](../evidence/review-fixes-20261028/final-review-v37/REPORT.md) 将这些称为局部静态观察，不是独立交互验收。

这提供了协调者实际操作过各目标节点、并有对应画面的证据，但不能据截图推导逐步/自动播放全程的停点契约、每根未来信息截止、视野/返回链或无误触；独立审阅者未独立运行图表。v10 的箭头/标签遮挡 FAIL 与 v33 播放提示失同步历史均保留，不以 v37 截图自动关闭。需同一冻结版核验节点操作和状态一致性，本票仍 open / acceptance-failed。
