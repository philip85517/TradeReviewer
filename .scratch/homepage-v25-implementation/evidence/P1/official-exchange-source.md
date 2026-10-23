# Official exchange evidence and finite retention policy

Verified by read-only web access 2026-10-23, before final P1 freeze. Primary sources:

- [SEC company ticker/exchange JSON](https://www.sec.gov/files/company_tickers_exchange.json): fields include cik/name/ticker/exchange; observed AAPL row carries Nasdaq, BRK-B NYSE. P1 accepts explicit Nasdaq/NYSE values, preserves unknown others as unresolved. Limited root-run seed captures only `[320193,"Apple Inc.","AAPL","Nasdaq"]`, parsed by production `parseSecCompanyTickers`; synthetic UNRESOLVED gets no exchange.
- [Nasdaq Symbol Directory Definitions](https://www.nasdaqtrader.com/trader.aspx?id=symboldirdefs): Nasdaq-listed file membership is Nasdaq listing evidence. Other-listed Exchange `N` means NYSE; `P` means NYSE Arca. Other codes are deliberately unsupported rather than relabeled. Being served by Nasdaq alone is not identity evidence.

ResolvedInstrument adds optional `exchange={code,source,resolvedAt}` for US only. Existing records remain valid without it. CN-SH, CN-SZ and HK identities use their explicitly known market; US without a supported official exchange remains unresolved and detail cannot navigate an ambiguous collection.

Name and exchange clocks are separate. A newer name with absent exchange cannot erase trustworthy old evidence. Among supported evidence, later exchange.resolvedAt wins; exact timestamp ties prefer Nasdaq's exchange-owned directory over SEC, then deterministic code order for same-source duplicates. This policy is consistently exercised through resolver cache/result, IndexedDB write/read, SQLite metadata write/read and core instrument upsert. No TTL, provider request, routing, schema or execution behavior changed.

The root seed remains opt-in, requires an explicit allowed isolated absolute database path and matching TRADEREVIEW_DB_PATH, refuses symlinks/default paths, and supports --dry-run without opening a database. Its metadata addition is idempotent and limited to the isolated AAPL record. No business DB was opened by the UI owner.
