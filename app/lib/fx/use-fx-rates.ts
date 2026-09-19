"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { FxState } from "./contracts";

export type UseFxRatesOptions = {
  enabled?: boolean;
};

export type UseFxRatesResult = {
  state: FxState | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFxState(value: unknown): value is FxState {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" &&
    value.baseCurrency === "CNY" &&
    value.source === "BOC" &&
    (value.publishedAt === null || typeof value.publishedAt === "string") &&
    (value.fetchedAt === null || typeof value.fetchedAt === "string") &&
    (value.lastAttemptDay === null || typeof value.lastAttemptDay === "string") &&
    (value.status === "complete" || value.status === "partial" || value.status === "missing") &&
    (value.error === null || typeof value.error === "string") &&
    isRecord(value.rates) &&
    isRecord(value.publishedAtByCurrency);
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim() ? error.message : "汇率状态暂时不可用";
}

async function fetchFxState(method: "GET" | "POST", signal: AbortSignal): Promise<FxState> {
  const response = await fetch("/api/fx", {
    method,
    cache: "no-store",
    signal,
    headers: { accept: "application/json" },
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("汇率状态暂时不可用");
  }
  if (!response.ok) {
    const message = isRecord(body) && isRecord(body.error) && typeof body.error.message === "string"
      ? body.error.message
      : "汇率状态暂时不可用";
    throw new Error(message);
  }
  if (!isFxState(body)) throw new Error("汇率状态格式无效");
  return body;
}

export function useFxRates({ enabled = true }: UseFxRatesOptions = {}): UseFxRatesResult {
  const [state, setState] = useState<FxState | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const loadInitialState = useCallback(() => {
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    void fetchFxState("GET", controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setState(next);
      })
      .catch((caught) => {
        if (!controller.signal.aborted) setError(errorMessage(caught));
      })
      .finally(() => {
        if (requestRef.current === controller) {
          requestRef.current = null;
          setLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    queueMicrotask(() => {
      if (active) loadInitialState();
    });
    return () => {
      active = false;
      requestRef.current?.abort();
      requestRef.current = null;
      setLoading(false);
      setRefreshing(false);
    };
  }, [enabled, loadInitialState]);

  useEffect(() => () => {
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);

  const refresh = useCallback(async () => {
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;
    setLoading(false);
    setRefreshing(true);
    setError(null);
    try {
      const next = await fetchFxState("POST", controller.signal);
      if (!controller.signal.aborted) setState(next);
    } catch (caught) {
      if (!controller.signal.aborted) setError(errorMessage(caught));
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      if (requestRef.current === null) setRefreshing(false);
    }
  }, []);

  return { state, loading, refreshing, error, refresh };
}
