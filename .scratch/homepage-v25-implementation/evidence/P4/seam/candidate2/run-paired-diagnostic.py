"""Fixed twelve-sample diagnostic. Run only after explicit root quiet-window release."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

base = Path('.scratch/homepage-v25-implementation/evidence/P4/seam/candidate2')
if sys.argv[1:] != ['--root-quiet-window-released']:
    raise SystemExit('requires explicit root quiet-window release; this flag is not itself authorization')
paths = [
 'app/lib/replay/position-ledger.ts', 'app/lib/reviews/homepage-v25-performance.ts',
 '.scratch/homepage-v25-implementation/evidence/P4/seam/input-position-ledger.ts',
 '.scratch/homepage-v25-implementation/evidence/P4/seam/input-homepage-v25-performance.ts',
 '.scratch/homepage-v25-implementation/evidence/P2/data/calendar-resume/input-oracle.ts',
 '.scratch/homepage-v25-implementation/evidence/P2/data/immutable-sharing/fixtures.ts',
 '.scratch/homepage-v25-implementation/evidence/P2/data/calendar-resume/benchmark.test.ts',
 str(base / 'paired-benchmark.test.ts'), str(base / 'paired-benchmark.config.ts'),
]
def manifest():
    return {p: hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in paths}
initial = manifest()
if list((base / 'paired').glob('*')):
    raise SystemExit('paired evidence directory already has samples; never overwrite or retry')
(base / 'paired' / 'SOURCE-HASHES.json').write_text(json.dumps(initial, indent=2) + '\n')
results = []
for shape in ['rounds', 'long-prefix', 'multimarket']:
    for pair, modes, sample in [('ab', ['baseline', 'candidate'], '1'), ('ba', ['candidate', 'baseline'], '2')]:
        for mode in modes:
            if manifest() != initial:
                raise SystemExit('source changed during diagnostic; preserve all prior results and stop')
            run = f'paired-{pair}-{mode}'
            stem = f'{run}-{shape}-{sample}'
            env = dict(os.environ, P2_RUN=run, P2_SHAPE=shape, P2_SAMPLE=sample, P4_VARIANT=mode)
            cmd = ['./scripts/native-node.sh', 'node_modules/vitest/vitest.mjs', 'run', '--config', str(base / 'paired-benchmark.config.ts')]
            with (base / 'paired' / f'{stem}.log').open('x') as log:
                done = subprocess.run(cmd, env=env, stdout=log, stderr=subprocess.STDOUT)
            report = base / 'paired' / f'{stem}.json'
            data = json.loads(report.read_text()) if report.exists() else {}
            result = {'shape': shape, 'pair': pair, 'variant': mode, 'sample': sample, 'exitCode': done.returncode, 'report': str(report), 'coldMs': data.get('coldMs'), 'prepareMs': data.get('prepareMs'), 'batchMs': data.get('batchMs'), 'repeats': data.get('repeats'), 'cacheEstimatedBytes': data.get('afterRepeat', {}).get('cacheEstimatedBytes'), 'completePublicBytesEqual': data.get('completePublicBytesEqual'), 'publicSha256': data.get('publicSha256'), 'fixture': data.get('fixture'), 'admitted': data.get('admitted')}
            results.append(result)
            (base / 'paired' / f'{stem}-exit.json').write_text(json.dumps({'command': cmd, 'environment': {k: env[k] for k in ['P2_RUN', 'P2_SHAPE', 'P2_SAMPLE', 'P4_VARIANT']}, 'exitCode': done.returncode}, indent=2) + '\n')
            (base / 'paired' / 'SUMMARY.json').write_text(json.dumps({'diagnosticOnly': True, 'formalAcceptance': 'root-owned; this does not replace nine samples', 'goals': {'coldMs': 2000, 'repeatMs': 200, 'cacheEstimatedBytes': 64*1024*1024}, 'results': results}, indent=2) + '\n')
            print(json.dumps({k: result[k] for k in ['shape', 'pair', 'variant', 'exitCode', 'coldMs', 'prepareMs', 'batchMs']}), flush=True)
if manifest() != initial:
    raise SystemExit('source changed during diagnostic; results remain unaccepted')
