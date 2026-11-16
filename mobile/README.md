# 숲결 앱(iOS·Android) — Capacitor 껍데기

웹 화면·엔진 파일을 그대로 복사해 앱으로 감싼다. 화면 코드를 따로 만들지 않는다.
계획·요건·위험: [`../docs/PLATFORM_MIGRATION.md`](../docs/PLATFORM_MIGRATION.md)

```bash
cd mobile
npm install                       # @capacitor/core·cli 8.6.2
npm run build:web                 # ../ 웹 파일 → www/ (기기 안 계산)
# API 계산으로 빌드할 때: node scripts/build-web.mjs --api https://API주소 --platform android
npm run add:android               # Android Studio 2025.2.1+ 필요
npm run add:ios                   # macOS + Xcode 26.0+ 필요
npx cap sync
```

- `appId`(`kr.soopgyeol.app`)는 자리표시다. 기관 도메인을 거꾸로 쓴 값으로 바꾼다.
- `www/`, `android/`, `ios/`는 생성물이라 저장소에 넣지 않는다(.gitignore).
- 아직 하지 않은 일: 앱 고유 기능(위치 기반 추천·방문일 알림), 오프라인용 지도·글꼴 묶기, 아이콘·스플래시, 스토어 등록.
