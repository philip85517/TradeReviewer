from pathlib import Path
p=Path('app/lib/reviews/homepage-v25-performance.ts');s=p.read_text()
s=s.replace('type PreparedPositionLedger, type PositionLedgerSnapshot','readPreparedPositionFacts, type CanonicalFactResult, type PositionFactValue, type PreparedPositionLedger, type PositionLedgerSnapshot')
s=s.replace('function replay(group: Group, boundary: Boundary, start: string, prepared?: PreparedKernel): State {','function replay(group: Group, boundary: Boundary, start: string, prepared?: PreparedKernel, observe?: FeeStepObserver): State {')
s=s.replace('    const before = beforeStep(ids, step);','    const poolBefore = pool;\n    const before = beforeStep(ids, step);')
s=s.replace('    if (pool && fee && size.gt(0)) {\n      const allocated: Decimal = closed.gt(0) ? pool.mul(closed).div(beforeQuantity.abs()) : new Decimal(0);\n      pool = pool.minus(allocated).plus(fee.mul(size.minus(closed)).div(size));\n    }','''    let released: Decimal | null = null;
    if (pool && fee && size.gt(0)) {
      const allocated: Decimal = closed.gt(0) ? pool.mul(closed).div(beforeQuantity.abs()) : new Decimal(0);
      pool = pool.minus(allocated).plus(fee.mul(size.minus(closed)).div(size));
      if (observe) released = allocated;
    }
    observe?.({ executionId: e?.id ?? null, allocationEventId: step.allocation?.id ?? null, at: step.at,
      poolBefore, poolAfter: pool, released, fee, closed, size, reasons: [...pnl, ...quantityReasons],
      beforeContext: { cursor: allocations.length ? boundary.cursor : step.at > boundary.cursor ? boundary.cursor : step.at,
        selectedExecutionPrefixLength: ids.length, movementPrefix: prefix.slice(0, -1).map(item => [...item]),
        evidencePolicy: allocations.length ? "cash-knowledge-with-preceding-movements" : "original" } });''')
s=s.replace('function prepareOrdinaryProjection(data: PreparedData, group: Group, canonical: PreparedPositionLedger, normalized: ReturnType<typeof normalizedExecution>[]): OrdinaryProjection {','function prepareOrdinaryProjection(data: PreparedData | undefined, group: Group, canonical: PreparedPositionLedger, normalized: ReturnType<typeof normalizedExecution>[], observe?: FeeStepObserver): OrdinaryProjection {')
s=s.replace('    data.counts.feeSteps++;\n    const e=ordered[index]', '    if (data) data.counts.feeSteps++;\n    const poolBefore = pool;\n    const e=ordered[index]')
s=s.replace('    if(pool&&size.gt(0)){\n      const allocated: Decimal=closed.gt(0)?pool.mul(closed).div(beforeQuantity.abs()):new Decimal(0);\n      pool=pool.minus(allocated).plus(fee.mul(size.minus(closed)).div(size));\n    }\n    checkpoints.push(capture());','''    let released: Decimal | null = null;
    if(pool&&size.gt(0)){
      const allocated: Decimal=closed.gt(0)?pool.mul(closed).div(beforeQuantity.abs()):new Decimal(0);
      pool=pool.minus(allocated).plus(fee.mul(size.minus(closed)).div(size));
      if (observe) released = allocated;
    }
    observe?.({ executionId: e.id, allocationEventId: null, at: replayExecutionAt(e), poolBefore, poolAfter: pool,
      released, fee, closed, size, reasons: [...pnl, ...quantity],
      beforeContext: { cursor: replayExecutionAt(e), selectedExecutionPrefixLength: index, movementPrefix: null, evidencePolicy: "original" } });
    checkpoints.push(capture());''')
p.write_text(s)
