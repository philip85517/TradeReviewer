"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  episodePlanAtCursor,
  hasValidPlannedRiskAmounts,
  mergeEpisodePlanRevision,
  normalizeEpisodeReviewRecord,
} from "../../lib/reviews/review-metrics";
import type {
  EpisodePlan,
  EpisodeReviewRecord,
} from "../../lib/reviews/types";

type Status = "idle" | "dirty" | "saving" | "saved" | "error";

type Input = {
  episodeId: string;
  instrumentId: string;
  record?: EpisodeReviewRecord;
  knowledgeCursor?: string;
  episodeStartedAt?: string;
  delayMs?: number;
  onSave: (record: EpisodeReviewRecord) => Promise<void>;
};

type RetainedDraft = {
  draft: EpisodeReviewRecord;
  status: Exclude<Status, "idle" | "saved">;
  error: string | null;
  revision: number;
};

const retainedDrafts = new Map<string, RetainedDraft>();
const latestRevisions = new Map<string, number>();
const latestSaveTimestamps = new Map<string, number>();

function identityFor(episodeId: string, instrumentId: string) {
  return `${episodeId}\u0000${instrumentId}`;
}

function nextRevision(identity: string) {
  const revision = (latestRevisions.get(identity) ?? 0) + 1;
  latestRevisions.set(identity, revision);
  return revision;
}

function nextSaveTimestamp(
  identity: string,
  candidate: EpisodeReviewRecord,
) {
  const candidateTimestamp = Date.parse(candidate.updatedAt);
  const next = Math.max(
    Date.now(),
    Number.isFinite(candidateTimestamp) ? candidateTimestamp + 1 : 0,
    (latestSaveTimestamps.get(identity) ?? -1) + 1,
  );
  latestSaveTimestamps.set(identity, next);
  return new Date(next).toISOString();
}

function emptyPlan(): EpisodePlan {
  return {
    thesis: "",
    expectedPath: "",
    invalidationCondition: "",
    targetRange: "",
    plannedRiskAmount: "",
    confidence: null,
  };
}

function emptyRecord(
  episodeId: string,
  instrumentId: string,
): EpisodeReviewRecord {
  return {
    version: 1,
    episodeId,
    instrumentId,
    updatedAt: new Date(0).toISOString(),
    plan: emptyPlan(),
    review: {
      decisionQuality: null,
      executionQuality: null,
      riskManagement: "",
      psychology: "",
      reusableRule: "",
      completed: false,
    },
    confirmedTagIds: [],
  };
}

function sourceRecord(
  input: Pick<Input, "episodeId" | "instrumentId" | "record">,
) {
  return input.record ?? emptyRecord(input.episodeId, input.instrumentId);
}

function displayRecordAtCursor(
  record: EpisodeReviewRecord,
  knowledgeCursor: string | undefined,
) {
  if (!knowledgeCursor) return record;
  return {
    ...record,
    plan: episodePlanAtCursor(record, knowledgeCursor) ?? emptyPlan(),
  };
}

