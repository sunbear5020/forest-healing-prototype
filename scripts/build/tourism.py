"""시설 주변 관광지 → data/tourism.json
한국관광공사 국문 관광정보 서비스(KorService2) locationBasedList2. 키는 환경변수 DATA_GO_KR_KEY(브라우저·저장소에 넣지 않음).
실행: DATA_GO_KR_KEY=... python scripts/build/tourism.py data/sites.json data/tourism.json
수록: 시설 반경 10 km 안 관광지(12)·문화시설(14)·레포츠(28) 유형별 가까운 순 최대 4곳. 사진·소개문은 이용조건이 항목마다 달라 싣지 않음."""
import json, os, sys, time, urllib.parse, urllib.request, datetime

KEY = urllib.parse.unquote(os.environ['DATA_GO_KR_KEY'])
URL = 'https://apis.data.go.kr/B551011/KorService2/locationBasedList2'
TYPES = {'12': '관광지', '14': '문화시설', '28': '레포츠'}
RADIUS_M, PER_TYPE = 10000, 4

def call(lat, lng, ctype):
    q = urllib.parse.urlencode({'serviceKey': KEY, 'MobileOS': 'ETC', 'MobileApp': 'soopgyeol', '_type': 'json',
                                'mapX': lng, 'mapY': lat, 'radius': RADIUS_M, 'contentTypeId': ctype,
                                'arrange': 'E', 'numOfRows': 20, 'pageNo': 1})
    for attempt in range(4):
        try:
            d = json.loads(urllib.request.urlopen(URL + '?' + q, timeout=30).read().decode('utf-8'))
            h = d['response']['header']
            if h['resultCode'] != '0000': raise RuntimeError(h)
            items = d['response']['body'].get('items') or {}
            it = items.get('item', []) if isinstance(items, dict) else []
            return it if isinstance(it, list) else [it]
        except Exception as e:
            if attempt == 3: raise
            time.sleep(2 ** attempt)

def main(sites_path, out_path):
    sites = json.load(open(sites_path, encoding='utf-8'))['sites']
    out = {}
    for s in sites:
        rows = []
        for ct, label in TYPES.items():
            for it in call(s['lat'], s['lng'], ct)[:PER_TYPE]:
                rows.append({'name': it['title'], 'type': label, 'km': round(float(it['dist']) / 1000, 1),
                             'addr': it.get('addr1') or '', 'lat': float(it['mapy']), 'lng': float(it['mapx']),
                             'contentid': it['contentid']})
        rows.sort(key=lambda r: r['km'])
        out[s['id']] = rows
        print(s['id'], s['name'], len(rows))
    meta = {'source': '한국관광공사 국문 관광정보 서비스(KorService2) 위치기반 관광정보 조회', 'built': datetime.date.today().isoformat(),
            'radius_km': RADIUS_M / 1000, 'types': TYPES,
            'note': '관광 연계 정보는 거리 기준 참고 목록이며 산림치유 효과와 무관합니다. 운영 여부는 방문 전 확인하세요.'}
    json.dump({'_meta': meta, 'sites': out}, open(out_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)

if __name__ == '__main__':
    main(*sys.argv[1:])
