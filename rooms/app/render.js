// WorkBadge Rooms – Schildbild erzeugen (250 × 122, 1 Bit je Pixel).
// Reines Zeichnen ohne Zustand der Oberfläche: renderSign(room, company) → { bits, hash }.


  const W = 250, H = 122, ROW = 32, BYTES = ROW * H; // 3904 Bytes, Zeilen auf volle Bytes aufgefüllt

  const TEMPLATES = [
    { id: 'klassisch', name: 'Klassisch', hint: 'Logo oben, Nummer rechts' },
    { id: 'balken', name: 'Balken', hint: 'Große Nummer links' },
    { id: 'kopf', name: 'Kopfzeile', hint: 'Schwarze Kopfzeile' },
    { id: 'zentriert', name: 'Zentriert', hint: 'Ruhig und mittig' },
    { id: 'personen', name: 'Büro', hint: 'Namen im Vordergrund' }
  ];
  const FONTS = ['Segoe UI', 'Bahnschrift', 'Arial', 'Verdana', 'Georgia', 'Consolas'];
  const STATUSES = ['', 'Frei', 'Belegt', 'Bitte nicht stören', 'Besprechung', 'Außer Haus'];

  // Vorlagen zeichnen in einer Layout-Fläche L (250 × 122 für 2,13″; 250 × 150 für 7,5″, dort mal 3,2 vergrößert).
  // S: Pixel je Layout-Einheit – Logos werden in voller Auflösung des Ziels gerastert.
  const L = { W, H };
  let S = 1;
  // 7,5″ (TRMNL): 800 × 480, Zeilen zu 100 Bytes.
  const W75 = 800, H75 = 480, ROW75 = 100, BYTES75 = ROW75 * H75;
  let logoImage = null;            // geladenes Firmenlogo (HTMLImageElement) oder null
  const logoCache = new Map();

  function setLogoImage(img) { logoImage = img; logoCache.clear(); }
  function clearLogoCache() { logoCache.clear(); }

  // Logo in ein Feld einpassen und in reines Schwarzweiß wandeln.
  function logoBitmap(boxW, boxH, mode) {
    if (!logoImage) return null;
    const key = [boxW, boxH, S, mode.threshold, mode.dither, mode.invert].join('|');
    if (logoCache.has(key)) return logoCache.get(key);
    const scale = Math.min(boxW * S / logoImage.naturalWidth, boxH * S / logoImage.naturalHeight);
    const w = Math.max(1, Math.round(logoImage.naturalWidth * scale));
    const h = Math.max(1, Math.round(logoImage.naturalHeight * scale));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.imageSmoothingQuality = 'high';
    g.drawImage(logoImage, 0, 0, w, h);
    const img = g.getImageData(0, 0, w, h), d = img.data;
    const lum = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      let v = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
      lum[i] = mode.invert ? 255 - v : v;
    }
    const t = mode.threshold;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, black = lum[i] < t;
      if (mode.dither) { // Floyd–Steinberg
        const err = lum[i] - (black ? 0 : 255);
        if (x + 1 < w) lum[i + 1] += err * 7 / 16;
        if (y + 1 < h) {
          if (x > 0) lum[i + w - 1] += err * 3 / 16;
          lum[i + w] += err * 5 / 16;
          if (x + 1 < w) lum[i + w + 1] += err / 16;
        }
      }
      const v = black ? 0 : 255;
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    c.lw = w / S; c.lh = h / S;  // Größe in Layout-Einheiten
    logoCache.set(key, c);
    return c;
  }

  // ---- Texthilfen -------------------------------------------------------------------------
  function setFont(g, size, weight, family) {
    g.font = weight + ' ' + size + 'px "' + family + '", "Segoe UI", Arial, sans-serif';
  }
  function fitSize(g, text, maxW, max, min, weight, family) {
    let s = max;
    for (; s > min; s--) { setFont(g, s, weight, family); if (g.measureText(text).width <= maxW) break; }
    setFont(g, s, weight, family);
    return s;
  }
  function ellipsize(g, text, maxW) {
    if (g.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 1 && g.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t.trimEnd() + '…';
  }
  function splitTwo(text) { // an dem Leerzeichen teilen, das der Mitte am nächsten liegt
    const mid = text.length / 2; let best = -1;
    for (let i = 0; i < text.length; i++) if (text[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
    return best < 0 ? null : [text.slice(0, best), text.slice(best + 1)];
  }
  function peopleLines(room) {
    return String(room.people || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  }

  // Stapelt Name, Bereich, Personen und Status in ein Feld und verkleinert, bis alles passt.
  function stack(g, box, room, family, opt) {
    opt = opt || {};
    const align = opt.align || 'left';
    const people = peopleLines(room);
    const primaryPeople = !!opt.peopleFirst;
    let nameMax = opt.nameMax || 30, peopleMax = opt.peopleMax || (primaryPeople ? 24 : 13), maxPeople = opt.maxPeople || 3;
    let lines;
    for (let attempt = 0; attempt < 40; attempt++) {
      lines = [];
      const name = (room.name || '').trim();
      if (name && !opt.skipName) {
        let s = fitSize(g, name, box.w, nameMax, 12, 700, family);
        const two = splitTwo(name);
        if (two && g.measureText(name).width > box.w || (two && s < 17 && nameMax >= 17)) {
          const s2 = Math.min(fitSize(g, two[0], box.w, Math.min(nameMax, 22), 11, 700, family), fitSize(g, two[1], box.w, Math.min(nameMax, 22), 11, 700, family));
          lines.push({ t: two[0], s: s2, w: 700, gap: 0 }, { t: two[1], s: s2, w: 700, gap: 3 });
        } else lines.push({ t: name, s: s, w: 700, gap: 3 });
      }
      const sub = (room.subtitle || '').trim();
      if (sub && !opt.skipSubtitle && !primaryPeople) lines.push({ t: sub, s: 13, w: 600, gap: 4 });
      people.slice(0, maxPeople).forEach(p => {
        const s = fitSize(g, p, box.w, peopleMax, 10, primaryPeople ? 700 : 500, family);
        lines.push({ t: p, s: s, w: primaryPeople ? 700 : 500, gap: primaryPeople ? 3 : 1 });
      });
      if (people.length > maxPeople && lines.length) lines[lines.length - 1].more = people.length - maxPeople;
      if (sub && !opt.skipSubtitle && primaryPeople) lines.push({ t: sub, s: 12, w: 500, gap: 2 });
      if (room.status) lines.push({ status: room.status, s: 17, gap: 0, pad: 4 });
      const total = lines.reduce((a, l) => a + (l.pad || 0) + Math.ceil(l.s * 1.16) + l.gap, 0);
      if (total <= box.h) break;
      if (primaryPeople && peopleMax > 13) peopleMax -= 2;
      else if (nameMax > 15) nameMax -= 2;
      else if (peopleMax > 10) peopleMax -= 1;
      else if (maxPeople > 1) maxPeople -= 1;
      else break;
    }
    const total = lines.reduce((a, l) => a + (l.pad || 0) + Math.ceil(l.s * 1.16) + l.gap, 0);
    let y = box.y + Math.max(0, Math.floor((box.h - total) * (opt.valign === 'top' ? 0 : 0.5)));
    g.fillStyle = '#000'; g.textBaseline = 'alphabetic';
    for (const l of lines) {
      y += l.pad || 0;
      const lh = Math.ceil(l.s * 1.16);
      if (l.status) drawStatus(g, l.status, box, y, align, family);
      else {
        setFont(g, l.s, l.w, family);
        let text = l.more ? l.t + '  +' + l.more : l.t;
        text = ellipsize(g, text, box.w);
        const tw = g.measureText(text).width;
        const x = align === 'center' ? box.x + (box.w - tw) / 2 : box.x;
        g.fillText(text, Math.round(x), Math.round(y + l.s * 0.86));
      }
      y += lh + l.gap;
    }
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function drawStatus(g, status, box, y, align, family) {
    const text = status.toUpperCase();
    setFont(g, 11, 700, family);
    const tw = Math.min(g.measureText(text).width, box.w - 16), w = Math.ceil(tw) + 16, h = 17;
    const x = Math.round(align === 'center' ? box.x + (box.w - w) / 2 : box.x);
    const free = /^frei$/i.test(status);
    g.fillStyle = '#000'; roundRect(g, x, y, w, h, 8); g.fill();
    if (free) { g.fillStyle = '#fff'; roundRect(g, x + 1.5, y + 1.5, w - 3, h - 3, 6.5); g.fill(); }
    g.fillStyle = free ? '#000' : '#fff';
    g.fillText(ellipsize(g, text, box.w - 16), x + 8, y + 12.5);
    g.fillStyle = '#000';
  }
  function drawLogo(g, company, room, x, y, w, h, align) {
    if (!room.showLogo) return false;
    const bmp = logoBitmap(w, h, company.logoMode);
    if (bmp) {
      const dx = align === 'right' ? x + w - bmp.lw : align === 'center' ? x + (w - bmp.lw) / 2 : x;
      g.drawImage(bmp, Math.round(dx * S) / S, Math.round((y + (h - bmp.lh) / 2) * S) / S, bmp.lw, bmp.lh);
      return true;
    }
    const name = (company.name || '').trim();
    if (!name) return false;
    g.fillStyle = '#000'; g.textBaseline = 'alphabetic';
    fitSize(g, name, w, Math.min(13, h), 9, 700, company.font);
    const text = ellipsize(g, name, w), tw = g.measureText(text).width;
    const dx = align === 'right' ? x + w - tw : align === 'center' ? x + (w - tw) / 2 : x;
    g.fillText(text, Math.round(dx), Math.round(y + h / 2 + 4.5));
    return true;
  }

  // ---- Vorlagen ---------------------------------------------------------------------------
  const DRAW = {
    klassisch(g, room, co) {
      const f = co.font, num = (room.number || '').trim();
      let right = L.W - 8;
      if (num) {
        setFont(g, 15, 700, f);
        const text = ellipsize(g, num, 90), w = Math.ceil(g.measureText(text).width) + 14;
        g.fillStyle = '#000'; roundRect(g, L.W - 8 - w, 6, w, 22, 4); g.fill();
        g.fillStyle = '#fff'; g.textBaseline = 'alphabetic'; g.fillText(text, L.W - 8 - w + 7, 22);
        right = L.W - 8 - w - 8;
      }
      const hasLogo = drawLogo(g, co, room, 8, 5, Math.min(120, right - 8), 24, 'left');
      const top = (hasLogo || num) ? 35 : 6;
      if (hasLogo || num) { g.fillStyle = '#000'; g.fillRect(8, 32, L.W - 16, 1); }
      stack(g, { x: 8, y: top + 2, w: L.W - 16, h: L.H - top - 7 }, room, f, { nameMax: 30 });
    },
    balken(g, room, co) {
      const f = co.font, num = (room.number || '').trim(), band = 62;
      g.fillStyle = '#000'; g.fillRect(0, 0, band, L.H);
      g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
      setFont(g, 9, 700, f);
      const label = 'RAUM', lw = g.measureText(label).width;
      if (num) {
        g.fillText(label, Math.round((band - lw) / 2), 44);
        const s = fitSize(g, num, band - 10, 28, 11, 700, f);
        const tw = g.measureText(num).width;
        g.fillText(ellipsize(g, num, band - 6), Math.round((band - Math.min(tw, band - 6)) / 2), Math.round(52 + s * 0.86));
      }
      const hasLogo = room.showLogo && (logoBitmap(80, 18, co.logoMode) || (co.name || '').trim());
      if (hasLogo) drawLogo(g, co, room, L.W - 8 - 100, L.H - 6 - 18, 100, 18, 'right');
      stack(g, { x: band + 9, y: 6, w: L.W - band - 17, h: L.H - 12 - (hasLogo ? 20 : 0) }, room, f, { nameMax: 28 });
    },
    kopf(g, room, co) {
      const f = co.font, num = (room.number || '').trim(), sub = (room.subtitle || '').trim();
      g.fillStyle = '#000'; g.fillRect(0, 0, L.W, 28);
      g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
      let left = 8;
      if (num) { setFont(g, 16, 700, f); const t = ellipsize(g, num, 100); g.fillText(t, 8, 20); left = 8 + g.measureText(t).width + 10; }
      const head = sub || (co.name || '').trim();
      if (head) {
        setFont(g, 12, 600, f);
        const t = ellipsize(g, head, L.W - 8 - left), tw = g.measureText(t).width;
        g.fillText(t, Math.round(L.W - 8 - tw), 19);
      }
      const hasLogo = room.showLogo && !!logoBitmap(80, 18, co.logoMode);
      if (hasLogo) drawLogo(g, co, room, L.W - 8 - 90, L.H - 5 - 18, 90, 18, 'right');
      stack(g, { x: 8, y: 32, w: L.W - 16, h: L.H - 37 - (hasLogo ? 20 : 0) }, room, f, { nameMax: 30, skipSubtitle: !!sub });
    },
    zentriert(g, room, co) {
      const f = co.font, num = (room.number || '').trim();
      g.strokeStyle = '#000'; g.lineWidth = 1; g.strokeRect(3.5, 3.5, L.W - 7, L.H - 7);
      const hasLogo = drawLogo(g, co, room, (L.W - 130) / 2, 9, 130, 22, 'center');
      let bottom = L.H - 9;
      if (num) {
        g.fillStyle = '#000'; g.textBaseline = 'alphabetic'; setFont(g, 11, 600, f);
        const t = ellipsize(g, 'Raum ' + num, L.W - 30), tw = g.measureText(t).width;
        g.fillText(t, Math.round((L.W - tw) / 2), L.H - 11);
        g.fillRect(Math.round(L.W / 2 - 14), L.H - 25, 28, 1);
        bottom = L.H - 28;
      }
      const top = hasLogo ? 34 : 9;
      stack(g, { x: 12, y: top, w: L.W - 24, h: bottom - top }, room, f, { align: 'center', nameMax: 28 });
    },
    personen(g, room, co) {
      const f = co.font, num = (room.number || '').trim(), name = (room.name || '').trim();
      const head = [num, name].filter(Boolean).join(' · ');
      let top = 6;
      if (head) {
        g.fillStyle = '#000'; g.textBaseline = 'alphabetic'; setFont(g, 13, 700, f);
        g.fillText(ellipsize(g, head, L.W - 16), 8, 19);
        g.fillRect(8, 25, L.W - 16, 1); top = 29;
      }
      const hasLogo = room.showLogo && (logoBitmap(80, 18, co.logoMode) || (co.name || '').trim());
      if (hasLogo) drawLogo(g, co, room, L.W - 8 - 100, L.H - 5 - 18, 100, 18, 'right');
      const box = { x: 8, y: top, w: L.W - 16, h: L.H - top - 6 - (hasLogo ? 20 : 0) };
      if (peopleLines(room).length) stack(g, box, room, f, { peopleFirst: true, skipName: true, maxPeople: 4 });
      else stack(g, box, room, f, { skipName: !!head, nameMax: 26 });
    }
  };

  // ---- Bild → Bits ------------------------------------------------------------------------
  function toBits(g, w = W, h = H, row = ROW) {
    const d = g.getImageData(0, 0, w, h).data, bits = new Uint8Array(row * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < 150) bits[y * row + (x >> 3)] |= 0x80 >> (x & 7);
    }
    return bits;
  }
  function hashBits(bits) { // FNV-1a
    let h = 0x811c9dc5;
    for (let i = 0; i < bits.length; i++) { h ^= bits[i]; h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
  function renderSign(room, company) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    (DRAW[room.template] || DRAW.klassisch)(g, room, company);
    const bits = toBits(g);
    return { bits: bits, hash: hashBits(bits) };
  }
  // 7,5″ (TRMNL, 800 × 480): dieselben Vorlagen auf einer Layout-Fläche von 250 × 150, 3,2-fach vergrößert.
  function renderSign75(room, company) {
    const c = document.createElement('canvas'); c.width = W75; c.height = H75;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#fff'; g.fillRect(0, 0, W75, H75);
    const scale = W75 / W;
    L.W = W; L.H = H75 / scale; S = scale;
    try { g.scale(scale, scale); (DRAW[room.template] || DRAW.klassisch)(g, room, company); }
    finally { L.W = W; L.H = H; S = 1; }
    const bits = toBits(g, W75, H75, ROW75);
    return { bits: bits, hash: hashBits(bits) };
  }
  // So sieht das Schild aus, solange die Erkennungsnummer angezeigt wird.
  function renderIdentify(label, id, company) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#000'; g.textBaseline = 'alphabetic';
    const s = fitSize(g, label, W - 40, 84, 30, 700, 'Segoe UI');
    g.fillText(label, Math.round((W - g.measureText(label).width) / 2), Math.round(8 + s * 0.84));
    setFont(g, 11, 600, 'Segoe UI');
    const t = 'WorkBadge Rooms · ' + id.toUpperCase();
    g.fillText(t, Math.round((W - g.measureText(t).width) / 2), H - 8);
    const bits = toBits(g);
    return { bits: bits, hash: hashBits(bits) };
  }
  // Bits auf eine Zeichenfläche (250 × 122) malen, in Papier- und Tintenfarbe.
  function paint(canvas, bits, dim) {
    if (canvas.width !== W) { canvas.width = W; canvas.height = H; }
    const g = canvas.getContext('2d'), img = g.createImageData(W, H), d = img.data;
    const paper = dim ? [226, 225, 219] : [238, 237, 230], ink = dim ? [120, 120, 116] : [30, 31, 29];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const on = bits[y * ROW + (x >> 3)] & (0x80 >> (x & 7)), c = on ? ink : paper, i = (y * W + x) * 4;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  // 800 × 480 malen (Vorschau 7,5″). Die Zeichenfläche wird per CSS verkleinert.
  function paint75(canvas, bits) {
    if (canvas.width !== W75) { canvas.width = W75; canvas.height = H75; }
    const g = canvas.getContext('2d'), img = g.createImageData(W75, H75), d = img.data;
    for (let y = 0; y < H75; y++) for (let x = 0; x < W75; x++) {
      const on = bits[y * ROW75 + (x >> 3)] & (0x80 >> (x & 7)), i = (y * W75 + x) * 4, v = on ? [30, 31, 29] : [238, 237, 230];
      d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  function toBase64(bits) {
    let s = '';
    for (let i = 0; i < bits.length; i += 1024) s += String.fromCharCode.apply(null, bits.subarray(i, i + 1024));
    return btoa(s);
  }

export { W, H, BYTES, W75, H75, BYTES75, TEMPLATES, FONTS, STATUSES, renderSign, renderSign75, renderIdentify, paint, paint75, toBase64, setLogoImage, clearLogoCache, logoBitmap };

