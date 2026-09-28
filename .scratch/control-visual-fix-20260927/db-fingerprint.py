import sqlite3,json,hashlib,sys
from pathlib import Path
cfg=json.loads(Path('conf/runtime.json').read_text())
c=sqlite3.connect('file:'+cfg['databasePath']+'?mode=ro',uri=True)
r={'databasePath':cfg['databasePath'],'tables':{}}
for t in ['executions','instruments','import_batches']:
 rows=c.execute('SELECT * FROM "'+t+'" ORDER BY rowid').fetchall()
 h=hashlib.sha256()
 for row in rows:h.update(repr(row).encode())
 r['tables'][t]={'count':len(rows),'sha256':h.hexdigest()}
Path(sys.argv[1]).write_text(json.dumps(r,indent=2)+'\n')
print(json.dumps({k:v['count'] for k,v in r['tables'].items()}))
