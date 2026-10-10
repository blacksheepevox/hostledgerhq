/* HostLedger — short-term rental profit calculator (estimates only). No tracking, no network calls. */
(function (root) {
  'use strict';

  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /**
   * All money inputs are per month except per-night / per-stay values.
   * taxMode: 'platform' (platform collects + remits, no effect on your net)
   *          'host'     (you remit occupancy tax out of what guests pay you)
   */
  function computeStr(i) {
    var rate = Math.max(0, num(i.nightlyRate));
    var occ = clamp(num(i.occupancyPct), 0, 100) / 100;
    var nights = clamp(num(i.nightsPerMonth, 30), 1, 31);
    var cleanFee = Math.max(0, num(i.cleaningFeePerStay));
    var stayLen = Math.max(1, num(i.avgStayNights, 1));
    var platPct = clamp(num(i.platformFeePct), 0, 100) / 100;
    var cleanCost = Math.max(0, num(i.cleaningCostPerTurnover));
    var taxPct = i.taxMode === 'host' ? clamp(num(i.occupancyTaxPct), 0, 100) / 100 : 0;
    var fixed = Math.max(0, num(i.mortgageOrRent)) + Math.max(0, num(i.utilities)) +
                Math.max(0, num(i.supplies)) + Math.max(0, num(i.otherFixed));

    var bookedNights = nights * occ;
    var stays = bookedNights / stayLen;
    var lodging = bookedNights * rate;
    var cleaningFees = stays * cleanFee;
    var revenue = lodging + cleaningFees;
    var platformFees = revenue * platPct;
    var occupancyTax = revenue * taxPct;
    var cleaningCosts = stays * cleanCost;
    var variable = platformFees + occupancyTax + cleaningCosts;
    var expenses = variable + fixed;
    var net = revenue - expenses;

    // Contribution per booked night after per-night and per-stay costs.
    var keep = 1 - platPct - taxPct;
    var perNight = rate * keep + (cleanFee * keep - cleanCost) / stayLen;
    var breakEvenNights = perNight > 0 ? fixed / perNight : Infinity;
    var breakEvenOcc = perNight > 0 ? breakEvenNights / nights * 100 : Infinity;

    return {
      bookedNights: bookedNights, stays: stays, lodging: lodging, cleaningFees: cleaningFees,
      revenue: revenue, platformFees: platformFees, occupancyTax: occupancyTax,
      cleaningCosts: cleaningCosts, fixed: fixed, expenses: expenses, net: net,
      annualNet: net * 12, contributionPerNight: perNight,
      breakEvenNights: breakEvenNights, breakEvenOccupancyPct: breakEvenOcc
    };
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { computeStr: computeStr }; }
  root.HostLedgerStr = { computeStr: computeStr };

  if (typeof document === 'undefined') { return; }

  var money = function (v) {
    // Round half up to cents on the absolute value (avoids 123.8249999 showing as .82).
    var cents = Math.round(Number((Math.abs(v) * 100).toFixed(6)));
    var s = (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (v < 0 && cents !== 0 ? '-$' : '$') + s;
  };

  function run() {
    var f = document.getElementById('str-form');
    if (!f) { return; }
    var get = function (id) { return document.getElementById(id).value; };
    var set = function (id, t) { document.getElementById(id).textContent = t; };
    var taxModeEl = function () { var c = f.querySelector('input[name="taxMode"]:checked'); return c ? c.value : 'platform'; };
    var r = computeStr({
      nightlyRate: get('nightlyRate'), occupancyPct: get('occupancyPct'), nightsPerMonth: get('nightsPerMonth'),
      cleaningFeePerStay: get('cleaningFeePerStay'), avgStayNights: get('avgStayNights'),
      platformFeePct: get('platformFeePct'), cleaningCostPerTurnover: get('cleaningCostPerTurnover'),
      mortgageOrRent: get('mortgageOrRent'), utilities: get('utilities'), supplies: get('supplies'),
      otherFixed: get('otherFixed'), occupancyTaxPct: get('occupancyTaxPct'), taxMode: taxModeEl()
    });
    document.getElementById('occupancyTaxPct').disabled = taxModeEl() !== 'host';
    set('out-revenue', money(r.revenue));
    set('out-revenue-detail', r.bookedNights.toFixed(1) + ' booked nights · ' + r.stays.toFixed(1) + ' stays · lodging ' + money(r.lodging) + ' + cleaning fees ' + money(r.cleaningFees));
    set('out-expenses', money(r.expenses));
    set('out-expenses-detail', 'platform ' + money(r.platformFees) + ' · occupancy tax ' + money(r.occupancyTax) + ' · cleaning ' + money(r.cleaningCosts) + ' · fixed ' + money(r.fixed));
    set('out-net', money(r.net));
    set('out-net-detail', 'about ' + money(r.annualNet) + ' per year at this pace');
    document.getElementById('out-net').className = 'big ' + (r.net < 0 ? 'neg' : 'pos');
    if (!isFinite(r.breakEvenOccupancyPct)) {
      set('out-be', 'Not reachable');
      set('out-be-detail', 'Each booked night loses money after fees and cleaning, so no occupancy covers fixed costs.');
    } else if (r.breakEvenOccupancyPct > 100) {
      set('out-be', r.breakEvenOccupancyPct.toFixed(1) + '%');
      set('out-be-detail', 'Above 100%: fixed costs are not covered even when fully booked.');
    } else {
      set('out-be', r.breakEvenOccupancyPct.toFixed(1) + '%');
      set('out-be-detail', 'about ' + r.breakEvenNights.toFixed(1) + ' booked nights per month cover fixed costs');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var f = document.getElementById('str-form');
    if (!f) { return; }
    f.addEventListener('input', run);
    f.addEventListener('change', run);
    f.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    f.addEventListener('reset', function () { setTimeout(run, 0); });
    run();
  });
})(typeof window !== 'undefined' ? window : globalThis);
