"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { RecallWorkspace } from "../recall/recall-workspace";
import type { ChartSettings } from "../../lib/storage/chart-settings";
import { createSqliteHttpClient, type SqliteHttpClient } from "../../lib/storage/sqlite-http-client";
import type { TimeframeAvailability } from "../../lib/market/availability";
import {
  createRecallPrototypeFixture,
  isRecallPrototypeStorageAvailable,
  type RecallPrototypeMode,
  type RecallPrototypeStorage,
} from "./recall-design-prototype-data";
import "./recall-design-prototype.css";

const availability: TimeframeAvailability = {
  "15m": { enabled: false, reason: "样板只提供完整日线范围" },
  "1h": { enabled: false, reason: "样板只提供完整日线范围" },
  "4h": { enabled: false, reason: "样板只提供完整日线范围" },
  "1D": { enabled: true },
  "1W": { enabled: false, reason: "样板只提供完整日线范围" },
};

export async function readPrototypeChartSettings(
  client: Pick<SqliteHttpClient, "getSettings"> = createSqliteHttpClient(),
): Promise<ChartSettings> {
  return client.getSettings();
}

function memoryStorage(): RecallPrototypeStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

export function RecallDesignPrototype({ mode = "recommended" }: { mode?: RecallPrototypeMode }) {
  const [storage, setStorage] = useState<RecallPrototypeStorage>(() => memoryStorage());
  const [storageAvailable, setStorageAvailable] = useState(false);
  // Read the project's existing chart preferences after mount so SSR and the
  // client agree. Prototype interactions stay in React state and never call
  // saveChartSettings, leaving the business settings key untouched.
  const [settings, setSettings] = useState<ChartSettings | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  useEffect(() => {
    if (!isRecallPrototypeStorageAvailable()) return;
    setStorage(window.localStorage);
    setStorageAvailable(true);
  }, []);
  useEffect(() => {
    let active = true;
    void readPrototypeChartSettings()
      .then((next) => {
        if (active) setSettings(next);
      })
      .catch(() => {
        if (active) setSettingsError("当前环境无法读取项目图表设置，样板图表设置暂不可用");
      });
    return () => {
      active = false;
    };
  }, []);
  const fixture = useMemo(() => createRecallPrototypeFixture(mode, storage), [mode, storage]);
  const episodes = useMemo(() => [fixture.episode], [fixture.episode]);
  const instruments = useMemo(() => [fixture.episode.instrument], [fixture.episode.instrument]);
  const candlesByTimeframe = useMemo(() => ({ "1D": fixture.candles }), [fixture.candles]);
  const designPrototype = useMemo(() => ({ mode, safeStageProjection: true as const }), [mode]);
  const [reloadKey, setReloadKey] = useState(0);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [status, setStatus] = useState("本地样板尚未保存");

  const handleEpisodeChange = useCallback(() => undefined, []);
  const handleInstrumentChange = useCallback(() => undefined, []);
  const handleSettingsChange = useCallback((next: ChartSettings) => setSettings(next), []);
  const handleSaved = useCallback(() => {
    const time = new Date();
    setSavedAt(time.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    setStatus(storageAvailable ? "已保存到浏览器本地样板" : "已保存到当前内存样板（刷新不会保留）");
  }, [storageAvailable]);

  const reset = async () => {
    await fixture.repository.reset();
    setSavedAt(null);
    setStatus("已重置本地样板，将从买入前判断重新开始");
    setReloadKey((key) => key + 1);
  };

  return (
    <main className="recall-design-prototype" data-mode={mode}>
      <header className="recall-design-prototype__intro">
        <div>
          <p className="recall-design-prototype__eyebrow">原生复盘样板 · {mode === "recommended" ? "推荐视觉" : "基线视觉"}</p>
          <h1>复盘样板</h1>
        </div>
        <div className="recall-design-prototype__actions" aria-label="样板操作">
          <span role="status">{status}{savedAt ? ` · ${savedAt}` : ""}</span>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)}>重新读取本地样板</button>
          <button type="button" onClick={() => void reset()}>重置样板</button>
        </div>
      </header>
      <p className="recall-design-prototype__storage-note">合成行情 · {storageAvailable ? "浏览器本地保存" : "当前环境仅内存，刷新不会保留"} · 不写入业务交易记录或 SQL。</p>
      {settingsError && <p role="alert" className="recall-design-prototype__storage-note">{settingsError}</p>}

      <div key={reloadKey} className="recall-design-prototype__workspace">
        {settings && <RecallWorkspace
          episode={fixture.episode}
          episodes={episodes}
          instrument={fixture.episode.instrument}
          instruments={instruments}
          timeframeAvailability={availability}
          importedTimelineCandles={fixture.candles}
          candlesByTimeframe={candlesByTimeframe}
          settings={settings}
          repository={fixture.repository}
          designPrototype={designPrototype}
          onEpisodeChange={handleEpisodeChange}
          onInstrumentChange={handleInstrumentChange}
          onSettingsChange={handleSettingsChange}
          onSaved={handleSaved}
        />}
      </div>
    </main>
  );
}
