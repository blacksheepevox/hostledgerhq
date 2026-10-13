/* HostLedger — prorated rent calculator (estimates only). No tracking, no network calls. */
(function (root) {
  'use strict';

  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }

  /** Calendar days in a month (month 1-12), leap years included. */
  function daysInMonth(year, month) { return new Date(Date.UTC(year, month, 0)).getUTCDate(); }

  /**
   * daysInMonth   = calendar days for year/month (leap years handled)
   * day           = clamped to 1..daysInMonth
   * move-in       : occupiedDays = daysInMonth - day + 1   (move-in day through month end)
   * move-out      : occupiedDays = day                     (1st through move-out day)
   * actual        : dailyRate = rent / daysInMonth; daysCharged = occupiedDays
   * thirty        : dailyRate = rent / 30;          daysCharged = min(occupiedDays, 30)  (30-day "banker's month")
   * prorated      = dailyRate * daysCharged
   * No legal caps or rules are applied; the lease and local law decide which method applies.
   */
  function computeProration(i) {
    var monthlyRent = Math.max(0, num(i.monthlyRent));
    var year = Math.min(2100, Math.max(1900, Math.round(num(i.year, 2026))));
    var month = Math.min(12, Math.max(1, Math.round(num(i.month, 1))));
    var mode = i.mode === 'move-out' ? 'move-out' : 'move-in';
    var method = i.method === 'thirty' ? 'thirty' : 'actual';
    var dim = daysInMonth(year, month);
    var day = Math.min(dim, Math.max(1, Math.round(num(i.day, 1))));
    var occupiedDays = mode === 'move-in' ? dim - day + 1 : day;
    var basisDays = method === 'thirty' ? 30 : dim;
    var daysCharged = method === 'thirty' ? Math.min(occupiedDays, 30) : occupiedDays;
    var dailyRate = monthlyRent / basisDays;
    var prorated = dailyRate * daysCharged;
    return {
      monthlyRent: monthlyRent, year: year, month: month, mode: mode, method: method, day: day,
      daysInMonth: dim, basisDays: basisDays, occupiedDays: occupiedDays, daysCharged: daysCharged,
      dailyRate: dailyRate, prorated: prorated, fullMonthRent: monthlyRent, difference: monthlyRent - prorated
    };
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { computeProration: computeProration, daysInMonth: daysInMonth }; }
  root.HostLedgerProration = { computeProration: computeProration, daysInMonth: daysInMonth };

  if (typeof document === 'undefined') { return; }

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var money = function (v) {
    var cents = Math.round(Number((Math.abs(v) * 100).toFixed(6)));
    var s = (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (v < 0 && cents !== 0 ? '-$' : '$') + s;
  };
  var ord = function (n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  var plural = function (n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); };

  function run() {
    var f = document.getElementById('pr-form');
    if (!f) { return; }
    var get = function (id) { return document.getElementById(id).value; };
    var set = function (id, t) { document.getElementById(id).textContent = t; };
    var radio = function (name) { var c = f.querySelector('input[name="' + name + '"]:checked'); return c ? c.value : ''; };
    var r = computeProration({
      monthlyRent: get('monthlyRent'), year: get('year'), month: get('month'), day: get('day'),
      mode: radio('mode'), method: radio('method')
    });
    var mname = MONTHS[r.month - 1] + ' ' + r.year;
    set('out-daily', money(r.dailyRate));
    set('out-daily-detail', money(r.monthlyRent) + ' ÷ ' + r.basisDays + (r.method === 'thirty' ? ' (30-day month)' : ' days in ' + mname));
    set('out-days', plural(r.daysCharged, 'day'));
    var span = r.mode === 'move-in'
      ? MONTHS[r.month - 1] + ' ' + r.day + '–' + r.daysInMonth
      : MONTHS[r.month - 1] + ' 1–' + r.day;
    set('out-days-detail', (r.mode === 'move-in' ? 'move-in on the ' : 'move-out on the ') + ord(r.day) + ': ' + span +
      ' is ' + plural(r.occupiedDays, 'calendar day') + ' of ' + r.daysInMonth +
      (r.daysCharged !== r.occupiedDays ? ' (capped at 30 under the 30-day method)' : ''));
    set('out-prorated', money(r.prorated));
    set('out-prorated-detail', money(r.dailyRate) + ' a day × ' + plural(r.daysCharged, 'day'));
    set('out-full', money(r.fullMonthRent));
    set('out-full-detail', r.difference > 0.004 ? money(r.difference) + ' less than a full month' : 'same as a full month');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var f = document.getElementById('pr-form');
    if (!f) { return; }
    f.addEventListener('input', run);
    f.addEventListener('change', run);
    f.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    f.addEventListener('reset', function () { setTimeout(run, 0); });
    run();
  });
})(typeof window !== 'undefined' ? window : globalThis);
