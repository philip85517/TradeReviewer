# 第三轮局部视觉原型独立复核

日期：2026-10-21。复核者未参与本轮实现。

## 结论

**PASS：round3 可作为当前局部选择与 D07 二选一的最终讨论原型。** D01 A、D03 已确认标题契约、D10 常规 A + 窄宽 B、D11 B 的获选方向均被保留；D07 A 清楚表达共同紧凑外框，D07 B 清楚表达由最长实际选项决定的等宽列组。直接查看的最终截图中没有发现文字截断、错误字号、基线错组、箭头挤压、菜单推动下游、页面级横向溢出或数据替换。

这里的 `PASS` 只验收当前静态局部原型及其比较准确性。D07 A/B 仍待用户选择；本报告不表示这些样式已经写入正式规范，也不表示正式 V2.4.1 已完成。

## 触发、范围与证据边界

- 触发：用户选定 D01 A、D03、D10 常规 A + 窄宽 B、D11 B，并要求 D07 继续比较共同紧凑外框与最长选项等宽组；适用 `docs/agents/frontend-control-audit.md`。
- 范围：`round3/index.html`、`round3/ui-select.js`、`round3/NOTES.md`，以及 `round3/evidence/` 内 1280px、601px、600px、390px 最终截图和几何记录。
- 排除：正式首页集成、正式规范修订、业务数据库/API、保存与重载、D09 第二轮状态区、全首页控件清单、实体触控及跨浏览器验收。
- 方法：独立读取源码和冻结参考，按原始像素直接查看全部 11 张最终 JPEG。当前审查环境没有可用浏览器 surface，因此没有重放共享浏览器操作；协调者提供的真实浏览器点击、键盘和几何结果单列记录，未冒充本复核者的直接操作。
- 版本完整性：`evidence/integrity.json` 记录冻结源 533 个文件和 round2 20 个文件均 `changed: []`。

## 冻结版本

源码冻结于 2026-10-21 00:51:01 +0800，最终几何证据截至 00:54:53 +0800。工作树中的原型为 untracked，因此以下结论以内容哈希绑定。

| 对象 | SHA-256 |
| --- | --- |
| `round3/index.html` | `fd98e8778b54702b258a6031ab788f4fd9bedef3170d36784a7feb31813de2d3` |
| `round3/ui-select.js` | `81c7d4628f670a7fbe980790929e319087acdaeef41b02214908b88dc4e871e8` |
| `round3/NOTES.md` | `6582a3a1a1963ce51ffa957a967de8a5fc7f6b80b38ef607d92249dd48625144` |
| `evidence/geometry.json` | `d53fc0a43bc116541e4d7d889f7f79478e580d2acb9a10d9286b89edec515216` |
| `evidence/integrity.json` | `195e82b2513e55423a53dddda263cfccb13aa9d6e0e9ad5d084102729b6c385a` |
| 冻结 `period-selector-current.svg` | `aebac62ff4d546abdf8c3921d660010ec475e6dd07da1a03e414468f3443b920` |
| 冻结 `winrate-current.svg` | `8ccfbe8543e6142046d0a501dcbf9c5f22dec783cb5acd6a070bc49052202460` |
| 冻结 `contribution-labels-current.svg` | `317e39b4120bc7702d936cd4477299296be0ef051c18cdeca9efd8d794834e70` |
| round2 `accepted-chart-title.svg` | `0cbde9b976b625b1ee2f8b0714b5e2c6e596dd13ce19f81d176f20d24139b7aa` |

## 需求与视觉核对

