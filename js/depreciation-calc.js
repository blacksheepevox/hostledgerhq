/* HostLedger — rental property depreciation calculator (estimates only). No tracking, no network calls. */
(function (root) {
  'use strict';

  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }

  var RECOVERY_YEARS = 27.5;   // residential rental property, GDS straight line (IRS Pub 527)

  /**
   * basis        = max(0, purchasePrice + closingCosts + improvements - landValue)
   * annual       = basis / 27.5
   * firstYear    = annual * (12 - month + 0.5) / 12      (mid-month convention, month placed in service 1-12)
   * accumulated(N) = min(basis, firstYear + (N - 1) * annual) for N >= 1
   * yearN        = accumulated(N) - accumulated(N - 1)
   * Ignores disposal-year proration, bonus/cost segregation, and later improvements (each has its own schedule).
   */
  function computeDepreciation(i) {
    var purchasePrice = Math.max(0, num(i.purchasePrice));
    var closingCosts = Math.max(0, num(i.closingCosts));
    var improvements = Math.max(0, num(i.improvements));
    var landValue = Math.max(0, num(i.landValue));
    var month = Math.min(12, Math.max(1, Math.round(num(i.monthPlaced, 1))));
    var taxYear = Math.max(1, Math.round(num(i.taxYear, 1)));

    var basis = Math.max(0, purchasePrice + closingCosts + improvements - landValue);
    var annual = basis / RECOVERY_YEARS;
    var firstYearFraction = (12 - month + 0.5) / 12;
    var firstYear = annual * firstYearFraction;
    var acc = function (n) { return n < 1 ? 0 : Math.min(basis, firstYear + (n - 1) * annual); };
    var accumulated = acc(taxYear);
    var yearN = accumulated - acc(taxYear - 1);
    var remaining = basis - accumulated;

    return {
      purchasePrice: purchasePrice, closingCosts: closingCosts, improvements: improvements, landValue: landValue,
      month: month, taxYear: taxYear, basis: basis, annual: annual, annualPct: basis > 0 ? 100 / RECOVERY_YEARS : 0,
      firstYearFraction: firstYearFraction, firstYear: firstYear, yearN: yearN,
      accumulated: accumulated, remaining: remaining
    };
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { computeDepreciation: computeDepreciation }; }
  root.HostLedgerDepreciation = { computeDepreciation: computeDepreciation };

  if (typeof document === 'undefined') { return; }

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var money = function (v) {
    var cents = Math.round(Number((Math.abs(v) * 100).toFixed(6)));
    var s = (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (v < 0 && cents !== 0 ? '-$' : '$') + s;
  };

  function run() {
    var f = document.getElementById('depr-form');
    if (!f) { return; }
    var get = function (id) { return document.getElementById(id).value; };
    var set = function (id, t) { document.getElementById(id).textContent = t; };
    var r = computeDepreciation({
      purchasePrice: get('purchasePrice'), closingCosts: get('closingCosts'), improvements: get('improvements'),
      landValue: get('landValue'), monthPlaced: get('monthPlaced'), taxYear: get('taxYear')
    });
    set('out-basis', money(r.basis));
    set('out-basis-detail', 'price ' + money(r.purchasePrice) + ' + closing ' + money(r.closingCosts) +
      ' + improvements ' + money(r.improvements) + ' − land ' + money(r.landValue));
    set('out-annual', money(r.annual));
    set('out-annual-detail', r.basis > 0 ? 'basis ÷ 27.5 years (about 3.636% a year), ' + money(r.annual / 12) + ' a month' : 'no depreciable basis');
    set('out-first', money(r.firstYear));
    set('out-first-detail', 'placed in service in ' + MONTHS[r.month - 1] + ': ' + (12 - r.month + 0.5) + ' of 12 months (mid-month convention)');
    set('out-accum', money(r.accumulated));
    set('out-accum-detail', 'through tax year ' + r.taxYear + ' (that year: ' + money(r.yearN) + '); ' + money(r.remaining) + ' of basis left');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var f = document.getElementById('depr-form');
    if (!f) { return; }
    f.addEventListener('input', run);
    f.addEventListener('change', run);
    f.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    f.addEventListener('reset', function () { setTimeout(run, 0); });
    run();
  });
})(typeof window !== 'undefined' ? window : globalThis);
