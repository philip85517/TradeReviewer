# Running prototype visual implementation

- Scope: only `running-prototype.css` and this record; no TSX, globals, API, or database changes.
- References reviewed: `running-visual-contract.md` W01-W06, running coverage rows in `DESIGN-COVERAGE.md`, and the 1440 creation baseline plus history/preview reference screenshots.
- Layout: `.running-prototype` is a scoped flex child beside the shared app rail, with `flex:1`, `min-width:0`, `min-height:0`, `height:100dvh`, and its own scroll container.
- Visuals: TradeReview dark cards, blue primary controls, 360px desktop chart, 280px narrow chart, summary cards, holdings/events side rail, and 36px desktop / 44px narrow controls.
- Breakpoint: desktop rail remains active at 760px; running content stacks at `max-width:759px` without page-level horizontal overflow.
- Validation: static CSS review completed; independent browser visual and journey acceptance remains with the coordinator.
- Integration follow-up: styled the current owner’s `running-header-actions`, `running-history`, `running-warning`, `running-config`, `running-event-trades`, and chart symbol select. History controls wrap on narrow screens, warnings stay compact below the chart, details use readable line height, and all narrow controls are 44px.
- Final narrow-layout correction: increased header action specificity so both return buttons are 44px at 390px; desktop grid uses `align-items:start` to prevent event-side content from stretching the chart card, with mobile stacking restored.
