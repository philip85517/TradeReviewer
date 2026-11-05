# 策略台V1.2公共扩展最终独立视觉复核

日期：2026-10-24。审查者：audit_components，未参与实现。审查范围为协调者真实浏览器截图 `docs/design-system/baselines/2026-10-24-strategy-workbench-v1.2/evidence/final/sw*.png` 8 张（1440×1000视口、SVG自然尺寸/fullPage），全部通过view_image直接查看；SW03/04/05在本轮协调者修复后再次逐张查看。并读取最终 `docs/design-system/shared/strategy-workbench-v1.2/manual.html`，核对尺寸、只读、键盘和入口定义是否与图一致。对照基线沿用前轮实际查看的V2.5首页公共参考图片及公共规范。另纳入最终06-observe.png新截图直接视觉复看，以及与前轮已查看round2证据SHA256完全相同的06-observe-status-detail.png，共10张。本轮不改源码。

**结论：PASS，限8张公共组合样例及2张观察页的静态视觉与图文一致性。SH-01至SH-07已关闭。** 新增参数控件、离开草稿层无文字遮挡、裁切或越界，控件字级/图标/颜色/对齐保持公共基线。该结论不代表产品交互、浏览器键盘、触摸或数据链路已通过。

## 七项问题关闭证据

|原ID|状态|实际图片与手册证据|
|---|---|---|
|SH-01 参数覆盖无实际控件|CLOSED|最终sw04中间槽有独立36px数值输入“20”、单位选择器“日”、已勾选“覆盖预设”与“恢复预设”按钮；空槽显示禁用输入/覆盖，已锁定槽改为“14日·锁定参数”和需派生新实验的只读说明；参数、详情和换包分别可辨。三槽280×392与提示864×146在manual中同步。|
|SH-02 日期边界/静态截止Tab矛盾|CLOSED|sw02正常日历保留2024-06-14；错误例明确改为2017-12-31，说明可用数据从2018-01-01开始，并在底注区分正常/错误例。只读名义结束/最后完整交易日无选择器外观。manual写明截止不进入编辑Tab序列，并区分260×36字段本体与266×42焦点环。|
|SH-03 排序及未选移除状态矛盾|CLOSED|sw05位置2/3上移、下移均可用，说明为同组位置；未选行移除变禁用，已选行移除可用。最终底注改“未选行的移除入口不可用；先勾选，再移除”，与图一致。保存失败和重试保留草稿仍明确。|
|SH-04 无匹配重复清除|CLOSED|sw08清除移至原查询行尾；无匹配卡仅说明调整查询或使用上方清除，没有重复按钮。局部失败重试和版本冲突另存仍局限受影响区域；manual同样定义唯一查询清除入口。|
|SH-05 离开草稿例缺失|CLOSED|最终sw03有364×280独立确认层，包含保留草稿并离开、放弃草稿、继续编辑，显示当前上下文及默认焦点“继续编辑”；左侧提交/步骤说明独立排布，不再被确认层遮挡。manual限定第4步确认才创建，离开确认不等同创建提交。|
|SH-06 包详情误放实验本金|CLOSED|sw06包详情改为用途、输入/输出、周期20日与至少20交易日预热；实验独立本金已移除。运行检查栏保留查看日、未知—和费用，金额右齐。480包说明层/320运行证据栏职责分清。|
|SH-07 P3 最新日返回动作仍突出|CLOSED（静态视觉）|重新直接查看final/06-observe.png：完成态查看日为2024-09-13，底部“返回最新日期”改为灰色禁用外观，与不可继续推进及速度控件的禁用层级一致；未发现新增文字遮挡或边界回归。禁用的实际交互行为仍未验证。|

## 十张图逐张接受

|图|结果|检查要点|
|---|---|---|
|sw01-navigation.png|PASS|54/200/48专属紧凑契约保留；同源SVG导航图标；默认、悬停、当前、焦点可辨。|
|sw02-date-time.png|PASS|正常与错误样例明确分离；日期图标、36px字段、外置错误保值、只读截止清楚。|
|sw03-steps.png|PASS|已完成/当前/未到达区别；提交加载；离开确认三动作；文字/弹层互不遮挡。|
|sw04-package-slots.png|PASS|真实参数控件样例、可编辑与锁定只读区别；空/已选/锁定/不兼容状态；三卡和提示区边界清楚。|
|sw05-multi-select.png|PASS|72px两行密度、checkbox/详情/移除独立；位置2/3与上下动作一致；错误保留草稿。|
|sw06-summary-detail.png|PASS|88px摘要/28px数值；包参数与运行证据分离；文本和数字列清晰对齐。|
|sw07-replay.png|PASS（图示四态）|暂停、播放、回看、完成禁用四态无视觉回归；不声称未展示的追赶确认/失败/速度展开也已验。|
|sw08-recovery.png|PASS|查询尾部清除与空态说明一致；加载无假动作；局部重试与另存清晰。|
|06-observe.png|PASS|重新查看最终浏览器截图；完成/最新日状态下返回最新呈禁用外观，图表、摘要和底栏层级保持。|
|06-observe-status-detail.png|PASS（复用已核实证据）|与round2已直接查看截图逐字节相同（SHA256相同）；运行检查栏和主观察区层级、对齐与边界沿用前轮静态接受。|

