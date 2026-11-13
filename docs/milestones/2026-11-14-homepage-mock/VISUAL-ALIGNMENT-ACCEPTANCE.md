# 首页视觉修正与切换防闪

本轮只处理已报告的 D01–D06 和市场切换等待闪现。用户已授权推进；root 实施并整合，独立审查另见 [review](VISUAL-ALIGNMENT-REVIEW.md)。整个 Mock 阶段的剩余验收仍由 11 号任务承接。

## 改了什么

- 请求照常立即发出，结果返回后立即提交；只有持续超过 250ms 的读取才显示“更新中”和卡片等待装饰。替换请求重新计时，取消、成功、失败和卸载清理反馈计时器。真实 pending 仍立即保护导出、翻页等操作。
- 日期面板靠近日期入口并右对齐，恢复标题下 20px 间距；窄屏按视口边界收纳。
- 恢复市场选中颜色和账户下拉箭头；期间快捷项、搜索、导出、持仓列名/身份/查看图标按参考调整。
- 成本价和最新价保持原币单价，每项明确 CNY/HKD/USD；市值、盈亏仍按报告币种显示。没有无依据换算单价。
- 独立复核发现窄屏浮盈表头换行后，补齐单行样式；不缩字号、不改列宽，复拍390横滚、1101/1099及两种桌面。

250ms 是反馈阈值，不是请求延迟，也不证明真实后端达到 1 秒。原币单位标签是为避免误导而保留的明确差异；相较参考两列增加 12px 单位字样，数值字号和列宽不变。原有按正文优先的图轴单位、无满图日点、无导航计数及 2px 模块间距差异继续保留，见前次报告。

## 版本与环境

- 分支 `codex/latest-system-preview-20261106`，基线 `6ddbeca09b9eaf1b6d88488e6e154839217cb74b`，保留既有未提交修改。
- 最终 20 文件源码快照 `18ca3bd95ea15f45d4d9f21fea7e2ba5dc8aacc67307769e093b0c9343a33e39`：[manifest](evidence/visual-alignment/source-manifest.json)。前一阶段 `a443138c…` 的35图、交互与几何仍绑定[原源码](evidence/visual-alignment/source-manifest-a443138c.json)和[原几何](evidence/visual-alignment/browser-facts.json)。独立复核发现 VA-R01 后仅追加表头 nowrap；最终6图和几何绑定[最终图片指纹](evidence/visual-alignment/final-image-manifest.json)及[最终几何](evidence/visual-alignment/final-browser-facts.json)。不把旧图伪绑定新版本；历史 `dc063d8b…` 和 VA-R01 的 FAIL 保留。
- 真实 Chrome，DPR1、100%缩放；1440×1000、1280×800、1101/1099/901/899×800、390×844。测试入口 `http://127.0.0.1:3333/preview/homepage`，数据为固定 2026-10-15 Mock。
- 正式来源：V2.5 `visual-design.candidate.md`、`home-1440.svg`、`home-1280.svg`、`period.svg`；截图与状态图的准确映射继承 [V2.5 canonical design](../../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md)。不以旧截图替代正文规范。

## 本轮控件与旅程验收

