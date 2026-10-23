from pathlib import Path
p=Path('app/lib/replay/position-ledger.ts');s=p.read_text()
s=s.replace('import Decimal from "decimal.js";','import Decimal from "decimal.js";\nimport { sha256 } from "../recall/retained-digest";')
s=s.replace('function evaluatePositionAtPrice(input: PositionLedgerInput, observe?: (checkpoint: Checkpoint) => void): PositionLedgerSnapshot {','''type LedgerEntry = { at: string; execution?: TradeExecution; position?: StatementPosition; event?: StatementEvent; pendingTransfer?: StatementEvent };
type MovementObservation = { entry: LedgerEntry; ordinal: number; before: Checkpoint; after: Checkpoint; closed: Decimal | null; opened: Decimal | null; effect: CanonicalMovementFact["effect"] };
type FactObserver = { context(cursor: string | null, selected: TradeExecution[]): void; movement(value: MovementObservation): void; terminal(value: Checkpoint): void };
function evaluatePositionAtPrice(input: PositionLedgerInput, observe?: (checkpoint: Checkpoint) => void, facts?: FactObserver): PositionLedgerSnapshot {''')
s=s.replace('  type Entry = { at: string; execution?: TradeExecution; position?: StatementPosition; event?: StatementEvent; pendingTransfer?: StatementEvent };','  type Entry = LedgerEntry;')
s=s.replace('  observe?.(checkpoint());\n\n  for (const entry of timeline) {','''  observe?.(checkpoint());
  facts?.context(cursor ?? null, timeline.flatMap(entry => entry.execution && selectedExecution(entry.execution) ? [entry.execution] : []));
  let ordinal = -1;
  for (const entry of timeline) {
    ordinal++;''')
s=s.replace('    if (entry.pendingTransfer) {','''    const before = facts ? checkpoint() : undefined;
    let closed: Decimal | null = null, opened: Decimal | null = null;
    let effect: CanonicalMovementFact["effect"] = "applied";
    try {
    if (entry.pendingTransfer) {
      effect = "unresolved";''',1)
s=s.replace('      if (isExecutionBackedIpoAllocation(event, actualVisibleExecutions)) continue;','      if (isExecutionBackedIpoAllocation(event, actualVisibleExecutions)) { effect = "suppressed-duplicate"; continue; }')
s=s.replace('      if (isIpoAllocation && isZero(event.quantity)) continue;','      if (isIpoAllocation && isZero(event.quantity)) { effect = "suppressed-duplicate"; continue; }')
s=s.replace('        const size = quantityValue;','        const size = quantityValue;\n        closed = new Decimal(0); opened = size;')
s=s.replace('          const covered = Decimal.min(quantity.abs(), size);\n          if (allocationCost)', '          const covered = Decimal.min(quantity.abs(), size);\n          closed = covered; opened = size.minus(covered);\n          if (allocationCost)')
s=s.replace('        // Cash, fee, dividend, and other statement rows are contextual','        effect = "contextual";\n        // Cash, fee, dividend, and other statement rows are contextual')
s=s.replace('    const size = new Decimal(execution.quantity).abs();','    const size = new Decimal(execution.quantity).abs();\n    closed = new Decimal(0); opened = size;')
s=s.replace('        const covered = Decimal.min(quantity.abs(), size);\n        realizedPnl', '        const covered = Decimal.min(quantity.abs(), size);\n        closed = covered; opened = size.minus(covered);\n        realizedPnl')
s=s.replace('      const closed = Decimal.min(quantity, size);\n      realizedPnl', '      closed = Decimal.min(quantity, size); opened = size.minus(closed);\n      realizedPnl')
s=s.replace('    observe?.(checkpoint());\n  }\n  return finalizePosition(checkpoint(), input.markPrice);','''    observe?.(checkpoint());
    } finally {
      if (facts && before) facts.movement({ entry, ordinal, before, after: checkpoint(), closed, opened, effect });
    }
  }
  const terminal = checkpoint();
  facts?.terminal(terminal);
  return finalizePosition(terminal, input.markPrice);''')
p.write_text(s)
