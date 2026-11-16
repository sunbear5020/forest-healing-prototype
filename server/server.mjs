// =========================================================================
// 숲결 추천 API 서버 (Soopgyeol API)
// -------------------------------------------------------------------------
// 웹 화면이 브라우저 안에서 쓰는 엔진(engine/soopgyeol-engine.js)과 같은 파일을
// 그대로 불러 HTTP로 서빙한다. 외부 패키지 의존성이 없다(Node 20 이상 내장 모듈만 사용).
//
//   GET  /healthz          살아 있는지(쿠버네티스 livenessProbe)
//   GET  /readyz           자료를 읽어 요청을 받을 수 있는지(readinessProbe)
//   GET  /v1/meta          엔진 버전·계수 해시·자료 시점
//   GET  /v1/params        엔진 계수표(근거 유형 basis 포함)
//   GET  /v1/sites         추천 대상 시설 목록
//   POST /v1/recommend     맞춤 추천(입력은 docs/api/openapi.yaml)
//   POST /v1/programs      2026 프로그램 추천 모형 순위
//
// 설정은 모두 환경변수(12-factor). 컨테이너·쿠버네티스에서 ConfigMap으로 넘긴다.
// 개인정보: 요청 본문(위치·자가점검)은 계산에만 쓰고 저장·기록하지 않는다. 접근 기록에는 경로·상태·시간만 남긴다.
// =========================================================================
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, resolve, sep } from 'node:path';
import { loadContext, filesSignature, Engine, SoopContext, ROOT } from './context.mjs';
import { sanitizeRecommendInput, sanitizePerson } from './validate.mjs';

