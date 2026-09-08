export const FUTU_WORKBOOK_PROFILE_ID = "futu/xlsx/trades-v1";
export const FUTU_TRADE_SHEET = "证券-交易流水";

export const FUTU_REQUIRED_HEADERS = [
  "成交时间",
  "账户名称",
  "账户号码",
  "品类",
  "代码名称",
  "交易所/市场",
  "方向",
  "币种",
  "数量/面值",
  "价格",
  "总费用",
] as const;

export type FutuWorkbookField = (typeof FUTU_REQUIRED_HEADERS)[number];
export type FutuWorkbookHeaderMap = Record<FutuWorkbookField, string>;

/** Normalize presentation-only differences without guessing a changed field meaning. */
export function normalizeWorkbookLabel(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[‐‑‒–—―－]/g, "-")
    .replace(/\s+/g, "")
    .trim();
}

export function resolveFutuTradeSheetName(
  sheetNames: readonly string[],
): string | undefined {
  const expected = normalizeWorkbookLabel(FUTU_TRADE_SHEET);
  return sheetNames.find((sheetName) => normalizeWorkbookLabel(sheetName) === expected);
}

export function resolveFutuWorkbookHeaders(
  headers: readonly unknown[],
): { map?: FutuWorkbookHeaderMap; missing: FutuWorkbookField[] } {
  const byNormalized = new Map(
    FUTU_REQUIRED_HEADERS.map((header) => [normalizeWorkbookLabel(header), header] as const),
  );
  const found = new Map<FutuWorkbookField, string>();
  for (const header of headers) {
    const raw = String(header ?? "");
    const field = byNormalized.get(normalizeWorkbookLabel(raw));
    if (field && !found.has(field)) found.set(field, raw);
  }
  const missing = FUTU_REQUIRED_HEADERS.filter((header) => !found.has(header));
  if (missing.length > 0) return { missing };
  return { map: Object.fromEntries(found) as FutuWorkbookHeaderMap, missing: [] };
}

export function canonicalizeFutuWorkbookRow(
  row: Record<string, unknown>,
  map: FutuWorkbookHeaderMap,
): Record<string, unknown> {
  return Object.fromEntries(
    FUTU_REQUIRED_HEADERS.map((field) => [field, row[map[field]] ?? ""]),
  );
}
