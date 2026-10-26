"""Link original review quotes to reviewed rewritten paragraphs without editing comments."""
from pathlib import Path
import json

root = Path(__file__).resolve().parents[2]
task = Path(__file__).resolve().parent
base = root / 'docs/design-system/baselines/2026-10-22-trading-library-v1.0'
manifest = json.loads((base / 'document-manifest.json').read_text())
comments_path = root / 'docs/design-system/reviews/TRADING-LIBRARY-V10.json'
comments = json.loads(comments_path.read_text())
blocks = {b['id']:b for b in manifest['blocks']}
by_source = {
    'HOME-DOC-B070':'HOME-TLIB-GOAL',
    'HOME-DOC-B004':'HOME-TLIB-TRADEOFF',
    'HOME-DOC-B005':'HOME-TLIB-ACCURACY',
    'HOME-DOC-B001':'HOME-TLIB-INTRO',
    'HOME-DOC-B071':'HOME-TLIB-REFERENCES',
}
mapping = json.loads((base / 'comment-migration.json').read_text())
mapping['fingerprint'] = manifest['fingerprint']
for comment in comments['comments']:
    sources = [s['blockId'] for s in comment['segments']]
    if not sources or not all(s in by_source for s in sources):
        continue
    targets = {s:by_source[s] for s in sources}
    assert all(t in blocks for t in targets.values())
    entry = {
        'commentId':comment['id'],
        'kind':'paragraph',
        'sourceFingerprint':comment['fingerprint'],
        'targetBlockId':targets[sources[0]],
        'targetBlockIdBySource':targets,
        'reason':'按用户批准的行文修订方案关联到新段落。原引用保持修改前全文；此映射表示同一论题的修订位置，不表示旧句子仍存在，也不改变评论状态。第一章的具体规则已归入第三至六章。',
    }
    mapping['entries'] = [e for e in mapping['entries'] if e['commentId'] != comment['id']] + [entry]
encoded = json.dumps(mapping, ensure_ascii=False, indent=2) + '\n'
for relative in ['comment-migration.json', 'reviews/comment-migration.json']:
    (base / relative).write_text(encoded)
(base / 'comments-snapshot.json').write_bytes(comments_path.read_bytes())
print(f"Mapped {len(mapping['entries'])} comments; original comment store left unchanged.")
