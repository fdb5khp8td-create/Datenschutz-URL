// Workbadge Rooms 1.0 – Kalender: Firmenkalender importieren (ICS-Datei oder Link) oder Termine selbst anlegen,
// Räume damit verknüpfen. Verknüpfte Schilder zeigen von selbst „Belegt“ oder „Frei bis …“ und werden bei jedem
// Terminwechsel automatisch aktualisiert.
import { FIELD_LIMITS } from './protocol.js';

const KEY = 'workbadge.calendar.v1';
const DAY = 86400000, MAX_EVENTS = 5000;
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cut = (text, limit) => { const chars = [...String(text || '').replace(/\s+/g, ' ').trim()]; return chars.length > limit ? `${chars.slice(0, limit - 1).join('')}…` : chars.join(''); };
const pad = n => String(n).padStart(2, '0');
export const hm = time => { const d = new Date(time); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const dayStart = time => { const d = new Date(time); d.setHours(0, 0, 0, 0); return d.getTime(); };
const addDays = (time, days) => { const d = new Date(time); d.setDate(d.getDate() + days); return d.getTime(); };
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// ---------------------------------------------------------------- ICS (iCalendar) lesen
// Unterstützt: Einzeltermine, ganztägige Termine, Wiederholungen (täglich, wöchentlich mit Wochentagen, monatlich,
// jährlich; INTERVAL, COUNT, UNTIL, EXDATE), geänderte Einzeltermine (RECURRENCE-ID), abgesagte Termine, private Termine.
// Zeitzonen: Zeiten mit „Z“ sind UTC, alle anderen gelten als Ortszeit dieses Computers.
function unescapeText(value) { return value.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1'); }
function parseLine(line) {
  let i = 0, quoted = false;
  for (; i < line.length; i++) { const c = line[i]; if (c === '"') quoted = !quoted; else if (c === ':' && !quoted) break; }
  const head = line.slice(0, i), value = line.slice(i + 1);
  const [name, ...rest] = head.split(';');
  const params = {};
  for (const part of rest) { const eq = part.indexOf('='); if (eq > 0) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).replace(/^"|"$/g, ''); }
  return { name: name.toUpperCase(), params, value };
}
export function parseIcsDate(value, params = {}) {
  const v = value.trim();
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (!h || params.VALUE === 'DATE') return { time: new Date(+y, +mo - 1, +d).getTime(), allDay: true };
  const time = z ? Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s || 0)) : new Date(+y, +mo - 1, +d, +h, +mi, +(s || 0)).getTime();
  return { time, allDay: false };
}
function parseDuration(value) {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value.trim());
  if (!m) return 0;
  const [, sign, w, d, h, mi, s] = m;
  return (sign === '-' ? -1 : 1) * ((+w || 0) * 7 * DAY + (+d || 0) * DAY + (+h || 0) * 3600000 + (+mi || 0) * 60000 + (+s || 0) * 1000);
}
function parseRule(value) {
  const rule = {};
  for (const part of value.split(';')) { const [k, v] = part.split('='); if (k && v) rule[k.toUpperCase()] = v; }
  const result = { freq: rule.FREQ, interval: Math.max(1, parseInt(rule.INTERVAL, 10) || 1) };
  if (rule.COUNT) result.count = Math.min(5000, parseInt(rule.COUNT, 10) || 1);
  if (rule.UNTIL) result.until = parseIcsDate(rule.UNTIL)?.time;
  if (rule.BYDAY) result.byday = rule.BYDAY.split(',').map(token => { const m = /^([+-]?\d+)?(MO|TU|WE|TH|FR|SA|SU)$/.exec(token.trim()); return m ? { n: m[1] ? +m[1] : 0, day: ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].indexOf(m[2]) } : null; }).filter(Boolean);
  if (rule.BYMONTHDAY) result.bymonthday = rule.BYMONTHDAY.split(',').map(Number).filter(Number.isFinite);
  return ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(result.freq) ? result : null;
}
export function parseIcs(text) {
  const lines = String(text).replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const events = [];
  let current = null, depth = 0, name = '';
  for (const raw of lines) {
    if (!raw) continue;
    const { name: key, params, value } = parseLine(raw);
    if (key === 'BEGIN' && value.toUpperCase() === 'VEVENT') { current = { exdates: [] }; depth = 0; continue; }
    if (key === 'X-WR-CALNAME' && !current) { name = unescapeText(value).trim(); continue; }
    if (!current) continue;
    if (key === 'BEGIN') { depth++; continue; }  // VALARM usw. überspringen
    if (key === 'END' && depth) { depth--; continue; }
    if (depth) continue;
    if (key === 'END' && value.toUpperCase() === 'VEVENT') {
      if (current.start !== undefined && current.status !== 'CANCELLED') {
        if (current.end === undefined) current.end = current.duration ? current.start + current.duration : current.start + (current.allDay ? DAY : 3600000);
        if (current.end > current.start) events.push({
          uid: current.uid || uid(), title: current.private ? 'Privater Termin' : cut(current.title || 'Termin', 120), host: current.private ? '' : cut(current.host || '', 80),
          location: cut(current.location || '', 120), start: current.start, end: current.end, allDay: !!current.allDay,
          ...(current.rule ? { rule: current.rule } : {}), ...(current.exdates.length ? { exdates: current.exdates } : {}), ...(current.recurrence ? { recurrence: current.recurrence } : {}),
        });
      }
      current = null;
      if (events.length >= MAX_EVENTS) break;
      continue;
    }
    if (key === 'UID') current.uid = value.trim();
    else if (key === 'SUMMARY') current.title = unescapeText(value);
    else if (key === 'LOCATION') current.location = unescapeText(value);
    else if (key === 'ORGANIZER') current.host = params.CN || value.replace(/^mailto:/i, '');
    else if (key === 'DTSTART') { const d = parseIcsDate(value, params); if (d) { current.start = d.time; current.allDay = d.allDay; } }
    else if (key === 'DTEND') { const d = parseIcsDate(value, params); if (d) current.end = d.time; }
    else if (key === 'DURATION') current.duration = parseDuration(value);
    else if (key === 'RRULE') current.rule = parseRule(value);
    else if (key === 'EXDATE') for (const part of value.split(',')) { const d = parseIcsDate(part, params); if (d) current.exdates.push(d.time); }
    else if (key === 'RECURRENCE-ID') { const d = parseIcsDate(value, params); if (d) current.recurrence = d.time; }
    else if (key === 'STATUS') current.status = value.trim().toUpperCase();
    else if (key === 'CLASS') current.private = /PRIVATE|CONFIDENTIAL/i.test(value);
    else if (key === 'TRANSP' && /TRANSPARENT/i.test(value)) current.status = 'CANCELLED';  // „frei“ markiert: Raum nicht belegt
  }
  return { name, events };
}

