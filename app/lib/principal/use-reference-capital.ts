"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { emptyReferenceCapitalState, normalizeReferenceCapitalState, validateReferenceCapitalState, type ReferenceCapitalDraft, type ReferenceCapitalState } from "./reference-capital-model";

export type ReferenceCapitalClient = { read: () => Promise<ReferenceCapitalState>; save: (draft: ReferenceCapitalDraft) => Promise<ReferenceCapitalState>; remove: (id: string) => Promise<ReferenceCapitalState> };
const responseState = async (response: Response): Promise<ReferenceCapitalState> => { const body = await response.json() as unknown; if (!response.ok) throw new Error(body && typeof body === "object" && "error" in body && body.error && typeof body.error === "object" && "message" in body.error ? String(body.error.message) : "参考资本请求失败"); const invalid = validateReferenceCapitalState(body); if (invalid) throw new Error(invalid); return normalizeReferenceCapitalState(body); };
export function createReferenceCapitalClient(fetcher: typeof fetch = fetch): ReferenceCapitalClient { return { read: async () => responseState(await fetcher("/api/trading-room/reference-capital", { cache: "no-store" })), save: async draft => responseState(await fetcher("/api/trading-room/reference-capital", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) })), remove: async id => responseState(await fetcher("/api/trading-room/reference-capital", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) })) }; }

export function useReferenceCapital(options: { enabled?: boolean; client?: ReferenceCapitalClient } = {}) {
  const [defaultClient] = useState(() => createReferenceCapitalClient());
  const { enabled = true, client = defaultClient } = options;
  const [state, setState] = useState<ReferenceCapitalState>(emptyReferenceCapitalState);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const reads = useRef(0);
  const writes = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  // A refresh queued during a mutation must read after that mutation commits.
  // Separate busy counters prevent one request from stranding another's status.
  const request = useCallback((operation: () => Promise<ReferenceCapitalState>, mutation: boolean) => {
    if (!enabled) return Promise.resolve(false);
    const count = mutation ? writes : reads;
    count.current += 1;
    (mutation ? setSaving : setLoading)(true);
    setError(null);
    const pending = queue.current.then(async () => {
      try {
        const next = await operation();
        if (mounted.current) setState(next);
        return true;
      } catch (caught) {
        if (mounted.current) setError(caught instanceof Error ? caught.message : "参考资本请求失败");
        return false;
      } finally {
        count.current -= 1;
        if (mounted.current) (mutation ? setSaving : setLoading)(count.current > 0);
      }
    });
    queue.current = pending;
    return pending;
  }, [enabled]);
  const refresh = useCallback(async () => { await request(() => client.read(), false); }, [client, request]);
  // Synchronize with the remote settings store; refresh immediately exposes its loading state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);
  const save = useCallback((draft: ReferenceCapitalDraft) => request(() => client.save(draft), true), [client, request]);
  const remove = useCallback((id: string) => request(() => client.remove(id), true), [client, request]);
  return { state, loading, saving, error, refresh, save, remove };
}
