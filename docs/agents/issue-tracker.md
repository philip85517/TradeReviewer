# Issue tracker: Local Markdown

用户已确认本项目使用本地 Markdown 工作任务，不发布到远程 issue tracker。

## 约定

- 每个功能使用 `.scratch/<feature-slug>/` 目录。
- 每个任务独立保存为 `.scratch/<feature-slug>/issues/<NN>-<slug>.md`，按依赖顺序编号，阻塞任务在前。
- 功能目录的 `README.md` 可作为索引，不代替独立任务文件。
- 每个任务包含 What to build、Blocked by、Status 和可勾选的验收标准；按需记录 Priority。
- 已确认、可由 agent 领取的任务使用 `Status: ready-for-agent`；存在 Blocked by 时仍须等待所列任务完成。
- 发布任务即写入对应 Markdown 文件；读取任务时读取完整文件。
- 任务依赖使用编号和标题表达，不因优先级或共享文件而添加人为阻塞。
- 本文件只配置本地工作任务跟踪；不代表已经配置其他 triage 标签或代理指令文件。

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