| 元素 / 状态 | 实际核验与证据 | 结论 |
| --- | --- | --- |
| CP0.scope.market，快速读取 | 鼠标四市场逐次切换，URL、选中态、币种和数据一起提交；港股 Space 键实例；`fast-*-1280.jpg`。可控请求测试覆盖 30ms 完成、249/250ms 边界 | PASS（这些实例）；不是逐帧摄录结论 |
| CP0.status.stale，慢请求 | 3 秒切换，250ms 后出现等待和取消；保持旧范围和旧值。`slow-pending/ready/before-cancel/cancelled-1280.jpg` | PASS；桌面四卡 y124、图表 y228/h320、持仓 y588 不变 |
| 连续请求 / 取消 / 失败 | 组件真实路径测试确认替换后重新计时、取消清除、错误立即可见；浏览器取消美股仍留港股，失败切美股仍留港股并说明未应用，`failure-retains-HK-1280.jpg` | PASS；忽略 abort 的迟到结果由既有组件反例保护 |
| CP0.period.custom/start/cancel | 双桌面及 390 打开、反向日期错误、取消；桌面另验 Esc 恢复日期入口焦点。`date-open-*` / `date-error-*` | PASS（所列路径）；完整日期矩阵不扩展 |
| CP0.scope.account | 海外账户选择再回全部；自绘箭头无点击拦截，`account-2-1280.jpg` | PASS（鼠标选择实例）；完整键盘矩阵 NOT VERIFIED |
| CP0.holdings.summary/readout | 两种桌面正常、1440 长金额、390 长名称/金额、空态；176px 搜索、44px 导出、原币单价、交易所:代码和蓝色文档图标 | PASS（所列状态的主代理检查）；独立视觉结论见 review |
| CP0.holdings.search/sort-export | 实际输入“腾讯”后 1 条、清除回 8 条；市值排序提交 URL `sort=marketValue&direction=desc`，`search-applied-1440.jpg` / `sorted-value-1440.jpg` | PASS（实例）；CSV 按钮可操作，5 秒内未收到 download 事件，文件端到端仍 NOT VERIFIED |
| CP0.page.scroll/table-scroll | 390 实际纵向 wheel 到分页、表格横向 wheel 到查看列；页面宽度不超过视口，表内独立滚动，`holdings-scroll/right-390.jpg` | PASS（鼠标/滚轮）；触控 NOT VERIFIED |
| CP0.detail.return | 390 横滚后腾讯详情、Esc 返回；1440 腾讯详情、关闭返回。原行焦点恢复，390 y984.5、1440 y170 保持；`detail-390/1440.jpg` / `detail-return-390.jpg` | PASS（这两个实例）；不是全部对象重验 |
| CP0.page.responsive | 1100/900 断点两侧、390；正常、日期错误、长值和空态，`breakpoint-*` / `normal-390` / `extreme-*` / `empty-390` | PASS（所列布局）；没有新增移动设计稿或物理触控证据 |

快/慢请求在同一视口下主要容器的文档坐标保持一致；操作造成的浏览器自动滚动与布局变化分开记录。汇总文字随数字字宽有自然变化，不影响搜索、导出及模块定位。此轮不重验图表全部日点、全部金额焦点/hover、完整 IME、动效逐帧、软件键盘和触控；原 NOT VERIFIED 保留。历史、贡献、全局搜索、附加筛选和真实后端仍未进入本轮。

## 自动检查

- 组件新增反例先失败后通过，首页组件 23/23；包括快请求、替换/取消/失败和原币显示。原取消按钮测试按延迟可见反馈等待。
- 类型检查、涉及文件 ESLint 通过。
- `npm test`：生产构建和 5 项原生测试通过；表头CSS增量后再次通过，[最终日志](project-test-visual-alignment-final.log)。
- 全量 Vitest：3100 通过、4 失败、6 跳过；4 项均为 5 秒超时，[原日志](unit-visual-alignment.log)。串行复测后 workspace 两项通过，真实仓库部署 staging 与 Tiger US daily 两项仍超时：[复测日志](unit-timeout-recheck.log)。相关文件未在本轮修改，未将其冒称为通过或已证实的基线问题。

Mock 无持久化写流程；本轮不访问业务数据，数据库写入/返回/重载验收为 NOT APPLICABLE（只读样例范围）。全量测试并非全绿；本轮 UI 结论和项目级检查分别报告。

## 接受状态

主代理已执行上述本轮检查，最终真实Chrome已复拍并恢复临时视口、保留预览；3333新鲜HTTP200，服务仍运行（npm run dev，会话94946）。启动时已确认旧服务不在、隔离库无进程占用，将残留空锁重命名留存后按标准入口创建WAL一致性备份；未切端口或写业务库。[交付记录](evidence/visual-alignment/delivery-final.json)。独立审查者直接对照参考与最终桌面/窄屏图片，核对源码和图片指纹；D01–D06及250ms防闪 **PASS**，VA-R01表头换行已关闭，首次FAIL保留，详见[独立报告](VISUAL-ALIGNMENT-REVIEW.md)。root接受本票有界修正。不得据此签整个 Mock 阶段通过，也不得推出真实数据库、财务正确性或 1 秒性能结论。
