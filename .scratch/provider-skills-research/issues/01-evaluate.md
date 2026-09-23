# 长桥、AKShare、富途数据源与 Skill 可用性研究

ID: provider-skills-research-01
State: closed
Status: completed
Assignee: /root

## What to build

依据官方文档、官方代码和明确标识的社区封装，比较 Skill 身份、账户门槛、行情费用、市场与周期覆盖、配额、口径、运维和全市场建库适用性。将结论保存到 docs/adr，不修改已批准的数据源路由。

## Blocked by

无。

## 验收标准

- [x] 三个平台各有可追溯的一手资料研究记录。
- [x] 区分 Skill、接入 SDK 和真正的上游行情源。
- [x] 明确免费、注册、开户、资产门槛与地区权限的区别。
- [x] 给出适用于 TradeReview 的选型建议与待验证项。
- [x] 不将公开文档核验描述为已登录账户实测。

## Resolution

协调者已阅读三份附件，并独立核对官方 Skill 页面、账户规则、长桥历史额度及富途 OpenD 历史接口。汇总见 [ADR 0007](../../../docs/adr/0007-provider-skills-feasibility.md)。本次只写研究文档，未改变生产路由、未安装/登录或访问业务数据库。
