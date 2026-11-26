// تشغيل: node tests/test.js
const assert = require('assert');
const H = require('../js/hijri.js');
const P = require('../js/prayer.js');
const E = require('../js/events.js');

// تحويل ميلادي <-> JDN
assert.strictEqual(H.gregToJdn(2000, 1, 1), 2451545);
for (let j = 2400000; j < 2500000; j += 997) {
  const g = H.jdnToGreg(j);
  assert.strictEqual(H.gregToJdn(g.y, g.m, g.d), j);
}
assert.strictEqual(H.weekday(H.gregToJdn(2026, 11, 26)), 4); // الخميس

// الهجري: ذهاب وعودة، وطول الشهر ٢٩ أو ٣٠
const h = H.create({});
for (let j = H.gregToJdn(2020, 1, 1); j < H.gregToJdn(2035, 1, 1); j++) {
  const x = h.fromJdn(j);
  assert.strictEqual(h.toJdn(x.y, x.m, x.d), j);
  assert(x.d >= 1 && x.d <= h.monthLength(x.y, x.m));
}
for (let m = 1; m <= 12; m++) assert([29, 30].includes(h.monthLength(1448, m)));

// ضبط بداية شهر بالرؤية
const base = h.monthStart(1448, 9);
const h2 = H.create({ overrides: { '1448-9': base + 1 } });
assert.strictEqual(h2.monthStart(1448, 9), base + 1);
assert.strictEqual(h2.monthLength(1448, 8), h.monthLength(1448, 8) + 1);
assert.strictEqual(h2.fromJdn(base + 1).m, 9);
assert.strictEqual(h2.fromJdn(base + 1).d, 1);
assert.strictEqual(h2.fromJdn(base).m, 8);
// الإزاحة العامة
const h3 = H.create({ offset: 1 });
assert.strictEqual(h3.fromJdn(base + 1).d, 1);

// المواقيت: المنامة، ٢٦ نوفمبر ٢٠٢٦ (قيم مرجعية من مكتبة astral مع هامش دقيقتين)
const loc = { lat: 26.2285, lng: 50.5860, tz: 3 };
const t = P.times(H.gregToJdn(2026, 11, 26), loc);
const ref = { fajr: 4 + 52 / 60, sunrise: 6 + 4 / 60, dhuhr: 11 + 24 / 60, sunset: 16 + 45 / 60, maghrib: 17 + 1 / 60 };
Object.keys(ref).forEach(k => assert(Math.abs(t[k] - ref[k]) < 2 / 60, k + ' ' + t[k]));
assert(t.fajr < t.sunrise && t.sunrise < t.dhuhr && t.dhuhr < t.sunset && t.sunset < t.maghrib && t.maghrib < t.midnight);
assert(t.midnight > 22 && t.midnight < 24);

