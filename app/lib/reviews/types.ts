export type ReviewScore = 1 | 2 | 3 | 4 | 5;

export type EpisodePlan = {
  thesis: string;
  expectedPath: string;
  invalidationCondition: string;
  targetRange: string;
  plannedRiskAmount: string;
  confidence: ReviewScore | null;
};

export type EpisodePlanRevision = {
  knowledgeAt: string;
  plan: EpisodePlan;
};

export type EpisodeReviewRecord = {
  version: 1;
  tagDictionaryVersion?: number;
  episodeId: string;
  instrumentId: string;
  updatedAt: string;
  plan: EpisodePlan;
  planRevisions?: EpisodePlanRevision[];
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
