# creation_visual 交接记录

范围：DR02/03/06/07/08、LIB07–09 的静态创建原型；仅修改 `strategy-library-wireframes/build.py` 与生成的 `index.html`。

## 已完成

- 早期检查发现 F16–F18 曾是静态固定 2 份策略；已改为会话内 `Set` 状态，默认仅选 trend-v1，moving-exit-v1 可切换，返回时保持身份、版本、组合数与各 ¥100,000。本记录不把早期 fixed2 视为完成证据。
- F16 明确分开三类策略定义与完整组合预设；详情按钮不改变选择。F17 逐选策略展示独立组合身份与“尚未成交”，F18 同步锁定策略包版本、预设与本金。
- F17 设计工具加入无候选、无信号、必需数据缺失演示；前两者允许继续检查，缺失数据演示将真正禁用“下一步：确认配置”按钮。
- F14 五张卡改为直接 fixture，固定四个 metadata 槽位和原卡密度；状态只由 badge 表达，研究区间统一短格式，未知结果明确写“截止日期未提供”，五种主动作分别对应草稿、待开始、暂停、完成、失败。
- F16/F17/F18 的移动退出完整策略保持 v1；F12 的 v3 仅为详情浏览。短名移除额外 tabindex，并保留一条真实截断长名作为 tooltip/focus/Escape 压力样例。F18 检查详情使用 button 滚动并 focus 当前实际检查区，保持 `#f18`。

- F15–F18 改为 shell 外部 62px 操作栏；正文仍在 `.page` 内滚动，按钮最小 36px、输入/筛选 40px。
- F17 将预览分为候选范围、买入信号、目标配置与成交检查；首屏明确“尚未成交 / 持仓 0 / 现金 ¥100,000”，目标与实际成交分开，并根据内存选择保留每个独立组合。
- F18 按“实际必检项 → 执行口径及限制 → 合成示例与待接入能力”分组。交易日历、市场数据覆盖、宿主执行与费用能力以阻断项呈现；真实确认按钮禁用，底部附近提供短原因与详情入口，不显示总体伪通过。
- F14 五种状态统一为研究范围、实际运行/结果、策略/组合、状态或失败原因槽位；暂停、完成、失败不再重复起点与区间，失败明确“必需市场数据缺失”。
- F10/F12 提升所看版本、生命周期、统计口径；长名使用自定义 hover/focus tooltip，Escape 关闭并将焦点留在原入口。
- 设计工具折叠区可独立打开 A 工作台视觉样例：`http://127.0.0.1:3063/workbench-design/?variant=A`，明确标注独立实验。

## 验证

- `python3 -m py_compile .scratch/strategy-portfolio-backtesting/strategy-library-wireframes/build.py`：PASS
- `python3 .scratch/strategy-portfolio-backtesting/strategy-library-wireframes/build.py`：PASS（19 boards）
- 生成 HTML 内联脚本 `node --check`：PASS
- 真实浏览器/截图、完整 F15→F18 端到端与跨页持久化：NOT VERIFIED（由 root 负责）

## 边界

该原型仅会话内静态内存/锚点导航；不实现 API、数据库、真实确认、运行引擎或创建到 A 的业务接线。模型：gpt-5.6-luna；effort：medium。

## 本轮修正（选择集与演示状态）

- F17 候选结果现在由稳定选择集逐项生成；选择“趋势回撤 · 移动退出 v1”后不再残留趋势回撤 v1 的候选文案。每项同步显示三类包稳定身份/版本、独立本金 ¥100,000、组合预设与“实际：尚未成交”。目标行明确标为“目标权重”，实际行保留持仓 0 与现金 ¥100,000。
- F18 策略定义同步选择集，移动退出完整策略固定为 v1；移动止盈止损 v3 只存在于详情中的历史浏览层，不替换完整策略。检查详情正文链接改为唯一同页入口并保持 `#f18`。
- 无候选/无信号演示分别呈现空结果且保持下一步可用；必需数据缺失演示使用真实 `disabled` 按钮阻断下一步。

本轮静态验证：`py_compile` PASS；生成器 PASS（19 boards）；内联脚本 `node --check` PASS。浏览器路径、鼠标/键盘完整旅程由 root 验收，仍记为 NOT VERIFIED。

本轮 SHA-256：`build.py` `80125ed2689eee65b46bc586329801b664973cb6b94f67a0d65e1b5af2ffabc0`；`index.html` `dd5b0775d29a72c42dac45755b20f52b116de77c9fee936386ccc75f16c57b90`；报告哈希随本记录更新后由交接消息给出。

## Source-review 修正

- F17 的 `preview-portfolio` 现由当前 `selected` 集完整重建：每个独立组合显示所选策略身份、三类包稳定版本、目标权重、独立 ¥100,000 与实际“尚未成交 / 持仓 0 / 现金 ¥100,000”。默认与移动退出样例可保持相同目标权重，仅表达不同策略组合。
- 切换无候选、无信号、缺失数据演示前先调用正常选择集重渲染，再应用当前样例差异；不会把前一个样例的候选或信号文案残留到下一个状态。

