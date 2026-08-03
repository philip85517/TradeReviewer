import { act, cleanup, renderHook } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type {
  OcrImageResult,
  ScreenshotField,
  ScreenshotInput,
  ScreenshotTradeDraft,
} from "../../lib/import/screenshot/contracts";
import type { LocalOcrEngine } from "../../lib/import/screenshot/ocr-engine";
import type { TradeExecution } from "../../lib/trades/types";
import {
  type PreparedScreenshotImport,
  type ScreenshotImportDependencies,
  useScreenshotImport,
} from "./use-screenshot-import";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const requiredFields: ScreenshotField[] = [
  "market",
  "symbol",
  "side",
  "quantity",
  "price",
  "executedAt",
];

function draft(
  imageId: string,
  overrides: Partial<ScreenshotTradeDraft> = {},
): ScreenshotTradeDraft {
  return {
    id: `${imageId}:draft`,
    broker: "futu",
    layoutVersion: "futu-orders-dark-v1",
    imageId,
    sourceRowIndex: 0,
    sourceBounds: { x: 1, y: 2, width: 3, height: 4 },
    market: "US",
    symbol: "NVDA",
    sourceName: "英伟达",
    side: "buy",
    quantity: "1",
    price: "100",
    sourceTimestampText: "2025-03-01 09:30:00",
    fieldEvidence: Object.fromEntries(
      requiredFields.map((field) => [
        field,
        {
          rawText: field,
          confidence: 0.99,
          repaired: false,
          confirmedByUser: true,
        },
      ]),
    ),
    ...overrides,
  };
}

function execution(
  id: string,
  overrides: Partial<TradeExecution> = {},
): TradeExecution {
  return {
    id,
    source: {
      platform: "futu",
      row: 0,
      sourceOrder: 0,
      fileFingerprint: "existing-statement",
      inputKind: "statement",
    },
    accountId: "acct",
    accountLabel: "账户",
    instrument: {
      id: "US:NVDA",
      symbol: "NVDA",
      name: "英伟达",
      market: "US",
      currency: "USD",
    },
    side: "buy",
    executedAt: "2025-03-01T17:30:00Z",
    quantity: "1",
    price: "100",
    fee: "1",
    ...overrides,
  };
}

function imageResult(imageId: string): OcrImageResult {
  return { imageId, width: 1_000, height: 2_000, lines: [] };
}

function file(name: string, contents = name) {
  return new File([contents], name, { type: "image/png" });
}

function setupDependencies(overrides: Partial<ScreenshotImportDependencies> = {}) {
  const dispose = vi.fn().mockResolvedValue(undefined);
  const engine: LocalOcrEngine = {
    recognize: vi.fn(),
    dispose,
  };
  const revokeObjectUrl = vi.fn();
  const parseFutu = vi.fn((image: OcrImageResult) => [draft(image.imageId)]);
  const parseTiger = vi.fn((image: OcrImageResult) => [
    draft(image.imageId, {
      broker: "tiger",
      layoutVersion: "tiger-orders-dark-v1",
    }),
  ]);
  const dependencies: ScreenshotImportDependencies = {
    validateFiles: (files) => ({ ok: true, files }),
    buildInputs: async (files) =>
      files.map((selected, index): ScreenshotInput => ({
        id: `image-${index + 1}`,
        index,
        file: selected,
        fingerprint: `fingerprint-${index + 1}`,
      })),
    buildBatchId: () => "batch-1",
    createObjectUrl: (selected) => `blob:${selected.name}`,
    revokeObjectUrl,
    createOcrEngine: vi.fn().mockResolvedValue(engine),
    recognize: async (input, _engine, options) => {
      options.onProgress(1, 1);
      return imageResult(input.id);
    },
    detectLayout: () => ({
      matched: true,
      broker: "futu",
      layoutVersion: "futu-orders-dark-v1",
      confidence: 1,
    }),
    parseFutu,
    parseTiger,
    ...overrides,
  };
  return { dependencies, dispose, revokeObjectUrl, parseFutu, parseTiger };
}

