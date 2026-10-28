/** Cash remarks identify a stock only through an explicit broker reference. */
export function parseStatementCashIdentity(text: string): { market: string; symbol: string } | undefined {
  if (/基金|期[权權]|\b(?:options?|funds?)\b|\b[A-Z]{1,6}\d{6}[CP]\d{8}\b|\b[A-Z]{2}[A-Z0-9]{9}\d\b/i.test(text)) return undefined;

  const symbols = new Set<string>();
  for (const reference of text.matchAll(/<([A-Z][A-Z0-9-]*)\s+([^<>]*)/gi)) {
    // Unknown exchanges and malformed codes cannot disambiguate a cash row.
    if (!/^(?:HKEX|SEHK)$/i.test(reference[1])) return undefined;
    const code = reference[2].match(/^(\d{1,5})(?=\s|$)/)?.[1];
    if (!code || (/^HKEX$/i.test(reference[1]) && code.length !== 5)) return undefined;
    // Older SEHK statements omit leading zeroes; HKEX's new form is exact.
    symbols.add(code.padStart(5, "0"));
  }
  for (const reference of text.matchAll(/#(\d{5})(?![A-Za-z0-9_])/g)) symbols.add(reference[1]);
  if (symbols.size !== 1) return undefined;
  return { market: "HK", symbol: [...symbols][0] };
}
