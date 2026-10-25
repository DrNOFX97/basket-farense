#!/usr/bin/env python3
"""Constroi data/farense.json a partir da API NBN23 (Swish).

Uso:
    python3 build_data.py               # epoca 2026/2027
    python3 build_data.py 2026/2027
    python3 build_data.py --sem-cache   # ignora cache local

Credenciais: SWISH_EMAIL/SWISH_PASSWORD no ambiente, ou no ficheiro .env
"""
import json
import os
import re
import sys
import time

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
from swish_client import Swish  # noqa: E402

CACHE = os.path.join(BASE, 'cache')
OUT = os.path.join(BASE, 'data', 'farense.json')
os.makedirs(CACHE, exist_ok=True)
os.makedirs(os.path.dirname(OUT), exist_ok=True)

SEM_CACHE = '--sem-cache' in sys.argv

c = Swish()

SCH = json.load(open(os.path.join(BASE, '.schema.json'), encoding='utf-8'))
TYPES = {t['name']: t for t in SCH['data']['__schema']['types'] if t.get('name')}
SCALARS = {'String', 'Int', 'Float', 'Boolean', 'ID', 'Date', 'DateTime', 'JSON'}
BROKEN = {'playerFid', 'teamFid', 'competitionFid', 'projectKey', 'matchFid'}


def base_type(ft):
    while ft and ft.get('kind') in ('NON_NULL', 'LIST'):
        ft = ft['ofType']
    return (ft or {}).get('name')


def metrics(tname):
    return [f['name'] for f in TYPES[tname]['fields']
            if base_type(f['type']) in SCALARS and f['name'] not in BROKEN]


def limpar_foto(v):
    """A API usa 'N/A' quando o jogador nao tem fotografia."""
    v = str(v or '').strip()
    return None if not v or v.upper() in ('N/A', 'NA', 'NULL') else v


BOX_M = metrics('BoxscoreStats')
TEAM_M = metrics('BoxscoreCompetitionTeamStats')
STAND_M = metrics(base_type(next(f for f in TYPES['Standing']['fields']
                                 if f['name'] == 'stats')['type']))

# ------------------------------------------------------------------ cache ----
def gql(key, query, variables=None):
    path = os.path.join(CACHE, key + '.json')
    if os.path.exists(path) and not SEM_CACHE:
        return json.load(open(path, encoding='utf-8'))
    last = {}
    for _ in range(3):
        st, d = c.gql(query, variables)
        last = d
        if not d.get('errors'):
            break
        time.sleep(2)
    if d.get('errors'):
        print(f'    ! {key}: {d["errors"][0]["message"][:90]}')
    json.dump(d, open(path, 'w', encoding='utf-8'), ensure_ascii=False)
    return d


# ------------------------------------------------------------- queries -------
Q_SEASONS = """query { seasons { id name startDate endDate } }"""
Q_SEARCH = """query S($searchCriteria: String!, $seasonId: String!, $searchOptions: ISearchOptions!) {
  search(searchCriteria: $searchCriteria, seasonId: $seasonId, searchOptions: $searchOptions) {
    __typename
    ... on Team {
      tFid: fid
      teamName: name
      logo
      competitionFid
      tprojectKey: projectKey
      competition { name projectName }
    }
  } }"""
Q_SCHED = """query S($projectKey: String!, $competitionFid: String!, $teamFid: String!) {
  teamMatch(projectKey: $projectKey, competitionFid: $competitionFid, teamFid: $teamFid) {
    fid date winner court { place town }
    timeStatus { status period time }
    homeTeam { id name } awayTeam { id name }
    scores { total { homeScore awayScore }
             partials { period homeScore awayScore } }
  } }"""
