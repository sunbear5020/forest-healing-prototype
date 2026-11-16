/* 2026 프로그램 추천 모형(발주처 공개 허가 2026-11-16). 2026 결과물 HTML의 계산을 그대로 옮김.
   입력 person: { age, sex(1 남·2 여·0 없음), h(1~5), ex(0~4), hp(1~5), d(1~4), v(1~6), pre(0~88), cats:[대상 종류] }
   값이 없으면 학습 때 대체값(IMP) 사용. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SoopProgramModel = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function features(p, M) {
    var z = new Array(23).fill(0), miss = [];
    z[0] = 1;
    var num = function (x) { return x === '' || x == null || isNaN(+x) ? null : +x; };
    var age = num(p.age); if (age == null) { age = M.IMP.age; miss.push('연령'); }
    z[1] = (age - M.mu) / M.sd;
    var sx = num(p.sex); if (!sx) { sx = M.IMP.sex; miss.push('성별'); } if (sx === 2) z[2] = 1;
    function g(k, label) { var v = num(p[k]); if (v == null) { miss.push(label); return M.IMP[k]; } return v; }
    var h = g('h', '건강상태'), e = g('ex', '운동빈도'), hp = g('hp', '숲 건강도움'), d = g('d', '숲까지 시간'), v = g('v', '숲 방문');
    if (h >= 2) z[1 + h] = 1; if (e >= 1) z[6 + e] = 1; if (hp >= 2) z[9 + hp] = 1; if (d >= 2) z[13 + d] = 1; if (v >= 2) z[16 + v] = 1;
    return { z: z, missing: miss };
  }
  function rankDesc(arr) { var o = arr.map(function (_, i) { return i; }).sort(function (a, b) { return arr[b] - arr[a]; }); var r = new Array(arr.length); o.forEach(function (j, i) { r[j] = i + 1; }); return r; }
  function q(a, p) { var s = a.slice().sort(function (x, y) { return x - y; }); var i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return Math.round(s[lo] + (s[hi] - s[lo]) * (i - lo)); }
  function create(M) {
    var K = M.A50.length, N = M.P.length;
    return function ranker(input) {
      var p = (input && input.person) || {};
      var f = features(p, M), z = f.z, eta = new Array(N).fill(0), ranksK = [];
      for (var k = 0; k < K; k++) {
        var ek = new Array(N).fill(0), Ak = M.A50[k];
        for (var i = 0; i < 23; i++) { if (!z[i]) continue; var row = Ak[i]; for (var j = 0; j < N; j++) ek[j] += z[i] * row[j]; }
        for (j = 0; j < N; j++) eta[j] += ek[j] / K;
        ranksK.push(rankDesc(ek));
      }
      var full = rankDesc(eta);
      var cats = p.cats && p.cats.length ? p.cats : ['일반'];
      var pre = p.pre === '' || p.pre == null ? null : Math.max(0, Math.min(88, +p.pre));
      var programs = M.P.map(function (pg, j) {
        var rk = ranksK.map(function (a) { return a[j]; });
        var post = null;
        if (pre != null) { var lo2 = Math.log((pre + 0.5) / (89 - (pre + 0.5))); post = Math.round(880 / (1 + Math.exp(-(lo2 - eta[j])))) / 10; }
        return { key: pg.k, title: pg.t, target: pg.tg, category: pg.c7, form: pg.f, n: pg.n, org: pg.i.org, year: pg.i.yr,
                 acts: pg.i.act || null, eta: Math.round(eta[j] * 100) / 100, rank: full[j], rankRange: [q(rk, 0.1), q(rk, 0.9)],
                 avgRank: pg.avgR, eligible: cats.indexOf(pg.c7) >= 0, pre: pre, post: post };
      }).filter(function (x) { return x.eligible; }).sort(function (a, b) { return a.rank - b.rank; });
      return { programs: programs, total: N, missing: f.missing, cats: cats, limits: M.limits,
               basis: '2026 프로그램 추천 모형(산림치유 프로그램 추천 연구, 2026)' };
    };
  }
  return { create: create, features: features };
}));
