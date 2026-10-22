import json,hashlib,xml.etree.ElementTree as ET
from pathlib import Path
b=Path('docs/design-system/baselines/2026-10-20-homepage-v2.4.1');o=b/'review-records/2026-10-22-comment-repair'
before=json.loads((o/'before-manifest.json').read_text());after={p:hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in before if Path(p).exists()}
changed=[p for p in before if before[p]!=after.get(p)]
source=[p for p in changed if '/source/' in p];svgs=[p for p in source if p.endswith('.svg')]
for p in (b/'source').rglob('*.svg'):ET.parse(p)
comments=str(b/'reviews/HOME-DOC-V23.json')
result={'changed_source_count':len(source),'changed_svg_count':len(svgs),'source_files':source,'unchanged_source_count':sum('/source/' in p and p not in changed for p in before),'comments_sha_unchanged':before[comments]==after[comments],'all_source_svg_xml_parse':'PASS','after_hashes':after}
(o/'after-manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k not in ['source_files','after_hashes']},ensure_ascii=False))
