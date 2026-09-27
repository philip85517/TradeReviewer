import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openSqliteDatabase } from "../../../db/sqlite";
import { buildTradeEpisodes } from "../trades/episodes";
import type { TradeExecution } from "../trades/types";
import { getSqliteStore } from "../storage/sqlite-store";
import { createRecallDocument, retainRecallSnapshot, } from "./document";
import { upsertRecallManualEvaluationDraft } from "./manual-evaluations";
import { getRecallDocument, RecallConflictError, saveRecallDocument, } from "./server-repository";
import type { RecallSnapshot } from "./types";
const directories: string[] = [];
function database() {
    const directory = mkdtempSync(join(tmpdir(), "trade-review-recall-"));
    directories.push(directory);
    return openSqliteDatabase(join(directory, "recall.sqlite"));
}
function execution(id: string, side: TradeExecution["side"], executedAt: string): TradeExecution {
    return {
        id,
        source: {
            platform: "test", row: 0
        },
        accountId: "account",
        accountLabel: "Test",
        instrument: {
            id: "US:TEST", symbol: "TEST", name: "Test", market: "US", currency: "USD"
        },
        side,
        executedAt,
        quantity: "1",
        price: "10",
        fee: "0",
    };
}
function snapshot(decisionId: string, id = "snapshot"): RecallSnapshot {
    return {
        id,
        decisionId,
        timeframe: "1D",
        cursor: "2026-01-01T00:00:00.000Z",
        executionCursor: "2026-01-01T00:00:00.000Z",
        candles: [{
                time: "2026-01-01T00:00:00.000Z", open: 10, high: 11, low: 9, close: 10, volume: 1
            }],
        drawings: [],
        imageDataUrl: "data:image/png;base64,AAAA",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
    };
}
afterEach(() => {
    for (const directory of directories.splice(0))
        rmSync(directory, {
            recursive: true, force: true
        });
});
describe("Recall SQLite repository", () => {
    it("persists episode manual evaluation drafts in the same document transaction", () => {
        const db = database();
        const store = getSqliteStore(db);
        store.mergeExecutions([execution("buy-manual", "buy", "2026-01-01T00:00:00.000Z")]);
        const tradeEpisode = buildTradeEpisodes(store.getExecutions())[0];
        let document = createRecallDocument(tradeEpisode);
        document = retainRecallSnapshot(document, snapshot(document.decisions[0].id));
        document = upsertRecallManualEvaluationDraft(document, {
            id: "manual-draft", evaluationId: "manual-evaluation", target: { scope: "episode", decisionId: null },
            tags: ["position", "entry", "analysis"], tagDictionaryVersion: "manual-v1", evidence: [{ kind: "snapshot", snapshotId: "snapshot" }],
            source: "manual-retrospective", recordedBy: "user", recordedPhase: "post-review", recordedAt: "2026-01-03",
            knowledgeCutoff: { cursor: "2026-01-03", executionCursor: document.decisions[0].executionIds[0] }, hasSeenFuture: true,
        });
        saveRecallDocument(db, { document, expectedRevision: 0 });
        expect(db.prepare("select state, evaluation_id from recall_manual_evaluations where version_kind='draft'").all()).toEqual([{ state: "draft", evaluation_id: "manual-evaluation" }]);
        expect(getRecallDocument(db, tradeEpisode.id)?.manualEvaluations?.drafts[0].tags).toEqual(["position", "entry", "analysis"]);
        db.close();
    });

    it("rejects a new manual evidence pointer at the server boundary without advancing the CAS revision", () => {
        const db = database();
        const store = getSqliteStore(db);
        store.mergeExecutions([execution("buy-manual-invalid", "buy", "2026-01-01T00:00:00.000Z")]);
        const tradeEpisode = buildTradeEpisodes(store.getExecutions())[0];
        const document = createRecallDocument(tradeEpisode);
        document.manualEvaluations = {
            drafts: [{
                id: "manual-draft-invalid", evaluationId: "manual-evaluation-invalid", target: { scope: "episode", decisionId: null },
                tags: ["analysis"], tagDictionaryVersion: "manual-v1", evidence: [{ kind: "snapshot", snapshotId: "missing" }],
                source: "manual-retrospective", recordedBy: "user", recordedPhase: "post-review", recordedAt: "2026-01-03",
                knowledgeCutoff: { cursor: "2026-01-03", executionCursor: tradeEpisode.executions[0].id }, hasSeenFuture: true,
            }],
            versions: [], associations: [{ evaluationId: "manual-evaluation-invalid", decisionId: null, status: "linked" }],
        };
        expect(() => saveRecallDocument(db, { document, expectedRevision: 0 })).toThrow(/new evidence pointer/);
        expect(getRecallDocument(db, tradeEpisode.id)).toBeUndefined();
        expect(db.prepare("select count(*) as count from recall_manual_evaluations").get()).toEqual({ count: 0 });
        db.close();
    });

    it("preserves an older manual evidence pointer when its source snapshot is later unavailable", () => {
        const db = database();
        const store = getSqliteStore(db);
        store.mergeExecutions([execution("buy-manual-history", "buy", "2026-01-01T00:00:00.000Z")]);
        const tradeEpisode = buildTradeEpisodes(store.getExecutions())[0];
        let document = createRecallDocument(tradeEpisode);
        document = retainRecallSnapshot(document, snapshot(document.decisions[0].id));
        document = upsertRecallManualEvaluationDraft(document, {
            id: "manual-draft-history", evaluationId: "manual-evaluation-history", target: { scope: "episode", decisionId: null },
            tags: ["analysis"], tagDictionaryVersion: "manual-v1", evidence: [{ kind: "snapshot", snapshotId: "snapshot" }],
            source: "manual-retrospective", recordedBy: "user", recordedPhase: "post-review", recordedAt: "2026-01-03",
            knowledgeCutoff: { cursor: "2026-01-03", executionCursor: tradeEpisode.executions[0].id }, hasSeenFuture: true,
        });
        const first = saveRecallDocument(db, { document, expectedRevision: 0 });
        const edited = structuredClone(first.document);
        edited.snapshots = [];
        const second = saveRecallDocument(db, { document: edited, expectedRevision: 1 });
        expect(second.revision).toBe(2);
        expect(second.document.manualEvaluations?.drafts[0].evidence).toEqual([{ kind: "snapshot", snapshotId: "snapshot" }]);
        db.close();
    });

    it("keeps the formal JSON unchanged while autosaving a later draft", () => {
        const db = database();
        const store = getSqliteStore(db);
        const executions = [
            execution("buy", "buy", "2026-01-01T00:00:00.000Z"),
            execution("sell", "sell", "2026-01-02T00:00:00.000Z"),
        ];
        store.mergeExecutions(executions);
        const tradeEpisode = buildTradeEpisodes(store.getExecutions())[0];
        let draft = createRecallDocument(tradeEpisode, "2026-01-03T00:00:00.000Z");
        draft = retainRecallSnapshot(draft, snapshot(draft.decisions[0].id));
        const first = saveRecallDocument(db, {
            document: draft, expectedRevision: 0
        });
        let formalInput = retainRecallSnapshot(first.document, snapshot(first.document.decisions[1].id, "snapshot-2"));
        formalInput = retainRecallSnapshot(formalInput, snapshot("global", "global"));
        const formal = saveRecallDocument(db, {
            document: {
                ...formalInput, status: "completed", completedAt: "2026-01-04T00:00:00.000Z"
            },
            expectedRevision: 1,
            finalize: true,
        });
        const finalizedJsonBefore = db.prepare("select finalized_json from recall_documents where episode_id = ?").get(tradeEpisode.id) as {
            finalized_json: string;
        };
        const edited = {
            ...formal.document,
            working: {
                ...formal.document.working, cursor: "2026-01-05T00:00:00.000Z"
            },
        };
        const draftAfter = saveRecallDocument(db, {
            document: edited, expectedRevision: 2
        });
        const finalizedJsonAfter = db.prepare("select finalized_json from recall_documents where episode_id = ?").get(tradeEpisode.id) as {
            finalized_json: string;
        };
        expect(finalizedJsonAfter.finalized_json).toBe(finalizedJsonBefore.finalized_json);
        expect(draftAfter.document.lastCompleted).toMatchObject({
            revision: 2, status: "completed"
        });
        expect(getRecallDocument(db, tradeEpisode.id)?.lastCompleted).toMatchObject({
            revision: 2
        });
        expect(() => saveRecallDocument(db, {
            document: edited, expectedRevision: 2
        })).toThrow(RecallConflictError);
    });
});
import { upsertRecallPlanDraft } from './plans';
import { freezeRecallSnapshotBundle } from './retained-bundles';
import { rebuildRecallPlanProjections } from './plan-projections';
function plannedCapture(db: ReturnType<typeof database>) {
    const store = getSqliteStore(db);
    store.mergeExecutions([execution('plan-buy', 'buy', '2026-01-01T00:00:00.000Z')]);
    const episode = buildTradeEpisodes(store.getExecutions())[0];
    let document = createRecallDocument(episode);
    document = upsertRecallPlanDraft(document, {
        id: 'draft', planId: 'plan', decisionId: document.decisions[0].id, kind: 'initial', input: {
            direction: 'long', currency: 'USD', priceBasis: 'raw', entry: '10', initialStop: '9', targets: [{
                    id: 'target', price: '12', quantity: null, ratio: null
                }], sizeInputMode: 'quantity', sizeInputValue: '2', resolvedQuantity: '2', quantityUnit: 'share', capital: null
        }, recordedPhase: 'pre-entry', source: 'retrospective', recordedAt: '2026-01-03', knowledgeCutoff: {
            cursor: '2026-01-01', executionCursor: '2026-01-01'
        }, hasSeenFuture: false
    });
    document = retainRecallSnapshot(document, snapshot(document.decisions[0].id));
    return {
        episode, document: freezeRecallSnapshotBundle(document, 'snapshot', {
            bundleId: 'bundle', retainedAt: '2026-01-03', episode
        })
    };
}
it('atomically confirms evidence, protects immutable history, and rebuilds typed projections', () => {
    const db = database();
    const { document } = plannedCapture(db);
    const saved = saveRecallDocument(db, {
        document, expectedRevision: 0
    });
    expect(saved.document.retainedBundles?.[0].documentRevision).toBe(1);
    const rows = () => db.prepare('select * from recall_plan_versions order by entity_id').all();
    const initial = rows();
    expect(initial).toHaveLength(2);
    db.prepare("delete from recall_plan_versions where episode_id=?").run(document.episodeId);
    rebuildRecallPlanProjections(db, saved.document, 'draft');
    expect(rows()).toEqual(initial);
    const mutated = structuredClone(saved.document);
    mutated.plans!.versions[0].input.targets[0].price = '13';
    mutated.plans!.drafts[0].input.targets[0].price = '13';
    expect(() => saveRecallDocument(db, {
        document: mutated, expectedRevision: 1
    })).toThrow(/immutable/);
    expect(getRecallDocument(db, document.episodeId)?.revision).toBe(1);
    db.exec("create trigger fail_plan before insert on recall_plan_versions begin select raise(abort,'projection failure'); end");
    expect(() => saveRecallDocument(db, {
        document: saved.document, expectedRevision: 1
    })).toThrow(/projection failure/);
    expect(getRecallDocument(db, document.episodeId)?.revision).toBe(1);
    expect(rows()).toEqual(initial);
    db.close();
});
it('rejects stale capture evidence and CAS conflicts without changing projections', () => {
    const db = database();
    const { document } = plannedCapture(db);
    const saved = saveRecallDocument(db, {
        document, expectedRevision: 0
    });
    expect(() => saveRecallDocument(db, {
        document, expectedRevision: 0
    })).toThrow(RecallConflictError);
    const store = getSqliteStore(db);
    const fills = store.getExecutions();
    fills[0].fee = '1';
    store.mergeExecutions(fills);
    const newer = structuredClone(saved.document);
    newer.retainedBundles!.push({
        ...structuredClone(document.retainedBundles![0]), id: 'stale'
    });
    expect(() => saveRecallDocument(db, {
        document: newer, expectedRevision: 1
    })).toThrow(/stale|spoofed/);
    expect(getRecallDocument(db, document.episodeId)?.revision).toBe(1);
    db.close();
});
it('keeps formal projections and capture revisions unchanged on later draft autosave', () => {
    const db = database();
    const store = getSqliteStore(db);
    const prepared = plannedCapture(db);
    store.mergeExecutions([execution('plan-sell', 'sell', '2026-01-02T00:00:00.000Z')]);
    const episode = buildTradeEpisodes(store.getExecutions())[0];
    let document = createRecallDocument(episode);
    document = upsertRecallPlanDraft(document, prepared.document.plans!.drafts[0]);
    for (const decision of document.decisions)
        document = retainRecallSnapshot(document, snapshot(decision.id, `s-${decision.id}`));
    document = retainRecallSnapshot(document, snapshot('global', 'global'));
    document = freezeRecallSnapshotBundle(document, 'global', {
        bundleId: 'formal-bundle', retainedAt: '2026-01-04', episode
    });
    const formal = saveRecallDocument(db, {
        document, expectedRevision: 0, finalize: true
    });
    const rows = () => db.prepare("select * from recall_plan_versions where version_kind='formal'").all();
    const before = rows();
    const changed = structuredClone(formal.document);
    changed.working.cursor = '2026-01-01';
    const result = saveRecallDocument(db, {
        document: changed, expectedRevision: 1
    });
    expect(rows()).toEqual(before);
    expect(result.document.retainedBundles![0].documentRevision).toBe(1);
    expect(result.document.lastCompleted!.retainedBundles).toEqual(formal.document.retainedBundles);
    db.close();
});
it('ignores display labels in evidence identity but rejects source fee tampering', () => {
    const db = database();
    const { document, episode } = plannedCapture(db);
    const display = structuredClone(episode);
    display.accountLabel = 'Display';
    display.instrument.name = 'New display';
    display.executions[0].instrument.name = 'New display';
    const recaptured = freezeRecallSnapshotBundle(document, 'snapshot', {
        bundleId: 'display', retainedAt: '2026-01-04', episode: display
    });
    expect(() => saveRecallDocument(db, {
        document: recaptured, expectedRevision: 0
    })).not.toThrow();
    db.close();
});
it.each(['phase', 'cursor', 'executionCursor', 'timeframe', 'viewport', 'hasSeenFuture', 'image', 'drawing', 'candle'])('rejects changing accepted snapshot %s without a new capture', kind => {
    const db = database();
    const { document } = plannedCapture(db);
    const saved = saveRecallDocument(db, {
        document, expectedRevision: 0
    });
    const changed = structuredClone(saved.document);
    const snap = changed.snapshots[0];
    if (kind === 'phase')
        snap.phase = 'post-review';
    if (kind === 'executionCursor')
        snap.executionCursor = 'future';
    if (kind === 'timeframe')
        snap.timeframe = '1W';
    if (kind === 'viewport')
        snap.viewport = {
            version: 1, logicalRange: null, barSpacing: 10, rightOffset: 0, width: 100, height: 100
        };
    if (kind === 'hasSeenFuture')
        snap.hasSeenFuture = true;
    if (kind === 'cursor')
        snap.cursor = '2026-01-04T00:00:00.000Z';
    if (kind === 'image')
        snap.imageDataUrl = 'data:image/png;base64,BBBB';
    if (kind === 'drawing')
        snap.drawings.push({
            id: 'text', tool: 'text', anchors: [{
                    time: '2026-01-01', price: 10
                }], style: {
                color: '#fff', lineWidth: 1, opacity: 1
            }, hidden: false, locked: false, visibleOn: 'all', stage: 'pre-trade', text: 'changed'
        } as never);
    if (kind === 'candle')
        snap.candles[0].close = 11;
    expect(() => saveRecallDocument(db, {
        document: changed, expectedRevision: 1
    })).toThrow();
    expect(getRecallDocument(db, document.episodeId)?.revision).toBe(1);
    db.close();
});
it('allows fresh bundle replacement and retained snapshot deletion while preserving old evidence', () => {
    const db = database();
    const { document, episode } = plannedCapture(db);
    const saved = saveRecallDocument(db, {
        document, expectedRevision: 0
    });
    const changed = structuredClone(saved.document);
    changed.snapshots[0].cursor = '2026-01-04T00:00:00.000Z';
    changed.snapshots[0].imageDataUrl = 'data:image/png;base64,BBBB';
    const recaptured = freezeRecallSnapshotBundle(changed, 'snapshot', {
        bundleId: 'replacement', retainedAt: '2026-01-04', episode
    });
    const replaced = saveRecallDocument(db, {
        document: recaptured, expectedRevision: 1
    });
    expect(replaced.document.retainedBundles).toHaveLength(2);
    const deleted = structuredClone(replaced.document);
    deleted.snapshots = [];
    expect(saveRecallDocument(db, {
        document: deleted, expectedRevision: 2
    }).document.retainedBundles).toHaveLength(2);
    db.close();
});
it('rejects new unbound bundles instead of accepting invented captures', () => {
    const db = database();
    const { document } = plannedCapture(db);
    document.snapshots = [];
    expect(() => saveRecallDocument(db, {
        document, expectedRevision: 0
    })).toThrow(/bound snapshot/);
    db.close();
});
import { mergeRecallDecisions, reorderRecallSnapshots } from './document';
import { confirmRecallRetainedState } from './retained-bundles';
it('permits snapshot export reordering and decision regrouping without changing bound financial pictures', () => {
    const db = database();
    const { document, episode } = plannedCapture(db);
    const first = saveRecallDocument(db, {
        document, expectedRevision: 0
    });
    let next = retainRecallSnapshot(first.document, {
        ...snapshot('global', 'global')
    });
    next = freezeRecallSnapshotBundle(next, 'global', {
        bundleId: 'global-b', retainedAt: '2026-01-03', episode
    });
    const saved = saveRecallDocument(db, {
        document: next, expectedRevision: 1
    });
    const reordered = reorderRecallSnapshots(saved.document, ['global', 'snapshot']);
    expect(saveRecallDocument(db, {
        document: reordered, expectedRevision: 2
    }).revision).toBe(3);
    db.close();
    const grouped = structuredClone(saved.document);
    grouped.decisions.push({
        id: 'extra', executionIds: []
    });
    const merged = mergeRecallDecisions(grouped, [grouped.decisions[0].id, 'extra'], grouped.decisions[0].id);
    expect(() => confirmRecallRetainedState(grouped, merged, undefined, 4)).not.toThrow();
});
it('protects accepted legacy bundle pictures without retroactively changing old bundle data', () => {
    const db = database();
    const { document, episode } = plannedCapture(db);
    const saved = saveRecallDocument(db, {
        document, expectedRevision: 0
    }).document;
    delete saved.retainedBundles![0].snapshotContentDigest;
    const mutated = structuredClone(saved);
    mutated.snapshots[0].imageDataUrl = 'data:image/png;base64,BBBB';
    expect(() => confirmRecallRetainedState(saved, mutated, episode, 2)).toThrow(/legacy accepted snapshot changed/);
    expect(() => confirmRecallRetainedState(saved, structuredClone(saved), episode, 2)).not.toThrow();
    db.close();
});
it('rejects stripping an accepted snapshot bundle to bypass immutable capture checks',()=>{
 const db=database();const {document}=plannedCapture(db);const saved=saveRecallDocument(db,{document,expectedRevision:0}).document;const changed=structuredClone(saved);delete changed.snapshots[0].retainedBundleId;changed.snapshots[0].imageDataUrl='data:image/png;base64,BBBB';expect(()=>saveRecallDocument(db,{document:changed,expectedRevision:1})).toThrow(/binding/);db.close();
});

it('computes server-owned actual metrics for a newly accepted capture with its CAS revision', () => {
    const db = database();
    const { document } = plannedCapture(db);
    const saved = saveRecallDocument(db, { document, expectedRevision: 0 });
    expect(saved.document.retainedBundles![0]).toHaveProperty('actualMetrics.source.documentRevision', 1);
    expect(getRecallDocument(db, document.episodeId)?.retainedBundles![0]).toHaveProperty('actualMetrics.source.documentRevision', 1);
    db.close();
});
