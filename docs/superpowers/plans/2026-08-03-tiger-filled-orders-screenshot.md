# 老虎证券已成交股票截图识别实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` when executing this plan. If the user selects inline execution instead, keep the same task boundaries and test checkpoints.

**Goal:** 为当前部署版本增加老虎证券“订单 → 已成交 → 股票”紧凑版长截图的识别与解析，使 `/Users/zhoulin/Documents/TradeReview/trades/截图2.jpg` 能导入为交易记录，同时保持已有富途、老虎截图版式的行为不变。

**Architecture:** 增加显式版式版本 `tiger-filled-orders-dark-v1`。检测器只在“订单”标题、已成交/股票筛选器、四个有序表头以及至少两条完整成交行同时满足时返回该版本；解析器复用老虎成交行流程，新增 `US CTVA`、`HK 06228` 这类组合市场/代码及相邻市场/代码行的归一化；导入 hook 将新版本纳入白名单。OCR 模型、图片切片和部署数据层不作无关改动。

**Tech Stack:** TypeScript, React 19, Vitest, PaddleOCR local WASM worker, Vinext, Docker Compose.

## Global Constraints

- OCR 继续在浏览器本地运行，不上传截图。
- 版式版本使用显式字符串；未知或证据不足的版式必须失败并给出当前不支持提示。
- 已有 `futu-orders-dark-v1`、`tiger-orders-dark-v1`、`tiger-instrument-first-dark-v1` 的检测、解析和证据输出保持兼容。
- 交易市场至少可靠识别 `US` 和 `HK`；数字、价格和数量保留为字符串，不能因格式化丢失前导零或小数位。
- 时间戳沿用现有严格日期/时间解析和当前账户时区处理；缺失时区或账户上下文时继续阻止确认。
- 长图按有界 OCR 行高/行窗口关联成交行，避免跨行误配。
- 实现基线必须是当前部署分支 `agent/remove-production-demo` 的提交 `5b4bd901e373ea3b56db08d84d2208d421eb4c26`，并保留已部署的 SQLite、浏览器迁移和既有截图修复。
- 部署验证不得删除或重置目标配置、数据库、备份、日志或浏览器用户数据。

## Task 1: Add an explicit detector for the compact Tiger filled-orders layout

**Files:**

- Modify `app/lib/import/screenshot/layout-detector.ts`
- Modify `app/lib/import/screenshot/fixtures/ocr-lines.ts`
- Modify `app/lib/import/screenshot/layout-detector.test.ts`

**Interface:** Extend the layout-version union with `tiger-filled-orders-dark-v1`; add a deterministic OCR fixture representing the supplied screenshot, including the title, both filters, ordered headers, and multiple rows. The detector must return the new version only when all required structural signals are present.

**Steps:**

1. Add a failing fixture/test. Assert the complete fixture returns `tiger-filled-orders-dark-v1`; assert that removing the 股票 filter, reordering/removing a header, or leaving only one complete row does not return the new version.

   ```ts
   expect(detectScreenshotLayout(TIGER_FILLED_ORDERS_SCREENSHOT_OCR)).toMatchObject({
     version: "tiger-filled-orders-dark-v1",
   });
   expect(detectScreenshotLayout(withoutText(TIGER_FILLED_ORDERS_SCREENSHOT_OCR, "股票")).version)
     .not.toBe("tiger-filled-orders-dark-v1");
   ```

2. Run `npm run test:unit -- app/lib/import/screenshot/layout-detector.test.ts`; confirm the new assertions fail because the version is not yet implemented.
3. Implement the dedicated detector branch with normalized aliases for the title/filter/header text, ordered-anchor checks, and a minimum of two bounded complete rows. Keep ambiguous evidence on the existing unsupported path rather than guessing another Tiger version.
4. Run the same focused test command; confirm the new and legacy detector cases pass.
5. Commit the detector and fixture changes with `git add app/lib/import/screenshot/layout-detector.ts app/lib/import/screenshot/fixtures/ocr-lines.ts app/lib/import/screenshot/layout-detector.test.ts && git commit -m "fix: detect Tiger filled-orders screenshots"`.

## Task 2: Parse combined and adjacent market/code identities

**Files:**

- Modify `app/lib/import/screenshot/parsers/tiger-screenshot.ts`
- Modify `app/lib/import/screenshot/parsers/tiger-screenshot.test.ts`
- Modify `app/lib/import/screenshot/to-statement-result.test.ts`

