/** MIGRATION-ONLY: retired IndexedDB repository for browser-state-export/tests. */
import { normalizeEpisodeReviewRecord } from "../reviews/review-metrics";
import type { EpisodeReviewRecord } from "../reviews/types";
import type { EpisodeReviewRepository } from "./episode-review-repository";
import {
  openTradeReviewDatabase,
  requestValue,
  REVIEWS,
  transactionDone,
} from "./indexeddb-schema";

export class IndexedDbEpisodeReviewRepository
  implements EpisodeReviewRepository
{
  constructor(private readonly databaseName = "trade-reviewer") {}

  async getAll() {
    const database = await openTradeReviewDatabase(this.databaseName);
    try {
      const transaction = database.transaction(REVIEWS, "readonly");
      return (await requestValue(
        transaction.objectStore(REVIEWS).getAll(),
      )) as EpisodeReviewRecord[];
    } finally {
      database.close();
    }
  }

  async get(episodeId: string) {
    const database = await openTradeReviewDatabase(this.databaseName);
    try {
      const transaction = database.transaction(REVIEWS, "readonly");
      return (await requestValue(
        transaction.objectStore(REVIEWS).get(episodeId),
      )) as EpisodeReviewRecord | undefined;
    } finally {
      database.close();
    }
  }

  async put(record: EpisodeReviewRecord) {
    const database = await openTradeReviewDatabase(this.databaseName);
    try {
      const transaction = database.transaction(REVIEWS, "readwrite");
      const completion = transactionDone(transaction);
      const store = transaction.objectStore(REVIEWS);
      const normalized = normalizeEpisodeReviewRecord(record);
      const current = (await requestValue(
        store.get(record.episodeId),
      )) as EpisodeReviewRecord | undefined;
      if (
        current &&
        Date.parse(current.updatedAt) > Date.parse(normalized.updatedAt)
      ) {
        await completion;
        return false;
      }
      store.put(normalized);
      await completion;
      return true;
    } finally {
      database.close();
    }
  }
}