Q_MATCH = """query M($projectKey: String!, $fid: String!) {
  matchBy(projectKey: $projectKey, fid: $fid) {
    fid status date roundName
    homeTeam { fid name } awayTeam { fid name }
    scores { total { homeScore awayScore }
             partials { period homeScore awayScore } }
    stats { biggestLead { homeTeam awayTeam } timesTied leadChanges }
    boxscore {
      homeTeam { players { player { fid name lastName number photo } stats { %s } } }
      awayTeam { players { player { fid name lastName number photo } stats { %s } } } }
    actions { period time actor { fid type } code subCode value result teamFid }
  } }""" % (' '.join(BOX_M), ' '.join(BOX_M))
Q_STAND = """query S($projectKey: String!, $competitionFid: String!, $teamFid: String!) {
  standingsByTeam(projectKey: $projectKey, competitionFid: $competitionFid, teamFid: $teamFid) {
    group { fid name }
    standings { fid name position stats { %s } }
  } }""" % ' '.join(STAND_M)
Q_TEAMSTATS = """query T($projectKey: String!, $competitionFid: String!, $teamFid: String!) {
  competitionStatsByTeam(projectKey: $projectKey, competitionFid: $competitionFid, teamFid: $teamFid) {
    %s } }""" % ' '.join(TEAM_M)
Q_ROSTER = """query P($projectKey: String!, $competitionFid: String!, $teamFid: String!) {
  playersByTeam(projectKey: $projectKey, competitionFid: $competitionFid, teamFid: $teamFid) {
    fid name lastName number license captain photo } }"""

# --------------------------------------------------------- classificacao -----
SUB_RE = re.compile(r'(?:sub\s*[- ]?|u)(\d{1,2})(?![0-9])\s*(?:([bg])(?![a-zA-Z]))?', re.I)
SENIOR_RE = re.compile(r'(proliga|divis[ãa]o|liga betclic|nacional seniores|seniores)', re.I)


def classificar(comp):
    s = comp or ''
    m = SUB_RE.search(s)
    letra = (m.group(2) or '').lower() if m else ''
    if m:
        idade = int(m.group(1))
        ordem = idade
        nome = f'Sub {idade}'
    elif SENIOR_RE.search(s):
        idade, ordem, nome = None, 0, 'Seniores'
    else:
        idade, ordem, nome = None, 50, 'Outros'

    low = s.lower()
    if letra == 'g' or 'feminin' in low:
        genero = 'F'
    elif letra == 'b' or 'masculin' in low:
        genero = 'M'
    else:
        genero = 'X'
    return {'nome': nome, 'idade': idade, 'genero': genero,
            'ordem': (0, 0) if idade is None else (1, -idade)}


def sufixo(nome):
    m = re.search(r'"([A-Z])"', nome or '')
    return m.group(1) if m else ''


def variante(comp):
    s = (comp or '').lower()
    for chave, nome in (('festival', 'festival'), ('taça', 'taca'), ('taca', 'taca'),
                        ('regional', 'regional'), ('nacional', 'nacional')):
        if chave in s:
            return nome
    return ''


def unicos(equipas):
    vistos = {}
    for t in equipas:
        base = t['id']
        if base in vistos:
            novo = base + ('-' + t['variante'] if t['variante'] else '')
            n = 2
            while novo in vistos:
                novo = f'{base}-{n}'
                n += 1
            t['id'] = novo
        vistos[t['id']] = True
    return equipas


def limpar_stats(d):
    return {k: v for k, v in (d or {}).items() if k not in BROKEN}


