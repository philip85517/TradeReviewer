# Task 3 Report: Tiger provider and router integration

Date: 2026-09-01
Task brief: `.superpowers/sdd/2026-08-31-tiger-openapi-market-data/task-3-brief.md`
Code commit: `880ea0e` (`feat: add Tiger market data provider`)

## Changed files

- `app/lib/market/contracts.ts`
- `app/lib/market/sync-service.ts`
- `app/lib/market/intraday-sync-service.ts`
- `app/lib/market/providers/router.ts`
- `app/lib/market/providers/tiger.ts`
- `app/lib/market/providers/tiger.test.ts`
- `app/lib/market/providers/providers.test.ts`

## Decisions

- Added a new `TigerProvider` with `provider: "tiger"` that supports only `US` and `HK`.
- Normalized US symbols with `normalizeMarketSymbol`.
- Normalized HK symbols to Tiger raw contract codes without `.HK`, using four digits such as `0700`.
- Mapped Tiger daily requests to `period: "day"`.
- Mapped Tiger hourly requests to `period: "60min"`.
- Rejected Tiger `15m` requests with an existing `MarketDataProviderError` path instead of silently remapping intervals.
- Parsed Tiger bars by validating provider identity, timestamps, and every numeric field before converting them to decimal strings.
- Kept failed or empty Tiger results safe for existing sync/cache behavior by allowing router fallback, and only converting an empty Tiger result to `no-data` when no later provider remained.
- Extended persisted provider ID guards to include `"tiger"` in both daily and intraday sync-service route validation.
- Kept Tiger out of `CN-SH` and `CN-SZ` routing.
- Preserved existing public-provider ordering when Tiger is not configured.
- Prepended Tiger only for configured `US`/`HK` daily and `1h` provider routes.

## Self-review

- Verified the Tiger provider stayed isolated to provider/router and provider-ID guard surfaces.
- Verified no Tiger routing was added for `CN-SH` or `CN-SZ`.
- Verified existing public fallback order remains unchanged when no Tiger config is available.
- Verified the new tests cover identity mismatch, HK normalization, hourly mapping, empty-result safety, conditional priority, and sparse-result fallback.

## Commands and outputs

### Red step

Command:

```bash
npm run test:unit -- app/lib/market/providers/tiger.test.ts --run
```

Output:

```text
> trade-reviewer@0.1.0 test:unit
> vitest run app/lib/market/providers/tiger.test.ts --run

RUN  v4.1.10 /Users/zhoulin/.codex/worktrees/1024/TradeReview

(node:66255) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
❯ app/lib/market/providers/tiger.test.ts (0 test)

⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

FAIL  app/lib/market/providers/tiger.test.ts [ app/lib/market/providers/tiger.test.ts ]
Error: Failed to resolve import "./tiger" from "app/lib/market/providers/tiger.test.ts". Does the file exist?
  Plugin: vite:import-analysis
  File: /Users/zhoulin/.codex/worktrees/1024/TradeReview/app/lib/market/providers/tiger.test.ts:8:7
  1  |  import { describe, expect, it } from "vitest";
  2  |  import { parseTigerBars, TigerProvider } from "./tiger";
     |                                                 ^
  3  |  describe("Tiger provider", () => {
  4  |    it("parses Tiger daily bars into provider candles", async () => {
❯ TransformPluginContext._formatLog node_modules/vite/dist/node/chunks/node.js:30486:39
❯ TransformPluginContext.error node_modules/vite/dist/node/chunks/node.js:30483:14
❯ normalizeUrl node_modules/vite/dist/node/chunks/node.js:27725:18
❯ node_modules/vite/dist/node/chunks/node.js:27788:30
❯ TransformPluginContext.transform node_modules/vite/dist/node/chunks/node.js:27756:4
❯ EnvironmentPluginContainer.transform node_modules/vite/dist/node/chunks/node.js:30271:14
❯ loadAndTransform node_modules/vite/dist/node/chunks/node.js:24532:26

Test Files  1 failed (1)
     Tests  no tests
  Start at  00:45:30
  Duration  2.93s (transform 36ms, setup 516ms, import 0ms, tests 0ms, environment 2.01s)
```

### Focused provider/router tests

Command:

```bash
npm run test:unit -- app/lib/market/providers/tiger.test.ts app/lib/market/providers/providers.test.ts --run
```

Output:

```text
> trade-reviewer@0.1.0 test:unit
> vitest run app/lib/market/providers/tiger.test.ts app/lib/market/providers/providers.test.ts --run

RUN  v4.1.10 /Users/zhoulin/.codex/worktrees/1024/TradeReview

(node:66562) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)

Test Files  2 passed (2)
     Tests  63 passed (63)
  Start at  00:49:20
  Duration  2.10s (transform 349ms, setup 422ms, import 353ms, tests 318ms, environment 1.98s)
```

### Typecheck

Command:

```bash
npm run typecheck
```

Output:

```text
> trade-reviewer@0.1.0 typecheck
> tsc --noEmit
```

### Commit

Command:

```bash
git add app/lib/market/contracts.ts app/lib/market/sync-service.ts app/lib/market/intraday-sync-service.ts app/lib/market/providers/tiger.ts app/lib/market/providers/tiger.test.ts app/lib/market/providers/router.ts app/lib/market/providers/providers.test.ts && git commit -m "feat: add Tiger market data provider"
```

Output:

```text
[codex/public-market-hourly-backfill 880ea0e] feat: add Tiger market data provider
 7 files changed, 722 insertions(+), 6 deletions(-)
 create mode 100644 app/lib/market/providers/tiger.test.ts
 create mode 100644 app/lib/market/providers/tiger.ts
```

## Notes

- The commit summary reports 7 files because the staged Task 3 code changes were committed before this report file was created.
- The report records the exact command outputs used to verify the Task 3 implementation from the current workspace state.
- The `.superpowers` tree is ignored by git in this repository, so committing this report requires `git add -f` for this exact file path.
