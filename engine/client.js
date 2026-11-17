/* =========================================================================
   숲결 엔진 클라이언트 (Soopgyeol Engine Client)
   -------------------------------------------------------------------------
   화면 코드(ui.js)는 엔진을 직접 부르지 않고 이 클라이언트를 거친다.
     · local  : 기기 안에서 SoopEngine.recommend() 계산(기본값, 지금의 GitHub Pages 방식)
     · remote : 같은 엔진을 서빙하는 API(server/) POST /v1/recommend 호출
   remote가 실패하거나 시간이 넘으면 local로 되돌리고 결과에 servedBy를 남긴다.
   웹·앱이 같은 화면 코드를 쓰고, 계산 위치만 설정(config.js)으로 바꾸기 위한 층이다.
   ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SoopClient = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function create(opts) {
    opts = opts || {};
    var engine = opts.engine;
    var apiBase = (opts.apiBase || '').replace(/\/+$/, '');
    var timeoutMs = opts.timeoutMs || 8000;
    var fetchFn = opts.fetch || (typeof fetch === 'function' ? fetch : null);
    var mode = apiBase && fetchFn ? 'remote' : 'local';

    function local(input, ctx) {
      var r = engine.recommend(input, ctx);
      r.servedBy = 'local';
      return r;
    }

    function remote(input) {
      var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs) : null;
      return fetchFn(apiBase + '/v1/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (res) {
        if (timer) clearTimeout(timer);
        if (!res.ok) throw new Error('API ' + res.status);
        return res.json();
      }, function (e) { if (timer) clearTimeout(timer); throw e; });
    }

    return {
      mode: mode,
      apiBase: apiBase,
      recommend: function (input, ctx) {
        if (mode === 'local') {
          try { return Promise.resolve(local(input, ctx)); } catch (e) { return Promise.reject(e); }
        }
        return remote(input).then(function (r) { r.servedBy = 'remote'; return r; }, function (e) {
          if (typeof console !== 'undefined') console.warn('[숲결] API 계산 실패, 기기 안 계산으로 전환:', e && e.message);
          if (!ctx) throw e;
          var r = local(input, ctx); r.servedBy = 'local-fallback'; return r;
        });
      }
    };
  }

  /* 브라우저: config.js의 SOOP_CONFIG로 만든다 */
  // 서버 계산은 개인정보 처리방침 주소(privacyNoticeUrl)가 설정되어 있을 때만 켠다.
  // 위치·자가점검(자해 문항 포함)이 서버로 가므로 고지 없이 전환되는 것을 코드에서 막는다(가상 전문가 검토 E5-05).
  function fromConfig(cfg, engine) {
    cfg = cfg || (typeof window !== 'undefined' && window.SOOP_CONFIG) || {};
    engine = engine || (typeof window !== 'undefined' && window.SoopEngine);
    var apiBase = cfg.apiBase && cfg.privacyNoticeUrl ? cfg.apiBase : '';
    if (cfg.apiBase && !cfg.privacyNoticeUrl && typeof console !== 'undefined') console.warn('[숲결] privacyNoticeUrl이 없어 서버 계산을 켜지 않고 기기 안에서 계산합니다.');
    return create({ engine: engine, apiBase: apiBase, timeoutMs: cfg.apiTimeoutMs });
  }

  function isRemote(cfg) { cfg = cfg || {}; return !!(cfg.apiBase && cfg.privacyNoticeUrl); }
  return { create: create, fromConfig: fromConfig, isRemote: isRemote };
}));
