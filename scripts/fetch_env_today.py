"""③층 실황 편차용 오늘·내일 환경 스냅샷(data/env_today.json)
· 기상청 단기예보(VilageFcstInfoService_2.0/getVilageFcst): 시설 좌표 격자(5 km)의 10~16시 값
· 에어코리아 시도별 실시간(ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty): 시설이 있는 시도 측정소 PM2.5 중앙값
  ※ 측정소 위치 API(MsrstnInfoInqireSvc)가 미승인이라 '시설 인근 측정소'가 아니라 '시도 중앙값'이다.
환경변수 DATA_GO_KR_KEY 필요. GitHub Actions(.github/workflows/env-daily.yml)가 매일 실행해 커밋한다.
API 키는 저장소 Secrets에만 두고, 브라우저에는 결과 JSON만 공개한다.
"""
import os, json, math, time, statistics, urllib.request, urllib.parse, datetime as dt, sys

KEY = os.environ['DATA_GO_KR_KEY']
ROOT = os.path.join(os.path.dirname(__file__), '..')
KST = dt.timezone(dt.timedelta(hours=9))

def get(url, params, tries=4):
    q = urllib.parse.urlencode(params, safe='%')
    for i in range(tries):
        try:
            b = urllib.request.urlopen(f'{url}?serviceKey={KEY}&{q}', timeout=30).read().decode('utf-8')
            return json.loads(b)
        except Exception as e:
            err = str(e).replace(KEY, '***'); time.sleep(3 * (i + 1))
    raise RuntimeError(err)

def latlon_to_grid(lat, lon):
    """기상청 단기예보 격자 변환(LCC, 기상청 동네예보 격자 정의)"""
    RE, GRID, SLAT1, SLAT2, OLON, OLAT, XO, YO = 6371.00877, 5.0, 30.0, 60.0, 126.0, 38.0, 43, 136
    D = math.pi / 180.0; re = RE / GRID
    s1, s2, olon, olat = SLAT1 * D, SLAT2 * D, OLON * D, OLAT * D
    sn = math.log(math.cos(s1) / math.cos(s2)) / math.log(math.tan(math.pi * 0.25 + s2 * 0.5) / math.tan(math.pi * 0.25 + s1 * 0.5))
    sf = math.tan(math.pi * 0.25 + s1 * 0.5) ** sn * math.cos(s1) / sn
    ro = re * sf / math.tan(math.pi * 0.25 + olat * 0.5) ** sn
    ra = re * sf / math.tan(math.pi * 0.25 + lat * D * 0.5) ** sn
    th = lon * D - olon
    th = (th + math.pi) % (2 * math.pi) - math.pi
    th *= sn
    return int(ra * math.sin(th) + XO + 0.5), int(ro - ra * math.cos(th) + YO + 0.5)

SIDO = [('서울', '서울'), ('부산', '부산'), ('대구', '대구'), ('인천', '인천'), ('광주', '광주'), ('대전', '대전'), ('울산', '울산'),
        ('세종', '세종'), ('경기', '경기'), ('강원', '강원'), ('충청북', '충북'), ('충북', '충북'), ('충청남', '충남'), ('충남', '충남'),
        ('전라북', '전북'), ('전북', '전북'), ('전라남', '전남'), ('전남', '전남'), ('경상북', '경북'), ('경북', '경북'),
        ('경상남', '경남'), ('경남', '경남'), ('제주', '제주')]
def sido_of(addr):
    for k, v in SIDO:
        if addr.startswith(k): return v
    return None

