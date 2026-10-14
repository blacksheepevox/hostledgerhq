/* HostLedger — rental property cap rate calculator (estimates only). No tracking, no network calls. */
(function (root) {
  'use strict';

  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }

  /**
   * noi           = max(0, annualNOI)
   * price         = max(0, purchasePrice)
   * capRatePct    = price > 0 ? (noi / price) * 100 : null
   * valueAtTarget = targetCapPct > 0 ? noi / (targetCapPct / 100) : null
   * noiAtTarget   = targetCapPct > 0 && price > 0 ? price * (targetCapPct / 100) : null
   * Cap rate ignores financing, taxes, CapEx timing, and local market norms.
   */
  function computeCapRate(i) {
    var noi = Math.max(0, num(i.annualNOI));
    var price = Math.max(0, num(i.purchasePrice));
    var targetCapPct = Math.max(0, num(i.targetCapPct));

    var capRatePct = price > 0 ? (noi / price) * 100 : null;
    var valueAtTargetCap = targetCapPct > 0 ? noi / (targetCapPct / 100) : null;
    var noiAtTargetCap = (targetCapPct > 0 && price > 0) ? price * (targetCapPct / 100) : null;

    return {
      annualNOI: noi, purchasePrice: price, targetCapPct: targetCapPct,
      capRatePct: capRatePct, valueAtTargetCap: valueAtTargetCap, noiAtTargetCap: noiAtTargetCap
    };
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { computeCapRate: computeCapRate }; }
  root.HostLedgerCapRate = { computeCapRate: computeCapRate };

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
    var f = document.getElementById('cr-form');
    if (!f) { return; }
    var get = function (id) { return document.getElementById(id).value; };
    var set = function (id, t) { document.getElementById(id).textContent = t; };
    var r = computeCapRate({
      annualNOI: get('annualNOI'), purchasePrice: get('purchasePrice'), targetCapPct: get('targetCapPct')
    });
    set('out-cap', pct(r.capRatePct));
    set('out-cap-detail', r.capRatePct === null
      ? 'enter a purchase price above zero'
      : 'annual NOI ' + money(r.annualNOI) + ' ÷ purchase price ' + money(r.purchasePrice));
    set('out-value', r.valueAtTargetCap === null ? '—' : money(r.valueAtTargetCap));
    set('out-value-detail', r.valueAtTargetCap === null
      ? (r.targetCapPct <= 0 ? 'enter a target cap above zero' : '—')
      : 'NOI ' + money(r.annualNOI) + ' ÷ ' + r.targetCapPct + '%');
    set('out-noi-needed', r.noiAtTargetCap === null ? '—' : money(r.noiAtTargetCap));
    set('out-noi-needed-detail', r.noiAtTargetCap === null
      ? (r.targetCapPct <= 0 || r.purchasePrice <= 0 ? 'needs a purchase price and a target cap above zero' : '—')
      : r.targetCapPct + '% of ' + money(r.purchasePrice));
    set('out-noi', money(r.annualNOI));
    set('out-noi-detail', 'the annual NOI entered above');
    set('out-price', money(r.purchasePrice));
    set('out-price-detail', 'the purchase price entered above');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var f = document.getElementById('cr-form');
    if (!f) { return; }
    f.addEventListener('input', run);
    f.addEventListener('change', run);
    f.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    f.addEventListener('reset', function () { setTimeout(run, 0); });
    run();
  });
})(typeof window !== 'undefined' ? window : globalThis);
