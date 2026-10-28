"use client";

import { FileClock, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { ImportHistoryEntry } from "../../lib/storage/import-history";
import { formatBeijingDate } from "../../lib/replay/format-time";
import { useModalFocus } from "./use-modal-focus";
import "./import-history-dialog.css";

type Props = {
  entries: ImportHistoryEntry[];
  onClose: () => void;
  loadCommit?: (batchId: string, signal: AbortSignal) => Promise<{ batchId: string; committedDuplicateTradeCount?: number }>;
};

function date(value?: string) {
  if (!value) return "—";
  return formatBeijingDate(value);
}
function maskSensitive(value: string): string {
  return value.replace(/\d{4,}/g, match => `••••${match.slice(-4)}`);
}

export function ImportHistoryDialog({ entries, onClose, loadCommit }: Props) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(entries[0]?.id ?? null);
  const [sort, setSort] = useState<"importedAt" | "tradeCount">("importedAt");
  const [descending, setDescending] = useState(true);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matched = normalized ? entries.filter(entry => [entry.fileName, entry.sourceLabel, entry.sourceKind, entry.tradeNature].filter(Boolean).join(" ").toLowerCase().includes(normalized)) : entries;
    return [...matched].sort((a,b) => { const left = sort === "tradeCount" ? a.tradeCount : a.importedAt; const right = sort === "tradeCount" ? b.tradeCount : b.importedAt; const result = left < right ? -1 : left > right ? 1 : 0; return descending ? -result : result; });
  }, [entries, query, sort, descending]);
  const changeSort = (next: "importedAt" | "tradeCount") => { if (sort === next) setDescending(value => !value); else { setSort(next); setDescending(true); } };
  const selected = filtered.find(entry => entry.id === selectedId) ?? filtered[0];
  const [attempt, setAttempt] = useState(0);
  const [verification, setVerification] = useState<{ entry: ImportHistoryEntry; state: "loading" | "ready" | "failed"; count?: number; message?: string }>();
  useEffect(() => {
    if (!selected || !loadCommit) return;
    const controller = new AbortController();
    setVerification({ entry: selected, state: "loading" });
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return;
      return loadCommit(selected.id, controller.signal);
    }).then(result => {
      if (controller.signal.aborted) return;
      if (!result || result.batchId !== selected.id || (result.committedDuplicateTradeCount !== undefined &&
          (!Number.isSafeInteger(result.committedDuplicateTradeCount) || result.committedDuplicateTradeCount < 0))) throw new Error("Invalid batch result");
      setVerification({ entry: selected, state: "ready", count: result.committedDuplicateTradeCount });
    }).catch((error: unknown) => {
      const changed = error && typeof error === "object" && "code" in error && error.code === "BOOK_VERSION_CHANGED";
      if (!controller.signal.aborted) setVerification({ entry: selected, state: "failed", message: changed ? "账本版本已变化，请刷新页面后重试。" : "实际数量读取失败，请重试。" });
    });
    return () => controller.abort();
  }, [selected, loadCommit, attempt]);
  const actual = (entry: ImportHistoryEntry): number | string => {
    if (!loadCommit) return "未知";
    if (entry !== selected) return "选中后核验";
    if (verification?.entry !== entry || verification.state === "loading") return "核验中";
    if (verification.state === "failed") return "读取失败";
    return verification.count ?? "未知";
  };
  const status = (entry: ImportHistoryEntry) => {
    if (entry.unresolvedInstrumentCount > 0) return "待处理";
    const count = actual(entry);
    return typeof count === "number" ? count > 0 ? "已核对重复" : "成功" : count === "未知" ? "实际数量未知" : count;
  };
  const dialogRef = useModalFocus(onClose);
  return (
    <div className="modal-backdrop">
      <section
        ref={dialogRef}
        className="history-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-dialog-title"
      >
        <header className="modal-header">
          <div>
            <span className="eyebrow">数据管理</span>
            <h2 id="history-dialog-title">导入记录</h2>
          </div>
          <button
            className="icon-button"
            aria-label="关闭导入记录"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        {entries.length === 0 ? (
          <div className="history-empty">
            <FileClock size={24} />
            <strong>还没有导入记录</strong>
            <span>每次确认导入后，会在这里保留批次摘要。</span>
          </div>
        ) : (
          <div className="history-content">
            <label className="history-filter">筛选导入记录<input value={query} onChange={event => setQuery(event.target.value)} placeholder="文件名、来源或交易性质" /></label>
            <div className="history-table-wrap">
            <table className="history-table"><caption className="sr-only">导入批次历史</caption><thead><tr><th><button type="button" onClick={()=>changeSort("importedAt")}>导入时间 {sort === "importedAt" ? (descending ? "↓" : "↑") : ""}</button></th><th>来源</th><th>覆盖期间</th><th><button type="button" onClick={()=>changeSort("tradeCount")}>成交数 {sort === "tradeCount" ? (descending ? "↓" : "↑") : ""}</button></th><th>实际重复 / 排除</th><th>状态</th></tr></thead><tbody>
            {filtered.map((entry) => (
              <tr key={entry.id} tabIndex={0} aria-selected={selected?.id === entry.id} onClick={() => setSelectedId(entry.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(entry.id); } }}>
                <td><strong>{date(entry.importedAt)}</strong><small>{maskSensitive(entry.fileName)}</small></td>
                <td>{entry.sourceLabel}<small>{entry.sourceKind === "tradingview" ? "TradingView · 模拟盘" : entry.sourceKind === "screenshot" ? "截图恢复" : "文件导入"}</small></td>
                <td>{date(entry.firstTradeAt)} — {date(entry.lastTradeAt)}<small>账户元数据已脱敏</small></td>
                <td>{entry.tradeCount} 笔<small>{entry.instrumentCount} 个标的</small></td><td>{actual(entry)} / {entry.excludedRecordCount}</td>
                <td>{status(entry)}</td>
              </tr>
            ))}
            </tbody></table>
            {filtered.length === 0 && <p className="history-empty">没有匹配的导入记录。</p>}
            </div>
            {selected && <aside className="history-evidence" aria-label="选中导入证据详情"><strong>选中批次证据</strong><p>{maskSensitive(selected.fileName)} · {date(selected.importedAt)}</p><details><summary>查看原文件名（本地核对）</summary><p>{selected.fileName}</p></details><p>排除 {selected.excludedRecordCount} 笔记录 / {selected.excludedInstrumentCount} 个标的。</p>{selected.sourceKind === "screenshot" && <div className="history-screenshot-meta"><span>{selected.captureCount ?? 0} 张截图</span><span>已处理 {selected.conflictTradeCount ?? 0} 笔冲突</span></div>}<p aria-live="polite">交易区间：{date(selected.firstTradeAt)} — {date(selected.lastTradeAt)}；导入前重复预估 {selected.duplicateTradeCount} 笔；实际核对重复 {actual(selected)}{typeof actual(selected) === "number" ? " 笔" : ""}；未识别标的 {selected.unresolvedInstrumentCount} 个。</p>
                  {actual(selected) === "读取失败" && <><p role="alert">{verification?.message}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>重试核验实际数量</button></>}
                  {selected.monthly && <details><summary>{selected.monthly.month} 月结单证据</summary><p>{selected.monthly.templateIds.join(" / ")}</p><p>{selected.monthly.timePolicy}</p><p>持仓快照 {selected.monthly.positions.length} · 辅助流水 {selected.monthly.events.length}</p><ul>{selected.monthly.events.map(event => <li key={event.id}>{event.date} {event.symbol} {event.description}（第 {event.source.map(s => s.page).join(", ")} 页）</li>)}</ul></details>}
            </aside>}

          </div>
        )}
      </section>
    </div>
  );
}
