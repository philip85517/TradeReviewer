#!/usr/bin/env bash
set -euo pipefail
# Prepared only. Root executes after declaring its quiet window.
cd -- "$(dirname -- "$0")/../../../../../.."
evidence=.scratch/homepage-v25-implementation/evidence/P2/data/calendar-resume
for shape in rounds long-prefix multimarket; do
  for sample in 1 2 3; do
    report="$evidence/root-resume1-$shape-$sample.json"
    log="$evidence/root-resume1-$shape-$sample.log"
    if [[ -e "$report" || -e "$log" ]]; then
      echo "Refusing to overwrite preserved benchmark evidence: $report" >&2
      exit 1
    fi
    P2_RUN=root-resume1 P2_SHAPE="$shape" P2_SAMPLE="$sample" ./scripts/native-node.sh node_modules/vitest/vitest.mjs run --config "$evidence/benchmark.config.ts" --configLoader native > "$log" 2>&1
  done
done
