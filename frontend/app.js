/* =========================================================
   Моніторинг температури та вологості — логіка сторінки
   ---------------------------------------------------------
   Очікує від бекенду (див. README.md):
     GET /api/latest              -> { temp, humid, time }
     GET /api/hourly?hours=24     -> [ { label, start, temp, humid, count }, ... ]
     GET /api/daily?days=7        -> [ { label, start, temp, humid, count }, ... ]
   Якщо бекенд недоступний — показує демо-дані.
   ========================================================= */
'use strict';

/* ---------------- конфігурація ---------------- */

// window.SENSOR_API_BASE можна задати у <script> перед app.js
const API_BASE = (() => {
  if (typeof window.SENSOR_API_BASE === 'string') {
    return window.SENSOR_API_BASE.replace(/\/+$/, '');
  }
  // якщо сторінку віддає сам Go-сервер (порт 3000) — працюємо на тому ж origin
  if (location.protocol.startsWith('http') && location.port === '3000') return '';
  return 'http://localhost:3000';
})();

const REFRESH_MS    = 30_000;   // датчик пише кожні 30 с
const FETCH_TIMEOUT = 8_000;
const HOURS         = 24;       // період гістограми
const DAYS          = 7;        // період тижневого зрізу

const PANELS = [
  {
    metric: 'temp', unit: '°C', digits: 1, weekDigits: 1,
    other: 'humid', otherUnit: '%', otherDigits: 0, otherLabel: 'вологість',
  },
  {
    metric: 'humid', unit: '%', digits: 1, weekDigits: 0,
    other: 'temp', otherUnit: '°C', otherDigits: 1, otherLabel: 'температура',
  },
];

const WEEKDAYS = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/* ---------------- дрібні хелпери ---------------- */

const $  = (s, r = document) => r.querySelector(s);

const pad2 = (n) => String(n).padStart(2, '0');

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const fmt = (v, d = 1) => (v === null || v === undefined ? '—' : v.toFixed(d));

function parseTime(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const fmtDay   = (d) => `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`;
const fmtClock = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const fmtStamp = (d) => `${fmtDay(d)} ${fmtClock(d)}`;

/* ---------------- мережа ---------------- */

async function api(path) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(API_BASE + path, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- нормалізація відповідей ---------------- */

function normLatest(raw) {
  let o = raw;
  if (Array.isArray(o)) o = o[0];
  if (o && typeof o === 'object' && o.data) o = o.data;
  if (!o || typeof o !== 'object') return null;

  const latest = {
    temp:  num(o.temp  ?? o.temperature ?? o.t),
    humid: num(o.humid ?? o.humidity    ?? o.h),
    time:  parseTime(o.time ?? o.Time ?? o.timestamp ?? o.date),
  };
  return latest.temp === null && latest.humid === null ? null : latest;
}

function normSeries(raw, kind) {
  const arr = Array.isArray(raw) ? raw
            : Array.isArray(raw && raw.data) ? raw.data
            : [];

  const out = [];
  for (const o of arr) {
    if (!o || typeof o !== 'object') continue;

    const time = parseTime(o.start ?? o.time ?? o.date ?? o.hour);
    let label  = o.label ?? o.date ?? o.hour ?? '';
    if (!label && time) label = kind === 'daily' ? fmtDay(time) : fmtClock(time);

    const temp  = num(o.temp  ?? o.avgTemp  ?? o.avg_temp  ?? o.temperature);
    const humid = num(o.humid ?? o.avgHumid ?? o.avg_humid ?? o.humidity);
    if (temp === null && humid === null) continue;

    out.push({
      label: String(label),
      weekday: kind === 'daily' && time ? WEEKDAYS[time.getDay()] : '',
      temp, humid,
      count: num(o.count ?? o.n),
      time,
    });
  }

  if (out.every((d) => d.time)) out.sort((a, b) => a.time - b.time);
  return out;
}

/* ---------------- демо-дані (коли бекенд недоступний) ---------------- */

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function demoData() {
  const rnd = mulberry32(20261018);
  const now = new Date();

  const hourly = [];
  for (let i = HOURS - 1; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 3600e3);
    const h = t.getHours();
    const phase = Math.sin(((h - 15) / 24) * Math.PI * 2); // вночі холодніше
    hourly.push({
      label: `${pad2(h)}:00`,
      weekday: '',
      time: t,
      temp:  +(19 + 3 * phase + (rnd() - 0.5) * 0.7).toFixed(2),
      humid: +clamp(84 - 13 * phase + (rnd() - 0.5) * 4, 20, 100).toFixed(2),
      count: 120,
    });
  }

  const daily = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    daily.push({
      label: fmtDay(d),
      weekday: WEEKDAYS[d.getDay()],
      time: d,
      temp:  +(18.5 + 2 * Math.sin(i * 1.15) + (rnd() - 0.5) * 1.6).toFixed(2),
      humid: +clamp(80 + 6 * Math.cos(i * 0.9) + (rnd() - 0.5) * 7, 20, 100).toFixed(2),
      count: 2880,
    });
  }

  const last = hourly[hourly.length - 1];
  return {
    latest: { temp: last.temp, humid: last.humid, time: now },
    hourly,
    daily,
    demo: true,
  };
}

