# Luna 独立桌面视觉验收

日期：2026-11-06  
范围：Task 2 集成后的首页有限桌面状态、持仓表状态及首页到交易库再返回的真实浏览器状态。  
审查人：未参与本轮实现的独立审查者。

## 结论

**Spec：FAIL（本次有限范围）**。已提供的截图显示：当前不可用/加载状态没有伪造为零值，持仓表和若干控件状态可读；但首页图表容器占用高度明显超过参考、历史区域仍是显式未接线占位、交易库读取/返回页面仍长时间处于连接/加载状态，且 A 股切换请求越过 15 秒截止后仍继续轮询。正常完整数据首页的同态截图没有提供，所以该状态的视觉符合性为 **NOT VERIFIED**。

**Quality：Changes requested**。需在完整的同态数据/错误状态证据齐全后复审图表高度与信息密度，并完成可用交易库加载及返回后恢复/重载的端到端状态。不能据此报告整页 1 秒达标、全页验收通过或触屏通过。

这是有限截图审查，不是完整交互验收。本人直接查看并比较了真实 Chrome/CDP PNG 与批准参考；未独立操作浏览器。有关鼠标、键盘操作与等待时间的信息来自协调者提供的实际操作记录及截图/JSON，而非本人复现。

## 版本、参考与范围

- 最终版本：协调者报告已冻结；1198 文件候选 SHA-256 为 `2a94e2aa6b58d5c15499581184ced492ab27bee103436c61dc1814b2c4e26ef0`。之后另报告 `final-current-manifest.json` 与 `final-prebuild-manifest.json` 完全一致。审查者未重新哈希全部文件。
- 设计参考：`reference-home-1440.png`（1440×1000）及 `reference-home-1280-1280x800.png`（1280×800），对应 V2.5 批准稿 `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md`。
- 桌面实图：`final-cold-1440.png`、`final-warm-1440.png`、`final-write-first-read-1440.png`（1440×1000）；`final-desktop-1280-1280.png`（1280×800）；`final-desktop-1440x900-1440.png`（1440×900）。图像文件名均在 `.scratch/homepage-db-optimization-20261105/write-precompute/`。
- 交互状态实图：`journey-account-open/escape.png`、`journey-symbol-empty/escape.png`、`journey-holdings-empty/clear.png`、`journey-detail-open/escape.png`、`journey-page-one/two/three.png`、`journey-trades-after-one-second/after-deadline/late.png`、`journey-real-return-during/after.png`、`journey-real-home-reload.png`，同目录下配有 JSON 操作记录。
- 比较视口为提供文件标注的 1440×1000、1440×900、1280×800，DPR 1、100% 缩放。1440×1000 是与批准参考相同尺寸的比较视口；但错误/未就绪页面与参考中的正常数据页面不是同一状态。
- 排除：移动/窄屏、模拟触摸和物理触摸、完整页面所有控件/所有断点盘点、真实业务库复核、独立性能复测、测试/构建、服务操作。未打开任何业务 SQLite 数据库。

## 版本绑定覆盖

