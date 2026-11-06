# 2026-11-06 跨 worktree 视觉资料本地整合

> 本页是 02:27 本地保全记录；后续补齐、当前有效规则、推送与 PR 状态请从[最新完整入口](../2026-11-06-current-visual-progress/README.md)读取。下文“未 push／未合并”和文件数量均绑定当时版本，保留历史不改写。

用户要求比较视觉规范的时间与当时聊天，将尚未进入 master 的内容 cherry-pick 到本地。整合分支为 `codex/visual-specs-consolidation-20261106`，基底为 `d95afc37d30f817edbd6daab41e85f485138de0d`。本次范围是视觉文档、静态原型、评论、设计契约和对应证据；产品组件、后端、数据库与并行开发修复仍在各自源分支。本地整合不表示规范获得用户批准，也不表示进入 master。

## 选择结果与最新决策

时间均为北京时间。聊天记录由各独立 Agent 通过 Codex app 读取；逐字依据、时间口径与读取限制保存在下方 provenance，不能以文件 mtime 代替用户决定。

|内容与来源|决定／版本时间|本地处理与状态|
|---|---|---|
|首页公共 V2.5；0dc6／38a0|10/22 已随 PR40 进入 master；11/4–11/5 聊天重点是数据与性能|复用 master 包；另保全首页执行视觉契约。策略 V1.2 对公共库的 SW 增补改变 5 个现有文件，不能说整个 V2.5 字节未变|
|交易库视觉 V2.0；25db|10/26 已随 PR41、PR42 进入 master；11/4–11/5 新决定主要是业务口径|原规范包不改动；只纳入从属执行视觉契约及来源清单。旧执行范围不覆盖用户较新的范围排除|
|策略 V1.0 → V1.2；b387|10/22 23:50:25 要求 V1.0；10/24 00:55:11 要求从零重写；**10/24 01:24:04** 要求公共风格对齐、独有组件补入公共部分并形成 V1.2|完整保全 [V1.2](../../baselines/2026-10-24-strategy-workbench-v1.2/README.md)、[SW01–08](../../shared/strategy-workbench-v1.2/manual.html) 与 [V1.0](../../baselines/2026-10-22-strategy-workbench-v1.0/README.md)。10/24 02:16:30 是助手静态设计交付时间，不是用户批准或产品验收|
|复盘正式 V1.0；80b0|10/24 提交 `270aad42`；用户要求原型先确认，再把一致内容写入正式规范|完整 cherry-pick 正式包；[正式正文](../../baselines/2026-10-22-review-workspace-v1.0/visual-spec.html) 不因本次保全升级为 V1.1 或已批准|
|复盘 candidate45、direct-text v5、identity；80b0|**11/6 01:21:28** 用户取消 Text 重叠专项自动避让；identity 冻结时间 01:49:56|当前原型保持 candidate45；direct-v5 与 identity 独立保存。identity 待用户审阅，实际输入断点仍 NOT VERIFIED。旧重叠 FAIL 保留历史，但不再单独按已取消要求阻断，也不能改写成 PASS|
|0ff3 首页 v0.1/v0.2 及旧执行契约|10/8 撤回旧推荐；v0.2 最后 HA09 有限接受为 10/10，整体仍 OPEN|6 份原文放入 [0ff3 历史目录](history/0ff3/)，不覆盖 V2.5|
|f42e 策略旧稿、契约及视觉证据|9/30 14:27:41 要求融合；14:45:24 由 V1 接管；**14:50:15 明确只推 feature、不合并**；后续 10/6–10/7 静态稿|637 文件放入 [f42e 历史目录](history/f42e/)。不 cherry-pick 含产品实现的整个旧 feature，不把旧候选升级为当前规范|
|master 工作区未跟踪 B2 hover 旧稿|9/25 文件名所示历史版本；未观察到其取代当前规范的用户决定|原文放入 [master 历史目录](history/master/)，只作追溯|

对应真实聊天：

- 策略：`01a1644e-6c21-7923-9b4d-6d8de8c4fbc5`「策略台迭代设计规范」；`01a169af-0928-7c63-a18d-fe50738368f2`「策略台迭代设计规范 (2)」；`01a169c8-9e52-7340-bd57-b089c6402947`「策略台迭代设计规范 (3)」。
- 旧策略：`01a0efc6-b48d-7e80-8598-2a3b6a315218`「策略工作台迭代V1 (2)」；`01a11044-27bf-7900-9305-240719683dcb`「策略台迭代 （待定）」有早期单轮超出读取上限，未声称读到该轮用户原话。
- 复盘：`01a16c13-5390-7c20-8813-774eabac4581`「复盘页视觉规范V1.1 （2）｜规范开发中」。10/24 12:02:48 为建聊时间，初始请求来自元数据预览；11/4 修复授权按 turn 起始时间记录，未虚构该 turn 内第二条消息的独立时间。
- 首页与交易库：`01a1a757-3109-77f2-a7de-7b118f47189f`「首页数据库优化 ｜ 开发中」、`01a18814-7717-7c42-963f-210cf0b61bbb`「首页读取的性能优化方案 (2)」、`01a1919c-5e22-7a63-b9c0-4eed2ff7abff`「交易库V2.0 开发 ｜ 开发中」。

