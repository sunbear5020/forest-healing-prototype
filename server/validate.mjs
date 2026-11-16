// /v1/recommend 입력 검사: 알려진 키만 통과시키고 범위를 벗어난 값은 거부한다.
// 엔진이 읽는 입력 키는 engine/soopgyeol-engine.js recommend()와 engine/ui.js readInput() 기준.
const CHECK_KEYS = ['stress', 'anxiety', 'depression', 'fatigue', 'sleep', 'breath'];
const PURPOSES = ['stress', 'sleep', 'respiratory', 'family', 'vitality'];
const WALKS = ['barrier', 'normal', 'trek'];
const PM = ['good', 'normal', 'bad'];
const PERSON_KEYS = ['age', 'sex', 'h', 'ex', 'hp', 'd', 'v', 'pre'];

class InputError extends Error { constructor(msg) { super(msg); this.status = 400; } }
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
function num(x, lo, hi, name) {
  const v = typeof x === 'string' && x.trim() !== '' ? Number(x) : x;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) throw new InputError(`${name}: ${lo}~${hi} 사이 숫자여야 합니다`);
  return v;
}
function str(x, max, name) {
  if (typeof x !== 'string' || x.length > max) throw new InputError(`${name}: ${max}자 이하 문자열이어야 합니다`);
  return x;
}

export function sanitizeRecommendInput(body) {
  if (!isObj(body)) throw new InputError('요청 본문은 JSON 객체여야 합니다');
  const out = {};
  if (body.check != null) {
    if (!isObj(body.check)) throw new InputError('check는 객체여야 합니다');
    out.check = {};
    for (const k of Object.keys(body.check)) {
      if (!CHECK_KEYS.includes(k)) throw new InputError(`check.${k}: 알 수 없는 영역`);
      out.check[k] = num(body.check[k], 0, 4, `check.${k}`);
    }
  }
  if (body.selfharm != null) out.selfharm = body.selfharm === true;
  if (body.purpose != null) { if (!PURPOSES.includes(body.purpose)) throw new InputError('purpose 값이 올바르지 않습니다'); out.purpose = body.purpose; }
  if (body.walk != null) { if (!WALKS.includes(body.walk)) throw new InputError('walk 값이 올바르지 않습니다'); out.walk = body.walk; }
  if (body.maxHours != null) out.maxHours = num(body.maxHours, 0.25, 99, 'maxHours');
  if (body.canVisit != null) out.canVisit = body.canVisit !== false;
  if (body.forestTaste != null) out.forestTaste = str(body.forestTaste, 20, 'forestTaste');
  if (body.month != null) out.month = Math.round(num(body.month, 1, 12, 'month'));
  if (body.date != null) {
    if (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) throw new InputError('date는 YYYY-MM-DD 형식이어야 합니다');
    out.date = body.date;
  }
  if (body.origin != null) {
    const o = body.origin;
    if (!isObj(o)) throw new InputError('origin은 객체여야 합니다');
    if (o.lat != null || o.lng != null) out.origin = { lat: num(o.lat, 32, 39.5, 'origin.lat'), lng: num(o.lng, 124, 132, 'origin.lng') };
    else if (o.sigungu != null) out.origin = { sido: o.sido == null ? undefined : str(o.sido, 30, 'origin.sido'), sigungu: str(o.sigungu, 30, 'origin.sigungu') };
    else throw new InputError('origin에는 lat·lng 또는 sigungu가 있어야 합니다');
  }
  if (body.envOverride != null) {
    const e = body.envOverride;
    if (!isObj(e)) throw new InputError('envOverride는 객체여야 합니다');
    out.envOverride = {
      temp: num(e.temp, -30, 45, 'envOverride.temp'),
      humidity: num(e.humidity ?? 50, 0, 100, 'envOverride.humidity'),
      pm: PM.includes(e.pm) ? e.pm : 'normal',
      rain: e.rain === true,
      wind: num(e.wind ?? 2, 0, 60, 'envOverride.wind')
    };
  }
  if (body.weights != null) {
    const w = body.weights;
    if (!isObj(w)) throw new InputError('weights는 객체여야 합니다');
    out.weights = {};
    for (const k of ['effect', 'env', 'access']) if (w[k] != null) out.weights[k] = num(w[k], 0, 1, `weights.${k}`);
  }
  if (body.topN != null) out.topN = Math.round(num(body.topN, 1, 30, 'topN'));
  if (body.seed != null) out.seed = Math.round(num(body.seed, 1, 2 ** 31 - 1, 'seed'));
  if (body.person != null) out.person = sanitizePerson(body.person);
  return out;
}

export function sanitizePerson(p) {
  if (!isObj(p)) throw new InputError('person은 객체여야 합니다');
  const out = {};
  for (const k of PERSON_KEYS) {
    const v = p[k];
    if (v === '' || v == null) { out[k] = ''; continue; }
    out[k] = num(v, 0, 120, `person.${k}`);
  }
  if (p.cats != null) {
    if (!Array.isArray(p.cats) || p.cats.length > 20) throw new InputError('person.cats는 20개 이하 배열이어야 합니다');
    out.cats = p.cats.map((c, i) => str(c, 30, `person.cats[${i}]`));
  }
  return out;
}

export { InputError };
