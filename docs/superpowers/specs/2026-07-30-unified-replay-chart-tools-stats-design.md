# Unified Replay, Chart Tools, and Position Statistics Design

## Context

The application already contains two different review experiences:

- The deterministic demo uses a replay cursor, `15m` through `1W` period
  switching, position accounting, replay controls, and the first drawing
  tools.
- Imported instruments use real cached daily candles but are restricted to
  `1D` and `1W`, render through a separate static review component, do not
  expose replay controls or drawings, and deliberately disable the right
  review panel.

Several controls in the shared chart toolbar are also visual placeholders:
instrument search, the data badge, layers, fullscreen, settings, and the
compact-screen right-panel trigger have no usable interaction.

This design converges imported and demo instruments on one review workspace,
adds honest intraday availability, completes the in-scope toolbar and drawing
interactions, and gives the right panel cursor-safe position-path statistics
alongside episode notes.

## Goals

- Make real imported instruments usable at `15m`, `1H`, `4H`, `1D`, and `1W`
  when the configured public providers actually cover those intervals.
- Preserve current daily caches and imported trades during the storage
  migration.
- Use one review shell for demo and imported episodes.
- Make instrument search, data details, layers, fullscreen, chart settings,
  and the compact-screen review drawer functional.
- Provide usable chart annotation tools, including separate long and short
  risk/reward tools.
- Show position, path-risk, and plan-comparison statistics calculated only
  from information revealed at the current replay cursor.
- Save drawings, chart preferences, and notes locally at the correct
  instrument and episode scope.

## Non-Goals

- The top-level “模式洞察” navigation remains a later project.
- The application will not invent intraday candles from daily data.
- The application will not promise a fixed amount of intraday history from
  free public endpoints.
- This work does not add real-time quotes, order entry, alerts, broker login,
  cloud synchronization, or investment advice.
- General market discovery is out of scope. Instrument search covers the
  user’s locally imported trade library and the bundled demo.
- This work does not introduce an untrusted third-party drawing-plugin
  marketplace.

## Chosen Approach

Imported and demo instruments will share a single replay workspace. Provider,
storage, replay, position-path metrics, drawing state, and review-note
responsibilities remain separate modules with explicit contracts.

This approach replaces the imported instrument’s static chart/details view
with the same chart shell used by the demo. It avoids maintaining duplicate
toolbars, drawing behavior, and right panels while stopping short of a full
chart-engine rewrite.

## Domain Terms

- **Episode:** A continuous position in one account and instrument, from the
  first non-zero position through the return to zero. An open position has no
  closing timestamp.
- **Knowledge cursor:** The latest timestamp the user has revealed during a
  replay. No chart, execution, metric, drawing, or note-derived result may use
  later information.
- **Native interval:** The interval returned by an external provider and
  stored without synthesizing finer candles.
- **Derived interval:** A coarser interval aggregated from a supported native
  interval.
- **MFE:** The greatest net profit achievable at a favorable candle extreme,
  using the position and realized result known at that candle.
- **MAE:** The smallest net profit, normally the greatest loss, at an adverse
  candle extreme under the same rule.
- **Maximum drawdown:** The largest decline from a previous peak of the
  mark-to-market net-P&L curve to a later trough.
- **Profit giveback:** The positive difference between cursor-to-date MFE and
  net P&L at the current cursor.

## Architecture

### Market data contracts

The daily-only provider contract will become interval-aware without changing
the meaning of existing daily records. A normalized stored candle contains:

- `instrumentId`
- `interval`
- an absolute ISO timestamp
- open, high, low, close, and volume as decimal strings
- currency, provider, provider symbol, adjustment mode, and fetch timestamp

The interval contract distinguishes native data from derived display periods.
Providers expose capabilities and fetch a requested native interval. The
router tries only providers that claim support for the instrument’s market
and interval.

The initial intraday path requests real `15m` candles. `1H` and `4H` are
aggregated from those `15m` candles. `1D` continues to use existing real daily
candles, and `1W` is aggregated from daily candles. The system never aggregates
toward a finer interval.

Provider adapters continue to use Tencent, Eastmoney, and Yahoo public
endpoints under the existing no-key policy. Each adapter:

- parses provider timestamps into absolute timestamps;
- rejects missing or malformed OHLCV values;
- respects provider request-size and history limits through bounded chunks;
- returns an explicit no-data, unsupported-interval, rate-limited, forbidden,
  timeout, or invalid-response result;
- never overwrites valid cached candles with an error response.

Provider availability is empirical and may change. Tests use fixed response
fixtures rather than live public services.

### Interval-aware cache

IndexedDB gains a generic candle store keyed by:

`[instrumentId, interval, timestamp, adjustmentMode]`

Interval coverage is keyed by instrument and native interval and records:

- requested start and end timestamps;
- actual first and last returned timestamps;
- coverage status and reason;
- provider and provider symbol;
- fetch timestamp;
- missing or unavailable sections when they can be identified.

The database upgrade preserves the current daily candle, coverage, provider
symbol, and review stores. Existing daily records remain immediately
readable. A lazy compatibility path copies or exposes daily records through
the interval-aware repository as `1D` records, so users do not need to
re-import trades or re-fetch already cached daily history.

