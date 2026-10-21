# 首页视觉规范 V2.4.1：排查与修订记录

归档日期：2026-10-21。用户已确认第四轮局部原型，并要求保留排查、修复过程供后续跟踪与 Git 管理。

**当前结论：视觉取舍已确认，完整 V2.4.1 仍待整合验收。** 本目录记录从 V2.4 冻结、评论诊断到四轮视觉评审的过程，不替代首页规范正文，也不把局部原型通过写成全量修复完成。

## 阅读入口

|需要了解的内容|入口|
|---|---|
|17 项问题、根因、涉及章节、数量、修复及验收计划|[问题跟踪表](ISSUE-STATUS.md)|
|用户最终选择，后续实现应遵守的局部视觉约定|[已确认决定](DECISIONS.md)|
|为什么修改、哪一轮未通过、后来如何修正|[修订过程](REPAIR-HISTORY.md)|
|完整排查分析与复现依据|[排查报告](DIAGNOSIS.md)|
|106 张独立 SVG、108 处引用的章节分布|[位置清单](LOCATIONS.md)|
|32 条冻结评论，含本轮 5 条新增评论|[原始评论 JSON](records/homepage-v24-ch12-diagnosis/comments-frozen.json)|
|四轮原型、截图与局部验收|[第一轮](records/homepage-v241-repair/visual-options/index.html) · [第二轮](records/homepage-v241-repair/visual-options/round2/index.html) · [第三轮](records/homepage-v241-repair/visual-options/round3/index.html) · [第四轮](records/homepage-v241-repair/visual-options/round4/index.html)|
|最新两处原型的实际浏览器验收|[第四轮验收](records/homepage-v241-repair/visual-options/round4/ACCEPTANCE.md)|
|原文件来源及内容指纹|[归档来源清单](manifest.json) · [归档校验结果](VERIFICATION.json)|

## 版本关系

冻结基线是 [V2.4](../../baselines/2026-10-19-homepage-v2.4/README.md)，对应冻结提交 `fcb30097`。持仓汇总 C 方案及后续局部选择是在此基础上的修订；已确认的模块顺序、底部单一贡献区和业务口径继续保留。

原型用于确认视觉和局部交互。正式 V2.4.1 需要将决定一致地落实到正文、公共组件、全部关联图稿及交互预览，再逐项验收。问题跟踪表保留尚未取得证据的项目，后续不能仅凭本次用户确认关闭这些项目。

## 保存方式与回溯

- `records/` 是诊断及修复工作目录的逐字节快照，包含原始评论、CSV、扫描结果、任务记录、生成工具、原型和验收截图。各轮历史待选措辞及失败证据按原貌保留，当前状态以本目录的决定和跟踪表为准。
- `DIAGNOSIS.md`、`LOCATIONS.md` 是便携阅读副本，只转换文件链接。报告引用的部分旧工作目录文件另存于 `references/`；基线文件链接仍指向仓库中的冻结 V2.4。
- 原始记录内可能含当时机器的绝对路径、预览端口或脚本路径；它们是历史证据。浏览原型使用下方命令，勿将旧生成脚本当作可无条件重跑的构建入口。
- `manifest.json` 记录原路径、归档路径、大小及 SHA-256。`SHA256SUMS.json` 校验本次完整归档；运行 `python3 verify-archive.py` 可重新检查。后续新增进展应另加日期记录，保留此快照。
- 评论 JSON 可脱离评论服务阅读和版本追踪；本次没有验证将旧评论重新导入未来评论服务，不能把文件已保存等同于导入链路已通过。

## 本地查看归档原型

在任意终端执行以下完整命令；3088 若被占用，先选择空闲端口。本命令仅提供静态文件，不连接业务数据库或评论服务。

```sh
python3 -m http.server 3088 --bind 127.0.0.1 --directory /Users/zhoulin/.codex/worktrees/12f2/TradeReview/docs/design-system/iterations/2026-10-21-homepage-v2.4.1/records/homepage-v241-repair/visual-options
```

然后打开第四轮 `http://127.0.0.1:3088/round4/?section=d07`。此处是重开说明，不表示本次已启动 3088 服务。

## Git 范围

本次归档放在仓库正式文档目录，已检查不受忽略规则排除。建议提交范围为本目录、上级迭代索引，以及对应的本地任务状态更新。没有执行提交或推送；其它未跟踪的历史目录和在制 V2.4.1 基线不能因为本次归档而一并当作已验收成果提交。
