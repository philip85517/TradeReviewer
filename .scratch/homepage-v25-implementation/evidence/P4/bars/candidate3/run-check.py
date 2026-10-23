from pathlib import Path
import json,subprocess,sys
root=Path.cwd(); evidence=Path(__file__).resolve().parent
node="/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node"
name=sys.argv[1]; command=[node]+sys.argv[2:]
r=subprocess.run(command,cwd=root,text=True,capture_output=True)
log="COMMAND "+json.dumps(command,ensure_ascii=False)+"\nSTDOUT\n"+r.stdout+"\nSTDERR\n"+r.stderr+"\nEXIT "+str(r.returncode)+"\n"
(evidence/name).write_text(log);print(log);sys.exit(r.returncode)
