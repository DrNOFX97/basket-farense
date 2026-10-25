#!/usr/bin/env python3
"""
swish_client.py — cliente para a API do SWISH by NBN23.

Fluxo recuperado por engenharia reversa do APK 2.10.0 (com.nbn23.fansapp):
  BuildConfig.FIREBASE_ANDROID_WEBCLIENTID / API key  -> Firebase Auth (email+password)
  idToken do Firebase                                 -> Authorization: Bearer <idToken>
  BuildConfig.GRAPHQL_URL                             -> https://internal.nbn23.app/graphql

Credenciais, por ordem de preferência:
  env  SWISH_EMAIL / SWISH_PASSWORD
  ficheiro .env ao lado deste script   (SWISH_EMAIL=... e SWISH_PASSWORD=...)

O token fica em cache no directório de cache do utilizador, nunca no projecto.

Uso:
  python3 swish_client.py login
  python3 swish_client.py q 'query { home { competition { fid name projectKey } } }'
  python3 swish_client.py q-file gql/query_GetHomeData.graphql
"""

import json
import os
import sys
import urllib.error
import urllib.request

FIREBASE_KEY = 'AIzaSyDfES1qET23MQ0Y5_cgbDYbeQ168xVcpiA'
GRAPHQL_URL = 'https://internal.nbn23.app/graphql'
PKG = 'com.nbn23.fansapp'
VERSION = '2.10.0'
BASE = os.path.dirname(os.path.abspath(__file__))


def _cache_dir():
    if os.name == 'nt':
        raiz = os.environ.get('LOCALAPPDATA') or os.path.expanduser('~')
    else:
        raiz = os.environ.get('XDG_CACHE_HOME') or os.path.join(os.path.expanduser('~'), '.cache')
    pasta = os.path.join(raiz, 'farense-basket')
    try:
        os.makedirs(pasta, exist_ok=True)
    except OSError:
        pass
    return pasta


TOKEN_CACHE = os.path.join(_cache_dir(), 'token.json')

ENV_FILE = os.path.join(BASE, '.env')


def _post(url, body, headers=None, timeout=30):
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(),
        headers={'Content-Type': 'application/json', **(headers or {})},
        method='POST')
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw or b'{}')
        except json.JSONDecodeError:
            return e.code, {'raw': raw.decode('utf-8', 'replace')[:400]}


def _ler_env(caminho):
    valores = {}
    try:
        linhas = open(caminho, encoding='utf-8').read().splitlines()
    except OSError:
        return valores
    for linha in linhas:
        linha = linha.strip()
        if not linha or linha.startswith('#') or '=' not in linha:
            continue
        chave, _, valor = linha.partition('=')
        valores[chave.strip()] = valor.strip().strip("\"'")
    return valores


def credentials():
    email = os.environ.get('SWISH_EMAIL')
    pw = os.environ.get('SWISH_PASSWORD')
    if not (email and pw):
        env = _ler_env(ENV_FILE)
        email = email or env.get('SWISH_EMAIL')
        pw = pw or env.get('SWISH_PASSWORD')
    if email and pw:
        return email, pw
    raise SystemExit(
        'faltam credenciais: define SWISH_EMAIL e SWISH_PASSWORD '
        f'no ambiente ou em {ENV_FILE}')


class Swish:
    def __init__(self):
        self.id_token = None
        self.refresh_token = None
        self._load_token()

    # -- token cache ---------------------------------------------------
    def _load_token(self):
        if not os.path.exists(TOKEN_CACHE):
            return
        try:
            d = json.load(open(TOKEN_CACHE))
            self.id_token = d.get('idToken')
            self.refresh_token = d.get('refreshToken')
        except Exception:
            pass

    def _save_token(self):
        with open(TOKEN_CACHE, 'w') as f:
            json.dump({'idToken': self.id_token,
                       'refreshToken': self.refresh_token}, f)
        os.chmod(TOKEN_CACHE, 0o600)

    # -- auth ----------------------------------------------------------
    def login(self):
        email, pw = credentials()
        st, d = _post(f'https://identitytoolkit.googleapis.com/v1/accounts:'
                      f'signInWithPassword?key={FIREBASE_KEY}',
                      {'email': email, 'password': pw, 'returnSecureToken': True})
        if st != 200:
            msg = d.get('error', {}).get('message', d)
            raise SystemExit(f'login falhou ({st}): {msg}')
        self.id_token = d['idToken']
        self.refresh_token = d.get('refreshToken')
        self._save_token()
        return d

    def refresh(self):
        if not self.refresh_token:
            self.login()
            return
        st, d = _post(f'https://securetoken.googleapis.com/v1/token?key={FIREBASE_KEY}',
                      {'grant_type': 'refresh_token', 'refresh_token': self.refresh_token})
        if st != 200 or 'id_token' not in d:
            self.login()
            return
        self.id_token = d['id_token']
        self.refresh_token = d.get('refresh_token', self.refresh_token)
        self._save_token()

    # -- graphql -------------------------------------------------------
    def gql(self, query, variables=None):
        if not self.id_token:
            self.login()
        body = {'query': query}
        if variables:
            body['variables'] = variables
        headers = {
            'Authorization': 'Bearer ' + self.id_token,
            'x-package-name': PKG,
            'x-package-version': VERSION,
        }
        st, d = _post(GRAPHQL_URL, body, headers)
        if st == 401:
            self.refresh()
            headers['Authorization'] = 'Bearer ' + self.id_token
            st, d = _post(GRAPHQL_URL, body, headers)
        return st, d


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 1
    c = Swish()
    cmd = argv[1]

    if cmd == 'login':
        d = c.login()
        print(json.dumps({k: d.get(k) for k in
                          ('localId', 'email', 'displayName', 'registered')},
                         ensure_ascii=False, indent=2))
        print('token guardado em', TOKEN_CACHE)
        return 0

    if cmd == 'q':
        st, d = c.gql(argv[2])
    elif cmd == 'q-file':
        st, d = c.gql(open(argv[2], encoding='utf-8').read())
    else:
        print(__doc__)
        return 1

    print('HTTP', st)
    print(json.dumps(d, ensure_ascii=False, indent=2)[:4000])
    return 0 if st == 200 else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv))
