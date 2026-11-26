(function () {
  'use strict';

  const H = window.Hijri, P = window.Prayer, E = window.Occasions, CD = window.CalendarData;

  /* ---------- الإعدادات ---------- */
  const KEY = 'hadi.settings.v1';
  const DEFAULTS = {
    cityId: 'manama', name: 'المنامة', lat: 26.2285, lng: 50.5860, tz: 3,
    source: 'hawza', digits: 'latin', offset: 0, overrides: {}, adj: {}
  };
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || '{}');
      return Object.assign({}, DEFAULTS, s, { overrides: s.overrides || {}, adj: s.adj || {} });
    } catch (e) { return Object.assign({}, DEFAULTS); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } }
  let st = load();

  /* ---------- أدوات ---------- */
  const AR = '٠١٢٣٤٥٦٧٨٩';
  // الأرقام: إنجليزية (123) افتراضياً، وعربية (١٢٣) من الإعدادات
  const ar = function (n) { return st.digits === 'arabic' ? String(n).replace(/\d/g, function (d) { return AR[d]; }) : String(n); };
  const pad = function (n) { return (n < 10 ? '0' : '') + n; };
  const $view = document.getElementById('view');

  const CITIES = [
    { id: 'manama', name: 'المنامة', lat: 26.2285, lng: 50.5860 },
    { id: 'muharraq', name: 'المحرق', lat: 26.2572, lng: 50.6119 },
    { id: 'jidhafs', name: 'جدحفص', lat: 26.2167, lng: 50.5500 },
    { id: 'budaiya', name: 'البديع', lat: 26.2125, lng: 50.4560 },
    { id: 'isa', name: 'مدينة عيسى', lat: 26.1736, lng: 50.5478 },
    { id: 'sitra', name: 'سترة', lat: 26.1547, lng: 50.6206 },
    { id: 'riffa', name: 'الرفاع', lat: 26.1300, lng: 50.5550 },
    { id: 'hamad', name: 'مدينة حمد', lat: 26.1150, lng: 50.5070 }
  ];

  const PRAYERS = [
    { k: 'fajr', n: 'الفجر' },
    { k: 'sunrise', n: 'الشروق' },
    { k: 'dhuhr', n: 'الظهر' },
    { k: 'sunset', n: 'الغروب' },
    { k: 'maghrib', n: 'المغرب' },
    { k: 'midnight', n: 'منتصف الليل' }
  ];

  function buildCal() {
    const base = st.source === 'hawza' ? CD.toJdnMap(CD.HAWZA, H.gregToJdn) : {};
    return H.create({ offset: st.offset, overrides: Object.assign({}, base, st.overrides) });
  }
  let hj = buildCal();
  function rebuild() { hj = buildCal(); save(); }
  function prayerOpts() { return CD.PRAYER_PROFILES[st.source] || CD.PRAYER_PROFILES.general; }

  /* ---------- الوقت (بتوقيت الموقع المختار) ---------- */
  function now() {
    const d = new Date(Date.now() + st.tz * 3600000);
    return {
      jdn: H.gregToJdn(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()),
      sec: d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds()
    };
  }
  function dayTimes(jdn) { return P.times(jdn, st, st.adj, prayerOpts()); }

  function clock(h) {
    if (h == null || isNaN(h)) return '—';
    let m = Math.round(h * 60);
    m = ((m % 1440) + 1440) % 1440;
    const hh = Math.floor(m / 60), mm = m % 60;
    let h12 = hh % 12; if (h12 === 0) h12 = 12;
    return ar(h12) + ':' + ar(pad(mm)) + ' ' + (hh >= 12 ? 'م' : 'ص');
  }
  function clockShort(h) {
    let m = Math.round(h * 60); m = ((m % 1440) + 1440) % 1440;
    let h12 = Math.floor(m / 60) % 12; if (h12 === 0) h12 = 12;
    return ar(h12) + ':' + ar(pad(m % 60));
  }

  function fmtG(jdn, withDay, withYear) {
    const g = H.jdnToGreg(jdn);
    return (withDay ? H.WEEKDAYS[H.weekday(jdn)] + ' ' : '') + ar(g.d) + ' ' + H.GREG_MONTHS[g.m - 1] + (withYear === false ? '' : ' ' + ar(g.y));
  }
  function fmtH(h) { return ar(h.d) + ' ' + H.HIJRI_MONTHS[h.m - 1] + ' ' + ar(h.y); }
  function daysText(n) {
    if (n === 0) return 'اليوم';
    if (n === 1) return 'غداً';
    if (n === 2) return 'بعد يومين';
    return 'بعد ' + ar(n) + (n <= 10 ? ' أيام' : ' يوماً');
  }
  // مفرد، مثنى، جمع قلة (3–10)، جمع كثرة (11+)
  function plural(n, w) {
    if (n === 1) return w[0];
    if (n === 2) return w[1];
    return ar(n) + ' ' + (n >= 3 && n <= 10 ? w[2] : w[3]);
  }
  const UNIT = { h: ['ساعة', 'ساعتان', 'ساعات', 'ساعة'], m: ['دقيقة', 'دقيقتان', 'دقائق', 'دقيقة'], s: ['ثانية', 'ثانيتان', 'ثوانٍ', 'ثانية'] };
  function cdText(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    const parts = h > 0 ? [plural(h, UNIT.h)] : [];
    if (h > 0 && m > 0) parts.push(plural(m, UNIT.m));
    else if (h === 0) { if (m > 0) parts.push(plural(m, UNIT.m)); parts.push(plural(s, UNIT.s)); }
    return parts.join(' و');
  }

  /* ---------- المناسبات ---------- */
  function upcoming(fromJdn, days, limit, filter) {
    const out = [];
    for (let j = fromJdn; j < fromJdn + days && out.length < limit; j++) {
      const h = hj.fromJdn(j);
      E.on(h.m, h.d, hj.monthLength(h.y, h.m)).forEach(function (ev) {
        if (!filter || filter(ev)) out.push({ jdn: j, h: h, ev: ev });
      });
    }
    return out;
  }
  const typeClass = function (t) { return t === 'joy' ? 'joy' : t === 'grief' ? 'grief' : t === 'eid' ? 'eid' : 'info'; };

  function evRow(item, nowJdn, showDate) {
    const ev = item.ev, h = item.h;
    const n = nowJdn == null ? -1 : item.jdn - nowJdn;
    const nowYear = H.jdnToGreg(nowJdn == null ? item.jdn : nowJdn).y;
    const sub = (showDate === false ? '' : ar(h.d) + ' ' + H.HIJRI_MONTHS[h.m - 1] + ' · ' + fmtG(item.jdn, true, H.jdnToGreg(item.jdn).y !== nowYear));
    return '<div class="oc ' + typeClass(ev.type) + '"><i class="dot"></i><div>' +
      '<div class="t">' + ev.title + '</div>' +
      (sub ? '<div class="s">' + sub + '</div>' : '') +
      (ev.note ? '<div class="s">' + ev.note + '</div>' : '') +
      (ev.night ? '<div class="s">ليلة: تبدأ عند مغرب اليوم السابق لهذا التاريخ</div>' : '') +
      '</div>' + (n >= 0 ? '<div class="w">' + daysText(n) + '</div>' : '<div></div>') + '</div>';
  }

  // اليوم الصالح حسب تقويم الحوزة (يمتد من ليلة اليوم حتى نهايته)
  function isSalih(h) {
    if (st.source !== 'hawza') return false;
    const a = CD.SALIH[h.y + '-' + h.m];
    return !!a && a.indexOf(h.d) >= 0;
  }
  const SALIH_TXT = 'من الأيام الصالحة حسب تقويم الحوزة (تمتد من ليلة اليوم حتى نهايته)';

  function deeds(jdn, h) {
    const out = [];
    const wd = H.weekday(jdn);
    if (wd === 4) out.push('مساء اليوم ليلة الجمعة: دعاء كميل وزيارة الإمام الحسين (ع)');
    if (wd === 5) out.push('يوم الجمعة: دعاء الندبة والإكثار من الصلاة على محمد وآل محمد');
    if ((h.d === 13 || h.d === 14 || h.d === 15) && h.m !== 9 && h.m !== 12) out.push('من الأيام البيض: يُستحب صيامها');
    if (isSalih(h)) out.push(SALIH_TXT);
    if (h.m === 7 || h.m === 8) out.push('شهر ' + (h.m === 7 ? 'رجب' : 'شعبان') + ': يُستحب الاستغفار وكثرة الدعاء والصيام');
    if (h.m === 1 && h.d <= 10) out.push('عشرة محرم: أيام عزاء الإمام الحسين (ع)');
    return out;
  }

  /* ---------- الحالة ---------- */
  let view = 'home';
  let calYM = null;
  let selJdn = null;
  let occFilter = 'all';
  let showAdjust = false;
  let showSalihOn = false;
  let tickDay = null;

  const FILTERS = {
    all: null,
    joy: function (ev) { return ev.type === 'joy'; },
    grief: function (ev) { return ev.type === 'grief'; },
    other: function (ev) { return ev.type === 'eid' || ev.type === 'ibadah' || ev.type === 'month'; }
  };

  const ICONS = {
    next: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
    prev: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>'
  };

  /* ---------- الرئيسية ---------- */
  // الرقم الكبير للمناسبة القادمة: [نص كبير, وحدة]
  function daysBig(n, ev) {
    if (n === 0) return ['اليوم', ''];
    if (n === 1) return [ev && ev.night ? 'الليلة' : 'غداً', ''];
    if (n === 2) return ['يومين', ''];
    return [ar(n), n <= 10 ? 'أيام' : 'يوماً'];
  }

  function homeHtml() {
    const t = now();
    const h = hj.fromJdn(t.jdn);
    const times = dayTimes(t.jdn);
    const ups = upcoming(t.jdn, 400, 5);
    const dd = deeds(t.jdn, h);

    let html = '<div class="date"><div class="wd">' + H.WEEKDAYS[H.weekday(t.jdn)] + '</div>' +
      '<div class="hd">' + fmtH(h) + '</div><div class="gd">' + fmtG(t.jdn) + '</div></div>';

    if (ups.length) {
      const f = ups[0], n = f.jdn - t.jdn, big = daysBig(n, f.ev);
      const nowYear = H.jdnToGreg(t.jdn).y;
      html += '<section class="hero" aria-label="المناسبة القادمة">' +
        '<div class="big"><span class="n">' + big[0] + '</span>' + (big[1] ? '<span class="u">' + big[1] + '</span>' : '') + '</div>' +
        '<div class="ot ' + typeClass(f.ev.type) + '"><i class="dot"></i><span>' + f.ev.title + '</span></div>' +
        '<div class="os">' + ar(f.h.d) + ' ' + H.HIJRI_MONTHS[f.h.m - 1] + ' · ' + fmtG(f.jdn, true, H.jdnToGreg(f.jdn).y !== nowYear) + '</div>' +
        (f.ev.note ? '<div class="os">' + f.ev.note + '</div>' : '') +
        (f.ev.night ? '<div class="os">ليلة: تبدأ عند مغرب اليوم السابق لهذا التاريخ</div>' : '') +
        '</section>';
    }

    html += '<div class="npline" id="npLine"></div>' +
      '<div class="grp" id="timesList" style="margin-top:8px">' + PRAYERS.map(function (p) {
        return '<div class="pr" data-k="' + p.k + '"><span>' + p.n + '</span><b>' + clock(times[p.k]) + '</b></div>';
      }).join('') + '</div>' +
      '<p class="note">' + (st.source === 'hawza'
        ? 'على تقويم حوزة الهدى (البحرين). منتصف الليل بين الغروب والشروق، ويُحتاط ' + ar(3) + ' دقائق بعد وقت الفجر.'
        : 'حسب المذهب الجعفري: الفجر ' + ar(16) + '°، والمغرب بعد ذهاب الحمرة المشرقية (' + ar(4) + '°).') + '</p>';

    const rest = ups.slice(1, 4);
    html += '<h2 class="sec">بعدها <button class="link" data-a="nav" data-v="occ">كل المناسبات</button></h2>' +
      (rest.length ? rest.map(function (i) { return evRow(i, t.jdn); }).join('') : '<div class="empty">لا مناسبات أخرى قريبة</div>');

    if (dd.length) {
      html += '<h2 class="sec">أعمال اليوم</h2>' + dd.map(function (x) { return '<div class="deed">' + x + '</div>'; }).join('');
    }
    return html;
  }

  // تحديث سطر الصلاة القادمة والصلاة الحالية كل ثانية
  function tick() {
    if (view !== 'home') return;
    const line = document.getElementById('npLine');
    if (!line) return;
    const t = now();
    const times = dayTimes(t.jdn);
    const list = PRAYERS.map(function (p) { return { k: p.k, n: p.n, at: times[p.k] * 3600 }; });
    list.push({ k: 'fajr', n: 'الفجر', at: times.nextFajr * 3600 });
    let ni = list.findIndex(function (x) { return x.at > t.sec; });
    if (ni < 0) ni = list.length - 1;
    const nx = list[ni];
    let cur = -1;
    for (let i = 0; i < PRAYERS.length; i++) if (list[i].at <= t.sec) cur = i;

    line.innerHTML = '<b>' + nx.n + '</b> بعد ' + cdText(nx.at - t.sec);

    document.querySelectorAll('#timesList .pr').forEach(function (row, i) {
      row.className = 'pr' + (i === cur ? ' cur' : i < cur ? ' pass' : i === ni ? ' nxt' : '');
    });

    const dk = hj.fromJdn(t.jdn).d;
    if (tickDay === null) tickDay = dk;
    else if (dk !== tickDay) { tickDay = dk; render(true); }
  }

  /* ---------- التقويم ---------- */
  function calHtml() {
    const t = now();
    if (!calYM) { const h = hj.fromJdn(t.jdn); calYM = { y: h.y, m: h.m }; }
    const y = calYM.y, m = calYM.m;
    const start = hj.monthStart(y, m), len = hj.monthLength(y, m);
    const g1 = H.jdnToGreg(start), g2 = H.jdnToGreg(start + len - 1);
    if (selJdn == null || selJdn < start || selJdn >= start + len) {
      selJdn = (t.jdn >= start && t.jdn < start + len) ? t.jdn : start;
    }
    const lead = (H.weekday(start) + 1) % 7; // السبت أول الأسبوع
    const days = ['سبت', 'أحد', 'اثن', 'ثلا', 'أرب', 'خمس', 'جمع'];

    let cells = days.map(function (n) { return '<div class="w">' + n + '</div>'; }).join('');
    for (let i = 0; i < lead; i++) cells += '<div class="cell void"></div>';
    for (let d = 1; d <= len; d++) {
      const j = start + d - 1;
      const evs = E.on(m, d, len);
      const wd = H.weekday(j);
      const sal = isSalih({ y: y, m: m, d: d });
      cells += '<button class="cell ' + (evs.length ? typeClass(evs[0].type) : '') + (sal ? ' salih' : '') + (wd === 5 ? ' fri' : '') + (j === t.jdn ? ' today' : '') + (j === selJdn ? ' sel' : '') +
        '" data-a="pick" data-j="' + j + '" aria-label="' + ar(d) + ' ' + H.HIJRI_MONTHS[m - 1] + (sal ? ' — يوم صالح' : '') + (evs.length ? ' — ' + evs[0].title : '') + '">' +
        '<span class="nn">' + ar(d) + '</span><span class="gg">' + ar(H.jdnToGreg(j).d) + '</span>' + (evs.length ? '<i class="ev"></i>' : '') + '</button>';
    }

    const gTitle = g1.m === g2.m ? H.GREG_MONTHS[g1.m - 1] + ' ' + ar(g1.y) :
      H.GREG_MONTHS[g1.m - 1] + (g1.y !== g2.y ? ' ' + ar(g1.y) : '') + ' – ' + H.GREG_MONTHS[g2.m - 1] + ' ' + ar(g2.y);

    let html = '<div class="mt"><button class="ib" data-a="next" aria-label="الشهر التالي">' + ICONS.next + '</button>' +
      '<div class="n">' + H.HIJRI_MONTHS[m - 1] + ' ' + ar(y) + '<small>' + gTitle + ' · ' + ar(len) + ' يوماً</small></div>' +
      '<button class="ib" data-a="prev" aria-label="الشهر السابق">' + ICONS.prev + '</button></div>' +
      '<div class="tools"><button class="pill" data-a="today" aria-pressed="false">اليوم</button>' +
      (st.source === 'hawza' ? '<button class="pill" data-a="toggleSalih" aria-pressed="' + showSalihOn + '">الأيام الصالحة</button>' : '') +
      '<button class="pill" data-a="toggleAdjust" aria-pressed="' + showAdjust + '">ضبط بداية الشهر</button></div>';

    if (showAdjust) {
      const isOv = st.overrides[y + '-' + m] != null;
      const fromSrc = !isOv && st.source === 'hawza' && CD.HAWZA[y + '-' + m] != null;
      html += '<div class="grp" style="margin-top:14px"><div class="pr"><span>أول ' + H.HIJRI_MONTHS[m - 1] +
        '<span class="d">' + fmtG(start, true) + (isOv ? ' · معدّل يدوياً' : fromSrc ? ' · من تقويم الحوزة' : '') + '</span></span>' +
        '<div class="step"><button data-a="ms" data-d="-1" aria-label="يوم قبل">−</button><span>' + ar(1) + ' يوم</span><button data-a="ms" data-d="1" aria-label="يوم بعد">+</button></div></div>' +
        '<div class="pad hint">يبدأ الشهر عند الشيعة بالرؤية. اضبط اليوم حسب إعلان إدارة الأوقاف الجعفرية في البحرين أو مرجعك. تغيير بداية شهر يغيّر طول الشهر السابق له تلقائياً.</div>' +
        (isOv ? '<div class="pad" style="padding-top:0"><button class="btn ghost" data-a="msreset">إعادة للحساب الافتراضي</button></div>' : '') + '</div>';
    }
    if (st.source === 'hawza' && CD.HAWZA[y + '-' + m] == null && st.overrides[y + '-' + m] == null) {
      html += '<div class="warn">بداية هذا الشهر تقديرية (حساب) إلى أن تُعلن الرؤية. بعد الإعلان اضغط «ضبط بداية الشهر».</div>';
    }

    html += '<div class="gr' + (showSalihOn ? ' show-salih' : '') + '">' + cells + '</div>' +
      '<div class="lg"><span style="--c:var(--joy)"><i></i>فرح</span><span style="--c:var(--grief)"><i></i>حزن</span><span style="--c:var(--eid)"><i></i>عيد</span><span style="--c:var(--accent)"><i></i>عبادات</span></div>';

    const sh = hj.fromJdn(selJdn);
    const sev = E.on(sh.m, sh.d, len);
    const tm = dayTimes(selJdn);
    html += '<section class="sheet"><div class="h">' + H.WEEKDAYS[H.weekday(selJdn)] + ' ' + fmtH(sh) + '</div>' +
      '<div class="p">' + fmtG(selJdn) + (isSalih(sh) ? ' · من الأيام الصالحة' : '') + '</div>' +
      (sev.length ? sev.map(function (ev) { return evRow({ jdn: selJdn, h: sh, ev: ev }, null, false); }).join('') : '<div class="hint" style="margin-top:8px">لا توجد مناسبة مسجّلة في هذا اليوم.</div>') +
      '<div class="tm">' + [['الفجر', 'fajr'], ['الظهر', 'dhuhr'], ['المغرب', 'maghrib'], ['الليل', 'midnight']].map(function (x) {
        return '<div><span>' + x[0] + '</span><b>' + clockShort(tm[x[1]]) + '</b></div>';
      }).join('') + '</div></section>';
    return html;
  }

  /* ---------- المناسبات ---------- */
  function occHtml() {
    const t = now();
    const items = upcoming(t.jdn, 370, 120, FILTERS[occFilter]);
    let html = '<div class="tools" role="group" aria-label="تصفية" style="padding-top:18px">' +
      [['all', 'الكل'], ['joy', 'أفراح'], ['grief', 'أحزان'], ['other', 'أعياد وعبادات']].map(function (f) {
        return '<button class="pill" data-a="filter" data-f="' + f[0] + '" aria-pressed="' + (occFilter === f[0]) + '">' + f[1] + '</button>';
      }).join('') + '</div>';
    let last = '';
    items.forEach(function (i) {
      const key = i.h.y + '-' + i.h.m;
      if (key !== last) { html += '<h2 class="sec">' + H.HIJRI_MONTHS[i.h.m - 1] + ' ' + ar(i.h.y) + '</h2>'; last = key; }
      html += evRow(i, t.jdn);
    });
    if (!items.length) html += '<div class="empty">لا توجد مناسبات</div>';
    html += '<p class="note">التواريخ حسب المشهور عند الشيعة الإمامية. بعض المناسبات فيها اختلاف روايات وقد نُبّه عليها. وتتبع التواريخ الميلادية بداية الشهر المضبوطة في التقويم.</p>';
    return html;
  }

  /* ---------- الإعدادات ---------- */
  function stepper(key, val) {
    return '<div class="step"><button data-a="adj" data-k="' + key + '" data-d="-1" aria-label="إنقاص">−</button><span>' + (val > 0 ? '+' : '') + ar(val) + '</span><button data-a="adj" data-k="' + key + '" data-d="1" aria-label="زيادة">+</button></div>';
  }
  function setHtml() {
    const opt = function (v, label, cur) { return '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + label + '</option>'; };
    let html = '<h2 class="sec">المرجع</h2><div class="grp"><div class="pr"><span>التقويم والمواقيت</span><select data-a="source" aria-label="المرجع">' +
      opt('hawza', 'حوزة الهدى (البحرين)', st.source) + opt('general', 'حساب عام (جعفري)', st.source) + '</select></div>' +
      '<div class="pad hint">' + (st.source === 'hawza'
        ? 'بدايات الشهور من تقويم الحوزة المعلن، وما بعده تقديري حتى يُعلن. الفجر ' + ar('16.5') + '° ومنتصف الليل للشروق، حسب جداولهم.'
        : 'تقويم حسابي والفجر ' + ar(16) + '° ومنتصف الليل للفجر. اضبط بداية الشهور بنفسك.') + '</div></div>';

    html += '<h2 class="sec">الموقع</h2><div class="grp"><div class="pr"><span>المدينة</span><select data-a="city" aria-label="المدينة">' +
      CITIES.map(function (c) { return opt(c.id, c.name, st.cityId); }).join('') +
      (st.cityId === 'gps' ? opt('gps', 'موقعي الحالي', 'gps') : '') + '</select></div>' +
      '<div class="pad"><button class="btn ghost" data-a="geo">استخدام موقعي الحالي</button><div class="hint" id="geoMsg" style="margin-top:6px"></div></div></div>';

    html += '<h2 class="sec">الأرقام</h2><div class="grp"><div class="pr"><span>شكل الأرقام</span><select data-a="digits" aria-label="شكل الأرقام">' +
      opt('latin', 'إنجليزية (123)', st.digits) + opt('arabic', 'عربية (١٢٣)', st.digits) + '</select></div></div>';

    html += '<h2 class="sec">تعديل المواقيت (بالدقائق)</h2><div class="grp">' +
      PRAYERS.map(function (p) { return '<div class="pr"><span>' + p.n + '</span>' + stepper('p:' + p.k, st.adj[p.k] || 0) + '</div>'; }).join('') +
      '</div><p class="note">للاحتياط أو لمطابقة تقويم المكتب الذي تتبعه.</p>';

    const ovKeys = Object.keys(st.overrides).sort(function (a, b) { return st.overrides[a] - st.overrides[b]; });
    html += '<h2 class="sec">التقويم الهجري</h2><div class="grp"><div class="pr"><span>إزاحة عامة على الشهور<span class="d">الأصل حسابي، وتُضبط الشهور بالرؤية من شاشة التقويم</span></span>' + stepper('offset', st.offset) + '</div>' +
      ovKeys.map(function (k) {
        const p = k.split('-');
        return '<div class="pr"><span>' + H.HIJRI_MONTHS[p[1] - 1] + ' ' + ar(p[0]) + '<span class="d">يبدأ ' + fmtG(st.overrides[k], true) + '</span></span><button class="btn ghost" data-a="delov" data-k="' + k + '">إلغاء</button></div>';
      }).join('') + '</div>';

    html += '<h2 class="sec">عن التطبيق</h2><div class="grp"><div class="pad hint">' +
      'مواقيت الصلاة تُحسب على الجهاز بدون إنترنت، وفق المذهب الجعفري: المغرب ' + ar(4) + '° (ذهاب الحمرة المشرقية)، وإعدادات الفجر ومنتصف الليل حسب المرجع المختار. ' +
      'وقت العشاء يلي المغرب ويمتد إلى منتصف الليل الشرعي.<br><br>' +
      'هذه الحسابات للاستئناس؛ يُرجى الرجوع لمكتب مرجعك أو إدارة الأوقاف الجعفرية عند الاحتياط، خاصة في بدايات الشهور والأعياد.<br><br>' +
      'يعمل التطبيق بدون إنترنت بعد أول فتح، ويمكن تثبيته على الشاشة الرئيسية من قائمة المتصفح.</div></div>';
    return html;
  }

  /* ---------- الرسم ---------- */
  function render(keepScroll) {
    $view.innerHTML = view === 'home' ? homeHtml() : view === 'cal' ? calHtml() : view === 'occ' ? occHtml() : setHtml();
    document.querySelectorAll('.tabs button').forEach(function (b) {
      if (b.dataset.v === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    document.getElementById('locLabel').textContent = st.name;
    if (!keepScroll) window.scrollTo(0, 0);
    tick();
  }

  function shiftMonth(delta) {
    const p = delta > 0 ? H.nextYM(calYM.y, calYM.m) : H.prevYM(calYM.y, calYM.m);
    calYM = { y: p[0], m: p[1] };
    selJdn = null;
  }

  document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-a]');
    if (!el || el.tagName === 'SELECT') return;
    const a = el.dataset.a;
    let keep = true;
    if (a === 'nav') { view = el.dataset.v; keep = false; }
    else if (a === 'prev') shiftMonth(-1);
    else if (a === 'next') shiftMonth(1);
    else if (a === 'today') { calYM = null; selJdn = null; }
    else if (a === 'pick') selJdn = +el.dataset.j;
    else if (a === 'filter') occFilter = el.dataset.f;
    else if (a === 'toggleAdjust') showAdjust = !showAdjust;
    else if (a === 'toggleSalih') showSalihOn = !showSalihOn;
    else if (a === 'ms') {
      st.overrides[calYM.y + '-' + calYM.m] = hj.monthStart(calYM.y, calYM.m) + (+el.dataset.d);
      rebuild();
    } else if (a === 'msreset') { delete st.overrides[calYM.y + '-' + calYM.m]; rebuild(); }
    else if (a === 'delov') { delete st.overrides[el.dataset.k]; rebuild(); }
    else if (a === 'adj') {
      const k = el.dataset.k, d = +el.dataset.d;
      if (k === 'offset') { st.offset = Math.max(-3, Math.min(3, st.offset + d)); rebuild(); }
      else { const p = k.slice(2); st.adj[p] = Math.max(-30, Math.min(30, (st.adj[p] || 0) + d)); save(); }
    } else if (a === 'geo') { geolocate(); return; }
    else return;
    render(keep);
  });

  document.addEventListener('change', function (e) {
    const a = e.target.dataset.a;
    if (a === 'source') { st.source = e.target.value; rebuild(); render(true); return; }
    if (a === 'digits') { st.digits = e.target.value; save(); render(true); return; }
    if (a !== 'city') return;
    const c = CITIES.filter(function (x) { return x.id === e.target.value; })[0];
    if (!c) return;
    st.cityId = c.id; st.name = c.name; st.lat = c.lat; st.lng = c.lng; st.tz = 3;
    save(); render(true);
  });

  function geolocate() {
    const msg = document.getElementById('geoMsg');
    if (!navigator.geolocation) { msg.textContent = 'المتصفح لا يدعم تحديد الموقع.'; return; }
    msg.textContent = 'جارٍ تحديد الموقع…';
    navigator.geolocation.getCurrentPosition(function (pos) {
      st.cityId = 'gps'; st.name = 'موقعي الحالي';
      st.lat = pos.coords.latitude; st.lng = pos.coords.longitude;
      st.tz = -new Date().getTimezoneOffset() / 60;
      save(); render(true);
    }, function () {
      msg.textContent = 'تعذّر تحديد الموقع. تأكد من السماح للمتصفح بالوصول للموقع.';
    }, { timeout: 10000 });
  }

  render();
  setInterval(tick, 1000);

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(function () { /* ignore */ });
  }
})();
