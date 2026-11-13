# 首页视觉对齐与防闪独立审查

2026-11-14 00:03（Asia/Shanghai）增量复核。审查者 `/root/visual_alignment_final_check` 未实施所审 UI，未改产品代码，未委派、未使用 CUA。本轮最终结论：**PASS（D01–D06 所审状态与 250ms 防闪）**。首次审查的 VA-R01 表头偏差已修复并直接看图复核，原 FAIL 证据保留如下；这不是整个 Mock 阶段或全仓接受。

- 触发与范围：用户要求推进首页 Mock 视觉、消除切市场“更新中”闪现；按 [前端审计规范](../../../docs/agents/frontend-control-audit.md)、[本轮方案](../../../docs/superpowers/plans/2026-11-13-homepage-visual-alignment.md)及 [本轮接受表](VISUAL-ALIGNMENT-ACCEPTANCE.md)检查 D01–D06 与 250ms 反馈。正式依据为 [V2.5 正文](../../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md)与 home-1440/home-1280/period 图。
- 首次冻结版本：worktree `/Users/zhoulin/.codex/worktrees/0cde/TradeReview`，分支 `codex/latest-system-preview-20261106`，HEAD/基线 `6ddbeca09b9eaf1b6d88488e6e154839217cb74b`，带未提交修改；[归档 source-manifest](evidence/visual-alignment/source-manifest-a443138c.json) 的 `a443138c59e0f5567078a841c737766e9ceff75ad4c7a9cd962c93cf5822e2c3`。首次本 reviewer 重算 20/20 源码文件、35/35 图片 SHA256 均匹配；[原 image-manifest](evidence/visual-alignment/image-manifest.json)仍绑定该旧指纹。修正后的最终版本见下方增量复核。
- 图片环境来自 [browser-facts](evidence/visual-alignment/browser-facts.json)：Chrome，DPR1/100%，1440×1000、1280×800、1101/1099/901/899×800、390×844；固定 2026-10-15 Mock。默认全部市场/全部账户/本年/空查询/名称升序/第1页8条；失败图为港股旧范围。URL `http://127.0.0.1:3333/preview/homepage`；主代理 `npm run dev`/`make dev`，显式隔离库 `.data/tradereview-test.sqlite`。本 reviewer 未启动或新鲜打开浏览器，不能签署服务终检。

## 直接看图与版本绑定结论

使用 `view_image` 逐张亲看，未用 DOM/几何代替视觉对照。参考共3张：[1440](evidence/design-diff/reference-1440.jpg)、[1280](evidence/design-diff/reference-1280.jpg)、[期间局部](evidence/design-diff/reference-period-1280.jpg)。首次源码版本直接查看12张，清单如下；另直接查看修正后5张，见增量复核。

| 范围 / 元素 | 直接查看的最终图与观察 | 结论 |
| --- | --- | --- |
| D01 / CP0.period.custom/start/end | [date-open-1280](evidence/visual-alignment/date-open-1280.jpg)：浮层右缘对应日期入口，标题与字段有清楚间距；[date-error-390](evidence/visual-alignment/date-error-390.jpg)：字段改为单列、错误可见、应用禁用，浮层收纳在视口内。期间参考含反向日期，未以其错误态总高度要求正常态。 | PASS（所列静态状态） |
| D02 / CP0.holdings.readout | [normal-1440](evidence/visual-alignment/normal-1440.jpg)、[normal-1280](evidence/visual-alignment/normal-1280.jpg)：单价明确原币，混合行 CNY/HKD/USD 可辨，报告金额仍标 CNY。 | PASS |
| D03/D04/D06 / scope.market/account、holdings.summary/search、period | 同上双桌面：市场蓝色选中、独立账户箭头、期间起点/日期右侧位置、标题汇总与176px搜索/44px导出密度合理；标题、数值和次级代码层级清楚。normal-1280 含图表 hover 读数，不将其当成无提示静态基线。 | PASS（所列状态） |
| D05 / holdings identity/view/header | 同上双桌面：标的/数量/查看、交易所:代码、蓝色文档图标符合方向；[holdings-right-390](evidence/visual-alignment/holdings-right-390.jpg)可见数值/查看/分页，但浮盈表头币种换为第二行，见 VA-R01。 | 首次 FAIL，已修复见下 |
| CP0.status.stale/update-error | [slow-pending-1280](evidence/visual-alignment/slow-pending-1280.jpg)、[failure-retains-HK-1280](evidence/visual-alignment/failure-retains-HK-1280.jpg)：慢读保留原范围与整组数字、可取消；失败保留港股/HKD并说明新选择未应用。卡片、图表与持仓定位稳定，状态条占原有间隔。静态图不能证明250ms时序。 | PASS（视觉） |
| CP0.page.responsive/longtext | [1101](evidence/visual-alignment/breakpoint-1101.jpg)、[1099](evidence/visual-alignment/breakpoint-1099.jpg)、[901](evidence/visual-alignment/breakpoint-901.jpg)、[899](evidence/visual-alignment/breakpoint-899.jpg)：断点两侧主要层级清晰；[extreme-holdings-390](evidence/visual-alignment/extreme-holdings-390.jpg)：长名称省略且完整读数可见，长金额未挤压搜索/导出。横滚图保留表内横滚与固定标题区的表现。 | PASS（所列布局；表头例外） |

