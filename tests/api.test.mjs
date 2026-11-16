// 실행: node tests/api.test.mjs
// API 서버가 브라우저와 같은 엔진·같은 자료로 같은 결과를 내는지(동등성), 입력 검사·CORS·상태 점검을 시험한다.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer, configFromEnv } from '../server/server.mjs';
const require = createRequire(import.meta.url);
const E = require('../engine/soopgyeol-engine.js');
const PM = require('../engine/program-model.js');
const Client = require('../engine/client.js');

// 서버 코드와 별개로 tests/engine.test.mjs 방식으로 ctx를 직접 조립(독립 기준)
const j = (p) => JSON.parse(readFileSync(new URL('../data/' + p, import.meta.url)));
const sb = {}; vm.createContext(sb);
vm.runInContext(readFileSync(new URL('../data.js', import.meta.url), 'utf8') + ';this.FORESTS=FORESTS;this.TRAVEL_HOURS=TRAVEL_HOURS;', sb);
const ev = j('evidence.json');
const refCtx = {
  sites: j('sites.json').sites, evidence: ev, facilityEnv: j('facility_env.json'), envToday: j('env_today.json'),
  forests: j('forests_nearby.json').forests, regionHealth: j('region_health.json'), sigunguPoints: ev.sigungu_points,
  tourism: j('tourism.json').sites, tourismMeta: j('tourism.json')._meta, facilityRegionHealth: j('facility_region_health.json'),
  protoForests: sb.FORESTS, travelHours: sb.TRAVEL_HOURS, parks: j('parks.json').parks, digitalTherapeutic: null,
  programRanker: PM.create(j('program_model.json'))
};

const { server } = createServer({ ...configFromEnv({}), logRequests: false, allowedOrigins: ['https://sunbear5020.github.io'] });
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;
const post = (path, body, headers = {}) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const strip = (r) => { const c = JSON.parse(JSON.stringify(r)); delete c.servedBy; return c; };

let n = 0; const t = async (name, f) => { await f(); n++; console.log('ok -', name); };
const seoul = { lat: 37.5665, lng: 126.978 };
const CASES = [
  { check: { stress: 3, anxiety: 2, depression: 1, fatigue: 2, sleep: 1, breath: 0 }, purpose: 'stress', walk: 'normal', maxHours: 3, origin: seoul, month: 10 },
  { check: { breath: 4 }, purpose: 'respiratory', walk: 'barrier', maxHours: 2, origin: { lat: 35.1796, lng: 129.0756 }, envOverride: { temp: 15, humidity: 40, pm: 'bad', rain: false, wind: 2 } },
  { check: { stress: 4, anxiety: 4, depression: 4 }, selfharm: true, purpose: 'stress', canVisit: false, origin: seoul, month: 7 },
  { check: { fatigue: 4 }, purpose: 'vitality', walk: 'trek', maxHours: 9, month: 5, forestTaste: '침엽수림',
    person: { age: 45, sex: 2, h: 3, ex: 2, hp: 4, d: 2, v: 3, pre: 40, cats: ['일반'] } },
  { check: { sleep: 3 }, purpose: 'sleep', origin: { sido: '강원특별자치도', sigungu: '강릉시' }, date: '2026-11-20' }
];

