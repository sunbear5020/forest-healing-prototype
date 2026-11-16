"""2026 결과물 HTML에서 프로그램 추천 모형 자료를 꺼내 data/program_model.json으로 저장(발주처 공개 허가 2026-11-16).
실행: python3 scripts/extract_program_model.py "<2026 결과물 HTML>" data/program_model.json"""
import json, re, sys, hashlib, datetime
src, out = sys.argv[1], sys.argv[2]
raw = open(src, encoding='utf-8').read()
sc = re.findall(r'<script[^>]*>(.*?)</script>', raw, re.S)[0]
D, _ = json.JSONDecoder().raw_decode(sc[sc.find('{'):])
def lit(name):
    m = re.search(r'const %s\s*=\s*' % name, sc)
    txt = sc[m.end():]
    # JS 객체 리터럴의 따옴표 없는 키를 JSON으로
    end = {'{': '}', '[': ']'}[txt[0]]; depth = 0
    for i, ch in enumerate(txt):
        depth += ch == txt[0]; depth -= ch == end
        if depth == 0: break
    body = txt[:i + 1]
    body = re.sub(r'([{,])\s*([A-Za-z_]\w*)\s*:', r'\1"\2":', body).replace("'", '"')
    return json.loads(body)
model = {
    '_meta': {'source': '2026 산림치유 프로그램 추천 결과물(단일 HTML)', 'source_sha256': hashlib.sha256(raw.encode('utf-8')).hexdigest()[:16],
              'extracted': datetime.date.today().isoformat(), 'public': False,
              'note': '발주처 공개 허가(2026-11-16, 사용자 확인). 방법·결과는 docs/PROGRAM_MODEL.md'},
    'A50': D['A50'], 'P': D['P'], 'mu': D['mu'], 'sd': D['sd'],
    'IMP': lit('IMP'), 'CATS': lit('CATS'), 'DESC': lit('DESC'),
    'limits': ['같은 프로그램 안에서 누가 더 좋아질지는 거의 구별하지 못함(프로그램 안 AUC 0.50~0.52, 보고서 Ⅵ장 2.1)',
               '순위는 학습자료 8,511명 기반 50개 모형(10번 반복×5묶음)의 평균, 범위는 모형별 순위 10~90%',
               '참가 자격 정보가 없어 운영 대상 문구로 7종 분류(참고용)']
}
assert len(model['A50']) == 50 and len(model['A50'][0]) == 23 and len(model['A50'][0][0]) == len(model['P'])
json.dump(model, open(out, 'w', encoding='utf-8'), ensure_ascii=False)
print('programs', len(model['P']), 'models', len(model['A50']), 'CATS', model['CATS'])
