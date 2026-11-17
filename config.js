/* 숲결 실행 설정 — 웹(GitHub Pages)·앱(Capacitor)·API 서버 전환용.
   apiBase가 빈 문자열이면 지금처럼 브라우저 안에서 엔진을 계산한다(입력값이 기기 밖으로 나가지 않음).
   apiBase에 API 주소(예: 'https://api.example.kr')를 넣으면 같은 엔진을 서버에서 계산한다.
   서버 계산으로 바꾸면 위치·자가점검 값이 서버로 전송되므로, 화면의 '저장·전송 안 함' 안내와
   개인정보 처리방침을 먼저 고쳐야 한다(docs/PLATFORM_MIGRATION.md §5). */
window.SOOP_CONFIG = window.SOOP_CONFIG || {
  apiBase: '',          // '' = 기기 안 계산(기본값). 서버 계산으로 바꿀 때만 채운다.
  privacyNoticeUrl: '', // 개인정보 처리방침 주소. 비어 있으면 apiBase를 채워도 서버 계산을 켜지 않는다(engine/client.js).
  apiTimeoutMs: 8000,   // 서버 응답 대기 한도. 넘으면 기기 안 계산으로 되돌린다.
  platform: 'web'       // 'web' | 'android' | 'ios' (앱 빌드 스크립트가 바꿔 씀)
};
