#!/usr/bin/env python3
"""
Dev server for web/. Plain static files -- the app has no build step -- but with
caching turned OFF.

`python3 -m http.server` serves Last-Modified and no Cache-Control, so browsers
apply heuristic caching to ES modules. Editing a module and reloading then runs
the OLD code, which looks exactly like a logic bug and wastes an afternoon.

    python3 dev-server.py [port]            # http://localhost:8731/
    python3 dev-server.py --host 0.0.0.0    # reach from other devices on the LAN
"""
import argparse
import functools
import http.server
import os
import socket
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    # WebAssembly must be served as application/wasm: the browser only uses its
    # streaming compiler for that type, and while Emscripten falls back to
    # instantiating from an ArrayBuffer, that costs an extra full copy of the 7.6MB
    # STEP engine. Python's mimetypes reads the Windows registry, which does not
    # know .wasm, so state it here instead of leaving it to the OS.
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.wasm': 'application/wasm',
    }

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):        # one line per request, no noise
        sys.stderr.write(f"{self.command} {self.path} -> {args[1]}\n")


def _lan_ip():
    """Best-effort LAN address for the "reachable at" hint. No packets are sent."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))  # pick a route; the OS resolves the local end without sending
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return None


def main():
    parser = argparse.ArgumentParser(
        description='Support Fins no-cache dev server.',
        epilog='Bind 0.0.0.0 (or ::) to reach the server from other devices on your LAN.',
    )
    parser.add_argument('port', nargs='?', type=int, default=8731,
                        help='port to listen on (default: 8731)')
    parser.add_argument('--host', default='127.0.0.1',
                        help='address to bind (default: 127.0.0.1; 0.0.0.0 exposes it to the LAN)')
    args = parser.parse_args()

    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'web')  # serve ./web from the repo root
    handler = functools.partial(NoCacheHandler, directory=root)
    print(f"support-fins dev server: http://localhost:{args.port}/  (serving {root})")
    wildcard = args.host in ('0.0.0.0', '::', '')
    if wildcard:
        ip = _lan_ip()
        if ip:
            print(f"On other devices on your LAN, open http://{ip}:{args.port}/")
    bind = '' if wildcard else args.host
    sys.stdout.flush()  # ensure the lines above land in a redirected log immediately (e.g. headless RPi)
    http.server.ThreadingHTTPServer((bind, args.port), handler).serve_forever()


if __name__ == '__main__':
    main()