**Interface:** Add a parser helper that returns `{ market?: "US" | "HK"; symbol?: string; symbolLines: OcrTextLine[]; nameLine?: OcrTextLine }` for either a combined identity (`US CTVA`, `HK 06228`) or adjacent market/code OCR lines. Preserve the existing parser return shape, layout version, and evidence fields.

**Steps:**

1. Add failing parser and statement-result tests using the new fixture. Assert `US / CTVA / 卖出 / 100 / 88.76 / 2026/07/29 23:01:17` for the CTVA row and `HK / 06228 / 卖出 / 200 / 26.380 / 2026/06/26 10:22:37` for the HK row. Assert an unknown market prefix does not invent a market and that existing side-first/instrument-first fixtures remain unchanged.
2. Run `npm run test:unit -- app/lib/import/screenshot/parsers/tiger-screenshot.test.ts app/lib/import/screenshot/to-statement-result.test.ts`; confirm the new expectations fail.
3. Implement the helper using canonical instrument normalization, explicit `US`/`HK` prefix handling, adjacent-line fallback, and the existing bounded row window. Select the first two numeric cells as quantity/price, preserve decimal text, choose the closest valid date/time pair, and include all identity lines in evidence.
4. Run the focused parser/statement tests; confirm all new and legacy cases pass.
5. Commit with `git add app/lib/import/screenshot/parsers/tiger-screenshot.ts app/lib/import/screenshot/parsers/tiger-screenshot.test.ts app/lib/import/screenshot/to-statement-result.test.ts && git commit -m "fix: parse Tiger filled-order identities"`.

## Task 3: Allow the new version through screenshot import

**Files:**

- Modify `app/components/import/use-screenshot-import.ts`
- Modify `app/components/import/use-screenshot-import.test.tsx`
- Modify `app/lib/import/screenshot/review-state.ts` and `app/lib/import/screenshot/review-state.test.ts` for persisted review provenance

**Interface:** Add `tiger-filled-orders-dark-v1` to the supported layout unions/guards in the import hook and review state, while still rejecting unknown versions. Preserve metadata origin and confirmation-blocking behavior.

**Steps:**

1. Add failing hook/review-state tests for the new version and for an unknown version.
2. Run the hook/review-state-focused unit test command and confirm the new-version assertion fails.
3. Add the literal to each supported union/guard without broadening the type to arbitrary strings.
4. Re-run `npm run test:unit -- app/components/import/use-screenshot-import.test.tsx app/lib/import/screenshot/review-state.test.ts app/lib/import/screenshot`; confirm pass.
5. Commit with `git add app/components/import/use-screenshot-import.ts app/components/import/use-screenshot-import.test.tsx app/lib/import/screenshot/review-state.ts app/lib/import/screenshot/review-state.test.ts && git commit -m "fix: enable Tiger filled-order import"`.

## Task 4: Verify against the deployed application and preserve release state

1. Before implementation, align this clean worktree to detached commit `5b4bd901e373ea3b56db08d84d2208d421eb4c26` without destructive reset; cherry-pick the design and plan commits so the active deployment fixes remain the base.
2. Run the complete verification set: `npm run test:unit`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`, and `git diff --check`. Record failures with their exact command/output before changing code.
3. Deploy only code using `make deploy-code DEPLOY_ROOT=/Users/zhoulin/projects/TradeReview`. Verify the release health endpoint, release symlink, SQLite file presence/size, and that no target config/data/backup/log files changed.
4. In the deployed app at `http://127.0.0.1:4317/`, upload `/Users/zhoulin/Documents/TradeReview/trades/截图2.jpg`, wait for all OCR tiles to finish, and assert a nonzero trade count with no unsupported-layout error. Verify the CTVA and HK fields from Task 2, that account/timezone blockers still disable confirmation, and that no OCR model asset request fails.
5. Run `git status --short --branch` and inspect the deployment log. Only source/test/docs changes may remain in the worktree; do not commit generated screenshots, browser artifacts, databases, logs, or environment files.

## Plan self-review checklist

- Every task names concrete files, interfaces, tests, commands, and commit boundaries.
- The supplied screenshot has deterministic acceptance assertions, including both US and HK examples.
- The plan explicitly preserves the current deployment branch and data state.
- No OCR/model/pipeline rewrite is included because the deployed investigation showed successful OCR and a layout-only failure.
