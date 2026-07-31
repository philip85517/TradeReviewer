"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  applyReconciliationDecisions,
  reconcileExecutions,
  type ExecutionReconciliation,
  type ReconciliationDecision,
} from "../../lib/import/execution-reconciliation";
import {
  buildScreenshotBatchId,
  buildScreenshotInputs,
  validateScreenshotFiles,
} from "../../lib/import/screenshot/image-input";
import { recognizeScreenshot } from "../../lib/import/screenshot/image-pipeline";
import {
  detectScreenshotLayout,
  type ScreenshotLayoutDetection,
} from "../../lib/import/screenshot/layout-detector";
import {
  createLocalOcrEngine,
  type LocalOcrEngine,
} from "../../lib/import/screenshot/ocr-engine";
import { parseFutuScreenshot } from "../../lib/import/screenshot/futu-screenshot";
import {
  reviewBlockers,
  screenshotReviewReducer,
  type ScreenshotReviewAction,
  type ScreenshotReviewImage as ReviewImageSource,
  type ScreenshotReviewState,
} from "../../lib/import/screenshot/review-state";
import { parseTigerScreenshot } from "../../lib/import/screenshot/tiger-screenshot";
import { toStatementParseResult } from "../../lib/import/screenshot/to-statement-result";
import type {
  OcrImageResult,
  ScreenshotFileValidation,
  ScreenshotInput,
  ScreenshotTradeDraft,
} from "../../lib/import/screenshot/contracts";
import type { StatementParseResult } from "../../lib/import/contracts";
import type { TradeExecution } from "../../lib/trades/types";
import type { ScreenshotReviewImage } from "./screenshot-review-dialog";

export type PreparedScreenshotImport = {
  parsed: StatementParseResult;
  reconciliation: ExecutionReconciliation;
  decisions: ReadonlyMap<string, ReconciliationDecision>;
  fileName: string;
  captureCount: number;
};

export type ScreenshotImportDependencies = {
  validateFiles(files: readonly File[]): ScreenshotFileValidation;
  buildInputs(files: readonly File[]): Promise<ScreenshotInput[]>;
  buildBatchId(inputs: readonly ScreenshotInput[]): string;
  createObjectUrl(file: File): string;
  revokeObjectUrl(url: string): void;
  createOcrEngine(): Promise<LocalOcrEngine>;
  recognize(
    input: ScreenshotInput,
    engine: LocalOcrEngine,
    options: {
      signal: AbortSignal;
      onProgress(completedTiles: number, totalTiles: number): void;
    },
  ): Promise<OcrImageResult>;
  detectLayout(image: OcrImageResult): ScreenshotLayoutDetection;
  parseFutu(image: OcrImageResult): ScreenshotTradeDraft[];
  parseTiger(image: OcrImageResult): ScreenshotTradeDraft[];
};

export type UseScreenshotImportOptions = {
  currentExecutions(): TradeExecution[];
  onPrepared(prepared: PreparedScreenshotImport): Promise<void>;
  /** Test seam for browser decoding/OCR and deterministic fixtures. */
  dependencies?: Partial<ScreenshotImportDependencies>;
};

type ImageStatus = Omit<
  ScreenshotReviewImage,
  "fileName" | "previewUrl" | "width" | "height"
> & { captureIndex: number };

type ImageResource = {
  input: ScreenshotInput;
  fileName: string;
  previewUrl: string;
  width: number;
  height: number;
  released: boolean;
};

type ScreenshotSession = {
  id: number;
  resources: Map<string, ImageResource>;
  dependencies: ScreenshotImportDependencies;
  engineCreationBarrier: Promise<void>;
  enginePromise?: Promise<LocalOcrEngine>;
  disposePromise?: Promise<void>;
  active?: { imageId: string; controller: AbortController };
  queue: Promise<void>;
  closed: boolean;
  completing: boolean;
};

