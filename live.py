#!/usr/bin/env python3
"""Estado ao vivo do Farense, por polling a API NBN23.

A API nao tem WebSocket nem subscriptions: cada accao da mesa e escrita no
backend durante o jogo, por isso polling da o mesmo resultado com 3 a 5 s de
atraso.

Mantem a agenda em cache 5 minutos e so consulta os jogos que estao a decorrer.
"""
import datetime
import json
import os
import threading
import time

from swish_client import Swish

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, 'data', 'farense.json')

Q_SCHED = """query S($projectKey: String!, $competitionFid: String!, $teamFid: String!) {
  teamMatch(projectKey: $projectKey, competitionFid: $competitionFid, teamFid: $teamFid) {
    fid date timeStatus { status period time }
    homeTeam { id name } awayTeam { id name }
    scores { total { homeScore awayScore } }
  } }"""

Q_MATCH = """query L($projectKey: String!, $fid: String!) {
  matchBy(projectKey: $projectKey, fid: $fid) {
    fid status date roundName
    homeTeam { fid name } awayTeam { fid name }
    scores { total { homeScore awayScore }
             partials { period homeScore awayScore } }
    timeStatus { status period time }
    stats { biggestLead { homeTeam awayTeam } timesTied leadChanges }
    boxscore {
      homeTeam { players { player { fid name lastName number } stats {
        timePlayed points inArcThrowsMade outArcThrowsMade freeThrowsMade
        freeThrowsFailed fouls fibaRating plusMinus } } }
      awayTeam { players { player { fid name lastName number } stats {
        timePlayed points inArcThrowsMade outArcThrowsMade freeThrowsMade
        freeThrowsFailed fouls fibaRating plusMinus } } } }
    actions { period time actor { fid type } code subCode value result teamFid }
  } }"""


def equipas():
    d = json.load(open(DATA, encoding='utf-8'))
    vistas, out = set(), []
    for ep in d['epocas']:
        for t in ep['equipas']:
            k = (t['projectKey'], t['compFid'], t['teamFid'])
            if k in vistas:
                continue
            vistas.add(k)
            out.append(t)
    return out