await t('상태 점검: /healthz 200, /readyz 200', async () => {
  assert.equal((await fetch(base + '/healthz')).status, 200);
  const r = await fetch(base + '/readyz'); assert.equal(r.status, 200); assert.equal((await r.json()).ready, true);
});
await t('/v1/meta: 엔진 버전·계수 해시가 엔진 결과와 같음', async () => {
  const m = await (await fetch(base + '/v1/meta')).json();
  assert.equal(m.engine, E.version);
  assert.equal(m.paramsHash, E.recommend(CASES[0], refCtx).config.paramsHash);
  assert.ok(m.data.nSites > 0 && m.data.programModel === true);
});
for (const [i, c] of CASES.entries()) {
  await t(`동등성 ${i + 1}: API 결과 = 같은 입력의 직접 엔진 계산`, async () => {
    const res = await post('/v1/recommend', c); assert.equal(res.status, 200);
    const api = await res.json();
    assert.equal(api.servedBy, 'api');
    assert.deepEqual(strip(api), strip(E.recommend(c, refCtx)));
  });
}
await t('엔진 클라이언트(remote) → API, 결과 동등', async () => {
  const cl = Client.create({ engine: E, apiBase: base });
  assert.equal(cl.mode, 'remote');
  const r = await cl.recommend(CASES[0], refCtx);
  assert.equal(r.servedBy, 'remote');
  assert.deepEqual(strip(r), strip(E.recommend(CASES[0], refCtx)));
});
await t('엔진 클라이언트: API 실패 시 기기 안 계산으로 되돌림', async () => {
  const cl = Client.create({ engine: E, apiBase: 'http://127.0.0.1:9', timeoutMs: 1500 });
  const r = await cl.recommend(CASES[0], refCtx);
  assert.equal(r.servedBy, 'local-fallback');
  assert.deepEqual(strip(r), strip(E.recommend(CASES[0], refCtx)));
});
await t('엔진 클라이언트(local, apiBase 없음) = 직접 계산', async () => {
  const cl = Client.create({ engine: E, apiBase: '' });
  assert.equal(cl.mode, 'local');
  assert.deepEqual(strip(await cl.recommend(CASES[1], refCtx)), strip(E.recommend(CASES[1], refCtx)));
});
await t('/v1/programs: 2026 모형 순위 = 직접 계산', async () => {
  const person = CASES[3].person;
  const r = await (await post('/v1/programs', { person })).json();
  assert.deepEqual(r, JSON.parse(JSON.stringify(refCtx.programRanker({ person }))));
});
await t('입력 검사: 알 수 없는 값·범위 밖·JSON 아님 → 400, 큰 본문 → 413', async () => {
  assert.equal((await post('/v1/recommend', { check: { stress: 9 } })).status, 400);
  assert.equal((await post('/v1/recommend', { check: { hack: 1 } })).status, 400);
  assert.equal((await post('/v1/recommend', { purpose: 'x' })).status, 400);
  assert.equal((await post('/v1/recommend', { origin: { lat: 0, lng: 0 } })).status, 400);
  assert.equal((await post('/v1/recommend', '{oops')).status, 400);
  assert.equal((await post('/v1/recommend', { forestTaste: 'x'.repeat(70000) })).status, 413);
  const unknownTop = await post('/v1/recommend', { purpose: 'stress', __proto__x: 1, extra: 'ignored' });
  assert.equal(unknownTop.status, 200);   // 최상위 모르는 키는 버린다
});
await t('CORS: 허용 출처만 헤더를 받음', async () => {
  const ok = await fetch(base + '/v1/meta', { headers: { Origin: 'https://sunbear5020.github.io' } });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://sunbear5020.github.io');
  const no = await fetch(base + '/v1/meta', { headers: { Origin: 'https://evil.example' } });
  assert.equal(no.headers.get('access-control-allow-origin'), null);
  const pre = await fetch(base + '/v1/recommend', { method: 'OPTIONS', headers: { Origin: 'https://sunbear5020.github.io' } });
  assert.equal(pre.status, 204);
});
await t('없는 경로 404, 정적 파일 서빙은 STATIC_DIR 없으면 꺼짐', async () => {
  assert.equal((await fetch(base + '/nope')).status, 404);
  assert.equal((await fetch(base + '/index.html')).status, 404);
});

// 정적 서빙(한 컨테이너로 웹+API) 확인, 상위 경로 접근 차단
const s2 = createServer({ ...configFromEnv({}), logRequests: false, staticDir: new URL('..', import.meta.url).pathname }).server;
await new Promise((ok) => s2.listen(0, '127.0.0.1', ok));
const b2 = `http://127.0.0.1:${s2.address().port}`;
await t('STATIC_DIR 설정 시 웹 화면 서빙, 상위 경로 차단', async () => {
  const r = await fetch(b2 + '/'); assert.equal(r.status, 200); assert.match(await r.text(), /숲결/);
  assert.equal((await fetch(b2 + '/data/sites.json')).status, 200);
  const trav = await fetch(b2 + '/..%2f..%2fetc%2fpasswd'); assert.ok([403, 404].includes(trav.status));
});
s2.close(); server.close();
console.log(`\n${n} tests passed`);