export function configFromEnv(env = process.env) {
  return {
    port: Number(env.PORT || 8080),
    host: env.HOST || '0.0.0.0',
    dataDir: env.DATA_DIR || join(ROOT, 'data'),
    dataJs: env.DATA_JS || join(ROOT, 'data.js'),
    allowedOrigins: (env.ALLOWED_ORIGINS || 'https://sunbear5020.github.io,capacitor://localhost,https://localhost,http://localhost')
      .split(',').map((s) => s.trim()).filter(Boolean),
    maxBodyBytes: Number(env.MAX_BODY_BYTES || 64 * 1024),
    reloadIntervalSec: Number(env.RELOAD_INTERVAL_SEC || 0),
    staticDir: env.STATIC_DIR || '',
    logRequests: env.LOG_REQUESTS !== '0'
  };
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon', '.md': 'text/markdown; charset=utf-8' };

export function createServer(cfg = configFromEnv()) {
  let state = { ready: false, ctx: null, sig: '', loadedAt: null, warnings: [] };

  function reload() {
    const sig = filesSignature(cfg.dataDir, cfg.dataJs);
    if (sig === state.sig && state.ready) return false;
    const { ctx, warnings } = loadContext({ dataDir: cfg.dataDir, dataJs: cfg.dataJs });
    state = { ready: true, ctx, sig, loadedAt: new Date().toISOString(), warnings };
    return true;
  }
  reload();
  let timer = null;
  if (cfg.reloadIntervalSec > 0) {
    timer = setInterval(() => {
      try { if (reload()) log({ msg: 'data reloaded' }); } catch (e) { log({ msg: 'data reload failed', error: e.message }); }
    }, cfg.reloadIntervalSec * 1000);
    timer.unref();
  }

  function log(o) { if (cfg.logRequests) console.log(JSON.stringify({ t: new Date().toISOString(), ...o })); }

  function cors(req, res) {
    const o = req.headers.origin;
    if (o && (cfg.allowedOrigins.includes('*') || cfg.allowedOrigins.includes(o))) {
      res.setHeader('Access-Control-Allow-Origin', cfg.allowedOrigins.includes('*') ? '*' : o);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Max-Age', '600');
    }
  }

  function send(res, status, body, headers = {}) {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store', ...headers });
    res.end(data);
  }

  function readBody(req) {
    return new Promise((ok, fail) => {
      let size = 0, over = false; const chunks = [];
      req.on('data', (c) => {
        if (over) return;   // 한도를 넘으면 나머지는 읽고 버린다(응답을 보낼 수 있게 연결은 유지)
        size += c.length;
        if (size > cfg.maxBodyBytes) { over = true; chunks.length = 0; const e = new Error('요청 본문이 너무 큽니다'); e.status = 413; fail(e); return; }
        chunks.push(c);
      });
      req.on('end', () => {
        if (over) return;
        try { ok(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
        catch { const e = new Error('JSON 형식이 아닙니다'); e.status = 400; fail(e); }
      });
      req.on('error', fail);
    });
  }

  async function serveStatic(req, res, pathname) {
    const base = resolve(cfg.staticDir);
    const rel = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
    const file = resolve(base, '.' + normalize(rel));
    if (file !== base && !file.startsWith(base + sep)) return send(res, 403, { error: 'forbidden' });
    try {
      const st = await stat(file);
      if (!st.isFile()) return send(res, 404, { error: 'not found' });
      const buf = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff',
        'Cache-Control': extname(file) === '.json' ? 'no-cache' : 'public, max-age=300' });
      res.end(buf);
    } catch { send(res, 404, { error: 'not found' }); }
  }

  function meta() {
    return {
      service: 'soopgyeol-api', engine: Engine.version,
      paramsHash: hashParams(),
      loadedAt: state.loadedAt, data: SoopContext.dataStamp(state.ctx), warnings: state.warnings
    };
  }
  function hashParams() {   // 엔진 결과 config.paramsHash와 같은 FNV-1a 32bit
    const s = JSON.stringify(Engine.PARAMS); let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  }

  const server = http.createServer(async (req, res) => {
    const t0 = process.hrtime.bigint();
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    res.on('finish', () => log({ method: req.method, path: p, status: res.statusCode, ms: Number(process.hrtime.bigint() - t0) / 1e6 }));
    cors(req, res);
    try {
      if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
      if (req.method === 'GET' && p === '/healthz') return send(res, 200, { ok: true });
      if (req.method === 'GET' && p === '/readyz') return send(res, state.ready ? 200 : 503, { ready: state.ready });
      if (req.method === 'GET' && p === '/v1/meta') return send(res, 200, meta());
      if (req.method === 'GET' && p === '/v1/params') return send(res, 200, { engine: Engine.version, params: Engine.PARAMS, domains: Engine.DOMAINS });
      if (req.method === 'GET' && p === '/v1/sites') return send(res, 200, { engine: Engine.version, sites: state.ctx.sites });
      if (req.method === 'POST' && p === '/v1/recommend') {
        const input = sanitizeRecommendInput(await readBody(req));
        const r = Engine.recommend(input, state.ctx);
        r.servedBy = 'api';
        return send(res, 200, r);
      }
      if (req.method === 'POST' && p === '/v1/programs') {
        if (!state.ctx.programRanker) return send(res, 503, { error: '프로그램 추천 모형 자료가 없습니다' });
        const body = await readBody(req);
        return send(res, 200, state.ctx.programRanker({ person: sanitizePerson(body.person || {}) }));
      }
      if (req.method === 'GET' && cfg.staticDir && !p.startsWith('/v1/')) return serveStatic(req, res, p);
      return send(res, 404, { error: 'not found' });
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) log({ msg: 'error', path: p, error: e.message });
      return send(res, status, { error: status >= 500 ? '서버 오류' : e.message }, status === 413 ? { Connection: 'close' } : {});
    }
  });
  server.on('close', () => { if (timer) clearInterval(timer); });
  return { server, reload, state: () => state };
}

// 직접 실행: node server/server.mjs
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('server.mjs')) {
  const cfg = configFromEnv();
  const { server } = createServer(cfg);
  server.listen(cfg.port, cfg.host, () => console.log(JSON.stringify({ msg: 'soopgyeol-api listening', port: cfg.port, engine: Engine.version })));
  const stop = (sig) => {   // 쿠버네티스 SIGTERM: 새 연결을 받지 않고 진행 중인 요청을 마친 뒤 종료
    console.log(JSON.stringify({ msg: 'shutdown', sig }));
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10000).unref();
  };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}
