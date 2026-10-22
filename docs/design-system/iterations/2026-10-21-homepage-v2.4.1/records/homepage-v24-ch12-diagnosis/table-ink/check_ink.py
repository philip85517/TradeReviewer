"""Check rendered text ink, not SVG advance boxes. Re-capture after fixture changes."""
from pathlib import Path
from PIL import Image
im = Image.open(Path(__file__).with_name('fixture-browser.jpg')).convert('RGB')
results = []
for i, name in enumerate(['original-fullwidth-12', 'ascii-12', 'fullwidth-14', 'field-only-12']):
    edges = []
    for baseline in [40 + i * 100, 70 + i * 100]:
        points = [(x, y) for y in range(baseline - 18, baseline + 2)
                  for x in range(260, 405) if min(im.getpixel((x, y))) > 115]
        edges.append(max(x for x, y in points))
    gap = edges[1] - edges[0]
    results.append(gap)
    print(f'{name}: header={edges[0]}, value={edges[1]}, ink-gap={gap}px')
assert abs(results[0]) <= 2, f'FAIL: original visible edge mismatch {results[0]}px (tolerance 2px)'
