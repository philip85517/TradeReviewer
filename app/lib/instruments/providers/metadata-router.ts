import {
  validateResolvedInstrument,
  validateLocalizedInstrumentName,
  type InstrumentLookup,
  type InstrumentMetadataFailure,
  type ResolvedInstrument,
} from "../metadata-contracts";
import { composeAbortSignals } from "../abort-signal";
import {
  METADATA_DEADLINE_GUARD_MS,
  METADATA_REQUEST_TIMEOUT_MS,
  OPTIONAL_LOCALIZATION_MAX_TIMEOUT_MS,
} from "../metadata-timeouts";
import { EastmoneyMetadataProvider } from "./eastmoney-metadata";
import { HkexDirectoryProvider } from "./hkex-directory";
import {
  InstrumentMetadataProviderError,
  type InstrumentMetadataProvider,
  type InstrumentMetadataProviderErrorCode,
} from "./metadata-errors";
import { NasdaqDirectoryProvider } from "./nasdaq-directory";
import { SecCompanyTickersProvider } from "./sec-company-tickers";
import { SinaMetadataProvider } from "./sina-metadata";
import { TencentMetadataProvider } from "./tencent-metadata";

type SupportedMarket = InstrumentLookup["market"];
type ProviderOverrides = Partial<
  Record<SupportedMarket, InstrumentMetadataProvider[]>
>;

export type InstrumentMetadataRouter = {
  resolve(
    lookup: InstrumentLookup,
    signal?: AbortSignal,
  ): Promise<ResolvedInstrument>;
};

const ERROR_PRIORITY: readonly InstrumentMetadataProviderErrorCode[] = [
  "source-rate-limited",
  "source-forbidden",
  "invalid-response",
  "source-timeout",
  "source-unavailable",
  "no-data",
];

const SAFE_MESSAGES: Record<InstrumentMetadataProviderErrorCode, string> = {
  "source-rate-limited": "请求受限",
  "source-forbidden": "拒绝访问",
  "source-timeout": "请求超时",
  "source-unavailable": "暂时不可用",
  "invalid-response": "响应无效",
  "no-data": "未找到证券",
};

const HAN_CHARACTER = /\p{Script=Han}/u;

export class InstrumentMetadataResolutionError extends Error {
  constructor(
    readonly code: InstrumentMetadataProviderErrorCode,
    readonly failure: InstrumentMetadataFailure,
  ) {
    super(
      code === "no-data" ? "未找到该股票或 ETF" : "证券元数据暂时无法解析",
    );
    this.name = "InstrumentMetadataResolutionError";
  }
}

function defaultProviderOrder(
  fetcher: typeof fetch,
  clock: () => number,
): Record<SupportedMarket, InstrumentMetadataProvider[]> {
  const tencent = new TencentMetadataProvider();
  const eastmoney = new EastmoneyMetadataProvider();
  const sina = new SinaMetadataProvider();
  const nasdaq = new NasdaqDirectoryProvider({ fetcher, now: clock });
  const hkex = new HkexDirectoryProvider({ fetcher, now: clock });
  const sec = new SecCompanyTickersProvider({ fetcher, now: clock });

  return {
    "CN-SH": [tencent, eastmoney, sina],
    "CN-SZ": [tencent, eastmoney, sina],
    HK: [hkex, tencent, eastmoney, sina],
    US: [nasdaq, tencent, sec, sina],
  };
}

function safeAttempt(
  provider: InstrumentMetadataProvider,
  error: unknown,
): InstrumentMetadataFailure["attempts"][number] {
  const code =
    error instanceof InstrumentMetadataProviderError
      ? error.code
      : "source-unavailable";
  return {
    source: provider.id,
    code,
    message: `${provider.id} ${SAFE_MESSAGES[code]}`,
  };
}

function selectedErrorCode(
  attempts: InstrumentMetadataFailure["attempts"],
): InstrumentMetadataProviderErrorCode {
  return (
    ERROR_PRIORITY.find((code) =>
      attempts.some((attempt) => attempt.code === code),
    ) ?? "no-data"
  );
}

function throwIfChainAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return;
  throw (
    signal.reason ??
    new InstrumentMetadataProviderError(
      "source-timeout",
      "证券元数据请求已终止",
    )
  );
}

