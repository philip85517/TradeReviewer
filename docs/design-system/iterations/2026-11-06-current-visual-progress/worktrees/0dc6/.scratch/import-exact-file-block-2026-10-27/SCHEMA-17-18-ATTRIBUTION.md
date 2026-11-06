# npm test schema 17/18 失败归因（只读）

- 原始证据：ROOT-NPM-TEST-03.log:152–167，`tests/local-dev-storage.test.mjs:63` 失败，HTTP status 200 后响应 `schemaVersion=18`，断言预期 17。
- 测试由 `TRADEREVIEW_DB_PATH` 显式指定 `mkdtempSync` 临时目录启动本地服务，失败不是业务数据库版本读取或本次测试污染。
- `app/lib/storage/sqlite-store.ts:1644` 的 status 取 `SQLITE_MIGRATIONS.at(-1)?.version ?? 0`；当前 `db/sqlite-schema.ts` 末尾已有 `migration(18, "persist-import-history-evidence-audit", IMPORT_HISTORY_AUDIT_SCHEMA)`，故返回 18 与当前迁移列表一致。
- 当前 dirty 工作树相对 HEAD 的 `db/sqlite-schema.ts` 已包含 15–18 等独立工作；`tests/local-dev-storage.test.mjs` 相对 HEAD 已从 14 改为 17，未跟到 18。该版本期望与当前 schema 列表脱节。
- 候选 1/2/3 的任务文件清单及本轮计划均不含 db/sqlite-schema.ts、db/import-history-audit-schema.ts 或 tests/local-dev-storage.test.mjs；本轮未编辑它们。不能把这项既存集成失败报告为通过，也不擅自把 17 改成 18。
- 修复 owner：协调者确认 schema 18 所属工作后，选择按正式迁移版本更新测试或以迁移列表作为动态期望；本票仅定位归因。
