import { describe, expect, it } from "vitest";

import type {
  ScreenshotField,
  ScreenshotTradeDraft,
} from "./contracts";
import {
  TIGER_FILLED_ORDERS_SCREENSHOT_OCR,
  TIGER_INSTRUMENT_FIRST_SCREENSHOT_OCR,
} from "./__fixtures__/ocr-lines";
import { parseTigerScreenshot } from "./tiger-screenshot";
import {
  resolvedReviewAccount,
  reviewBlockers,
  screenshotReviewReducer,
  type ScreenshotReviewState,
} from "./review-state";

const FIELDS: ScreenshotField[] = [
  "market",
  "symbol",
  "side",
  "quantity",
  "price",
  "executedAt",
];

function draft(
  id = "image-1:tiger:0",
  overrides: Partial<ScreenshotTradeDraft> = {},
): ScreenshotTradeDraft {
  const values: Record<ScreenshotField, string> = {
    market: "US",
    symbol: "NVDA",
    side: "buy",
    quantity: "10",
    price: "120.5",
    executedAt: "2024/06/05 14:39:25",
  };
  return {
    id,
    broker: "tiger",
    layoutVersion: "tiger-orders-dark-v1",
    imageId: "image-1",
    sourceRowIndex: 0,
    sourceBounds: { x: 20, y: 390, width: 1140, height: 57 },
    market: "US",
    symbol: "NVDA",
    sourceName: "NVIDIA",
    side: "buy",
    quantity: "10",
    price: "120.5",
    sourceTimestampText: "2024/06/05 14:39:25",
    sourceAccountSuffix: "U6789",
    fieldEvidence: Object.fromEntries(
      FIELDS.map((field) => [
        field,
        {
          rawText: values[field],
          confidence: 0.85,
          repaired: false,
          confirmedByUser: field === "executedAt",
        },
      ]),
    ),
    ...overrides,
  };
}

function state(
  drafts: ScreenshotTradeDraft[] = [draft()],
): ScreenshotReviewState {
  return {
    batchId: "screenshot-batch:batch",
    images: [
      {
        imageId: "image-1",
        fingerprint: "fingerprint-1",
        captureIndex: 0,
        broker: "tiger",
        layoutVersion: "tiger-orders-dark-v1",
      },
    ],
    drafts,
    deletedDraftIds: new Set(),
    sourceTimezone: "Asia/Hong_Kong",
    account: { id: "account-1", label: "Tiger account" },
  };
}

