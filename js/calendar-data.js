/* بدايات الشهور الهجرية المعتمدة (بالرؤية) كما أعلنها المرجع.
 * المصدر: تقويم حوزة الهدى للدراسات الإسلامية — السنابس، مملكة البحرين
 *         https://www.alhodacenter.com/calendar/year/1448
 * الصيغة: "سنة-شهر": [سنة ميلادية، شهر ميلادي، يوم] هو أول يوم في الشهر الهجري.
 *
 * لإضافة شهر جديد بعد إعلانه: أضف سطراً هنا، وغيّر رقم نسخة الكاش في sw.js.
 * الشهور غير الموجودة هنا تُحسب تقديرياً (تقويم حسابي) حتى تُضاف.
 *
 * ملاحظة: الحوزة تطبع ٣٠ صفاً لكل شهر قبل الرؤية، فإذا تطابق اليوم الأخير مع أول
 * الشهر الذي بعده يكون الشهر ٢٩ يوماً (كما في محرم وربيع الأول).
 */
(function (root) {
  'use strict';

  const HAWZA = {
    '1448-1': [2026, 6, 17],   // محرم
    '1448-2': [2026, 7, 16],   // صفر
    '1448-3': [2026, 8, 15],   // ربيع الأول
    '1448-4': [2026, 9, 13],   // ربيع الآخر
    '1448-5': [2026, 10, 13],  // جمادى الأولى
    '1448-6': [2026, 11, 12]   // جمادى الآخرة
  };

  // إعدادات الحساب المطابقة لجداول الحوزة (قيست على جدول جمادى الآخرة ١٤٤٨، الفرق أقل من دقيقة)
  const PRAYER_PROFILES = {
    hawza: { fajr: 16.5, midnight: 'sunrise' },   // منتصف الليل = بين الغروب والشروق
    general: { fajr: 16, midnight: 'fajr' }       // منتصف الليل = بين الغروب والفجر
  };

  function toJdnMap(table, gregToJdn) {
    const out = {};
    Object.keys(table).forEach(function (k) {
      const d = table[k];
      out[k] = gregToJdn(d[0], d[1], d[2]);
    });
    return out;
  }

  const api = { HAWZA: HAWZA, PRAYER_PROFILES: PRAYER_PROFILES, toJdnMap: toJdnMap };
  root.CalendarData = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
