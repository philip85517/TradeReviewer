"""Read one existing CPU capture; never execute a fixture or product code."""
from collections import Counter, defaultdict
from hashlib import sha256
from pathlib import Path
import json

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[5]
profile = json.loads((BASE / "diagnostic-multimarket.cpuprofile").read_text())
freeze = json.loads((BASE / "14-candidate-freeze.json").read_text())
for name, expected in freeze["files"].items():
    assert sha256((ROOT / name).read_bytes()).hexdigest() == expected["sha256"], name
for name, expected in freeze["originalPrefixesUnchanged"].items():
    assert sha256((ROOT / name).read_bytes()[:expected["bytes"]]).hexdigest() == expected["sha256"], name

nodes = {node["id"]: node for node in profile["nodes"]}
parents = {child: node["id"] for node in profile["nodes"] for child in node.get("children", [])}
assert len(profile["samples"]) == len(profile["timeDeltas"])
total_us = sum(profile["timeDeltas"])
phase_us, category_us = Counter(), Counter()
self_us, inclusive_us, inclusive_samples = Counter(), Counter(), Counter()
phase_function_us = Counter()
locations = defaultdict(set)


def home(frame):
    return frame["url"].endswith("/app/lib/reviews/homepage-v25-performance.ts")


def key(frame):
    name = frame["functionName"]
    # Collapse recursion by function, but keep different anonymous closures distinct.
    if not name:
        name = f"(anonymous transformed {frame['lineNumber'] + 1}:{frame['columnNumber'] + 1})"
    return name, frame["url"]


def category(frames, phase):
    if phase == "other":
        if any(f["functionName"] == "(garbage collector)" for f in frames):
            return "unallocated garbage collection"
        if any(f["functionName"] == "post" and f["url"] == "node:inspector" for f in frames):
            return "inspector start overhead"
        return "unallocated runtime/harness or incomplete stack"
    # Deepest recognized ancestor assigns each sample exactly once.
    for frame in frames:
        name, url = frame["functionName"], frame["url"]
        if home(frame):
            if name in {"shape", "accountPermanent", "retain", "release", "get", "set", "delete", "primitiveBytes", "accountSourceStrings"}:
                return "memo and source/index graph accounting"
            if name == "freezeProjection":
                return "public graph freezing"
            if name == "exact" or (not name and frame["lineNumber"] + 1 in {971, 974}):
                return "sharing keys, probes and content interning"
            if name == "indexedQuote":
                return "quote selection, session calendar and timezone"
            if name == "metric":
                return "unchanged metric money/FX oracle"
            if name == "fxFor":
                return "dated FX selection and provenance assembly"
            if name == "stableProjectionJson":
                return "stable source/request key serialization"
            if name == "prepareOrdinaryProjection":
                return "ordinary fee checkpoint construction"
            if name == "selectedPrepared":
                return "execution prefix selection"
            if name in {"ordinaryState", "projectedState"}:
                return "state and prefix-key assembly outside ledger/graph"
            if name in {"feeAmount", "visibleFeeFacts", "collectFeeFacts", "ordinaryFeeIndex"}:
                return "fee fact selection and assembly"
            if name == "evidence":
                return "public evidence assembly"
            if name == "lifetimeFor":
                return "lifetime coverage assembly"
            if name in {"amount", "strictAmount"}:
                return "native amount construction"
        if name in {"preparePositionLedger", "replayPreparedPositionBoundaries"} and url.endswith("/app/lib/replay/position-ledger.ts"):
            return "canonical ledger preparation/query"
        if name == "sha256" and url.endswith("/app/lib/recall/retained-digest.ts"):
            return "source/group digest hashing"
        if name == "structuredClone":
            return "source snapshot clone"
    return "remaining preparation/group/index work" if phase == "prepare" else "remaining endpoint/current assembly"


