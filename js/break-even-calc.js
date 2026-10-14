/* HostLedger — Airbnb / STR break-even nightly rate calculator (estimates only). No tracking, no network calls. */
(function (root) {
  'use strict';

  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /**
   * Models lodging only (no separate cleaning fee charged to guests).
   * monthlyFixed     = max(0, monthlyFixed)
   * costPerStay      = max(0, costPerStay)     // what you pay per turnover
   * platformFeePct   = clamp(0..100); keep = 1 - fee/100; fee >= 100 → keep = 0
   * avgStayNights    = max(1, avgStayNights)
   * nightsBooked     = max(0, nightsBooked)
   * nightsAvailable  = max(0, nightsAvailable)
   * targetProfit     = max(0, targetProfit)
   * nightlyRate      = max(0, nightlyRate)     // planned rate for P&L / BE occupancy
   *
   * breakEvenRate    = nightsBooked > 0 && keep > 0
   *                    ? (monthlyFixed / nightsBooked + costPerStay / avgStayNights) / keep : null
   * rateForTarget    = nightsBooked > 0 && keep > 0
   *                    ? ((monthlyFixed + targetProfit) / nightsBooked + costPerStay / avgStayNights) / keep : null
   * contribution/night = nightlyRate * keep - costPerStay / avgStayNights
   * breakEvenNights  = contribution > 0 ? monthlyFixed / contribution : Infinity
   * breakEvenOccPct  = contribution > 0 && nightsAvailable > 0
   *                    ? breakEvenNights / nightsAvailable * 100 : null (Infinity if contribution <= 0)
   * revenue / fees / stayCosts / profit at entered nightsBooked + nightlyRate
   * Ignores taxes, seasonality, occupancy taxes, cleaning fees charged to guests.
   */
  function computeBreakEven(i) {
    var monthlyFixed = Math.max(0, num(i.monthlyFixed));
    var costPerStay = Math.max(0, num(i.costPerStay));
    var platformFeePct = clamp(num(i.platformFeePct), 0, 100);
    var keep = 1 - platformFeePct / 100;
    var avgStayNights = Math.max(1, num(i.avgStayNights, 1));
    var nightsBooked = Math.max(0, num(i.nightsBooked));
    var nightsAvailable = Math.max(0, num(i.nightsAvailable));
    var targetProfit = Math.max(0, num(i.targetProfit));
    var nightlyRate = Math.max(0, num(i.nightlyRate));

    var costPerNight = costPerStay / avgStayNights;
    var breakEvenRate = (nightsBooked > 0 && keep > 0)
      ? (monthlyFixed / nightsBooked + costPerNight) / keep : null;
    var rateForTarget = (nightsBooked > 0 && keep > 0)
      ? ((monthlyFixed + targetProfit) / nightsBooked + costPerNight) / keep : null;

    var contributionPerNight = nightlyRate * keep - costPerNight;
    var breakEvenNights = contributionPerNight > 0 ? monthlyFixed / contributionPerNight : Infinity;
    var breakEvenOccPct = contributionPerNight > 0 && nightsAvailable > 0
      ? breakEvenNights / nightsAvailable * 100
      : (contributionPerNight > 0 ? null : Infinity);

    var stays = nightsBooked / avgStayNights;
    var revenue = nightsBooked * nightlyRate;
    var platformFees = revenue * (platformFeePct / 100);
    var stayCosts = stays * costPerStay;
    var profit = revenue - platformFees - stayCosts - monthlyFixed;

    return {
      monthlyFixed: monthlyFixed, costPerStay: costPerStay, platformFeePct: platformFeePct, keep: keep,
      avgStayNights: avgStayNights, nightsBooked: nightsBooked, nightsAvailable: nightsAvailable,
      targetProfit: targetProfit, nightlyRate: nightlyRate, costPerNight: costPerNight,
      breakEvenRate: breakEvenRate, rateForTarget: rateForTarget,
      contributionPerNight: contributionPerNight, breakEvenNights: breakEvenNights,
      breakEvenOccupancyPct: breakEvenOccPct, stays: stays, revenue: revenue,
      platformFees: platformFees, stayCosts: stayCosts, profit: profit
    };
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { computeBreakEven: computeBreakEven }; }
  root.HostLedgerBreakEven = { computeBreakEven: computeBreakEven };

  if (typeof document === 'undefined') { return; }

  var money = function (v) {
    var cents = Math.round(Number((Math.abs(v) * 100).toFixed(6)));
    var s = (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (v < 0 && cents !== 0 ? '-$' : '$') + s;
  };
  var pct = function (v) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    return v.toFixed(1) + '%';
  };

  function run() {
    var f = document.getElementById('be-form');
    if (!f) { return; }
    var get = function (id) { return document.getElementById(id).value; };
    var set = function (id, t) { document.getElementById(id).textContent = t; };
    var r = computeBreakEven({
      monthlyFixed: get('monthlyFixed'), costPerStay: get('costPerStay'),
      platformFeePct: get('platformFeePct'), avgStayNights: get('avgStayNights'),
      nightsBooked: get('nightsBooked'), nightsAvailable: get('nightsAvailable'),
      targetProfit: get('targetProfit'), nightlyRate: get('nightlyRate')
    });
    set('out-be-rate', r.breakEvenRate === null ? '—' : money(r.breakEvenRate));
    set('out-be-rate-detail', r.breakEvenRate === null
      ? (r.nightsBooked <= 0 ? 'enter nights booked above zero' : (r.keep <= 0 ? 'platform fee must be under 100%' : '—'))
      : 'covers fixed costs and per-stay costs after a ' + r.platformFeePct + '% fee');
    set('out-target-rate', r.rateForTarget === null ? '—' : money(r.rateForTarget));
    set('out-target-rate-detail', r.rateForTarget === null
      ? (r.nightsBooked <= 0 || r.keep <= 0 ? 'needs nights booked and a fee under 100%' : '—')
      : 'includes $' + r.targetProfit.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' target monthly profit');
    if (!isFinite(r.breakEvenOccupancyPct)) {
      set('out-be-occ', 'Not reachable');
      set('out-be-occ-detail', 'At this nightly rate each booked night loses money after fees and per-stay costs.');
    } else if (r.breakEvenOccupancyPct === null) {
      set('out-be-occ', '—');
      set('out-be-occ-detail', 'enter nights available above zero');
    } else {
      set('out-be-occ', pct(r.breakEvenOccupancyPct));
      set('out-be-occ-detail', 'about ' + r.breakEvenNights.toFixed(1) + ' booked nights cover fixed costs at ' + money(r.nightlyRate) + '/night');
    }
    set('out-revenue', money(r.revenue));
    set('out-revenue-detail', r.nightsBooked.toFixed(1) + ' booked nights × ' + money(r.nightlyRate));
    set('out-profit', money(r.profit));
    set('out-profit-detail', 'after platform ' + money(r.platformFees) + ' · stay costs ' + money(r.stayCosts) + ' · fixed ' + money(r.monthlyFixed));
    document.getElementById('out-profit').className = 'big ' + (r.profit < 0 ? 'neg' : 'pos');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var f = document.getElementById('be-form');
    if (!f) { return; }
    f.addEventListener('input', run);
    f.addEventListener('change', run);
    f.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    f.addEventListener('reset', function () { setTimeout(run, 0); });
    run();
  });
})(typeof window !== 'undefined' ? window : globalThis);
