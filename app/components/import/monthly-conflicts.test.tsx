import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ImportPreview } from "../../lib/import/import-preview";
import type { ExecutionConflict } from "../../lib/import/execution-reconciliation";
import { ImportConfirmDialog } from "./import-confirm-dialog";

afterEach(cleanup);
it("requires a decision for every monthly conflict before saving", () => {
  const preview: ImportPreview = { id: "p", fileName: "2025-06.pdf", sourceLabel: "富途", sourceKind: "statement", records: [], instruments: [], unresolved: [], exclusionGroups: [], tradeCount: 0, instrumentCount: 0, duplicateTradeCount: 0, unresolvedInstrumentCount: 0, excludedInstrumentCount: 0, blocked: false };
  const conflicts: ExecutionConflict[] = [{ id: "c", candidateKey: "test", existing: [], incoming: [] }];
  const onDecision = vi.fn();
  const onConfirm = vi.fn();
  const props = { preview, conflicts, onConflictDecision: onDecision, onConfirm, onCancel: vi.fn(), onRetryUnresolved: vi.fn() };
  const view = render(<ImportConfirmDialog {...props} />);
  const save = screen.getByRole("button", { name: /确认导入/ });
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText("冲突处理 c"), { target: { value: "keep-both" } });
  expect(onDecision).toHaveBeenCalledWith("c", "keep-both");
  view.rerender(<ImportConfirmDialog {...props} conflictDecisions={new Map([["c", "keep-both"]])} />);
  fireEvent.click(save);
  expect(onConfirm).toHaveBeenCalledOnce();
});