// Termine eines Zeitraums (Wiederholungen aufgelöst). event.rule wie parseRule().
function occurrences(event, from, to) {
  const length = event.end - event.start;
  if (!event.rule) return event.start < to && event.end > from ? [{ ...event }] : [];
  const { freq, interval, count, until, byday, bymonthday } = event.rule;
  const out = [], skip = new Set(event.exdates || []), base = new Date(event.start);
  const limit = Math.min(to, until !== undefined ? until + 1 : Infinity);
  let n = 0;
  const emit = time => {
    if (time < event.start) return true;
    if (count && n >= count) return false;
    if (time >= limit) return false;
    n++;
    if (!skip.has(time) && time < to && time + length > from) out.push({ ...event, start: time, end: time + length, rule: undefined });
    return true;
  };
  const at = (y, m, d) => new Date(y, m, d, base.getHours(), base.getMinutes(), base.getSeconds()).getTime();
  for (let step = 0, guard = 0; guard < 6000; step++, guard++) {
    if (freq === 'DAILY') { const t = at(base.getFullYear(), base.getMonth(), base.getDate() + step * interval); if (!emit(t)) break; }
    else if (freq === 'WEEKLY') {
      const monday = base.getDate() - ((base.getDay() + 6) % 7) + step * 7 * interval;
      const days = byday?.length ? byday.map(b => b.day).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)) : [base.getDay()];
      let stop = false;
      for (const day of days) { if (!emit(at(base.getFullYear(), base.getMonth(), monday + ((day + 6) % 7)))) { stop = true; break; } }
      if (stop) break;
    } else if (freq === 'MONTHLY') {
      const y = base.getFullYear(), m = base.getMonth() + step * interval, times = [];
      if (byday?.length) for (const b of byday) {
        const first = new Date(y, m, 1), last = new Date(y, m + 1, 0).getDate(), matches = [];
        for (let d = 1; d <= last; d++) if (new Date(y, m, d).getDay() === b.day) matches.push(d);
        const pick = b.n > 0 ? matches[b.n - 1] : b.n < 0 ? matches[matches.length + b.n] : null;
        (pick ? [pick] : b.n ? [] : matches).forEach(d => times.push(at(first.getFullYear(), first.getMonth(), d)));
      } else for (const d of bymonthday?.length ? bymonthday : [base.getDate()]) { const date = new Date(y, m, 1); const last = new Date(y, m + 1, 0).getDate(); const day = d < 0 ? last + d + 1 : d; if (day >= 1 && day <= last) times.push(at(date.getFullYear(), date.getMonth(), day)); }
      let stop = false;
      for (const t of times.sort((a, b) => a - b)) if (!emit(t)) { stop = true; break; }
      if (stop || at(y, m, 1) >= limit) break;
    } else if (freq === 'YEARLY') { if (!emit(at(base.getFullYear() + step * interval, base.getMonth(), base.getDate()))) break; }
    else break;
  }
  return out;
}
function expand(events, from, to) {
  // Geänderte Einzeltermine ersetzen das ursprüngliche Vorkommen derselben Serie.
  const moved = new Map();
  for (const event of events) if (event.recurrence !== undefined) { if (!moved.has(event.uid)) moved.set(event.uid, new Set()); moved.get(event.uid).add(event.recurrence); }
  const out = [];
  for (const event of events) {
    const exdates = event.rule && moved.has(event.uid) ? [...(event.exdates || []), ...moved.get(event.uid)] : event.exdates;
    out.push(...occurrences(exdates === event.exdates ? event : { ...event, exdates }, from, to));
  }
  return out.sort((a, b) => a.start - b.start);
}

