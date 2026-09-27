import { createEmptyEpisodeReviewRecord } from "../reviews/review-metrics";
import type { EpisodeReviewRecord } from "../reviews/types";

/**
 * The formal Recall copy is the completion authority.  It intentionally only
 * projects the completion bit into the legacy review shape; plan, evaluation,
 * tags, and other legacy fields remain owned by the legacy record.
 */
export type RecallCompletionProjection = {
  episodeId: string;
  updatedAt: string;
};

export function bridgeRecallCompletion(
  record: EpisodeReviewRecord | undefined,
  completion: RecallCompletionProjection,
  instrumentId?: string,
): EpisodeReviewRecord | undefined {
  if (record) {
    if (record.review.completed) return record;
    return {
      ...record,
      review: { ...record.review, completed: true },
    };
  }
  if (!instrumentId) return undefined;
  const synthetic = createEmptyEpisodeReviewRecord(
    completion.episodeId,
    instrumentId,
    completion.updatedAt,
  );
  synthetic.updatedAt = completion.updatedAt;
  synthetic.review.completed = true;
  return synthetic;
}

export function bridgeRecallCompletions(
  records: readonly EpisodeReviewRecord[],
  completions: readonly RecallCompletionProjection[],
  instrumentIdsByEpisode: ReadonlyMap<string, string>,
): EpisodeReviewRecord[] {
  const byEpisode = new Map(records.map((record) => [record.episodeId, record]));
  for (const completion of completions) {
    const bridged = bridgeRecallCompletion(
      byEpisode.get(completion.episodeId),
      completion,
      instrumentIdsByEpisode.get(completion.episodeId),
    );
    if (bridged) byEpisode.set(completion.episodeId, bridged);
  }
  return [...byEpisode.values()].sort((left, right) => left.episodeId.localeCompare(right.episodeId));
}
