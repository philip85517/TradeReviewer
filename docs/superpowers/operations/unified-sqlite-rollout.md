# Unified SQLite rollout

This release makes the mounted SQLite file the only business-data source. The
browser's old `localStorage` and IndexedDB records are used once to create the
migration payload, then remain only as a short-term rollback copy.

Production mode never seeds the XPEV demo review. When `showDemo` is disabled,
the migration exporter removes the known demo episode/instrument. Malformed
legacy records abort migration before its completion marker is written.

## Deploy the same persistent environment

Run each command from the source checkout, with the same deployment root. Do
not change `DEPLOY_ROOT` between deploy, status, or backup: it identifies the
one persistent SQLite environment.

```bash
make -C /Users/zhoulin/.codex/worktrees/65ad/TradeReview DEPLOY_ROOT=/Users/zhoulin/projects/TradeReview deploy
make -C /Users/zhoulin/.codex/worktrees/65ad/TradeReview DEPLOY_ROOT=/Users/zhoulin/projects/TradeReview deploy-status
make -C /Users/zhoulin/.codex/worktrees/65ad/TradeReview DEPLOY_ROOT=/Users/zhoulin/projects/TradeReview deploy-backup
```

The default service URL is `http://127.0.0.1:4317`. The active application is
`/Users/zhoulin/projects/TradeReview/app/current`; releases change this
symlink atomically. The container bind-mounts
`/Users/zhoulin/projects/TradeReview/data/sqlite` at
`/var/lib/tradereview`, so its database is always
`/var/lib/tradereview/tradereview.sqlite` in the container and
`/Users/zhoulin/projects/TradeReview/data/sqlite/tradereview.sqlite` on the
host. A new release must not create a second business database.
The Compose healthcheck calls `/api/storage/status`, which opens SQLite and
initializes the schema; lazy database/schema failures therefore block release
publication.

## Verify the browser migration

1. Open `http://127.0.0.1:4317` in the browser profile that contains the old
   TradeReview data.
2. Wait for the workspace to finish its SQLite migration. Do not close or
   reload while the migration progress state is shown.
3. Run `make ... deploy-status` above. Confirm it reports the SQLite schema
   version, browser migration report, per-table record counts, and the stable
   database location/label. Record the inserted, duplicate, conflict, and
   failed counts plus the validation digest.
4. Reload the browser. The same records must render from SQLite; it must not
   re-import the browser rollback copy. Confirm an empty profile sees the
   SQLite data only after it has been explicitly imported or restored.

If the migration reports failed records or an unexpected count, stop before
removing any browser rollback data. Capture the report and investigate the
invalid records; the server migration is transactional and retries with the
same fingerprint are idempotent.

Screenshot conflict decisions are sent with the merged snapshot and explicit
replacement ids. This preserves a “use incoming” choice after reload instead
of allowing a second server reconciliation pass to restore the old row.

## Backup and restart verification

`make ... deploy-backup` creates a SQLite online backup under
`/Users/zhoulin/projects/TradeReview/data/backups/`, runs `PRAGMA quick_check`,
and writes matching `.sha256` and `.metadata.json` sidecars. Confirm the
reported checksum and metadata match the intended database schema, migration
state, and table counts before considering the rollout complete.

Then restart via the normal deployment path and check persistence:

```bash
make -C /Users/zhoulin/.codex/worktrees/65ad/TradeReview DEPLOY_ROOT=/Users/zhoulin/projects/TradeReview deploy
make -C /Users/zhoulin/.codex/worktrees/65ad/TradeReview DEPLOY_ROOT=/Users/zhoulin/projects/TradeReview deploy-status
```

Open `http://127.0.0.1:4317` after the restart and verify the migration report,
counts, imported trades, reviews, market data, and chart settings are still
present. If a restore is required, select a verified absolute backup path and
run `make -C /Users/zhoulin/.codex/worktrees/65ad/TradeReview DEPLOY_ROOT=/Users/zhoulin/projects/TradeReview deploy-restore BACKUP=/absolute/path/to/backup.sqlite`,
then repeat status and browser verification.
