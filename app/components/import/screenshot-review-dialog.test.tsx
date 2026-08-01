import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  ExecutionReconciliation,
  ReconciliationDecision,
} from "../../lib/import/execution-reconciliation";
import type {
  ScreenshotField,
  ScreenshotTradeDraft,
} from "../../lib/import/screenshot/contracts";
import type { ScreenshotReviewState } from "../../lib/import/screenshot/review-state";
import type { TradeExecution } from "../../lib/trades/types";
import {
  ScreenshotReviewDialog,
  type ScreenshotReviewDialogProps,
  type ScreenshotReviewImage,
} from "./screenshot-review-dialog";

afterEach(cleanup);

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
  symbol: string,
  sourceRowIndex: number,
  overrides: Partial<ScreenshotTradeDraft> = {},
): ScreenshotTradeDraft {
  const raw: Record<ScreenshotField, string> = {
    market: "US",
    symbol,
    side: "buy",
    quantity: "10",
    price: "100",
    executedAt: "24/06/05 14:41:08",
  };
  return {
    id,
    broker: "tiger",
    layoutVersion: "tiger-orders-dark-v1",
    imageId: sourceRowIndex < 2 ? "image-1" : "image-2",
    sourceRowIndex,
    sourceBounds: {
      x: 40,
      y: 300 + sourceRowIndex * 60,
      width: 980,
      height: 52,
    },
    market: "US",
    symbol,
    sourceName: symbol,
    side: "buy",
    quantity: "10",
    price: "100",
    sourceTimestampText: "24/06/05 14:41:08",
    sourceAccountSuffix: "7788",
    fieldEvidence: Object.fromEntries(
      FIELDS.map((field) => [
        field,
        {
          rawText: raw[field],
          confidence: 0.97,
          repaired: false,
          confirmedByUser: true,
          sourceBounds: {
            x: 120,
            y: 320 + sourceRowIndex * 60,
            width: 180,
            height: 36,
          },
        },
      ]),
    ),
    ...overrides,
  };
}

function reviewState(
  lowConfidence = true,
): ScreenshotReviewState {
  const nvda = draft("draft-nvda", "NVDA", 0, {
    price: "114.8",
    fieldEvidence: {
      ...draft("base", "NVDA", 0).fieldEvidence,
      price: {
        rawText: "114.8?",
        confidence: 0.72,
        repaired: true,
        confirmedByUser: !lowConfidence,
        sourceBounds: { x: 760, y: 320, width: 124, height: 38 },
      },
    },
  });
  return {
    batchId: "screenshot-batch:test",
    images: [
      {
        imageId: "image-1",
        fingerprint: "fingerprint-1",
        captureIndex: 0,
        broker: "tiger",
        layoutVersion: "tiger-orders-dark-v1",
      },
      {
        imageId: "image-2",
        fingerprint: "fingerprint-2",
        captureIndex: 1,
        broker: "tiger",
        layoutVersion: "tiger-orders-dark-v1",
      },
    ],
    drafts: [
      nvda,
      draft("draft-amd", "AMD", 1),
      draft("draft-tsla", "TSLA", 2, { price: "177.1" }),
      draft("draft-aapl", "AAPL", 3, { price: "194.2" }),
    ],
    deletedDraftIds: new Set(),
    sourceTimezone: "America/New_York",
    account: { id: "tiger-7788", label: "老虎 · 7788" },
  };
}

function screenshotExecution(
  id: string,
  symbol: string,
  captureIndex: number,
  row: number,
  price: string,
): TradeExecution {
  return {
    id,
    source: {
      platform: "tiger",
      row,
      sourceOrder: row,
      fileName: `orders-${captureIndex + 1}.png`,
      fileFingerprint: `fingerprint-${captureIndex + 1}`,
      inputKind: "screenshot",
      batchId: "screenshot-batch:test",
      captureIndex,
      sourceBounds: { x: 40, y: 300 + row * 60, width: 980, height: 52 },
    },
    accountId: "tiger-7788",
    accountLabel: "老虎 · 7788",
    instrument: {
      id: `US:${symbol}`,
      symbol,
      name: symbol,
      market: "US",
      currency: "USD",
    },
    side: "buy",
    executedAt: "2024-06-05T18:41:08Z",
    quantity: "10",
    price,
    fee: "0",
  };
}

