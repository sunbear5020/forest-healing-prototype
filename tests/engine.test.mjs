// 실행: node tests/engine.test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../engine/soopgyeol-engine.js');
const j = (p) => JSON.parse(readFileSync(new URL('../data/' + p, import.meta.url)));
const sandbox = {}; vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL('../data.js', import.meta.url), 'utf8') + ';this.FORESTS=FORESTS;this.TRAVEL_HOURS=TRAVEL_HOURS;', sandbox);
const ev = j('evidence.json');
const ctx = {
  sites: j('sites.json').sites, evidence: ev, facilityEnv: j('facility_env.json'), envToday: j('env_today.json'),
  forests: j('forests_nearby.json').forests, regionHealth: j('region_health.json'), sigunguPoints: ev.sigungu_points,
  tourism: j('tourism.json').sites, facilityRegionHealth: j('facility_region_health.json'), tourismMeta: j('tourism.json')._meta, protoForests: sandbox.FORESTS, travelHours: sandbox.TRAVEL_HOURS, parks: j('parks.json').parks
};
let n = 0; const t = (name, f) => { f(); n++; console.log('ok -', name); };

const seoul = { lat: 37.5665, lng: 126.978 };
const base = { check: { stress: 3, anxiety: 2, depression: 1, fatigue: 2, sleep: 1, breath: 0 }, purpose: 'stress', walk: 'normal',
  maxHours: 3, origin: seoul, month: 10 };

