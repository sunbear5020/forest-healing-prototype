// 사전 고정 규칙 판정(docs/EVALUATION.md §3) 실행. 결과: tests/eval/out/report.{json,md}
// 실행: node tests/eval/run_eval.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { E, ctx, cases, SCENARIOS, mulberry32, shuffled, wilson } from './common.mjs';

const protoById = Object.fromEntries((ctx.protoForests || []).map((f) => [f.id, f]));
const t0 = Date.now();
const rngShuffle = mulberry32(777);
const shuffledCtx = { ...ctx, sites: shuffled(ctx.sites, rngShuffle), forests: shuffled(ctx.forests, rngShuffle), parks: shuffled(ctx.parks, rngShuffle) };
const C = {}; const fails = {};
function judge(id, applies, pass, caseId, detail) {
  if (!applies) return;
  C[id] = C[id] || { n: 0, pass: 0 };
  C[id].n++; if (pass) C[id].pass++;
  else { (fails[id] = fails[id] || []).push({ case: caseId, detail }); }
}
const sig = (r) => r.recommendations.map((e) => e.site.id + ':' + e.total).join(',');
const pool = (r) => new Set(r.recommendations.map((e) => e.site.id).concat(r.others.map((o) => o.id)));
const allEnv = (input) => {
  const r = E.recommend({ ...input, maxHours: 99, topN: 99 }, ctx);
  return Object.fromEntries(r.recommendations.map((e) => [e.site.id, e.scores.env]));
};
const envCache = new Map();
let nCases = 0; const widths = []; let config = null; const basisCount = {};

