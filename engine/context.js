/* =========================================================================
   숲결 엔진 컨텍스트 조립기 (Soopgyeol Context Builder)
   -------------------------------------------------------------------------
   data/*.json 원자료를 엔진 recommend()가 받는 ctx 객체로 바꾼다.
   웹(브라우저 loader.js)·앱(같은 웹 코드를 감싼 Capacitor)·API 서버(server/)가
   이 함수 하나를 함께 써서, 세 실행 환경의 ctx 구성이 어긋나지 않게 한다.

   · 순수 함수. 파일·네트워크를 읽지 않는다(읽기는 호출하는 쪽 책임).
   · raw 키: sites, evidence, facilityEnv, envToday, forestsNearby, regionHealth,
            tourism, facilityRegionHealth, parks(선택), programModel(선택)
   · globals: { protoForests, travelHours } — data.js의 FORESTS·TRAVEL_HOURS
   ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SoopContext = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* 엔진이 읽는 자료 파일 목록(이름 → data/ 안 파일명). required가 아니면 없어도 동작한다. */
  var FILES = [
    { key: 'sites', file: 'sites.json', required: true },
    { key: 'evidence', file: 'evidence.json' },
    { key: 'facilityEnv', file: 'facility_env.json' },
    { key: 'envToday', file: 'env_today.json' },
    { key: 'forestsNearby', file: 'forests_nearby.json' },
    { key: 'regionHealth', file: 'region_health.json' },
    { key: 'tourism', file: 'tourism.json' },
    { key: 'facilityRegionHealth', file: 'facility_region_health.json' }
  ];
  /* 늦게 읽어도 되는 큰 파일 */
  var LAZY_FILES = [
    { key: 'parks', file: 'parks.json' },
    { key: 'programModel', file: 'program_model.json' }
  ];

  function build(raw, globals, deps) {
    raw = raw || {}; globals = globals || {}; deps = deps || {};
    if (!raw.sites || !raw.sites.sites) throw new Error('sites.json이 없거나 형식이 다릅니다');
    var ctx = {
      sites: raw.sites.sites,
      evidence: raw.evidence || null,
      facilityEnv: raw.facilityEnv || null,
      envToday: raw.envToday || null,
      forests: raw.forestsNearby ? raw.forestsNearby.forests : [],
      regionHealth: raw.regionHealth || null,
      tourism: raw.tourism ? raw.tourism.sites : null,
      tourismMeta: raw.tourism ? raw.tourism._meta : null,
      facilityRegionHealth: raw.facilityRegionHealth || null,
      sigunguPoints: raw.evidence ? raw.evidence.sigungu_points : [],
      protoForests: globals.protoForests || [],
      travelHours: globals.travelHours || null,
      parks: raw.parks ? raw.parks.parks : null,
      digitalTherapeutic: null   // 출시 후 { available:true, url:'…', title:'…' }로 채움
    };
    // 2026 프로그램 추천 모형: 모형 JSON과 SoopProgramModel이 함께 있을 때만 연결
    if (raw.programModel && deps.programModel && typeof deps.programModel.create === 'function') {
      ctx.programRanker = deps.programModel.create(raw.programModel);
    }
    return ctx;
  }

  /* 자료 시점 요약(API /v1/meta, 앱 화면 표시용) */
  function dataStamp(ctx) {
    var ev = ctx.evidence, fe = ctx.facilityEnv, et = ctx.envToday;
    return {
      nSites: ctx.sites ? ctx.sites.length : 0,
      nForests: ctx.forests ? ctx.forests.length : 0,
      nParks: ctx.parks ? ctx.parks.length : null,
      evidenceBuilt: ev && ev._meta ? ev._meta.built || null : null,
      effectModel: ev && ev.model ? { version: ev.model.version || null, fitted_at: ev.model.fitted_at || null } : null,
      facilityEnvBuilt: fe && fe._meta ? fe._meta.built || null : null,
      envToday: et ? { generated_at: et.generated_at || null, forecast_base: et.forecast_base || null } : null,
      programModel: !!ctx.programRanker
    };
  }

  return { FILES: FILES, LAZY_FILES: LAZY_FILES, build: build, dataStamp: dataStamp };
}));
