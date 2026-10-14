"use client";

import { useMemo, useState } from "react";

import type { MarketDataSyncStatus } from "../../lib/market/sync-status";
import type {
  GlobalNotification,
  GlobalSearchResult,
  GlobalEntryScope,
} from "../../lib/reviews/trading-room-global-entries";
import type { RoomFxSnapshot } from "../../lib/reviews/trading-room-scope";
import { RoomHoldingsFxProvenance } from "../dashboard/room-holdings-fx-provenance";
import {
  TradingRoomGlobalSearch,
  TradingRoomGlobalUtilities,
} from "../dashboard/trading-room-global-tools";
import { UnifiedPageHeader } from "../workspace/unified-page-header";
import { buildInstrumentTradeSummaries } from "../../lib/trades/instruments";
import { buildTradeLibraryEntries, type TradeLibraryEntry } from "../../lib/trades/library";
import type { Instrument, TradeExecution } from "../../lib/trades/types";

import styles from "./part-a-component-states.module.css";

type FixtureStatus = "loading" | "error" | "ready";

type NotificationFixture = {
  id: string;
  label: string;
  entries: readonly TradeLibraryEntry[];
  marketDataStatuses: Readonly<Record<string, MarketDataSyncStatus | undefined>>;
  status: FixtureStatus;
};

type SearchFixture = {
  id: string;
  label: string;
  entries: readonly TradeLibraryEntry[];
  status: FixtureStatus;
};

type FxFixture = {
  id: string;
  label: string;
  snapshot: RoomFxSnapshot;
  currencies: readonly string[];
};

const liveScope: GlobalEntryScope = {
  nature: "live",
  accountIds: [],
  simulationRunId: null,
};

function fixtureExecution(index: number, prefix: string, instrument: Instrument): TradeExecution {
  const day = String((index % 27) + 1).padStart(2, "0");
  return {
    id: `${prefix}:execution:${index + 1}`,
    accountId: `${prefix}:account`,
    accountLabel: "Part A 样板账户",
    instrument,
    side: "buy",
    executedAt: `2026-09-${day}T09:30:00+08:00`,
    quantity: "100",
    price: "10.25",
    fee: "0",
    source: {
      platform: "part-a-design-fixture",
      row: index + 1,
      tradeNature: "live",
      tradingDate: `2026-09-${day}`,
    },
  };
}

function buildFixtureEntries(
  count: number,
  prefix: string,
  nameFor: (index: number) => Pick<Instrument, "symbol" | "name" | "market" | "currency">,
): TradeLibraryEntry[] {
  const executions = Array.from({ length: count }, (_, index) => {
    const details = nameFor(index);
    const instrument: Instrument = {
      id: `${details.market}:${details.symbol}`,
      ...details,
    };
    return fixtureExecution(index, prefix, instrument);
  });

  return buildTradeLibraryEntries(
    buildInstrumentTradeSummaries(executions),
    {},
    {},
  );
}

function partialMarketDataFor(entries: readonly TradeLibraryEntry[]): Readonly<Record<string, MarketDataSyncStatus>> {
  return Object.fromEntries(entries.map(entry => [entry.instrument.id, "partial" as const]));
}

const bellEntries = buildFixtureEntries(100, "bell", index => ({
  symbol: `B${String(index + 1).padStart(4, "0")}`,
  name: `通知样板 ${index + 1}`,
  market: index % 2 === 0 ? "US" : "HK",
  currency: index % 2 === 0 ? "USD" : "HKD",
}));

const notificationFixtures: readonly NotificationFixture[] = [
  {
    id: "bell-0",
    label: "ready · 0",
    entries: bellEntries.slice(0, 0),
    marketDataStatuses: {},
    status: "ready",
  },
  {
    id: "bell-1",
    label: "ready · 1",
    entries: bellEntries.slice(0, 1),
    marketDataStatuses: partialMarketDataFor(bellEntries.slice(0, 1)),
    status: "ready",
  },
  {
    id: "bell-99",
    label: "ready · 99",
    entries: bellEntries.slice(0, 99),
    marketDataStatuses: partialMarketDataFor(bellEntries.slice(0, 99)),
    status: "ready",
  },
  {
    id: "bell-99-plus",
    label: "ready · 99+（100）",
    entries: bellEntries,
    marketDataStatuses: partialMarketDataFor(bellEntries),
    status: "ready",
  },
  {
    id: "bell-loading",
    label: "loading · 读取中",
    entries: bellEntries.slice(0, 1),
    marketDataStatuses: partialMarketDataFor(bellEntries.slice(0, 1)),
    status: "loading",
  },
  {
    id: "bell-error",
    label: "error · 读取失败",
    entries: bellEntries.slice(0, 1),
    marketDataStatuses: partialMarketDataFor(bellEntries.slice(0, 1)),
    status: "error",
  },
];

const searchEntries = buildFixtureEntries(2, "search", index => index === 0
  ? {
      symbol: "0005",
      name: "汇丰控股",
      market: "HK",
      currency: "HKD",
    }
  : {
      symbol: "600519",
      name: "贵州茅台",
      market: "CN",
      currency: "CNY",
    });

