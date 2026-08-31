import { describe, expect, it } from "vitest";

import type {
  ScreenshotField,
  ScreenshotTradeDraft,
} from "./contracts";
import {
  screenshotReviewReducer,
  type ScreenshotReviewState,
} from "./review-state";
import { toStatementParseResult } from "./to-statement-result";

const FIELDS: ScreenshotField[] = [
  "market",
  "symbol",
  "side",
  "quantity",
  "price",
  "executedAt",
];

function draft(
  id: string,
  overrides: Partial<ScreenshotTradeDraft> = {},
): ScreenshotTradeDraft {
  const raw: Record<ScreenshotField, string> = {
    market: "HK",
    symbol: "00700",
    side: "buy",
    quantity: "200",
    price: "381.4",
    executedAt: "24/06/05 14:41:08",
  };
  return {
    id,
    broker: "futu",
    layoutVersion: "futu-orders-dark-v1",
    imageId: "image-1",
    sourceRowIndex: 4,
    sourceBounds: { x: 20, y: 530, width: 1135, height: 57 },
    market: "HK",
    symbol: "700",
    sourceName: "腾讯控股",
    side: "buy",
    quantity: "200",
    price: "381.4",
    sourceTimestampText: "24/06/05 14:41:08",
    sourceAccountSuffix: "4321",
    fieldEvidence: Object.fromEntries(
      FIELDS.map((field) => [
        field,
        {
          rawText: raw[field],
          confidence: 0.96,
          repaired: false,
          confirmedByUser: field === "executedAt",
        },
      ]),
    ),
    ...overrides,
  };
}

function state(
  drafts: ScreenshotTradeDraft[] = [draft("image-1:futu:4")],
): ScreenshotReviewState {
  return {
    batchId: "screenshot-batch:abc",
    images: [
      {
        imageId: "image-1",
        fingerprint: "image-fingerprint",
        captureIndex: 2,
        broker: "futu",
        layoutVersion: "futu-orders-dark-v1",
      },
    ],
    drafts,
    deletedDraftIds: new Set(),
    sourceTimezone: "Asia/Hong_Kong",
  };
}

