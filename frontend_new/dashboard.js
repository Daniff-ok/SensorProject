'use strict';
(() => {
  const $ = (s) => document.querySelector(s);
  const ZONE = 'Europe/Kyiv';
  const formatter = (options) => new Intl.DateTimeFormat('uk-UA', { timeZone: ZONE, ...options });
  const clock = formatter({ hour: '2-digit', minute: '2-digit' });
  const date = formatter({ day: '2-digit', month: '2-digit' });
  const weekday = formatter({ weekday: 'short' });
  const stamp = formatter({ day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
  const dayKey = (d) => formatter({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const number = (v) => typeof v === 'number' && Number.isFinite(v) ? v : null;
  const time = (v) => typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v) : null;
  const fmt = (v) => v === null || v === undefined ? '—' : v.toLocaleString('uk-UA', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const params = new URLSearchParams(location.search);
  let source = params.get('source') === 'demo' ? 'demo' : 'live';
  let period = params.get('period') === 'week' ? 'week' : 'day';
  let settings = { minTemp: null, maxHumid: null };
  try { const saved = JSON.parse(localStorage.getItem('air-thresholds')); if (saved) settings = { minTemp: number(saved.minTemp), maxHumid: number(saved.maxHumid) }; } catch { /* Storage may be unavailable. */ }
  const state = { latest: { data: null, error: null }, hourly: { data: [], error: null }, daily: { data: [], error: null } };
  let controller;
  let loading = false;
  const apiBase = typeof window.SENSOR_API_BASE === 'string' ? window.SENSOR_API_BASE.replace(/\/+$/, '') : '';
  function normalizeRow(raw, latest = false) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Некоректний формат відповіді');
    const row = { temp: number(raw.temp), humid: number(raw.humid), time: time(latest ? raw.time : raw.start), count: number(raw.count) };
    if (!row.time || (raw.temp != null && row.temp === null) || (raw.humid != null && row.humid === null) || (row.humid !== null && (row.humid < 0 || row.humid > 100))) throw new Error('Некоректні значення або час у відповіді');
    return row;
  }
  function normalize(raw, key) {
    if (key === 'latest') return raw === null ? null : normalizeRow(raw, true);
    if (raw === null) return [];
    if (!Array.isArray(raw)) throw new Error('Очікується масив вимірів');
    return raw.map((r) => normalizeRow(r)).sort((a, b) => a.time - b.time);
  }
  function syncURL() {
    const url = new URL(location.href);
    source === 'live' ? url.searchParams.delete('source') : url.searchParams.set('source', source);
    period === 'day' ? url.searchParams.delete('period') : url.searchParams.set('period', period);
    history.replaceState(null, '', url);
  }
  function sample() {
    const now = new Date();
    now.setSeconds(0, 0);
    const hourly = Array.from({ length: 49 }, (_, i) => ({ time: new Date(+now - (48 - i) * 1800000), temp: +(20.5 + Math.sin(i / 7) * 1.8 - Math.cos(i / 3) * .25).toFixed(1), humid: +(55 + Math.cos(i / 8) * 8 + Math.sin(i / 3) * 2).toFixed(1) }));
    const daily = Array.from({ length: 7 }, (_, i) => ({ time: new Date(+now - (6 - i) * 86400000), temp: +(20 + Math.sin(i * .9) * 1.3).toFixed(1), humid: +(56 + Math.cos(i * .8) * 5).toFixed(1) }));
    return { latest: hourly.at(-1), hourly, daily };
  }
  function freshness() {
    const current = state.latest;
    const row = current.data;
    if (!row) { $('#freshness').textContent = current.error ? 'Не вдалося отримати вимір' : 'Датчик ще не надіслав даних'; return; }
    const minutes = Math.floor((Date.now() - row.time) / 60000);
    if (source === 'demo') { $('#freshness').textContent = 'Приклад, а не показники датчика'; return; }
    $('#freshness').textContent = minutes < -5 ? 'Перевір час на сервері: вимір у майбутньому' : minutes > 60 ? `Дані застаріли: ${minutes} хв тому. Перевір датчик.` : `Вимір отримано ${Math.max(0, minutes)} хв тому`;
  }
  function renderLatest() {
    const row = state.latest.data;
    $('#current-region').setAttribute('aria-busy', 'false');
    for (const metric of ['temp', 'humid']) {
      const value = row?.[metric] ?? null;
      $(`#${metric}-value`).textContent = fmt(value);
      $(`#${metric}-value`).classList.remove('skeleton');
      const hint = $(`#${metric}-advice`);
      const threshold = metric === 'temp' ? settings.minTemp : settings.maxHumid;
      const alert = value !== null && threshold !== null && (metric === 'temp' ? value < threshold : value > threshold);
      hint.classList.toggle('alert', alert);
      const stale = row && (Date.now() - row.time > 3600000 || +row.time - Date.now() > 300000);
      hint.textContent = value === null ? state.latest.error ? 'Не вдалося отримати. Онови дані.' : 'Поки немає виміру' : source === 'live' && stale ? 'Підказка недоступна: перевір час виміру' : threshold === null ? 'Додай власний поріг нижче' : metric === 'temp' ? alert ? 'Нижче твого порогу: час опалювати' : 'Не нижче твого порогу опалення' : alert ? 'Вище твого порогу: перевір провітрювання' : 'Не вище твого порогу вологості';
      if (source === 'live' && stale) hint.classList.remove('alert');
      $(`#${metric}-threshold`).textContent = threshold === null ? 'Не задано' : `${fmt(threshold)} ${metric === 'temp' ? '°C' : '%'}`;
    }
    $('#measured-at').textContent = row ? stamp.format(row.time) : '—';
    if (row) $('#measured-at').dateTime = row.time.toISOString(); else $('#measured-at').removeAttribute('datetime');
    freshness();
  }
  function svg(tag, attrs = {}, text) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function selectedSeries() {
    const now = Date.now();
    return period === 'day' ? state.hourly.data.filter((r) => +r.time >= now - 86400000 && +r.time <= now) : weekRows();
  }
  function weekRows() {
    const rows = new Map(state.daily.data.map((r) => [dayKey(r.time), r]));
    // Noon UTC stays on the same Kyiv calendar day across daylight saving changes.
    const parts = formatter({ year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const get = (type) => Number(parts.find((p) => p.type === type).value);
    const today = Date.UTC(get('year'), get('month') - 1, get('day'), 12);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today - (6 - i) * 86400000);
      const found = rows.get(dayKey(d));
      return { ...found, time: d, temp: found?.temp ?? null, humid: found?.humid ?? null };
    });
  }
  function renderChart(metric, rows, error) {
    const host = $(`#${metric}-chart`);
    host.replaceChildren();
    host.setAttribute('aria-busy', 'false');
    const valid = rows.filter((r) => r[metric] !== null);
    const unit = metric === 'temp' ? '°C' : '%';
    $(`#${metric}-range`).textContent = rows.length ? `${date.format(rows[0].time)} — ${date.format(rows.at(-1).time)}` : '—';
    const stats = $(`#${metric}-stats`);
    stats.replaceChildren();
    if (!valid.length) {
      const p = document.createElement('p'); p.className = 'chart-state';
      p.textContent = error ? 'Історія недоступна. Натисни «Оновити дані».' : 'За цей період ще немає вимірів.';
      host.append(p); return;
    }
    const values = valid.map((r) => r[metric]);
    const min = Math.min(...values), max = Math.max(...values), avg = values.reduce((a, b) => a + b, 0) / values.length;
    for (const [label, value] of [['Мін.', min], ['Середнє', avg], ['Макс.', max]]) {
      const span = document.createElement('span'); span.textContent = label;
      const b = document.createElement('b'); b.className = 'measure'; b.textContent = `${fmt(value)} ${unit}`; span.append(b); stats.append(span);
    }
    const W = Math.max(260, host.clientWidth || 600), H = 240, left = 42, right = 16, top = 16, bottom = 34;
    const padding = Math.max((max - min) * .2, metric === 'temp' ? 1 : 3);
    let lo = Math.floor(min - padding), hi = Math.ceil(max + padding);
    if (metric === 'humid') { lo = Math.max(0, lo); hi = Math.min(100, hi); }
    if (hi === lo) hi = lo + 1;
    const now = Date.now();
    const start = period === 'day' ? now - 86400000 : +rows[0].time;
    const end = period === 'day' ? now : +rows.at(-1).time;
    const x = (d) => left + (+d - start) / Math.max(1, end - start) * (W - left - right);
    const y = (v) => top + (hi - v) / (hi - lo) * (H - top - bottom);
    const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${metric === 'temp' ? 'Температура' : 'Вологість'}: від ${fmt(min)} до ${fmt(max)} ${unit}. Автоматична шкала.` });
    for (let i = 0; i < 4; i++) {
      const value = lo + (hi - lo) * i / 3, yy = y(value);
      root.append(svg('line', { x1: left, x2: W - right, y1: yy, y2: yy, class: 'chart-grid' }), svg('text', { x: left - 8, y: yy + 4, 'text-anchor': 'end', class: 'chart-axis' }, value.toFixed(0)));
    }
    for (let i = 0; i < 5; i++) {
      const d = new Date(start + (end - start) * i / 4);
      root.append(svg('text', { x: x(d), y: H - 8, 'text-anchor': i === 0 ? 'start' : i === 4 ? 'end' : 'middle', class: 'chart-axis' }, period === 'day' ? clock.format(d) : date.format(d)));
    }
    let path = '', previous = null;
    for (const row of rows) {
      if (row[metric] === null) { previous = null; continue; }
      const gap = !previous || (+row.time - +previous.time) > (period === 'day' ? 75 * 60000 : 36 * 3600000);
      path += `${gap ? 'M' : 'L'}${x(row.time).toFixed(2)},${y(row[metric]).toFixed(2)} `;
      previous = row;
    }
    root.append(svg('path', { d: path, class: `chart-line ${metric === 'humid' ? 'humid-line' : ''}` }));
    const gapLimit = period === 'day' ? 75 * 60000 : 36 * 3600000;
    const isolatedOrLast = rows.filter((r, i) => r[metric] !== null && (i === rows.length - 1 ||
      (!rows[i - 1] || rows[i - 1][metric] === null || +r.time - +rows[i - 1].time > gapLimit) &&
      (!rows[i + 1] || rows[i + 1][metric] === null || +rows[i + 1].time - +r.time > gapLimit)));
    for (const row of isolatedOrLast) {
      const point = svg('circle', { cx: x(row.time), cy: y(row[metric]), r: 3, class: `chart-point ${metric === 'humid' ? 'humid-point' : ''}` });
      point.append(svg('title', {}, `${stamp.format(row.time)}: ${fmt(row[metric])} ${unit}`)); root.append(point);
    }
    host.append(root);
  }
  function createTable(rows, daily, captionText) {
    const table = document.createElement('table');
    const caption = table.createCaption(); caption.textContent = captionText;
    const head = table.createTHead().insertRow();
    for (const title of [daily ? 'День' : 'Час, Київ', 'Темп., °C', 'Волог., %']) { const th = document.createElement('th'); th.scope = 'col'; th.textContent = title; head.append(th); }
    const body = table.createTBody();
    for (const row of rows) {
      const tr = body.insertRow();
      const today = dayKey(row.time) === dayKey(new Date());
      if (daily && today) tr.className = 'today';
      for (const text of [daily ? `${today ? 'Сьогодні' : weekday.format(row.time)}, ${date.format(row.time)}` : `${date.format(row.time)}, ${clock.format(row.time)}`, fmt(row.temp), fmt(row.humid)]) tr.insertCell().textContent = text;
    }
    return table;
  }
  function renderHistory() {
    const region = period === 'day' ? state.hourly : state.daily;
    const rows = selectedSeries();
    $('#period-caption').textContent = period === 'day' ? 'Окремі виміри за останні 24 години' : 'Середні за календарні дні; сьогодні — неповний день';
    document.querySelectorAll('[data-period]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.period === period)));
    for (const metric of ['temp', 'humid']) renderChart(metric, rows, region.error);
    const table = $('#history-table'); table.replaceChildren();
    if (!region.error && rows.length) table.append(createTable(rows, period === 'week', period === 'day' ? 'Середнє на графіку обчислено за доступними вимірами.' : 'Середнє на графіку — середнє доступних денних значень.'));
    else { const p = document.createElement('p'); p.textContent = region.error ? 'Не вдалося отримати історію.' : 'Вимірів поки немає.'; table.append(p); }
  }
  function renderWeek() {
    const host = $('#week-table'); host.setAttribute('aria-busy', 'false'); host.replaceChildren();
    if (state.daily.error) { const p = document.createElement('p'); p.className = 'chart-state'; p.textContent = 'Підсумок недоступний. Спробуй оновити дані.'; host.append(p); return; }
    const rows = weekRows();
    $('#week-range').textContent = `${date.format(rows[0].time)} — ${date.format(rows.at(-1).time)}`;
    host.append(createTable([...rows].reverse(), true, 'Температура та вологість, денні середні'));
  }
  function render() { renderLatest(); renderHistory(); renderWeek(); }
  async function load() {
    if (loading) controller?.abort();
    const currentController = new AbortController(); controller = currentController;
    loading = true;
    $('#refresh').disabled = true; $('#refresh').setAttribute('aria-busy', 'true'); $('#refresh').textContent = 'Оновлюємо…';
    $('#connection').textContent = source === 'demo' ? 'Демонстрація' : 'Отримуємо дані…';
    if (source === 'demo') {
      const data = sample();
      for (const key of Object.keys(state)) state[key] = { data: data[key], error: null };
    } else {
      const timeout = setTimeout(() => currentController.abort(), 8000);
      const results = await Promise.allSettled(['latest', 'hourly', 'daily'].map(async (key) => {
        const response = await fetch(`${apiBase}/api/${key}`, { signal: currentController.signal, cache: 'no-store', headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return normalize(await response.json(), key);
      }));
      clearTimeout(timeout);
      if (controller !== currentController) return;
      ['latest', 'hourly', 'daily'].forEach((key, i) => { const result = results[i]; state[key] = result.status === 'fulfilled' ? { data: result.value, error: null } : { data: key === 'latest' ? null : [], error: result.reason }; });
    }
    const failures = Object.values(state).filter((r) => r.error).length;
    const notice = $('#notice'); notice.hidden = source !== 'demo' && !failures;
    notice.textContent = source === 'demo' ? 'Демонстраційні дані. Усі значення на цій сторінці — приклад, а не виміри твого датчика.' : failures ? 'Частину даних не отримано. Перевір, чи працює Go-сервер, та натисни «Оновити дані». Доступні виміри показані нижче.' : '';
    $('#connection').textContent = source === 'demo' ? 'Демонстрація' : failures ? 'Помилка API' : 'API відповідає';
    render();
    loading = false; $('#refresh').disabled = false; $('#refresh').setAttribute('aria-busy', 'false'); $('#refresh').textContent = 'Оновити дані';
  }
  $('#source').value = source;
  $('#source').addEventListener('change', (event) => { source = event.target.value; syncURL(); load(); });
  $('#refresh').addEventListener('click', load);
  document.querySelectorAll('[data-period]').forEach((b) => b.addEventListener('click', () => { period = b.dataset.period; syncURL(); renderHistory(); }));
  $('#min-temp').value = settings.minTemp ?? '';
  $('#max-humid').value = settings.maxHumid ?? '';
  $('#thresholds').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!event.target.reportValidity()) return;
    settings = { minTemp: $('#min-temp').value === '' ? null : Number($('#min-temp').value), maxHumid: $('#max-humid').value === '' ? null : Number($('#max-humid').value) };
    try { localStorage.setItem('air-thresholds', JSON.stringify(settings)); $('#settings-message').textContent = 'Межі збережено в цьому браузері.'; }
    catch { $('#settings-message').textContent = 'Межі застосовано. Браузер не дозволив зберегти їх після закриття.'; }
    renderLatest();
  });
  window.addEventListener('popstate', () => { const p = new URLSearchParams(location.search); source = p.get('source') === 'demo' ? 'demo' : 'live'; period = p.get('period') === 'week' ? 'week' : 'day'; $('#source').value = source; load(); });
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderHistory, 150); });
  load();
  setInterval(() => { if (!document.hidden && !loading) load(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !loading) load(); });
})();
