/* 숲결 엔진 자료 로더 — 정적 JSON(data/*.json)을 읽어 엔진 ctx를 만든다(조립 규칙은 engine/context.js).
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
    var C = root.SoopContext;   // engine/context.js — 웹·앱·API 서버가 같은 ctx 조립 규칙을 쓴다
    return Promise.all(C.FILES.map(function (f) {
      var p = getJSON(base + f.file);
      return f.required ? p : soft(p);
    })).then(function (r) {
      var raw = {};
      C.FILES.forEach(function (f, i) { raw[f.key] = r[i]; });
      var ctx = C.build(raw, {
        protoForests: typeof FORESTS !== 'undefined' ? FORESTS : [],
        travelHours: typeof TRAVEL_HOURS !== 'undefined' ? TRAVEL_HOURS : null
      });
      ctx.loadParks = function () {
        if (ctx.parks) return Promise.resolve(ctx.parks);
        return soft(getJSON(base + 'parks.json')).then(function (p) { ctx.parks = p ? p.parks : []; return ctx.parks; });
      };
      return ctx;
    });
  }
  root.SoopLoader = { loadContext: loadContext };
}(typeof self !== 'undefined' ? self : this));
