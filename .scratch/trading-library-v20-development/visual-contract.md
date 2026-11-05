# 交易库 V2.0 视觉契约

这是已批准合同的执行索引，不增加设计授权。主来源 [V2.0](../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md) L43–89；逻辑以[业务规范](../../docs/design-system/trading-library-design-spec.md)优先；全站基础/首页入口沿[V2.5](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md)。图片完整路径和版本hash见evidence/source-manifest.json。

|责任|唯一owner|
|---|---|
|整页视觉一致性、入口/返回跨组件体验|root / INTEGRATOR|
|完整数据与持久化链|DATA角色，领取前指定唯一执行人|
|独立同状态视觉比较|未实现所审UI的VISUAL-REVIEWER，不能由worker自签|

## 可比较条件与参考

|画面|准确主参考|比较条件|
|---|---|---|
|实盘列表|[E实盘列表](../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/approved-e-live-list-1440.jpg)|1440×1000；另以journeys-date-1280.svg核1280×800；成交日/含未平仓|
|实盘统计|[E实盘统计](../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/approved-e-live-stats-1440.jpg)|1440×1000、1280×800；01-live-normal.svg定义回合日期语义；长页完整截图|
|模拟列表|[E模拟列表](../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/approved-e-sim-list-1440.jpg)|同上；hcr06-final-sim-ab.svg定义练习身份与日期|
|模拟统计|[E模拟统计](../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/approved-e-sim-stats-1440.jpg)|同上；02-simulation-normal.svg定义6/5/1、388、60%|
|详情、复盘、返回、异常/分布|V2.0 BT04–BT07逐状态图；DESIGN-COVERAGE每行精确引用|相同阶段、筛选、账户、侧栏/导航状态、近似文本/数据密度；禁止用不同状态截图抵消偏差|
|首页来源恢复|journeys-home-entry.svg、journeys-library-return.svg|复用1440×2346完整首页，校验目标滚动位置及焦点；本次仅改入口/返回影响面|
|回放受影响布局|[既有图表要求](../../docs/specs/2026-09-25-chart-first-review-ui.md) L100–119及现有批准阶段画板|1440×900、1280×800、约390px；导航展开；真实手机软件键盘独立证据|

CSS视口、DPR、缩放、浏览器和截图像素必须记录；原稿未给出DPR，不假定等于2。1280版仍保持字号/命中盒，不等比缩小。交易库没有批准的独立手机重排稿：沿既有容器/公共规范核受影响响应式，出现无法保持合同的边界回决策，不能临时发明新双栏/全屏弹层。手机真实键盘检查是回放既有合同，桌面窄屏不替代。

## 固定几何、层级与密度

- 顶栏64px仅“交易库”；全局侧栏72px；二级栏58px，实/模拟与列表/统计相邻。内容左缘96px、右24px；不加视角label/重复面包屑/返回首页，首页由侧栏恢复。
- 自然长页：普通画布至少1000px、窄版至少800px；统计、明细、异常向下增长并纵向滚动，不能裁掉底部或压缩字号。
- 字号/行高：标题24/32、模块18/24、正文控件14/20、说明12/16、指标28/34。表头数值与数据共用**字形右缘**；名称/说明左对齐，动作居中。
- 搜索宽220px，刷新36×36px且与搜索相隔28px；筛选浮层320px、字段36px；公共图标16px，搜索/筛选18px，命中盒36px。日期用日历、年份用箭头，静态日期无多余图标。
- 模拟背景#111E2C，卡#162332，边#40566D，顶部2px #607C96；按钮蓝；盈#53D7A0、亏#FF8592。交易方向、盈亏、复盘状态分别表达，不互相冒用颜色语义。
- 信息i：hit36px/icon16px，hover/focus开、Esc/外点关，宽280px且边缘避让；费用、资格/分母、估值、切点详细可查，不卡片常驻长文。
- 金额abs≥1万/≥1亿缩写两位，不新增“万亿”；价/率两位；完整值由详情/tooltip/聚焦/复制/导出可查，缩写不改数据；窄占比按V第五章换行。

## 状态与空间预算

首个完整画面就独立对照，不能等票19才首次看图。每票保存点击前/中/后工具区、主体、浮层、卡片、表格、下游底部rect；量化高度变化及原因。加载/更新/失败保留最终槽位，旧完整scope和值不可与新条件混搭；长说明/长名/展开/错误下游允许自然增长但不遮挡/跳焦点。

回放侧栏列内开合不推进双截止、不改既有观察窗口；轴与输入分隔12–16px，开栏/resize不能覆盖主动导航结果。精确优先级由D06核对现有SDK后冻结，不能凭同步mock决定。

本轮授权偏差：**无**。E历史图数字/旧标签不作业务权威，正文与逐状态图优先；fixture只检验已确认口径，LIFO与human_action_id示例不推出生产识别。原型底部“视觉样例”工具排除正式产品。新增导入冲突、资料补正等未批准画面需在对应决策中形成批准稿；不用无交易空图冒充。

独立视觉的FAIL/NOT VERIFIED逐项保留，严重设计差距不能被测试通过、无overflow或总体评分抵消。鼠标、键盘、模拟触控与物理触控记录分开。
