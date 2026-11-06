#!/usr/bin/env bash
set -euo pipefail
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$BASE_DIR/../../../.." && pwd)"
exec python3 "$REPO_ROOT/tools/document_review/server.py" --host 127.0.0.1 --port "${PORT:-3094}" --docs-root "$REPO_ROOT/docs" --comments-dir "$REPO_ROOT/docs/design-system/reviews"
