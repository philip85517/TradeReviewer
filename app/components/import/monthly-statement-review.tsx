"use client";

import { useState } from "react";
import type { StatementParseResult } from "../../lib/import/contracts";
import type { StatementTimeOptions } from "../../lib/import/monthly-statement";
import { useModalFocus } from "./use-modal-focus";

type Props = {
  fileName: string;
  parsed: StatementParseResult;
  busy?: boolean;
  onReparse: (options: StatementTimeOptions) => void;
  onContinue: () => void;
  onCancel: () => void;
};

export function MonthlyStatementReview({ fileName, parsed, busy, onReparse, onContinue, onCancel }: Props) {
  const ref = useModalFocus(onCancel);
  const [zone, setZone] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [zoneChanged, setZoneChanged] = useState(false);
  const monthly = parsed.monthly;
  const needsAcknowledgement = monthly?.reviewRequired || parsed.diagnostics.some(d => d.severity === "warning");
  return <div className="modal-backdrop"><section ref={ref} className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="monthly-review-title">
    <header className="modal-header"><div><span className="eyebrow">月结单证据核对</span><h2 id="monthly-review-title">核对月结单与时间口径</h2></div><button className="secondary-button" onClick={onCancel}>取消</button></header>
    <div className="import-file-summary"><div><strong>{fileName}</strong><p>{monthly?.month ?? "账期未识别"} · {monthly?.templateIds.join(" / ")}</p><p>时间依据：{monthly?.timePolicy ?? "请核对原件时间说明"}</p></div></div>
    <p>已识别 {parsed.records.length} 笔成交、{monthly?.positions.length ?? 0} 条持仓快照、{monthly?.events.length ?? 0} 条辅助流水。合计行不计为成交。重新导入同一文件会更新该文件的解析记录。</p>
    <section className="import-category-panel" aria-label="月结单诊断">
      {parsed.diagnostics.length === 0 ? <p>未发现解析问题；仍请核对原件。</p> : <ul>{parsed.diagnostics.map((d, i) => <li key={`${d.code}:${i}`}><strong>{d.severity === "error" ? "错误" : d.severity === "warning" ? "需核对" : "说明"}</strong>：{d.page ? `第 ${d.page} 页 ` : ""}{d.message}</li>)}</ul>}
    </section>
    <section className="import-category-panel">
      <label>缺失或冲突的文档来源时区<select aria-label="月结单来源时区" value={zone} onChange={e => { setZone(e.target.value); setZoneChanged(true); setAcknowledged(false); }}>
        <option value="">按原件自动识别</option><option value="Asia/Hong_Kong">香港时间（UTC+8）</option><option value="America/New_York">纽约时间（按日期处理夏令时）</option><option value="UTC">UTC</option>
      </select></label>
      <p>仅在有原件或成交回报依据时更改。行内明确时区仍优先；选择会随成交保存为人工确认来源。</p>
      <button className="secondary-button" disabled={busy} onClick={() => { setAcknowledged(false); onReparse(zone ? { sourceTimezone: zone, overrideDocumentTimezone: true } : {}); }}>按所选时间口径重新解析</button>
    </section>
    <details className="import-category-panel"><summary>核对逐笔成交与来源（{parsed.records.length}）</summary>
      <div style={{ overflowX: "auto", maxHeight: 320 }}><table><thead><tr><th>证券 / 市场</th><th>原时间与语义</th><th>标准化时间</th><th>方向 / 数量 / 价格</th><th>费用</th><th>来源页</th></tr></thead><tbody>{parsed.records.map(r => <tr key={r.id}><td>{r.instrument.symbol} / {r.instrument.market}</td><td>{r.source.sourceTimestampText} · {r.source.sourceTimeKind === "order" ? "下单时间；仅日期级" : r.source.timePrecision === "date-only" ? "仅日期" : "成交时间"} · {r.source.sourceTimezone}{r.source.timeEvidence === "inferred" ? ` · 推断 ${Math.round((r.source.timeConfidence ?? 0) * 100)}%` : ""}</td><td>{r.executedAt}</td><td>{r.side === "buy" ? "买入" : "卖出"} / {r.quantity} / {r.price}</td><td>{r.source.feeStatus === "unknown" ? "未知" : r.fee}</td><td>{r.source.fragments?.map(f => f.page).filter((p, i, all) => all.indexOf(p) === i).join(", ") ?? r.source.page}</td></tr>)}</tbody></table></div>
    </details>
    <details className="import-category-panel"><summary>持仓与辅助流水证据</summary><ul>{monthly?.positions.map((p, i) => <li key={`p${i}`}>{p.date} {p.phase === "opening" ? "期初" : "期末"} {p.market}:{p.symbol} {p.quantity} 股 · {p.cost ? `原件成本 ${p.cost}` : "历史成本未知"}</li>)}{monthly?.events.map(e => <li key={e.id}>{e.date} {e.symbol} {e.kind} · {e.description}</li>)}</ul></details>
    {needsAcknowledgement && <label><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} />我已核对上述警告和数据范围；未知成本及日期精度限制将保留</label>}
    {parsed.blocked && <p role="alert">当前月结单存在阻断问题，请更正时间口径或检查原件后重试。</p>}
    <footer className="modal-footer"><p>{zoneChanged ? "时间口径已改变，请先重新解析。" : "继续后还会展示股票分类与导入确认，取消不会保存。"}</p><button className="primary-button" disabled={busy || zoneChanged || parsed.blocked || Boolean(needsAcknowledgement && !acknowledged)} onClick={onContinue}>继续核对并导入</button></footer>
  </section></div>;
}
