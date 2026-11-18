# 숲결 웹·앱·쿠버네티스 전환 계획과 1단계 결과

- 작성: 2026-11-16 · 대상 저장소 `sunbear5020/forest-healing-prototype` · 엔진 v0.6.1
- 결정 근거: 사용자 방향(2026-11-16) "웹 전용(PWA 유지), 앱 전용(iOS·Android), 추후 쿠버네티스 이관"
- 표기: **확실하지 않음** = 출처로 확인하지 못한 값, **추정** = 이 저장소 안 측정이나 판단에서 나온 값

## 1. 목적과 범위

같은 추천 엔진 하나를 세 실행 환경에서 쓰도록 구조를 나눈다.

| 실행 환경 | 화면 | 계산 위치 | 배포 |
| --- | --- | --- | --- |
| 웹 전용 | 지금의 `index.html` | 브라우저 안(기본값) 또는 API | GitHub Pages(지금 그대로) |
| 앱 전용(iOS·Android) | 같은 웹 화면을 Capacitor로 감쌈 | 기기 안 또는 API | App Store·Google Play |
| 서버(API) | 없음(웹·앱이 호출) | 컨테이너 안 같은 엔진 | 단일 서버 → 서버리스 → 쿠버네티스 |

이번 1단계는 **구조 분리와 이관 준비물**까지다. 실제 서버 운영, 앱스토어 등록, 클러스터 배포는 하지 않았다.

## 2. 현황 진단(작업 전)

| 항목 | 확인 결과 | 근거 |
| --- | --- | --- |
| 추천 엔진 | 이미 화면과 분리된 순수 함수(UMD)였다. 브라우저·Node 모두에서 동작 | `engine/soopgyeol-engine.js` 머리말, `tests/engine.test.mjs`가 Node에서 실행 |
| 결합 지점 | ① 엔진 입력(ctx) 조립이 브라우저 로더·시험·평가 코드에 따로 있었다. ② 화면(`ui.js`)이 엔진을 직접 불러 계산 위치를 바꿀 수 없었다 | `engine/loader.js`, `tests/engine.test.mjs`, `tests/eval/common.mjs` |
| PWA 여부 | **지금 사이트는 PWA 설치 요건을 갖추지 않았다.** 웹 앱 매니페스트와 아이콘이 없었다 | 저장소에 `manifest` 파일 없음. MDN은 매니페스트(name, 192·512px 아이콘, start_url, display)를 설치 요건으로 든다[S5] |
| 서버 | 없음. 정적 파일만 배포. 예보 자료는 GitHub Actions가 하루 2회 `data/env_today.json`으로 갱신 | `.github/workflows/env-daily.yml` |

## 3. 목표 구조

```
                ┌──────────── 같은 화면 코드(index.html · engine/ui.js) ───────────┐
                │                                                              │
   웹(GitHub Pages)                                           앱(Capacitor: iOS·Android)
                │                                                              │
                └────────── engine/client.js (계산 위치 선택: config.js) ──────────┘
                        │ apiBase 없음(기본)                 │ apiBase 있음
                        ▼                                    ▼
              브라우저 안 SoopEngine            API 서버(server/) ─ 같은 SoopEngine
                        ▲                                    ▲
                        └──── engine/context.js(ctx 조립 규칙 하나) ────┘
                                         ▲
                                  data/*.json · data.js
```

핵심은 **엔진 파일·자료 파일·ctx 조립 규칙이 하나**라는 점이다. 웹·앱·서버가 같은 파일을 쓰므로 결과가 갈라질 수 없고, 아래 5절의 동등성 시험으로 이를 확인한다.

## 4. 이번에 만든 것(1단계)

