"""Local-only dashboard server. POST /api/refresh performs an on-demand official-source update."""
import argparse
import functools
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
import json
from pathlib import Path
import threading
import time
import urllib.parse
import webbrowser
from ingest import run,ROOT

refresh_lock=threading.Lock()
last_success=0
refresh_error=None

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        super().end_headers()

    def json_response(self,payload,status=200):
        encoded=json.dumps(payload,ensure_ascii=False,allow_nan=False).encode('utf-8')
        self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(encoded)));self.end_headers();self.wfile.write(encoded)

    def snapshot(self):
        data=json.loads((ROOT/'data/normalized/latest.json').read_text(encoding='utf-8'))
        if refresh_error:data['meta']['refreshError']=True
        return data

    def allowed_host(self):
        return self.headers.get('Host') in (f'127.0.0.1:{self.server.server_port}',f'localhost:{self.server.server_port}')

    def do_GET(self):
        if not self.allowed_host():return self.json_response({'error':'invalid_host'},403)
        path=urllib.parse.urlparse(self.path).path
        if path=='/api/h41':
            try:return self.json_response(self.snapshot())
            except (OSError,ValueError):return self.json_response({'error':'snapshot_unavailable'},503)
        if path=='/':self.path='/FedBalanceSheet_v1.html'
        # Expose only the dashboard and its public data/assets, not Git or scripts.
        path=urllib.parse.unquote(urllib.parse.urlparse(self.path).path)
        if '..' in Path(path).parts or not (path in ('/FedBalanceSheet_v1.html','/FedBalanceSheet_v2.html','/FedBalanceSheet_v3.html') or path.startswith('/assets/') or path in ('/language-table.csv','/data/quality-report.json')):
            return self.json_response({'error':'not_found'},404)
        return super().do_GET()

    def do_POST(self):
        global last_success,refresh_error
        expected_origin=f'http://{self.headers.get("Host","")}'
        if not self.allowed_host() or self.headers.get('Origin')!=expected_origin or self.headers.get('X-FED-Refresh')!='1' or self.headers.get('Content-Type')!='application/json':
            return self.json_response({'error':'same_origin_required'},403)
        if self.path!='/api/refresh':return self.json_response({'error':'not_found'},404)
        if not refresh_lock.acquire(blocking=False):return self.json_response({'error':'refresh_in_progress'},409)
        try:
            if time.monotonic()-last_success<60:return self.json_response(self.snapshot())
            snapshot=run();refresh_error=None;last_success=time.monotonic();return self.json_response(snapshot)
        except Exception as exc:
            refresh_error=str(exc)
            print('Refresh failed; previous snapshot preserved:',exc,flush=True)
            return self.json_response({'error':'official_source_refresh_failed'},502)
        finally:refresh_lock.release()

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8765);parser.add_argument('--open',action='store_true');args=parser.parse_args()
    handler=functools.partial(Handler,directory=str(ROOT))
    with ThreadingHTTPServer(('127.0.0.1',args.port),handler) as server:
        url=f'http://127.0.0.1:{server.server_port}/FedBalanceSheet_v1.html'
        print('FED Balance Sheet: '+url,flush=True)
        if args.open:webbrowser.open(url)
        server.serve_forever()
