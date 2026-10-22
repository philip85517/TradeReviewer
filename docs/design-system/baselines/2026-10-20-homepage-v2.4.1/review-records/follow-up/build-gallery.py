"""Rebuild a read-only visual acceptance gallery from the current document references."""
from pathlib import Path
import re, json, hashlib, html
root=Path(__file__).resolve().parents[2]
source=root/'source/visual-design.candidate.md'
refs=list(dict.fromkeys(re.findall(r'images/[A-Za-z0-9_-]+\.svg',source.read_text())))
boards=[]
for ref in refs:
 p=root/'source'/ref
 boards.append({'name':p.name,'hash':hashlib.sha256(p.read_bytes()).hexdigest(),'svg':p.read_text()})
data=json.dumps(boards,ensure_ascii=False).replace('</','<\\/')
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>V2.4.1 逐图验收台</title><style>
*{box-sizing:border-box}body{margin:0;background:#0b1019;color:#e7edf7;font:14px system-ui}header{padding:12px 20px;background:#172333;display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:1}select,button{font:inherit;color:inherit;background:#172333;border:1px solid #526176;border-radius:5px;padding:6px 10px}main{overflow:auto;padding:16px}main svg{display:block;max-width:none}small{color:#a8b6cb}.note{padding:8px 20px;color:#a8b6cb}</style>
<header><strong>逐图验收 · 文档工具</strong><button id="prev">上一图</button><select id="choose" aria-label="验收图稿"></select><button id="next">下一图</button><small id="count"></small></header><div class="note">按图稿原始尺寸显示；此页面用于验收，不属于产品视觉。检查正文关联图稿，历史候选保留原样。</div><main id="board"></main><script>
const boards=DATA; const choose=document.querySelector('#choose'); boards.forEach((b,i)=>choose.add(new Option(b.name,i))); let i=Math.max(0,boards.findIndex(b=>b.name===new URLSearchParams(location.search).get('board')));function show(){choose.value=i;document.querySelector('#board').innerHTML=boards[i].svg;document.querySelector('#count').textContent=`${i+1} / ${boards.length} · ${boards[i].hash.slice(0,12)}`;history.replaceState(null,'','?board='+boards[i].name);document.querySelector('#prev').disabled=i===0;document.querySelector('#next').disabled=i===boards.length-1;}choose.onchange=()=>{i=+choose.value;show()};document.querySelector('#prev').onclick=()=>{i--;show()};document.querySelector('#next').onclick=()=>{i++;show()};show();</script></html>'''.replace('DATA',data)
(root/'review-records/follow-up/gallery.html').write_text(page)
(root/'review-records/follow-up/board-hashes.json').write_text(json.dumps([{k:v for k,v in b.items() if k!='svg'} for b in boards],indent=2))
print(len(boards),'boards')
