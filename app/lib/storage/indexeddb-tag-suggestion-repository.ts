import type { TagSuggestionRecord } from "../insights/types";
import {
  openTradeReviewDatabase,
  requestValue,
  TAG_SUGGESTIONS,
  transactionDone,
} from "./indexeddb-schema";
import {
  normalizeTagSuggestionRecord,
  type TagSuggestionRepository,
} from "./tag-suggestion-repository";

export { normalizeTagSuggestionRecord } from "./tag-suggestion-repository";

export class IndexedDbTagSuggestionRepository
  implements TagSuggestionRepository
{
  constructor(private readonly databaseName = "trade-reviewer") {}

  async getAll() {
    const database = await openTradeReviewDatabase(this.databaseName);
    try {
      const transaction = database.transaction(
        TAG_SUGGESTIONS,
        "readonly",
      );
      const records = (await requestValue(
        transaction.objectStore(TAG_SUGGESTIONS).getAll(),
      )) as TagSuggestionRecord[];
      return records.map(normalizeTagSuggestionRecord);
    } finally {
      database.close();
    }
  }

  async put(record: TagSuggestionRecord) {
    const database = await openTradeReviewDatabase(this.databaseName);
    try {
      const transaction = database.transaction(
        TAG_SUGGESTIONS,
        "readwrite",
      );
      const completion = transactionDone(transaction);
      transaction
        .objectStore(TAG_SUGGESTIONS)
        .put(normalizeTagSuggestionRecord(record));
      await completion;
    } finally {
      database.close();
    }
  }
}
