import type {
  SuggestionEvidence,
  TagSuggestionRecord,
} from "../insights/types";
import { REVIEW_TAG_DICTIONARY_VERSION } from "../reviews/review-tags";
import {
  openTradeReviewDatabase,
  requestValue,
  TAG_SUGGESTIONS,
  transactionDone,
} from "./indexeddb-schema";
import type { TagSuggestionRepository } from "./tag-suggestion-repository";

function cleanEvidence(
  evidence: SuggestionEvidence,
): SuggestionEvidence {
  if (evidence.kind === "execution-count") {
    return {
      ...evidence,
      observed: evidence.observed.trim(),
      reference: evidence.reference.trim(),
    };
  }
  if (evidence.kind === "price-comparison") {
    return {
      ...evidence,
      tradingDate: evidence.tradingDate.trim(),
      observed: evidence.observed.trim(),
      reference: evidence.reference.trim(),
    };
  }
  return {
    ...evidence,
    tradingDate: evidence.tradingDate.trim(),
    breakoutDate: evidence.breakoutDate.trim(),
    observed: evidence.observed.trim(),
    reference: evidence.reference.trim(),
  };
}

export function normalizeTagSuggestionRecord(
  record: TagSuggestionRecord,
): TagSuggestionRecord {
  return {
    ...record,
    tagDictionaryVersion:
      record.tagDictionaryVersion ?? REVIEW_TAG_DICTIONARY_VERSION,
    id: record.id.trim(),
    episodeId: record.episodeId.trim(),
    instrumentId: record.instrumentId.trim(),
    tagId: record.tagId.trim(),
    finalTagId: record.finalTagId?.trim() || null,
    suggestedAt: record.suggestedAt.trim(),
    decidedAt: record.decidedAt?.trim() || null,
    evidence: record.evidence.map(cleanEvidence),
  };
}

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
