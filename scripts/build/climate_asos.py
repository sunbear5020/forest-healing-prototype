"""효과 측정 시설 목록 밖 5곳(산음·장성·서귀포·만연산·남해)의 ②층 기후: 가까운 ASOS 2021~2025 일자료 월평균
기상청 지상(종관, ASOS) 일자료 조회서비스(공공데이터포털). 키: DATA_GO_KR_KEY
표고 보정 없음(시설 표고 미확보). 관측소는 시설과 같은 시군 또는 인접 시군의 ASOS로 골랐고, 거리는 계산하지 않음.
실행: DATA_GO_KR_KEY=... python scripts/build/climate_asos.py data/facility_env.json"""
import os, sys, json, urllib.parse, urllib.request, time
import pandas as pd
KEY = urllib.parse.unquote(os.environ['DATA_GO_KR_KEY'])
STN = {'saneum': (202, '양평'), 'jangseong': (172, '고창'), 'seogwipo': (189, '서귀포'), 'hwasun': (156, '광주'), 'namhae': (295, '남해')}
def year(stn, y):
    q = urllib.parse.urlencode({'serviceKey': KEY, 'pageNo': 1, 'numOfRows': 400, 'dataType': 'JSON', 'dataCd': 'ASOS', 'dateCd': 'DAY',
                                'startDt': f'{y}0101', 'endDt': f'{y}1231', 'stnIds': stn})
    for a in range(4):
        try:
            d = json.loads(urllib.request.urlopen('https://apis.data.go.kr/1360000/AsosDalyInfoService/getWthrDataList?' + q, timeout=60).read())
            return d['response']['body']['items']['item']
        except Exception:
            if a == 3: raise
            time.sleep(2 ** a)
out_path = sys.argv[1]
fe = json.load(open(out_path, encoding='utf-8'))
f = lambda x: float(x) if x not in (None, '') else None
for sid, (stn, nm) in STN.items():
    rows = []
    for y in range(2021, 2026):
        for it in year(stn, y):
            assert it['stnNm'] == nm, (it['stnNm'], nm)
            rows.append({'date': it['tm'], 'tavg': f(it['avgTa']), 'tmax': f(it['maxTa']), 'rh': f(it['avgRhm']),
                         'rain': f(it.get('sumRn')) or 0.0, 'ws': f(it['avgWs'])})
    d = pd.DataFrame(rows); d['m'] = pd.to_datetime(d.date).dt.month
    d['di'] = 0.81 * d.tavg + 0.01 * d.rh * (0.99 * d.tavg - 14.3) + 46.3
    monthly = {}
    for m, g in d.groupby('m'):
        monthly[str(int(m))] = {'tavg': round(g.tavg.mean(), 1), 'tmax': round(g.tmax.mean(), 1), 'rh': round(g.rh.mean(), 0),
                                'rain_day_pct': round(100 * (g.rain >= 1).mean(), 0), 'hot_day_pct': round(100 * (g.tmax >= 30).mean(), 0),
                                'di': round(g.di.mean(), 1), 'ws': round(g.ws.mean(), 1), 'n_days': int(g.tavg.notna().sum())}
    fe['facilities'][sid] = {'facility_id': sid, 'climate': {'station': {'id': stn, 'name': nm, 'type': 'ASOS', 'dist_km': None, 'dh_m': None, 'lapse_adj_c': None,
                             'note': '표고 보정 없음(시설 표고 미확보). 산지 시설은 실제보다 따뜻하게 나올 수 있음'}, 'monthly': monthly}}
    print(sid, nm, len(d))
fe.setdefault('_meta', {})['climate_asos_extra'] = '산음·장성·서귀포·만연산·남해: ASOS 일자료 2021~2025 월평균(표고 보정 없음), scripts/build/climate_asos.py'
json.dump(fe, open(out_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
