# Task 2 Report: Tiger OpenAPI JSON-over-stdio Helper and Node Runner

Date: 2026-09-01

## Scope

Implemented only Task 2 runtime files and tests:

- `scripts/tiger-market-data.py`
- `app/lib/market/tiger-process.ts`
- `app/lib/market/tiger-process.test.ts`

## Changed Files

- `scripts/tiger-market-data.py`
  - Added a quote-only Python stdin/stdout helper.
  - Reads `TIGER_OPENAPI_CONFIG` from the environment.
  - Uses `TigerOpenClientConfig(props_path=configPath)` and `QuoteClient.get_bars(...)`.
  - Emits exactly one JSON object with `bars`.
  - Uses fixed safe stderr categories and exits non-zero on failure.

- `app/lib/market/tiger-process.ts`
  - Added `runTigerBars(request, options?)`.
  - Supports injected `spawn`, `pythonCommand`, `helperPath`, and `timeoutMs`.
  - Spawns `python3 -u <helper>`, writes one JSON line, enforces timeout, parses a single JSON object, validates `bars`, and maps failures to `MarketDataProviderError`.
  - Keeps raw stderr out of browser-facing errors.

- `app/lib/market/tiger-process.test.ts`
  - Added fake-child-process tests for:
    - successful one-line JSON output
    - malformed JSON
    - missing `bars`
    - non-zero exit with stderr redaction
    - timeout
    - spawn failure

## Key Decisions

- Followed the controller ruling instead of the older plan wording:
  - used the official Python SDK loader as the credential-format source of truth
  - passed the external config path into `TigerOpenClientConfig(props_path=configPath)`
  - did not reimplement private-key selection logic in the helper
- Kept the helper quote-only.
- Kept credentials, config contents, raw SDK output, and traceback out of logs, stderr categories, and user-facing errors.
- Treated the broad `tsc --project tsconfig.json` failure in `app/lib/market/tiger-config.test.ts` as pre-existing and outside Task 2 scope; used a focused TypeScript syntax check for the new files after that.

## Self-Review

- Confirmed the runner writes exactly one JSON request line and only accepts a single JSON object with an array `bars`.
- Confirmed non-zero helper exits and spawn failures surface safe `source-unavailable` errors only.
- Confirmed timeout kills the child and maps to `source-timeout`.
- Confirmed no raw stderr, secrets, config contents, or traceback are exposed by the runner tests.
- Confirmed staged diff had no whitespace or patch-format problems.

## Commands And Exact Outputs

### Red phase

Command:

```bash
npm run test:unit -- app/lib/market/tiger-process.test.ts --run
```

Output:

```text
> trade-reviewer@0.1.0 test:unit
> vitest run app/lib/market/tiger-process.test.ts --run


 RUN  v4.1.10 /Users/zhoulin/.codex/worktrees/1024/TradeReview

(node:62561) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
 ❯ app/lib/market/tiger-process.test.ts (0 test)

⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  app/lib/market/tiger-process.test.ts [ app/lib/market/tiger-process.test.ts ]
Error: Failed to resolve import "./tiger-process" from "app/lib/market/tiger-process.test.ts". Does the file exist?
  Plugin: vite:import-analysis
  File: /Users/zhoulin/.codex/worktrees/1024/TradeReview/app/lib/market/tiger-process.test.ts:11:29
  2  |  import { PassThrough, Writable } from "node:stream";
  3  |  import { describe, expect, it } from "vitest";
  4  |  import { runTigerBars } from "./tiger-process";
     |                                ^
  5  |  class FakeStdin extends Writable {
  6  |  	constructor(..._args2) {
 ❯ TransformPluginContext._formatLog node_modules/vite/dist/node/chunks/node.js:30486:39
 ❯ TransformPluginContext.error node_modules/vite/dist/node/chunks/node.js:30483:14
 ❯ normalizeUrl node_modules/vite/dist/node/chunks/node.js:27725:18
 ❯ node_modules/vite/dist/node/chunks/node.js:27788:30
 ❯ TransformPluginContext.transform node_modules/vite/dist/node/chunks/node.js:27756:4
 ❯ EnvironmentPluginContainer.transform node_modules/vite/dist/node/chunks/node.js:30271:14
 ❯ loadAndTransform node_modules/vite/dist/node/chunks/node.js:24532:26

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  no tests
   Start at  00:09:14
   Duration  1.36s (transform 28ms, setup 158ms, import 0ms, tests 0ms, environment 833ms)
```

### First green run after implementation

Command:

```bash
npm run test:unit -- app/lib/market/tiger-process.test.ts --run
```

