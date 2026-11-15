"""추천 대상 시설 목록(data/sites.json)
· 1차 범위: 진흥원 프로그램 운영시설 후보 13곳(F02~F14) + 프로토타입에만 있던 공립·기타 치유의숲 6곳 = 19곳
· protoId는 data.js FORESTS의 id(시설 상세·프로그램 정보가 있는 곳)
· modelKey는 설문 효과모형(effect_model.json) 시설 키. 없으면 문헌 사전값 사용
· 국립춘천·나주숲체원은 효과모형에는 있으나 좌표·환경자료가 없어 추천 대상에서 뺐다(좌표 확보 후 추가)
"""
import json, csv, sys
root, out = sys.argv[1:3]
coords = {r['facility_id']: r for r in csv.DictReader(open(f'{root}/연구설계/시설좌표_검수본.csv', encoding='utf-8-sig'))}
REGION = {'경기': '수도권', '서울': '수도권', '인천': '수도권', '강원': '강원', '충청': '충청', '대전': '충청', '세종': '충청',
          '전라': '전라', '광주': '전라', '전북': '전라', '경상': '경상', '대구': '경상', '부산': '경상', '울산': '경상', '제주': '제주'}
def region(addr):
    for k, v in REGION.items():
        if addr.startswith(k): return v
    return None
PROTO = {'F02': 'daslim', 'F03': 'cheongtaesan', 'F04': 'chilgok', 'F09': 'daegwallyeong', 'F10': 'daeunsan', 'F12': 'jecheon', 'F13': 'yesan'}
sites = []
for fid in [f'F{i:02d}' for i in range(2, 15)]:
    r = coords[fid]
    sites.append({'id': fid, 'facilityId': fid, 'protoId': PROTO.get(fid), 'name': r['기관'], 'kind': r['유형'],
                  'lat': float(r['위도']), 'lng': float(r['경도']), 'address': r['도로명주소'], 'region': region(r['도로명주소']),
                  'operator': '국립(한국산림복지진흥원)', 'modelKey': fid})
# 프로토타입 전용(공립 등) — 좌표는 data.js(카카오맵 지오코딩)
for pid, name, lat, lng, reg, addr in [
    ('saneum', '산음 치유의 숲', 37.5870, 127.5853, '수도권', '경기 양평군 단월면'),
    ('jangseong', '장성 편백 치유의 숲(축령산)', 35.3688, 126.7315, '전라', '전남 장성군 서삼면'),
    ('seogwipo', '서귀포 치유의 숲', 33.2919, 126.5279, '제주', '제주 서귀포시 산록남로 2271'),
    ('hwasun', '만연산 치유의 숲', 35.0848, 126.9820, '전라', '전남 화순군 화순읍'),
    ('namhae', '남해 편백 치유의 숲', 34.7521, 128.0201, '경상', '경남 남해군 삼동면')]:
    sites.append({'id': pid, 'facilityId': None, 'protoId': pid, 'name': name, 'kind': '치유의숲', 'lat': lat, 'lng': lng,
                  'address': addr, 'region': reg, 'operator': '공립·기타', 'modelKey': None})
json.dump({'_meta': {'built': '2026-11-15', 'note': __doc__.strip()}, 'sites': sites}, open(out, 'w'), ensure_ascii=False, indent=1)
print(len(sites))
