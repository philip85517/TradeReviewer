#!/bin/sh
set -eu
BASE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$BASE_DIR/../../../.." && pwd)
SERVER="$REPO_ROOT/tools/document_review/server.py"
DOCS_ROOT="$BASE_DIR"
COMMENTS_DIR="$BASE_DIR/reviews"
MANIFEST="$BASE_DIR/document-manifest.json"
PORT="${PORT:-3088}"

exec python3 "$SERVER" \
  --host 127.0.0.1 \
  --port "$PORT" \
  --docs-root "$DOCS_ROOT" \
  --comments-dir "$COMMENTS_DIR" \
  --manifest "$MANIFEST"
