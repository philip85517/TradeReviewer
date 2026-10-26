# 交易库 V1.1 独立验收

日期：2026-10-24。Reviewer：`v11_acceptance`；未实施正文、原型或图稿修改，未派发代理，未连接业务数据库。本记录是独立设计审查，不替代 root 的集成交付记录。

## 结论与范围

**PASS — 限交易库 V1.1 设计文档定型、冻结 E 原型归档、生成图稿结构和本记录列出的代表状态视觉比对。当前该范围没有未关闭的阻断问题。** 历史 FAIL 保留于下表，均经修正复验关闭。

触发：V1.1 新增阅读器版本与静态图稿，按仓库 frontend-control-audit、task-decomposition 和 ui-task-templates 执行；参考映射见 [DESIGN-COVERAGE.md](DESIGN-COVERAGE.md)。本次不是产品实现验收。实盘/模拟盘生产控制流、真实行情回放、数据库写入与持久化、移动端新设计、物理触摸不适用本次交付范围；没有访问业务数据库。

已阅读 AGENTS.md、四份指定流程文档、任务 README/PLAN/覆盖表、V1.0 原正文、批准 E 原型源码和 V2.5 公共规范/首页参考源码。对照基线为原批准 E 及用户七项确认，不以实现者报告替代视觉检查。

## 版本绑定与独立检查

包：`docs/design-system/baselines/2026-10-24-trading-library-v1.1`；文档身份 `TRADING-LIBRARY-V11`；版本 `1.1`。

|对象|SHA256 / 结果|
|---|---|
|正文与 manifest fingerprint|`8044415e3d830de333abd8d3cd334803a9d7c87b92e12ddb1f87b09b10e2f982`|
|`source/generate-library-frames.py`|`2be534692a0f53cda2c974a7153ac69c4e4e27532a00f3a7f334113fc64c2d1b`|
|41 SVG 集合指纹|`170f429835112b209e376cb45e31c7eda5deebba7f7faa2d2b770f08f5605096`|
|冻结 E 原型|`3b1068e9d156aa27af5a00cbaf676451dc492c38c0f47426b57a6cd3037c6025`，与原 V1.0 原型逐字节相同|

SVG 集合指纹算法：按文件名排序 `source/images/*.svg`，连接每行 `文件名\t文件SHA256\n` 后对 UTF-8 字节取 SHA256。正文 fingerprint 不随图像变动，因此本记录另绑定生成器和全部 SVG。

|检查|状态|证据与精确范围|
|---|---|---|
|十章正式正文|PASS|BT01–BT10 完整；比较 V1.0 差异，E 公共框架更新，原列表/统计、回合、下钻、返回上下文与异常业务规则保留。|
|原型与正式规则分界|PASS|README、BT02 与正文明确固定样例、底部预览工具、固定 loading/empty 和刷新重置仅用于原型；正式 URL/刷新恢复与模式独立记忆仍在。五个保存日期、7 个回合等已标为设计样例，未定为产品最低数量。|
|来源说明|PASS|README 正确链接 V2.5、V1.0、原评论与冻结原型；BT10 同时保留 V1.0 业务来源和 E 壳层来源，未把最小原型当作全部业务规范。|
|全部 41 SVG 结构|PASS|独立 XML 解析全部通过；可见 text 中没有旧顶栏“返回首页”或“视角”标签。共 41 SVG + 4 approved E JPG。此项不等于 41 图逐一视觉通过。|
|阅读器资源|PASS|独立检查 161 个本地 href/src 全部存在、内部锚点可解析、56 个 HTML id 无重复；manifest 正文图像 44 项。|
|旧版保留|PASS|相对本任务 `v10-before.json` 的 202 个原有文件，独立重新计算 SHA256，0 个变化。不是相对 Git HEAD 的笼统判断。|
|评论隔离|PASS|V1.1 snapshot 为独立 documentId、revision 0、comments 空、operations 空；migration 无迁移条目。V1.0 仍 revision 11，历史来源记录保留原评论 11 条和不迁移策略。未做评论写入试验。|
|样例/计算检查|PASS|独立执行 `PYTHONDONTWRITEBYTECODE=1 python3 .../source/test-library-metrics.py`，6/6 PASS；`test-homepage-template.py`，5/5 PASS。最后一次执行在分页修复后。|
|分页样例一致性|PASS|最终生成器恢复 `page_size=state['page_size']`；实盘列表与返回图显示 6 行、1–6 / 11 项、1 / 2 页；正文与 fixture 仍保留原来源快照。|

## 直接视觉证据

Reviewer 使用 `view_image` 直接查看批准原型六张 PNG（四个 1440×1000 主状态、两个 1280×800 统计状态）、正文内四张 `approved-e-*-1440.jpg`，以及下列真实浏览器截图。截图由 root 操作浏览器生成，视觉判断由本 reviewer 独立完成。

批准截图的像素大小不能反推真实浏览器 viewport。root 记录实际 DOM viewport 为 1280×720，viewport 覆盖行为与截图输出像素不一致。本次图稿截图是 SVG 自然宽度 1440/1280 的 fullPage 静态画布对照，**不宣称 1440×1000 或 1280×800 的产品响应式已验证**。

