# v0.1 控件与独立覆盖记录

## 首轮反馈修订

2026-10-24：用户选定 A，并调整当前股票交易次数列表、持仓收起右侧记录区、自由多条 Text 及工具条尺寸。新版本的局部影响面登记、状态与独立证据见 [revision-01/acceptance.md](../../../../../../.scratch/review-workspace-design-map/evidence/immersive-layout/revision-01/acceptance.md)。下表保留为修订前的历史结果；旧 A/B/C、六场景、多股票、节点 Text 与持仓判断结果不代表新版本通过。

## 首稿历史验收

触发：完整桌面视觉原型开发后验收。范围包含所有可见和条件出现的原型控件；2026-10-24 IAB、1440×900/1280×800、DPR1。版本绑定到 `.scratch/review-workspace-design-map/evidence/immersive-layout/artifact-manifest.json`。验收者 coordinator，未编写 UI。PASS 只指下表限定的合成、内存行为。

|元素/稳定定位|控件、状态与独立检查|结果|
|---|---|---|
|W01 exit/resume-workspace/confirm-exit|顶栏返回、关闭→继续工作/查看记录/退出→返回；弹层互斥，返回后图表恢复|PASS|
|W01 顶栏导出、更多|真实 disabled，原因可读；没有成功假反馈|PASS：禁用；实际能力 NOT VERIFIED|
|W02 data-filter/clear-filter|名称/代码即时匹配、无匹配空态、清除恢复、输入焦点保留|PASS|
|W02 data-trade|600000/300750/601018 逐个选择；标的、首次入场截止变化；计划分别保留|PASS|
|W02/W11 records|顶栏和列表入口；当前记录、返回；退出原因与评分中文标签正确|PASS：内存记录|
|W03 D01–D13/H00|13 槽及拖动点保留；D02 可用，其余 disabled/title 原因；D06/D11/D12 名称仍待核|外观候选 PASS；完整 TV 功能 NOT VERIFIED|
|W04/W10 step/play|28→29 实际新增 K 与首次买入；29播放至33暂停，34加仓，41部分退出，49最终退出；末尾不越界|PASS|
|W10 next-node|33加仓前暂停、41/49退出后暂停；未来成交隐藏；末尾有反馈|PASS|
|W10 date/input/confirm/cancel|取消不推进；02-19→01-29 可回看并隐藏未来；03-04末尾|PASS|
|W10 data-speed|0.5、1、2 逐项选中；改变速度暂停并反馈|PASS|
|W10 日线/返回实时|禁用与原因准确；未伪装 TV 语义|PASS：禁用；实际能力 NOT VERIFIED|
|W10 hide-replay/show-replay|收起后经审阅条恢复；审阅条同时隐藏仍可先恢复审阅条|PASS|
|W05 data-direction|做多/做空；方向与三价顺序验证、风险和收益风险比联动|PASS|
|W05 data-plan|entry/stop/target/quantity；空值、非数字、错误顺序、长值；缺项未计算而非零|PASS|
|W05 data-scale|数量→金额→仓位→数量：56000→112000=2000股→56%；14%=500股|PASS|
|W05 data-funds/资金 details|资金值、来源；长来源不撑宽，结构切换回显；参考资金可折叠|PASS|
|W06 text-entry/D02/图表定位|T→图上时间价格定位→确认；当前节点文字可点击编辑|PASS|
|W06 text-confirm/text-cancel/Escape|确认后再编辑，取消/Esc恢复原值；未确认不写；场景切换清理待放置状态|PASS|
|W06 输入保护|播放后输入框/textarea 焦点暂停；图标同步播放；方向键在输入中不切结构|PASS：鼠标/键盘；系统 IME NOT VERIFIED|
|W07 toggle-left/toggle-right|1440四组合；1280互斥；1291/1292边界；画布扩宽、价格轴跟随、时点不跳|PASS|
|W08 data-judgment|持仓当前判断、返回入场/结构切换保留；持仓计划只读，未来退出隐藏|PASS|
|W09 data-early|未评价、是、否、不确定逐项；部分/最终退出剩余800/0与LIFO说明|PASS|
|W09 reason/adherence|退出原因输入；未评价/符合/部分符合/不符合逐项并回显|PASS|
|W09 data-rating|纪律/机会/仓位/体验，每维未评分、资料不足、1–5共28项；切布局保留|PASS；见 rating-checks.json|
|W12 previous/next-variant|A/B/C实质结构变化，URL更新，数据共用；B展开后连续编辑不收起|PASS|
|W12 data-scene|entry/holding/add/partial/exit/resume六项，精确截止与对应表单；退出回入场无未来泄漏|PASS|
|W12 hide-review/show-review|审阅条隐藏与恢复；不遮回放；刷新恢复URL视图且重置草稿|PASS|
|窄屏提示与返回链接|390×844仅诚实提示、返回阅读页入口；完整桌面布局恢复后图表重绘|提示 PASS；完整移动适配 NOT VERIFIED|
|图表库署名链接|保留供应商署名；外部网站不属于原型旅程，未操作|NOT APPLICABLE|

业务数据库、保存后重开、导出文件：NOT APPLICABLE，本轮只授权内存视觉原型。真实 TV 绘图生命周期、系统 IME、模拟/物理触摸、手机适配继续保留后续验证。全部 HITL 设计选择仍开放，不能用本表关闭设计票。
