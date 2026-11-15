# 숲결 맞춤 추천 엔진 v0.4 — 구조와 자료

사용자의 **지금 상태·니즈**를 **시설 환경(고정/평년/실황)**, **효과 근거**와 맞춰 치유의 숲 방문을 추천하고,
방문이 어려우면 **디지털치료제(자리) → 집 근처 수관 피복이 넉넉한 공원 → 가까운 산림** 순으로 안내합니다.
GitHub Pages에서 그대로 돌아가는 정적 구성이며, 입력값은 브라우저 안에서만 계산합니다(저장·전송 없음).

## 1. 처리 흐름

```
입력(자가점검 6영역·목적·걷기·이동 허용·방문일·출발 위치·방문 가능 여부)
  │
  ├─① 안전 확인 ─ 자해 생각 → 상담전화(109, 1577-0199) 먼저, 대안 경로 강조
  ├─② 상태 프로필 ─ 영역 가중치 w(스트레스·불안·우울감·피로·수면·호흡기)
  ├─③ 시설별 평가(18곳)
  │    E 효과: 설문 효과모형(시설×영역×월, 10~90% 구간) → 없으면 측정기관 중앙값(유사 시설 추정)
  │             + 효과모형 환경항은 Benjamini–Hochberg 보정(q<0.05) 후 남은 항만 반영
               → 2026-11-15 현재 29개 중 명목 p<0.05 4개, 보정 후 0개 = 반영 없음(v0.1은 보정 없이 p<0.05를 써서 과대 반영)
  │    V 환경: 방문일 예보(③층) → 없으면 최근 5년 월평균(②층) + 수관 피복·경사·피톤치드(①층)
  │             폭염(33℃)·강풍(14 m/s)·PM2.5 나쁨(36) 안전 규칙, 나머지 계수는 시연값
  │    A 접근: 출발점-시설 거리 → 이동시간 추정, 허용시간 초과 시 제외
  ├─④ 종합 = 0.5·E + 0.3·V + 0.2·A(시연값), 몬테카를로 400회로 점수·순위 범위(10~90%, 효과 불확실성만 반영)
  ├─④' 나쁜 날씨(PM2.5 나쁨·비)면 실내 대체 시설 있는 곳을 점수보다 먼저(v0.3, 시연 규칙)
  ├─④'' 불확실하면 가까운 곳 우선(v0.4): 같은 단계 안에서 최고점 시설보다 5점 넘게 낮을 확률이 80% 미만인 시설 중 이동시간이 가장 짧은 곳을 앞에(효과 구간 정규 근사, 시드 무관). 가상 판정 후 추가한 사후 규칙
  ├─⑤ 프로그램(목적 태그·난이도·기상 → 실내 전환), 주변 산림 20 km, 관광 연계 자리
  └─⑥ 대체 경로: 디지털치료제 자리 / 공원(수관 ≥30%, ≥1 ha, 2→5→10 km) / 산림공원(수관 ≥60%, ≥10 ha) / 도시숲(자료 없음, 자리만) / 가까운 휴양림·치유의숲
       강풍·폭염·PM2.5 나쁨이면 실외 자제 안내를 먼저(v0.3)
```

지역 건강 지표(지역사회건강조사)는 **출발 시군구의 맥락 표시**에만 쓰고 개인 점수에는 넣지 않습니다(생태학적 오류 방지).

## 2. 파일