| 파일 | 역할 |
| --- | --- |
| `engine/context.js` | 자료 → 엔진 ctx 조립 규칙(웹·앱·서버 공용). `loader.js`가 이를 쓰도록 바꿈 |
| `engine/client.js` | 화면이 부르는 계산 층. `config.js`의 `apiBase`가 비면 기기 안 계산, 있으면 API 호출. API 실패·시간 초과 시 기기 안 계산으로 되돌림 |
| `config.js` | 실행 설정. 기본값 `apiBase: ''`(지금과 같은 기기 안 계산) |
| `server/` | 외부 패키지 없는 Node API 서버. `/healthz`, `/readyz`, `/v1/meta`, `/v1/params`, `/v1/sites`, `POST /v1/recommend`, `POST /v1/programs`. 입력 검사(허용 키·범위·본문 64KB), CORS 허용 목록, SIGTERM 정상 종료, 자료 파일 변경 감지 재적재(선택) |
| `docs/api/openapi.yaml` | API 명세(OpenAPI 3.1) |
| `Dockerfile`, `.dockerignore` | API 컨테이너(비루트 사용자, 상태 점검 포함) |
| `deploy/docker-compose.yml` | 단일 서버 실행 예 |
| `deploy/k8s/` | 쿠버네티스 초안: Namespace·ConfigMap·Deployment(2개, 무중단 갱신, 읽기 전용 루트, 권한 상승 금지)·Service·HPA·PDB·Ingress, kustomize 묶음 |
| `.github/workflows/ci.yml` | PR마다 엔진·API 시험, 이미지 빌드·기동 점검, 매니페스트 스키마 검사(kubeconform) |
| `mobile/` | Capacitor 앱 껍데기: 설정, 웹 파일 복사 스크립트(`npm run build:web`) |
| `manifest.webmanifest`, `icons/` | PWA 설치 요건(매니페스트·192/512px 아이콘)[S5]. 서비스 워커는 아직 넣지 않음(6절) |

공개 사이트(GitHub Pages)는 `config.js` 기본값 때문에 **지금과 똑같이 기기 안에서 계산**한다. 서버가 없어도 동작한다.

## 5. 검증 방법과 결과(회귀 점검)

| 점검 | 방법 | 결과 |
| --- | --- | --- |
| 엔진 시험 | `node tests/engine.test.mjs` 작업 전·후 출력 비교 | 24/24 통과, 출력 문자 단위 동일 |
| 사전 고정 규칙 판정 | `node tests/eval/run_eval.mjs` 작업 전·후 출력 비교(실행 시간 줄 제외) | 동일. 단 **S2 기준 미충족(28/35, 80.0%)은 작업 전부터 있던 상태**이며 이번 작업과 무관 |
| API 동등성 | `node tests/api.test.mjs`: 5개 입력(서울·부산·시군구 출발, PM2.5 나쁨, 자해 생각, 방문 불가, 참여자 정보)에 대해 API 응답과 독립 조립 ctx의 직접 엔진 계산을 깊은 비교 | 15/15 통과(동등성 5건 모두 완전 일치, 계수 해시 `97d162df` 일치) |
| 클라이언트 | 같은 시험에서 remote·local·API 실패 시 되돌림 확인 | 3건 모두 결과 동일 |
| 화면 잘림·결과 | Playwright로 390·1440·1920px에서 추천 실행 2회(기본·출발지+방문 불가) 후 결과 문구, 가로 넘침, 화면 밖 요소, 콘솔 오류 비교 | 작업 전·후 결과 문구 동일, 가로 넘침 0, 오류 0 |
| 앱 복사본 | `mobile/www`를 따로 띄워 같은 화면 점검 | 웹과 결과 동일 |
| API 모드 화면 | 화면 설정을 `apiBase=로컬 API`로 바꿔 같은 점검 | 결과 문구 동일(서버 로그에 추천 요청 6건) |
| 컨테이너 내용 | Dockerfile이 복사하는 파일만 따로 모아 서버 실행 | 정상 기동·추천 응답 |

측정(추정, 이 개발 환경 1회): 추천 1회 계산 중앙값 31.5 ms(90분위 38.3 ms), 프로세스 메모리 약 111 MB. 서버 1개(1코어)가 대략 초당 20~30건을 처리할 수 있다는 추정이며, 부하 시험 전이라 **확실하지 않음**.

**하지 못한 점검**: 이 작업 환경에는 Docker 데몬과 쿠버네티스 도구가 없어 이미지 실제 빌드, 매니페스트 스키마 검사, 클러스터 배포를 하지 못했다. 이 둘은 PR의 CI(`ci.yml`)에서 처음 실행된다. Android·iOS 네이티브 빌드는 Android Studio·macOS/Xcode가 필요해 하지 않았다.

