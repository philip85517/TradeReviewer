import { describe, expect, it } from "vitest";

import type { RecallDocument } from "./types";
import { fetchRecallDocument, saveRecallDocument } from "./repository";

const document: RecallDocument = {
  version: 1,
  episodeId: "episode",
  revision: 0,
  decisions: [],
  snapshots: [],
  working: {
    drawings: [],
    timeframe: "1D",
    cursor: "2026-01-01T00:00:00.000Z",
    executionCursor: "2026-01-01T00:00:00.000Z",
    selectedDecisionId: null,
  },
  status: "in-progress",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("Recall browser repository", () => {
  it("loads a nullable document from the GET endpoint", async () => {
    const fetcher = async () => new Response(JSON.stringify(document), { status: 200 });
    await expect(fetchRecallDocument("episode", fetcher)).resolves.toEqual(document);
    const missing = async () => new Response(JSON.stringify({ error: { code: "not-found" } }), { status: 404 });
    await expect(fetchRecallDocument("episode", missing)).resolves.toBeNull();
  });

  it("sends an explicit CAS save envelope and maps conflict responses", async () => {
    let request: RequestInit | undefined;
    const fetcher = async (_input: string, init?: RequestInit) => {
      request = init;
      return new Response(JSON.stringify(document), { status: 200 });
    };
    await saveRecallDocument(document, { expectedRevision: 0, finalize: false, fetcher });
    expect(request?.method).toBe("PUT");
    expect(JSON.parse(String(request?.body))).toMatchObject({ expectedRevision: 0, finalize: false });

    const conflict = async () => new Response(JSON.stringify({ error: { code: "conflict", message: "stale" } }), { status: 409 });
    await expect(saveRecallDocument(document, { fetcher: conflict })).rejects.toMatchObject({ status: 409, code: "conflict" });
  });
});
