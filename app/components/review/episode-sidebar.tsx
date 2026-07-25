"use client";

import { Check, Clock3, FileSpreadsheet, Upload } from "lucide-react";

import type { ImportDiagnostic } from "../../lib/import/import-result";
import type { TradeEpisode } from "../../lib/trades/types";

type Props = {
  importedEpisodes: TradeEpisode[];
  diagnostics: ImportDiagnostic[];
  importing: boolean;
  onImport: (file: File) => void;
};

export function EpisodeSidebar({
  importedEpisodes,
  diagnostics,
  importing,
  onImport,
}: Props) {
  return (
    <aside className="episode-sidebar">
      <div className="sidebar-heading">
        <div>
          <span className="eyebrow">交易回合</span>
          <h2>历史复盘</h2>
        </div>
        <span className="episode-count">1 个演示</span>
      </div>
      <label className="import-button">
        <Upload size={16} />
        {importing ? "正在解析…" : "导入富途 XLSX"}
        <input
          type="file"
          accept=".xlsx"
          disabled={importing}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onImport(file);
          }}
        />
      </label>
      <p className="privacy-note">文件仅在此设备解析，不会上传。</p>

      <div className="episode-list">
        <button className="episode-card active">
          <div className="episode-card-top">
            <span className="market-chip">US</span>
            <strong>XPEV</strong>
            <span className="episode-status">
              <Clock3 size={12} />
              回放中
            </span>
          </div>
          <p>小鹏汽车 · Tiger</p>
          <div className="episode-meta">
            <span>2025 Q1</span>
            <b>2 买 / 1 卖</b>
          </div>
        </button>
      </div>

      {importedEpisodes.length > 0 && (
        <section className="import-result">
          <div className="import-result-title">
            <Check size={15} />
            已解析 {importedEpisodes.length} 个回合
          </div>
          {importedEpisodes.slice(0, 4).map((episode) => (
            <div className="imported-episode" key={episode.id}>
              <FileSpreadsheet size={15} />
              <div>
                <strong>{episode.instrument.symbol}</strong>
                <span>
                  {episode.executions.length} 笔 ·{" "}
                  {episode.status === "closed" ? "已平仓" : "持仓中"}
                </span>
              </div>
            </div>
          ))}
          <p>成交已保存在当前会话；真实行情接入后即可回放。</p>
        </section>
      )}

      {diagnostics.length > 0 && (
        <div className="diagnostic-summary">
          {diagnostics.filter((item) => item.severity !== "info").length} 条需检查，
          {diagnostics.filter((item) => item.severity === "info").length} 条已跳过
        </div>
      )}
    </aside>
  );
}
