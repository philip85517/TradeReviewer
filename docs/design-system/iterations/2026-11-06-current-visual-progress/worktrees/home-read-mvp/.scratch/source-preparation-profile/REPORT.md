# 候选 01：交独立审查，尚未测量真实副本

这轮已把只读分段工具和合成验收做成可冻结候选。没有读取、hash、复制或 SQLite 打开真实 seed/source.sqlite，没有新性能结论；最初 7.3 秒的内部根因仍 UNKNOWN。只改本目录，产品、旧实验、正式业务库、3333/4393 服务未操作。状态是 implementation-ready，独立接受和真实执行批准仍待协调者。

## 已验证

- 17/17 合成测试通过，原始日志见 `evidence/final-tests-05.txt`（前一次完整回归 `final-tests-04.txt` 同样通过）；这是测试套件耗时，不是来源准备耗时。保留最初四轮 RED：6 个缺失护栏/计时行为、1 个插桩行为、2 个入口行为、2 个实际 CLI/审批文件行为；早期 final-tests 与所有早期 GREEN 保留。RED-04 同时揭示 clone fixture 下相对输入身份不一致，已改固定仓库相对身份；非真实数据失败。
- 真实产品读取及解析入口运行于本目录独占创建的合成 SQLite。1003 条合成成交、两页；两种模式的原始结果分别通过真实合同，之后 owned payload 的完整归一化 SHA 和 1,293,743 字节一致。未插桩 spans=0，插桩 51 个 coarse spans；关键阶段出现次数精确核对。raw wall/CPU、模块加载/开库/完整性校验、noop 校准均在 `evidence/synthetic-04.json`。字节数为归一化完整内容编码，非原始 HTTP wire 大小。这些数值仅验证工具，不用于推测真实数据表现。
- 固定 SHA、静止 stat、路径/非空 WAL/SHM/journal、审批绑定、父子 inclusive/exclusive、结果目录独占和 result `wx` 测试通过。新增/改动/不安全/重复源码路径、产品或支持文件变化拒绝。
- 实际 CLI 子进程在复制的合成工具目录验证：有效 `--check` 不加载带 DB sentinel 的 runner；缺审批的 `--measure` 拒绝；冻结后修改 runner 时，`--check` 与具有匹配审批的 `--measure` 都先报 TOOL_HASH，sentinel 未执行。不是仅用串行函数调用模拟此门禁。
- 新增独立预审反例：tsconfig.json 绑定安装/编译配置身份；CLI 和 direct-import 都共用 gate。直接导入缺审批、额外 path 字段、冻结代码或 tsconfig 改动均在固定源复制、Vite graph 加载和 SQLite constructor 前拒绝。sample/moduleGraph 不公开，合成入口拒绝参数和 symlink temp；子进程用 SQLite constructor sentinel 与新私有目录未产生佐证。RED-05/06/07、GREEN-05 与全套回归保留；RED-06 首次 undefined 参数属于测试 harness 错误，修正后保留有效缺口反例，见 ROOT-CAUSE.md。
- 安全复制合成测试：固定源 SHA，源父目录 0700/文件 0400，空 WAL 与非空 SHM 均拒绝，符号链接/SHA 不符/宽权限拒绝；目标专属目录 0700、文件 0400，wx 且冲突拒绝。源/副本 SHA 和 stat 静止、无 sidecar；没有 SQLite 打开源。这里只复制明确合成字节，真实 seed 仍未读。
- 普通 readOnly WAL 读取会创建 sidecar 的负例保留于 `readonly-uri-investigation.txt`。最终合成运行以 immutable URI+readOnly+query_only 打开；实际写语句只在合成测试尝试，必须收到 SQLite errcode=8（READONLY），不是任意错误都算通过；来源读取/解析前后主文件和 sidecars 不变，未创建 sidecar。
- 只对顶层 receipt 的 receiptId/knownAt/payloadDigest、各页 snapshot receipt 的 receiptId/knownAt、page payloadDigest 归一化。snapshot receipt.payloadDigest 保留；业务嵌套同名字段及 snapshot 数据摘要变化会导致 SHA 不同。原值不被改写来绕过真实合同。

测试发现的依赖警告 DEP0205（Vite `module.register`）保留，没有屏蔽。输出不含交易明细、名称或账户；错误只有安全枚举/通用抑制说明。没有 CPU/heap profile 文件。17 项仅为本实验 scoped suite，不声称产品全套测试通过；未修改产品，不运行可能超出此隔离范围的完整 npm 测试。合成 fixture 文件包含明确合成值，留在本目录 tests/tmp 独占路径，供审查追溯；不作为真实证据。

## 计时和内容边界

source.read 包含原 SQL/映射、投影、页与整包编码/摘要、shape；contract.parse 包含 owned clone、结构检查、WebCrypto 和逐页 digest/selection 检查。更细 probe 见 instrument.mjs 精确锚点。SQL 与 getter 内的行映射未进一步拆开；facts 解码/日期排序等落在 materialize residual。noop 仅用于暴露探针开销的数量级，不能从总时间准确扣除。

