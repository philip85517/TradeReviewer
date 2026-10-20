// Shared fixture for the design preview and the standalone integration module.
// Values mirror the preview's canonical source; renderers derive rows from these totals.
export function deriveFloatingDelta(floatingStart, floatingEnd) {
  if (!Number.isFinite(floatingStart) || !Number.isFinite(floatingEnd)) return null;
  return floatingEnd - floatingStart;
}

export function marketWithFloating(name, realized, floatingStart, floatingEnd) {
  const floating = deriveFloatingDelta(floatingStart, floatingEnd);
  return { name, realized, floatingStart, floatingEnd, floating, total: floating === null ? null : realized + floating };
}

export const floatingDeltaCases = {
  positive: marketWithFloating('正浮盈变化', 100, 20, 170),
  negative: marketWithFloating('负浮盈变化', 100, 170, 20),
  zero: marketWithFloating('零浮盈变化', 100, 80, 80),
  missing: marketWithFloating('缺少必要估值', 100, null, 80)
};

export const contributionFixture = {
  current: {
    subtitle: '当前表现日期 2026-01-01 — 2026-10-15 · 已实现 + 浮盈变化',
    markets: {
      cn: marketWithFloating('A股', 9000, 1000, 4020),
      hk: marketWithFloating('港股', -400, -80, -280),
      us: marketWithFloating('美股', 3640, 1200, 4560)
    }
  },
  historical: {
    subtitle: '历史范围 2026 · 只统计已平仓回合',
    markets: {
      cn: { name: 'A股', total: 12240, realized: 12240, floating: 0 },
      hk: { name: '港股', total: 0, realized: 0, floating: 0 },
      us: { name: '美股', total: 0, realized: 0, floating: 0 }
    }
  },
  mixedSignDemo: [
    { name: '同市场：已实现正 / 浮盈负', realized: 900, floating: -240, total: 660 },
    { name: '同市场：已实现负 / 浮盈正', realized: -900, floating: 240, total: -660 }
  ],
  seeds: {
    cn: [['贵州茅台 / 600519', 6200], ['招商银行 / 600036', 4200], ['中证500ETF / 510500', 2820]],
    hk: [['腾讯控股 / 00700', 4800], ['友邦保险 / 01299', 1]],
    us: [['Tesla / TSLA', 1380], ['Microsoft / MSFT', 1]]
  },
  counts: { long: 50, short: 34, ipo: 12 }
};

// Upstream source demonstrations live outside the contribution panel. The default
// selections preserve the approved fixture; alternate selections only demonstrate
// that the contribution range and result inherit the upstream choice.
export const contributionSources = {
  current: {
    ytd: { label: '当前表现 · 2026-01-01 — 2026-10-15', range: { from: '2026-01-01', to: '2026-10-15', label: '本年 · 当前表现日期 2026-01-01 — 2026-10-15' }, subtitle: '当前表现日期 2026-01-01 — 2026-10-15 · 已实现 + 浮盈变化', markets: contributionFixture.current.markets },
    recent: {
      label: '当前表现 · 最近 90 天（2026-07-17 — 2026-10-15）',
      range: { from: '2026-07-17', to: '2026-10-15', label: '最近 90 天 · 当前表现日期 2026-07-17 — 2026-10-15' },
      subtitle: '当前表现日期 2026-07-17 — 2026-10-15 · 已实现 + 浮盈变化',
      markets: { cn: marketWithFloating('A股', 3400, 500, 1780), hk: marketWithFloating('港股', -120, -40, -100), us: marketWithFloating('美股', 1420, 600, 1940) }
    }
  },
  historical: {
    y2026: { label: '历史已平仓 · 2026', range: { from: '2026-01-01', to: '2026-10-15', label: '历史范围 2026 · 只统计已平仓回合' }, subtitle: '历史范围 2026 · 只统计已平仓回合', markets: contributionFixture.historical.markets },
    y2025: {
      label: '历史已平仓 · 2025',
      range: { from: '2025-01-01', to: '2025-12-31', label: '历史范围 2025 · 只统计已平仓回合' },
      subtitle: '历史范围 2025 · 只统计已平仓回合',
      markets: { cn: { name: 'A股', total: 8420, realized: 8420, floating: 0 }, hk: { name: '港股', total: -260, realized: -260, floating: 0 }, us: { name: '美股', total: 1940, realized: 1940, floating: 0 } }
    }
  }
};

export function getContributionSource(mode, sourceId) {
  const defaults = mode === 'historical' ? 'y2026' : 'ytd';
  return contributionSources[mode][sourceId] ?? contributionSources[mode][defaults];
}