describe("screenshotReviewReducer", () => {
  it("confirms only the selected low-confidence field", () => {
    const current = state([
      draft("image-1:tiger:0", {
        fieldEvidence: {
          ...draft().fieldEvidence,
          price: {
            rawText: "120.5",
            confidence: 0.8499,
            repaired: false,
            confirmedByUser: false,
          },
          quantity: {
            rawText: "10",
            confidence: 0.8499,
            repaired: false,
            confirmedByUser: false,
          },
        },
      }),
    ]);

    const next = screenshotReviewReducer(current, {
      type: "confirm-field",
      draftId: "image-1:tiger:0",
      field: "price",
    });

    expect(
      reviewBlockers(next).map(({ field }) => field),
    ).toEqual(["quantity"]);
    expect(current.drafts[0].fieldEvidence.price?.confirmedByUser).toBe(
      false,
    );
  });

  it("normalizes edited decimals and marks each edited field confirmed", () => {
    const quantityEdited = screenshotReviewReducer(state(), {
      type: "edit-field",
      draftId: "image-1:tiger:0",
      field: "quantity",
      value: " 1,234.500 ",
    });
    const priceEdited = screenshotReviewReducer(quantityEdited, {
      type: "edit-field",
      draftId: "image-1:tiger:0",
      field: "price",
      value: "00120.0500",
    });

    expect(priceEdited.drafts[0]).toMatchObject({
      quantity: "1234.5",
      price: "120.05",
      fieldEvidence: {
        quantity: {
          rawText: " 1,234.500 ",
          repaired: false,
          confirmedByUser: true,
        },
        price: {
          rawText: "00120.0500",
          repaired: false,
          confirmedByUser: true,
        },
      },
    });
  });

  it("clears stale DST disambiguation when the timestamp is edited", () => {
    const current = state([
      draft("image-1:tiger:0", { timeDisambiguation: "later" }),
    ]);

    const next = screenshotReviewReducer(current, {
      type: "edit-field",
      draftId: "image-1:tiger:0",
      field: "executedAt",
      value: "24/11/03 01:30:00",
    });

    expect(next.drafts[0].timeDisambiguation).toBeUndefined();
  });

  it("tracks deletion in a new Set and excludes the deleted row", () => {
    const blocked = draft("image-1:tiger:1", { price: undefined });
    const current = state([draft(), blocked]);

    const next = screenshotReviewReducer(current, {
      type: "delete-draft",
      draftId: blocked.id,
    });

    expect(next.deletedDraftIds).not.toBe(current.deletedDraftIds);
    expect(current.deletedDraftIds.size).toBe(0);
    expect(next.deletedDraftIds).toEqual(new Set([blocked.id]));
    expect(reviewBlockers(next)).toEqual([]);
  });

  it("adds a blank manual row tied to the selected image", () => {
    const current = state();
    const next = screenshotReviewReducer(current, {
      type: "add-draft",
      imageId: "image-1",
    });

    expect(next.drafts).toHaveLength(2);
    expect(next.drafts[1]).toMatchObject({
      id: "image-1:manual:1",
      broker: "tiger",
      layoutVersion: "tiger-orders-dark-v1",
      imageId: "image-1",
      sourceRowIndex: 1,
      sourceAccountSuffix: "U6789",
      fieldEvidence: {},
    });
    expect(next.drafts[1].market).toBeUndefined();
    expect(reviewBlockers(next).some(({ draftId }) =>
      draftId === "image-1:manual:1")).toBe(true);
  });

  it("adds a blank row from supported image metadata without parsed drafts", () => {
    const current = state([]);

    const next = screenshotReviewReducer(current, {
      type: "add-draft",
      imageId: "image-1",
    });

    expect(next.drafts).toEqual([
      expect.objectContaining({
        id: "image-1:manual:0",
        broker: "tiger",
        layoutVersion: "tiger-orders-dark-v1",
        imageId: "image-1",
        sourceRowIndex: 0,
        fieldEvidence: {},
      }),
    ]);
  });

  it("does not add a row without supported image metadata", () => {
    const missing = state([]);
    missing.images = [];
    expect(
      screenshotReviewReducer(missing, {
        type: "add-draft",
        imageId: "image-1",
      }).drafts,
    ).toEqual([]);

    const unsupported = state([]);
    unsupported.images[0] = {
      ...unsupported.images[0],
      layoutVersion: "unsupported-layout",
    } as unknown as ScreenshotReviewState["images"][number];
    expect(
      screenshotReviewReducer(unsupported, {
        type: "add-draft",
        imageId: "image-1",
      }).drafts,
    ).toEqual([]);
  });

  it("stores normalized timezone and explicit account selections", () => {
    const timezone = screenshotReviewReducer(state(), {
      type: "set-time-zone",
      timeZone: " America/New_York ",
    });
    const account = screenshotReviewReducer(timezone, {
      type: "set-account",
      accountId: "existing-account",
      accountLabel: "Existing account",
    });

    expect(account.sourceTimezone).toBe("America/New_York");
    expect(account.account).toEqual({
      id: "existing-account",
      label: "Existing account",
    });
  });

  it("uses each market's default source timezone when the batch has mixed markets", () => {
    const hk = draft("image-1:tiger:0", {
      market: "HK",
      sourceTimestampText: "24/06/05 14:41:08",
    });
    const us = draft("image-1:tiger:1", {
      sourceRowIndex: 1,
      market: "US",
      sourceTimestampText: "24/06/05 14:41:08",
    });
    const current = state([hk, us]);
    current.sourceTimezone = undefined;

    expect(reviewBlockers(current)).toEqual([]);
  });
});

