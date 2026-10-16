# 来源与版本说明

## 唯一产品基线

采集日期：2026-10-15，Asia/Shanghai。任务 worktree：`/Users/zhoulin/.codex/worktrees/12f2/TradeReview`。HEAD、local master、重新fetch后的origin/master均为 `7a5d137da3dcdf0f133a29714ee269693746472b`。

现有3022端口来自4ca2 worktree的609889c0，不能代表master。本次另以 `npm run dev` 在3333启动当前基线，启动脚本对业务库作WAL-aware在线备份到 `.data/tradereview-test.sqlite` 并显式传给服务。截图、观察与控件检查仅使用此隔离副本。行情与历史计算可能后台更新，截图数值是采集样本，未冻结成业务验收期望值。

## 公开需求与迭代记录

| 来源 | 用于解释什么 | 使用限制 |
| --- | --- | --- |
| docs/specs/2026-09-19-trading-room-homepage.md | 范围统一、收益与复盘任务、数据可信性 | 旧布局不是当前布局 |
| docs/specs/2026-09-21-trading-room-homepage-feedback.md | 简约、展开反馈、趋势可读性、异常处理 | 部分交互和默认值与当前实现不同，应保留差异 |
| 当前app/components/dashboard及app/lib/reviews | 当前组成、控件、状态、CSS和计算边界 | 源码存在不能替代实际功能验收 |
| 4ca2：首页视觉效果设计 / v0.2、v0.3候选 | 统一密度、视觉拉齐和未合入方案背景 | HEAD609889c0，候选，不作为master画面 |
| 0ff3：持仓估值修复迭代 | 缺行情、现金和估值解释的历史背景 | HEADb95929ad，未合入候选 |
| f922：策略台文档v2.2及VDF-002 | 图文阅读结构、目录、原图、文字和图片评论 | 复用文档能力，不复制策略业务规范或个人评论 |
| 历史聊天“首页控件迭代 ｜ 图表区”“首页视觉效果设计”“策略台设计” | 对照已记录的用户反馈和文档交互偏好 | 只总结可查证决策，不补造未记录动机 |

## 截图与解释的关系

images目录内JPG均由本次真实浏览器采集；无AI生成产品截图。HOME-编号为正文图号，图片原始文件与指纹登记于document-manifest.json及evidence/captures.json。整页结构图若采用SVG示意，则明确标为示意，不用于像素验收。

标准视觉比对视口是1440×1000和390×844；单区域裁切保持原始比例。原图可点击查看，分镜只是这些截图的前后态切换，不向实际首页发送操作。

## 辅助材料

详细源码来源图保存在任务目录 `.scratch/homepage-visual-baseline/source-map.md`；逐项规则在本目录rules.md；实际浏览器与评论测试结果在evidence/acceptance.md。本次不提交、推送或发布远端，也没有修改业务页面源码。