本轮再次验证：`py_compile` PASS；生成器 PASS（19 boards）；内联脚本 `node --check` PASS。浏览器验收仍由 root 负责。

## SR02 / F10 末修

- `renderSelection()` 每次恢复正常模型时同时重置候选与买入信号基础文案；样例覆盖只作用于当前场景，因此无买入信号不会残留到无候选或缺失数据。
- F10 移动止盈止损首行链接复用 `.package-name strong`，字号为 14px、字重 600，与其他包名称一致；长名 tooltip 入口仍保留。

本轮验证：`py_compile` PASS；生成器 PASS（19 boards）；内联脚本 `node --check` PASS。浏览器验收仍由 root 负责。

## 末轮视觉复核修正

- F18 检查详情按钮统一现有深色 secondary 样式；策略摘要只显示完整策略名称/版本，三类包稳定引用集中保留在策略定义行一次，避免右栏重复长文本。
- F17 目标配置表只保留每个独立组合的目标权重与实际成交行；完整包引用集中在组合摘要行，两个组合仍独立显示 ¥100,000、尚未成交、持仓 0、现金 ¥100,000。
- 选择集重渲染同时恢复正常候选、信号、提示 note 与下一步可用状态，再由演示样例覆盖；跨样例和返回 F17 不残留 warning 或 disabled 状态。

本轮验证：`py_compile` PASS；生成器 PASS（19 boards）；内联脚本 `node --check` PASS。浏览器截图复核由 root 负责。

## DR08 tooltip 可验证修正

- 长名提示层改为 `position: fixed`，由 `placeTooltip()` 按触发入口的 `getBoundingClientRect()` 计算视口位置，避免 `.docbar`、`.page` 等 overflow 祖先裁切；现有 F10/F12/策略选择入口与 Escape 关闭行为保留。
- 浏览器验证步骤：打开 `#f10`，Tab 到移动止盈止损名称入口（selector `.package-name .name-tooltip a[href="#f12"]`），聚焦后应在视口内看到 `完整名称：移动止盈止损 · 所看版本 v1/v3 · 生命周期：未归档` 提示；打开 `#f12`，Tab 到 `[aria-describedby="full-package-name"]`，聚焦检查完整提示；在 `#f16` 展开设计工具，聚焦 `.docbar .name-tooltip .truncate-name` 长名压力样例，提示应出现在工具条外且可见。按 Escape 可关闭提示并保留触发入口焦点。

本轮验证：`py_compile` PASS；生成器 PASS（19 boards）；内联脚本 `node --check` PASS。浏览器截图复核仍由 root 负责。

## VIS07-08 F17 footer disclosure

- F17 footer now has hidden `#preview-missing-details` and `#preview-footer-note`. Missing-data demo shows concise “必需数据缺失，暂不能继续”, disables `#preview-next`, and reveals “查看缺失详情”. Clicking it keeps `#f17`, scrolls and focuses existing `#f17 #preview-data-gap` (“数据不足” row). Normal, no-candidate, no-signal, and selection changes restore the original footer note, hide the detail button, and re-enable next.
- Static selectors for browser verification: `#preview-missing-details`, `#preview-footer-note`, `#preview-next`, `#f17 #preview-data-gap`.

本轮验证：`py_compile` PASS；生成器 PASS（19 boards）；内联脚本 `node --check` PASS。浏览器截图验收由 root 负责。

## VIS07-08 状态显示二次修正

- 为 `#preview-missing-details[hidden]` 增加 `.footer [hidden]{display:none!important}`，覆盖 footer action 的 flex display，普通状态计算样式明确隐藏。
- `renderSelection()` 恢复 `#preview-data-gap` 原文；missing-data 样例覆盖为“合成示例：必需市场数据缺失（未接入），无法继续确认”，其它样例和选择变化恢复未知原文。
- 保留上一版失败记录对应的 SHA；本轮重新生成并通过 `py_compile`、生成器（19 boards）、`node --check`。

## DR03 缺失说明补全

- F17 现有 `#preview-data-gap` 在 missing-data 合成样例中按当前选择集逐组合显示策略名与三类包稳定版本，并明确“市场数据覆盖未接入；缺失区间无法确认（未知）”；同一单元格末尾给出“请返回选择策略调整配置，实际接入后重新检查”。未伪造缺失日期，正常/无候选/无信号/选择变化仍恢复未知原文。

本轮验证：`py_compile` PASS；生成器 PASS（19 boards）；内联脚本 `node --check` PASS。

## VIS07-09 nested detail actions

- `.strategy-detail-overlay .action` 统一为现有深色 secondary，文字可读且最小高度 36px，覆盖完整策略、包历史和返回完整策略各层按钮；未改变布局或交互。

本轮验证：`py_compile` PASS；生成器 PASS（19 boards）；内联脚本 `node --check` PASS。保留历史失败截图，不覆盖验收记录。
