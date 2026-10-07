# 全仓单测修复

State: closed
Status: accepted
Coordinator: /root
User request: “先进行全仓单测的修复工作” (2026-10-06)

## 契约
目标是使当前完整 `npm run test:unit` 通过，修复实际根因并保持现有批准的交互、数据安全和领域口径。先复现65个已记录失败，区分功能回归、过时 fixture/入口与并发资源导致的超时。不删除、跳过或弱化断言，不通过提高项目默认 timeout 掩盖失败。任何涉及生产实现的变更必须先有红色可复现用例，并扩充覆盖与适用浏览器/设计验收。

保留上一任务未提交工作与历史失败证据；不提交、推送、合并或部署。正式3022服务、正式SQLite和调试3333服务保持现状。自动化写入仅使用自有临时DB，不读取业务库生成fixture。

## 所有权与验收
01 workspace: 四处父工作区/回放入口相关失败；主工作区和测试仅在诊断确认后授权文件修改。
02 async-fixtures: dashboard/library/refresh/storage边界相关超时；先诊断，独立测试文件可在契约确认后修改。
03 holdings: 持仓日期fallback领域失败；领域模型/该测试可在红色用例及口径确认后修复。
04 coordinator: 部署超时、共享测试环境/配置、全量独立验收、文档与整合。

所有实现者为 gpt-5.6-luna medium；协调者独立复核。先派只读诊断，依据证据冻结小范围修复任务。最终仅协调者集中运行全仓套件，不并行多个全量命令。适用的 UI/数据验收由实际影响面决定；测试基础设施修复不冒充产品UI验收。

[Coverage](DESIGN-COVERAGE.md) · [Failure census](reports/prior-failure-census.json)

## 历史诊断记录（保留原始失败；最终结论见下）

Integration reopened: the frozen three-case probes and full 91-case file pass, but bare full-unit run finishes with 3062 passed / 2 failed / 6 existing skips in 488.87s. Confirmed-import context fails its default toolbar find at 3163ms; deferred alias restoration reads canonical persistence before its separate passive effect commits. Preserve all scoped PASS and full FAIL evidence. Both bounded test synchronization repairs are implemented and frozen for coordinator verification; overall completion awaits a new bare full run and native entrypoint checks. See FINAL-ACCEPTANCE.md and reports/full-unit-final.log.

Latest integration: bare full-unit-final-v2.log passes 3064 / 0 failures / 6 original skips (322 files), 449.66s; make deploy-test passes 57/57. Native make debug-test instead fails five cases at the live host 3333 port preflight (10/15 pass). R13 / issue08 authorizes test-only injection of the existing port probe for non-port scenarios, preserving the occupied-port rejection case and current preview service. Overall State remains open until this final native gap closes; the frozen full-unit evidence remains valid.

## 最终验收

Coordinator /root accepted all applicable gates. Bare `npm run test:unit`: 319 passed files / 3 existing corpus files skipped, 3064 passed / 0 failed / 6 original corpus tests skipped, 449.66s. `make deploy-test`: 57/57; `make debug-test`: 15/15. Typecheck, scoped ESLint, final whitespace/source-freeze checks and all four independent Spec/Quality reviews pass. No new skips, removed cases/assertions or raised timeouts. Native debug tests pass with the original 3333 listener retained. Historical failures remain archived. No deployment, service restart, formal database write, commit or remote action.

All R01–R13 and task issues are closed together. See [FINAL-ACCEPTANCE.md](FINAL-ACCEPTANCE.md) and reports/final-consistency.json for final evidence.
