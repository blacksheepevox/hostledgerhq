/* HostLedger — security deposit refund calculator (estimates only). No tracking, no network calls. */
(function (root) {
  'use strict';

  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }

  /**
   * totalDeductions = unpaidRent + cleaning + repairs + other
   * balance         = depositHeld + interestOwed - totalDeductions
   * refundDue       = max(0, balance)
   * stillOwed       = max(0, -balance)
   * Interest is an editable dollar field only; this calculator does not encode state statutes.
   */
  function computeDeposit(i) {
    var depositHeld = Math.max(0, num(i.depositHeld));
    var unpaidRent = Math.max(0, num(i.unpaidRent));
    var cleaning = Math.max(0, num(i.cleaning));
    var repairs = Math.max(0, num(i.repairs));
    var other = Math.max(0, num(i.other));
    var interestOwed = Math.max(0, num(i.interestOwed));

    var totalDeductions = unpaidRent + cleaning + repairs + other;
    var balance = depositHeld + interestOwed - totalDeductions;
    var refundDue = Math.max(0, balance);
    var stillOwed = Math.max(0, -balance);

    return {
      depositHeld: depositHeld, unpaidRent: unpaidRent, cleaning: cleaning, repairs: repairs,
      other: other, interestOwed: interestOwed, totalDeductions: totalDeductions,
      balance: balance, refundDue: refundDue, stillOwed: stillOwed
    };
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { computeDeposit: computeDeposit }; }
  root.HostLedgerDeposit = { computeDeposit: computeDeposit };

  if (typeof document === 'undefined') { return; }

  var money = function (v) {
    var cents = Math.round(Number((Math.abs(v) * 100).toFixed(6)));
    var s = (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (v < 0 && cents !== 0 ? '-$' : '$') + s;
  };

  function run() {
    var f = document.getElementById('dep-form');
    if (!f) { return; }
    var get = function (id) { return document.getElementById(id).value; };
    var set = function (id, t) { document.getElementById(id).textContent = t; };
    var r = computeDeposit({
      depositHeld: get('depositHeld'), unpaidRent: get('unpaidRent'), cleaning: get('cleaning'),
      repairs: get('repairs'), other: get('other'), interestOwed: get('interestOwed')
    });
    set('out-deductions', money(r.totalDeductions));
    set('out-deductions-detail',
      'unpaid rent ' + money(r.unpaidRent) + ' · cleaning ' + money(r.cleaning) +
      ' · repairs ' + money(r.repairs) + ' · other ' + money(r.other));
    set('out-refund', money(r.refundDue));
    var refundEl = document.getElementById('out-refund');
    var owedEl = document.getElementById('out-owed');
    if (r.stillOwed > 0) {
      refundEl.className = 'big';
      set('out-refund-detail', 'deposit ' + money(r.depositHeld) +
        (r.interestOwed > 0 ? ' + interest ' + money(r.interestOwed) : '') +
        ' − deductions ' + money(r.totalDeductions) + ' leaves nothing to refund');
      set('out-owed', money(r.stillOwed));
      owedEl.className = 'big neg';
      set('out-owed-detail', 'deductions exceed deposit' +
        (r.interestOwed > 0 ? ' + interest' : '') + ' by ' + money(r.stillOwed));
    } else {
      refundEl.className = 'big pos';
      set('out-refund-detail', 'deposit ' + money(r.depositHeld) +
        (r.interestOwed > 0 ? ' + interest ' + money(r.interestOwed) : '') +
        ' − deductions ' + money(r.totalDeductions));
      set('out-owed', money(0));
      owedEl.className = 'big';
      set('out-owed-detail', 'deductions do not exceed the deposit' +
        (r.interestOwed > 0 ? ' + interest' : ''));
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var f = document.getElementById('dep-form');
    if (!f) { return; }
    f.addEventListener('input', run);
    f.addEventListener('change', run);
    f.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    f.addEventListener('reset', function () { setTimeout(run, 0); });
    run();
  });
})(typeof window !== 'undefined' ? window : globalThis);
