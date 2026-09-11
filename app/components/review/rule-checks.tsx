"use client";

import { ExternalLink } from "lucide-react";

import {
  updateRuleCheck,
  type TrackedRuleCandidate,
} from "../../lib/reviews/review-summary";
import type { RuleCheck } from "../../lib/reviews/types";

type Props = {
  candidates: TrackedRuleCandidate[];
  checks: RuleCheck[];
  onChange: (checks: RuleCheck[]) => void;
  onOpenSource: (instrumentId: string, episodeId: string) => void;
};

const RESULT_LABELS: Record<RuleCheck["result"], string> = {
  followed: "遵守",
  deviated: "偏离",
  "not-applicable": "不适用",
};

export function RuleChecks({
  candidates,
  checks,
  onChange,
  onOpenSource,
}: Props) {
  const bySource = new Map(candidates.map((item) => [item.sourceEpisodeId, item]));
  const rows: Array<{
    candidate: TrackedRuleCandidate;
    check?: RuleCheck;
  }> = [
    ...candidates.map((candidate) => ({
      candidate,
      check: checks.find(
        ({ sourceEpisodeId }) => sourceEpisodeId === candidate.sourceEpisodeId,
      ),
    })),
    ...checks
      .filter(({ sourceEpisodeId }) => !bySource.has(sourceEpisodeId))
      .map((check) => ({
        check,
        candidate: {
          sourceEpisodeId: check.sourceEpisodeId,
          sourceUpdatedAt: check.sourceUpdatedAt,
          ruleText: check.ruleText,
          sourceInstrumentId: "",
          sourceLabel: "已保存的来源回合",
        },
      })),
  ];

  if (rows.length === 0) return null;

  return (
    <section className="rule-checks" aria-label="此前规则检查">
      <header>
        <strong>此前规则检查</strong>
        <span>由你判断本回合是否适用</span>
      </header>
      <div className="rule-check-list">
        {rows.map(({ candidate, check }) => {
          const snapshot = check ?? candidate;
          return (
            <article key={candidate.sourceEpisodeId}>
              <div>
                <p>{snapshot.ruleText}</p>
                <small>{candidate.sourceLabel}</small>
              </div>
              <label>
                <span>本回合</span>
                <select
                  aria-label={`判断规则：${snapshot.ruleText}`}
                  value={check?.result ?? ""}
                  onChange={(event) => {
                    if (!event.target.value) return;
                    onChange(
                      updateRuleCheck(
                        checks,
                        candidate,
                        event.target.value as RuleCheck["result"],
                      ),
                    );
                  }}
                >
                  <option value="">未判断</option>
                  {Object.entries(RESULT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {candidate.sourceInstrumentId && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenSource(
                      candidate.sourceInstrumentId,
                      candidate.sourceEpisodeId,
                    )
                  }
                >
                  <ExternalLink size={13} />
                  来源回合
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
