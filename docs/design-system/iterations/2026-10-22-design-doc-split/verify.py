#!/usr/bin/env python3
"""Read-only content and reader integrity audit for the documentation split."""
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[4]
BASE = ROOT / 'docs/design-system/baselines'
ORIGINAL = BASE / '2026-10-20-homepage-v2.4.1'
PACKAGES = [BASE / n for n in ('2026-10-22-homepage-v2.4.2', '2026-10-22-homepage-v2.5', '2026-10-22-trading-library-v1.0')]
F, H, L = PACKAGES
checks = []
def check(name, ok, detail):
    checks.append(dict(check=name, result='PASS' if ok else 'FAIL', detail=detail))
def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def source(path):
    return (path / 'source/visual-design.candidate.md').read_text()
class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.links=[]; self.ids=set()
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if 'id' in a: self.ids.add(a['id'])
        for k in ('href', 'src'):
            if k in a: self.links.append(a[k])

check('frozen-source', source(F).replace('V2.4.2', 'V2.4.1', 1) == source(ORIGINAL), 'V2.4.1 current source retained; only document title version differs')
image_count=0; changed=[]
for p in PACKAGES:
    for old in (ORIGINAL/'source/images').rglob('*'):
        if old.is_file():
            image_count+=1
            target=p/'source/images'/old.relative_to(ORIGINAL/'source/images')
            if not target.is_file() or digest(old)!=digest(target): changed.append(str(target.relative_to(ROOT)))
check('image-byte-preservation', not changed, dict(compared=image_count, differences=changed))
raw=F/'review-records/comments-at-split.json'
raw_hash=digest(raw); record=json.loads(raw.read_text())
check('frozen-comments', raw_hash=='03ca5132853155fae9217cca75ac04002f9043bdbc0e1edcb707d3b73892d543' and len(record['comments'])==43,dict(count=len(record['comments']),sha256=raw_hash))
for p in PACKAGES:
    check(p.name+'-comment-archive', digest(p/'review-records/comments-at-split.json')==raw_hash,'All text, replies, states, history and operation data retained byte for byte')
for p,expected in [(F,('HOME-DOC-V23','2.4.2')),(H,('SITE-HOME-V25','2.5')),(L,('TRADING-LIBRARY-V10','1.0'))]:
    m=json.loads((p/'document-manifest.json').read_text())
    check(p.name+'-identity', (m['documentId'],m['version'])==expected,dict(documentId=m['documentId'],version=m['version'],blocks=len(m['blocks']),images=len(m['images'])))
    check(p.name+'-manifest',m['fingerprint']==hashlib.sha256((p/'source/visual-design.candidate.md').read_bytes()).hexdigest(),'Manifest fingerprint matches current Markdown')
    snapshot=json.loads((p/'comments-snapshot.json').read_text())
    check(p.name+'-offline-snapshot', len(snapshot['comments'])==(43 if p==F else 0),dict(comments=len(snapshot['comments'])))

def chapter(text,id):
    start=text.index('{#chapter-'+id+'}')
    end=text.find('\n## ', start)
    return text[start:end if end!=-1 else len(text)]
# Homepage chapters outside the requested promotion and entry split must remain intact.
unchanged=[]
for id in ('HP02','HP03','HP04','HP05'):
    expected = chapter(source(F), id)
    qualification = 'none'
    if id == 'HP05':
        expected = expected.replace('标的明细每页固定八行', '首页贡献区的标的明细每页固定八行')
        qualification = 'Only qualifies the existing eight-row rule as homepage contribution scope; no behavior change'
    unchanged.append(dict(chapter=id,identical=expected==chapter(source(H),id),allowed_scope_qualification=qualification))
check('unaffected-home-chapters',all(x['identical'] for x in unchanged),unchanged)
original_chapter=chapter(source(F),'HP06')
# HP07 is a nested marker in chapter seven, included above until chapter eight.
old_boards=set(re.findall(r'^images/([^|]+)\|',original_chapter,re.M))
new_boards=set(re.findall(r'^images/([^|]+)\|',chapter(source(H),'HP06')+'\n'+source(L),re.M))
retired={'journeys-pending.svg','journeys-pending-normal.svg','journeys-pending-99plus.svg','hcr06-final-pending-return.svg'}
check('chapter-seven-storyboards',(old_boards-retired)<=new_boards,dict(original=len(old_boards),retained=len(old_boards&new_boards),authorized_retirement=sorted(retired),missing=sorted(old_boards-retired-new_boards),reason='2026-10-22 user cancels separate homepage pending-review entry; original image files remain preserved'))
# Only current entry/return boards belong in the homepage chapter.
home_boards=set(re.findall(r'^images/([^|]+)\|',chapter(source(H),'HP06'),re.M))
allowed={'journeys-library-entry.svg','library-return.svg','hcr06-final-return.svg'}
check('homepage-entry-boundary',home_boards<=allowed,sorted(home_boards))
errors=[]; checked=0
for p in PACKAGES:
    files=[p/'visual-spec.html',p/'review-records/split-comments.html']
    if (p/'source/component-manual.html').exists():files.append(p/'source/component-manual.html')
    for f in files:
        if not f.exists():continue
        parser=Links();parser.feed(f.read_text())
        for link in parser.links:
            u=urlsplit(link)
            if u.scheme or u.netloc or link.startswith('//'):continue
            target=(f.parent/unquote(u.path)).resolve() if u.path else f
            checked+=1
            if not target.exists():errors.append(dict(file=str(f.relative_to(ROOT)),link=link,reason='missing target'));continue
            if u.fragment and target.suffix=='.html':
                tp=Links();tp.feed(target.read_text())
                if unquote(u.fragment) not in tp.ids:errors.append(dict(file=str(f.relative_to(ROOT)),link=link,reason='missing anchor'))
check('reader-links-and-assets',not errors,dict(checked=checked,errors=errors))
result=dict(scope='Documentation split only; product UI and database acceptance not applicable',checks=checks,passed=all(c['result']=='PASS' for c in checks))
output=Path(__file__).with_name('verification.json');output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False,indent=2))
raise SystemExit(0 if result['passed'] else 1)
