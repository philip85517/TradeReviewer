from pathlib import Path
import hashlib,json,importlib.util
here=Path(__file__).resolve().parent
repo=here.parents[3]
root=repo/'docs/design-system/baselines/2026-10-19-homepage-v2.4'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
errors=[]
rows=(root/'source-hashes.sha256').read_text().splitlines()
for line in rows:
 expected,name=line.split('  ',1);p=root/name
 if not p.is_file() or sha(p)!=expected:errors.append(name)
manifest=json.loads((root/'document-manifest.json').read_text())
for row in manifest['images']:
 if sha(root/row['src'])!=row['fingerprint']:errors.append(row['src'])
original=json.loads((root/'comments-snapshot.json').read_text())['comments']
current=json.loads((root/'reviews/HOME-DOC-V23.json').read_text())['comments']
lookup={c['id']:c for c in current}
assert len(original)==27
assert all(lookup.get(c['id'])==c for c in original),'original comments changed'
historical=root/'source/reviews/2026-10-18-source/comments.json'
canonical=repo/'docs/design-system/baselines/2026-10-18-homepage-v2.3/reviews/2026-10-18-source/comments.json'
assert historical.read_bytes()==canonical.read_bytes()
assert (root/'reviews/2026-10-18-source/comments.json').read_bytes()==canonical.read_bytes()
spec=importlib.util.spec_from_file_location('packager',here.parent/'02/package-reader-dependencies.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
audit=m.scan_refs(root)
errors.extend(audit['missing'])
report={'readerSha256':sha(root/'visual-spec.html'),'files':len(rows),'imageOccurrences':len(manifest['images']),'originalComments':len(original),'currentComments':len(current),'originalCommentsUnchanged':True,'historicalComments':len(json.loads(historical.read_text())['comments']),'errors':errors,'status':'FAIL' if errors else 'PASS','scope':'final bytes, links, original comment content/status; browser evidence separate'}
(here/'packaged-integrity.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False));raise SystemExit(bool(errors))
