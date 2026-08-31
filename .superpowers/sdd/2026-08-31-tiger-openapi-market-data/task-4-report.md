# Task 4 Report

Date: 2026-09-01

Scope completed:

- API configured/unconfigured/fallback tests
- Sync persistence regression test
- README Tiger setup documentation
- Task verification commands

Changed files:

- `README.md`
- `app/api/market-data/daily/route.ts`
- `app/api/market-data/daily/route.test.ts`
- `app/api/market-data/intraday/route.ts`
- `app/api/market-data/intraday/route.test.ts`
- `app/lib/market/sync-service.test.ts`

Implementation summary:

- Added route-level test seams that preserve the public `GET` handlers while allowing a fake provider router to be injected in tests.
- Added daily route tests for configured Tiger success, unconfigured public-provider success, and public fallback success after Tiger upstream failure.
- Added intraday route tests for configured Tiger `1h` success, unconfigured public-provider success, and public fallback success after Tiger upstream failure.
- Added a sync regression test proving Tiger daily candles, Tiger coverage/provider symbol persistence, and no duplicate write on a cache-only resync.
- Documented local Tiger setup in the README with the required commands, external-config requirement, pinned SDK key precedence, and US/HK daily-plus-`1h` scope.

Verification commands and outputs:

```bash
npm run test:unit -- app/api/market-data/daily/route.test.ts app/api/market-data/intraday/route.test.ts app/lib/market/sync-service.test.ts --run
```

```text
> trade-reviewer@0.1.0 test:unit
> vitest run app/api/market-data/daily/route.test.ts app/api/market-data/intraday/route.test.ts app/lib/market/sync-service.test.ts --run

RUN  v4.1.10 /Users/zhoulin/.codex/worktrees/1024/TradeReview
(node:70814) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)

Test Files  3 passed (3)
Tests  34 passed (34)
Start at  01:15:12
Duration  1.83s (transform 536ms, setup 559ms, import 314ms, tests 608ms, environment 2.70s)
```

```bash
npm run typecheck
```

```text
> trade-reviewer@0.1.0 typecheck
> tsc --noEmit
```

Exit code: `0`

```bash
npm run test:unit -- --run
```

```text
> trade-reviewer@0.1.0 test:unit
> vitest run --run

RUN  v4.1.10 /Users/zhoulin/.codex/worktrees/1024/TradeReview
(node:69749) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)

Test Files  112 passed (112)
Tests  961 passed (961)
Start at  01:12:07
Duration  72.37s (transform 7.09s, setup 40.69s, import 20.70s, tests 133.21s, environment 232.22s)
```

Additional verification note:

```bash
npm run test:unit -- scripts/deploy.test.mjs --run --testNamePattern "runs deployed operational Make targets from the target root"
```

```text
> trade-reviewer@0.1.0 test:unit
> vitest run scripts/deploy.test.mjs --run --testNamePattern runs deployed operational Make targets from the target root

RUN  v4.1.10 /Users/zhoulin/.codex/worktrees/1024/TradeReview
(node:69635) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)

Test Files  1 passed (1)
Tests  1 passed | 52 skipped (53)
Start at  01:11:48
Duration  4.19s (transform 101ms, setup 157ms, import 100ms, tests 2.81s, environment 826ms)
```

Reason:

- An earlier full-suite run hit a single timeout in this deploy test; the isolated rerun passed, and the subsequent full-suite rerun passed unchanged.

```bash
npm run lint
```

```text
> trade-reviewer@0.1.0 lint
> eslint . --ignore-pattern dist --ignore-pattern .next

/Users/zhoulin/.codex/worktrees/1024/TradeReview/app/lib/market/providers/tiger.ts
  135:5  warning  '_fetcher' is defined but never used  @typescript-eslint/no-unused-vars
  176:5  warning  '_fetcher' is defined but never used  @typescript-eslint/no-unused-vars

/Users/zhoulin/.codex/worktrees/1024/TradeReview/app/lib/storage/storage-boundary.test.tsx
  36:7  warning  'workspacePath' is assigned a value but never used  @typescript-eslint/no-unused-vars

✖ 3 problems (0 errors, 3 warnings)
```

Exit code: `0`

```bash
npm test
```

