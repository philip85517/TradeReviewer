# Native toolkit transaction

Status: implementation-ready; coordinator integration review pending.

`beginNativeToolkitTransaction({ targetDir, toolkitDir? })` snapshots the control files, installs the current source toolkit into the deployment `ops` directory, and returns `{ restore(), discard() }`. The source layout is inferred from the module location: repository `scripts/` maps to repository deployment control files, while an installed module under `target/ops` maps to sibling deployment files. Modules installed are `deploy-native.mjs`, `deploy-source.mjs`, `deploy-native-runtime.mjs`, `deploy.mjs`, and `deploy-native-toolkit.mjs`, plus `ops/start-native.command`, root `Makefile`, and root `DEPLOYMENT.md`.

The transaction records prior bytes, modes, and nonexistence in a private temporary directory. Any installation error restores all files and removes newly created files. Callers retain `restore()` for later lifecycle failure or `discard()` after success. Target roots, `ops`, ancestors, source files, and destination files are checked with `lstat`; symlink targets and non-regular control files are rejected before mutation. Business configuration, database, and service state are outside this module.

## Verification

Command: `node --test scripts/deploy-native-toolkit.test.mjs`

Result: 4 passing, 0 failing. Evidence covers current toolkit installation and restoration, injected install failure with sentinel preservation, importing the installed toolkit from `target/ops`, and symlinked target rejection with outsider preservation.