|覆盖对象|最终视觉证据（screenshots/）|状态与结论|
|---|---|---|
|实盘列表|[accepted-paged-live-list-1440.jpg](screenshots/accepted-paged-live-list-1440.jpg)|PASS：E 标题/侧栏/模式+页签、业务筛选与搜索、表格层级和原分页合同可见。|
|模拟盘列表|[final-sim-list-1440.jpg](screenshots/final-sim-list-1440.jpg)|PASS：整 workspace/卡片/边缘改变，模式仍蓝色；练习列表保留独立身份。|
|实盘统计|[final-live-stats-1440.jpg](screenshots/final-live-stats-1440.jpg)|PASS：六指标、趋势和分布上下堆叠；信息 i 可见且未压标题；盈利绿、亏损红。|
|模拟盘统计|[final-sim-stats-1440.jpg](screenshots/final-sim-stats-1440.jpg)|PASS：4×2 指标、最差练习回撤入口、趋势和分布保持 E 层级；色彩与壳层一致。|
|模拟盘回合集与复盘|[final-sim-rounds-1440.jpg](screenshots/final-sim-rounds-1440.jpg)、[final-sim-replay-1440.jpg](screenshots/final-sim-replay-1440.jpg)|PASS（静态）：回合/费用/余量、配对数量与原成交标记区分、开平仓定位和返回回合集可见；不证明真实回放可用。|
|1280 返回与日期列表|[accepted-paged-return-1280.jpg](screenshots/accepted-paged-return-1280.jpg)、[accepted-paged-date-1280.jpg](screenshots/accepted-paged-date-1280.jpg)|PASS：状态列在卡片内；返回焦点与分页可见，单日期结果无多页时不显示无意义分页。|
|加载、空态、更新失败、缺失输入|[final-loading-1440.jpg](screenshots/final-loading-1440.jpg)、[final-empty-1440.jpg](screenshots/final-empty-1440.jpg)、[final-error-1440.jpg](screenshots/final-error-1440.jpg)、[final-missing-1440.jpg](screenshots/final-missing-1440.jpg)|PASS（静态）：共同壳层、信息入口和主要布局连续；失败保留旧结果，缺失与零区分、缺失数据不连线。|
|阅读器 BT02 引用与切帧结果|[reader-final.jpg](screenshots/reader-final.jpg)、[reader-e-reference-final.jpg](screenshots/reader-e-reference-final.jpg)|PASS（视觉）：V1.1 标识、目录、样例界限与 E 第一/第二帧加载可见，正文参考和生成分镜无相互冲突的公共框架。|

视觉接受的业务扩展：生成分镜保留原业务规定的搜索、复盘状态筛选、分页、下钻、轴标签和异常提示，所以不要求与最小 E 原型逐像素相同。批准原型中固定 11 行、预览底栏不转成业务分镜的分页/底栏规则。侧栏 72px、顶栏 64px、模式与列表/统计同栏、无右上返回首页和可见“视角”、模拟盘整工作区色层、盈亏绿红均保持。

## 历史 FAIL 与关闭证据

|ID|曾经的 FAIL|关闭依据|
|---|---|---|
|IA-01|正文费用长说明仍要求旁边常显、业务来源只列最小 E 原型、模拟盘固定日期/回合样例近似正式规则。|最终正文差异复读：费用说明归 info；V1.0 业务来源恢复；固定数量明确为样例。PASS。|
|IA-02|趋势标题与信息入口重叠；图标为问号；分布按钮贴近副标题。|最终统计/缺失/异常截图直接复验，改为 info i，标题留间距，副标题与按钮分开。PASS。早期 `frame-*` 不是最终通过证据。|
|IA-03|1280 列表状态文字约越出卡片右边界 8px。|失败证据保留 `final-return-1280.jpg`、`final-date-1280.jpg`；最终 `accepted-paged-return-1280.jpg`、`accepted-paged-date-1280.jpg` 显示右对齐到卡片内部。PASS。|
|IA-04|生成器把实盘 page_size 硬编码为 11，覆盖 fixture 和正文每页 6 笔，移除了该样例分页。|失败证据 `final-live-list-1440.jpg`/`final-return-1280.jpg` 保留；恢复 fixture page_size 后，三张 `accepted-paged-*` 直接复验通过，并独立重跑 6 个指标/分页测试。PASS。|

## NOT VERIFIED 与证据边界

- **NOT VERIFIED：全部 41 张 SVG 每张逐一视觉审查。** 全量做的是结构/文本检查；直接视觉覆盖为本报告列出的 12 个业务代表状态、4 个正文 E 参考和阅读器截图。没有把结构 PASS 扩大成逐图视觉 PASS。
- **NOT VERIFIED：真实 1440/1280 浏览器 viewport 的响应式行为。** 受本轮 viewport 工具实际行为限制，仅接受自然画布视觉与已有原型像素证据；本次没有开发响应式产品。
- **Reviewer 未亲自执行浏览器点击。** root 的 [browser-checks.json](browser-checks.json) 记录目录跳转、下一帧、评论抽屉开关、四个原型主状态和只读评论 API；本 reviewer 检查了该记录并直接查看相应截图结果，不把 root 操作冒充独立操作。
- **NOT VERIFIED：新版本评论写入/迁移端到端。** 此次授权为独立评论身份归档，采用只读检查；没有修改旧评论，也没有为验收创建评论。
- 产品交互、数据库持久化、真实行情/未来信息安全和物理触摸为 **NOT APPLICABLE（设计文档定型范围）**，不得将本报告用于宣称产品已经实现或交付。

最终设计范围结论以以上哈希和最终截图为限；后续正文、生成器或分镜变化需要重开受影响项。
