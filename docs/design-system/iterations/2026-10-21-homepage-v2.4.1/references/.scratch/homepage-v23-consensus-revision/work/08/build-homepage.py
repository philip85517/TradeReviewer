"""Compose approved homepage regions at native widths; never alter baseline files."""
from pathlib import Path
import importlib.util, json, hashlib, re
import xml.etree.ElementTree as ET
HERE=Path(__file__).resolve().parent
WORK=HERE.parent
OUT=HERE/'composed-images'; OUT.mkdir(exist_ok=True)
spec=importlib.util.spec_from_file_location('shared_boards',WORK/'01/integration-assets/build-boards.py')
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
def module(path,x,y):
    content=path.read_text()
    root=ET.fromstring(content)
    height=float(root.attrib['height'])
    # Nested SVG retains its own native viewport; no transform or rescale.
    content=re.sub(r'<svg\b',f'<svg x="{x}" y="{y}"',content,count=1)
    return content,height
records=[]
for width, mode in ((1440,"current"),(1280,"current"),(1440,"history"),(1280,"history")):
    x=96; cw=width-120
    history,hh=module(WORK/f'04/integration/history-module-{cw}.svg',x,1130)
    suffix = '-history' if mode == 'history' else ''
    contribution, ch=module(WORK/f'05/integration/contribution-module{suffix}-{cw}.svg',x,1130+hh+24)
    height=int(1130+hh+24+ch+24)
    body=b.nav(height)+b.tx(x,39,'我的交易室',24,b.TEXT,600)+b.tabs(x+228,16,'全部')+b.control(640,16,176,'全部账户','select')+b.control(824,16,36,kind='search')+b.control(868,16,36,kind='filter')+b.tx(width-24,39,'16:32 更新',12,b.MUTED,400,'end')+b.line(x,64,width-24,64)
    body+=b.tx(x,104,'当前表现',18,b.TEXT,600)+b.control(x+150,80,68,'本年',state='pressed')+b.control(x+226,80,68,'本月')+b.control(x+302,80,68,'本周')+b.control(width-256,80,216,'2026-01-01 — 10-15','select')
    body+=b.metrics(x,124,cw)+b.chart(x,226,cw)+b.table(x,586,cw)+history+contribution
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img"><title>首页全貌：当前表现、持仓、历史统计与底部贡献</title><rect width="{width}" height="{height}" fill="{b.BG}"/><g font-family="{b.FONT}">{body}</g></svg>'
    target=OUT/f'home{suffix}-{width}.svg';target.write_text(svg)
    records.append({'file':str(target.relative_to(HERE)), 'width':width,'mode':mode,'height':height,'sha256':hashlib.sha256(svg.encode()).hexdigest(),'status':'NOT_ACCEPTED','regions':{'current':[x,80,cw,466],'holdings':[x,586,cw,520],'history':[x,1130,cw,hh],'contribution':[x,1130+hh+24,cw,ch]}})
(HERE/'homepage-composition.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(records,ensure_ascii=False,indent=2))
