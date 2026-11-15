/* =========================================================================
   숲결 (Soopgyeol) — app.js
   4축(기상환경 × 지역환경 × 임상도 × 치유목적) 가중합 추천 엔진 + UI
   ========================================================================= */
(function () {
  'use strict';

  /* ───────────── 상태 ───────────── */
  const state = {
    region: '수도권',
    purpose: 'stress',
    walk: 'normal',
    env: { temp: 19, humidity: 50, pm: 'good', rain: false, wind: 2 },
    scenario: 'clear',
    weights: { weather: 32, region: 18, stand: 22, purpose: 28 },
    results: [],
    prevRank: {},
    selectedId: null,
    weightsTouched: false
  };

  const TOP_N = 5;
  const LAPSE = 0.6;           // ℃ / 100m
  const LAPSE_EFF = 0.85;      // 숲 내부 체감 보정

  /* ───────────── 유틸 ───────────── */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const round = (v) => Math.round(v);
  const el = (sel, root) => (root || document).querySelector(sel);
  const els = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function signed(n) { return (n > 0 ? '+' : '') + n; }
  /* 축별 점수 분포 확장: 높은 구간에 몰린 값을 0~100 전 구간으로 펼쳐 순위 차이를 드러낸다 */
  function expand(x, power) { return clamp(100 * Math.pow(clamp(x, 0, 100) / 100, power), 0, 100); }

  function effectiveTemp(f) {
    return state.env.temp - (f.elevation.base / 100) * LAPSE * LAPSE_EFF;
  }

  /* =======================================================================
     1. 4축 점수 계산
     ======================================================================= */

  /* 1-1 기상적합도 */
  function weatherScore(f) {
    const env = state.env;
    const effTemp = effectiveTemp(f);

    // 열쾌적성 (18~23℃ 구간 중심 21℃)
    let comfort = 100 - Math.abs(effTemp - 21) * 4.2;
    if (effTemp > 26) comfort -= (effTemp - 26) * 3.0;
    if (effTemp < 5) comfort -= (5 - effTemp) * 2.2;
    comfort = clamp(comfort, 5, 100);

    // 습도 (55% 중심, 78% 이상 다습 가중)
    let humid = 100 - Math.abs(env.humidity - 55) * 1.2;
    if (env.humidity >= 78) humid -= (env.humidity - 78) * 2.5;
    humid = clamp(humid, 8, 100);

    // 미세먼지
    let dust = { good: 100, normal: 72, bad: 28 }[env.pm];
    if (env.pm === 'bad') {
      const indoorCount = f.programs.filter((p) => p.setting !== '실외').length;
      dust += indoorCount >= 2 ? 10 : 4;
      if (f.canopy === '상') dust += 4;
      dust = clamp(dust, 10, 70);
    }

    // 강수 · 강풍 → 숲의 실내 대체 역량
    let rain = 100;
    if (env.rain) {
      rain = f.shelter;
      rain -= Math.min(24, Math.max(0, env.wind - 4) * 3);
      rain = clamp(rain, 5, 100);
    } else if (env.wind >= 8) {
      rain = clamp(100 - (env.wind - 7) * 5, 40, 100);
    }

    const raw =
      comfort * 0.40 + humid * 0.14 + dust * 0.26 + rain * 0.20;

    return { score: expand(raw, 1.6), raw, comfort, humid, dust, rain, effTemp };
  }

  /* 1-2 지역환경 */
  const TERRAIN_FIT = {
    barrier: { '완만': 96, '보통': 74, '산악': 46 },
    normal: { '완만': 88, '보통': 94, '산악': 72 },
    trek: { '완만': 68, '보통': 90, '산악': 97 }
  };

  function regionScore(f) {
    const hours = (TRAVEL_HOURS[state.region] || {})[f.region] ?? 3.0;
    let dist = 100 - Math.max(0, hours - 0.5) * 15.5;
    if (f.access === '근교형') dist += 2;
    if (f.access === '도심형') dist += 4;
    dist = clamp(dist, 8, 100);

    let terrain = TERRAIN_FIT[state.walk][f.terrain] ?? 80;
    if (state.walk === 'barrier' && f.barrierFree) terrain += 6;
    if (state.walk === 'barrier' && !f.barrierFree) terrain -= 10;
    terrain = clamp(terrain, 5, 100);

    let elev;
    if (state.walk === 'barrier') {
      elev = 100 - Math.max(0, f.elevation.base - 250) / 5;
      if (f.elevation.base > 700) elev -= 12;
    } else if (state.walk === 'trek') {
      elev = 70 + Math.min(28, f.elevation.base / 35);
    } else {
      elev = 96 - Math.abs(f.elevation.base - 350) / 12;
    }
    elev = clamp(elev, 8, 100);

    const raw = clamp(dist * 0.60 + terrain * 0.25 + elev * 0.15, 0, 100);
    return { score: expand(raw, 1.25), raw, dist, terrain, elev, hours };
  }

  /* 1-3 임상도 매칭 */
  const TYPE_AFFINITY = {
    stress: { '활엽수림': 90, '혼효림': 94, '침엽수림': 84 },
    sleep: { '활엽수림': 82, '혼효림': 88, '침엽수림': 92 },
    respiratory: { '활엽수림': 76, '혼효림': 88, '침엽수림': 96 },
    family: { '활엽수림': 86, '혼효림': 90, '침엽수림': 84 },
    vitality: { '활엽수림': 84, '혼효림': 90, '침엽수림': 86 }
  };

  function standScore(f) {
    const aff = TYPE_AFFINITY[state.purpose][f.forestType] ?? 85;
    // 친화도 행렬(76~96)을 45~85 구간으로 펼쳐 변별력을 확보
    let s = 45 + (aff - 76) * 2.0;

    // 수종 인자 가중
    const pw = PURPOSES[state.purpose].factors;
    let factorBonus = 0;
    f.factors.forEach((fac) => { factorBonus += pw[fac] || 0; });
    factorBonus = Math.min(12, factorBonus * 0.35);
    s += factorBonus;

    // 영급
    if (/VI|90년|60년|70년/.test(f.ageClass)) s += 4;
    else if (/V/.test(f.ageClass)) s += 2;
    else if (/III/.test(f.ageClass)) s -= 3;

    // 수관울폐도
    if (f.canopy === '상') s += 2;

    // 여름 고온 시 차광 가점
    if (state.env.temp >= 27 && f.factors.includes('차광')) s += 3;

    return { score: clamp(s, 25, 97), aff, factorBonus };
  }

  /* 1-4 목적 적합도 */
  function purposeScore(f) {
    const curated = f.purpose[state.purpose] ?? 80;
    // 큐레이션 값(78~94)을 40~80 구간으로 펼침
    let base = 40 + (curated - 78) * 2.5;
    const tagCount = f.programs.filter((p) => p.tags.includes(state.purpose)).length;
    const bonus = Math.min(8, tagCount * 3);
    // 보행 선호 정합성
    let walkBonus = 0;
    if (state.walk === 'barrier') walkBonus = f.programs.some((p) => p.difficulty === '낮음') ? 2 : -2;
    if (state.walk === 'trek') walkBonus = f.programs.some((p) => p.difficulty === '보통') ? 2 : 0;
    return { score: clamp(base + bonus + walkBonus, 25, 96), curated, tagCount, bonus };
  }

  /* 1-5 종합 */
  function evaluate(f) {
    const w = weatherScore(f);
    const r = regionScore(f);
    const s = standScore(f);
    const p = purposeScore(f);

    const W = state.weights;
    const sum = W.weather + W.region + W.stand + W.purpose || 1;
    const total =
      (w.score * W.weather + r.score * W.region + s.score * W.stand + p.score * W.purpose) / sum;

    return {
      forest: f,
      weather: w, region: r, stand: s, purpose: p,
      total: clamp(total, 0, 100)
    };
  }

  function computeAll() {
    const scored = FORESTS.map(evaluate).sort((a, b) => b.total - a.total);
    const prev = state.prevRank;
    scored.forEach((r, i) => {
      r.rank = i + 1;
      r.delta = prev[r.forest.id] ? prev[r.forest.id] - (i + 1) : 0;
    });
    state.results = scored;
    state.prevRank = {};
    scored.forEach((r) => { state.prevRank[r.forest.id] = r.rank; });
    return scored;
  }

  /* =======================================================================
     2. 프로그램 매칭 (기상 악화 시 실내 전환)
     ======================================================================= */
  function pickPrograms(f, purpose, walk) {
    const env = state.env;
    const bad = env.rain || env.pm === 'bad';
    const hot = effectiveTemp(f) >= 28;

    const scored = f.programs.map((p) => {
      let s = 0;
      if (p.tags.includes(purpose)) s += 5;
      if (walk === 'barrier') s += p.difficulty === '낮음' ? 4 : p.difficulty === '보통' ? -3 : -9;
      if (walk === 'normal') s += p.difficulty === '낮음' ? 2 : p.difficulty === '보통' ? 3 : -1;
      if (walk === 'trek') s += p.difficulty === '보통' ? 3 : p.difficulty === '낮음' ? 1 : 2;
      if (bad) s += p.setting === '실내' ? 7 : p.setting === '실내외' ? 2 : -7;
      if (hot && p.setting === '실외') s -= 2;
      return { p, s };
    }).sort((a, b) => b.s - a.s);

    let items = scored.slice(0, 2).map((x) => x.p);

    // 기상 악화인데 실내 프로그램이 하나도 없으면 강제 교체
    let forcedIndoor = null;
    if (bad && !items.some((p) => p.setting !== '실외')) {
      const indoor = f.programs
        .filter((p) => p.setting !== '실외')
        .sort((a, b) => (b.tags.includes(purpose) ? 1 : 0) - (a.tags.includes(purpose) ? 1 : 0))[0];
      if (indoor) {
        forcedIndoor = indoor;
        items = [items[0], indoor];
      }
    }

    return {
      items,
      switched: bad,
      forcedIndoor,
      headline: bad
        ? (env.rain ? '강수·강풍으로 실내·저강도 프로그램 우선 편성' : 'PM2.5 나쁨으로 실내·저강도 프로그램 우선 편성')
        : (hot ? '고온으로 그늘·실내 휴식 비중을 높인 편성' : null)
    };
  }

  /* =======================================================================
     3. 추천 근거 문장 생성
     ======================================================================= */
  function buildReasons(r, prog) {
    const f = r.forest;
    const env = state.env;
    const out = [];
    const eff = r.weather.effTemp;
    const dTemp = env.temp - eff;
    const purposeLabel = PURPOSES[state.purpose].label;

    // ① 기상
    if (dTemp >= 1.2) {
      let ctxText;
      if (env.temp >= 27) {
        ctxText = `고온 시나리오에서도 열쾌적성이 <b>${round(r.weather.comfort)}점</b>으로 유지됩니다.`;
      } else if (eff <= 10) {
        ctxText = `한기가 느껴질 수 있어 방한 준비가 필요합니다.`;
      } else {
        ctxText = `표고 덕에 걸을 때 땀이 덜 나는 온도이며, 수관울폐도 <b>${f.canopy}</b>가 한낮 햇볕을 가려 줍니다.`;
      }
      out.push(`<b>${f.elevation.range}</b>의 ${f.short} 자락이라 숲 체감기온이 <b>${eff.toFixed(1)}℃</b>로, 입력한 ${env.temp}℃보다 <b>${dTemp.toFixed(1)}℃</b> 낮습니다. ${ctxText}`);
    } else if (env.temp >= 27) {
      out.push(`기온 ${env.temp}℃·습도 ${env.humidity}% 조건에서 표고 보정 체감기온 <b>${eff.toFixed(1)}℃</b>, 수관울폐도 <b>${f.canopy}</b>로 한낮 직사광선을 가려 열쾌적성 <b>${round(r.weather.comfort)}점</b>입니다.`);
    } else {
      out.push(`기온 ${env.temp}℃·습도 ${env.humidity}%가 열쾌적 구간(18~23℃)에 가까워 기상적합도 <b>${round(r.weather.score)}점</b>입니다.`);
    }

    // ② 대기·강수
    if (env.pm === 'bad') {
      out.push(`PM2.5 <b>나쁨</b> 조건에서 <b>${f.indoorFacilities}</b> 등 실내 대체 동선이 확보되어 있어, 장시간 실외 노출 없이 치유 활동을 이어갈 수 있습니다(대기 점수 ${round(r.weather.dust)}점).`);
    } else if (env.rain) {
      out.push(`강수·강풍 시나리오에서 실내 대체 역량 <b>${f.shelter}점</b>(${f.indoorFacilities})으로, 숲길이 통제되어도 프로그램을 운영할 수 있는 숲입니다.`);
    } else if (env.pm === 'good') {
      out.push(`PM2.5 <b>좋음</b>·강수 없음 조건이라 실외 숲길을 온전히 활용할 수 있습니다.`);
    }

    // ③ 임상도
    const top3 = f.species.slice(0, 3).map((s) => `${s.name} ${s.pct}%`).join(' · ');
    const mainFactors = f.factors.slice(0, 3).join('·');
    out.push(`주임상 <b>${f.forestType}</b>(${top3}) ${f.ageClass}, 수관울폐도 <b>${f.canopy}</b> — ${mainFactors} 인자가 ${purposeLabel} 목적과 맞물려 임상도 매칭 <b>${round(r.stand.score)}점</b>입니다.`);

    // ④ 지역환경
    const h = r.region.hours;
    out.push(`${state.region} 출발 편도 약 <b>${h}시간</b>, 지형 <b>${f.terrain}</b>·${WALK_PREFS[state.walk].label} 조건 적합도 ${round(r.region.terrain)}점${f.barrierFree ? `, <b>무장애 데크로드</b>(${f.barrierNote}) 보유` : ''}.`);

    // ⑤ 프로그램 전환
    if (prog.switched && prog.items[0]) {
      const first = prog.items[0];
      const alt = first.setting === '실외' && first.indoorAlt ? ` (우천 시 ‘${first.indoorAlt}’로 대체)` : '';
      out.push(`기상 조건에 따라 <b>${first.name}</b>${alt}을 우선 편성했습니다 — ${prog.headline}.`);
    } else if (prog.items[0]) {
      out.push(`입력 조건에서 가장 적합한 프로그램은 <b>${prog.items[0].name}</b>(${prog.items[0].minutes}분·난이도 ${prog.items[0].difficulty})입니다.`);
    }

    return out;
  }

  /* =======================================================================
     4. 렌더링 — 입력 패널
     ======================================================================= */
  function renderControls() {
    // 지역
    const rg = el('#region-group');
    rg.innerHTML = REGIONS.map((r) =>
      `<button class="seg-btn" role="radio" data-region="${r}" aria-checked="${state.region === r}">${r}</button>`
    ).join('');

    // 목적
    el('#purpose-group').innerHTML = Object.values(PURPOSES).map((p) =>
      `<button class="opt" role="radio" data-purpose="${p.key}" aria-checked="${state.purpose === p.key}">
        <span class="ico" aria-hidden="true">${p.icon}</span>
        <span class="txt"><b>${p.label}</b><small>${p.desc}</small></span>
      </button>`
    ).join('');

    // 보행
    el('#walk-group').innerHTML = Object.values(WALK_PREFS).map((w) =>
      `<button class="chip" role="radio" data-walk="${w.key}" aria-checked="${state.walk === w.key}" title="${w.label} · ${w.desc}">${w.icon} ${w.short}</button>`
    ).join('');

    // PM
    el('#pm-group').innerHTML = Object.values(PM_LEVELS).map((p) =>
      `<button class="seg-btn" role="radio" data-pm="${p.key}" aria-checked="${state.env.pm === p.key}" title="${p.value}">${p.label}</button>`
    ).join('');

    // 프리셋
    el('#preset-group').innerHTML = Object.values(SCENARIOS).map((s) =>
      `<button class="preset" data-scenario="${s.key}" aria-pressed="${state.scenario === s.key}">
        <span class="p-ico" aria-hidden="true">${s.icon}</span>
        <span class="p-label">${s.label}</span>
        <span class="p-sub">${s.sub}</span>
      </button>`
    ).join('');
  }

  function syncEnvInputs() {
    el('#temp').value = state.env.temp;
    el('#humidity').value = state.env.humidity;
    el('#temp-out').textContent = state.env.temp + '℃';
    el('#humidity-out').textContent = state.env.humidity + '%';
    el('#rain').checked = state.env.rain;
    el('#wind-on').checked = state.env.wind >= 7;
    els('#pm-group .seg-btn').forEach((b) =>
      b.setAttribute('aria-checked', String(b.dataset.pm === state.env.pm)));
    els('#preset-group .preset').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.scenario === state.scenario)));
    els('#region-group .seg-btn').forEach((b) =>
      b.setAttribute('aria-checked', String(b.dataset.region === state.region)));
    els('#purpose-group .opt').forEach((b) =>
      b.setAttribute('aria-checked', String(b.dataset.purpose === state.purpose)));
    els('#walk-group .chip').forEach((b) =>
      b.setAttribute('aria-checked', String(b.dataset.walk === state.walk)));

    // 레인지 채움 표시
    fillRange('#temp');
    fillRange('#humidity');
    fillRange('#wt-weather');
    fillRange('#wt-region');
    fillRange('#wt-stand');
    fillRange('#wt-purpose');

    // readout
    const pm = PM_LEVELS[state.env.pm];
    const avgEff = FORESTS.reduce((a, f) => a + effectiveTemp(f), 0) / FORESTS.length;
    el('#env-readout').innerHTML =
      `<span><b>${state.env.temp}℃</b> / <b>${state.env.humidity}%</b></span>` +
      `<span>PM2.5 <b class="${state.env.pm === 'bad' ? 'warn' : ''}">${pm.label}</b></span>` +
      `<span>${state.env.rain ? '<b class="warn">강수</b>' : '강수 없음'}·풍속 <b>${state.env.wind}m/s</b></span>` +
      `<span>평균 표고 보정 체감 <b>${avgEff.toFixed(1)}℃</b></span>`;
  }

  function fillRange(sel) {
    const input = el(sel);
    if (!input) return;
    const min = Number(input.min), max = Number(input.max), v = Number(input.value);
    const p = ((v - min) / (max - min)) * 100;
    input.style.background = `linear-gradient(90deg, var(--green-2) ${p}%, var(--line-soft) ${p}%)`;
  }

  /* =======================================================================
     5. 렌더링 — 결과 카드
     ======================================================================= */
  function bar(label, value) {
    return `<div class="bar-row">
      <span class="bar-label">${label}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${clamp(value, 0, 100)}%"></span></span>
      <span class="bar-val">${round(value)}</span>
    </div>`;
  }

  function settingBadge(setting) {
    const map = { '실외': 'out', '실내': 'in', '실내외': 'mix' };
    return `<span class="p-badge ${map[setting] || ''}">${setting}</span>`;
  }

  function cardHTML(r, animate) {
    const f = r.forest;
    const prog = pickPrograms(f, state.purpose, state.walk);
    const reasons = buildReasons(r, prog);
    const deltaCls = r.delta > 0 ? 'up' : r.delta < 0 ? 'down' : 'same';
    const deltaTxt = r.delta > 0 ? `▲ ${r.delta}` : r.delta < 0 ? `▼ ${Math.abs(r.delta)}` : '–';

    const tags = [
      `<span class="tag env">${f.region} · ${f.sigungu}</span>`,
      `<span class="tag stand">${f.forestType}</span>`,
      ...f.species.slice(0, 2).map((s) => `<span class="tag stand">${s.name} ${s.pct}%</span>`),
      `<span class="tag">${f.ageClass}</span>`,
      `<span class="tag">${f.elevation.range}</span>`,
      f.barrierFree ? `<span class="tag env">무장애 데크</span>` : ''
    ].filter(Boolean).join('');

    const progHTML = prog.items.map((p, i) => {
      const isAlt = prog.switched && p.setting === '실외' && p.indoorAlt;
      const showSwitch = prog.switched && i === 0 && p.setting !== '실외';
      return `<div class="prog">
        <div class="prog-main">
          <div class="prog-name">${p.name}
            ${showSwitch ? '<span class="p-badge switch">실내 전환</span>' : ''}
            ${isAlt ? `<span class="p-badge switch">→ ${p.indoorAlt}</span>` : ''}
          </div>
          <div class="prog-desc">${p.activities}</div>
        </div>
        <div class="prog-meta">
          ${settingBadge(p.setting)}
          <span class="p-badge">${p.minutes}분</span>
          <span class="p-badge">난이도 ${p.difficulty}</span>
          <span class="p-badge">${p.target}</span>
        </div>
      </div>`;
    }).join('');

    return `<article class="forest-card ${r.rank === 1 ? 'top-1' : ''} ${animate ? 'anim' : ''}" id="card-${f.id}" data-id="${f.id}">
      <div class="rank-col">
        <span class="rank-label">RANK</span>
        <span class="rank-num">${String(r.rank).padStart(2, '0')}</span>
        <span class="rank-delta ${deltaCls}" title="직전 조건 대비 순위 변동">${deltaTxt}</span>
        <div class="score-ring" style="--p:${r.total}">
          <b>${round(r.total)}<i>%</i></b>
        </div>
      </div>
      <div class="card-body">
        <div class="card-top">
          <div>
            <h3 class="card-title">${f.name}</h3>
            <p class="card-sub">
              <span class="badge ${f.operator === '국립' ? 'national' : 'public'}">${f.operator}</span>
              <span>${f.sido} ${f.sigungu}</span>
              <span>·</span>
              <span>${f.org}</span>
            </p>
          </div>
          <div class="card-actions">
            <button class="mini-btn" data-focus="${f.id}">지도에서 보기</button>
            <button class="mini-btn primary" data-detail="${f.id}">상세 보기</button>
          </div>
        </div>
        <div class="tags">${tags}</div>
        <div class="bars">
          ${bar('기상적합도', r.weather.score)}
          ${bar('지역환경', r.region.score)}
          ${bar('임상도 매칭', r.stand.score)}
          ${bar('목적 적합도', r.purpose.score)}
        </div>
        <div class="prog-list">${progHTML}</div>
        <div class="reason">
          <h4>🌱 왜 이곳이 추천되었나요?</h4>
          <ul>${reasons.map((t) => `<li>${t}</li>`).join('')}</ul>
        </div>
      </div>
    </article>`;
  }

  function renderRail() {
    const env = state.env;
    el('#rail-cond').innerHTML =
      `${state.region} 출발 · <b>${PURPOSES[state.purpose].label}</b><br />` +
      `${env.temp}℃ · 습도 ${env.humidity}% · PM2.5 ${PM_LEVELS[env.pm].label}${env.rain ? ' · 강수' : ''}`;
    el('#rail-list').innerHTML = state.results.slice(0, TOP_N).map((r) => {
      const d = r.delta > 0 ? `<span class="ri-delta up">▲${r.delta}</span>`
        : r.delta < 0 ? `<span class="ri-delta down">▼${Math.abs(r.delta)}</span>` : '';
      return `<li><button class="rail-item" data-goto="${r.forest.id}" title="${r.forest.name}">
        <span class="ri-rank">${String(r.rank).padStart(2, '0')}</span>
        <span class="ri-name">${r.forest.short}</span>${d}
        <span class="ri-score">${round(r.total)}</span>
      </button></li>`;
    }).join('');
  }

  function renderResults(animate) {
    const top = state.results.slice(0, TOP_N);
    el('#result-count').textContent = `TOP ${Math.min(TOP_N, top.length)}`;

    const first = top[0], last = top[top.length - 1];
    el('#summary').innerHTML =
      `<b>${state.region}</b> 출발 · <b>${PURPOSES[state.purpose].label}</b> · <b>${WALK_PREFS[state.walk].label}</b> · ` +
      `${state.env.temp}℃/${state.env.humidity}%/PM2.5 ${PM_LEVELS[state.env.pm].label}${state.env.rain ? '·강수' : ''} 조건으로 ` +
      `${FORESTS.length}곳을 평가했습니다. 1위 <b>${first.forest.short}</b> ${round(first.total)}점, ` +
      `${top.length}위 <b>${last.forest.short}</b> ${round(last.total)}점 (차이 ${round(first.total - last.total)}점).`;

    el('#results').innerHTML = top.map((r) => cardHTML(r, animate)).join('');
  }

  /* =======================================================================
     6. 지도
     ======================================================================= */
  let map = null;
  let markerLayer = null;
  const markers = {};

  function initMap() {
    const container = el('#map');
    if (typeof L === 'undefined') {
      renderMapFallback();
      return;
    }
    map = L.map(container, {
      center: [36.1, 127.8],
      zoom: 7,
      scrollWheelZoom: false,
      zoomControl: false,
      attributionControl: true
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
    fitKorea();
  }

  function fitKorea() {
    if (!map) return;
    const bounds = L.latLngBounds(FORESTS.map((f) => [f.lat, f.lng]));
    map.fitBounds(bounds, { padding: [26, 26] });
    // 제주~강원 전 구간을 한 화면에 두되, 너무 축소되어 반도가 작아지지 않게 하한 줌을 둔다
    if (map.getZoom() < 6.3) map.setView(bounds.getCenter(), 6.3);
  }

  function pinIcon(rank, isTop) {
    if (!isTop) return L.divIcon({ className: 'pin-wrap', html: '<span class="pin rest"><span></span></span>', iconSize: [14, 14], iconAnchor: [7, 7] });
    const cls = rank <= 3 ? `pin rank-${rank}` : 'pin';
    const small = window.innerWidth < 700;
    const size = small ? 24 : 30;
    return L.divIcon({
      className: 'pin-wrap',
      html: `<span class="${cls}"><span>${rank}</span></span>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size - 3],
      popupAnchor: [0, -22]
    });
  }

  function renderMap() {
    if (!map) return;
    markerLayer.clearLayers();
    Object.keys(markers).forEach((k) => delete markers[k]);

    state.results.forEach((r) => {
      const f = r.forest;
      const isTop = r.rank <= TOP_N;
      const m = L.marker([f.lat, f.lng], {
        icon: pinIcon(r.rank, isTop),
        zIndexOffset: isTop ? 1000 - r.rank : 0,
        title: `${f.name} (${round(r.total)}점)`
      });
      if (isTop) {
        const prog = pickPrograms(f, state.purpose, state.walk);
        m.bindPopup(
          `<div class="pop-name">${r.rank}위 · ${f.name}</div>
           <div class="pop-meta">${f.sido} ${f.sigungu} · 종합 <span class="pop-score">${round(r.total)}점</span></div>
           <div class="pop-meta">추천 프로그램: ${prog.items[0] ? prog.items[0].name : '-'}</div>
           <div class="pop-actions">
             <button class="pop-btn" onclick="window.__focusForest('${f.id}', false)">카드에서 보기</button>
             <button class="pop-btn ghost" onclick="window.__focusForest('${f.id}', true)">상세 보기</button>
           </div>`
        );
      }
      m.on('click', () => { if (!isTop) window.__focusForest(f.id, true); });
      m.addTo(markerLayer);
      markers[f.id] = m;
    });
  }

  function renderMapFallback() {
    const box = el('#map');
    box.innerHTML = `<div class="map-fallback">
      <span class="fb-note">지도 라이브러리를 불러오지 못해 좌표 기반 간이 지도로 표시합니다.</span>
      ${FORESTS.map((f) => {
        const r = state.results.find((x) => x.forest.id === f.id) || { rank: 99, total: 0 };
        const isTop = r.rank <= TOP_N;
        const x = ((f.lng - 125.6) / (129.6 - 125.6)) * 100;
        const y = ((38.4 - f.lat) / (38.4 - 33.1)) * 100;
        return `<span class="fb-dot ${isTop ? 'top' : ''}" style="left:${x}%;top:${y}%" title="${f.name}">${isTop ? r.rank : ''}</span>`;
      }).join('')}
    </div>`;
  }

  function focusForest(id, openDetail) {
    const card = el('#card-' + id);
    if (card) {
      els('.forest-card').forEach((c) => c.classList.remove('is-active'));
      card.classList.add('is-active');
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => card.classList.remove('is-active'), 2600);
    }
    if (markers[id] && map) {
      map.setView(markers[id].getLatLng(), Math.max(map.getZoom(), 8), { animate: true });
    }
    if (openDetail) openDetailModal(id);
  }
  window.__focusForest = focusForest;

  /* =======================================================================
     7. 상세 모달
     ======================================================================= */
  function weatherNotesHTML(f) {
    const env = state.env;
    const eff = effectiveTemp(f);
    const notes = [];

    if (env.temp >= 26) {
      notes.push(`<div class="wnote hot"><b>고온 시</b>체감 ${eff.toFixed(1)}℃ · 수관울폐도 ${f.canopy}의 차광과 계곡·실내 휴식 동선을 활용하세요. 한낮(12~15시) 장거리 코스는 피하는 것이 좋습니다.</div>`);
    } else if (eff <= 8) {
      notes.push(`<div class="wnote"><b>저온 시</b>숲 체감 ${eff.toFixed(1)}℃로 도심보다 낮습니다. 방한복과 장갑을 준비하고, 데크로드 결빙 구간을 확인하세요.</div>`);
    } else {
      notes.push(`<div class="wnote"><b>활동 적정</b>숲 체감 ${eff.toFixed(1)}℃로 걷기·명상에 적정한 기온입니다. 1~2시간 숲길 활동에 적합합니다.</div>`);
    }

    if (env.pm === 'bad') {
      notes.push(`<div class="wnote dust"><b>미세먼지 나쁨</b>${f.indoorFacilities} 중심으로 실내 프로그램을 선택하고, 실외 활동은 1시간 이내로 줄이세요. 마스크(KF80 이상)를 준비하세요.</div>`);
    } else if (env.rain) {
      notes.push(`<div class="wnote rain"><b>강수·강풍</b>실내 대체 역량 ${f.shelter}점. 데크 미끄럼·낙엽 미끄러짐에 유의하고, 실내 프로그램(${f.programs.filter((p) => p.setting !== '실외').map((p) => p.name).join(', ') || '운영 여부 확인'})으로 전환하세요.</div>`);
    } else {
      notes.push(`<div class="wnote"><b>건조·화기</b>습도 ${env.humidity}%. 목재 데크와 낙엽이 많은 구간에서는 취사·화기 사용이 금지되며, 수분 섭취를 자주 하세요.</div>`);
    }
    return notes.join('');
  }

  function openDetailModal(id) {
    const r = state.results.find((x) => x.forest.id === id);
    if (!r) return;
    const f = r.forest;
    const prog = pickPrograms(f, state.purpose, state.walk);
    const reasons = buildReasons(r, prog);

    const speciesHTML = f.species.map((s) =>
      `<div class="species-row">
        <span>${s.name}</span>
        <span class="species-track"><span class="species-fill" style="width:${s.pct}%"></span></span>
        <span class="species-val">${s.pct}%</span>
      </div>`).join('');

    const programsHTML = f.programs.map((p) => `
      <div class="prog-item">
        <div class="pi-top">
          <span class="pi-name">${p.name}</span>
          <span class="pi-meta">${settingBadge(p.setting)}<span>${p.minutes}분</span><span>난이도 ${p.difficulty}</span><span>${p.target}</span></span>
        </div>
        <div class="pi-act">${p.activities}</div>
        ${p.indoorAlt ? `<div class="pi-alt">↳ 기상 악화 시 대체: ${p.indoorAlt}</div>` : ''}
      </div>`).join('');

    el('#detail-body').innerHTML = `
      <div class="detail-hero">
        <div>
          <p class="eyebrow">${f.region} · ${f.operator} · ${f.org}</p>
          <h2 id="detail-title">${f.name}</h2>
          <p class="addr">${f.address} · ${f.phone}</p>
          <div class="tags" style="margin-top:8px">
            <span class="tag env">${f.elevation.range}</span>
            <span class="tag env">${f.terrain} 지형</span>
            <span class="tag env">${f.access}</span>
            <span class="tag stand">${f.forestType}</span>
            ${f.barrierFree ? '<span class="tag env">무장애 데크로드</span>' : ''}
          </div>
        </div>
        <div class="detail-score">
          <b>${round(r.total)}<span>점</span></b>
          <span>종합 적합도 · ${r.rank}위</span>
        </div>
      </div>

      <div class="bars" style="margin:4px 0 6px">
        ${bar('기상적합도', r.weather.score)}
        ${bar('지역환경', r.region.score)}
        ${bar('임상도 매칭', r.stand.score)}
        ${bar('목적 적합도', r.purpose.score)}
      </div>

      <div class="detail-facts">
        <dl class="fact"><dt>운영 주체</dt><dd>${f.operator} · ${f.org}</dd></dl>
        <dl class="fact"><dt>면적</dt><dd>${f.area}</dd></dl>
        <dl class="fact"><dt>표고 / 지형</dt><dd>${f.elevation.base}m · ${f.terrain}</dd></dl>
        <dl class="fact"><dt>접근성</dt><dd>${f.access} · ${state.region}에서 ${r.region.hours}시간</dd></dl>
        <dl class="fact"><dt>운영 시기</dt><dd>${f.seasons}</dd></dl>
        <dl class="fact"><dt>실내 시설</dt><dd>${f.indoorFacilities}</dd></dl>
      </div>

      <p style="font-size:12.6px;color:var(--ink-soft);line-height:1.75">${f.feature}</p>

      <section class="detail-section">
        <h3>임상도 상세 <span class="num">주임상 ${f.forestType} · ${f.ageClass} · 울폐도 ${f.canopy}</span></h3>
        <div class="detail-two">
          <div>
            <div class="species">${speciesHTML}</div>
          </div>
          <div>
            <p style="font-size:11.6px;color:var(--muted);margin-bottom:6px">기대 치유 인자</p>
            <div class="chip-row">${f.factors.map((x) => `<span class="tag env">${x}</span>`).join('')}</div>
            <p style="font-size:11.6px;color:var(--muted);margin:12px 0 6px">지형 · 접근</p>
            <p style="font-size:12px;color:var(--ink-soft);line-height:1.65">${f.terrainNote}<br />${f.barrierFree ? '무장애: ' + f.barrierNote : '무장애 데크로드 미확인'}</p>
          </div>
        </div>
      </section>

      <section class="detail-section">
        <h3>치유 프로그램 전체 <span class="num">${f.programs.length}개 · 현재 조건 추천 ${prog.items.map((p) => p.name).join(', ')}</span></h3>
        <div class="prog-table">${programsHTML}</div>
      </section>

      <section class="detail-section">
        <h3>추천 근거</h3>
        <ul class="reason" style="border:0;padding:0">
          ${reasons.map((t) => `<li style="font-size:12.2px;color:var(--ink-soft);line-height:1.65;padding-left:16px;position:relative">${t}</li>`).join('')}
        </ul>
      </section>

      <section class="detail-section">
        <h3>기상 조건별 유의사항</h3>
        <div class="weather-notes">${weatherNotesHTML(f)}</div>
        <ul class="caution-list" style="margin-top:12px">
          ${f.cautions.map((c) => `<li>${c}</li>`).join('')}
        </ul>
      </section>

      <div class="detail-actions">
        <button class="mini-btn primary" onclick="window.__focusOnMap('${f.id}')">지도에서 위치 보기</button>
        ${f.homepage ? `<a class="mini-btn" href="${f.homepage}" target="_blank" rel="noopener">기관 홈페이지</a>` : ''}
        <button class="mini-btn" data-close>닫기</button>
      </div>
    `;
    openModal('#modal-detail');
  }

  window.__focusOnMap = function (id) {
    closeModal('#modal-detail');
    if (markers[id] && map) {
      map.setView(markers[id].getLatLng(), 10, { animate: true });
      markers[id].openPopup();
    }
  };

  /* =======================================================================
     8. 모달 제어
     ======================================================================= */
  let lastFocus = null;
  function openModal(sel) {
    lastFocus = document.activeElement;
    const m = el(sel);
    m.hidden = false;
    document.body.style.overflow = 'hidden';
    const btn = m.querySelector('.modal-close');
    if (btn) btn.focus({ preventScroll: true });
  }
  function closeModal(sel) {
    const m = el(sel);
    m.hidden = true;
    if (!els('.modal:not([hidden])').length) document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  /* =======================================================================
     9. 업데이트 파이프라인
     ======================================================================= */
  let rafId = null;
  let pendingAnim = false;

  function scheduleUpdate(animate) {
    if (animate) pendingAnim = true;
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      const anim = pendingAnim;
      pendingAnim = false;
      update(anim);
    });
  }

  function update(animate) {
    computeAll();
    renderResults(animate);
    renderRail();
    renderMap();
    syncEnvInputs();
    updateWeightLabels();
  }

  /* =======================================================================
     10. 이벤트
     ======================================================================= */
  function bindEvents() {
    // 지역 / 목적 / 보행 / PM (이벤트 위임)
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-region],[data-purpose],[data-walk],[data-pm],[data-scenario],[data-detail],[data-focus],[data-goto],[data-close],[data-weights]');
      if (!t) return;

      if (t.dataset.region) {
        state.region = t.dataset.region;
        scheduleUpdate(true);
      } else if (t.dataset.purpose) {
        state.purpose = t.dataset.purpose;
        scheduleUpdate(true);
      } else if (t.dataset.walk) {
        state.walk = t.dataset.walk;
        scheduleUpdate(true);
      } else if (t.dataset.pm) {
        state.env.pm = t.dataset.pm;
        state.scenario = null;
        scheduleUpdate(true);
      } else if (t.dataset.scenario) {
        applyScenario(t.dataset.scenario);
      } else if (t.dataset.detail) {
        openDetailModal(t.dataset.detail);
      } else if (t.dataset.goto) {
        focusForest(t.dataset.goto, false);
      } else if (t.dataset.focus) {
        const m = markers[t.dataset.focus];
        if (m && map) { map.setView(m.getLatLng(), 9, { animate: true }); m.openPopup(); }
        el('#map').scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (t.hasAttribute('data-close')) {
        const modal = t.closest('.modal');
        if (modal) closeModal('#' + modal.id);
      } else if (t.dataset.weights) {
        const [w, r, s, p] = t.dataset.weights.split(',').map(Number);
        state.weights = { weather: w, region: r, stand: s, purpose: p };
        state.weightsTouched = true;
        el('#wt-weather').value = w; el('#wt-region').value = r;
        el('#wt-stand').value = s; el('#wt-purpose').value = p;
        update(false);
      }
    });

    // 기온 / 습도
    el('#temp').addEventListener('input', (e) => {
      state.env.temp = Number(e.target.value);
      state.scenario = null;
      scheduleUpdate(false);
    });
    el('#humidity').addEventListener('input', (e) => {
      state.env.humidity = Number(e.target.value);
      state.scenario = null;
      scheduleUpdate(false);
    });

    // 강수 / 강풍
    el('#rain').addEventListener('change', (e) => {
      state.env.rain = e.target.checked;
      state.env.wind = e.target.checked ? Math.max(7, state.env.wind) : 2;
      state.scenario = null;
      scheduleUpdate(true);
    });
    el('#wind-on').addEventListener('change', (e) => {
      state.env.wind = e.target.checked ? 9 : 2;
      state.scenario = null;
      scheduleUpdate(true);
    });

    // 가중치
    ['weather', 'region', 'stand', 'purpose'].forEach((k) => {
      el('#wt-' + k).addEventListener('input', (e) => {
        state.weights[k] = Number(e.target.value);
        state.weightsTouched = true;
        update(false);
      });
    });

    // 초기화
    el('#btn-reset').addEventListener('click', () => {
      state.region = '수도권';
      state.purpose = 'stress';
      state.walk = 'normal';
      state.weights = { weather: 32, region: 18, stand: 22, purpose: 28 };
      state.weightsTouched = false;
      el('#wt-weather').value = 32; el('#wt-region').value = 18;
      el('#wt-stand').value = 22; el('#wt-purpose').value = 28;
      applyScenario('clear');
    });

    // 모달
    el('#btn-algo').addEventListener('click', () => openModal('#modal-algo'));
    el('#btn-about').addEventListener('click', () => openModal('#modal-about'));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const open = els('.modal:not([hidden])');
        if (open.length) closeModal('#' + open[open.length - 1].id);
      }
    });

    // 반응형: 지도 리사이즈
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { if (map) map.invalidateSize(); }, 180);
    });
  }

  function applyScenario(key) {
    const s = SCENARIOS[key];
    if (!s) return;
    state.scenario = key;
    state.env = { temp: s.temp, humidity: s.humidity, pm: s.pm, rain: s.rain, wind: s.wind };
    syncEnvInputs();
    scheduleUpdate(true);
  }

  function updateWeightLabels() {
    const W = state.weights;
    const sum = W.weather + W.region + W.stand + W.purpose || 1;
    const norm = {
      weather: W.weather / sum, region: W.region / sum,
      stand: W.stand / sum, purpose: W.purpose / sum
    };
    el('#w-w').textContent = norm.weather.toFixed(2);
    el('#w-r').textContent = norm.region.toFixed(2);
    el('#w-s').textContent = norm.stand.toFixed(2);
    el('#w-p').textContent = norm.purpose.toFixed(2);
    el('#wt-weather-out').textContent = Math.round(norm.weather * 100) + '%';
    el('#wt-region-out').textContent = Math.round(norm.region * 100) + '%';
    el('#wt-stand-out').textContent = Math.round(norm.stand * 100) + '%';
    el('#wt-purpose-out').textContent = Math.round(norm.purpose * 100) + '%';
  }

  /* =======================================================================
     11. 시작
     ======================================================================= */
  function init() {
    renderControls();
    // 초기 순위 기준선 (delta가 처음부터 튀지 않도록)
    computeAll();
    state.prevRank = {};
    state.results.forEach((r) => { state.prevRank[r.forest.id] = r.rank; });
    state.results.forEach((r) => { r.delta = 0; });

    initMap();
    update(false);
    bindEvents();
    updateWeightLabels();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