/* ---------------- SVG-гістограма ---------------- */

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

function renderChart(host, items, cfg) {
  host.textContent = '';

  const values = items.map((d) => d[cfg.metric]).filter((v) => v !== null);
  if (!values.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'Немає даних за цей період';
    host.appendChild(p);
    return;
  }

  const W = Math.max(240, Math.round(host.clientWidth || 320));
  const H = host.clientHeight || 190;
  const PAD = { top: 14, right: 8, bottom: 30, left: 42 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 0.5) { const c = (max + min) / 2; min = c - 0.5; max = c + 0.5; }
  const span = max - min;
  min -= span * 0.14;
  max += span * 0.14;

  const yOf = (v) => PAD.top + plotH - ((v - min) / (max - min)) * plotH;
  const axisDigits = (max - min) < 6 ? 1 : 0;

  const root = svg('svg', {
    viewBox: `0 0 ${W} ${H}`,
    width: '100%',
    height: H,
    preserveAspectRatio: 'xMidYMid meet',
  });

  // сітка + підписи осі Y
  const TICKS = 4;
  for (let i = 0; i <= TICKS; i++) {
    const val = min + (max - min) * (i / TICKS);
    const y = Math.round(yOf(val)) + 0.5;
    root.appendChild(svg('line', {
      class: 'grid-line', x1: PAD.left, x2: W - PAD.right, y1: y, y2: y,
    }));
    const txt = svg('text', {
      class: 'axis-text', x: PAD.left - 7, y: y + 3.5, 'text-anchor': 'end',
    });
    txt.textContent = val.toFixed(axisDigits);
    root.appendChild(txt);
  }

  // стовпці
  const slot = plotW / items.length;
  const barW = clamp(slot * 0.66, 2, 34);
  const radius = barW >= 7 ? 3 : 1;

  items.forEach((d, i) => {
    const v = d[cfg.metric];
    if (v === null) return;

    const x = PAD.left + slot * i + (slot - barW) / 2;
    const y = yOf(v);
    const h = Math.max(1, PAD.top + plotH - y);

    const rect = svg('rect', {
      class: 'bar',
      x: x.toFixed(2), y: y.toFixed(2),
      width: barW.toFixed(2), height: h.toFixed(2),
      rx: radius,
    });

    const tip = svg('title');
    tip.textContent =
      `${d.label}${d.weekday ? ' (' + d.weekday + ')' : ''} — ` +
      `${fmt(v, cfg.digits)} ${cfg.unit}` +
      (d.count ? ` · вимірів: ${d.count}` : '');
    rect.appendChild(tip);
    root.appendChild(rect);
  });

  // підписи осі X
  const maxLabels = slot > 34 ? 12 : slot > 22 ? 8 : 6;
  const step = Math.max(1, Math.ceil(items.length / maxLabels));
  items.forEach((d, i) => {
    if (i % step !== 0 && i !== items.length - 1) return;
    const txt = svg('text', {
      class: 'bar-label',
      x: PAD.left + slot * i + slot / 2,
      y: H - PAD.bottom + 16,
    });
    txt.textContent = d.label;
    root.appendChild(txt);
  });

  host.appendChild(root);
}

/* ---------------- тижневий список ---------------- */