# ------------------------------------------------------------------ pull -----
def pull_match(pk, fid):
    # Chave versionada: os caches antigos dos jogos nao tinham o campo photo.
    d = gql(f'match_foto_{fid}', Q_MATCH, {'projectKey': pk, 'fid': fid})
    m = ((d.get('data') or {}).get('matchBy') or [None])[0]
    if not m:
        return None
    out = {
        'fid': fid, 'estado': m.get('status'), 'data': m.get('date'),
        'jornada': m.get('roundName'),
        'parciais': [[q['period'], q['homeScore'], q['awayScore']]
                     for q in ((m.get('scores') or {}).get('partials') or [])],
        'lideranca': None, 'jogadores': {'casa': [], 'fora': []}, 'accoes': [],
    }
    st = m.get('stats') or {}
    if st.get('biggestLead'):
        out['lideranca'] = {
            'maiorCasa': (st['biggestLead'] or {}).get('homeTeam'),
            'maiorFora': (st['biggestLead'] or {}).get('awayTeam'),
            'empates': st.get('timesTied'), 'trocas': st.get('leadChanges')}
    for side, key in (('casa', 'homeTeam'), ('fora', 'awayTeam')):
        for r in (((m.get('boxscore') or {}).get(key) or {}).get('players') or []):
            if not r.get('stats'):
                continue
            p = r.get('player') or {}
            s = r['stats']
            out['jogadores'][side].append({
                'fid': p.get('fid'), 'num': p.get('number'),
                'nome': ((p.get('name') or '') + ' ' + (p.get('lastName') or '')).strip(),
                'foto': limpar_foto(p.get('photo')),
                'min': s.get('timePlayed'), 'pts': s.get('points'),
                'c2': s.get('inArcThrowsMade'), 'f2': s.get('inArcThrowsFailed'),
                'c3': s.get('outArcThrowsMade'), 'f3': s.get('outArcThrowsFailed'),
                'cll': s.get('freeThrowsMade'), 'fll': s.get('freeThrowsFailed'),
                'ft': s.get('fouls'), 'fr': s.get('receivedFouls'),
                'val': s.get('fibaRating'), 'pm': s.get('plusMinus')})
    # falhados e acoes
    acts = sorted(m.get('actions') or [], key=lambda a: (a.get('period') or 0, a.get('time') or 0))
    for a in acts:
        out['accoes'].append([
            a.get('period'), a.get('time'),
            (a.get('actor') or {}).get('fid'), (a.get('actor') or {}).get('type'),
            a.get('code'), a.get('subCode'), a.get('value'),
            a.get('result'), a.get('teamFid')])
    falhas = {}
    for a in acts:
        if a.get('code') == 'POINTS' and a.get('result') is False:
            k = ((a.get('actor') or {}).get('fid'), a.get('subCode'))
            falhas[k] = falhas.get(k, 0) + 1
    for side in ('casa', 'fora'):
        for j in out['jogadores'][side]:
            f = j['fid']
            j['f2'] = falhas.get((f, 'IN_ARC'), 0)
            j['f3'] = falhas.get((f, 'OUT_ARC'), 0)
            j['fll'] = falhas.get((f, 'FREE_THROW'), 0)
    return out