### Required ranges and synchronization

For the selected episode, the application loads cached data first and then
checks coverage in the background.

- Daily coverage continues to use the existing expanded trade range.
- Intraday coverage is requested around the selected episode, including
  enough pre-entry context for chart reading and the entire holding period of
  a closed episode. Cached candles after the knowledge cursor remain hidden.
- An open episode requests through the latest complete market session allowed
  by the provider.

If a public source returns only part of the range, the returned segment is
cached and labeled partial. The UI enables a period only when it has usable
candles for the current episode and shows the exact limitation for unavailable
periods. Daily data is never presented as intraday coverage.

### Replay controller

The selected episode owns one knowledge cursor. The controller receives local
candles and episode executions, but publishes only:

- candles at or before the cursor;
- executions at or before the cursor;
- the position snapshot calculated from those executions;
- cursor-safe path metrics;
- cursor-visible drawings.

Switching period maps the same absolute cursor to the candle containing that
timestamp. It does not reset progress or reveal a later candle. The demo can
continue using its server frame transport; imported episodes use a local
controller over cached provider candles with the same published interface.

When an instrument has multiple episodes, review opens the most recent episode
by default and provides an episode selector. Drawings, notes, cursor state, and
statistics bind to the selected episode rather than the whole instrument.

## Unified Review Workspace

The workspace retains the current three-column desktop structure:

- instrument and episode navigation on the left;
- chart, replay, and drawing tools in the center;
- statistics and notes on the right.

The imported-instrument static detail component no longer owns a separate
chart. The shared center column renders the same period toolbar, position
strip, drawing rail, chart, and replay footer for both imported and demo
episodes. Imported execution details remain available as an episode detail
section or drawer without replacing the replay chart.

### Toolbar interactions

Every in-scope toolbar control has an observable action:

- **Instrument search:** Opens a keyboard-accessible search popover over the
  demo and locally imported instruments. Search matches name or symbol and
  selecting a result opens its most recent episode.
- **Local data:** Opens a data popover showing source, native interval,
  available derived periods, coverage range, last fetch time, limitation
  reason, and an update action.
- **Layers:** Opens the selected episode’s drawing list. Each row supports
  rename, show/hide, lock/unlock, delete, and move up/down.
- **Fullscreen:** Uses the browser Fullscreen API for the review workspace,
  toggles its label and icon while active, and exits through `Esc` or the same
  control.
- **Chart settings:** Opens a popover for grid visibility, volume visibility,
  execution markers, average-cost line, and candle color scheme. Preferences
  persist locally.
- **Compact review panel:** At narrow widths, opens the right panel as a
  modal drawer and restores focus to the trigger when closed.

A control that cannot operate is disabled and exposes a concise reason. For
example, layers are disabled when there are no drawings, and fullscreen is
disabled when the browser does not expose the Fullscreen API. The application
does not leave clickable placeholder controls.

## Drawing System

The in-scope toolbar exposes:

- cursor/crosshair;
- trend line;
- horizontal line;
- vertical line;
- rectangle;
- arrow;
- price label;
- free text;
- range measurement;
- long risk/reward;
- short risk/reward;
- lock all, undo, redo, and clear unlocked drawings.

Each drawing has a stable ID, type and version, episode ID, anchors, style,
text or label data, z-order, hidden and locked flags, visible periods,
creation stage, and knowledge timestamp.

User interaction supports:

- click or drag creation according to the tool’s anchor contract;
- selection and visible handles;
- dragging an unlocked drawing or individual anchor;
- direct text entry after placing a text drawing;
- deletion, hiding, locking, renaming, and z-order changes through layers;
- undo and redo across create, move, rename, style, visibility, lock, order,
  and delete commands;
- absolute time/price reprojection when the display period changes.

The two risk/reward tools use entry, stop, and target anchors. They display
risk distance and percentage, reward distance and percentage, and R multiple.
When a planned risk amount exists, they also display potential currency risk,
potential reward, and suggested quantity. They are planning aids and do not
create orders or alter actual trade history.

Every created or moved anchor is clamped to the knowledge cursor. A future
drawing cannot appear through the layer list, undo history, period switching,
or persistence restoration.

Drawing state persists under the episode. Existing demo drawings remain
compatible with the demo review key.

## Right Panel

The right panel has two tabs:

- `持仓统计`, selected by default;
- `复盘笔记`.

### Position statistics

The statistics tab contains:

1. **Current state**
   - quantity;
   - average cost;
   - elapsed calendar holding time;
   - realized, unrealized, and net P&L;
   - return percentage;
   - fees.
2. **Path risk**
   - MFE;
   - MAE;
   - maximum drawdown;
   - profit giveback.
3. **Plan comparison**
   - planned risk amount;
   - current or final R multiple;
   - invalidation condition;
   - target range.

Position state is reconstructed in timestamp order with decimal arithmetic.
For each candle, executions that are known by that timestamp determine the
position, average cost, realized P&L, and fees. The favorable candle extreme
drives the MFE candidate and the adverse extreme drives the MAE candidate,
with direction reversed for a short position.

