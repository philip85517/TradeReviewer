# Issue tracker: Local Markdown

用户已确认本项目使用本地 Markdown 工作任务，不发布到远程 issue tracker。

## 约定

- 每个功能使用 `.scratch/<feature-slug>/` 目录。
- 每个任务独立保存为 `.scratch/<feature-slug>/issues/<NN>-<slug>.md`，按依赖顺序编号，阻塞任务在前。
- 功能目录的 `README.md` 可作为索引，不代替独立任务文件。
- 每个任务包含 What to build / Scope、Refs、State、Status、Assignee、集成负责人、Blocked by、可勾选的验收标准、反例与证据；按需记录 Priority。使用 [拆票标准与模板](task-decomposition.md)。
- 已确认、可由 agent 领取的任务使用 `State: open`、`Status: ready-for-agent`、`Assignee: unassigned`；存在 Blocked by 时仍须等待所列任务被接受并关闭。`ready-for-agent` 不是完成。
- 发布任务即写入对应 Markdown 文件；读取任务时读取完整文件。
- 任务依赖使用编号和标题表达，不因优先级或共享文件而添加人为阻塞。
- 本文件只配置本地工作任务跟踪；不代表已经配置其他 triage 标签或代理指令文件。

## 所有任务的生命周期与验收状态

以下规则也适用于非 Wayfinding 票；Wayfinding 的地图、frontier、独立 Resolution 和领取规则保持如下节所述。

- `State: open|closed` 是生命周期权威字段；`Status` 描述工作情况。工作前重新读取并填写唯一 `Assignee`，并发会话先协调所有权。
- `ready-for-agent`：范围与验收已明确，可在依赖解除后领取；`in-progress`：负责人正在实施。
- `implementation-ready`：本票实现及适用自测已具备审查条件，尚未独立接受；`integration-pending`：等待与依赖或其他切片集成并验证。两者均保持 open。
- `acceptance-failed`：任一在范围内的验收失败，或必需检查仍未验证；记录 fail / unverified 的区别、证据及下一步，保持 open。
- `accepted`：协调者已独立验证本票 Scope 的全部必需验收，证据完整并签署。只有 `Status: accepted` 且有证据才能设为 `State: closed`；研究/决策票的证据可以是研究结论或用户真实决策。Wayfinding 仍需先保存并链接独立 Resolution。
- 每个验收勾选都链接到证据。局部票或 finding 的 accepted 不代表 feature accepted；功能整体接受须满足 [开发流程](development-workflow.md) 的完整旅程、状态安全及视觉门槛。
- `Blocked by` 依据所列依赖的 `State: closed` 解除，与 frontier 一致；合法关闭必须满足上述接受与证据规则，不能仅改字段绕过验收。依赖被重开时，重新评估下游契约与证据，不能沿用失效的接受结果。
- 后续回归同步将相关 issue 重开为 open / acceptance-failed，并更新功能 `README.md`、`DESIGN-COVERAGE.md` 和 `FINAL-ACCEPTANCE.md`（已有其他命名则使用原最终验收记录）。保留旧验收历史，追加失效时间、原因、影响范围及复验结果，不能仍宣称全部完成。

新建票立即遵循本规则及 [拆票标准](task-decomposition.md)。既有 open / acceptance-failed 票在下一次派发前补齐设计矩阵、准确参考图、适用状态契约与证据项；历史勾选不自动代表当前通过。历史 closed 票不批量改写或抹除旧 Status，作为新依赖复用前核对其接受证据仍然有效，证据失效则重开。历史交付包内的流程快照保留，当前项目规则优先，不为此重写历史压缩包。

## Wayfinding operations

本地 Markdown 没有原生子任务、指派和 blocking，使用以下文本关系；不创建远程 issue。

- 地图和决策票都是 `issues/` 下的独立 Markdown issue，首行标题是展示名称，`ID` 是稳定标识。地图包含 `Labels: wayfinder:map`。
- 子票用 `Parent: [地图名称](相对路径)` 归属地图，并标 `wayfinder:grilling`、`wayfinder:task`、`wayfinder:research` 或 `wayfinder:prototype`；`Mode` 为 HITL 或 AFK。
- `State: open|closed` 是生命周期权威字段；`Assignee: unassigned` 表示未领取。工作前先重新读取并填写 Assignee，再执行；同一票只能有一个负责人。纯文件不能提供跨进程原子领取，并发会话应先协调同一文件的所有权。
- `Blocked by` 小节用命名链接列出依赖票；只在全部依赖 `State: closed` 时解除阻塞。首次创建完所有 issue 后，第二遍再写依赖。Status 仅说明当前工作情况，frontier 根据 State、Assignee 和依赖计算。
- Frontier 是指定地图下 open、unassigned、所有依赖均 closed 的票，按编号排序；始终展示标题和链接，不展示裸 ID 代替标题。
- Resolution 使用 `comments/<票ID>/<时间戳>-resolution.md` 单独保存，并在票的 Resolution comment 字段链接；记录用户原话依据或 AFK 工作证据，再关闭票。地图 Decisions so far 仅增加标题链接和一句摘要，不复制答案。
- 图谱创建会话不领取、不手动解决子票。下一会话只领取一张 frontier 票，HITL 结论必须来自用户真实交流；研究票按 wayfinder 的独立研究流程处理。
- 当前行情重构地图附带只读 `frontier.py`：默认查询 frontier，`--all` 查询所有子票及 blocking，`--mermaid` 输出当前依赖图。其输出是派生视图，不是第二份权威地图。
