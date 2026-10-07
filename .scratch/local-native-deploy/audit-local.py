import datetime, json, pathlib, subprocess

root = pathlib.Path(__file__).resolve().parent
report = root / 'reports/version-audit.json'
previous = json.loads(report.read_text())
archive = root / 'reports/version-audit-initial.json'
if not archive.exists():
    archive.write_text(report.read_text())

def git(*args, cwd=None):
    return subprocess.check_output(['git', *args], cwd=cwd, text=True, timeout=15)

entries = []
for block in git('worktree', 'list', '--porcelain').strip().split('\n\n'):
    item = dict(line.split(' ', 1) if ' ' in line else (line, True) for line in block.splitlines())
    path = pathlib.Path(item['worktree'])
    item['exists'] = path.is_dir()
    item['packageVersion'] = json.loads((path / 'package.json').read_text()).get('version') if item['exists'] else None
    item['changeEntries'] = len(git('status', '--short', cwd=path).splitlines()) if item['exists'] else None
    item['ahead'], item['behind'] = map(int, git('rev-list', '--left-right', '--count', item['HEAD'] + '...' + previous['remoteMaster']).split())
    entries.append(item)

previous['localRecheckedAt'] = datetime.datetime.now().astimezone().isoformat()
previous['remoteVerifiedAt'] = previous['checkedAt']
previous['remoteRefreshResult'] = 'FAILED; see master-dry-run-final.log. No stale fallback.'
previous['worktrees'] = entries
report.write_text(json.dumps(previous, ensure_ascii=False, indent=2) + '\n')
lines = [
    '# 版本核对', '',
    f"本地复核：{previous['localRecheckedAt']}。最近一次成功获取远端：{previous['remoteVerifiedAt']}（北京时间）。随后远端获取失败，不能声称已验证该时间之后的远端状态。", '',
    '各现存 worktree 和正式应用的 package.json 均为 0.1.0；这不能区分代码版本。下表采用 Git 提交号。', '',
    f"桌面启动服务：`{previous['verifiedLegacyCommit']}`；release `20260923-master-ee76e83`；监听 PID 42336；正式入口 `http://127.0.0.1:3022/`。完整提交由已发布源码与 Git 文件比对核实，旧 release 本身缺少 release.json。", '',
    f"最近核实的远端 master：`{previous['remoteMaster']}`。正式服务落后该版本 {previous['aheadOfFormal']} 个提交。本次没有切换正式服务，最终只读进程/目录/HTTP 核验见 [formal-status-final.log](formal-status-final.log)。", '',
    '| Worktree | 分支 | 提交 | 相对已核实远端 master（领先/落后） | 工作区条目 |',
    '| --- | --- | --- | --- | --- |',
]
for item in entries:
    state = str(item['changeEntries']) if item['exists'] else '目录已不存在，Git 残留记录'
    lines.append(f"| `{item['worktree']}` | `{item.get('branch', 'detached').removeprefix('refs/heads/')}` | `{item['HEAD'][:8]}` | {item['ahead']} / {item['behind']} | {state} |")
lines += ['', '所有已有工作区修改均保留；本任务分支为 `codex/local-native-deploy`，修改尚未提交。默认 `make deploy` 会拒绝发布未提交的应用源码；显式 ref 只发布其已提交快照。', '', '旧 release 的 status 显示 `fullcommit=UNKNOWN`，同时 `consistent=true` 仅表示 current 指针、实际运行目录和 HTTP 健康一致，不能证明它与 master 一致。']
(root / 'reports/VERSION-AUDIT.md').write_text('\n'.join(lines) + '\n')
print(json.dumps({'localRecheckedAt': previous['localRecheckedAt'], 'worktrees': len(entries)}, ensure_ascii=False))
