/* HostLedger — rental property 50% rule calculator (estimates only). No tracking, no network calls. */
(function (root) {
  'use strict';

  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }
  function blank(v) { return v === undefined || v === null || v === ''; }

  /**
   * monthlyGrossRent  = max(0, …)  (primary; annual = monthly × 12)
   * annualGrossRent   = if monthlyGrossRent provided (incl. 0), monthly×12;
   *                     else max(0, annualGrossRent) and monthly = annual/12
   * expenseRatioPct   = clamp(0–100), default 50 when blank
   * monthlyMortgage   = max(0, …)  monthly principal & interest (optional, blank → 0)
   * units             = whole number ≥ 1 (blank/0/negative → 1) so per-unit math never divides by zero
   * monthlyExpenses   = monthlyGrossRent × ratio/100        annualExpenses = × 12
   * monthlyNoi        = monthlyGrossRent − monthlyExpenses  annualNoi = × 12
   * monthlyCashFlow   = monthlyNoi − monthlyMortgage (may be negative)   annualCashFlow = × 12
   * perUnitCashFlow   = monthlyCashFlow / units             perUnitRent = monthlyGrossRent / units
   * maxMortgage       = monthlyNoi (break-even P&I payment)
   * mortgageCushion   = maxMortgage − monthlyMortgage (same as monthly cash flow)
   * The 50% rule is a rough screen; real expenses vary by age, taxes, insurance and location.
   */
  function computeFiftyPercentRule(i) {
    var monthlyGrossRent, annualGrossRent;
    if (!blank(i.monthlyGrossRent) || blank(i.annualGrossRent)) {
      monthlyGrossRent = Math.max(0, num(i.monthlyGrossRent));
      annualGrossRent = monthlyGrossRent * 12;
    } else {
      annualGrossRent = Math.max(0, num(i.annualGrossRent));
      monthlyGrossRent = annualGrossRent / 12;
    }
    var expenseRatioPct = blank(i.expenseRatioPct) ? 50 : Math.min(100, Math.max(0, num(i.expenseRatioPct, 50)));
    var monthlyMortgage = Math.max(0, num(i.monthlyMortgage));
    var unitsRaw = Math.floor(num(i.units, 1));
    var units = unitsRaw >= 1 ? unitsRaw : 1;

    var monthlyExpenses = monthlyGrossRent * expenseRatioPct / 100;
    var monthlyNoi = monthlyGrossRent - monthlyExpenses;
    var monthlyCashFlow = monthlyNoi - monthlyMortgage;

    return {
      monthlyGrossRent: monthlyGrossRent, annualGrossRent: annualGrossRent, expenseRatioPct: expenseRatioPct,
      monthlyMortgage: monthlyMortgage, units: units,
      monthlyExpenses: monthlyExpenses, annualExpenses: monthlyExpenses * 12,
      monthlyNoi: monthlyNoi, annualNoi: monthlyNoi * 12,
      monthlyCashFlow: monthlyCashFlow, annualCashFlow: monthlyCashFlow * 12,
      perUnitCashFlow: monthlyCashFlow / units, perUnitRent: monthlyGrossRent / units,
      maxMortgage: monthlyNoi, mortgageCushion: monthlyNoi - monthlyMortgage
    };
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { computeFiftyPercentRule: computeFiftyPercentRule }; }
  root.HostLedgerFiftyPercentRule = { computeFiftyPercentRule: computeFiftyPercentRule };

  if (typeof document === 'undefined') { return; }

  var money = function (v) {
    var cents = Math.round(Number((Math.abs(v) * 100).toFixed(6)));
    var s = (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (v < 0 && cents !== 0 ? '-$' : '$') + s;
  };
  var pctTxt = function (v) { return (Math.round(v * 100) / 100) + '%'; };

  function run() {
    var f = document.getElementById('fpr-form');
    if (!f) { return; }
    var get = function (id) { return document.getElementById(id).value; };
    var set = function (id, t) { document.getElementById(id).textContent = t; };
    var r = computeFiftyPercentRule({
      monthlyGrossRent: get('monthlyGrossRent'), expenseRatioPct: get('expenseRatioPct'),
      monthlyMortgage: get('monthlyMortgage'), units: get('units')
    });
    set('out-cashflow', money(r.monthlyCashFlow));
    set('out-cashflow-detail', 'NOI ' + money(r.monthlyNoi) + ' − mortgage P&I ' + money(r.monthlyMortgage)
      + (r.monthlyCashFlow < 0 ? ' (negative: the payment is above the 50% rule NOI)' : ''));
    set('out-expenses', money(r.monthlyExpenses));
    set('out-expenses-detail', 'rent ' + money(r.monthlyGrossRent) + ' × ' + pctTxt(r.expenseRatioPct) + ' (annual ' + money(r.annualExpenses) + ')');
    set('out-noi', money(r.monthlyNoi));
    set('out-noi-detail', 'rent ' + money(r.monthlyGrossRent) + ' − estimated expenses ' + money(r.monthlyExpenses));
    set('out-noi-annual', money(r.annualNoi));
    set('out-noi-annual-detail', 'monthly NOI ' + money(r.monthlyNoi) + ' × 12');
    set('out-cashflow-annual', money(r.annualCashFlow));
    set('out-cashflow-annual-detail', 'monthly cash flow ' + money(r.monthlyCashFlow) + ' × 12');
    set('out-per-unit', money(r.perUnitCashFlow));
    set('out-per-unit-detail', 'monthly cash flow ÷ ' + r.units + (r.units === 1 ? ' unit' : ' units') + ' (rent ' + money(r.perUnitRent) + ' per unit)');
    set('out-max-mortgage', money(r.maxMortgage));
    set('out-max-mortgage-detail', 'monthly P&I that breaks even under this rule (equals NOI)');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var f = document.getElementById('fpr-form');
    if (!f) { return; }
    f.addEventListener('input', run);
    f.addEventListener('change', run);
    f.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    f.addEventListener('reset', function () { setTimeout(run, 0); });
    run();
  });
})(typeof window !== 'undefined' ? window : globalThis);