Output:

```text
> trade-reviewer@0.1.0 test:unit
> vitest run app/lib/market/tiger-process.test.ts --run


 RUN  v4.1.10 /Users/zhoulin/.codex/worktrees/1024/TradeReview

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Start at  00:11:30
   Duration  1.34s (transform 65ms, setup 159ms, import 50ms, tests 28ms, environment 811ms)
```

### First syntax and lint pass

Command:

```bash
python3 -m py_compile scripts/tiger-market-data.py
```

Output:

```text
```

Command:

```bash
npx eslint app/lib/market/tiger-process.ts app/lib/market/tiger-process.test.ts
```

Output:

```text
/Users/zhoulin/.codex/worktrees/1024/TradeReview/app/lib/market/tiger-process.test.ts
  221:9  warning  '_command' is defined but never used  @typescript-eslint/no-unused-vars
  222:9  warning  '_args' is defined but never used     @typescript-eslint/no-unused-vars
  223:9  warning  '_options' is defined but never used  @typescript-eslint/no-unused-vars

✖ 3 problems (0 errors, 3 warnings)
```

Command:

```bash
npx tsc --noEmit --pretty false
```

Output:

```text
app/lib/market/tiger-config.test.ts(104,35): error TS2345: Argument of type '{}' is not assignable to parameter of type 'ProcessEnv'.
  Property 'NODE_ENV' is missing in type '{}' but required in type 'ProcessEnv'.
app/lib/market/tiger-config.test.ts(109,30): error TS2345: Argument of type '{ TIGER_OPENAPI_CONFIG: string; }' is not assignable to parameter of type 'ProcessEnv'.
  Property 'NODE_ENV' is missing in type '{ TIGER_OPENAPI_CONFIG: string; }' but required in type 'ProcessEnv'.
app/lib/market/tiger-config.test.ts(121,30): error TS2345: Argument of type '{ TIGER_OPENAPI_CONFIG: string; }' is not assignable to parameter of type 'ProcessEnv'.
  Property 'NODE_ENV' is missing in type '{ TIGER_OPENAPI_CONFIG: string; }' but required in type 'ProcessEnv'.
app/lib/market/tiger-config.test.ts(135,30): error TS2345: Argument of type '{ TIGER_OPENAPI_CONFIG: string; }' is not assignable to parameter of type 'ProcessEnv'.
  Property 'NODE_ENV' is missing in type '{ TIGER_OPENAPI_CONFIG: string; }' but required in type 'ProcessEnv'.
app/lib/market/tiger-config.test.ts(158,43): error TS2345: Argument of type '{ TIGER_OPENAPI_CONFIG: string; }' is not assignable to parameter of type 'ProcessEnv'.
  Property 'NODE_ENV' is missing in type '{ TIGER_OPENAPI_CONFIG: string; }' but required in type 'ProcessEnv'.
app/lib/market/tiger-process.test.ts(78,7): error TS2322: Type '(command: string, args: readonly string[], options: SpawnOptionsWithoutStdio) => FakeChildProcess' is not assignable to type 'SpawnFunction'.
  Call signature return types 'FakeChildProcess' and 'ChildProcessWithoutNullStreams' are incompatible.
    Type at position 0 in source is not compatible with type at position 0 in target.
      The types of 'stdio' are incompatible between these types.
        Type 'Writable | null' is not assignable to type 'Writable'.
          Type 'null' is not assignable to type 'Writable'.
app/lib/market/tiger-process.test.ts(122,7): error TS2322: Type '() => FakeChildProcess' is not assignable to type 'SpawnFunction'.
  Call signature return types 'FakeChildProcess' and 'ChildProcessWithoutNullStreams' are incompatible.
    Type at position 0 in source is not compatible with type at position 0 in target.
      The types of 'stdio' are incompatible between these types.
        Type 'Writable | null' is not assignable to type 'Writable'.
          Type 'null' is not assignable to type 'Writable'.
app/lib/market/tiger-process.test.ts(143,7): error TS2322: Type '() => FakeChildProcess' is not assignable to type 'SpawnFunction'.
  Call signature return types 'FakeChildProcess' and 'ChildProcessWithoutNullStreams' are incompatible.
    Type at position 0 in source is not compatible with type at position 0 in target.
      The types of 'stdio' are incompatible between these types.
        Type 'Writable | null' is not assignable to type 'Writable'.
          Type 'null' is not assignable to type 'Writable'.
app/lib/market/tiger-process.test.ts(165,7): error TS2322: Type '() => FakeChildProcess' is not assignable to type 'SpawnFunction'.
  Call signature return types 'FakeChildProcess' and 'ChildProcessWithoutNullStreams' are incompatible.
    Type at position 0 in source is not compatible with type at position 0 in target.
      The types of 'stdio' are incompatible between these types.
        Type 'Writable | null' is not assignable to type 'Writable'.
          Type 'null' is not assignable to type 'Writable'.
app/lib/market/tiger-process.test.ts(203,7): error TS2322: Type '() => FakeChildProcess' is not assignable to type 'SpawnFunction'.
  Call signature return types 'FakeChildProcess' and 'ChildProcessWithoutNullStreams' are incompatible.
    Type at position 0 in source is not compatible with type at position 0 in target.
      The types of 'stdio' are incompatible between these types.
        Type 'Writable | null' is not assignable to type 'Writable'.
          Type 'null' is not assignable to type 'Writable'.
```

