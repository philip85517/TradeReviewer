"""Build the accepted board ownership map, then the reader."""
import importlib.util
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'source'
spec = importlib.util.spec_from_file_location('strategy_visual_base', SOURCE / 'build-artboards.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
for name in ('06-observe.svg', '06-observe-status-detail.svg'):
    base.save(name, base.BUILDERS[name]())
for script in ('build-library-forms.py', 'build-time-results.py', 'build-responsive.py'):
    subprocess.run([sys.executable, str(SOURCE / script)], check=True)
subprocess.run([sys.executable, str(ROOT / 'build-visual-spec.py')], check=True)
