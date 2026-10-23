"""Read-only log/source manifest. Does not import or execute application code."""

from hashlib import sha256
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[5]
LOG = Path(".scratch/homepage-v25-implementation/evidence/continue-2026-10-23/root-workspace-current-0522.log")
SOURCES = [
    LOG,
    Path("app/components/trade-review-workspace.test.tsx"),
    Path("app/components/trade-review-workspace.tsx"),
    Path("app/components/test-support/legacy-sqlite-client.ts"),
    Path("app/components/homepage-v25/use-homepage-host.ts"),
    Path("app/components/homepage-v25/home-surface.tsx"),
    Path("app/components/homepage-v25/session-model.ts"),
    Path("app/components/homepage-v25/catalog-model.ts"),
    Path("app/components/homepage-v25/holdings-model.ts"),
    Path("app/components/homepage-v25/fx-adapter.ts"),
    Path("app/components/dashboard/review-dashboard.tsx"),
    Path("app/lib/storage/sqlite-repositories.ts"),
    Path("app/lib/storage/browser-state-export.ts"),
    Path("app/lib/reviews/localized-metadata-hydration.ts"),
    Path("app/lib/instruments/resolve-service.ts"),
    Path("app/trades/page.tsx"),
    Path("app/page.tsx"),
    Path("docs/agents/development-workflow.md"),
    Path("docs/agents/task-decomposition.md"),
    Path("docs/agents/frontend-control-audit.md"),
    Path(".scratch/homepage-v25-implementation/issues/04-holdings-journey.md"),
    Path(".scratch/homepage-v25-implementation/issues/06-search-filter.md"),
    Path(".scratch/homepage-v25-implementation/DESIGN-COVERAGE.md"),
    Path("docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md"),
    Path("docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/holding-return.svg"),
    Path("docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/search-detail.svg"),
]

raw = (ROOT / LOG).read_bytes()
plain = re.sub(r"\x1b\[[0-9;]*m", "", raw.decode())
failures = []
for number, block in enumerate(re.split(r"\n FAIL ", plain)[1:], 1):
    lines = block.splitlines()
    failures.append({
        "number": number,
        "name": lines[0].strip(),
        "error": next((line for line in lines[1:] if line.startswith(("AssertionError:", "TestingLibraryElementError:"))), None),
        "workspace_stack": [line.strip() for line in lines if line.startswith(" ❯ ") and "trade-review-workspace.test.tsx:" in line],
    })

print(json.dumps({
    "method": "Static text inspection only; no app imports, test runner, browser, service, DB, performance or profile execution.",
    "root": str(ROOT),
    "log_summary": [line.strip() for line in plain.splitlines() if re.match(r"\s*(Test Files|Tests |Start at|Duration)", line)],
    "failure_count": len(failures),
    "failures": failures,
    "inputs": [{"path": str(path), "bytes": len((ROOT / path).read_bytes()), "sha256": sha256((ROOT / path).read_bytes()).hexdigest()} for path in SOURCES],
}, ensure_ascii=False, indent=2))