### Re-run after lint cleanup and runner typing adjustments

Command:

```bash
npm run test:unit -- app/lib/market/tiger-process.test.ts --run
```

Output:

```text
> trade-reviewer@0.1.0 test:unit
> vitest run app/lib/market/tiger-process.test.ts --run


 RUN  v4.1.10 /Users/zhoulin/.codex/worktrees/1024/TradeReview

(node:62907) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Start at  00:12:38
   Duration  1.65s (transform 77ms, setup 192ms, import 59ms, tests 28ms, environment 987ms)
```

Command:

```bash
npx eslint app/lib/market/tiger-process.ts app/lib/market/tiger-process.test.ts
```

Output:

```text
```

Command:

```bash
npx tsc --noEmit --pretty false app/lib/market/tiger-process.ts app/lib/market/tiger-process.test.ts
```

Output:

```text
app/lib/market/tiger-process.ts(5,8): error TS1259: Module '"node:path"' can only be default-imported using the 'esModuleInterop' flag
app/lib/market/tiger-process.ts(174,21): error TS2339: Property 'error' does not exist on type '{ ok: true; bars: TigerBar[]; } | { ok: false; error: MarketDataProviderError; }'.
  Property 'error' does not exist on type '{ ok: true; bars: TigerBar[]; }'.
node_modules/@vitest/expect/dist/index.d.ts(6,27): error TS2307: Cannot find module '@vitest/utils/display' or its corresponding type declarations.
  There are types at '/Users/zhoulin/.codex/worktrees/1024/TradeReview/node_modules/@vitest/utils/dist/display.d.ts', but this result could not be resolved under your current 'moduleResolution' setting. Consider updating to 'node16', 'nodenext', or 'bundler'.
node_modules/vitest/dist/chunks/evaluatedModules.d.BxJ5omdx.d.ts(1,34): error TS2307: Cannot find module 'vite/module-runner' or its corresponding type declarations.
  There are types at '/Users/zhoulin/.codex/worktrees/1024/TradeReview/node_modules/vite/dist/node/module-runner.d.ts', but this result could not be resolved under your current 'moduleResolution' setting. Consider updating to 'node16', 'nodenext', or 'bundler'.
node_modules/vitest/dist/chunks/rpc.d.B_8sPU0w.d.ts(3,51): error TS2307: Cannot find module 'vite/module-runner' or its corresponding type declarations.
  There are types at '/Users/zhoulin/.codex/worktrees/1024/TradeReview/node_modules/vite/dist/node/module-runner.d.ts', but this result could not be resolved under your current 'moduleResolution' setting. Consider updating to 'node16', 'nodenext', or 'bundler'.
node_modules/vitest/dist/chunks/traces.d.D2T_R8rx.d.ts(54,2): error TS18028: Private identifiers are only available when targeting ECMAScript 2015 and higher.
node_modules/vitest/dist/chunks/worker.d.ZpHpO4yb.d.ts(2,34): error TS2307: Cannot find module 'vite/module-runner' or its corresponding type declarations.
  There are types at '/Users/zhoulin/.codex/worktrees/1024/TradeReview/node_modules/vite/dist/node/module-runner.d.ts', but this result could not be resolved under your current 'moduleResolution' setting. Consider updating to 'node16', 'nodenext', or 'bundler'.
```

### Focused final verification

Command:

```bash
python3 -m py_compile scripts/tiger-market-data.py
```

Output:

```text
```

Command:

```bash
npm run test:unit -- app/lib/market/tiger-process.test.ts --run
```

Output:

