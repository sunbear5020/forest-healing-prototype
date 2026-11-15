/* =========================================================================
   숲결 맞춤 추천 엔진 (Soopgyeol Matching Engine) v0.1
   -------------------------------------------------------------------------
   사용자의 지금 상태·니즈 × 시설 환경(고정/평년/실황) × 효과 근거를 맞춰
   치유의 숲 방문을 추천하고, 방문이 어려우면 대체 경로를 안내한다.

   · 순수 함수. 브라우저와 Node 모두에서 동작(UMD). 외부 요청을 하지 않는다.
   · 입력값(자가점검·위치)은 이 함수 안에서만 쓰이고 저장·전송하지 않는다.
   · 근거 등급: model(설문 효과모형) > similar(측정기관 중앙값 추정) > literature(메타분석 사전값) > rule(안전 기준) > demo(시연값)
   · 계수 출처는 PARAMS의 basis 필드에 적는다. 'demo'는 근거 없이 정한 값이다.

   처리 단계
     1 안전 확인        safetyCheck()
     2 상태 프로필      buildProfile()
     3 시설별 평가      evaluateSite()  ─ 효과(E) · 환경 적합(V) · 접근(A) · 제외 사유
     4 종합·순위 범위   rankWithUncertainty()  ─ 몬테카를로 순위 10~90%
     5 프로그램·주변 연계 pickPrograms(), nearbyLinks()
     6 대체 경로        alternatives()  ─ 디지털치료제 자리 → 근처 공원 → 가까운 산림
   ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SoopEngine = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '0.3.0';

  /* ---------------------------------------------------------------------
     계수표 — basis: rule(공공 기준) / literature / model / demo(시연값)
     --------------------------------------------------------------------- */
  var PARAMS = {
    weights:        { value: { effect: 0.5, env: 0.3, access: 0.2 }, basis: 'demo', note: '효과·환경·접근 합성 비중' },
    effectScale:    { value: 1.0, basis: 'demo', note: '사전-사후 1.0 SD 개선을 효과 점수 100으로 환산' },
    heatWarn:       { value: 33, basis: 'rule', note: '일 최고기온 33 ℃: 기상청 폭염주의보 기준값' },
    heatCaution:    { value: 30, basis: 'demo', note: '30 ℃ 이상 감점' },
    coldCaution:    { value: 0, basis: 'demo', note: '최고기온 0 ℃ 이하 감점' },
    windWarn:       { value: 14, basis: 'rule', note: '풍속 14 m/s: 기상청 육상 강풍주의보 기준값' },
    pm25Bad:        { value: 36, basis: 'rule', note: 'PM2.5 36 ㎍/㎥ 이상 = 환경부 예보 등급 나쁨' },
    rainPop:        { value: 60, basis: 'demo', note: '강수확률 60% 이상 또는 강수 2시간 이상을 비 오는 날로 봄' },
    lapse:          { value: 0.65, basis: 'literature', note: '표준 기온감률 0.65 ℃/100 m(연구설계 3.4절)' },
    roadFactor:     { value: 1.3, basis: 'demo', note: '직선거리 → 도로거리 보정' },
    roadSpeed:      { value: 70, basis: 'demo', note: '평균 차량 속도 km/h' },
    seaCrossing:    { value: 2.0, basis: 'demo', note: '제주↔내륙 이동 추가 시간(항공·수속)' },
    parkCanopyMin:  { value: 30, basis: 'demo', note: '공원 수관 피복 30% 이상. 3-30-300 규칙의 30%를 공원 단위에 차용(원래는 동네 단위 기준)' },
    parkRadiusKm:   { value: [2, 5, 10], basis: 'demo', note: '근처 공원 탐색 반경(부족하면 넓힘)' },
    gentleBarrier:  { value: 8, basis: 'demo', note: '무장애 선호: 반경 0.5 km 완경사(8° 미만) 비율이 이 값(%) 미만이면 감점(무장애 데크 정보가 없는 시설)' },
    mcDraws:        { value: 400, basis: 'demo', note: '순위 범위 계산 반복 수' },
    fdr:            { value: 0.05, basis: 'rule', note: '효과모형 환경항 다중비교 보정(Benjamini-Hochberg) 기준 q' },
    forestPark:     { value: { canopyMin: 60, areaHa: 10, radiusKm: [10, 20, 40] }, basis: 'demo', note: '산림공원(숲이 많은 큰 공원): 수관 피복 60% 이상·10 ha 이상. 공식 공원 구분이 아니라 WorldCover 기준 정의' },
    badWeatherIndoorFirst: { value: ['pm25', 'rain'], basis: 'demo', note: 'PM2.5 나쁨·비 예상일에는 실내 대체 시설이 있는 곳을 먼저(점수보다 앞선 순위 규칙). v0.2 가상 판정에서 드러난 약점 보완' }
  };

  /* 자가점검 영역 ↔ 근거 영역 */
  var DOMAINS = {
    stress:     { label: '스트레스',        model: 'stress',     prior: 'stress',     purposeTag: 'stress' },
    anxiety:    { label: '불안·긴장',       model: 'anxiety',    prior: 'anxiety',    purposeTag: 'stress' },
    depression: { label: '우울감',          model: 'depression', prior: 'depression', purposeTag: 'stress' },
    fatigue:    { label: '피로·활력 저하',  model: 'mood',       prior: 'fatigue',    purposeTag: 'vitality' },
    sleep:      { label: '수면 어려움',     model: null,         prior: null,         purposeTag: 'sleep' },
    breath:     { label: '호흡기 불편',     model: null,         prior: null,         purposeTag: 'respiratory' }
  };
  var PURPOSE_TO_DOMAIN = { stress: 'stress', sleep: 'sleep', respiratory: 'breath', family: 'fatigue', vitality: 'fatigue' };

  var CONTACTS = [
    { name: '자살예방상담전화', tel: '109', note: '24시간' },
    { name: '정신건강위기상담전화', tel: '1577-0199', note: '24시간' },
    { name: '응급 상황', tel: '119 / 112', note: '즉시 위험할 때' }
  ];

  /* ---------------------------------------------------------------------
     유틸
     --------------------------------------------------------------------- */
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function round(x, d) { var k = Math.pow(10, d || 0); return Math.round(x * k) / k; }
  function haversineKm(a, b) {
    var R = 6371, toR = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function isJeju(p) { return p.lat < 34.0; }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function normal(rng) {
    var u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function quantile(arr, q) {
    var a = arr.slice().sort(function (x, y) { return x - y; });
    var i = (a.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
    return a[lo] + (a[hi] - a[lo]) * (i - lo);
  }
  function monthOf(dateStr) {
    var d = dateStr ? new Date(dateStr + 'T12:00:00+09:00') : new Date();
    return d.getMonth() + 1;
  }

  /* ---------------------------------------------------------------------
     1. 안전 확인
     --------------------------------------------------------------------- */
  function safetyCheck(input) {
    var c = input.check || {};
    var out = { level: 'ok', messages: [], contacts: [] };
    if (input.selfharm) {
      out.level = 'urgent';
      out.messages.push('스스로를 해치고 싶은 생각이 있다고 답하셨습니다. 숲 방문보다 지금 바로 전문 상담을 먼저 권합니다.');
      out.contacts = CONTACTS;
    } else if ((c.depression || 0) >= 4 || (c.anxiety || 0) >= 4) {
      out.level = 'caution';
      out.messages.push('우울감 또는 불안이 매우 심하다고 답하셨습니다. 산림치유는 치료를 대신하지 않으니 전문 상담과 함께 이용하시길 권합니다.');
      out.contacts = CONTACTS.slice(1, 2);
    }
    out.disclaimer = '자가점검은 진단이나 표준화된 선별도구가 아닙니다. 추천의 방향을 정하는 데만 씁니다.';
    return out;
  }

  /* ---------------------------------------------------------------------
     2. 상태 프로필: 영역별 가중치
     --------------------------------------------------------------------- */
  function buildProfile(input) {
    var c = input.check || {};
    var w = {}, sum = 0;
    Object.keys(DOMAINS).forEach(function (k) { w[k] = clamp(+c[k] || 0, 0, 4); sum += w[k]; });
    var pd = PURPOSE_TO_DOMAIN[input.purpose];
    if (pd) { w[pd] += 1; sum += 1; }
    if (sum === 0) { w.stress = 1; sum = 1; }
    Object.keys(w).forEach(function (k) { w[k] = w[k] / sum; });
    var sorted = Object.keys(w).sort(function (a, b) { return w[b] - w[a]; });
    var modeled = sorted.filter(function (k) { return DOMAINS[k].model && w[k] > 0; });
    var unmodeled = sorted.filter(function (k) { return !DOMAINS[k].model && w[k] > 0; });
    return {
      weights: w,
      primary: sorted[0],
      modeledDomains: modeled,
      literatureOnlyDomains: unmodeled,
      purposeTags: sorted.filter(function (k) { return w[k] > 0; }).map(function (k) { return DOMAINS[k].purposeTag; })
    };
  }

  /* ---------------------------------------------------------------------
     3-a. 효과 근거: 시설 × 영역
     --------------------------------------------------------------------- */
  function domainEffect(site, domain, month, ctx) {
    var D = DOMAINS[domain];
    if (!D.model) return null;
    var model = ctx.evidence && ctx.evidence.model;
    var f = model && site.facilityId && model.facilities[site.facilityId];
    if (f && f[D.model]) {
      var o = f[D.model];
      var pred = o.pred, shift = 0;
      var fm = model.facility_month && model.facility_month[site.facilityId];
      if (fm && fm[D.model] && fm[D.model][String(month)] != null) shift = fm[D.model][String(month)] - o.pred;
      return { pred: pred + shift, lo: o.lo + shift, hi: o.hi + shift, n: o.n, supported: o.supported !== false,
               basis: 'model', note: o.supported === false ? '응답 30건 미만, 다른 영역 자료로 외삽' : null };
    }
    // 효과측정 자료가 없는 시설: 같은 자료체계(진흥원 프로그램)의 측정기관 중앙값으로 추정하고,
    // 범위는 측정기관 구간의 최소~최대로 넓게 둔다. 메타분석 통합값은 참고로 함께 싣는다.
    // (메타분석 값은 이 자료의 사전-사후 변화보다 작게 나오는 경향이 있어 그대로 쓰면 측정기관이 체계적으로 유리해진다)
    var sim = similarEffect(D.model, month, ctx);
    var p = ctx.evidence && ctx.evidence.prior[D.prior];
    if (sim) {
      return { pred: sim.pred, lo: sim.lo, hi: sim.hi, n: null, supported: true, basis: 'similar',
               note: '효과측정 자료가 없어 측정기관 ' + sim.k + '곳 중앙값으로 추정(범위는 기관 구간 최소~최대)' +
                     (p ? '. 참고: 메타분석 ' + p.label + ' ' + p.g.toFixed(2) + ' SD' : '') };
    }
    if (!p) return null;
    return { pred: p.g, lo: p.lo, hi: p.hi, n: null, supported: true, basis: 'literature',
             note: '효과측정 자료가 없어 메타분석 통합값(단일군 사전-사후)을 씀. 시설 간 차이 정보 없음' };
  }

  var _simCache = {};
  function similarEffect(outcome, month, ctx) {
    var model = ctx.evidence && ctx.evidence.model;
    if (!model) return null;
    var key = outcome + '|' + month;
    if (_simCache[key] && _simCache[key].model === model) return _simCache[key].v;
    var preds = [], los = [], his = [];
    Object.keys(model.facilities).forEach(function (k) {
      var o = model.facilities[k][outcome];
      if (!o || o.supported === false) return;
      var fm = model.facility_month && model.facility_month[k] && model.facility_month[k][outcome];
      var shift = fm && fm[String(month)] != null ? fm[String(month)] - o.pred : 0;
      preds.push(o.pred + shift); los.push(o.lo + shift); his.push(o.hi + shift);
    });
    var v = preds.length < 3 ? null : {
      pred: quantile(preds, 0.5),   // 중앙값: 한두 기관의 큰 값에 끌려가지 않게
      lo: Math.min.apply(null, los), hi: Math.max.apply(null, his), k: preds.length };
    _simCache[key] = { model: model, v: v };
    return v;
  }

  /* 환경 항 다중비교 보정(Benjamini-Hochberg). 효과모형은 환경변수 × 결과영역을 여러 개 검정했으므로
     개별 p<0.05만으로 쓰면 우연히 걸린 항을 반영하게 된다. 보정 q<0.05인 항만 반영한다. */
  var _bhCache = { model: null, q: null };
  function bhQ(model) {
    if (_bhCache.model === model) return _bhCache.q;
    var terms = (model.env_terms || []).map(function (t, i) { return { i: i, p: typeof t.p === 'number' ? t.p : 1 }; });
    var m = terms.length, q = new Array(m);
    terms.sort(function (a, b) { return a.p - b.p; });
    var prev = 1;
    for (var k = m - 1; k >= 0; k--) { prev = Math.min(prev, terms[k].p * m / (k + 1)); q[terms[k].i] = Math.min(1, prev); }
    _bhCache = { model: model, q: q };
    return q;
  }
  function envTermAudit(ctx) {
    var model = ctx.evidence && ctx.evidence.model;
    if (!model || !model.env_terms) return null;
    var q = bhQ(model);
    var nominal = model.env_terms.filter(function (t) { return t.p < 0.05; }).length;
    var kept = model.env_terms.filter(function (t, i) { return q[i] < PARAMS.fdr.value; });
    return { tested: model.env_terms.length, nominalP05: nominal, keptAfterFDR: kept.length,
             kept: kept.map(function (t) { return t.var + ':' + t.outcome; }),
             note: '환경항 ' + model.env_terms.length + '개 검정 중 p<0.05는 ' + nominal + '개, BH 보정(q<' + PARAMS.fdr.value + ') 후 ' + kept.length + '개' +
                   (kept.length ? ' 반영' : ' → 환경항은 효과 점수에 반영하지 않음(탐색 결과로만 보고)') };
  }

  /* 환경 항(효과모형 env_terms 중 BH 보정 q<0.05이고 날짜별로 달라지는 항만) */
  function envTermShift(domain, dayEnv, climMonth, ctx) {
    var model = ctx.evidence && ctx.evidence.model;
    if (!model || !dayEnv) return { shift: 0, used: [] };
    var D = DOMAINS[domain], shift = 0, used = [];
    var q = bhQ(model);
    (model.env_terms || []).forEach(function (t, i) {
      if (!(q[i] < PARAMS.fdr.value)) return;
      if (t.outcome !== 'all' && t.outcome !== D.model) return;
      if (t.var === 'wet' && dayEnv.rain) { shift += t.b; used.push('강수일 ' + (t.b > 0 ? '+' : '') + t.b.toFixed(2) + ' SD(p=' + t.p.toFixed(3) + ', q=' + q[i].toFixed(3) + ')'); }
      if (t.var === 'tmean_anom' && dayEnv.tmean != null && climMonth && climMonth.tavg != null) {
        var an = dayEnv.tmean - climMonth.tavg;
        shift += t.b * an; used.push('기온 편차 ' + an.toFixed(1) + '℃ × ' + t.b + ' SD(q=' + q[i].toFixed(3) + ')');
      }
    });
    return { shift: shift, used: used };
  }

  /* ---------------------------------------------------------------------
     3-b. 방문일 환경(③층 실황 → 없으면 ②층 월평균)
     --------------------------------------------------------------------- */
  function dayEnvironment(site, date, month, ctx, override) {
    var fe = ctx.facilityEnv && site.facilityId && ctx.facilityEnv.facilities[site.facilityId];
    var clim = fe && fe.climate && fe.climate.monthly ? fe.climate.monthly[String(month)] || fe.climate.monthly[month] : null;
    if (override) {
      return { source: 'scenario', label: '화면 시나리오 입력값',
               tmax: override.temp, tmean: override.temp - 3, reh: override.humidity,
               rain: !!override.rain, wind: override.wind || 0,
               pm25: override.pm === 'bad' ? 50 : override.pm === 'normal' ? 25 : 10, clim: clim };
    }
    var et = ctx.envToday && ctx.envToday.sites && ctx.envToday.sites[site.id];
    var day = et && et.days && et.days.filter(function (d) { return d.date === date; })[0];
    if (day) {
      var tmax = day.tmx != null ? day.tmx : day.tmp_day;
      return { source: 'forecast', label: '기상청 단기예보(' + (ctx.envToday.forecast_base || '') + ')',
               tmax: tmax, tmean: day.tmx != null && day.tmn != null ? (day.tmx + day.tmn) / 2 : day.tmp_day,
               reh: day.reh, rain: (day.pop_max || 0) >= PARAMS.rainPop.value || (day.rain_hours || 0) >= 2,
               wind: day.wsd_max || 0, pop: day.pop_max,
               pm25: et.pm25 && et.pm25.pm25_median, pm25Basis: '시도 측정소 중앙값', clim: clim };
    }
    if (clim) {
      return { source: 'climate', label: '최근 5년(2021~2025) ' + month + '월 평균(표고 보정)',
               tmax: clim.tmax, tmean: clim.tavg, reh: clim.rh,
               rain: false, rainChancePct: clim.rain_day_pct, hotDayPct: clim.hot_day_pct,
               wind: 0, pm25: null, clim: clim };
    }
    return { source: 'none', label: '환경 자료 없음(시설 프로필 구축 전)', clim: null };
  }

  /* ---------------------------------------------------------------------
     3-c. 환경 적합(V, 0~100): 안전·쾌적·필요 노출. 대부분 시연값
     --------------------------------------------------------------------- */
  function envFit(site, profile, env, ctx, proto, walk) {
    var notes = [], hazards = [], score = 70, basis = [];
    var fe = ctx.facilityEnv && site.facilityId && ctx.facilityEnv.facilities[site.facilityId];
    var indoor = proto ? (proto.shelter || 0) >= 60 : false;
    var w = profile.weights;

    if (env.source === 'none') {
      notes.push('기상·대기 자료가 없어 환경 적합은 중립값(70)으로 둠');
    } else {
      if (env.tmax != null) {
        if (env.tmax >= PARAMS.heatWarn.value) { hazards.push('heat'); score -= indoor ? 15 : 30; notes.push('최고기온 ' + env.tmax + '℃: 폭염주의보 기준 이상' + (indoor ? '(실내 시설 있음)' : '')); }
        else if (env.tmax >= PARAMS.heatCaution.value) { score -= 10; notes.push('최고기온 ' + env.tmax + '℃: 더움'); }
        else if (env.tmax <= PARAMS.coldCaution.value) { score -= 10; notes.push('최고기온 ' + env.tmax + '℃: 추움'); }
      }
      if (env.wind >= PARAMS.windWarn.value) { hazards.push('wind'); score -= 25; notes.push('풍속 ' + env.wind + ' m/s: 강풍주의보 기준 이상'); }
      if (env.rain) { hazards.push('rain'); score -= indoor ? 5 : 15; notes.push('비 예상' + (indoor ? '(실내 프로그램 가능)' : '')); }
      if (env.source === 'climate' && env.rainChancePct != null) notes.push(env.label + ' 강수일 비율 ' + env.rainChancePct + '%');
      if (env.pm25 != null) {
        if (env.pm25 >= PARAMS.pm25Bad.value) {
          hazards.push('pm25'); score -= 10 + Math.round(40 * w.breath);
          notes.push('PM2.5 ' + env.pm25 + '㎍/㎥(' + (env.pm25Basis || '입력값') + '): 나쁨');
        } else if (w.breath > 0) { score += Math.round(10 * w.breath); notes.push('PM2.5 ' + env.pm25 + '㎍/㎥: 나쁨 기준 미만'); }
      }
    }
    // 고정층: 수관 피복·지형·피톤치드
    if (fe && fe.fixed) {
      var cp = fe.fixed.canopy_1km;
      if (cp) { score += Math.round((cp.tree - 85) / 3); basis.push('수관 피복 ' + cp.tree + '%(반경 1 km, ESA WorldCover 2021)'); }
      var t = fe.fixed.terrain && fe.fixed.terrain.r500;
      if (t) {
        basis.push('반경 0.5 km 평균 경사 ' + t.slope_mean_deg + '°, 완경사 비율 ' + t.gentle_pct_lt8deg + '%');
        if (walk === 'barrier' && !(proto && proto.barrierFree) && t.gentle_pct_lt8deg < PARAMS.gentleBarrier.value) {
          score -= 15; notes.push('무장애 선호인데 무장애 숲길 정보가 없고 주변 경사가 급함');
        }
        if (walk === 'trek') score += 3;
      }
      var ph = fe.fixed.phytoncide_2018;
      if (ph && (w.breath + w.sleep) > 0) {
        basis.push('피톤치드(테르펜 6종 합) 중앙값 ' + ph.terpene_ppt_median + ' ppt, 2018년 ' + ph.n + '건 측정');
        score += Math.round(6 * (w.breath + w.sleep));
      }
    } else if (proto) {
      basis.push('시설 환경 프로필은 공개자료 요약(data.js)만 있음');
      if (walk === 'barrier' && !proto.barrierFree) { score -= 15; notes.push('무장애 숲길 정보 없음'); }
    }
    if (walk === 'barrier' && proto && proto.barrierFree) { score += 5; basis.push('무장애 데크 있음'); }
    return { score: clamp(score, 0, 100), hazards: hazards, notes: notes, basis: basis, indoor: indoor };
  }

  /* ---------------------------------------------------------------------
     3-d. 접근(A)
     --------------------------------------------------------------------- */
  function access(site, origin, maxHours, ctx) {
    var hours = null, km = null, how = '';
    if (origin && origin.lat != null) {
      km = haversineKm(origin, site);
      hours = km * PARAMS.roadFactor.value / PARAMS.roadSpeed.value + 0.25;
      if (isJeju(origin) !== isJeju(site)) hours += PARAMS.seaCrossing.value;
      how = '직선거리 ' + round(km, 0) + ' km 기준 추정';
    } else if (origin && origin.region && ctx.travelHours && site.region && ctx.travelHours[origin.region]) {
      hours = ctx.travelHours[origin.region][site.region];
      how = '권역 간 대표 이동시간';
    }
    if (hours == null) return { hours: null, km: null, score: 50, eligible: true, how: '출발지 미입력' };
    var max = maxHours || 3;
    var score = hours <= 1 ? 100 : clamp(100 * (1 - (hours - 1) / Math.max(0.5, max * 1.5 - 1)), 0, 100);
    return { hours: round(hours, 1), km: km == null ? null : round(km, 0), score: round(score, 0), eligible: hours <= max, how: how };
  }

  /* ---------------------------------------------------------------------
     5. 프로그램 매칭 · 주변 연계
     --------------------------------------------------------------------- */
  function pickPrograms(proto, profile, walk, hazards) {
    if (!proto || !proto.programs || !proto.programs.length) {
      return { items: [], note: '프로그램 정보 구축 전입니다. 시설에 직접 문의하세요.' };
    }
    var bad = hazards.indexOf('rain') >= 0 || hazards.indexOf('pm25') >= 0 || hazards.indexOf('wind') >= 0 || hazards.indexOf('heat') >= 0;
    var tags = profile.purposeTags;
    var scored = proto.programs.map(function (p) {
      var s = 0;
      tags.forEach(function (t, i) { if (p.tags && p.tags.indexOf(t) >= 0) s += 5 - Math.min(i, 3); });
      if (walk === 'barrier') s += p.difficulty === '낮음' ? 4 : p.difficulty === '보통' ? -3 : -9;
      if (walk === 'trek') s += p.difficulty === '높음' ? 2 : 1;
      if (bad) s += p.setting === '실내' ? 7 : p.setting === '실내외' ? 2 : -7;
      return { p: p, s: s };
    }).sort(function (a, b) { return b.s - a.s; });
    var items = scored.slice(0, 2).map(function (x) {
      return { name: x.p.name, setting: x.p.setting, minutes: x.p.minutes, difficulty: x.p.difficulty,
               indoorAlt: bad && x.p.setting === '실외' ? x.p.indoorAlt : null };
    });
    return { items: items, switchedIndoor: bad,
             note: '프로그램 선택은 목적 태그·난이도·기상 규칙(시연값)으로 정함. 프로그램별 효과 차이는 2026 모형에서 구분되지 않음(AUC 0.50~0.52).' };
  }

  function nearbyLinks(site, ctx) {
    var out = [];
    if (ctx.forests) {
      ctx.forests.forEach(function (f) {
        var d = haversineKm(site, f);
        if (d > 1.5 && d <= 20) out.push({ name: f.name, kind: f.kind, km: round(d, 1) });
      });
      out.sort(function (a, b) { return a.km - b.km; });
    }
    var tour = ctx.tourism && ctx.tourism[site.id];
    return {
      forests: out.slice(0, 3),
      tourism: tour ? tour.slice(0, 5) : null,
      tourismNote: tour ? '반경 10 km 관광지·문화시설·레포츠(한국관광공사 관광정보, ' + ((ctx.tourismMeta && ctx.tourismMeta.built) || '') + ' 수집). 거리 기준 참고 목록이며 치유 효과와 무관합니다.'
                        : '주변 관광지 자료 없음'
    };
  }

  /* ---------------------------------------------------------------------
     6. 대체 경로
     --------------------------------------------------------------------- */
  function alternatives(origin, ctx, opts) {
    opts = opts || {};
    var res = {
      digital: Object.assign({ available: false, status: '개발 중', title: '산림치유 디지털치료제',
                               note: '개발 중인 디지털치료제 연결 자리입니다. 출시 후 링크를 연결합니다.' }, ctx.digitalTherapeutic || {}),
      parks: [], forestParks: [], urbanForest: null, forests: [], originNote: null
    };
    if (!origin || origin.lat == null) {
      res.originNote = '출발 위치(기기 위치 또는 시군구)를 알려 주시면 근처 공원과 산림을 찾습니다.';
      return res;
    }
    if (ctx.parks) {
      var radii = PARAMS.parkRadiusKm.value, found = [];
      for (var i = 0; i < radii.length && found.length < 3; i++) {
        found = [];
        ctx.parks.forEach(function (p) {
          if (p.tree_pct == null || p.tree_pct < PARAMS.parkCanopyMin.value) return;
          var d = haversineKm(origin, p);
          if (d > radii[i]) return;
          var s = p.tree_pct * 0.6 + Math.min(30, 6 * Math.log10(p.area_m2 / 1000)) - d * (20 / radii[i]);
          found.push({ name: p.name, type: p.type, km: round(d, 1), tree_pct: p.tree_pct, area_ha: round(p.area_m2 / 10000, 1),
                       addr: p.addr, score: round(s, 1), lat: p.lat, lng: p.lng, radiusKm: radii[i] });
        });
      }
      res.parks = found.sort(function (a, b) { return b.score - a.score; }).slice(0, 5);
      var fp = PARAMS.forestPark.value, ffound = [];
      for (var r2 = 0; r2 < fp.radiusKm.length && ffound.length < 3; r2++) {
        ffound = [];
        ctx.parks.forEach(function (p) {
          if (p.tree_pct == null || p.tree_pct < fp.canopyMin || p.area_m2 < fp.areaHa * 10000) return;
          var d = haversineKm(origin, p);
          if (d > fp.radiusKm[r2]) return;
          ffound.push({ name: p.name, type: p.type, km: round(d, 1), tree_pct: p.tree_pct, area_ha: round(p.area_m2 / 10000, 1), addr: p.addr, lat: p.lat, lng: p.lng, radiusKm: fp.radiusKm[r2] });
        });
      }
      res.forestParks = ffound.sort(function (a, b) { return a.km - b.km; }).slice(0, 3);
      res.urbanForest = { available: false, note: '도시숲은 전국 위치 자료가 공개되어 있지 않습니다(산림청 도시숲 현황 통계는 지자체별 면적 수치). 지자체 자료를 확보하면 이 단계에 연결합니다.' };
      res.parkNote = '수관 피복률은 공원 대표 좌표 중심의 원형 근사(ESA WorldCover 2021) 추정값이며, 수종 정보는 아직 결합하지 않았습니다.';
    }
    var fl = [];
    (ctx.forests || []).forEach(function (f) { fl.push({ name: f.name, kind: f.kind, km: round(haversineKm(origin, f), 1), tree_pct_1km: f.tree_pct_1km, addr: f.addr, phone: f.phone, lat: f.lat, lng: f.lng }); });
    (ctx.sites || []).forEach(function (s) { fl.push({ name: s.name, kind: s.kind, km: round(haversineKm(origin, s), 1), addr: s.address, lat: s.lat, lng: s.lng, isSite: true }); });
    var kept = [];
    fl.sort(function (a, b) { return a.km - b.km; }).forEach(function (f) {
      // 두 자료(휴양림 표준데이터·치유의숲 좌표·시설 목록)에 같은 곳이 이름만 달리 들어 있으면 0.7 km 이내를 같은 곳으로 봄
      var dup = kept.some(function (k) { return haversineKm(k, f) < 0.7 || k.name.replace(/\s/g, '') === f.name.replace(/\s/g, ''); });
      if (!dup) kept.push(f);
    });
    res.forests = kept.slice(0, 5);
    var hz = opts.hazards || [];
    var HZ = { wind: '강풍', heat: '폭염', pm25: 'PM2.5 나쁨', rain: '비' };
    var severe = hz.filter(function (h) { return h === 'wind' || h === 'heat' || h === 'pm25'; });
    if (hz.length) {
      res.weather = { hazards: hz, basis: opts.hazardBasis || null, outdoorOk: severe.length === 0,
        note: severe.length
          ? '오늘은 ' + severe.map(function (h) { return HZ[h]; }).join('·') + ' 때문에 공원·산림 등 실외 활동을 권하지 않습니다. 실내에서 쓸 수 있는 디지털치료제(개발 중)나 실내 휴식을 먼저 고려하고, 공원·산림은 날씨가 나아진 뒤 이용하세요.'
          : '비 예상: 공원·산림은 짧게, 미끄럼에 유의하세요.' };
    }
    return res;
  }

  /* 지역 건강 맥락(개인 점수에 넣지 않음) */
  function regionContext(origin, ctx) {
    var rh = ctx.regionHealth && ctx.regionHealth.regions;
    if (!rh || !origin) return null;
    var sido = origin.sido, sg = origin.sigungu;
    if (!sg && origin.lat != null && ctx.sigunguPoints) {
      var best = null, bd = 1e9;
      ctx.sigunguPoints.forEach(function (p) { var d = haversineKm(origin, p); if (d < bd) { bd = d; best = p; } });
      if (best) { sido = best.sido; sg = best.sigungu; }
    }
    if (!sg) return null;
    var key2 = (sido || '').slice(0, 2), hit = null, hitSido = null;
    Object.keys(rh).forEach(function (s) {
      var r = rh[s].sigungu[sg];
      if (!r) return;
      if (!hit || s.slice(0, 2) === key2) { hit = r; hitSido = s; }
    });
    if (!hit) return { sigungu: sg, note: '지역사회건강조사 시군구 값을 찾지 못함' };
    return { sido: hitSido, sigungu: sg, stress: hit.stress, depress: hit.depress,
             sidoStress: rh[hitSido].stress, sidoDepress: rh[hitSido].depress, year: 2025,
             note: '지역사회건강조사 2025 표준화율. 지역 맥락 정보이며 개인 추천 점수에는 쓰지 않음.' };
  }

  /* ---------------------------------------------------------------------
     메인
     --------------------------------------------------------------------- */
  function recommend(input, ctx) {
    input = input || {}; ctx = ctx || {};
    var W = Object.assign({}, PARAMS.weights.value, input.weights || {});
    var wsum = W.effect + W.env + W.access; W.effect /= wsum; W.env /= wsum; W.access /= wsum;
    var safety = safetyCheck(input);
    var profile = buildProfile(input);
    var date = input.date || null;
    var month = input.month || monthOf(date);
    var walk = input.walk || 'normal';
    var origin = input.origin || null;
    if (origin && origin.lat == null && origin.sigungu && ctx.sigunguPoints) {
      var sp = ctx.sigunguPoints.filter(function (p) { return p.sigungu === origin.sigungu && (!origin.sido || p.sido.slice(0, 2) === origin.sido.slice(0, 2)); })[0];
      if (sp) origin = Object.assign({}, origin, { lat: sp.lat, lng: sp.lng, approx: '시군구 대표점(근사)' });
    }
    var protoById = {};
    (ctx.protoForests || []).forEach(function (f) { protoById[f.id] = f; });
    var warnings = [];
    if (!ctx.sites || !ctx.sites.length) warnings.push('시설 목록이 비어 있어 추천할 수 없음');
    if (!ctx.evidence || !ctx.evidence.model) warnings.push('설문 효과모형을 읽지 못함 → 효과 점수는 문헌 사전값만 사용');
    if (!input.envOverride && !(ctx.envToday && ctx.envToday.sites)) warnings.push('예보 스냅샷을 읽지 못함 → 월평균 기후로만 판단');
    Object.keys(input.check || {}).forEach(function (k) {
      var v = input.check[k];
      if (!DOMAINS[k]) warnings.push('알 수 없는 자가점검 항목 무시: ' + k);
      else if (!(v >= 0 && v <= 4)) warnings.push('자가점검 ' + k + ' 값 ' + v + '를 0~4 범위로 고침');
    });
    // 입력 시설 순서가 결과에 영향을 주지 않도록 ID 순으로 고정
    var siteList = (ctx.sites || []).slice().sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });

    var evals = siteList.map(function (site) {
      var proto = site.protoId ? protoById[site.protoId] : null;
      var env = dayEnvironment(site, date, month, ctx, input.envOverride);
      var byDomain = {}, eNum = 0, eW = 0, envUsed = [];
      profile.modeledDomains.forEach(function (d) {
        var e = domainEffect(site, d, month, ctx);
        if (!e) return;
        var sh = envTermShift(d, env.source === 'forecast' || env.source === 'scenario' ? env : null, env.clim, ctx);
        if (sh.used.length) { e = Object.assign({}, e, { pred: e.pred + sh.shift, lo: e.lo + sh.shift, hi: e.hi + sh.shift }); envUsed = envUsed.concat(sh.used); }
        byDomain[d] = e;
        eNum += profile.weights[d] * (-e.pred); eW += profile.weights[d];
      });
      var effectSD = eW > 0 ? eNum / eW : null;
      var basisSet = Object.keys(byDomain).map(function (d) { return byDomain[d].basis; });
      var basis = basisSet.length === 0 ? 'none'
        : basisSet.every(function (b) { return b === 'model'; }) ? 'model'
        : basisSet.some(function (b) { return b === 'model'; }) ? 'mixed'
        : basisSet.some(function (b) { return b === 'similar'; }) ? 'similar' : 'literature';
      if (env.source === 'none') warnings.push(site.name + ': 기상 자료 없음(환경 점수 중립값)');
      var v = envFit(site, profile, env, ctx, proto, walk);
      var a = access(site, origin, input.maxHours, ctx);
      var effScore = effectSD == null ? null : clamp(100 * effectSD / PARAMS.effectScale.value, 0, 100);
      var exclude = [];
      if (!a.eligible) exclude.push('이동시간 ' + a.hours + '시간 > 허용 ' + (input.maxHours || 3) + '시간');
      if (v.hazards.indexOf('wind') >= 0) exclude.push('강풍');
      if (v.hazards.indexOf('heat') >= 0 && !v.indoor) exclude.push('폭염(실내 대체 시설 정보 없음)');
      if (v.hazards.indexOf('pm25') >= 0 && profile.weights.breath >= 0.25 && !v.indoor) exclude.push('호흡기 불편 + PM2.5 나쁨');
      return {
        site: site, proto: proto, env: env, byDomain: byDomain, effectSD: effectSD, effectBasis: basis, envTermsUsed: envUsed,
        scores: { effect: effScore == null ? null : round(effScore, 0), env: round(v.score, 0), access: a.score },
        envDetail: v, access: a, excluded: exclude, eligible: exclude.length === 0,
        tier: (!v.indoor && v.hazards.some(function (h) { return PARAMS.badWeatherIndoorFirst.value.indexOf(h) >= 0; })) ? 1 : 0
      };
    });

    // 종합 점수(효과 근거가 전혀 없으면 환경·접근만으로)
    function total(e, effOverride) {
      var es = effOverride != null ? effOverride : e.scores.effect;
      if (es == null) return (W.env * e.scores.env + W.access * e.scores.access) / (W.env + W.access);
      return W.effect * es + W.env * e.scores.env + W.access * e.scores.access;
    }
    evals.forEach(function (e) { e.total = round(total(e), 1); });

    // 4. 순위 범위(몬테카를로)
    var pool = evals.filter(function (e) { return e.eligible; });
    var rng = mulberry32(input.seed || 20271);
    var N = PARAMS.mcDraws.value, ranks = pool.map(function () { return []; }), totals = pool.map(function () { return []; });
    for (var it = 0; it < N && pool.length; it++) {
      var draws = pool.map(function (e) {
        if (e.effectSD == null) return total(e);
        var num = 0, den = 0;
        Object.keys(e.byDomain).forEach(function (d) {
          var x = e.byDomain[d], sd = Math.max(0.01, (x.hi - x.lo) / 2.563);
          num += profile.weights[d] * -(x.pred + sd * normal(rng)); den += profile.weights[d];
        });
        return total(e, clamp(100 * (num / den) / PARAMS.effectScale.value, 0, 100));
      });
      draws.forEach(function (v, i) { totals[i].push(v); });
      var order = draws.map(function (v, i) { return [v, i]; }).sort(function (a, b) { return pool[a[1]].tier - pool[b[1]].tier || b[0] - a[0] || a[1] - b[1]; });
      order.forEach(function (o, r) { ranks[o[1]].push(r + 1); });
    }
    pool.forEach(function (e, i) {
      e.rankRange = ranks[i].length ? [Math.round(quantile(ranks[i], 0.1)), Math.round(quantile(ranks[i], 0.9))] : null;
      e.totalRange = totals[i].length ? [round(quantile(totals[i], 0.1), 0), round(quantile(totals[i], 0.9), 0)] : null;
    });
    pool.sort(function (a, b) { return a.tier - b.tier || b.total - a.total || (a.site.id < b.site.id ? -1 : 1); });
    pool.forEach(function (e, i) { e.rank = i + 1; });
    var top = pool.slice(0, input.topN || 5);
    top.forEach(function (e) {
      e.programs = pickPrograms(e.proto, profile, walk, e.envDetail.hazards);
      e.links = nearbyLinks(e.site, ctx);
      e.reasons = buildReasons(e, profile);
    });

    var showAlt = input.canVisit === false || top.length === 0 || safety.level === 'urgent';
    // 대체 경로용 출발지 날씨: 시나리오 입력이 있으면 그 값, 없으면 출발지에서 가장 가까운 시설의 방문일 환경으로 근사
    var nearestEval = origin && origin.lat != null ? evals.slice().sort(function (a, b) { return haversineKm(origin, a.site) - haversineKm(origin, b.site); })[0] : null;
    var altHazards = nearestEval ? nearestEval.envDetail.hazards : [];
    var alt = alternatives(origin, ctx, { hazards: altHazards, hazardBasis: input.envOverride ? '화면 시나리오 입력값' : nearestEval ? nearestEval.site.name + ' ' + nearestEval.env.label + ' 근사' : null });
    var notes = [
      '효과 값은 대조군 없는 사전-사후 변화(표준편차 단위)입니다. 인과 효과가 아닙니다.',
      '시설 간 효과 차이에는 그 시설에서 운영된 사업·대상군 구성 차이가 섞여 있습니다. 환경 때문이라고 해석하면 안 됩니다.',
      '효과측정 자료가 없는 시설은 측정기관 중앙값을 똑같이 쓰고 범위를 넓게 둡니다. 효과로는 구분되지 않으며 환경·접근으로 순위가 정해집니다.',
      '수면·호흡기 목적은 결과 척도가 없어 효과를 계산하지 않고, 환경 노출(대기질·피톤치드·수관 피복)만 반영합니다(근거 수준 낮음).',
      '환경 적합·접근 점수의 계수는 대부분 시연값입니다(PARAMS 참조).',
      '종합 점수 범위와 순위 범위는 효과 구간만 반영한 10~90% 범위입니다. 환경·접근 계수의 불확실성은 들어 있지 않습니다.'
    ].concat(envTermAudit(ctx) ? [envTermAudit(ctx).note] : []).concat((ctx.evidence && ctx.evidence.model && ctx.evidence.model.notes) || []);

    var em = ctx.evidence && ctx.evidence.model;
    var config = {
      engine: VERSION, seed: input.seed || 20271, mcDraws: N, paramsHash: hashStr(JSON.stringify(PARAMS)),
      weights: W,
      data: {
        effectModel: em ? { version: em.version, fitted_at: em.fitted_at, n_rows: em.n_rows } : null,
        evidenceBuilt: ctx.evidence && ctx.evidence._meta ? ctx.evidence._meta.built : null,
        facilityEnvBuilt: ctx.facilityEnv && ctx.facilityEnv._meta ? ctx.facilityEnv._meta.built : null,
        envToday: ctx.envToday ? { generated_at: ctx.envToday.generated_at, forecast_base: ctx.envToday.forecast_base } : null,
        nSites: siteList.length, nParks: ctx.parks ? ctx.parks.length : null, nForests: ctx.forests ? ctx.forests.length : null
      },
      envSource: input.envOverride ? 'scenario' : 'forecast/climate'
    };
    return {
      version: VERSION,
      config: config,
      warnings: warnings,
      evidenceAudit: { envTerms: envTermAudit(ctx) },
      input: { purpose: input.purpose, walk: walk, maxHours: input.maxHours || 3, canVisit: input.canVisit !== false, month: month, date: date,
               origin: origin ? { approx: origin.approx || null, region: origin.region || null, sigungu: origin.sigungu || null } : null },
      weights: W, safety: safety, profile: profile,
      context: { region: regionContext(origin, ctx) },
      recommendations: top,
      others: pool.slice(top.length).map(function (e) { return { id: e.site.id, name: e.site.name, total: e.total, rank: e.rank }; }),
      excluded: evals.filter(function (e) { return !e.eligible; }).map(function (e) { return { id: e.site.id, name: e.site.name, reasons: e.excluded, access: e.access }; }),
      alternatives: Object.assign(alt, { prominent: showAlt }),
      notes: notes,
      params: PARAMS
    };
  }

  function hashStr(str) {   // 설정 변경 추적용 짧은 해시(FNV-1a 32bit)
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  }

  function buildReasons(e, profile) {
    var out = [];
    var dl = Object.keys(e.byDomain);
    if (dl.length) {
      var parts = dl.map(function (d) {
        var x = e.byDomain[d];
        return DOMAINS[d].label + ' ' + x.pred.toFixed(2) + ' SD(' + x.lo.toFixed(2) + '~' + x.hi.toFixed(2) + ')' + (x.supported ? '' : ' 외삽');
      });
      out.push({ model: '설문 효과모형 예측: ', mixed: '효과모형 예측(일부 영역 추정): ', similar: '측정기관 중앙값으로 추정(이 시설 자료 없음): ', literature: '문헌(메타분석) 사전값: ' }[e.effectBasis] + parts.join(', '));
    }
    if (profile.literatureOnlyDomains.length) out.push(profile.literatureOnlyDomains.map(function (d) { return DOMAINS[d].label; }).join('·') + '는 효과 자료가 없어 환경 노출만 반영');
    out.push('방문일 환경: ' + e.env.label);
    var badW = e.envDetail.hazards.filter(function (h) { return PARAMS.badWeatherIndoorFirst.value.indexOf(h) >= 0; });
    if (badW.length) out.push(e.tier === 0 ? '나쁜 날씨(' + badW.join('·') + '): 실내 대체 시설이 있어 앞 순위로 둠' : '나쁜 날씨(' + badW.join('·') + '): 실내 대체 시설 정보가 없어 실내 시설 다음 순위로 둠');
    e.envDetail.notes.forEach(function (n) { out.push(n); });
    e.envDetail.basis.forEach(function (n) { out.push(n); });
    e.envTermsUsed.forEach(function (n) { out.push('효과모형 환경항 반영: ' + n); });
    if (e.access.hours != null) out.push('이동 약 ' + e.access.hours + '시간(' + e.access.how + ')');
    return out;
  }

  return {
    version: VERSION, PARAMS: PARAMS, DOMAINS: DOMAINS, CONTACTS: CONTACTS,
    recommend: recommend, safetyCheck: safetyCheck, buildProfile: buildProfile,
    alternatives: alternatives, haversineKm: haversineKm
  };
}));