| 区域 / 状态 | 证据 | 结果 |
| --- | --- | --- |
| 首页骨架、顶部控件、四张 KPI 卡、图表区、持仓区 | `final-cold-1440.png`、`final-warm-1440.png`、`final-write-first-read-1440.png`；同视口参考 `reference-home-1440.png` | 有限比较；图表高度/纵向密度 FAIL；正常数据状态 NOT VERIFIED |
| 桌面纵向布局 | `final-desktop-1280-1280.png`、`final-desktop-1440x900-1440.png` | 1280 和 1440×900 仍可见图表区偏高；更低视口裁切更多持仓行 |
| 账户菜单打开/关闭 | `journey-account-open.png`、`journey-account-escape.png` | 截图中菜单锚定、内容可读；Escape 后关闭并显示触发器焦点样式。操作记录由协调者提供 |
| 标的搜索空结果/关闭 | `journey-symbol-empty.png`、`journey-symbol-escape.png` | 显示明确无结果态；Escape 后关闭并返回搜索触发器。仅按截图审查 |
| 持仓筛选空结果/清除 | `journey-holdings-empty.png`、`journey-holdings-clear.png` | 空结果说明与清除指引可见；清除后列表恢复。固定槽位行为未由这些截图证明 |
| 持仓详情打开/关闭 | `journey-detail-open.png`、`journey-detail-escape.png` | 详情层级、信息和“查看交易”入口可见；Escape 后返回表格并显示焦点样式。未独立操作 |
| 持仓分页 | `journey-page-one.png`、`journey-page-two.png`、`journey-page-three.png` | 8 行槽位及页码 1/3、2/3、3/3 可见，末页保留空白行。此截图不证明数值来源正确 |
| 持仓后的历史区域 | `journey-page-one/two/three.png` | 显示“历史统计与贡献将在后续阶段接入”占位；FAIL，仍未接线 |
| 首页进入交易库、读取等待、超时 | `journey-trades-after-one-second.png`、`journey-trades-after-deadline.png`、`journey-trades-late.png` | 1 秒及 16.5 秒捕获仍为连接/读取中；协调者报告约 74 秒出现目标集合超时；长时间等待后才出现重试和返回首页入口。状态/功能 FAIL |
| 交易库返回首页及刷新 | `journey-real-return-during.png`、`journey-real-return-after.png`、`journey-real-home-reload.png` | 协调者报告点击返回后约 2 秒仍加载；截图显示范围读取中/KPI 骨架；刷新后约 2.2 秒交易库仍连接中。返回恢复/刷新路径 FAIL |
| A 股范围切换及超时/取消 | `cancel-browser-before.png`、`cancel-browser-pending.png`、`cancel-browser-deadline.png`、`cancel-browser-after-deadline.png`、`cancel-browser-return-all.png`、`final-browser-cancellation.json` | 15.966 秒期限处仍显示读取中，期限后仍轮询；手动切回全部后成功恢复。超时停止轮询 FAIL |

## 发现

### P1 — 交易库读取、返回及重载路径未在可用时限内完成

**预期：** 首页进入交易库后得到可用交易记录；如果读取失败，应及时显示明确错误和可行恢复入口。返回首页后应显示已恢复或明确说明仍在进行的状态，刷新应能最终进入可用页面。

**实际：** 截图 `journey-trades-after-one-second.png` 和 `journey-trades-after-deadline.png` 仍显示全屏“正在连接交易数据”及“正在从 SQLite 读取交易记录…”。协调者记录该 16.5 秒截图仍连接中；约 74 秒的 `journey-trades-late.png` 才出现“目标交易集合读取超时，请重试”及返回首页按钮。协调者又报告通过真实点击返回首页后约 2 秒仍显示范围读取中；`journey-real-home-reload.png` 在刷新后约 2.2 秒仍处于交易库连接状态。可见截图没有可用目标交易行。

**证据边界：** 图片本身可确认这些画面状态；等待秒数和输入方式依据协调者操作记录/JSON。审查者未控制浏览器，也未检查服务日志、数据库或独立时钟。根因和重试最终是否成功 **NOT VERIFIED**。即使返回入口可见，也不能视为返回数据链已恢复。

### P1 — A 股范围读取超过截止时间后没有停止轮询

**预期：** 范围读取到 15 秒截止时，停止该次请求的重试并展示终止/恢复状态；旧的已提交持仓可以在“正在读取范围”的状态下继续显示，但期限后不应继续对同一未完成范围发起后台请求。用户改回“全部”后应能正常读取并恢复。

**实际：** `cancel-browser-before.png` 是原有全部范围画面；选择 A 股后，`cancel-browser-pending.png` 与 `cancel-browser-deadline.png` 显示“正在读取新范围…”、“修复中…”和卡片“更新中”，同时仍保留原全部持仓。到 JSON 所记 15.966 秒 deadline，`cancel-browser-after-deadline.png` 仍为相同读取中状态。`final-browser-cancellation.json` 的 Network 记录在截止之后继续发出多次 `/api/storage/homepage-view` 请求，并收到 202；这与“超时停止轮询”的要求不符。约 18.6 秒真实点击切回“全部”后，请求返回 200，`cancel-browser-return-all.png` 回到原有 ready 画面。

