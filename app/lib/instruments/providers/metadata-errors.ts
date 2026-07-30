import {
  validateResolvedInstrument,
  type InstrumentLookup,
  type InstrumentMetadataSource,
  type ResolvedInstrument,
} from "../metadata-contracts";

export type InstrumentMetadataProviderErrorCode =
  | "source-rate-limited"
  | "source-forbidden"
  | "source-timeout"
  | "source-unavailable"
  | "invalid-response"
  | "no-data";

export class InstrumentMetadataProviderError extends Error {
  constructor(
    readonly code: InstrumentMetadataProviderErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "InstrumentMetadataProviderError";
  }
}

export interface InstrumentMetadataProvider {
  readonly id: Exclude<InstrumentMetadataSource, "statement">;
  supports(lookup: InstrumentLookup): boolean;
  resolve(
    lookup: InstrumentLookup,
    fetcher?: typeof fetch,
  ): Promise<ResolvedInstrument>;
}

export async function requestMetadataResponse(
  fetcher: typeof fetch,
  input: string,
  init: RequestInit | undefined,
  providerLabel: string,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetcher(input, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(10_000),
    });
  } catch (error) {
    const errorName =
      error instanceof Error || error instanceof DOMException
        ? error.name
        : "";
    if (errorName === "AbortError" || errorName === "TimeoutError") {
      throw new InstrumentMetadataProviderError(
        "source-timeout",
        `${providerLabel}请求超时`,
      );
    }
    throw new InstrumentMetadataProviderError(
      "source-unavailable",
      `${providerLabel}暂时不可用`,
    );
  }

  if (!response.ok) {
    const code =
      response.status === 429
        ? "source-rate-limited"
        : response.status === 403
          ? "source-forbidden"
          : "source-unavailable";
    throw new InstrumentMetadataProviderError(
      code,
      `${providerLabel}暂时不可用`,
      response.status,
    );
  }
  return response;
}

export function invalidMetadataResponse(message: string): never {
  throw new InstrumentMetadataProviderError("invalid-response", message);
}

export function noMetadata(message: string): never {
  throw new InstrumentMetadataProviderError("no-data", message);
}

export function validateProviderMetadataResult(
  value: unknown,
  lookup: InstrumentLookup,
  providerLabel: string,
): ResolvedInstrument {
  try {
    return validateResolvedInstrument(value, lookup);
  } catch (error) {
    if (error instanceof InstrumentMetadataProviderError) throw error;
    return invalidMetadataResponse(`${providerLabel}响应无效`);
  }
}