function statementExecution(
  id: string,
  symbol: string,
  price: string,
): TradeExecution {
  return {
    ...screenshotExecution(id, symbol, 0, 0, price),
    source: {
      platform: "tiger",
      row: 8,
      fileName: "Tiger_2024.pdf",
      fileFingerprint: "statement-fingerprint",
      inputKind: "statement",
    },
  };
}

function reconciliation(): ExecutionReconciliation {
  const conflictIncoming = screenshotExecution(
    "incoming-tsla",
    "TSLA",
    1,
    2,
    "177.1",
  );
  const duplicateIncoming = screenshotExecution(
    "incoming-aapl",
    "AAPL",
    1,
    3,
    "194.2",
  );
  return {
    acceptedIncoming: [],
    automaticReplacementIds: [],
    duplicates: [
      {
        kept: statementExecution("existing-aapl", "AAPL", "194.2"),
        skipped: duplicateIncoming,
      },
    ],
    conflicts: [
      {
        id: "conflict-tsla",
        candidateKey: "US:TSLA|2024-06-05T18:41:08Z",
        existing: [
          statementExecution("existing-tsla", "TSLA", "177.2"),
        ],
        incoming: [conflictIncoming],
      },
    ],
  };
}

const images: ScreenshotReviewImage[] = [
  {
    id: "image-1",
    fileName: "orders-1.png",
    previewUrl: "blob:https://trade-review/image-1",
    width: 1170,
    height: 2532,
    state: "needs-review",
    completedTiles: 4,
    totalTiles: 4,
    tradeCount: 2,
    issueCount: 1,
  },
  {
    id: "image-2",
    fileName: "orders-2.png",
    previewUrl: "blob:https://trade-review/image-2",
    width: 1170,
    height: 2532,
    state: "complete",
    completedTiles: 4,
    totalTiles: 4,
    tradeCount: 2,
    issueCount: 0,
  },
];

function renderDialog({
  state = reviewState(),
  reviewImages = images,
  reviewReconciliation = reconciliation(),
  decisions = new Map<string, ReconciliationDecision>(),
  onAction = vi.fn(),
  onDecision = vi.fn(),
  onRetryImage = vi.fn(),
  onRemoveImage = vi.fn(),
  onCancel = vi.fn(),
  onCompleteReview = vi.fn(),
}: {
  state?: ScreenshotReviewState;
  reviewImages?: ScreenshotReviewImage[];
  reviewReconciliation?: ExecutionReconciliation;
  decisions?: ReadonlyMap<string, ReconciliationDecision>;
  onAction?: ScreenshotReviewDialogProps["onAction"];
  onDecision?: ScreenshotReviewDialogProps["onDecision"];
  onRetryImage?: ScreenshotReviewDialogProps["onRetryImage"];
  onRemoveImage?: ScreenshotReviewDialogProps["onRemoveImage"];
  onCancel?: ScreenshotReviewDialogProps["onCancel"];
  onCompleteReview?: ScreenshotReviewDialogProps["onCompleteReview"];
} = {}) {
  return {
    ...render(
      <ScreenshotReviewDialog
        state={state}
        images={reviewImages}
        reconciliation={reviewReconciliation}
        decisions={decisions}
        onAction={onAction}
        onDecision={onDecision}
        onRetryImage={onRetryImage}
        onRemoveImage={onRemoveImage}
        onCancel={onCancel}
        onCompleteReview={onCompleteReview}
      />,
    ),
    onAction,
    onDecision,
    onRetryImage,
    onRemoveImage,
    onCancel,
    onCompleteReview,
  };
}

