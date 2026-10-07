# G07 pinned entrypoints implementation report

## Stage 2 — implementation ready

- Added `scripts/native-node.sh` and wired the authorized source/installed entrypoints, preserving the existing debug log environment and argument behavior.
- Native Make targets now invoke the bootstrap; Docker targets remain unchanged. `npm run dev` retains `WRANGLER_LOG_PATH=.wrangler/wrangler.log` while resolving the configured runtime.
- Installed toolkit ownership includes the bootstrap, and toolkit tests cover install and rollback of the new control file.
- Added an isolated source-style fixture test that will copy `scripts/native-node.sh`, provide `conf/native-environment.json`, and verify the configured runtime reports its actual SQL version, `process.execPath`, and arguments containing spaces, quotes, and shell metacharacters.
- The source-style probe puts an owned ambient `node` wrapper first on `PATH`; it permits profile parsing but asserts the configured application sentinel never reaches that wrapper, proving the configured executable was selected.
- Added an isolated missing-runtime test with a PATH wrapper. It requires a nonzero failure and verifies that the user arguments never reach the ambient PATH fallback command.
- Fixtures use temporary directories and do not access the business database or services.
- The deploy runtime build assertion derives npm CLI from `process.execPath` using the configured private runtime layout.

Per the bounded G07 instructions, tests were not run. Coordinator should run the focused bootstrap/toolkit/runtime checks and the required frozen suites.
- `npm run dev` uses `./scripts/native-node.sh` so the source checkout path is explicit while retaining `WRANGLER_LOG_PATH=.wrangler/wrangler.log`.
