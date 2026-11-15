"""효과 근거 계층(data/evidence.json)
1) model: 설문 기반 효과모형(코드/alg_v1/effect_model.json, 다른 작업에서 적합) — 그대로 싣는다
2) prior: 산림 미기후·임상→정신건강 메타분석(연구설계/메타분석/작업파일/pooled.json)
   · 효과모형과 단위를 맞추려고 '단일군 사전-사후' 통합값을 사전값으로 씀(둘 다 사전-사후 변화)
   · 95% 예측구간을 10~90% 구간으로 환산(반폭 × 1.2816/1.96)
   · 2026-11-15: 각 사전값에 무작위 대조 연구 통합값(rct, 95% CI)과 GRADE 1차 확실성(grade)을 붙임
     (작업파일/pooled_design_rob.json, grade.json). 사전값 자체(단일군)는 그대로 둠(단위 일치)
3) sigungu_points: 시군구 대표점(도시공원 표준데이터 좌표 중앙값, 근사) — 위치 대신 시군구만 고를 때 사용
"""
import json, sys, statistics, collections
root, parks_raw, out = sys.argv[1:4]
model = json.load(open(f'{root}/코드/alg_v1/effect_model.json'))
pooled = json.load(open(f'{root}/연구설계/메타분석/작업파일/pooled.json'))
Z = 1.2816 / 1.96
try:
    design = json.load(open(f'{root}/연구설계/메타분석/작업파일/pooled_design_rob.json'))
    grade = json.load(open(f'{root}/연구설계/메타분석/작업파일/grade.json'))['grade']
except FileNotFoundError:
    design, grade = {}, {}
def rct(label):
    r = design.get(f"{label} | 무작위(RoB2) = '심각' 제외")
    return None if not r else {'g': round(r['g'], 3), 'lo95': round(r['lo'], 3), 'hi95': round(r['hi'], 3), 'studies': r['m'], 'I2': round(r['I2'], 1)}
def prior(key, label):
    p = pooled[key]; half_l = (p['g'] - p['pil']) * Z; half_h = (p['pih'] - p['g']) * Z
    return {'g': round(p['g'], 3), 'lo': round(p['g'] - half_l, 3), 'hi': round(p['g'] + half_h, 3), 'k': p['k'], 'studies': p['m'],
            'I2': round(p['I2'], 1), 'p': p['p'], 'source_key': key, 'label': label,
            'rct': rct(key.split(' | ')[0]), 'grade': (grade.get(key.split(' | ')[0]) or {}).get('cert')}
priors = {
    'stress': prior('지각 스트레스 | 단일군 사전-사후', '지각 스트레스'),
    'anxiety': prior('불안·긴장 | 단일군 사전-사후', '불안·긴장'),
    'depression': prior('우울 | 단일군 사전-사후', '우울'),
    'fatigue': prior('피로 | 단일군 사전-사후', '피로'),
    'vitality': prior('활력(부호반전) | 단일군 사전-사후', '활력(부호 반전)')}
controlled = {k.split(' | ')[0]: {'g': round(v['g'], 3), 'lo95': round(v['lo'], 3), 'hi95': round(v['hi'], 3), 'k': v['k'], 'p': v['p']}
              for k, v in pooled.items() if k.endswith('대조군 비교')}
temp = {k: v for k, v in pooled.items() if k.startswith('temp:')}
# 시군구 대표점
pts = collections.defaultdict(list)
for r in json.load(open(parks_raw)):
    a = (r['소재지도로명주소'] or r['소재지지번주소'] or '').split()
    try: lat, lng = float(r['위도']), float(r['경도'])
    except: continue
    if len(a) < 2 or not (33 < lat < 39 and 124 < lng < 132): continue
    sg = a[1] if a[0] != '세종특별자치시' else '세종시'
    pts[(a[0], sg)].append((lat, lng))
sp = [{'sido': k[0], 'sigungu': k[1], 'lat': round(statistics.median(x[0] for x in v), 5),
       'lng': round(statistics.median(x[1] for x in v), 5), 'n': len(v)} for k, v in sorted(pts.items()) if len(v) >= 3]
json.dump({'_meta': {'built': '2026-11-15', 'note': __doc__.strip()},
           'model': model, 'prior': priors, 'meta_controlled_95ci': controlled, 'meta_temperature': temp,
           'sigungu_points': sp}, open(out, 'w'), ensure_ascii=False, indent=0)
print(len(sp), priors)
