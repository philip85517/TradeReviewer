# S 恢复修复报告：implementation-ready，等待独立验收

日期：2026-10-23。模型：gpt-6.1-sol / ultra。原任务及历史3轮 FAIL 保留；本次是原 S 的恢复修复，不是新票。本报告不是接受记录，恢复验收仍由协调者从 0/3 开始。

只改 `app/lib/reviews/homepage-v25-state.ts`、同名测试，并新建本 S-fix 目录。没有修改旧 evidence/S、S-debug、F、产品 UI/workspace、shared types、依赖；没有启动服务、访问业务 DB、运行全量测试、提交或推送。原诊断 [ROOT-CAUSE.md](../S-debug/ROOT-CAUSE.md) 的 H1 是本次单一修复假设。

## 1. 实际修复

1. snapshot 成为唯一 committed UI，applied 从 scope+attachments 派生。global 成功分别投影 scope 与 attachments，不再把完整 applied 塞入 scope。draft/desired 只管待应用选择，旧标题及条件保留至成功。
2. 共享 normalizer 验证并显式重建所有嵌套 UI 字段。编码深投影，解码严格验证；恢复、提交、scope/request key 复用这些节点规范化。集合归一化与固定字段次序消除键的属性次序误差。业务对象不进入编码。
3. snapshot v2 完整记录 history 范围选择语义与四 chartMode；贡献 current/history 独立 view，current.openOnly 独立于全局；删除共享 selectedMarket/selectedSymbol 双权威。旧 v1 因缺语义无法无损迁移，明确 unsupported-version；v2 缺字段/坏值明确拒绝。
4. global/period/history 三个请求域，递增 generation + 完整语义 key。日期域不互相覆盖；全局及日期依赖变化使旧 token 失效。失败、超时、取消、错误 payload 都终结 token，只有显式 retry 新编号才能提交。带 accepted 的完成接口给 P1 原子提交匹配数据。
5. 独立有效日期草稿编辑、取消回 committed；筛选关闭保草稿，清附加/恢复默认保日期，改身份清旧附件草稿；未提交的新草稿不被旧成功结果抹掉。
6. 全账户 * 不受真实账户目录误拒；空项/mixed/未知 concrete ID、重复参数、非法日期及证券显式失败。导航只投影目标字段，无 queue。应用对象作为 Scope 结构子类型仍可序列化，attachments 不混入 URL。
7. 完整恢复构造器清所有请求；同一 owner 可传 previous 保 generation 单调，防止恢复后与旧 token 碰撞。保留精确来源触发 ID 与容器标题 fallback，避免 holdings 来源误用搜索触发点。

## 2. TDD 与新鲜验证

使用固定 Node：`/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node`，`v26.0.0`。先新增完整链红测并保存日志，才替换产品实现。测试期望手写，不用被测 normalizer 构造预期；通过实际公开动作→提交→编码字节→解码→恢复断言。

|证据|结果|绑定与说明|
|---|---|---|
|[red.log](red.log)、[red.json](red.json)|35 FAIL / 26 PASS，退出1|产品源仍为原 a028…；复现真实缺陷与缺 API|
|[green-initial.log](green-initial.log)|61 PASS|首次 H1 修复后的中间版本，不作为最终冻结证据|
|[red-compatibility.log](red-compatibility.log)|1 FAIL / 61 PASS|真实 root 消费方式 Applied→导航被 strict Scope 误拒，先加反例再修|
|[red-focus-date-drafts.log](red-focus-date-drafts.log)|2 FAIL / 64 PASS|发现跨容器搜索焦点及缺少日期编辑 API|
|[red-live-restore.log](red-live-restore.log)|3 FAIL / 64 PASS|额外证明活跃 owner 恢复后 generation 可能重用；与前两项一起修复|
|[green.log](green.log)、[green.json](green.json)|67 PASS，退出0|最终冻结版本，历史4范围×4图模式含16次完整应用恢复组合|
|[neighbors.log](neighbors.log)、[neighbors.json](neighbors.json)|3文件 / 91 PASS，退出0|S 67 + dashboard preferences 5 + library browse 19；只跑有直接合同关系的邻居|
|[root-six.stdout.txt](root-six.stdout.txt)|6/6 PASS，退出0|原 coordinator-round3.mjs 原样运行；原5 FAIL均通过|
|[boundaries.json](boundaries.json)|定向严格 tsc、ESLint 退出0|只包含本模块和测试，stdout/stderr 为空|

命令（仓库根目录，NODE 表示上面完整固定路径）：

