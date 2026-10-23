"""Run one fixed candidate, fresh process per cold sample; stop on any miss."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys

base = Path('.scratch/homepage-v25-implementation/evidence/P2/data/immutable-sharing')
node = '/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node'
run = sys.argv[1] if len(sys.argv) == 2 else ''
if not re.fullmatch(r'[a-z0-9-]+', run):
    raise SystemExit('usage: python3 .../run-benchmarks.py <new-report-prefix>')
if list(base.glob(f'{run}-*.json')) or list(base.glob(f'{run}-*.log')):
    raise SystemExit('report prefix already exists; evidence must not be overwritten')
results = []
for shape in ['rounds', 'long-prefix', 'multimarket']:
    for sample in ['1', '2', '3']:
        env = dict(os.environ, P2_RUN=run, P2_SHAPE=shape, P2_SAMPLE=sample)
        cmd = [node, 'node_modules/vitest/vitest.mjs', 'run', '--config', str(base / 'benchmark.config.ts')]
        with (base / f'{run}-{shape}-{sample}.log').open('w') as log:
            completed = subprocess.run(cmd, env=env, stdout=log, stderr=subprocess.STDOUT)
        path = base / f'{run}-{shape}-{sample}.json'
        data = json.loads(path.read_text()) if path.exists() else {}
        result = {'shape': shape, 'sample': sample, 'exitCode': completed.returncode, 'report': str(path), 'coldMs': data.get('coldMs'), 'repeats': data.get('repeats'), 'cacheEstimatedBytes': data.get('afterRepeat', {}).get('cacheEstimatedBytes'), 'publicBytesEqual': data.get('completePublicBytesEqual'), 'admitted': data.get('admitted')}
        results.append(result)
        print(json.dumps(result), flush=True)
        (base / f'{run}-summary.json').write_text(json.dumps({'results': results, 'formalP2': '0/3; root acceptance required', 'stopOnAnyMiss': True}, indent=2))
        if completed.returncode:
            raise SystemExit('Fixed candidate missed a gate; remaining samples NOT VERIFIED. No further variant or retry.')
