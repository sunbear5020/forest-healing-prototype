/* 숲결 확장: 참여자 정보 입력 + 2026 프로그램 추천 모형 연결. 발주처 공개 허가(2026-11-16, 사용자 확인) 후 공개. 방법·결과: docs/PROGRAM_MODEL.md */
(function () {
  'use strict';
  var model = null;
  var CATS_DEFAULT = ['일반'];
  function sel(id, label, opts) {
    return '<label class="eg-field">' + label + '<select id="' + id + '"><option value="">응답 없음</option>' +
      opts.map(function (o, i) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select></label>';
  }
  window.SoopExt = {
    init: function (ctx) {
      fetch('data/program_model.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (M) {
        model = M; ctx.programRanker = window.SoopProgramModel.create(M);
        var form = document.querySelector('#engine-card');
        var box = document.createElement('details'); box.className = 'eg-person'; box.open = true;
        box.innerHTML = '<summary>참여자 정보(선택, 2026 프로그램 추천 모형)</summary>' +
          '<label class="eg-field">연령<input id="px-age" type="number" min="10" max="95" placeholder="응답 없음"></label>' +
          sel('px-sex', '성별', [[1, '남'], [2, '여']]) +
          sel('px-h', '주관적 건강상태', [[1, '아주 건강하지 않다'], [2, '건강하지 않다'], [3, '보통이다'], [4, '건강하다'], [5, '아주 건강하다']]) +
          sel('px-ex', '운동 빈도', [[0, '안 함'], [1, '주 1회 미만'], [2, '주 1~2회'], [3, '주 3~4회'], [4, '주 4회 이상']]) +
          sel('px-hp', '숲이 건강에 도움 된다는 생각', [[1, '전혀 그렇지 않다'], [2, '그렇지 않다'], [3, '보통이다'], [4, '그렇다'], [5, '매우 그렇다']]) +
          sel('px-d', '가까운 숲까지 시간', [[1, '10분 미만'], [2, '10~30분'], [3, '30분~1시간'], [4, '1시간 이상']]) +
          sel('px-v', '숲 방문 빈도', [[1, '가지 않음'], [2, '연 1~2회'], [3, '6개월 1~2회'], [4, '월 1~2회'], [5, '주 1~2회'], [6, '매일']]) +
          '<label class="eg-field">사전 스트레스 점수(SRI 22문항 합, 0~88, 선택)<input id="px-pre" type="number" min="0" max="88"></label>' +
          '<div class="eg-field">참여할 수 있는 프로그램 종류<div id="px-cats">' + M.CATS.map(function (c) {
            return '<label class="eg-inline"><input type="checkbox" value="' + c + '"' + (CATS_DEFAULT.indexOf(c) >= 0 ? ' checked' : '') + '> ' + (M.DESC[c] || c) + '</label>'; }).join('') + '</div></div>';
        var run = document.getElementById('eg-run');
        if (run && run.parentNode) run.parentNode.insertBefore(box, run); else if (form) form.appendChild(box);
      }).catch(function (e) { console.warn('[숲결 확장] 프로그램 모형 없음:', e.message); });
    },
    readInput: function () {
      if (!model) return {};
      var v = function (id) { var el = document.getElementById(id); return el ? el.value : ''; };
      var cats = [].slice.call(document.querySelectorAll('#px-cats input:checked')).map(function (x) { return x.value; });
      return { person: { age: v('px-age'), sex: v('px-sex'), h: v('px-h'), ex: v('px-ex'), hp: v('px-hp'), d: v('px-d'), v: v('px-v'), pre: v('px-pre'), cats: cats } };
    },
    afterRender: function (r, el) {
      var pr = r.programRanking; if (!pr) return;
      var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
      // 시설 카드마다 그 시설에서 운영한 프로그램의 모형 순위
      [].slice.call(el.querySelectorAll('.eg-item')).forEach(function (li, i) {
        var e = r.recommendations[i]; if (!e || !e.programs.model) return;
        var d = li.querySelector('details'); if (!d) return;
        var p = document.createElement('p');
        p.innerHTML = '<b>이 시설 운영 프로그램(2026 프로그램 모형 참고)</b><br>' + (e.programs.model.length ? e.programs.model.map(function (x) {
          return esc(x.title) + ' <small>' + (x.post != null ? '비슷한 참여자 평균 기준 예상 사후 ' + x.post + '점' : '') + ' · ' + x.year + '</small>'; }).join('<br>')
          : '<small>효과측정 자료가 있는 47개 프로그램 중 이 시설 운영분이 없거나, 고른 대상 종류에 해당하지 않음</small>');
        d.appendChild(p);
      });
      var box = document.createElement('section'); box.className = 'eg-programs';
      box.innerHTML = '<h3>조건에 맞을 가능성이 높은 프로그램 5개(2026 프로그램 추천 모형, 순서는 우열이 아님)</h3>' +
        (pr.missing.length ? '<p class="summary">응답 없음 → 학습 때 대체값 사용: ' + esc(pr.missing.join(', ')) + '</p>' : '') +
        '<ol>' + pr.programs.slice(0, 5).map(function (x) {
          return '<li><b>' + esc(x.title) + '</b> <small>' + esc(x.category) + ' · ' + esc(x.org) + ' · ' + x.year + (x.post != null ? ' · 사전 ' + x.pre + ' → 비슷한 참여자 평균 기준 예상 사후 ' + x.post + '점' : '') + '</small></li>'; }).join('') + '</ol>' +
        '<ul class="eg-notes">' + pr.limits.map(function (t) { return '<li><small>' + esc(t) + '</small></li>'; }).join('') + '</ul>';
      el.insertBefore(box, el.querySelector('.eg-list'));
    }
  };
}());
