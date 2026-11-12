// Workbadge Rooms 0.7 – Firmen-Design: Logo, Schrift, Vorlagen und das fertige Schildbild je Raum.
import { STATUSES } from './protocol.js';
import { defaultCompany, readCompany, DRAFT_ID_START } from './store.js';
import { TEMPLATES, FONTS, renderSign, renderSign75, paint, paint75, setLogoImage, clearLogoCache } from './render.js';

const $ = selector => document.querySelector(selector);
export const company = defaultCompany();
let revision = 0, changed = () => {};
const cache = new Map(), cache75 = new Map();

export function setCompany(value) { Object.assign(company, readCompany(value)); touch(); }
function touch() { revision++; cache.clear(); cache75.clear(); clearLogoCache(); }
export const isDraft = room => room.id >= DRAFT_ID_START;

// Raum → Angaben für die Vorlage.
export function signRoom(room, template) {
  const c = room.content, d = room.design || {};
  const people = String(d.people || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const when = [c.host, c.time].filter(Boolean).join(' · ');
  if (when) people.push(when);
  if (c.note) people.push(c.note);
  return {
    name: c.name, number: d.number || '', subtitle: c.title || '', people: people.join('\n'),
    status: d.showStatus ? STATUSES[c.status] : '', template: template || d.template || company.template, showLogo: d.showLogo !== false,
  };
}
// Fertiges Bild (Bits + Prüfwert); wird je Raum zwischengespeichert, bis sich Inhalt oder Design ändern.
export function rendered(room, template) {
  const sign = signRoom(room, template), key = `${revision}|${JSON.stringify(sign)}`;
  const slot = template ? `t:${template}:${room.id}` : room.id, hit = cache.get(slot);
  if (hit?.key === key) return hit;
  const result = { key, ...renderSign(sign, company) };
  if (cache.size > 600) cache.clear();
  cache.set(slot, result);
  return result;
}
// 7,5″ (TRMNL): dasselbe Schild in 800 × 480 – wird per WLAN abgeholt. Ebenfalls zwischengespeichert.
export function rendered75(room) {
  const sign = signRoom(room), key = `${revision}|${JSON.stringify(sign)}`, hit = cache75.get(room.id);
  if (hit?.key === key) return hit;
  const result = { key, ...renderSign75(sign, company) };
  if (cache75.size > 300) cache75.clear();
  cache75.set(room.id, result);
  return result;
}
// Alle Vorschauflächen unterhalb von root malen. lookup(schlüssel) liefert den Raum.
// data-large: 800 × 480 (TRMNL), sonst 250 × 122.
export function paintCanvases(root, lookup) {
  for (const canvas of root.querySelectorAll('canvas[data-sign]')) {
    const room = lookup(canvas.dataset.sign);
    if (!room) continue;
    if (canvas.dataset.large !== undefined) paint75(canvas, canvas.dataset.template ? renderSign75(signRoom(room, canvas.dataset.template), company).bits : rendered75(room).bits);
    else paint(canvas, rendered(room, canvas.dataset.template || undefined).bits);
  }
}
export function refreshLogo() {
  return new Promise(resolve => {
    if (!company.logo) { setLogoImage(null); touch(); return resolve(); }
    const image = new Image();
    image.onload = () => { setLogoImage(image); touch(); resolve(); };
    image.onerror = () => { setLogoImage(null); touch(); resolve(); };
    image.src = company.logo;
  });
}
// Hochgeladenes Logo verkleinern (höchstens 640 px breit) und als PNG mit weißem Grund ablegen.
function readLogo(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) return reject(new Error('Bitte eine Bilddatei wählen (PNG, JPG oder SVG).'));
    if (file.size > 8 * 1024 * 1024) return reject(new Error('Das Logo ist größer als 8 MB.'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Die Datei konnte nicht gelesen werden.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Dieses Bildformat wird nicht unterstützt.'));
      image.onload = () => {
        const width = image.naturalWidth || 640, height = image.naturalHeight || 240, scale = Math.min(1, 640 / width, 320 / height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
        const g = canvas.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height);
        g.imageSmoothingQuality = 'high'; g.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
const sample = () => ({ id: 0, content: { name: 'Besprechung Elbe', status: 'busy', title: company.name ? 'Marketing' : 'Marketing & Vertrieb', host: '', time: '', note: '' }, design: { number: '2.14', people: 'Anna Schmidt\nJonas Weber', showLogo: true, showStatus: false, template: '' } });

export function renderDesign() {
  $('#company-name').value = company.name;
  $('#logo-threshold').value = company.logoMode.threshold;
  $('#logo-dither').checked = company.logoMode.dither; $('#logo-invert').checked = company.logoMode.invert;
  $('#company-font').value = company.font;
  $('#logo-state').textContent = company.logo ? 'Logo hinterlegt. Es erscheint in Schwarzweiß auf jedem Schild.' : 'Noch kein Logo. Datei hierher ziehen oder auswählen.';
  $('#logo-remove').classList.toggle('hidden', !company.logo);
  $('#logo-image').classList.toggle('hidden', !company.logo);
  if (company.logo) $('#logo-image').src = company.logo; else $('#logo-image').removeAttribute('src');
  $('#template-grid').innerHTML = TEMPLATES.map(t => `<button type="button" class="template-card${company.template === t.id ? ' active' : ''}" data-template-choice="${t.id}" aria-pressed="${company.template === t.id}"><canvas class="eink-canvas" width="250" height="122" data-sign="sample" data-template="${t.id}"></canvas><strong>${t.name}</strong><span>${t.hint}</span></button>`).join('');
  const room = sample();
  paintCanvases($('#view-design'), () => room);
}
export function templateOptions(selected) {
  return TEMPLATES.map(t => `<button type="button" class="template-option${selected === t.id ? ' active' : ''}" data-template-option="${t.id}" title="${t.name} · ${t.hint}" aria-pressed="${selected === t.id}"><canvas class="eink-canvas" width="250" height="122" data-sign="editor" data-template="${t.id}"></canvas><span>${t.name}</span></button>`).join('');
}
export function initDesign({ onChange, toast, applyToAll }) {
  changed = () => { touch(); renderDesign(); onChange(); };
  $('#company-font').innerHTML = FONTS.map(font => `<option>${font}</option>`).join('');
  $('#company-name').addEventListener('input', event => { company.name = event.target.value.slice(0, 60); touch(); paintCanvases($('#view-design'), sample); onChange(); });
  $('#company-font').addEventListener('change', event => { company.font = event.target.value; changed(); });
  $('#logo-threshold').addEventListener('input', event => { company.logoMode.threshold = Number(event.target.value); touch(); paintCanvases($('#view-design'), sample); });
  $('#logo-threshold').addEventListener('change', () => changed());
  $('#logo-dither').addEventListener('change', event => { company.logoMode.dither = event.target.checked; changed(); });
  $('#logo-invert').addEventListener('change', event => { company.logoMode.invert = event.target.checked; changed(); });
  const take = async file => {
    if (!file) return;
    try { company.logo = await readLogo(file); await refreshLogo(); changed(); toast('Logo übernommen. So sieht es auf den Schildern aus.'); }
    catch (error) { toast(error.message, true); }
  };
  $('#logo-pick').addEventListener('click', () => $('#logo-file').click());
  $('#logo-file').addEventListener('change', event => { void take(event.target.files[0]); event.target.value = ''; });
  const drop = $('#logo-drop');
  for (const type of ['dragenter', 'dragover']) drop.addEventListener(type, event => { event.preventDefault(); drop.classList.add('over'); });
  for (const type of ['dragleave', 'drop']) drop.addEventListener(type, event => { event.preventDefault(); drop.classList.remove('over'); });
  drop.addEventListener('drop', event => void take(event.dataTransfer?.files?.[0]));
  $('#logo-remove').addEventListener('click', async () => { company.logo = null; await refreshLogo(); changed(); });
  $('#template-grid').addEventListener('click', event => {
    const card = event.target.closest('[data-template-choice]'); if (!card) return;
    company.template = card.dataset.templateChoice; changed();
  });
  $('#apply-design-all').addEventListener('click', () => applyToAll());
}

// ---- Raumliste aus einer Tabelle (CSV) --------------------------------------------------------
// Spalten: Raum; Nummer; Bereich; Personen (mit | getrennt); Schild-ID (optional). Trennzeichen ; , oder Tab.
export function parseRoomCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) throw new Error('Die Datei ist leer.');
  const separator = [';', '\t', ','].sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0];
  const cells = line => { // einfache CSV-Zerlegung mit Anführungszeichen
    const out = []; let cell = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) { if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch; }
      else if (ch === '"') quoted = true; else if (ch === separator) { out.push(cell.trim()); cell = ''; } else cell += ch;
    }
    out.push(cell.trim()); return out;
  };
  let rows = lines.map(cells);
  if (/^(raum|name|bezeichnung)/i.test(rows[0][0])) rows = rows.slice(1);
  if (rows.length > 256) throw new Error('Höchstens 256 Räume je Datei.');
  return rows.filter(row => row[0]).map(row => ({
    name: row[0].slice(0, 40), number: (row[1] || '').slice(0, 12), floor: (row[2] || '').slice(0, 40),
    people: (row[3] || '').split('|').map(s => s.trim()).filter(Boolean).join('\n').slice(0, 200),
    id: /^\d+$/.test(row[4] || '') ? Number(row[4]) : null,
  }));
}
// Montageliste: welches Schild (Nummer) gehört an welche Tür.
export function printList(rooms, workspace) {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const sorted = [...rooms].sort((a, b) => (a.floor || '').localeCompare(b.floor || '', 'de') || a.content.name.localeCompare(b.content.name, 'de'));
  $('#print-area').innerHTML = `<h1>${escape(company.name || workspace)} · Montageliste</h1><p>${new Date().toLocaleDateString('de-DE')} · ${sorted.length} Schilder. Die Schild-Nummer erscheint groß auf dem Schild, wenn in Workbadge Rooms „Nummern anzeigen“ aktiv ist.</p><table><thead><tr><th>Schild-Nr.</th><th>Raum</th><th>Raumnummer</th><th>Bereich / Etage</th><th>Montiert</th></tr></thead><tbody>${sorted.map(room => `<tr><td>${isDraft(room) ? '–' : room.id}</td><td>${escape(room.content.name)}</td><td>${escape(room.design?.number || '')}</td><td>${escape(room.floor)}</td><td>☐</td></tr>`).join('')}</tbody></table>`;
  window.print();
}
