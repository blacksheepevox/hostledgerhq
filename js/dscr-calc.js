/* HostLedger — rental property DSCR (debt service coverage ratio) calculator (estimates only). No tracking, no network calls. */
(function (root) {
  'use strict';

  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }

  /**
   * noi                 = num(noi)                    // negatives allowed → negative DSCR is meaningful
   * annualDebtService   = max(0, annualDebtService)
   * targetDscr          = max(0, targetDscr)
   * dscr                = annualDebtService > 0 ? noi / annualDebtService : null
   * noiAtTarget         = targetDscr > 0 && annualDebtService > 0 ? targetDscr * annualDebtService : null
   * debtServiceAtTarget = targetDscr > 0 ? noi / targetDscr : null
   *   (debtServiceAtTarget allows any NOI, including negative)
   * DSCR is a lender screen: NOI vs qualifying annual debt service. Lenders define both differently.
   */
  function computeDscr(i) {
    var noi = num(i.noi);
    var annualDebtService = Math.max(0, num(i.annualDebtService));
    var targetDscr = Math.max(0, num(i.targetDscr));

    var dscr = annualDebtService > 0 ? noi / annualDebtService : null;
    var noiAtTarget = (targetDscr > 0 && annualDebtService > 0) ? targetDscr * annualDebtService : null;
    var debtServiceAtTarget = targetDscr > 0 ? noi / targetDscr : null;

    return {
      noi: noi, annualDebtService: annualDebtService, targetDscr: targetDscr,
      dscr: dscr, noiAtTarget: noiAtTarget, debtServiceAtTarget: debtServiceAtTarget
    };
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { computeDscr: computeDscr }; }
  root.HostLedgerDscr = { computeDscr: computeDscr };

  if (typeof document === 'undefined') { return; }

  var money = function (v) {
    var cents = Math.round(Number((Math.abs(v) * 100).toFixed(6)));
    var s = (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (v < 0 && cents !== 0 ? '-$' : '$') + s;
  };
  var ratio = function (v) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    return v.toFixed(2) + '\u00d7';
  };

  function run() {
    var f = document.getElementById('dscr-form');
    if (!f) { return; }
    var get = function (id) { return document.getElementById(id).value; };
    var set = function (id, t) { document.getElementById(id).textContent = t; };
    var r = computeDscr({
      noi: get('noi'), annualDebtService: get('annualDebtService'), targetDscr: get('targetDscr')
    });
    set('out-dscr', ratio(r.dscr));
    set('out-dscr-detail', r.dscr === null
      ? 'enter annual debt service above zero'
      : 'NOI ' + money(r.noi) + ' \u00f7 debt service ' + money(r.annualDebtService));
    set('out-noi-needed', r.noiAtTarget === null ? '—' : money(r.noiAtTarget));
    set('out-noi-needed-detail', r.noiAtTarget === null
      ? (r.targetDscr <= 0 || r.annualDebtService <= 0 ? 'needs debt service and a target DSCR above zero' : '—')
      : r.targetDscr.toFixed(2) + '\u00d7 ' + money(r.annualDebtService));
    set('out-debt-max', r.debtServiceAtTarget === null ? '—' : money(r.debtServiceAtTarget));
    set('out-debt-max-detail', r.debtServiceAtTarget === null
      ? (r.targetDscr <= 0 ? 'enter a target DSCR above zero' : '—')
      : 'NOI ' + money(r.noi) + ' \u00f7 ' + r.targetDscr.toFixed(2));
    set('out-noi', money(r.noi));
    set('out-noi-detail', 'the annual NOI entered above');
    set('out-debt', money(r.annualDebtService));
    set('out-debt-detail', 'the annual debt service entered above');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var f = document.getElementById('dscr-form');
    if (!f) { return; }
    f.addEventListener('input', run);
    f.addEventListener('change', run);
    f.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    f.addEventListener('reset', function () { setTimeout(run, 0); });
    run();
  });
})(typeof window !== 'undefined' ? window : globalThis);
