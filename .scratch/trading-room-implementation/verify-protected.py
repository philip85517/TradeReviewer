from pathlib import Path
import sqlite3,hashlib,json,sys
base=Path(__file__).resolve().parent
p=base/'reports/protected-baseline.json'
source_path=Path('/Users/zhoulin/projects/TradeReview/data/sqlite/tradereview.sqlite')
con=sqlite3.connect(source_path.as_uri()+'?mode=ro',uri=True)
data={}
for table in ['executions','instruments','trade_revisions','import_batches','reviews','app_settings']:
 rows=con.execute('select * from "'+table+'"').fetchall()
 values=sorted(json.dumps(r,ensure_ascii=False,default=str) for r in rows)
 data[table]={'count':len(rows),'sha256':hashlib.sha256('\n'.join(values).encode()).hexdigest()}
con.close()
if '--record' in sys.argv:
 p.write_text(json.dumps({'source':str(source_path),'tables':data},ensure_ascii=False,indent=2))
 print('Recorded protected table baseline', {k:v['count'] for k,v in data.items()})
else:
 expected=json.loads(p.read_text())['tables']
 changed=[t for t in data if data[t]!=expected.get(t)]
 print('Protected table verification:', 'UNCHANGED' if not changed else 'CHANGED '+','.join(changed))
 if changed: sys.exit(1)
