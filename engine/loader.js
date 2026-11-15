/* 숲결 엔진 자료 로더 — 정적 JSON(data/*.json)을 읽어 엔진 ctx를 만든다.
   GitHub Pages에서 같은 저장소 경로로 읽으므로 외부 서버·API 키가 필요 없다.
   공원 목록(약 1.2 MB)은 대체 경로가 필요할 때만 늦게 읽는다. */
(function (root) {
  'use strict';
  function getJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
  }
  function soft(p) { return p.catch(function (e) { console.warn('[숲결 엔진] 자료 읽기 실패:', e.message); return null; }); }

  function loadContext(base) {
    base = base || 'data/';
    return Promise.all([
      getJSON(base + 'sites.json'),
      soft(getJSON(base + 'evidence.json')),
      soft(getJSON(base + 'facility_env.json')),
      soft(getJSON(base + 'env_today.json')),
      soft(getJSON(base + 'forests_nearby.json')),
      soft(getJSON(base + 'region_health.json')),
      soft(getJSON(base + 'tourism.json'))
    ]).then(function (r) {
      var ctx = {
        sites: r[0].sites,
        evidence: r[1],
        facilityEnv: r[2],
        envToday: r[3],
        forests: r[4] ? r[4].forests : [],
        regionHealth: r[5],
        tourism: r[6] ? r[6].sites : null,
        tourismMeta: r[6] ? r[6]._meta : null,
        sigunguPoints: r[1] ? r[1].sigungu_points : [],
        protoForests: typeof FORESTS !== 'undefined' ? FORESTS : [],
        travelHours: typeof TRAVEL_HOURS !== 'undefined' ? TRAVEL_HOURS : null,
        parks: null,
        digitalTherapeutic: null   // 출시 후 { available:true, url:'…', title:'…' }로 채움
      };
      ctx.loadParks = function () {
        if (ctx.parks) return Promise.resolve(ctx.parks);
        return soft(getJSON(base + 'parks.json')).then(function (p) { ctx.parks = p ? p.parks : []; return ctx.parks; });
      };
      return ctx;
    });
  }
  root.SoopLoader = { loadContext: loadContext };
}(typeof self !== 'undefined' ? self : this));
