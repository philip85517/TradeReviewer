import json
import pathlib
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parents[6]
node = "/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node"
command = [node, *sys.argv[2:]]
result = subprocess.run(command, cwd=root, text=True, capture_output=True)
log = "COMMAND " + json.dumps(command, ensure_ascii=False) + "\nSTDOUT\n" + result.stdout + "\nSTDERR\n" + result.stderr + "\nEXIT " + str(result.returncode) + "\n"
pathlib.Path(__file__).with_name(sys.argv[1]).write_text(log)
print(log)
sys.exit(result.returncode)
