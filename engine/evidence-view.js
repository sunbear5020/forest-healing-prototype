/* 숲결 연구 근거 화면: data/meta_summary.json(연구진 메타분석 결과)을 그대로 보여준다.
 * 점수 계산에는 관여하지 않는 표시 전용 스크립트. */
(function () {
  'use strict';
  var loaded = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function f2(x) { return (x < 0 ? '−' : '') + Math.abs(x).toFixed(2); }
  function ci(o) { return f2(o.g) + ' <span class="ev-ci">(' + f2(o.lo) + ', ' + f2(o.hi) + ')</span>'; }
  function gradeTag(g) {
    var cls = { '높음': 'hi', '중간': 'mid', '낮음': 'lo', '매우 낮음': 'vlo' }[g] || 'mid';
    return '<span class="ev-grade ev-grade-' + cls + '">' + esc(g) + '</span>';
  }
  function list(arr) {
    return '<ul class="ev-list">' + (arr || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
  }

  function render(d) {
    var m = d.methods || {};
    var h = [];
    h.push('<section class="ev-sec"><h3>1. 연구 방법</h3><dl class="ev-dl">' +
      [['연구 질문', m.question], ['자료원', m.sources], ['포함 기준', m.inclusion], ['효과크기', m.effect],
       ['통합 모형', m.model], ['비뚤림 평가', m.rob], ['근거 확실성', m.grade]]
        .map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl></section>');

    h.push('<section class="ev-sec"><h3>2. 결과: 숲 체험 전후·대조군 대비 기분·스트레스 변화(문헌)</h3>' +
      '<p class="ev-note">값은 Hedges g, <b>음수일수록 개선</b>(0.2 작음 · 0.5 중간 · 0.8 큼). 괄호는 95% 신뢰구간, 예측구간은 새 연구 하나에서 기대되는 범위.</p>' +
      '<div class="table-scroll"><table class="demo-table ev-table"><thead><tr>' +
      '<th>지표</th><th>대조군 비교 전체 (주분석)</th><th>예측구간</th><th>I²</th><th>무작위 대조만</th><th>단일군 사전-사후</th></tr></thead><tbody>' +
      (d.domains || []).map(function (x) {
        return '<tr><th>' + esc(x.label) + '</th><td>' + ci(x.controlled) + '<br><small>' + x.controlled.studies + '편</small></td>' +
          '<td>' + f2(x.controlled.pil) + ' ~ ' + f2(x.controlled.pih) + '</td><td>' + x.controlled.I2 + '%</td>' +
          '<td>' + ci(x.rct) + '<br><small>' + x.rct.studies + '편</small></td>' +
          '<td>' + ci(x.single) + '<br><small>' + x.single.studies + '편</small></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="ev-note">해석: 다섯 지표 모두 평균적으로 개선 방향의 결과가 보고되었으나, 근거 확실성은 지표별로 매우 낮음~중간(엄격 판정)입니다. 5개 중 3개 지표는 예측구간이 0을 넘어, 어떤 프로그램·장소에서는 효과가 거의 없을 수도 있습니다.</p></section>');

    var rules = d.lenientRules || [];
    h.push('<section class="ev-sec"><h3>3. 근거 확실성(GRADE): 엄격 판정과 완화 판정</h3>' +
      '<p class="ev-note">두 판정 모두 Claude의 <b>가상 판정</b>이며, 실험실 전문가 2인이 별도로 직접 판정할 예정입니다. 통합 효과크기는 두 판정에서 같고 확실성 표시만 달라집니다. 완화 기준은 엄격 판정 결과를 본 뒤 정한 <b>사후 설정</b>입니다. 우울은 완화 판정 ‘높음’이지만 예측구간이 0을 포함합니다. 추천 점수 계산에는 어느 쪽도 쓰지 않습니다.</p>' +
      '<div class="table-scroll"><table class="demo-table ev-table"><thead><tr><th>지표</th><th>엄격 판정</th><th>완화 판정</th></tr></thead><tbody>' +
      (d.domains || []).map(function (x) {
        return '<tr><th>' + esc(x.label) + '</th><td>' + gradeTag(x.grade.strict) + '</td><td>' + gradeTag(x.grade.lenient) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      (d.rob ? '<p class="ev-note">비뚤림위험: 엄격판은 무작위 연구 전부 일부 우려·비무작위 전부 심각. 완화판은 ' + esc(d.rob.lenient.rob2) + ' / ' + esc(d.rob.lenient.robinsI) + '.</p>' : '') +
      '<details class="ev-details"><summary>완화 기준 5가지 보기</summary><div class="table-scroll"><table class="demo-table"><thead><tr><th>항목</th><th>엄격판</th><th>완화판</th><th>근거</th></tr></thead><tbody>' +
      rules.map(function (r) { return '<tr>' + r.map(function (c, i) { return (i ? '<td>' : '<th>') + esc(c) + (i ? '</td>' : '</th>'); }).join('') + '</tr>'; }).join('') +
      '</tbody></table></div></details></section>');

    h.push('<section class="ev-sec"><h3>4. 민감도 분석</h3>' + list(d.sensitivity) + '</section>');

    var t = d.temperature || {};
    h.push('<section class="ev-sec"><h3>5. 기온에 따른 차이(메타회귀)</h3><p class="ev-note">' + esc(t.note) + '</p>' +
      '<div class="table-scroll"><table class="demo-table"><thead><tr><th>지표</th><th>기온 10 ℃당 변화</th><th>95% CI</th><th>p</th></tr></thead><tbody>' +
      Object.keys(t.items || {}).map(function (k) {
        var it = t.items[k];
        return '<tr><th>' + esc(k) + '</th><td>' + f2(it.b) + '</td><td>' + f2(it.lo) + ' ~ ' + f2(it.hi) + '</td><td>' + it.p.toFixed(2) + '</td></tr>';
      }).join('') + '</tbody></table></div></section>');

    var ft = d.forestType || {}, ma = ft.ma || {}, sr = ft.sr || {};
    function row(lbl, a) { return a ? '<tr><th>' + lbl + '</th><td>' + f2(a[0]) + '</td><td>' + f2(a[1]) + ' ~ ' + f2(a[2]) + '</td></tr>' : ''; }
    h.push('<section class="ev-sec"><h3>6. 숲 종류(침엽·활엽·혼효)에 따른 차이</h3>' +
      '<p class="ev-note"><b>메타분석</b>(' + esc(ma.n) + '): 효과크기 차이, 양수면 앞쪽 숲의 개선이 작음.</p>' +
      '<div class="table-scroll"><table class="demo-table"><thead><tr><th>비교</th><th>차이</th><th>95% CI</th></tr></thead><tbody>' +
      row('침엽수림 − 혼효림', ma.conifer_vs_mixed) + row('활엽수림 − 혼효림', ma.broadleaf_vs_mixed) +
      row('도시숲·녹지 − 산림', ma.urban_vs_forest) + row('침엽 − 혼효(대조군 연구만)', ma.ctrl_conifer_vs_mixed) +
      '</tbody></table></div><p class="ev-note">' + esc(ma.conclusion) + '</p>' +
      '<p class="ev-note"><b>체계적 문헌고찰(경관 선호·회복감)</b>: ' + esc(sr.conclusion) + '. 예: ' + esc(sr.example) + '. ' + esc(sr.other) + '.</p>' +
      '<p class="ev-note">앱 반영: ' + esc(ft.app) + '.</p></section>');

    h.push('<section class="ev-sec"><h3>7. 숲결에서 이 결과를 쓰는 방식</h3>' + list(d.appUse) + '</section>');
    h.push('<section class="ev-sec"><h3>8. 한계</h3>' + list(d.limits) +
      '<p class="ev-note ev-meta">기준일 ' + esc((d._meta || {}).built) + ' · ' + esc((d._meta || {}).status) + '</p></section>');
    return h.join('');
  }

  function open() {
    var m = document.getElementById('modal-evidence');
    if (!m) return;
    m.hidden = false;
    document.body.style.overflow = 'hidden';
    var btn = m.querySelector('.modal-close');
    if (btn) btn.focus({ preventScroll: true });
    if (loaded) return;
    var body = document.getElementById('evidence-body');
    loaded = fetch('data/meta_summary.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { body.innerHTML = render(d); })
      .catch(function () { loaded = null; body.innerHTML = '<p class="ev-note">근거 자료를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.</p>'; });
  }

  function init() {
    var b = document.getElementById('btn-evidence');
    if (b) b.addEventListener('click', open);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  if (typeof window !== 'undefined') window.SoopgyeolEvidence = { render: render, open: open };
})();