## 手册一致性

最终手册已把日期字段本体/焦点环区分，保持36px交互本体；SW04尺寸和锁定实验派生语义与图一致；SW03仅第4步提交与离开草稿确认分开；SW05多选/详情/排序分工及未选不可移除一致；SW06包详情和检查栏职责明确；SW08无匹配清除入口限定原查询行。只读截止不进入编辑Tab序列、禁用日期不进入Tab、Esc关闭后回触发字段、详情关闭回原触发器，以及IME/文本输入期间暂停回放快捷键，在文档层面未发现与当前图示矛盾。

手册的尺寸/键盘表是规范，不是运行时实测证据。manual.html整体页面的窄屏重排与浏览器焦点顺序未在本轮实际操作。

## 本轮中间失败保留

本轮最初读取的final截图曾仍有两个失败，已即时告知协调者，未接受worker“已修”口头报告：

- 旧sw04参数20/日及覆盖均只是text，SHA256 `3ba6a21d16a18c4a2e93c15e640d0338feeb8854243b483a16af0e1abac7412e`，SH-01维持FAIL；协调者补真正控件样例并重截后才关闭。
- 旧sw03离开确认层遮住提交说明后半句，SHA256 `2bf9f99005492dace7cf46475e3e3bccf5f41fd6f69949e34b8327334bacd753`，SH-05未接受；协调者重新排布说明并重截后才关闭。

前轮 `/private/tmp/strategy-v12-shared-review.md` 的原始FAIL/截图hash仍保留。最终结论仅绑定下面列出的图像与manual版本。

## 明确未验证/范围外

- 实际点击、Tab顺序、焦点环触发/恢复、键盘Enter/Space、触摸命中与物理触摸：NOT VERIFIED。
- 真实回放新增K线/成交、取消排队帧、请求错误与幂等、保存/返回/重载持久化：NOT VERIFIED；纯设计范围不要求产品数据库验收。
- 06-observe已直接复看新截图并关闭SH-07；06-observe-status-detail最终截图与已直接查看的round2证据哈希相同，因此沿用该次静态视觉接受，未声称本轮重新操作其交互。
- 不外推为所有V1.2产品图或产品实现的总体验收。

## 最终接受输入SHA256

- `docs/design-system/baselines/2026-10-24-strategy-workbench-v1.2/evidence/final/sw01-navigation.png`: `5930b20b0ee6e4d2e7478459f1c30595a183961a526d56d4208f926343cdfb59`
- `docs/design-system/baselines/2026-10-24-strategy-workbench-v1.2/evidence/final/sw02-date-time.png`: `1c0d932a99b9f5850aca36ae6a16c7727df2505444aef0ce493c1f9f7c87b3da`
- `docs/design-system/baselines/2026-10-24-strategy-workbench-v1.2/evidence/final/sw03-steps.png`: `e116dd1e775846c3ecf425914715aff6134d7e7636b51c8f30f0f8b22b040602`
- `docs/design-system/baselines/2026-10-24-strategy-workbench-v1.2/evidence/final/sw04-package-slots.png`: `019895b26b987b2705ac490c97135907dc7518f2d6ed31582e6e820b6b3af05c`
- `docs/design-system/baselines/2026-10-24-strategy-workbench-v1.2/evidence/final/sw05-multi-select.png`: `1fa0926255440b0f611eac71a2d98ffe5369b88db73c9658b85819d2745cd0d7`
- `docs/design-system/baselines/2026-10-24-strategy-workbench-v1.2/evidence/final/sw06-summary-detail.png`: `96375c46125f5011087160973a3e6a6d9b41e15e684e134231c0d98b8944da40`
- `docs/design-system/baselines/2026-10-24-strategy-workbench-v1.2/evidence/final/sw07-replay.png`: `34fc84aede0fd532617b3c67d4a8eeda30ae4cb8eb1234ef47d9c92755b954b1`
- `docs/design-system/baselines/2026-10-24-strategy-workbench-v1.2/evidence/final/sw08-recovery.png`: `d7687345b6a5b839141d140f186dca5807c80154fb1f0e0b2559432672020a40`
- `docs/design-system/shared/strategy-workbench-v1.2/manual.html`: `36fdad15f5789255290e8fc95fefaf43d4452093d27fa5332019444d4fd40f1f`
- `docs/design-system/shared/strategy-workbench-v1.2/build-samples.py`: `a3a2298069026d52dd1258ef9a0bb525e3c713778480af42e72e6657afca1429`

- `docs/design-system/baselines/2026-10-24-strategy-workbench-v1.2/evidence/final/06-observe.png`: `c95f4b78135cba2f13d4362569c95dcd2ae5d1df864d409cc6942002776d2f2b`
- `docs/design-system/baselines/2026-10-24-strategy-workbench-v1.2/evidence/final/06-observe-status-detail.png`: `7a11909d74d90c42185c969fbc160419a392523f3767d23ae38fa4d90f4c2b40`（与round2同名文件一致）
