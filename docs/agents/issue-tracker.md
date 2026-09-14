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
