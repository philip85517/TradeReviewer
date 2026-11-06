# 12 — 首页已存数据的原子读取凭证

State: closed
Status: accepted
Assignee: /root/astra_integration_design
Model: gpt-6-astra / ultra
集成负责人及独立接受: /root
验收轮次: 1/3 PASS（存储接口）；最多3轮，失败历史保留。

## Scope

采用 [审计方案 B](../evidence/resume-2026-10-24/astra-integration/backend-coverage/AUDIT-AND-CONTRACT.md)：小接口组合既有 Store/Recall 投影，显式同步读事务，枚举原表计数与孤儿校验，返回真实 knownAt、版本化 payload 绑定和投影缺口。存储枚举、财务表示、inception 三项分开，不输出 universe complete。

准确写面：新增 `app/lib/storage/homepage-source-snapshot.ts`、`homepage-source-contract.ts`、`app/api/storage/homepage-source/route.ts` 与定向测试；`sqlite-http-client.ts` 仅新增运行时验证的读取方法及测试；`sqlite-store.ts` 仅必要的既有 monthly 投影诊断 seam 与测试，不复制 provenance 规则。其他文件需先报 root。无客户端接线、财务计算、F/S1 或页面修改。

## Refs / journeys

HV25-06..22/23..31/32..43/47..53；原规格、元素及原图沿 [DESIGN-COVERAGE](../DESIGN-COVERAGE.md) 的55行，本切片落实数据输入合同，不改变视觉。从真实已存资料到首页 raw，失败不发布部分包；所有事务、计数、编码与投影诊断复杂性留在 storage Module。具体诊断、两个方案与逐反例见上方审计。

## Blocked by

无；客户端消费由 source owner另负责，禁止把本票PASS当成财务表示或页面PASS。

## Acceptance

- [x] 两连接真实 SQLite 并发提交，读取全旧或全新，禁止混合。
- [x] orphan/坏JSON/坏Recall整包失败；旧bootstrap不受新增接口失败条件影响。
- [x] 真空数据库合法；元素删除、receipt错配、计数/shape/digest不一致拒收。
- [x] projectionGaps真实反映既有monthly剥除；不能硬编码为空。
- [x] statement-only quantity5仍不推出universe完整/current0；metadata缺失不补stock，lifetime不补造。
- [x] root独立检查、定向回归、strict/lint、版本hash。

本票无UI，视觉与浏览器写入NA；隔离SQLite事务测试必需。保存原业务数据，不push/merge/publish。

[root独立接受](../evidence/resume-2026-10-24/root-stored-source/ROOT-ACCEPTANCE-1.md)：146测试、strict/lint、hash及真实隔离服务200通过。
