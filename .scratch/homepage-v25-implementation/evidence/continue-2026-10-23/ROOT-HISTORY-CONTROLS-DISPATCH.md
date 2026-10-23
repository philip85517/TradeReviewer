# 历史组合选择器有限派发

2026-10-23，root。用户授权 GPT-6.1 SOL Ultra 并行开发。提前准备不读取金额的受控控件，不释放 P4 数据/图表/页面接线；P4 正式0/3及所有旧FAIL/NV保持。上级任务轮数不重置，子范围最多3次正式接受。

唯一实现 owner /root/responsive_shell；root整页视觉/完整数据流/独立验收。只允许新增 `app/components/homepage-v25/history-controls.tsx`、`history-controls.css`、`history-controls.test.tsx` 与 `evidence/P4/controls/` 证据。禁止其他产品/测试/配置/共享文档、Surface/host/Workspace/state/金融代码；不启动服务/浏览器/DB、不跑全套或性能、不派代理、不提交。

权威：V2.5正文HP05 349–394，特别357/361及manual103/107；原稿 `source/images/history.svg`、`journeys-year.svg`、`history-stats-cumulative.svg`、`history-stats-win.svg`、`history-stats-rounds.svg`、`history-stats-error.svg`。都在 `docs/design-system/baselines/2026-10-22-homepage-v2.5/`。root已读原文、SVG及round5/history.js和round4/ui-select.js，并直接看准确journeys-year派生PNG `evidence/continue-2026-10-23/history-year-reference.png`。旧round5/reference-history截图采用已被替换的三控件，不能当最新A组合。原型仅动作参考，不替代正文。HV25-33/34，HOME-HP05-B001。

接口用现有S的HomepageHistoryRange/ChartMode type-only。appliedRange、chartMode、rangeOptions（caller提供实际可选的单年/今年/区间/全部及稳定id和label）、pending/error、onRangeApply、onChartModeChange。leaf不推断最早交易/当前年份、不读时钟、不fetch/storage/金额、不自建committed范围。rangeOptions是实际业务输入，不硬编码2024–2026例子；四种S模式均须可表达，范围校验不接受非整数/反序。先提交简短接口/视觉/八态清单，不等新授权即可在本范围RED→单候选实现；需额外编辑器/新行为则先报告接口问题。

A组合：外盒36px高、282px基准宽、7px圆角，底111a26/边283448，两个独立trigger用下拉箭头，左范围右指标/中间20px细分隔线；14px文字、36px命中、居中。range文字年份/今年/全部，纯年份禁用日历图标；不添加常驻“按平仓时间·年份”副行。指标次序period-pnl/cumulative-pnl/win-rate/round-count，period单年/this-year为“每月净盈亏”，years/all为“每年净盈亏”；其他累计净盈亏/各期胜率/各期回合数。不得增粒度选择器。数字意义来自appliedRange，pending新目标不提前替换旧标题。

每个菜单键盘完整：触发打开、焦点到当前选项，Up/Down/Home/End只导航，Enter/Space显式提交，Esc/外点关闭并恢复原trigger焦点，Tab正常离开且关闭；一次只开一个菜单。pending保留旧applied/选择，禁止范围重复提交但允许关闭；error保旧applied并附近显示可读原因，可选范围重试；range menu空列表显示原因不假造选项。chartMode由caller受控，其切换不改变range/贡献模式，不触发range回调；pending是否允许metric交互保持独立。外部applied变更时同步selected，不回调反推，不关闭页面其他状态。

Popup绝对定位不挤页面；沿批准原型bg162233/border283448/6px radius、4px padding、选项7px/10px、hover/selected243b5c；reduced-motion。原图1440×1000中的组合x1102y42w282h36，范围文本1114/metric1228；这是图形坐标不是CSS断点。参考CSS视口1440×1000、1280×800、390×844；390可用342，两trigger仍同一组合，菜单不超viewport24px边距；长范围/错误不裁切、不覆盖当前字段。root最后独立看图。授权设计差异无。

核心可演示行为：受控2026→range打开→选择2024–2026请求→pending仍2026及每月净盈亏→失败仍2026并说明→再次请求→caller成功range才改变标签和period文案→切累计/胜率/回合仅报告mode；Esc/Tab/外点无range回调。真实历史金额/贡献原子刷新、保存/返回reload均留后续整合NOT VERIFIED，无写入leaf DB门N/A。

先记录局部完整控件/选项动态实例与八态分母、准确Refs/几何/关键状态/功能与浏览器三门。TDD只此定向套件及依赖tsc/lint，保留RED/GREEN和文件SHA。无真实浏览器则视觉/E2E一律NV，不能从jsdom宣称整票通过。候选冻结后root独立测试与最终接线验收。
