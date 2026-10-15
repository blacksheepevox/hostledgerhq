/* HostLedger — rental property 1% rule calculator (estimates only). No tracking, no network calls. */
(function (root) {
  'use strict';

  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }

  /**
   * purchasePrice     = max(0, …)
   * monthlyGrossRent  = max(0, …)  (primary; annual = monthly × 12)
   * annualGrossRent   = if monthlyGrossRent provided (incl. 0), monthly×12;
   *                     else max(0, annualGrossRent) and monthly = annual/12
   * targetPct         = max(0, …); ≤0 → reverse fields + passesRule are null
   * actualPct         = (monthlyGrossRent / purchasePrice) × 100 when price > 0; else null
   * passesRule        = actualPct >= targetPct when both defined; else null
   * gapDollars        = monthlyGrossRent − (targetPct/100 × purchasePrice) when targetPct > 0
   * rentNeeded        = (targetPct/100) × purchasePrice when targetPct > 0
   * priceMax          = monthlyGrossRent / (targetPct/100) when targetPct > 0
   * annualRentNeeded  = rentNeeded × 12
   * The 1% rule is a rough screen that ignores vacancy, expenses, CapEx, financing, taxes.
   */
  function computeOnePercentRule(i) {
    var purchasePrice = Math.max(0, num(i.purchasePrice));
    var targetPctRaw = num(i.targetPct);
    var targetPct = Math.max(0, targetPctRaw);
    var monthlyGrossRent, annualGrossRent;
    var hasMonthly = (i.monthlyGrossRent !== undefined && i.monthlyGrossRent !== null && i.monthlyGrossRent !== '');
    if (hasMonthly || i.annualGrossRent === undefined || i.annualGrossRent === null || i.annualGrossRent === '') {
      monthlyGrossRent = Math.max(0, num(i.monthlyGrossRent));
      annualGrossRent = monthlyGrossRent * 12;
    } else {
      annualGrossRent = Math.max(0, num(i.annualGrossRent));
      monthlyGrossRent = annualGrossRent / 12;
    }

    var actualPct = purchasePrice > 0 ? (monthlyGrossRent / purchasePrice) * 100 : null;
    var hasTarget = targetPct > 0;
    var passesRule = (actualPct !== null && hasTarget) ? (actualPct >= targetPct) : null;
    var rentNeeded = hasTarget ? (targetPct / 100) * purchasePrice : null;
    var annualRentNeeded = rentNeeded === null ? null : rentNeeded * 12;
    var priceMax = hasTarget ? monthlyGrossRent / (targetPct / 100) : null;
    var gapDollars = hasTarget ? monthlyGrossRent - (targetPct / 100) * purchasePrice : null;

    return {
      purchasePrice: purchasePrice, monthlyGrossRent: monthlyGrossRent, annualGrossRent: annualGrossRent,
      targetPct: targetPct, actualPct: actualPct, passesRule: passesRule, gapDollars: gapDollars,
      rentNeeded: rentNeeded, priceMax: priceMax, annualRentNeeded: annualRentNeeded
    };
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { computeOnePercentRule: computeOnePercentRule }; }
  root.HostLedgerOnePercentRule = { computeOnePercentRule: computeOnePercentRule };

  if (typeof document === 'undefined') { return; }

  var money = function (v) {
    var cents = Math.round(Number((Math.abs(v) * 100).toFixed(6)));
    var s = (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (v < 0 && cents !== 0 ? '-$' : '$') + s;
  };
  var pct = function (v) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    return v.toFixed(2) + '%';
  };
  var passFail = function (v) {
    if (v === null || v === undefined) return '—';
    return v ? 'Passes' : 'Fails';
  };
  var signedMoney = function (v) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    var cents = Math.round(Number((Math.abs(v) * 100).toFixed(6)));
    if (cents === 0) return '$0.00';
    if (v > 0) return '+' + money(v);
    return money(v);
  };

  function run() {
    var f = document.getElementById('opr-form');
    if (!f) { return; }
    var get = function (id) { return document.getElementById(id).value; };
    var set = function (id, t) { document.getElementById(id).textContent = t; };
    var r = computeOnePercentRule({
      purchasePrice: get('purchasePrice'), monthlyGrossRent: get('monthlyGrossRent'), targetPct: get('targetPct')
    });
    set('out-actual', pct(r.actualPct));
    set('out-actual-detail', r.actualPct === null
      ? 'enter a purchase price above zero'
      : 'monthly rent ' + money(r.monthlyGrossRent) + ' ÷ price ' + money(r.purchasePrice) + ' × 100');
    set('out-pass', passFail(r.passesRule));
    set('out-pass-detail', r.passesRule === null
      ? (r.targetPct <= 0 ? 'enter a target % above zero' : (r.actualPct === null ? 'enter a purchase price above zero' : '—'))
      : (r.passesRule
        ? 'actual ' + pct(r.actualPct) + ' meets or beats the ' + r.targetPct + '% rule'
        : 'actual ' + pct(r.actualPct) + ' is below the ' + r.targetPct + '% rule'));
    set('out-monthly', money(r.monthlyGrossRent));
    set('out-monthly-detail', 'the monthly gross rent entered above');
    set('out-annual', money(r.annualGrossRent));
    set('out-annual-detail', 'monthly rent ' + money(r.monthlyGrossRent) + ' × 12');
    set('out-rent-needed', r.rentNeeded === null ? '—' : money(r.rentNeeded));
    set('out-rent-needed-detail', r.rentNeeded === null
      ? 'enter a target % above zero'
      : r.targetPct + '% of price ' + money(r.purchasePrice) + ' (annual ' + money(r.annualRentNeeded) + ')');
    set('out-price-max', r.priceMax === null ? '—' : money(r.priceMax));
    set('out-price-max-detail', r.priceMax === null
      ? 'enter a target % above zero'
      : 'monthly rent ' + money(r.monthlyGrossRent) + ' ÷ (' + r.targetPct + ' / 100)');
    set('out-gap', signedMoney(r.gapDollars));
    set('out-gap-detail', r.gapDollars === null
      ? 'enter a target % above zero'
      : (r.gapDollars >= 0
        ? money(r.gapDollars) + ' above the rule rent of ' + money(r.rentNeeded)
        : money(Math.abs(r.gapDollars)) + ' short of the rule rent of ' + money(r.rentNeeded)));
  }

  document.addEventListener('DOMContentLoaded', function () {
    var f = document.getElementById('opr-form');
    if (!f) { return; }
    f.addEventListener('input', run);
    f.addEventListener('change', run);
    f.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    f.addEventListener('reset', function () { setTimeout(run, 0); });
    run();
  });
})(typeof window !== 'undefined' ? window : globalThis);
