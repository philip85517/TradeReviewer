from pathlib import Path
import importlib.util,re
here=Path(__file__).resolve().parent
base=here.parent.parent
spec=importlib.util.spec_from_file_location('v241builder',base/'build-visual-spec.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
module.build_companion_page(here/'REPORT.md',here/'REPORT.html',version='2.4.1')
p=here/'REPORT.html';s=p.read_text()
def keep_existing(m):
 href=m.group(1)
 if href.endswith('.html') and not (here/href).is_file() and (here/(href[:-5]+'.md')).is_file():href=href[:-5]+'.md'
 return 'href="'+href+'"'
s=re.sub(r'href="([^"]+)"',keep_existing,s).replace('href="../visual-spec.html"','href="../../visual-spec.html"')
p.write_text(s)
