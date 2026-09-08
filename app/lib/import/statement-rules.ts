export type StatementRuleStatus = "supported" | "unsupported";

export type StatementFormatRule = {
  id: string;
  broker: string;
  status: StatementRuleStatus;
  priority: number;
};

export type StatementTimeRule = {
  id: string;
  broker: string;
  version: number;
};

export type TimeCandidateEvidence = {
  timezone: string;
  score: number;
  evidence: string[];
};

export type StatementRuleSet = {
  formats: readonly StatementFormatRule[];
  time: readonly StatementTimeRule[];
};

type StatementRuleInput = {
  formats: readonly StatementFormatRule[];
  time: readonly StatementTimeRule[];
};

function validateRuleId(id: string) {
  if (!id.trim()) throw new Error("statement rule id must not be empty");
}

function freezeRule<T extends object>(rule: T): Readonly<T> {
  return Object.freeze({ ...rule });
}

export function createStatementRuleSet(
  input: StatementRuleInput,
): StatementRuleSet {
  const ids = new Set<string>();
  const collect = (rule: { id: string }) => {
    validateRuleId(rule.id);
    if (ids.has(rule.id)) {
      throw new Error(`duplicate statement rule id: ${rule.id}`);
    }
    ids.add(rule.id);
  };

  input.formats.forEach(collect);
  input.time.forEach(collect);

  return Object.freeze({
    formats: Object.freeze(input.formats.map(freezeRule)),
    time: Object.freeze(input.time.map(freezeRule)),
  });
}

export function resolveFormatRule(
  rules: StatementRuleSet,
  id: string,
): StatementFormatRule | undefined {
  return rules.formats.find((rule) => rule.id === id);
}

export function rankTimeCandidates(
  candidates: readonly TimeCandidateEvidence[],
): TimeCandidateEvidence[] {
  return candidates
    .map((candidate) => ({
      ...candidate,
      evidence: [...candidate.evidence],
    }))
    .sort((left, right) => right.score - left.score || left.timezone.localeCompare(right.timezone));
}
