"use client";

import { useEffect, useRef, type RefObject } from "react";

import type { ChartSettings } from "../../lib/storage/chart-settings";

type Props = {
  open: boolean;
  settings: ChartSettings;
  onClose: () => void;
  onSettingsChange: (settings: ChartSettings) => void;
  triggerRef?: RefObject<HTMLElement | null>;
};

const toggles: Array<{ key: keyof Pick<ChartSettings, "showGrid" | "showVolume" | "showExecutions" | "showAverageCost">; label: string }> = [
  { key: "showGrid", label: "显示网格" },
  { key: "showVolume", label: "显示成交量" },
  { key: "showExecutions", label: "显示成交记录" },
  { key: "showAverageCost", label: "显示平均成本" },
];

export function ChartSettingsPopover({
  open,
  settings,
  onClose,
  onSettingsChange,
  triggerRef,
}: Props) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const close = () => {
    onClose();
    triggerRef?.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!popoverRef.current?.contains(target) && !triggerRef?.current?.contains(target)) {
        close();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  });

  if (!open) return null;
  return (
    <div className="chart-popover chart-settings-popover" ref={popoverRef} role="dialog" aria-label="图表设置">
      <strong>图表设置</strong>
      {toggles.map(({ key, label }) => (
        <label className="settings-toggle" key={key}>
          <input
            type="checkbox"
            checked={settings[key]}
            onChange={() => onSettingsChange({ ...settings, [key]: !settings[key] })}
          />
          {label}
        </label>
      ))}
    </div>
  );
}