const searchFixtures: readonly SearchFixture[] = [
  { id: "search-ready", label: "ready · 中文结果", entries: searchEntries, status: "ready" },
  { id: "search-loading", label: "loading · 读取中", entries: [], status: "loading" },
  { id: "search-error", label: "error · 读取失败", entries: [], status: "error" },
];

const sameDateSnapshot: RoomFxSnapshot = {
  id: "part-a:fx:same-date",
  baseCurrency: "CNY",
  asOf: "2026-09-19T10:30:00+08:00",
  source: "BOC",
  status: "complete",
  rates: { "USD/CNY": "6.7521", "HKD/CNY": "0.8606" },
  publishedAt: "2026-09-19T10:30:00+08:00",
  publishedAtByCurrency: {
    USD: "2026-09-19T10:30:00+08:00",
    HKD: "2026-09-19T10:30:00+08:00",
  },
  fetchedAt: "2026-09-19T03:00:00.000Z",
};

const fxFixtures: readonly FxFixture[] = [
  {
    id: "fx-same-date",
    label: "同日 · USD/HKD",
    snapshot: sameDateSnapshot,
    currencies: ["CNY", "USD", "HKD"],
  },
  {
    id: "fx-split-dates",
    label: "不同日 · 分币种日期",
    snapshot: {
      ...sameDateSnapshot,
      id: "part-a:fx:split-dates",
      publishedAtByCurrency: {
        USD: "2026-09-19T10:30:00+08:00",
        HKD: "2026-09-18T10:30:00+08:00",
      },
    },
    currencies: ["USD", "HKD"],
  },
  {
    id: "fx-fetched-only",
    label: "仅获取时间 · 无发布日期",
    snapshot: {
      ...sameDateSnapshot,
      id: "part-a:fx:fetched-only",
      asOf: "2026-09-19T03:00:00.000Z",
      publishedAt: null,
      publishedAtByCurrency: {},
      fetchedAt: "2026-09-19T03:00:00.000Z",
    },
    currencies: ["USD"],
  },
  {
    id: "fx-partial-missing",
    label: "partial · HKD/EUR 缺失",
    snapshot: {
      ...sameDateSnapshot,
      id: "part-a:fx:partial-missing",
      status: "partial",
      rates: { "USD/CNY": "6.7521" },
      publishedAtByCurrency: { USD: "2026-09-19T10:30:00+08:00" },
    },
    currencies: ["USD", "HKD", "EUR"],
  },
  {
    id: "fx-all-missing",
    label: "missing · 全部缺失",
    snapshot: {
      ...sameDateSnapshot,
      id: "part-a:fx:all-missing",
      status: "missing",
      rates: {},
      publishedAt: null,
      publishedAtByCurrency: {},
    },
    currencies: ["USD", "HKD"],
  },
  {
    id: "fx-cny-only",
    label: "仅 CNY · 不显示换算说明",
    snapshot: sameDateSnapshot,
    currencies: ["CNY", "人民币"],
  },
  {
    id: "fx-long-precision",
    label: "长小数 · 保留来源精度",
    snapshot: {
      ...sameDateSnapshot,
      id: "part-a:fx:long-precision",
      rates: {
        "USD/CNY": "6.7521000000000001",
        "HKD/CNY": "0.8606000000000001",
      },
    },
    currencies: ["USD", "HKD"],
  },
];

function fixtureLabel(id: string, label: string): string {
  return `${id} · ${label}`;
}

