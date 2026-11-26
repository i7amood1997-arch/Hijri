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

// نستخدم curl لأنه يحترم إعدادات الوكيل (proxy) في كل البيئات
function fetchPdf(file) {
  const tmp = path.join(require('os').tmpdir(), 'hawza-' + file + '.pdf');
  const code = execFileSync('curl', ['-sSL', '-m', '60', '-o', tmp, '-w', '%{http_code}', BASE + file + '.pdf'], { encoding: 'utf8' }).trim();
  if (code === '404') return Promise.resolve(null);
  if (code !== '200') return Promise.reject(new Error('HTTP ' + code + ' ' + file));
  return Promise.resolve(execFileSync('pdftotext', ['-raw', tmp, '-'], { encoding: 'utf8' }));
}

function currentData() { delete require.cache[require.resolve(DATA)]; return require(DATA).HAWZA; }

function writeData(table) {
  const keys = Object.keys(table).sort(function (a, b) {
    const x = a.split('-').map(Number), y = b.split('-').map(Number);
    return x[0] - y[0] || x[1] - y[1];
  });
  const rows = keys.map(function (k, i) {
    const m = +k.split('-')[1], d = table[k];
    return "    '" + k + "': [" + d.join(', ') + ']' + (i < keys.length - 1 ? ',' : ' ') + ' // ' + MONTHS_AR[m - 1];
  });
  const block = '  // BEGIN-AUTO\n  const HAWZA = {\n' + rows.join('\n') + '\n  };\n  // END-AUTO';
  const src = fs.readFileSync(DATA, 'utf8');
  const out = src.replace(/ {2}\/\/ BEGIN-AUTO[\s\S]*?\/\/ END-AUTO/, block);
  fs.writeFileSync(DATA, out);
}

function bumpCache() {
  const s = fs.readFileSync(SW, 'utf8');
  fs.writeFileSync(SW, s.replace(/hadi-v(\d+)/, function (_, n) { return 'hadi-v' + (+n + 1); }));
}

async function main() {
  const table = Object.assign({}, currentData());
  // نفحص من آخر شهر معروف وحتى ثلاثة شهور بعده (الشهر الأخير نعيد التحقق منه أيضاً)
  const keys = Object.keys(table).map(function (k) { return k.split('-').map(Number); })
    .sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
  let [y, m] = keys[keys.length - 1];
  const todo = [[y, m]];
  for (let i = 0; i < 3; i++) { const n = H.nextYM(y, m); y = n[0]; m = n[1]; todo.push([y, m]); }

  let changed = false;
  for (const [hy, hm] of todo) {
    const file = String(hy) + String(hm).padStart(2, '0');
    const text = await fetchPdf(file);
    if (!text) { console.log(file + ': لم يُنشر بعد'); continue; }
    const date = resolveDate(parseFirstDay(text), hy, hm);
    const key = hy + '-' + hm;
    const old = table[key];
    if (!old || old.join() !== date.join()) {
      console.log(key + ' (' + MONTHS_AR[hm - 1] + '): ' + (old ? old.join('-') + ' ← ' : 'جديد ') + date.join('-'));
      table[key] = date; changed = true;
    } else console.log(key + ': بلا تغيير (' + date.join('-') + ')');
  }
  if (changed && !DRY) { writeData(table); bumpCache(); console.log('تم تحديث js/calendar-data.js ورفع نسخة الكاش'); }
  if (!changed) console.log('لا جديد.');
}

if (require.main === module) main().catch(function (e) { console.error('فشل: ' + e.message); process.exit(1); });
module.exports = { parseFirstDay, resolveDate, weekdayOf };
