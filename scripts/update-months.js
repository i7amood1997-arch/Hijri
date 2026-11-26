#!/usr/bin/env node
/* يسحب جداول حوزة الهدى (PDF) ويحدّث بدايات الشهور في js/calendar-data.js.
 *   node scripts/update-months.js            # يحدّث الملفات
 *   node scripts/update-months.js --dry      # يعرض فقط
 * يحتاج: Node 18+ وأداة pdftotext (poppler-utils).
 * يخرج بـ 1 إذا تعذّر فهم أي جدول، حتى لا يُنشر تاريخ خاطئ بصمت.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const H = require('../js/hijri.js');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'js', 'calendar-data.js');
const SW = path.join(ROOT, 'sw.js');
const BASE = 'https://www.alhodacenter.com/assets/uploads/calendar_file/';
const DRY = process.argv.includes('--dry');
const MONTHS_AR = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];

// تطبيع النص: أشكال العرض العربية → حروف عادية، والأرقام الهندية → لاتينية، وحذف التشكيل
function norm(t) {
  return t.normalize('NFKC')
    .replace(/[\u0660-\u0669]/g, function (c) { return String(c.charCodeAt(0) - 0x660); })
    .replace(/[\u064B-\u065F\u0670\u0640\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '');
}

// يوم الأسبوع (0 = الأحد) من نص قد يكون فيه التواء في اللام ألف
function weekdayOf(t) {
  const s = norm(t);
  if (s.includes('سبت')) return 6;
  if (s.includes('جمع')) return 5;
  if (s.includes('خميس') || s.includes('خم')) return 4;
  if (s.includes('ربعاء') || s.includes('بعاء')) return 3;  // وبعض الخطوط تقسّم الكلمة وتعكس أجزاءها
  if (s.includes('ثالث') || s.includes('ثلاث') || s.includes('ثاء')) return 2;
  if (s.includes('ثنين') || s.includes('ثنان') || s.includes('اثن')) return 1;
  if (s.endsWith('حد')) return 0;
  return -1;
}

/** يستخرج رقم اليوم الميلادي ويوم الأسبوع لأول صف (اليوم ١ من الشهر الهجري). */
function parseFirstDay(text) {
  const lines = norm(text).split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  for (let i = 0; i < lines.length - 2; i++) {
    if (lines[i] === '1' && weekdayOf(lines[i + 1]) >= 0 && /^\d{1,2}$/.test(lines[i + 2])) {
      return { d: +lines[i + 2], wd: weekdayOf(lines[i + 1]) };
    }
  }
  throw new Error('لم أجد صف اليوم الأول');
}

// يجد التاريخ الميلادي الوحيد الذي يطابق (يوم الشهر + يوم الأسبوع) قرب تقدير التقويم الحسابي (±٣ أيام)
function resolveDate(first, hy, hm) {
  const civil = H.civilStart(hy, hm);
  const found = [];
  for (let j = civil - 3; j <= civil + 3; j++) {
    const g = H.jdnToGreg(j);
    if (g.d === first.d && H.weekday(j) === first.wd) found.push([g.y, g.m, g.d]);
  }
  if (found.length !== 1) throw new Error('تعذّر تحديد التاريخ (' + found.length + ' احتمالات) لليوم ' + first.d);
  return found[0];
}

