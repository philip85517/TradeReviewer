export type ReviewScore = 1 | 2 | 3 | 4 | 5;

export type EpisodeReviewRecord = {
  version: 1;
  tagDictionaryVersion?: number;
  episodeId: string;
  instrumentId: string;
  updatedAt: string;
  plan: {
    thesis: string;
    expectedPath: string;
    invalidationCondition: string;
    targetRange: string;
    plannedRiskAmount: string;
    confidence: ReviewScore | null;
  };
  review: {
    decisionQuality: ReviewScore | null;
    executionQuality: ReviewScore | null;
    riskManagement: string;
    psychology: string;
    reusableRule: string;
    completed: boolean;
  };
  confirmedTagIds: string[];
};

export type EpisodeReviewDraft = Omit<
  EpisodeReviewRecord,
  "version" | "updatedAt"
>;

export type EpisodeReviewStatus = "pending" | "completed";
