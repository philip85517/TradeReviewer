#!/usr/bin/env python3
"""Rebuild the V2 reader and its companion review/source pages."""
import importlib.util
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('homepage_reader', HERE / 'build-visual-spec.py')
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)
reader.build(
    source_path=HERE / 'visual-design.md',
    output_path=HERE / 'visual-spec.html',
    manifest_path=HERE / 'document-manifest.json',
    identity_path=HERE / 'document-identity.json',
    document_id='HOME-DOC-V2', version='2.0',
)
for name in ('sources', 'comment-review', 'acceptance'):
    path = HERE / f'{name}.md'
    if path.exists():
        reader.build_companion_page(path, HERE / f'{name}.html', version='2.0')
print('V2 reader and companion pages rebuilt')
