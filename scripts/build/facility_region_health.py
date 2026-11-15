"""시설 소재 시군구 vs 도심(특별·광역시) 건강지표 비교 → data/facility_region_health.json
자료: 질병관리청 지역사회건강조사 2025, KOSIS orgId 177, 연령 표준화율(SR)과 표준오차(SR_SE)
 - DT_HYPER_DOCTOR 고혈압 진단 경험률(30세 이상), DT_DIA_DOCTOR 당뇨병 진단 경험률(30세 이상)
 - 스트레스 인지율·우울감 경험률은 data/region_health.json(표준오차 없음, 서술만)
KOSIS 조회(2026-11-15) 값을 옮김. 비교: z=(시설지역-서울)/sqrt(SE1²+SE2²), 32개 비교에 BH-FDR.
지역 비교는 인과가 아님(숲이 있어서 덜 아픈 것이 아님). 개인 추천 점수에 넣지 않음."""
import json, math, sys
HYPER = {'서울특별시': (20.7, .3), '부산광역시': (19.3, .4), '대구광역시': (19.1, .5), '인천광역시': (21.9, .5), '광주광역시': (19.1, .6),
         '대전광역시': (20.5, .6), '울산광역시': (19.9, .6),
         '유성구': (16.7, 1.3), '울주군': (22.6, 1.7), '양평군': (22.7, 1.9), '강릉시': (24.8, 1.4), '횡성군': (21.5, 1.9), '제천시': (22.9, 1.5),
         '예산군': (21.8, 1.6), '곡성군': (19.1, 1.4), '장성군': (24.2, 2.0), '화순군': (20.2, 1.7), '김천시': (17.8, 1.0), '영주시': (19.4, 1.7),
         '청도군': (22.0, 2.0), '칠곡군': (20.4, 1.2), '남해군': (20.4, 1.5), '서귀포시': (23.2, 1.0)}
DIA = {'서울특별시': (8.5, .2), '부산광역시': (9.8, .3), '대구광역시': (8.6, .4), '인천광역시': (10.0, .4), '광주광역시': (7.9, .4),
       '대전광역시': (9.4, .4), '울산광역시': (8.8, .4),
       '유성구': (6.7, .8), '울주군': (10.0, 1.0), '양평군': (9.9, 1.2), '강릉시': (9.5, 1.1), '횡성군': (8.7, 1.0), '제천시': (11.0, 1.1),
       '예산군': (10.9, 1.3), '곡성군': (10.6, 1.7), '장성군': (10.5, 1.2), '화순군': (12.3, 1.6), '김천시': (9.2, .9), '영주시': (10.1, 1.4),
       '청도군': (9.1, 1.4), '칠곡군': (9.7, .9), '남해군': (9.5, 1.1), '서귀포시': (9.1, .8)}
assert len(HYPER) == len(DIA) == 23
SITE_SGG = {'F02': ('경상북도', '영주시'), 'F03': ('강원특별자치도', '횡성군'), 'F04': ('경상북도', '칠곡군'), 'F05': ('전라남도', '장성군'),
            'F06': ('경상북도', '청도군'), 'F07': ('대전광역시', '유성구'), 'F08': ('경기도', '양평군'), 'F09': ('강원특별자치도', '강릉시'),
            'F10': ('울산광역시', '울주군'), 'F11': ('경상북도', '김천시'), 'F12': ('충청북도', '제천시'), 'F13': ('충청남도', '예산군'),
            'F14': ('전라남도', '곡성군'), 'saneum': ('경기도', '양평군'), 'jangseong': ('전라남도', '장성군'), 'seogwipo': ('제주특별자치도', '서귀포시'),
            'hwasun': ('전라남도', '화순군'), 'namhae': ('경상남도', '남해군')}
REF = '서울특별시'
def p2(z): return math.erfc(abs(z) / math.sqrt(2))
rows = []
for sgg in sorted({v[1] for v in SITE_SGG.values()}):
    for key, tab, label in [('hypertension', HYPER, '고혈압 진단 경험률'), ('diabetes', DIA, '당뇨병 진단 경험률')]:
        (a, sa), (b, sb) = tab[sgg], tab[REF]
        z = (a - b) / math.sqrt(sa ** 2 + sb ** 2)
        rows.append({'sigungu': sgg, 'key': key, 'label': label, 'value': a, 'se': sa, 'ref': b, 'ref_se': sb, 'diff': round(a - b, 1), 'z': round(z, 2), 'p': p2(z)})
m = len(rows); order = sorted(range(m), key=lambda i: rows[i]['p']); q = [0] * m; prev = 1
for rank, i in reversed(list(enumerate(order, 1))):
    prev = min(prev, rows[i]['p'] * m / rank); q[i] = prev
for r, qq in zip(rows, q):
    r['q'] = round(qq, 4); r['p'] = round(r['p'], 4)
    r['verdict'] = ('lower' if r['diff'] < 0 else 'higher') if qq < 0.05 else 'unclear'
rh = json.load(open('data/region_health.json', encoding='utf-8'))['regions']
mental = {}
for fid, (sido, sgg) in SITE_SGG.items():
    reg = rh.get(sido) or next((v for k, v in rh.items() if k[:2] == sido[:2]), None)
    sg = reg and reg['sigungu'].get(sgg)
    mental[sgg] = {'stress': sg and sg['stress'], 'depress': sg and sg['depress'], 'ref_stress': rh[REF]['stress'], 'ref_depress': rh[REF]['depress']}
out = {'_meta': {'source': '질병관리청 지역사회건강조사 2025, KOSIS orgId 177 DT_HYPER_DOCTOR·DT_DIA_DOCTOR(연령 표준화율·표준오차), 정신건강은 region_health.json',
                 'retrieved': '2026-11-15', 'reference': '서울특별시(도심 비교 기준)', 'test': 'z 검정, 32개 비교 BH-FDR q<0.05',
                 'links': ['https://kosis.kr/statHtml/statHtml.do?orgId=177&tblId=DT_HYPER_DOCTOR', 'https://kosis.kr/statHtml/statHtml.do?orgId=177&tblId=DT_DIA_DOCTOR'],
                 'urban': {k: {'hypertension': HYPER[k][0], 'diabetes': DIA[k][0]} for k in HYPER if k.endswith('시') and ('특별' in k or '광역' in k)},
                 'caution': '지역 간 차이는 인과가 아닙니다(숲이 있어서 덜 아프다는 뜻이 아님). 개인 추천 점수에 넣지 않고 시설 지역 맥락으로만 보여 줍니다. 질병코드(진료) 자료가 아니라 설문 기반 진단 경험률입니다.'},
       'sites': SITE_SGG, 'comparisons': rows, 'mental': mental}
json.dump(out, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for r in rows: print(r['sigungu'], r['key'], r['value'], 'vs', r['ref'], r['diff'], r['q'], r['verdict'])
