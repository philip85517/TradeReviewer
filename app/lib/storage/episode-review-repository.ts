import type { EpisodeReviewRecord } from "../reviews/types";

export interface EpisodeReviewRepository {
  getAll(): Promise<EpisodeReviewRecord[]>;
  get(episodeId: string): Promise<EpisodeReviewRecord | undefined>;
  put(record: EpisodeReviewRecord): Promise<boolean>;
}