```text
> trade-reviewer@0.1.0 test
> npm run build && node --test tests/rendered-html.test.mjs tests/local-dev-storage.test.mjs

> trade-reviewer@0.1.0 build
> WRANGLER_LOG_PATH=.wrangler/wrangler.log vinext build

vinext build  (Vite 8.0.13)

(node:70625) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
[1/5] analyze client references...
transforming...✓ 187 modules transformed.
rendering chunks...
✓ built in 954ms
[2/5] analyze server references...
transforming...✓ 232 modules transformed.
rendering chunks...
✓ built in 1.28s
[3/5] build rsc environment...
transforming...✓ 193 modules transformed.
rendering chunks...
computing gzip size...
✓ built in 1.01s
[4/5] build client environment...
transforming...
[plugin rolldown:vite-resolve] Module "fs" has been externalized for browser compatibility, imported by ".../node_modules/@techstark/opencv-js/dist/opencv.js".
[plugin rolldown:vite-resolve] Module "path" has been externalized for browser compatibility, imported by ".../node_modules/@techstark/opencv-js/dist/opencv.js".
[plugin rolldown:vite-resolve] Module "crypto" has been externalized for browser compatibility, imported by ".../node_modules/@techstark/opencv-js/dist/opencv.js".
✓ 1929 modules transformed.
rendering chunks...
computing gzip size...
[plugin builtin:vite-reporter]
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
[PLUGIN_TIMINGS] Your build spent significant time in plugins. Here is a breakdown:
  - rsc:virtual-client-package (48%)
  - vinext:react-canary (14%)
  - vinext:jsx-in-js (12%)
  - vinext:config (5%)
  - vinext:mdx (4%)
See https://rolldown.rs/options/checks#plugintimings for more details.

✓ built in 3.18s
[5/5] build ssr environment...
transforming...✓ 241 modules transformed.
rendering chunks...
computing gzip size...
✓ built in 1.78s

Route (app)
┌ ? /
├ λ /api/demo-replay
├ λ /api/instruments/resolve
├ λ /api/market-data/daily
├ λ /api/market-data/intraday
├ λ /api/storage/bootstrap
├ λ /api/storage/market-data
├ λ /api/storage/migrate
├ λ /api/storage/reviews
├ λ /api/storage/settings
├ λ /api/storage/status
└ λ /api/storage/trades

λ API  ? Unknown

? Some routes could not be classified. vinext currently uses static analysis
  and cannot detect dynamic API usage (headers(), cookies(), etc.) at build time.
  Automatic classification will be improved in a future release.

Build complete. Run `vinext start` to start the production server.

✔ dev server exposes a working SQLite storage API (4223.50271ms)
✔ server-renders the historical trade review workspace (321.870423ms)
✔ client bundle contains no unrevealed demo executions (129.814279ms)
✔ emits an importable same-origin ONNX Runtime JSEP module (2.817934ms)
ℹ tests 4
ℹ pass 4
ℹ fail 0
ℹ skipped 0
ℹ duration_ms 4445.667225
```

Smoke verification:

```bash
python3 -m pip install -r requirements-tiger.txt
```

```text
Defaulting to user installation because normal site-packages is not writeable
Collecting tigeropen==3.7.1
  Using cached tigeropen-3.7.1-py3-none-any.whl (600 kB)
Collecting getmac
  Downloading getmac-0.9.5-py2.py3-none-any.whl (35 kB)
Collecting cryptography
  Downloading cryptography-50.0.1.tar.gz (880 kB)
  Installing build dependencies: finished with status 'done'
  Getting requirements to build wheel: started
  Getting requirements to build wheel: finished with status 'done'
  Installing backend dependencies: started
  Installing backend dependencies: finished with status 'done'
  Preparing wheel metadata: started
```

Smoke status:

- Blocked before service startup and HTTP verification because the optional SDK install did not complete within the task window on this host.
- No external config path, account data, private key data, raw SDK response, traceback, or credential-derived output was recorded.
- No Tiger HTTP smoke requests were executed, so there is no provider/candle-count/timestamp/error-code summary to report.

Self-review:

- `git diff --check` returned no whitespace or patch-format issues.
- The route changes keep the public `GET` exports intact and only add an internal test seam.
- The new tests cover configured Tiger success, unconfigured public-provider success, Tiger-to-public fallback, and Tiger sync persistence/cached-resync behavior.

Commit command:

```bash
git add README.md app/api/market-data/daily/route.ts app/api/market-data/daily/route.test.ts app/api/market-data/intraday/route.ts app/api/market-data/intraday/route.test.ts app/lib/market/sync-service.test.ts .superpowers/sdd/2026-08-31-tiger-openapi-market-data/task-4-report.md && git commit -m "docs: document Tiger market data setup"
```
