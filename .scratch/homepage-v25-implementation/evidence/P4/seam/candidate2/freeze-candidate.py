from pathlib import Path
import difflib
import hashlib
import json

root = Path.cwd()
evidence = root / '.scratch/homepage-v25-implementation/evidence/P4/seam/candidate2'
inputs = json.loads((evidence / 'INPUT-HASHES.json').read_text())
owned = ['app/lib/replay/position-ledger.ts', 'app/lib/replay/position-ledger.test.ts', 'app/lib/reviews/homepage-v25-performance.ts', 'app/lib/reviews/homepage-v25-performance.test.ts']
manifest = {}
diffs = []
for name in owned:
    content = (root / name).read_bytes()
    before = (evidence / ('input-' + Path(name).name)).read_bytes()
    (evidence / ('candidate-' + Path(name).name)).write_bytes(content)
    item = {'sha256': hashlib.sha256(content).hexdigest(), 'bytes': len(content), 'lines': len(content.splitlines()), 'candidate1Sha256': hashlib.sha256(before).hexdigest()}
    if name.endswith('.test.ts'):
        item['allCandidate1TestBytesUnchanged'] = content.startswith(before)
        assert item['allCandidate1TestBytesUnchanged'], name
    manifest[name] = item
    diffs.extend(difflib.unified_diff(before.decode().splitlines(True), content.decode().splitlines(True), fromfile='candidate1/' + name, tofile='candidate2/' + name))
(evidence / 'candidate2.diff').write_text(''.join(diffs))
guards = {}
for name, before in inputs.items():
    if name in owned:
        continue
    digest = hashlib.sha256((root / name).read_bytes()).hexdigest()
    guards[name] = {'sha256': digest, 'inputSha256': before['sha256'], 'unchanged': digest == before['sha256']}
    assert guards[name]['unchanged'], name
output = {'status': 'FROZEN_FOR_ROOT_REVIEW_WITH_REQUIRED_PERFORMANCE_NOT_VERIFIED', 'model': 'gpt-6.1-sol', 'effort': 'ultra', 'sameSeamTicketPreviousFormalResult': 'candidate1 1/3 FAIL', 'nextFormalSeamAcceptance': 'candidate2 2/3 (not yet run)', 'acceptedAResumeAttempt': '1/3 historical acceptance unchanged; adjacent performance reopened', 'files': manifest, 'readOnlyGuards': guards, 'diffSha256': hashlib.sha256((evidence / 'candidate2.diff').read_bytes()).hexdigest(), 'heavyPerformanceSamplesByThisOwner': 0, 'remaining': ['root decision on prior candidate1 raw movement fee total assertion', 'root explicit quiet-window release and fixed paired diagnostic', 'root independent functional/strict/lint review and original nine-sample performance acceptance']}
(evidence / 'CANDIDATE-HASHES.json').write_text(json.dumps(output, indent=2) + '\n')
print(json.dumps(output, indent=2))