## 6. 단계별 계획

| 단계 | 내용 | 조건·산출물 |
| --- | --- | --- |
| 1(완료, 이 PR) | 엔진·ctx 조립 공용화, 계산 위치 선택 층, API·컨테이너·k8s 초안, 앱 껍데기, PWA 매니페스트 | 회귀 없음(5절) |
| 2 웹 PWA 완성 | 서비스 워커(오프라인 화면, 자료 캐시). 캐시 때문에 예보 자료가 낡아 보이지 않도록 자료는 네트워크 우선 | 설치·오프라인 시험 |
| 3 앱 | `mobile/`에서 `npx cap add android/ios`, 아이콘·스플래시, 앱 고유 기능(위치 기반 추천, 방문일 알림) 추가 후 내부 시험 → 심사 제출 | 개발자 계정(7절), 개인정보 처리방침 URL |
| 4 API 단일 운영 | 같은 컨테이너를 단일 서버나 서버리스(Cloud Run 등)에 배포, `config.js`의 `apiBase` 설정 | 도메인·TLS, 개인정보 안내 문구 변경(8절) |
| 5 공공데이터 개방 API | `/v1/sites`, `/v1/params`, 시설 환경 요약 등 읽기 전용 개방. 이용 약관·호출 한도 | 과업 D7~D11 범위와 연결 |
| 6 쿠버네티스 이관 | `deploy/k8s/`를 운영기관 클러스터에 적용. 레지스트리·도메인·인그레스·모니터링 확정 | 이관 기관 결정 후 |

쿠버네티스는 이용자 규모·운영기관이 정해진 뒤에 들어가는 것이 맞다고 본다(판단, 추정 포함). 같은 이미지를 쓰므로 4단계에서 6단계로 갈 때 코드 수정은 필요 없게 설계했다.

## 7. 비용·계정 요건

| 항목 | 내용 | 확인 |
| --- | --- | --- |
| Apple Developer Program | 연 99 USD(현지 통화 환산가 있음). 비영리·**인가된 교육기관**·정부기관은 수수료 면제 신청 대상 | Apple 공식[S1]. 한국 대학·공공기관 면제 적용 여부는 **확실하지 않음**(Apple 문의 필요) |
| Google Play 개발자 계정 | 1회 25 USD | Google 공식[S2] |
| iOS 빌드 환경 | macOS·Xcode 26.0 이상(Capacitor 8 기준) | Capacitor 공식[S3] |
| Android 빌드 환경 | Android Studio 2025.2.1 이상, SDK API 24 이상 | Capacitor 공식[S3] |
| Node.js | 22 이상(Capacitor 8 기준). API 서버는 20 이상이면 동작 | Capacitor 공식[S3], `package.json` |
| Capacitor 버전 | npm 최신 8.6.2(2026-11-16 조회). 공식 문서에 다음 판(9) 안내가 이미 있음 | npm 레지스트리 조회, [S3] |
| 서버·클라우드 비용 | 구성·사업자에 따라 크게 달라 이번에 산정하지 않음 | **확실하지 않음**. 4단계 전에 견적 필요 |

## 8. 개인정보·보안

- 기본값(기기 안 계산)에서는 위치·자가점검 값이 기기 밖으로 나가지 않는다. 화면 문구도 그대로다.
- API 계산으로 바꾸면 이 값이 서버로 **전송**된다. 서버는 본문을 저장·기록하지 않고 접근 기록에 경로·상태·시간만 남기도록 만들었지만, 전송 자체가 생기므로 화면 안내와 개인정보 처리방침을 먼저 고쳐야 한다. 위치 버튼 안내 문구는 `apiBase`가 있으면 자동으로 "서버로 보냅니다(저장 안 함)"로 바뀌게 해 두었다. 자해 생각 문항처럼 민감한 응답이 포함되므로 API 전환 전에 법률 검토가 필요하다고 본다(판단).
- API 키는 서버에 필요 없다. 예보 갱신 키(`DATA_GO_KR_KEY`)는 지금처럼 GitHub Secrets에만 둔다. 이미지·매니페스트에 비밀값이 없다.
- 요청 수 제한은 서버 코드가 아니라 인그레스·API 게이트웨이에서 건다(4·6단계).
- 운영 전 기반 이미지(`node:22-alpine`)를 다이제스트로 고정한다.

