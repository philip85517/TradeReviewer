#!/usr/bin/env python3
"""Read-only view of the local wayfinder map; does not claim or close tickets."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent
ISSUES = ROOT / 'issues'
MAP = ISSUES / '02-refactor-map.md'


def field(text, name):
    match = re.search(r'^' + re.escape(name) + r': (.+)$', text, re.M)
    if not match:
        raise ValueError(f'Missing {name}')
    return match.group(1).strip()


def links(text):
    return re.findall(r'\[([^\]]+)\]\(([^)]+)\)', text)


def read_ticket(path):
    text = path.read_text()
    parent = links(field(text, 'Parent'))
    if len(parent) != 1 or (path.parent / parent[0][1]).resolve() != MAP.resolve():
        raise ValueError(f'Invalid parent: {path.name}')
    section = text.split('## Blocked by\n', 1)[1].split('\n## ', 1)[0]
    dependencies = [(path.parent / target).resolve() for _, target in links(section)]
    return dict(path=path.resolve(), title=text.splitlines()[0][2:],
                id=field(text, 'ID'), state=field(text, 'State'),
                assignee=field(text, 'Assignee'), mode=field(text, 'Mode'),
                dependencies=dependencies)


def main():
    args = sys.argv[1:]
    if any(arg not in ('--all', '--mermaid') for arg in args):
        raise ValueError('Usage: frontier.py [--all | --mermaid]')
    tickets = []
    for path in sorted(ISSUES.glob('*.md')):
        if re.search(r'^Parent: .*\(02-refactor-map\.md\)$', path.read_text(), re.M):
            tickets.append(read_ticket(path))
    by_path = {t['path']: t for t in tickets}
    if len({t['id'] for t in tickets}) != len(tickets):
        raise ValueError('Duplicate ticket identity')
    visiting, visited = set(), set()

    def validate(t):
        path = t['path']
        if path in visiting:
            raise ValueError('Dependency cycle: ' + t['title'])
        if path in visited:
            return
        if t['state'] not in ('open', 'closed'):
            raise ValueError('Invalid state: ' + t['title'])
        visiting.add(path)
        for dependency in t['dependencies']:
            if dependency not in by_path:
                raise ValueError('Missing child dependency: ' + str(dependency))
            validate(by_path[dependency])
        visiting.remove(path)
        visited.add(path)

    for t in tickets:
        validate(t)
    if '--mermaid' in args:
        print('flowchart TD')
        names = {t['path']: f'n{i}' for i, t in enumerate(tickets)}
        for t in tickets:
            print(f'  {names[t["path"]]}["{t["title"]}"]')
        for t in tickets:
            for dep in t['dependencies']:
                print(f'  {names[dep]} --> {names[t["path"]]}')
        return
    for t in tickets:
        pending = [by_path[d]['title'] for d in t['dependencies'] if by_path[d]['state'] != 'closed']
        frontier = t['state'] == 'open' and t['assignee'] == 'unassigned' and not pending
        if '--all' not in args and not frontier:
            continue
        state = ('closed' if t['state'] == 'closed' else
                 'claimed' if t['assignee'] != 'unassigned' else
                 'blocked' if pending else 'frontier')
        suffix = '；等待：' + '、'.join(pending) if pending else ''
        print(f'- [{t["title"]}]({t["path"]}) — {state} · {t["mode"]}{suffix}')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, IndexError, OSError) as error:
        raise SystemExit(str(error))