```text
> trade-reviewer@0.1.0 test:unit
> vitest run app/lib/market/tiger-process.test.ts --run


 RUN  v4.1.10 /Users/zhoulin/.codex/worktrees/1024/TradeReview

(node:63335) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Start at  00:15:35
   Duration  1.67s (transform 63ms, setup 164ms, import 46ms, tests 27ms, environment 1.04s)
```

Command:

```bash
npx eslint app/lib/market/tiger-process.ts app/lib/market/tiger-process.test.ts
```

Output:

```text
```

Command:

```bash
npx tsc --noEmit --pretty false --moduleResolution bundler --module esnext --target es2017 --skipLibCheck --types node,vitest/globals app/lib/market/tiger-process.ts app/lib/market/tiger-process.test.ts
```

Output:

```text
```

### Staging and self-review

Command:

```bash
git add app/lib/market/tiger-process.ts app/lib/market/tiger-process.test.ts scripts/tiger-market-data.py && git diff --cached --stat -- app/lib/market/tiger-process.ts app/lib/market/tiger-process.test.ts scripts/tiger-market-data.py
```

Output:

```text
 app/lib/market/tiger-process.test.ts | 239 +++++++++++++++++++++++++++++++++++
 app/lib/market/tiger-process.ts      | 223 ++++++++++++++++++++++++++++++++
 scripts/tiger-market-data.py         | 149 ++++++++++++++++++++++
 3 files changed, 611 insertions(+)
```

Command:

```bash
git diff --cached --check -- app/lib/market/tiger-process.ts app/lib/market/tiger-process.test.ts scripts/tiger-market-data.py
```

Output:

```text
```

Command:

```bash
git status --short
```

Output:

```text
A  app/lib/market/tiger-process.test.ts
A  app/lib/market/tiger-process.ts
A  scripts/tiger-market-data.py
```

### Commit

Command:

```bash
git commit -m "feat: bridge Tiger OpenAPI bars through Python SDK"
```

Output:

```text
[codex/public-market-hourly-backfill 5f6cf2c] feat: bridge Tiger OpenAPI bars through Python SDK
 3 files changed, 611 insertions(+)
 create mode 100644 app/lib/market/tiger-process.test.ts
 create mode 100644 app/lib/market/tiger-process.ts
 create mode 100644 scripts/tiger-market-data.py
```

## Result

- Commit: `5f6cf2c`
- Focused tests: passing
- Focused syntax checks: passing
- Broad project `tsc --project tsconfig.json`: still fails in pre-existing `app/lib/market/tiger-config.test.ts` env typing outside Task 2 scope

## Fix Round 1

Date: 2026-09-01

### Review Items Addressed

- Added local, non-sensitive helper validation for `tiger_id`, `account`, and at least one non-empty private key field before constructing the SDK client.
- Kept `TigerOpenClientConfig(props_path=config_path)` as the source of truth for key-format precedence and adjacent token loading.
- Cleared the project-configured TypeScript check by widening the Tiger config reader’s environment input to only the key it actually consumes.

### Changed Files

- `scripts/tiger-market-data.py`
  - Added local properties parsing.
  - Added required-field validation without printing parsed values.
- `app/lib/market/tiger-process.test.ts`
  - Added integration-style tests that run the real helper with a stub `tigeropen` package and invalid config files.
- `app/lib/market/tiger-config.ts`
  - Narrowed the environment type to `TIGER_OPENAPI_CONFIG` so `tsc --project tsconfig.json` can type-check the Tiger config tests.

### Red Verification

Command:

```bash
npm run test:unit -- app/lib/market/tiger-process.test.ts --run
```

Output:

```text
> trade-reviewer@0.1.0 test:unit
> vitest run app/lib/market/tiger-process.test.ts --run

 RUN  v4.1.10 /Users/zhoulin/.codex/worktrees/1024/TradeReview

(node:64157) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
 ❯ app/lib/market/tiger-process.test.ts (8 tests | 2 failed) 413ms
     × fails when tiger_id is missing from the helper config without exposing values 269ms
     × fails when the helper config has an empty private key without exposing values 113ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  app/lib/market/tiger-process.test.ts > runTigerBars > fails when tiger_id is missing from the helper config without exposing values
AssertionError: promise resolved "[]" instead of rejecting

- Expected:
Error {
  "message": "rejected promise",
}

+ Received:
[]

 ❯ app/lib/market/tiger-process.test.ts:308:31
    306|     });
    307|
    308|     await expect(resultPromise).rejects.toEqual(
       |                               ^
    309|       expect.objectContaining<Partial<MarketDataProviderError>>({
    310|         code: "source-unavailable",

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  app/lib/market/tiger-process.test.ts > runTigerBars > fails when the helper config has an empty private key without exposing values
AssertionError: promise resolved "[]" instead of rejecting

- Expected:
Error {
  "message": "rejected promise",
}

+ Received:
[]

 ❯ app/lib/market/tiger-process.test.ts:336:31
    334|     });
    335|
    336|     await expect(resultPromise).rejects.toEqual(
       |                               ^
    337|       expect.objectContaining<Partial<MarketDataProviderError>>({
    338|         code: "source-unavailable",

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯


 Test Files  1 failed (1)
      Tests  2 failed | 6 passed (8)
   Start at  00:26:00
   Duration  4.29s (transform 119ms, setup 581ms, import 82ms, tests 413ms, environment 2.73s)
```

