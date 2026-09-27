# R6 Header / Footer 紧凑预算修复

日期：2026-09-26  
负责人：Luna 5.6  事件：`/root` 真实浏览器复验后交回  
范围：仅 `app/components/recall/recall.css`

## 复现与方案

`R6-pre-plan-1280.png` 显示 1280px 桌面 header 内的全局 `.chart-toolbar { flex-wrap: wrap; }` 把搜索、周期和设置拆成三层，顶栏高度达到约 126px。批准的 E01 仍要求紧凑顶栏，桌面按钮保持至少 36px。

本轮在 901px 以上强制 chart toolbar 单行；1101–1320px 使用两行网格：第一行标题与必要动作，第二行 chart toolbar 与阶段导航。1440px 继续单行，设置、周期与搜索保持同组，不改字体或命中区。

`R6-more-390-intermediate.png` 显示 390px post + 侧栏展开时，More body 只剩约 70px；末尾状态说明与无效 replay buttons 占用了记录区域。More 展开时收起重复的末尾 status 整行、隐藏 disabled replay buttons，保留仍可用的“计划侧栏”按钮；More 关闭时恢复状态行与核心动作，并让“回到买入前判断”保持 nowrap 独立宽度。图表 220px 与 More body 的唯一滚动容器保持不变。

## 实施规则

- 桌面 toolbar：`flex-wrap: nowrap`、36px 高度；1280 紧凑桌面采用两行明确网格。
- 窄屏 More：去掉重复 status 整行，而不是留下只有一个返回按钮的 44px 空行；阶段导航仍提供买入前入口，计划侧栏按钮保留。
- 窄屏闭合 More：返回按钮 `width: max-content`、`min-width: max-content`、`white-space: nowrap`，说明文本以省略号占用剩余空间。
- More 桌面滚动、nested panel 单滚动盒、220px chart floor 和已冻结的 More body 约束未改动。

## 验证状态

本轮仅完成 CSS 修改和级联静态检查，未自行启动 build 或浏览器；root 将用统一 build 复验 1280/1440 header 与 390 post/global、侧栏打开和 More 展开状态。
