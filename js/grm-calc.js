/* HostLedger — rental property gross rent multiplier (GRM) calculator (estimates only). No tracking, no network calls. */
(function (root) {
  'use strict';

  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }

  /**
   * purchasePrice     = max(0, …)
   * monthlyGrossRent  = max(0, …)  (primary input; annual = monthly × 12)
   * annualGrossRent   = if monthlyGrossRent provided (incl. 0), monthly×12;
   *                     else max(0, annualGrossRent) and monthly = annual/12
   * GRM               = purchasePrice / annualGrossRent when annual > 0; else null
   * priceAtTarget     = targetGrm × annualGrossRent when targetGrm > 0
   * annualRentAtTarget / monthlyRentAtTarget = purchasePrice / targetGrm (/12)
   * GRM ignores expenses, vacancy, financing and CapEx.
   */
  function computeGrm(i) {
    var purchasePrice = Math.max(0, num(i.purchasePrice));
    var targetGrm = Math.max(0, num(i.targetGrm));
    var monthlyGrossRent, annualGrossRent;
    var hasMonthly = (i.monthlyGrossRent !== undefined && i.monthlyGrossRent !== null && i.monthlyGrossRent !== '');
    if (hasMonthly || i.annualGrossRent === undefined || i.annualGrossRent === null || i.annualGrossRent === '') {
      monthlyGrossRent = Math.max(0, num(i.monthlyGrossRent));
      annualGrossRent = monthlyGrossRent * 12;
    } else {
      annualGrossRent = Math.max(0, num(i.annualGrossRent));
      monthlyGrossRent = annualGrossRent / 12;
    }

    var grm = annualGrossRent > 0 ? purchasePrice / annualGrossRent : null;
    var priceAtTarget = targetGrm > 0 ? targetGrm * annualGrossRent : null;
    var annualRentAtTarget = targetGrm > 0 ? purchasePrice / targetGrm : null;
    var monthlyRentAtTarget = annualRentAtTarget === null ? null : annualRentAtTarget / 12;

    return {
      purchasePrice: purchasePrice, monthlyGrossRent: monthlyGrossRent, annualGrossRent: annualGrossRent,
      targetGrm: targetGrm, grm: grm, priceAtTarget: priceAtTarget,
      annualRentAtTarget: annualRentAtTarget, monthlyRentAtTarget: monthlyRentAtTarget
    };
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { computeGrm: computeGrm }; }
  root.HostLedgerGrm = { computeGrm: computeGrm };

  if (typeof document === 'undefined') { return; }

  var money = function (v) {
    var cents = Math.round(Number((Math.abs(v) * 100).toFixed(6)));
    var s = (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (v < 0 && cents !== 0 ? '-$' : '$') + s;
  };
  var mult = function (v) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    return v.toFixed(2);
  };

  function run() {
    var f = document.getElementById('grm-form');
    if (!f) { return; }
    var get = function (id) { return document.getElementById(id).value; };
    var set = function (id, t) { document.getElementById(id).textContent = t; };
    var r = computeGrm({
      purchasePrice: get('purchasePrice'), monthlyGrossRent: get('monthlyGrossRent'), targetGrm: get('targetGrm')
    });
    set('out-grm', mult(r.grm));
    set('out-grm-detail', r.grm === null
      ? 'enter annual gross rent above zero (monthly rent × 12)'
      : 'purchase price ' + money(r.purchasePrice) + ' ÷ annual gross rent ' + money(r.annualGrossRent));
    set('out-annual', money(r.annualGrossRent));
    set('out-annual-detail', 'monthly rent ' + money(r.monthlyGrossRent) + ' × 12');
    set('out-monthly', money(r.monthlyGrossRent));
    set('out-monthly-detail', 'the monthly gross rent entered above');
    set('out-price-target', r.priceAtTarget === null ? '—' : money(r.priceAtTarget));
    set('out-price-target-detail', r.priceAtTarget === null
      ? (r.targetGrm <= 0 ? 'enter a target GRM above zero' : '—')
      : 'target GRM ' + r.targetGrm + ' × annual rent ' + money(r.annualGrossRent));
    set('out-rent-target', r.monthlyRentAtTarget === null ? '—' : money(r.monthlyRentAtTarget));
    set('out-rent-target-detail', r.monthlyRentAtTarget === null
      ? (r.targetGrm <= 0 ? 'enter a target GRM above zero' : '—')
      : 'annual ' + money(r.annualRentAtTarget) + ' ÷ 12 (price ' + money(r.purchasePrice) + ' ÷ target ' + r.targetGrm + ')');
    set('out-price', money(r.purchasePrice));
    set('out-price-detail', 'the purchase price entered above');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var f = document.getElementById('grm-form');
    if (!f) { return; }
    f.addEventListener('input', run);
    f.addEventListener('change', run);
    f.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    f.addEventListener('reset', function () { setTimeout(run, 0); });
    run();
  });
})(typeof window !== 'undefined' ? window : globalThis);