async function makeValid(
  result: ReturnType<typeof renderHook<ReturnType<typeof useScreenshotImport>, unknown>>,
) {
  await act(async () => {
    result.result.current.dispatch({
      type: "set-account",
      accountId: "acct",
      accountLabel: "账户",
    });
    result.result.current.dispatch({
      type: "set-time-zone",
      timeZone: "America/Los_Angeles",
    });
  });
}

describe("useScreenshotImport", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("preserves the compact Tiger filled-orders layout in review metadata", async () => {
    const { dependencies } = setupDependencies({
      detectLayout: () => ({
        matched: true,
        broker: "tiger",
        layoutVersion: "tiger-filled-orders-dark-v1",
        confidence: 1,
      }),
    });
    const { result } = renderHook(() =>
      useScreenshotImport({
        currentExecutions: () => [],
        onPrepared: vi.fn(),
        dependencies,
      }),
    );

    await act(async () => {
      await result.current.start([file("filled-orders.png")]);
    });

    expect(result.current.state?.images).toEqual([
      {
        imageId: "image-1",
        fingerprint: "fingerprint-1",
        captureIndex: 0,
        broker: "tiger",
        layoutVersion: "tiger-filled-orders-dark-v1",
      },
    ]);
  });

  it("recognizes images sequentially in selection order without progress reordering", async () => {
    const first = deferred<OcrImageResult>();
    const second = deferred<OcrImageResult>();
    const calls: string[] = [];
    const progress = new Map<
      string,
      (completedTiles: number, totalTiles: number) => void
    >();
    const { dependencies, parseFutu, parseTiger } = setupDependencies({
      recognize: (input, _engine, options) => {
        calls.push(input.id);
        progress.set(input.id, options.onProgress);
        return input.index === 0 ? first.promise : second.promise;
      },
      detectLayout: (image) =>
        image.imageId === "image-1"
          ? {
              matched: true,
              broker: "futu",
              layoutVersion: "futu-orders-dark-v1",
              confidence: 1,
            }
          : {
              matched: true,
              broker: "tiger",
              layoutVersion: "tiger-orders-dark-v1",
              confidence: 1,
            },
    });
    const { result } = renderHook(() =>
      useScreenshotImport({
        currentExecutions: () => [],
        onPrepared: vi.fn(),
        dependencies,
      }),
    );

    let started!: Promise<void>;
    await act(async () => {
      started = result.current.start([file("one.png"), file("two.png")]);
      await Promise.resolve();
    });
    expect(calls).toEqual(["image-1"]);
    expect(result.current.images.map(({ id }) => id)).toEqual([
      "image-1",
      "image-2",
    ]);

    await act(async () => {
      progress.get("image-1")?.(1, 3);
    });
    expect(result.current.images.map(({ id }) => id)).toEqual([
      "image-1",
      "image-2",
    ]);
    expect(result.current.images[0]).toMatchObject({
      state: "recognizing",
      completedTiles: 1,
      totalTiles: 3,
    });

    await act(async () => {
      first.resolve(imageResult("image-1"));
      await first.promise;
      await Promise.resolve();
    });
    expect(calls).toEqual(["image-1", "image-2"]);
    expect(parseFutu).toHaveBeenCalledTimes(1);
    expect(parseTiger).not.toHaveBeenCalled();

    await act(async () => {
      second.resolve(imageResult("image-2"));
      await started;
    });
    expect(parseTiger).toHaveBeenCalledTimes(1);
    expect(result.current.state?.drafts.map(({ imageId }) => imageId)).toEqual([
      "image-1",
      "image-2",
    ]);
  });

  it("isolates one image failure and retry replaces only that image result", async () => {
    let secondAttempt = 0;
    const { dependencies } = setupDependencies({
      recognize: async (input, _engine, options) => {
        options.onProgress(1, 1);
        if (input.id === "image-2" && secondAttempt++ === 0) {
          throw new Error("OCR failed");
        }
        return imageResult(input.id);
      },
    });
    const { result } = renderHook(() =>
      useScreenshotImport({
        currentExecutions: () => [],
        onPrepared: vi.fn(),
        dependencies,
      }),
    );

    await act(async () => {
      await result.current.start([file("one.png"), file("two.png")]);
    });
    expect(result.current.images.map(({ state }) => state)).toEqual([
      "needs-review",
      "failed",
    ]);
    const completedDraft = result.current.state?.drafts[0];
    expect(result.current.state?.drafts).toHaveLength(1);

    await act(async () => {
      await result.current.retryImage("image-2");
    });
    expect(result.current.images.map(({ state }) => state)).toEqual([
      "needs-review",
      "needs-review",
    ]);
    expect(result.current.state?.drafts).toHaveLength(2);
    expect(result.current.state?.drafts[0]).toBe(completedDraft);
  });

  it("backfills a first failed image after a later image establishes the shared layout", async () => {
    const onPrepared = vi.fn();
    const { dependencies } = setupDependencies({
      recognize: async (input, _engine, options) => {
        options.onProgress(1, 1);
        if (input.id === "image-1") throw new Error("OCR failed");
        return imageResult(input.id);
      },
    });
    const { result } = renderHook(() =>
      useScreenshotImport({
        currentExecutions: () => [],
        onPrepared,
        dependencies,
      }),
    );

    await act(async () => {
      await result.current.start([file("one.png"), file("two.png")]);
    });

    expect(result.current.images.map(({ state }) => state)).toEqual([
      "failed",
      "needs-review",
    ]);
    expect(result.current.state?.images).toContainEqual({
      imageId: "image-1",
      fingerprint: "fingerprint-1",
      captureIndex: 0,
      broker: "futu",
      layoutVersion: "futu-orders-dark-v1",
    });

    await makeValid({ result } as never);
    await act(async () => {
      await result.current.completeReview();
    });
    expect(onPrepared).not.toHaveBeenCalled();
    expect(result.current.images[0].state).toBe("failed");

    act(() =>
      result.current.dispatch({ type: "add-draft", imageId: "image-1" }),
    );
    expect(result.current.state?.drafts).toContainEqual(
      expect.objectContaining({
        id: "image-1:manual:0",
        broker: "futu",
        layoutVersion: "futu-orders-dark-v1",
        imageId: "image-1",
        fieldEvidence: {},
      }),
    );
  });

  it("adds a blank draft for a failed image when successful images share its layout", async () => {
    const onPrepared = vi.fn();
    const { dependencies } = setupDependencies({
      recognize: async (input, _engine, options) => {
        options.onProgress(1, 1);
        if (input.id === "image-2") throw new Error("OCR failed");
        return imageResult(input.id);
      },
    });
    const { result } = renderHook(() =>
      useScreenshotImport({
        currentExecutions: () => [],
        onPrepared,
        dependencies,
      }),
    );

    await act(async () => {
      await result.current.start([file("one.png"), file("two.png")]);
    });
    const failedImage = result.current.images.find(
      ({ state }) => state === "failed",
    );
    expect(failedImage?.id).toBe("image-2");
    expect(result.current.state?.images).toContainEqual({
      imageId: "image-2",
      fingerprint: "fingerprint-2",
      captureIndex: 1,
      broker: "futu",
      layoutVersion: "futu-orders-dark-v1",
    });

    await makeValid({ result } as never);
    await act(async () => {
      await result.current.completeReview();
    });
    expect(onPrepared).not.toHaveBeenCalled();
    expect(result.current.images[1].state).toBe("failed");

    act(() =>
      result.current.dispatch({
        type: "add-draft",
        imageId: failedImage!.id,
      }),
    );

    expect(result.current.state?.drafts).toHaveLength(2);
    expect(result.current.state?.drafts[1]).toMatchObject({
      id: "image-2:manual:0",
      broker: "futu",
      layoutVersion: "futu-orders-dark-v1",
      imageId: "image-2",
      sourceRowIndex: 0,
      fieldEvidence: {},
    });
    expect(result.current.state?.drafts[1].market).toBeUndefined();
  });

  it("removes inferred failed-image metadata when later successes disagree on layout", async () => {
    const { dependencies } = setupDependencies({
      recognize: async (input, _engine, options) => {
        options.onProgress(1, 1);
        if (input.id === "image-2") throw new Error("OCR failed");
        return imageResult(input.id);
      },
      detectLayout: (image) =>
        image.imageId === "image-3"
          ? {
              matched: true,
              broker: "tiger",
              layoutVersion: "tiger-orders-dark-v1",
              confidence: 1,
            }
          : {
              matched: true,
              broker: "futu",
              layoutVersion: "futu-orders-dark-v1",
              confidence: 1,
            },
    });
    const { result } = renderHook(() =>
      useScreenshotImport({
        currentExecutions: () => [],
        onPrepared: vi.fn(),
        dependencies,
      }),
    );

    await act(async () => {
      await result.current.start([
        file("one.png"),
        file("two.png"),
        file("three.png"),
      ]);
    });

    expect(result.current.images.map(({ state }) => state)).toEqual([
      "needs-review",
      "failed",
      "needs-review",
    ]);
    expect(result.current.state?.images).toEqual([
      {
        imageId: "image-1",
        fingerprint: "fingerprint-1",
        captureIndex: 0,
        broker: "futu",
        layoutVersion: "futu-orders-dark-v1",
      },
      {
        imageId: "image-3",
        fingerprint: "fingerprint-3",
        captureIndex: 2,
        broker: "tiger",
        layoutVersion: "tiger-orders-dark-v1",
      },
    ]);

    act(() =>
      result.current.dispatch({ type: "add-draft", imageId: "image-2" }),
    );
    expect(result.current.state?.drafts.map(({ imageId }) => imageId)).toEqual([
      "image-1",
      "image-3",
    ]);
  });

  it("rejects manual add while inferred metadata is provisional before later layouts diverge", async () => {
    const thirdRecognition = deferred<OcrImageResult>();
    const thirdStarted = deferred<void>();
    const { dependencies } = setupDependencies({
      recognize: async (input, _engine, options) => {
        options.onProgress(1, 1);
        if (input.id === "image-2") throw new Error("OCR failed");
        if (input.id === "image-3") {
          thirdStarted.resolve();
          return thirdRecognition.promise;
        }
        return imageResult(input.id);
      },
      detectLayout: (image) =>
        image.imageId === "image-3"
          ? {
              matched: true,
              broker: "tiger",
              layoutVersion: "tiger-orders-dark-v1",
              confidence: 1,
            }
          : {
              matched: true,
              broker: "futu",
              layoutVersion: "futu-orders-dark-v1",
              confidence: 1,
            },
    });
    const { result } = renderHook(() =>
      useScreenshotImport({
        currentExecutions: () => [],
        onPrepared: vi.fn(),
        dependencies,
      }),
    );

    let started!: Promise<void>;
    await act(async () => {
      started = result.current.start([
        file("one.png"),
        file("two.png"),
        file("three.png"),
      ]);
      await thirdStarted.promise;
    });
    expect(result.current.images.map(({ state }) => state)).toEqual([
      "needs-review",
      "failed",
      "recognizing",
    ]);
    expect(result.current.state?.images).toContainEqual(
      expect.objectContaining({ imageId: "image-2" }),
    );

    act(() =>
      result.current.dispatch({ type: "add-draft", imageId: "image-2" }),
    );
    expect(result.current.state?.drafts.map(({ imageId }) => imageId)).toEqual([
      "image-1",
    ]);

    await act(async () => {
      thirdRecognition.resolve(imageResult("image-3"));
      await started;
    });

    expect(result.current.state?.drafts.map(({ imageId }) => imageId)).toEqual([
      "image-1",
      "image-3",
    ]);
    expect(
      result.current.state?.drafts.every((candidate) =>
        result.current.state?.images.some(
          ({ imageId }) => imageId === candidate.imageId,
        ),
      ),
    ).toBe(true);
  });

  it("retains matched layout metadata when parsing finds no trades", async () => {
    const { dependencies } = setupDependencies({
      parseFutu: () => [],
    });
    const { result } = renderHook(() =>
      useScreenshotImport({
        currentExecutions: () => [],
        onPrepared: vi.fn(),
        dependencies,
      }),
    );

    await act(async () => {
      await result.current.start([file("one.png")]);
    });

    expect(result.current.images[0].state).toBe("failed");
    expect(result.current.state?.images).toEqual([
      {
        imageId: "image-1",
        fingerprint: "fingerprint-1",
        captureIndex: 0,
        broker: "futu",
        layoutVersion: "futu-orders-dark-v1",
      },
    ]);

    act(() =>
      result.current.dispatch({ type: "add-draft", imageId: "image-1" }),
    );
    expect(result.current.state?.drafts).toEqual([
      expect.objectContaining({
        id: "image-1:manual:0",
        broker: "futu",
        layoutVersion: "futu-orders-dark-v1",
        imageId: "image-1",
        sourceRowIndex: 0,
        fieldEvidence: {},
      }),
    ]);
  });

  it("creates a fresh OCR engine when initialization failed transiently", async () => {
    const replacementEngine: LocalOcrEngine = {
      recognize: vi.fn(),
      dispose: vi.fn().mockResolvedValue(undefined),
    };
    const createOcrEngine = vi
      .fn<() => Promise<LocalOcrEngine>>()
      .mockRejectedValueOnce(new Error("WASM initialization failed"))
      .mockResolvedValueOnce(replacementEngine);
    const recognize = vi.fn(async (input: ScreenshotInput) =>
      imageResult(input.id),
    );
    const { dependencies } = setupDependencies({
      createOcrEngine,
      recognize,
    });
    const { result } = renderHook(() =>
      useScreenshotImport({
        currentExecutions: () => [],
        onPrepared: vi.fn(),
        dependencies,
      }),
    );

    await act(async () => {
      await result.current.start([file("one.png")]);
    });
    expect(result.current.images[0].state).toBe("failed");

    await act(async () => {
      await result.current.retryImage("image-1");
    });

    expect(createOcrEngine).toHaveBeenCalledTimes(2);
    expect(recognize).toHaveBeenCalledTimes(1);
    expect(result.current.images[0].state).toBe("needs-review");
  });

  it("removing one image releases only its URL and drafts", async () => {
    const { dependencies, revokeObjectUrl } = setupDependencies();
    const { result } = renderHook(() =>
      useScreenshotImport({
        currentExecutions: () => [],
        onPrepared: vi.fn(),
        dependencies,
      }),
    );
    await act(async () => {
      await result.current.start([file("one.png"), file("two.png")]);
    });

    act(() => result.current.removeImage("image-1"));

    expect(result.current.images.map(({ id }) => id)).toEqual(["image-2"]);
    expect(result.current.state?.drafts.map(({ imageId }) => imageId)).toEqual([
      "image-2",
    ]);
    expect(revokeObjectUrl).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:one.png");
  });

  it("cancel aborts recognition, disposes once, revokes every URL once, and never prepares", async () => {
    const recognition = deferred<OcrImageResult>();
    const { dependencies, dispose, revokeObjectUrl } = setupDependencies({
      recognize: (input, _engine, options) =>
        new Promise<OcrImageResult>((resolve, reject) => {
          recognition.promise.then(resolve, reject);
          options.signal.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          );
        }),
    });
    const onPrepared = vi.fn();
    const { result, unmount } = renderHook(() =>
      useScreenshotImport({
        currentExecutions: () => [],
        onPrepared,
        dependencies,
      }),
    );
    let started!: Promise<void>;
    await act(async () => {
      started = result.current.start([file("one.png"), file("two.png")]);
      await Promise.resolve();
    });

    await act(async () => {
      result.current.cancel();
      result.current.cancel();
      await started;
      await Promise.resolve();
    });
    unmount();

    expect(result.current.open).toBe(false);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl.mock.calls).toEqual([
      ["blob:one.png"],
      ["blob:two.png"],
    ]);
    expect(onPrepared).not.toHaveBeenCalled();
  });

  it("waits for canceled engine initialization and disposal before creating a replacement engine", async () => {
    const initialization = deferred<LocalOcrEngine>();
    const disposal = deferred<void>();
    const firstDispose = vi.fn(() => disposal.promise);
    const firstEngine: LocalOcrEngine = {
      recognize: vi.fn(),
      dispose: firstDispose,
    };
    const replacementEngine: LocalOcrEngine = {
      recognize: vi.fn(),
      dispose: vi.fn().mockResolvedValue(undefined),
    };
    const createOcrEngine = vi
      .fn<() => Promise<LocalOcrEngine>>()
      .mockImplementationOnce(() => initialization.promise)
      .mockResolvedValueOnce(replacementEngine);
    const { dependencies } = setupDependencies({ createOcrEngine });
    const { result } = renderHook(() =>
      useScreenshotImport({
        currentExecutions: () => [],
        onPrepared: vi.fn(),
        dependencies,
      }),
    );

    let firstStart!: Promise<void>;
    await act(async () => {
      firstStart = result.current.start([file("first.png")]);
      await Promise.resolve();
    });
    expect(createOcrEngine).toHaveBeenCalledTimes(1);

    let replacementStart!: Promise<void>;
    await act(async () => {
      result.current.cancel();
      replacementStart = result.current.start([file("replacement.png")]);
      await Promise.resolve();
    });
    expect(createOcrEngine).toHaveBeenCalledTimes(1);

    await act(async () => {
      initialization.resolve(firstEngine);
      await initialization.promise;
      await Promise.resolve();
    });
    expect(firstDispose).toHaveBeenCalledTimes(1);
    expect(createOcrEngine).toHaveBeenCalledTimes(1);

    await act(async () => {
      disposal.resolve();
      await disposal.promise;
      await replacementStart;
      await firstStart;
    });
    expect(createOcrEngine).toHaveBeenCalledTimes(2);
  });

  it("recomputes duplicate and conflict analysis after an edit", async () => {
    const { dependencies } = setupDependencies();
    const current = execution("existing");
    const { result } = renderHook(() =>
      useScreenshotImport({
        currentExecutions: () => [current],
        onPrepared: vi.fn(),
        dependencies,
      }),
    );
    await act(async () => {
      await result.current.start([file("one.png")]);
    });
    await makeValid({ result } as never);

    expect(result.current.reconciliation?.duplicates).toHaveLength(1);
    expect(result.current.reconciliation?.conflicts).toHaveLength(0);

    act(() =>
      result.current.dispatch({
        type: "edit-field",
        draftId: "image-1:draft",
        field: "price",
        value: "101",
      }),
    );

    expect(result.current.reconciliation?.duplicates).toHaveLength(0);
    expect(result.current.reconciliation?.conflicts).toHaveLength(1);
  });

  it("does not complete while review blockers or decisions remain", async () => {
    const { dependencies } = setupDependencies();
    const onPrepared = vi.fn();
    const { result } = renderHook(() =>
      useScreenshotImport({
        currentExecutions: () => [execution("existing", { price: "101" })],
        onPrepared,
        dependencies,
      }),
    );
    await act(async () => {
      await result.current.start([file("one.png")]);
      await result.current.completeReview();
    });
    expect(onPrepared).not.toHaveBeenCalled();

    await makeValid({ result } as never);
    expect(result.current.reconciliation?.conflicts).toHaveLength(1);
    await act(async () => {
      await result.current.completeReview();
    });
    expect(onPrepared).not.toHaveBeenCalled();
  });

  it("emits a valid prepared import and closes the review", async () => {
    const { dependencies, dispose, revokeObjectUrl } = setupDependencies();
    const onPrepared = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useScreenshotImport({
        currentExecutions: () => [],
        onPrepared,
        dependencies,
      }),
    );
    await act(async () => {
      await result.current.start([file("one.png"), file("two.png")]);
    });
    await makeValid({ result } as never);

    await act(async () => {
      await result.current.completeReview();
    });

    expect(onPrepared).toHaveBeenCalledWith(
      expect.objectContaining({
        parsed: expect.objectContaining({
          broker: "futu",
          records: expect.arrayContaining([
            expect.objectContaining({ id: "futu:fingerprint-1:0" }),
            expect.objectContaining({ id: "futu:fingerprint-2:0" }),
          ]),
        }),
        reconciliation: expect.objectContaining({ conflicts: [] }),
        decisions: expect.any(Map),
        fileName: "2 张交易截图",
        captureCount: 2,
      }),
    );
    expect(result.current.open).toBe(false);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledTimes(2);
  });

  it("freezes every session mutation while deferred preparation is pending", async () => {
    const prepared = deferred<void>();
    const { dependencies, dispose, revokeObjectUrl } = setupDependencies();
    let emitted: PreparedScreenshotImport | undefined;
    let prepareCalls = 0;
    const onPrepared = (value: PreparedScreenshotImport) => {
      prepareCalls += 1;
      emitted = value;
      return prepared.promise;
    };
    const { result } = renderHook(() =>
      useScreenshotImport({
        currentExecutions: () => [execution("existing", { price: "101" })],
        onPrepared,
        dependencies,
      }),
    );
    await act(async () => {
      await result.current.start([file("one.png")]);
    });
    await makeValid({ result } as never);
    const conflictId = result.current.reconciliation?.conflicts[0]?.id;
    expect(conflictId).toBeTruthy();
    act(() => result.current.decide(conflictId!, "keep-existing"));

    let completion!: Promise<void>;
    await act(async () => {
      completion = result.current.completeReview();
      await Promise.resolve();
    });

    expect(result.current.completing).toBe(true);
    const frozenState = result.current.state;
    const frozenImages = result.current.images;
    const frozenReconciliation = result.current.reconciliation;
    await act(async () => {
      await result.current.start([file("replacement.png")]);
      await result.current.retryImage("image-1");
      result.current.removeImage("image-1");
      result.current.dispatch({
        type: "edit-field",
        draftId: "image-1:draft",
        field: "price",
        value: "999",
      });
      result.current.decide(conflictId!, "use-incoming");
      result.current.cancel();
    });

    expect(result.current.completing).toBe(true);
    expect(result.current.open).toBe(true);
    expect(result.current.state).toBe(frozenState);
    expect(result.current.images).toEqual(frozenImages);
    expect(result.current.reconciliation).toBe(frozenReconciliation);
    expect(result.current.decisions.get(conflictId!)).toBe("keep-existing");
    expect(prepareCalls).toBe(1);
    expect(emitted?.parsed.records[0]).toMatchObject({
      price: "100",
    });
    expect(emitted?.decisions.get(conflictId!)).toBe(
      "keep-existing",
    );
    expect(dispose).not.toHaveBeenCalled();
    expect(revokeObjectUrl).not.toHaveBeenCalled();

    await act(async () => {
      prepared.resolve();
      await completion;
    });
    expect(result.current.completing).toBe(false);
    expect(result.current.open).toBe(false);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledTimes(1);
  });

  it("restores the frozen review after deferred preparation fails", async () => {
    const prepared = deferred<void>();
    const { dependencies, dispose, revokeObjectUrl } = setupDependencies();
    const { result } = renderHook(() =>
      useScreenshotImport({
        currentExecutions: () => [],
        onPrepared: () => prepared.promise,
        dependencies,
      }),
    );
    await act(async () => {
      await result.current.start([file("one.png")]);
    });
    await makeValid({ result } as never);
    const frozenState = result.current.state;
    let completion!: Promise<void>;
    await act(async () => {
      completion = result.current.completeReview();
      await Promise.resolve();
    });
    expect(result.current.completing).toBe(true);

    await act(async () => {
      prepared.reject(new Error("metadata unavailable"));
      await expect(completion).rejects.toThrow("metadata unavailable");
    });

    expect(result.current.completing).toBe(false);
    expect(result.current.open).toBe(true);
    expect(result.current.state).toBe(frozenState);
    expect(dispose).not.toHaveBeenCalled();
    expect(revokeObjectUrl).not.toHaveBeenCalled();

    act(() =>
      result.current.dispatch({
        type: "edit-field",
        draftId: "image-1:draft",
        field: "price",
        value: "102",
      }),
    );
    expect(result.current.state?.drafts[0].price).toBe("102");

    await act(async () => {
      result.current.cancel();
      await Promise.resolve();
    });
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledTimes(1);
  });
});
