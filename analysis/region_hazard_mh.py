"""산림재난 피해 시군구와 지역 정신건강 지표의 탐색적 비교 (생태학적, 인과 추론 아님)
입력: data/region_health.json(KCHS 2025), data/region_health_2024.json(KCHS 2024), data/region_hazard.json(피해 지역 표시)
분석 단위: 시군구 229곳. 노출군: (A) 2025년 3월 대형산불 피해 8개 시군, (B) 재선충병 극심 6곳, (C) 극심+심(보도 13곳) 19곳
결과: 스트레스 인지율·우울감 경험률 표준화율(%)의 2025 수준, 2024→2025 변화(Δ)
방법: 기술통계, Mann-Whitney U(양측), 군·시·구 유형 보정 OLS(HC 아님, 고전 SE), 무작위 순열검정(10,000회, 같은 수의 시군구 무작위 추출 평균 Δ와 비교)
사용: python3 analysis/region_hazard_mh.py > analysis/region_hazard_mh_result.txt
"""
import json, random, statistics as S
import numpy as np
from scipy.stats import mannwhitneyu, spearmanr
random.seed(20261116)
r25 = json.load(open('data/region_health.json'))['regions']
r24 = json.load(open('data/region_health_2024.json'))['regions']
hz = json.load(open('data/region_hazard.json'))
rows = []
for s, v in r25.items():
    for g, x in v['sigungu'].items():
        y = r24[s]['sigungu'][g]
        rows.append(dict(sido=s, sg=g, s25=x['stress'], d25=x['depress'], s24=y['stress'], d24=y['depress'],
                         typ='군' if g.endswith('군') else ('구' if g.endswith('구') else '시')))
for r in rows: r['ds'] = r['s25'] - r['s24']; r['dd'] = r['d25'] - r['d24']
def setof(cond): return {(f['sido'], f['sigungu']) for f in hz['sigungu_flags'] if cond(f)}
G = {'A_산불2025(8)': setof(lambda f: f['type'] == 'wildfire'),
     'B_재선충극심(6)': setof(lambda f: f['type'] == 'pwd' and f.get('grade') == '극심'),
     'C_재선충극심+심(19)': setof(lambda f: f['type'] == 'pwd')}
print('N시군구', len(rows))
for k, lab in [('s25', '스트레스2025'), ('d25', '우울감2025'), ('ds', 'Δ스트레스'), ('dd', 'Δ우울감')]:
    x = [r[k] for r in rows]; print(f'{lab}: 평균 {S.mean(x):.2f} SD {S.stdev(x):.2f} 중앙 {S.median(x):.1f} 범위 {min(x):.1f}~{max(x):.1f}')
print('스트레스-우울감 2025 Spearman rho', round(spearmanr([r['s25'] for r in rows], [r['d25'] for r in rows])[0], 3))
print('2024-2025 시군구 순위 상관(스트레스)', round(spearmanr([r['s24'] for r in rows], [r['s25'] for r in rows])[0], 3),
      '(우울감)', round(spearmanr([r['d24'] for r in rows], [r['d25'] for r in rows])[0], 3))
def ols(y, cols):
    X = np.column_stack([np.ones(len(y))] + cols); b = np.linalg.lstsq(X, y, rcond=None)[0]
    e = y - X @ b; s2 = e @ e / (len(y) - X.shape[1]); se = np.sqrt(np.diag(s2 * np.linalg.inv(X.T @ X))); return b[1], se[1]
for name, K in G.items():
    inn = [r for r in rows if (r['sido'], r['sg']) in K]; out = [r for r in rows if (r['sido'], r['sg']) not in K]
    print(f'\n## {name}  n={len(inn)} vs {len(out)}  (매칭 실패 {len(K)-len(inn)})')
    for k, lab in [('s25', '스트레스2025'), ('d25', '우울감2025'), ('s24', '스트레스2024'), ('d24', '우울감2024'), ('ds', 'Δ스트레스'), ('dd', 'Δ우울감')]:
        a = [r[k] for r in inn]; b = [r[k] for r in out]
        p = mannwhitneyu(a, b).pvalue
        y = np.array([r[k] for r in rows]); ex = np.array([1.0 * ((r['sido'], r['sg']) in K) for r in rows])
        gun = np.array([1.0 * (r['typ'] == '군') for r in rows]); gu = np.array([1.0 * (r['typ'] == '구') for r in rows])
        cols = [ex, gun, gu] + ([np.array([r[k.replace('d', 'd24') if False else ('s24' if k == 'ds' else 'd24')] for r in rows])] if k in ('ds', 'dd') else [])
        bcoef, se = ols(y, cols)
        line = f'  {lab}: 노출 평균 {S.mean(a):.2f} / 비노출 {S.mean(b):.2f}, 차 {S.mean(a)-S.mean(b):+.2f}, MWU p={p:.3f}, 유형보정 계수 {bcoef:+.2f} (95%CI {bcoef-1.96*se:+.2f}~{bcoef+1.96*se:+.2f})'
        if k in ('ds', 'dd'):
            obs = S.mean(a); allv = [r[k] for r in rows]
            perm = [S.mean(random.sample(allv, len(a))) for _ in range(10000)]
            pp = (sum(1 for v in perm if abs(v - S.mean(allv)) >= abs(obs - S.mean(allv))) + 1) / 10001
            line += f', 순열 p={pp:.3f}'
        print(line)
    print('  개별:', '; '.join(f"{r['sg']} 스트레스 {r['s24']}→{r['s25']}, 우울 {r['d24']}→{r['d25']}" for r in inn))
