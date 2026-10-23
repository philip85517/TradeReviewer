from pathlib import Path
p=Path('app/lib/replay/position-ledger.ts')
s=p.read_text()
s=s.replace('effect: CanonicalMovementFact["effect"]; evidenceIds: string[] }','effect: CanonicalMovementFact["effect"]; evidenceIds: string[]; beforeFeeUnavailable: boolean; afterFeeUnavailable: boolean }')
s=s.replace('terminal(value: Checkpoint): void','terminal(value: Checkpoint, feeUnavailable: boolean): void')
s=s.replace('  let ordinal = -1;','  let ordinal = -1, factFeeUnavailable = false;')
s=s.replace('    const before = facts ? checkpoint() : undefined;','    const before = facts ? checkpoint() : undefined;\n    const beforeFeeUnavailable = factFeeUnavailable;')
s=s.replace('        if (!cost || !allocationCost) {\n          reasons.add("position-event");','        if (!cost || !allocationCost) {\n          if (facts) factFeeUnavailable = true;\n          reasons.add("position-event");')
s=s.replace('effect, evidenceIds: movementEvidence ?? [] });','effect, evidenceIds: movementEvidence ?? [], beforeFeeUnavailable, afterFeeUnavailable: factFeeUnavailable });')
s=s.replace('  facts?.terminal(terminal);','  facts?.terminal(terminal, factFeeUnavailable);')
s=s.replace('function stateFact(state: Checkpoint): CanonicalStateFact {','function stateFact(state: Checkpoint, feeUnavailable = false): CanonicalStateFact {')
s=s.replace('fees: factValue(state.fees, state.reasons.filter(reason => reason.includes("fee"))),','fees: factValue(state.fees, [...state.reasons.filter(reason => reason.includes("fee")), ...(feeUnavailable ? ["ipo-fee-allocation-unavailable"] : [])]),')
s=s.replace('before: stateFact(before), after: stateFact(after),','before: stateFact(before, value.beforeFeeUnavailable), after: stateFact(after, value.afterFeeUnavailable),')
s=s.replace('  let evaluations = 0, transitions = 0;\n  const evaluate =','  let evaluations = 0, transitions = 0, indexProbes = 0;\n  const evaluate =')
s=s.replace('      terminal(value) { terminal = stateFact(value); },','      terminal(value, feeUnavailable) { terminal = stateFact(value, feeUnavailable); },')
s=s.replace('        const index = prepared.index.get(id);','        indexProbes++;\n        const index = prepared.index.get(id);')
s=s.replace('      while (low < high) { const middle = (low + high) >>> 1; if (!cursor','      while (low < high) { indexProbes++; const middle = (low + high) >>> 1; if (!cursor')
s=s.replace('terminal.reasons.filter(reason => ["initial-position", "position-gap",','terminal.reasons.filter(reason => ["position-gap",')
s=s.replace('"history-incomplete"].includes(reason))])];','"history-incomplete"].includes(reason)), ...(facts.some(fact => fact.kind !== "ipo-allocation" && !fact.before.reasons.includes("initial-position") && fact.after.reasons.includes("initial-position")) ? ["initial-position"] : [])])];')
s=s.replace('diagnostics: { evaluations, transitions, retainedFactBytes: 0 }','diagnostics: { evaluations, transitions, indexProbes, retainedFactBytes: 0 }')
p.write_text(s)
p=Path('app/lib/replay/position-ledger.test.ts');s=p.read_text().replace('id: "transfer", kind: "transfer-out", date: "2026-01-08", quantity: "3", symbol:','id: "transfer", kind: "transfer-out", date: "2026-01-08", quantity: "3", description: "stock out", symbol:').replace('id: "allocation", date: "2026-01-10", kind: "ipo", quantity: "2", description: "IPO allocation", displayTimePolicy:', 'id: "allocation", date: "2026-01-10", kind: "ipo", quantity: "2", amount: "-200", description: "IPO allocation", displayTimePolicy:');p.write_text(s)
p=Path('app/lib/reviews/homepage-v25-performance.ts');s=p.read_text();old='    const movements = new Map(canonical.facts.flatMap(fact => fact.executionId ? [[`execution:${fact.executionId}`, fact] as const] : fact.kind === "ipo-allocation" && fact.effect === "applied" ? [[`allocation:${fact.eventId}`, fact] as const] : []));';new='''    const movements = new Map<string, CanonicalFactResult["facts"][number]>();
    for (const fact of canonical.facts) {
      if (fact.executionId) movements.set(`execution:${fact.executionId}`, fact);
      else if (fact.kind === "ipo-allocation" && fact.effect === "applied") movements.set(`allocation:${fact.eventId}`, fact);
    }''';assert old in s;s=s.replace(old,new);p.write_text(s)
p=Path('app/lib/reviews/homepage-v25-performance.test.ts');s=p.read_text().replace('evaluations: 1, transitions: 200, retainedFactBytes: 0, feeSteps: 200','evaluations: 1, transitions: 200, indexProbes: 200, retainedFactBytes: 0, feeSteps: 200');p.write_text(s)
