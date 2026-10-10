/* HostLedger — rental property cash flow calculator (estimates only). No tracking, no network calls. */
(function (root) {
  'use strict';

  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /**
   * Monthly figures unless noted. Property taxes and insurance are ANNUAL inputs.
   * Maintenance and CapEx reserves are % of scheduled rent; management is % of collected income.
   */
  function computeCashFlow(i) {
    var units = clamp(Math.round(num(i.units, 1)), 1, 10);
    var rent = Math.max(0, num(i.rentPerUnit));
    var other = Math.max(0, num(i.otherIncome));
    var vac = clamp(num(i.vacancyPct), 0, 100) / 100;
    var mortgage = Math.max(0, num(i.mortgage));
    var taxes = Math.max(0, num(i.propertyTaxesAnnual)) / 12;
    var insurance = Math.max(0, num(i.insuranceAnnual)) / 12;
    var maintPct = clamp(num(i.maintenancePct), 0, 100) / 100;
    var capexPct = clamp(num(i.capexPct), 0, 100) / 100;
    var mgmtPct = clamp(num(i.managementPct), 0, 100) / 100;
    var utilities = Math.max(0, num(i.utilities));
    var hoa = Math.max(0, num(i.hoaOther));
    var invested = Math.max(0, num(i.cashInvested));

    var scheduledRent = units * rent;
    var gross = scheduledRent + other;
    var vacancyLoss = gross * vac;
    var effective = gross - vacancyLoss;
    var management = effective * mgmtPct;
    var maintenance = scheduledRent * maintPct;
    var capex = scheduledRent * capexPct;
    var opex = taxes + insurance + maintenance + capex + management + utilities + hoa;
    var noi = effective - opex;
    var cashFlow = noi - mortgage;
    var annualCashFlow = cashFlow * 12;
    var coc = invested > 0 ? annualCashFlow / invested * 100 : null;

    return {
      units: units, scheduledRent: scheduledRent, grossPotential: gross, vacancyLoss: vacancyLoss,
      effectiveIncome: effective, taxes: taxes, insurance: insurance, maintenance: maintenance,
      capex: capex, management: management, utilities: utilities, hoaOther: hoa,
      operatingExpenses: opex, noiMonthly: noi, noiAnnual: noi * 12, mortgage: mortgage,
      cashFlowMonthly: cashFlow, cashFlowAnnual: annualCashFlow, cashFlowPerUnit: cashFlow / units,
      cashOnCashPct: coc
    };
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { computeCashFlow: computeCashFlow }; }
  root.HostLedgerCashFlow = { computeCashFlow: computeCashFlow };

  if (typeof document === 'undefined') { return; }

  var money = function (v) {
    // Round half up to cents on the absolute value (avoids 123.8249999 showing as .82).
    var cents = Math.round(Number((Math.abs(v) * 100).toFixed(6)));
    var s = (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (v < 0 && cents !== 0 ? '-$' : '$') + s;
  };

  function run() {
    var f = document.getElementById('cf-form');
    if (!f) { return; }
    var get = function (id) { return document.getElementById(id).value; };
    var set = function (id, t) { document.getElementById(id).textContent = t; };
    var r = computeCashFlow({
      units: get('units'), rentPerUnit: get('rentPerUnit'), otherIncome: get('otherIncome'),
      vacancyPct: get('vacancyPct'), mortgage: get('mortgage'), propertyTaxesAnnual: get('propertyTaxesAnnual'),
      insuranceAnnual: get('insuranceAnnual'), maintenancePct: get('maintenancePct'), capexPct: get('capexPct'),
      managementPct: get('managementPct'), utilities: get('utilities'), hoaOther: get('hoaOther'),
      cashInvested: get('cashInvested')
    });
    set('out-income', money(r.effectiveIncome));
    set('out-income-detail', 'scheduled ' + money(r.grossPotential) + ' minus vacancy ' + money(r.vacancyLoss));
    set('out-opex', money(r.operatingExpenses));
    set('out-opex-detail', 'taxes ' + money(r.taxes) + ' · insurance ' + money(r.insurance) + ' · maintenance ' + money(r.maintenance) + ' · CapEx ' + money(r.capex) + ' · management ' + money(r.management) + ' · utilities ' + money(r.utilities) + ' · HOA/other ' + money(r.hoaOther));
    set('out-noi', money(r.noiMonthly));
    set('out-noi-detail', money(r.noiAnnual) + ' per year, before the mortgage');
    set('out-cf', money(r.cashFlowMonthly));
    document.getElementById('out-cf').className = 'big ' + (r.cashFlowMonthly < 0 ? 'neg' : 'pos');
    set('out-cf-detail', money(r.cashFlowAnnual) + ' per year · ' + money(r.cashFlowPerUnit) + ' per unit per month');
    if (r.cashOnCashPct === null) {
      set('out-coc', '—');
      set('out-coc-detail', 'Enter your cash invested (down payment + closing + rehab) to see this.');
    } else {
      set('out-coc', r.cashOnCashPct.toFixed(2) + '%');
      set('out-coc-detail', 'annual cash flow ÷ cash invested');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var f = document.getElementById('cf-form');
    if (!f) { return; }
    f.addEventListener('input', run);
    f.addEventListener('change', run);
    f.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    f.addEventListener('reset', function () { setTimeout(run, 0); });
    run();
  });
})(typeof window !== 'undefined' ? window : globalThis);
