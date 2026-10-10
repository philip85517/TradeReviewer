export type CurrencyMarker = "circle" | "diamond" | "square";

export type CurrencyPresentation = {
  color: string;
  marker: CurrencyMarker;
  label: string;
};

const KNOWN_CURRENCIES = ["CNY", "HKD", "USD"] as const;

export const CURRENCY_PRESENTATION: Record<string, CurrencyPresentation> = {
  CNY: { color: "#00d5b6", marker: "circle", label: "CNY" },
  HKD: { color: "#b76be7", marker: "diamond", label: "HKD" },
  USD: { color: "#78a8ff", marker: "square", label: "USD" },
};

export function normalizeCurrency(currency: string): string {
  return currency.trim().toUpperCase();
}

/** Keep the three dashboard currencies visually and semantically stable. */
export function orderCurrencies(currencies: Iterable<string>): string[] {
  const normalized = [...new Set([...currencies].map(normalizeCurrency).filter(Boolean))];
  return [
    ...KNOWN_CURRENCIES.filter(currency => normalized.includes(currency)),
    ...normalized.filter(currency => !KNOWN_CURRENCIES.includes(currency as typeof KNOWN_CURRENCIES[number])).sort(),
  ];
}

export function currencyPresentation(currency: string): CurrencyPresentation {
  const normalized = normalizeCurrency(currency);
  return CURRENCY_PRESENTATION[normalized] ?? {
    color: "#94a3b8",
    marker: "circle",
    label: normalized || currency,
  };
}
