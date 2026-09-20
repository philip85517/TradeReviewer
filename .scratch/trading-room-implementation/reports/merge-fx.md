# FX merge resolution

Kept the master trade-library FX contracts and `/api/fx` route (`fx.rates.snapshot.v1`, ECB snapshot read on GET and manual refresh on POST). Moved the feature's BOC daily service contract into `app/lib/fx/room-contracts.ts`, its contract test into `room-contracts.test.ts`, and its route/tests into `/api/trading-room/fx`. Updated the BOC parser, service, hook, tests, and moved route imports to use the room contract; the room hook now calls `/api/trading-room/fx`. The master service suite remains in `app/lib/fx/fx-service.test.ts`; the BOC suite is preserved as `room-fx-service.test.ts`.

Focused validation:

- `npm run test:unit -- app/api/fx/route.test.ts app/api/trading-room/fx/route.test.ts app/lib/fx/room-contracts.test.ts app/lib/fx/room-fx-service.test.ts app/lib/fx/boc-parser.test.ts app/lib/fx/use-fx-rates.test.tsx app/lib/fx/fx-service.test.ts` — 7 files, 30 tests passed.
- `npm run typecheck` — passed.
- `npx eslint` on the resolved FX files — passed.

Root-owned follow-up imports/tests that still refer to the room BOC contract or endpoint:

- `app/components/trade-review-workspace.tsx`: import `toRoomFxSnapshot` from `../lib/fx/room-contracts`.
- `app/components/data-management/fx-panel.tsx`: import `FxState` from `../../lib/fx/room-contracts`.
- `app/lib/reviews/trading-room-quality.ts` and `.test.ts`: import `FxState` from `../fx/room-contracts`.
- BOC fetch stubs/assertions in `app/components/trade-review-workspace.test.tsx` and `trade-review-workspace.import-flow.test.tsx` should use `/api/trading-room/fx`; library controls continue using `/api/fx`.

No database files were touched. Files remain unstaged/uncommitted for the coordinator to integrate.