## Git 提取方式

|源提交／快照|整合提交|内容|
|---|---|---|
|`270aad42cb807773e716249deb04b03bf53a1e4e`|`ff82d354`|203 文件正式复盘包；唯一索引冲突保留 master 的交易库 V2.0 当前地位，追加复盘提案入口|
|`3b5c2ccfb889bc65e469d88d7c434fe55e347cba`|`265ee123`|b387 限定快照：392 文件，17,285,815 字节|
|`39645f102c3d630c8d4870ea677c98008501da8a`|`7588bc57`|80b0 最新限定快照：1,110 文件，126,506,356 字节；覆盖正式包的现有资料并补齐冻结候选和证据，不删除原正式包历史|
|`32f66f54a5aad31cb77be3e7e39d0b4cfc7057ce`|`45ee60c7`|647 文件，50,619,182 字节；3 份从属执行资料、6 份首页历史、637 份旧策略历史、1 份 B2 旧稿|
|`1cefa26776e3d30a2726ad659ef84dfb84c9f603`|`be219d55`|3 份文档增量：采集期间补充的模拟输入／实际输入区分和 Text 拖动能力限制；33,053 字节，不涉及候选代码|

尚未提交的源文件不能直接用原分支 HEAD cherry-pick：先通过独立临时 Git index 将选定文件封成可追溯快照提交，再 `cherry-pick -x`。源 worktree 的 HEAD、index、未提交文件均未被重写。快照 ref 为 `refs/codex/snapshots/visual-specs-20261106/{strategy,review-current,supporting-history,review-decision-clarifications}`。逐文件清单记录绝对源路径、目标路径、mtime、SHA256、Git blob 与大小；冻结的是采集时版本，源聊天仍可能继续更新。本次最新限定增量截止 **2026-11-06 02:27:19 +08:00**，不是实时镜像；后一个快照仅取代前一份复盘清单中对应的 3 份审查文字，前后快照均保留。

原 e7e8 分支 `codex/worktree-consolidation-20261105` 保留在 `906ac6e1`；本次复用现有 worktree，没有新增长期工作目录。master 与 origin/master 保持 `d95afc37`，未 push、未合并。

## 使用与检查边界

复盘当前入口为 [workspace-v0.1](../../baselines/2026-10-22-review-workspace-v1.0/prototypes/workspace-v0.1/index.html)。三个候选的防覆盖 SHA256 前缀分别为 `0504ece6`（45）、`f18728ad`（direct-v5）、`71803b71`（identity），完整值见 [review-selection](provenance/review-selection.json)。不得凭文件更新时间把 identity 替换为默认版本。

历史资料按原始字节归档，目录内部的旧相对链接仍保留原语义，**历史区不是独立可运行站点**。查阅某个归档条目时，先在 [supporting-history-manifest](provenance/supporting-history-manifest.json) 按 `destination` 找到绝对 `source`，再结合旧分支与原目录解析其引用；没有纳入本次范围的产品文件、原型运行依赖及所有旧候选不自动补入。保留原文比改写旧证据更优先。

V2.5 的 5 份增补文件与 b387 原文一致。独立审查发现重建后 21 个旧 block ID 变化；现有 532 个 block 与 identity、HTML 一致，评论文件与 master 同字节且当前无评论，未发现现有评论孤儿。外部书签或旧 block 引用兼容性仍 **NOT VERIFIED**，本次不擅改原锚点或宣称兼容已通过。

本次只接受资料整合的完整性、字节保真、范围及版本隔离。UI 功能、真实浏览器视觉比对、交互与数据库验收不属于本次范围，不沿用旧报告为新实现背书。

逐文件来源与筛选依据：

- [策略快照清单](provenance/strategy-manifest.json) · [策略聊天与筛选](provenance/strategy-selection.json)
- [复盘快照清单](provenance/review-current-manifest.json) · [复盘聊天与筛选](provenance/review-selection.json)
- [复盘最后三份证据口径澄清](provenance/review-decision-clarifications-manifest.json)
- [历史与从属契约快照清单](provenance/supporting-history-manifest.json) · [首页筛选](provenance/home-selection.json)
- [最终整合接受记录](FINAL-ACCEPTANCE.md)
