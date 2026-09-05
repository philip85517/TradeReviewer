import {
  canonicalInstrumentId,
  canonicalInstrumentSymbol,
  instrumentDisplayName,
} from "../../instruments/display-name";
import type {
  ParsedInstrumentCandidate,
  StatementParseResult,
} from "../contracts";
import {
  resolvedReviewAccount,
  reviewBlockers,
  sourceTimezoneForDraft,
  type ScreenshotReviewState,
} from "./review-state";
import { wallClockToInstant } from "./time";

const MARKET_CURRENCY = {
  US: "USD",
  HK: "HKD",
  "CN-SH": "CNY",
  "CN-SZ": "CNY",
} as const;

export function toStatementParseResult(
  state: ScreenshotReviewState,
): StatementParseResult {
  const blockers = reviewBlockers(state);
  if (blockers.length > 0) {
    throw new Error(
      `Screenshot review blocked: ${blockers
        .map(({ code, draftId, field }) =>
          [code, draftId, field].filter(Boolean).join(":"),
        )
        .join(", ")}`,
    );
  }

  const drafts = state.drafts.filter(
    ({ id }) => !state.deletedDraftIds.has(id),
  );
  const account = resolvedReviewAccount(state)!;
  const candidates = new Map<string, ParsedInstrumentCandidate>();
  const records = drafts.map((draft) => {
    const image = state.images.find(
      ({ imageId }) => imageId === draft.imageId,
    )!;
    const symbol = canonicalInstrumentSymbol(
      draft.symbol!,
      draft.market!,
    );
    const instrumentId = canonicalInstrumentId(symbol, draft.market!);
    const sourceTimezone = sourceTimezoneForDraft(state, draft);
    if (!sourceTimezone) {
      throw new Error("Screenshot review blocked: missing-timezone");
    }
    const time = wallClockToInstant(
      draft.sourceTimestampText!,
      sourceTimezone,
      draft.timeDisambiguation,
    );
    if (!time.ok) {
      throw new Error(`Screenshot review blocked: ${time.code}`);
    }
    if (!candidates.has(instrumentId)) {
      candidates.set(instrumentId, {
        market: draft.market!,
        symbol,
        sourceName: draft.sourceName,
        sourceAssetType: "unknown",
      });
    }

    return {
      id: `${draft.broker}:${image.fingerprint}:${draft.sourceRowIndex}`,
      source: {
        platform: draft.broker,
        row: draft.sourceRowIndex,
        sourceOrder: draft.sourceRowIndex,
        timePrecision: "second" as const,
        fileFingerprint: image.fingerprint,
        sourceTimestampText: draft.sourceTimestampText,
        sourceTimezone,
        inputKind: "screenshot" as const,
        batchId: state.batchId,
        captureIndex: image.captureIndex,
        sourceBounds: draft.sourceBounds,
      },
      accountId: account.id,
      accountLabel: account.label,
      instrument: {
        id: instrumentId,
        symbol,
        name: instrumentDisplayName(
          symbol,
          draft.market!,
          draft.sourceName,
        ),
        market: draft.market!,
        currency: MARKET_CURRENCY[draft.market!],
      },
      side: draft.side!,
      executedAt: time.executedAt,
      quantity: draft.quantity!,
      price: draft.price!,
      fee: "0",
    };
  });

  const broker = drafts[0]?.broker ?? state.drafts[0]?.broker ?? "futu";
  return {
    broker,
    records,
    candidates: [...candidates.values()],
    exclusions: [],
    diagnostics: [],
    blocked: false,
  };
}
