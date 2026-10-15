/* HostLedger — rental utility bill split / RUBS calculator (estimates only). No tracking, no network calls. */
(function (root) {
  'use strict';

  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }
  function blank(v) { return v === '' || v === null || v === undefined || !isFinite(parseFloat(v)); }
  var METHODS = { equal: 1, occupants: 1, sqft: 1, blended: 1 };
  var MAX_UNITS = 10;

  /**
   * totalBill   = max(0, …)
   * nUnits      = clamp 1..10
   * method      = 'equal' | 'occupants' | 'sqft' | 'blended'  (unknown → equal)
   * blendWeight = clamp 0..100 (% weight on occupants; rest on sqft). Used only for blended.
   * adminFee    = max(0, …) optional fee added per unit on top of the utility share
   * units[]     = { occupants: max(0,…), sqft: max(0,…) } for each active unit
   *
   * Weights:
   *   equal      → 1 per unit
   *   occupants  → occupants_i (if total occupants is 0, fall back to equal)
   *   sqft       → sqft_i (if total sqft is 0, fall back to equal)
   *   blended    → (w/100)×(occ_i/Σocc) + ((100−w)/100)×(sqft_i/Σsqft);
   *                if one side’s total is 0, that side is treated as equal weights
   *
   * Bill shares are rounded to cents with largest-remainder so they sum exactly to totalBill.
   * Admin fees are added after and do not come out of the bill.
   * balances = (sum of rounded bill shares === totalBill in cents)
   * No state RUBS rules or caps are applied; local laws vary.
   */
  function roundMoney(v) {
    return Math.round(Number((v * 100).toFixed(6))) / 100;
  }

  function allocateCents(totalCents, rawWeights) {
    var n = rawWeights.length;
    if (n === 0) return [];
    var sumW = 0;
    for (var i = 0; i < n; i++) sumW += rawWeights[i];
    if (!(sumW > 0)) {
      // equal fallback
      var base = Math.floor(totalCents / n);
      var rem = totalCents - base * n;
      var out = [];
      for (var j = 0; j < n; j++) out.push(base + (j < rem ? 1 : 0));
      return out;
    }
    var exact = [];
    var floors = [];
    var fracs = [];
    var floorSum = 0;
    for (var k = 0; k < n; k++) {
      var e = totalCents * (rawWeights[k] / sumW);
      exact.push(e);
      var f = Math.floor(e);
      floors.push(f);
      fracs.push(e - f);
      floorSum += f;
    }
    var left = totalCents - floorSum;
    var order = fracs.map(function (frac, idx) { return { frac: frac, idx: idx }; })
      .sort(function (a, b) {
        if (b.frac !== a.frac) return b.frac - a.frac;
        return a.idx - b.idx;
      });
    var cents = floors.slice();
    for (var r = 0; r < left; r++) cents[order[r % n].idx] += 1;
    return cents;
  }

  function computeUtilitySplit(i) {
    var totalBill = Math.max(0, num(i.totalBill));
    var nUnits = Math.max(1, Math.min(MAX_UNITS, Math.round(num(i.nUnits, 1))));
    var method = METHODS[i.method] ? i.method : 'equal';
    var blendWeight = Math.max(0, Math.min(100, num(i.blendWeight, 50)));
    var adminFee = Math.max(0, num(i.adminFee));
    var rawUnits = Array.isArray(i.units) ? i.units : [];
    var unitsIn = [];
    for (var u = 0; u < nUnits; u++) {
      var src = rawUnits[u] || {};
      unitsIn.push({
        occupants: Math.max(0, num(src.occupants)),
        sqft: Math.max(0, num(src.sqft))
      });
    }

    var totOcc = 0, totSqft = 0;
    for (var a = 0; a < nUnits; a++) {
      totOcc += unitsIn[a].occupants;
      totSqft += unitsIn[a].sqft;
    }

    var weights = [];
    for (var b = 0; b < nUnits; b++) {
      var occ = unitsIn[b].occupants;
      var sq = unitsIn[b].sqft;
      if (method === 'equal') {
        weights.push(1);
      } else if (method === 'occupants') {
        weights.push(totOcc > 0 ? occ : 1);
      } else if (method === 'sqft') {
        weights.push(totSqft > 0 ? sq : 1);
      } else {
        // blended
        var occShare = totOcc > 0 ? occ / totOcc : 1 / nUnits;
        var sqShare = totSqft > 0 ? sq / totSqft : 1 / nUnits;
        weights.push((blendWeight / 100) * occShare + ((100 - blendWeight) / 100) * sqShare);
      }
    }

    var totalCents = Math.round(Number((totalBill * 100).toFixed(6)));
    var shareCents = allocateCents(totalCents, weights);
    var allocatedCents = 0;
    var units = [];
    for (var c = 0; c < nUnits; c++) {
      var billShare = shareCents[c] / 100;
      allocatedCents += shareCents[c];
      var pct = totalCents > 0 ? (shareCents[c] / totalCents) * 100 : (nUnits > 0 ? 100 / nUnits : 0);
      var totalDue = roundMoney(billShare + adminFee);
      units.push({
        index: c + 1,
        occupants: unitsIn[c].occupants,
        sqft: unitsIn[c].sqft,
        weight: weights[c],
        billShare: billShare,
        percent: pct,
        adminFee: adminFee,
        totalDue: totalDue
      });
    }

    var totalAllocated = allocatedCents / 100;
    var totalAdmin = roundMoney(adminFee * nUnits);
    var totalRecovered = roundMoney(totalAllocated + totalAdmin);
    var balances = allocatedCents === totalCents;

    return {
      totalBill: totalBill,
      nUnits: nUnits,
      method: method,
      blendWeight: method === 'blended' ? blendWeight : null,
      adminFee: adminFee,
      totalOccupants: totOcc,
      totalSqft: totSqft,
      units: units,
      totalAllocated: totalAllocated,
      totalAdmin: totalAdmin,
      totalRecovered: totalRecovered,
      balances: balances
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { computeUtilitySplit: computeUtilitySplit, MAX_UNITS: MAX_UNITS };
  }
  root.HostLedgerUtilitySplit = { computeUtilitySplit: computeUtilitySplit, MAX_UNITS: MAX_UNITS };

  if (typeof document === 'undefined') { return; }

  var money = function (v) {
    var cents = Math.round(Number((Math.abs(v) * 100).toFixed(6)));
    var s = (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (v < 0 && cents !== 0 ? '-$' : '$') + s;
  };
  var pct = function (v) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    var s = v.toFixed(2);
    if (s === '-0.00') s = '0.00';
    return s + '%';
  };

  function readUnits(n) {
    var out = [];
    for (var i = 1; i <= n; i++) {
      var occEl = document.getElementById('u' + i + '-occ');
      var sqEl = document.getElementById('u' + i + '-sqft');
      out.push({
        occupants: occEl ? occEl.value : 0,
        sqft: sqEl ? sqEl.value : 0
      });
    }
    return out;
  }

  function syncUnitRows(n, method) {
    var needsDetail = method === 'occupants' || method === 'sqft' || method === 'blended';
    var occOn = method === 'occupants' || method === 'blended';
    var sqOn = method === 'sqft' || method === 'blended';
    for (var i = 1; i <= MAX_UNITS; i++) {
      var row = document.getElementById('unit-row-' + i);
      if (!row) continue;
      var show = i <= n;
      row.hidden = !show;
      var occ = document.getElementById('u' + i + '-occ');
      var sq = document.getElementById('u' + i + '-sqft');
      if (occ) occ.disabled = !show || !occOn;
      if (sq) sq.disabled = !show || !sqOn;
    }
    var detail = document.getElementById('unit-details');
    if (detail) detail.hidden = !needsDetail;
    var blendField = document.getElementById('blendWeight');
    if (blendField) blendField.disabled = method !== 'blended';
  }

  function renderTable(r) {
    var tb = document.getElementById('share-tbody');
    if (!tb) return;
    var html = '';
    for (var i = 0; i < r.units.length; i++) {
      var u = r.units[i];
      html += '<tr>'
        + '<th scope="row">Unit ' + u.index + '</th>'
        + '<td class="n">' + money(u.billShare) + '</td>'
        + '<td class="n">' + pct(u.percent) + '</td>'
        + '<td class="n">' + money(u.adminFee) + '</td>'
        + '<td class="n">' + money(u.totalDue) + '</td>'
        + '</tr>';
    }
    tb.innerHTML = html;
  }

  function run() {
    var f = document.getElementById('rubs-form');
    if (!f) { return; }
    var get = function (id) { return document.getElementById(id).value; };
    var set = function (id, t) { document.getElementById(id).textContent = t; };
    var c = f.querySelector('input[name="method"]:checked');
    var method = c ? c.value : 'equal';
    var nUnits = Math.max(1, Math.min(MAX_UNITS, Math.round(num(get('nUnits'), 1))));
    syncUnitRows(nUnits, method);
    var r = computeUtilitySplit({
      totalBill: get('totalBill'),
      nUnits: nUnits,
      method: method,
      blendWeight: get('blendWeight'),
      adminFee: get('adminFee'),
      units: readUnits(nUnits)
    });
    set('out-recovered', money(r.totalRecovered));
    set('out-recovered-detail', money(r.totalAllocated) + ' bill + ' + money(r.totalAdmin) + ' admin fees');
    set('out-allocated', money(r.totalAllocated));
    set('out-allocated-detail', r.nUnits + ' unit' + (r.nUnits === 1 ? '' : 's') + ' · ' + r.method
      + (r.method === 'blended' ? ' (' + r.blendWeight + '% occupants)' : ''));
    set('out-check', r.balances ? 'Balances' : 'Does not balance');
    set('out-check-detail', r.balances
      ? money(r.totalAllocated) + ' allocated = ' + money(r.totalBill) + ' bill (cents reconciled)'
      : money(r.totalAllocated) + ' allocated vs ' + money(r.totalBill) + ' bill');
    set('out-admin', money(r.totalAdmin));
    set('out-admin-detail', money(r.adminFee) + ' × ' + r.nUnits + ' unit' + (r.nUnits === 1 ? '' : 's'));
    renderTable(r);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var f = document.getElementById('rubs-form');
    if (!f) { return; }
    f.addEventListener('input', run);
    f.addEventListener('change', run);
    f.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    f.addEventListener('reset', function () { setTimeout(run, 0); });
    run();
  });
})(typeof window !== 'undefined' ? window : globalThis);