function hasChineseName(name: string) {
  return HAN_CHARACTER.test(name);
}

function withPrimaryLocalizedName(
  primary: ResolvedInstrument,
  market: InstrumentLookup["market"],
): ResolvedInstrument {
  if (
    primary.localizedName ||
    (market !== "US" && market !== "HK") ||
    !hasChineseName(primary.name)
  ) {
    return primary;
  }
  return {
    ...primary,
    localizedName: validateLocalizedInstrumentName({
      name: primary.name,
      locale: "zh-CN",
      source: primary.source,
      resolvedAt: primary.resolvedAt,
    }),
  };
}

async function resolveOptionalLocalization(
  provider: InstrumentMetadataProvider,
  lookup: InstrumentLookup,
  fetcher: typeof fetch,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<ResolvedInstrument> {
  const optionalController = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      const timeoutError = new InstrumentMetadataProviderError(
        "source-timeout",
        "中文证券名称请求超时",
      );
      optionalController.abort(timeoutError);
      reject(
        timeoutError,
      );
    }, timeoutMs);
  });
  const optionalFetcher: typeof fetch = (input, init) =>
    fetcher(input, {
      ...init,
      signal: composeAbortSignals(
        optionalController.signal,
        signal,
        init?.signal,
      ),
    });
  try {
    return await Promise.race([
      provider.resolve(lookup, optionalFetcher),
      timeoutPromise,
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function createMetadataRouter(
  fetcher: typeof fetch = fetch,
  clock: () => number = Date.now,
  overrides: ProviderOverrides = {},
): InstrumentMetadataRouter {
  const defaults = defaultProviderOrder(fetcher, clock);
  const providers = {
    ...defaults,
    ...overrides,
  };

  return {
    async resolve(lookup, signal) {
      const attempts: InstrumentMetadataFailure["attempts"] = [];
      const deadlineAt = clock() + METADATA_REQUEST_TIMEOUT_MS;
      for (const provider of providers[lookup.market]) {
        throwIfChainAborted(signal);
        if (!provider.supports(lookup)) continue;
        let resolved: ResolvedInstrument;
        try {
          resolved = await provider.resolve(lookup, fetcher);
        } catch (error) {
          throwIfChainAborted(signal);
          attempts.push(safeAttempt(provider, error));
          continue;
        }
        throwIfChainAborted(signal);
        try {
          const primary = withPrimaryLocalizedName(
            validateResolvedInstrument(resolved, lookup),
            lookup.market,
          );
          if (
            (lookup.market !== "US" && lookup.market !== "HK") ||
            primary.localizedName
          ) {
            return primary;
          }

          const localizedProvider = providers[lookup.market].find(
            (candidate) => candidate.id === "tencent",
          );
          if (
            !localizedProvider ||
            localizedProvider === provider ||
            !localizedProvider.supports(lookup)
          ) {
            return primary;
          }
          const localizationTimeoutMs = Math.min(
            OPTIONAL_LOCALIZATION_MAX_TIMEOUT_MS,
            deadlineAt - clock() - METADATA_DEADLINE_GUARD_MS,
          );
          if (localizationTimeoutMs <= 0) return primary;
          try {
            const localized = await resolveOptionalLocalization(
              localizedProvider,
              lookup,
              fetcher,
              signal,
              localizationTimeoutMs,
            );
            const verifiedLocalized = validateResolvedInstrument(
              localized,
              lookup,
            );
            if (!hasChineseName(verifiedLocalized.name)) return primary;
            const localizedName = validateLocalizedInstrumentName({
              name: verifiedLocalized.name,
              locale: "zh-CN",
              source: verifiedLocalized.source,
              resolvedAt: verifiedLocalized.resolvedAt,
            });
            return { ...primary, localizedName };
          } catch {
            return primary;
          }
        } catch {
          attempts.push(
            safeAttempt(
              provider,
              new InstrumentMetadataProviderError(
                "invalid-response",
                "证券元数据响应无效",
              ),
            ),
          );
        }
      }

      throw new InstrumentMetadataResolutionError(
        selectedErrorCode(attempts),
        {
          ...lookup,
          attempts,
        },
      );
    },
  };
}