const DEFAULT_DEPENDENCIES: ScreenshotImportDependencies = {
  validateFiles: validateScreenshotFiles,
  buildInputs: buildScreenshotInputs,
  buildBatchId: buildScreenshotBatchId,
  createObjectUrl: (file) => URL.createObjectURL(file),
  revokeObjectUrl: (url) => URL.revokeObjectURL(url),
  createOcrEngine: createLocalOcrEngine,
  recognize: recognizeScreenshot,
  detectLayout: detectScreenshotLayout,
  parseFutu: parseFutuScreenshot,
  parseTiger: parseTigerScreenshot,
};

function initialReviewState(
  batchId: string,
): ScreenshotReviewState {
  return {
    batchId,
    images: [],
    drafts: [],
    deletedDraftIds: new Set(),
  };
}

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : "截图识别失败";
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function uniqueInputIds(inputs: ScreenshotInput[]): ScreenshotInput[] {
  const totals = new Map<string, number>();
  for (const input of inputs) {
    totals.set(input.id, (totals.get(input.id) ?? 0) + 1);
  }
  return inputs.map((input) =>
    totals.get(input.id) === 1
      ? input
      : { ...input, id: `${input.id}:${input.index}` },
  );
}

function sortReviewState(state: ScreenshotReviewState): ScreenshotReviewState {
  const captureIndex = new Map(
    state.images.map((image) => [image.imageId, image.captureIndex]),
  );
  return {
    ...state,
    images: [...state.images].sort(
      (left, right) => left.captureIndex - right.captureIndex,
    ),
    drafts: [...state.drafts].sort(
      (left, right) =>
        (captureIndex.get(left.imageId) ?? Number.MAX_SAFE_INTEGER) -
          (captureIndex.get(right.imageId) ?? Number.MAX_SAFE_INTEGER) ||
        left.sourceRowIndex - right.sourceRowIndex ||
        left.id.localeCompare(right.id),
    ),
  };
}

function replaceImageResult(
  state: ScreenshotReviewState,
  image: ReviewImageSource,
  drafts: ScreenshotTradeDraft[],
) {
  const replacedDraftIds = new Set(
    state.drafts
      .filter(({ imageId }) => imageId === image.imageId)
      .map(({ id }) => id),
  );
  return sortReviewState({
    ...state,
    images: [
      ...state.images.filter(({ imageId }) => imageId !== image.imageId),
      image,
    ],
    drafts: [
      ...state.drafts.filter(({ imageId }) => imageId !== image.imageId),
      ...drafts,
    ],
    deletedDraftIds: new Set(
      [...state.deletedDraftIds].filter((id) => !replacedDraftIds.has(id)),
    ),
  });
}

function removeImageResult(state: ScreenshotReviewState, imageId: string) {
  const removedDraftIds = new Set(
    state.drafts
      .filter((draft) => draft.imageId === imageId)
      .map(({ id }) => id),
  );
  return {
    ...state,
    images: state.images.filter((image) => image.imageId !== imageId),
    drafts: state.drafts.filter((draft) => draft.imageId !== imageId),
    deletedDraftIds: new Set(
      [...state.deletedDraftIds].filter((id) => !removedDraftIds.has(id)),
    ),
  };
}

function reconciliationFor(
  state: ScreenshotReviewState,
  currentExecutions: () => TradeExecution[],
): ExecutionReconciliation | undefined {
  const blockers = reviewBlockers(state);
  if (blockers.some(({ draftId }) => !draftId)) return undefined;

  const blockedDraftIds = new Set(
    blockers.flatMap(({ draftId }) => (draftId ? [draftId] : [])),
  );
  const drafts = state.drafts.filter(
    ({ id }) =>
      !state.deletedDraftIds.has(id) && !blockedDraftIds.has(id),
  );
  if (drafts.length === 0) return undefined;
  const imageIds = new Set(drafts.map(({ imageId }) => imageId));
  const normalizedState: ScreenshotReviewState = {
    ...state,
    images: state.images.filter(({ imageId }) => imageIds.has(imageId)),
    drafts,
    deletedDraftIds: new Set(),
  };

  try {
    return reconcileExecutions(
      currentExecutions(),
      toStatementParseResult(normalizedState).records,
    );
  } catch {
    return undefined;
  }
}

