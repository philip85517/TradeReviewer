import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const out = '.scratch/homepage-v25-implementation/evidence/P3/';
const sha = text => createHash('sha256').update(text).digest('hex');
function replace(text, from, to) {
  if (!text.includes(from)) throw new Error(`Missing exact diff context: ${from}`);
  return text.replace(from, to);
}
let host = readFileSync('app/components/homepage-v25/use-homepage-host.ts', 'utf8');
host = replace(host, '  const initializingRead = useRef(false);\n', '');
host = replace(host, '        } else if (routeRef.current.error) {\n          setAddressRoute({ ...routeRef.current, error: null });\n        }\n        if (initializingRead.current) { initializingRead.current = false; setInitialized(true); }', '        }');
host = replace(host, '      const current = pending.current?.token.generation === token.generation;\n', '');
host = replace(host, '      if (current) pending.current = null;', '      if (pending.current?.token.generation === token.generation) pending.current = null;');
host = replace(host, '      if (current && (initializingRead.current || routeRef.current.error)) {\n        if (routeRef.current.page === "trades") setAddressRoute({ ...routeRef.current, error: error instanceof Error ? error.message : "目标交易集合读取失败，请重试。" });\n        initializingRead.current = false; setInitialized(true);\n      }\n', '');
host = replace(host, '    if (options.readOnInitialize && !routeRef.current.error) {', '    if (options.readOnInitialize && routeRef.current.page === "home" && !routeRef.current.error) {');
host = replace(host, '      const matching = restored && (routeRef.current.page === "trades" || homepageScopeKey(restored.snapshot.scope) === homepageScopeKey(routeRef.current.scope));\n      initializingRead.current = true;', '      const matching = restored && homepageScopeKey(restored.snapshot.scope) === homepageScopeKey(routeRef.current.scope);');
host = replace(host, '    } else setInitialized(true);\n    replaceEntry();', '    }\n    replaceEntry(); setInitialized(true);');
host = replace(host, '      if (ui !== sessionRef.current.ui) {\n        pending.current = null; update({ ...sessionRef.current, ui });\n        if (initializingRead.current) {\n          if (routeRef.current.page === "trades") setAddressRoute({ ...routeRef.current, error: "目标交易集合读取超时，请重试。" });\n          initializingRead.current = false; setInitialized(true);\n        }\n      }', '      if (ui !== sessionRef.current.ui) { pending.current = null; update({ ...sessionRef.current, ui }); }');
host = replace(host, '  }, [session.ui.requests.global, setAddressRoute, update]);', '  }, [session.ui.requests.global, update]);');
host = replace(host, '  const reload = useCallback(() => {\n    const restored = routeRef.current.page === "trades" ? validateSource(source.current) : null;\n    beginRead(sessionRef.current.ui.errors.global ? "retry" : { purpose: "refresh" }, restored ? encodeHomepageSnapshot(restored.snapshot) : undefined);\n  }, [beginRead, validateSource]);', '  const reload = useCallback(() => beginRead(sessionRef.current.ui.errors.global ? "retry" : { purpose: "refresh" }), [beginRead]);');
let workspace = readFileSync('app/components/trade-review-workspace.tsx', 'utf8');
workspace = replace(workspace, 'import { buildTradeEpisodes } from "../lib/trades/episodes";\n', 'import { buildTradeEpisodes } from "../lib/trades/episodes";\nimport type { TradeLibraryEntry } from "../lib/trades/library";\n');
workspace = replace(workspace, '    if (showDemo || homepage.route.page !== "trades") return;\n    setActiveViewState("library");\n    if (!homepage.initialized || homepage.route.error || ordinaryLibraryKey === homepage.route.key) return;', '    if (showDemo || !homepage.initialized || homepage.route.page !== "trades" || homepage.route.error || ordinaryLibraryKey === homepage.route.key) return;');
workspace = replace(workspace, '    setOrdinaryLibraryKey(homepage.route.key);\n', '    setOrdinaryLibraryKey(homepage.route.key);\n    setActiveViewState("library");\n');
workspace = replace(workspace, '{homepage.route.error}{homepage.ui.errors.global && <button type="button" disabled={Boolean(homepage.ui.requests.global)} onClick={homepage.reload}>{homepage.ui.requests.global ? "正在重试…" : "重新读取目标交易集合"}</button>}', '{homepage.route.error}');
writeFileSync(out + 'cold-read-host.before.ts', host);
writeFileSync(out + 'cold-read-workspace.before.tsx', workspace);
console.log(JSON.stringify({ reconstructed: [
  { file: 'host', sha256: sha(host), expected: 'e9e446bdddc7f333932955038568f59e5e2e47bb5f691b40306b563e51c41233' },
  { file: 'workspace', sha256: sha(workspace), expected: 'ee29515346366905d0bba6b4d220b22cee4f4b8f4310e247aebcaed951a7d490' },
] }, null, 2));
