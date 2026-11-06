# 后端设计审查覆盖

2026-10-25；文档 owner / 集成负责人：root。独立审查另见 [DOCUMENT-REVIEW](DOCUMENT-REVIEW.md)。所有目标模块目前都是候选，不以本表的“已写”表示设计已接受。

## 范围与依据

用户确认：全局总图＋读取链路深入；现状与目标分成两份。采用视觉规范的总分写作方法，而非复制其 UI 尺寸或编号。精确参考为 [V2.5 视觉正文](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md) 的 HP01、HP02、HP04、HP05、HP06、HP09 及 entry-contract，以及 [交易库 V1.0 正文](../../docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/visual-design.candidate.md)。本轮无界面更改，参考图像／比较 viewport／控件库存与实际持久化验收不适用；没有声明 UI 或数据库通过。

## 需求 → 文档 → 场景 → 证据

|需求／要素|精确依据|文档位置／owner|用户路径／验证材料|当前状态|
|---|---|---|---|---|
|总分结构与功能树|本轮用户原话“TopDown…功能…功能拆解”|AS01–AS03、BD01–BD03；root|导入到复盘的全局功能表和协作图|已写，待用户 review|
|领域划分与运行位置|用户范围选择；现有 ADR、源码|AS02、BD03；root|浏览器／Node／SQLite区别；非深入领域明确概要|已写，非全后端审计|
|模块、子模块与处理对象|用户“先review到模块…处理对象”|AS04、BD04/M01–M08；root|每模块功能、规则、输入输出、失败、对象映射|候选，待模块所有权决策|
|数据对象模型与关系|用户“数据对象模型”|AS04、BD05；root|来源→成交／辅助证据→快照→资格→领域结果→页面结果|候选，待业务关系决策|
|输入解释与必要辅助边界|月结导入设计第1–6项、CONTEXT参考现金选择|AS04.1/4.4、BD04/M01/M04；root|账户事件、无成交月、公司行动、重导|待辅助范围决策|
|读协议与校验层次|homepage-source contract / snapshot / acquisition|AS03、AS05、BD04/M03、BD06；root|结构／计数／摘要不替代历史覆盖和计算资格|待协议与资格决策|
|问题树与证据|Q02新旧对照、既有REVIEW|AS06、BD06/BD08；root|228证据缺口不等于丢成交；超时单独成链|已有诊断引用；本轮未重测|
|未知／空／失败语义|V2.5 HP01、HP04空态、HP05、HP09|BD04/M06–M08、BD06；root|无持仓、搜索空、缺价、首次失败、更新失败|候选状态模型，视觉要求保留|
|范围、返回与发布|V2.5 HP03、HP06、HP09、entry-contract|BD02、BD04/M05/M08、BD05；root|市场账户切换、进入库、返回及迟到结果|待发布与所有权决策|
|完整一秒与暂停边界|用户采用边界与保持暂停的真实选择；原优化地图|BD07–BD08；root|冷热／重启／修订首读；外部补齐分开|约束保留，未执行性能验收|
|事实与建议分开|用户选择两份文档|README、current-state、target-design.candidate；root|独立文件与“现有／候选／待决策”标识|已写；未冻结|
|可逐项review的地图|wayfinder＋项目tracker|issues/00-map 与六张子票；root|先创建所有票，再接线；frontier只读派生|charted；全部open/unassigned|

## 证据与排除

- [源快照](evidence/source-snapshot.json)：当前HEAD、关键源文件SHA与其 dirty/untracked 状态。
- [Q02诊断](../homepage-design-logic-review-2026-10-24/questions/Q02-LEGACY-HOMEPAGE-DIFF.md)：动态实验的范围、输入、失效条件和历史日志；没有冒充本轮重新执行。
- [文档验核记录](DOCUMENT-REVIEW.md)：相对链接、依赖、独立检查及本轮改动范围。
- UI／数据库／性能执行：NOT APPLICABLE（文档产出）；当前首页产品问题仍未接受，不因此转为PASS。
