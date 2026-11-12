export class NativeSerialProvider {
  constructor(api) { this.api = api; this.path = null; }
  async requestPort() {
    const api = this.api;
    let controller, ended = false;
    const unsubscribe = api.onSerial(data => { if (!ended) controller.enqueue(new TextEncoder().encode(data)); });
    const readable = new ReadableStream({ start(value) { controller = value; }, cancel() { ended = true; unsubscribe(); } });
    const removeState = api.onState(state => { if (state.phase === 'disconnected' && !ended) { ended = true; controller.close(); } });
    try {
      const result = await api.connect(this.path);
      const writable = new WritableStream({ write(bytes) { return api.write(new TextDecoder().decode(bytes)); } });
      return {
        readable, writable, open: async () => {},
        getInfo: () => ({ usbVendorId: result.port.vid, usbProductId: result.port.pid }),
        async close() { ended = true; unsubscribe(); removeState(); await api.disconnect(); },
      };
    } catch (error) { ended = true; unsubscribe(); removeState(); throw error; }
  }
}

export async function installDevice({ api, gateway, connect, path, role, device }) {
  if (!Number.isInteger(device) || device < 1 || device > 65534) throw new Error('Schild-ID muss zwischen 1 und 65534 liegen.');
  if (!['gateway', 'receiver'].includes(role)) throw new Error('Ungültige Verwendung.');
  const result = await api.setup({ path, role });
  await connect();
  if (!gateway.ready || !gateway.info?.local_display || gateway.info.display_type !== 'wirelesspaper12' || gateway.info.role !== role) throw new Error('Firmware installiert, aber die Verbindung zum gewählten Profil ist noch nicht bestätigt. Bitte erneut verbinden.');
  const info = await gateway.request('configure', device);
  if (info.device !== device) throw new Error('Die Schild-ID wurde nicht bestätigt. Bitte die Geräte-ID erneut speichern.');
  gateway.info = info;
  return { ...result, device };
}