class Estado:
    def __init__(self):
        self.c = Swish()
        self.equipas = equipas()
        self.lock = threading.Lock()
        self.schedules = {}
        self.tsched = 0.0
        self.snap = {'atualizado': None, 'jogos': [], 'proximos': [], 'erro': None}
        self.ultimo_erro = None

    # -- agenda ---------------------------------------------------------
    def agenda(self, max_idade=300):
        if self.schedules and time.time() - self.tsched < max_idade:
            return self.schedules
        sched = {}
        for t in self.equipas:
            try:
                st, d = self.c.gql(Q_SCHED, {'projectKey': t['projectKey'],
                                             'competitionFid': t['compFid'],
                                             'teamFid': t['teamFid']})
                for m in (d.get('data') or {}).get('teamMatch') or []:
                    sched[m['fid']] = {'m': m, 'eq': t}
            except Exception as e:  # rede, token, o que for
                self.ultimo_erro = f'{t["nome"]}: {e}'
        if sched:
            self.schedules = sched
            self.tsched = time.time()
        return self.schedules

    def candidatos(self):
        sched = self.agenda()
        agora = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
        live, futuros = [], []
        for fid, e in sched.items():
            ts = (e['m'].get('timeStatus') or {})
            if ts.get('status') == 'LIVE':
                live.append(fid)
                continue
            iso = e['m'].get('date') or ''
            if not iso:
                continue
            try:
                dt = datetime.datetime.strptime(iso[:19], '%Y-%m-%dT%H:%M:%S')
            except ValueError:
                continue
            if ts.get('status') == 'NOT_STARTED' and dt > agora - datetime.timedelta(hours=2):
                futuros.append((dt, fid))
        futuros.sort()
        return live, [f for _, f in futuros[:24]]

    # -- jogo -----------------------------------------------------------
    def jogo(self, fid):
        e = self.agenda().get(fid)
        if not e:
            return None
        t = e['eq']
        st, d = self.c.gql(Q_MATCH, {'projectKey': t['projectKey'], 'fid': fid})
        if d.get('errors'):
            self.ultimo_erro = d['errors'][0].get('message')
        m = ((d.get('data') or {}).get('matchBy') or [None])[0]
        if not m:
            return None
        ts = m.get('timeStatus') or {}
        sc = (m.get('scores') or {}).get('total') or {}
        out = {
            'fid': fid, 'status': m.get('status'), 'inicio': m.get('date'),
            'jornada': m.get('roundName'),
            'periodo': ts.get('period'), 'relogio': ts.get('time'),
            'casa': (m.get('homeTeam') or {}).get('name'),
            'fora': (m.get('awayTeam') or {}).get('name'),
            'casaFid': (m.get('homeTeam') or {}).get('fid'),
            'foraFid': (m.get('awayTeam') or {}).get('fid'),
            'pontos': [sc.get('homeScore'), sc.get('awayScore')],
            'parciais': [[q['period'], q['homeScore'], q['awayScore']]
                         for q in ((m.get('scores') or {}).get('partials') or [])],
            'lideranca': None,
            'jogadores': {'casa': [], 'fora': []},
            'accoes': [],
            'equipa': {'id': t['id'], 'nome': t['nomeCurto'],
                       'teamFid': t['teamFid'], 'compFid': t['compFid'],
                       'competicao': t['competicao'], 'epoca': t['epoca']},
        }
        stt = m.get('stats') or {}
        if stt.get('biggestLead'):
            out['lideranca'] = {
                'maiorCasa': (stt['biggestLead'] or {}).get('homeTeam'),
                'maiorFora': (stt['biggestLead'] or {}).get('awayTeam'),
                'empates': stt.get('timesTied'), 'trocas': stt.get('leadChanges')}
        for side, k in (('casa', 'homeTeam'), ('fora', 'awayTeam')):
            for r in (((m.get('boxscore') or {}).get(k) or {}).get('players') or []):
                if not r.get('stats'):
                    continue
                p, s = r.get('player') or {}, r['stats']
                out['jogadores'][side].append({
                    'fid': p.get('fid'), 'num': p.get('number'),
                    'nome': ((p.get('name') or '') + ' ' + (p.get('lastName') or '')).strip(),
                    'min': s.get('timePlayed'), 'pts': s.get('points'),
                    'c2': s.get('inArcThrowsMade'), 'c3': s.get('outArcThrowsMade'),
                    'cll': s.get('freeThrowsMade'), 'fll': s.get('freeThrowsFailed'),
                    'ft': s.get('fouls'), 'val': s.get('fibaRating'),
                    'pm': s.get('plusMinus')})
        for a in sorted(m.get('actions') or [],
                        key=lambda a: (a.get('period') or 0, a.get('time') or 0)):
            out['accoes'].append([
                a.get('period'), a.get('time'),
                (a.get('actor') or {}).get('fid'), (a.get('actor') or {}).get('type'),
                a.get('code'), a.get('subCode'), a.get('value'),
                a.get('result'), a.get('teamFid')])
        return out

    # -- ciclo ----------------------------------------------------------
    def atualizar(self):
        try:
            live, futuros = self.candidatos()
            jogos = [j for j in (self.jogo(f) for f in live) if j]
            proximos = [j for j in (self.jogo(f) for f in futuros) if j]
            self.ultimo_erro = None
        except Exception as e:
            jogos, proximos = [], []
            self.ultimo_erro = str(e)
        snap = {
            'atualizado': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'jogos': jogos, 'proximos': proximos, 'erro': self.ultimo_erro,
        }
        with self.lock:
            self.snap = snap
        return snap

    def loop(self):
        while True:
            try:
                s = self.atualizar()
                vivo = any(j['status'] == 'LIVE' for j in s['jogos'])
                time.sleep(4 if vivo else 25)
            except Exception:
                time.sleep(15)
