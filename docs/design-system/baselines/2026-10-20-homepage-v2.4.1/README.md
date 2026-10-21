# 首页视觉与交互设计规范 V2.4.1

这是以 V2.4 为基础的累计修订，整合已确认的五轮视觉原型、32 条评论及处理记录。主布局和历史共识继续有效；旧版本与原评论没有被覆盖。

## 阅读入口

- [完整可评论规范](visual-spec.html)：设计思路、布局、控件、分镜与验收规则。
- [已确认的历史曲线与贡献原型](prototypes/round5/index.html)：第五轮完整方案。
- [已确认的选择器与胜率卡片](prototypes/round4/index.html)：第四轮局部方案。
- [全部原评论与处理映射](review-records/comments.html)。
- [整合、修复及验收记录](review-records/integration-report.md)。
- [冻结的原排查及四轮修订档案](../../iterations/2026-10-21-homepage-v2.4.1/README.md)。

## 启动预览

```sh
"/Users/zhoulin/.codex/worktrees/12f2/TradeReview/docs/design-system/baselines/2026-10-20-homepage-v2.4.1/start-preview.sh"
```

默认地址为 http://127.0.0.1:3088/visual-spec.html；可通过 `PORT` 覆盖。脚本从自身目录定位仓库，无需切换工作目录。原型使用固定示例数据，不连接交易数据库。

## 评论与 Git

`reviews/HOME-DOC-V23.json` 是本版本的可写评论存储；历史 documentId 为稳定身份，不是页面版本号。`review-records/comments-original.json` 是整合时冻结的 revision 32 原记录；`comments-snapshot.json` 是无服务时的只读回退。评论状态没有被自动关闭。后续新增评论请连同更新后的快照一起提交。

正文源文件位于 `source/visual-design.candidate.md`，图稿、原型、脚本和证据均在本目录，运行不依赖 `.scratch`。历史 `original-images/` 用于原评论回溯，不能替代当前图稿。可用 `python3 verify-package.py` 检查版本、评论保存和相对资源。重建命令见 `build-command.txt`。

本目录及相邻迭代记录可由 Git 跟踪；本次没有推送远端。实际提交状态以 Git 为准。O02 20px 紧凑徽章仍未确认，本版沿用24px。
