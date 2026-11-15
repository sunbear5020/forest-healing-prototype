// 평가 공통: 데이터 적재와 사전 고정 시나리오(docs/EVALUATION.md §2)
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export const E = require('../../engine/soopgyeol-engine.js');
const j = (p) => JSON.parse(readFileSync(new URL('../../data/' + p, import.meta.url)));
const sb = {}; vm.createContext(sb);
vm.runInContext(readFileSync(new URL('../../data.js', import.meta.url), 'utf8') + ';this.FORESTS=FORESTS;this.TRAVEL_HOURS=TRAVEL_HOURS;', sb);
const ev = j('evidence.json');
export const ctx = {
  sites: j('sites.json').sites, evidence: ev, facilityEnv: j('facility_env.json'), envToday: j('env_today.json'),
  forests: j('forests_nearby.json').forests, regionHealth: j('region_health.json'), sigunguPoints: ev.sigungu_points,
  protoForests: sb.FORESTS, travelHours: sb.TRAVEL_HOURS, parks: j('parks.json').parks
};

export const PROFILES = {
  stress_high:  { check: { stress: 4, anxiety: 2, depression: 1, fatigue: 2, sleep: 1, breath: 0 }, purpose: 'stress' },
  depress_high: { check: { stress: 2, anxiety: 1, depression: 3, fatigue: 2, sleep: 1, breath: 0 }, purpose: 'stress' },
  anxiety_high: { check: { stress: 2, anxiety: 3, depression: 1, fatigue: 1, sleep: 1, breath: 0 }, purpose: 'stress' },
  fatigue_high: { check: { stress: 1, anxiety: 0, depression: 0, fatigue: 4, sleep: 1, breath: 0 }, purpose: 'vitality' },
  sleep_only:   { check: { sleep: 3 }, purpose: 'sleep' },
  breath_only:  { check: { breath: 3 }, purpose: 'respiratory' },
  mild_all:     { check: { stress: 1, anxiety: 1, depression: 1, fatigue: 1, sleep: 1, breath: 1 }, purpose: 'stress' },
  severe_all:   { check: { stress: 4, anxiety: 4, depression: 4, fatigue: 3, sleep: 3, breath: 1 }, purpose: 'stress' }
};
export const ORIGINS = {
  서울: { lat: 37.5665, lng: 126.978 }, 부산: { lat: 35.1796, lng: 129.0756 }, 광주: { lat: 35.1595, lng: 126.8526 },
  강릉: { lat: 37.7519, lng: 128.8761 }, 제주: { lat: 33.4996, lng: 126.5312 }
};
export const SCENARIOS = {
  normal: { temp: 20, humidity: 50, pm: 'good', rain: false, wind: 2 },
  heat:   { temp: 35, humidity: 60, pm: 'good', rain: false, wind: 2 },
  wind:   { temp: 15, humidity: 50, pm: 'good', rain: false, wind: 16 },
  pm_bad: { temp: 18, humidity: 50, pm: 'bad', rain: false, wind: 2 },
  rain:   { temp: 18, humidity: 85, pm: 'good', rain: true, wind: 3 }
};

export function* cases() {
  for (const p of Object.keys(PROFILES)) for (const selfharm of [false, true]) for (const o of Object.keys(ORIGINS))
    for (const s of Object.keys(SCENARIOS)) for (const canVisit of [true, false]) for (const maxHours of [1.5, 3]) {
      yield { id: [p, selfharm ? 'SH' : 'noSH', o, s, canVisit ? 'visit' : 'noVisit', maxHours + 'h'].join('|'),
        factors: { profile: p, selfharm, origin: o, scenario: s, canVisit, maxHours },
        input: { ...PROFILES[p], selfharm, origin: ORIGINS[o], envOverride: SCENARIOS[s], canVisit, maxHours, walk: 'normal', month: 10 } };
    }
}

export function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function shuffled(arr, rng) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(rng() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; } return a; }
export function wilson(k, n, z = 1.96) {
  if (!n) return [null, null];
  const p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
