#!/usr/bin/env python3
"""Validate the complete three-document split and immutable content evidence."""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).resolve().parents[2] / 'iterations/2026-10-22-design-doc-split/verify.py'), run_name='__main__')
