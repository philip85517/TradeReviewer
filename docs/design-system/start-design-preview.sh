#!/bin/sh
set -eu
BASE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$BASE_DIR/../.." && pwd)
exec python3 "$REPO_ROOT/tools/document_review/server.py" --host 127.0.0.1 --port "${PORT:-3090}" --docs-root "$REPO_ROOT/docs" --comments-dir "$BASE_DIR/reviews"
