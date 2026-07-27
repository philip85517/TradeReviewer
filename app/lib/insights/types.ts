export type TagSuggestionStatus =
  | "suggested"
  | "confirmed"
  | "rejected"
  | "edited";

export type SuggestionEvidence =
  | {
      kind: "price-comparison";
      tradingDate: string;
      observed: string;
      reference: string;
    }
  | {
      kind: "breakout-pullback";
      tradingDate: string;
      breakoutDate: string;
      observed: string;
      reference: string;
    }
  | {
      kind: "execution-count";
      observed: string;
      reference: string;
    };

export type TagSuggestionRuleId =
  | "entry-20d-breakout"
  | "first-pullback-after-breakout"
  | "scale-in";

export type TagSuggestionRecord = {
  version: 1;
  id: string;
  episodeId: string;
  instrumentId: string;
  tagId: string;
  finalTagId: string | null;
  ruleId: TagSuggestionRuleId;
  ruleVersion: 1;
  status: TagSuggestionStatus;
  suggestedAt: string;
  decidedAt: string | null;
  evidence: SuggestionEvidence[];
};