| ID | 直接视觉检查 | 源码/几何检查 | 结论 |
| --- | --- | --- | --- |
| D01 A | `d01-desktop.jpg` 中四条检查线分别穿过表头与两行数据的可见右边缘；标题保持单行，数据没有挤压或改位。检查线是文档辅助状态，不属于正式默认外观。 | 复用 round2 A 的四个 `data-anchor` 和实际字体 ink-metrics 校准；表头仍为 12px，数据仍为 14px；`636.85 / 688.67 / 12.53 万 / +9,431.24` 等原值保留。 | `PASS`，符合已选 A。正式字体/缩放仍需集成后复验。 |
| D03 | round3 的 `d03-desktop.jpg` 直接证明“每月净盈亏”保持 16px/600，裁切完整。round2 `d03-approved.jpg` 才同时显示 18px/600“历史已平仓”和 16px/600“每月净盈亏”。 | round3 未改 D03 资产，继续引用 hash 不变的 `accepted-chart-title.svg`；该 SVG 的 66px viewBox 只覆盖图标题区域。 | 契约延续 `PASS`，但 round3 单张新截图不能独立证明两级层级；完整层级证据依赖已冻结的 round2 截图。 |
| D07 A | 1280、601、600、390px 截图中三个字段处于同一外框，内部只有两条分隔线；文字、8px 文字—箭头间距和 16px 箭头清楚。390px 菜单完整覆盖显示，不挤动下面说明或候选 B。 | 外框高 36px，横向外边距 8px；各 trigger 取消独立边框并保留 12px 内边距。菜单绝对定位。 | `PASS`，准确表达共同紧凑组。 |
| D07 B | 桌面和 601px 为三列同排；600px 和 390px 为三行同宽。各列文字起点与箭头位置一致，没有按容器剩余空间拉宽。 | JS 以全部实际选项的最长文字宽度 + 50px 设置唯一 CSS 变量；几何证据中 B 三按钮均为 `126.2109375px × 36px`。600/601 的 `scrollWidth === viewport`。 | `PASS`，准确表达最长选项决定的等宽组。 |
| D10 常规 A | `d10-desktop.jpg` 与 `d10-narrow.jpg` 中 321×88 卡均保留 60.0% 与完整“6 / 10 盈利回合”；右侧说明与左侧主值共享下行文字基线，没有落到标题行。 | 主值和分母同处 grid 第 2 行并使用 `align-self: baseline`；28px 主值、11px 分母和原卡尺寸不变。 | `PASS`，符合已选常规 A。 |
| D10 窄宽 B | 278×104 压力例中，上行“范围胜率 / 盈利回合”互相对齐，下行“100.0% / 1,000 / 1,000”互相对齐；两行角色没有混排或截断。 | 左右标题同处第 1 行 baseline，左右数值同处第 2 行 baseline；只增加卡高，不缩字号、不增加指标。压力数字明确为合成数据。 | `PASS`，符合已选窄宽 B。 |
| D11 B | `d11-desktop.jpg` 中分类、排序、checkbox 和全局市场保持同一 36px 行；分类与排序的可见面均为 28px。`d11-narrow.jpg` 自然换行，选中下划线、排序箭头、checkbox 和“全部市场”完整可见。 | 分类 button、排序 trigger、checkbox 命中框均高 36px；分类与排序的可见伪元素均 `top:4px;height:28px`。排序保留 `盈利最高 ↓ / 亏损最大 ↑`，checkbox 独立，“全部市场”仍为 14px/700。 | `PASS`，满足“可见 28、点击 36”及已选 B。 |

## 状态与操作证据

| 路径 | 证据 | 本独立结论 |
| --- | --- | --- |
| D07 六个下拉分别展开 | 协调者真实浏览器记录；`geometry.json` 六项 downstream `shift: 0`；`d07-narrow-menu.jpg` 显示展开菜单 | 最终状态视觉 `PASS`；菜单绝对定位且未改变下游位置。实际输入由协调者执行。 |
| D07 选择、Esc、外点关闭 | 协调者真实点击/键盘记录；源码同步隐藏 select、按钮值、`aria-expanded` | 已有真实操作说明；未由本审查者重放。 |
| D07 600/601 临界宽度 | `d07-600.jpg`、`d07-601.jpg` 与 `geometry.json` | `PASS`：600px 纵排、601px 横排，均无页面级横向溢出。 |
| D11 三分类互斥 | 协调者逐项真实切换记录；源码把同组唯一按钮置为 `aria-pressed=true` | 已有真实操作说明；截图显示最终“打新”选中状态。 |
| D11 排序、checkbox 独立组合 | `d11-desktop.jpg` 显示“亏损最大 ↑”与已勾选 checkbox 共存；协调者真实操作记录 | 最终组合状态视觉 `PASS`，符合独立状态语义。 |
| D11 Enter/Esc | 协调者真实键盘记录；源码存在 Enter/Space 与 Escape 路径 | 已有真实操作说明；未由本审查者重放。 |

