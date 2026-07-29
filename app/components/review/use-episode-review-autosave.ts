"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  isValidPlannedRiskAmount,
  normalizeEpisodeReviewRecord,
} from "../../lib/reviews/review-metrics";
import type { EpisodeReviewRecord } from "../../lib/reviews/types";

type Status = "idle" | "dirty" | "saving" | "saved" | "error";

type Input = {
  episodeId: string;
  instrumentId: string;
  record?: EpisodeReviewRecord;
  delayMs?: number;
  onSave: (record: EpisodeReviewRecord) => Promise<void>;
};

function emptyRecord(episodeId: string, instrumentId: string): EpisodeReviewRecord {
  return {
    version: 1,
    episodeId,
    instrumentId,
    updatedAt: new Date(0).toISOString(),
    plan: {
      thesis: "",
      expectedPath: "",
      invalidationCondition: "",
      targetRange: "",
      plannedRiskAmount: "",
      confidence: null,
    },
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

function recordFor(input: Pick<Input, "episodeId" | "instrumentId" | "record">) {
  return input.record ?? emptyRecord(input.episodeId, input.instrumentId);
}

export function useEpisodeReviewAutosave(input: Input) {
  const delayMs = input.delayMs ?? 600;
  const [draft, setDraft] = useState(() => recordFor(input));
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const draftRef = useRef(draft);
  const dirtyRef = useRef(false);
  const revisionRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const identityRef = useRef(`${input.episodeId}\u0000${input.instrumentId}`);
  const recordUpdatedAtRef = useRef(input.record?.updatedAt);
  const onSaveRef = useRef(input.onSave);

  useEffect(() => {
    onSaveRef.current = input.onSave;
  }, [input.onSave]);

  const persist = useCallback(async (candidate: EpisodeReviewRecord, revision: number) => {
    if (!isValidPlannedRiskAmount(candidate.plan.plannedRiskAmount)) {
      if (revision === revisionRef.current) {
        setStatus("error");
        setError("计划风险必须大于 0");
      }
      return;
    }

    const next = normalizeEpisodeReviewRecord({
      ...candidate,
      updatedAt: new Date().toISOString(),
    });
    if (revision === revisionRef.current) {
      setStatus("saving");
      setError(null);
    }
    try {
      await onSaveRef.current(next);
      if (revision !== revisionRef.current) return;
      draftRef.current = next;
      dirtyRef.current = false;
      setDraft(next);
      setStatus("saved");
    } catch {
      if (revision !== revisionRef.current) return;
      setStatus("error");
      setError("保存失败，请检查本机存储后重试");
    }
  }, []);

  const flushPending = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (dirtyRef.current) {
      void persist(draftRef.current, revisionRef.current);
    }
  }, [persist]);

  const schedule = useCallback((next: EpisodeReviewRecord) => {
    revisionRef.current += 1;
    const revision = revisionRef.current;
    draftRef.current = next;
    dirtyRef.current = true;
    setDraft(next);
    setStatus("dirty");
    setError(null);
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void persist(next, revision);
    }, delayMs);
  }, [delayMs, persist]);

  useEffect(() => {
    const identity = `${input.episodeId}\u0000${input.instrumentId}`;
    if (identity !== identityRef.current) {
      flushPending();
      identityRef.current = identity;
      recordUpdatedAtRef.current = input.record?.updatedAt;
      revisionRef.current += 1;
      const next = recordFor(input);
      draftRef.current = next;
      dirtyRef.current = false;
      setDraft(next);
      setStatus("idle");
      setError(null);
      return;
    }
    if (
      input.record &&
      input.record.updatedAt !== recordUpdatedAtRef.current &&
      !dirtyRef.current
    ) {
      recordUpdatedAtRef.current = input.record.updatedAt;
      draftRef.current = input.record;
      setDraft(input.record);
      setStatus("idle");
      setError(null);
    }
  }, [flushPending, input]);

  useEffect(() => () => flushPending(), [flushPending]);

  const updatePlan = <K extends keyof EpisodeReviewRecord["plan"]>(
    key: K,
    value: EpisodeReviewRecord["plan"][K],
  ) => {
    schedule({
      ...draftRef.current,
      plan: { ...draftRef.current.plan, [key]: value },
    });
  };

  const updateReview = <K extends keyof EpisodeReviewRecord["review"]>(
    key: K,
    value: EpisodeReviewRecord["review"][K],
  ) => {
    schedule({
      ...draftRef.current,
      review: { ...draftRef.current.review, [key]: value },
    });
  };

  const toggleTag = (tagId: string) => {
    const current = draftRef.current;
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
    await persist(draftRef.current, revisionRef.current);
  };

  return { draft, status, error, updatePlan, updateReview, toggleTag, retry };
}