describe("toStatementParseResult", () => {
  it("converts reviewed screenshot fields and exact source provenance", () => {
    expect(toStatementParseResult(state())).toEqual({
      broker: "futu",
      records: [
        {
          id: "futu:image-fingerprint:4",
          source: {
            platform: "futu",
            row: 4,
            sourceOrder: 4,
            timePrecision: "second",
            fileFingerprint: "image-fingerprint",
            sourceTimestampText: "24/06/05 14:41:08",
            sourceTimezone: "Asia/Hong_Kong",
            inputKind: "screenshot",
            batchId: "screenshot-batch:abc",
            captureIndex: 2,
            sourceBounds: {
              x: 20,
              y: 530,
              width: 1135,
              height: 57,
            },
          },
          accountId: "screenshot:futu",
          accountLabel: "富途",
          instrument: {
            id: "HK:700",
            symbol: "700",
            name: "腾讯控股",
            market: "HK",
            currency: "HKD",
          },
          side: "buy",
          executedAt: "2024-06-05T06:41:08Z",
          quantity: "200",
          price: "381.4",
          fee: "0",
        },
      ],
      candidates: [
        {
          market: "HK",
          symbol: "700",
          sourceName: "腾讯控股",
          sourceAssetType: "unknown",
        },
      ],
      exclusions: [],
      diagnostics: [],
      blocked: false,
    });
  });

  it("converts OCR-spaced timestamps without rewriting raw provenance", () => {
    const rawTimestamp = "24/  06/05 14:  41:08";
    const spacedTimestamp = draft("image-1:futu:4");
    spacedTimestamp.sourceTimestampText = rawTimestamp;
    spacedTimestamp.fieldEvidence.executedAt = {
      ...spacedTimestamp.fieldEvidence.executedAt!,
      rawText: rawTimestamp,
    };

    const result = toStatementParseResult(state([spacedTimestamp]));

    expect(result.records[0]).toMatchObject({
      executedAt: "2024-06-05T06:41:08Z",
      source: { sourceTimestampText: rawTimestamp },
    });
    expect(spacedTimestamp.fieldEvidence.executedAt.rawText).toBe(
      rawTimestamp,
    );
  });

  it("uses explicit account selection instead of the parsed suffix", () => {
    const current = state();
    current.account = { id: "chosen", label: "Chosen account" };

    expect(toStatementParseResult(current).records[0]).toMatchObject({
      accountId: "chosen",
      accountLabel: "Chosen account",
    });
  });

  it("auto-resolves one consistent broker without requiring an account suffix", () => {
    const consistent = state([
      draft("image-1:futu:4"),
      draft("image-1:futu:5", { sourceRowIndex: 5 }),
    ]);
    expect(toStatementParseResult(consistent).records).toHaveLength(2);

    const withoutSuffix = state([
      draft("image-1:futu:4", { sourceAccountSuffix: undefined }),
    ]);
    expect(toStatementParseResult(withoutSuffix).records).toHaveLength(1);
  });

  it("keeps provenance distinct across a homogeneous multi-image batch", () => {
    const second = draft("image-2:futu:0", {
      imageId: "image-2",
      sourceRowIndex: 0,
    });
    const current = state([draft("image-1:futu:4"), second]);
    current.images.push({
      imageId: "image-2",
      fingerprint: "image-fingerprint-2",
      captureIndex: 3,
      broker: "futu",
      layoutVersion: "futu-orders-dark-v1",
    });

    const result = toStatementParseResult(current);
    expect(
      result.records.map(({ source }) => ({
        fingerprint: source.fileFingerprint,
        captureIndex: source.captureIndex,
      })),
    ).toEqual([
      { fingerprint: "image-fingerprint", captureIndex: 2 },
      { fingerprint: "image-fingerprint-2", captureIndex: 3 },
    ]);
  });

  it("keeps row identity stable when the same screenshot is imported in another batch", () => {
    const alone = state();
    const combined = state();
    combined.batchId = "screenshot-batch:different";
    combined.images[0] = {
      ...combined.images[0],
      captureIndex: 0,
    };

    expect(toStatementParseResult(alone).records[0].id).toBe(
      toStatementParseResult(combined).records[0].id,
    );
  });

  it("uses the same row identity for repeated captures with the same fingerprint", () => {
    const repeated = state([
      draft("image-1:futu:4"),
      draft("image-2:futu:4", { imageId: "image-2" }),
    ]);
    repeated.images.push({
      ...repeated.images[0],
      imageId: "image-2",
      captureIndex: 3,
    });

    const [first, second] = toStatementParseResult(repeated).records;
    expect(first.id).toBe(second.id);
    expect(first.source.captureIndex).not.toBe(second.source.captureIndex);
  });

  it("cannot bypass low-confidence or repaired field review", () => {
    const lowConfidence = draft("image-1:futu:4", {
      fieldEvidence: {
        ...draft("base").fieldEvidence,
        price: {
          rawText: "381.4",
          confidence: 0.8499,
          repaired: true,
          confirmedByUser: false,
        },
      },
    });
    const current = state([lowConfidence]);

    expect(() => toStatementParseResult(current)).toThrow(
      /unconfirmed-field/,
    );

    const confirmed = screenshotReviewReducer(current, {
      type: "confirm-field",
      draftId: lowConfidence.id,
      field: "price",
    });
    expect(toStatementParseResult(confirmed).records).toHaveLength(1);
  });

  it("converts an exact-second timestamp when confidence is sufficient", () => {
    const unconfirmedTime = draft("image-1:futu:4", {
      fieldEvidence: {
        ...draft("base").fieldEvidence,
        executedAt: {
          rawText: "24/06/05 14:41:08",
          confidence: 1,
          repaired: false,
          confirmedByUser: false,
        },
      },
    });
    const current = state([unconfirmedTime]);

    expect(toStatementParseResult(current).records).toHaveLength(1);
  });

  it("throws instead of converting when any blocker remains", () => {
    const current = state();
    current.images = [];

    expect(() => toStatementParseResult(current)).toThrow(
      /invalid-field/,
    );
  });

  it("omits deleted drafts from records and candidates", () => {
    const removed = draft("image-1:futu:5", {
      sourceRowIndex: 5,
      symbol: "1810",
      sourceName: "小米集团-W",
    });
    const current = state([draft("image-1:futu:4"), removed]);
    current.deletedDraftIds.add(removed.id);

    const result = toStatementParseResult(current);
    expect(result.records).toHaveLength(1);
    expect(result.candidates).toHaveLength(1);
    expect(result.records[0].instrument.symbol).toBe("700");
  });
});
