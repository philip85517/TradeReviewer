# 真实数据库运行时接线验收 · 第 1 / 3 轮

协调验收 /root，2026-10-24。**连接已生效；整体 open / acceptance-failed。** 不宣称完整只读或首页 V2.5 已通过。

## 冻结条件

- worktree：`/Users/zhoulin/.codex/worktrees/0dc6/TradeReview`；detached HEAD `58bf0d90e68ddc634de180b3f5c3d16a089f0eb3`，已有 dirty 产品变更保留。[887 文件 manifest](CONTENT-MANIFEST.json) SHA256 `3ae7aaf831971e1a190a27923db8610cdcc93e915cebf9fed73fb7ddd0742539`。
- 本任务只修改运行入口与证据/说明，不修改产品源代码或配置。本轮未运行构建/全仓测试；它们不用于证明运行时 DB 切换，既有失败未撤销。
- 服务：PID 29149 / 会话 97376，Node 26.0.0 / SQLite 3.53.0，127.0.0.1:3333；[启动命令](STARTUP.md)。[末次服务输出](SERVICE-FINAL-OUTPUT.txt)与 2026-10-24T01:49:26Z 的 API 200 核对确认服务仍运行。
- 数据：项目真实共享库，1,866 executions / 213 imports / 236 instruments；最终实盘、全部账户、A 股、按标的浏览、第一页 1–52/52，导航收起，无弹窗。
- 浏览器：现有 IAB tab 1，本轮读取新服务数据，最终只读 AX 检查与截图；未主动 reload。CSS viewport 319×694，DPR 2；visualViewport 304×694，scale 1；window scroll 0/0。截图像素尺寸与 CSS 尺寸分别对待。
- 触发：数据源 wiring 运行切换。局部范围为当前交易库可见数据、性质和市场切换；不是全控件或整页改版。未实施新视觉样式，现有 UI 为参考。排除全控件普查、写操作验收、图表/回放、V2.5 设计保真及已暂停的财务/性能开发；这些不算 PASS。

## 独立门槛

| 门槛 | 结果 | 证据 / 限制 |
| --- | --- | --- |
| 进程实际连接业务绝对路径 | PASS | SERVICE-OPEN-FILES.txt，cwd / DB / WAL / SHM |
| API 与真实库 ID 集合一致 | PASS | API-FINAL.json，三类集合完全匹配 |
| 普通库可见真实数据 | PASS | FINAL-UI-FULL.txt、FINAL-REAL-DATABASE.jpg；A 股 52/85，7 个真实账户选项 |
| 保留原首页范围 URL 并显示记录 | FAIL | CURRENT-UI.txt，原入口 strict live 资格显示 0；最终改为普通 /trades，本地恢复 A 股 |
| 主动刷新 / 返回后的状态保持 | NOT VERIFIED | 刷新被自动审批拒绝；未进行返回旅程 |
| 核心四表内容保护 | FAIL | BUSINESS-FINAL.json；前三表和迁移未变，reviews 摘要改变 |
| 核心 write flow 闭环 | NOT APPLICABLE | 本轮不执行写验收；自动写入副作用另列 FAIL |
| 独立视觉同态比较 | NOT VERIFIED | 未取得独立截图同态比较，Astra 只审查源码与保存的文本证据；截图仅证明当前数据状态 |

## 局部控件登记与真实结果

全部定位来自现有 AX；只验证下列 5 项，不从其它控件推导通过。选项按实测边界计，不要求与数据连接无关的全部 7 市场或账户逐一操作。

| ID / 定位 | 前态、动作 / 输入 | 预期及状态合同 | 实际 / 证据 | 状态 |
| --- | --- | --- | --- | --- |
| UI01 / 交易库列表 | 原首页 query，服务更换后读取当前状态 | URL 范围保留且真实库存可见 | 0；CURRENT-UI.txt，显式性质与普通库推导不同 | FAIL |
| UI02a / 交易性质 | 切换来源未知，真实下拉选择 | 按普通库未知性质过滤，空态可见 | 普通 /trades，0；LATEST-UI.txt | PASS，仅证明该选项与状态 |
| UI02b / 交易性质 | 来源未知→实盘，真实下拉选择 | 本地共享性质变实盘，列表显示旧券商实盘 | 232/732；REAL-BUSINESS-LIVE-UI.txt | PASS |
| UI03 / 按市场筛选 | 全市场实盘→A 股，真实下拉选择 | 账户不变，本地市场筛选，列表与汇总变化；不要求网络阶段 | 52/85、全部账户、A 股；FINAL-UI-FULL.txt / PNG | PASS |
| UI04 / reload | 尝试主动刷新 | 重载后范围和真实库存仍可读 | 自动审批拒绝，未执行 | NOT VERIFIED |

执行覆盖 4/5；有结果项 PASS 3、FAIL 1，结果通过 3/4。3 个范围/选项动作有真实选择和结果证据；未记录每次底层鼠标与键盘输入差别，因此点击覆盖、键盘覆盖、模拟/物理触控均 NOT VERIFIED，不以选择成功冒充某种输入方式。未知/实盘/A 股的状态选项覆盖 3/3，仅限该边界。没有空间位移测量或断点对照，不主张这些通过。刷新尝试未获执行，不能计入执行覆盖。

## 问题与独立审计

原范围空态为合同差异，未将 1,784 条 SQL NULL 改成显式 live。完整只读失败详见[自动写入问题票](issues/02-automatic-writes.md)，保留前后摘要、更新内容的证明边界和不回滚原因。[诊断](DIAGNOSIS.md)含统一后续方案与 Astra 独立审计范围。

自动审批拒绝刷新，理由：初始化及自动迁移/元数据写入可能修改业务库，与本轮只读限制冲突。未绕过拒绝。当前连接及显示结果可以报告；刷新、原 URL 合同与只读保护不能签收。第 2 轮未开始，P1/F07 / Bars 的 3/3 暂停不变。

## 2026-10-24 当前桌面首页补充诊断

[新独立诊断](../desktop-home-db-diagnosis-2026-10-24/FINAL-ACCEPTANCE.md)在当前1440×900真实桌面首页确认：3333仍连接共享业务库，API/DB三类完整ID摘要一致；首页首读timeout未接受财务数据，空seed却显示为暂无持仓，且历史未接线。旧窄屏普通交易库的52/85不能证明桌面首页通过。原第1/3轮acceptance-failed、自动写入失败及暂停记录均保留；此次仅诊断，不启动第2轮或第4轮修复。
