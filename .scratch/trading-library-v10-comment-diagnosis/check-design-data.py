"""Independently account for sample lots/fees without importing the SVG generator."""
from pathlib import Path
from decimal import Decimal, ROUND_HALF_UP
from collections import defaultdict
import hashlib
import json
import argparse

root = Path(__file__).resolve().parents[2]
task = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--output-dir', type=Path, default=task / 'evidence/repair')
out = parser.parse_args().output_dir
out.mkdir(parents=True, exist_ok=True)
path = root / 'docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/library-design-fixture.json'
f = json.loads(path.read_text(), parse_float=Decimal)
D = Decimal
cent = D('.01')
def money(x): return str(D(x).quantize(cent, rounding=ROUND_HALF_UP))
def account(trades, date_override=None):
    lots, closed = [], []
    fee_total = sum(D(t['fee']) for t in trades)
    for t in trades:
        q, p, fee = D(t['quantity']), D(t['price']), D(t['fee'])
        if t['side'] == '买入':
            lots.append({'id':t['id'], 'q':q, 'price':p, 'unit_fee':fee/q})
        else:
            remaining = q
            while remaining:
                assert lots, 'Closing quantity exceeds sample inventory'
                opening = lots[-1]
                matched = min(opening['q'], remaining)
                fees = matched * (opening['unit_fee'] + fee/q)
                closed.append({'open':opening['id'], 'close':t['id'], 'date':date_override or t['date'], 'quantity':int(matched), 'gross':(p-opening['price'])*matched, 'fees':fees, 'net':(p-opening['price'])*matched-fees, 'basis':opening['price']*matched})
                remaining -= matched; opening['q'] -= matched
                if not opening['q']: lots.pop()
    open_fees = sum(x['q']*x['unit_fee'] for x in lots)
    assert sum(x['fees'] for x in closed)+open_fees == fee_total
    return closed, int(sum(x['q'] for x in lots)), open_fees

live_by_symbol = defaultdict(list)
for t in f['live_trades']: live_by_symbol[t['code']].append(t)
live = []
for trades in live_by_symbol.values(): live.extend(account(sorted(trades, key=lambda t:t['date']))[0])
sim, exercises = [], []
for e in f['simulation_exercises']:
    rounds, unclosed, open_fees = account(e['trades'], e['saved_date'])
    if 'expected_closed_rounds' in e: assert len(rounds) == e['expected_closed_rounds']
    if 'expected_open_quantity' in e: assert unclosed == e['expected_open_quantity']
    if e['label'] == '练习 A':
        assert [r['quantity'] for r in rounds] == [50,30]
        assert [money(r['net']) for r in rounds] == ['990.00','894.00']
        assert unclosed == 70 and money(open_fees) == '7.00'
    sim.extend(rounds)
    exercises.append({'id':e['id'], 'date':e['saved_date'], 'closed':len(rounds), 'open_quantity':unclosed, 'open_fees':money(open_fees), 'net':money(sum(r['net'] for r in rounds)), 'rounds':rounds})

def stats(rounds):
    daily = defaultdict(Decimal)
    for r in rounds: daily[r['date']] += r['net']
    positive = [r['net'] for r in rounds if r['net']>0]
    negative = [r['net'] for r in rounds if r['net']<0]
    return {'rounds':len(rounds), 'wins':len(positive), 'losses':len(negative), 'zero':len(rounds)-len(positive)-len(negative), 'net':money(sum(r['net'] for r in rounds)), 'fees':money(sum(r['fees'] for r in rounds)), 'win_rate':money(D(len(positive))/len(rounds)*100) if rounds else None, 'average_profit':money(sum(positive)/len(positive)) if positive else None, 'average_loss':money(sum(negative)/len(negative)) if negative else None, 'daily':{k:money(v) for k,v in sorted(daily.items())}}
output={'fixture_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'scope':'Static design fixture only; no business database accessed','live':stats(live),'simulation':stats(sim),'exercises':exercises}
assert len(output['live']['daily'])>=5 and len(output['simulation']['daily'])>=5, 'Normal trend requires at least five effective dates per view'
assert any(D(v)<0 for v in output['simulation']['daily'].values()), 'Simulation normal sample must show a losing period'
encoded=json.dumps(output,ensure_ascii=False,indent=2,default=lambda x:money(x) if isinstance(x,Decimal) else str(x))+'\n'
(out/'independent-data.json').write_text(encoded)
print('PASS: independent LIFO lot accounting, closed/open fee conservation, A=50+30 closed with 70 open; normal live/simulation trends have >=5 effective dates.')
print(json.dumps({k:output[k] for k in ['live','simulation']},ensure_ascii=False))