baseline 的产品源码不插桩，外部仍有总/来源/解析计时；profile 增加子阶段探针。每个样本顺序运行、fresh connection 与 fresh Vite graph；依赖的进程级/JIT/OS 缓存并未清空，不能称每次冷启动或独占环境。异步 WebCrypto 的进程 CPU 区间也可能包含其他进程内活动，CPU 不等于某函数独占占用。父子 inclusive 不能相加当总时；self 残差含探针、闭包和未标记逻辑。

模块加载、输入 SHA/static 校验、开库、归一化完整内容核验都在本次来源+解析总时之外单列。计划把真实 seed 文件复制耗时/复制前后校验单列（本轮尚未执行）；产品计时不含初始持久化投影构建、摘要发布提交、首次产品页面读取、浏览器/网络/HTTP/渲染。首对只叫首次观察，不叫 OS 冷缓存；计划仅 3 对交错 B/P、P/B、B/P，无稳定 p95、SLA 或首页一秒结论。此工具诊断原入口，不能完整重演原 7312.530 ms 的 harness 总时。

immutable=1 只适用于固定 SHA、所有 sidecar 均不存在、静止冻结副本。它绕过 SQLite 的锁/变更检测，不适用于活动业务库；前后检查能发现合作环境中的持久变化，但不抵御恶意时序替换、临时写入再恢复。真实输入当前仍 NOT VERIFIED；旧 run-02 副本非空 SHM 保持拒绝、未处理。获独立接受与协调者批准后，只通过只读文件句柄复制固定 seed 至本实验私有目录，再 immutable 打开副本；不通过 SQLite 打开 seed，不使用产品业务路径。固定 seed SHA 引用旧冻结记录，施工/审查期间未重新 hash。

## 冻结与证据身份

SNAPSHOT.json 绑定严格工具 `.mjs/.js/.ts` 清单（含测试/冻结工具）、SUPPORTS 清单中的明确支持文件、app/lib 与 db 的非测试 `.ts/.mjs` 产品源、tsconfig.json、锁文件、直接依赖安装 manifests/可解析 entry。CLI 与公开真实测量/复制函数共用门禁，测量前及发布 PASS 前均复核身份，持续变化导致拒绝；不声称抵御检查间隙的恶意替换。支持身份保证文件未变，不证明其陈述一定正确。锁和入口不等于安装树所有传递 chunk 均逐字校验；本实验信任已装运行环境，无 package install。SNAPSHOT 不自哈希；协调者须与聊天交付的外部 snapshot SHA 比较。

issue.md、results、reports、private-inputs、tests/tmp、Vite cache 与后续 post-freeze receipt 不入支持冻结：前者跟踪/后者运行产物，不能作为冻结证明；它们不提供入口代码。候选无审批文件，冻结不代表批准真实采样。freeze.mjs 使用 wx，已存在 snapshot 时失败，不覆盖候选。

## 复核与未来执行命令

均在 `/Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview`。

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node .scratch/source-preparation-profile/run.mjs --check
```

上述只验工具/产品/依赖/支持身份，不打开数据库，也不读真实输入。复验合成测试会创建新 tests/tmp 文件，不覆盖旧日志；若要保存新日志须新名称，不能重写冻结 evidence。

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node --test --test-concurrency=1 .scratch/source-preparation-profile/tests/core.test.mjs .scratch/source-preparation-profile/tests/instrument.test.mjs .scratch/source-preparation-profile/tests/product.test.mjs .scratch/source-preparation-profile/tests/entry.test.mjs .scratch/source-preparation-profile/tests/review-gates.test.mjs
```

真实采样命令（仅在独立接受及协调者批准后）：

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node .scratch/source-preparation-profile/run.mjs --measure approved-01 --approval /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/source-preparation-profile/approval-approved-01.json
```

协调者单独创建该审批文件，字段必须精确为：

```json
{"kind":"source-preparation-profile-approval-v1","approvedBy":"coordinator","snapshotSha":"<externally-reviewed-SNAPSHOT-SHA>","sourceSha":"176beaee3afe356984a3407f3ee99d276dd25862e2edc284eceafbbb9b6993e6","runId":"approved-01","pairs":3}
```

审批 JSON 限本目录内正规小型 JSON 文件。获批执行会先 wx 创建 private-inputs/approved-01/source.sqlite，再将成功汇总保存 results/approved-01/result.json；冲突拒绝；失败仅写不可覆盖的 failure.json。候选内部不生成审批，也不能自动把自测成功升级为真实运行批准。

## 尚未验证

真实 seed 执行时路径/hash/权限/sidecar 状态、私有复制与复制后的只读完整性、真实阶段耗时/热点/探针扰动、3 对真实内容等价、独立审查接受均 NOT VERIFIED。合成 fixture 的来源材料/旧 review/importHistory 集合为空，只证明对应阶段调用存在，不能证明其真实非空数据成本。未验证产品跨进程缓存/页面/财务正确性；不建议或实施优化，后续应根据独立批准的实际汇总再决定。
