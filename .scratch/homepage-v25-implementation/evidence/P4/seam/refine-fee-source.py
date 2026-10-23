from pathlib import Path
p=Path('app/lib/reviews/homepage-v25-performance.ts');s=p.read_text()
s=s.replace('function collectFeeFacts(data: PreparedData): HomepageV25FeeFact[] {','function collectFeeFacts(data: PreparedData, supplemental: readonly { event: StatementEvent; group: Group }[] = []): HomepageV25FeeFact[] {')
old='''  for (const [key, { event, group, conflict }] of events) {'''
new='''  // Explicit seam reads can supply statement-only groups through the same fee
  // evidence collector. Normal source preparation supplies no supplemental rows.
  for (const { event, group } of supplemental) {
    const key = `${event.accountId}|${group.identity.nature}|${group.identity.simulationRunId ?? ""}|${event.id}`;
    const previous = events.get(key);
    if (previous) { if (JSON.stringify(previous.event) !== JSON.stringify(event)) previous.conflict = true; }
    else events.set(key, { event, group, conflict: false });
  }
  for (const [key, { event, group, conflict }] of events) {'''
assert s.count(old)==1;s=s.replace(old,new)
s=s.replace('    const feeFacts = visibleFeeFacts(data, boundary, data.feeFactsByGroup.get(group.key) ?? []);','''    const feeFacts = visibleFeeFacts(data, boundary, uncoveredEvidence.length
      ? collectFeeFacts({ ...data, groups: [group] }, uncoveredEvidence.flatMap(evidence => evidence.events.map(event => ({ event, group }))))
      : data.feeFactsByGroup.get(group.key) ?? []);''')
s=s.replace('classificationCoverage: classificationFactCoverage(canonical),','classificationCoverage: classificationFactCoverage(canonical, group.executions),')
s=s.replace('function classificationFactCoverage(canonical: CanonicalFactResult) {','''function classificationFactCoverage(canonical: CanonicalFactResult, executions: readonly TradeExecution[]) {
  const suppressed = new Set(canonical.facts.filter(fact => fact.kind === "ipo-allocation" && fact.effect === "suppressed-duplicate").map(fact => fact.eventId));
  const allocations = [...new Map(executions.flatMap(execution => execution.source.positionEvents ?? []).filter(event => suppressed.has(event.id)).map(event => [event.id, event])).values()];
  const ipoBuys = new Set<string>();
  // This existing authority identifies the duplicate acquisition only. It does
  // not establish any disposal-to-lot relationship for mixed-source inventory.
  for (const event of allocations) for (const execution of executions) if (isExecutionBackedIpoAllocation(event, [execution])) ipoBuys.add(execution.id);''')
s=s.replace('if (fact.kind === "ipo-allocation") classes.add("ipo");','if (fact.kind === "ipo-allocation" && (fact.effect === "applied" || allocations.some(event => event.id === fact.eventId))) classes.add("ipo");')
s=s.replace('if (fact.kind === "execution" && D(fact.openedQuantity.value)?.gt(0)) classes.add(D(fact.after.quantity.value)?.lt(0) ? "short" : "long");','if (fact.kind === "execution" && D(fact.openedQuantity.value)?.gt(0)) classes.add(ipoBuys.has(fact.executionId!) ? "ipo" : D(fact.after.quantity.value)?.lt(0) ? "short" : "long");')
p.write_text(s)