| 경로 | 내용 |
| --- | --- |
| `engine/soopgyeol-engine.js` | 엔진(순수 함수, 브라우저·Node 겸용). 계수표 `PARAMS`에 근거 등급(rule/literature/model/demo) 표기 |
| `engine/loader.js` | `data/*.json`을 읽어 엔진 입력(ctx) 구성. 공원 목록은 필요할 때만 읽음 |
| `engine/ui.js` | 기존 화면 결과 영역 위 '내 상태 맞춤 추천' 카드 |
| `data/*.json` | 정적 자료 = 공개 조회용 API(GET). 아래 표 |
| `scripts/build/*.py` | 연구 원자료 → `data/*.json` 재생성 |
| `scripts/fetch_env_today.py` | 예보·대기질 스냅샷. `.github/workflows/env-daily.yml`이 하루 2회 실행 |
| `tests/engine.test.mjs` | 엔진 시험 19건(`node tests/engine.test.mjs`) |
| `docs/EVALUATION.md` | **사전 고정 평가계획**: 좋은 추천의 정의, 판정 기준·통과선, 전문가 판정 절차, 변경 기록 |
| `tests/eval/run_eval.mjs` | 1,600건 교차 시나리오 규칙 판정 → `tests/eval/out/report.{md,json}` |
| `tests/eval/make_expert_cases.mjs`, `kappa.py` | 전문가 블라인드 판정 사례 100건(엔진 vs 가까운 순), 판정자 간 κ·엔진 선호율 |

## 3. 자료 계층과 확보 상태(2026-11-15)

| 계층 | 파일 | 출처 | 상태 |
| --- | --- | --- | --- |
| 효과(설문) | `evidence.json › model` | 2025·2026 효과성 설문 코딩자료 효과모형(alg_v1, 9개 기관·8개 영역, 부트스트랩 50) | 확보. 2026 자료 완성 후 재적합 |
| 효과(문헌) | `evidence.json › prior` | 산림 미기후·임상→정신건강 메타분석 통합값(단일군 사전-사후, 95% PI→80% 환산) | 확보(참고값) |
| ① 지형 | `terrain.json` | 수치지형도 1:5,000 → 5 m DEM(실험실 구축), 반경 0.5/1 km | 13곳 확보 |
| ① 수관 피복 | `facility_env.json` | ESA WorldCover 10 m 2021(CC BY 4.0), 나무 피복 비율 | 확보 |
| ① 피톤치드 | `facility_env.json` | 진흥원 게시 시험성적서 2018, 136건(8곳), 테르펜 6종 합 | 확보, 1회성 측정 |
| ② 기후 | `facility_env.json` | 매칭 ASOS/AWS 2021~2025 일자료 월평균, 0.65 ℃/100 m 보정 | 확보(30년 평년 아님) |
| ③ 실황 | `env_today.json` | 기상청 단기예보(5 km 격자), 에어코리아 시도 PM2.5 중앙값 | 자동 갱신(Secrets 등록 필요) |
| 대안: 공원 | `parks.json` | 전국도시공원정보표준데이터(15012890), 1 ha 이상 4,755곳 + WorldCover 원형 근사 | 확보 |
| 대안: 산림공원 | `parks.json` | 같은 공원 자료 중 수관 피복 60% 이상·10 ha 이상(공식 구분 아님, 시연 기준) | 확보 |
| 대안: 도시숲 | — | 법상 도시숲 전국 위치자료 없음(통계 15157393은 행정수치). 대용안: 임상도(15093362) × 용도지역 도시지역(15047831) 교차, 가로수(15120900) | **미확보**(PC에서 내려받기 필요) |
| 대안: 산림 | `forests_nearby.json` | 전국휴양림표준데이터(15013111) 186곳 + 산림청 치유의숲 좌표(15110279) 38곳 | 확보 |
| 시설 지역 건강 | `facility_region_health.json` | 지역사회건강조사 2025 고혈압·당뇨병 진단 경험률(연령 표준화율·표준오차), 시설 시군구 vs 서울, z 검정+BH | 확보. 32개 비교 중 보정 후 유의한 차이 0개. 맥락 표시만 |
| 지역 맥락 | `region_health.json` | 지역사회건강조사 2025 시군구 스트레스 인지율·우울감 경험률(KOSIS 177) | 확보 |
| 관광 연계 | `tourism.json` | 한국관광공사 국문 관광정보 서비스(KorService2) 위치기반 조회, 시설 반경 10 km 관광지·문화시설·레포츠 | 확보(2026-11-15). 재수집: `scripts/build/tourism.py` |
| 디지털치료제 | — | 개발 중 | 연결 자리만(`ctx.digitalTherapeutic`) |
| 임상도·수종 | — | 산림청 임상도 | 미확보. 프로토타입 12곳은 공개자료 요약(data.js) |