Command:

```bash
npx tsc --noEmit --pretty false --project tsconfig.json
```

Output:

```text
app/lib/market/tiger-config.test.ts(104,35): error TS2345: Argument of type '{}' is not assignable to parameter of type 'ProcessEnv'.
  Property 'NODE_ENV' is missing in type '{}' but required in type 'ProcessEnv'.
app/lib/market/tiger-config.test.ts(109,30): error TS2345: Argument of type '{ TIGER_OPENAPI_CONFIG: string; }' is not assignable to parameter of type 'ProcessEnv'.
  Property 'NODE_ENV' is missing in type '{ TIGER_OPENAPI_CONFIG: string; }' but required in type 'ProcessEnv'.
app/lib/market/tiger-config.test.ts(121,30): error TS2345: Argument of type '{ TIGER_OPENAPI_CONFIG: string; }' is not assignable to parameter of type 'ProcessEnv'.
  Property 'NODE_ENV' is missing in type '{ TIGER_OPENAPI_CONFIG: string; }' but required in type 'ProcessEnv'.
app/lib/market/tiger-config.test.ts(135,30): error TS2345: Argument of type '{ TIGER_OPENAPI_CONFIG: string; }' is not assignable to parameter of type 'ProcessEnv'.
  Property 'NODE_ENV' is missing in type '{ TIGER_OPENAPI_CONFIG: string; }' but required in type 'ProcessEnv'.
app/lib/market/tiger-config.test.ts(158,43): error TS2345: Argument of type '{ TIGER_OPENAPI_CONFIG: string; }' is not assignable to parameter of type 'ProcessEnv'.
  Property 'NODE_ENV' is missing in type '{ TIGER_OPENAPI_CONFIG: string; }' but required in type 'ProcessEnv'.
```

### Green Verification

Command:

```bash
npm run test:unit -- app/lib/market/tiger-process.test.ts --run
```

Output:

```text
> trade-reviewer@0.1.0 test:unit
> vitest run app/lib/market/tiger-process.test.ts --run

 RUN  v4.1.10 /Users/zhoulin/.codex/worktrees/1024/TradeReview

(node:64371) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)

 Test Files  1 passed (1)
      Tests  8 passed (8)
   Start at  00:27:35
   Duration  3.65s (transform 129ms, setup 413ms, import 108ms, tests 285ms, environment 2.17s)
```

Command:

```bash
python3 -m py_compile scripts/tiger-market-data.py
```

Output:

```text
```

Command:

```bash
npx eslint app/lib/market/tiger-process.ts app/lib/market/tiger-process.test.ts
```

Output:

```text
```

Command:

```bash
npx tsc --noEmit --pretty false --project tsconfig.json
```

Output:

```text
```

## Fix Round 2

Date: 2026-09-01

### Review Item Addressed

- Replaced the remaining `"error" in result` branch in `app/lib/market/tiger-process.ts` with discriminant-based narrowing: `if (!result.ok) { reject(result.error); return; }`.

### Verification

Command:

```bash
npm run test:unit -- app/lib/market/tiger-process.test.ts --run
```

Output:

```text
> trade-reviewer@0.1.0 test:unit
> vitest run app/lib/market/tiger-process.test.ts --run


 RUN  v4.1.10 /Users/zhoulin/.codex/worktrees/1024/TradeReview

(node:65050) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)

 Test Files  1 passed (1)
      Tests  8 passed (8)
   Start at  00:34:40
   Duration  2.11s (transform 90ms, setup 245ms, import 68ms, tests 350ms, environment 1.09s)
```

Command:

```bash
npx eslint app/lib/market/tiger-process.ts app/lib/market/tiger-process.test.ts
```

Output:

```text
```

Command:

```bash
npx tsc --noEmit --pretty false --project tsconfig.json
```

Output:

```text
```