describe("reviewBlockers", () => {
  it("accepts parsed compact Tiger filled-orders provenance for review", () => {
    const [parsed] = parseTigerScreenshot(
      TIGER_FILLED_ORDERS_SCREENSHOT_OCR,
    );
    const current: ScreenshotReviewState = {
      batchId: "screenshot-batch:filled-orders",
      images: [
        {
          imageId: TIGER_FILLED_ORDERS_SCREENSHOT_OCR.imageId,
          fingerprint: "anonymous-fixture",
          captureIndex: 0,
          broker: "tiger",
          layoutVersion: "tiger-filled-orders-dark-v1",
        },
      ],
      drafts: [parsed],
      deletedDraftIds: new Set(),
      sourceTimezone: "Asia/Hong_Kong",
      account: { id: "account-1", label: "Tiger account" },
    };

    expect(
      reviewBlockers(current).filter(
        ({ code, draftId, field }) =>
          code === "invalid-field" && draftId === parsed.id && !field,
      ),
    ).toEqual([]);
  });

  it("infers a broker-only account label when the screenshot has no account suffix", () => {
    const current = state([
      draft("image-1:tiger:0", { sourceAccountSuffix: undefined }),
    ]);
    current.account = undefined;

    expect(resolvedReviewAccount(current)).toEqual({
      id: "screenshot:tiger",
      label: "老虎",
    });
    expect(reviewBlockers(current)).not.toContainEqual(
      expect.objectContaining({ code: "missing-account" }),
    );
  });

  it("accepts parsed Tiger instrument-first provenance for review", () => {
    const [parsed] = parseTigerScreenshot(
      TIGER_INSTRUMENT_FIRST_SCREENSHOT_OCR,
    );
    const current: ScreenshotReviewState = {
      batchId: "screenshot-batch:instrument-first",
      images: [
        {
          imageId: TIGER_INSTRUMENT_FIRST_SCREENSHOT_OCR.imageId,
          fingerprint: "anonymous-fixture",
          captureIndex: 0,
          broker: "tiger",
          layoutVersion: "tiger-instrument-first-dark-v1",
        },
      ],
      drafts: [parsed],
      deletedDraftIds: new Set(),
      sourceTimezone: "Asia/Hong_Kong",
      account: { id: "account-1", label: "Tiger account" },
    };

    expect(
      reviewBlockers(current).filter(
        ({ code, draftId, field }) =>
          code === "invalid-field" && draftId === parsed.id && !field,
      ),
    ).toEqual([]);
  });

  it("uses 0.85 as the exact confidence boundary", () => {
    const below = draft("image-1:tiger:0", {
      fieldEvidence: {
        ...draft().fieldEvidence,
        price: {
          rawText: "120.5",
          confidence: 0.8499,
          repaired: false,
          confirmedByUser: false,
        },
      },
    });
    const boundary = draft("image-1:tiger:0", {
      fieldEvidence: {
        ...draft().fieldEvidence,
        price: {
          rawText: "120.5",
          confidence: 0.85,
          repaired: false,
          confirmedByUser: false,
        },
      },
    });

    expect(reviewBlockers(state([below]))).toContainEqual(
      expect.objectContaining({
        code: "unconfirmed-field",
        field: "price",
      }),
    );
    expect(reviewBlockers(state([boundary]))).toEqual([]);
  });

  it("requires confirmation for repaired evidence regardless of score", () => {
    const repaired = draft("image-1:tiger:0", {
      fieldEvidence: {
        ...draft().fieldEvidence,
        price: {
          rawText: "I2.O5",
          confidence: 1,
          repaired: true,
          confirmedByUser: false,
        },
      },
    });

    const blockers = reviewBlockers(state([repaired]));
    expect(blockers).toContainEqual(
      expect.objectContaining({
        code: "unconfirmed-field",
        field: "price",
      }),
    );
  });

  it("auto-accepts an exact-second timestamp with sufficient confidence", () => {
    const unconfirmedTime = draft("image-1:tiger:0", {
      fieldEvidence: {
        ...draft().fieldEvidence,
        executedAt: {
          rawText: "2024/06/05 14:39:25",
          confidence: 1,
          repaired: false,
          confirmedByUser: false,
        },
      },
    });

    expect(reviewBlockers(state([unconfirmedTime]))).toEqual([]);
  });

  it("still requires confirmation for low-confidence or repaired timestamps", () => {
    const lowConfidence = draft("image-1:tiger:0", {
      fieldEvidence: {
        ...draft().fieldEvidence,
        executedAt: {
          rawText: "2024/06/05 14:39:25",
          confidence: 0.8499,
          repaired: false,
          confirmedByUser: false,
        },
      },
    });
    const repaired = draft("image-1:tiger:0", {
      fieldEvidence: {
        ...draft().fieldEvidence,
        executedAt: {
          rawText: "2024/06/05 14:39:25",
          confidence: 1,
          repaired: true,
          confirmedByUser: false,
        },
      },
    });

    expect(reviewBlockers(state([lowConfidence]))).toContainEqual(
      expect.objectContaining({
        code: "unconfirmed-field",
        field: "executedAt",
      }),
    );
    expect(reviewBlockers(state([repaired]))).toContainEqual(
      expect.objectContaining({
        code: "unconfirmed-field",
        field: "executedAt",
      }),
    );
  });

  it("does not require manual timezone selection for a supported market", () => {
    const current = state([
      draft("image-1:tiger:0", { sourceAccountSuffix: undefined }),
    ]);
    current.sourceTimezone = undefined;
    current.account = undefined;

    expect(reviewBlockers(current)).not.toContainEqual(
      expect.objectContaining({ code: "missing-timezone" }),
    );
    expect(reviewBlockers(current)).not.toContainEqual(
      expect.objectContaining({ code: "missing-account" }),
    );
  });

  it("does not accept an empty explicit account selection", () => {
    const current = state([
      draft("image-1:tiger:0", { sourceAccountSuffix: undefined }),
    ]);
    current.account = { id: "", label: " " };

    expect(reviewBlockers(current)).toContainEqual(
      expect.objectContaining({ code: "missing-account" }),
    );
  });

  it("does not trust non-finite confidence evidence", () => {
    const invalidConfidence = draft("image-1:tiger:0", {
      fieldEvidence: {
        ...draft().fieldEvidence,
        price: {
          rawText: "120.5",
          confidence: Number.NaN,
          repaired: false,
          confirmedByUser: false,
        },
      },
    });

    expect(reviewBlockers(state([invalidConfidence]))).toContainEqual(
      expect.objectContaining({
        code: "unconfirmed-field",
        field: "price",
      }),
    );
  });

  it("blocks non-positive quantity and price even when user-confirmed", () => {
    const zero = screenshotReviewReducer(state(), {
      type: "edit-field",
      draftId: "image-1:tiger:0",
      field: "quantity",
      value: "0",
    });
    const negative = screenshotReviewReducer(zero, {
      type: "edit-field",
      draftId: "image-1:tiger:0",
      field: "price",
      value: "-1.5",
    });

    expect(reviewBlockers(negative)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid-field",
          field: "quantity",
        }),
        expect.objectContaining({
          code: "invalid-field",
          field: "price",
        }),
      ]),
    );
  });

  it("blocks invalid and ambiguous times only on affected rows", () => {
    const valid = draft("image-1:tiger:0");
    const invalid = draft("image-1:tiger:1", {
      sourceRowIndex: 1,
      sourceTimestampText: "unknown",
    });
    const ambiguous = draft("image-1:tiger:2", {
      sourceRowIndex: 2,
      sourceTimestampText: "24/11/03 01:30:00",
    });
    const current = state([valid, invalid, ambiguous]);
    current.sourceTimezone = "America/New_York";

    expect(
      reviewBlockers(current).filter(
        ({ field }) => field === "executedAt",
      ),
    ).toEqual([
      expect.objectContaining({
        code: "invalid-field",
        draftId: invalid.id,
      }),
      expect.objectContaining({
        code: "ambiguous-time",
        draftId: ambiguous.id,
      }),
    ]);
  });

  it("clears an ambiguous-time blocker when disambiguation is selected", () => {
    const repeated = draft("image-1:tiger:0", {
      sourceTimestampText: "24/11/03 01:30:00",
    });
    const current = state([repeated]);
    current.sourceTimezone = "America/New_York";

    const next = screenshotReviewReducer(current, {
      type: "set-time-disambiguation",
      draftId: repeated.id,
      value: "later",
    });

    expect(reviewBlockers(next)).toEqual([]);
  });

  it("blocks an active row whose image metadata is missing", () => {
    const current = state();
    current.images = [];

    expect(reviewBlockers(current)).toContainEqual(
      expect.objectContaining({
        code: "invalid-field",
        draftId: "image-1:tiger:0",
      }),
    );
  });

  it("blocks image metadata whose supported layout does not match the row", () => {
    const current = state();
    current.images[0] = {
      ...current.images[0],
      broker: "futu",
      layoutVersion: "futu-orders-dark-v1",
    };

    expect(reviewBlockers(current)).toContainEqual(
      expect.objectContaining({
        code: "invalid-field",
        draftId: "image-1:tiger:0",
      }),
    );
  });

  it("blocks mixed Futu and Tiger rows at batch scope", () => {
    const futu = draft("image-1:futu:1", {
      broker: "futu",
      sourceRowIndex: 1,
      sourceAccountSuffix: "4321",
    });
    const current = state([draft(), futu]);
    current.account = { id: "chosen", label: "Chosen account" };

    expect(reviewBlockers(current)).toContainEqual({
      code: "invalid-field",
      message: "请将富途和老虎截图分开导入",
    });
  });
});
