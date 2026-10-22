from pathlib import Path
b=Path('docs/design-system/baselines/2026-10-20-homepage-v2.4.1')
o=b/'review-records/2026-10-22-comment-repair'
files=['handoff.svg','hcr06-final-sim-ab.svg','journeys-date.svg','01-live-normal.svg','02-simulation-normal.svg','03-distribution-selected.svg','08-extreme.svg','09-missing-input.svg','05-loading.svg','hcr06-final-pending-library.svg','hcr06-final-pending-library-1280.svg','home-1440.svg','home-1280.svg','extreme.svg','holding-option-C-normal-1440.svg']
html='<!doctype html><meta charset="utf-8"><title>交易库修复独立验收</title><style>body{margin:0;background:#0b111b;color:#dbe6f6;font:14px system-ui}nav{position:sticky;top:0;background:#172438;padding:12px;z-index:2}a{color:#88b9ff;margin:0 12px}section{scroll-margin-top:48px;padding:16px}svg{width:100%;height:auto}h2{font-size:16px}</style><nav>'+''.join(f'<a href="#{i}">{i+1}</a>' for i in range(len(files)))+'</nav>'
for i,f in enumerate(files): html+=f'<section id="{i}"><h2>{f}</h2>'+ (b/'source/images'/f).read_text()+'</section>'
(o/'library-acceptance.html').write_text(html)
