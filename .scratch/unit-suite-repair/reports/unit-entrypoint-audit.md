# Unit test entrypoint audit

This is a read-only audit of the current worktree. No test process or service was
started.

## Entrypoints and coverage

`npm run test:unit` runs `vitest run` using `vitest.config.ts`:

- environment: `jsdom`, with `tests/setup.ts`;
- included files: `app/**/*.test.{ts,tsx}`, `db/**/*.test.ts`, and
  `scripts/**/*.test.mjs`;
- Vitest therefore covers the application and database unit suites plus the
  non-operational script tests (`scripts/deploy.test.mjs`,
  `scripts/runtime-config.test.mjs`, and `scripts/start-local.test.mjs`);
- the seven operational native-runner files are explicitly excluded by the config:
  `scripts/deploy-source.test.mjs`, `scripts/deploy-native-runtime.test.mjs`,
  `scripts/deploy-native-toolkit.test.mjs`, `scripts/deploy-native.test.mjs`,
  `scripts/deploy-native-safety.test.mjs`, `scripts/native-environment.test.mjs`,
  and `scripts/debug-local.test.mjs`.

The exclusion is pre-existing workflow configuration (the config comment says to run
these with `make deploy-test`); it is not a new exclusion from this repair.

`make deploy-test` is the native Node entrypoint for six of those files:

```text
scripts/native-environment.test.mjs
scripts/deploy-source.test.mjs
scripts/deploy-native-runtime.test.mjs
scripts/deploy-native-toolkit.test.mjs
scripts/deploy-native.test.mjs
scripts/deploy-native-safety.test.mjs
```

`make debug-test` covers the remaining native file together with the environment
checks:

```text
scripts/native-environment.test.mjs
scripts/debug-local.test.mjs
```

Thus `debug-local.test.mjs` is not covered by `make deploy-test`, while
`native-environment.test.mjs` is intentionally exercised by both native targets.

The package-level commands have a different scope:

- `npm test` performs `npm run build`, then runs only the three Node tests
  `tests/rendered-html.test.mjs`, `tests/local-dev-storage.test.mjs`, and
  `tests/focused-review-ui.test.mjs`;
- `npm run test:runtime` runs only `tests/local-dev-storage.test.mjs`;
- `npm test` does not run the Vitest suite or any `scripts/*.test.mjs` file.

## Existing six skips

The previous full Vitest census reported six skipped tests in three skipped files.
All six are deliberate opt-in corpus tests, and each skip condition is source-level:

| File | Skipped test count | Condition | To enable |
|---|---:|---|---|
| `app/lib/import/monthly-corpus.test.ts` | 1 | `it.skipIf(!root)` where `root = process.env.BROKER_CORPUS_ROOT` | Set `BROKER_CORPUS_ROOT` to an external corpus root containing the expected broker subdirectories and monthly PDFs. |
| `app/lib/import/china-merchants-corpus.test.ts` | 1 | `it.skipIf(!root)` where `root = process.env.CHINA_MERCHANTS_CORPUS_ROOT` | Set `CHINA_MERCHANTS_CORPUS_ROOT` to an external directory containing the original China Merchants PDFs. |
| `app/lib/import/tradingview-samples.test.ts` | 4 | `describe.skipIf(!sampleDirectory)` where `sampleDirectory = process.env.TRADINGVIEW_SAMPLE_DIR` | Set `TRADINGVIEW_SAMPLE_DIR` to an external directory containing the four named CSV exports in the file. |

These are not missing ordinary repository tests: the source comments explicitly keep
private/original corpora outside the repository and require opt-in environment
variables. Enabling a variable with an empty or wrong directory changes a skip into a
real file-system failure; the corpus roots must contain the documented fixtures.

## Minimum acceptance commands and omission risks

For the repository's complete automated unit/regression surface, the smallest command
set is:

```sh
npm run test:unit
make deploy-test
make debug-test
```

This runs the Vitest suite and all seven excluded native Node files. The six corpus
tests remain explicitly skipped unless their private fixture roots are supplied; that
status should be reported, not silently treated as coverage.

The broader package acceptance command is separate and should be run when the final
gate includes build/server-rendered behavior:

```sh
npm test
```

It adds the build and three `tests/*.mjs` checks but does not replace any of the three
unit/native commands above. The main omission risk is treating `npm test` as “all
tests”, or treating `npm run test:unit` as covering the excluded native operational
files. The existing Vitest exclusion itself should remain unchanged during this repair.
