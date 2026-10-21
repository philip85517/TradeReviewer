"""Generate the bounded owner-01 table asset batch from the copied V2.3 builder."""
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

ROOT = Path(__file__).parent
spec = spec_from_file_location('integration_build_boards', ROOT / 'build-boards.py')
builder = module_from_spec(spec)
spec.loader.exec_module(builder)

state_spec = spec_from_file_location('integration_state_boards', ROOT / 'state-boards.py')
state_boards = module_from_spec(state_spec)
state_spec.loader.exec_module(state_boards)

API = builder.__dict__
state_frames = state_boards.build_states(API)

# Keep the original comment/image identity attached to every generated file.
MAPPING = {
    'count-scales': ('count-scales.svg', 'c19c9e0376c82a6da59114d328ff64ef941ab7bbefccc52abeff3d78f4a52675', 'count-scales@262'),
    'local-search-pages': ('local-search-pages.svg', 'ed7ea8311786997cf1ff5a3b9cc6faf222b0372a35e796a069fc6367dfcff163', 'local-search-pages@270'),
    '50-items': ('50-items.svg', '5c8a59d6139fcfb9ca85c696c3b72d8df7d5ea728f17dae570df4a9930d804ea', '50-items@272'),
    'holding-return': ('holding-return.svg', '6a91c31dd5a39a1a7427a450fbe01b116e0371498c2ea0361caffc9d31e71281', 'holding-return@280'),
    'empty': ('empty.svg', '2d8d996d559417031f702eb85b2dc6929934704e705a2f80b6ae3fd0e507efbe', 'empty@293; empty@state-demo-4-1'),
    'count-boundaries': ('count-boundaries.svg', 'e087740b9439d825254e6d83637815ac11a17cedd07fe8ff369a5351d0beb663', 'count-boundaries@295'),
    'extreme': ('extreme.svg', '8d436e0fbac13ba4e115547bef80a792f28244fddc7fb52f4d5be55282b6ea97', 'extreme@297'),
    'atoms': ('atoms.svg', '512372500969bb24f2e108af7617d4f0b380eeda31da480c5e6d0a270ccf275c', 'atoms@441'),
    'search': ('search.svg', '0ea535dae0cd11824877ad3fdb93a92a1cace366b89106f6fc2304127bd4e276', 'search@state-demo-1-1'),
    'search-detail': ('search-detail.svg', 'bb16d120de9e61fb2160e972c90150b2edd1143e92c60cea43b636798a149660', 'search-detail@state-demo-1-2'),
    'filter': ('filter.svg', '71948cd37cf01f21105b876a05eedd6a86d9afcff47854bf5f37cb2f8d7cb900', 'filter@state-demo-2-1'),
    'multi-applied': ('multi-applied.svg', '6c6cfb0f9d8c6fa2b566642d8819225f29750632b461596b6e2531d7e358100e', 'multi-applied@state-demo-2-2'),
    'clear-attachments': ('clear-attachments.svg', '2d4428ec9c83a1550644e5a40b00dc20d8cb7f1183c7a9e033c306589462bbeb', 'clear-attachments@state-demo-2-3'),
    'reset': ('reset.svg', '3cfe9f83d1b2317dd0c9486c6f10febb666921e5881b99b33d2887730cb32390', 'reset@state-demo-2-4'),
    'cancel': ('cancel.svg', '71516192600657d6528ba8ce0189b3301b34eaf9445635b02551e51f146bb95b', 'cancel@state-demo-2-5'),
    'period': ('period.svg', '6241240055318f17406c51776d5389516f4d2287bb51129e1ad17776225c099a', 'period@194'),
    'chart-hover': ('chart-hover.svg', '4e50cce156e2a1441bffee14b99f48e17e9bfa311d90305be0f0875a84607178', 'chart-hover@state-demo-3-1'),
    'chart-gap': ('chart-gap.svg', '2a84a3d216cf73a0a06c46dc797df1ffad4e0cdb17ff81cdc1761848f7a98a35', 'chart-gap@state-demo-3-2'),
    'chart-scale': ('chart-scale.svg', 'cd7c2d3c3925121a379daf9d7cae906266026060b4c947bc042d152c3beb738f', 'chart-scale@state-demo-3-3'),
    'loading': ('loading.svg', '8c17174451c6c796a14064f226434164a3bcf7ad3d2e390dd56551bf37b90ed4', 'loading@state-demo-4-2'),
    'error': ('error.svg', 'f1c66669a111bf925f03d11bb8e5ddc0cd64eed0648828670454bc2e4fa0e1a8', 'error@state-demo-4-3'),
    'repair': ('repair.svg', '673352fb495f2ddade99221576fdcf10ad1950903995bca7143f51f185fcca81', 'repair@state-demo-4-4'),
    'account': ('account.svg', '4fbe047c7612c5c9dc5552b39f6aa9e48a46adf83d4b57466e69fb115394d533', 'account@110'),
    'detail': ('detail.svg', '9d6fb789a7cc415452bc1a943f6a65540f7a7f3b222c3774c1d6a1838f1b472d', 'detail@139'),
    # The original board has no standalone builder entry. Keep this candidate
    # explicitly derived from the shared atoms board until root visual review.
    'visual-samples-board': ('visual-samples-board.svg', '6e763d3acf3f0f02cb705bed4af77272898044cddcd377bf2e087fed96b4ecb8', 'visual-samples-board@63'),
}

def add_identity(path, original, sha, occurrence):
    svg = path.read_text()
    metadata = f'<metadata data-original-asset="docs/design-system/baselines/2026-10-18-homepage-v2.3/images/{original}" data-original-sha256="{sha}" data-original-occurrence="{occurrence}" data-owner="01" data-status="NOT_ACCEPTED"/>'
    path.write_text(svg.replace('><style>', f'>{metadata}<style>', 1))

for name, (original, sha, occurrence) in MAPPING.items():
    data = builder.panel('holding-return') if name == 'holding-return' else state_frames.get(name)
    if data is None:
        data = builder.panel('atoms') if name == 'visual-samples-board' else builder.panel(name)
    builder.save(name, data)
    path = ROOT / 'images' / f'{name}.svg'
    add_identity(path, original, sha, occurrence)
    if name == 'visual-samples-board':
        svg = path.read_text()
        path.write_text(svg.replace('data-status="NOT_ACCEPTED"', 'data-status="NOT_ACCEPTED" data-derived-from="panel:atoms"', 1))
    print(f'generated images/{name}.svg')