for (const c of cases()) {
  nCases++;
  const f = c.factors, inp = c.input;
  const r = E.recommend(inp, ctx);
  config = config || r.config;
  const recs = r.recommendations, w = r.profile.weights;
  const severe = (inp.check.depression || 0) >= 4 || (inp.check.anxiety || 0) >= 4;
  const tels = r.safety.contacts.map((x) => x.tel);
  const alt = r.alternatives;
  const altAny = (alt.parks || []).length + (alt.forests || []).length > 0;

  judge('S1', f.selfharm, r.safety.level === 'urgent' && tels.includes('109') && tels.includes('1577-0199') && alt.prominent, c.id,
    { level: r.safety.level, tels, prominent: alt.prominent });
  judge('S2', !f.selfharm && !severe && f.scenario === 'normal' && f.canVisit && f.maxHours === 3,
    r.safety.level === 'ok' && recs.length >= 3 && !alt.prominent, c.id, { level: r.safety.level, nRecs: recs.length, prominent: alt.prominent });
  // S2b: 결과를 본 뒤 추가한 보조 기준(§7). 원래 S2 결과는 그대로 보고
  judge('S2b', !f.selfharm && !severe && f.scenario === 'normal' && f.canVisit && f.maxHours === 3 && recs.length + r.others.length >= 3,
    r.safety.level === 'ok' && recs.length >= 3 && !alt.prominent, c.id, { level: r.safety.level, nRecs: recs.length });
  judge('S3', !f.selfharm && severe, r.safety.level === 'caution' && r.safety.contacts.length >= 1 && (recs.length >= 1 || r.excluded.length === r.config.data.nSites),
    c.id, { level: r.safety.level, nRecs: recs.length, nExcluded: r.excluded.length });
  judge('H1', f.scenario === 'heat', recs.every((e) => e.envDetail.indoor), c.id, { outdoor: recs.filter((e) => !e.envDetail.indoor).map((e) => e.site.id) });
  judge('H2', f.scenario === 'wind', recs.length === 0 && alt.prominent && altAny, c.id, { nRecs: recs.length, prominent: alt.prominent });
  judge('H3', f.scenario === 'pm_bad' && w.breath >= 0.25, recs.every((e) => e.envDetail.indoor), c.id, { outdoor: recs.filter((e) => !e.envDetail.indoor).map((e) => e.site.id) });
  // H4: 프로그램 정보가 있는 추천만 분모(정보 없는 시설은 프로그램을 내지 않음) — §7 변경 기록 참조
  const withProg = recs.filter((e) => e.programs && e.programs.items.length);
  judge('H4', f.scenario !== 'normal' && withProg.length > 0, withProg.every((e) => e.programs.switchedIndoor), c.id, {});
  // H5·H6: v0.2 가상 판정 후 추가한 v0.3 기준(§7). 사전 기준 아님
  if (f.scenario === 'pm_bad' || f.scenario === 'rain') {
    const ind = recs.map((e) => e.envDetail.indoor), fo = ind.indexOf(false);
    judge('H5', recs.length > 1, fo < 0 || ind.slice(fo).every((x) => !x), c.id, { order: recs.map((e) => e.site.id + (e.envDetail.indoor ? '[실내]' : '')) });
  }
  judge('H6', ['wind', 'heat', 'pm_bad'].includes(f.scenario), !!alt.weather && alt.weather.outdoorOk === false, c.id, { weather: alt.weather || null });
  judge('A1', true, recs.every((e) => e.access.hours != null && e.access.hours <= f.maxHours), c.id, { hours: recs.map((e) => e.access.hours) });
  judge('A2', !f.canVisit, alt.prominent && (alt.parks || []).every((p) => p.tree_pct >= 30) && (alt.forests || []).length >= 1, c.id,
    { prominent: alt.prominent, parks: (alt.parks || []).map((p) => p.tree_pct), nForests: (alt.forests || []).length });
  judge('A3', recs.length === 0, alt.prominent && altAny, c.id, { prominent: alt.prominent });
  if (f.scenario === 'normal') {
    const top = r.profile.purposeTags[0];
    recs.forEach((e) => {
      const proto = e.proto; if (!proto || !proto.programs) return;
      if (!proto.programs.some((p) => (p.tags || []).includes(top))) return;
      const first = proto.programs.find((p) => p.name === e.programs.items[0].name);
      judge('N1', true, !!first && (first.tags || []).includes(top), c.id + '|' + e.site.id, { top, first: first && first.tags });
    });
  }
  const modeled = r.profile.modeledDomains.length > 0;
  judge('N2', true, recs.every((e) => modeled ? e.scores.effect != null : e.scores.effect == null), c.id, { modeled });
  judge('U1', recs.length > 0, recs.every((e) => e.rankRange && e.totalRange && e.totalRange[0] <= e.total + 1 && e.totalRange[1] >= e.total - 1
    && ['model', 'mixed', 'similar', 'literature', 'none'].includes(e.effectBasis) && e.reasons.length >= 2), c.id,
    { bad: recs.filter((e) => !(e.totalRange && e.totalRange[0] <= e.total + 1 && e.totalRange[1] >= e.total - 1)).map((e) => [e.site.id, e.total, e.totalRange]) });
  judge('U2', true, r.notes.some((n) => n.includes('인과 효과가 아닙니다')) && r.config.engine && r.config.paramsHash && r.config.data.effectModel && r.config.data.effectModel.version, c.id, {});
  const rs = E.recommend(inp, shuffledCtx);
  judge('I1', true, sig(rs) === sig(r), c.id, { a: sig(r), b: sig(rs) });
  const r2 = E.recommend({ ...inp, seed: 99991 }, ctx);
  judge('I2', true, sig(r2) === sig(r), c.id, { a: sig(r), b: sig(r2) });
  if (f.maxHours === 1.5) {
    const r3 = E.recommend({ ...inp, maxHours: 3 }, ctx);
    const a = pool(r), b = pool(r3);
    judge('M1', true, [...a].every((x) => b.has(x)), c.id, { lost: [...a].filter((x) => !b.has(x)) });
  } else judge('M1', true, true, c.id, {});
  const key = f.profile + '|' + f.origin;
  if (!envCache.has(key)) {
    const good = allEnv({ ...inp, selfharm: false, canVisit: true, envOverride: SCENARIOS.normal });
    const bad = allEnv({ ...inp, selfharm: false, canVisit: true, envOverride: { ...SCENARIOS.normal, pm: 'bad' } });
    envCache.set(key, Object.keys(bad).filter((id) => good[id] != null && bad[id] > good[id]));
  }
  const up = envCache.get(key);
  judge('M2', true, up.length === 0, c.id, { raised: up });
  recs.forEach((e) => { widths.push(e.rankRange[1] - e.rankRange[0]); basisCount[e.effectBasis] = (basisCount[e.effectBasis] || 0) + 1; });
}

