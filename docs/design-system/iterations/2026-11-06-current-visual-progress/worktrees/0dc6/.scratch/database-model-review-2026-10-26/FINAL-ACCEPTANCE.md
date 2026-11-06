# 数据库建模文档与独立审查验收

State: closed
Status: accepted
验收者: root
日期: 2026-10-26

**接受本轮数据库现状、公开研究和审查材料；不接受或宣称产品问题已经修复。** 交付入口为[阅读导航](../../docs/backend-design/database-review/README.md)，核心判断见[综合报告](../../docs/backend-design/database-review/REVIEW.md)。

## 1. 范围与版本

本轮是文档/设计审查，不改产品、表结构或业务数据。检查当前脏工作区，HEAD `58bf0d90e68ddc634de180b3f5c3d16a089f0eb3`，不冒称远端 master。受保护代码指纹见[source-baseline.json](evidence/source-baseline.json)。三名 Agent 均为用户指定 GPT 6.1 Sol Ultra，任务边界互不覆盖，报告由 root 综合验收。

财务 P1/F07 与 Bars 保持暂停；本轮没有恢复、重置失败记录或验收轮数。没有 commit/push/merge/publish。

## 2. 逐项独立验收与轮数

每项上限3轮，未发生超限。轮次指本轮审查材料的反馈迭代，不改变旧开发任务轮数。

|任务|验收轮次|结果|root 独立核验与限制|
|---|---|---|---|
|01 结构与逻辑模型|2/3|ACCEPTED（报告）|首轮要求补齐跨账户反例、修正引用和3→4项摘要；第二轮检查S01–04与真实Store反例、FK/事务/RecallCAS依据及待验证风险分级|
|02 网页功能与生命周期|2/3|ACCEPTED（报告）|首轮要求澄清source_fingerprint可空唯一列未被writer填充；第二轮核对修订措辞及首页全局资格、历史空输入、范围行情读取证据|
|03 公开实践|1/3|ACCEPTED（研究）|核对相关性、固定提交及限制；root另取Ghostfolio模型和Portfolio Performance配对对象源码，并查阅SQLite官方及Money原文|
|04 综合与现状附录|1/3|ACCEPTED（文档交付）|root核对迁移提取、45+1表分组、50索引、4项反例、链接、受保护源码与事实/推断边界|

三路报告原文见[结构](../../docs/backend-design/database-review/schema-review.md)、[功能](../../docs/backend-design/database-review/feature-review.md)、[公开实践](../../docs/backend-design/database-review/external-practices.md)。各报告自身没有执行的检查仍保持未验证；整合时不得把研究者的源码推断升级为在线事故。

## 3. 已执行证据

**全部数据库操作均在内存空库中使用虚构记录。** 未打开业务数据库，未启动产品服务，未发送HTTP写入请求。

- [迁移提取脚本](evidence/inspect-schema.mjs)使用固定 Node 26.0.0／SQLite 3.53.0，顺序执行14迁移，得到45业务表+1结构记录表、50索引条目（2显式+48主键/唯一自动索引）。[结构JSON](evidence/schema.json)、[SQL](evidence/schema.sql)保留元数据。空库FK检查结果不代表在线库质量。
- [Store反例脚本](evidence/store-probes.test.ts)导入真实`SqliteStore`，4/4通过，含义是四项问题已复现：跨账户误去重、非法数值/时间落库、改证券身份改变旧读取、旧替换覆盖新修订。[执行结果](evidence/store-probes.json)保留测试状态。没有实现修复，不能称修复回归通过。
- [公开资料复核](evidence/public-root-verification.json)记录root取得的固定源码URL和Git blob SHA，包含官方规则复核；只发送公开路径，不上传私有源码或交易数据。
- [最终文档核验](evidence/document-verification.json)记录受保护文件892项、结构覆盖、引用和产物指纹。技术附录含全部46张表。文档证据范围不要求运行全产品测试。

## 4. 明确保留的未验证项

|门槛|状态及理由|
|---|---|
|现状结构与主要业务链路文档|PASS，限当前代码定义与已读链路|
|四项Store反例|PASS，问题复现；非修复通过|
|DB05跨市场/账户资格反例|NOT VERIFIED，静态链路已核实，未执行fixture|
|在线库迁移版本、记录数、数据损坏情况|NOT VERIFIED，未连接在线库|
|真实HTTP写入、桌面页面、返回/刷新持久化|NOT VERIFIED，本轮未运行产品；文档交付不承担该产品验收|
|UI视觉/控件/输入设备|NOT APPLICABLE，纯文档与设计审查，没有修改网页或阅读器|
|完整首屏≤1秒|NOT VERIFIED，无本轮性能测量；门槛不变|
|财务/Bars实现和回归|PAUSED，遵守原暂停决定|

root签署：本次范围内文档及审查证据接受；待验证问题和候选设计决策继续保留，不产生隐含实施授权。
