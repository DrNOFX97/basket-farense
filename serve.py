#!/usr/bin/env python3
"""Servidor da web app do Farense Basket.

    python3 serve.py              # http://localhost:8000
    python3 serve.py --port 9000
    python3 serve.py --no-live    # sem polling a API
    python3 serve.py --no-auto    # nao refaz os dados sozinho

Serve a pasta app/, o JSON de dados (com gzip), /versao.json e /api/live.
Biblioteca padrao apenas. Sem build step, sem dependencias.
"""
import argparse
import gzip
import json
import mimetypes
import os
import subprocess
import sys
import threading
import time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote

BASE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(BASE, 'app')
DATA = os.path.join(BASE, 'data', 'farense.json')
PORT = 8000
REBUILD_CADA = 20 * 60   # refaz os dados de 20 em 20 minutos
REBUILD_APOS_JOGO = 60   # e 1 minuto depois de um jogo deixar de estar LIVE
GYZ = {'.html', '.css', '.js', '.json', '.svg'}

estado = None
_cache = {}


def ler_json():
    m = os.path.getmtime(DATA)
    c = _cache.get('json')
    if c and c[0] == m:
        return c[1]
    try:
        dados = json.load(open(DATA, encoding='utf-8'))
    except ValueError:  # build_data.py a meio de escrever: serve a versao anterior
        if c:
            return c[1]
        raise
    _cache['json'] = (m, dados)
    return dados


def rebuild():
    """Refaz data/farense.json ignorando a cache da agenda (fica desatualizada)."""
    print('dados: a atualizar...')
    r = subprocess.run([sys.executable, os.path.join(BASE, 'build_data.py'), '--sem-cache'],
                       cwd=BASE, capture_output=True, text=True)
    print('dados: atualizados' if r.returncode == 0
          else f'dados: falhou ({(r.stderr or r.stdout).strip()[-200:]})')


def auto_atualizar():
    """Atualiza periodicamente e logo apos um jogo terminar (LIVE -> outro estado)."""
    ultimo, vivos = time.time(), set()
    pendente = None
    while True:
        time.sleep(5)
        if estado is not None:
            with estado.lock:
                agora = {j['fid'] for j in (estado.snap or {}).get('jogos', [])
                         if j.get('status') == 'LIVE'}
            if vivos - agora:
                pendente = time.time() + REBUILD_APOS_JOGO
            vivos = agora
        if (pendente and time.time() >= pendente) or time.time() - ultimo >= REBUILD_CADA:
            pendente = None
            try:
                rebuild()
            except Exception as e:
                print(f'dados: erro {e}')
            ultimo = time.time()


def versao_local():
    """Hora da última alteração ao shell, para imitar o build de produção."""
    fontes = [os.path.join(APP, 'index.html'),
              os.path.join(APP, 'js', 'app.js'),
              os.path.join(APP, 'css', 'app.css')]
    m = max(os.path.getmtime(p) for p in fontes if os.path.exists(p))
    return datetime.fromtimestamp(m).astimezone().isoformat(timespec='seconds')


class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, fmt, *a):
        if '/api/live' not in self.path:
            print(f'  {self.address_string()} {fmt % a}')

    # -- helpers --------------------------------------------------------
    def enviar(self, corpo, ctype, status=200):
        aceita = 'gzip' in (self.headers.get('Accept-Encoding') or '')
        if aceita and len(corpo) > 2048:
            corpo = gzip.compress(corpo, 6)
            extra = {'Content-Encoding': 'gzip'}
        else:
            extra = {}
        self.send_response(status)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(corpo)))
        self.send_header('Cache-Control', 'no-cache')
        for k, v in extra.items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(corpo)

    def json(self, obj, status=200):
        self.enviar(json.dumps(obj, ensure_ascii=False).encode(),
                    'application/json; charset=utf-8', status)

    def ficheiro(self, caminho):
        if not os.path.isfile(caminho):
            return self.enviar(b'{"erro":"nao encontrado"}', 'application/json', 404)
        ctype, _ = mimetypes.guess_type(caminho)
        if caminho.endswith('.js'):
            ctype = 'text/javascript; charset=utf-8'
        elif ctype and ctype.startswith('text/'):
            ctype += '; charset=utf-8'
        self.enviar(open(caminho, 'rb').read(), ctype or 'application/octet-stream')

    # -- rotas ----------------------------------------------------------
    def do_GET(self):
        caminho = unquote(self.path.split('?')[0])

        if caminho == '/api/live':
            if estado is None:
                return self.json({'atualizado': None, 'jogos': [],
                                  'erro': 'ao vivo desligado'})
            with estado.lock:
                snap = estado.snap
            return self.json(snap or {'atualizado': None, 'jogos': [],
                                      'erro': 'a carregar'})

        if caminho == '/api/meta':
            d = ler_json()
            return self.json({'gerado': d.get('gerado'), 'epocas':
                              [e['id'] for e in d['epocas']]})

        if caminho == '/versao.json':
            # Em produção este ficheiro é criado no build; em local usa a hora
            # da última alteração ao shell.
            return self.json({'construido': versao_local()})

        if caminho == '/data/farense.json':
            return self.enviar(json.dumps(ler_json(), ensure_ascii=False,
                                          separators=(',', ':')).encode(),
                               'application/json; charset=utf-8')

        if caminho in ('/', '/index.html'):
            return self.ficheiro(os.path.join(APP, 'index.html'))

        # impede subir de pasta
        rel = os.path.normpath(caminho.lstrip('/')).replace('\\', '/')
        if rel.startswith('..') or rel.startswith('/'):
            return self.enviar(b'{"erro":"caminho invalido"}', 'application/json', 400)
        self.ficheiro(os.path.join(APP, rel))


def main():
    global PORT, estado
    ap = argparse.ArgumentParser()
    ap.add_argument('--port', type=int, default=8000)
    ap.add_argument('--host', default='0.0.0.0')
    ap.add_argument('--no-live', action='store_true')
    ap.add_argument('--no-auto', action='store_true')
    a = ap.parse_args()
    PORT = a.port

    if not os.path.exists(DATA):
        raise SystemExit('falta data/farense.json — corre: python3 build_data.py')

    if not a.no_live:
        try:
            from live import Estado
            estado = Estado()
            threading.Thread(target=estado.loop, daemon=True).start()
            print('modo ao vivo: ligado (polling a API)')
        except Exception as e:
            print(f'modo ao vivo indisponivel: {e}')
    else:
        print('modo ao vivo: desligado')

    if not a.no_auto:
        threading.Thread(target=auto_atualizar, daemon=True).start()
        print('dados: atualizacao automatica ligada (20 min e no fim dos jogos)')

    d = ler_json()
    n = sum(len(t['jogos']) for e in d['epocas'] for t in e['equipas'])
    print(f'dados: {len(d["epocas"])} epocas, '
          f'{sum(len(e["equipas"]) for e in d["epocas"])} equipas, {n} jogos')
    print(f'a servir em http://localhost:{PORT}')
    try:
        ThreadingHTTPServer((a.host, PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        print('\nfechado')


if __name__ == '__main__':
    main()
