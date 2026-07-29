"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

export type SearchableInstrument = {
  id: string;
  name: string;
  symbol: string;
  market: string;
};

const BUNDLED_DEMO: SearchableInstrument = {
  id: "demo:XPEV",
  name: "小鹏汽车",
  symbol: "XPEV",
  market: "NYSE",
};

type Props = {
  open: boolean;
  instruments: SearchableInstrument[];
  onClose: () => void;
  onSelectInstrument: (instrumentId: string) => void;
  triggerRef?: RefObject<HTMLElement | null>;
};

export function InstrumentSearchPopover({
  open,
  instruments,
  onClose,
  onSelectInstrument,
  triggerRef,
}: Props) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useMemo(() => {
    const availableInstruments = instruments.length > 0 ? instruments : [BUNDLED_DEMO];
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return availableInstruments;
    return availableInstruments.filter((instrument) =>
      `${instrument.name} ${instrument.symbol}`
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );
  }, [instruments, query]);

  const close = () => {
    onClose();
    triggerRef?.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !popoverRef.current?.contains(target) &&
        !triggerRef?.current?.contains(target)
      ) {
        close();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  });

  if (!open) return null;
  const selectedIndex = Math.min(activeIndex, Math.max(0, results.length - 1));

  const select = (instrument: SearchableInstrument) => {
    onSelectInstrument(instrument.id);
    close();
  };

  return (
    <div className="chart-popover instrument-search-popover" ref={popoverRef} role="dialog" aria-label="搜索标的">
      <input
        ref={inputRef}
        type="search"
        role="searchbox"
        aria-label="搜索标的"
        placeholder="名称或代码"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            close();
          }
          if (event.key === "ArrowDown" && results.length > 0) {
            event.preventDefault();
            setActiveIndex((index) => (index + 1) % results.length);
          }
          if (event.key === "ArrowUp" && results.length > 0) {
            event.preventDefault();
            setActiveIndex((index) => (index - 1 + results.length) % results.length);
          }
          if (event.key === "Enter" && results[selectedIndex]) {
            event.preventDefault();
            select(results[selectedIndex]);
          }
        }}
      />
      <div role="listbox" aria-label="搜索结果">
        {results.length === 0 ? (
          <p className="popover-empty">没有匹配的标的</p>
        ) : (
          results.map((instrument, index) => (
            <button
              className="instrument-search-option"
              key={instrument.id}
              role="option"
              aria-selected={selectedIndex === index}
              onMouseMove={() => setActiveIndex(index)}
              onClick={() => select(instrument)}
            >
              {instrument.name} {instrument.symbol} {instrument.market}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
