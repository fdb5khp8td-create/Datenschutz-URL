import { Gateway } from './transport.js';
import { STATUSES, validateContent, imageParts, BROADCAST } from './protocol.js';
import { STORAGE_KEY, readBackup, validateRooms, demoRooms, readDesign, DRAFT_ID_START } from './store.js';
import { company, setCompany, isDraft, rendered, rendered75, paintCanvases, refreshLogo, renderDesign, templateOptions, initDesign, parseRoomCsv, printList } from './design.js';
import { DISPLAY_TYPES, DEFAULT_DISPLAY, getDisplay } from './displays.js';
import { initDesktopPanel } from './native.js';
import { initOta, handleOtaEvent, renderOta } from './ota.js';
import { renderNetMap, pulse } from './netmap.js';
import { toBase64 } from './render.js';

const $ = selector => document.querySelector(selector);
const paths = {
  radar: '<circle cx="12" cy="12" r="2.2"/><path d="M7.5 7.5a6.4 6.4 0 0 0 0 9m9-9a6.4 6.4 0 0 1 0 9M4.6 4.6a10.4 10.4 0 0 0 0 14.8m14.8-14.8a10.4 10.4 0 0 1 0 14.8"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  display: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4M7 8h5m-5 4h10"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  settings: '<path d="m10 3-1 3-3 1-3 3 2 2-1 4 3 1 2 4 3-1 3 1 2-4 4-2-1-3 1-3-4-2-2-3Z"/><circle cx="12" cy="12" r="3"/>',
  signal: '<path d="M5 6a10 10 0 0 0 0 12m14-12a10 10 0 0 1 0 12M8 9a5 5 0 0 0 0 6m8-6a5 5 0 0 1 0 6"/><circle cx="12" cy="12" r="1"/>',
  usb: '<path d="M12 21V3m-3 3 3-3 3 3M12 16l-5-4V9m5 4 5-4V6"/><circle cx="7" cy="8" r="1"/><rect x="16" y="4" width="2" height="2"/><circle cx="12" cy="20" r="1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  send: '<path d="m21 3-7 18-3-8-8-3 18-7ZM11 13 21 3"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  door: '<path d="M4 21h16M6 21V4l12-2v19M14 11v2"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-1 1-2 1-2 3m0 3v.2"/>',
  edit: '<path d="m4 16-1 5 5-1L20 8l-4-4L4 16Zm9-9 4 4"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  warning: '<path d="m12 3 10 18H2L12 3Zm0 6v5m0 3v1"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.9 1.8-1.8 0-1.6 1-2.2 2.4-2.2H18a3 3 0 0 0 3-3c0-6-4-11-9-11Z"/><circle cx="7.8" cy="11" r=".9"/><circle cx="11" cy="7.4" r=".9"/><circle cx="15.4" cy="8.6" r=".9"/>',
  hash: '<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>',
};
const icon = name => `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.display}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el => el.replaceWith(Object.assign(document.createElement('span'), { className: el.className, innerHTML: icon(el.dataset.icon) })));
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const gateway = new Gateway();
let realRooms = [], rooms = [], workspace = 'Mein Workspace', demo = false, editingId = null, view = 'home';
let jobs = new Map(), reach = new Map(), logs = [], toastTimer;
// Alle per Funk gehörten Schilder (auch ohne angelegten Raum): id -> Telemetrie.
const ONLINE_MS = 12 * 60 * 1000, lowBatteryWarned = new Set();
let bulkRunning = false, bulkQuietUntil = 0;
function updateReach(id, event, via = 'lora', source = 'ack') {
  const previous = reach.get(id) || {};
  const entry = { ...previous, time: Date.now(), via, source };
  if (via !== 'usb' && typeof event.rssi === 'number') { entry.rssi = Math.round(event.rssi); entry.snr = event.snr; entry.lora_time = Date.now(); }
  for (const key of ['battery', 'battery_mv', 'downlink_rssi', 'downlink_snr', 'display', 'images', 'relayed', 'fw', 'large']) if (event[key] !== undefined) entry[key] = event[key];
  if (event.relayed !== undefined) entry.via_sign = event.relayed ? event.via : undefined;
  if (event.identify === true) identifying.add(id); else if (event.identify === false && !identifyAll) identifying.delete(id);
  reach.set(id, entry);
  if (typeof entry.battery === 'number' && entry.battery <= 15 && !lowBatteryWarned.has(id)) {
    lowBatteryWarned.add(id);
    const name = rooms.find(room => room.id === id)?.content.name || `Schild ${id}`;
    addLog(`${name}: Akku fast leer`, `${entry.battery} % · bitte laden`, true); toast(`${name}: Akku fast leer (${entry.battery} %).`, true);
  }
  return entry;
}
function signalQuality(seen) {
  if (!seen || typeof seen.rssi !== 'number') return null;
  // Schwächere der beiden Richtungen zählt (Gateway→Schild und Schild→Gateway).
  const rssi = typeof seen.downlink_rssi === 'number' ? Math.min(seen.rssi, seen.downlink_rssi) : seen.rssi;
  const snr = typeof seen.snr === 'number' ? seen.snr : 0;
  if (rssi >= -95 && snr >= 5) return { bars: 4, label: 'Sehr gut', rssi };
  if (rssi >= -105 && snr >= 0) return { bars: 3, label: 'Gut', rssi };
  if (rssi >= -115 && snr >= -7) return { bars: 2, label: 'Mittel', rssi };
  return { bars: 1, label: 'Schwach', rssi };
}
// WLAN (TRMNL 7,5″): Empfang am Schild in dBm → Balken.
function wifiQuality(rssi) {
  if (typeof rssi !== 'number') return null;
  const bars = rssi >= -60 ? 4 : rssi >= -70 ? 3 : rssi >= -80 ? 2 : 1;
  return { bars, label: ['', 'Schwach', 'Mittel', 'Gut', 'Sehr gut'][bars], rssi };
}
// Hat sich das Schild zuletzt per WLAN gemeldet? Schlafende Schilder fragen etwa alle 5 Minuten, wache jede Minute.
const wlanFresh = seen => !!seen?.wifi_time && Date.now() - seen.wifi_time < (seen.sleeping ? 15 : 5) * 60000;
const loraFresh = seen => !!seen?.lora_time && Date.now() - seen.lora_time < ONLINE_MS;
function ago(time) {
  const s = Math.round((Date.now() - time) / 1000);
  if (s < 60) return 'gerade eben'; if (s < 3600) return `vor ${Math.round(s / 60)} Min.`;
  return `vor ${Math.round(s / 3600)} Std.`;
}
function telemetryHtml(seen, compact = false) {
  if (!seen) return '<span class="telemetry muted">Noch keine Meldung</span>';
  const online = Date.now() - seen.time < ONLINE_MS;
  if (seen.via === 'usb') return `<span class="telemetry"><span class="tiny-dot green"></span>USB direkt${typeof seen.battery === 'number' ? ` · ${batteryHtml(seen)}` : ''}</span>`;
  const q = signalQuality(seen), w = seen.wifi_time ? wifiQuality(seen.wifi_rssi) : null;
  const bars = q ? `<span class="signal-bars b${q.bars}" title="Empfang ${q.label}: Gateway hört ${seen.rssi} dBm / SNR ${seen.snr ?? '–'} dB${typeof seen.downlink_rssi === 'number' ? `, Schild hört ${seen.downlink_rssi} dBm` : ''}"><i></i><i></i><i></i><i></i></span>` : '';
  const parts = q ? [`${bars}${compact ? '' : `${q.label} · `}${q.rssi} dBm`] : w ? [] : ['Empfang unbekannt'];
  if (w) parts.push(`<span class="wifi-tag${wlanFresh(seen) ? '' : ' stale'}" title="WLAN: Schild hört ${w.rssi} dBm${seen.wifi_address ? ` · ${seen.wifi_address}` : ''}${seen.sleeping ? ' · schläft zwischen den Abfragen' : ''}"><span class="signal-bars b${w.bars}"><i></i><i></i><i></i><i></i></span>WLAN${compact ? '' : ` · ${w.label}`}</span>`);
  if (seen.relayed) parts.push(`<span class="relay-tag" title="Außer Reichweite des Senders – ein anderes Schild reicht die Daten weiter.">über ${seen.via_sign ? `Schild ${seen.via_sign}` : 'Nachbarschild'}</span>`);
  if (typeof seen.battery === 'number' || seen.battery_mv) parts.push(batteryHtml(seen));
  if (!compact && seen.fw) parts.push(`Firmware 0.${seen.fw}`);
  parts.push(`<span class="${online ? '' : 'stale'}">${ago(seen.time)}</span>`);
  return `<span class="telemetry${online ? '' : ' offline'}">${parts.join('<span class="sep">·</span>')}</span>`;
}
function batteryHtml(seen) {
  const pct = typeof seen.battery === 'number' ? seen.battery : null;
  const level = pct === null ? '' : pct <= 15 ? ' low' : pct <= 35 ? ' mid' : '';
  const text = pct === null ? `${(seen.battery_mv / 1000).toFixed(2)} V` : `${pct} %`;
  return `<span class="battery${level}" title="${seen.battery_mv ? `${(seen.battery_mv / 1000).toFixed(2)} V` : ''}"><span class="battery-body"><span class="fill-${Math.round((pct ?? 50) / 10)}"></span></span>${text}</span>`;
}
const submitting = new Set();
// Erkennen: Schilder, die gerade groß ihre Nummer zeigen. Bilder: laufende Übertragungen je Schild.
const identifying = new Set(), autoIdentified = new Set(), imageJobs = new Map(), partWaiters = new Map(), earlyResults = new Map();
let identifyAll = false, imageCounter = Math.floor(Math.random() * 60000);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const firmware05 = info => /^0\.(?:[5-9]|\d\d)|^[1-9]/.test(info?.firmware || '');
const canIdentify = () => gateway.ready && firmware05(gateway.info);
// Volle Auflösung (800 × 480) per Funk braucht Firmware 0.8 auf dem Sender (er reicht die längeren Bilder durch).
const firmware08 = info => /^0\.(?:[8-9]|\d\d)|^[1-9]/.test(info?.firmware || '');
// Das fertig gestaltete Bild geht nur an 2,13″-Schilder mit Firmware ab 0.5; sonst der bisherige Text.
function usesImage(room) { return getDisplay(room.displayType).image === true && gateway.ready && firmware05(gateway.info) && gateway.info.images !== false && reach.get(room.id)?.images !== false; }
// TRMNL 7,5″: Bild liegt im PC bereit, bis das Schild es per WLAN abholt (id → { hash, since }).
const signApi = globalThis.workbadgeDesktop?.signs, wlanJobs = new Map();
let signServer = null;
const isLarge = room => getDisplay(room.displayType).large === true;
// Kann der Inhalt dieses Raums gerade gesendet werden? LoRa-Sender/USB, oder beim TRMNL über den WLAN-Abruf.
const canSend = room => gateway.canSendTo(room.id) || (isLarge(room) && !!signApi && !demo);
function sentState(room) {
  if (isDraft(room)) return 'Noch keinem Schild zugewiesen';
  if (!getDisplay(room.displayType).image) return 'Entwurf · noch nicht übertragen';
  const large = isLarge(room) ? rendered75(room).hash : null;
  if (room.sent && (room.sent === rendered(room).hash || room.sent === large)) return 'Auf dem Schild aktuell';
  if (large && wlanJobs.get(room.id)?.hash === large) return 'Bereitgestellt · Schild holt es per WLAN ab';
  return room.sent ? 'Geändert · noch nicht gesendet' : 'Entwurf · noch nicht übertragen';
}
try { const stored = localStorage.getItem(STORAGE_KEY); if (stored) { const data = readBackup(stored); realRooms = data.rooms; workspace = data.workspace; setCompany(data.company); } } catch { setTimeout(() => toast('Gespeicherte Daten konnten nicht geladen werden. Bitte Sicherung importieren.', true), 100); }
rooms = realRooms;
function persist() {
  if (!demo) realRooms = rooms;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, workspace, rooms: realRooms, company })); }
  catch { toast('Lokales Speichern fehlgeschlagen. Bitte Daten exportieren.', true); }
}
function toast(message, error = false) { const el = $('#toast'); el.textContent = message; el.className = `toast${error ? ' error' : ''}`; clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hidden'), 5500); }
function addLog(title, text = '', error = false) {
  logs.unshift({ title, text, error, time: Date.now() }); if (logs.length > 200) logs.length = 200; renderLogs();
}
function renderLogs() {
  $('#log-count').textContent = logs.length;
  $('#activity-list').innerHTML = logs.length ? logs.map(log => `<div class="activity-row${log.error ? ' error' : ''}">${icon(log.error ? 'warning' : 'activity')}<div><strong>${escape(log.title)}</strong><p>${escape(log.text)}</p></div><time>${new Date(log.time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time></div>`).join('') : '<p class="no-activity">Hier erscheinen deine nächsten Übertragungen.</p>';
}
function currentJob(id) { return [...jobs.values()].reverse().find(job => job.device === id); }
const isActive = job => job && !['ack', 'failed'].includes(job.state);
function display(room, key = room.id) {
  const c = room.content;
  const model = getDisplay(room.displayType);
  // 2,13″: echte Vorschau des Bildes, das gesendet wird (Logo, Schrift, Vorlage).
  if (model.large) return `<div class="display-frame large-image"><canvas class="eink-canvas" width="800" height="480" data-sign="${key}" data-large role="img" aria-label="Vorschau ${escape(c.name)}"></canvas>${key !== 'editor' && !isDraft(room) && (identifyAll || identifying.has(room.id)) ? `<span class="identify-chip">zeigt gerade Nr. ${room.id}</span>` : ''}</div>`;
  if (model.compact) return `<div class="display-frame compact-display"><canvas class="eink-canvas" width="250" height="122" data-sign="${key}" role="img" aria-label="Vorschau ${escape(c.name)}"></canvas>${key !== 'editor' && !isDraft(room) && (identifyAll || identifying.has(room.id)) ? `<span class="identify-chip">zeigt gerade Nr. ${room.id}</span>` : ''}</div>`;
  return `<div class="display-frame ${model.compact ? "compact-display" : "large-display"}"><div class="eink ${escape(c.status)}"><div class="eink-head"><span class="eink-name">${escape(c.name)}</span><span class="eink-logo">workbadge.</span></div><div class="eink-body"><div class="eink-status"><span class="tiny-dot"></span>${STATUSES[c.status]}</div><div class="eink-title">${escape(c.title || (c.status === 'free' ? 'Raum für gute Arbeit.' : ''))}</div><div class="eink-meta">${escape([c.host, c.time].filter(Boolean).join(' · '))}</div></div><div class="eink-footer"><span>${escape(c.note || 'Willkommen.')}</span><span class="eink-id">${String(room.id).padStart(4, '0')}</span></div></div></div>`;
}
function renderRooms() {
  const query = $('#search').value.trim().toLocaleLowerCase('de'), status = $('#status-filter').value;
  const filtered = rooms.filter(room => (status === 'all' || room.content.status === status) && `${room.content.name} ${room.floor} ${room.id} ${getDisplay(room.displayType).name}`.toLocaleLowerCase('de').includes(query));
  $('#rooms-grid').innerHTML = filtered.map(room => {
    const seen = reach.get(room.id), job = currentJob(room.id), busy = isActive(job) || submitting.has(room.id);
    const progress = job?.image ? ({ ack: job.via === 'usb' ? 'USB · Schild aktualisiert' : 'Schild aktualisiert', failed: job.error || 'Keine Empfangsbestätigung' }[job.state] || `Bild wird gesendet · Teil ${job.part}/${job.total}${job.relay ? ' · über Nachbarschild' : ''}${job.attempt > 1 ? ` · Versuch ${job.attempt}` : ''}`) : job ? { queued: job.via === 'usb' ? 'USB · Display wird aktualisiert' : 'In Warteschlange · Funkpause möglich', tx: `Gesendet · warte auf Antwort (${job.attempt || 1}/${job.maxAttempts || 5})`, ack: job.via === 'usb' ? (job.stage === 'rendered' ? 'USB · Display-Treiber aktualisiert' : 'USB · Gerät erreichbar') : 'Empfang bestätigt', failed: job.error || 'Keine Empfangsbestätigung' }[job.state] : sentState(room);
    const current = (!job || !isActive(job)) && progress === 'Auf dem Schild aktuell';
    return `<article class="room-card${isDraft(room) ? ' draft' : ''}"><div class="room-card-header"><div><h3>${escape(room.content.name)}</h3><p>${escape(room.floor || 'Kein Bereich')}<span>·</span>${isDraft(room) ? 'ohne Schild' : `Schild ${room.id}`}${room.design?.number ? `<span>·</span>Raum ${escape(room.design.number)}` : ''}</p><span class="room-model">${escape(getDisplay(room.displayType).short)}</span></div><span class="status-pill ${room.content.status}"><span class="tiny-dot"></span>${STATUSES[room.content.status]}</span></div><div class="preview-area">${display(room)}</div><span class="room-progress ${job?.state === 'failed' ? 'error' : job?.state === 'ack' || current ? 'ack' : ''}">${escape(progress)}</span>${job?.image && isActive(job) ? `<progress class="part-progress" max="${job.total}" value="${Math.max(0, job.part - 1)}"></progress>` : ''}<div class="room-card-footer"><span class="reachability">${demo && seen ? '<em class="demo-tag">Demo</em>' : ''}${telemetryHtml(seen, true)}</span><div class="card-actions"><button class="icon-button" data-action="ping" data-id="${room.id}" aria-label="${escape(room.content.name)} anpingen" title="Erreichbarkeit prüfen" ${!gateway.canSendTo(room.id) || busy ? 'disabled' : ''}>${icon('signal')}</button><button class="icon-button" data-action="edit" data-id="${room.id}" aria-label="${escape(room.content.name)} bearbeiten" title="Inhalt bearbeiten">${icon('edit')}</button><button class="icon-button" data-action="send" data-id="${room.id}" aria-label="${escape(room.content.name)} senden" title="Inhalt senden" ${!canSend(room) || busy ? 'disabled' : ''}>${icon('send')}</button></div></div></article>`;
  }).join('');
  paintCanvases($('#rooms-grid'), key => rooms.find(room => room.id === Number(key)));
  // Neue Schilder: gehört, aber noch keinem Raum zugewiesen.
  const fresh = [...reach.entries()].filter(([id, seen]) => seen.via !== 'usb' && !rooms.some(room => room.id === id)).sort((a, b) => a[0] - b[0]);
  const drafts = rooms.filter(isDraft);
  $('#new-signs').classList.toggle('hidden', !fresh.length);
  $('#new-signs-title').textContent = fresh.length === 1 ? 'Ein neues Schild gefunden' : `${fresh.length} neue Schilder gefunden`;
  $('#new-signs-list').innerHTML = fresh.map(([id, seen]) => `<div class="new-sign"><span class="new-sign-number">${id}</span><div class="new-sign-info"><strong>Schild ${id}</strong>${telemetryHtml(seen, true)}</div>${drafts.length ? `<select data-assign="${id}" aria-label="Vorbereiteten Raum zuweisen"><option value="">Vorbereiteten Raum zuweisen …</option>${drafts.map(room => `<option value="${room.id}">${escape(room.content.name)}${room.design?.number ? ` · ${escape(room.design.number)}` : ''}</option>`).join('')}</select>` : ''}<button class="button primary" data-radio-add="${id}">Neuen Raum anlegen</button></div>`).join('');
  $('#identify-all').disabled = !canIdentify() && !(signApi && [...reach.values()].some(wlanFresh));
  $('#identify-all').classList.toggle('active', identifyAll);
  $('#identify-all-label').textContent = identifyAll ? 'Nummern ausblenden' : 'Nummern anzeigen';
  $('#empty').classList.toggle('hidden', rooms.length > 0);
  if (rooms.length && !filtered.length) $('#rooms-grid').innerHTML = '<div class="empty-state"><h2>Keine passenden Räume.</h2><p>Versuche einen anderen Suchbegriff oder Status.</p></div>';
  const queued = [...jobs.values()].filter(isActive).length;
  $('#stat-total').textContent = rooms.length; $('#nav-count').textContent = rooms.length; $('#room-count').textContent = filtered.length;
  $('#stat-free').innerHTML = `${rooms.filter(room => room.content.status === 'free').length} <em>von ${rooms.length}</em>`;
  $('#stat-online').innerHTML = `${rooms.filter(room => reach.has(room.id) && Date.now() - reach.get(room.id).time < ONLINE_MS).length} <em>von ${rooms.length}</em>`;
  const lowBattery = rooms.filter(room => typeof reach.get(room.id)?.battery === 'number' && reach.get(room.id).battery <= 15).length;
  $('#stat-online-hint').innerHTML = lowBattery ? `<span class="tiny-dot red"></span> ${lowBattery} mit fast leerem Akku` : '<span class="tiny-dot green"></span> Meldung in den letzten 12 Minuten';
  $('#send-all').disabled = bulkRunning || !rooms.some(canSend);
  $('#ping-all').disabled = bulkRunning || !rooms.some(room => gateway.canSendTo(room.id));
  renderRadioList();
  $('#stat-queue').textContent = queued; $('#queue-badge').textContent = queued; $('#queue-badge').classList.toggle('hidden', !queued);
  $('#queue-hint').textContent = queued ? 'Wartet auf Übertragung / Antwort' : 'Keine offenen Übertragungen';
  $('#save-send').disabled = !canSend({ id: Number($('#edit-id').value), displayType: $('#edit-display').value }) || isActive(currentJob(editingId)) || submitting.has(editingId);
  renderHome(fresh);
}
// ---------------------------------------------------------------- Übersicht: Funknetz + nächste Schritte
function signsForMap(fresh) {
  const entries = [...reach.entries()].filter(([, seen]) => seen.via !== 'usb');
  return entries.map(([id, seen]) => {
    const room = rooms.find(item => item.id === id), q = signalQuality(seen), w = wlanFresh(seen) ? wifiQuality(seen.wifi_rssi) : null;
    const stale = Date.now() - seen.time >= ONLINE_MS && !w;
    const parts = [q ? `LoRa ${q.label.toLowerCase()} (${q.rssi} dBm)` : w ? `WLAN ${w.label.toLowerCase()} (${w.rssi} dBm)` : 'Empfang unbekannt'];
    if (q && w) parts.push(`WLAN ${w.rssi} dBm`);
    if (typeof seen.battery === 'number') parts.push(`Akku ${seen.battery} %`);
    if (seen.relayed) parts.push(`über ${seen.via_sign ? `Schild ${seen.via_sign}` : 'Nachbarschild'}`);
    parts.push(`zuletzt ${ago(seen.time)}`);
    return { id, name: room?.content.name || '', isNew: !room, bars: q?.bars ?? w?.bars, stale, relayed: !!seen.relayed && !!q, via: seen.via_sign, wlan: !q && !!w,
      lowBattery: typeof seen.battery === 'number' && seen.battery <= 15, details: parts.join(' · ') };
  });
}
function senderState() {
  if (demo) return { state: 'on', label: 'Sender', sub: 'Demo' };
  if (!gateway.ready && signServer?.listening && [...reach.values()].some(wlanFresh)) return { state: 'on', label: 'PC', sub: 'WLAN · ohne LoRa-Sender' };
  if (gateway.ready) return { state: 'on', label: 'Sender', sub: gateway.info.local_display && gateway.info.role === 'receiver' ? `Schild ${gateway.info.device} am USB` : 'verbunden' };
  return { state: 'off', label: 'Sender', sub: gateway.connecting ? 'verbinde …' : 'nicht verbunden' };
}
function guideSteps(fresh) {
  const connected = gateway.ready || (!!signApi && [...reach.values()].some(wlanFresh));
  const heard = [...reach.values()].some(seen => seen.via !== 'usb');
  const unsent = rooms.filter(room => !isDraft(room) && sentState(room) !== 'Auf dem Schild aktuell');
  const desktop = !!globalThis.workbadgeShowSetup;
  return [
    { title: 'Sender anschließen', done: connected,
      text: connected ? (demo ? 'Demo-Sender aktiv.' : 'Der Sender ist per USB verbunden.') : desktop ? 'Den Sender per USB anstecken – das Programm verbindet sich selbst. Noch nicht eingerichtet? Erst einrichten.' : `Den eingerichteten Sender per USB anstecken und verbinden (Chrome oder Edge).${document.documentElement.dataset.edition === 'web' ? ' Sender und Schilder richtest du einmalig mit dem Programm zum Herunterladen ein.' : ''}`,
      action: connected ? null : desktop ? { id: 'guide-setup', label: 'Sender einrichten' } : { id: 'guide-connect', label: 'Sender verbinden' },
      extra: connected ? null : { id: 'guide-demo', label: 'Mit Beispieldaten ausprobieren' } },
    { title: 'Schilder einschalten', done: heard,
      text: heard ? `${[...reach.values()].filter(seen => seen.via !== 'usb').length} Schilder melden sich.` : 'Eingeschaltete Schilder verbinden sich von selbst. Auf dem Display steht dann „Mit Sender verbunden“.',
      action: !heard && desktop ? { id: 'guide-setup', label: 'Schilder per USB einrichten' } : null },
    { title: 'Räume zuweisen', done: heard && !fresh.length && rooms.length > 0,
      text: fresh.length ? `${fresh.length === 1 ? 'Ein neues Schild wartet' : `${fresh.length} neue Schilder warten`} auf einen Raum.` : rooms.length ? 'Alle gefundenen Schilder haben einen Raum.' : 'Jedem Schild einen Raum geben – die Nummer steht groß auf dem Display.',
      action: fresh.length ? { id: 'guide-assign', label: 'Neue Schilder zuweisen' } : null },
    { title: 'Inhalte senden', done: rooms.length > 0 && !unsent.length && connected,
      text: !rooms.length ? 'Sobald Räume angelegt sind.' : unsent.length ? `${unsent.length} ${unsent.length === 1 ? 'Raum ist' : 'Räume sind'} noch nicht auf dem Schild.` : 'Alle Schilder zeigen den aktuellen Stand.',
      action: unsent.length && connected ? { id: 'guide-send', label: 'Alle senden' } : null },
  ];
}
function renderHome(fresh) {
  $('#nav-new').textContent = fresh.length; $('#nav-new').classList.toggle('hidden', !fresh.length);
  const steps = guideSteps(fresh), current = steps.findIndex(step => !step.done);
  $('#guide').innerHTML = `<h2>${current === -1 ? 'Alles eingerichtet' : 'Nächste Schritte'}</h2><p>${current === -1 ? 'Neue Schilder erscheinen hier automatisch.' : `Schritt ${current + 1} von ${steps.length}`}</p><ol>${steps.map((step, i) => {
    const state = step.done ? 'done' : i === current ? 'current' : 'later';
    const buttons = i === current ? `${step.action ? `<button class="button primary" data-guide="${step.action.id}">${escape(step.action.label)}</button>` : ''}${step.extra ? ` <button class="text-button" data-guide="${step.extra.id}">${escape(step.extra.label)}</button>` : ''}` : '';
    return `<li class="${state}"><span class="step-mark">${step.done ? '✓' : i + 1}</span><div><strong>${escape(step.title)}</strong>${state !== 'later' ? `<p>${escape(step.text)}</p>` : ''}${buttons}</div></li>`;
  }).join('')}</ol>${current === -1 ? '<div class="guide-done">Alle Schilder sind verbunden und aktuell.</div>' : ''}`;
  const signs = signsForMap(fresh), sender = senderState();
  const desktop = !!globalThis.workbadgeShowSetup;
  let emptyHtml = '';
  if (sender.state === 'off' && !signs.length) emptyHtml = `<strong>Noch kein Sender verbunden</strong>Sobald der Sender am USB steckt, erscheinen hier alle Schilder in Funkreichweite.<br><button class="button primary" data-guide="${desktop ? 'guide-setup' : 'guide-connect'}">${desktop ? 'Sender einrichten' : 'Sender verbinden'}</button>`;
  else if (!signs.length) emptyHtml = '<strong>Warte auf Schilder …</strong>Eingeschaltete Schilder melden sich innerhalb weniger Sekunden und erscheinen hier.';
  if (view === 'home') renderNetMap($('#netmap'), { signs, sender, emptyHtml, onSelect: id => (rooms.some(room => room.id === id) ? openEditor(id) : openEditor(null, id)) });
  const sent = $('#home-sub');
  sent.textContent = signs.length ? 'Der Sender in der Mitte, jedes Schild an seinem Platz. Je näher, desto besser der Empfang. Auf ein Schild klicken zum Bearbeiten.' : 'Hier siehst du, welche Schilder mit dem Sender verbunden sind – und wie gut.';
}
document.addEventListener('click', event => {
  const target = event.target.closest('[data-guide]'); if (!target) return;
  const action = target.dataset.guide;
  if (action === 'guide-connect') connect();
  if (action === 'guide-setup') globalThis.workbadgeShowSetup?.();
  if (action === 'guide-demo') startDemo();
  if (action === 'guide-assign') $('#new-signs').scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (action === 'guide-send') sendAll('update');
});
$('#netmap').addEventListener('netmap-resize', () => { if (view === 'home') renderRooms(); });
function flash(id) { if (view === 'home') requestAnimationFrame(() => pulse($('#netmap'), id)); }
function renderConnection() {
  const connected = !!gateway.ready, info = gateway.info;
  const local = connected && info.local_display === true, failed = gateway.lastFailure;
  $('#side-dot').classList.toggle('connected', connected);
  $('#side-connection').textContent = demo ? 'Demo-Sender verbunden' : local ? 'Sender per USB verbunden' : connected ? 'Sender verbunden' : 'Sender nicht verbunden';
  $('#side-hint').textContent = demo ? 'Simulation aktiv. Es wird kein Funk gesendet.' : connected ? (info.radio ? `${info.board} · ${info.frequency} MHz` : 'USB bereit, Funkmodul meldet einen Fehler.') : 'Ein Sender am USB-Anschluss versorgt alle Schilder im Haus.';
  $('#side-connect').disabled = connected || gateway.connecting; $('#settings-connect').disabled = connected || gateway.connecting;
  $('#settings-connect').classList.toggle('hidden', connected); $('#disconnect').classList.toggle('hidden', !connected);
  $('#disconnect').disabled = !connected;
  $('#settings-demo').disabled = connected || gateway.connecting;
  if (local) $('#side-hint').textContent = `${info.board} · USB direkt · ID ${info.device}`;
  $('#local-device-settings').classList.toggle('hidden', !local);
  $('#local-device-id').value = local ? info.device : 101;
  $('#connection-diagnostic').classList.toggle('hidden', !failed);
  $('#connection-diagnostic').textContent = failed ? failed.message : '';
  $('#firmware-installer')?.setAttribute('aria-disabled', connected ? 'true' : 'false');
  const banner = $('#mode-banner'); banner.classList.toggle('demo', demo);
  banner.innerHTML = demo ? `${icon('signal')}<div><strong>Demo-Modus.</strong><span> Beispieldaten und simulierte Funkantworten – deine echten Räume bleiben unberührt.</span></div><button id="exit-demo" class="text-button">Demo beenden</button>` : connected && !info.radio ? `${icon('warning')}<div><strong>Funkmodul des Senders antwortet nicht.</strong><span> Sender kurz abziehen und wieder anstecken.</span></div><button id="show-gateway" class="text-button">Sender ansehen</button>` : '';
  if (failed && !connected) banner.innerHTML = `${icon('warning')}<div><strong>Sender antwortet nicht.</strong><span> ${escape(failed.message)}</span></div><button id="show-gateway" class="text-button">Einrichtung öffnen</button>`;
  const outdated = connected && !demo && !firmware05(info);
  if (local && info.display_type === 'trmnl75') banner.innerHTML = `${icon('usb')}<div><strong>TRMNL ${info.device} steckt am USB.</strong><span> ${info.wifi ? `WLAN „${escape(info.wifi_ssid)}“ eingerichtet.` : 'WLAN noch nicht eingerichtet – unter „Schilder per USB einrichten“ eintragen.'} Für die anderen Schilder den Sender anstecken.</span></div><button id="show-gateway" class="text-button">Schild ansehen</button>`;
  else if (local && info.role === 'receiver') banner.innerHTML = `${icon('usb')}<div><strong>Ein Raumschild steckt am USB.</strong><span> Schild ${info.device} lässt sich direkt bearbeiten. Für alle anderen Schilder den Sender anstecken.</span></div><button id="show-gateway" class="text-button">Schild ansehen</button>`;
  if (outdated) banner.innerHTML = `${icon('warning')}<div><strong>Sender-Firmware ${escape(info.firmware || 'alt')} ist veraltet.</strong><span> Logo, Nummernanzeige, Weiterreichen und automatisches Verbinden brauchen neuere Firmware. Unter „Schilder per USB einrichten“ → „Firmware erneuern · Nummer behalten“.</span></div><button id="show-gateway" class="text-button">Sender ansehen</button>`;
  $('#gateway-name').textContent = connected ? `${demo ? 'Demo-Sender' : info.local_display && info.role === 'receiver' ? `Raumschild ${info.device} am USB` : 'Sender verbunden'} · ${info.board || 'Heltec'}` : 'Kein Sender verbunden';
  document.querySelector('.sender-panel')?.classList.toggle('online', connected);
  const details = connected ? [['Verbindung', demo ? 'Simulation' : 'USB · 115200 Baud'], ['Firmware', info.firmware || 'unbekannt'], ['Funkmodul', info.radio ? 'Bereit' : 'Fehler'], ['Protokoll', info.protocol], ['Frequenz', `${info.frequency} MHz${info.duty_percent ? ` · ${info.duty_percent} % Duty-Cycle` : ''}`], ['Modulation', `SF${info.sf} · ${info.bandwidth} kHz${info.power ? ` · ${info.power} dBm` : ''}`], ['Netzwerk-ID', info.network]] : [['Verbindung', 'Nicht verbunden'], ['Firmware-Profil', 'Wireless Paper 1.2 · Heltec V3 / V2'], ['Protokoll', 'WB1']];
  if (connected && typeof info.airtime_budget_ms === 'number') details.push(['Funkbudget frei', `${(Math.max(0, info.airtime_budget_ms) / 1000).toFixed(1)} s`]);
  if (connected && (typeof info.battery === 'number' || info.battery_mv)) details.push(['Akku Gateway', typeof info.battery === 'number' ? `${info.battery} % · ${(info.battery_mv / 1000).toFixed(2)} V` : `${(info.battery_mv / 1000).toFixed(2)} V`]);
  if (local) details.unshift(['Direkte Display-ID', info.device], ['Modus', info.display_type === 'trmnl75' ? `TRMNL 7,5″ · WLAN${info.radio ? ' + LoRa' : ' (ohne LoRa-Modul)'}` : info.role === 'gateway' ? 'USB direkt + LoRa-Sender' : 'USB direkt + LoRa-Empfänger']);
  if (local && info.display_type === 'trmnl75') details.push(['WLAN des Schilds', info.wifi ? `${info.wifi_ssid} · ${{ ok: 'verbunden', no_network: 'Netz nicht erreichbar', no_server: 'PC antwortet nicht', connecting: 'verbindet …' }[info.wifi_state] || 'eingerichtet'}` : 'nicht eingerichtet']);
  // WLAN-Abruf der TRMNL-Schilder: unter dieser Adresse holen sie ihre Bilder.
  if (signServer) details.push(['WLAN-Abruf (TRMNL)', signServer.listening ? `${signServer.addresses?.length ? signServer.addresses.map(address => `${address}:${signServer.port}`).join(', ') : `Port ${signServer.port}`}` : signServer.error || 'startet …']);
  renderOta();
  $('#gateway-details').innerHTML = details.map(([key, val]) => `<div><dt>${escape(key)}</dt><dd>${escape(val)}</dd></div>`).join('');
  renderRooms();
}
function switchView(name) {
  view = name;
  document.querySelectorAll('.view').forEach(el => el.classList.toggle('hidden', el.id !== `view-${name}`));
  document.querySelectorAll('[data-view]').forEach(el => el.classList.toggle('active', el.dataset.view === name));
  $('#breadcrumb').textContent = { home: 'Übersicht', rooms: 'Räume', design: 'Firmen-Design', activity: 'Übertragungen', settings: 'Sender & Einstellungen' }[name];
  if (name === 'design') renderDesign();
  if (name === 'home' || name === 'rooms') renderRooms();
}
async function connect() {
  $('#side-connect').disabled = true; $('#settings-connect').disabled = true;
  try { await gateway.connect(); toast(gateway.info.local_display ? `Wireless Paper verbunden · Display-ID ${gateway.info.device}.` : 'USB-Gateway verbunden.'); }
  catch (error) { if (error.name !== 'NotFoundError') { toast(error.message, true); addLog('USB-Einrichtung erforderlich', error.message, true); } }
  finally { renderConnection(); }
}
function startDemo() {
  try {
    const exampleRooms = demoRooms();
    gateway.demo(); demo = true; rooms = exampleRooms; jobs.clear(); reach.clear();
    rooms.forEach(room => reach.set(room.id, { time: Date.now() - (room.id % 4) * 60000, via: 'lora', rssi: -72 - (room.id * 7) % 45, snr: 9 - (room.id % 6) * 2, downlink_rssi: -75 - (room.id * 5) % 40, battery: [92, 64, 41, 12, 78, 100][room.id % 6], battery_mv: 3900 }));
    // Zwei neue Schilder ohne Raum, eines davon nur über ein Nachbarschild erreichbar.
    reach.set(1207, { time: Date.now() - 40000, via: 'lora', rssi: -108, snr: -1, battery: 64, battery_mv: 3800 });
    reach.set(1342, { time: Date.now() - 15000, via: 'lora', rssi: -101, snr: 2, battery: 88, battery_mv: 4000, relayed: true, via_sign: rooms[3]?.id });
    logs = []; addLog('Demo gestartet', 'Alle Antworten und Signalwerte in diesem Modus sind simuliert.'); renderConnection();
  } catch (error) { toast(error.message, true); }
}
gateway.addEventListener('event', ({ detail: event }) => {
  if (event.event === 'connection') {
    if (event.mode === 'offline') {
      for (const job of jobs.values()) if (isActive(job)) { job.state = 'failed'; job.error = 'Verbindung getrennt · Zustellung unbekannt'; }
      if (demo) { demo = false; rooms = realRooms; jobs.clear(); logs = []; }
      reach.clear(); addLog('Verbindung getrennt');
    } else if (event.mode === 'usb') { jobs.clear(); reach.clear(); addLog('Sender verbunden', `${event.info.board} · Firmware ${event.info.firmware || '?'}`); }
    identifying.clear(); autoIdentified.clear(); identifyAll = false;
    for (const waiter of partWaiters.values()) waiter.reject(new Error('Verbindung getrennt.'));
    renderConnection(); return;
  }
  if (handleOtaEvent(event)) return;
  if (event.event === 'transport_error') { toast(event.message, true); addLog('Verbindungsfehler', event.message, true); return; }
  if (event.event === 'linked' && Number.isInteger(event.device)) {
    // Firmware 0.7: Schild hat sich mit dem Sender verbunden (Begrüßung bestätigt).
    const room = rooms.find(item => item.id === event.device);
    updateReach(event.device, event, 'lora', 'linked');
    addLog(`${room ? room.content.name : `Schild ${event.device}`}: mit dem Sender verbunden`, `Das Display zeigt jetzt „Verbunden“${event.relayed ? ` · über ${event.via ? `Schild ${event.via}` : 'ein Nachbarschild'}` : ''}.`);
    renderRooms(); flash(event.device); return;
  }
  if (event.event === 'beacon' && Number.isInteger(event.device)) {
    const known = rooms.some(room => room.id === event.device), first = !reach.has(event.device);
    updateReach(event.device, event, 'lora', 'beacon');
    if (first) addLog(known ? `${rooms.find(room => room.id === event.device).content.name}: meldet sich` : `Neues Schild ${event.device} gefunden`, `${Math.round(event.rssi)} dBm · SNR ${event.snr} dB${typeof event.battery === 'number' ? ` · Akku ${event.battery} %` : ''}${event.relayed ? ` · über ${event.via ? `Schild ${event.via}` : 'ein Nachbarschild'}` : ''}`);
    // Ein neues Schild soll sofort zeigen, wer es ist: Nummer groß aufs Display.
    if (!known && canIdentify() && gateway.info.role === 'gateway' && event.identify !== true && !(event.fw >= 7) && !autoIdentified.has(event.device)) {
      autoIdentified.add(event.device);
      gateway.request('identify', event.device, undefined, 5000, { on: true, relay: event.relayed === true }).then(() => { identifying.add(event.device); addLog(`Schild ${event.device} zeigt jetzt seine Nummer`, 'So findest du es an der Tür wieder.'); renderRooms(); }).catch(() => autoIdentified.delete(event.device));
    }
    renderRooms(); flash(event.device); return;
  }
  // Teile eines Bildes: Fortschritt am Raum zeigen, die Übertragung selbst steuert sendImage().
  const imageJob = imageJobs.get(event.device);
  if (imageJob && ['queued', 'tx', 'ack', 'failed', 'error'].includes(event.event)) {
    if (event.event === 'tx') { imageJob.state = 'tx'; imageJob.attempt = event.attempt; imageJob.relay = event.relay === true; }
    if (event.event === 'ack') { updateReach(event.device, event, event.via || 'lora', 'ack'); settlePart(event.id, event); }
    if (['failed', 'error'].includes(event.event)) settlePart(event.id, null, new Error(event.message || event.code || 'Keine Antwort'));
    renderRooms(); return;
  }
  if (event.event === 'ack' && Number.isInteger(event.device) && event.device !== BROADCAST && !rooms.some(room => room.id === event.device)) updateReach(event.device, event, event.via || 'lora', 'ack');
  const room = rooms.find(room => room.id === event.device);
  if (event.event === 'queued' && room) {
    jobs.set(event.id, { id: event.id, device: event.device, state: 'queued', via: event.via || 'lora' });
    // The UI keeps a bounded history; active firmware jobs are never evicted.
    if (jobs.size > 200) for (const [id, job] of jobs) { if (!isActive(job)) { jobs.delete(id); break; } }
    addLog(`${room.content.name}: eingereiht`, `Nachricht ${event.id}${event.wait_ms ? ` · frühestens in ${Math.ceil(event.wait_ms / 1000)} s` : ''}`);
  }
  const job = jobs.get(event.id);
  if (job && room && job.device === event.device && isActive(job)) {
    if (event.event === 'tx') { flash(0); job.state = 'tx'; job.attempt = event.attempt; job.maxAttempts = event.max_attempts || 5; if (event.attempt > 1) addLog(`${room.content.name}: erneut gesendet`, `Versuch ${event.attempt}/${job.maxAttempts} · warte auf Empfangsbestätigung`); }
    if (event.event === 'ack') {
      job.state = 'ack'; job.via = event.via || 'lora'; job.stage = event.stage;
      const seen = updateReach(room.id, event, job.via, 'ack');
      const local = job.via === 'usb';
      const message = local ? (event.stage === 'rendered' ? 'Display aktualisiert' : 'USB-Gerät erreichbar') : 'Empfang bestätigt';
      const q = signalQuality(seen);
      addLog(`${room.content.name}: ${message}`, local ? 'Direkt über USB' : `${demo ? 'Simuliert · ' : ''}${q ? `${q.label} · ` : ''}${Math.round(event.rssi)} dBm · SNR ${event.snr} dB${event.attempt > 1 ? ` · ${event.attempt}. Versuch` : ''}${typeof event.battery === 'number' ? ` · Akku ${event.battery} %` : ''}`);
      if (Date.now() > bulkQuietUntil) toast(`${room.content.name}: ${message}${demo ? ' (Demo)' : ''}.`);
      flash(room.id);
    }
    if (['failed', 'error'].includes(event.event)) { job.state = 'failed'; job.error = event.message || event.code || 'Keine Antwort'; addLog(`${room.content.name}: fehlgeschlagen`, job.error, true); if (Date.now() > bulkQuietUntil) toast(`${room.content.name}: ${job.error}`, true); }
  }
  renderRooms();
});
function settlePart(id, value, error) {
  const waiter = partWaiters.get(id);
  if (!waiter) { earlyResults.set(id, { value, error }); return; }
  partWaiters.delete(id); if (error) waiter.reject(error); else waiter.resolve(value);
}
function partResult(id) {
  return new Promise((resolve, reject) => {
    const early = earlyResults.get(id);
    if (early) { earlyResults.delete(id); return early.error ? reject(early.error) : resolve(early.value); }
    const timer = setTimeout(() => { partWaiters.delete(id); reject(new Error('Keine Antwort vom Sender.')); }, 120000);
    partWaiters.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
  });
}
// Sendet das fertig gestaltete Schild als Bild: mehrere Funkpakete nacheinander, jedes einzeln bestätigt.
// large: TRMNL in voller Auflösung (800 × 480, Format 2). fallback: Fehler nur vermerken, der Aufrufer nimmt das WLAN.
async function sendImage(room, { large = false, fallback = false } = {}) {
  const { bits, hash } = large ? rendered75(room) : rendered(room);
  const parts = imageParts(bits, imageCounter = (imageCounter + 1) & 0xffff);
  const job = { id: `image-${room.id}-${Date.now()}`, device: room.id, state: 'queued', image: true, part: 0, total: parts.length, via: gateway.isLocalDevice(room.id) ? 'usb' : 'lora' };
  jobs.set(job.id, job); imageJobs.set(room.id, job); submitting.add(room.id); earlyResults.clear();
  addLog(`${room.content.name}: wird gesendet`, `${large ? 'Volle Auflösung 800 × 480' : 'Schildbild'} in ${parts.length} ${parts.length === 1 ? 'Funkpaket' : 'Funkpaketen'}${large ? ` · ca. ${Math.round(parts.length * 0.8)} s` : ''}`);
  try {
    for (const part of parts) {
      job.part = part.index + 1; job.state = 'queued'; job.attempt = 1; renderRooms();
      let queued;
      for (let attempt = 0; ; attempt++) {
        try { queued = await gateway.request('image', room.id, undefined, 5000, { ...part, relay: reach.get(room.id)?.relayed === true }); break; }
        catch (error) { if (/Warteschlange voll|queue_full|noch aktualisiert/i.test(error.message) && attempt < 40 && gateway.ready) { await sleep(1200); continue; } throw error; }
      }
      await partResult(queued.id);
    }
    job.state = 'ack'; room.sent = hash; identifying.delete(room.id); persist();
    const seen = reach.get(room.id);
    addLog(`${room.content.name}: Schild aktualisiert`, job.via === 'usb' ? 'Direkt über USB' : `${demo ? 'Simuliert · ' : ''}${seen?.relayed ? `über ${seen.via_sign ? `Schild ${seen.via_sign}` : 'Nachbarschild'} · ` : ''}${typeof seen?.rssi === 'number' ? `${seen.rssi} dBm` : ''}${typeof seen?.battery === 'number' ? ` · Akku ${seen.battery} %` : ''}`);
    if (Date.now() > bulkQuietUntil) toast(`${room.content.name}: Schild aktualisiert${demo ? ' (Demo)' : ''}.`);
  } catch (error) {
    job.state = 'failed'; job.error = error.message; error.jobId = job.id;
    if (fallback) addLog(`${room.content.name}: per LoRa nicht angekommen`, `${error.message} – das Schild holt das Bild jetzt per WLAN.`);
    else addLog(`${room.content.name}: fehlgeschlagen`, error.message, true);
    throw error;
  } finally { imageJobs.delete(room.id); submitting.delete(room.id); renderRooms(); }
}
async function setIdentifyAll(on) {
  try {
    // TRMNL per WLAN: Wunsch liegt im PC bereit, das Schild sieht ihn bei der nächsten Abfrage.
    const wlanIds = [...reach.entries()].filter(([, seen]) => seen.wifi_time).map(([id]) => id);
    if (signApi && wlanIds.length) await signApi.identify(wlanIds, on);
    if (canIdentify()) await gateway.request('identify', BROADCAST, undefined, 5000, { on });
    else if (!wlanIds.length) throw new Error('Kein Schild erreichbar.');
    identifyAll = on; if (!on) { identifying.clear(); for (const id of reach.keys()) autoIdentified.add(id); }
    addLog(on ? 'Alle Schilder zeigen ihre Nummer' : 'Nummernanzeige beendet', on ? 'Jedes Schild zeigt groß seine Schild-Nummer. Beim nächsten Senden oder nach 20 Minuten erscheint wieder der Inhalt.' : 'Die Schilder zeigen wieder ihren Inhalt.');
    toast(on ? 'Alle Schilder zeigen jetzt groß ihre Nummer.' : 'Die Schilder zeigen wieder ihren Inhalt.');
  } catch (error) { toast(error.message, true); }
  renderRooms();
}
function editorRoom() {
  return { id: Number($('#edit-id').value), floor: $('#edit-floor').value.trim(), displayType: $('#edit-display').value, design: readDesign({ template: $('#edit-template').value, number: $('#edit-number').value.trim(), people: $('#edit-people').value, showLogo: $('#edit-logo').checked, showStatus: $('#edit-show-status').checked }), content: { status: $('#edit-status').value, name: $('#edit-name').value.trim(), title: $('#edit-title').value, host: $('#edit-host').value, time: $('#edit-time').value, note: $('#edit-note').value } };
}
function updatePreview() {
  const room = editorRoom(); $('#editor-display').innerHTML = display(room);
  const model = getDisplay(room.displayType);
  $('#display-specs').textContent = model.description;
  $('#display-hint').textContent = model.hint;
  $('#preview-model').textContent = model.short;
  const bytes = new TextEncoder().encode(JSON.stringify(room.content)).length;
  $('#room-form').classList.toggle('image-mode', model.image === true);
  if (model.image) {
    paintCanvases($('#room-form'), () => room);
    document.querySelectorAll('[data-template-option]').forEach(el => { const active = el.dataset.templateOption === (room.design.template || company.template); el.classList.toggle('active', active); el.setAttribute('aria-pressed', active); });
    let parts = 0; try { parts = imageParts(rendered(room).bits, 1).length; } catch { /* zu unruhig: Meldung beim Senden */ }
    if (model.large) {
      let full = 0; try { full = imageParts(rendered75(room).bits, 1).length; } catch { /* zu unruhig */ }
      $('#payload-label').textContent = full ? `800 × 480 per LoRa · ${full} Funkpakete · ca. ${Math.round(full * 0.8)} s · sonst per WLAN` : '800 × 480 · zu unruhig für LoRa – nur per WLAN';
      $('.payload-meter').classList.remove('over');
    } else {
      $('#payload-label').textContent = parts ? `Schildbild · ${parts} ${parts === 1 ? 'Funkpaket' : 'Funkpakete'} · ca. ${Math.max(1, Math.round(parts * 0.7))} s Übertragung` : 'Bild zu unruhig für den Funk';
      $('.payload-meter').classList.toggle('over', !parts);
    }
  } else {
    $('#payload-label').textContent = `${bytes} / 200 Bytes Funkinhalt`;
    $('.payload-meter').classList.toggle('over', bytes > 200);
  }
  $('#save-send').disabled = !canSend(room) || isActive(currentJob(editingId)) || submitting.has(editingId);
}
function openEditor(id = null, presetId = null) {
  editingId = id;
  let room = rooms.find(room => room.id === id);
  if (!room) { let next = presetId ?? (gateway.info?.local_display ? gateway.info.device : 1); while (rooms.some(room => room.id === next)) next = next >= 65534 ? 1 : next + 1; room = { id: next, floor: '', displayType: presetId && reach.get(presetId)?.large ? 'trmnl75' : presetId || gateway.info?.local_display ? 'wirelesspaper12' : DEFAULT_DISPLAY, design: readDesign(), content: { name: '', status: 'free', title: '', host: '', time: '', note: '' } }; }
  $('#editor-title').textContent = id === null ? 'Neues Raumdisplay' : 'Raum bearbeiten';
  for (const field of ['name', 'status', 'title', 'host', 'time', 'note']) $(`#edit-${field}`).value = room.content[field];
  $('#edit-id').value = room.id; $('#edit-floor').value = room.floor;
  const design = readDesign(room.design);
  $('#edit-number').value = design.number; $('#edit-people').value = design.people; $('#edit-template').value = design.template;
  $('#edit-logo').checked = design.showLogo; $('#edit-show-status').checked = design.showStatus;
  $('#template-options').innerHTML = templateOptions(design.template || company.template);
  $('#edit-display').value = room.displayType || 'generic';
  $('#edit-id').disabled = isActive(currentJob(id));
  $('#edit-display').disabled = isActive(currentJob(id));
  $('#delete-room').classList.toggle('hidden', id === null); $('#delete-room').disabled = isActive(currentJob(id));
  $('#editor-error').textContent = ''; updatePreview(); renderRooms(); $('#editor').showModal();
}
// TRMNL 7,5″: zuerst per LoRa in voller Auflösung (800 × 480, ~30 Funkpakete). Klappt das nicht – kein Sender, Schild
// ohne LoRa-Modul oder nicht erreichbar –, holt das Schild dasselbe Bild per WLAN beim PC ab (dort liegt es immer bereit).
async function sendLarge(room) {
  const large = rendered75(room), seen = reach.get(room.id), name = room.content.name;
  const data = signApi ? toBase64(large.bits) : null;
  if (signApi) await signApi.publish(room.id, large.hash, data);
  if (seen?.have === large.hash) { room.sent = large.hash; wlanJobs.delete(room.id); persist(); addLog(`${name}: Schild ist bereits aktuell`, 'Per WLAN bestätigt.'); renderRooms(); return; }
  const noRadio = seen?.lora_module === false && wlanFresh(seen);  // Schild meldet per WLAN: kein LoRa-Modul
  const viaLora = gateway.ready && gateway.canSendTo(room.id) && !noRadio && usesImage(room);
  const waitForWlan = reason => {
    wlanJobs.set(room.id, { hash: large.hash, since: Date.now() });
    addLog(`${name}: für WLAN bereitgestellt`, `${reason}${seen?.wifi_time ? ` Das Schild holt das Bild bei seiner nächsten Abfrage ab${seen.sleeping ? ' – es schläft zwischendurch, spätestens nach etwa 5 Minuten' : ' – etwa jede Minute'}.` : ' Sobald sich das Schild per WLAN meldet, holt es das Bild ab.'}`);
    if (Date.now() > bulkQuietUntil) toast(`${name}: bereitgestellt – das Schild holt es per WLAN ab.`);
    renderRooms();
  };
  if (viaLora && (firmware08(gateway.info) || demo)) {
    try {
      await sendImage(room, { large: true, fallback: !!signApi });
      wlanJobs.delete(room.id);
      // Dem WLAN-Abruf sagen, dass das Schild dieses Bild schon hat (kein zweiter Bildaufbau).
      if (signApi) void signApi.publish(room.id, large.hash, data, true).catch(() => {});
      return;
    } catch (error) {
      if (!signApi) throw error;
      if (error.jobId) jobs.delete(error.jobId);
      return waitForWlan('Per LoRa nicht angekommen.');
    }
  }
  if (signApi) return waitForWlan(viaLora ? 'Der Sender braucht Firmware 0.8 für die volle Auflösung per Funk.' : noRadio ? 'Das Schild hat kein LoRa-Modul.' : 'Kein LoRa-Sender verbunden.');
  // Ohne PC-Programm (Browser): Sender zu alt → vereinfacht per Funk.
  if (viaLora) { addLog(`${name}: vereinfacht per LoRa`, 'Für die volle Auflösung den Sender auf Firmware 0.8 bringen.'); return sendImage(room); }
  throw new Error('Kein Sender verbunden.');
}
async function send(room, op = 'update') {
  if (isActive(currentJob(room.id)) || submitting.has(room.id)) throw new Error('Für dieses Display läuft bereits eine Übertragung.');
  if (isDraft(room)) throw new Error('Diesem Raum ist noch kein Schild zugewiesen.');
  if (op === 'update' && isLarge(room)) return sendLarge(room);
  if (!gateway.canSendTo(room.id)) throw new Error('Dieses Gerät kann die gewählte Display-ID nicht steuern. Bitte Geräte-ID und Verbindung prüfen.');
  if (op === 'update' && usesImage(room)) return sendImage(room);
  if (op === 'update') validateContent(room.content);
  submitting.add(room.id); renderRooms();
  try { return await gateway.request(op, room.id, room.content); }
  finally { submitting.delete(room.id); renderRooms(); }
}
async function sendAll(op) {
  if (bulkRunning) return;
  const targets = rooms.filter(room => !isDraft(room) && (op === 'update' ? canSend(room) : gateway.canSendTo(room.id)) && !isActive(currentJob(room.id)));
  if (!targets.length) return toast('Kein Raum kann gerade erreicht werden. Gateway verbinden.', true);
  if (op === 'update') { const invalid = targets.filter(room => { if (usesImage(room) || isLarge(room)) return false; try { validateContent(room.content); return false; } catch { return true; } }); if (invalid.length) return toast(`${invalid[0].content.name}: Inhalt zu lang oder ungültig. Bitte zuerst kürzen.`, true); }
  bulkRunning = true; bulkQuietUntil = Date.now() + 120000; renderRooms();
  let queued = 0, failed = 0;
  addLog(op === 'update' ? `Alle Räume senden (${targets.length})` : `Empfang aller Schilder prüfen (${targets.length})`);
  try {
    for (const room of targets) {
      for (let attempt = 0; ; attempt++) {
        try { await send(room, op); queued++; break; }
        catch (error) {
          // Volle Warteschlange: kurz warten, das Gateway arbeitet sie ab.
          if (/Warteschlange voll|queue_full/i.test(error.message) && attempt < 40 && gateway.ready) { await new Promise(resolve => setTimeout(resolve, 1500)); continue; }
          failed++; addLog(`${room.content.name}: nicht eingereiht`, error.message, true); break;
        }
      }
      if (!gateway.ready) break;
    }
  } finally { bulkRunning = false; bulkQuietUntil = Date.now() + 30000; renderRooms(); }
  toast(`${queued} von ${targets.length} Räumen ${op === 'update' ? 'gesendet' : 'geprüft'}${failed ? `, ${failed} fehlgeschlagen` : ''}. Einzelheiten unter „Übertragungen“.`, failed > 0);
}
function renderRadioList() {
  const list = $('#radio-list'); if (!list) return;
  const entries = [...reach.entries()].filter(([, seen]) => seen.via !== 'usb').sort((a, b) => b[1].time - a[1].time);
  $('#radio-count').textContent = entries.length;
  list.innerHTML = entries.length ? entries.map(([id, seen]) => {
    const room = rooms.find(room => room.id === id);
    return `<div class="radio-row"><strong>ID ${id}</strong><span>${room ? escape(room.content.name) : '<em class="new-tag">Neu · kein Raum</em>'}</span>${telemetryHtml(seen)}${room ? `<button class="text-button" data-radio-edit="${id}">Bearbeiten</button>` : `<button class="button" data-radio-add="${id}">Als Raum anlegen</button>`}</div>`;
  }).join('') : '<p class="no-activity">Noch kein Schild gehört. Eingeschaltete Schilder melden sich von selbst – spätestens nach wenigen Minuten.</p>';
}
for (const list of ['#radio-list', '#new-signs-list']) $(list).addEventListener('click', event => {
  const add = event.target.closest('[data-radio-add]'), edit = event.target.closest('[data-radio-edit]');
  if (add) openEditor(null, Number(add.dataset.radioAdd));
  if (edit) openEditor(Number(edit.dataset.radioEdit));
});
// Einen vorbereiteten Raum (aus der importierten Liste) einem gefundenen Schild zuweisen und gleich senden.
$('#new-signs-list').addEventListener('change', async event => {
  const select = event.target.closest('[data-assign]'); if (!select || !select.value) return;
  const sign = Number(select.dataset.assign), room = rooms.find(item => item.id === Number(select.value));
  if (!room || rooms.some(item => item.id === sign)) return;
  room.id = sign; delete room.sent; persist(); renderRooms();
  toast(`${room.content.name} gehört jetzt zu Schild ${sign}.`);
  try { await send(room); } catch (error) { toast(error.message, true); }
});
$('#identify-all').addEventListener('click', () => setIdentifyAll(!identifyAll));
$('#template-options').addEventListener('click', event => {
  const option = event.target.closest('[data-template-option]'); if (!option) return;
  $('#edit-template').value = option.dataset.templateOption; updatePreview();
});
$('#send-all').addEventListener('click', () => sendAll('update'));
$('#ping-all').addEventListener('click', () => sendAll('ping'));
$('#room-form').addEventListener('input', updatePreview);
$('#room-form').addEventListener('submit', async event => {
  event.preventDefault(); const intent = event.submitter?.value || 'save';
  try {
    const room = validateRooms([editorRoom()])[0];
    if (rooms.some(item => item.id === room.id && item.id !== editingId)) throw new Error('Diese Display-ID ist bereits vergeben.');
    if (intent === 'send') { if (!usesImage(room) && !isLarge(room)) validateContent(room.content); if (!canSend(room)) throw new Error('Bitte das passende USB-Gerät verbinden und dessen Display-ID verwenden.'); }
    if (editingId !== null && isActive(currentJob(editingId))) throw new Error('Bitte die laufende Übertragung abwarten.');
    const index = rooms.findIndex(item => item.id === editingId);
    if (index === -1 && rooms.length >= 256) throw new Error('Pro Workspace sind höchstens 256 Räume möglich.');
    if (index !== -1 && rooms[index].sent && room.id === editingId) room.sent = rooms[index].sent;
    if (index === -1) rooms.push(room); else rooms[index] = room;
    if (room.id !== editingId) { identifying.delete(room.id); }
    if (editingId !== null && room.id !== editingId) { if (signApi) void signApi.unpublish(editingId).catch(() => {}); wlanJobs.delete(editingId); }
    if (editingId !== null) { reach.delete(editingId); for (const [id, job] of jobs) if (job.device === editingId) jobs.delete(id); }
    persist(); renderRooms();
    $('#editor').close();
    if (intent === 'send') { toast('Gespeichert – wird jetzt gesendet.'); send(room).catch(error => toast(error.message, true)); }
    else toast('Entwurf lokal gespeichert.');
  } catch (error) { $('#editor-error').textContent = error.message; }
});
$('#delete-room').addEventListener('click', () => {
  if (isActive(currentJob(editingId))) return;
  if (!confirm('Diesen Raum aus dem lokalen Workspace entfernen? Das Display selbst wird nicht gelöscht.')) return;
  if (signApi) void signApi.unpublish(editingId).catch(() => {});
  wlanJobs.delete(editingId);
  rooms = rooms.filter(room => room.id !== editingId); persist(); renderRooms(); $('#editor').close(); toast('Raum entfernt.');
});
$('#rooms-grid').addEventListener('click', async event => {
  const button = event.target.closest('[data-action]'); if (!button || button.disabled) return;
  const id = Number(button.dataset.id), room = rooms.find(room => room.id === id);
  if (button.dataset.action === 'edit') return openEditor(id);
  button.disabled = true;
  try { await send(room, button.dataset.action === 'ping' ? 'ping' : 'update'); }
  catch (error) { toast(error.message, true); }
  finally { renderRooms(); }
});
$('#mode-banner').addEventListener('click', event => {
  if (event.target.closest('#try-demo')) startDemo();
  if (event.target.closest('#exit-demo')) void gateway.disconnect();
  if (event.target.closest('#show-gateway')) switchView('settings');
});
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => switchView(button.dataset.view)));
$('#search').addEventListener('input', renderRooms); $('#status-filter').addEventListener('change', renderRooms);
for (const id of ['add-room', 'empty-add']) $(`#${id}`).addEventListener('click', () => openEditor());
for (const id of ['side-connect', 'settings-connect']) $(`#${id}`).addEventListener('click', connect);
for (const id of ['empty-demo', 'settings-demo']) $(`#${id}`).addEventListener('click', startDemo);
$('#disconnect').addEventListener('click', () => gateway.disconnect());
$('#firmware-installer')?.addEventListener('click', event => {
  if (gateway.mode !== 'offline' || gateway.connecting) { event.preventDefault(); toast('Bitte zuerst die USB-Verbindung beziehungsweise Demo trennen.', true); }
});
$('#add-local-room').addEventListener('click', () => {
  const room = rooms.find(room => room.id === gateway.info?.device);
  openEditor(room ? room.id : null);
});
$('#save-device-id').addEventListener('click', async () => {
  const button = $('#save-device-id'); button.disabled = true;
  try {
    const info = await gateway.request('configure', Number($('#local-device-id').value));
    gateway.info = info; renderConnection(); toast(`Geräte-ID ${info.device} dauerhaft gespeichert. Bitte dieselbe ID beim Raum verwenden.`);
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
});
$('#close-editor').addEventListener('click', () => $('#editor').close());
$('#help').addEventListener('click', () => $('#help-dialog').showModal()); $('#close-help').addEventListener('click', () => $('#help-dialog').close());
$('#clear-log').addEventListener('click', () => { logs = []; renderLogs(); });
function renderWorkspace() {
  $('.workspace>div').firstChild.textContent = company.name || workspace; $('#workspace-name').value = workspace;
  const badge = $('.workspace-icon'); badge.classList.toggle('with-logo', !!company.logo);
  if (company.logo) { const image = new Image(); image.alt = ''; image.src = company.logo; badge.replaceChildren(image); }
  else badge.textContent = (company.name || workspace).trim().charAt(0).toUpperCase() || 'W';
}
$('#workspace-name').addEventListener('change', event => { workspace = event.target.value.trim() || 'Mein Workspace'; renderWorkspace(); persist(); });
$('#export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ version: 1, workspace, rooms: realRooms, company }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = 'workbadge-rooms-backup.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Sicherung deiner echten Räume exportiert.');
});
$('#import').addEventListener('click', () => {
  if (demo) return toast('Bitte zuerst den Demo-Modus beenden.', true);
  if ([...jobs.values()].some(isActive)) return toast('Bitte offene Übertragungen zuerst abschließen.', true);
  $('#import-file').click();
});
$('#import-file').addEventListener('change', async event => {
  try {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 512000) throw new Error('Sicherungsdatei ist zu groß.');
    const data = readBackup(await file.text());
    if (demo || [...jobs.values()].some(isActive)) throw new Error('Import während Demo oder Übertragung nicht möglich.');
    if (rooms.length && !confirm(`Workspace durch die Sicherung mit ${data.rooms.length} Räumen ersetzen?`)) return;
    rooms = data.rooms; realRooms = rooms; workspace = data.workspace; setCompany(data.company); await refreshLogo(); jobs.clear(); reach.clear(); persist(); renderWorkspace(); renderRooms(); toast('Sicherung importiert.');
  } catch (error) { toast(`Import fehlgeschlagen: ${error.message}`, true); }
  finally { event.target.value = ''; }
});
$('#edit-display').innerHTML = Object.entries(DISPLAY_TYPES).map(([key, model]) => `<option value="${key}">${escape(model.name)}</option>`).join('');
initDesign({
  toast,
  onChange: () => { persist(); renderWorkspace(); if (view === 'rooms' || view === 'home') renderRooms(); },
  applyToAll: () => {
    if (!rooms.length) return toast('Es gibt noch keine Räume.', true);
    if (!confirm(`Vorlage „${company.template}“ und Logo auf alle ${rooms.length} Räume anwenden? Danach „Alle senden“ wählen.`)) return;
    for (const room of rooms) { room.design = readDesign({ ...room.design, template: '', showLogo: true }); }
    persist(); renderRooms(); toast('Design auf alle Räume angewendet. Jetzt „Alle senden“.');
  },
});
$('#import-csv').addEventListener('click', () => { if (demo) return toast('Bitte zuerst den Demo-Modus beenden.', true); $('#csv-file').click(); });
$('#csv-file').addEventListener('change', async event => {
  try {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 512000) throw new Error('Die Datei ist zu groß.');
    const rows = parseRoomCsv(await file.text());
    let added = 0, nextDraft = Math.max(DRAFT_ID_START - 1, ...rooms.map(room => room.id)) + 1;
    for (const row of rows) {
      if (rooms.length >= 256) break;
      let id = row.id && row.id >= 1 && row.id < DRAFT_ID_START && !rooms.some(room => room.id === row.id) ? row.id : null;
      if (id === null) { if (nextDraft > 65534) break; id = nextDraft++; }
      rooms.push(validateRooms([{ id, floor: row.floor, displayType: 'wirelesspaper12', content: { status: 'free', name: row.name, title: '', host: '', time: '', note: '' }, design: { number: row.number, people: row.people } }])[0]);
      added++;
    }
    persist(); renderRooms(); switchView('rooms');
    toast(`${added} ${added === 1 ? 'Raum' : 'Räume'} übernommen. Räume ohne Schild-ID weist du gefundenen Schildern mit einem Klick zu.`);
  } catch (error) { toast(`Import fehlgeschlagen: ${error.message}`, true); }
  finally { event.target.value = ''; }
});
$('#print-list').addEventListener('click', () => { if (!rooms.length) return toast('Es gibt noch keine Räume.', true); printList(rooms, workspace); });
// ---------------------------------------------------------------- TRMNL 7,5″ per WLAN
// Jede Abfrage eines Schilds beim PC kommt hier an: Akku, WLAN-Empfang und welches Bild es gerade zeigt (have).
if (signApi) {
  signApi.onPoll(event => {
    const id = event.device; if (!Number.isInteger(id)) return;
    const previous = reach.get(id), first = !previous, room = rooms.find(item => item.id === id);
    const entry = updateReach(id, event, loraFresh(previous) ? previous.via : 'wlan', 'wlan');
    Object.assign(entry, { wifi_time: Date.now(), wifi_rssi: event.wifi_rssi, wifi_address: event.address, have: event.have, sleeping: event.sleeping, large: true, lora_module: event.lora });
    if (first) addLog(room ? `${room.content.name}: meldet sich per WLAN` : `Neues Schild ${id} meldet sich per WLAN`, `${event.address || ''}${typeof event.wifi_rssi === 'number' ? ` · ${event.wifi_rssi} dBm` : ''}${typeof event.battery === 'number' ? ` · Akku ${event.battery} %` : ''}${event.lora ? ' · mit LoRa-Modul' : ''}`);
    // Bild steht auf dem Schild (have = Prüfwert des Bildes, das der PC bereitgestellt hat).
    const waiting = wlanJobs.get(id);
    if (room && event.have && event.have === event.hash && (waiting?.hash === event.have || room.sent !== event.have)) {
      room.sent = event.have; wlanJobs.delete(id); identifying.delete(id); persist();
      addLog(`${room.content.name}: Schild aktualisiert`, `Per WLAN${typeof event.wifi_rssi === 'number' ? ` · ${event.wifi_rssi} dBm` : ''}${typeof event.battery === 'number' ? ` · Akku ${event.battery} %` : ''}`);
      if (Date.now() > bulkQuietUntil) toast(`${room.content.name}: Schild aktualisiert (WLAN).`);
    }
    // PC hat kein Bild mehr für ein Schild, das schon Inhalt hatte (z. B. anderer PC): wieder bereitstellen.
    if (room && event.status === 404 && room.sent && !demo) { const large = rendered75(room); void signApi.publish(id, large.hash, toBase64(large.bits)).catch(() => {}); }
    renderRooms(); flash(id);
  });
  const showServer = info => { signServer = info; renderConnection(); };
  signApi.onInfo(showServer);
  signApi.info().then(showServer).catch(() => {});
}
void refreshLogo().then(() => { renderWorkspace(); renderRooms(); });
// Web-Ausgabe (workbadge.de): Räume gestalten und über den Sender senden – ohne Schilder einzurichten oder Firmware
// zu verteilen. Dafür gibt es das Programm zum Herunterladen.
const webEdition = document.documentElement.dataset.edition === 'web';
if (webEdition) {
  $('#firmware-installer').remove(); $('.ota-panel')?.remove(); $('.lg-wlan')?.remove(); $('#get-desktop').classList.remove('hidden');
} else initOta({ gateway, toast, addLog });
renderWorkspace(); renderConnection(); renderLogs();
initDesktopPanel({ gateway, connect, renderConnection });
setInterval(() => { if ((view === 'rooms' || view === 'home') && !$('#editor').open) renderRooms(); }, 30000);
switchView('home');
