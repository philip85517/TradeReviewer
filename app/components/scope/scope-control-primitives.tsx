"use client";

import styles from "./scope-control-primitives.module.css";
import type { KeyboardEvent } from "react";

export type ScopeChoiceOption<Value extends string> = {
  value: Value;
  label: string;
  ariaLabel?: string;
};

type ScopeChoiceBase<Value extends string> = {
  ariaLabel: string;
  value: Value;
  options: readonly ScopeChoiceOption<Value>[];
  onChange: (value: Value) => void;
  className?: string;
  size?: "standard" | "compact";
};

type ScopeChoiceRadioProps<Value extends string> = ScopeChoiceBase<Value> & {
  mode: "radio";
  name: string;
  legend?: string;
};

type ScopeChoiceSegmentedProps<Value extends string> = ScopeChoiceBase<Value> & {
  mode: "segmented";
};

type ScopeChoiceTabsProps<Value extends string> = ScopeChoiceBase<Value> & {
  mode: "tabs";
};

export type ScopeChoiceGroupProps<Value extends string> =
  | ScopeChoiceRadioProps<Value>
  | ScopeChoiceSegmentedProps<Value>
  | ScopeChoiceTabsProps<Value>;

function classes(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function ScopeChoiceGroup<Value extends string>(props: ScopeChoiceGroupProps<Value>) {
  const sizeClass = props.size === "compact" ? styles.compact : styles.standard;

  if (props.mode === "radio") {
    return (
      <fieldset
        className={classes(styles.radioGroup, sizeClass, props.className)}
        aria-label={props.ariaLabel}
        data-control-mode="radio"
        data-control-size={props.size ?? "standard"}
      >
        {props.legend && <span className={styles.radioLegend} aria-hidden="true">{props.legend}</span>}
        <div className={styles.radioOptions}>
          {props.options.map(option => (
            <label className={styles.radioOption} key={option.value}>
              <input
                type="radio"
                name={props.name}
                value={option.value}
                checked={props.value === option.value}
                onChange={() => props.onChange(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  const isTabs = props.mode === "tabs";
  const moveTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!isTabs) return;
    const key = event.key;
    const count = props.options.length;
    if (!count || !["ArrowRight", "ArrowLeft", "Home", "End"].includes(key)) return;
    event.preventDefault();
    const next = key === "Home" ? 0 : key === "End" ? count - 1 : (index + (key === "ArrowRight" ? 1 : -1) + count) % count;
    props.onChange(props.options[next].value);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };
  return (
    <div
      className={classes(styles.segmentedGroup, sizeClass, props.className)}
      role={isTabs ? "tablist" : "group"}
      aria-label={props.ariaLabel}
      data-control-mode={isTabs ? "tabs" : "segmented"}
      data-control-size={props.size ?? "standard"}
    >
      {props.options.map((option, index) => (
        <button
          type="button"
          className={styles.segmentButton}
          key={option.value}
          {...(isTabs
            ? { role: "tab" as const, "aria-selected": props.value === option.value }
            : { "aria-pressed": props.value === option.value })}
          aria-label={option.ariaLabel}
          onClick={() => props.onChange(option.value)}
          {...(isTabs ? { tabIndex: props.value === option.value ? 0 : -1, onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => moveTab(event, index) } : {})}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export type ScopeSelectOption = { value: string; label: string };

export type ScopeSelectProps = {
  label: string;
  ariaLabel: string;
  value: string;
  options: readonly ScopeSelectOption[];
  onChange: (value: string) => void;
  className?: string;
  layout?: "stacked" | "inline";
  fieldId?: "nature" | "account" | "run" | "currency";
  required?: boolean;
};

export function ScopeSelect({
  label,
  ariaLabel,
  value,
  options,
  onChange,
  className,
  layout = "stacked",
  fieldId,
  required = false,
}: ScopeSelectProps) {
  return (
    <label
      className={classes(styles.selectField, layout === "inline" ? styles.inlineField : undefined, className)}
      data-scope-field={fieldId}
    >
      <span>{label}</span>
      <select data-control-size="standard" aria-label={ariaLabel} required={required} value={value} onChange={event => onChange(event.target.value)}>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
