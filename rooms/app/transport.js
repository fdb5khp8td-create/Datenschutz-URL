import { command, LineDecoder } from './protocol.js';
import { NativeSerialProvider } from './native.js';
function transportError(code, message) { return Object.assign(new Error(message), { code }); }

export class Gateway extends EventTarget {
  constructor(serial = globalThis.workbadgeDesktop ? new NativeSerialProvider(globalThis.workbadgeDesktop) : globalThis.navigator?.serial, { handshakeTimeoutMs = 1500 } = {}) {
    super(); this.serial = serial; this.mode = 'offline'; this.pending = new Map(); this.counter = Math.floor(Math.random() * 0x7fffffff) + 1; this.session = 0; this.connecting = false; this.handshakeTimeoutMs = handshakeTimeoutMs; this.lastFailure = null;
  }
  emit(detail) { this.dispatchEvent(new CustomEvent('event', { detail })); }
  nextId() { this.counter = (this.counter + 1) >>> 0 || 1; return this.counter; }
  async connect() {
    if (this.closing) await this.closing;
    if (this.mode !== 'offline' || this.connecting) throw new Error('Verbindung ist bereits aktiv.');
    if (!this.serial) throw new Error('USB benötigt Chrome oder Edge auf Windows oder macOS.');
    this.connecting = true;
    this.lastFailure = null;
    let usbOpened = false;
    try {
      this.port = await this.serial.requestPort();
      await this.port.open({ baudRate: 115200, bufferSize: 4096 });
      usbOpened = true;
      this.writer = this.port.writable.getWriter();
      this.mode = 'usb'; this.ready = false; this.info = null;
      this.readerTask = this.readLoop();
      // Boot output is ignored. Repeat the harmless handshake while USB/reset settles.
      let lastError;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const info = await this.request('hello', undefined, undefined, this.handshakeTimeoutMs);
          if (info.v !== 1 || info.protocol !== 'WB1') throw transportError('wrong_firmware', 'Das Gerät antwortet mit einer anderen Firmware. Bitte die passende Workbadge-Firmware installieren.');
          if (info.role !== 'gateway' && !(info.role === 'receiver' && info.local_display === true)) throw transportError('wrong_role', 'Dieses Gerät ist ein reiner LoRa-Empfänger. Bitte das USB-Gateway auswählen oder die Wireless-Paper-Firmware mit USB-Direktsteuerung installieren.');
          this.info = info; this.ready = true; this.emit({ event: 'connection', mode: 'usb', info }); return;
        } catch (error) { lastError = error; if (this.mode !== 'usb' || error.code !== 'response_timeout') break; }
      }
      throw lastError;
    } catch (error) {
      if (usbOpened && error.code === 'response_timeout') error = transportError('firmware_missing', 'USB ist geöffnet, aber das Gerät antwortet nicht auf Workbadge-Befehle. Bitte zuerst die passende Firmware installieren. Die Display-Auswahl allein reicht dafür nicht.');
      if (error.name !== 'NotFoundError') this.lastFailure = { message: error.message, code: error.code || 'usb_error', usbOpened };
      await this.disconnect(); throw error;
    }
    finally { this.connecting = false; }
  }
  async readLoop() {
    const decoder = new LineDecoder();
    try {
      while (this.mode === 'usb' && this.port.readable) {
        const reader = this.port.readable.getReader(); this.reader = reader;
        try {
          while (this.mode === 'usb') {
            const { value, done } = await reader.read();
            if (done) break;
            for (const event of decoder.push(value)) this.receive(event);
          }
        } finally { reader.releaseLock(); if (this.reader === reader) this.reader = null; }
        break;
      }
    } catch (error) { if (this.mode === 'usb') this.emit({ event: 'transport_error', message: error.message }); }
    finally {
      if (this.mode === 'usb') {
        this.mode = 'offline'; this.ready = false; this.rejectPending('USB-Verbindung getrennt.');
        this.emit({ event: 'connection', mode: 'offline' });
        // Close outside this reader task so disconnect never waits on itself.
        queueMicrotask(() => this.disconnect());
      }
    }
  }
  receive(event) {
    if (event.v !== 1 || typeof event.event !== 'string') return;
    if (event.event === 'hello' && this.ready && event.session !== this.info?.session) {
      this.rejectPending('Gateway wurde neu gestartet. Erneut verbinden.'); this.emit({ event: 'transport_error', message: 'Gateway neu gestartet. Bitte USB neu verbinden.' });
      void this.disconnect(); return;
    }
    const pending = this.pending.get(event.id);
    if (pending) {
      if (event.event === 'error') { clearTimeout(pending.timer); this.pending.delete(event.id); pending.reject(new Error(event.message || event.code || 'Gateway-Fehler')); }
      else if (event.event === pending.expected) { clearTimeout(pending.timer); this.pending.delete(event.id); pending.resolve(event); }
    }
    this.emit(event);
  }
  async request(op, device, content, timeout = 3000, extra = {}) {
    if (this.mode === 'offline') throw new Error('Bitte zuerst den Sender verbinden.');
    const id = this.nextId(), payload = command(op, id, device, content, extra);
    if (this.mode === 'demo') return this.simulate(payload);
    const expected = { hello: 'hello', status: 'status', update: 'queued', ping: 'queued', image: 'queued', identify: 'queued', configure: 'configured', ota_begin: 'ota', ota_data: 'ota', ota_start: 'ota', ota_stop: 'ota' }[op];
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(transportError('response_timeout', 'Gerät antwortet nicht. USB-Verbindung und installierte Workbadge-Firmware prüfen.')); }, timeout);
      this.pending.set(id, { resolve, reject, timer, expected });
      this.writer.write(new TextEncoder().encode(JSON.stringify(payload) + '\n')).catch(error => { clearTimeout(timer); this.pending.delete(id); reject(error); });
    });
  }
  demo() {
    if (this.mode !== 'offline' || this.connecting) throw new Error('Bitte zuerst die USB-Verbindung trennen.');
    this.mode = 'demo'; this.ready = true; this.session++; this.lastFailure = null;
    this.info = { board: 'Heltec Wireless Paper · Simulation', role: 'gateway', protocol: 'WB1', firmware: '0.8.0', images: true, ota: true, relay_hops: 2, radio: true, frequency: 869.525, duty_percent: 10, power: 17, sf: 7, bandwidth: 125, network: 1, max_attempts: 5, airtime_budget_ms: 18000 };
    this.emit({ event: 'connection', mode: 'demo', info: this.info });
    // Zwei noch nicht angelegte Schilder melden sich – eines davon nur über ein anderes Schild erreichbar.
    const session = this.session;
    const beacon = (delay, event) => setTimeout(() => { if (this.mode === 'demo' && session === this.session) this.receive({ v: 1, event: 'beacon', display: true, images: true, identify: false, ...event }); }, delay);
    beacon(1400, { device: 1207, rssi: -81, snr: 8, battery: 97, battery_mv: 4120, downlink_rssi: -84, downlink_snr: 7, relayed: false });
    beacon(2600, { device: 1342, rssi: -99, snr: 4, battery: 88, battery_mv: 4050, downlink_rssi: -103, downlink_snr: 2, relayed: true, via: 104 });
  }
  simulate(payload) {
    const session = this.session;
    if (payload.op.startsWith('ota_')) {
      const later = (delay, event) => setTimeout(() => { if (this.mode === 'demo' && session === this.session && this.demoOta?.running) this.receive({ v: 1, event: 'ota', id: 0, ...event }); }, delay);
      let event = { v: 1, event: 'ota', id: payload.id };
      if (payload.op === 'ota_begin') { this.demoOta = { size: payload.size, crc: payload.crc, written: 0, stored: false }; event.stage = 'ready'; }
      if (payload.op === 'ota_data') { const o = this.demoOta; o.written = payload.offset + Math.floor(payload.data.length * 3 / 4); o.stored = o.written >= o.size - 2; event.stage = o.stored ? 'stored' : 'data'; event.offset = o.written; if (o.stored) Object.assign(this.info, { ota_stored: true, ota_size: o.size, ota_crc: o.crc }); }
      if (payload.op === 'ota_stop') { if (this.demoOta) this.demoOta.running = false; event.stage = 'stopped'; }
      if (payload.op === 'ota_start') {
        this.demoOta.running = true;
        if (payload.mode === 'wifi') { event.stage = 'wifi_started'; event.ssid = 'WBR-DEMO'; [1, 2, 3, 4, 5].forEach(n => later(1500 * n, { stage: 'wifi_served', served: n })); later(9500, { stage: 'wifi_stopped' }); }
        else { event.stage = 'lora_started'; event.total = 400; for (let n = 1; n <= 20; n++) later(350 * n, { stage: 'lora_progress', sent: n * 20, total: 400, round: 0 }); [101, 102, 103, 104].forEach((device, i) => later(7400 + i * 300, { stage: 'sign_done', device })); later(9200, { stage: 'lora_finished', missing: 0, round: 0 }); }
      }
      this.receive(event); return Promise.resolve(event);
    }
    const event = { v: 1, event: ['update', 'ping', 'image', 'identify'].includes(payload.op) ? 'queued' : payload.op, id: payload.id, device: payload.device, ...this.info, wait_ms: 0 };
    this.receive(event);
    if (event.event === 'queued') {
      // Bildteile laufen in der Simulation schneller durch; Schild 105 und 1342 liegen „hinter“ Schild 104.
      const fast = payload.op === 'image', relayed = [105, 1342].includes(payload.device), all = payload.device === 65535;
      if (payload.op === 'identify') { this.demoIdentify ??= new Set(); if (all) { if (!payload.on) this.demoIdentify.clear(); this.demoIdentifyAll = payload.on; } else if (payload.on) this.demoIdentify.add(payload.device); else this.demoIdentify.delete(payload.device); }
      if (['update', 'image'].includes(payload.op)) this.demoIdentify?.delete(payload.device);
      const identify = all ? payload.on : (this.demoIdentify?.has(payload.device) ?? false);
      setTimeout(() => { if (this.mode === 'demo' && session === this.session) this.receive({ v: 1, event: 'tx', id: payload.id, device: payload.device, attempt: 1, max_attempts: 5, relay: relayed }); }, fast ? 90 : 300);
      setTimeout(() => { if (this.mode === 'demo' && session === this.session) this.receive(all ? { v: 1, event: 'ack', id: payload.id, device: payload.device, broadcast: true, attempt: 2 } : { v: 1, event: 'ack', id: payload.id, device: payload.device, rssi: -72 - (payload.device * 7) % 45, snr: 8.5, code: 0, attempt: 1, battery: [92, 64, 41, 12, 78, 100][payload.device % 6], battery_mv: 3900, downlink_rssi: -75 - (payload.device * 5) % 40, downlink_snr: 7, display: true, images: true, identify, relayed, ...(relayed ? { via: 104 } : {}) }); }, fast ? (relayed ? 420 : 260) : 1100);
    }
    return Promise.resolve(event);
  }
  rejectPending(message) { for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error(message)); } this.pending.clear(); }
  isLocalDevice(device) { return this.mode === 'usb' && this.info?.local_display === true && this.info.device === device; }
  canSendTo(device) { return this.ready && (this.isLocalDevice(device) || (this.info?.role === 'gateway' && this.info.radio === true)); }
  async disconnect() {
    if (this.closing) return this.closing;
    this.closing = (async () => {
      this.mode = 'offline'; this.ready = false; this.session++; this.rejectPending('Verbindung getrennt.');
      try { await this.reader?.cancel(); } catch {}
      try { await this.readerTask; } catch {}
      try { this.writer?.releaseLock(); } catch {}
      try { await this.port?.close(); } catch {}
      this.port = null; this.writer = null; this.readerTask = null; this.info = null;
      this.emit({ event: 'connection', mode: 'offline' });
    })();
    try { await this.closing; } finally { this.closing = null; }
  }
}
