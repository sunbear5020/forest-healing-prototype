"""전문가 판정 일치도·엔진 선호율(docs/EVALUATION.md §5).
실행: python tests/eval/kappa.py tests/eval/out/answer_key.csv rater1.csv rater2.csv
판정 파일 형식은 rater_template.csv와 같음. 표준 라이브러리만 사용."""
import csv, math, random, sys

def read(p):
    with open(p, encoding='utf-8-sig') as f:
        return {r['case_id']: r for r in csv.DictReader(f)}

def kappa(a, b, cats, weighted=False):
    k = len(cats); idx = {c: i for i, c in enumerate(cats)}; n = len(a)
    if n == 0: return float('nan')
    O = [[0] * k for _ in range(k)]
    for x, y in zip(a, b): O[idx[x]][idx[y]] += 1
    ra = [sum(O[i]) for i in range(k)]; cb = [sum(O[i][j] for i in range(k)) for j in range(k)]
    w = lambda i, j: ((i - j) ** 2 / (k - 1) ** 2) if weighted else (0 if i == j else 1)
    obs = sum(w(i, j) * O[i][j] for i in range(k) for j in range(k)) / n
    exp = sum(w(i, j) * ra[i] * cb[j] for i in range(k) for j in range(k)) / n / n
    return 1 - obs / exp if exp else float('nan')

def boot(a, b, cats, weighted, B=2000, seed=1):
    rng = random.Random(seed); n = len(a); out = []
    for _ in range(B):
        s = [rng.randrange(n) for _ in range(n)]
        v = kappa([a[i] for i in s], [b[i] for i in s], cats, weighted)
        if not math.isnan(v): out.append(v)
    out.sort()
    return (out[int(0.025 * len(out))], out[int(0.975 * len(out)) - 1]) if out else (float('nan'),) * 2

def wilson(k, n, z=1.96):
    if n == 0: return (float('nan'),) * 2
    p = k / n; d = 1 + z * z / n; c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return max(0, c - h), min(1, c + h)

def main(key_p, *rater_ps):
    key = read(key_p); raters = [read(p) for p in rater_ps]
    if len(raters) < 2: sys.exit('판정자 2명 이상 필요')
    ids = [i for i in key if all(i in r and r[i]['A_적절성(0/1/2)'].strip() for r in raters)]
    print(f'판정 완료 사례 {len(ids)} / {len(key)}')
    def eng(r, i, col):   # A/B → engine/nearest 기준으로 정렬
        side = 'A' if key[i]['A'] == 'engine' else 'B'
        return r[i][f'{side}_적절성(0/1/2)'].strip() if col == 'eng' else r[i][f"{'B' if side == 'A' else 'A'}_적절성(0/1/2)"].strip()
    for a in range(len(raters)):
        for b in range(a + 1, len(raters)):
            x = [eng(raters[a], i, 'eng') for i in ids] + [eng(raters[a], i, 'base') for i in ids]
            y = [eng(raters[b], i, 'eng') for i in ids] + [eng(raters[b], i, 'base') for i in ids]
            kw = kappa(x, y, ['0', '1', '2'], True); lo, hi = boot(x, y, ['0', '1', '2'], True)
            s1 = [raters[a][i]['안전 안내 적절(예/아니오)'].strip() for i in ids]; s2 = [raters[b][i]['안전 안내 적절(예/아니오)'].strip() for i in ids]
            ks = kappa(s1, s2, ['예', '아니오']); sl, sh = boot(s1, s2, ['예', '아니오'], False)
            print(f'판정자 {a+1}·{b+1}: 적절성 가중 κ={kw:.2f} (95% {lo:.2f}~{hi:.2f}) · 안전 안내 κ={ks:.2f} ({sl:.2f}~{sh:.2f}) · 통과선 가중 κ≥0.60: {"충족" if kw >= 0.6 else "미달"}')
    for n_r, r in enumerate(raters, 1):
        win = tie = 0
        for i in ids:
            v = r[i]['더 나은 쪽(A/B/같음)'].strip()
            if v == '같음': tie += 1
            elif key[i].get(v) == 'engine': win += 1
        dec = len(ids) - tie; lo, hi = wilson(win, dec)
        print(f'판정자 {n_r}: 엔진 선호 {win}/{dec}(같음 {tie}) = {win/dec if dec else float("nan"):.1%}, 95% {lo:.1%}~{hi:.1%} · 통과선(하한>50%): {"충족" if lo > 0.5 else "미달"}')

if __name__ == '__main__':
    main(*sys.argv[1:])
