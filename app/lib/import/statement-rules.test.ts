import { describe, expect, it } from "vitest";

import {
  createStatementRuleSet,
  rankTimeCandidates,
  resolveFormatRule,
  type StatementRuleSet,
} from "./statement-rules";

const baseRules = (): StatementRuleSet =>
  createStatementRuleSet({
    formats: [
      {
        id: "futu/pdf/f4@1",
        broker: "futu",
        status: "supported",
        priority: 40,
      },
    ],
    time: [
      {
        id: "futu/time/market-session@1",
        broker: "futu",
        version: 1,
      },
    ],
  });

describe("statement rule registry", () => {
  it("resolves a format rule by stable id", () => {
    expect(resolveFormatRule(baseRules(), "futu/pdf/f4@1")).toMatchObject({
      broker: "futu",
      status: "supported",
    });
  });

  it("rejects duplicate rule ids instead of choosing by insertion order", () => {
    expect(() =>
      createStatementRuleSet({
        formats: [
          { id: "same", broker: "futu", status: "supported", priority: 1 },
          { id: "same", broker: "tiger", status: "supported", priority: 2 },
        ],
        time: [],
      }),
    ).toThrow("duplicate statement rule id: same");
  });

  it("ranks time candidates by score and preserves evidence", () => {
    expect(
      rankTimeCandidates([
        {
          timezone: "Asia/Hong_Kong",
          score: 0.78,
          evidence: ["alternate-market-session"],
        },
        {
          timezone: "America/New_York",
          score: 0.93,
          evidence: ["market-session"],
        },
      ]),
    ).toEqual([
      {
        timezone: "America/New_York",
        score: 0.93,
        evidence: ["market-session"],
      },
      {
        timezone: "Asia/Hong_Kong",
        score: 0.78,
        evidence: ["alternate-market-session"],
      },
    ]);
  });
});