**证据边界：** 期限时间、请求顺序/状态和实际点击来源于协调者提供的 JSON 与操作记录；截图确认截止时 UI 仍在 pending 且保留旧持仓。切回全部成功只证明该路径恢复，不证明 A 股请求被取消。根因未确定；协调者静态观察到 timer 只调用一次，但没有证据足以区分 timer 精度、请求时序或其他原因，因此不作因果结论。单测通过不能覆盖此真实浏览器失败。

### P2 — 首页图表容器高度与参考的信息密度不一致

**预期：** 首页的四卡、图表、持仓应遵循 V2.5 桌面纵向层级和密度。参考图的图表外框约从 y=226 到 y=547，高约 321 px；持仓区约从 y=585 开始。

**实际：** `final-warm-1440.png` 的图表外框约从 y=226 到 y=639，高约 413 px，比参考高约 92 px；持仓区约 y=680 才开始，比参考低约 95 px。`final-desktop-1280-1280.png` 的图表约高 364 px，较参考多约 43 px，持仓从约 y=630 开始，较参考晚约 45 px。1440×900 截图也显示相同的过高图表区域；在 1000 px 高的画面中，额外空白已遮掉约两行持仓可视面积，800/900 px 视口裁切更明显。

当前图表本身显示“图表数据暂不可用”，不是正常折线图；参考是有数值的正常状态。因此上述尺寸对照证明实际页面分配了更多纵向空间，但在没有同态“图表不可用”参考时，错误态应否保留该高度仍 **NOT VERIFIED**。正常图表状态也没有同态实图，不能声称正常态已通过。

### P2 — 首页历史统计/贡献区域仍是显式未接线占位

**预期：** 批准首页层级包含历史统计和底部贡献区域；已发布页面应呈现内容或有定义的可用状态。

**实际：** `journey-page-one/two/three.png` 在持仓分页之后显示“历史统计与贡献将在后续阶段接入”。这是页面上明确的未接线状态，与设计要求不符；该区域是否由本次改动引入无法从证据判断。

### P3 — 品牌/标题与参考文案不一致（低优先级）

参考显示左上 TR 标识和“我的交易室”；实图显示蓝色图标和“首页”。这是直接观察到的文案/品牌差异，但没有此轮改动前的同态页面或设计变更记录，是否为有意更新及是否由本轮引入均 **NOT VERIFIED**，需产品/设计负责人确认。

## 有限正确性与状态观察

- 四张 KPI 均显示 `—`，日期控件显示全部期间/日期不可用；图表显示不可用提示。截图未把未知数据伪装成 0，这符合批准稿的未知值表达规则。数值、来源及市场/外汇资格本审查未核验。
- 顶部提供一处“一键修复”入口。截图显示持仓行和若干单元格数据，但本审查未检查其实际计算、完整性或业务库来源。
- 账户菜单、标的搜索、持仓筛选、详情层和分页在截图中的信息层级总体清楚；这仅是截图层面的有限正面证据，不证明键盘可达性、全部交互分支或数据正确性。
- 不把正常参考里的非零数值与当前页面的 `—` 直接判成视觉错误；两者状态不同。反之，未知值正确显示也不能抵销图表密度、历史占位或交易库等待问题。

## 归因、未验项与复审条件

- 缺少相同数据、相同加载/错误状态的旧版本截图，因此首页高度差、品牌差异、历史占位以及交易库路径是否属于本次新增回归均为 **NOT VERIFIED**。旧版归因不作猜测。
- 普通完整数据首页未出现；当前 KPI、图表和顶部状态处于不可用/待修复画面，故完整数据视觉与首页→交易库→返回后的最终业务状态 **NOT VERIFIED / FAIL（就本次捕获路径）**。
- 桌面有限范围不等于全页 100% 控件覆盖。窄屏、触屏、鼠标/键盘独立复现、完整页面其他模块、数据来源和性能阈值均未验。
- 解锁 Changes requested 至少需要：同态正常数据和 unavailable/error 的桌面截图；明确图表区域高度契约并解决/解释该密度差异；历史区达到批准要求或有批准的范围/阶段依据；交易库可用加载、超时恢复、返回首页后的完成态及刷新均有版本绑定实证；A 股范围读取在截止后停止轮询并保留一致状态的真实浏览器证据。具体修复和整页验收由负责实现/总体验收者处理。
