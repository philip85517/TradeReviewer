import type {
  SuggestionEvidence,
  TagSuggestionRecord,
} from "../insights/types";
import { REVIEW_TAG_DICTIONARY_VERSION } from "../reviews/review-tags";

export interface TagSuggestionRepository {
  getAll(): Promise<TagSuggestionRecord[]>;
  put(record: TagSuggestionRecord): Promise<void>;
}

function cleanEvidence(evidence: SuggestionEvidence): SuggestionEvidence {
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
