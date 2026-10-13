/* HostLedger — rent late fee calculator (estimates only). No tracking, no network calls. */
(function (root) {
  'use strict';

  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }

  /**
   * daysPastGrace = max(0, daysLate − graceDays)
   * isLate        = daysPastGrace > 0
   * flat          : fee = isLate ? flatFee : 0
   * percent       : fee = isLate ? monthlyRent × (percentOfRent / 100) : 0
   * daily         : fee = dailyFee × daysPastGrace
   * optional cap  : if cap is a finite number (>= 0), fee = min(fee, cap); blank/missing = no cap
   * totalDue      = monthlyRent + fee
   * No state caps or statutes are applied; many jurisdictions limit late fees.
   */
  function computeLateFee(i) {
    var monthlyRent = Math.max(0, num(i.monthlyRent));
    var daysLate = Math.max(0, Math.round(num(i.daysLate)));
    var graceDays = Math.max(0, Math.round(num(i.graceDays)));
    var feeType = (i.feeType === 'percent' || i.feeType === 'daily') ? i.feeType : 'flat';
    var flatFee = Math.max(0, num(i.flatFee));
    var percentOfRent = Math.max(0, num(i.percentOfRent));
    var dailyFee = Math.max(0, num(i.dailyFee));
    var capRaw = i.cap;
    var hasCap = capRaw !== '' && capRaw !== null && capRaw !== undefined && isFinite(parseFloat(capRaw));
    var cap = hasCap ? Math.max(0, num(capRaw)) : null;

    var daysPastGrace = Math.max(0, daysLate - graceDays);
    var isLate = daysPastGrace > 0;
    var feeBeforeCap = 0;
    if (feeType === 'flat') feeBeforeCap = isLate ? flatFee : 0;
    else if (feeType === 'percent') feeBeforeCap = isLate ? monthlyRent * (percentOfRent / 100) : 0;
    else feeBeforeCap = dailyFee * daysPastGrace;

    var fee = (cap !== null) ? Math.min(feeBeforeCap, cap) : feeBeforeCap;
    var wasCapped = cap !== null && feeBeforeCap > cap + 1e-9;
    return {
      monthlyRent: monthlyRent, daysLate: daysLate, graceDays: graceDays, feeType: feeType,
      flatFee: flatFee, percentOfRent: percentOfRent, dailyFee: dailyFee, cap: cap,
      daysPastGrace: daysPastGrace, isLate: isLate, feeBeforeCap: feeBeforeCap,
      fee: fee, wasCapped: wasCapped, totalDue: monthlyRent + fee
    };
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { computeLateFee: computeLateFee }; }
  root.HostLedgerLateFee = { computeLateFee: computeLateFee };

  if (typeof document === 'undefined') { return; }

  var money = function (v) {
    var cents = Math.round(Number((Math.abs(v) * 100).toFixed(6)));
    var s = (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (v < 0 && cents !== 0 ? '-$' : '$') + s;
  };
  var plural = function (n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); };

  function run() {
    var f = document.getElementById('lf-form');
    if (!f) { return; }
    var get = function (id) { return document.getElementById(id).value; };
    var set = function (id, t) { document.getElementById(id).textContent = t; };
    var radio = function (name) { var c = f.querySelector('input[name="' + name + '"]:checked'); return c ? c.value : ''; };
    var feeType = radio('feeType') || 'flat';
    document.getElementById('flatFee').disabled = feeType !== 'flat';
    document.getElementById('percentOfRent').disabled = feeType !== 'percent';
    document.getElementById('dailyFee').disabled = feeType !== 'daily';
    var r = computeLateFee({
      monthlyRent: get('monthlyRent'), daysLate: get('daysLate'), graceDays: get('graceDays'),
      feeType: feeType, flatFee: get('flatFee'), percentOfRent: get('percentOfRent'),
      dailyFee: get('dailyFee'), cap: get('cap')
    });
    set('out-past', plural(r.daysPastGrace, 'day'));
    set('out-past-detail', r.isLate
      ? (plural(r.daysLate, 'day') + ' late − ' + plural(r.graceDays, 'grace day'))
      : (r.daysLate === 0 ? 'rent is not late' : 'still inside the ' + plural(r.graceDays, 'day') + ' grace period'));
    set('out-fee', money(r.fee));
    var feeDetail;
    if (!r.isLate && r.feeType !== 'daily') {
      feeDetail = 'no late fee while inside the grace period';
    } else if (r.feeType === 'flat') {
      feeDetail = 'flat fee of ' + money(r.flatFee);
    } else if (r.feeType === 'percent') {
      feeDetail = r.percentOfRent + '% of ' + money(r.monthlyRent);
    } else {
      feeDetail = money(r.dailyFee) + ' × ' + plural(r.daysPastGrace, 'day') + ' past grace';
    }
    if (r.wasCapped) feeDetail += ' (capped at ' + money(r.cap) + '; uncapped would be ' + money(r.feeBeforeCap) + ')';
    else if (r.cap !== null && r.isLate) feeDetail += ' (under the ' + money(r.cap) + ' cap)';
    set('out-fee-detail', feeDetail);
    set('out-total', money(r.totalDue));
    set('out-total-detail', 'rent ' + money(r.monthlyRent) + ' + late fee ' + money(r.fee));
    set('out-rent', money(r.monthlyRent));
    set('out-rent-detail', 'the monthly rent entered above');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var f = document.getElementById('lf-form');
    if (!f) { return; }
    f.addEventListener('input', run);
    f.addEventListener('change', run);
    f.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    f.addEventListener('reset', function () { setTimeout(run, 0); });
    run();
  });
})(typeof window !== 'undefined' ? window : globalThis);
