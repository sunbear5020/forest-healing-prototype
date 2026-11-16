# 숲결 색상 팔레트 (2026-11-16)

## 기준
- 사용자 지정: 주색 **#6FADCF**, 보조색 **#706CA2**.
- 비율: 광고·보고서·UI 디자인에서 널리 쓰는 **60-30-10 규칙**(중립 60%, 주색 30%, 보조·강조 10%)을 따랐다. 출처: [UX Planet](https://uxplanet.org/the-60-30-10-rule-a-simple-way-to-creating-catchy-user-interfaces-e9e2cf957213), [Uxcel](https://uxcel.com/blog/mastering-the-60-30-10-rule-in-design-691), [Vision Australia](https://employmentservices.visionaustralia.org/business-consulting/digital-access/Creating-accessible-digital-colour-palettes-60-30-10-design-rule). 이 규칙은 실무 경험칙이며 실증 연구로 검증된 기준은 아니다(확실하지 않음).
- 대비: WCAG 2.1 AA. 일반 글자 4.5:1, 큰 글자 3:1, 비텍스트 UI 3:1(1.4.11). 출처: [WebAIM](https://webaim.org/articles/contrast/), [W3C 1.4.11 해설](https://w3c.github.io/wcag21/understanding/non-text-contrast), [MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Understanding_WCAG/Perceivable/Color_contrast).
- 강조색: 주색(파랑, 색상각 약 200°)의 보색 계열인 주황(약 28°)을 골랐다. 보색 강조는 일반적인 색채 조화 원리다. 이 색상값 자체는 출처가 아니라 판단으로 정했다(추측입니다).

## 팔레트

| 역할 | HEX | 용도 | 대비(대상 바탕) |
|---|---|---|---|
| 주색 | #6FADCF | 주요 버튼, 순위 원, 막대, 지도 핀 등 면·장식 | 흰 바탕 2.45:1 → **글자에 쓰지 않음** |
| 주색 위 글자 | #0F2A3A | 주색 면 위 글자 | #6FADCF 위 6.06:1 |
| 주색 짙은색 | #1D4F6B | 제목·강조 글자, 짙은 면(흰 글자) | 흰 바탕 8.81:1 |
| 주색 중간색 | #2B6A8E | 보조 글자·면 | 흰 바탕 5.91:1 |
| 주색 옅은색 | #E2EFF6 | 배경 강조, 태그 | #1D4F6B 글자 7.52:1 |
| 보조색 | #706CA2 | 선택된 칩, 근거 등급 '높음', 3순위 핀, 막대 | 흰 글자 4.82:1 |
| 보조색 글자 | #5F5B93 | 소제목(eyebrow) | 흰 바탕 6.07:1 |
| 보조색 옅은색 | #ECEBF5 | 취향 배지 바탕 | #4E4A80 글자 사용 |
| 강조색 | #E0904A | 막대 1개, 작은 강조 면 | #0F2A3A 글자 5.85:1 |
| 강조색 글자 | #8A4F17 | 필요 시 강조 글자 | 흰 바탕 6.54:1 |
| 중립 바탕 | #F3F6F8 / #FFFFFF | 페이지·카드 | — |
| 본문 | #1B2A35 | 본문 글자 | #F3F6F8 위 13.5:1 |
| 보조 본문 | #5F6C77 | 설명 글자 | 흰 바탕 약 5:1 |

- 숲 경관 배지(녹색)와 경고(점토색)는 의미색이라 그대로 두었다.
- 대비 값은 WCAG 상대휘도 공식으로 직접 계산했다.