def pull_team(t, epoca_id):
    pk, cf, tf = t['projectKey'], t['compFid'], t['teamFid']
    d = gql(f'team_{tf}_{cf}', Q_SCHED, {'projectKey': pk, 'competitionFid': cf, 'teamFid': tf})
    ms = (d.get('data') or {}).get('teamMatch') or []
    jogos = []
    for m in sorted(ms, key=lambda x: str(x.get('date'))):
        em_casa = (m.get('homeTeam') or {}).get('id') == tf
        s = (m.get('scores') or {}).get('total') or {}
        hs, as_ = s.get('homeScore'), s.get('awayScore')
        meu, adv = (hs, as_) if em_casa else (as_, hs)
        jogado = bool(hs or as_)
        venceu = (m.get('winner') == tf) if m.get('winner') else (meu > adv if jogado else None)
        jogos.append({
            'fid': m['fid'], 'data': m.get('date'), 'jornada': None,
            'casa': (m.get('homeTeam') or {}).get('name'),
            'fora': (m.get('awayTeam') or {}).get('name'),
            'casaFid': (m.get('homeTeam') or {}).get('id'),
            'foraFid': (m.get('awayTeam') or {}).get('id'),
            'emCasa': em_casa, 'jogado': jogado,
            'meus': meu if jogado else None, 'adv': adv if jogado else None,
            'resultado': ('V' if venceu else 'D') if jogado else None,
            'estado': (m.get('timeStatus') or {}).get('status'),
            'parciais': [[q['period'], q['homeScore'], q['awayScore']]
                         for q in ((m.get('scores') or {}).get('partials') or [])],
            'local': ((m.get('court') or {}).get('place')),
            'detalhe': None})
    for j in jogos:
        if j['jogado']:
            d2 = pull_match(pk, j['fid'])
            if d2:
                j['detalhe'] = True
                j['jornada'] = d2.get('jornada')
                j['parciais'] = d2['parciais']
                j['lideranca'] = d2['lideranca']
                j['jogadores'] = d2['jogadores']
                j['accoes'] = d2['accoes']

    d = gql(f'stand_{tf}_{cf}', Q_STAND, {'projectKey': pk, 'competitionFid': cf, 'teamFid': tf})
    grupos = (d.get('data') or {}).get('standingsByTeam') or []
    classif = []
    for g in grupos:
        linhas = []
        for s in g.get('standings') or []:
            st = limpar_stats(s.get('stats'))
            linhas.append({
                'fid': s.get('fid'), 'nome': s.get('name'),
                'pos': s.get('position'), 'eu': s.get('fid') == tf,
                'j': st.get('playedMatches'), 'v': st.get('wonMatches'),
                'd': st.get('lostMatches'),
                'pm': (round(st['pointsPerGame'] * st['playedMatches'], 1)
                       if st.get('pointsPerGame') is not None else None),
                'ps': (round(st['opponentsPointsPerGame'] * st['playedMatches'], 1)
                       if st.get('opponentsPointsPerGame') is not None else None),
                'dif': (round((st['pointsPerGame'] - st['opponentsPointsPerGame'])
                              * st['playedMatches'], 1)
                        if st.get('pointsPerGame') is not None
                        and st.get('opponentsPointsPerGame') is not None else None),
                'ppg': st.get('pointsPerGame'), 'oppg': st.get('opponentsPointsPerGame'),
                'logo': s.get('logo')})
        classif.append({'grupo': (g.get('group') or {}).get('name'), 'linhas': linhas})

    d = gql(f'tstats_{tf}_{cf}', Q_TEAMSTATS, {'projectKey': pk, 'competitionFid': cf, 'teamFid': tf})
    agregado = limpar_stats((d.get('data') or {}).get('competitionStatsByTeam'))

    d = gql(f'roster_{tf}_{cf}', Q_ROSTER, {'projectKey': pk, 'competitionFid': cf, 'teamFid': tf})
    plantel = [{'fid': p.get('fid'),
                'nome': ((p.get('name') or '') + ' ' + (p.get('lastName') or '')).strip(),
                'num': p.get('number'), 'capitao': bool(p.get('captain')),
                'foto': limpar_foto(p.get('photo'))}
               for p in ((d.get('data') or {}).get('playersByTeam') or [])]
    if not plantel:
        # a API devolve playersByTeam vazio nesta epoca; reconstroi pelos boxscores
        vistos = {}
        for j in jogos:
            if not j['jogado']:
                continue
            lado = 'casa' if j['casaFid'] == tf else 'fora'
            for p in (j.get('jogadores') or {}).get(lado, []):
                if p['fid'] not in vistos:
                    vistos[p['fid']] = {'fid': p['fid'], 'nome': p['nome'],
                                        'num': p['num'], 'capitao': False,
                                        'foto': p.get('foto')}
        plantel = sorted(vistos.values(), key=lambda p: str(p['num'] or '99'))

    # Se o plantel veio da API mas alguma foto faltava, aproveita as dos boxscores.
    fotos = {}
    for j in jogos:
        for lado in ('casa', 'fora'):
            for p in (j.get('jogadores') or {}).get(lado, []):
                if p.get('foto') and not fotos.get(p['fid']):
                    fotos[p['fid']] = p['foto']
    for p in plantel:
        if not p.get('foto'):
            p['foto'] = fotos.get(p['fid'])

    realizados = [j for j in jogos if j['jogado']]
    v = sum(1 for j in realizados if j['resultado'] == 'V')
    pts = sum(j['meus'] for j in realizados)
    sof = sum(j['adv'] for j in realizados)

    cls = t['classe']
    suf = sufixo(t['name'])
    slug = (f"{cls['nome'].lower().replace(' ', '')}-{cls['genero'].lower()}"
            + (f"-{suf.lower()}" if suf else ''))
    return {
        'id': slug, 'nome': t['name'], 'sufixo': suf,
        'escalao': cls['nome'], 'genero': cls['genero'],
        'ordem': list(cls['ordem']),
        'nomeCurto': cls['nome'] + (' ' + cls['genero'] if cls['genero'] != 'X' else '')
                     + (f' {suf}' if suf else ''),
        'competicao': t['comp'], 'projeto': t['project'],
        'variante': variante(t['comp']),
        'compFid': cf, 'projectKey': pk, 'teamFid': tf, 'logo': t.get('logo'),
        'epoca': epoca_id,
        'resumo': {'jogos': len(jogos), 'realizados': len(realizados),
                   'v': v, 'd': len(realizados) - v,
                   'pontos': pts, 'sofridos': sof,
                   'media': round(pts / len(realizados), 1) if realizados else None,
                   'mediaSofrida': round(sof / len(realizados), 1) if realizados else None},
        'classificacao': classif, 'agregado': agregado,
        'plantel': plantel, 'jogos': jogos,
    }