// ---------------------------------------------------------------- Zustand
const REPEAT_RULES = { daily: { freq: 'DAILY', interval: 1 }, weekdays: { freq: 'WEEKLY', interval: 1, byday: [1, 2, 3, 4, 5].map(day => ({ n: 0, day })) }, weekly: { freq: 'WEEKLY', interval: 1 } };
const REPEAT_LABELS = { none: 'Einmalig', daily: 'Täglich', weekdays: 'Werktags (Mo–Fr)', weekly: 'Wöchentlich' };
let state = { sources: [], own: [], links: {}, autoSend: true };
function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (data && typeof data === 'object') state = readCalendar(data);
  } catch { /* leer beginnen */ }
}
export function readCalendar(data) {
  const result = { sources: [], own: [], links: {}, autoSend: data?.autoSend !== false };
  for (const source of Array.isArray(data?.sources) ? data.sources.slice(0, 20) : []) {
    if (!source || typeof source.id !== 'string') continue;
    result.sources.push({ id: source.id.slice(0, 40), name: cut(source.name || 'Kalender', 60), kind: source.kind === 'url' ? 'url' : 'file', url: source.kind === 'url' ? String(source.url || '').slice(0, 2000) : '', updated: Number(source.updated) || 0, error: source.error ? String(source.error).slice(0, 200) : '', events: Array.isArray(source.events) ? source.events.slice(0, MAX_EVENTS).filter(e => Number.isFinite(e?.start) && Number.isFinite(e?.end)) : [] });
  }
  for (const event of Array.isArray(data?.own) ? data.own.slice(0, 2000) : []) {
    if (!event || !Number.isInteger(event.room) || !Number.isFinite(event.start) || !Number.isFinite(event.end) || event.end <= event.start) continue;
    result.own.push({ id: String(event.id || uid()).slice(0, 40), room: event.room, title: cut(event.title || 'Besprechung', 64), host: cut(event.host || '', 40), start: event.start, end: event.end, repeat: REPEAT_RULES[event.repeat] ? event.repeat : 'none' });
  }
  for (const [id, link] of Object.entries(data?.links || {})) {
    if (!/^\d{1,5}$/.test(id) || !link || typeof link !== 'object') continue;
    result.links[id] = { on: link.on !== false, source: typeof link.source === 'string' ? link.source.slice(0, 40) : '', match: cut(link.match || '', 60) };
  }
  return result;
}
export function calendarData() { return state; }
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { api?.toast('Kalender konnte nicht gespeichert werden (zu viele Termine?).', true); } }

