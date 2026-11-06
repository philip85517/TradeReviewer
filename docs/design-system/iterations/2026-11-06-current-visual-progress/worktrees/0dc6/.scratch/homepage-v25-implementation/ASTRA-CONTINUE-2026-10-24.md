# Astra 并行续推 — 2026-10-24

用户要求新的 Astra 并行推进设计、修复，必要时重构 Implementation。实际新代理模型 `gpt-6-astra` / `ultra`；旧三个代理已不在 live inventory。承接已有工作，不重置验收轮数。采用 codebase-design 的 Module / Interface / Seam 语言及 systematic-debugging 的证据先行流程。

## 文件所有权与验收

| owner | 工作与写面 | 原合同、需求与证据 | 轮次与禁止项 |
|---|---|---|---|
| /root/astra_finance | 承接 seam candidate3；仅 F 源码/测试与 market/providers/errors.ts/errors.test.ts 和新候选证据 | `evidence/P4/seam/ROOT-CANDIDATE3-DISPATCH.md`、原 DESIGN-COVERAGE 的财务需求；已完成12 paired/4 profile | 2/3 FAIL，第三候选最后一次；不改阈值，不自行正式性能采样 |
| /root/astra_source | 承接 S1 四新文件，核对并完成候选1；后续接线只设计 | `evidence/P4/ROOT-DATA-CONTRACT.md`、issues/08；HV25-06..22、32..43、47..51 的原稿/图像/旅程/证据保持 | 0/3；不得接入未接受财务到页面，不改共享 host/Workspace/Surface |
| /root/astra_integration_design | 只读检查 source→producer→三域host→Workspace→Surface 的 Module 深度、真实断点，形成可执行设计及风险清单 | `evidence/P4/PRODUCER-IMPLEMENTATION-DESIGN.md`、ROOT-DATA-CONTRACT、原 DESIGN-COVERAGE/批准原稿；证据 `evidence/resume-2026-10-24/astra-integration/` | 不改产品或旧证据；root审查后才释放唯一owner实施，Bars 3/3暂停不能绕过 |

Root 仍为整页视觉、跨 Module 数据/持久化流及逐项独立接受负责人。实现者自测不等于接受。P1 2/3、Metrics 2/3、Stats 1/3、Chart 1/3、Bars 3/3暂停全部保留。S1纯 Interface 可独立接受，但不得冒充首页接线完成。

性能正式复验由 root 在全体进入 QUIET 后按原9 fresh样本固定运行一次。数据库、依赖、配置、旧证据受保护；不推送/合并/发布。重构限已经授权需求，优先隐藏共同规则、减少调用方必须理解的事实；不增加仅一个 Adapter 的虚构 Seam，不重造财务账本。

## 2026-10-24 F07 + chronology single-owner implementation release

Root authorized `/root/astra_finance` to implement the original F07 14-product/17-test manifest plus chronology tests only in homepage-v25-performance.test.ts. Exact contracts, dependency gates and evidence: [dispatch](evidence/resume-2026-10-24/source/qualifier-repair/F07-ROOT-IMPLEMENTATION-DISPATCH.md). F07 remains P1 2/3 FAIL final candidate preparation; representation remains 1/3 FAIL, next round2. Invalid calendar/inventory chronology must be consistently unknown; valid cost-unknown market value and future/cutoff behavior preserved. Root real-chart gate precedes Recall/editor expansion. Catalog six-file source work remains disjoint; period UI design only. No new acceptance budget, business data writes or Bars fourth attempt.
