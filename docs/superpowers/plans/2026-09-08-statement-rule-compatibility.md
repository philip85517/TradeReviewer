# 月结单规则兼容性重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把券商、模板和时间推断规则抽成可注册、可版本化的深模块，保持现有导入结果并让未知版本明确进入复核。

**Architecture:** 在 dispatcher 与具体解析器之间建立适配器注册表；在富途 PDF 解析器内部建立模板 profile seam；时间推断通过版本化策略输入会话规则并输出候选证据。解析器保留 PDF 几何和金额守恒实现，避免只做文件搬迁式重构。

**Tech Stack:** TypeScript, Vitest, PDF.js 页面模型, Temporal polyfill, Decimal.js。

**Spec:** `docs/superpowers/specs/2026-09-08-statement-rule-compatibility-design.md`

## Global Constraints

- 不改变现有导入结果、复盘数据模型和数据库结构。
- 不用文件名作为唯一格式判断依据。
- 未知模板必须阻断或标记复核，不能静默套用旧模板。
- 新规则必须带稳定的 rule/template ID 和原始证据。
- 不引入运行时依赖。

---

### Task 1: 建立规则领域模型和失败测试

**Files:**
- Create: `app/lib/import/statement-rules.ts`
- Test: `app/lib/import/statement-rules.test.ts`
- Modify: `app/lib/trades/types.ts`

**Interfaces:**
- Produces `StatementRuleRegistry`, `StatementRuleId`, `TimeCandidateEvidence` and optional source rule metadata consumed by later tasks.

- [x] **Step 1: Write failing tests** for deterministic registry lookup, duplicate rule rejection, and time candidate ordering.
- [x] **Step 2: Run `npx vitest run app/lib/import/statement-rules.test.ts`** and verify the new module symbols are missing.
- [x] **Step 3: Implement the typed rule model** with immutable profiles and validation at registry construction.
- [x] **Step 4: Add optional `timeRuleId`, `timeCandidates`, and `formatRuleId` source fields without changing existing serialized records.**
- [x] **Step 5: Run the focused test and typecheck.**

### Task 2: 将 dispatcher 改为适配器注册表

**Files:**
- Create: `app/lib/import/statement-adapters.ts`
- Modify: `app/lib/import/dispatcher.ts`
- Test: `app/lib/import/dispatcher.test.ts`

**Interfaces:**
- Consumes `StatementRuleRegistry` from Task 1.
- Produces `STATEMENT_ADAPTERS` and `parseBrokerStatement` with the current public behavior.

- [x] **Step 1: Add a failing test** proving a registered adapter can be detected without adding a branch to dispatcher.
- [x] **Step 2: Run the focused dispatcher test and verify failure.**
- [x] **Step 3: Move Futu XLSX/PDF, Tiger PDF and China Merchants PDF registrations into `statement-adapters.ts`.**
- [x] **Step 4: Replace the dispatcher ternary and hardcoded confidence constant with registry iteration and a named threshold.**
- [x] **Step 5: Preserve current zero-match and multi-match diagnostics, then run dispatcher and existing import tests.**

### Task 3: 抽取富途 PDF 模板 profile

**Files:**
- Create: `app/lib/import/futu-template-profile.ts`
- Modify: `app/lib/import/futu-pdf.ts`
- Test: `app/lib/import/futu-pdf.test.ts`

**Interfaces:**
- Produces `detectFutuTemplate(text)` and `FutuTemplateProfile`.
- `parseFutuPdfPages` consumes the profile result and retains existing F0/F1/F2/F3/F4/F4a behavior.

- [x] **Step 1: Add failing tests** for known template IDs, unsupported F4a, and an unknown transaction header returning an explicit unsupported-template diagnostic.
- [x] **Step 2: Run the focused tests and verify they fail.**
- [x] **Step 3: Implement ordered declarative profiles for known anchors and required columns.**
- [x] **Step 4: Replace inline family selection and final F5 fallback with profile resolution; preserve the existing geometry parser for matched profiles.**
- [x] **Step 5: Run all Futu PDF tests and compare record IDs, quantities, fees, timestamps and blocked states.**

### Task 4: 将富途时间推断改成版本化策略

**Files:**
- Modify: `app/lib/import/futu-time-policy.ts`
- Modify: `app/lib/import/statement-time.ts`
- Modify: `app/lib/import/futu-pdf.ts`
- Test: `app/lib/import/statement-time.test.ts`
- Test: `app/lib/import/futu-pdf.test.ts`

**Interfaces:**
- `inferFutuTransactionTimezone` consumes a policy profile and produces the selected timezone plus candidate evidence.
- `resolveStatementTime` forwards rule ID and candidates into `TradeExecution.source`.

- [x] **Step 1: Add failing tests** for rule ID/candidate persistence and unchanged market-local selection.
- [x] **Step 2: Run the focused tests and verify failure.**
- [x] **Step 3: Move market zones, alternate zones, session windows and confidence values into immutable versioned policy records.**
- [x] **Step 4: Add candidate evidence while retaining the old selected timezone and confidence fields.**
- [x] **Step 5: Run time, Futu PDF and monthly corpus tests.**

### Task 5: 提升富途 XLSX profile 兼容性

**Files:**
- Create: `app/lib/import/futu-workbook-profile.ts`
- Modify: `app/lib/import/futu.ts`
- Test: `app/lib/import/futu.test.ts`

**Interfaces:**
- Produces sheet aliases, header aliases and field lookup for verified Futu workbook versions.
- `parseFutuWorkbook` keeps its existing public parser and diagnostics.

- [x] **Step 1: Add failing tests** for a verified sheet/header alias and for an unknown workbook that remains blocked.
- [x] **Step 2: Run the focused tests and verify failure.**
- [x] **Step 3: Implement profile-based normalized sheet/header lookup, retaining current exact names as the first profile.**
- [x] **Step 4: Replace direct string constants in detection and row parsing with profile field access.**
- [x] **Step 5: Run workbook, dispatcher and full unit tests.**

### Task 6: 全量验证和兼容性报告

**Files:**
- Modify: `docs/superpowers/specs/2026-09-08-statement-rule-compatibility-design.md`
- Modify: `docs/superpowers/plans/2026-09-08-statement-rule-compatibility.md`

- [x] **Step 1: Run `npm run test:unit -- --maxWorkers=2`, `npm run typecheck`, `npm run lint`, and `npm run build`.**
- [x] **Step 2: Run applicable rendered/runtime tests and the corpus audit if the source corpus is available.**
- [x] **Step 3: Run `git diff --check` and inspect the diff for accidental changes outside the import seam.**
- [x] **Step 4: Record actual verification counts and any remaining known unsupported formats in the spec.**
