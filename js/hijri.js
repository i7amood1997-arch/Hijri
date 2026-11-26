/* تحويل التاريخ الهجري/الميلادي.
 * الأساس: التقويم الهجري الحسابي (civil) ثم يُضبط بداية كل شهر يدوياً،
 * لأن بداية الشهر عند الشيعة بالرؤية وليست بالحساب.
 */
(function (root) {
  'use strict';

  const HIJRI_MONTHS = [
    'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
    'رجب', 'شعبان', 'شهر رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
  ];
  const GREG_MONTHS = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  // رقم اليوم اليولياني (JDN) من تاريخ ميلادي
  function gregToJdn(y, m, d) {
    const a = Math.floor((14 - m) / 12);
    const yy = y + 4800 - a;
    const mm = m + 12 * a - 3;
    return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) -
      Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  }

  function jdnToGreg(j) {
    const a = j + 32044;
    const b = Math.floor((4 * a + 3) / 146097);
    const c = a - Math.floor(146097 * b / 4);
    const d = Math.floor((4 * c + 3) / 1461);
    const e = c - Math.floor(1461 * d / 4);
    const m = Math.floor((5 * e + 2) / 153);
    return {
      y: 100 * b + d - 4800 + Math.floor(m / 10),
      m: m + 3 - 12 * Math.floor(m / 10),
      d: e - Math.floor((153 * m + 2) / 5) + 1
    };
  }

  // 0 = الأحد ... 6 = السبت
  function weekday(jdn) { return (jdn + 1) % 7; }

  // أول يوم في الشهر حسب التقويم الحسابي
  function civilStart(y, m) {
    return 1 + Math.ceil(29.5 * (m - 1)) + (y - 1) * 354 + Math.floor((3 + 11 * y) / 30) + 1948439;
  }

  function nextYM(y, m) { return m === 12 ? [y + 1, 1] : [y, m + 1]; }
  function prevYM(y, m) { return m === 1 ? [y - 1, 12] : [y, m - 1]; }

  /**
   * opts.offset    : إزاحة عامة بالأيام على التقويم الحسابي
   * opts.overrides : { "1448-5": jdn } بداية شهر محدد (بالرؤية)
   */
  function create(opts) {
    const offset = (opts && opts.offset) || 0;
    const overrides = (opts && opts.overrides) || {};

    function monthStart(y, m) {
      const v = overrides[y + '-' + m];
      return v != null ? v : civilStart(y, m) + offset;
    }

    function monthLength(y, m) {
      const n = nextYM(y, m);
      return monthStart(n[0], n[1]) - monthStart(y, m);
    }

    function fromJdn(jdn) {
      let y = Math.floor((30 * (jdn - offset - 1948440) + 10646) / 10631);
      let m = Math.min(12, Math.max(1, Math.ceil((jdn - offset - 29 - civilStart(y, 1)) / 29.5) + 1));
      let guard = 0;
      while (monthStart(y, m) > jdn && guard++ < 60) { const p = prevYM(y, m); y = p[0]; m = p[1]; }
      while (guard++ < 120) {
        const n = nextYM(y, m);
        if (monthStart(n[0], n[1]) <= jdn) { y = n[0]; m = n[1]; } else break;
      }
      return { y: y, m: m, d: jdn - monthStart(y, m) + 1, jdn: jdn };
    }

    function toJdn(y, m, d) { return monthStart(y, m) + d - 1; }

    return { monthStart: monthStart, monthLength: monthLength, fromJdn: fromJdn, toJdn: toJdn };
  }

  const api = {
    HIJRI_MONTHS: HIJRI_MONTHS, GREG_MONTHS: GREG_MONTHS, WEEKDAYS: WEEKDAYS,
    gregToJdn: gregToJdn, jdnToGreg: jdnToGreg, weekday: weekday,
    civilStart: civilStart, nextYM: nextYM, prevYM: prevYM, create: create
  };
  root.Hijri = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
