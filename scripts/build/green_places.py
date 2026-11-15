"""대체경로용 녹지 목록 생성
1) 도시공원: 공공데이터포털 전국도시공원정보표준데이터(15012890) 중 면적 1 ha 이상
2) 산림: 전국휴양림표준데이터(15013111) + 산림청 전국 치유의숲 좌표(15110279, 2023-09-22)
각 장소에 ESA WorldCover 2021 수관 피복률을 붙인다.
  · 공원: 면적 원형 근사(대표 좌표 중심, 반경 sqrt(A/π)) → '추정'
  · 산림: 대표 좌표 반경 1 km
사용: python green_places.py <parks_raw.json> <rcrfrst.json> <healforest.json> <worldcover_dir> <out_dir>
"""
import sys, json, math, os
sys.path.insert(0, os.path.dirname(__file__))
from canopy import TreeCover
parks_p, rf_p, hf_p, wc, out = sys.argv[1:6]
tc = TreeCover(wc)
def f(x):
    try: return float(x)
    except: return None
parks = []
for r in json.load(open(parks_p)):
    a, lat, lng = f(r['공원면적']), f(r['위도']), f(r['경도'])
    if not a or a < 10000 or not lat or not lng or not (33 < lat < 39 and 124 < lng < 132): continue
    rad = max(30.0, math.sqrt(a / math.pi))
    c = tc.frac(lat, lng, rad)
    fac = [r[k] for k in ['공원보유시설(운동시설)', '공원보유시설(편익시설)', '공원보유시설(교양시설)'] if r.get(k)]
    parks.append({'id': r['관리번호'], 'name': r['공원명'], 'type': r['공원구분'], 'lat': round(lat, 6), 'lng': round(lng, 6),
                  'area_m2': int(a), 'addr': r['소재지도로명주소'] or r['소재지지번주소'],
                  'tree_pct': c and c['tree'], 'green_pct': c and c['green'], 'built_pct': c and c['built'],
                  'facilities': ' / '.join(fac)[:80]})
print('parks', len(parks), sum(1 for p in parks if p['tree_pct'] is not None))
forests = []
for r in json.load(open(rf_p)):
    lat, lng = f(r['위도']), f(r['경도'])
    if not lat or not lng: continue
    c = tc.frac(lat, lng, 1000)
    forests.append({'kind': '자연휴양림', 'name': r['휴양림명'], 'owner': r['휴양림구분'], 'lat': round(lat, 6), 'lng': round(lng, 6),
                    'area_m2': int(f(r['휴양림면적']) or 0), 'stay': r['숙박가능여부'] == 'Y', 'addr': r['소재지도로명주소'],
                    'phone': r['휴양림전화번호'], 'tree_pct_1km': c and c['tree']})
for r in json.load(open(hf_p)):
    rec = r['rec']; c = tc.frac(r['lat'], r['lng'], 1000)
    forests.append({'kind': '치유의숲', 'name': rec[2], 'owner': rec[7], 'lat': r['lat'], 'lng': r['lng'], 'area_m2': None,
                    'stay': None, 'addr': rec[3], 'phone': rec[4], 'reserve': rec[6], 'tree_pct_1km': c and c['tree']})
print('forests', len(forests))
meta = lambda src, m: {'source': src, 'method': m, 'built': '2026-11-15',
                       'landcover': 'ESA WorldCover 10m 2021 v200 (CC BY 4.0), class 10 Tree cover'}
json.dump({'_meta': meta('공공데이터포털 전국도시공원정보표준데이터(15012890), 데이터기준일 2026-09 전후',
                         '면적 1 ha 이상만. 수관 피복률은 대표 좌표 중심 원형 근사(공원 경계 아님) → 추정값'),
           'parks': parks}, open(os.path.join(out, 'parks.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
json.dump({'_meta': meta('전국휴양림표준데이터(15013111) + 산림청 전국 치유의숲 좌표(15110279, 2023-09-22)',
                         '대표 좌표 반경 1 km 수관 피복률'), 'forests': forests},
          open(os.path.join(out, 'forests_nearby.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
