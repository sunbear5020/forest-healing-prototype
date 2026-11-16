// 전문가 블라인드 판정용 사례 100건(docs/EVALUATION.md §5)
// 출력: tests/eval/out/expert_cases.csv(판정자용), expert_cases_info.csv(같은 사례·같은 A/B에 시설별 효과·근거 정보 추가, v0.4~),
//       tests/eval/out/answer_key.csv(판정자에게 주지 않음), rater_template.csv
// 실행: node tests/eval/make_expert_cases.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { E, ctx, cases, mulberry32, shuffled } from './common.mjs';

const N = 100, N_SH = 10, rng = mulberry32(20261115);
const all = [...cases()].filter((c) => c.factors.canVisit);   // 방문 가능 사례만(방문 불가는 대체경로 판정이라 별도)
const sh = shuffled(all.filter((c) => c.factors.selfharm), rng).slice(0, N_SH);
// 자해 없음: 프로필×환경 층별로 고르게
const strata = {};
all.filter((c) => !c.factors.selfharm).forEach((c) => { const k = c.factors.profile + '|' + c.factors.scenario; (strata[k] = strata[k] || []).push(c); });
const BASIS = { model: '측정', mixed: '일부 측정', similar: '유사 시설 추정', literature: '문헌값', none: '효과 자료 없음' };
function item(e) {
  // 효과: 고른 영역 가중 평균 개선(SD, 클수록 좋음)과 구간. 판정자에게 보여 줄 정보(정보 추가판)
  const ds = Object.keys(e.byDomain || {});
  let eff = null;
  if (ds.length) {
    const w = ds.map((d) => 1); const sw = w.reduce((a, b) => a + b, 0);
    const m = ds.reduce((a, d) => a - e.byDomain[d].pred, 0) / sw, lo = ds.reduce((a, d) => a - e.byDomain[d].hi, 0) / sw, hi = ds.reduce((a, d) => a - e.byDomain[d].lo, 0) / sw;
    eff = `${m.toFixed(2)}(${lo.toFixed(2)}~${hi.toFixed(2)})`;
  }
  return { name: e.site.name, hours: e.access.hours, indoor: e.envDetail.indoor, eff, basis: BASIS[e.effectBasis] || e.effectBasis };
}
function lists(c) {
  const r = E.recommend(c.input, ctx);
  const engine = r.recommendations.slice(0, 3).map(item);
  // 기준선: 제외되지 않은 시설 중 가까운 순 3곳(같은 제외 규칙 적용 → 차이는 '맞춤'만)
  const pool = E.recommend({ ...c.input, topN: 99 }, ctx).recommendations.slice().sort((a, b) => a.access.hours - b.access.hours || (a.site.id < b.site.id ? -1 : 1));
  const near = pool.slice(0, 3).map(item);
  return { r, engine, near };
}
const same = (a, b) => a.map((x) => x.name).join() === b.map((x) => x.name).join();   // 순서까지 같으면 같은 목록
// 자해 없음 사례는 두 목록의 시설 구성이 다른 것만 뽑음(같으면 비교 정보가 없음, §7)
const keys = shuffled(Object.keys(strata), rng); const pick = [];
for (let i = 0; pick.length < N - N_SH && i < 100000; i++) {
  const arr = strata[keys[i % keys.length]]; if (!arr.length) continue;
  const c = arr.splice(Math.floor(rng() * arr.length), 1)[0];
  const L0 = lists(c); if (same(L0.engine, L0.near)) continue;
  pick.push(c);
}
const chosen = shuffled(sh.concat(pick), rng);

const L = { stress: '스트레스', anxiety: '불안', depression: '우울감', fatigue: '피로', sleep: '수면', breath: '호흡기' };
const SC = { normal: '맑음 20℃', heat: '최고 35℃', wind: '강풍 16 m/s', pm_bad: 'PM2.5 나쁨', rain: '비' };
const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
const fmtList = (items) => items.length ? items.map((x, i) => `${i + 1}) ${x.name}(${x.hours}시간)${x.indoor ? '[실내시설]' : ''}`).join(' / ') : '추천 없음';
const fmtInfo = (items) => items.length ? items.map((x, i) => `${i + 1}) ${x.name}(${x.hours}시간)${x.indoor ? '[실내시설]' : ''} 예상 개선 ${x.eff ?? '계산 안 함'} SD·${x.basis}`).join(' / ') : '추천 없음';
const infoRows = [['case_id', '상태(0~4)', '자해 생각', '출발지', '방문일 환경', '이동 허용', '안전 안내', '목록 A', '목록 B'].join(',')];
const caseRows = [['case_id', '상태(0~4)', '자해 생각', '출발지', '방문일 환경', '이동 허용', '안전 안내', '목록 A', '목록 B'].join(',')];
const keyRows = [['case_id', 'A', 'B', 'factors'].join(',')];
const rater = [['case_id', 'A_적절성(0/1/2)', 'B_적절성(0/1/2)', '더 나은 쪽(A/B/같음)', '안전 안내 적절(예/아니오)', '메모'].join(',')];
chosen.forEach((c, i) => {
  const id = 'C' + String(i + 1).padStart(3, '0');
  const { r, engine, near } = lists(c);
  const engineIsA = rng() < 0.5;
  const A = engineIsA ? engine : near, B = engineIsA ? near : engine;
  const st = Object.entries(c.input.check).map(([k, v]) => L[k] + v).join(' ');
  const safety = r.safety.level === 'urgent' ? '상담전화 먼저 안내(109 등), 숲·공원 대안 함께' : r.safety.level === 'caution' ? '전문 상담 병행 권고' : '없음';
  caseRows.push([id, q(st), c.factors.selfharm ? '있음' : '없음', c.factors.origin, SC[c.factors.scenario], c.factors.maxHours + '시간', q(safety), q(fmtList(A)), q(fmtList(B))].join(','));
  infoRows.push([id, q(st), c.factors.selfharm ? '있음' : '없음', c.factors.origin, SC[c.factors.scenario], c.factors.maxHours + '시간', q(safety), q(fmtInfo(A)), q(fmtInfo(B))].join(','));
  keyRows.push([id, engineIsA ? 'engine' : 'nearest', engineIsA ? 'nearest' : 'engine', q(c.id)].join(','));
  rater.push([id, '', '', '', '', ''].join(','));
});
mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
const bom = '﻿';
writeFileSync(new URL('./out/expert_cases.csv', import.meta.url), bom + caseRows.join('\n') + '\n');
writeFileSync(new URL('./out/expert_cases_info.csv', import.meta.url), bom + infoRows.join('\n') + '\n');
writeFileSync(new URL('./out/answer_key.csv', import.meta.url), bom + keyRows.join('\n') + '\n');
writeFileSync(new URL('./out/rater_template.csv', import.meta.url), bom + rater.join('\n') + '\n');
const nSame = chosen.filter((c) => { const L0 = lists(c); return same(L0.engine, L0.near); }).length;
console.log(`사례 ${chosen.length}건(자해 있음 ${sh.length}, 두 목록 구성이 같은 사례 ${nSame}건) → tests/eval/out/expert_cases.csv, answer_key.csv, rater_template.csv`);
