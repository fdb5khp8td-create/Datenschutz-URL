// Hardware choices belong to room configuration, not to the 200-byte content.
// A selection describes the intended panel; it does not install a receiver driver.
export const DISPLAY_TYPES = Object.freeze({
  wirelesspaper12: Object.freeze({
    name: 'Heltec Wireless Paper 1.2 · 2,13″', short: '2,13″ · Wireless Paper 1.2', width: 250, height: 122,
    description: '250 × 122 Pixel · E0213A367-BW · LoRa SX1262 eingebaut',
    hint: 'Direkt per USB oder als LoRa-Empfänger nutzbar. Zuerst die Wireless-Paper-1.2-Firmware installieren; die Geräte-ID steht nach dem Verbinden bei „Gateway & Einstellungen“.',
    compact: true, image: true,
  }),
  trmnl75: Object.freeze({
    name: 'Seeed TRMNL 7,5″ · WLAN + LoRa', short: '7,5″ · TRMNL', width: 800, height: 480,
    description: '800 × 480 Pixel · Schwarz-Weiß · WLAN eingebaut · LoRa mit Wio-SX1262',
    hint: 'Holt sein Bild per WLAN von diesem PC (Workbadge Rooms muss laufen). Mit aufgestecktem Wio-SX1262 zusätzlich per LoRa erreichbar und Teil des Mesh – dann am USB-Netzteil betreiben.',
    compact: false, image: true, large: true,
  }),
  waveshare213v4: Object.freeze({
    name: 'Waveshare 2,13″ · S/W · V4', short: '2,13″ · Waveshare V4', width: 250, height: 122,
    description: '250 × 122 Pixel · Schwarz-Weiß · Standardannahme',
    hint: 'Vorläufiges Standardprofil für das übliche 2,13″-Display. Panel-Version und LoRa-Empfänger vor dem Aufspielen prüfen.',
    compact: true,
  }),
  generic: Object.freeze({
    name: 'Referenzdisplay / Modell offen', short: 'Displaytyp noch offen', width: null, height: null,
    description: 'Bisheriger Eintrag ohne Modellzuordnung',
    hint: 'Bitte den vorhandenen Raum dem passenden Displaytyp zuordnen.', compact: false,
  }),
});
export const DEFAULT_DISPLAY = 'wirelesspaper12';
export function displayType(value) {
  const key = value === undefined ? 'generic' : value;
  if (typeof key !== 'string' || !Object.hasOwn(DISPLAY_TYPES, key)) throw new Error('Unbekannter Displaytyp.');
  return key;
}
export function getDisplay(value) { return DISPLAY_TYPES[displayType(value)]; }
