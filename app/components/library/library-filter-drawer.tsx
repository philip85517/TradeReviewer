"use client";

import { useMemo, useState } from "react";

import type { TradeLibraryEntry } from "../../lib/trades/library";
import { useModalFocus } from "../import/use-modal-focus";
import type { TradeLibraryBrowseState } from "./library-browse-state";
import {
  buildLibraryFilterOptions,
  normalizeBrokerIds,
  type LibraryFilterOption,
  type LibraryFilterOptions,
} from "./library-filter-options";
import styles from "./library-filter-drawer.module.css";

export type LibraryFilterDrawerProps = {
  value: TradeLibraryBrowseState;
  entries: TradeLibraryEntry[];
  /** Reuse the parent scope's memoized options when available. */
  options?: LibraryFilterOptions;
  onApply: (patch: Partial<TradeLibraryBrowseState>) => void;
  onClose: () => void;
};

type DrawerDraft = Pick<
  TradeLibraryBrowseState,
  | "brokers"
  | "accounts"
  | "year"
  | "simulationRunId"
  | "positionStatus"
  | "dataStatus"
  | "tag"
>;

function draftFrom(value: TradeLibraryBrowseState): DrawerDraft {
  return {
    brokers: normalizeBrokerIds(value.brokers),
    accounts: [...value.accounts],
    year: value.year,
    simulationRunId: value.simulationRunId,
    positionStatus: value.positionStatus,
    dataStatus: value.dataStatus,
    tag: value.tag,
  };
}

function toggle(values: readonly string[], id: string): string[] {
  return values.includes(id)
    ? values.filter((value) => value !== id)
    : [...values, id];
}

function selectedSummary(
  options: readonly LibraryFilterOption[],
  selected: readonly string[],
  emptyLabel: string,
) {
  if (selected.length === 0) return emptyLabel;
  const labels = selected
    .map((id) => options.find((option) => option.id === id)?.label ?? id)
    .filter(Boolean);
  return labels.length <= 2
    ? labels.join("、")
    : `${labels.slice(0, 2).join("、")} 等 ${labels.length} 项`;
}

export function LibraryFilterDrawer({
  value,
  entries,
  options: providedOptions,
  onApply,
  onClose,
}: LibraryFilterDrawerProps) {
  const options = useMemo(
    () => providedOptions ?? buildLibraryFilterOptions(entries),
    [entries, providedOptions],
  );
  const [draft, setDraft] = useState<DrawerDraft>(() => draftFrom(value));
  const drawerRef = useModalFocus(onClose);
  const showSimulationRuns = value.tradeNature === "simulation" ||
    (value.tradeNature === "all" && options.simulationRuns.length > 0);

  const update = <K extends keyof DrawerDraft>(key: K, next: DrawerDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: next }));
  };

  const clearDraft = () => setDraft({
    brokers: [],
    accounts: [],
    year: "all",
    simulationRunId: "all",
    positionStatus: "all",
    dataStatus: "all",
    tag: "all",
  });

  const apply = () => {
    onApply({
      brokers: [...draft.brokers],
      accounts: [...draft.accounts],
      account: draft.accounts.length === 1 ? draft.accounts[0] : "all",
      year: draft.year,
      simulationRunId: draft.simulationRunId,
      positionStatus: draft.positionStatus,
      dataStatus: draft.dataStatus,
      tag: draft.tag,
    });
    onClose();
  };

  return (
    <div className={styles.backdrop}>
      <aside
        ref={drawerRef}
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-filter-drawer-title"
      >
        <header className={styles.header}>
          <div>
            <h2 id="library-filter-drawer-title">高级筛选</h2>
            <p>修改条件后点击应用；关闭抽屉会放弃本次修改。</p>
          </div>
          <button type="button" className={styles.closeButton} aria-label="关闭高级筛选" onClick={onClose}>×</button>
        </header>

        <div className={styles.content}>
          <fieldset className={styles.section}>
            <legend>来源平台</legend>
            <details open>
              <summary>{selectedSummary(options.brokers, draft.brokers, "未限定来源平台")}</summary>
              <div className={styles.checkList} role="group" aria-label="来源平台选项">
                {options.brokers.map((option) => (
                  <label key={option.id} className={styles.checkItem}>
                    <input
                      type="checkbox"
                      aria-label={option.label}
                      checked={draft.brokers.includes(option.id)}
                      onChange={() => update("brokers", toggle(draft.brokers, option.id))}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
                {options.brokers.length === 0 && <p className={styles.summary}>当前范围没有来源平台选项。</p>}
              </div>
            </details>
          </fieldset>

          <fieldset className={styles.section}>
            <legend>账户</legend>
            <details open>
              <summary>{selectedSummary(options.accounts, draft.accounts, "未限定账户")}</summary>
              <div className={styles.checkList} role="group" aria-label="账户">
                {options.accounts.map((option) => (
                  <label key={option.id} className={styles.checkItem}>
                    <input
                      type="checkbox"
                      aria-label={option.label}
                      checked={draft.accounts.includes(option.id)}
                      onChange={() => update("accounts", toggle(draft.accounts, option.id))}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
                {options.accounts.length === 0 && <p className={styles.summary}>当前范围没有账户选项。</p>}
              </div>
            </details>
          </fieldset>

          <label className={styles.field}>
            <span>年份</span>
            <select aria-label="年份" value={draft.year} onChange={(event) => update("year", event.target.value)}>
              <option value="all">全部年份</option>
              {options.years.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>

          {showSimulationRuns && options.simulationRuns.length > 0 && <label className={styles.field}>
            <span>模拟运行</span>
            <select aria-label="模拟运行" value={draft.simulationRunId} onChange={(event) => update("simulationRunId", event.target.value)}>
              <option value="all">全部模拟运行</option>
              {options.simulationRuns.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>}

          <details className={styles.section}>
            <summary>其他条件</summary>
            <div>
              <label className={styles.field}>
                <span>持仓状态</span>
                <select aria-label="持仓状态" value={draft.positionStatus} onChange={(event) => update("positionStatus", event.target.value)}>
                  {options.positionStatuses.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
              <label className={styles.field}>
                <span>行情状态</span>
                <select aria-label="行情状态" value={draft.dataStatus} onChange={(event) => update("dataStatus", event.target.value)}>
                  {options.dataStatuses.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
              {options.tags.length > 0 && <label className={styles.field}>
                <span>复盘标签</span>
                <select aria-label="复盘标签" value={draft.tag} onChange={(event) => update("tag", event.target.value)}>
                  <option value="all">全部标签</option>
                  {options.tags.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>}
            </div>
          </details>
        </div>

        <footer className={styles.actions}>
          <button type="button" className={styles.clearButton} onClick={clearDraft}>清除高级条件</button>
          <button type="button" className={styles.cancelButton} onClick={onClose}>取消</button>
          <button type="button" className={styles.applyButton} onClick={apply}>应用筛选</button>
        </footer>
      </aside>
    </div>
  );
}
