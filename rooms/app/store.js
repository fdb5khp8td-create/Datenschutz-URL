import { validateContent, deviceId, STATUSES, FIELD_LIMITS } from './protocol.js';
import { displayType } from './displays.js';
import { TEMPLATES, FONTS } from './render.js';
export const STORAGE_KEY = 'workbadge.rooms.v1';
// Räume aus einer importierten Liste ohne Schild bekommen vorläufige IDs ab hier (Schilder liegen ab Werk bei 1000–60999).
export const DRAFT_ID_START = 61000;
const text = (value, limit) => typeof value === 'string' ? value.slice(0, limit) : '';
export function defaultCompany() { return { name: '', logo: null, logoMode: { threshold: 150, dither: false, invert: false }, font: 'Segoe UI', template: 'klassisch' }; }
export function readCompany(value) {
  const result = defaultCompany();
  if (!value || typeof value !== 'object') return result;
  result.name = text(value.name, 60);
  if (typeof value.logo === 'string' && value.logo.startsWith('data:image/') && value.logo.length <= 400000) result.logo = value.logo;
  const mode = value.logoMode || {};
  if (Number.isFinite(mode.threshold)) result.logoMode.threshold = Math.min(250, Math.max(5, Math.round(mode.threshold)));
  result.logoMode.dither = mode.dither === true; result.logoMode.invert = mode.invert === true;
  if (FONTS.includes(value.font)) result.font = value.font;
  if (TEMPLATES.some(t => t.id === value.template)) result.template = value.template;
  return result;
}
// Gestaltung je Raum. template '' = Vorlage aus dem Firmen-Design.
export function readDesign(value) {
  const d = value && typeof value === 'object' ? value : {};
  return { template: TEMPLATES.some(t => t.id === d.template) ? d.template : '', number: text(d.number, 12), people: text(d.people, 200), showLogo: d.showLogo !== false, showStatus: d.showStatus === true };
}
export function validateRooms(value) {
  if (!Array.isArray(value) || value.length > 256) throw new Error('Eine Sicherung darf höchstens 256 Räume enthalten.');
  const ids = new Set();
  return value.map(room => {
    if (!room || typeof room !== 'object') throw new Error('Ungültiger Raum.');
    const id = deviceId(room.id);
    if (ids.has(id)) throw new Error(`Display-ID ${id} ist doppelt vergeben.`);
    ids.add(id);
    if (typeof room.floor !== 'string' || room.floor.length > 40) throw new Error('Ungültiger Bereich.');
    // Drafts may exceed the radio budget; enforce per-field limits but allow editing offline.
    if (!room.content || !Object.hasOwn(STATUSES, room.content.status)) throw new Error('Ungültiger Inhalt.');
    const content = { status: room.content.status };
    for (const [field, limit] of Object.entries(FIELD_LIMITS)) {
      if (typeof room.content[field] !== 'string' || [...room.content[field]].length > limit) throw new Error(`Ungültiges Feld: ${field}`);
      content[field] = room.content[field];
    }
    if (!content.name.trim()) throw new Error('Raumname fehlt.');
    const result = { id, floor: room.floor, displayType: displayType(room.displayType), content, design: readDesign(room.design) };
    if (typeof room.sent === 'string' && /^[0-9a-f]{8}$/.test(room.sent)) result.sent = room.sent;
    return result;
  });
}
export function readBackup(text) {
  if (text.length > 512000) throw new Error('Sicherungsdatei ist zu groß.');
  const data = JSON.parse(text);
  if (data.version !== 1 || typeof data.workspace !== 'string' || data.workspace.length > 40) throw new Error('Unbekanntes Sicherungsformat.');
  return { version: 1, workspace: data.workspace, rooms: validateRooms(data.rooms), company: readCompany(data.company) };
}
export function demoRooms() {
  return [
    [101, 'Besprechung Elbe', 'Erdgeschoss', 'busy', 'Design Weekly', 'Design-Team', '10:00 – 11:00', '', '0.12', '', 'klassisch', true],
    [102, 'Atelier', 'Erdgeschoss', 'free', 'Platz für neue Ideen', '', '', '', '0.14', '', 'zentriert', false],
    [103, 'Geschäftsführung', '1. Obergeschoss', 'free', '', '', '', '', '1.01', 'Dr. Katrin Möller\nSören Brandt', 'personen', false],
    [104, 'Fokusraum', '1. Obergeschoss', 'free', 'Bitte leise sein', '', '', '', '1.07', '', 'balken', true],
    [105, 'Buchhaltung', '2. Obergeschoss', 'free', 'Finanzen & Controlling', '', '', '', '2.03', 'Jürgen Weiß\nAylin Özdemir', 'kopf', false],
    [106, 'Labor Nord', '2. Obergeschoss', 'reserved', 'Zutritt nur mit Schutzbrille', '', '', '', '2.11', '', 'balken', true],
  ].map(([id, name, floor, status, title, host, time, note, number, people, template, showStatus]) => ({ id, floor, displayType: 'wirelesspaper12', content: validateContent({ status, name, title, host, time, note }), design: readDesign({ number, people, template, showStatus }) }));
}
