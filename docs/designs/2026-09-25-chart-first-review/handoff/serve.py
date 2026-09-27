#!/usr/bin/env python3
"""Serve the portable design package on loopback only. No business API or database."""
import argparse
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--port', type=int, default=8855)
args = parser.parse_args()
root = Path(__file__).resolve().parent
handler = partial(SimpleHTTPRequestHandler, directory=str(root))
with ThreadingHTTPServer(('127.0.0.1', args.port), handler) as server:
    print(f'TradeReview design: http://127.0.0.1:{server.server_port}/', flush=True)
    print('Ctrl+C to stop. Synthetic demo; no database connection.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
