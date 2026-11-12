export const VERSION = 1;
export const MAX_PAYLOAD = 200;
export const STATUSES = { free: 'Frei', busy: 'Belegt', reserved: 'Reserviert' };
export const FIELD_LIMITS = { name: 40, title: 64, host: 40, time: 24, note: 80 };
const encoder = new TextEncoder();
export function validateContent(content) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) throw new Error('Display-Inhalt fehlt.');
  if (!Object.hasOwn(STATUSES, content.status)) throw new Error('Ungültiger Raumstatus.');
  const result = { status: content.status };
  for (const [field, limit] of Object.entries(FIELD_LIMITS)) {
    const value = content[field] ?? '';
    if (typeof value !== 'string') throw new Error(`Ungültiger Text: ${field}`);
    if (value.includes('\0')) throw new Error(`${field}: NUL-Zeichen sind nicht erlaubt.`);
    if (encoder.encode(value).length > limit) throw new Error(`${field}: maximal ${limit} UTF-8-Bytes.`);
    result[field] = value;
  }
  if (!result.name.trim()) throw new Error('Bitte einen Raumnamen eingeben.');
  const bytes = encoder.encode(JSON.stringify(result)).length;
  if (bytes > MAX_PAYLOAD) throw new Error(`Inhalt zu lang: ${bytes}/${MAX_PAYLOAD} Bytes. Bitte Texte kürzen.`);
  return result;
}
export function deviceId(value) {
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isInteger(number) || number < 1 || number > 65534) throw new Error('Display-ID muss zwischen 1 und 65534 liegen.');
  return number;
}
export const BROADCAST = 65535;
export const IMAGE = Object.freeze({ width: 250, height: 122, row: 32, bytes: 3904, firstData: 191, nextData: 196, maxPacked: 4096, maxParts: 22 });
// Format 2 (ab Firmware 0.8): 800 × 480 für den TRMNL 7,5″ – Zeilen mit der Vorzeile XOR-verknüpft, dann PackBits.
export const LARGE_IMAGE = Object.freeze({ width: 800, height: 480, row: 100, bytes: 48000, maxPacked: 24576, maxParts: 128 });
const u16 = value => Number.isInteger(value) && value >= 0 && value <= 0xffff;
// extra: zusätzliche Felder für „image“ (image, index, total, length, crc, data), „identify“ (on) und relay.
export function command(op, id, device, content, extra = {}) {
  if (!Number.isInteger(id) || id < 1 || id > 0xffffffff) throw new Error('Ungültige Nachrichten-ID.');
  if (!['hello', 'status', 'update', 'ping', 'configure', 'image', 'identify', 'ota_begin', 'ota_data', 'ota_start', 'ota_stop'].includes(op)) throw new Error('Unbekannter Befehl.');
  const result = { v: VERSION, op, id };
  if (['update', 'ping', 'configure', 'image'].includes(op)) result.device = deviceId(device);
  if (op === 'update') result.content = validateContent(content);
  if (op === 'identify') { result.device = device === BROADCAST ? BROADCAST : deviceId(device); result.on = extra?.on !== false; }
  if (op === 'image') {
    const { image, index, total, length, crc, data } = extra || {}, format = extra?.format ?? 1, limits = format === 2 ? LARGE_IMAGE : IMAGE;
    if (format !== 1 && format !== 2) throw new Error('Unbekanntes Bildformat.');
    if (!u16(image) || !Number.isInteger(total) || total < 1 || total > limits.maxParts || !Number.isInteger(index) || index < 0 || index >= total) throw new Error('Ungültiger Bildteil.');
    if (!Number.isInteger(length) || length < 1 || length > limits.maxPacked || !u16(crc)) throw new Error('Ungültige Bildlänge oder Prüfsumme.');
    if (typeof data !== 'string' || !data.length || data.length > 264 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new Error('Ungültige Bilddaten.');
    Object.assign(result, { image, index, total, length, crc, data });
    if (format === 2) result.format = 2;
  }
  // Firmware-Update der Schilder: Firmware in den Sender legen (ota_begin/ota_data), dann verteilen (ota_start).
  if (op === 'ota_begin') {
    if (!Number.isInteger(extra?.size) || extra.size < 1024 || extra.size > 3342336 || !u16(extra.crc)) throw new Error('Ungültige Firmware-Größe.');
    result.size = extra.size; result.crc = extra.crc;
  }
  if (op === 'ota_data') {
    if (!Number.isInteger(extra?.offset) || extra.offset < 0 || extra.offset > 3342336) throw new Error('Ungültige Firmware-Position.');
    if (typeof extra.data !== 'string' || !extra.data.length || extra.data.length > 512 || !/^[A-Za-z0-9+/]+={0,2}$/.test(extra.data)) throw new Error('Ungültige Firmware-Daten.');
    result.offset = extra.offset; result.data = extra.data;
  }
  if (op === 'ota_start') {
    if (!['wifi', 'lora'].includes(extra?.mode)) throw new Error('Unbekannte Update-Art.');
    result.device = device === BROADCAST ? BROADCAST : deviceId(device); result.mode = extra.mode;
  }
  // TRMNL 7,5″ (ab 0.8): WLAN-Zugang und PC-Adresse zusammen mit der Schild-ID speichern. Leerer Name = WLAN aus.
  if (op === 'configure' && extra?.wifi_ssid !== undefined) {
    const text = (value, max, label) => { if (typeof value !== 'string' || new TextEncoder().encode(value).length > max) throw new Error(`${label} ist zu lang (höchstens ${max} Zeichen).`); return value; };
    result.wifi_ssid = text(extra.wifi_ssid, 32, 'WLAN-Name');
    result.wifi_password = text(extra.wifi_password ?? '', 64, 'WLAN-Passwort');
    result.server = text(extra.server ?? '', 80, 'PC-Adresse');
    if (result.wifi_password && result.wifi_password.length < 8) throw new Error('Das WLAN-Passwort hat weniger als 8 Zeichen.');
    if (result.wifi_ssid && !result.server) throw new Error('Bitte die Adresse des PCs angeben.');
    if (extra.interval !== undefined) { if (!Number.isInteger(extra.interval) || extra.interval < 20 || extra.interval > 3600) throw new Error('Abfrage-Abstand: 20 bis 3600 Sekunden.'); result.interval = extra.interval; }
  }
  if (extra?.relay === true && ['update', 'ping', 'image', 'identify', 'ota_start'].includes(op)) result.relay = true;
  return result;
}
// PackBits: Kopfbyte n: 0…127 → n+1 Bytes wörtlich; 129…255 → nächstes Byte (257−n)-mal. Wie in firmware/include/protocol.h.
export function packBits(bytes) {
  const out = []; let i = 0;
  while (i < bytes.length) {
    let run = 1; while (i + run < bytes.length && run < 128 && bytes[i + run] === bytes[i]) run++;
    if (run >= 3) { out.push(257 - run, bytes[i]); i += run; continue; }
    const start = i; let n = 0;
    while (i < bytes.length && n < 128) {
      if (i + 2 < bytes.length && bytes[i] === bytes[i + 1] && bytes[i] === bytes[i + 2]) break;
      i++; n++;
    }
    out.push(n - 1); for (let k = start; k < i; k++) out.push(bytes[k]);
  }
  return Uint8Array.from(out);
}
export function unpackBits(bytes, capacity = IMAGE.bytes) {
  const out = new Uint8Array(capacity); let i = 0, o = 0;
  while (i < bytes.length) {
    const n = bytes[i++];
    if (n < 128) { const count = n + 1; if (i + count > bytes.length || o + count > capacity) throw new Error('Bilddaten beschädigt'); out.set(bytes.subarray(i, i + count), o); i += count; o += count; }
    else if (n > 128) { const count = 257 - n; if (i >= bytes.length || o + count > capacity) throw new Error('Bilddaten beschädigt'); out.fill(bytes[i++], o, o + count); o += count; }
    else throw new Error('Bilddaten beschädigt');
  }
  return out.subarray(0, o);
}
function base64(bytes) { let text = ''; for (const byte of bytes) text += String.fromCharCode(byte); return btoa(text); }
// 800 × 480: jede Zeile mit der Zeile darüber XOR-verknüpfen (und zurück). Wie unpackLarge() in protocol.h.
export function rowDelta(bits, row = LARGE_IMAGE.row) { const out = Uint8Array.from(bits); for (let i = out.length - 1; i >= row; i--) out[i] ^= out[i - row]; return out; }
export function rowUndelta(bits, row = LARGE_IMAGE.row) { const out = Uint8Array.from(bits); for (let i = row; i < out.length; i++) out[i] ^= out[i - row]; return out; }
// Zerlegt ein Schildbild in die Teile, die einzeln per Funk gesendet werden:
// 3904 Bytes (250 × 122, Format 1) oder 48 000 Bytes (800 × 480, Format 2, TRMNL ab Firmware 0.8).
export function imageParts(bits, imageId) {
  const large = bits instanceof Uint8Array && bits.length === LARGE_IMAGE.bytes;
  if (!(bits instanceof Uint8Array) || (bits.length !== IMAGE.bytes && !large)) throw new Error('Das Schildbild muss 250 × 122 oder 800 × 480 Pixel haben.');
  if (!u16(imageId)) throw new Error('Ungültige Bild-ID.');
  const packed = packBits(large ? rowDelta(bits) : bits);
  if (packed.length > (large ? LARGE_IMAGE.maxPacked : IMAGE.maxPacked)) throw new Error('Das Bild ist zu unruhig für die Funkübertragung. Bitte „Raster“ beim Logo ausschalten.');
  const total = packed.length <= IMAGE.firstData ? 1 : 1 + Math.ceil((packed.length - IMAGE.firstData) / IMAGE.nextData);
  const crc = crc16(packed), parts = [];
  for (let index = 0, offset = 0; index < total; index++) {
    const size = index === 0 ? IMAGE.firstData : IMAGE.nextData;
    parts.push({ image: imageId, index, total, length: packed.length, crc, data: base64(packed.subarray(offset, offset + size)), ...(large ? { format: 2 } : {}) });
    offset += size;
  }
  return parts;
}
export class LineDecoder {
  constructor(limit = 2048) { this.buffer = ''; this.limit = limit; this.discard = false; this.decoder = new TextDecoder(); }
  push(chunk) {
    const lines = [];
    for (const char of typeof chunk === 'string' ? chunk : this.decoder.decode(chunk, { stream: true })) {
      if (char === '\n') {
        if (!this.discard && this.buffer.trim()) { try { const event = JSON.parse(this.buffer); if (event && typeof event === 'object' && !Array.isArray(event)) lines.push(event); } catch { /* ESP boot messages are not protocol data. */ } }
        this.buffer = ''; this.discard = false;
      } else if (!this.discard) {
        this.buffer += char;
        if (this.buffer.length > this.limit) { this.buffer = ''; this.discard = true; }
      }
    }
    return lines;
  }
}
export function crc16(bytes) {
  let crc = 0xffff;
  for (const byte of bytes) { crc ^= byte << 8; for (let i = 0; i < 8; i++) crc = ((crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff; }
  return crc;
}
// WB1 reference wire format. Not a claim of compatibility with existing displays.
export function encodeFrame({ type = 1, network = 1, destination, source = 0, session, sequence, payload = new Uint8Array() }) {
  if (payload.length > MAX_PAYLOAD) throw new Error('Payload zu groß');
  const bytes = new Uint8Array(22 + payload.length), view = new DataView(bytes.buffer);
  bytes.set([0x57, 0x42, 1, type]);
  view.setUint16(4, network, true); view.setUint16(6, destination, true); view.setUint16(8, source, true);
  view.setUint32(10, session, true); view.setUint32(14, sequence, true); view.setUint16(18, payload.length, true);
  bytes.set(payload, 20); view.setUint16(bytes.length - 2, crc16(bytes.subarray(0, -2)), true);
  return bytes;
}
export function decodeFrame(bytes) {
  if (bytes.length < 22 || bytes.length > 222 || bytes[0] !== 0x57 || bytes[1] !== 0x42 || bytes[2] !== 1) throw new Error('Ungültiges Paket');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), length = view.getUint16(18, true);
  if (length + 22 !== bytes.length || view.getUint16(bytes.length - 2, true) !== crc16(bytes.subarray(0, -2))) throw new Error('Prüfsumme oder Länge ungültig');
  return { type: bytes[3], network: view.getUint16(4, true), destination: view.getUint16(6, true), source: view.getUint16(8, true), session: view.getUint32(10, true), sequence: view.getUint32(14, true), payload: bytes.slice(20, -2) };
}
