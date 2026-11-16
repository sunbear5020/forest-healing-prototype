# 숲결 추천 API 컨테이너 — 같은 이미지를 단일 서버·서버리스(Cloud Run 등)·쿠버네티스 어디서나 쓴다.
# 빌드:  docker build -t soopgyeol-api:0.6.1 .
# 실행:  docker run --rm -p 8080:8080 soopgyeol-api:0.6.1
# 외부 패키지 의존성이 없어 npm install 단계가 없다. API 키는 이미지에 넣지 않는다.
# 운영 배포 때는 아래 기반 이미지를 다이제스트(@sha256:…)로 고정할 것(docs/PLATFORM_MIGRATION.md §6).
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0
WORKDIR /app

# 엔진·자료·서버만 복사(화면 파일은 STATIC_DIR=/app/web 으로 함께 서빙하려면 아래 web 줄을 쓴다)
COPY --chown=node:node engine/ ./engine/
COPY --chown=node:node data/ ./data/
COPY --chown=node:node data.js ./data.js
COPY --chown=node:node server/ ./server/
COPY --chown=node:node package.json ./package.json

USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
CMD ["node", "server/server.mjs"]
