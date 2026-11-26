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
console.log('كل الاختبارات نجحت ✔');