def main():
    sites = json.load(open(os.path.join(ROOT, 'data/sites.json')))['sites']
    now = dt.datetime.now(KST)
    base = now - dt.timedelta(hours=2, minutes=15)   # 발표 후 약 10분 뒤 제공 → 여유
    bt = max([h for h in (2, 5, 8, 11, 14, 17, 20, 23) if h <= base.hour] or [23])
    bdate = base if bt <= base.hour else base - dt.timedelta(days=1)
    base_date, base_time = bdate.strftime('%Y%m%d'), f'{bt:02d}00'
    out = {'generated_at': now.isoformat(timespec='minutes'), 'forecast_base': f'{base_date} {base_time} KST',
           'sources': {'forecast': '기상청 단기예보 조회서비스(공공데이터포털 15084084), 격자 5 km, 10~16시',
                       'pm25': '한국환경공단 에어코리아 시도별 실시간 측정정보, 시도 측정소 PM2.5 중앙값(시설 인근 측정소 아님)'},
           'sites': {}}
    pm = {}
    for sd in sorted({sido_of(s['address']) for s in sites} - {None}):
        try:
            j = get('https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty',
                    {'returnType': 'json', 'numOfRows': 200, 'pageNo': 1, 'sidoName': sd, 'ver': '1.0'})
            v = [float(i['pm25Value']) for i in j['response']['body']['items'] if (i.get('pm25Value') or '').replace('.', '').isdigit()]
            t = j['response']['body']['items'][0]['dataTime'] if j['response']['body']['items'] else None
            pm[sd] = {'pm25_median': round(statistics.median(v), 1) if v else None, 'n_station': len(v), 'time': t}
        except Exception as e:
            pm[sd] = {'error': str(e)[:120]}
    grids = {}
    for s in sites:
        nx, ny = latlon_to_grid(s['lat'], s['lng'])
        if (nx, ny) not in grids:
            try:
                j = get('https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst',
                        {'dataType': 'JSON', 'numOfRows': 1000, 'pageNo': 1, 'base_date': base_date, 'base_time': base_time, 'nx': nx, 'ny': ny})
                grids[(nx, ny)] = j['response']['body']['items']['item']
            except Exception as e:
                grids[(nx, ny)] = str(e)[:120]
        items = grids[(nx, ny)]
        days = {}
        if isinstance(items, list):
            for it in items:
                d, h, c, v = it['fcstDate'], int(it['fcstTime'][:2]), it['category'], it['fcstValue']
                rec = days.setdefault(d, {'tmp': [], 'reh': [], 'wsd': [], 'pop': [], 'pcp': [], 'tmx': None, 'tmn': None, 'sky': []})
                if c == 'TMX': rec['tmx'] = float(v)
                if c == 'TMN': rec['tmn'] = float(v)
                if 10 <= h <= 16:
                    if c == 'TMP': rec['tmp'].append(float(v))
                    if c == 'REH': rec['reh'].append(float(v))
                    if c == 'WSD': rec['wsd'].append(float(v))
                    if c == 'POP': rec['pop'].append(float(v))
                    if c == 'SKY': rec['sky'].append(int(v))
                    if c == 'PCP': rec['pcp'].append(0.0 if v in ('강수없음', '0') else 1.0)
        dl = []
        for d in sorted(days)[:3]:
            r = days[d]
            if not r['tmp']: continue
            dl.append({'date': f'{d[:4]}-{d[4:6]}-{d[6:]}', 'tmp_day': round(sum(r['tmp']) / len(r['tmp']), 1), 'tmx': r['tmx'], 'tmn': r['tmn'],
                       'reh': round(sum(r['reh']) / len(r['reh'])) if r['reh'] else None, 'wsd_max': max(r['wsd']) if r['wsd'] else None,
                       'pop_max': max(r['pop']) if r['pop'] else None, 'rain_hours': int(sum(r['pcp'])) if r['pcp'] else 0,
                       'sky_mode': max(set(r['sky']), key=r['sky'].count) if r['sky'] else None})
        sd = sido_of(s['address'])
        out['sites'][s['id']] = {'grid': [nx, ny], 'days': dl, 'pm25': pm.get(sd), 'sido': sd,
                                 'error': None if isinstance(items, list) else items}
    json.dump(out, open(os.path.join(ROOT, 'data/env_today.json'), 'w'), ensure_ascii=False, indent=1)
    ok = sum(1 for v in out['sites'].values() if v['days'])
    print(f'sites with forecast: {ok}/{len(sites)}; pm sido: {pm}')
    if ok == 0: sys.exit(1)

if __name__ == '__main__':
    main()
