import type { TagSuggestionRecord } from "../insights/types";

export interface TagSuggestionRepository {
  getAll(): Promise<TagSuggestionRecord[]>;
  put(record: TagSuggestionRecord): Promise<void>;
}
