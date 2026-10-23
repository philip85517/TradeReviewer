# P1 第2候选前的独立调试裁定

2026-10-23 02:10 CST，root；实现与只读诊断实际模型均为 `gpt-6.1-sol / ultra`。P1 第1/3轮 FAIL 保留，以下诊断不增加或重置正式接受轮次。

独立报告：`../resume-2026-10-23/P1-state-peer/WORKSPACE-THREE-FAIL-ROOT-CAUSE.md`。相同三项 HEAD 3 PASS / freeze-1 3 FAIL；单变量 cash selector、aliases 响应及真实 canonical→entry→scope 观察已由 root 直接阅读。原失败不删、不补原始成交 nature。

- W01 是真实产品可达性回归：legacy tiger/futu 缺 nature 的 canonical unknown 在全局普通库三个性质选项下均不可达。采用有限方案 A 区分裸 `/trades` 全局上下文与完整查询的首页来源集合。裸入口保留既有 shared-scope legacy 兼容；带来源查询的 live 集合坚持显式 live。直接加载和 back/forward 应由地址一致推导上下文，不由临时 UI 标志猜测。
- **首页导航的交易库入口仍是首页来源入口**：原 HP06:436–464 要求带已应用市场、账户、日期；不能为了 legacy 测试恢复而把首页导航改为裸 URL。只有直接全局入口或其他页全局导航可以使用裸 `/trades`。旧测试若目的是验证全局 legacy guard/展开返回，可明确建立全局入口上下文，保留原始缺 nature 数据及完整 guard 断言；另新增首页非默认来源范围与同证券 unknown 不扩大的反例。
- W02 只修旧位置 selector：数据管理仍可见保存成功、摘要503与只读重试；保留 expectedRevision、PUT仅一次和重试仅读约束。真实保存、返回及 reload 不由 mock PASS 代替。
- W03 修按 endpoint 的合法 aliases double；真实 aliases 错误须明确失败/重试、成功后恢复原范围，不能放宽 validator 或静默扩大账户。修 mock 后继续发生的 W01 必须修产品，不能归类为 fixture 缺陷。
- M01 必须分别核验 broad PUT 写入与历史 bootstrap 读取信任边界。新增写入必须复用官方 exchange 校验；历史已存无效 code/provider/date 不能仅因 code truthy 生成可信证券身份。先最小 RED，后在原有限范围 fail-closed，不迁移、不改交易或原 instrument 身份。

后续仍由 integration 单一 owner 修复并冻结第2候选；root 独立执行功能、真实状态/持久化、视觉及控件门槛。P2/P3 仅允许只读接口与反例准备，未放行产品实施。最小真实往返与首张完整页面视觉可单独签署为后续实施依赖门，不能据此将完整 P1 的 FAIL / NOT VERIFIED 改成 PASS。
