/* HostLedger — short-term rental occupancy rate, ADR and RevPAR calculator (estimates only). No tracking, no network calls. */
(function (root) {
  'use strict';

  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }

  /**
   * available nights = nights in period - owner/maintenance blocked nights
   * occupancy        = booked nights / available nights
   * ADR              = rental revenue / booked nights
   * RevPAR           = rental revenue / available nights (= ADR x occupancy)
   * Returns null for ratios whose denominator is 0.
   */
  function computeOccupancy(i) {
    var nights = Math.max(0, num(i.nightsInPeriod));
    var blocked = Math.min(nights, Math.max(0, num(i.blockedNights)));
    var booked = Math.max(0, num(i.bookedNights));
    var revenue = Math.max(0, num(i.revenue));
    var available = nights - blocked;
    return {
      nights: nights, blocked: blocked, booked: booked, revenue: revenue, available: available,
      vacantNights: Math.max(0, available - booked), overbooked: booked > available,
      occupancyPct: available > 0 ? booked / available * 100 : null,
      grossOccupancyPct: nights > 0 ? booked / nights * 100 : null,
      adr: booked > 0 ? revenue / booked : null,
      revpar: available > 0 ? revenue / available : null
    };
  }

  /** rows: array of {nightsInPeriod, blockedNights, bookedNights, revenue}; total = ratios of the summed nights/revenue. */
  function computeOccupancyYear(rows) {
    var months = rows.map(computeOccupancy);
    var sum = function (k) { return months.reduce(function (a, m) { return a + m[k]; }, 0); };
    var total = computeOccupancy({ nightsInPeriod: sum('nights'), blockedNights: sum('blocked'),
                                   bookedNights: sum('booked'), revenue: sum('revenue') });
    return { months: months, total: total };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { computeOccupancy: computeOccupancy, computeOccupancyYear: computeOccupancyYear };
  }
  root.HostLedgerOccupancy = { computeOccupancy: computeOccupancy, computeOccupancyYear: computeOccupancyYear };

  if (typeof document === 'undefined') { return; }

  var money = function (v) {
    var cents = Math.round(Number((Math.abs(v) * 100).toFixed(6)));
    var s = (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (v < 0 && cents !== 0 ? '-$' : '$') + s;
  };
  var pct = function (v) { return v === null ? '—' : v.toFixed(1) + '%'; };
  var m$ = function (v) { return v === null ? '—' : money(v); };
  var n = function (v) { return (Math.round(v * 10) / 10).toLocaleString('en-US', { maximumFractionDigits: 1 }); };

  function run() {
    var f = document.getElementById('occ-form');
    if (!f) { return; }
    var get = function (id) { return document.getElementById(id).value; };
    var set = function (id, t) { document.getElementById(id).textContent = t; };
    var r = computeOccupancy({ nightsInPeriod: get('nightsInPeriod'), blockedNights: get('blockedNights'),
                               bookedNights: get('bookedNights'), revenue: get('revenue') });
    set('out-occ', pct(r.occupancyPct));
    set('out-occ-detail', r.overbooked ? 'Booked nights are more than available nights. Check the numbers.'
      : n(r.booked) + ' booked of ' + n(r.available) + ' available nights · ' + n(r.vacantNights) + ' left empty');
    set('out-adr', m$(r.adr));
    set('out-adr-detail', r.adr === null ? 'Enter booked nights to see ADR.' : 'rental revenue ÷ booked nights');
    set('out-revpar', m$(r.revpar));
    set('out-revpar-detail', r.revpar === null ? 'No available nights in this period.' : 'rental revenue ÷ available nights');
    set('out-avail', n(r.available));
    set('out-avail-detail', n(r.nights) + ' nights − ' + n(r.blocked) + ' blocked. Counting every night as available, occupancy would be ' + pct(r.grossOccupancyPct));
  }

  function runYear() {
    var f = document.getElementById('occ-year-form');
    if (!f) { return; }
    var get = function (id) { return document.getElementById(id).value; };
    var set = function (id, t) { document.getElementById(id).textContent = t; };
    var rows = [];
    for (var k = 1; k <= 12; k++) {
      rows.push({ nightsInPeriod: get('m' + k + '-nights'), blockedNights: get('m' + k + '-blocked'),
                  bookedNights: get('m' + k + '-booked'), revenue: get('m' + k + '-revenue') });
    }
    var y = computeOccupancyYear(rows);
    y.months.forEach(function (m, idx) {
      var p = 'm' + (idx + 1);
      set(p + '-occ', m.overbooked ? 'check' : pct(m.occupancyPct));
      set(p + '-adr', m$(m.adr));
      set(p + '-revpar', m$(m.revpar));
    });
    var t = y.total;
    set('mt-nights', n(t.nights)); set('mt-blocked', n(t.blocked)); set('mt-booked', n(t.booked));
    set('mt-revenue', money(t.revenue)); set('mt-occ', pct(t.occupancyPct)); set('mt-adr', m$(t.adr)); set('mt-revpar', m$(t.revpar));
  }

  document.addEventListener('DOMContentLoaded', function () {
    [['occ-form', run], ['occ-year-form', runYear]].forEach(function (pair) {
      var f = document.getElementById(pair[0]);
      if (!f) { return; }
      f.addEventListener('input', pair[1]);
      f.addEventListener('change', pair[1]);
      f.addEventListener('submit', function (e) { e.preventDefault(); pair[1](); });
      f.addEventListener('reset', function () { setTimeout(pair[1], 0); });
      pair[1]();
    });
  });
})(typeof window !== 'undefined' ? window : globalThis);
