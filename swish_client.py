#!/usr/bin/env python3
"""
swish_client.py — cliente para a API do SWISH by NBN23.

Fluxo recuperado por engenharia reversa do APK 2.10.0 (com.nbn23.fansapp):
  BuildConfig.FIREBASE_ANDROID_WEBCLIENTID / API key  -> Firebase Auth (email+password)
  idToken do Firebase                                 -> Authorization: Bearer <idToken>
  BuildConfig.GRAPHQL_URL                             -> https://internal.nbn23.app/graphql

Credenciais, por ordem de preferência:
  env  SWISH_EMAIL / SWISH_PASSWORD
  ficheiro creds.txt ao lado deste script   (linha 1 = email, linha 2 = password)
  /tmp/opencode/swish/creds.txt
  ~/.config/farense-basket/creds.txt

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

CREDS_CANDIDATOS = [
    os.path.join(BASE, 'creds.txt'),
    '/tmp/opencode/swish/creds.txt',
    os.path.expanduser('~/.config/farense-basket/creds.txt'),
]


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


def credentials():
    email = os.environ.get('SWISH_EMAIL')
    pw = os.environ.get('SWISH_PASSWORD')
    if email and pw:
        return email, pw
    for caminho in CREDS_CANDIDATOS:
        if os.path.exists(caminho):
            lines = [l.rstrip('\n') for l in open(caminho, encoding='utf-8')]
            lines = [l for l in lines if l.strip()]
            if len(lines) >= 2:
                return lines[0].strip(), lines[1]
    raise SystemExit(
        'faltam credenciais: define SWISH_EMAIL/SWISH_PASSWORD '
        f'ou escreve email e password em duas linhas em {CREDS_CANDIDATOS[0]}')


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