export function PartAComponentStates() {
  const [bellFixtureId, setBellFixtureId] = useState(notificationFixtures[0].id);
  const [searchFixtureId, setSearchFixtureId] = useState(searchFixtures[0].id);
  const [fxFixtureId, setFxFixtureId] = useState(fxFixtures[0].id);
  const [selectedCallback, setSelectedCallback] = useState("尚未触发回调");

  const bellFixture = useMemo(
    () => notificationFixtures.find(fixture => fixture.id === bellFixtureId) ?? notificationFixtures[0],
    [bellFixtureId],
  );
  const searchFixture = useMemo(
    () => searchFixtures.find(fixture => fixture.id === searchFixtureId) ?? searchFixtures[0],
    [searchFixtureId],
  );
  const fxFixture = useMemo(
    () => fxFixtures.find(fixture => fixture.id === fxFixtureId) ?? fxFixtures[0],
    [fxFixtureId],
  );

  const showNotification = (item: GlobalNotification) => {
    setSelectedCallback(`notification:${bellFixture.id}:${item.id}`);
  };
  const showSearchResult = (result: GlobalSearchResult) => {
    setSelectedCallback(`search:${searchFixture.id}:${result.instrumentId}`);
  };

  return (
    <div className={`trade-review-app ${styles.fixtureApp}`}>
      <div className={`workspace dashboard-mode ${styles.fixtureWorkspace}`}>
        <section className={styles.fixtureRoom} aria-label="我的交易室">
          <main className={styles.root}>
            <header className={styles.intro}>
              <div>
                <p className={styles.eyebrow}>PAV26 · PART A COMPONENT STATES</p>
                <h1>控件、通知、搜索与汇率说明状态样板</h1>
                <p className={styles.lede}>
                  只读固定 fixture。每个区域直接挂载现有产品组件；回调只把选中的 fixture ID 写入本页状态，不写网络或数据库。
                </p>
              </div>
              <a className={styles.homeLink} href="/">返回真实首页</a>
            </header>

            <div className={styles.matrix}>
              <section className={styles.panel} aria-labelledby="part-a-bell-heading">
                <div className={styles.panelHeader}>
                  <div>
                    <p className={styles.kicker}>PA-E01 · 待处理事项入口</p>
                    <h2 id="part-a-bell-heading">实际通知与本地用户工具</h2>
                  </div>
                  <label className={styles.fixturePicker}>
                    <span>固定 fixture</span>
                    <select value={bellFixture.id} onChange={event => setBellFixtureId(event.target.value)}>
                      {notificationFixtures.map(fixture => (
                        <option key={fixture.id} value={fixture.id}>
                          {fixtureLabel(fixture.id, fixture.label)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className={styles.helper}>
                  {bellFixture.status === "ready"
                    ? `${bellFixture.label}；待处理数量由实际通知 builder 生成（输入 ${bellFixture.entries.length} 个已导入标的与 partial 行情状态）。`
                    : `${bellFixture.label}；通知数量不可用：${bellFixture.status === "loading" ? "正在读取当前身份" : "当前身份读取失败"}。`}
                </p>
                <div className={styles.fixtureSurface}>
                  <UnifiedPageHeader
                    title="我的交易室"
                    description="固定通知状态"
                    status={<span className={styles.fixtureIdentityStatus} aria-hidden="true" />}
                    scopeControls={<span className={styles.fixtureContextLabel}>固定 live scope</span>}
                    globalTools={<TradingRoomGlobalUtilities
                      key={bellFixture.id}
                      entries={bellFixture.entries}
                      scope={liveScope}
                      status={bellFixture.status}
                      marketDataStatuses={bellFixture.marketDataStatuses}
                      onOpenNotification={showNotification}
                      onOpenAccountAndCurrency={() => setSelectedCallback(`account-menu:${bellFixture.id}`)}
                    />}
                  />
                </div>
              </section>

              <section className={styles.panel} aria-labelledby="part-a-search-heading">
                <div className={styles.panelHeader}>
                  <div>
                    <p className={styles.kicker}>PA-E02 · 搜索标的</p>
                    <h2 id="part-a-search-heading">实际搜索、中文结果与清除/键盘路径</h2>
                  </div>
                  <label className={styles.fixturePicker}>
                    <span>固定 fixture</span>
                    <select value={searchFixture.id} onChange={event => setSearchFixtureId(event.target.value)}>
                      {searchFixtures.map(fixture => (
                        <option key={fixture.id} value={fixture.id}>
                          {fixtureLabel(fixture.id, fixture.label)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className={styles.helper}>输入“汇丰”可得到完整中文标的；实际组件负责 focus、清除、Enter、Escape 和候选展开。</p>
                <div className={`${styles.fixtureSurface} ${styles.searchSurface}`}>
                  <UnifiedPageHeader
                    title="我的交易室"
                    description="固定搜索状态"
                    scopeControls={<span className={styles.fixtureContextLabel}>固定 live scope</span>}
                    scopeTools={<TradingRoomGlobalSearch
                      key={searchFixture.id}
                      entries={searchFixture.entries}
                      scope={liveScope}
                      status={searchFixture.status}
                      onOpenSearchResult={showSearchResult}
                    />}
                  />
                </div>
              </section>

              <section className={`${styles.panel} ${styles.fxPanel}`} aria-labelledby="part-a-fx-heading" aria-label="持仓照看">
                <div className={styles.panelHeader}>
                  <div>
                    <p className={styles.kicker}>PA-E03 · 汇率来源说明</p>
                    <h2 id="part-a-fx-heading">实际持仓汇率来源与缺口</h2>
                  </div>
                  <label className={styles.fixturePicker}>
                    <span>固定 fixture</span>
                    <select value={fxFixture.id} onChange={event => setFxFixtureId(event.target.value)}>
                      {fxFixtures.map(fixture => (
                        <option key={fixture.id} value={fixture.id}>
                          {fixtureLabel(fixture.id, fixture.label)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className={styles.helper}>
                  固定数据：{fxFixture.id}；币种输入 {fxFixture.currencies.join("、")}。日期、来源、每个实际汇率和缺失原因由组件直接输出。
                </p>
                <div className={styles.fixtureSurface}>
                  <RoomHoldingsFxProvenance snapshot={fxFixture.snapshot} currencies={fxFixture.currencies} />
                  {fxFixture.currencies.every(currency => ["CNY", "人民币"].includes(currency)) && (
                    <p className={styles.emptyFx}>CNY-only fixture：无外币，不渲染 FX 说明。</p>
                  )}
                </div>
              </section>
            </div>

            <aside className={styles.callbackReadout} aria-live="polite">
              <span>最近一次只读回调</span>
              <strong>{selectedCallback}</strong>
            </aside>
          </main>
        </section>
      </div>
    </div>
  );
}