t('기본 추천: 상위 5곳, 순위·범위·근거 포함', () => {
  const r = E.recommend(base, ctx);
  assert.equal(r.recommendations.length, 5);
  r.recommendations.forEach((e, i) => {
    assert.equal(e.rank, i + 1);
    assert.ok(e.rankRange && e.rankRange[0] <= e.rankRange[1]);
    assert.ok(e.total >= 0 && e.total <= 100);
    assert.ok(['model', 'mixed', 'similar', 'literature'].includes(e.effectBasis));
    assert.ok(e.reasons.length >= 2);
  });
  console.log(r.recommendations.map((e) => `${e.rank}.${e.site.name} ${e.total} [${e.rankRange}] ${e.effectBasis} E${e.scores.effect} V${e.scores.env} A${e.scores.access}`).join('\n'));
});
t('이동시간 제한 밖 시설은 제외되고 사유가 남음', () => {
  const r = E.recommend({ ...base, maxHours: 1.5 }, ctx);
  assert.ok(r.excluded.length > 0);
  r.recommendations.forEach((e) => assert.ok(e.access.hours <= 1.5));
  assert.ok(r.excluded.every((x) => x.reasons.length > 0));
});
t('자해 생각 응답 → 긴급 안내와 대체경로 우선 표시', () => {
  const r = E.recommend({ ...base, selfharm: true }, ctx);
  assert.equal(r.safety.level, 'urgent');
  assert.ok(r.safety.contacts.some((c) => c.tel === '109'));
  assert.equal(r.alternatives.prominent, true);
});
t('방문 불가 → 근처 공원(수관 30% 이상)·가까운 산림·디지털치료제 자리', () => {
  const r = E.recommend({ ...base, canVisit: false }, ctx);
  const a = r.alternatives;
  assert.equal(a.prominent, true);
  assert.equal(a.digital.available, false);
  assert.ok(a.parks.length > 0 && a.parks.every((p) => p.tree_pct >= 30));
  assert.ok(a.forests.length > 0);
  console.log('parks:', a.parks.map((p) => `${p.name} ${p.km}km 수관${p.tree_pct}%`).join(' | '));
  console.log('forests:', a.forests.map((p) => `${p.name} ${p.km}km`).join(' | '));
});
t('호흡기 불편 + PM2.5 나쁨 시나리오 → 실내 대체 없는 시설 제외', () => {
  const r = E.recommend({ ...base, check: { breath: 4 }, purpose: 'respiratory', envOverride: { temp: 15, humidity: 40, pm: 'bad', rain: false, wind: 2 } }, ctx);
  assert.ok(r.excluded.some((x) => x.reasons.some((s) => s.includes('PM2.5'))));
  r.recommendations.forEach((e) => assert.ok(e.envDetail.indoor));
});
t('수면·호흡기만 고르면 효과 계산 없이 환경·접근으로만 순위', () => {
  const r = E.recommend({ ...base, check: { sleep: 3 }, purpose: 'sleep' }, ctx);
  r.recommendations.forEach((e) => assert.equal(e.scores.effect, null));
  assert.deepEqual(r.profile.literatureOnlyDomains, ['sleep']);
});
t('효과모형 시설은 model, 그 외는 similar 근거로 표시', () => {
  const r = E.recommend({ ...base, maxHours: 9, topN: 99 }, ctx);
  const byId = Object.fromEntries(r.recommendations.map((e) => [e.site.id, e]));
  assert.equal(byId.F03.effectBasis, 'model');
  assert.equal(byId.F09.effectBasis, 'similar');
});
t('지역 맥락은 개인 점수와 분리', () => {
  const r = E.recommend(base, ctx);
  assert.ok(r.context.region && r.context.region.stress > 0);
  console.log('region:', JSON.stringify(r.context.region));
});
t('시군구만 입력해도 대표점으로 거리 계산', () => {
  const r = E.recommend({ ...base, origin: { sido: '경상남도', sigungu: '진주시' } }, ctx);
  assert.ok(r.recommendations[0].access.km != null);
  assert.ok(r.alternatives.parks.length > 0);
});
t('같은 입력·같은 seed → 같은 결과(재현성)', () => {
  const a = E.recommend(base, ctx), b = E.recommend(base, ctx);
  assert.deepEqual(a.recommendations.map((e) => [e.site.id, e.rankRange]), b.recommendations.map((e) => [e.site.id, e.rankRange]));
});
t('환경항 다중비교 보정(BH) 결과를 보고하고, 남은 항만 반영', () => {
  const r = E.recommend(base, ctx);
  const a = r.evidenceAudit.envTerms;
  assert.ok(a.tested > 0 && a.keptAfterFDR <= a.nominalP05);
  if (a.keptAfterFDR === 0) r.recommendations.forEach((e) => assert.equal(e.envTermsUsed.length, 0));
});
t('시설 목록 순서를 바꿔도 결과 동일(순서 불변)', () => {
  const a = E.recommend(base, ctx), b = E.recommend(base, { ...ctx, sites: ctx.sites.slice().reverse() });
  assert.deepEqual(a.recommendations.map((e) => [e.site.id, e.total]), b.recommendations.map((e) => [e.site.id, e.total]));
});
t('설정 기록과 점수 범위가 결과에 포함', () => {
  const r = E.recommend(base, ctx);
  assert.equal(r.config.engine, E.version);
  assert.ok(r.config.paramsHash && r.config.data.effectModel.version);
  r.recommendations.forEach((e) => assert.ok(e.totalRange[0] <= e.total + 1 && e.totalRange[1] >= e.total - 1));
});
t('자료가 빠지면 조용히 넘어가지 않고 경고', () => {
  const r = E.recommend(base, { ...ctx, envToday: null, evidence: { prior: ctx.evidence.prior } });
  assert.ok(r.warnings.some((w) => w.includes('효과모형')));
  assert.ok(r.warnings.some((w) => w.includes('예보')));
});
t('v0.3: PM2.5 나쁨·비에는 실내 시설이 실외형보다 앞 순위', () => {
  for (const pm of [{ pm: 'bad', rain: false }, { pm: 'good', rain: true }]) {
    const r = E.recommend({ ...base, maxHours: 9, topN: 18, envOverride: { temp: 18, humidity: 50, wind: 2, ...pm } }, ctx);
    const idx = r.recommendations.map((e) => e.envDetail.indoor);
    const firstOut = idx.indexOf(false);
    if (firstOut >= 0) assert.ok(idx.slice(firstOut).every((x) => !x), '실외형 뒤에 실내 시설이 오면 안 됨');
  }
});
t('v0.3: 강풍·폭염이면 대체 경로에 실외 자제 안내', () => {
  const r = E.recommend({ ...base, canVisit: false, envOverride: { temp: 15, humidity: 50, pm: 'good', rain: false, wind: 16 } }, ctx);
  assert.equal(r.alternatives.weather.outdoorOk, false);
  assert.ok(r.alternatives.weather.note.includes('강풍'));
  const ok = E.recommend({ ...base, canVisit: false, envOverride: { temp: 20, humidity: 50, pm: 'good', rain: false, wind: 2 } }, ctx);
  assert.equal(ok.alternatives.weather, undefined);
});
t('대체 경로 단계: 공원 → 산림공원(수관 60%·10 ha 이상) → 도시숲 자리 → 산림', () => {
  const r = E.recommend({ ...base, canVisit: false }, ctx);
  const a = r.alternatives;
  assert.ok(a.forestParks.length > 0 && a.forestParks.every((p) => p.tree_pct >= 60 && p.area_ha >= 10));
  assert.equal(a.urbanForest.available, false);
  console.log('forestParks:', a.forestParks.map((p) => `${p.name} ${p.km}km 수관${p.tree_pct}% ${p.area_ha}ha`).join(' | '));
});
t('관광 연계: 추천 시설마다 10 km 안 관광 목록(최대 5곳)', () => {
  const r = E.recommend(base, ctx);
  r.recommendations.forEach((e) => { assert.ok(Array.isArray(e.links.tourism)); assert.ok(e.links.tourism.length <= 5 && e.links.tourism.every((t) => t.km <= 10)); });
});
t('시설 지역 건강지표: 맥락만 표시하고 점수는 그대로', () => {
  const a = E.recommend(base, ctx), b = E.recommend(base, { ...ctx, facilityRegionHealth: null });
  assert.deepEqual(a.recommendations.map((e) => e.total), b.recommendations.map((e) => e.total));
  const withRH = a.recommendations.filter((e) => !e.site.id.startsWith('hf_'));   // 2026-11-16 추가한 공립·사립 치유의숲(hf_*)은 시군구 지표 미수집
  withRH.forEach((e) => { assert.ok(e.links.regionHealth && e.links.regionHealth.items.length >= 2); assert.ok(e.links.regionHealth.caution.includes('인과')); });
  a.recommendations.filter((e) => e.site.id.startsWith('hf_')).forEach((e) => assert.ok(!e.links.regionHealth || e.links.regionHealth.items));
});
t('v0.5: 숲 취향은 총점을 바꾸지 않고, 경관 배지·꽃가루 안내를 붙임', () => {
  const a = E.recommend({ ...base, maxHours: 9, topN: 18 }, ctx), b = E.recommend({ ...base, maxHours: 9, topN: 18, forestTaste: 'mixed' }, ctx);
  const ta = Object.fromEntries(a.recommendations.map((e) => [e.site.id, e.total])), tb = Object.fromEntries(b.recommendations.map((e) => [e.site.id, e.total]));
  Object.keys(ta).forEach((k) => { if (tb[k] != null) assert.equal(ta[k], tb[k]); });
  assert.ok(b.recommendations.some((e) => e.landscape));
  const spring = E.recommend({ ...base, maxHours: 9, topN: 18, month: 5 }, ctx);
  assert.ok(spring.recommendations.some((e) => e.landscape && e.landscape.cautions.some((c) => c.includes('꽃가루'))));
  const fall = E.recommend({ ...base, maxHours: 9, topN: 18, month: 10 }, ctx);
  assert.ok(fall.recommendations.every((e) => !e.landscape || e.landscape.cautions.length === 0 || e.site.lat < 33.7));
});
t('v0.6: 예측 피톤치드는 측정 계절 밖이면 계산 안 하고, 환경 점수만 ±3점 안에서 조정', () => {
  const nov = E.recommend({ ...base, month: 11, maxHours: 9, topN: 40 }, ctx);
  const nv = nov.recommendations.filter((e) => e.nvoc);
  assert.ok(nv.length > 0);
  nv.forEach((e) => { assert.ok(e.nvoc.every((x) => x.status === 'out_of_season')); assert.equal(e.nvocAdj, 0); });
  for (const ov of [{ temp: 30, humidity: 85, wind: 1 }, { temp: 18, humidity: 50, wind: 3 }]) {
    const r = E.recommend({ ...base, month: 7, maxHours: 9, topN: 40, envOverride: ov }, ctx);
    r.recommendations.forEach((e) => { assert.ok(Math.abs(e.nvocAdj || 0) <= 3); });
    assert.ok(r.recommendations.some((e) => e.nvoc && e.nvoc.some((x) => x.status === 'ok')));
  }
});
t('v0.6.1: 기온 편차는 평년값(climate.normal) 기준, 평년값 없는 시설은 2021~2025 월평균', () => {
  const r = E.recommend({ ...base, month: 7, maxHours: 9, topN: 40, envOverride: { temp: 30, humidity: 60 } }, ctx);
  const fe = ctx.facilityEnv.facilities;
  let withN = 0;
  r.recommendations.forEach((e) => {
    if (e.env.anom == null) return;
    const f = fe[e.site.envKey || e.site.facilityId];
    const ref = f && f.climate.normal ? f.climate.normal.monthly['7'].tavg : f.climate.monthly['7'].tavg;
    if (f && f.climate.normal) withN++;
    assert.ok(Math.abs(e.env.anom - (27 - ref)) < 0.06);
  });
  assert.ok(withN > 0);
});
t('카카오맵 링크: 이름 인코딩·쉼표 제거·좌표 6자리, 좌표 없으면 null', () => {
  const k = E.kakaoLinks('국립산림치유원, 본관', 36.857915, 128.471903);
  assert.equal(k.map, 'https://map.kakao.com/link/map/' + encodeURIComponent('국립산림치유원  본관') + ',36.857915,128.471903');
  assert.ok(k.route.startsWith('https://map.kakao.com/link/to/'));
  assert.equal(E.kakaoLinks('x', null, 127), null);
  const r = E.recommend(base, ctx);
  r.recommendations.forEach((e) => assert.ok(E.kakaoLinks(e.site.name, e.site.lat, e.site.lng)));
});
t('2026 프로그램 추천 모형: 대상 종류 필터·순위 범위·시설별 상위 3개', () => {
  const PM = require('../engine/program-model.js');
  const c2 = { ...ctx, programRanker: PM.create(j('program_model.json')) };
  const r = E.recommend({ ...base, maxHours: 9, topN: 18, person: { age: 45, sex: 2, cats: ['일반', '중장년·건강관리'] } }, c2);
  const pr = r.programRanking;
  assert.ok(pr && pr.programs.length > 0 && pr.programs.length <= 47);
  pr.programs.forEach((x, i) => { if (i) assert.ok(x.rank > pr.programs[i - 1].rank); assert.ok(x.rankRange[0] <= x.rankRange[1]); });
  assert.ok(r.recommendations.some((e) => e.programs.model && e.programs.model.length > 0));
  r.recommendations.forEach((e) => assert.ok(!e.programs.model || e.programs.model.length <= 3));
});

