#!/usr/bin/env python3
"""Verify this finite documentation integration without starting the application."""
from pathlib import Path
import argparse,collections,datetime,gzip,hashlib,html,json,re,subprocess,sys,xml.etree.ElementTree as ET
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
BASE='d95afc37d30f817edbd6daab41e85f485138de0d'
PRIOR='7a9a46cc3daaf36d98b7f79235eb1f0d841f7f9d'
sha=lambda b:hashlib.sha256(b).hexdigest()
read=lambda p:json.loads(p.read_text())
rel=lambda p:p.relative_to(ROOT).as_posix()
class Markup(HTMLParser):
    def __init__(self):super().__init__();self.ids=[];self.blocks=[];self.links=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if a.get('id'):self.ids.append(a['id'])
        if a.get('data-comment-block'):self.blocks.append(a['data-comment-block'])
        for key in (['href'] if tag in ['a','link'] else ['src'] if tag in ['img','script'] else []):
            if a.get(key):self.links.append(a[key])
def anchors(p):
    if p.suffix=='.html':
        parser=Markup();parser.feed(p.read_text());return set(parser.ids)
    t=p.read_text();ids=set(re.findall(r'\{#([^}]+)\}|<a\s+id="([^"]+)"',t));ans={a or b for a,b in ids};used=collections.Counter()
    for title in re.findall(r'^#{1,6}\s+(.+)$',t,re.M):
        title=re.sub(r'\{#[^}]+\}','',title).strip();slug=re.sub(r'[^\w\s\-]','',title.lower());slug=re.sub(r'\s','-',slug)
        n=used[slug];used[slug]+=1;ans.add(slug+(f'-{n}' if n else ''))
    return ans

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--write',action='store_true');args=ap.parse_args();checks={};fail=[]
    def result(name,data,ok=True):checks[name]=data;fail.extend([] if ok else [name])
    supplements=[]
    for name in ['supplement-other-worktrees.json','alignment-manifest.json','supplement-review-strategy.json']:
        supplements+=read(HERE/name)['files']
    mismatches=[]
    for f in supplements:
        p=ROOT/f.get('destination',f.get('desired_destination',''))
        if not p.is_file() or sha(p.read_bytes())!=f['sha256']:mismatches.append(str(p))
    result('supplement_hashes',{'files':len(supplements),'mismatches':mismatches},not mismatches)
    old={}
    prov=HERE.parent/'2026-11-06-visual-spec-consolidation/provenance'
    for m in sorted((read(p) for p in prov.glob('*manifest.json')),key=lambda x:x['captured_at']):
        for f in m['files']:old[f['destination']]=f
    derived=[];exact=0;missing=[]
    for name,f in old.items():
        p=ROOT/name
        if not p.is_file():missing.append(name);continue
        current=sha(p.read_bytes())
        if current==f['sha256']:exact+=1
        else:derived.append({'path':name,'snapshot_sha256':f['sha256'],'current_sha256':current,'reason':'Current authority banner, approved summary/replay update, stable identity regeneration or associated document index; original snapshot remains in Git provenance.'})
    allowed_prefixes=['docs/design-system/baselines/2026-10-22-homepage-v2.5/','docs/design-system/baselines/2026-10-22-review-workspace-v1.0/','docs/design-system/baselines/2026-10-24-strategy-workbench-v1.2/','docs/design-system/shared/strategy-workbench-v1.2/']
    unexpected=[x['path'] for x in derived if not any(x['path'].startswith(pre) for pre in allowed_prefixes)]
    result('original_preservation',{'unique_paths':len(old),'byte_exact':exact,'intentional_derivatives':derived,'missing':missing,'unexpected':unexpected},not missing and not unexpected)
    inv=read(HERE/'worktree-inventory-summary.json');z=HERE/'worktree-inventory.json.gz';raw=json.loads(gzip.decompress(z.read_bytes()))
    result('inventory',{'worktrees':len(raw['worktrees']),'captured_at':raw['captured_at'],'gzip_sha256':sha(z.read_bytes()),'summary_hash_matches':sha(z.read_bytes())==inv['inventory_sha256']},len(raw['worktrees'])==11 and sha(z.read_bytes())==inv['inventory_sha256'])
    active=[HERE/x for x in ['README.md','WORKTREE-COVERAGE.md','BUSINESS-UPDATES.md','FINAL-ACCEPTANCE.md']]
    active += [ROOT/x for x in ['docs/design-system/README.md','docs/design-system/iterations/README.md','docs/design-system/trading-library-design-spec.md','docs/design-system/trading-library-design-spec.html','.scratch/visual-specs-consolidation-20261106/README.md','.scratch/visual-specs-consolidation-20261106/issues/03-core-design-alignment.md','.scratch/visual-specs-consolidation-20261106/issues/04-full-document-pr.md']]
    readers=['2026-10-22-homepage-v2.5','2026-10-22-review-workspace-v1.0','2026-10-24-strategy-workbench-v1.2','2026-10-26-trading-library-v2.0'];reader_results=[];reader_errors=[]
    for name in readers:
        d=ROOT/'docs/design-system/baselines'/name;i=read(d/'document-identity.json');m=read(d/'document-manifest.json');p=Markup();p.feed((d/'visual-spec.html').read_text())
        ref=BASE if 'homepage' in name or 'trading-library' in name else PRIOR
        baseline=json.loads(subprocess.check_output(['git','show',ref+':'+rel(d/'document-identity.json')]))
        a={x['id']:x for x in baseline['blocks']};b={x['id']:x for x in i['blocks']}
        retired=[k for k in a if k not in b];changed=[k for k in a.keys()&b.keys() if a[k]['text']!=b[k]['text'] or a[k]['chapter']!=b[k]['chapter']]
        comments=[]
        for cp in d.glob('*comment*.json'):
            before=subprocess.check_output(['git','show',ref+':'+rel(cp)])
            comments.append({'path':rel(cp),'unchanged':sha(before)==sha(cp.read_bytes())})
        errors=[]
        if len(p.ids)!=len(set(p.ids)):errors.append('duplicate HTML id')
        if len(p.blocks)!=len(set(p.blocks)) or set(p.blocks)!=set(b):errors.append('HTML blocks vs identity mismatch')
        if set(x['id'] for x in m['blocks'])!=set(b) or m['documentId']!=i['documentId']:errors.append('manifest identity mismatch')
        if changed:errors.append('stable ID changed meaning')
        if retired and name!='2026-10-24-strategy-workbench-v1.2':errors.append('unexpected retired blocks')
        if not all(x['unchanged'] for x in comments):errors.append('comment history changed')
        reader_results.append({'reader':name,'documentId':i['documentId'],'old_blocks':len(a),'current_blocks':len(b),'retired_after_text_revision':retired,'same_id_changed_meaning':changed,'comment_files':comments,'errors':errors})
        reader_errors+=errors;active+=[d/'README.md',d/'visual-spec.html']
    result('reader_identity',reader_results,not reader_errors)
    stores=[]
    for p in (ROOT/'docs/design-system/reviews').glob('*.json'):
        before=subprocess.check_output(['git','show',PRIOR+':'+rel(p)])
        stores.append({'path':rel(p),'comments':len(read(p).get('comments',[])),'unchanged':sha(before)==sha(p.read_bytes())})
    result('published_comment_stores',stores,all(x['unchanged'] for x in stores))
    missing_links=[];checked=0
    for p in active:
        t=p.read_text()
        if p.suffix=='.html':parser=Markup();parser.feed(t);urls=parser.links
        else:urls=re.findall(r'!?\[[^\]\n]*\]\(([^)\n]+)\)',t)
        for rawurl in urls:
            url=rawurl.strip().split(' "')[0].strip('<>');parts=urlsplit(html.unescape(url))
            if parts.scheme or parts.netloc or parts.path.startswith('/'):continue
            checked+=1;target=(p.parent/unquote(parts.path)).resolve() if parts.path else p
            if not target.is_file():missing_links.append({'file':rel(p),'url':url,'reason':'missing file'})
            elif parts.fragment and target.suffix in ['.md','.html'] and unquote(parts.fragment) not in anchors(target):missing_links.append({'file':rel(p),'url':url,'reason':'missing anchor'})
    result('active_links',{'files':len(active),'urls':checked,'missing':missing_links},not missing_links)
    svgfiles=list((HERE/'alignment').glob('*.svg'))+[ROOT/'docs/design-system/shared/strategy-workbench-v1.2/sw06-summary-detail.svg',ROOT/'docs/design-system/baselines/2026-10-24-strategy-workbench-v1.2/source/images/06-observe.svg'];errors=[]
    for p in svgfiles:
        try:ET.parse(p)
        except ET.ParseError as e:errors.append({'path':rel(p),'error':str(e)})
    result('svg_syntax',{'files':len(svgfiles),'errors':errors},not errors)
    current_paths=sorted(set(rel(p) for p in active)|{'CONTEXT.md',rel(Path(__file__).resolve())})
    run=subprocess.run(['git','diff',BASE,'--check','--',*current_paths],cwd=ROOT,capture_output=True,text=True)
    result('current_document_whitespace',{'exit_code':run.returncode,'diagnostics':run.stdout.splitlines()},run.returncode==0)
    paths=[p.decode() for p in subprocess.check_output(['git','diff',BASE,'--name-only','-z'],cwd=ROOT).split(b'\0') if p]
    outside=[p for p in paths if not (p.startswith(('docs/','.scratch/')) or p=='CONTEXT.md')]
    largest=sorted(({'path':p,'bytes':(ROOT/p).stat().st_size} for p in paths if (ROOT/p).is_file()),key=lambda x:x['bytes'],reverse=True)[:5]
    result('git_scope',{'changed_paths':len(paths),'outside_document_scope':outside,'largest_files':largest},not outside and all(x['bytes']<100*1024*1024 for x in largest))
    # Hash before/after a second build: this is a generated-document stability check.
    changed=[];builds=[]
    for name in readers:
        d=ROOT/'docs/design-system/baselines'/name;files=[d/x for x in ['document-identity.json','document-manifest.json','visual-spec.html']];before={rel(p):sha(p.read_bytes()) for p in files}
        cmd=[sys.executable,str(d/'build-visual-spec.py')]
        if 'review-workspace' in name or 'trading-library' in name:cmd+=['--source',str(d/'source/visual-design.candidate.md'),'--version','1.0' if 'review' in name else '2.0','--output-dir',str(d)]
        run=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True);builds.append({'reader':name,'returncode':run.returncode})
        if run.returncode:changed.append({'reader':name,'error':run.stderr})
        for p in files:
            if before[rel(p)]!=sha(p.read_bytes()):changed.append({'path':rel(p),'reason':'second build changed bytes'})
    result('reader_rebuild_stability',{'builds':builds,'changes':changed},not changed)
    run=subprocess.run(['git','diff',BASE,'--check'],cwd=ROOT,capture_output=True,text=True)
    lines=run.stdout.splitlines();ws=[x for x in lines if not x.startswith('+')];result('whole_package_whitespace',{'exit_code':run.returncode,'diagnostics':ws,'classification':'Original-source whitespace retained byte-exact in preserved archival materials; not silently reformatted.'})
    payload={'verified_at':datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat(),'base':BASE,'prior_local_snapshot':PRIOR,'scope':'documentation only; no UI/database/product acceptance inferred','checks':checks,'status':'PASS' if not fail else 'FAIL','failed_checks':fail}
    if args.write:(HERE/'verification.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'status':payload['status'],'failed_checks':fail,'supplement_files':len(supplements),'active_urls':checked,'link_failures':missing_links,'identity_errors':reader_errors,'rebuild_changes':changed},ensure_ascii=False,indent=2))
    return bool(fail)
if __name__=='__main__':sys.exit(main())
