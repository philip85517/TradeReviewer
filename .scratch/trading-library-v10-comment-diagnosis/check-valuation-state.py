"""Independent reconciliation of the repaired home and pending-review fixture."""
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
import argparse
import hashlib
import json

root = Path(__file__).resolve().parents[2]
task = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--output-dir', type=Path, required=True)
out = parser.parse_args().output_dir
out.mkdir(parents=True, exist_ok=True)
path = root / 'docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/library-design-fixture.json'
f = json.loads(path.read_text(), parse_float=Decimal)
D = Decimal
def money(v):
    return str(D(v).quantize(D('.01'), rounding=ROUND_HALF_UP))

nav, valuation = f['navigation']['home'], f['valuation']
assert valuation['opening_position_count'] == 0
assert D(valuation['opening_unrealized']) == 0
assert valuation['cost_includes_opening_fee'] is True
assert nav['start'] == f['navigation']['live']['start']
assert nav['end'] == f['navigation']['live']['end']

lots = defaultdict(list)
realized = D(0)
daily = []
for date, quotes in sorted(valuation['quotes_by_date'].items()):
    assert nav['start'] <= date <= nav['end']
    for t in sorted(f['live_trades'], key=lambda t: (t['date'], t['id'])):
        if t['date'] != date:
            continue
        code, qty, price, fee = t['code'], D(t['quantity']), D(t['price']), D(t['fee'])
        if t['side'] == '买入':
            lots[code].append({'id': t['id'], 'qty': qty, 'price': price, 'unit_fee': fee / qty})
            continue
        left = qty
        while left:
            lot = lots[code][-1]
            closed = min(left, lot['qty'])
            realized += closed * (price - lot['price'] - lot['unit_fee'] - fee / qty)
            lot['qty'] -= closed
            left -= closed
            if not lot['qty']:
                lots[code].pop()
    active = {code: xs for code, xs in lots.items() if xs}
    assert set(active) <= set(quotes), f'Missing end-of-day valuation on {date}'
    market_value = sum((sum(x['qty'] for x in xs) * D(quotes[code]) for code, xs in active.items()), D(0))
    cost = sum((x['qty'] * (x['price'] + x['unit_fee']) for xs in active.values() for x in xs), D(0))
    unrealized = market_value - cost
    daily.append({'date': date, 'realized': money(realized), 'market_value': money(market_value), 'unrealized': money(unrealized), 'net': money(realized + unrealized - D(valuation['opening_unrealized']))})

assert daily[-1]['market_value'] == '111920.00'
assert daily[-1]['realized'] == '747.14'
assert daily[-1]['unrealized'] == '1831.91'
assert daily[-1]['net'] == '2579.05'
assert set(d['date'] for d in daily) >= set(t['date'] for t in f['live_trades'])
pending = [t for t in f['live_trades'] if t['review_status'] == 'pending']
assert {t['id'] for t in pending} == {'live-01', 'live-02', 'live-04'}
assert next(t['quantity'] for t in pending if t['id'] == 'live-01') == 100
assert not lots['300750'] and next(t for t in pending if t['id'] == 'live-04')
assert lots['688981'] and next(t for t in f['live_trades'] if t['id'] == 'live-05')['review_status'] == 'reviewed'
gap = {d['date']: d for d in f['trend_modes']['gap_scenario']['dates']}
assert gap['2026-10-17']['status'] == gap['2026-10-18']['status'] == 'missing'
assert gap['2026-10-20']['status'] == 'no_trades'
output = {'status': 'PASS', 'fixture_sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'daily_home_valuation': daily, 'pending_review_ids': [t['id'] for t in pending], 'counterexamples': ['closed position remains pending: live-04', 'open position already reviewed: live-05', 'pending original quantity 100, residual position 60: live-01'], 'gap_scenario': gap, 'scope': 'Fixture accounting only; browser evidence must independently reconcile visible values.'}
(out / 'independent-valuation-state.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'status': 'PASS', 'home': daily[-1], 'pending': output['pending_review_ids']}, ensure_ascii=False))
