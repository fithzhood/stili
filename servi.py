"""Server di sviluppo senza cache: python servi.py [porta]  (predefinita 8340).
http.server normale lascia i moduli ES in cache e si collauda codice vecchio."""
import http.server, sys, os, functools

class NoCache(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm',
                      '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream'}
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def log_message(self, *a):
        pass

if __name__ == '__main__':
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else 8340
    root = os.path.dirname(os.path.abspath(__file__))
    h = functools.partial(NoCache, directory=root)
    http.server.ThreadingHTTPServer(('127.0.0.1', porta), h).serve_forever()
