"""시설 환경 프로필(3층 중 ①고정·②평년 대체) 생성 → data/facility_env.json
①고정: 지형(terrain.json), 수관 피복(ESA WorldCover, 반경 1 km), 피톤치드 성적서(2018, 진흥원 게시)
②기후: 매칭 관측소(ASOS/AWS) 2021~2025 일자료의 월평균, 표고차 기온감률 보정(aws_match.csv의 lapse_adj_c)
   ※ 30년 평년값이 아니라 최근 5년 관측 평균이다.
③실황 편차: 엔진이 실행 시 env_today.json(예보)과 ②의 차이로 계산
사용: python facility_env.py <연구폴더> <worldcover_dir> <out_json>
"""
import sys, os, json, csv
import pandas as pd, numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from canopy import TreeCover
root, wc, out = sys.argv[1:4]
coords = pd.read_csv(f'{root}/연구설계/시설좌표_검수본.csv')
coords = coords[coords['분석후보'].str.startswith('Y')]
terrain = json.load(open(os.path.join(os.path.dirname(out), 'terrain.json')))['facilities']
tc = TreeCover(wc)

# ② 월별 기후(표고 보정)
d = pd.read_csv(f'{root}/자료/kma_aws/facility_daily_2021_2025.csv', parse_dates=['date'])
d['m'] = d.date.dt.month
d['tavg'] = d.tavg_h + d.lapse_adj_c
d['tmax_s'] = d.tmax + d.lapse_adj_c
t, h = d.tavg, d.rh_h
d['di'] = 0.81 * t + 0.01 * h * (0.99 * t - 14.3) + 46.3          # 불쾌지수(기상청 식)
clim = {}
for (fid, m), g in d.groupby(['facility_id', 'm']):
    clim.setdefault(fid, {})[int(m)] = {
        'tavg': round(g.tavg.mean(), 1), 'tmax': round(g.tmax_s.mean(), 1), 'rh': round(g.rh_h.mean(), 0),
        'rain_day_pct': round(100 * (g.rain >= 1).mean(), 0), 'hot_day_pct': round(100 * (g.tmax_s >= 30).mean(), 0),
        'di': round(g.di.mean(), 1), 'ws': round(g.ws_h.mean(), 1), 'n_days': int(g.tavg.notna().sum())}
stn = pd.read_csv(f'{root}/자료/kma_aws/aws_match.csv').set_index('facility_id')

# ① 피톤치드(2018)
p = pd.read_csv(f'{root}/자료/피톤치드_시험성적서_2018/피톤치드_성적서별_요약.csv')
p['m'] = pd.to_datetime(p['포집일자'], errors='coerce').dt.month
name2f = {'국립산림치유원': 'F02', '국립횡성숲체원': 'F03', '국립칠곡숲체원': 'F04', '국립장성숲체원': 'F05', '국립청도숲체원': 'F06',
          '국립양평치유의숲': 'F08', '국립대관령치유의숲': 'F09', '대운산 치유의숲': 'F10'}
p['fid'] = p['기관_게시판'].map(name2f)
TERP = ['α-Pinene', 'β-Pinene', 'Camphene', 'Limonene', 'Camphor', 'Bornyl acetate']
phy = {}
for fid, g in p.dropna(subset=['fid']).groupby('fid'):
    phy[fid] = {'n': int(len(g)), 'sites': sorted(set(g['포집장소'].astype(str)))[:6],
                'species': sorted(set(g['수종_괄호'].dropna().astype(str))),
                'terpene_ppt_median': round(float(g['성분합_Benzaldehyde제외'].median()), 1),
                'anion_median': None if g['음이온_ions_cm3'].isna().all() else int(g['음이온_ions_cm3'].median()),
                'top_terpenes': {c: round(float(g[c].median()), 1) for c in TERP if c in g and g[c].notna().any()},
                'months': sorted(int(x) for x in g.m.dropna().unique())}
# 수종별(전체 136건) 중앙값 — 측정 없는 시설의 수종 기반 참고값
spc = {}
for s, g in p.groupby('수종_괄호'):
    spc[s] = {'n': int(len(g)), 'terpene_ppt_median': round(float(g['성분합_Benzaldehyde제외'].median()), 1),
              'anion_median': None if g['음이온_ions_cm3'].isna().all() else int(g['음이온_ions_cm3'].median())}

fac = {}
for _, r in coords.iterrows():
    fid = r.facility_id
    c = tc.frac(r['위도'], r['경도'], 1000)
    s = stn.loc[fid] if fid in stn.index else None
    fac[fid] = {'facility_id': fid, 'name': r['기관'], 'type': r['유형'], 'lat': r['위도'], 'lng': r['경도'],
                'address': r['도로명주소'],
                'fixed': {'terrain': terrain.get(fid), 'canopy_1km': c, 'phytoncide_2018': phy.get(fid)},
                'climate': {'station': None if s is None else {'id': int(s.stn_id), 'name': s['name'], 'type': s.stn_type,
                                                                 'dist_km': float(s.dist_km), 'dh_m': float(s.dh_m),
                                                                 'lapse_adj_c': float(s.lapse_adj_c)},
                            'monthly': clim.get(fid)}}
    print(fid, c and c['tree'], fid in phy, bool(clim.get(fid)))
json.dump({'_meta': {
    'built': '2026-11-15',
    'layers': {'fixed': '지형(수치지형도 5 m DEM), 수관 피복(ESA WorldCover 2021, 반경 1 km), 피톤치드(진흥원 게시 시험성적서 2018, 136건 중 시설 대응분)',
               'climate': '매칭 관측소 2021~2025 일자료 월평균, 기온은 표고차×0.65 ℃/100 m 보정. 30년 평년값 아님',
               'anomaly': '엔진 실행 시 예보값 − 월평균으로 계산'},
    'phytoncide_caveat': '2018년 1회성·일부 지점 측정. 포집 시간대·기상 미기재. 총량의 약 82%가 벤즈알데하이드라 테르펜 6종 합(벤즈알데하이드 제외)을 지표로 씀. 피톤치드 농도와 치유 효과의 관계는 본 연구에서 추정하지 않음.',
    'lapse_rate_c_per_100m': 0.65},
    'species_phytoncide_2018': spc, 'facilities': fac}, open(out, 'w'), ensure_ascii=False, indent=1)
