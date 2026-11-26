/* حساب مواقيت الصلاة على المذهب الجعفري.
 *  الفجر: 16°  |  المغرب: 4° (ذهاب الحمرة المشرقية)  |  العشاء: 14°
 *  منتصف الليل الشرعي: منتصف المدة بين الغروب وفجر اليوم التالي.
 * الخوارزمية: موضع الشمس المبسّط (نفس أسلوب PrayTimes).
 * كل الأوقات تُرجع كساعات عشرية بالتوقيت المحلي للموقع.
 */
(function (root) {
  'use strict';

  const JAFARI = { fajr: 16, maghrib: 4, isha: 14 };
  const RISE_SET = 0.833; // انكسار الغلاف الجوي + نصف قطر الشمس
  const R = Math.PI / 180;
  const sin = function (d) { return Math.sin(d * R); };
  const cos = function (d) { return Math.cos(d * R); };
  const fixA = function (a) { return a - 360 * Math.floor(a / 360); };
  const fixH = function (a) { return a - 24 * Math.floor(a / 24); };

  function sunPos(jd) {
    const D = jd - 2451545.0;
    const g = fixA(357.529 + 0.98560028 * D);
    const q = fixA(280.459 + 0.98564736 * D);
    const L = fixA(q + 1.915 * sin(g) + 0.020 * sin(2 * g));
    const e = 23.439 - 0.00000036 * D;
    const RA = fixH(Math.atan2(cos(e) * sin(L), cos(L)) / R / 15);
    return { decl: Math.asin(sin(e) * sin(L)) / R, eqt: q / 15 - RA };
  }

  function midDay(jd, t) { return fixH(12 - sunPos(jd + t).eqt); }

  function angleTime(jd, lat, angle, t, ccw) {
    const decl = sunPos(jd + t).decl;
    const c = (-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat));
    if (c > 1 || c < -1) return NaN;
    const d = Math.acos(c) / R / 15;
    return midDay(jd, t) + (ccw ? -d : d);
  }

  function rawTimes(jdn, lat, lng, tz, p) {
    const jd = jdn - 0.5 - lng / 360;
    let t = { fajr: 5, sunrise: 6, dhuhr: 12, sunset: 18, maghrib: 18, isha: 18 };
    for (let i = 0; i < 3; i++) {
      t = {
        fajr: angleTime(jd, lat, p.fajr, t.fajr / 24, true),
        sunrise: angleTime(jd, lat, RISE_SET, t.sunrise / 24, true),
        dhuhr: midDay(jd, t.dhuhr / 24),
        sunset: angleTime(jd, lat, RISE_SET, t.sunset / 24, false),
        maghrib: angleTime(jd, lat, p.maghrib, t.maghrib / 24, false),
        isha: angleTime(jd, lat, p.isha, t.isha / 24, false)
      };
    }
    const shift = tz - lng / 15;
    Object.keys(t).forEach(function (k) { t[k] += shift; });
    return t;
  }

  /**
   * jdn: رقم اليوم اليولياني للتاريخ المحلي
   * loc: { lat, lng, tz }
   * adj: تعديل بالدقائق لكل وقت (اختياري)
   */
  function times(jdn, loc, adj) {
    const p = JAFARI;
    const today = rawTimes(jdn, loc.lat, loc.lng, loc.tz, p);
    const next = rawTimes(jdn + 1, loc.lat, loc.lng, loc.tz, p);
    const night = fixH(next.fajr - today.sunset);
    today.midnight = today.sunset + night / 2;
    today.nextFajr = next.fajr + 24;
    if (adj) {
      Object.keys(adj).forEach(function (k) {
        if (today[k] != null) today[k] += (adj[k] || 0) / 60;
      });
      if (adj.fajr) today.nextFajr += adj.fajr / 60;
    }
    return today;
  }

  const api = { JAFARI: JAFARI, times: times };
  root.Prayer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