```sh
NODE .scratch/homepage-v25-implementation/evidence/resume-2026-10-23/S-fix/run-checks.mjs red
NODE .scratch/homepage-v25-implementation/evidence/resume-2026-10-23/S-fix/run-checks.mjs green
NODE .scratch/homepage-v25-implementation/evidence/resume-2026-10-23/S-fix/run-checks.mjs neighbors
NODE .scratch/homepage-v25-implementation/evidence/resume-2026-10-23/S-fix/verify-boundaries.mjs
```

每次 runner 的 JSON 保存完整 executable/args、退出码与 SHA256。red-* 同一个 runner 用不同 mode 保存，均未覆盖原 red。Vitest 的 `module.register()` deprecation 来自现有环境，退出0；没有更换 Node/依赖绕过。

最终源冻结 SHA256：

|文件|SHA256|
|---|---|
|homepage-v25-state.ts|`ddceb3cb717d83431605fdbe2764c9d619321f883b8fbd7234bea3897aaafc1b`|
|homepage-v25-state.test.ts|`25c0af4452056c1763017a96f76fe45fd5a375159dde10013b98c32a80b19a68`|

GREEN、neighbors、root-six、tsc、lint 均绑定这两个最终 hash。后续仅新增报告，不修改产品源码。源冻结复核及只读对照见 [source-freeze.json](source-freeze.json)。

## 3. 合同覆盖与尚待 P1

前端审计触发为状态/持久化数据接线变化；此次限定纯模块修复，未交付页面。下面 PASS 只指固定 hash 的纯合同；浏览器/真实数据/视觉独立门槛没有被这些测试替代。

|诊断矩阵 ID|本次纯模块结果|外部责任与剩余状态|
|---|---|---|
|S01|PASS：非默认附件成功→原始快照合法→编码→完整恢复，scope 不含 attachments|真实 storage/刷新/返回：P1 NOT VERIFIED|
|S02|PASS：8个父节点、贡献两子节点污染剔除；非法已知值拒绝；缺字段拒绝|真实业务数据来源与存储适配：P1 NOT VERIFIED|
|S03|PASS：4范围×4图模式恢复，current period 不变|真实图数据/交互与视觉：P1/P4 NOT VERIFIED|
|S04|PASS：两贡献 view、局部 openOnly、市场/证券路径往返且无共享 selected 权威|实际 market row→证券列表→详情及本地交互：P4 NOT VERIFIED|
|S05|PASS：属性/集合顺序等价成功；错误 target 同 token 拒绝；完整依赖改变失效|实际查询使用完整 token target：P1 NOT VERIFIED|
|S06|PASS：旧代、失败/取消/超时晚结果、retry、日期并发两序、身份与日期依赖失效|实际 AbortController/timer/整组数据与标题原子提交：P1 NOT VERIFIED|
|S07|PASS：关闭保草稿、清附加、默认保日期、改身份清附加且不提前改 applied、日期取消只回本域|真实 Esc/外点与弹层重开：页面 owner NOT VERIFIED|
|S08|PASS：*+真实/空catalog、未知/空/mixed/空项/重复参数拒绝|已删除账户的纠错提示：P1 NOT VERIFIED|
|S09|PASS：all/date/custom、倒置/不可能/空日期、非法 symbol、market warning、无 queue、URL 与来源分工|真实直达/到达即 applied/成交日包含 open：P1 NOT VERIFIED|
|S10–11|纯 scope/URL 部分 PASS|普通交易库、复制/刷新、来源重读：P1 NOT VERIFIED|
|S12–13|PASS：完整来源 UI、搜索 query/scroll/selection、精确 trigger 与缺对象 title fallback|真实对象消失、页码 clamp、DOM focus、搜索→详情→库→返回：P1/P3/P4 NOT VERIFIED|
|S14|PASS：坏 JSON、旧版本、缺字段拒绝，恢复无活跃请求，live restore 代数不复用|SSR/storage getter/read/write/quota、hydrate/显式返回优先级：P1 NOT VERIFIED|
|S15|不适用本次纯层执行|页面功能、持久化、1440/1280视觉、鼠标/键盘/触屏全仍 NOT VERIFIED|

## 4. P1 接口交付

详见 [INTERFACES.md](INTERFACES.md)：完整字段/更新域、每个编辑与请求动作、accepted 数据原子提交例子、来源捕获/实际期间到目标 URL/解析/返回恢复完整例子、v1 明确拒绝与活跃 owner restore 用法。

关键限制：模块不读取业务目录；P1 在直达/恢复时必须提供真实 allowedAccounts/allowedSymbols 并明确处理失效对象。模块不重算“本周/月/年”和“今年”业务日；snapshot 记录最后成功的实际范围，P1 算新目标并成功载入后再替换。输入中的非法/未完成日期原文留在弹层本地，不能提交到 canonical UI。分页随真实结果的校正由页面负责，decoder 不静默扩大/清空条件。

S 状态：**implementation-ready**。等待协调者固定版本独立验收，不自行推进 P1。