// Termine eines Raums: eigene Termine plus die passenden aus dem verknüpften Firmenkalender.
function roomEvents(roomId, from, to, room) {
  const link = state.links[roomId];
  const own = state.own.filter(e => e.room === roomId).map(e => ({ ...e, uid: e.id, own: true, ...(e.repeat !== 'none' ? { rule: REPEAT_RULES[e.repeat] } : {}) }));
  let imported = [];
  const source = link?.source && state.sources.find(s => s.id === link.source);
  if (source) {
    const match = (link.match || '').toLocaleLowerCase('de');
    const events = match ? source.events.filter(e => `${e.location} ${e.title}`.toLocaleLowerCase('de').includes(match)) : source.events;
    imported = events.map(e => ({ ...e, sourceName: source.name }));
  }
  void room;
  return expand([...own, ...imported], from, to);
}
export function isLinked(roomId) { return !!state.links[roomId]?.on; }
// Was das Schild jetzt zeigen soll (null = Raum nicht mit dem Kalender verknüpft).
export function calendarContent(room, now = Date.now()) {
  if (!isLinked(room.id)) return null;
  const events = roomEvents(room.id, dayStart(now), addDays(dayStart(now), 1), room);
  const current = events.filter(e => e.start <= now && now < e.end).sort((a, b) => Number(a.allDay) - Number(b.allDay))[0];
  if (current) {
    // Direkt anschließende Termine zusammenfassen: „Belegt bis …“ gilt bis zum Ende der Kette.
    return { status: current.allDay ? 'reserved' : 'busy', title: cut(current.title, FIELD_LIMITS.title), host: cut(current.host || '', FIELD_LIMITS.host), time: current.allDay ? 'Ganztägig' : cut(`${hm(current.start)} – ${hm(current.end)}`, FIELD_LIMITS.time) };
  }
  const next = events.find(e => e.start > now && !e.allDay);
  if (next) return { status: 'free', title: cut(`Frei bis ${hm(next.start)} Uhr`, FIELD_LIMITS.title), host: cut(`Danach: ${next.title}`, FIELD_LIMITS.host), time: cut(`${hm(next.start)} – ${hm(next.end)}`, FIELD_LIMITS.time) };
  return { status: 'free', title: 'Frei', host: events.some(e => e.end <= now) ? 'Heute keine weiteren Termine' : 'Heute keine Termine', time: '' };
}

// ---------------------------------------------------------------- Abgleich mit den Räumen, automatisch senden
let api = null, view = { day: dayStart(Date.now()) }, retryAfter = new Map(), sending = false;
function applyAll() {
  if (!api || api.isDemo()) return;
  let changed = false;
  for (const room of api.rooms()) {
    const content = calendarContent(room);
    if (!content) continue;
    const c = room.content;
    if (c.status !== content.status || c.title !== content.title || c.host !== content.host || c.time !== content.time) {
      room.content = { ...c, ...content }; changed = true;
    }
  }
  if (changed) { api.persist(); api.renderRooms(); }
  void autoSend();
}
async function autoSend() {
  if (!state.autoSend || sending || !api || api.isDemo()) return;
  const now = Date.now();
  const due = api.rooms().filter(room => isLinked(room.id) && api.needsSend(room) && api.canSend(room) && !api.isBusy(room) && (retryAfter.get(room.id) || 0) <= now);
  if (!due.length) return;
  sending = true;
  try {
    for (const room of due) {
      try { await api.send(room); retryAfter.delete(room.id); }
      catch (error) { retryAfter.set(room.id, Date.now() + 5 * 60000); api.addLog(`${room.content.name}: Kalender-Aktualisierung nicht gesendet`, `${error.message} – nächster Versuch in 5 Minuten.`, true); }
    }
  } finally { sending = false; }
}

