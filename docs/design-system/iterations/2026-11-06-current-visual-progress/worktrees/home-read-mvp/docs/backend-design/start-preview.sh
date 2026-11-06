#!/bin/sh
# Dedicated document review service; never starts the business application.
set -eu
backend_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
project_dir=$(CDPATH= cd -- "$backend_dir/../.." && pwd)
preview_port=${BACKEND_REVIEW_PORT:-3091}
comments_dir=${BACKEND_REVIEW_COMMENTS_DIR:-"$backend_dir/reviews"}
python_bin=${PYTHON:-python3}

for document in current target; do
  if [ ! -f "$backend_dir/review/$document/document-manifest.json" ]; then
    echo "Missing reader manifest. Run: python3 docs/backend-design/build-review.py" >&2
    exit 1
  fi
done
printf '现状说明: http://127.0.0.1:%s/backend-design/review/current/index.html\n' "$preview_port"
printf '目标审查: http://127.0.0.1:%s/backend-design/review/target/index.html\n' "$preview_port"
printf '评论目录: %s\n' "$comments_dir"
exec "$python_bin" "$project_dir/tools/document_review/server.py" \
  --host 127.0.0.1 \
  --port "$preview_port" \
  --docs-root "$project_dir/docs" \
  --manifest "$backend_dir/review/current/document-manifest.json" \
  --manifest "$backend_dir/review/target/document-manifest.json" \
  --comments-dir "$comments_dir"