有意差异保持：原币单价附12px币种；图表/持仓相对旧整页图低2px按正文间距；金额轴万/亿、默认不铺满日点、无交易库“12”徽章均以正文优先。全局搜索/附加筛选/历史/贡献属后续，不作为本轮缺陷。

## 发现与代码审查

**VA-R01 / P3 / 实现偏差，首次 FAIL、现已关闭**：390横滚至右侧时，“持仓浮动盈亏(CNY)”的 `(CNY)`落在第二行；1101截图也可见该现象。正文 L107 要求“金额表头保留单行”，本轮 D05 增加完整表头后在980px最小表宽的14%列中未保留单行预算。定位 `homepage-preview.css:57,65` 与 `holdings.tsx:22`；真实截图见上，发现后已立即通知主代理。首次不能签全部 PASS；修正与复核见下。

- `use-homepage-preview.ts`：`pending`立即生效，反馈独立延迟250ms；每次 `run` 清理旧反馈并重置，局部 token/AbortController 阻止旧计时器、迟到结果与错误越代生效。成功/错误 finally、取消、关闭及卸载 invalidate 清理反馈；15秒超时关闭反馈并保留旧值。未发现重要状态安全缺陷。
- `homepage-preview.tsx`：卡片/状态条使用 `showPending`，导出/分页等保护继续用真实 `pending`；范围、币种和数据只随已提交 `view`一起替换，错误不被250ms门槛延迟。`period-selector`按触发器右缘定位、监听滚动/resize并清理，CSS选择器恢复标题20px间距。`holdings`保留原币精度与币种、报告金额合同，图标及身份修正无额外数据换算。代码未见另一个重要缺陷。

## VA-R01 修正后的增量复核

最终 [source-manifest](evidence/visual-alignment/source-manifest.json) 为 `18ca3bd95ea15f45d4d9f21fea7e2ba5dc8aacc67307769e093b0c9343a33e39`。本 reviewer 重算指纹及20/20源文件均匹配；与归档比较，仅 `homepage-preview.css` 的 `.hp-holdings th button` 增加 `white-space:nowrap`。去掉该声明即可还原旧 CSS hash，未缩字或更改列宽。[final-image-manifest](evidence/visual-alignment/final-image-manifest.json)绑定新指纹，6/6图片 hash 匹配。

直接亲看新增5图：[390右横滚](evidence/visual-alignment/final-header-right-390.jpg)、[1101](evidence/visual-alignment/final-header-1101.jpg)、[1099](evidence/visual-alignment/final-header-1099.jpg)、[1280](evidence/visual-alignment/final-normal-1280.jpg)、[1440](evidence/visual-alignment/final-normal-1440.jpg)。390、1101及双桌面可见完整浮盈表头单行、与数值对齐，未侵入相邻查看列；1099图用于复看断点后的工具栏与整体布局，其表头位于截图下缘，不单靠该图断言完整表头。双桌面与原参考对照未见新增布局偏移。**D05 增量 PASS，VA-R01 关闭；D01–D06 与防闪本轮最终 PASS。**

[final-browser-facts](evidence/visual-alignment/final-browser-facts.json)补充记录390表内横滚720px、浮盈按钮20px高与121.195px宽、列137.195px含padding，作为图片辅助证据。浏览器由主代理操作；本 reviewer 未亲自操作。主代理另报告完成浏览器 reset/交付标记，不能替代本 reviewer 的直接交互验证。

## 验证与限制

仅独立运行 `./scripts/native-node.sh node_modules/vitest/vitest.mjs run app/components/homepage-preview/homepage-preview.test.tsx`：**1 文件、23/23 PASS，退出0**，24.69秒；[完整日志](visual-alignment-independent-test.log)。覆盖快请求、249/250ms替换、取消/失败、迟到结果、原币和既有首页旅程；组件合成事件不是 reviewer 的真实鼠标/键盘操作，卸载清理由源码审查判断。该测试绑定首次 a443 版本；最终仅 CSS 单行增量，按主代理要求不重复运行23用例。已读取主代理[最终项目测试日志](project-test-visual-alignment-final.log)，构建与5个原生测试通过，非本 reviewer 独立运行。

本 reviewer 未操作浏览器：鼠标/键盘点击覆盖与状态操作覆盖均不新增数字；主代理操作证据仍由[本轮接受表](VISUAL-ALIGNMENT-ACCEPTANCE.md)负责。CSV文件下载、完整IME、全部日点/金额/键盘组合、动效逐帧、模拟/物理触控和软件键盘仍 NOT VERIFIED；本轮未独立查看空态/详情返回图片，不能冒用上位 reviewer 的看图记录。只读Mock没有核心写流程，持久化/数据库写入验收 NOT APPLICABLE，不代表真实数据通过。

未重跑全量：已有结果3100通过/4超时/6跳过；串行复测2通过/2仍超时（部署staging、Tiger US daily），相关文件未改不证明它们为基线故障。全仓不能称green，整Mock继续open。VA-R01已关闭，所审D01–D06状态与防闪实现无剩余已知阻断项；最终真实浏览器交付检查由主代理负责。
