from pathlib import Path
import difflib
import hashlib
import json

root = Path(__file__).resolve().parents[5]
evidence = Path(__file__).resolve().parent
inputs = json.loads((evidence / "INPUT-HASHES.json").read_text())
owned = [
    "app/lib/replay/position-ledger.ts",
    "app/lib/replay/position-ledger.test.ts",
    "app/lib/reviews/homepage-v25-performance.ts",
    "app/lib/reviews/homepage-v25-performance.test.ts",
]
manifest = {}
diffs = []
for name in owned:
    content = (root / name).read_bytes()
    baseline = (evidence / ("input-" + Path(name).name)).read_bytes()
    (evidence / ("candidate-" + Path(name).name)).write_bytes(content)
    item = {"sha256": hashlib.sha256(content).hexdigest(), "bytes": len(content), "lines": len(content.splitlines()), "inputSha256": hashlib.sha256(baseline).hexdigest()}
    if name.endswith(".test.ts"):
        item["originalTestBytesUnchanged"] = content.startswith(baseline)
        assert item["originalTestBytesUnchanged"], name
    manifest[name] = item
    diffs.extend(difflib.unified_diff(baseline.decode().splitlines(True), content.decode().splitlines(True), fromfile="accepted-input/" + name, tofile="candidate/" + name))
(evidence / "candidate.diff").write_text("".join(diffs))
guards = {}
for name, original in inputs.items():
    if name in owned:
        continue
    digest = hashlib.sha256((root / name).read_bytes()).hexdigest()
    guards[name] = {"sha256": digest, "inputSha256": original["sha256"], "unchanged": digest == original["sha256"]}
    assert guards[name]["unchanged"], name
output = {"status": "IMPLEMENTATION_READY_FOR_ROOT_REVIEW", "model": "gpt-6.1-sol", "effort": "ultra", "formalP4SeamAcceptanceAttempts": 0, "p4WholeTicketAcceptanceAttempts": 0, "acceptedAResumeAttempt": "1/3 (unchanged)", "files": manifest, "readOnlyGuards": guards, "candidateDiffSha256": hashlib.sha256((evidence / "candidate.diff").read_bytes()).hexdigest()}
(evidence / "CANDIDATE-HASHES.json").write_text(json.dumps(output, indent=2) + "\n")
print(json.dumps(output, indent=2))
