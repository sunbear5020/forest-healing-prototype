/* 숲결 · 지역 정보 (region.html)
   - data/region_health.json  : 지역사회건강조사 2025 시군구 표준화율(스트레스·우울감)
   - data/region_hazard.json  : 산불·자연재난(시도), 재선충병·산불·산사태 피해지역 표시, 심리 영향 근거
   - data/sigungu_boundary.json : 시군구 경계(표시용 단순화)
   지역 정보는 참고 표시 전용이며 추천 엔진 점수에 들어가지 않는다. */
(function () {
  'use strict';

  var PAL = ['#F3EAD3', '#E6C796', '#D69E64', '#BC6E40', '#8E4527'];
  var NODATA = '#DCDCD4';
  var FLAG = {
    wildfire: { name: '2025 대형산불', color: '#A2583F' },
    pwd: { name: '재선충병 극심·심', color: '#7A4E8C' },
    landslide: { name: '2025 산사태', color: '#3E6A8A' }
  };
  var LAYERS = [
    { id: 'stress', name: '스트레스 인지율', unit: '%', level: 'sigungu' },
    { id: 'depress', name: '우울감 경험률', unit: '%', level: 'sigungu' },
    { id: 'fire', name: '2025 산불 피해면적', unit: 'ha', level: 'sido' },
    { id: 'disaster', name: '자연재난 피해액', unit: '억원', level: 'sido', years: ['2020', '2021', '2022', '2023', '2024'] },
    { id: 'pwd', name: '재선충병 5년 누적', unit: '그루', level: 'sido' }
  ];

  var st = { layer: 'stress', year: '2024', flags: { wildfire: true, pwd: true, landslide: true }, sel: null };
  var RH, HZ, GEO, map, featByKey = {}, featBounds = {}, flagOverlays = [], tipEl = null, tipOverlay = null;

  function $(s) { return document.querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(n, d) { if (n == null || isNaN(n)) return '–'; return Number(n).toLocaleString('ko-KR', { maximumFractionDigits: d == null ? 1 : d }); }
  function key(sido, sg) { return sido + '|' + sg; }
  function getJSON(u) { return fetch(u, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(u); return r.json(); }); }

  /* ── 값 ── */
  function sidoVal(sido) {
    var s = HZ.sido[sido]; if (!s) return null;
    if (st.layer === 'fire') return s.fire2025.area_ha;
    if (st.layer === 'disaster') { var v = s.disaster_kKRW[st.year]; return v == null ? null : v / 100000; } // 천원 → 억원
    if (st.layer === 'pwd') return s.pwd5y_trees;
    return null;
  }
  function value(sido, sg) {
    var L = layerDef();
    if (L.level === 'sido') return sidoVal(sido);
    var r = RH.regions[sido]; var g = r && r.sigungu[sg];
    return g ? g[st.layer] : null;
  }
  function layerDef() { return LAYERS.filter(function (l) { return l.id === st.layer; })[0]; }

  function breaks(vals) {
    var v = vals.filter(function (x) { return x != null && !isNaN(x); }).sort(function (a, b) { return a - b; });
    if (!v.length) return [];
    var b = [];
    for (var i = 1; i < 5; i++) b.push(v[Math.min(v.length - 1, Math.floor(v.length * i / 5))]);
    return b;
  }
  function classOf(x, br) { if (x == null || isNaN(x)) return -1; var i = 0; while (i < br.length && x >= br[i]) i++; return Math.min(i, 4); }

  /* ── 지도 (카카오 지도 SDK) ── */
  function kmaps() {
    return typeof kakao !== 'undefined' && kakao.maps && typeof kakao.maps.load === 'function' ? kakao.maps : null;
  }
  function mapFallback() {
    $('#rg-map').innerHTML = '<p class="rg-empty" style="padding:20px">지도를 불러오지 못했습니다. 아래 검색으로 지역을 찾아보세요.</p>';
  }

  function initMap() {
    var km = kmaps();
    if (!km) { mapFallback(); return; }
    km.load(function () {
      if (typeof km.Map !== 'function') { mapFallback(); return; }
      map = new km.Map('rg-map', {
        center: new km.LatLng(36.2, 127.9),
        level: 9,
        scrollwheel: false,     // 페이지 스크롤을 지도가 잡아먹지 않게
        draggable: true
      });
      map.addControl(new km.ZoomControl(), km.ControlPosition.BOTTOM_RIGHT);
      buildTooltip();
      buildPolygons();
      redraw();
      fitTo(wholeBounds(), 9);
    });
  }

  /* GeoJSON(경계 단순화본) → 카카오 지도 다각형 */
  function buildPolygons() {
    var km = kmaps();
    GEO.features.forEach(function (f) {
      var p = f.properties;
      var parts = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      var bounds = new km.LatLngBounds();
      var polys = [];
      parts.forEach(function (rings) {
        var path = rings.map(function (ring) {
          return ring.map(function (c) { var ll = new km.LatLng(c[1], c[0]); bounds.extend(ll); return ll; });
        });
        var poly = new km.Polygon({
          path: path, strokeWeight: 0.6, strokeColor: '#FFFFFF', strokeOpacity: 1,
          fillColor: NODATA, fillOpacity: 0.86, zIndex: 1
        });
        km.event.addListener(poly, 'click', function () { select(p.sido, p.sigungu); });
        km.event.addListener(poly, 'mouseover', function (e) { showTip(tip(p), e.latLng); });
        km.event.addListener(poly, 'mousemove', function (e) { showTip(tip(p), e.latLng); });
        km.event.addListener(poly, 'mouseout', hideTip);
        poly.setMap(map);
        polys.push(poly);
      });
      featByKey[key(p.sido, p.sigungu)] = { props: p, polys: polys };
      featBounds[key(p.sido, p.sigungu)] = bounds;
    });
  }

  /* 마우스를 올린 지역의 값 툴팁 */
  function buildTooltip() {
    var km = kmaps();
    tipEl = document.createElement('div');
    tipEl.className = 'rg-tip';
    tipEl.style.display = 'none';
    tipOverlay = new km.CustomOverlay({ content: tipEl, xAnchor: 0.5, yAnchor: 1.4, zIndex: 20 });
  }
  function showTip(html, latlng) {
    if (!tipOverlay || !latlng) return;
    tipEl.innerHTML = html;
    tipEl.style.display = 'block';
    tipOverlay.setPosition(latlng);
    tipOverlay.setMap(map);
  }
  function hideTip() {
    if (!tipOverlay) return;
    tipEl.style.display = 'none';
    tipOverlay.setMap(null);
  }

  /* 지도에는 fitBounds가 없다. 레벨(1=가까움)을 이진 탐색해 경계를 모두 담는 가장 가까운 레벨을 찾는다.
     레벨을 바꾼 직후 getBounds()는 아직 이전 값을 돌려줄 수 있어, 한 박자 뒤에 확인한다. */
  function fitTo(bounds, maxLevel) {
    if (!map || !bounds) return;
    var limit = Math.min(maxLevel || 12, 14);
    var sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
    map.setCenter(centerOf(bounds));
    var lo = 1, hi = limit, best = limit;
    function step() {
      if (lo > hi) { map.setLevel(best); return; }
      var mid = Math.floor((lo + hi) / 2);
      map.setLevel(mid);
      setTimeout(function () {
        var mb = null;
        try { mb = map.getBounds(); } catch (e) { mb = null; }
        var ok = !!mb && mb.contain(sw) && mb.contain(ne);
        if (ok) { best = mid; hi = mid - 1; } else { lo = mid + 1; }
        step();
      }, 60);
    }
    setTimeout(step, 120);
  }
  function wholeBounds() {
    var km = kmaps(), b = new km.LatLngBounds();
    GEO.features.forEach(function (f) {
      var fb = featBounds[key(f.properties.sido, f.properties.sigungu)];
      if (!fb) return;
      b.extend(fb.getSouthWest()); b.extend(fb.getNorthEast());
    });
    return b;
  }
  function centerOf(b) {
    var km = kmaps(), sw = b.getSouthWest(), ne = b.getNorthEast();
    return new km.LatLng((sw.getLat() + ne.getLat()) / 2, (sw.getLng() + ne.getLng()) / 2);
  }

  var curBreaks = [];
  function styleOf(p) {
    var c = classOf(value(p.sido, p.sigungu), curBreaks);
    var sel = st.sel && st.sel.sido === p.sido && st.sel.sigungu === p.sigungu;
    return {
      strokeColor: sel ? '#1E2A22' : '#FFFFFF', strokeWeight: sel ? 2.4 : 0.6,
      fillColor: c < 0 ? NODATA : PAL[c], fillOpacity: 0.86
    };
  }
  function applyStyles() {
    Object.keys(featByKey).forEach(function (k) {
      var f = featByKey[k], sel = st.sel && st.sel.sido === f.props.sido && st.sel.sigungu === f.props.sigungu;
      var s = styleOf(f.props);
      f.polys.forEach(function (poly) { poly.setOptions(s); poly.setZIndex(sel ? 5 : 1); });
    });
  }
  function tip(p) {
    var L0 = layerDef(), v = value(p.sido, p.sigungu);
    return '<b>' + esc(p.sido) + ' ' + esc(p.sigungu) + '</b><br>' + esc(L0.name) + (L0.level === 'sido' ? '(시도 값)' : '') + ': ' +
      (v == null ? '자료 없음' : fmt(v, L0.unit === '%' ? 1 : 0) + ' ' + L0.unit);
  }
  function redraw() {
    var L0 = layerDef(), vals;
    if (L0.level === 'sido') vals = Object.keys(HZ.sido).map(sidoVal);
    else vals = GEO.features.map(function (f) { return value(f.properties.sido, f.properties.sigungu); });
    curBreaks = breaks(vals);
    applyStyles();
    drawFlags();
    legend(L0);
    var notes = {
      stress: '지역사회건강조사 2025, 성·연령 표준화율. 5단계 색은 229개 시군구 값의 분위(상대 순위)이며 임상 기준이 아닙니다.',
      depress: '지역사회건강조사 2025, 성·연령 표준화율(최근 1년 2주 이상 연속 우울감 경험). 5단계 색은 분위(상대 순위)입니다.',
      fire: '산림청 산불통계 2025, 시도 단위 값입니다. 같은 시도 안의 시군구는 모두 같은 색입니다. 2025년 경북 면적이 전국의 대부분(3월 대형산불)입니다.',
      disaster: '행정안전부 자연재해현황(시도), 호우·태풍 등 자연재난 피해액. 시도 단위 값이며 산불은 포함 범위가 다를 수 있습니다(확실하지 않음).',
      pwd: '2022~2026년 5년 누적 피해목. 상위 6개 시도만 공개된 단일 보도 자료라 나머지는 회색(자료 없음)입니다. 확실하지 않음.'
    };
    $('#rg-layer-note').textContent = notes[st.layer];
  }
  function legend(L0) {
    var h = '<div class="t">' + esc(L0.name) + (L0.years ? ' ' + st.year : '') + ' (' + esc(L0.unit) + (L0.level === 'sido' ? ', 시도' : '') + ')</div>';
    var b = curBreaks, lo = null;
    for (var i = 0; i < 5; i++) {
      var a = i === 0 ? '최저' : fmt(b[i - 1], L0.unit === '%' ? 1 : 0), z = i < 4 ? fmt(b[i], L0.unit === '%' ? 1 : 0) : '최고';
      if (i > 0 && b[i - 1] === lo) continue; lo = b[i - 1];
      h += '<div class="row"><span class="sw" style="background:' + PAL[i] + '"></span>' + a + ' ~ ' + z + '</div>';
    }
    h += '<div class="row"><span class="sw" style="background:' + NODATA + '"></span>자료 없음</div>';
    Object.keys(FLAG).forEach(function (k) { if (st.flags[k]) h += '<div class="fl"><span class="dot" style="background:' + FLAG[k].color + '"></span>' + FLAG[k].name + '</div>'; });
    $('#rg-legend').innerHTML = h;
  }
  function flagsOf(sido, sg) { return HZ.sigungu_flags.filter(function (f) { return f.sido === sido && f.sigungu === sg; }); }
  function drawFlags() {
    var km = kmaps();
    if (!map || !km) return;
    flagOverlays.forEach(function (o) { o.setMap(null); });
    flagOverlays = [];
    var types = ['wildfire', 'pwd', 'landslide'];
    GEO.features.forEach(function (f) {
      var p = f.properties, fl = flagsOf(p.sido, p.sigungu).filter(function (x) { return st.flags[x.type]; });
      fl.forEach(function (x) {
        var off = (types.indexOf(x.type) - 1) * 0.06;
        var uncertain = /확실하지 않음/.test(x.certainty);
        var label = esc(p.sigungu) + ' · ' + esc(x.label) + (uncertain ? ' (확실하지 않음)' : '');
        var dot = document.createElement('span');
        dot.className = 'rg-flag-dot' + (x.grade === '극심' ? ' severe' : '') + (uncertain ? ' uncertain' : '');
        dot.style.background = FLAG[x.type].color;
        dot.setAttribute('aria-label', label);
        var ov = new km.CustomOverlay({
          position: new km.LatLng(p.lat, p.lng + off), content: dot,
          xAnchor: 0.5, yAnchor: 0.5, zIndex: 8, clickable: true
        });
        km.event.addListener(ov, 'click', function () { select(p.sido, p.sigungu); });
        km.event.addListener(ov, 'mouseover', function () { showTip(label, ov.getPosition()); });
        km.event.addListener(ov, 'mouseout', hideTip);
        ov.setMap(map);
        flagOverlays.push(ov);
      });
    });
  }

  /* ── 상세 ── */
  function bar(label, v, max, cls) {
    var w = v == null ? 0 : Math.max(2, Math.min(100, v / max * 100));
    return '<div class="rg-bar"><span>' + esc(label) + '</span><span class="track"><span class="fill ' + (cls || '') + '" style="width:' + w + '%"></span></span><b>' + (v == null ? '–' : fmt(v) + '%') + '</b></div>';
  }
  function rankOf(metric, v) {
    var all = []; Object.keys(RH.regions).forEach(function (s) { Object.keys(RH.regions[s].sigungu).forEach(function (g) { var x = RH.regions[s].sigungu[g][metric]; if (x != null) all.push(x); }); });
    var hi = all.filter(function (x) { return x > v; }).length;
    return { rank: hi + 1, n: all.length };
  }
  function select(sido, sg) {
    st.sel = { sido: sido, sigungu: sg };
    applyStyles();
    var r = RH.regions[sido] || {}, g = (r.sigungu || {})[sg] || {}, s = HZ.sido[sido];
    var h = '<h3>' + esc(sido) + ' ' + esc(sg) + '</h3><p class="sub">지역 평균을 보여주는 참고 정보입니다. 개인의 상태를 뜻하지 않습니다.</p><div class="rg-grid">';
    // 마음건강
    h += '<div class="rg-box"><h4>마음건강 (지역사회건강조사 2025, 표준화율)</h4>';
    h += bar('스트레스', g.stress, 40) + bar(sido.slice(0, 2) + ' 평균', r.stress, 40, 'sido');
    h += bar('우울감', g.depress, 15) + bar(sido.slice(0, 2) + ' 평균', r.depress, 15, 'sido');
    // 순위 대신 5분위 구간만 보여 줌: 시군구 순위는 해마다 순위 상관 0.44~0.47로 흔들림(REGION_INFO_METHODS), 지역 서열·낙인 방지(검토 E5-04)
    if (g.stress != null) { var a = rankOf('stress', g.stress), b = rankOf('depress', g.depress);
      var band = function (o) { var q = Math.min(5, Math.floor((o.rank - 1) / o.n * 5) + 1); return ['높은 편', '약간 높은 편', '중간', '약간 낮은 편', '낮은 편'][q - 1]; };
      h += '<p class="rg-kv"><span>전국 시군구 5분위 구간</span> 스트레스 ' + band(a) + ' · 우울감 ' + band(b) + '<br><small>한 해 표본 값이라 다음 해 구간이 크게 바뀔 수 있습니다. 지역을 판단하는 근거로 쓰지 마세요.</small></p>'; }
    h += '</div>';
    // 피해 지역 표시
    var fl = flagsOf(sido, sg);
    h += '<div class="rg-box"><h4>산림재난 피해 지역 여부</h4>';
    if (!fl.length) h += '<p class="rg-kv">이 화면에 담은 발표 자료(2025 대형산불, 2026 재선충병 극심·심 일부, 2025 산사태 주요 지역)에는 없습니다. <span>목록이 전수가 아니므로 피해가 없다는 뜻은 아닙니다.</span></p>';
    fl.forEach(function (x) { h += '<div class="rg-flag ' + x.type + '">' + esc(x.label) + '<span class="c">근거: ' + esc(x.certainty) + '</span></div>'; });
    h += '</div>';
    // 시도 통계
    h += '<div class="rg-box"><h4>' + esc(sido) + ' 재난 통계 (시도 단위)</h4>';
    if (s) {
      var f = s.fire2025;
      h += '<p class="rg-kv"><span>2025 산불</span> ' + (f.count == null ? '–' : fmt(f.count, 0) + '건') + ' · ' + (f.area_ha == null ? '–' : fmt(f.area_ha) + 'ha') + '</p>';
      h += '<p class="rg-kv"><span>10년 평균</span> ' + fmt(f.avg10_count) + '건 · ' + fmt(f.avg10_area_ha) + 'ha</p>';
      var d = s.disaster_kKRW;
      h += '<p class="rg-kv"><span>자연재난 피해액</span> 2024 ' + (d['2024'] == null ? '–' : fmt(d['2024'] / 100000) + '억원') + ' · 2023 ' + (d['2023'] == null ? '–' : fmt(d['2023'] / 100000) + '억원') + '</p>';
      h += '<p class="rg-kv"><span>재선충병 5년 누적</span> ' + (s.pwd5y_trees == null ? '공개 자료 없음' : fmt(s.pwd5y_trees, 0) + '그루 (단일 보도, 확실하지 않음)') + '</p>';
    }
    h += '</div></div>';
    var types = {}; fl.forEach(function (x) { types[x.type] = 1; });
    var map2 = { wildfire: '산불', landslide: '산사태', pwd: '재선충' };
    var ev = HZ.psych_evidence.filter(function (e) { return Object.keys(types).some(function (t) { return e.hazard.indexOf(map2[t]) === 0; }); });
    if (ev.length) h += '<p class="rg-foot">이 지역 유형과 관련된 심리 영향 근거: ' + ev.map(function (e) { return esc(e.hazard) + ' – ' + esc(e.level); }).join(' · ') + '. 아래 근거 목록을 참고하세요. 이 지역 주민을 직접 조사한 결과가 아닌 경우가 대부분입니다.</p>';
    // 연락처 명칭은 엔진(CONTACTS)과 같게: 109 자살예방상담전화, 1577-0199 정신건강위기상담전화(보건복지부, 2026-11-17 확인)
    h += '<p class="rg-foot">마음이 힘들면 자살예방상담전화 <a href="tel:109">109</a>(24시간), 정신건강위기상담전화 <a href="tel:15770199">1577-0199</a>(24시간)에서 도움을 받을 수 있습니다. 즉시 위험하면 <a href="tel:119">119</a>·<a href="tel:112">112</a>.</p>';
    $('#rg-detail').innerHTML = h;
  }

  /* ── 정적 섹션 ── */
  function tiles() {
    var n = HZ.national;
    var t = [
      { k: '소나무재선충병 피해목', v: fmt(n.pwd.trees / 10000, 0) + '<small>만 그루</small>', d: n.pwd.sigungu + '개 시군구 · ' + n.pwd.period.split('(')[0] },
      { k: '2025 산불 피해면적', v: fmt(n.fire2025.area_ha, 0) + '<small>ha</small>', d: '10년 평균 ' + fmt(n.fire2025.avg10_area_ha, 0) + 'ha · ' + fmt(n.fire2025.count, 0) + '건' },
      { k: '산사태 피해면적(최신 공개)', v: fmt(n.landslide.area_ha, 0) + '<small>ha</small>', d: n.landslide.latest_year + '년 · 이후 연도 미확보' },
      { k: '시군구 마음건강 자료', v: '229<small>곳</small>', d: '지역사회건강조사 2025 표준화율' }
    ];
    $('#rg-tiles').innerHTML = t.map(function (x) { return '<div class="rg-tile"><p class="k">' + x.k + '</p><p class="v">' + x.v + '</p><p class="d">' + esc(x.d) + '</p></div>'; }).join('');
  }
  function controls() {
    $('#rg-layer').innerHTML = LAYERS.map(function (l) { return '<button class="chip' + (l.id === st.layer ? ' is-active' : '') + '" role="radio" aria-checked="' + (l.id === st.layer) + '" data-l="' + l.id + '">' + esc(l.name) + '</button>'; }).join('');
    $('#rg-layer').onclick = function (e) {
      var b = e.target.closest('[data-l]'); if (!b) return;
      st.layer = b.getAttribute('data-l'); controls(); redraw(); if (st.sel) select(st.sel.sido, st.sel.sigungu);
    };
    var L0 = layerDef(); $('#rg-year').hidden = !L0.years;
    if (L0.years) {
      $('#rg-year-chips').innerHTML = L0.years.map(function (y) { return '<button class="chip' + (y === st.year ? ' is-active' : '') + '" role="radio" aria-checked="' + (y === st.year) + '" data-y="' + y + '">' + y + '</button>'; }).join('');
      $('#rg-year-chips').onclick = function (e) { var b = e.target.closest('[data-y]'); if (!b) return; st.year = b.getAttribute('data-y'); controls(); redraw(); };
    }
    $('#rg-flags').innerHTML = Object.keys(FLAG).map(function (k) { return '<button class="chip fl-' + k + (st.flags[k] ? ' flag-on' : '') + '" aria-pressed="' + st.flags[k] + '" data-f="' + k + '">' + FLAG[k].name + '</button>'; }).join('');
    $('#rg-flags').onclick = function (e) { var b = e.target.closest('[data-f]'); if (!b) return; var k = b.getAttribute('data-f'); st.flags[k] = !st.flags[k]; controls(); redraw(); };
  }
  function search() {
    var opts = GEO.features.map(function (f) { return f.properties.sido + ' ' + f.properties.sigungu; });
    $('#rg-list').innerHTML = opts.map(function (o) { return '<option value="' + esc(o) + '">'; }).join('');
    $('#rg-q').addEventListener('change', function () {
      var q = this.value.trim(); if (!q) return;
      var hit = GEO.features.filter(function (f) { var p = f.properties; return (p.sido + ' ' + p.sigungu) === q; })[0] ||
                GEO.features.filter(function (f) { return f.properties.sigungu === q || (f.properties.sido + ' ' + f.properties.sigungu).indexOf(q) >= 0; })[0];
      if (!hit) return;
      select(hit.properties.sido, hit.properties.sigungu);
      var fb = featBounds[key(hit.properties.sido, hit.properties.sigungu)]; if (fb && map) fitTo(fb, 10);
      $('#rg-detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }
  function evidence() {
    $('#rg-evi').innerHTML = HZ.psych_evidence.map(function (e) {
      var cls = /매우 낮음/.test(e.level) ? 'vlow' : /낮음/.test(e.level) ? 'low' : '';
      return '<article><p class="hz">' + esc(e.hazard) + '</p><h3><a href="' + esc(e.url) + '" target="_blank" rel="noopener">' + esc(e.title) + '</a></h3><p class="cite">' + esc(e.cite) + '</p><p>' + esc(e.finding) + '</p><span class="lv ' + cls + '">근거 수준: ' + esc(e.level) + '</span></article>';
    }).join('');
  }
  function gaps() {
    var g = [
      '소나무재선충병 166개 발생 시군구 전체 명단과 시군구별 피해목 수: 산림청 공식 표를 찾지 못해 극심 6곳(확인)과 심 21곳 중 보도된 13곳(확실하지 않음)만 표시했습니다.',
      '산불의 시군구별 피해면적: 2025년 3월 대형산불은 집계 기준(영향구역·피해면적·시군 자체 입력)에 따라 값이 달라 시군 명단만 표시했습니다.',
      '산사태: 2023년 이후 피해면적과 시도·시군구별 통계를 확보하지 못했습니다. 2025년 7월 산청은 복수 보도로 확인한 사례 표시입니다.',
      '재선충병 피해지역 주민의 심리 피해를 직접 조사한 연구는 이번 검색(국내외)에서 찾지 못했습니다. 관련 내용은 수목 고사와 건강의 연관을 다룬 간접 근거뿐입니다.',
      '재난과 지역 정신건강 수치의 관계: 이 화면은 두 자료를 나란히 보여줄 뿐, 재난이 그 지역 수치를 바꿨다는 근거가 아닙니다.'
    ];
    $('#rg-gaps').innerHTML = g.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
  }
  function sources() {
    var s = HZ._meta.sources, li = [];
    Object.keys(s).forEach(function (k) { li.push('<li>' + esc(s[k].name) + ' — <a href="' + esc(s[k].url) + '" target="_blank" rel="noopener">' + esc(s[k].url) + '</a></li>'); });
    li.push('<li>재선충병 전국 현황(2026년 6월 발표): ' + HZ.national.pwd.refs.map(function (u) { return '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u) + '</a>'; }).join(' · ') + '</li>');
    li.push('<li>산사태 전국 현황: <a href="' + esc(HZ.national.landslide.ref) + '" target="_blank" rel="noopener">e-나라지표 산사태 피해현황</a></li>');
    Object.keys(HZ.flag_refs).forEach(function (k) { li.push('<li>피해 지역 표시(' + FLAG[k].name + '): ' + HZ.flag_refs[k].map(function (u) { return '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u) + '</a>'; }).join(' · ') + '</li>'); });
    li.push('<li>시군구 경계: 통계청 SGIS 행정동 경계(공공누리 제1유형), <a href="https://github.com/vuski/admdongkor" target="_blank" rel="noopener">vuski/admdongkor</a> ver20251231(CC BY 4.0)를 시군구로 병합·단순화</li>');
    $('#rg-src').innerHTML = li.join('');
  }

  Promise.all([getJSON('data/region_health.json'), getJSON('data/region_hazard.json'), getJSON('data/sigungu_boundary.json')])
    .then(function (r) {
      RH = r[0]; HZ = r[1]; GEO = r[2];
      tiles(); controls(); evidence(); gaps(); sources(); search();
      initMap();
    })
    .catch(function (e) { $('#rg-detail').innerHTML = '<p class="rg-empty">자료를 읽지 못했습니다: ' + esc(e.message) + '</p>'; });
}());
