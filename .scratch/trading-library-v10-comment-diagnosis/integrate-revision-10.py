"""Rebind revision 10 comments, preserving original content and image evidence."""
from pathlib import Path
import hashlib
import json

root = Path(__file__).resolve().parents[2]
task = Path(__file__).resolve().parent
base = root / 'docs/design-system/baselines/2026-10-22-trading-library-v1.0'
manifest = json.loads((base / 'document-manifest.json').read_text())
shared_path = root / 'docs/design-system/reviews/TRADING-LIBRARY-V10.json'
shared_bytes = shared_path.read_bytes()
shared = json.loads(shared_bytes)
before = json.loads((task / 'evidence/comments-revision-10/comments.json').read_text())
current = {c['id']: c for c in shared['comments']}
for c in before['comments']:
    assert current[c['id']] == c, 'Original comment changed; inspect before integrating: ' + c['id']
mapping = json.loads((base / 'comment-migration.json').read_text())
blocks = {b['id'] for b in manifest['blocks']}
for e in mapping['entries']:
    if e['kind'] == 'paragraph':
        assert e['targetBlockId'] in blocks
        assert all(t in blocks for t in e.get('targetBlockIdBySource', {}).values())
for c in before['comments']:
    old = c.get('image')
    if not old:
        continue
    targets = [i for i in manifest['images'] if i['id'] == old['id'] and i['chapter'] == old['chapter']]
    assert len(targets) == 1, (c['id'], [t['occurrenceId'] for t in targets])
    target = targets[0]
    existing = next((e for e in mapping['entries'] if e['commentId'] == c['id'] and e.get('sourceImageFingerprint') == old['fingerprint']), None)
    if existing:
        original = existing['sourceUrl']
    else:
        original = 'review-records/2026-10-24-revision-10/originals/' + Path(old['src']).name
        frozen = task / 'evidence/revision-10-repair-before' / base.relative_to(root) / old['src']
        assert hashlib.sha256(frozen.read_bytes()).hexdigest() == old['fingerprint']
        destination = base / original
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(frozen.read_bytes())
    assert hashlib.sha256((base / original).read_bytes()).hexdigest() == old['fingerprint']
    entry = {
        'commentId': c['id'], 'kind': 'image',
        'sourceFingerprint': c['fingerprint'], 'sourceOccurrenceId': old['occurrenceId'],
        'sourceImageFingerprint': old['fingerprint'], 'sourceUrl': original,
        'targetOccurrenceId': target['occurrenceId'],
        'reason': '按已批准的图稿修复方案关联到同章节的修订整图。原图留存并可对照；此关联不声称原图具体坐标在新图中不变，也不修改评论的意见、状态或历史。'
    }
    mapping['entries'] = [e for e in mapping['entries'] if e['commentId'] != c['id']] + [entry]
mapping['fingerprint'] = manifest['fingerprint']
encoded = json.dumps(mapping, ensure_ascii=False, indent=2) + '\n'
for path in ['comment-migration.json', 'reviews/comment-migration.json']:
    (base / path).write_text(encoded)
(base / 'comments-snapshot.json').write_bytes(shared_bytes)
assert shared_path.read_bytes() == shared_bytes
print(f"Mapped {len(mapping['entries'])} comments; shared revision {shared['revision']} unchanged; original image hashes verified.")