/** يستخرج أرقام الأيام الهجرية الصالحة (عمود ✓) من ناتج pdftotext -bbox بالاعتماد على الإحداثيات. */
function parseSalih(bbox) {
  const pw = +((bbox.match(/<page width="([\d.]+)"/) || [])[1] || 0);
  if (!pw) throw new Error('لا يوجد عرض صفحة');
  const words = [];
  const re = /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)<\/word>/g;
  let m;
  while ((m = re.exec(bbox))) words.push({ x: +m[1], y: (+m[2] + +m[4]) / 2, t: norm(m[5]) });
  // أرقام الأيام الهجرية: عمود أقصى اليمين
  const rows = {};
  words.forEach(function (w) {
    if (w.x >= pw * 0.88 && /^\d{1,2}$/.test(w.t) && +w.t >= 1 && +w.t <= 30) rows[+w.t] = w.y;
  });
  const have = Object.keys(rows).map(Number);
  for (let d = 1; d <= 29; d++) if (rows[d] == null) throw new Error('لم أجد رقم اليوم ' + d);
  // علامات ✓: رموز خاصة (Private Use) تقع على صف يوم، ونأخذ العمود الأكثر تكراراً
  const hits = [];
  words.forEach(function (w) {
    if (!/^[\uE000-\uF8FF]+$/.test(w.t) || w.x < pw * 0.7 || w.x > pw * 0.88) return;
    let best = null;
    have.forEach(function (d) { if (Math.abs(rows[d] - w.y) < 6 && (!best || Math.abs(rows[d] - w.y) < Math.abs(rows[best] - w.y))) best = d; });
    if (best) hits.push({ d: best, x: Math.round(w.x) });
  });
  const cnt = {};
  hits.forEach(function (h) { cnt[h.x] = (cnt[h.x] || 0) + 1; });
  const col = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; })[0];
  if (col == null) throw new Error('لم أجد عمود العلامات');
  const out = hits.filter(function (h) { return String(h.x) === col; }).map(function (h) { return h.d; })
    .filter(function (v, i, arr) { return arr.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
  // الشهر العادي فيه ١٣–١٧ يوماً صالحاً؛ أقل من ٨ يعني أن تصميم الجدول مختلف والقراءة غير موثوقة
  if (out.length < 8) throw new Error('عدد الأيام الصالحة غير معقول (' + out.length + ')');
  return out;
}

// نستخدم curl لأنه يحترم إعدادات الوكيل (proxy) في كل البيئات. يرجع مسار الملف أو null إذا لم يُنشر.
function fetchPdf(file) {
  const tmp = path.join(require('os').tmpdir(), 'hawza-' + file + '.pdf');
  const code = execFileSync('curl', ['-sSL', '-m', '60', '-o', tmp, '-w', '%{http_code}', BASE + file + '.pdf'], { encoding: 'utf8' }).trim();
  if (code === '404') return null;
  if (code !== '200') throw new Error('HTTP ' + code + ' ' + file);
  return tmp;
}
const pdfText = function (f) { return execFileSync('pdftotext', ['-raw', f, '-'], { encoding: 'utf8' }); };
const pdfBbox = function (f) { return execFileSync('pdftotext', ['-bbox', f, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); };

function currentData() { delete require.cache[require.resolve(DATA)]; return require(DATA); }

function sortKeys(obj) {
  return Object.keys(obj).sort(function (a, b) {
    const x = a.split('-').map(Number), y = b.split('-').map(Number);
    return x[0] - y[0] || x[1] - y[1];
  });
}

function writeData(table, salih) {
  const keys = sortKeys(table);
  const rows = keys.map(function (k, i) {
    const m = +k.split('-')[1];
    return "    '" + k + "': [" + table[k].join(', ') + ']' + (i < keys.length - 1 ? ',' : ' ') + ' // ' + MONTHS_AR[m - 1];
  });
  const sk = sortKeys(salih);
  const srows = sk.map(function (k, i) {
    return "    '" + k + "': [" + salih[k].join(', ') + ']' + (i < sk.length - 1 ? ',' : '');
  });
  let src = fs.readFileSync(DATA, 'utf8');
  src = src.replace(/ {2}\/\/ BEGIN-AUTO[\s\S]*?\/\/ END-AUTO/, '  // BEGIN-AUTO\n  const HAWZA = {\n' + rows.join('\n') + '\n  };\n  // END-AUTO');
  src = src.replace(/ {2}\/\/ BEGIN-SALIH[\s\S]*?\/\/ END-SALIH/, '  // BEGIN-SALIH\n  const SALIH = {\n' + srows.join('\n') + '\n  };\n  // END-SALIH');
  fs.writeFileSync(DATA, src);
}

function bumpCache() {
  const s = fs.readFileSync(SW, 'utf8');
  fs.writeFileSync(SW, s.replace(/hadi-v(\d+)/, function (_, n) { return 'hadi-v' + (+n + 1); }));
}

async function main() {
  const cur = currentData();
  const table = Object.assign({}, cur.HAWZA);
  const salih = Object.assign({}, cur.SALIH);
  const keys = sortKeys(table).map(function (k) { return k.split('-').map(Number); });
  let [y, m] = keys[keys.length - 1];
  const last = y + '-' + m;
  // آخر شهر معروف + ثلاثة شهور بعده + أي شهر معروف ينقصه عمود الأيام الصالحة
  const todo = [[y, m]];
  for (let i = 0; i < 3; i++) { const n = H.nextYM(y, m); y = n[0]; m = n[1]; todo.push([y, m]); }
  keys.forEach(function (k) { if (!salih[k.join('-')] && !todo.some(function (t) { return t[0] === k[0] && t[1] === k[1]; })) todo.push(k); });

  let changed = false, hardFail = false;
  for (const [hy, hm] of todo) {
    const key = hy + '-' + hm, file = String(hy) + String(hm).padStart(2, '0');
    const critical = !table[key] || key === last;   // الشهور القديمة: الأخطاء تحذير فقط
    const pdf = fetchPdf(file);
    if (!pdf) { console.log(key + ': لم يُنشر بعد'); continue; }
    try {
      const date = resolveDate(parseFirstDay(pdfText(pdf)), hy, hm);
      const old = table[key];
      if (!old || old.join() !== date.join()) {
        console.log(key + ' (' + MONTHS_AR[hm - 1] + '): ' + (old ? old.join('-') + ' ← ' : 'جديد ') + date.join('-'));
        table[key] = date; changed = true;
      } else console.log(key + ': بداية الشهر بلا تغيير (' + date.join('-') + ')');
    } catch (e) {
      console.error(key + ': ' + (critical ? 'خطأ' : 'تحذير') + ' في قراءة بداية الشهر: ' + e.message);
      if (critical) hardFail = true;
    }
    try {
      const days = parseSalih(pdfBbox(pdf));
      if (!salih[key] || salih[key].join() !== days.join()) {
        console.log(key + ': الأيام الصالحة = ' + days.join(' '));
        salih[key] = days; changed = true;
      }
    } catch (e) { console.error(key + ': تحذير في قراءة الأيام الصالحة: ' + e.message); }
  }
  if (changed && !DRY) { writeData(table, salih); bumpCache(); console.log('تم تحديث js/calendar-data.js ورفع نسخة الكاش'); }
  if (!changed) console.log('لا جديد.');
  if (hardFail) process.exit(1);
}

if (require.main === module) main().catch(function (e) { console.error('فشل: ' + e.message); process.exit(1); });
module.exports = { parseFirstDay, resolveDate, weekdayOf, parseSalih };