// 기준선(가까운 순 3곳)과의 겹침: 방문 가능·자해 없음·후보 4곳 이상
const ov = { n: 0, setSame: 0, ordSame: 0, overlap: 0 };
for (const c of cases()) {
  if (!c.factors.canVisit || c.factors.selfharm) continue;
  const all = E.recommend({ ...c.input, topN: 99 }, ctx).recommendations; if (all.length < 4) continue;
  const eng = all.slice(0, 3).map((e) => e.site.id);
  const near = all.slice().sort((a, b) => a.access.hours - b.access.hours || (a.site.id < b.site.id ? -1 : 1)).slice(0, 3).map((e) => e.site.id);
  ov.n++; if (eng.slice().sort().join() === near.slice().sort().join()) ov.setSame++; if (eng.join() === near.join()) ov.ordSame++;
  ov.overlap += eng.filter((x) => near.includes(x)).length;
}
const thresholds = { N1: 0.95 };
const addedAfter = { S2b: '결과 확인 후 추가(§7). 사전 기준 아님', H5: 'v0.3 추가(가상 판정 후, §7). 사전 기준 아님', H6: 'v0.3 추가(가상 판정 후, §7). 사전 기준 아님' };
const rows = Object.keys(C).sort().map((id) => {
  const { n, pass } = C[id], [lo, hi] = wilson(pass, n), th = thresholds[id] || 1;
  return { id, n, pass, rate: pass / n, ci95: [lo, hi], threshold: th, met: pass / n >= th, note: addedAfter[id] || null, failExamples: (fails[id] || []).slice(0, 5), nFail: (fails[id] || []).length };
});
widths.sort((a, b) => a - b);
const q = (p) => widths[Math.min(widths.length - 1, Math.floor(p * widths.length))];
const audit = E.recommend({ check: { stress: 2 }, origin: { lat: 37.5665, lng: 126.978 } }, ctx);
const report = {
  plan: 'docs/EVALUATION.md (2026-11-15 고정)', ranAt: new Date().toISOString(), seconds: (Date.now() - t0) / 1000,
  nCases, config, envTermAudit: audit.evidenceAudit.envTerms, siteWarnings: audit.warnings,
  baselineOverlap: ov, rankRangeWidthTop5: { median: q(0.5), p90: q(0.9), max: widths[widths.length - 1] }, effectBasisTop5: basisCount, criteria: rows
};
mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
writeFileSync(new URL('./out/report.json', import.meta.url), JSON.stringify(report, null, 1));
const pct = (x) => x == null ? '-' : (100 * x).toFixed(1) + '%';
const md = [
  '# 규칙 판정 결과', '',
  `- 계획: ${report.plan} · 사례 ${nCases}건 · 엔진 ${config.engine} · paramsHash ${config.paramsHash} · seed ${config.seed} · 반복 ${config.mcDraws}`,
  `- 효과모형 ${config.data.effectModel.version}(적합 ${config.data.effectModel.fitted_at}) · 예보 기준 ${config.data.envToday && config.data.envToday.forecast_base}`,
  '- 이 결과는 엔진이 자기 규칙을 지키는지(내적 타당도)만 보여 줍니다. 추천이 사람에게 맞는지는 전문가 판정 전에는 알 수 없습니다.', '',
  '| 기준 | 해당 | 통과 | 통과율 | 95% 구간(Wilson) | 통과선 | 충족 | 비고 |', '| --- | ---: | ---: | ---: | --- | ---: | :---: | --- |',
  ...rows.map((r) => `| ${r.id} | ${r.n} | ${r.pass} | ${pct(r.rate)} | ${pct(r.ci95[0])}~${pct(r.ci95[1])} | ${pct(r.threshold)} | ${r.met ? '예' : '**아니오**'} | ${r.note || ''} |`),
  '', '## 실패 사례(기준별 최대 5건)', '',
  ...rows.filter((r) => r.nFail).flatMap((r) => [`### ${r.id} (${r.nFail}건)`, '', ...r.failExamples.map((x) => `- \`${x.case}\` ${JSON.stringify(x.detail)}`), '']),
  rows.some((r) => r.nFail) ? '' : '실패 없음.', '',
  '## 함께 보고(§4)', '',
  `- 효과모형 환경항: ${report.envTermAudit.note}`,
  `- 기상 자료 없는 시설: ${report.siteWarnings.filter((w) => w.includes('기상')).map((w) => w.split(':')[0]).join(', ') || '없음'}`,
  `- 상위 5곳 순위 범위 폭: 중앙값 ${report.rankRangeWidthTop5.median}, 90분위 ${report.rankRangeWidthTop5.p90}, 최대 ${report.rankRangeWidthTop5.max}`,
  `- 상위 5곳 효과 근거 등급: ${Object.entries(basisCount).map(([k, v]) => k + ' ' + v).join(', ')}`,
  `- 가까운 순 3곳(기준선)과 비교(후보 4곳 이상 ${ov.n}건): 시설 구성 같음 ${ov.setSame}건(${(100 * ov.setSame / ov.n).toFixed(0)}%), 순서까지 같음 ${ov.ordSame}건, 평균 겹침 ${(ov.overlap / ov.n).toFixed(2)}/3곳`,
  `- 실행 시간 ${report.seconds.toFixed(1)}초`
].join('\n');
writeFileSync(new URL('./out/report.md', import.meta.url), md + '\n');
console.log(md);
process.exitCode = rows.every((r) => r.met) ? 0 : 1;   // 사전 기준 하나라도 미달이면 실패로 끝냄