## 发现与限制

- 没有发现 P1/P2 视觉缺陷。
- D03 是证据范围限制：round3 新截图只覆盖图标题，完整两级层级仍由 SHA-256 `7c9608faca4a9d240e4266d031b7055b4c1edc290d9f90ca300d8608ec222402` 的 round2 `d03-approved.jpg` 证明。这不构成本轮回归，因为 D03 资产未变且用户已确认，但不能把 round3 单图描述为完整两级对照。
- D07 A 在本轮最窄 390px 仍保持单行共同容器；小于 390px 的换行行为没有证据，不能外推。
- D10 的 100.0% 与 1,000 / 1,000 是标注清楚的压力数据，只验证布局，不替代业务数据测试。
- 当前是静态原型，不连接业务状态；持久化、返回导航、reload 和正式页面数据链为 `NOT APPLICABLE`。

## 门槛结论

| 门槛 | 结果 | 说明 |
| --- | --- | --- |
| 已选方向保真 | `PASS` | D01 A、D03、D10 常规 A + 窄宽 B、D11 B 均保留。 |
| D07 A/B 决策对照 | `PASS` | 两种分组逻辑、宽度来源与窄宽行为可直接比较。 |
| 独立视觉对照 | `PASS` | 直接查看全部最终桌面、临界宽度和 390px 截图。 |
| 本审查者独立真实输入 | `NOT VERIFIED` | 当前环境无浏览器 surface；真实点击/键盘由协调者执行并留证。 |
| 正式规范整合 | `NOT VERIFIED` | 不在当前局部原型范围。 |
| 正式 V2.4.1 完成交付 | `NOT VERIFIED` | 不在当前局部原型范围。 |

## 截图哈希

| 截图 | SHA-256 |
| --- | --- |
| `d01-desktop.jpg` | `7e225d44f83ead731fffbcb490e75893e986f211a0bebc0d4b0dff99020a94a7` |
| `d03-desktop.jpg` | `87b5ddca1f76f81504a5d07c0183fcda7305c534092944ca0fa5dff0289547f6` |
| `d07-desktop.jpg` | `55327565ef26ea828681221533ce89a0d1cfecf3779387d5e0b9b6e9ade96be9` |
| `d07-601.jpg` | `fa316c99301096cf2fb094eeee7c606642e6241ee9b47e0228dc98b59ec09607` |
| `d07-600.jpg` | `8d9a794484eefb7077b5356e9af48763f703dd4560cebe3b8d36149bdf192c6f` |
| `d07-narrow.jpg` | `a0be317f8598be1b3ffc655873583bbd69bd5e5bbf2742e7b60ec181173e9aa0` |
| `d07-narrow-menu.jpg` | `e90c71df64523828310ddc75848f731e658d6310ad2e2e9239087e72a06fc8b4` |
| `d10-desktop.jpg` | `14208d6ea0f9234f45a7faa14219ed9baff30a35c92e4de4adbe1e00ef9006ed` |
| `d10-narrow.jpg` | `e8af4703a9211840f5c0c7a03b2f004ebdcda662f472330eab0376e62f48521c` |
| `d11-desktop.jpg` | `04929b6783cd47229f5ac3199c0b21be9116bb90266ed2bb8f5d14826bcd4fe0` |
| `d11-narrow.jpg` | `1549cc37b115bf100ce2a8ec82be04bdca2a0954ffa3747f9672960348820141` |
