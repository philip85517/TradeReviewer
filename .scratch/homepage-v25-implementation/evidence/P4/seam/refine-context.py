from pathlib import Path
p=Path('app/lib/reviews/homepage-v25-performance.ts');s=p.read_text()
s=s.replace('    if (!allocations.length) return snapshot(ids, step.at > boundary.cursor ? boundary.cursor : step.at, feeExecutions);','''    if (!allocations.length) {
      if (observe) stepContext = { sourceId: `sha256:${sha256(JSON.stringify({ input: { executions: feeExecutions }, policy: "canonical-movement-1" }))}`, selectedExecutionIds: [...ids] };
      return snapshot(ids, step.at > boundary.cursor ? boundary.cursor : step.at, feeExecutions);
    }''')
s=s.replace('    return snapshot(ids, boundary.cursor, prefix);','''    if (observe) stepContext = { sourceId: `sha256:${sha256(JSON.stringify({ input: { executions: prefix }, policy: "canonical-movement-1" }))}`, selectedExecutionIds: [...ids] };
    return snapshot(ids, boundary.cursor, prefix);''')
s=s.replace('  const beforeStep = (ids: string[], step: Step) => {', '  let stepContext: { sourceId: string; selectedExecutionIds: string[] } | undefined;\n  const beforeStep = (ids: string[], step: Step) => {')
s=s.replace('beforeContext: { cursor: allocations.length ?', 'beforeContext: { ...stepContext!, cursor: allocations.length ?')
s=s.replace('normalized: ReturnType<typeof normalizedExecution>[], observe?: FeeStepObserver): OrdinaryProjection {','normalized: ReturnType<typeof normalizedExecution>[], observe?: FeeStepObserver, prefixLength?: number): OrdinaryProjection {')
s=s.replace('  const ordered=canonical.transitions.map(fact=>byId.get(fact.executionId)!.execution);','  const transitions = prefixLength === undefined ? canonical.transitions : canonical.transitions.slice(0, prefixLength);\n  const ordered=transitions.map(fact=>byId.get(fact.executionId)!.execution);')
s=s.replace('beforeContext: { cursor: replayExecutionAt(e), selectedExecutionPrefixLength: index,','beforeContext: { selectedExecutionIds: null, cursor: replayExecutionAt(e), selectedExecutionPrefixLength: index,')
s=s.replace('beforeContext: { cursor: string; selectedExecutionPrefixLength:', 'beforeContext: { sourceId?: string; selectedExecutionIds: readonly string[] | null; cursor: string; selectedExecutionPrefixLength:')
s=s.replace('beforeContext: { ...step.beforeContext, sourceId: canonical.sourceId, selectedExecutionOrder: executionOrder },','beforeContext: { ...step.beforeContext, sourceId: step.beforeContext.sourceId ?? canonical.sourceId, selectedExecutionOrder: executionOrder },')
a=s.index('      const selectedSet = new Set(selected.map(execution => execution.id));');b=s.index('      const ledger = ',a)
s=s[:a]+'''      const fees = prepareOrdinaryProjection(undefined, group, canonicalSource, normalized, observe, selected.length).checkpoints.at(-1)!;
'''+s[b:]
s=s.replace('const zero = last.after.quantity.value === "0", ended =', 'const after = D(last.after.quantity.value), zero = after !== null && (episode.direction === "long" ? after.lte(0) : after.gte(0)), ended =')
# Copy records that are owned by the prepared source before freezing the public bundle.
s=s.replace('canonical, allocations, incurredFeeFacts: feeFacts,','canonical, allocations, incurredFeeFacts: structuredClone(feeFacts), rawExecutions: structuredClone(group.executions),')
s=s.replace('sourceCoverage: lifetimeFor(data, group, boundary),','sourceCoverage: structuredClone(lifetimeFor(data, group, boundary)),')
p.write_text(s)
