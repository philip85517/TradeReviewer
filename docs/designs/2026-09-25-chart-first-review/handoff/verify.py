#!/usr/bin/env python3
"""Verify the immutable handoff snapshot against its SHA-256 manifest."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parent
manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
errors = []
for item in manifest['files']:
    target = (root / item['path']).resolve()
    if not target.is_relative_to(root) or not target.is_file():
        errors.append(item['path'] + ': missing or invalid path')
        continue
    data = target.read_bytes()
    if len(data) != item['bytes'] or hashlib.sha256(data).hexdigest() != item['sha256']:
        errors.append(item['path'] + ': checksum mismatch')
if errors:
    print('\n'.join(errors))
    raise SystemExit(1)
print(f"PASS: {len(manifest['files'])} files match the v{manifest['version']} manifest")
