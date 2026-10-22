# 第三轮局部视觉对照验收

2026-10-21。范围：用户本轮选择的 D01 A、D03、D10 常规 A / 窄宽 B、D11 B 高度修正，以及待选的 D07 两种排列。仅为视觉决策原型，不代表 V2.4.1 正式文档已全部整合。

## 版本与证据

- 源码及历史完整性：[integrity.json](evidence/integrity.json)。第二轮 20 个文件、冻结 V2.4 与排查记录 533 个文件哈希均未改变。
- 浏览器：IAB，1280×900、390×900；D07 另检查 600 / 601px 分界。
- 尺寸记录：[geometry.json](evidence/geometry.json)。
- 独立视觉复核另见 `INDEPENDENT-REVIEW.md`，以其最终结果为准。

|范围|实际检查与证据|主进程结果|
|---|---|---|
|D01|已选 A 原 SVG；辅助线开关真实操作；`d01-desktop.jpg` 比较表头与数字末端|PASS|
|D03|沿用第二轮已确认标题图，原尺寸比例；本轮 `d03-desktop.jpg` 只覆盖 16px 图标题，两级层级沿用 `../round2/evidence/d03-approved.jpg` 的既有证据|PASS（继承证据，非本轮两级同框截图）|
|D07 六个下拉|逐个展开 / Esc；展开前后下游位置差均 0；年份与模式真实选值；外部点击关闭；`d07-desktop.jpg`、`d07-narrow-menu.jpg`|PASS|
|D07 布局|B 三列均 126.2109375px、按钮均 36px 高；390 / 600 / 601px 页面检查；窄宽 B 纵向排列为明确候选取舍|PASS，A/B 等待用户选择|
|D10|常规 A 完整分母在主值右侧；窄宽 B 标签、数值各自对齐；`d10-desktop.jpg`、`d10-narrow.jpg`|PASS|
|D11|三分类分别真实切换且互斥；排序切换不清除分类或复选框；Enter / Esc 开关；可见面 28px、命中区 36px；`d11-desktop.jpg`、`d11-narrow.jpg`|PASS|
|导航|五节真实切换、URL 同步；刷新保留目标章节|PASS|

## 保留的失败与修复记录

首轮候选曾误改下拉选项、遗漏 D11 分类处理器、增加可见字段标签，并将 B 做成不同列宽。主进程拒绝后已恢复原选项、补互斥切换、删除额外标签并按最长实际候选等宽。旧桌面截图存在平滑滚动捕获模糊，改即时切换后重拍；未把旧截图作为最终证据。

## 适用边界

- 业务数据、数据库写入、跨页面持久化：NOT APPLICABLE，本页明确为静态视觉候选。
- 评论服务与正式文档全量图稿：不在本轮局部原型验收范围。
- D09 未改动；鼠标纯悬停仍为 NOT VERIFIED，不把点击或键盘证据算作悬停通过。
- 触屏：未验证；390px 是窄视口，不是物理触摸证据。

## 启动

```bash
python3 -m http.server 3087 --bind 127.0.0.1 --directory /Users/zhoulin/.codex/worktrees/12f2/TradeReview/.scratch/homepage-v241-repair/visual-options
```

访问：<http://127.0.0.1:3087/round3/?section=d07>。