export function useEpisodeReviewAutosave(input: Input) {
  const delayMs = input.delayMs ?? 600;
  const initialIdentity = identityFor(
    input.episodeId,
    input.instrumentId,
  );
  const initialRetained = retainedDrafts.get(initialIdentity);
  const initialSource = initialRetained?.draft ?? sourceRecord(input);
  const [draft, setDraft] = useState(() =>
    displayRecordAtCursor(initialSource, input.knowledgeCursor),
  );
  const [status, setStatus] = useState<Status>(
    initialRetained?.status ?? "idle",
  );
  const [error, setError] = useState<string | null>(
    initialRetained?.error ?? null,
  );
  const draftRef = useRef(draft);
  const sourceRef = useRef(initialSource);
  const dirtyRef = useRef(Boolean(initialRetained));
  const revisionRef = useRef(
    initialRetained?.revision ??
      latestRevisions.get(initialIdentity) ??
      0,
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const identityRef = useRef(initialIdentity);
  const cursorRef = useRef(input.knowledgeCursor);
  const recordUpdatedAtRef = useRef(input.record?.updatedAt);
  const onSaveRef = useRef(input.onSave);
  const mountedRef = useRef(true);

  useEffect(() => {
    onSaveRef.current = input.onSave;
  }, [input.onSave]);

  const showRetainedState = useCallback(
    (
      identity: string,
      revision: number,
      retained: RetainedDraft,
    ) => {
      if (
        !mountedRef.current ||
        identity !== identityRef.current ||
        revision !== revisionRef.current
      ) {
        return;
      }
      draftRef.current = displayRecordAtCursor(
        retained.draft,
        cursorRef.current,
      );
      sourceRef.current = retained.draft;
      dirtyRef.current = true;
      setDraft(draftRef.current);
      setStatus(retained.status);
      setError(retained.error);
    },
    [setDraft, setError, setStatus],
  );

  const persist = useCallback(
    async (
      identity: string,
      candidate: EpisodeReviewRecord,
      revision: number,
    ) => {
      if (!hasValidPlannedRiskAmounts(candidate)) {
        const retained: RetainedDraft = {
          draft: candidate,
          status: "error",
          error: "计划风险必须大于 0",
          revision,
        };
        if (latestRevisions.get(identity) === revision) {
          retainedDrafts.set(identity, retained);
          showRetainedState(identity, revision, retained);
        }
        return;
      }

      const next = normalizeEpisodeReviewRecord({
        ...candidate,
        updatedAt: nextSaveTimestamp(identity, candidate),
      });
      const saving: RetainedDraft = {
        draft: next,
        status: "saving",
        error: null,
        revision,
      };
      if (latestRevisions.get(identity) !== revision) return;
      retainedDrafts.set(identity, saving);
      showRetainedState(identity, revision, saving);

      try {
        await onSaveRef.current(next);
        if (latestRevisions.get(identity) !== revision) return;
        retainedDrafts.delete(identity);
        if (
          !mountedRef.current ||
          identity !== identityRef.current ||
          revision !== revisionRef.current
        ) {
          return;
        }
        sourceRef.current = next;
        draftRef.current = displayRecordAtCursor(
          next,
          cursorRef.current,
        );
        dirtyRef.current = false;
        setDraft(draftRef.current);
        setStatus("saved");
        setError(null);
      } catch {
        if (latestRevisions.get(identity) !== revision) return;
        const failed: RetainedDraft = {
          draft: next,
          status: "error",
          error: "保存失败，请检查本机存储后重试",
          revision,
        };
        retainedDrafts.set(identity, failed);
        showRetainedState(identity, revision, failed);
      }
    },
    [setDraft, setError, setStatus, showRetainedState],
  );

  const flushPending = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const identity = identityRef.current;
    const retained = retainedDrafts.get(identity);
    if (
      dirtyRef.current &&
      retained?.status === "dirty" &&
      retained.revision === revisionRef.current
    ) {
      void persist(identity, retained.draft, retained.revision);
    }
  }, [persist]);

  const schedule = useCallback(
    (next: EpisodeReviewRecord) => {
      const identity = identityRef.current;
      const revision = nextRevision(identity);
      const retained: RetainedDraft = {
        draft: next,
        status: "dirty",
        error: null,
        revision,
      };
      revisionRef.current = revision;
      sourceRef.current = next;
      draftRef.current = displayRecordAtCursor(
        next,
        cursorRef.current,
      );
      dirtyRef.current = true;
      retainedDrafts.set(identity, retained);
      setDraft(draftRef.current);
      setStatus("dirty");
      setError(null);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void persist(identity, next, revision);
      }, delayMs);
    },
    [delayMs, persist, setDraft, setError, setStatus],
  );

  useEffect(() => {
    const identity = identityFor(input.episodeId, input.instrumentId);
    if (identity !== identityRef.current) {
      flushPending();
      identityRef.current = identity;
      cursorRef.current = input.knowledgeCursor;
      recordUpdatedAtRef.current = input.record?.updatedAt;
      const retained = retainedDrafts.get(identity);
      const next = retained?.draft ?? sourceRecord(input);
      revisionRef.current =
        retained?.revision ?? latestRevisions.get(identity) ?? 0;
      sourceRef.current = next;
      draftRef.current = displayRecordAtCursor(
        next,
        input.knowledgeCursor,
      );
      dirtyRef.current = Boolean(retained);
      setDraft(draftRef.current);
      setStatus(retained?.status ?? "idle");
      setError(retained?.error ?? null);
      return;
    }

    if (input.knowledgeCursor !== cursorRef.current) {
      flushPending();
      cursorRef.current = input.knowledgeCursor;
      const retained = retainedDrafts.get(identity);
      const next = retained?.draft ?? sourceRef.current;
      sourceRef.current = next;
      draftRef.current = displayRecordAtCursor(
        next,
        input.knowledgeCursor,
      );
      dirtyRef.current = Boolean(retained);
      setDraft(draftRef.current);
      setStatus(retained?.status ?? "idle");
      setError(retained?.error ?? null);
      return;
    }

    if (
      input.record &&
      input.record.updatedAt !== recordUpdatedAtRef.current &&
      !retainedDrafts.has(identity)
    ) {
      recordUpdatedAtRef.current = input.record.updatedAt;
      sourceRef.current = input.record;
      draftRef.current = displayRecordAtCursor(
        input.record,
        input.knowledgeCursor,
      );
      dirtyRef.current = false;
      setDraft(draftRef.current);
      setStatus("idle");
      setError(null);
    }
  }, [flushPending, input]);

  useEffect(
    () => {
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
        flushPending();
      };
    },
    [flushPending],
  );

  const updatePlan = <K extends keyof EpisodePlan>(
    key: K,
    value: EpisodePlan[K],
  ) => {
    const nextPlan = { ...draftRef.current.plan, [key]: value };
    if (!input.knowledgeCursor) {
      schedule({ ...sourceRef.current, plan: nextPlan });
      return;
    }
    const revised = mergeEpisodePlanRevision({
      record: sourceRef.current,
      knowledgeAt: input.knowledgeCursor,
      episodeStartedAt:
        input.episodeStartedAt ?? input.knowledgeCursor,
      plan: nextPlan,
    });
    schedule(revised);
  };

  const updateReview = <
    K extends keyof EpisodeReviewRecord["review"],
  >(
    key: K,
    value: EpisodeReviewRecord["review"][K],
  ) => {
    schedule({
      ...sourceRef.current,
      review: { ...sourceRef.current.review, [key]: value },
    });
  };

  const toggleTag = (tagId: string) => {
    const current = sourceRef.current;
    schedule({
      ...current,
      confirmedTagIds: current.confirmedTagIds.includes(tagId)
        ? current.confirmedTagIds.filter((id) => id !== tagId)
        : [...current.confirmedTagIds, tagId],
    });
  };

  const retry = async () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const identity = identityRef.current;
    const retained = retainedDrafts.get(identity);
    const candidate = retained?.draft ?? sourceRef.current;
    const revision =
      retained?.revision || revisionRef.current || nextRevision(identity);
    revisionRef.current = revision;
    latestRevisions.set(identity, revision);
    dirtyRef.current = true;
    await persist(identity, candidate, revision);
  };

  return {
    draft,
    status,
    error,
    updatePlan,
    updateReview,
    toggleTag,
    retry,
  };
}
