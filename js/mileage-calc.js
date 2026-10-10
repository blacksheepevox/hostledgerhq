/* HostLedger — rental property mileage deduction calculator (estimates only). No tracking, no network calls. */
(function (root) {
  'use strict';

  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /**
   * miles = trips per month x round-trip miles x months + one-off extra miles
   * Optional mid-period rate change (2026: IRS business rate 72.5 cents Jan 1-Jun 30, 76 cents Jul 1-Dec 31):
   *   earlyMonths (0..months) of regular miles use earlyRateCents; the remaining regular miles and all
   *   one-off extra miles use rateCents (the current rate). earlyMonths missing/0 = one rate for everything.
   * mileage amount = earlyMiles x earlyRate + lateMiles x rate (rates in cents per mile, user-editable)
   * total = mileage amount + actual parking/tolls for the same period
   */
  function computeMileage(i) {
    var trips = Math.max(0, num(i.tripsPerMonth));
    var roundTrip = Math.max(0, num(i.roundTripMiles));
    var months = clamp(Math.round(num(i.months, 12)), 1, 12);
    var extra = Math.max(0, num(i.extraMiles));
    var rateCents = Math.max(0, num(i.rateCents));
    var earlyMonths = clamp(Math.round(num(i.earlyMonths, 0)), 0, months);
    var earlyRateCents = Math.max(0, num(i.earlyRateCents));
    var parkingTolls = Math.max(0, num(i.parkingTolls));

    var tripCount = trips * months;
    var regularMiles = trips * roundTrip * months;
    var earlyMiles = trips * roundTrip * earlyMonths;
    var lateMiles = regularMiles - earlyMiles + extra;
    var miles = regularMiles + extra;
    var earlyAmount = earlyMonths > 0 ? earlyMiles * earlyRateCents / 100 : 0;
    var lateAmount = lateMiles * rateCents / 100;
    var mileageAmount = earlyAmount + lateAmount;
    var total = mileageAmount + parkingTolls;

    return {
      months: months, tripCount: tripCount, regularMiles: regularMiles, extraMiles: extra, miles: miles,
      milesPerMonth: miles / months, rateCents: rateCents, earlyMonths: earlyMonths, earlyRateCents: earlyRateCents,
      earlyMiles: earlyMiles, lateMiles: lateMiles, earlyAmount: earlyAmount, lateAmount: lateAmount,
      mileageAmount: mileageAmount, parkingTolls: parkingTolls, total: total, perMonth: total / months
    };
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { computeMileage: computeMileage }; }
  root.HostLedgerMileage = { computeMileage: computeMileage };

  if (typeof document === 'undefined') { return; }

  var money = function (v) {
    var cents = Math.round(Number((Math.abs(v) * 100).toFixed(6)));
    var s = (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (v < 0 && cents !== 0 ? '-$' : '$') + s;
  };
  var miles = function (v) { return (Math.round(v * 10) / 10).toLocaleString('en-US', { maximumFractionDigits: 1 }); };

  function run() {
    var f = document.getElementById('mi-form');
    if (!f) { return; }
    var get = function (id) { return document.getElementById(id).value; };
    var set = function (id, t) { document.getElementById(id).textContent = t; };
    var r = computeMileage({
      tripsPerMonth: get('tripsPerMonth'), roundTripMiles: get('roundTripMiles'), months: get('months'),
      extraMiles: get('extraMiles'), rateCents: get('rateCents'), earlyMonths: get('earlyMonths'),
      earlyRateCents: get('earlyRateCents'), parkingTolls: get('parkingTolls')
    });
    document.getElementById('earlyRateCents').disabled = r.earlyMonths === 0;
    var mo = r.months === 1 ? '1 month' : r.months + ' months';
    set('out-miles', miles(r.miles) + ' mi');
    set('out-miles-detail', miles(r.regularMiles) + ' mi from ' + miles(r.tripCount) + ' trips over ' + mo + ' + ' + miles(r.extraMiles) + ' extra mi');
    set('out-mileage', money(r.mileageAmount));
    set('out-mileage-detail', r.earlyMonths > 0
      ? miles(r.earlyMiles) + ' mi × ' + r.earlyRateCents + '¢ (first ' + r.earlyMonths + (r.earlyMonths === 1 ? ' month' : ' months') + ') + ' +
        miles(r.lateMiles) + ' mi × ' + r.rateCents + '¢'
      : miles(r.miles) + ' mi × ' + r.rateCents + '¢ per mile');
    set('out-total', money(r.total));
    set('out-total-detail', 'mileage ' + money(r.mileageAmount) + ' + parking/tolls ' + money(r.parkingTolls) + ' for ' + mo);
    set('out-permonth', money(r.perMonth));
    set('out-permonth-detail', 'about ' + miles(r.milesPerMonth) + ' business miles per month');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var f = document.getElementById('mi-form');
    if (!f) { return; }
    f.addEventListener('input', run);
    f.addEventListener('change', run);
    f.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    f.addEventListener('reset', function () { setTimeout(run, 0); });
    run();
  });
})(typeof window !== 'undefined' ? window : globalThis);
