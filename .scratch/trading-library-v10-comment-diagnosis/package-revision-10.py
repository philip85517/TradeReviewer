"""Freeze this uncommitted repair scope for independent review."""
from pathlib import Path
import difflib
import hashlib
import json
import re
import argparse
from xml.etree import ElementTree

task = Path(__file__).resolve().parent
root = task.parents[1]
base = root / 'docs/design-system/baselines/2026-10-22-trading-library-v1.0'
source = base / 'source/visual-design.candidate.md'
before = task / 'evidence/before-repair/source'
parser = argparse.ArgumentParser()
parser.add_argument('--output-dir', type=Path, default=task / 'evidence/repair')
parser.add_argument('--previous-root', type=Path)
args = parser.parse_args()
out = args.output_dir
out.mkdir(parents=True, exist_ok=True)
refs = sorted(set(re.findall(r'images/[\w-]+\.svg', source.read_text())))
extra_sources = [base/'navigation-options.html', base/'source/homepage-template.py', base/'source/test-homepage-template.py', base/'source/test-library-metrics.py']
extra_frames = [base/'source/images/journeys-library-list-return-1280.svg']
files = [*extra_frames, *extra_sources, source, base/'source/library-design-fixture.json', base/'source/generate-library-frames.py', *[base/'source'/r for r in refs], *[base/n for n in ['visual-spec.html','document-manifest.json','document-identity.json','comment-migration.json','comments-snapshot.json','reviews/comment-migration.json']]]
hashes = {str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
runtime_hashes = {str((base/n).relative_to(root)):hashlib.sha256((base/n).read_bytes()).hexdigest() for n in ['build-visual-spec.py','review-client.js','review-client.css','start-preview.sh']}
diffs = []
for p in [*extra_sources,source,base/'source/library-design-fixture.json',base/'source/generate-library-frames.py']:
    old = args.previous_root / p.relative_to(root) if args.previous_root else before / p.relative_to(base/'source')
    diffs.extend(difflib.unified_diff(old.read_text().splitlines(True) if old.exists() else [],p.read_text().splitlines(True),fromfile='before/'+str(p.relative_to(base)),tofile='current/'+str(p.relative_to(base)),n=6))
(out/'review-source.diff').write_text(''.join(diffs))
manifest=json.loads((base/'document-manifest.json').read_text())
data={'scope':'Task 1 static design repair, uncommitted workspace; compare frozen pre-repair source, not HEAD..HEAD', 'source_fingerprint':manifest['fingerprint'], 'files':hashes, 'images':manifest['images'], 'prior_source':str(before/'visual-design.candidate.md'), 'prior_svg_directory':str(before/'images'), 'source_diff':str(out/'review-source.diff'), 'global_constraints':'Preserve prior prose, comments and statuses; no database/product code; preserve LIFO, date attribution and navigation contracts; visual evidence required.'}
data['extra_acceptance_frames'] = [str(p.relative_to(root)) for p in extra_frames]
data['reader_runtime_files'] = runtime_hashes
data['content_fingerprint'] = hashlib.sha256(json.dumps({**hashes, **runtime_hashes},sort_keys=True).encode()).hexdigest()
if args.previous_root:
    data['scope'] = 'Scoped re-review of uncommitted static design fix against previous frozen review'
    data['prior_source'] = str(args.previous_root / source.relative_to(root))
    data['prior_svg_directory'] = str(args.previous_root / (base/'source/images').relative_to(root))
    data['changed_files'] = [name for name, digest in hashes.items() if not (args.previous_root/name).is_file() or hashlib.sha256((args.previous_root/name).read_bytes()).hexdigest() != digest]
(out/'review-package.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
rows=['# 本次引用状态清单\n',f"版本：`{manifest['fingerprint']}`。每一行是一个文档 occurrence；相同源图的其他章节引用仍需检查分镜上下文。独立验收结果写入 REVIEW.md。\n",'| occurrence / 章节 | 状态 | SVG自然尺寸 | 比较视口 | 图hash前12位 |\n|---|---|---|---|---|\n']
for image in manifest['images']:
    p=base/image['src']; svg=ElementTree.parse(p).getroot(); w,h=svg.attrib['width'],svg.attrib['height']
    viewport='1280×800' if w=='1280' else '1440×900'
    rows.append(f"| `{image['occurrenceId']}` / {image['chapter']} | {image['alt']} | {w}×{h} | {viewport} | `{image['fingerprint'][:12]}` |\n")
(out/'FRAME-INVENTORY.md').write_text(''.join(rows))
print(json.dumps({'files':len(files),'unique_images':len(refs),'occurrences':len(manifest['images']),'fingerprint':manifest['fingerprint'],'package':str(out/'review-package.json')},ensure_ascii=False))
