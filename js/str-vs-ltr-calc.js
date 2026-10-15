/* HostLedger — Airbnb vs long-term rental calculator (estimates only). No tracking, no network calls. */
(function (root) {
  'use strict';

  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /**
   * Compare short-term (Airbnb/VRBO) monthly net to long-term rental monthly net.
   * nightsAvailable defaults to 30 when blank/invalid; avgStayNights at least 1.
   * Percents clamped 0–100. Money inputs clamped ≥ 0. Negative nets allowed.
   * Occupancy/lodging tax is omitted (typically collected and remitted separately).
   *
   * STR: bookedNights = nights × occ; stays = booked / stayLen;
   *      revenue = lodging + cleaning fees charged; platform on revenue;
   *      strNet = revenue − platform − cleaning cost − STR-only − shared.
   * LTR: effectiveRent = rent × (1 − vacancy); mgmt on effective;
   *      ltrNet = effective − mgmt − LTR-only − shared.
   * Break-even STR occupancy: occupancy where strNet equals ltrNet
   *   (contribution per booked night after platform/cleaning must be > 0).
   */
  function computeStrVsLtr(i) {
    var nightsRaw = num(i.nightsAvailable, 30);
    var nightsAvailable = nightsRaw >= 1 ? Math.min(31, nightsRaw) : 30;
    var nightlyRate = Math.max(0, num(i.nightlyRate));
    var occupancyPct = clamp(num(i.occupancyPct), 0, 100);
    var avgStayNights = Math.max(1, num(i.avgStayNights, 1));
    var cleaningFeePerStay = Math.max(0, num(i.cleaningFeePerStay));
    var cleaningCostPerStay = Math.max(0, num(i.cleaningCostPerStay));
    var platformFeePct = clamp(num(i.platformFeePct), 0, 100);
    var strOnlyCosts = Math.max(0, num(i.strOnlyCosts));

    var monthlyRent = Math.max(0, num(i.monthlyRent));
    var vacancyPct = clamp(num(i.vacancyPct), 0, 100);
    var managementPct = clamp(num(i.managementPct), 0, 100);
    var ltrOnlyCosts = Math.max(0, num(i.ltrOnlyCosts));

    var sharedFixed = Math.max(0, num(i.sharedFixed));

    var bookedNights = nightsAvailable * occupancyPct / 100;
    var stays = bookedNights / avgStayNights;
    var lodging = bookedNights * nightlyRate;
    var cleaningFees = stays * cleaningFeePerStay;
    var strRevenue = lodging + cleaningFees;
    var platformFees = strRevenue * platformFeePct / 100;
    var cleaningCosts = stays * cleaningCostPerStay;
    var strNetMonthly = strRevenue - platformFees - cleaningCosts - strOnlyCosts - sharedFixed;

    var vacancyLoss = monthlyRent * vacancyPct / 100;
    var effectiveRent = monthlyRent - vacancyLoss;
    var managementFee = effectiveRent * managementPct / 100;
    var ltrNetMonthly = effectiveRent - managementFee - ltrOnlyCosts - sharedFixed;

    var differenceMonthly = strNetMonthly - ltrNetMonthly;
    var winner = differenceMonthly > 0 ? 'str' : (differenceMonthly < 0 ? 'ltr' : 'tie');

    var keep = 1 - platformFeePct / 100;
    var contributionPerNight = nightlyRate * keep + (cleaningFeePerStay * keep - cleaningCostPerStay) / avgStayNights;
    var needed = ltrNetMonthly + strOnlyCosts + sharedFixed;
    var breakEvenOccupancyPct;
    if (contributionPerNight > 0) {
      breakEvenOccupancyPct = needed / (nightsAvailable * contributionPerNight) * 100;
    } else {
      breakEvenOccupancyPct = Infinity;
    }

    return {
      nightsAvailable: nightsAvailable, occupancyPct: occupancyPct, avgStayNights: avgStayNights,
      bookedNights: bookedNights, stays: stays, lodging: lodging, cleaningFees: cleaningFees,
      strRevenue: strRevenue, platformFees: platformFees, cleaningCosts: cleaningCosts,
      strOnlyCosts: strOnlyCosts, sharedFixed: sharedFixed,
      strNetMonthly: strNetMonthly, strNetAnnual: strNetMonthly * 12,
      monthlyRent: monthlyRent, vacancyPct: vacancyPct, vacancyLoss: vacancyLoss,
      effectiveRent: effectiveRent, managementPct: managementPct, managementFee: managementFee,
      ltrOnlyCosts: ltrOnlyCosts,
      ltrNetMonthly: ltrNetMonthly, ltrNetAnnual: ltrNetMonthly * 12,
      differenceMonthly: differenceMonthly, differenceAnnual: differenceMonthly * 12,
      winner: winner, contributionPerNight: contributionPerNight,
      breakEvenOccupancyPct: breakEvenOccupancyPct,
      platformFeePct: platformFeePct, nightlyRate: nightlyRate
    };
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { computeStrVsLtr: computeStrVsLtr }; }
  root.HostLedgerStrVsLtr = { computeStrVsLtr: computeStrVsLtr };

  if (typeof document === 'undefined') { return; }

  var money = function (v) {
    var cents = Math.round(Number((Math.abs(v) * 100).toFixed(6)));
    var s = (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (v < 0 && cents !== 0 ? '-$' : '$') + s;
  };
  var pctTxt = function (v) { return (Math.round(v * 100) / 100) + '%'; };

  function run() {
    var f = document.getElementById('svl-form');
    if (!f) { return; }
    var get = function (id) { return document.getElementById(id).value; };
    var set = function (id, t) { document.getElementById(id).textContent = t; };
    var r = computeStrVsLtr({
      nightlyRate: get('nightlyRate'), occupancyPct: get('occupancyPct'), nightsAvailable: get('nightsAvailable'),
      avgStayNights: get('avgStayNights'), cleaningFeePerStay: get('cleaningFeePerStay'),
      cleaningCostPerStay: get('cleaningCostPerStay'), platformFeePct: get('platformFeePct'),
      strOnlyCosts: get('strOnlyCosts'), monthlyRent: get('monthlyRent'), vacancyPct: get('vacancyPct'),
      managementPct: get('managementPct'), ltrOnlyCosts: get('ltrOnlyCosts'), sharedFixed: get('sharedFixed')
    });

    set('out-diff', money(Math.abs(r.differenceMonthly)));
    if (r.winner === 'str') {
      set('out-diff-detail', 'STR wins by ' + money(r.differenceMonthly) + ' / mo (' + money(r.differenceAnnual) + ' / yr)');
      document.getElementById('out-diff').className = 'big pos';
    } else if (r.winner === 'ltr') {
      set('out-diff-detail', 'LTR wins by ' + money(-r.differenceMonthly) + ' / mo (' + money(-r.differenceAnnual) + ' / yr)');
      document.getElementById('out-diff').className = 'big pos';
    } else {
      set('out-diff-detail', 'Same monthly net at these inputs');
      document.getElementById('out-diff').className = 'big';
    }

    set('out-str-net', money(r.strNetMonthly));
    set('out-str-net-detail', 'annual ' + money(r.strNetAnnual) + ' · revenue ' + money(r.strRevenue)
      + ' − platform ' + money(r.platformFees) + ' − cleaning ' + money(r.cleaningCosts)
      + ' − STR-only ' + money(r.strOnlyCosts) + ' − shared ' + money(r.sharedFixed));
    document.getElementById('out-str-net').className = 'big ' + (r.strNetMonthly < 0 ? 'neg' : 'pos');

    set('out-ltr-net', money(r.ltrNetMonthly));
    set('out-ltr-net-detail', 'annual ' + money(r.ltrNetAnnual) + ' · effective rent ' + money(r.effectiveRent)
      + ' − mgmt ' + money(r.managementFee) + ' − LTR-only ' + money(r.ltrOnlyCosts)
      + ' − shared ' + money(r.sharedFixed));
    document.getElementById('out-ltr-net').className = 'big ' + (r.ltrNetMonthly < 0 ? 'neg' : 'pos');

    set('out-str-annual', money(r.strNetAnnual));
    set('out-str-annual-detail', 'monthly STR net × 12');
    set('out-ltr-annual', money(r.ltrNetAnnual));
    set('out-ltr-annual-detail', 'monthly LTR net × 12');

    set('out-booked', r.bookedNights.toFixed(1) + ' nights');
    set('out-booked-detail', r.stays.toFixed(1) + ' stays / mo · ' + r.nightsAvailable + ' nights available');

    if (!isFinite(r.breakEvenOccupancyPct)) {
      set('out-be-occ', 'Not reachable');
      set('out-be-occ-detail', 'Each booked night loses money after fees and cleaning, so no occupancy matches LTR net.');
    } else if (r.breakEvenOccupancyPct < 0) {
      set('out-be-occ', pctTxt(r.breakEvenOccupancyPct));
      set('out-be-occ-detail', 'Below 0%: STR net beats LTR even at zero occupancy (LTR may be deeply negative).');
    } else if (r.breakEvenOccupancyPct > 100) {
      set('out-be-occ', pctTxt(r.breakEvenOccupancyPct));
      set('out-be-occ-detail', 'Above 100%: STR never catches LTR at this rate and cost structure.');
    } else {
      set('out-be-occ', pctTxt(r.breakEvenOccupancyPct));
      set('out-be-occ-detail', 'STR occupancy where monthly net equals LTR net (~'
        + (r.nightsAvailable * r.breakEvenOccupancyPct / 100).toFixed(1) + ' booked nights)');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var f = document.getElementById('svl-form');
    if (!f) { return; }
    f.addEventListener('input', run);
    f.addEventListener('change', run);
    f.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    f.addEventListener('reset', function () { setTimeout(run, 0); });
    run();
  });
})(typeof window !== 'undefined' ? window : globalThis);
