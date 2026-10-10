/* HostLedger — Airbnb/VRBO cleaning fee calculator (estimates only). No tracking, no network calls. */
(function (root) {
  'use strict';

  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /**
   * payMode: 'turnover' (flat pay per turnover) or 'hourly' (hourly rate x hours per turnover)
   * cost per turnover = cleaner pay + laundry/linens + supplies
   * break-even fee    = cost / (1 - platform fee %), because the platform fee is taken out of the cleaning fee
   * currentFee is optional ('' or missing = no comparison)
   */
  function computeCleaning(i) {
    var hourly = i.payMode === 'hourly';
    var labor = hourly ? Math.max(0, num(i.hourlyRate)) * Math.max(0, num(i.hoursPerTurnover))
                       : Math.max(0, num(i.cleanerPerTurnover));
    var laundry = Math.max(0, num(i.laundryPerTurnover));
    var supplies = Math.max(0, num(i.suppliesPerTurnover));
    var p = clamp(num(i.platformFeePct), 0, 100) / 100;
    var stays = Math.max(0, num(i.staysPerMonth));

    var cost = labor + laundry + supplies;
    var breakEvenFee = p < 1 ? cost / (1 - p) : Infinity;
    var breakEvenRounded = isFinite(breakEvenFee) ? Math.ceil(breakEvenFee - 1e-9) : Infinity;
    var monthlyCost = cost * stays;

    var feeRaw = parseFloat(i.currentFee);
    var hasFee = isFinite(feeRaw) && String(i.currentFee).trim() !== '';
    var fee = hasFee ? Math.max(0, feeRaw) : null;
    var keepPerStay = hasFee ? fee * (1 - p) : null;
    var gapPerStay = hasFee ? keepPerStay - cost : null;
    var monthlyGap = hasFee ? gapPerStay * stays : null;

    return {
      labor: labor, laundry: laundry, supplies: supplies, costPerTurnover: cost,
      breakEvenFee: breakEvenFee, breakEvenRounded: breakEvenRounded, stays: stays,
      monthlyCost: monthlyCost, annualCost: monthlyCost * 12,
      currentFee: fee, keepPerStay: keepPerStay, gapPerStay: gapPerStay, monthlyGap: monthlyGap
    };
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { computeCleaning: computeCleaning }; }
  root.HostLedgerCleaning = { computeCleaning: computeCleaning };

  if (typeof document === 'undefined') { return; }

  var money = function (v) {
    var cents = Math.round(Number((Math.abs(v) * 100).toFixed(6)));
    var s = (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (v < 0 && cents !== 0 ? '-$' : '$') + s;
  };

  function run() {
    var f = document.getElementById('cl-form');
    if (!f) { return; }
    var get = function (id) { return document.getElementById(id).value; };
    var set = function (id, t) { document.getElementById(id).textContent = t; };
    var c = f.querySelector('input[name="payMode"]:checked');
    var mode = c ? c.value : 'turnover';
    document.getElementById('cleanerPerTurnover').disabled = mode === 'hourly';
    document.getElementById('hourlyRate').disabled = mode !== 'hourly';
    document.getElementById('hoursPerTurnover').disabled = mode !== 'hourly';
    var r = computeCleaning({
      payMode: mode, cleanerPerTurnover: get('cleanerPerTurnover'), hourlyRate: get('hourlyRate'),
      hoursPerTurnover: get('hoursPerTurnover'), laundryPerTurnover: get('laundryPerTurnover'),
      suppliesPerTurnover: get('suppliesPerTurnover'), platformFeePct: get('platformFeePct'),
      staysPerMonth: get('staysPerMonth'), currentFee: get('currentFee')
    });
    set('out-cost', money(r.costPerTurnover));
    set('out-cost-detail', 'cleaner ' + money(r.labor) + ' · laundry/linens ' + money(r.laundry) + ' · supplies ' + money(r.supplies));
    if (!isFinite(r.breakEvenFee)) {
      set('out-be', 'Not reachable');
      set('out-be-detail', 'A 100% platform fee leaves nothing from the cleaning fee. Check the fee %.');
    } else {
      set('out-be', money(r.breakEvenFee));
      set('out-be-detail', 'charge at least this per stay to cover cleaning after the platform fee (round up: $' + r.breakEvenRounded.toLocaleString('en-US') + ')');
    }
    set('out-monthly', money(r.monthlyCost));
    set('out-monthly-detail', r.stays + (r.stays === 1 ? ' turnover' : ' turnovers') + ' × ' + money(r.costPerTurnover) + ' · about ' + money(r.annualCost) + ' per year');
    var gapEl = document.getElementById('out-gap');
    if (r.currentFee === null) {
      set('out-gap', '—');
      gapEl.className = 'big';
      set('out-gap-detail', 'Enter the cleaning fee you charge now to compare it with your cost.');
    } else {
      set('out-gap', money(r.monthlyGap) + ' / mo');
      gapEl.className = 'big ' + (r.monthlyGap < 0 ? 'neg' : 'pos');
      set('out-gap-detail', 'you keep ' + money(r.keepPerStay) + ' of a ' + money(r.currentFee) + ' fee after the platform fee: ' +
        money(Math.abs(r.gapPerStay)) + (r.gapPerStay < 0 ? ' short of' : ' over') + ' cost per stay');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var f = document.getElementById('cl-form');
    if (!f) { return; }
    f.addEventListener('input', run);
    f.addEventListener('change', run);
    f.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    f.addEventListener('reset', function () { setTimeout(run, 0); });
    run();
  });
})(typeof window !== 'undefined' ? window : globalThis);