## 4. 결과에 함께 나오는 기록(v0.2)

- `config`: 엔진 버전, 계수표 해시(`paramsHash`), seed, 반복 수, 효과모형 버전·적합 시각, 예보 기준시각, 시설·공원·산림 수.
- `warnings`: 자료 누락(효과모형·예보·시설 기상)과 입력 보정을 조용히 넘기지 않고 표시.
- `evidenceAudit.envTerms`: 환경항 검정 수, 명목 유의 수, 보정 후 유지 수.
- 시설 순서를 id로 고정하고 동점은 id로 정해, 입력 순서가 결과를 바꾸지 않음.

## 5. 해석 제한

- 효과 값은 대조군 없는 사전-사후 변화이며 인과 효과가 아닙니다.
- 시설 간 효과 차이에는 사업·대상군 구성이 섞여 있습니다. 환경 때문이라고 해석하면 안 됩니다.
- 효과모형 교차검증에서 환경지표 추가는 예측력을 높이지 못했습니다(R² 0.648→0.642). 환경 점수는 주로 안전·쾌적 규칙입니다.
- 수면·호흡기는 결과 척도가 없어 효과를 계산하지 않습니다(환경 노출만 반영, 근거 수준 낮음).
- 효과측정 자료가 없는 시설은 측정기관 중앙값을 같게 쓰고 범위를 넓게 둡니다. 효과로는 서로 구분되지 않습니다.
- 공원 수관 피복은 공원 경계가 아닌 대표 좌표 원형 근사입니다. 공원 수종은 아직 결합하지 않았습니다.
- 에어코리아 측정소 위치 API(MsrstnInfoInqireSvc)가 미승인이라 PM2.5는 시도 중앙값입니다.
- 자가점검은 진단이나 표준화된 선별도구가 아닙니다.
- 규칙 판정(`tests/eval`) 통과는 엔진이 자기 규칙을 지킨다는 뜻일 뿐, 추천이 사람에게 맞다는 근거가 아닙니다. 전문가 판정 전입니다.
- 후보가 4곳 이상인 사례 133건에서 엔진 상위 3곳은 가까운 순 3곳과 평균 2.35곳 겹치고, 35%는 구성이 같습니다. 현재 개인화의 몫은 크지 않습니다.
- 산음·장성·서귀포·만연산·남해 5곳의 월평균 기후는 인접 ASOS(양평·고창·서귀포·광주·남해) 2021~2025 일자료이며 표고 보정이 없습니다(`scripts/build/climate_asos.py`).

## 6. 재생성

```bash
R="<프로젝트 폴더>"; WC="<WorldCover 타일 폴더: N33E126 N33E129 N36E126 N36E129>"
python scripts/build/terrain.py "$R/자료/dem_수치지형도" "$R/연구설계/시설좌표_검수본.csv" data/terrain.json
python scripts/build/facility_env.py "$R" "$WC" data/facility_env.json
python scripts/build/sites.py "$R" data/sites.json
python scripts/build/green_places.py parks_raw.json rcrfrst.json healforest.json "$WC" data
python scripts/build/evidence.py "$R" parks_raw.json data/evidence.json
python scripts/build/region_health.py data/region_health.json
python scripts/build/facility_region_health.py data/facility_region_health.json
DATA_GO_KR_KEY=... python scripts/build/climate_asos.py data/facility_env.json
DATA_GO_KR_KEY=... python scripts/build/tourism.py data/sites.json data/tourism.json
DATA_GO_KR_KEY=... python scripts/fetch_env_today.py
node tests/engine.test.mjs
node tests/eval/run_eval.mjs          # 규칙 판정(사전 기준 미달이 있으면 종료 코드 1)
node tests/eval/make_expert_cases.mjs # 전문가 판정 사례
```
