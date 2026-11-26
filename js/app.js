(function () {
  'use strict';

  const H = window.Hijri, P = window.Prayer, E = window.Occasions;

  /* ---------- أدوات ---------- */
  const AR = '٠١٢٣٤٥٦٧٨٩';
  const ar = function (n) { return String(n).replace(/\d/g, function (d) { return AR[d]; }); };
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
    { k: 'fajr', n: 'الفجر', main: true },
    { k: 'sunrise', n: 'الشروق' },
    { k: 'dhuhr', n: 'الظهر', main: true },
    { k: 'sunset', n: 'الغروب' },
    { k: 'maghrib', n: 'المغرب', main: true },
    { k: 'midnight', n: 'منتصف الليل الشرعي' }
  ];

  /* ---------- الإعدادات ---------- */
  const KEY = 'hadi.settings.v1';
  const DEFAULTS = {
    cityId: 'manama', name: 'المنامة', lat: 26.2285, lng: 50.5860, tz: 3,
    offset: 0, overrides: {}, adj: {}
  };
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || '{}');
      return Object.assign({}, DEFAULTS, s, { overrides: s.overrides || {}, adj: s.adj || {} });
    } catch (e) { return Object.assign({}, DEFAULTS); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } }

  let st = load();
  let hj = H.create(st);
  function rebuild() { hj = H.create(st); save(); }

  /* ---------- الوقت (بتوقيت الموقع المختار) ---------- */
  function now() {
    const d = new Date(Date.now() + st.tz * 3600000);
    return {
      jdn: H.gregToJdn(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()),
      sec: d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds()
    };
  }
  function dayTimes(jdn) { return P.times(jdn, st, st.adj); }

  function clock(h) {
    if (h == null || isNaN(h)) return '—';
    let m = Math.round(h * 60);
    m = ((m % 1440) + 1440) % 1440;
    const hh = Math.floor(m / 60), mm = m % 60;
    let h12 = hh % 12; if (h12 === 0) h12 = 12;
    return ar(h12) + ':' + ar(pad(mm)) + ' ' + (hh >= 12 ? 'م' : 'ص');
  }
  function hms(sec) {
    sec = Math.max(0, Math.floor(sec));
    return ar(pad(Math.floor(sec / 3600))) + ':' + ar(pad(Math.floor(sec % 3600 / 60))) + ':' + ar(pad(sec % 60));
  }

  function gregOf(jdn) { return H.jdnToGreg(jdn); }
  function fmtG(jdn, withDay) {
    const g = gregOf(jdn);
    return (withDay ? H.WEEKDAYS[H.weekday(jdn)] + ' ' : '') + ar(g.d) + ' ' + H.GREG_MONTHS[g.m - 1] + ' ' + ar(g.y) + 'م';
  }
  function fmtH(h) { return ar(h.d) + ' ' + H.HIJRI_MONTHS[h.m - 1] + ' ' + ar(h.y) + 'هـ'; }
  function daysText(n) {
    if (n === 0) return 'اليوم';
    if (n === 1) return 'غداً';
    if (n === 2) return 'بعد يومين';
    return 'بعد ' + ar(n) + (n <= 10 ? ' أيام' : ' يوماً');
  }

  /* ---------- المناسبات ---------- */
  function eventsOnJdn(jdn) {
    const h = hj.fromJdn(jdn);
    return E.on(h.m, h.d, hj.monthLength(h.y, h.m));
  }
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

  function evRow(item, nowJdn, showMonthStart) {
    const ev = item.ev, h = item.h;
    const n = item.jdn - nowJdn;
    return '<div class="ev t-' + ev.type + '">' +
      '<div class="badge"><b>' + ar(h.d) + '</b><small>' + H.HIJRI_MONTHS[h.m - 1].replace('شهر ', '') + '</small></div>' +
      '<div style="flex:1;min-width:0">' +
        '<div class="tt">' + ev.title + '</div>' +
        '<div class="meta"><span class="tag">' + (ev.night ? 'ليلة' : E.TYPE_LABEL[ev.type]) + '</span>' + fmtG(item.jdn, true) + '</div>' +
        (ev.note ? '<div class="nt">' + ev.note + '</div>' : '') +
        (ev.night ? '<div class="nt">تبدأ عند مغرب اليوم السابق لهذا التاريخ</div>' : '') +
      '</div>' +
      (nowJdn != null && n >= 0 ? '<div class="when">' + daysText(n) + '</div>' : '') +
    '</div>';
  }

  function deeds(jdn, h) {
    const out = [];
    const wd = H.weekday(jdn);
    if (wd === 4) out.push('مساء اليوم ليلة الجمعة: دعاء كميل وزيارة الإمام الحسين (ع)');
    if (wd === 5) out.push('يوم الجمعة: دعاء الندبة والإكثار من الصلاة على محمد وآل محمد');
    if ((h.d === 13 || h.d === 14 || h.d === 15) && h.m !== 9 && h.m !== 12) out.push('من الأيام البيض: يُستحب صيامها');
    if (h.m === 7 || h.m === 8) out.push('شهر ' + (h.m === 7 ? 'رجب' : 'شعبان') + ': يُستحب الاستغفار وكثرة الدعاء والصيام');
    if (h.m === 1 && h.d <= 10) out.push('عشرة محرم: أيام عزاء الإمام الحسين (ع)');
    return out;
  }

  /* ---------- الحالة ---------- */
  let view = 'home';
  let calYM = null;      // {y, m}
  let selJdn = null;
  let occFilter = 'all';
  let showAdjust = false;
  let tickRef = null;

  const FILTERS = {
    all: null,
    joy: function (ev) { return ev.type === 'joy'; },
    grief: function (ev) { return ev.type === 'grief'; },
    other: function (ev) { return ev.type === 'eid' || ev.type === 'ibadah' || ev.type === 'month'; }
  };

  /* ---------- الشاشة الرئيسية ---------- */
  function homeHtml() {
    const t = now();
    const h = hj.fromJdn(t.jdn);
    const times = dayTimes(t.jdn);
    const tomorrow = hj.fromJdn(t.jdn + 1);
    const ups = upcoming(t.jdn, 400, 4);
    const dd = deeds(t.jdn, h);

    let html = '<section class="card hero">' +
      '<div class="wd">' + H.WEEKDAYS[H.weekday(t.jdn)] + '</div>' +
      '<div class="hd">' + fmtH(h) + '</div>' +
      '<div class="gd">' + fmtG(t.jdn) + '</div>' +
      '<div class="next"><div><div class="lbl">الصلاة القادمة</div><div class="nm" id="nextName"></div></div>' +
      '<div><div class="cd" id="nextCd"></div><div class="tm" id="nextTm"></div></div></div>' +
      '<div class="night">بعد المغرب تبدأ ليلة ' + H.WEEKDAYS[H.weekday(t.jdn + 1)] + ' — ' + fmtH(tomorrow) + '</div>' +
    '</section>';

    html += '<section class="card"><h2>مواقيت الصلاة</h2><ul class="times" id="timesList">' +
      PRAYERS.map(function (p) {
        return '<li data-k="' + p.k + '" class="' + (p.main ? '' : 'sub') + '"><span class="n">' + p.n + '</span><span class="t">' + clock(times[p.k]) + '</span></li>';
      }).join('') +
      '</ul><div class="note">حسب المذهب الجعفري: الفجر ١٦°، والمغرب بعد ذهاب الحمرة المشرقية (٤°). ' + st.name + '</div></section>';

    html += '<section class="card"><h2>المناسبات القادمة <button class="link" data-a="nav" data-v="occ">عرض الكل</button></h2>' +
      (ups.length ? ups.map(function (i) { return evRow(i, t.jdn); }).join('') : '<div class="empty">لا مناسبات قريبة</div>') +
    '</section>';

    if (dd.length) {
      html += '<section class="card"><h2>أعمال اليوم</h2>' +
        dd.map(function (x) { return '<div class="ev"><div class="nt" style="color:var(--ink);font-size:15px">• ' + x + '</div></div>'; }).join('') +
      '</section>';
    }
    return html;
  }

  // تحديث العدّاد والصلاة الحالية كل ثانية
  function tick() {
    if (view !== 'home') return;
    const t = now();
    const el = document.getElementById('nextCd');
    if (!el) return;
    const times = dayTimes(t.jdn);
    const list = PRAYERS.map(function (p) { return { k: p.k, n: p.n, at: times[p.k] * 3600 }; });
    list.push({ k: 'fajr', n: 'الفجر', at: times.nextFajr * 3600 });
    let nextIdx = list.findIndex(function (x) { return x.at > t.sec; });
    if (nextIdx < 0) nextIdx = list.length - 1;
    const nx = list[nextIdx];
    document.getElementById('nextName').textContent = nx.n;
    el.textContent = hms(nx.at - t.sec);
    document.getElementById('nextTm').textContent = 'عند ' + clock(nx.at / 3600);
    // الفترة الحالية
    let cur = -1;
    for (let i = 0; i < PRAYERS.length; i++) if (list[i].at <= t.sec) cur = i;
    document.querySelectorAll('#timesList li').forEach(function (li, i) { li.classList.toggle('cur', i === cur); });
    if (hj.fromJdn(t.jdn).d !== tickRef) { tickRef = hj.fromJdn(t.jdn).d; render(true); }
  }

  /* ---------- التقويم ---------- */
  function calHtml() {
    const t = now();
    if (!calYM) { const h = hj.fromJdn(t.jdn); calYM = { y: h.y, m: h.m }; }
    const y = calYM.y, m = calYM.m;
    const start = hj.monthStart(y, m), len = hj.monthLength(y, m);
    const g1 = gregOf(start), g2 = gregOf(start + len - 1);
    if (selJdn == null || selJdn < start || selJdn >= start + len) {
      selJdn = (t.jdn >= start && t.jdn < start + len) ? t.jdn : start;
    }
    const lead = (H.weekday(start) + 1) % 7; // السبت أول الأسبوع
    const days = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<div class="cell void"></div>';
    for (let d = 1; d <= len; d++) {
      const j = start + d - 1;
      const evs = E.on(m, d, len);
      const wd = H.weekday(j);
      const g = gregOf(j);
      const types = evs.map(function (e) { return e.type; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
      cells += '<button class="cell' + (j === t.jdn ? ' today' : '') + (j === selJdn ? ' sel' : '') + (wd === 5 ? ' fri' : '') + '" data-a="pick" data-j="' + j + '" aria-label="' + ar(d) + ' ' + H.HIJRI_MONTHS[m - 1] + '">' +
        '<span class="h">' + ar(d) + '</span><span class="g">' + ar(g.d) + '</span>' +
        '<span class="dots">' + types.map(function (ty) { return '<i class="t-' + ty + '"></i>'; }).join('') + '</span></button>';
    }

    const gTitle = g1.m === g2.m ? H.GREG_MONTHS[g1.m - 1] + ' ' + ar(g1.y) :
      H.GREG_MONTHS[g1.m - 1] + (g1.y !== g2.y ? ' ' + ar(g1.y) : '') + ' – ' + H.GREG_MONTHS[g2.m - 1] + ' ' + ar(g2.y);

    let html = '<div class="calhead">' +
      '<button class="icon-btn" data-a="next" aria-label="الشهر التالي">›</button>' +
      '<div class="ttl"><b>' + H.HIJRI_MONTHS[m - 1] + ' ' + ar(y) + 'هـ</b><span>' + gTitle + ' · ' + ar(len) + ' يوماً</span></div>' +
      '<button class="icon-btn" data-a="prev" aria-label="الشهر السابق">‹</button></div>' +
      '<div class="btns" style="justify-content:center;margin:0 0 4px"><button class="chip" data-a="today">اليوم</button>' +
      '<button class="chip" data-a="toggleAdjust" aria-pressed="' + showAdjust + '">ضبط بداية الشهر</button></div>';

    if (showAdjust) {
      const isOv = st.overrides[y + '-' + m] != null;
      html += '<div class="card"><div class="row" style="padding-top:0"><div><b>أول ' + H.HIJRI_MONTHS[m - 1] + '</b><div class="d">' + fmtG(start, true) + (isOv ? ' · معدّل يدوياً' : '') + '</div></div>' +
        '<div class="step"><button data-a="ms" data-d="-1" aria-label="يوم قبل">−</button><span>١ يوم</span><button data-a="ms" data-d="1" aria-label="يوم بعد">+</button></div></div>' +
        '<div class="hint">يبدأ الشهر عند الشيعة بالرؤية. اضبط اليوم حسب إعلان إدارة الأوقاف الجعفرية في البحرين أو مرجعك. تغيير بداية شهر يغيّر طول الشهر السابق له تلقائياً.</div>' +
        (isOv ? '<div class="btns"><button class="btn ghost" data-a="msreset">إعادة للحساب الافتراضي</button></div>' : '') + '</div>';
    }

    html += '<div class="grid">' + days.map(function (n, i) { return '<div class="dow' + (i === 6 ? ' fri' : '') + '">' + n + '</div>'; }).join('') + cells + '</div>' +
      '<div class="legend"><span class="t-joy"><i></i>فرح</span><span class="t-grief"><i></i>حزن</span><span class="t-eid"><i></i>عيد</span><span class="t-ibadah"><i></i>عبادات</span><span class="t-month"><i></i>غرة شهر</span></div>';

    // تفاصيل اليوم المختار
    const sh = hj.fromJdn(selJdn);
    const sev = E.on(sh.m, sh.d, len);
    const tm = dayTimes(selJdn);
    html += '<section class="card detail"><h3>' + H.WEEKDAYS[H.weekday(selJdn)] + ' ' + fmtH(sh) + '</h3><div class="sub">' + fmtG(selJdn) + '</div>' +
      (sev.length ? sev.map(function (ev) {
        return evRow({ jdn: selJdn, h: sh, ev: ev }, null);
      }).join('') : '<div class="hint" style="margin:6px 0">لا توجد مناسبة مسجّلة في هذا اليوم.</div>') +
      '<div class="mini">' +
        ['fajr', 'sunrise', 'dhuhr', 'sunset', 'maghrib', 'midnight'].map(function (k) {
          return '<div>' + PRAYERS.filter(function (p) { return p.k === k; })[0].n.replace(' الشرعي', '') + '<b>' + clock(tm[k]) + '</b></div>';
        }).join('') + '</div></section>';

    return html;
  }

  /* ---------- المناسبات ---------- */
  function occHtml() {
    const t = now();
    const items = upcoming(t.jdn, 370, 120, FILTERS[occFilter]);
    let html = '<div class="chips" role="group" aria-label="تصفية">' +
      [['all', 'الكل'], ['joy', 'أفراح'], ['grief', 'أحزان'], ['other', 'أعياد وعبادات']].map(function (f) {
        return '<button class="chip" data-a="filter" data-f="' + f[0] + '" aria-pressed="' + (occFilter === f[0]) + '">' + f[1] + '</button>';
      }).join('') + '</div>';
    let last = '';
    items.forEach(function (i) {
      const key = i.h.y + '-' + i.h.m;
      if (key !== last) { html += '<div class="mh">' + H.HIJRI_MONTHS[i.h.m - 1] + ' ' + ar(i.h.y) + 'هـ</div>'; last = key; }
      html += '<div class="card" style="margin:6px 0;padding:6px 14px">' + evRow(i, t.jdn) + '</div>';
    });
    if (!items.length) html += '<div class="empty">لا توجد مناسبات</div>';
    html += '<p class="note">التواريخ حسب المشهور عند الشيعة الإمامية. بعض المناسبات فيها اختلاف روايات وقد نُبّه عليها. وتتبع التواريخ الميلادية بداية الشهر المضبوطة في التقويم.</p>';
    return html;
  }

  /* ---------- الإعدادات ---------- */
  function stepper(key, val, unit) {
    return '<div class="step"><button data-a="adj" data-k="' + key + '" data-d="-1" aria-label="إنقاص">−</button><span>' + (val > 0 ? '+' : '') + ar(val) + '</span><button data-a="adj" data-k="' + key + '" data-d="1" aria-label="زيادة">+</button></div>';
  }
  function setHtml() {
    let html = '<section class="card"><h2>الموقع</h2><div class="row"><span>المدينة</span><select data-a="city" aria-label="المدينة">' +
      CITIES.map(function (c) { return '<option value="' + c.id + '"' + (c.id === st.cityId ? ' selected' : '') + '>' + c.name + '</option>'; }).join('') +
      (st.cityId === 'gps' ? '<option value="gps" selected>موقعي الحالي</option>' : '') + '</select></div>' +
      '<div class="btns"><button class="btn ghost" data-a="geo">استخدام موقعي الحالي</button></div>' +
      '<div class="hint" id="geoMsg" style="margin-top:6px"></div></section>';

    html += '<section class="card"><h2>تعديل المواقيت (بالدقائق)</h2>' +
      PRAYERS.map(function (p) {
        return '<div class="row"><span>' + p.n + '</span>' + stepper('p:' + p.k, st.adj[p.k] || 0) + '</div>';
      }).join('') +
      '<div class="hint">للاحتياط أو لمطابقة تقويم المكتب الذي تتبعه.</div></section>';

    const ovKeys = Object.keys(st.overrides).sort(function (a, b) { return st.overrides[a] - st.overrides[b]; });
    html += '<section class="card"><h2>التقويم الهجري</h2>' +
      '<div class="row"><div><div>إزاحة عامة على كل الشهور</div><div class="d">الأصل: التقويم الحسابي، وتُضبط الشهور بالرؤية من شاشة التقويم</div></div>' + stepper('offset', st.offset) + '</div>' +
      (ovKeys.length ? '<div class="hint" style="margin-top:6px">شهور مضبوطة يدوياً: ' + ovKeys.length + '</div>' +
        ovKeys.map(function (k) {
          const p = k.split('-');
          return '<div class="row"><span>' + H.HIJRI_MONTHS[p[1] - 1] + ' ' + ar(p[0]) + '<div class="d">يبدأ ' + fmtG(st.overrides[k], true) + '</div></span><button class="btn ghost" data-a="delov" data-k="' + k + '">إلغاء</button></div>';
        }).join('') : '') + '</section>';

    html += '<section class="card"><h2>عن التطبيق</h2><div class="hint">' +
      'مواقيت الصلاة تُحسب على الجهاز بدون إنترنت، وفق المذهب الجعفري: الفجر ١٦°، المغرب ٤° (ذهاب الحمرة المشرقية)، ومنتصف الليل الشرعي بين الغروب والفجر. ' +
      'وقت العشاء يلي المغرب ويمتد إلى منتصف الليل الشرعي.<br><br>' +
      'هذه الحسابات للاستئناس؛ يُرجى الرجوع لمكتب مرجعك أو إدارة الأوقاف الجعفرية عند الاحتياط، خاصة في بدايات الشهور والأعياد.</div>' +
      '<div class="warn">يعمل التطبيق بدون إنترنت بعد أول فتح، ويمكن تثبيته على الشاشة الرئيسية من قائمة المتصفح.</div></section>';
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
    let p = [calYM.y, calYM.m];
    p = delta > 0 ? H.nextYM(p[0], p[1]) : H.prevYM(p[0], p[1]);
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
    else if (a === 'ms') {
      const k = calYM.y + '-' + calYM.m;
      st.overrides[k] = hj.monthStart(calYM.y, calYM.m) + (+el.dataset.d);
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
    if (e.target.dataset.a !== 'city') return;
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