def main():
    alvo = [a for a in sys.argv[1:] if not a.startswith('--')]
    d = gql('seasons', Q_SEASONS)
    seasons = (d.get('data') or {}).get('seasons') or []
    seasons = [s for s in seasons if s['name'] in ('2026/2027',)]
    if alvo:
        seasons = [s for s in seasons if s['name'] in alvo]

    epocas = []
    for s in seasons:
        print(f"\n== epoca {s['name']}")
        d = gql(f'search_farense_{s["id"]}', Q_SEARCH,
                {'searchCriteria': 'farense', 'seasonId': s['id'],
                 'searchOptions': {'limit': 100}})
        teams, vistos = [], set()
        for h in (d.get('data') or {}).get('search') or []:
            if h.get('__typename') != 'Team':
                continue
            if h['tFid'] in vistos:
                continue
            vistos.add(h['tFid'])
            teams.append({'teamFid': h['tFid'], 'name': h['teamName'],
                          'compFid': h['competitionFid'],
                          'comp': (h.get('competition') or {}).get('name'),
                          'project': (h.get('competition') or {}).get('projectName'),
                          'projectKey': h['tprojectKey'], 'logo': h.get('logo'),
                          'classe': classificar((h.get('competition') or {}).get('name'))})
        teams.sort(key=lambda t: (t['classe']['ordem'],
                                  {'M': 0, 'F': 1, 'X': 2}[t['classe']['genero']],
                                  t['name']))
        print(f'   {len(teams)} equipas')
        equipas = []
        for t in teams:
            print(f"   - {t['name']:26} {t['comp'][:44]}")
            equipas.append(pull_team(t, s['name']))
        epocas.append({'id': s['name'].replace('/', '-'), 'nome': s['name'],
                       'equipas': unicos(equipas)})

    dados = {'gerado': time.strftime('%Y-%m-%d %H:%M'),
             'fonte': 'API NBN23 (Swish)',
             'epocas': epocas}
    json.dump(dados, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    kb = os.path.getsize(OUT) / 1024
    nj = sum(len(t['jogos']) for e in epocas for t in e['equipas'])
    nd = sum(1 for e in epocas for t in e['equipas'] for j in t['jogos'] if j['detalhe'])
    print(f'\n{OUT}  {kb:.0f} KB  |  {nj} jogos, {nd} com boxscore')
    for e in epocas:
        print(f"  {e['nome']}: " + ', '.join(f"{t['nomeCurto']} ({t['resumo']['v']}-{t['resumo']['d']})"
                                             for t in e['equipas']))


if __name__ == '__main__':
    main()
