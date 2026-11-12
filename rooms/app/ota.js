// Workbadge Rooms 0.8 – Schild-Firmware per Funk verteilen (WLAN des Senders oder LoRa-Rundruf).
import { crc16, BROADCAST } from './protocol.js';

const $ = selector => document.querySelector(selector);
const FILE = 'firmware/wireless-paper12-receiver/firmware.bin', CHUNK = 384;
let firmware = null, running = false, mode = null, api = null, done = new Set();

async function loadFirmware() {
  const response = await fetch(FILE);
  if (!response.ok) throw new Error('Die Schild-Firmware liegt dem Programm nicht bei.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 100000 || bytes[0] !== 0xe9) throw new Error('Die beiliegende Schild-Firmware ist ungültig.');
  return { bytes, crc: crc16(bytes) };
}
function base64(bytes) { let text = ''; for (const byte of bytes) text += String.fromCharCode(byte); return btoa(text); }
function status(text, percent = null) {
  $('#ota-status').textContent = text;
  const bar = $('#ota-progress'); bar.classList.toggle('hidden', percent === null); if (percent !== null) bar.value = percent;
}
// Die Schild-Firmware einmal per USB in den Sender legen (bleibt dort bis zu dessen Neustart).
async function ensureStored() {
  firmware ??= await loadFirmware();
  const info = await api.gateway.request('status');
  if (info.ota_stored && info.ota_size === firmware.bytes.length && info.ota_crc === firmware.crc) return;
  status('Schild-Firmware wird in den Sender geladen …', 0);
  await api.gateway.request('ota_begin', undefined, undefined, 30000, { size: firmware.bytes.length, crc: firmware.crc });
  for (let offset = 0; offset < firmware.bytes.length; offset += CHUNK) {
    if (!running) throw new Error('Abgebrochen.');
    await api.gateway.request('ota_data', undefined, undefined, 15000, { offset, data: base64(firmware.bytes.subarray(offset, offset + CHUNK)) });
    if (offset % (CHUNK * 20) === 0) status(`Schild-Firmware wird in den Sender geladen … ${Math.round(offset / firmware.bytes.length * 100)} %`, offset / firmware.bytes.length * 100);
  }
}
async function start(kind) {
  if (running) return;
  if (kind === 'lora' && !confirm('Das Update über LoRa-Funk dauert mehrere Stunden (gesetzliche Sendezeit-Grenze). Sender und PC müssen so lange eingeschaltet bleiben. Jetzt starten?')) return;
  running = true; mode = kind; done = new Set(); renderOta();
  try {
    await ensureStored();
    const relay = $('#ota-relay').checked;
    const event = await api.gateway.request('ota_start', BROADCAST, undefined, 10000, { mode: kind, relay });
    if (kind === 'wifi') status('Der Sender hat sein Update-WLAN geöffnet. Die Schilder holen die Firmware nacheinander ab und starten neu (etwa 1–2 Minuten).');
    else status(`LoRa-Übertragung läuft: 0 von ${event.total} Teilen.`, 0);
    api.addLog(kind === 'wifi' ? 'Firmware-Update über WLAN gestartet' : 'Firmware-Update über LoRa gestartet', relay ? 'auch über Nachbarschilder' : 'alle Schilder in Reichweite');
  } catch (error) { running = false; mode = null; status(`Update nicht gestartet: ${error.message}`); api.toast(error.message, true); }
  renderOta();
}
async function stop() {
  const wasRunning = running; running = false; mode = null;
  try { if (api.gateway.ready) await api.gateway.request('ota_stop', undefined, undefined, 5000); } catch { /* Sender schon weg */ }
  if (wasRunning) status('Update beendet. Schilder, die noch nicht fertig waren, behalten ihre bisherige Firmware.');
  renderOta();
}
export function handleOtaEvent(event) {
  if (event.event !== 'ota') return false;
  const sign = event.device ? `Schild ${event.device}` : '';
  if (event.stage === 'wifi_served') status(`${event.served} ${event.served === 1 ? 'Schild hat' : 'Schilder haben'} die Firmware abgeholt und ${event.served === 1 ? 'startet' : 'starten'} neu. Das Update-WLAN schließt sich nach einigen Minuten von selbst.`);
  if (event.stage === 'wifi_stopped' && mode === 'wifi') { running = false; mode = null; status('Update-WLAN geschlossen. Unter „Schilder in Funkreichweite“ steht bei jedem Schild seine Firmware. Schilder ohne „Firmware 0.6“ waren außer WLAN-Reichweite – für sie den LoRa-Weg nutzen.'); }
  if (event.stage === 'lora_progress') {
    const minutes = Math.round((event.total - event.sent) * 3.9 / 60);
    status(`LoRa-Übertragung${event.round ? ` · Nachsenden Runde ${event.round}` : ''}: ${event.sent} von ${event.total} Teilen${minutes > 1 ? ` · noch etwa ${minutes >= 90 ? `${(minutes / 60).toFixed(1)} Std.` : `${minutes} Min.`}` : ''}`, event.sent / event.total * 100);
  }
  if (event.stage === 'lora_round') { status(`Fehlende Teile werden nachgesendet (${event.missing}) …`, 0); api.addLog('Firmware-Update: Nachsenden', `${event.missing} Teile fehlen noch bei mindestens einem Schild`); }
  if (event.stage === 'sign_missing') api.addLog(`${sign}: ${event.missing}${event.missing >= 99 ? '+' : ''} Teile fehlen noch`, 'werden nachgesendet');
  if (event.stage === 'sign_done') { done.add(event.device); api.addLog(`${sign}: Firmware vollständig`, 'geprüft, startet neu'); if (mode === 'lora') status(`${done.size} ${done.size === 1 ? 'Schild ist' : 'Schilder sind'} fertig und ${done.size === 1 ? 'startet' : 'starten'} neu …`); }
  if (event.stage === 'lora_finished') { running = false; mode = null; status(event.missing ? `Übertragung beendet. ${done.size} Schilder fertig; einzelne Schilder hatten bis zuletzt Lücken – bitte noch einmal starten.` : `Übertragung abgeschlossen: ${done.size} ${done.size === 1 ? 'Schild hat' : 'Schilder haben'} die neue Firmware bestätigt.`); api.addLog('Firmware-Update über LoRa beendet', `${done.size} Schilder bestätigt`); }
  if (event.stage === 'failed') { running = false; mode = null; status('Der Sender konnte die Firmware nicht lesen. Bitte erneut starten.'); }
  renderOta();
  return true;
}
export function renderOta() {
  if (!api) return;
  const info = api.gateway.info, able = api.gateway.ready && info?.ota === true;
  if (!api.gateway.ready && running) { running = false; mode = null; status('Verbindung zum Sender getrennt – das Update wurde unterbrochen.'); }
  $('#ota-wifi').disabled = !able || running; $('#ota-lora').disabled = !able || running;
  $('#ota-stop').classList.toggle('hidden', !running);
  $('#ota-hint').textContent = able ? '' : api.gateway.ready ? 'Dafür braucht der Sender Firmware 0.6 (einmalig per USB unter „Schilder einrichten“).' : 'Dafür zuerst den Sender verbinden.';
}
export function initOta(options) {
  api = options;
  $('#ota-wifi').addEventListener('click', () => start('wifi'));
  $('#ota-lora').addEventListener('click', () => start('lora'));
  $('#ota-stop').addEventListener('click', stop);
  renderOta();
}
