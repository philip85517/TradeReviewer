# Task3v — root 验收记录（进行中）

本片只处理已批准的 E01、E03 现有 Text、E04、E19/E20 与唯一旧入口布局和接线。功能、实际持久化、非作者同态视觉独立判断。完整回放、工具、holding Text、计划、导出、V 与 95% 仍未接受；触屏、窄屏和小时按用户排除。原 FAIL 不覆盖。

## 冻结与根审查

root 已完整读 `task3v-implementation-report.md`、八文件 before-relative diff、raw before/after 和实际源码相关上下文，并逐项核对内容 SHA。after manifest：`6c278a719ee82776ccdec94c0252f9009b58262872a3192dec41344c393da185`；完整 diff：`3fed6c3ef5ff9414a8f6bb0a6e0b79ab30a159e142c060e99e1be03621ff74d3`。

root 生成严格八路径 `task3v-after/root-SHA256SUMS`，SHA `58edbae9fbdd87ae4e6a1bb91c75d03466b4e723597c311444f868f52457d62c`；Canvas width-repair1 纯两路径 manifest SHA `8d128d7003422e92cda8cdbbecdf774b264efabb2dae69f973d2040019ee1d86`。两个集合不重叠；覆盖旧 A02 成功版本的精确38项，最终闭包为42项。

结构差异限定为一个 Entry 所有的 ReactNode、与真实回放一致的 ready/身份条件、头部完整名披露、左列现有 Text、权威状态与只读提示、局部 CSS。controller、请求体/CAS、Canvas、图表 props、后端未改。`处理中` 是权威 busy 的诚实概括，不把它记成完整 E20 动作鉴别已交付。长 source、Text 图标密度和旧高度预算留待实际图判断。

## 隔离 seed（root 实际执行）

服务 `http://127.0.0.1:3448/`，PID670，当前 worktree；显式私库 `/var/folders/35/254l_pjd3176pndzmz5_2l4m0000gn/T/b01-ui-root-oI2Hs6/fixture.sqlite`，Node26 / schema22。没有访问业务库或其他端口。

root 完整读候选 `task3v-root-seed-candidate.mjs`（SHA `f2d62cedda7791a7bf28b21dc7f4c7b50c048526adfba117cd4b14b06a6fa1e2`）后执行两份新长中文样本。每份先 GET 确认身份不存在，再按六个固定公开请求创建，不直接 SQL 写、不重置已有样本。结果 `task3v-seed-first/result.json`，SHA `49b3bfdfb7d9cc2c7fae5637b03926fbc119538d6ef9708ba213691fd14f8893`：PASS，12 calls / 2 samples，42源前后相同，70表 schema 与全部原有行保持。

| 角色 | 练习 | 视口 | 当前结论 |
|---|---|---|---|
| long-title-1440 / 600360 | 23975b04-5cb8-4b0e-b226-e471c2be23fd | 1440×900 | seed PASS；浏览器待执行 |
| long-title-1280-faults / 600361 | 5eef5e52-8f80-4321-8b4e-3792d200ed33 | 1280×800 | seed PASS；浏览器待执行 |

## 独立门槛

非作者 `capital_diagnosis` 已直接读原参考，并报告默认定向43项 + native8通过、ESLint0错误/1既有警告；最终独立报告和实图仍待收口。根未把作者或子代理报告作为产品已交付。浏览器候选尚 HOLD，等待最终原生标题/旧入口/焦点/T/取消增量完整审查后执行。7组局部控件库存与证据要求见 `task3v-independent-review-preparation.md`，覆盖结果尚 NOT VERIFIED。

当前为第1次视觉修复，首红→定向绿是实际进展；连续无进展0。STOPPED Recall 案例/文件/全套仍不运行。

## 首次实际浏览器（原 FAIL 保留）

root 已完整审读最终88行候选 `ff0ebcd3e874f7d7d7e055b93626202090b353254f2c5d7edac257a810d698aa` 后执行1440首run。结果 `task3v-browser-first/result.json`：FAIL，旧页返回焦点 false/BODY；5张真实PNG，0 journey 命令/1正常bind、0 blocked/pageErrors、42源前后相同、70表原行及13不可变表保持。真实长名 Tab/Enter 开闭和可见全文局部通过。正文保存与播放在此失败前未执行，仍 NOT VERIFIED。

root直视A图和原02：默认header147.296875px、chart499.703125px，Text按钮36×48四中文折两行；全局heading column级联、source重复长名挤占紧凑头部，3V01/02视觉FAIL。非作者已独立直接比较，报告追加中。3V04根因已明确为workspace卸载整个Entry导致局部ref丢失，精确三文件首修见release/map。当前修复有新进展，连续无进展0，不重置或重seed样本。

## Focus repair1 and visual repair2 actual root readback (latest)

3V04 scoped ACCEPTED: root focus-only result a46a1989e16feb53167a91d81f765c470e7beaefd356a2f8274e571b315f7b6e, native actual returned BUTTON; 0journey and2bind-command receipts only; independent report preserved original then corrected timing after approved3 visual changes. Original BODY FAIL retained.

Current visual three SHA manifest b7495552a6361a068e3c266073bbedf02487e71003f7d8c5398bb98d045813b7. Root FULL before-relative repair2 diff read and all raw/current3 verified. Actual1440 result 08ae7e284d60a3a2d023fc1495079d266d242630e040ebc6eba15dd205686553: A controls/title/legacy/16/220 actual SAVE and actual recall document tuple+return/reload pass; old Text same original id/anchor cancellation pass. Root directly viewed actual A and exact02 reference, header49/Type36; whole visual not passed. Actual1280 result retains all pending/failure/retry/write evidence and overall FAIL. Both fail at nativeblur measurement, not proven application defect: bgStart.findLast selects buy repaint after blur (4880.2ms), draw4899.5ms, doubleRAF4920.8ms focusedfalse. Need freeze pre-switch eligible actual painted scene; continuation must use same persisted B and safe RECOVER, never reseed or rewrite original evidence.

3V06 separate first-mount chart FAIL now open: actual49 known K but4visible+large blank. Root standalone actual pinned SDK probe script and result prove conditional earlier-fit mechanism exactly [45,99] vs[-3,51]; this is SDK experiment, not a direct trace of the original app frames or app acceptance. Exact2-source repair1 released and mapped before dispatch. This new failure prevents whole visual acceptance. Task3b remains HOLD; full V, other tools,95%, business DB switch not accepted.