describe("ScreenshotReviewDialog", () => {
  it("announces the review layout, image progress, issues, and batch counts", () => {
    renderDialog();

    expect(
      screen.getByRole("dialog", { name: "从截图恢复交易" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "orders-1.png，需复核，4/4 个区域，2 笔成交，1 个问题",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "orders-2.png，识别完成，4/4 个区域，2 笔成交，0 个问题",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "批次统计：总成交 4，待确认 1，自动重复 1，冲突 1",
      }),
    ).toBeInTheDocument();
  });

  it("filters the total table by pending, conflict, and automatic duplicate status", async () => {
    const user = userEvent.setup();
    renderDialog();

    const table = screen.getByRole("table", { name: "截图成交总表" });
    expect(within(table).getAllByRole("row")).toHaveLength(5);

    await user.click(screen.getByRole("button", { name: "待确认" }));
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).getByRole("row", { name: /NVDA/ })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "冲突" }));
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).getByRole("row", { name: /TSLA/ })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "自动重复" }));
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).getByRole("row", { name: /AAPL/ })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "全部" }));
    expect(within(table).getAllByRole("row")).toHaveLength(5);
  });

  it("maps only current-batch screenshot rows when an old screenshot reuses capture and row indices", async () => {
    const user = userEvent.setup();
    const currentIncoming = screenshotExecution(
      "incoming-amd",
      "AMD",
      0,
      1,
      "100",
    );
    const mismatchedCurrent = screenshotExecution(
      "mismatched-current-amd",
      "AMD",
      0,
      0,
      "99",
    );
    mismatchedCurrent.source.fileFingerprint = "old-fingerprint";
    mismatchedCurrent.source.batchId = "screenshot-batch:old";
    const fingerprintlessOld = screenshotExecution(
      "fingerprintless-old-amd",
      "AMD",
      0,
      0,
      "98",
    );
    delete fingerprintlessOld.source.fileFingerprint;
    fingerprintlessOld.source.batchId = "screenshot-batch:old";
    renderDialog({
      state: reviewState(false),
      reviewReconciliation: {
        acceptedIncoming: [],
        automaticReplacementIds: [],
        duplicates: [],
        conflicts: [
          {
            id: "conflict-amd",
            candidateKey: "US:AMD|2024-06-05T18:41:08Z",
            existing: [
              statementExecution("existing-amd", "AMD", "102"),
            ],
            incoming: [
              mismatchedCurrent,
              fingerprintlessOld,
              currentIncoming,
            ],
          },
        ],
      },
    });

    await user.click(screen.getByRole("button", { name: "冲突" }));
    const table = screen.getByRole("table", { name: "截图成交总表" });
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).getByRole("row", { name: /AMD/ })).toBeVisible();
    expect(
      within(table).queryByRole("row", { name: /NVDA/ }),
    ).not.toBeInTheDocument();
  });

  it("maps a same-symbol same-second duplicate to its exact source row", async () => {
    const user = userEvent.setup();
    const current = reviewState(false);
    current.drafts = [
      draft("draft-nvda-first", "NVDA", 0, { price: "100" }),
      draft("draft-nvda-second", "NVDA", 1, { price: "101" }),
    ];
    const duplicate = screenshotExecution(
      "incoming-nvda-second",
      "NVDA",
      0,
      1,
      "101",
    );
    delete duplicate.source.fileFingerprint;
    renderDialog({
      state: current,
      reviewReconciliation: {
        acceptedIncoming: [],
        automaticReplacementIds: [],
        duplicates: [
          {
            kept: statementExecution("existing-nvda", "NVDA", "101"),
            skipped: duplicate,
          },
        ],
        conflicts: [],
      },
    });

    await user.click(
      screen.getByRole("button", { name: "自动重复" }),
    );
    const table = screen.getByRole("table", { name: "截图成交总表" });
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(
      within(table).getByRole("cell", { name: "NVDA 价格 101" }),
    ).toBeVisible();
    expect(
      within(table).queryByRole("cell", { name: "NVDA 价格 100" }),
    ).not.toBeInTheDocument();
  });

  it("prefers capture index when repeated captures share a fingerprint", async () => {
    const user = userEvent.setup();
    const current = reviewState(false);
    current.images[1] = {
      ...current.images[1],
      fingerprint: current.images[0].fingerprint,
    };
    current.drafts = [
      draft("draft-first-capture", "NVDA", 0, { imageId: "image-1" }),
      draft("draft-second-capture", "AMD", 0, { imageId: "image-2" }),
    ];
    const duplicate = screenshotExecution(
      "incoming-amd-second-capture",
      "AMD",
      1,
      0,
      "100",
    );
    duplicate.source.fileFingerprint = current.images[0].fingerprint;
    renderDialog({
      state: current,
      reviewReconciliation: {
        acceptedIncoming: [],
        automaticReplacementIds: [],
        duplicates: [
          {
            kept: statementExecution("existing-amd", "AMD", "100"),
            skipped: duplicate,
          },
        ],
        conflicts: [],
      },
    });

    await user.click(screen.getByRole("button", { name: "自动重复" }));
    const table = screen.getByRole("table", { name: "截图成交总表" });
    expect(within(table).getByRole("row", { name: /AMD/ })).toBeVisible();
    expect(
      within(table).queryByRole("row", { name: /NVDA/ }),
    ).not.toBeInTheDocument();
  });

  it("opens low-confidence source evidence and confirms the recognized value", async () => {
    const user = userEvent.setup();
    const { onAction } = renderDialog();

    await user.click(
      screen.getByRole("cell", {
        name: "NVDA 价格 114.8，待确认",
      }),
    );

    const evidence = screen.getByRole("complementary", {
      name: "截图识别依据",
    });
    expect(evidence).toHaveTextContent("OCR 原文：114.8?");
    expect(evidence).toHaveTextContent("识别置信度：72%");
    expect(
      within(evidence).getByRole("img", { name: "NVDA 价格截图局部" }),
    ).toHaveAttribute("src", "blob:https://trade-review/image-1");

    await user.click(
      within(evidence).getByRole("button", { name: "确认识别值" }),
    );
    expect(onAction).toHaveBeenCalledWith({
      type: "confirm-field",
      draftId: "draft-nvda",
      field: "price",
    });
  });

  it("opens a field with the keyboard and dispatches an edited price", async () => {
    const user = userEvent.setup();
    const { onAction } = renderDialog();
    const cell = screen.getByRole("cell", {
      name: "NVDA 价格 114.8，待确认",
    });

    cell.focus();
    await user.keyboard("{Enter}");
    const input = screen.getByRole("textbox", { name: "修改价格" });
    await user.clear(input);
    await user.type(input, "115.2");
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(onAction).toHaveBeenCalledWith({
      type: "edit-field",
      draftId: "draft-nvda",
      field: "price",
      value: "115.2",
    });
  });

  it("dispatches row-specific delete and manual add actions", async () => {
    const user = userEvent.setup();
    const { onAction } = renderDialog();

    await user.click(
      screen.getByRole("button", {
        name: "删除 NVDA 成交，来源第 1 张 orders-1.png 第 1 行，24/06/05 14:41:08，数量 10，价格 114.8",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "手工补录成交" }),
    );

    expect(onAction).toHaveBeenNthCalledWith(1, {
      type: "delete-draft",
      draftId: "draft-nvda",
    });
    expect(onAction).toHaveBeenNthCalledWith(2, {
      type: "add-draft",
      imageId: "image-1",
    });
  });

  it("gives same-symbol same-second rows unique delete names", () => {
    const current = reviewState(false);
    current.drafts = [
      draft("draft-nvda-first", "NVDA", 0, {
        quantity: "10",
        price: "114.8",
      }),
      draft("draft-nvda-second", "NVDA", 1, {
        quantity: "20",
        price: "115.2",
      }),
    ];
    renderDialog({ state: current });

    const deleteButtons = screen.getAllByRole("button", {
      name: /^删除 NVDA 成交，来源第 1 张 orders-1\.png 第/,
    });
    expect(deleteButtons).toHaveLength(2);
    expect(
      screen.getByRole("button", {
        name: "删除 NVDA 成交，来源第 1 张 orders-1.png 第 1 行，24/06/05 14:41:08，数量 10，价格 114.8",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "删除 NVDA 成交，来源第 1 张 orders-1.png 第 2 行，24/06/05 14:41:08，数量 20，价格 115.2",
      }),
    ).toBeVisible();
    expect(
      new Set(deleteButtons.map((button) => button.getAttribute("aria-label")))
        .size,
    ).toBe(2);
  });

  it("uses stable image ordinals to delete identical fills from same-named images", async () => {
    const user = userEvent.setup();
    const current = reviewState(false);
    current.drafts = [
      draft("draft-nvda-image-1", "NVDA", 0, {
        quantity: "10",
        price: "114.8",
      }),
      draft("draft-nvda-image-2", "NVDA", 0, {
        imageId: "image-2",
        quantity: "10",
        price: "114.8",
      }),
    ];
    const sameNamedImages = images.map((image) => ({
      ...image,
      fileName: "orders.png",
    }));
    const { onAction } = renderDialog({
      state: current,
      reviewImages: sameNamedImages,
    });

    const first = screen.getByRole("button", {
      name: "删除 NVDA 成交，来源第 1 张 orders.png 第 1 行，24/06/05 14:41:08，数量 10，价格 114.8",
    });
    const second = screen.getByRole("button", {
      name: "删除 NVDA 成交，来源第 2 张 orders.png 第 1 行，24/06/05 14:41:08，数量 10，价格 114.8",
    });
    expect(first).toBeVisible();
    expect(second).toBeVisible();

    await user.click(first);
    await user.click(second);

    expect(onAction).toHaveBeenNthCalledWith(1, {
      type: "delete-draft",
      draftId: "draft-nvda-image-1",
    });
    expect(onAction).toHaveBeenNthCalledWith(2, {
      type: "delete-draft",
      draftId: "draft-nvda-image-2",
    });
  });

  it.each([
    ["保留已有记录", "keep-existing"],
    ["使用截图记录", "use-incoming"],
    ["全部保留", "keep-both"],
  ] as const)(
    "dispatches the %s conflict choice as %s",
    async (label, decision) => {
      const user = userEvent.setup();
      const { onDecision } = renderDialog();

      await user.click(
        screen.getByRole("button", {
          name: "处理 TSLA 冲突",
        }),
      );
      await user.click(screen.getByRole("radio", { name: label }));

      expect(onDecision).toHaveBeenCalledWith(
        "conflict-tsla",
        decision,
      );
    },
  );

  it("retries or removes only the failed image and keeps completed images visible", async () => {
    const user = userEvent.setup();
    const failed: ScreenshotReviewImage = {
      id: "image-3",
      fileName: "orders-3.png",
      previewUrl: "blob:https://trade-review/image-3",
      width: 1170,
      height: 2532,
      state: "failed",
      completedTiles: 1,
      totalTiles: 4,
      tradeCount: 0,
      issueCount: 1,
      error: "无法识别版式",
    };
    const { onRetryImage, onRemoveImage } = renderDialog({
      reviewImages: [...images, failed],
    });

    expect(
      screen.getByRole("status", {
        name: "orders-3.png，识别失败：无法识别版式",
      }),
    ).toBeInTheDocument();
    const recovery = screen.getByRole("group", {
      name: "恢复 orders-3.png",
    });
    expect(recovery).toHaveTextContent("重试或移除此截图后才能继续");
    await user.click(
      within(recovery).getByRole("button", { name: "重试 orders-3.png" }),
    );
    await user.click(
      within(recovery).getByRole("button", { name: "移除 orders-3.png" }),
    );

    expect(onRetryImage).toHaveBeenCalledWith("image-3");
    expect(onRemoveImage).toHaveBeenCalledWith("image-3");
    expect(
      screen.getByRole("button", { name: "选择 orders-2.png" }),
    ).toBeVisible();
  });

  it("cancels from the button and Escape", async () => {
    const user = userEvent.setup();
    const { onCancel } = renderDialog();

    await user.click(screen.getByRole("button", { name: "取消" }));
    await user.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("disables completion for a review blocker or an unresolved conflict", () => {
    const decided = new Map<string, ReconciliationDecision>([
      ["conflict-tsla", "keep-both"],
    ]);
    const first = renderDialog({ decisions: decided });
    expect(
      screen.getByRole("button", { name: "确认导入" }),
    ).toBeDisabled();
    first.unmount();

    const second = renderDialog({ state: reviewState(false) });
    expect(
      screen.getByRole("button", { name: "确认导入" }),
    ).toBeDisabled();
    second.unmount();

    renderDialog({ state: reviewState(false), decisions: decided });
    expect(
      screen.getByRole("button", { name: "确认导入" }),
    ).toBeEnabled();
  });
});