function renderWeek(host, items, cfg) {
  host.textContent = '';

  const vals = items.map((d) => d[cfg.metric]).filter((v) => v !== null);
  if (!vals.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Немає даних за тиждень';
    host.appendChild(li);
    return;
  }

  const min = Math.min(...vals);
  const max = Math.max(...vals);

  [...items].reverse().forEach((d) => {
    const value = d[cfg.metric];
    const other = d[cfg.other];

    const li = document.createElement('li');
    li.className = 'week__row';

    const day = document.createElement('span');
    day.className = 'week__day';
    day.textContent = d.label;
    if (d.weekday) {
      const small = document.createElement('small');
      small.textContent = d.weekday;
      day.appendChild(small);
    }

    const bar = document.createElement('span');
    bar.className = 'week__bar';
    const fill = document.createElement('i');
    const pct = max === min ? 100 : ((value - min) / (max - min)) * 100;
    fill.style.width = `${clamp(pct, 4, 100).toFixed(1)}%`;
    bar.appendChild(fill);

    const val = document.createElement('span');
    val.className = 'week__val';
    val.textContent = fmt(value, cfg.weekDigits);
    const unit = document.createElement('small');
    unit.textContent = cfg.unit;
    val.appendChild(unit);

    li.append(day, bar, val);

    if (other !== null && other !== undefined) {
      const rest = document.createElement('span');
      rest.className = 'week__other';
      rest.textContent = `${cfg.otherLabel} ${fmt(other, cfg.otherDigits)} ${cfg.otherUnit}`;
      li.appendChild(rest);
    }

    host.appendChild(li);
  });
}

/* ---------------- рендер усієї сторінки ---------------- */

let lastState = null;

function render(state) {
  lastState = state;

  document.querySelectorAll('.panel').forEach((panel) => {
    const cfg = PANELS.find((p) => p.metric === panel.dataset.metric);
    if (!cfg) return;

    const current = panel.querySelector('[data-role="current"]');
    const timeEl  = panel.querySelector('[data-role="current-time"]');

    const value = state.latest ? state.latest[cfg.metric] : null;
    current.textContent = fmt(value, cfg.digits);
    timeEl.textContent  = state.latest && state.latest.time
      ? fmtStamp(state.latest.time)
      : '—';

    renderChart(panel.querySelector('[data-role="chart"]'), state.hourly, cfg);
    renderWeek(panel.querySelector('[data-role="week"]'), state.daily, cfg);
  });

  // статус
  const dot  = $('#status-dot');
  const text = $('#status-text');

  dot.className = 'dot ' + (state.error ? 'dot--warn' : 'dot--ok');
  text.textContent = state.error
    ? 'демо-дані'
    : `оновлено ${fmtStamp(new Date())}`;

  // банер
  const banner = $('#banner');
  if (state.error) {
    banner.hidden = false;
    banner.innerHTML = '';

    const b = document.createElement('b');
    b.textContent = 'Демо-режим. ';
    banner.append(
      b,
      `Бекенд недоступний за адресою ${API_BASE || location.origin} — показано згенеровані дані. `,
      `Додайте API-ендпойнти (див. frontend/README.md) або запустіть сервер.`
    );
  } else {
    banner.hidden = true;
  }
}

/* ---------------- завантаження ---------------- */

async function load() {
  const btn = $('#refresh');
  btn.disabled = true;
  try {
    const [latestRaw, hourlyRaw, dailyRaw] = await Promise.all([
      api('/api/latest'),
      api(`/api/hourly?hours=${HOURS}`),
      api(`/api/daily?days=${DAYS}`),
    ]);

    const latest = normLatest(latestRaw);
    const hourly = normSeries(hourlyRaw, 'hourly');
    const daily  = normSeries(dailyRaw, 'daily');

    if (!latest && !hourly.length && !daily.length) throw new Error('порожні дані');

    render({ latest, hourly, daily, error: null });
  } catch (err) {
    console.warn('[sensor-dashboard] бекенд недоступний:', err.message);
    render({ ...demoData(), error: err });
  } finally {
    btn.disabled = false;
  }
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/* ---------------- старт ---------------- */

function start() {
  $('#refresh').addEventListener('click', load);

  $('#api-info').textContent = 'API: ' + (API_BASE || location.origin);

  load();
  setInterval(load, REFRESH_MS);

  // перемальовуємо графіки при зміні розміру вікна
  window.addEventListener('resize', debounce(() => {
    if (lastState) render(lastState);
  }, 150));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
