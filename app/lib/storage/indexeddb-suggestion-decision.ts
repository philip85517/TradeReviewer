import type { TagSuggestionRecord } from "../insights/types";
import { normalizeEpisodeReviewRecord } from "../reviews/review-metrics";
import type { EpisodeReviewRecord } from "../reviews/types";
import {
  openTradeReviewDatabase,
  REVIEWS,
  TAG_SUGGESTIONS,
  transactionDone,
} from "./indexeddb-schema";
import { normalizeTagSuggestionRecord } from "./indexeddb-tag-suggestion-repository";

type PersistSuggestionDecisionInput = {
  databaseName?: string;
  suggestion: TagSuggestionRecord;
  review?: EpisodeReviewRecord;
};

export async function persistSuggestionDecision({
  databaseName = "trade-reviewer",
  suggestion,
  review,
}: PersistSuggestionDecisionInput) {
  const database = await openTradeReviewDatabase(databaseName);
  const stores = review ? [TAG_SUGGESTIONS, REVIEWS] : [TAG_SUGGESTIONS];
  try {
    const transaction = database.transaction(stores, "readwrite");
    const completion = transactionDone(transaction);
    try {
      transaction
        .objectStore(TAG_SUGGESTIONS)
        .put(normalizeTagSuggestionRecord(suggestion));
      if (review) {
        transaction
          .objectStore(REVIEWS)
          .put(normalizeEpisodeReviewRecord(review));
      }
    } catch (error) {
      transaction.abort();
      await completion.catch(() => undefined);
      throw error;
    }
    await completion;
  } finally {
    database.close();
  }
}