## 9. 위험과 대응

| 위험 | 대응 |
| --- | --- |
| Apple 심사 4.2(최소 기능): 웹을 감싼 앱은 "repackaged website"로 반려될 수 있음[S4] | 3단계에서 위치 기반 추천, 방문일 알림 같은 앱 고유 기능을 넣는다. 그래도 반려될 수 있다(확실하지 않음) |
| 웹 화면이 외부 CDN(카카오 지도 SDK·글꼴)에 의존 → 앱이 오프라인이면 지도·글꼴 깨짐 | 3단계에서 앱 복사본에 라이브러리·글꼴을 함께 넣는다(지도는 카카오 SDK 정책상 CDN 키 인증이 필요해 앱 번들만으로는 대체 불가, 확실하지 않음) |
| 같은 저장소의 다른 작업과 충돌 | 이 PR은 `engine/ui.js`(2곳)·`engine/loader.js`·`index.html`·`region.html`(머리 태그)만 고침. 나머지는 새 파일 |
| 서버 자료가 낡음(예보는 하루 2회 갱신) | 이미지 재빌드, 또는 자료 볼륨을 마운트하고 `RELOAD_INTERVAL_SEC`로 자동 재적재 |
| k8s 초안이 실제 클러스터에서 검증되지 않음 | CI 스키마 검사로 형식만 확인. 자원값·확장 기준은 부하 시험 후 조정 |

## 10. 한계

1. 쿠버네티스 매니페스트·Docker 이미지는 이 작업 환경에서 실제로 빌드·배포하지 못했다(5절).
2. 서버 성능 수치는 개발 환경 1회 측정이며 부하 시험 전이다.
3. 앱 `appId`(`kr.soopgyeol.app`)는 자리표시다. 실제로는 기관이 가진 도메인을 거꾸로 쓴 값으로 정해야 한다.
4. 레지스트리 주소(`ghcr.io/sunbear5020/soopgyeol-api`)와 인그레스 도메인(`api.soopgyeol.example`)은 자리표시다.
5. 엔진의 추천 품질 자체는 바꾸지 않았다. S2 미충족 등 기존 평가 결과는 그대로다.

## 출처

- [S1] Apple Developer, "Fee waivers": https://developer.apple.com/help/account/membership/fee-waivers — 연 99 USD, 비영리·인가 교육기관·정부기관 면제 대상
- [S2] Google Play Console Help, "Get started with Play Console"(answer 6112435): https://support.google.com/googleplay/android-developer/answer/6112435 — "US$25 one-time registration fee"
- [S3] Capacitor 공식 문서, Environment Setup(v8): https://capacitorjs.com/docs/getting-started/environment-setup — Node 22+, Xcode 26.0+, Android Studio 2025.2.1+, API 24+
- [S4] Apple, App Store Review Guidelines 4.2 Minimum Functionality: https://developer.apple.com/app-store/review/guidelines/ — "Your app should include features, content, and UI that elevate it beyond a repackaged website."(2026-11-16 원문 확인)
- [S5] MDN, "Making PWAs installable": https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_Installable — 매니페스트·192/512 아이콘·HTTPS, 서비스 워커는 설치 필수 요건 아님
- [S6] Kubernetes 공식 문서 개요: https://kubernetes.io/docs/concepts/overview/ (용어 설명 참고, 이번에 재조회하지 않음)

## 확실하지 않은 항목(모음)

- 한국 국립대·공공기관의 Apple 개발자 수수료 면제 적용 여부
- 서버·클라우드·쿠버네티스 운영 비용
- 감싸는 방식 앱의 Apple 심사 통과 가능성
- 서버 1대 처리량(초당 20~30건 추정)과 k8s 자원값·확장 기준
