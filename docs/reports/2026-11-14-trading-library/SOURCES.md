# 来源、版本与归档边界

2026-11-14。当前报告归档已有评审结果，没有 fetch 新远端提交，也没有重新运行后端探针。候选工作区存在 dirty／untracked 实现，**HEAD 不等于被评审的全部代码**。以下源码路径需结合实际文件 SHA256 定位，不能直接按提交范围 cherry-pick。

## e0bb

当前工作分支 `codex/library-frontend-mock`，产品 HEAD `1770178694f5815b699c23deef894888dac1abea`，基线 `3d444316589e2feefd9b2b3d03d362737e8a6d27`。前端33文件与13个设计参考的路径／SHA256见 [前端最终 manifest](evidence/frontend/final-manifest.json)。后续文档提交会推进 HEAD，但不改变该产品基准。

原根目录 `/Users/zhoulin/.codex/worktrees/e0bb/TradeReview`。本报告对当前仓库文件使用相对链接；原始证据中的绝对路径保留为执行时的 provenance，不能当作其他机器上的可执行位置。

## 25db

原工作区 `/Users/zhoulin/.codex/worktrees/25db/TradeReview`，分支 `codex/trading-library-v2-development-plan`，HEAD `d95afc37d30f817edbd6daab41e85f485138de0d`。包含未提交／未跟踪模块。

关键路径／逐文件 SHA256见 [practice 专项研究](research/practice-backend.md)；全清单收于下方源码冻结。报告中的 `25db:app/…:行号` 是该冻结版本的源码定位符，未将这些后端文件迁入当前产品。

## 38a0

原工作区 `/Users/zhoulin/.codex/worktrees/38a0/TradeReview`，分支 `codex/homepage-db-1s-20261105`，HEAD `8c8c66c715be46e1e8a53d61d02b82f4fa13b22c`。关键文件／SHA256见 [readstore 专项研究](research/readstore-performance.md)。

本轮独立核对历史 A1b 的1,221文件，0个变化；原清单 SHA256 `8e7afc06e10044c9783df1a9d4410bdc23d5f4ea089ac7b79200d83b461f7342`。历史时序与当前机器负载、缓存状态并不因此相等。固定业务日期只为重放历史发布；valid_until 为 null，不能解释为绕过过期检查或当前业务 freshness 已证明。

## 0dc6

原工作区 `/Users/zhoulin/.codex/worktrees/0dc6/TradeReview`，分支 `codex/home-read-mvp-base-20261029`，HEAD `8c8c66c715be46e1e8a53d61d02b82f4fa13b22c`。本轮只将其必要旧读取实现作为对照，不宣称全部模块或最新远端分支均已审查。

## 源码冻结与证据完整性

本轮后端诊断前／后共冻结4个工作区的21,573个普通源码文件（排除 scratch、superpowers 产物、被忽略数据及符号链接），两份原始 JSON 字节完全相同。本次去重压缩为 [source-freeze.json.gz](evidence/backend/source-freeze.json.gz)，未压缩内容 SHA256及摘要见 [source-summary.json](evidence/backend/source-summary.json)。解压即可按工作区与仓库相对路径查原始 SHA256；此清单不是源码副本，单独不能重建 dirty 候选。

|工作区|纳入文件|文件映射指纹 SHA256|
|---|---:|---|
|e0bb|6,714|`7658954b3f037abbef1f94e107bf328524fafec96ea20dbefdf70f129e5d6136`|
|25db|5,129|`13617a8490effafcb03a728cc870baa251cadf4cb7deacd03cf05d558476fd64`|
|38a0|4,898|`3c29c5a5cca10d85b329e579b366cee8465d6023625788c5619bfd1af2145536`|
|0dc6|4,832|`b95051d5fc7a18566aa870eb037238d59491660f29044d56df8823df504db971`|

原 [verification.json](evidence/backend/verification.json)记录当时前后比对和链接检查；它不代表本次文档新增后的源码指纹仍相同。精选附件的归档校验和记录在 [文件清单](evidence/ARCHIVE-MANIFEST.json)，本次文档检查结果单独记录。

## historical-records

原本地后端研究快照：分支 `research/library-backend-four-read-20261114`，提交 `b59a33cbbce52f670bc730bb1d7419e9cec3fbca`，父提交为当前产品基准。该提交只含31个 `.scratch/library-backend-review-20261114/` 研究文件，没有产品改动，未推送。该本地分支不是报告的远端可用性保证；本目录已保存关键正文、结果与探针，不依赖该分支才能阅读。

原前端研究／验收目录 `.scratch/library-frontend-mock-20261113/`；旧代码基准、迁移地图在 `.scratch/library-code-baseline-20261113/` 与 `.scratch/library-staged-migration-20261113/`。用户最终后端选型与迁移决策仍开放，本次归档不关闭它们。

本报告对外部工作树／旧 scratch 链接改为“冻结定位”与版本说明，避免失去其他工作区后出现伪造的当前源码链接。原接受记录、控制表、探针与日志按原字节归档，内部历史路径并非本次重新执行命令。全部历史附件未全量收入，也未收入业务数据库、来源原件或候选后端源码。
