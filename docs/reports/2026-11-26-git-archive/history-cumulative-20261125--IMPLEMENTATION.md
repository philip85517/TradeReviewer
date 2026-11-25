> 归档说明：以下为原验收时点的文本记录，不是本次重新验收。截图、数据库、日志及私有原件仅本地核查，不随 Git 分发；文中其文件名不是随附证据链接。

# 历史默认双曲线实现报告

结论：限定实现切片已完成，定向组件测试 34/34 PASS；真实浏览器、接口及独立视觉验收为 NOT VERIFIED，等待协调者独立验收，不能据此报告整个功能已交付。

## 范围与参考

- 工作树 `本地工作目录（本地核查，不随 Git 分发）`，分支 `codex/homepage-performance-data-optimization`。
- 实现者 `history_curve_impl`；按父任务指派执行，不再委派。协调者负责整页视觉、真实 API 数据链、构建及浏览器验收。
- 实现前已读当前项目开发流程、拆票规范、前端控件审计、UI任务模板，以及本目录 README / DESIGN-COVERAGE / PLAN / issue。
- 原始参考：`docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md` 第六节（349–387行）及 `source/images/history-stats-cumulative.svg`（1440×1000 SVG原稿）。双线为用户 2026-11-25 已批准变化。
- 本轮仅写 full-history.tsx、history.css、full-cutover.test.tsx 与本报告；修改前版本完整备份在 `evidence/pre-implementation/app/components/homepage-preview/`，保留所有已有 LI/G7/回合统计修改。没有改后端、业务数据、其他代码，没有提交或推送。

## 实现

- 默认 net 同时绘制蓝色各期、紫色累计。累计单线、胜率、回合指标保留；四卡、标题、绘图区高度与既有断点保留。
- 轴域取两线全部已知金额；绘制使用后端 net / cumulativeNet，未在客户端重加已显示/舍入的分期金额。
- 按每条线分别分段与绘点。无成交的当期线缺口、已知累计平延，未知累计缺口，未来两线无点；真实零可见。保留首次真实平仓前无活动期间的抑制，避免凭初始累计0制造趋势。
- 累计已知时不依赖当期 net 是否已知。两位小数提示及图点 accessible name 同时包含两金额；未知累计明确解释不可计算。
- 图例常驻标题既有24px行，各指标切换不增减图例行高；样式全部新增在 `.hp-history-real` 下，Mock 页面不采用新样式。桌面覆盖提示使用既有图表上方间隙（top -24px），清开图例；窄屏延续原静态反馈流。此空间安排仍须协调者实际截图验收。

## 正确性样本与测试

1. 两期各6000、随后 -0.01 / +0.01，后端累计6000 / 12000 / 11999.99 / 12000.01。累计超过单期轴域时所有点必须在绘图区内；最后累计12,000.01直接来自接口（不等于分期显示值之和12,000.00）。同时检查默认两线、图例、accessible name与单累计/胜率切换。
2. 已知0 → 无成交但累计0 → 当期未知但累计25 → 当期1但累计未知 → 当期2累计28 → 未来。累计前3点连续、未知断线、后续已知重新成段、未来无点；各期独立缺口。复用现有真实零/无成交/胜率/回合用例，只调整默认双线后的点线数量。

测试先红后绿（合成组件事件，不代表真实鼠标/键盘验收）：

| 命令 | 结果 |
| --- | --- |
| `./scripts/native-node.sh node_modules/vitest/vitest.mjs run app/components/homepage-preview/full-cutover.test.tsx`（实现前） | 24 PASS / 3 FAIL，预期缺双线、图例与独立累计系列 |
| 同上（首轮实现后） | 27 PASS |
| 同命令追加 `-t 'draws cumulative independently'`（未知累计说明补充前） | 1 FAIL / 26 skipped，明确暴露缺失说明 |
| `./scripts/native-node.sh node_modules/vitest/vitest.mjs run app/components/homepage-preview/full-cutover.test.tsx app/components/homepage-preview/complete-mock/history.test.tsx`（修正后） | 34 PASS / 2 files |
| 同上（协调者要求加强累计轴极值样本后，最终运行） | 34 PASS / 2 files，9.43s，exit 0 |
| `git diff --check` | PASS，exit 0 |

运行使用项目 pinned Native Node。测试输出存在 `DEP0205 module.register()` 弃用警告与 `Not implemented: Window's scrollTo() method`，没有将其改写为无警告通过。未运行全仓测试或负载；本轮无后端/请求规模变化，遵从用户正确性优先及限定验证范围。未自行构建或启动服务，协调者拥有运行环境。

## 分项门槛

| 门槛 | 状态 | 证据 / owner |
| --- | --- | --- |
| 小样本组件正确性 HC01/HC04 | PASS（局部） | 实际 FullHistoryPanel，34项相关测试 |
| 原 Mock 组件相关回归 | PASS（局部） | history.test.tsx，包含上述34项 |
| 类型 / 生产构建 | NOT VERIFIED | 协调者 |
| 真实接口累计末值 / 范围 / 市场状态链 HC02 | NOT VERIFIED | 协调者 |
| 浏览器鼠标及键盘 HC03 | NOT VERIFIED | 组件fireEvent不能替代实际操作；协调者 |
| 1280×720、901/900、600×900视觉 / 尺寸稳定 HC05 | NOT VERIFIED | 协调者独立看图；重点确认双线标题+图例空间、缺失反馈位置 |
| 数据持久化写入 | NOT APPLICABLE | 前端只读图表，无写入行为 |
| 物理触屏 / 软件键盘 | NOT APPLICABLE | 本轮明确范围排除 |

17项局部浏览器登记沿用 DESIGN-COVERAGE，由协调者填写真实覆盖率；本报告不以组件合成事件计入浏览器覆盖分子。不宣称页面或整个前端100%。

## 冻结指纹

最终组件测试完成后冻结，记录时间：2026-11-26T00:06:13.988573+08:00。

| 文件 | SHA256 |
| --- | --- |
| `app/components/homepage-preview/full-history.tsx` | `6eca37a3fc8a437550d7c75d397b6bd4d3f4386874b7c96664f5595f2466f113` |
| `app/components/homepage-preview/complete-mock/history.css` | `cf44ee74eb222e2d915ff387467caf5d2c0ac95e85ea7fc9f1df252de8eed3cd` |
| `app/components/homepage-preview/full-cutover.test.tsx` | `757b56bbadda98b9896d47130d4b207811744b9f6fd6882ce334c8e9b673e0fc` |

下一步：协调者针对上述指纹构建、实际浏览器验证与同态参考对照；有问题交回此文件唯一owner。无需新增用户决策。