function issueCountForImage(
  state: ScreenshotReviewState,
  imageId: string,
) {
  const imageDraftIds = new Set(
    state.drafts
      .filter((draft) =>
        draft.imageId === imageId && !state.deletedDraftIds.has(draft.id),
      )
      .map(({ id }) => id),
  );
  return reviewBlockers(state).filter(
    ({ draftId }) => !draftId || imageDraftIds.has(draftId),
  ).length;
}

export function useScreenshotImport(options: UseScreenshotImportOptions): {
  open: boolean;
  completing: boolean;
  state: ScreenshotReviewState | null;
  images: ScreenshotReviewImage[];
  reconciliation?: ExecutionReconciliation;
  decisions: ReadonlyMap<string, ReconciliationDecision>;
  start(files: File[]): Promise<void>;
  retryImage(imageId: string): Promise<void>;
  removeImage(imageId: string): void;
  dispatch(action: ScreenshotReviewAction): void;
  decide(conflictId: string, decision: ReconciliationDecision): void;
  completeReview(): Promise<void>;
  cancel(): void;
} {
  const dependencies = useMemo(
    () => ({ ...DEFAULT_DEPENDENCIES, ...options.dependencies }),
    [options.dependencies],
  );
  const callbacksRef = useRef({
    currentExecutions: options.currentExecutions,
    onPrepared: options.onPrepared,
  });
  callbacksRef.current = {
    currentExecutions: options.currentExecutions,
    onPrepared: options.onPrepared,
  };
  const mountedRef = useRef(true);
  const nextSessionIdRef = useRef(0);
  const sessionRef = useRef<ScreenshotSession | undefined>(undefined);
  const disposalTailRef = useRef<Promise<void>>(Promise.resolve());
  const stateRef = useRef<ScreenshotReviewState | null>(null);
  const statusesRef = useRef<ImageStatus[]>([]);
  const reconciliationRef = useRef<ExecutionReconciliation | undefined>(
    undefined,
  );
  const decisionsRef = useRef<Map<string, ReconciliationDecision>>(new Map());
  const [open, setOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [state, setState] = useState<ScreenshotReviewState | null>(null);
  const [statuses, setStatuses] = useState<ImageStatus[]>([]);
  const [reconciliation, setReconciliation] = useState<
    ExecutionReconciliation | undefined
  >(undefined);
  const [decisions, setDecisions] = useState<
    ReadonlyMap<string, ReconciliationDecision>
  >(new Map());

  const isActive = useCallback(
    (session: ScreenshotSession) =>
      mountedRef.current && sessionRef.current === session && !session.closed,
    [],
  );

  const setStatusList = useCallback((next: ImageStatus[]) => {
    statusesRef.current = next;
    if (mountedRef.current) setStatuses(next);
  }, []);

  const updateStatus = useCallback(
    (imageId: string, update: (status: ImageStatus) => ImageStatus) => {
      setStatusList(
        statusesRef.current.map((status) =>
          status.id === imageId ? update(status) : status,
        ),
      );
    },
    [setStatusList],
  );

  const updateReview = useCallback(
    (next: ScreenshotReviewState) => {
      stateRef.current = next;
      if (mountedRef.current) setState(next);
      const nextReconciliation = reconciliationFor(
        next,
        callbacksRef.current.currentExecutions,
      );
      reconciliationRef.current = nextReconciliation;
      if (mountedRef.current) setReconciliation(nextReconciliation);

      const conflictIds = new Set(
        nextReconciliation?.conflicts.map(({ id }) => id) ?? [],
      );
      const nextDecisions = new Map(
        [...decisionsRef.current].filter(([id]) => conflictIds.has(id)),
      );
      decisionsRef.current = nextDecisions;
      if (mountedRef.current) setDecisions(nextDecisions);

      setStatusList(
        statusesRef.current.map((status) => {
          if (status.state === "failed" || status.state === "recognizing") {
            return status;
          }
          const tradeCount = next.drafts.filter(
            (draft) =>
              draft.imageId === status.id &&
              !next.deletedDraftIds.has(draft.id),
          ).length;
          const issueCount = issueCountForImage(next, status.id);
          return {
            ...status,
            tradeCount,
            issueCount,
            state: issueCount > 0 ? "needs-review" : "complete",
          };
        }),
      );
    },
    [setStatusList],
  );

  const releaseResource = useCallback((
    session: ScreenshotSession,
    resource: ImageResource,
  ) => {
    if (resource.released) return;
    resource.released = true;
    session.dependencies.revokeObjectUrl(resource.previewUrl);
  }, []);

  const closeSession = useCallback(
    (session: ScreenshotSession, resetView: boolean) => {
      if (!session.closed) {
        session.closed = true;
        session.active?.controller.abort();
        for (const resource of session.resources.values()) {
          releaseResource(session, resource);
        }
        session.resources.clear();
      }
      if (!session.disposePromise) {
        const previousDisposals = disposalTailRef.current;
        session.disposePromise = previousDisposals.then(async () => {
          if (!session.enginePromise) return;
          try {
            const engine = await session.enginePromise;
            await engine.dispose();
          } catch {
            // Failed initialization has no engine to release; failed disposal
            // must not poison the serialization tail for later sessions.
          }
        });
        disposalTailRef.current = session.disposePromise;
      }
      if (sessionRef.current === session) sessionRef.current = undefined;
      if (resetView && mountedRef.current) {
        stateRef.current = null;
        reconciliationRef.current = undefined;
        decisionsRef.current = new Map();
        setOpen(false);
        setCompleting(false);
        setState(null);
        setStatusList([]);
        setReconciliation(undefined);
        setDecisions(new Map());
      }
      return session.disposePromise;
    },
    [releaseResource, setStatusList],
  );

  const processImage = useCallback(
    async (session: ScreenshotSession, imageId: string) => {
      const resource = session.resources.get(imageId);
      if (!resource || !isActive(session)) return;
      updateStatus(imageId, (status) => ({
        ...status,
        state: "recognizing",
        completedTiles: 0,
        totalTiles: 0,
        tradeCount: 0,
        issueCount: 0,
        error: undefined,
      }));
      const controller = new AbortController();
      session.active = { imageId, controller };

      try {
        if (!session.enginePromise) {
          await session.engineCreationBarrier;
          if (!isActive(session) || !session.resources.has(imageId)) return;
          session.enginePromise = session.dependencies.createOcrEngine();
        }
        const engine = await session.enginePromise;
        if (!isActive(session) || !session.resources.has(imageId)) return;
        const ocr = await session.dependencies.recognize(
          resource.input,
          engine,
          {
            signal: controller.signal,
            onProgress: (completedTiles, totalTiles) => {
              if (!isActive(session) || !session.resources.has(imageId)) {
                return;
              }
              updateStatus(imageId, (status) => ({
                ...status,
                completedTiles,
                totalTiles,
              }));
            },
          },
        );
        if (!isActive(session) || !session.resources.has(imageId)) return;
        const layout = session.dependencies.detectLayout(ocr);
        if (!layout.matched) throw new Error(layout.message);
        const drafts =
          layout.broker === "futu"
            ? session.dependencies.parseFutu(ocr)
            : session.dependencies.parseTiger(ocr);
        if (drafts.length === 0) {
          throw new Error("未从截图中识别到成交记录");
        }
        resource.width = ocr.width;
        resource.height = ocr.height;
        const current = stateRef.current;
        if (!current || !isActive(session)) return;
        updateStatus(imageId, (status) => ({
          ...status,
          state: "queued",
        }));
        updateReview(
          replaceImageResult(
            current,
            {
              imageId,
              fingerprint: resource.input.fingerprint,
              captureIndex: resource.input.index,
              broker: layout.broker,
              layoutVersion: layout.layoutVersion,
            } as ReviewImageSource,
            drafts,
          ),
        );
      } catch (error) {
        if (
          !isAbortError(error) &&
          isActive(session) &&
          session.resources.has(imageId)
        ) {
          updateStatus(imageId, (status) => ({
            ...status,
            state: "failed",
            error: messageFor(error),
          }));
        }
      } finally {
        if (session.active?.controller === controller) {
          session.active = undefined;
        }
      }
    },
    [isActive, updateReview, updateStatus],
  );

  const start = useCallback(
    async (files: File[]) => {
      if (sessionRef.current?.completing) return;
      const validation = dependencies.validateFiles(files);
      if (!validation.ok) throw new Error(validation.message);
      const previous = sessionRef.current;
      if (previous) void closeSession(previous, false);

      const session: ScreenshotSession = {
        id: ++nextSessionIdRef.current,
        resources: new Map(),
        dependencies,
        engineCreationBarrier: disposalTailRef.current,
        queue: Promise.resolve(),
        closed: false,
        completing: false,
      };
      sessionRef.current = session;
      stateRef.current = null;
      reconciliationRef.current = undefined;
      decisionsRef.current = new Map();
      setOpen(true);
      setCompleting(false);
      setState(null);
      setStatusList([]);
      setReconciliation(undefined);
      setDecisions(new Map());

      try {
        const inputs = uniqueInputIds(
          await session.dependencies.buildInputs(validation.files),
        );
        if (!isActive(session)) return;
        for (const input of inputs) {
          const previewUrl = session.dependencies.createObjectUrl(input.file);
          session.resources.set(input.id, {
            input,
            fileName: input.file.name,
            previewUrl,
            width: 0,
            height: 0,
            released: false,
          });
        }
        const initialState = initialReviewState(
          session.dependencies.buildBatchId(inputs),
        );
        stateRef.current = initialState;
        setState(initialState);
        setStatusList(
          inputs.map((input) => ({
            id: input.id,
            captureIndex: input.index,
            state: "queued",
            completedTiles: 0,
            totalTiles: 0,
            tradeCount: 0,
            issueCount: 0,
          })),
        );
        session.queue = (async () => {
          for (const input of inputs) {
            if (!isActive(session)) break;
            if (!session.resources.has(input.id)) continue;
            await processImage(session, input.id);
          }
        })();
        await session.queue;
      } catch (error) {
        await closeSession(session, true);
        throw error;
      }
    },
    [closeSession, dependencies, isActive, processImage, setStatusList],
  );

  const retryImage = useCallback(
    async (imageId: string) => {
      const session = sessionRef.current;
      if (
        !session ||
        !isActive(session) ||
        session.completing ||
        !session.resources.has(imageId)
      ) {
        return;
      }
      updateStatus(imageId, (status) => ({
        ...status,
        state: "queued",
        completedTiles: 0,
        totalTiles: 0,
        error: undefined,
      }));
      const pending = session.queue.then(() => processImage(session, imageId));
      session.queue = pending;
      await pending;
    },
    [isActive, processImage, updateStatus],
  );

  const removeImage = useCallback(
    (imageId: string) => {
      const session = sessionRef.current;
      const resource = session?.resources.get(imageId);
      if (
        !session ||
        !resource ||
        !isActive(session) ||
        session.completing
      ) return;
      if (session.active?.imageId === imageId) {
        session.active.controller.abort();
      }
      releaseResource(session, resource);
      session.resources.delete(imageId);
      setStatusList(
        statusesRef.current.filter((status) => status.id !== imageId),
      );
      const current = stateRef.current;
      if (current) updateReview(removeImageResult(current, imageId));
    },
    [isActive, releaseResource, setStatusList, updateReview],
  );

  const dispatch = useCallback(
    (action: ScreenshotReviewAction) => {
      const session = sessionRef.current;
      const current = stateRef.current;
      if (
        !session ||
        !current ||
        !isActive(session) ||
        session.completing
      ) return;
      updateReview(screenshotReviewReducer(current, action));
    },
    [isActive, updateReview],
  );

  const decide = useCallback(
    (conflictId: string, decision: ReconciliationDecision) => {
      const session = sessionRef.current;
      if (
        !session ||
        !isActive(session) ||
        session.completing ||
        !reconciliationRef.current?.conflicts.some(
          ({ id }) => id === conflictId,
        )
      ) {
        return;
      }
      const next = new Map(decisionsRef.current);
      next.set(conflictId, decision);
      decisionsRef.current = next;
      setDecisions(next);
    },
    [isActive],
  );

  const completeReview = useCallback(async () => {
    const session = sessionRef.current;
    const current = stateRef.current;
    if (
      !session ||
      !current ||
      !isActive(session) ||
      session.completing ||
      current.drafts.every(({ id }) => current.deletedDraftIds.has(id)) ||
      statusesRef.current.some(({ state: imageState }) =>
        ["queued", "recognizing", "failed"].includes(imageState),
      ) ||
      reviewBlockers(current).length > 0
    ) {
      return;
    }
    const parsed = toStatementParseResult(current);
    const currentExecutions = callbacksRef.current.currentExecutions();
    const latestReconciliation = reconcileExecutions(
      currentExecutions,
      parsed.records,
    );
    reconciliationRef.current = latestReconciliation;
    setReconciliation(latestReconciliation);
    if (
      latestReconciliation.conflicts.some(
        ({ id }) => !decisionsRef.current.has(id),
      )
    ) {
      return;
    }

    // Validate the current decisions against the exact reconciliation snapshot
    // that will be handed to the import transaction.
    applyReconciliationDecisions(
      currentExecutions,
      latestReconciliation,
      decisionsRef.current,
    );
    session.completing = true;
    setCompleting(true);
    try {
      await callbacksRef.current.onPrepared({
        parsed,
        reconciliation: latestReconciliation,
        decisions: new Map(decisionsRef.current),
        fileName: `${session.resources.size} 张交易截图`,
        captureCount: session.resources.size,
      });
      if (isActive(session)) await closeSession(session, true);
    } catch (error) {
      if (isActive(session)) {
        session.completing = false;
        setCompleting(false);
      }
      throw error;
    }
  }, [closeSession, isActive]);

  const cancel = useCallback(() => {
    const session = sessionRef.current;
    if (session && !session.completing) void closeSession(session, true);
  }, [closeSession]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const session = sessionRef.current;
      if (session) void closeSession(session, false);
    };
  }, [closeSession]);

  const images = statuses.flatMap((status) => {
    const resource = sessionRef.current?.resources.get(status.id);
    return resource
      ? [
          {
            id: status.id,
            fileName: resource.fileName,
            previewUrl: resource.previewUrl,
            width: resource.width,
            height: resource.height,
            state: status.state,
            completedTiles: status.completedTiles,
            totalTiles: status.totalTiles,
            tradeCount: status.tradeCount,
            issueCount: status.issueCount,
            ...(status.error ? { error: status.error } : {}),
          },
        ]
      : [];
  });

  return {
    open,
    completing,
    state,
    images,
    reconciliation,
    decisions,
    start,
    retryImage,
    removeImage,
    dispatch,
    decide,
    completeReview,
    cancel,
  };
}
