#!/usr/bin/env python3
"""Rebind reviewed mappings after a rebuild; never invent a replacement anchor."""
from pathlib import Path
import json

base = Path(__file__).resolve().parent
manifest = json.loads((base / 'document-manifest.json').read_text())
mapping = json.loads((base / 'comment-migration.json').read_text())
blocks = {entry['id'] for entry in manifest['blocks']}
images = {entry['occurrenceId'] for entry in manifest['images']}
for entry in mapping['entries']:
    if entry['kind'] == 'image':
        assert entry['targetOccurrenceId'] in images, 'Review missing image anchor: ' + entry['commentId']
    else:
        assert entry['targetBlockId'] in blocks, 'Review missing paragraph anchor: ' + entry['commentId']
mapping['fingerprint'] = manifest['fingerprint']
encoded = json.dumps(mapping, ensure_ascii=False, indent=2) + '\n'
for path in (base / 'comment-migration.json', base / 'reviews/comment-migration.json'):
    path.write_text(encoded)
print('Preserved', len(mapping['entries']), 'reviewed mappings; refreshed version fingerprint.')
