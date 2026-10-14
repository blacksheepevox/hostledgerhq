/* HostLedger — rental property cash-on-cash return calculator (estimates only). No tracking, no network calls. */
(function (root) {
  'use strict';

  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }

  /**
   * cashInvested     = max(0, cashInvested)
   * annualCashFlow   = num(annualCashFlow)   // negatives allowed → negative CoC is meaningful
   * targetCoCPct     = max(0, targetCoCPct)
   * cocPct           = cashInvested > 0 ? (annualCashFlow / cashInvested) * 100 : null
   * cashFlowAtTarget = targetCoCPct > 0 && cashInvested > 0 ? cashInvested * (targetCoCPct/100) : null
   * investAtTarget   = targetCoCPct > 0 ? annualCashFlow / (targetCoCPct/100) : null
   *   (investAtTarget allows any cash flow, including negative or zero; document in tests)
   * CoC is pre-tax levered return; ignores tax brackets, CapEx timing, refinance, appreciation.
   */
  function computeCashOnCash(i) {
    var cashInvested = Math.max(0, num(i.cashInvested));
    var annualCashFlow = num(i.annualCashFlow);
    var targetCoCPct = Math.max(0, num(i.targetCoCPct));

    var cocPct = cashInvested > 0 ? (annualCashFlow / cashInvested) * 100 : null;
    var cashFlowAtTarget = (targetCoCPct > 0 && cashInvested > 0) ? cashInvested * (targetCoCPct / 100) : null;
    var investAtTarget = targetCoCPct > 0 ? annualCashFlow / (targetCoCPct / 100) : null;

    return {
      cashInvested: cashInvested, annualCashFlow: annualCashFlow, targetCoCPct: targetCoCPct,
      cocPct: cocPct, cashFlowAtTarget: cashFlowAtTarget, investAtTarget: investAtTarget
    };
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { computeCashOnCash: computeCashOnCash }; }
  root.HostLedgerCashOnCash = { computeCashOnCash: computeCashOnCash };

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

  function run() {
    var f = document.getElementById('coc-form');
    if (!f) { return; }
    var get = function (id) { return document.getElementById(id).value; };
    var set = function (id, t) { document.getElementById(id).textContent = t; };
    var r = computeCashOnCash({
      cashInvested: get('cashInvested'), annualCashFlow: get('annualCashFlow'), targetCoCPct: get('targetCoCPct')
    });
    set('out-coc', pct(r.cocPct));
    set('out-coc-detail', r.cocPct === null
      ? 'enter cash invested above zero'
      : 'annual cash flow ' + money(r.annualCashFlow) + ' ÷ cash invested ' + money(r.cashInvested));
    set('out-cf-needed', r.cashFlowAtTarget === null ? '—' : money(r.cashFlowAtTarget));
    set('out-cf-needed-detail', r.cashFlowAtTarget === null
      ? (r.targetCoCPct <= 0 || r.cashInvested <= 0 ? 'needs cash invested and a target above zero' : '—')
      : r.targetCoCPct + '% of ' + money(r.cashInvested));
    set('out-invest', r.investAtTarget === null ? '—' : money(r.investAtTarget));
    set('out-invest-detail', r.investAtTarget === null
      ? (r.targetCoCPct <= 0 ? 'enter a target return above zero' : '—')
      : 'cash flow ' + money(r.annualCashFlow) + ' ÷ ' + r.targetCoCPct + '%');
    set('out-cf', money(r.annualCashFlow));
    set('out-cf-detail', 'the annual pre-tax cash flow entered above');
    set('out-invested', money(r.cashInvested));
    set('out-invested-detail', 'the cash invested entered above');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var f = document.getElementById('coc-form');
    if (!f) { return; }
    f.addEventListener('input', run);
    f.addEventListener('change', run);
    f.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    f.addEventListener('reset', function () { setTimeout(run, 0); });
    run();
  });
})(typeof window !== 'undefined' ? window : globalThis);