// المناسبات
const m29 = E.on(2, 29, 29).map(e => e.title).join();
assert(m29.includes('الرضا'));                      // ٣٠ صفر ينتقل إلى ٢٩
assert(!E.on(2, 29, 30).map(e => e.title).join().includes('الرضا'));
assert(E.on(1, 10, 30).some(e => e.title.includes('عاشوراء')));
assert(E.LIST.every(e => e.m >= 1 && e.m <= 12 && e.d >= 1 && e.d <= 30 && E.TYPE_LABEL[e.type]));
// معايرة على جدول حوزة الهدى (جمادى الآخرة ١٤٤٨، ١٢ نوفمبر → ١١ ديسمبر ٢٠٢٦)
// الأعمدة: الفجر، الشروق، الظهر، الغروب(م)، العشاءين(م)، صلاة الليل(م)
const CD = require('../js/calendar-data.js');
const HAWZA_TABLE = `4:41 5:54 11:22 4:49 5:04 11:21
4:42 5:54 11:22 4:49 5:04 11:21
4:42 5:55 11:22 4:49 5:04 11:22
4:43 5:56 11:22 4:48 5:03 11:22
4:44 5:57 11:22 4:48 5:03 11:22
4:44 5:57 11:22 4:47 5:02 11:22
4:45 5:58 11:23 4:47 5:02 11:22
4:46 5:59 11:23 4:47 5:02 11:23
4:46 5:59 11:24 4:47 5:02 11:23
4:47 6:00 11:23 4:46 5:01 11:23
4:47 6:01 11:24 4:46 5:01 11:23
4:48 6:02 11:24 4:46 5:01 11:24
4:49 6:02 11:24 4:46 5:01 11:24
4:49 6:03 11:24 4:46 5:01 11:24
4:50 6:04 11:25 4:45 5:00 11:24
4:51 6:05 11:25 4:45 5:00 11:25
4:51 6:05 11:25 4:45 5:00 11:25
4:52 6:06 11:26 4:45 5:00 11:25
4:53 6:07 11:26 4:45 5:00 11:26
4:53 6:08 11:27 4:45 5:00 11:26
4:54 6:08 11:27 4:45 5:00 11:26
4:55 6:10 11:28 4:45 5:00 11:27
4:55 6:10 11:28 4:45 5:00 11:27
4:56 6:11 11:28 4:45 5:00 11:28
4:56 6:11 11:29 4:46 5:01 11:28
4:57 6:12 11:29 4:46 5:01 11:29
4:58 6:13 11:29 4:46 5:01 11:29
4:58 6:13 11:30 4:46 5:01 11:29
4:59 6:14 11:30 4:46 5:01 11:30
4:59 6:15 11:31 4:47 5:02 11:31`.split('\n').map(l => l.split(' ').map(x => { const [a, b] = x.split(':').map(Number); return a + b / 60; }));
const j0 = H.gregToJdn(2026, 11, 12);
HAWZA_TABLE.forEach((r, i) => {
  const x = P.times(j0 + i, loc, null, CD.PRAYER_PROFILES.hawza);
  const ref = [r[0], r[1], r[2], r[3] + 12, r[4] + 12, r[5] + 12];
  [x.fajr, x.sunrise, x.dhuhr, x.sunset, x.maghrib, x.midnight].forEach((v, k) =>
    assert(Math.abs(v - ref[k]) * 60 <= 1.5, 'يوم ' + (i + 1) + ' عمود ' + k + ' فرق ' + ((v - ref[k]) * 60).toFixed(2)));
});
// بدايات الشهور المعتمدة
const hz = H.create({ overrides: CD.toJdnMap(CD.HAWZA, H.gregToJdn) });
assert.deepStrictEqual([hz.fromJdn(j0).y, hz.fromJdn(j0).m, hz.fromJdn(j0).d], [1448, 6, 1]);
assert.strictEqual(hz.monthLength(1448, 1), 29);                 // محرم ٢٩ يوماً
assert.strictEqual(hz.monthLength(1448, 2), 30);                 // صفر ٣٠
assert.strictEqual(hz.monthStart(1448, 2), H.gregToJdn(2026, 7, 16));
assert.strictEqual(hz.fromJdn(H.gregToJdn(2026, 6, 26)).d, 10);  // عاشوراء الجمعة ٢٦ يونيو

// محلل جداول الحوزة (scripts/update-months.js): أشكال نص مختلفة خرجت من ملفات PDF فعلية
const U = require('../scripts/update-months.js');
assert.strictEqual(U.weekdayOf('الخميس'), 4);
assert.strictEqual(U.weekdayOf('\u202bبعاء\u202c\u202bر\u202c\u202bاأل\u202c'), 3);   // الأربعاء مقسّمة
assert.strictEqual(U.weekdayOf('الخم\ufffdس'), 4);                                          // حرف تالف
assert.strictEqual(U.weekdayOf('اﻟثﻼﺜﺎء'), 2);                                                // أشكال العرض
assert.strictEqual(U.weekdayOf('األحد'), 0);
assert.deepStrictEqual(U.parseFirstDay('x\n١\nاﻟﺨﻤﻴﺲ\n١٢\n4:41'), { d: 12, wd: 4 });
assert.deepStrictEqual(U.resolveDate({ d: 12, wd: 4 }, 1448, 6), [2026, 11, 12]);
assert.deepStrictEqual(U.resolveDate({ d: 16, wd: 4 }, 1448, 2), [2026, 7, 16]);          // يخالف الحساب العام بيوم
assert.throws(() => U.resolveDate({ d: 20, wd: 4 }, 1448, 6));                            // تاريخ بعيد → يرفض

// قراءة عمود الأيام الصالحة من إحداثيات النص (بيانات اصطناعية بنفس شكل pdftotext -bbox)
const mk = (x, y, t) => `<word xMin="${x}" yMin="${y}" xMax="${x + 9}" yMax="${y + 12}">${t}</word>`;
let bb = '<page width="595" height="842">';
for (let d = 1; d <= 30; d++) {
  bb += mk(552, 100 + d * 20, String(d));
  if (d % 3 !== 0) bb += mk(476, 100 + d * 20, '\uf050');            // ✓ في العمود
}
bb += mk(108, 120, '\uf06a') + '</page>';                           // زخرفة خارج العمود
const sal = U.parseSalih(bb);
assert.strictEqual(sal.length, 20);
assert(!sal.includes(3) && sal.includes(1) && sal.includes(29));
assert.throws(() => U.parseSalih('<page width="595" height="842"></page>'));   // لا أرقام أيام → يرفض
// البيانات المخزنة معقولة
Object.keys(CD.SALIH).forEach(k => assert(CD.SALIH[k].length >= 8 && CD.SALIH[k].every(d => d >= 1 && d <= 30)));

console.log('كل الاختبارات نجحت ✔');
