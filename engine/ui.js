/* 숲결 맞춤 엔진 화면 연결(engine/ui.js)
   기존 화면(index.html)의 결과 영역 맨 위에 '내 상태 맞춤 추천' 카드를 붙인다.
   입력은 브라우저 안에서만 계산하고 저장·전송하지 않는다(위치 좌표 포함). */
(function () {
  'use strict';
  var mount = document.getElementById('engine-card');
  if (!mount || !window.SoopEngine || !window.SoopLoader) return;
  var E = window.SoopEngine;
  var ctx = null;
  var geo = null;

  var CHECK = [
    ['stress', '스트레스', '요즘 스트레스를 얼마나 느끼나요?'],
    ['anxiety', '불안·긴장', '불안하거나 긴장되는 정도'],
    ['depression', '우울감', '기분이 가라앉거나 의욕이 없는 정도'],
    ['fatigue', '피로·활력 저하', '지치고 기운이 없는 정도'],
    ['sleep', '수면 어려움', '잠들기 어렵거나 자주 깨는 정도'],
    ['breath', '호흡기 불편', '기침·코막힘·숨참 등 호흡기 불편']
  ];
  var LEVEL = ['없음', '약간', '보통', '심함', '매우 심함'];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function kstDate(offset) {
    var d = new Date(Date.now() + 9 * 3600e3 + offset * 86400e3);
    return d.toISOString().slice(0, 10);
  }

  function formHTML() {
    var checks = CHECK.map(function (c) {
      return '<div class="eg-check"><label for="eg-' + c[0] + '"><b>' + c[1] + '</b><span>' + c[2] + '</span></label>' +
        '<input type="range" id="eg-' + c[0] + '" min="0" max="4" step="1" value="' + (c[0] === 'stress' ? 2 : 0) + '" />' +
        '<output id="eg-' + c[0] + '-out">' + LEVEL[c[0] === 'stress' ? 2 : 0] + '</output></div>';
    }).join('');
    var days = [1, 2, 3].map(function (o) { var d = kstDate(o); return '<option value="' + d + '">' + d + (o === 1 ? ' (내일)' : '') + '</option>'; }).join('');
    var months = '';
    for (var m = 1; m <= 12; m++) months += '<option value="m' + m + '">' + m + '월 방문(평균 기후로 판단)</option>';
    return '' +
      '<div class="eg-head"><div><p class="eyebrow">맞춤 추천 엔진 v' + E.version + '</p>' +
      '<h2>지금 내 상태에 맞는 치유의 숲</h2>' +
      '<p class="summary">상태 자가점검과 조건을 넣으면 효과 근거(설문 효과모형·문헌)와 방문일 환경(예보·기후), 이동시간을 합쳐 추천합니다. ' +
      '입력값은 이 브라우저 안에서만 계산하고 저장하거나 보내지 않습니다.</p></div></div>' +
      '<div class="eg-grid">' +
      '<fieldset class="eg-box"><legend>1. 최근 2주 상태(자가점검, 진단 아님)</legend>' + checks +
      '<label class="eg-inline"><input type="checkbox" id="eg-selfharm" /> 스스로를 해치고 싶은 생각이 든 적이 있다</label></fieldset>' +
      '<fieldset class="eg-box"><legend>2. 조건</legend>' +
      '<label class="eg-field">치유 목적<select id="eg-purpose">' +
      '<option value="stress">스트레스·번아웃 회복</option><option value="sleep">수면·심신 이완</option>' +
      '<option value="respiratory">호흡기·면역 케어</option><option value="family">가족·시니어 가벼운 산책</option>' +
      '<option value="vitality">활력·집중력 회복</option></select></label>' +
      '<label class="eg-field">걷기<select id="eg-walk"><option value="barrier">무장애·완만한 길</option>' +
      '<option value="normal" selected>보통 산책</option><option value="trek">트레킹 가능</option></select></label>' +
      '<label class="eg-field">편도 이동 허용<select id="eg-hours"><option value="1.5">1.5시간</option><option value="2">2시간</option>' +
      '<option value="3" selected>3시간</option><option value="4">4시간</option><option value="9">제한 없음</option></select></label>' +
      '<label class="eg-field">방문일<select id="eg-date">' + days + months + '</select></label>' +
      '<div class="eg-field">출발 위치<div class="eg-origin">' +
      '<button type="button" class="ghost-btn" id="eg-geo">내 위치 사용</button>' +
      '<select id="eg-sido"><option value="">시도</option></select><select id="eg-sigungu"><option value="">시군구</option></select></div>' +
      '<small id="eg-geo-note">위치는 이 기기 안에서만 거리 계산에 씁니다.</small></div>' +
      '<label class="eg-inline"><input type="checkbox" id="eg-cannot" /> 지금은 숲에 가기 어렵다(가까운 대안 보기)</label>' +
      '<label class="eg-inline"><input type="checkbox" id="eg-usescn" /> 왼쪽 패널의 기상 시나리오로 시험해 보기</label>' +
      '<button type="button" class="primary-btn" id="eg-run">맞춤 추천 받기</button>' +
      '</fieldset></div>' +
      '<div id="eg-out" aria-live="polite"></div>';
  }

  function fillRegions() {
    var pts = (ctx && ctx.sigunguPoints) || [];
    var sidos = {};
    pts.forEach(function (p) { (sidos[p.sido] = sidos[p.sido] || []).push(p.sigungu); });
    var sel = document.getElementById('eg-sido');
    Object.keys(sidos).sort().forEach(function (s) { var o = document.createElement('option'); o.value = s; o.textContent = s; sel.appendChild(o); });
    sel.addEventListener('change', function () {
      var sg = document.getElementById('eg-sigungu');
      sg.innerHTML = '<option value="">시군구</option>';
      (sidos[sel.value] || []).sort().forEach(function (n) { var o = document.createElement('option'); o.value = n; o.textContent = n; sg.appendChild(o); });
      geo = null; document.getElementById('eg-geo-note').textContent = '시군구 대표점(근사)으로 거리를 계산합니다.';
    });
  }

  function readInput() {
    var check = {};
    CHECK.forEach(function (c) { check[c[0]] = +document.getElementById('eg-' + c[0]).value; });
    var dv = document.getElementById('eg-date').value;
    var input = {
      check: check,
      selfharm: document.getElementById('eg-selfharm').checked,
      purpose: document.getElementById('eg-purpose').value,
      walk: document.getElementById('eg-walk').value,
      maxHours: +document.getElementById('eg-hours').value,
      canVisit: !document.getElementById('eg-cannot').checked
    };
    if (dv.charAt(0) === 'm') input.month = +dv.slice(1); else input.date = dv;
    if (geo) input.origin = { lat: geo.lat, lng: geo.lng };
    else {
      var sd = document.getElementById('eg-sido').value, sg = document.getElementById('eg-sigungu').value;
      if (sg) input.origin = { sido: sd, sigungu: sg };
    }
    if (document.getElementById('eg-usescn').checked) {
      input.envOverride = {
        temp: +document.getElementById('temp').value, humidity: +document.getElementById('humidity').value,
        pm: (function () { var b = document.querySelector('#pm-group [aria-checked="true"]'); return b ? b.getAttribute('data-pm') : 'normal'; }()),
        rain: document.getElementById('rain').checked, wind: document.getElementById('wind-on').checked ? 15 : 2
      };
    }
    return input;
  }

  var BASIS = { model: ['효과측정 자료 기반', 'b-model'], mixed: ['효과측정 자료(일부 추정)', 'b-model'],
                similar: ['유사 시설로 추정', 'b-similar'], literature: ['문헌 근거 기반', 'b-lit'], none: ['효과 자료 없음', 'b-lit'] };

  function render(r) {
    var h = '';
    if (r.safety.level !== 'ok') {
      h += '<div class="eg-alert ' + (r.safety.level === 'urgent' ? 'urgent' : '') + '">' + r.safety.messages.map(esc).join('<br>') +
        '<ul>' + r.safety.contacts.map(function (c) { return '<li><b>' + esc(c.name) + '</b> ' + esc(c.tel) + ' <small>' + esc(c.note) + '</small></li>'; }).join('') + '</ul></div>';
    }
    var alt = r.alternatives;
    var altHTML = renderAlternatives(alt);
    if (alt.prominent) h += altHTML;
    var reg = r.context.region;
    if (reg && reg.stress != null) {
      h += '<p class="summary eg-region">지역 맥락: ' + esc(reg.sido) + ' ' + esc(reg.sigungu) + ' 스트레스 인지율 ' + reg.stress + '%, 우울감 경험률 ' + reg.depress +
        '% (지역사회건강조사 ' + reg.year + ', 시도 ' + reg.sidoStress + '%·' + reg.sidoDepress + '%). 개인 추천 점수에는 쓰지 않습니다.</p>';
    }
    if (!r.input.origin) h += '<p class="summary">출발 위치를 넣지 않아 이동시간은 중립값으로 계산했습니다.</p>';
    h += '<ol class="eg-list">' + r.recommendations.map(function (e) {
      var b = BASIS[e.effectBasis] || BASIS.none;
      var prog = e.programs.items.length ? e.programs.items.map(function (p) {
        return esc(p.name) + ' <small>' + esc(p.setting) + '·' + esc(p.difficulty) + (p.indoorAlt ? ' → 실내 대체: ' + esc(p.indoorAlt) : '') + '</small>';
      }).join('<br>') : '<small>' + esc(e.programs.note) + '</small>';
      var near = e.links.forests.length ? e.links.forests.map(function (f) { return esc(f.name) + ' ' + f.km + 'km'; }).join(', ') : '20 km 안 산림 자료 없음';
      return '<li class="eg-item"><div class="eg-item-head"><span class="eg-rank">' + e.rank + '</span><div><b>' + esc(e.site.name) + '</b>' +
        ' <span class="eg-badge ' + b[1] + '">' + b[0] + '</span>' +
        '<small class="eg-sub">' + esc(e.site.address || '') + '</small></div>' +
        '<div class="eg-score"><b>' + e.total.toFixed(0) + '</b><small>점수 범위 ' + (e.totalRange ? e.totalRange[0] + '~' + e.totalRange[1] : '-') + ' · 순위 ' + (e.rankRange ? e.rankRange[0] + '~' + e.rankRange[1] + '위' : '-') + '</small></div></div>' +
        '<div class="eg-bars"><span>효과 ' + (e.scores.effect == null ? '–' : e.scores.effect) + '</span><span>환경 ' + e.scores.env + '</span><span>접근 ' + e.scores.access +
        (e.access.hours != null ? ' (약 ' + e.access.hours + '시간)' : '') + '</span></div>' +
        '<details><summary>추천 근거와 프로그램</summary><ul class="eg-reasons">' + e.reasons.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
        '<p><b>프로그램</b><br>' + prog + '</p><p><b>주변 산림</b> ' + near + '</p><p><b>주변 관광</b> ' + (e.links.tourism && e.links.tourism.length ? e.links.tourism.map(function (t) { return esc(t.name) + ' <small>' + esc(t.type) + ' ' + t.km + 'km</small>'; }).join(', ') : '–') +
        '<br><small>' + esc(e.links.tourismNote || '') + '</small></p></details></li>';
    }).join('') + '</ol>';
    if (!r.recommendations.length) h += '<p class="summary">조건에 맞는 시설이 없습니다. 이동시간을 늘리거나 아래 대안을 확인하세요.</p>';
    if (r.excluded.length) h += '<details class="eg-excl"><summary>제외된 시설 ' + r.excluded.length + '곳</summary><ul>' +
      r.excluded.map(function (x) { return '<li>' + esc(x.name) + ': ' + esc(x.reasons.join(', ')) + '</li>'; }).join('') + '</ul></details>';
    if (r.warnings && r.warnings.length) h += '<details class="eg-excl"><summary>자료 경고 ' + r.warnings.length + '건</summary><ul>' +
      r.warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></details>';
    if (!alt.prominent) h += '<details class="eg-alt-wrap"><summary>방문이 어려울 때 대안 보기</summary>' + altHTML + '</details>';
    h += '<details class="eg-notes"><summary>해석 유의사항과 계수 근거</summary><ul>' + r.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>' +
      '<table class="eg-params"><thead><tr><th>계수</th><th>값</th><th>근거</th></tr></thead><tbody>' +
      Object.keys(r.params).map(function (k) { var p = r.params[k]; return '<tr><td>' + esc(p.note) + '</td><td>' + esc(JSON.stringify(p.value)) + '</td><td>' +
        ({ rule: '공공 기준', literature: '문헌', model: '모형', demo: '시연값' }[p.basis]) + '</td></tr>'; }).join('') + '</tbody></table>' + configLine(r.config) + '</details>';
    document.getElementById('eg-out').innerHTML = h;
  }

  function configLine(c) {
    if (!c) return '';
    var em = c.data.effectModel, et = c.data.envToday;
    return '<p class="eg-config"><small>엔진 ' + esc(c.engine) + ' · 계수 해시 ' + esc(c.paramsHash) + ' · seed ' + c.seed + ' · 반복 ' + c.mcDraws +
      (em ? ' · 효과모형 ' + esc(em.version) : '') + (et ? ' · 예보 기준 ' + esc(et.forecast_base || '') : '') +
      ' · 평가 결과: tests/eval/out/report.md</small></p>';
  }

  function renderAlternatives(a) {
    var h = '<div class="eg-alt"><h3>방문이 어려울 때</h3>' +
      (a.weather ? '<p class="eg-alert' + (a.weather.outdoorOk ? '' : ' urgent') + '">' + esc(a.weather.note) + (a.weather.basis ? ' <small>(' + esc(a.weather.basis) + ')</small>' : '') + '</p>' : '') + '<ol>';
    h += '<li><b>' + esc(a.digital.title) + '</b> — ' + (a.digital.available && a.digital.url
      ? '<a href="' + esc(a.digital.url) + '" target="_blank" rel="noopener">바로 이용</a>' : esc(a.digital.status) + '. ' + esc(a.digital.note)) + '</li>';
    if (a.originNote) h += '<li>' + esc(a.originNote) + '</li>';
    else {
      h += '<li><b>가까운 숲 같은 공원</b>(수관 피복 30% 이상, 1 ha 이상)<ul>' +
        (a.parks.length ? a.parks.map(function (p) { return '<li>' + esc(p.name) + ' ' + p.km + 'km · 수관 ' + p.tree_pct + '% · ' + p.area_ha + 'ha <small>' + esc(p.addr || '') + '</small></li>'; }).join('')
          : '<li>반경 10 km 안에 조건에 맞는 공원이 없습니다.</li>') + '</ul><small>' + esc(a.parkNote || '') + '</small></li>';
      h += '<li><b>산림공원</b>(수관 피복 60% 이상, 10 ha 이상인 큰 공원)<ul>' +
        (a.forestParks && a.forestParks.length ? a.forestParks.map(function (p) { return '<li>' + esc(p.name) + ' ' + p.km + 'km · 수관 ' + p.tree_pct + '% · ' + p.area_ha + 'ha</li>'; }).join('')
          : '<li>반경 40 km 안에 조건에 맞는 공원이 없습니다.</li>') + '</ul></li>';
      if (a.urbanForest) h += '<li><b>도시숲</b> <small>' + esc(a.urbanForest.note) + '</small></li>';
      h += '<li><b>가까운 산림</b>(자연휴양림·치유의숲)<ul>' + a.forests.map(function (f) { return '<li>' + esc(f.name) + ' ' + f.km + 'km <small>' + esc(f.kind || '') + '</small></li>'; }).join('') + '</ul></li>';
    }
    return h + '</ol></div>';
  }

  function run() {
    var input = readInput();
    var needParks = true;
    var p = needParks && ctx.loadParks ? ctx.loadParks() : Promise.resolve();
    document.getElementById('eg-out').innerHTML = '<p class="summary">계산 중…</p>';
    p.then(function () { render(E.recommend(input, ctx)); }).catch(function (e) {
      document.getElementById('eg-out').innerHTML = '<p class="summary">계산 중 오류: ' + esc(e.message) + '</p>';
    });
  }

  mount.innerHTML = formHTML();
  CHECK.forEach(function (c) {
    var el = document.getElementById('eg-' + c[0]);
    el.addEventListener('input', function () { document.getElementById('eg-' + c[0] + '-out').textContent = LEVEL[+el.value]; });
  });
  document.getElementById('eg-run').addEventListener('click', run);
  document.getElementById('eg-geo').addEventListener('click', function () {
    var note = document.getElementById('eg-geo-note');
    if (!navigator.geolocation) { note.textContent = '이 브라우저는 위치 기능을 지원하지 않습니다.'; return; }
    note.textContent = '위치 확인 중…';
    navigator.geolocation.getCurrentPosition(function (pos) {
      geo = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      note.textContent = '기기 위치를 사용합니다(저장·전송 안 함).';
    }, function () { note.textContent = '위치를 가져오지 못했습니다. 시군구를 골라 주세요.'; }, { maximumAge: 600000, timeout: 10000 });
  });

  window.SoopLoader.loadContext('data/').then(function (c) {
    ctx = c; fillRegions();
    var et = c.envToday;
    if (et && et.generated_at) {
      var s = mount.querySelector('.eg-head .summary');
      s.insertAdjacentHTML('beforeend', ' <small>예보 자료: ' + esc(et.forecast_base) + ' 발표분(갱신 ' + esc(et.generated_at.slice(0, 16).replace('T', ' ')) + ').</small>');
    }
  }).catch(function (e) {
    document.getElementById('eg-out').innerHTML = '<p class="summary">자료를 읽지 못했습니다: ' + esc(e.message) + '</p>';
  });
  window.__soopRun = run;
}());
