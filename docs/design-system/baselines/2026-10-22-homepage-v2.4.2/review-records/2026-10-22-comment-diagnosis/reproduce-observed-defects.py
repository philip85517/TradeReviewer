from pathlib import Path
import json
p=Path(__file__).parent
d=json.loads((p/'evidence/chart-hover-geometry.json').read_text())
t=d['tooltip'][0]
over=max(x['box']['bottom']-t['panel']['bottom'] for x in t['texts'])
a=json.loads((p/'evidence/approved-d01-calibration.json').read_text())
a=[x for x in a if '(CNY)' in x['text']]
print(f'Tooltip containment: {"FAIL" if over>0 else "PASS"}; bottom overflow={over:.2f}px')
print('Prototype header calibration: '+', '.join(x['text']+' Δ='+x['adjust'] for x in a))
assert over<=0, 'Confirmed current defect: tooltip text is outside its panel'
