"""시설별 기온 평년값(월)을 facility_env.json 의 climate.normal 에 넣는다.

연구계획 결정(2026-11-15, 사용자 승인):
  - 주분석: 공식 평년값(기상청 sfc_norm1, 1991~2020)이 있는 관측소는 그 값,
    없는 AWS 8곳은 자체 조화회귀 평년값 '현 위치~2025 확장판'
  - 강릉성산(678, 대관령)·대덕(809, 김천)은 10년 기준 미달 → 강릉(105)·거창(284) ASOS 공식 평년값으로 대체
  - 민감도: AWS 8곳의 1991~2020(현 위치 구간)판
자료: 프로젝트 폴더 자료/kma_aws/ (normals_source_by_facility.csv, raw/sfc_norm1_D_1991-2020.txt,
      normals_self_8stn_ext2025.csv, normals_self_8stn.csv, raw/stn_inf_SFC_20251231.txt)
기온은 기존 climate.monthly 와 같은 표고 보정(0.65 ℃/100 m)을 적용한다.
  - 같은 관측소: climate.station.lapse_adj_c 그대로
  - ASOS 대체: (관측소 표고 − 시설 대표점 표고) × 0.65/100
일 평년값(doy 1~365)의 달별 평균으로 월 평년값을 만든다(윤일 무시).
실행: python3 scripts/build/climate_normals.py <kma_aws 폴더>
"""
import csv, json, sys, os, datetime as dt
from collections import defaultdict

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'facility_env.json')
LAPSE = 0.65


def month_of_doy(doy):
    return (dt.date(2021, 1, 1) + dt.timedelta(days=doy - 1)).month


def read_csv(p):
    with open(p, encoding='utf-8-sig') as f:
        return list(csv.DictReader(f))


def official():
    out = defaultdict(lambda: defaultdict(list))  # stn -> month -> [(ta, tmax, tmin, hm)]
    with open(os.path.join(SRC, 'raw', 'sfc_norm1_D_1991-2020.txt'), encoding='utf-8', errors='replace') as f:
        for line in f:
            if line.startswith('#') or not line.strip():
                continue
            c = [x.strip() for x in line.split(',')]
            stn, mm = int(c[1]), int(c[2])
            ta, tx, tn, hm = float(c[4]), float(c[5]), float(c[6]), float(c[10])
            out[stn][mm].append((ta, tx, tn, hm))
    return out


def self_normals(fname):
    out = defaultdict(lambda: defaultdict(list))
    for r in read_csv(os.path.join(SRC, fname)):
        doy = int(r['doy'])
        if doy > 365:
            continue
        out[int(r['stn_id'])][month_of_doy(doy)].append((float(r['tavg']), float(r['tmax']), float(r['tmin']), None))
    return out


def stn_elev():
    el = {}
    with open(os.path.join(SRC, 'raw', 'stn_inf_SFC_20251231.txt'), encoding='utf-8', errors='replace') as f:
        for line in f:
            if line.startswith('#') or not line.strip():
                continue
            c = line.split()
            try:
                el[int(c[0])] = float(c[4])
            except (ValueError, IndexError):
                pass
    return el


def monthly(src, stn, adj):
    if stn not in src:
        return None
    res = {}
    for m in range(1, 13):
        rows = [r for r in src[stn][m] if r[0] > -90]
        if not rows:
            return None
        mean = lambda i: sum(r[i] for r in rows) / len(rows)
        d = {'tavg': round(mean(0) + adj, 1), 'tmax': round(mean(1) + adj, 1), 'tmin': round(mean(2) + adj, 1)}
        hm = [r[3] for r in rows if r[3] is not None and r[3] > -90]
        if hm:
            d['rh'] = round(sum(hm) / len(hm), 1)
        res[str(m)] = d
    return res


def main():
    env = json.load(open(OUT, encoding='utf-8'))
    off, ext, base = official(), self_normals('normals_self_8stn_ext2025.csv'), self_normals('normals_self_8stn.csv')
    elev = stn_elev()
    src_rows = {r['facility_id']: r for r in read_csv(os.path.join(SRC, 'normals_source_by_facility.csv'))}
    log = []
    for fid, r in src_rows.items():
        fac = env['facilities'].get(fid)
        if not fac or 'climate' not in fac:
            log.append(f'{fid}: facility_env 에 없음 → 건너뜀')
            continue
        st = fac['climate']['station']
        obs, anom = int(r['obs_stn_id']), int(r['anom_stn_id'])
        method = r['평년값_방식']
        if obs == anom:
            adj = st['lapse_adj_c']
        else:  # ASOS 대체
            pe = fac['fixed']['terrain']['point_elev']
            adj = round((elev[anom] - pe) * LAPSE / 100, 2)
        if '공식' in method or 'ASOS' in method:
            main_m, period = monthly(off, anom, adj), '기상청 공식 일평년값 1991~2020'
            sens = monthly(base, obs, st['lapse_adj_c']) if obs in base else None
            sens_label = '시설 인근 AWS 자체 평년값(1991~2020 현 위치 구간, 10년 미만)' if sens else None
        else:
            main_m, period = monthly(ext, anom, adj), '자체 조화회귀 평년값(현 위치 설치~2025 확장판)'
            sens = monthly(base, anom, adj)
            sens_label = '자체 조화회귀 평년값(1991~2020 현 위치 구간)'
        fac['climate']['normal'] = {
            'station': {'id': anom, 'name': r['anom_stn_name'], 'lapse_adj_c': adj},
            'method': method, 'period': period, 'note': r['비고'],
            'monthly': main_m,
            'sensitivity': {'label': sens_label, 'monthly': sens} if sens else None,
        }
        log.append(f"{fid} {r['기관']}: {method} · stn {anom} · 보정 {adj:+.2f} ℃ · 7월 평년 {main_m['7']['tavg']} vs 2021~2025 평균 {fac['climate']['monthly']['7']['tavg']}")
    env['_meta']['layers']['normal'] = ('climate.normal: 기온 평년값(월). 주분석=공식 1991~2020 또는 자체 조화회귀 확장판(~2025), '
                                        '강릉성산·대덕은 강릉·거창 ASOS 대체, sensitivity=1991~2020판. scripts/build/climate_normals.py')
    env['_meta']['layers']['anomaly'] = '엔진 실행 시 예보 평균기온 − 평년값(climate.normal, 없으면 2021~2025 월평균)으로 계산'
    json.dump(env, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('\n'.join(log))


if __name__ == '__main__':
    main()
