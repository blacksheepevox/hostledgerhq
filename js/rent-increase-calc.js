/* HostLedger — rent increase calculator (estimates only). No tracking, no network calls. */
(function (root) {
  'use strict';

  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }
  function blank(v) { return v === '' || v === null || v === undefined || !isFinite(parseFloat(v)); }
  var DAY_MS = 86400000;

  /**
   * currentRent      = max(0, currentRent)
   * mode             = 'percent' (default) | 'newRent'
   * percent mode     : increasePct = max(-100, increasePct); newRent = currentRent × (1 + increasePct / 100)
   * newRent mode     : newRent = max(0, newRentInput)
   * monthlyIncrease  = newRent − currentRent          (negative = a decrease)
   * annualIncrease   = 12 × monthlyIncrease
   * percentIncrease  = currentRent > 0 ? monthlyIncrease / currentRent × 100 : null
   * target reverse   : targetRent blank → null; else targetPct = currentRent > 0 ? (targetRent − currentRent) / currentRent × 100 : null
   *                    targetMonthlyIncrease = targetRent − currentRent
   * notice (optional): effectiveDate 'YYYY-MM-DD' and noticeDays (blank = none) → noticeBy = effectiveDate − noticeDays days (UTC date math)
   * No rent-control caps or notice statutes are applied; local laws vary.
   */
  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    var t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    var d = new Date(t);
    if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
    return t;
  }
  function isoDate(t) {
    var d = new Date(t);
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
  }

  function computeRentIncrease(i) {
    var currentRent = Math.max(0, num(i.currentRent));
    var mode = i.mode === 'newRent' ? 'newRent' : 'percent';
    var increasePct = Math.max(-100, num(i.increasePct));
    var newRent = mode === 'newRent' ? Math.max(0, num(i.newRent)) : currentRent * (1 + increasePct / 100);
    var monthlyIncrease = newRent - currentRent;
    var annualIncrease = 12 * monthlyIncrease;
    var percentIncrease = currentRent > 0 ? (monthlyIncrease / currentRent) * 100 : null;

    var hasTarget = !blank(i.targetRent);
    var targetRent = hasTarget ? Math.max(0, num(i.targetRent)) : null;
    var targetPct = (hasTarget && currentRent > 0) ? ((targetRent - currentRent) / currentRent) * 100 : null;
    var targetMonthlyIncrease = hasTarget ? targetRent - currentRent : null;

    var noticeDays = blank(i.noticeDays) ? null : Math.max(0, Math.round(num(i.noticeDays)));
    var eff = parseDate(i.effectiveDate);
    var noticeBy = (noticeDays !== null && eff !== null) ? isoDate(eff - noticeDays * DAY_MS) : null;

    return {
      currentRent: currentRent, mode: mode, increasePct: mode === 'percent' ? increasePct : percentIncrease,
      newRent: newRent, monthlyIncrease: monthlyIncrease, annualIncrease: annualIncrease, percentIncrease: percentIncrease,
      targetRent: targetRent, targetPct: targetPct, targetMonthlyIncrease: targetMonthlyIncrease,
      noticeDays: noticeDays, effectiveDate: eff !== null ? isoDate(eff) : null, noticeBy: noticeBy
    };
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { computeRentIncrease: computeRentIncrease }; }
  root.HostLedgerRentIncrease = { computeRentIncrease: computeRentIncrease };

  if (typeof document === 'undefined') { return; }

  var money = function (v) {
    var cents = Math.round(Number((Math.abs(v) * 100).toFixed(6)));
    var s = (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (v < 0 && cents !== 0 ? '-$' : '$') + s;
  };
  var signed = function (v) {
    var cents = Math.round(Number((Math.abs(v) * 100).toFixed(6)));
    return (cents === 0 ? '' : (v < 0 ? '' : '+')) + money(v);
  };
  var pct = function (v) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    var s = v.toFixed(2);
    if (s === '-0.00') s = '0.00';
    return s + '%';
  };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var niceDate = function (iso) {
    var p = iso.split('-');
    return MONTHS[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0];
  };

  function run() {
    var f = document.getElementById('ri-form');
    if (!f) { return; }
    var get = function (id) { return document.getElementById(id).value; };
    var set = function (id, t) { document.getElementById(id).textContent = t; };
    var c = f.querySelector('input[name="mode"]:checked');
    var mode = c ? c.value : 'percent';
    document.getElementById('increasePct').disabled = mode !== 'percent';
    document.getElementById('newRent').disabled = mode !== 'newRent';
    var r = computeRentIncrease({
      currentRent: get('currentRent'), mode: mode, increasePct: get('increasePct'), newRent: get('newRent'),
      targetRent: get('targetRent'), noticeDays: get('noticeDays'), effectiveDate: get('effectiveDate')
    });
    set('out-new', money(r.newRent));
    set('out-new-detail', r.mode === 'percent'
      ? money(r.currentRent) + ' × (1 + ' + r.increasePct + '%)'
      : 'the new rent entered above');
    set('out-monthly', signed(r.monthlyIncrease));
    set('out-monthly-detail', money(r.newRent) + ' − ' + money(r.currentRent) + ' per month');
    set('out-annual', signed(r.annualIncrease));
    set('out-annual-detail', '12 × ' + signed(r.monthlyIncrease) + ' over a 12-month lease');
    set('out-pct', pct(r.percentIncrease));
    set('out-pct-detail', r.percentIncrease === null
      ? 'enter a current rent above zero'
      : (r.monthlyIncrease < 0 ? 'a decrease of ' : 'change of ') + signed(r.monthlyIncrease) + ' ÷ ' + money(r.currentRent));
    set('out-target', pct(r.targetPct));
    set('out-target-detail', r.targetRent === null
      ? 'enter a target rent to see the % it takes'
      : (r.targetPct === null ? 'enter a current rent above zero'
        : signed(r.targetMonthlyIncrease) + '/mo to reach ' + money(r.targetRent)));
    set('out-notice', r.noticeBy === null ? '—' : niceDate(r.noticeBy));
    set('out-notice-detail', r.noticeBy === null
      ? (r.noticeDays === null ? 'optional: enter notice days and the date the new rent starts' : 'enter the date the new rent starts')
      : r.noticeDays + ' days before ' + niceDate(r.effectiveDate) + '; check your lease and local law');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var f = document.getElementById('ri-form');
    if (!f) { return; }
    f.addEventListener('input', run);
    f.addEventListener('change', run);
    f.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    f.addEventListener('reset', function () { setTimeout(run, 0); });
    run();
  });
})(typeof window !== 'undefined' ? window : globalThis);
