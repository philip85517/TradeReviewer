from pathlib import Path
p=Path('app/lib/replay/position-ledger.ts');s=p.read_text()
s=s.replace('execution.source.timePrecision === "day" ? "day" : execution.source.timePrecision === "month" ? "month" : "instant"','execution.source.timePrecision === "date-only" || execution.executedAt.length === 10 ? "day" : "instant"')
s=s.replace('value.toString(), available:', 'value.toFixed(), available:')
s=s.replace('closed = new Decimal(0); opened = size;', 'if (facts) { closed = new Decimal(0); opened = size; }')
s=s.replace('closed = covered; opened = size.minus(covered);','if (facts) { closed = covered; opened = size.minus(covered); }')
# Keep the original sell branch closed local; observation only points at that same calculated value.
s=s.replace('closed = Decimal.min(quantity, size); opened = size.minus(closed);\n      realizedPnl', 'const matched = Decimal.min(quantity, size);\n      if (facts) { closed = matched; opened = size.minus(matched); }\n      realizedPnl')
s=s.replace('price.minus(averageCost).mul(closed)', 'price.minus(averageCost).mul(matched)')
# Event cash evidence IDs used by this exact cost authority, not guessed links.
s=s.replace('effect: CanonicalMovementFact["effect"] };', 'effect: CanonicalMovementFact["effect"]; evidenceIds: string[] };')
s=s.replace('let effect: CanonicalMovementFact["effect"] = "applied";', 'let effect: CanonicalMovementFact["effect"] = "applied";\n    let movementEvidence: string[] = [];')
s=s.replace('        if (cost) fees = fees.plus(cost.feeCost);', '        if (cost) { fees = fees.plus(cost.feeCost); if (facts) movementEvidence = cost.evidenceIds; }')
s=s.replace('closed, opened, effect });', 'closed, opened, effect, evidenceIds: movementEvidence });')
s=s.replace('evidenceIds: execution ? [execution.id] : event ? [event.id] : [JSON.stringify([position!.accountId, position!.market, position!.symbol, position!.phase, position!.date, position!.quantity])],','evidenceIds: execution ? [execution.id] : event ? [...new Set([event.id, ...value.evidenceIds])] : [JSON.stringify([position!.accountId, position!.market, position!.symbol, position!.phase, position!.date, position!.quantity])],')
s=s.replace('let movementEvidence: string[] = [];', 'let movementEvidence: string[] | undefined;')
s=s.replace('evidenceIds: movementEvidence });', 'evidenceIds: movementEvidence ?? [] });')
p.write_text(s)
p=Path('app/lib/reviews/homepage-v25-performance.ts');s=p.read_text()
s=s.replace('value.toString(), available: value !== null', 'value.toFixed(), available: value !== null')
s=s.replace('request: { asOf: string }) {\n  const data = preparedData.get(source);','request: { asOf: string; targetCurrency?: string }) {\n  const data = preparedData.get(source);')
s=s.replace('    const executionOrder = canonical.selectedExecutionIds;\n    const observe:', '''    const executionOrder = canonical.selectedExecutionIds;
    const movements = new Map(canonical.facts.flatMap(fact => fact.executionId ? [[`execution:${fact.executionId}`, fact] as const] : fact.kind === "ipo-allocation" && fact.effect === "applied" ? [[`allocation:${fact.eventId}`, fact] as const] : []));
    const feesByEvidence = new Map<string, HomepageV25FeeFact[]>();
    for (const fact of feeFacts) for (const id of [...fact.lineage.executionIds, ...fact.lineage.eventIds]) {
      const bucket = feesByEvidence.get(id) ?? []; bucket.push(fact); feesByEvidence.set(id, bucket);
    }
    const observe:''')
a='''      if (!canonical.facts.some(fact => step.executionId ? fact.executionId === step.executionId : fact.eventId === step.allocationEventId && fact.kind === "ipo-allocation" && fact.effect === "applied")) return;
      const movement = canonical.facts.find(fact => step.executionId ? fact.executionId === step.executionId : fact.eventId === step.allocationEventId && fact.kind === "ipo-allocation" && fact.effect === "applied")!;'''
b='''      const movement = movements.get(step.executionId ? `execution:${step.executionId}` : `allocation:${step.allocationEventId}`);
      if (!movement) return;'''
s=s.replace(a,b)
s=s.replace('const matchingFees = feeFacts.filter(fact => step.executionId ? fact.lineage.executionIds.includes(step.executionId) : fact.lineage.eventIds.includes(step.allocationEventId!));', 'const matchingFees = [...new Map((step.executionId ? feesByEvidence.get(step.executionId) ?? [] : movement.evidenceIds.flatMap(id => feesByEvidence.get(id) ?? [])).map(fact => [fact.factId, fact])).values()];')
s=s.replace('      sourceCoverage: lifetimeFor(data, group, boundary),','''      sourceCoverage: lifetimeFor(data, group, boundary),
      episodeCoverage: episodeFactCoverage(data, group, canonical),
      classificationCoverage: classificationFactCoverage(canonical),
      fxCoverage: fxFor(data, boundary, [group.instrument.currency], request.targetCurrency).coverage,''')
p.write_text(s)
# Correct new fixture construction, never touch the original assertions.
p=Path('app/lib/replay/position-ledger.test.ts');s=p.read_text();i=s.index('describe("P4 canonical fact seam O05');a,b=s[:i],s[i:]
b=b.replace('quantity: "1", description: "bonus shares"','quantity: "1", amount: "0", description: "bonus shares"')
b=b.replace('fixturePosition({ date: "2026-01-01", phase: "opening", quantity: "2" })', '{ accountId: "fixture-account", market: "HK", symbol: fixtureInstrument.symbol, date: "2026-01-01", phase: "opening" as const, quantity: "2", source: [] }').replace('fixturePosition({ date: "2026-03-31", phase: "closing", quantity: "0" })', '{ accountId: "fixture-account", market: "HK", symbol: fixtureInstrument.symbol, date: "2026-03-31", phase: "closing" as const, quantity: "0", source: [] }')
s=a+'import Decimal from "decimal.js";\n\n'+b;p.write_text(s)
p=Path('app/lib/reviews/homepage-v25-performance.test.ts');s=p.read_text();i=s.index('const seamIpoEvents');a,b=s[:i],s[i:]
b=b.replace('["1", "-1", "20", "2", "18"]', '["1", "-1", "-80", "3", "-83"]').replace('106.66666666666666666','106.66666666666666667').replace('103.33333333333333333','103.33333333333333334')
b=b.replace('buildTradeLibraryEntries(buildInstrumentTradeSummaries(executions));','buildTradeLibraryEntries(buildInstrumentTradeSummaries(executions), {}, {});')
s=a+b;p.write_text(s)