The mark-to-market net-P&L curve uses candle closes and already realized P&L.
Maximum drawdown is the largest peak-to-later-trough decline on that curve.
Profit giveback is `max(0, MFE - currentNetPnl)`.

Amount metrics use the instrument currency. Percentage path metrics divide by
the maximum gross capital deployed up to the cursor. When the denominator is
zero, the UI shows that the metric is unavailable instead of displaying a
misleading zero.

Partial entries, partial exits, position increases, and short episodes use the
same event-driven calculation. Empty, pre-entry, missing-candle, and
insufficient-coverage states show a specific explanation.

### Episode notes

Notes reuse the existing episode-review record instead of creating a second
note model. The panel edits:

- thesis;
- expected path;
- invalidation condition;
- target range;
- planned risk amount;
- confidence;
- decision and execution quality;
- risk management;
- psychology;
- reusable rule;
- confirmed tags and completion status.

Changes autosave locally after a short debounce. The panel exposes saving,
saved, validation-error, and storage-error states. Switching instrument or
episode flushes a valid pending save and never reuses another episode’s draft.

## Future-Information Boundary

At every cursor position, the following are restricted to knowledge at or
before the cursor:

- visible candles and crosshair values;
- execution markers and execution details;
- position, P&L, MFE, MAE, drawdown, giveback, and R multiple;
- available drawing anchors, layer rows, and undo/redo state;
- any note-derived plan comparison.

Complete episode statistics may be shown only after the replay reaches the
episode end. Cached future data may exist in IndexedDB but must not enter the
published replay view.

## Error Handling

- **Network failure with cache:** Continue from cache and show its end time and
  stale or partial state.
- **Unavailable public history:** Disable affected periods and show the
  provider’s actual coverage limitation.
- **Malformed provider response:** Reject the response, keep valid cache, and
  record an invalid-response status.
- **Rate limit or access refusal:** Do not loop or bypass controls. Keep cache
  and offer a later manual retry.
- **IndexedDB read failure:** Keep the workspace stable and explain which data
  could not be restored.
- **IndexedDB write failure:** Retain the current in-memory edit and show that
  it was not persisted.
- **Drawing validation failure:** Keep the active tool selected and explain
  the invalid anchor geometry without creating a partial drawing.
- **Unsupported browser API:** Disable the related control with a reason.

## Testing Strategy

### Market data

- Provider parser tests cover valid intraday responses, timestamps, null
  values, changed shapes, no-data responses, and request chunk boundaries.
- Router tests cover market/interval capability selection and fallback.
- Repository tests upgrade an existing version-2 database and verify that
  daily candles, coverage, provider symbols, reviews, and imported trades
  remain available.
- Aggregation tests cover `15m` to `1H` and `4H`, daily to weekly, market
  session boundaries, gaps, ordering, and the prohibition on finer synthetic
  periods.

### Replay and metrics

- Tests cover closed and open long episodes, short episodes, scaled entries,
  partial exits, position reversal boundaries, fees, and empty positions.
- MFE and MAE tests exercise favorable and adverse intrabar extremes.
- Drawdown and giveback tests use known P&L paths with exact expected peaks
  and troughs.
- Cursor-boundary tests iterate through replay positions and assert that no
  later candle, execution, drawing, or completed metric is published.
- Period-switch tests assert that the absolute knowledge cursor is unchanged.

### Components and drawings

- Workspace tests cover instrument search, episode selection, period
  availability reasons, cache status, replay controls, and imported/demo
  parity.
- Toolbar tests cover data details, layer operations, fullscreen transitions,
  persisted settings, disabled reasons, keyboard dismissal, and focus return.
- Compact-layout tests cover opening and closing the right drawer.
- Drawing contract tests cover creation, anchor editing, locking, hiding,
  deleting, ordering, undo/redo, persistence, and cross-period reprojection
  for every in-scope tool.
- Risk/reward tests cover long, short, zero-risk rejection, percentages, R
  multiple, risk amount, reward amount, and suggested quantity.
- Note tests cover episode isolation, autosave, validation, pending-save
  flushing, and storage failure.

No provider test depends on a live external service.

## Acceptance Criteria

- A real imported episode uses the shared replay chart and no longer renders a
  separate non-interactive chart experience.
- `15m`, `1H`, and `4H` become available only from real cached intraday data;
  `1D` and `1W` continue to work from real daily data.
- Period switching preserves the knowledge cursor.
- Instrument search, data details, layers, fullscreen, chart settings, and the
  compact right-panel trigger have tested observable behavior.
- All listed drawing tools create editable, persistent, cursor-safe drawings
  on imported and demo episodes.
- The right panel shows cursor-safe current state, MFE, MAE, maximum drawdown,
  profit giveback, and plan comparison alongside episode-scoped notes.
- Existing imported executions in browser storage and existing daily market
  data and review records in IndexedDB remain available after the database
  upgrade.
- Unit tests, type checking, linting, production build, and rendered-HTML
  smoke tests complete successfully before delivery.
