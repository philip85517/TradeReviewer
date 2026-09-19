"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  emptyPrincipalState,
  normalizePrincipalState,
  principalConfigForScope,
  type PrincipalCategory,
  type PrincipalMutation,
  type PrincipalScope,
  type PrincipalState,
  type PrincipalValue,
} from "./principal-model";

export class PrincipalSettingsError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PrincipalSettingsError";
  }
}

type PrincipalSettingsFetcher = (input: string, init?: RequestInit) => Promise<Response>;

export type PrincipalSettingsClient = {
  read: () => Promise<PrincipalState>;
  mutate: (mutation: PrincipalMutation) => Promise<PrincipalState>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function errorFromResponse(status: number, body: unknown): PrincipalSettingsError {
  const error = isRecord(body) && isRecord(body.error) ? body.error : {};
  return new PrincipalSettingsError(
    status,
    typeof error.code === "string" ? error.code : "principal-request-failed",
    typeof error.message === "string" ? error.message : `本金设置请求失败（${status}）`,
  );
}

async function parseResponse(response: Response): Promise<PrincipalState> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new PrincipalSettingsError(response.status, "invalid-response", "本金设置响应格式无效");
  }
  if (!response.ok) throw errorFromResponse(response.status, body);
  if (!isRecord(body) || body.version !== 1 || !isRecord(body.scopes)) {
    throw new PrincipalSettingsError(response.status, "invalid-response", "本金设置响应格式无效");
  }
  return normalizePrincipalState(body);
}

export function createPrincipalSettingsClient(fetcher: PrincipalSettingsFetcher = fetch): PrincipalSettingsClient {
  return {
    read: async () => parseResponse(await fetcher("/api/trading-room/principal", {
      cache: "no-store",
      headers: { accept: "application/json" },
    })),
    mutate: async (mutation) => parseResponse(await fetcher("/api/trading-room/principal", {
      method: "PUT",
      cache: "no-store",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(mutation),
    })),
  };
}

export type UsePrincipalSettingsOptions = {
  scope?: PrincipalScope;
  enabled?: boolean;
  client?: PrincipalSettingsClient;
};

export type UsePrincipalSettingsResult = {
  state: PrincipalState;
  config: ReturnType<typeof principalConfigForScope>;
  loading: boolean;
  saving: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  save: (category: PrincipalCategory, value: PrincipalValue) => Promise<boolean>;
  clear: (category: PrincipalCategory) => Promise<boolean>;
};

const defaultClient = createPrincipalSettingsClient();

function messageFor(error: unknown): string {
  return error instanceof Error && error.message.trim() ? error.message : "本金设置暂时不可用";
}

function mutationScopeFor(scope: PrincipalScope): PrincipalScope {
  return scope.nature === "live"
    ? { nature: "live", simulationRunId: null }
    : scope;
}

export function usePrincipalSettings({
  scope = { nature: "live", simulationRunId: null },
  enabled = true,
  client = defaultClient,
}: UsePrincipalSettingsOptions = {}): UsePrincipalSettingsResult {
  const [state, setState] = useState<PrincipalState>(() => emptyPrincipalState());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const operationVersionRef = useRef(0);
  const saveVersionRef = useRef(0);
  const mutationScope = mutationScopeFor(scope);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const cancelReads = useCallback(() => {
    operationVersionRef.current += 1;
    if (mountedRef.current) setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const version = ++operationVersionRef.current;
    setLoading(true);
    setError(null);
    try {
      const next = await client.read();
      if (mountedRef.current && version === operationVersionRef.current) setState(next);
    } catch (caught) {
      if (mountedRef.current && version === operationVersionRef.current) setError(messageFor(caught));
    } finally {
      if (mountedRef.current && version === operationVersionRef.current) setLoading(false);
    }
  }, [client, enabled]);

  useEffect(() => {
    if (!enabled) {
      cancelReads();
      return undefined;
    }
    let active = true;
    queueMicrotask(() => {
      if (active) void refresh();
    });
    return () => {
      active = false;
      cancelReads();
    };
  }, [cancelReads, enabled, refresh]);

  const mutate = useCallback(async (category: PrincipalCategory, value: PrincipalValue | null): Promise<boolean> => {
    if (!enabled) return false;
    const version = ++operationVersionRef.current;
    const saveVersion = ++saveVersionRef.current;
    setSaving(true);
    setError(null);
    try {
      const next = await client.mutate({
        version: 1,
        scope: mutationScope,
        category,
        value,
      });
      if (mountedRef.current && version === operationVersionRef.current) setState(next);
      return true;
    } catch (caught) {
      if (mountedRef.current && version === operationVersionRef.current) setError(messageFor(caught));
      return false;
    } finally {
      if (mountedRef.current && saveVersion === saveVersionRef.current) setSaving(false);
    }
  }, [client, enabled, mutationScope]);

  const save = useCallback((category: PrincipalCategory, value: PrincipalValue) => mutate(category, value), [mutate]);
  const clear = useCallback((category: PrincipalCategory) => mutate(category, null), [mutate]);
  const config = useMemo(() => principalConfigForScope(state, scope), [scope, state]);

  return { state, config, loading, saving, error, refresh, save, clear };
}