// ── v0.7.0 가상 전문가 검토 반영 회귀 시험 ──
t('E4-01: 근거 등급이 낮은 시설은 가까움만으로 측정 시설을 앞서지 않음', () => {
  const r = E.recommend({ ...base, maxHours: 3, topN: 99 }, ctx);
  const order = r.recommendations.filter((e) => e.tier === 0).map((e) => e.effectBasis);
  const firstModel = order.indexOf('model');
  if (firstModel > 0) {
    // 측정 시설 앞에 온 유사 추정 시설은 점수가 더 높아야 함(앞당김이 아니라 점수 순)
    const top = r.recommendations.filter((e) => e.tier === 0);
    for (let i = 0; i < firstModel; i++) assert.ok(top[i].total >= top[firstModel].total, top[i].site.name);
  }
  r.recommendations.forEach((e) => { if (e.nearFirst) { const over = r.recommendations.find((x) => x.site.name === e.nearFirst); if (over) assert.ok({ model: 3, mixed: 3, similar: 2, literature: 1, none: 0 }[e.effectBasis] >= { model: 3, mixed: 3, similar: 2, literature: 1, none: 0 }[over.effectBasis]); } });
});
t('E1-02: 2018 피톤치드 측정값은 점수에 넣지 않음(예측 NVOC ±3점만)', () => {
  const a = E.recommend({ ...base, check: { breath: 4 }, purpose: 'respiratory', maxHours: 9, topN: 99, month: 10 }, ctx);
  const b = E.recommend({ ...base, check: { breath: 4 }, purpose: 'respiratory', maxHours: 9, topN: 99, month: 10 }, { ...ctx, facilityEnv: { ...ctx.facilityEnv, facilities: Object.fromEntries(Object.entries(ctx.facilityEnv.facilities).map(([k, v]) => [k, { ...v, fixed: v.fixed ? { ...v.fixed, phytoncide_2018: undefined } : v.fixed }])) } });
  const sb = Object.fromEntries(b.recommendations.map((e) => [e.site.id, e.scores.env]));
  a.recommendations.forEach((e) => assert.equal(e.scores.env, sb[e.site.id], e.site.name));
  a.recommendations.forEach((e) => assert.ok(Math.abs(e.nvocAdj || 0) <= 3));
});
t('E1-03: 월별 효과 차이는 점수에 넣지 않음', () => {
  const a = E.recommend({ ...base, month: 5, maxHours: 9, topN: 99 }, ctx), b = E.recommend({ ...base, month: 11, maxHours: 9, topN: 99 }, ctx);
  const eb = Object.fromEntries(b.recommendations.map((e) => [e.site.id, e.effectSD]));
  a.recommendations.forEach((e) => { if (eb[e.site.id] != null && e.effectSD != null) assert.ok(Math.abs(e.effectSD - eb[e.site.id]) < 1e-9, e.site.name); });
});
t('E3-14·E4-11: 월은 날짜 문자열에서 읽고, maxHours 0·seed 0을 그대로 받음', () => {
  const r = E.recommend({ ...base, month: undefined, date: '2026-12-01', maxHours: 0, seed: 0 }, ctx);
  assert.equal(r.input.month, 12);
  assert.equal(r.input.maxHours, 0);
  assert.equal(r.config.seed, 0);
});
t('E3-03: PM2.5 1시간 값은 수집 날짜에만 씀', () => {
  const sid = Object.keys(ctx.envToday.sites)[0], et = ctx.envToday.sites[sid];
  const d0 = String(et.pm25 && et.pm25.time || '').slice(0, 10), other = et.days.map((d) => d.date).find((d) => d !== d0);
  if (!other) return;
  const r = E.recommend({ ...base, date: other, maxHours: 99, topN: 99 }, ctx);
  r.recommendations.concat(r.excluded || []).forEach((e) => { if (e.env) assert.equal(e.env.pm25, null); });
});
console.log(`\n${n} tests passed`);
