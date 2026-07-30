export const REVIEW_TAGS = [
  { id: "breakout", label: "突破" },
  { id: "pullback", label: "回踩" },
  { id: "bull-flag", label: "Bull Flag" },
  { id: "trading-range", label: "Trading Range" },
  { id: "planned", label: "计划内" },
  { id: "fomo", label: "FOMO" },
  { id: "fear", label: "恐惧" },
  { id: "scale-in", label: "分批进入" },
] as const;

export const REVIEW_TAG_DICTIONARY_VERSION = 1 as const;

export function reviewTagLabel(tagId: string) {
  return REVIEW_TAGS.find(({ id }) => id === tagId)?.label ?? tagId;
}