// ---------------------------------------------------------------- Kalender abrufen
async function fetchText(url) {
  const target = url.replace(/^webcal:/i, 'https:');
  if (!/^https?:\/\//i.test(target)) throw new Error('Bitte einen Link beginnend mit https:// oder webcal:// angeben.');
  if (api.fetchCalendar) return api.fetchCalendar(target);
  let response;
  try { response = await fetch(target, { cache: 'no-store' }); }
  catch { throw new Error('Der Browser darf diesen Kalender nicht abrufen. Bitte die ICS-Datei importieren oder das Programm für Windows verwenden.'); }
  if (!response.ok) throw new Error(`Kalender nicht erreichbar (HTTP ${response.status}).`);
  return response.text();
}
async function refreshSource(source, quiet = false) {
  try {
    const parsed = parseIcs(await fetchText(source.url));
    source.events = parsed.events; source.updated = Date.now(); source.error = '';
    if (!quiet) api.toast(`${source.name}: ${parsed.events.length} Termine geladen.`);
  } catch (error) { source.error = error.message; if (!quiet) api.toast(error.message, true); }
  save(); render(); applyAll();
}
async function refreshAll() { for (const source of state.sources.filter(s => s.kind === 'url')) await refreshSource(source, true); }

// ---------------------------------------------------------------- Ansicht
const HOUR = 52;  // Pixel je Stunde im Tagesplan
function linkedRooms() { return api.rooms().filter(room => !api.isDraft(room)).sort((a, b) => a.content.name.localeCompare(b.content.name, 'de')); }
function dayLabel(time) {
  const today = dayStart(Date.now()), text = new Date(time).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  return time === today ? `Heute, ${text}` : time === addDays(today, 1) ? `Morgen, ${text}` : text;
}
function render() {
  if (!api) return;
  const root = $('#calendar-root'); if (!root) return;
  const rooms = linkedRooms(), from = view.day, to = addDays(view.day, 1), now = Date.now();
  // Sichtbarer Bereich: 7–19 Uhr, erweitert um frühere/spätere Termine dieses Tages.
  const all = rooms.map(room => ({ room, events: roomEvents(room.id, from, to, room) }));
  let first = 7, last = 19;
  for (const { events } of all) for (const e of events) if (!e.allDay) { first = Math.min(first, new Date(Math.max(e.start, from)).getHours()); last = Math.max(last, Math.min(24, Math.ceil((Math.min(e.end, to) - from) / 3600000))); }
  const hours = Array.from({ length: last - first }, (_, i) => first + i);
  const top = time => ((time - from) / 3600000 - first) * HOUR;
  const sources = state.sources.map(source => `<li class="cal-source"><span class="cal-source-dot" aria-hidden="true"></span><div><strong>${esc(source.name)}</strong><span>${source.events.length} Termine · ${source.kind === 'url' ? 'Link' : 'Datei'}${source.updated ? ` · aktualisiert ${new Date(source.updated).toLocaleString('de-DE', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}</span>${source.error ? `<span class="cal-error">${esc(source.error)}</span>` : ''}</div>${source.kind === 'url' ? `<button class="text-button" data-cal-refresh="${source.id}">Aktualisieren</button>` : `<button class="text-button" data-cal-reimport="${source.id}">Neu einlesen</button>`}<button class="text-button danger" data-cal-remove="${source.id}">Entfernen</button></li>`).join('');
  const sourceOptions = id => `<option value="">Nur eigene Termine</option>${state.sources.map(s => `<option value="${esc(s.id)}"${state.links[id]?.source === s.id ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}`;
  const linkRows = rooms.map(room => {
    const link = state.links[room.id], on = !!link?.on, preview = on ? calendarContent(room) : null;
    return `<tr${on ? ' class="on"' : ''}><th scope="row"><span>${esc(room.content.name)}</span><small>Schild ${room.id}</small></th>
      <td><label class="switch"><input type="checkbox" data-link-on="${room.id}"${on ? ' checked' : ''}><span>${on ? 'Verknüpft' : 'Aus'}</span></label></td>
      <td><select data-link-source="${room.id}" aria-label="Kalender für ${esc(room.content.name)}"${on ? '' : ' disabled'}>${sourceOptions(room.id)}</select></td>
      <td><input data-link-match="${room.id}" value="${esc(link?.match || '')}" placeholder="${state.links[room.id]?.source ? esc(room.content.name) : '–'}" aria-label="Termine mit diesem Ort oder Namen" ${on && link?.source ? '' : 'disabled'}></td>
      <td class="cal-now">${preview ? `<span class="status-pill ${preview.status}"><span class="tiny-dot"></span>${esc(preview.title)}</span>` : '<span class="muted">Inhalt von Hand</span>'}</td></tr>`;
  }).join('');
  const columns = all.map(({ room, events }) => {
    const blocks = events.filter(e => !e.allDay).map(e => {
      const y = Math.max(0, top(Math.max(e.start, from))), h = Math.max(22, top(Math.min(e.end, to)) - y);
      return `<button class="cal-event${e.own ? ' own' : ' imported'}${e.end <= now ? ' past' : ''}" data-y="${y}" data-h="${h}" data-cal-event="${esc(e.own ? e.id : '')}" data-cal-info="${esc(`${e.title} · ${hm(e.start)} – ${hm(e.end)}${e.host ? ` · ${e.host}` : ''}${e.sourceName ? ` · aus „${e.sourceName}“` : ''}`)}" title="${esc(e.title)}"><strong>${esc(e.title)}</strong><span>${hm(e.start)} – ${hm(e.end)}${e.host ? ` · ${esc(e.host)}` : ''}</span></button>`;
    }).join('');
    const allDay = events.filter(e => e.allDay).map(e => `<span class="cal-allday" title="${esc(e.title)}">${esc(e.title)}</span>`).join('');
    return `<div class="cal-col${isLinked(room.id) ? ' linked' : ''}" data-cal-room="${room.id}"><div class="cal-col-head"><strong>${esc(room.content.name)}</strong><span>${isLinked(room.id) ? 'mit Schild verknüpft' : 'nicht verknüpft'}</span>${allDay}</div><div class="cal-col-body" data-h="${hours.length * HOUR}" data-cal-slot="${room.id}">${blocks}</div></div>`;
  }).join('');
  const nowLine = now >= from && now < to ? `<div class="cal-now-line" data-y="${top(now)}" aria-hidden="true"></div>` : '';
  root.innerHTML = `
    <div class="panel cal-day-panel"><div class="panel-heading cal-day-head"><div class="cal-nav"><button class="icon-button" id="cal-prev" aria-label="Vorheriger Tag">‹</button><button class="button" id="cal-today">Heute</button><button class="icon-button" id="cal-next" aria-label="Nächster Tag">›</button><h2>${esc(dayLabel(view.day))}</h2></div><button class="button primary" id="cal-new"><span class="cal-i">${api.icon('plus')}</span> Termin anlegen</button></div>
      ${rooms.length ? `<div class="cal-grid" data-cols="${rooms.length}"><div class="cal-times"><div class="cal-col-head"></div><div class="cal-col-body" data-h="${hours.length * HOUR}">${hours.map((h, i) => `<span data-y="${i * HOUR}">${pad(h)}:00</span>`).join('')}</div></div><div class="cal-cols">${columns}${nowLine ? `<div class="cal-now-wrap">${nowLine}</div>` : ''}</div></div><p class="cal-hint">In eine freie Stelle klicken, um dort einen Termin anzulegen. Importierte Termine sind gestrichelt und werden im Firmenkalender geändert.</p>` : ''}
    </div>
    <div class="panel"><div class="panel-heading"><h2>Schilder verknüpfen</h2><p class="panel-sub">Verknüpfte Schilder zeigen von selbst „Belegt“ oder „Frei bis …“.</p></div>
      <div class="panel-content cal-links-wrap">${rooms.length ? `<table class="cal-links"><thead><tr><th>Raum</th><th>Kalender</th><th>Quelle</th><th>Nur Termine mit Ort / Name</th><th>Jetzt auf dem Schild</th></tr></thead><tbody>${linkRows}</tbody></table>` : '<p class="cal-empty">Noch keine Räume mit Schild.</p>'}</div></div>
    <div class="panel cal-sources-panel"><div class="panel-heading"><h2>Firmenkalender</h2><div class="button-row"><button class="button" id="cal-import-file"><span class="cal-i">${api.icon('download')}</span> ICS-Datei importieren</button><button class="button" id="cal-import-url">Kalender-Link abonnieren</button></div></div>
      <div class="panel-content">${state.sources.length ? `<ul class="cal-sources">${sources}</ul>` : '<p class="cal-empty">Noch kein Firmenkalender. Aus Outlook oder Google den Raumkalender als ICS-Datei exportieren oder den Freigabe-Link (ICS) abonnieren. Termine lassen sich auch direkt hier anlegen.</p>'}
      <label class="check cal-auto"><input type="checkbox" id="cal-autosend"${state.autoSend ? ' checked' : ''}> Verknüpfte Schilder bei jedem Terminwechsel automatisch aktualisieren</label></div></div>`;
  // Positionen per CSSOM setzen (die Inhaltsrichtlinie verbietet style-Attribute im HTML).
  for (const el of root.querySelectorAll('[data-y]')) el.style.top = `${el.dataset.y}px`;
  for (const el of root.querySelectorAll('[data-h]')) el.style.height = `${el.dataset.h}px`;
  const grid = root.querySelector('.cal-grid'); if (grid) { grid.style.setProperty('--cols', grid.dataset.cols); grid.style.setProperty('--hour', `${HOUR}px`); }
  root._first = first; root._from = from;
}
function openEvent(event, preset = {}) {
  const dialog = $('#cal-dialog'), rooms = linkedRooms();
  if (!rooms.length) return api.toast('Bitte zuerst einen Raum mit Schild anlegen.', true);
  const start = event?.start ?? preset.start ?? (() => { const d = new Date(); d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0); return Math.max(d.getTime(), view.day + 8 * 3600000); })();
  const end = event?.end ?? start + 3600000;
  $('#cal-dialog-title').textContent = event ? 'Termin bearbeiten' : 'Termin anlegen';
  $('#cal-room').innerHTML = rooms.map(room => `<option value="${room.id}">${esc(room.content.name)} · Schild ${room.id}</option>`).join('');
  $('#cal-room').value = String(event?.room ?? preset.room ?? rooms[0].id);
  $('#cal-title').value = event?.title || ''; $('#cal-host').value = event?.host || '';
  const d = new Date(start);
  $('#cal-date').value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  $('#cal-start').value = hm(start); $('#cal-end').value = hm(end);
  $('#cal-repeat').innerHTML = Object.entries(REPEAT_LABELS).map(([key, label]) => `<option value="${key}">${label}</option>`).join('');
  $('#cal-repeat').value = event?.repeat || 'none';
  $('#cal-delete').classList.toggle('hidden', !event);
  $('#cal-error').textContent = '';
  dialog.dataset.id = event?.id || '';
  dialog.showModal(); $('#cal-title').focus();
}
function readDialog() {
  const [y, m, d] = $('#cal-date').value.split('-').map(Number), [sh, sm] = $('#cal-start').value.split(':').map(Number), [eh, em] = $('#cal-end').value.split(':').map(Number);
  if (!y || !Number.isFinite(sh) || !Number.isFinite(eh)) throw new Error('Bitte Datum, Beginn und Ende angeben.');
  const start = new Date(y, m - 1, d, sh, sm).getTime(), end = new Date(y, m - 1, d, eh, em).getTime();
  if (end <= start) throw new Error('Das Ende muss nach dem Beginn liegen.');
  const title = $('#cal-title').value.trim();
  if (!title) throw new Error('Bitte einen Titel angeben.');
  const room = Number($('#cal-room').value);
  const clash = state.own.find(e => e.room === room && e.id !== $('#cal-dialog').dataset.id && e.repeat === 'none' && $('#cal-repeat').value === 'none' && e.start < end && e.end > start);
  if (clash && !confirm(`Der Raum ist zu dieser Zeit schon belegt („${clash.title}“, ${hm(clash.start)} – ${hm(clash.end)}). Trotzdem speichern?`)) throw new Error('');
  return { room, title: cut(title, 64), host: cut($('#cal-host').value, 40), start, end, repeat: $('#cal-repeat').value };
}
function bind() {
  const root = $('#calendar-root');
  root.addEventListener('click', async event => {
    const target = event.target.closest('button, .cal-col-body');
    if (!target) return;
    if (target.id === 'cal-prev') { view.day = addDays(view.day, -1); return render(); }
    if (target.id === 'cal-next') { view.day = addDays(view.day, 1); return render(); }
    if (target.id === 'cal-today') { view.day = dayStart(Date.now()); return render(); }
    if (target.id === 'cal-new') return openEvent(null, { start: view.day === dayStart(Date.now()) ? undefined : view.day + 9 * 3600000 });
    if (target.id === 'cal-import-file') return $('#cal-file').click();
    if (target.id === 'cal-import-url') {
      const url = prompt('Link zum Kalender (ICS / iCal), z. B. aus Outlook „Kalender veröffentlichen“ oder Google „Geheime Adresse im iCal-Format“:');
      if (!url) return;
      const name = prompt('Name für diesen Kalender:', 'Firmenkalender') || 'Firmenkalender';
      const source = { id: uid(), name: cut(name, 60), kind: 'url', url: url.trim().slice(0, 2000), updated: 0, error: '', events: [] };
      state.sources.push(source); save(); render();
      return refreshSource(source);
    }
    if (target.dataset.calRefresh) return refreshSource(state.sources.find(s => s.id === target.dataset.calRefresh));
    if (target.dataset.calReimport) { $('#cal-file').dataset.replace = target.dataset.calReimport; return $('#cal-file').click(); }
    if (target.dataset.calRemove) {
      const source = state.sources.find(s => s.id === target.dataset.calRemove);
      if (!source || !confirm(`Kalender „${source.name}“ entfernen? Verknüpfte Räume zeigen danach nur noch eigene Termine.`)) return;
      state.sources = state.sources.filter(s => s !== source);
      for (const link of Object.values(state.links)) if (link.source === source.id) link.source = '';
      save(); render(); return applyAll();
    }
    if (target.classList.contains('cal-event')) {
      const own = state.own.find(e => e.id === target.dataset.calEvent);
      if (own) return openEvent(own);
      return api.toast(`${target.dataset.calInfo} – im Firmenkalender ändern.`);
    }
    if (target.classList.contains('cal-col-body') && target.dataset.calSlot) {
      const rect = target.getBoundingClientRect(), hours = (event.clientY - rect.top) / HOUR + root._first;
      const start = root._from + Math.floor(hours * 2) / 2 * 3600000;
      return openEvent(null, { room: Number(target.dataset.calSlot), start });
    }
  });
  root.addEventListener('change', event => {
    const t = event.target;
    if (t.id === 'cal-autosend') { state.autoSend = t.checked; save(); if (t.checked) applyAll(); return; }
    const id = t.dataset.linkOn || t.dataset.linkSource || t.dataset.linkMatch;
    if (!id) return;
    const link = state.links[id] || (state.links[id] = { on: false, source: '', match: '' });
    if (t.dataset.linkOn) {
      link.on = t.checked;
      if (t.checked) api.toast('Verknüpft: Das Schild zeigt ab jetzt den Kalender. Status und Termine im Raum werden automatisch gesetzt.');
    }
    if (t.dataset.linkSource !== undefined && t.dataset.linkSource) link.source = t.value;
    if (t.dataset.linkMatch) link.match = cut(t.value, 60);
    save(); applyAll(); render();
  });
  $('#cal-file').addEventListener('change', async event => {
    const file = event.target.files[0], replace = event.target.dataset.replace; event.target.value = ''; delete event.target.dataset.replace;
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Die Datei ist größer als 5 MB.');
      const parsed = parseIcs(await file.text());
      if (!parsed.events.length) throw new Error('In der Datei wurden keine Termine gefunden. Ist es eine ICS-/iCal-Datei?');
      const existing = replace && state.sources.find(s => s.id === replace);
      if (existing) { existing.events = parsed.events; existing.updated = Date.now(); existing.error = ''; }
      else state.sources.push({ id: uid(), name: cut(parsed.name || file.name.replace(/\.(ics|ical|ifb)$/i, ''), 60), kind: 'file', url: '', updated: Date.now(), error: '', events: parsed.events });
      save(); render(); applyAll();
      api.toast(`${parsed.events.length} Termine importiert. Jetzt unter „Schilder verknüpfen“ die Räume zuordnen.`);
    } catch (error) { api.toast(`Import fehlgeschlagen: ${error.message}`, true); }
  });
  $('#cal-form').addEventListener('submit', event => {
    event.preventDefault();
    const dialog = $('#cal-dialog');
    if (event.submitter?.value === 'cancel') return dialog.close();
    try {
      const values = readDialog(), id = dialog.dataset.id;
      if (id) Object.assign(state.own.find(e => e.id === id), values);
      else state.own.push({ id: uid(), ...values });
      // Wer für einen Raum Termine anlegt, will, dass das Schild sie zeigt.
      const link = state.links[values.room] || (state.links[values.room] = { on: true, source: '', match: '' });
      if (!id && !link.on) { link.on = true; api.toast('Raum mit dem Kalender verknüpft: Das Schild zeigt die Termine.'); }
      view.day = dayStart(values.start);
      save(); dialog.close(); render(); applyAll();
    } catch (error) { $('#cal-error').textContent = error.message; }
  });
  $('#cal-delete').addEventListener('click', () => {
    const dialog = $('#cal-dialog'), id = dialog.dataset.id;
    const event = state.own.find(e => e.id === id);
    if (!event || !confirm(`Termin „${event.title}“${event.repeat !== 'none' ? ' mit allen Wiederholungen' : ''} löschen?`)) return;
    state.own = state.own.filter(e => e.id !== id); save(); dialog.close(); render(); applyAll();
  });
  $('#cal-close').addEventListener('click', () => $('#cal-dialog').close());
}

// Raum-ID geändert oder Raum entfernt: Verknüpfung und eigene Termine mitnehmen bzw. aufräumen.
export function moveRoom(from, to) {
  if (from === to) return;
  if (state.links[from]) { if (to !== null) state.links[to] = state.links[from]; delete state.links[from]; }
  state.own = to === null ? state.own.filter(e => e.room !== from) : state.own.map(e => e.room === from ? { ...e, room: to } : e);
  save();
}
export function replaceCalendar(data) { state = readCalendar(data || {}); save(); render(); applyAll(); }
export function renderCalendar() { render(); }
export function initCalendar(options) {
  api = options; load(); bind();
  setInterval(applyAll, 30000);                  // Terminwechsel auf die Minute genau mitbekommen
  setInterval(() => void refreshAll(), 15 * 60000);  // abonnierte Kalender alle 15 Minuten neu laden
  setTimeout(() => { applyAll(); void refreshAll(); }, 1500);
}
export function retryCalendarSends() { void autoSend(); }