export function initDesktopPanel({ gateway, connect, renderConnection }) {
  const api = globalThis.workbadgeDesktop;
  if (!api) return;
  const $ = selector => document.querySelector(selector);
  const panel = $('#desktop-panel'); panel.classList.remove('hidden');
  const nav = $('#native-nav'); nav.classList.remove('hidden');
  function showSetup() {
    document.body.classList.add('setup-mode');
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    nav.classList.add('active'); $('#breadcrumb').textContent = 'Schilder per USB einrichten';
  }
  nav.addEventListener('click', showSetup);
  document.querySelectorAll('[data-view]').forEach(el => el.addEventListener('click', () => { document.body.classList.remove('setup-mode'); nav.classList.remove('active'); }));
  // Start auf der Übersicht; die Einrichtung ist über die Seitenleiste und die geführten Schritte erreichbar.
  globalThis.workbadgeShowSetup = showSetup;
  $('.local-pill').textContent = 'Desktop · USB automatisch';
  $('.local-tag > span:last-child').textContent = `v${api.version}`;
  $('.bottom-note > span:last-child').textContent = 'Deine Raumdaten bleiben auf diesem Computer. Inhalte gehen direkt über USB, LoRa oder (TRMNL) über dein WLAN.';
  const helpSteps = document.querySelectorAll('#help-dialog .setup-steps li');
  const help = [
    ['Sender einrichten', 'Ein Wireless Paper per USB anstecken und unter „Schilder per USB einrichten“ als Sender einrichten. Er bleibt am PC angeschlossen; das Programm verbindet sich automatisch.'],
    ['Schilder einrichten', 'Jedes weitere Schild einmal als Raumschild einrichten – mehrere gleichzeitig per USB-Hub geht auch. Danach braucht es kein Kabel mehr. Vor dem Funkbetrieb die Antenne anschließen.'],
    ['Schilder einschalten', 'Eingeschaltete Schilder suchen den Sender von selbst. Auf dem Display steht erst „Suche Sender …“, dann „Mit Sender verbunden“ und groß die Nummer.'],
    ['Räume zuweisen', 'In der Übersicht erscheint jedes neue Schild gelb mit seiner Nummer. Nummer an der Tür ablesen und den Raum zuweisen.'],
    ['Inhalte senden', 'Raum bearbeiten und „Speichern & senden“ – oder „Alle senden“. Unter „Übertragungen“ stehen die Bestätigungen.'],
  ];
  helpSteps.forEach((el, i) => { el.querySelector('strong').textContent = help[i][0]; el.querySelector('p').textContent = help[i][1]; });
  $('#firmware-installer').classList.add('hidden');
  let batchBusy = false, batchRows = new Map();
  let ports = [], busy = false, operationBusy = false, polling = false, attempted = '', latest = {}, logs = [], history = [];
  try { const saved = JSON.parse(localStorage.getItem('workbadge-device-history') || '[]'); if (Array.isArray(saved)) history = saved.filter(item => Number.isInteger(item.device) && ['gateway', 'receiver', 'trmnl75'].includes(item.role) && typeof item.at === 'number').slice(0, 50); } catch {}
  function renderHistory() {
    $('#native-history-empty').classList.toggle('hidden', history.length > 0);
    $('#native-history-list').replaceChildren(...history.slice(0, 8).map(item => {
      const row = document.createElement('div'); row.className = 'native-history-row';
      for (const value of [`ID ${item.device}`, item.role === 'gateway' ? 'USB-Gateway + Display' : item.role === 'trmnl75' ? 'TRMNL 7,5″ · WLAN' : 'LoRa-Raumschild', new Date(item.at).toLocaleString('de-DE'), item.update ? '✓ Firmware erneuert' : '✓ Eingerichtet']) { const cell = document.createElement('span'); cell.textContent = value; row.append(cell); }
      return row;
    }));
  }
  renderHistory();
  { let next = 101; while (history.some(item => item.device === next)) next++; if (next <= 65534) $('#native-device-id').value = next; }
  const provider = gateway.serial;
  const label = { idle: 'Bereit', connecting: 'Verbinden', ready: 'Verbunden', needs_setup: 'Einrichtung nötig', bootloader: 'Gerät vorbereiten', erase: 'Speicher vollständig löschen', write: 'Installieren', verify: 'Installation prüfen', restart: 'Neu starten', reconnect: 'Verbinden', disconnected: 'Getrennt', error: 'Hinweis' };
  function render() {
    const active = ['bootloader', 'erase', 'write', 'verify', 'restart', 'reconnect'].includes(latest.phase);
    busy = operationBusy || batchBusy || latest.busy || active;
    $('#native-phase').textContent = label[latest.phase] || 'Bereit';
    $('#native-message').textContent = latest.message || (ports.length ? 'USB-Gerät gefunden. Verbindung wird automatisch geprüft.' : 'Wireless Paper über ein USB-Datenkabel anschließen. Ein normaler COM1-Anschluss ist kein erkanntes USB-Board.');
    $('#native-setup').disabled = busy || !ports.length || gateway.connecting;
    $('#native-update').disabled = busy || !ports.length || gateway.connecting;
    $('#native-refresh').disabled = busy;
    $('#native-port').disabled = busy;
    $('#native-role').disabled = busy || trmnl();
    applyModel();
    $('#native-model').disabled = busy;
    $('#native-device-id').disabled = busy;
    $('#native-next-id').disabled = busy;
    $('#native-cancel').classList.toggle('hidden', latest.phase !== 'bootloader' || !latest.method);
    $('#native-progress').classList.toggle('hidden', !active);
    $('#native-progress').value = Math.max(0, Math.min(100, latest.percent || 0));
    const order = { connecting: 0, bootloader: 0, erase: 1, write: 2, verify: 2, restart: 3, reconnect: 3, ready: 4 };
    document.querySelectorAll('[data-native-step]').forEach((el, i) => { el.classList.toggle('current', i === order[latest.phase]); el.classList.toggle('done', i < (order[latest.phase] ?? -1)); });
    renderBatch();
    if (!ports.length && !busy && latest.phase !== 'error') $('#native-message').textContent = 'Kein USB-ESP32 erkannt. Datenkabel und USB-Anschluss prüfen. COM1 allein ist kein erkanntes USB-Board.';
  }
  // ---- TRMNL 7,5″: WLAN-Zugang (Name und PC-Adresse merkt sich das Programm, das Passwort nicht) ----
  const trmnl = () => $('#native-model').value === 'trmnl75';
  try { const saved = JSON.parse(localStorage.getItem('workbadge-wifi') || '{}'); $('#wifi-ssid').value = saved.ssid || ''; $('#wifi-server').value = saved.server || ''; $('#wifi-interval').value = saved.interval || ''; } catch {}
  function wifiValues(required = true) {
    const wifi = { wifi_ssid: $('#wifi-ssid').value.trim(), wifi_password: $('#wifi-password').value, server: $('#wifi-server').value.trim() };
    if ($('#wifi-interval').value) wifi.interval = Number($('#wifi-interval').value);
    if (required && !wifi.wifi_ssid) throw new Error('Bitte den WLAN-Namen eintragen – sonst kann der TRMNL sein Bild nicht abholen.');
    if (wifi.wifi_ssid && !wifi.server) throw new Error('Bitte die Adresse dieses PCs eintragen (Vorschlag in der Liste).');
    if (wifi.wifi_password && wifi.wifi_password.length < 8) throw new Error('Das WLAN-Passwort hat weniger als 8 Zeichen.');
    try { localStorage.setItem('workbadge-wifi', JSON.stringify({ ssid: wifi.wifi_ssid, server: wifi.server, interval: $('#wifi-interval').value })); } catch {}
    return wifi;
  }
  function serverAddresses(info) {
    if (!info) return;
    const options = (info.addresses || []).map(address => `${address}:${info.port}`);
    $('#wifi-server-options').replaceChildren(...options.map(value => new Option(value, value)));
    if (!$('#wifi-server').value && options.length) $('#wifi-server').value = options[0];
    $('#wifi-hint').textContent = info.listening ? (options.length > 1 ? `Dieser PC hat mehrere Adressen – die aus dem WLAN der Schilder wählen.` : '') : info.error || '';
  }
  api.signs?.info().then(serverAddresses).catch(() => {});
  api.signs?.onInfo(serverAddresses);
  function applyModel() {
    const large = trmnl();
    $('#native-wifi').classList.toggle('hidden', !large);
    if (large) $('#native-role').value = 'receiver';
    const localTrmnl = gateway.ready && gateway.info?.display_type === 'trmnl75' && gateway.info.local_display;
    $('#wifi-apply').classList.toggle('hidden', !localTrmnl);
  }
  $('#native-model').addEventListener('change', () => { applyModel(); render(); });
  $('#wifi-apply').addEventListener('click', async () => {
    const button = $('#wifi-apply'); button.disabled = true;
    try {
      const info = await gateway.request('configure', gateway.info.device, undefined, 8000, wifiValues(false));
      gateway.info = info; $('#native-message').textContent = info.wifi ? `WLAN „${info.wifi_ssid}“ gespeichert. Das Schild holt sein Bild jetzt ab.` : 'WLAN im Schild ausgeschaltet.';
      renderConnection();
    } catch (error) { $('#native-message').textContent = error.message; }
    finally { button.disabled = false; }
  });
  const nextFreeId = (start, taken) => { let id = start; while (id <= 65534 && (taken.has(id) || history.some(item => item.device === id))) id++; return id; };
  function plannedJobs() {
    const role = $('#native-role').value, taken = new Set();
    let next = Number($('#native-device-id').value) || 101;
    return ports.map(port => {
      const row = batchRows.get(port.path) || {};
      if (row.selected === undefined) row.selected = true;
      if (row.selected) {
        if (!row.fixedId) { next = nextFreeId(next, taken); row.device = next; }
        taken.add(row.device); next = row.device + 1;
      } else if (row.result?.ok) row.device = row.result.device;
      batchRows.set(port.path, row);
      return { path: port.path, description: port.description, role: trmnl() ? 'trmnl75' : role, device: row.device, selected: row.selected };
    });
  }
  const batchKeep = () => $('#batch-mode').value === 'keep';
  const batchPhase = { identify: 'ID auslesen', bootloader: 'Vorbereiten', connecting: 'Verbinden', erase: 'Löschen', write: 'Installieren', verify: 'Prüfen', restart: 'Neustart', configure: 'ID speichern' };
  function renderBatch() {
    const panel = $('#batch-panel');
    const visible = ports.length >= 2 || batchBusy || [...batchRows.values()].some(row => row.result);
    panel.classList.toggle('hidden', !visible);
    if (!visible) return;
    const keep = batchKeep();
    $('#batch-intro').textContent = keep ? 'Alle ausgewählten Schilder bekommen die neueste Firmware. ID und Verwendung (Sender/Raumschild) werden vorher ausgelesen und danach wiederhergestellt.' : 'Alle angeschlossenen Schilder werden parallel gelöscht, mit der oben gewählten Verwendung installiert und bekommen fortlaufende IDs ab der Schild-ID.';
    $('#batch-mode').disabled = batchBusy;
    const jobs = batchBusy ? [...batchRows.entries()].filter(([, row]) => row.running !== undefined).map(([path, row]) => ({ path, device: row.device, selected: true, description: row.description || '' })) : plannedJobs();
    $('#batch-list').replaceChildren(...jobs.map(job => {
      const row = batchRows.get(job.path) || {};
      const el = document.createElement('div'); el.className = 'batch-row';
      const check = Object.assign(document.createElement('input'), { type: 'checkbox', checked: job.selected, disabled: batchBusy });
      check.addEventListener('change', () => { row.selected = check.checked; render(); });
      const name = document.createElement('span'); name.innerHTML = `<strong></strong><small></small>`; name.querySelector('strong').textContent = job.path; name.querySelector('small').textContent = job.description || '';
      const id = Object.assign(document.createElement('input'), { type: 'number', min: 1, max: 65534, value: keep ? (row.foundId ?? '') : job.device, placeholder: keep ? 'auto' : '', disabled: batchBusy || keep, title: keep ? 'ID wird vom Schild übernommen' : 'Schild-ID' });
      id.addEventListener('change', () => { row.device = Number(id.value); row.fixedId = true; render(); });
      const bar = Object.assign(document.createElement('progress'), { max: 100, value: row.percent || 0 });
      bar.classList.toggle('hidden', !batchBusy && !row.result);
      const status = document.createElement('span');
      status.textContent = row.result ? (row.result.ok ? `✓ ${row.result.update ? 'Firmware erneuert' : 'Fertig'} · ID ${row.result.device}` : `✗ ${row.result.message}`) : row.phase ? `${batchPhase[row.phase] || row.phase} …` : batchBusy ? 'Wartet …' : 'Bereit';
      status.className = row.result ? (row.result.ok ? 'ok' : 'err') : '';
      el.append(check, name, id, bar, status); return el;
    }));
    const count = jobs.filter(job => job.selected).length;
    $('#batch-setup').textContent = batchBusy ? 'Läuft …' : `${count} ${count === 1 ? 'Schild' : 'Schilder'} ${keep ? 'neu installieren' : 'einrichten'}`;
    $('#batch-setup').disabled = batchBusy || operationBusy || !count;
    $('#batch-cancel').classList.toggle('hidden', !batchBusy);
  }
  api.onBatch?.(event => {
    const row = batchRows.get(event.path); if (!row) return;
    if (event.phase) row.phase = event.phase;
    if (Number.isInteger(event.device_found)) row.foundId = event.device_found;
    if (event.kind === 'progress') row.percent = event.phase === 'write' ? event.percent : row.percent;
    if (event.phase === 'verify') row.percent = 100;
    if (event.phase === 'error' && event.message) row.result = { ok: false, message: event.message };
    renderBatch();
  });
  $('#batch-cancel').addEventListener('click', async () => { await api.cancel(); $('#native-message').textContent = 'Abbruch angefordert: Schilder, die schon gelöscht werden, laufen zu Ende.'; });
  $('#batch-setup').addEventListener('click', () => {
    const jobs = plannedJobs().filter(job => job.selected);
    if (batchKeep()) return runBatch(jobs.map(job => ({ ...job, keep: true })), true);
    const ids = jobs.map(job => job.device);
    if (ids.some(id => !Number.isInteger(id) || id < 1 || id > 65534) || new Set(ids).size !== ids.length) { $('#native-message').textContent = 'Bitte jedem Schild eine eigene ID zwischen 1 und 65534 geben.'; return; }
    const reused = ids.filter(id => history.some(item => item.device === id));
    if (!confirm(`${jobs.length} Schilder werden vollständig gelöscht und als ${jobs[0].role === 'gateway' ? 'USB-Gateway' : jobs[0].role === 'trmnl75' ? 'TRMNL 7,5″ (WLAN + LoRa)' : 'LoRa-Raumschild'} eingerichtet (IDs ${ids.join(', ')}).${reused.length ? `\n\nAchtung: ID ${reused.join(', ')} wurde schon einmal vergeben.` : ''}\n\nFortfahren?`)) return;
    return runBatch(jobs, false);
  });
  $('#native-update').addEventListener('click', () => {
    const path = provider.path || (ports.length === 1 ? ports[0].path : null);
    if (!path) { $('#native-message').textContent = 'Mehrere USB-Geräte angeschlossen: bitte oben das Gerät wählen oder unten „Firmware neu installieren · ID & Verwendung behalten“ für alle nutzen.'; return; }
    const port = ports.find(item => item.path === path);
    if (!batchRows.has(path)) batchRows.set(path, {});
    return runBatch([{ path, description: port?.description || '', keep: true }], true);
  });
  async function runBatch(jobs, keep) {
    if (!jobs.length) return;
    // TRMNL: WLAN-Zugang mitgeben (beim Erneuern optional – ohne Angabe muss er danach neu eingetragen werden).
    let wifi;
    try { if (trmnl()) wifi = wifiValues(!keep); } catch (error) { $('#native-message').textContent = error.message; $('#wifi-ssid').focus(); return; }
    if (wifi && !wifi.wifi_ssid) wifi = undefined;
    if (keep && !confirm(`${jobs.length === 1 ? 'Das Schild bekommt' : `${jobs.length} Schilder bekommen`} die neueste Firmware.\n\nID und Verwendung werden vorher ausgelesen und danach wiederhergestellt. Der angezeigte Inhalt wird zurückgesetzt und muss danach erneut gesendet werden.${trmnl() && !wifi ? '\n\nTRMNL: Ohne WLAN-Angaben oben muss das WLAN danach neu eingetragen werden.' : ''}\n\nFortfahren?`)) return;
    const ids = jobs.map(job => job.device);
    batchBusy = true;
    for (const job of jobs) Object.assign(batchRows.get(job.path), { running: true, phase: null, percent: 0, result: null, foundId: null, description: job.description });
    for (const [path, row] of batchRows) if (!jobs.some(job => job.path === path)) delete row.running;
    latest = { phase: 'batch', busy: true, message: `${jobs.length === 1 ? 'Schild wird' : `${jobs.length} Schilder werden`} ${keep ? 'mit neuer Firmware versehen' : 'parallel eingerichtet'}. USB-Kabel bitte nicht trennen.` }; $('#native-complete').classList.add('hidden'); render();
    try {
      await gateway.disconnect();
      const { results } = await api.setupMany(jobs.map(({ path, role, device }) => ({ ...(keep ? { path, keep: true } : { path, role, device }), ...(wifi ? { wifi } : {}) })));
      const done = results.filter(item => item.ok);
      // Fertige Schilder abwählen (ein zweiter Klick soll sie nicht erneut löschen), fehlgeschlagene behalten ihre ID.
      for (const item of results) { const row = batchRows.get(item.path); if (row) { row.result = item; row.percent = item.ok ? 100 : row.percent; row.selected = !item.ok; row.fixedId = !item.ok; } }
      for (const item of done) history.unshift({ device: item.device, role: item.role || jobs[0].role, at: Date.now(), update: keep });
      history = history.slice(0, 50);
      try { localStorage.setItem('workbadge-device-history', JSON.stringify(history)); } catch {}
      renderHistory();
      if (!keep && $('#native-next-id').checked) $('#native-device-id').value = nextFreeId(Math.max(...ids) + 1, new Set());
      latest = { phase: done.length === results.length ? 'ready' : 'error', busy: false, message: `${done.length} von ${results.length} ${keep ? 'Schildern mit neuer Firmware versehen' : 'Schildern eingerichtet'}.${done.length < results.length ? ` ${results.find(item => !item.ok)?.message || ''}` : ' Inhalte danach in der Raumübersicht erneut senden.'}` };
      $('#native-complete').textContent = `✓ ${done.length} ${done.length === 1 ? 'Schild' : 'Schilder'} ${keep ? 'aktualisiert' : 'fertig'}: IDs ${done.map(item => item.device).join(', ') || '–'}.`;
      $('#native-complete').classList.toggle('hidden', !done.length);
    } catch (error) { latest = { phase: 'error', busy: false, message: error.message }; }
    finally { batchBusy = false; for (const row of batchRows.values()) delete row.running; render(); attempted = ''; void poll(); }
  }
  $('#batch-mode').addEventListener('change', render);
  api.onState(state => { if (batchBusy && state.phase !== 'batch' && state.phase !== 'idle') return; latest = state; render(); });
  api.onLog(message => { logs.push(message); if (logs.length > 120) logs.shift(); $('#native-log').textContent = logs.join('\n'); });
  api.state().then(state => { latest = state; render(); }).catch(() => {});
  async function poll(manual = false) {
    if (polling || busy) return;
    polling = true;
    try {
      const result = await api.list(); ports = result.ports;
      const signature = ports.map(port => `${port.path}:${port.vid}:${port.pid}:${port.serial}`).join('|');
      const previous = $('#native-port').value;
      $('#native-port').replaceChildren(new Option('Automatisch auswählen', ''));
      for (const port of ports) $('#native-port').add(new Option(`${port.path} · ${port.description}`, port.path));
      $('#native-port').value = ports.some(port => port.path === previous) ? previous : '';
      provider.path = $('#native-port').value || null;
      if (!batchBusy) for (const path of [...batchRows.keys()]) if (!ports.some(port => port.path === path)) batchRows.delete(path);
      if (!signature) attempted = '';
      render();
      if (manual) attempted = '';
      if (ports.length === 1 && !busy && !batchBusy && gateway.mode === 'offline' && !gateway.connecting && attempted !== signature) {
        attempted = signature;
        await connect();
        render();
      }
    } catch (error) { latest = { phase: 'error', message: error.message }; render(); }
    finally { polling = false; }
  }
  $('#native-port').addEventListener('change', () => { provider.path = $('#native-port').value || null; attempted = ''; });
  $('#native-refresh').addEventListener('click', () => poll(true));
  for (const id of ['#native-role', '#native-device-id']) $(id).addEventListener('change', () => { for (const row of batchRows.values()) delete row.fixedId; render(); });
  $('#native-cancel').addEventListener('click', async () => { await api.cancel(); $('#native-message').textContent = 'Abbruch vor dem Löschen angefordert.'; });
  $('#native-setup').addEventListener('click', async () => {
    const device = Number($('#native-device-id').value), role = $('#native-role').value;
    if (!$('#native-device-id').reportValidity()) return;
    if (trmnl()) {
      // TRMNL: installieren, Nummer und WLAN in einem Durchgang schreiben (wie bei mehreren Schildern).
      const path = provider.path || (ports.length === 1 ? ports[0].path : null);
      if (!path) { $('#native-message').textContent = 'Mehrere USB-Geräte angeschlossen: bitte oben das Gerät wählen.'; return; }
      if (!confirm(`Der TRMNL wird vollständig gelöscht und als Schild ${device} eingerichtet (WLAN + LoRa).\n\nFortfahren?`)) return;
      const port = ports.find(item => item.path === path);
      if (!batchRows.has(path)) batchRows.set(path, {});
      return runBatch([{ path, description: port?.description || '', role: 'trmnl75', device }], false);
    }
    operationBusy = true; latest = { phase: 'bootloader', busy: true, message: 'Einrichtung wird gestartet …' }; $('#native-complete').classList.add('hidden'); render();
    try {
      await gateway.disconnect();
      await installDevice({ api, gateway, connect, path: provider.path, role, device });
      history.unshift({ device, role, at: Date.now() }); history = history.slice(0, 50);
      try { localStorage.setItem('workbadge-device-history', JSON.stringify(history)); } catch {}
      renderHistory();
      if ($('#native-next-id').checked) { let next = device + 1; while (history.some(item => item.device === next)) next++; if (next <= 65534) $('#native-device-id').value = next; }
      latest = { phase: 'ready', busy: false, message: `Schild ${device} wurde gelöscht, neu installiert und mit seiner ID verbunden.` };
      $('#native-complete').textContent = `✓ Schild ${device} ist fertig. Du kannst jetzt das nächste Schild anschließen.`;
      $('#native-complete').classList.remove('hidden');
    } catch (error) { latest = { ...latest, phase: 'error', busy: false, message: error.message }; }
    finally { operationBusy = false; render(); renderConnection(); }
  });
  void poll();
  setInterval(() => void poll(), 2500);
  render();
}