for sample, delta in zip(profile["samples"], profile["timeDeltas"]):
    frames, cursor = [], sample
    while cursor is not None:
        frames.append(nodes[cursor]["callFrame"])
        cursor = parents.get(cursor)
    phase = "other"
    if any(home(f) and f["functionName"] == "prepareHomepageV25Source" for f in frames):
        phase = "prepare"
    elif any(home(f) and f["functionName"] == "projectHomepageV25Boundaries" for f in frames):
        phase = "project"
    phase_us[phase] += delta
    category_us[phase, category(frames, phase)] += delta
    self_us[key(frames[0])] += delta
    seen = set()
    for frame in frames:
        function = key(frame)
        locations[function].add((frame["lineNumber"] + 1, frame["columnNumber"] + 1))
        if function in seen:
            continue
        seen.add(function)
        inclusive_us[function] += delta
        inclusive_samples[function] += 1
        phase_function_us[phase, function] += delta

assert sum(phase_us.values()) == total_us
assert sum(category_us.values()) == total_us
rows = []
for function, inclusive in inclusive_us.most_common():
    name, url = function
    own = self_us[function]
    rows.append({"function": name, "url": url, "transformedLocations": sorted(locations[function]),
                 "inclusiveMs": inclusive / 1000, "selfMs": own / 1000,
                 "inclusivePctAllSamples": 100 * inclusive / total_us,
                 "selfPctAllSamples": 100 * own / total_us,
                 "inclusiveSamples": inclusive_samples[function],
                 "inclusiveMsByPhase": {p: phase_function_us[p, function] / 1000 for p in phase_us},
                 "inclusivePctProjection": 100 * phase_function_us["project", function] / phase_us["project"]})

artifacts = {}
for name in ["diagnostic-multimarket.cpuprofile", "diagnostic-multimarket.batch.json", "diagnostic-multimarket.report.json", "diagnostic-multimarket.started.json", "diagnostic-multimarket.log"]:
    raw = (BASE / name).read_bytes()
    artifacts[name] = {"bytes": len(raw), "sha256": sha256(raw).hexdigest()}
report = {
    "method": "For each sample, use its timeDelta as weight. Self belongs to the leaf; inclusive is counted once per distinct function+URL in that sample, with anonymous closures separated by transformed position. Categories assign the sample to its deepest recognized owner. Inclusive rows overlap and must not be summed; category rows partition all weights.",
    "caveats": ["Vite-transformed callFrame locations are not original TypeScript line numbers.", "Sampled CPU weight is not exact function duration or call count. Native Intl/JSON work can be charged to the JS caller.", "GC and incomplete stacks are left unallocated. No allocation count, native Intl construction/format split, or causal speedup is measured.", "Only the existing one-shot capture is read. No fixture, test or product code is executed by this analysis.", "Diagnostic timing is not formal threshold evidence; original cold FAIL and remaining NOT VERIFIED stay binding.", "The preliminary diagnostic-analysis.json matched the retained-digest path under reviews instead of recall, leaving its 53.354ms in remaining preparation. This v2 corrects only that read-only classification; raw profile and function totals are unchanged."],
    "profile": {"nodes": len(nodes), "samples": len(profile["samples"]), "samplingIntervalUs": 1000,
                "weightedMs": total_us / 1000, "profilerElapsedMs": (profile["endTime"] - profile["startTime"]) / 1000,
                "phaseMs": {p: v / 1000 for p, v in phase_us.items()}},
    "partition": [{"phase": phase, "category": label, "ms": value / 1000,
                   "pctAllSamples": 100 * value / total_us, "pctPhase": 100 * value / phase_us[phase]}
                  for (phase, label), value in category_us.most_common()],
    "functions": rows, "frozenFilesAndOriginalPrefixesVerified": True, "artifacts": artifacts,
    "formalP2": "0/3; root-independent multimarket cold 2617.548995ms FAIL; samples 2/3 NOT VERIFIED"
}
output = BASE / "diagnostic-analysis-v2.json"
assert not output.exists(), "Preserve the first analysis artifact; do not overwrite silently"
output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({"profile": report["profile"], "partition": report["partition"], "frozenHashesVerified": True}, ensure_ascii=False, indent=2))
