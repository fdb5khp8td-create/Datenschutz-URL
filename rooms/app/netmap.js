// Funknetz-Karte: Sender in der Mitte, Schilder auf Ringen nach Empfangsqualität.
// Weitergeleitete Schilder sitzen hinter ihrem Nachbarschild (gestrichelte Linie).
const NS = 'http://www.w3.org/2000/svg';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const RING = { 4: 0.30, 3: 0.52, 2: 0.74, 1: 0.95 };
const RING_LABEL = { 4: 'sehr gut', 3: 'gut', 2: 'mittel', 1: 'schwach' };
const short = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

let bound = null;
export function renderNetMap(el, { signs, sender, onSelect, emptyHtml }) {
  const width = Math.max(320, el.clientWidth || 800), height = Math.max(360, el.clientHeight || 400);
  const cx = width / 2, cy = height / 2;
  const ax = Math.max(80, width / 2 - 62), ay = Math.max(70, height / 2 - 30);
  const compact = signs.length > 20 || width < 560;
  const place = new Map();
  const direct = signs.filter(sign => !sign.relayed).sort((a, b) => a.id - b.id);
  const relayed = signs.filter(sign => sign.relayed);
  const step = (Math.PI * 2) / Math.max(1, direct.length);
  direct.forEach((sign, i) => {
    const angle = -Math.PI / 2 + step / 2 + i * step;
    const f = RING[sign.bars] ?? 0.84;
    place.set(sign.id, { x: cx + Math.cos(angle) * ax * f, y: cy + Math.sin(angle) * ay * f, angle, f, from: null });
  });
  relayed.forEach((sign, i) => {
    const via = place.get(sign.via);
    const angle = via ? via.angle + (i % 2 ? 0.3 : -0.3) : -Math.PI / 2 + i * 0.7;
    const f = Math.min(1.02, Math.max(0.72, (via ? via.f : 0.7) + 0.36));
    place.set(sign.id, { x: cx + Math.cos(angle) * ax * f, y: cy + Math.sin(angle) * ay * f, angle, f, from: via ? sign.via : null });
  });
  // Überlappungen auflösen: Schildchen sanft auseinanderschieben, Sender in der Mitte freihalten.
  const pw = compact ? 30 : 104, ph = compact ? 30 : 44, points = [...place.values()];
  for (let round = 0; round < 60; round++) {
    let moved = false;
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const sx = a.x - cx, sy = a.y - cy;
      if (Math.abs(sx) < pw / 2 + 40 && Math.abs(sy) < ph / 2 + 40) { const len = Math.hypot(sx, sy) || 1; a.x += (sx / len) * 6; a.y += (sy / len) * 6; moved = true; }
      for (let j = i + 1; j < points.length; j++) {
        const b = points[j], dx = b.x - a.x, dy = b.y - a.y;
        if (Math.abs(dx) < pw && Math.abs(dy) < ph) {
          const push = Math.abs(dx) / pw > Math.abs(dy) / ph ? [(dx >= 0 ? 1 : -1) * (pw - Math.abs(dx)) / 2 + 1, 0] : [0, (dy >= 0 ? 1 : -1) * (ph - Math.abs(dy)) / 2 + 1];
          a.x -= push[0]; a.y -= push[1]; b.x += push[0]; b.y += push[1]; moved = true;
        }
      }
    }
    for (const point of points) { point.x = Math.min(width - pw / 2 - 6, Math.max(pw / 2 + 6, point.x)); point.y = Math.min(height - ph / 2 - 6, Math.max(ph / 2 + 6, point.y)); }
    if (!moved) break;
  }

  const rings = [4, 3, 2, 1].map(bars => {
    const f = RING[bars];
    const lx = cx - ax * f + 8, ly = cy + 4;
    return `<ellipse class="nm-ring" cx="${cx}" cy="${cy}" rx="${ax * f}" ry="${ay * f}"/>${signs.length && !compact ? `<text class="nm-ring-label" x="${lx}" y="${ly}">${RING_LABEL[bars]}</text>` : ''}`;
  }).join('');

  const links = signs.map(sign => {
    const p = place.get(sign.id), origin = p.from != null ? place.get(p.from) : { x: cx, y: cy };
    const widthBy = { 4: 3, 3: 2.4, 2: 1.8, 1: 1.3 }[sign.bars] || 1.5;
    const cls = `nm-link${sign.relayed ? ' relay' : ''}${sign.wlan ? ' wlan' : ''}${sign.stale || (sender.state === 'off' && !sign.wlan) ? ' stale' : ''}`;
    return `<line class="${cls}" x1="${origin.x}" y1="${origin.y}" x2="${p.x}" y2="${p.y}" stroke-width="${widthBy}"/>`;
  }).join('');

  const nodes = signs.map(sign => {
    const p = place.get(sign.id);
    const cls = `nm-node${sign.isNew ? ' new' : ''}${sign.stale ? ' stale' : ''}${sign.wlan ? ' wlan' : ''}`;
    const label = `${sign.name || `Schild ${sign.id}`}${sign.isNew ? ', neu' : ''}`;
    const warn = sign.lowBattery ? `<circle class="warn" cx="${compact ? 8 : 44}" cy="${compact ? -8 : -15}" r="4.5"><title>Akku fast leer</title></circle>` : '';
    const body = compact
      ? `<circle class="nm-dot" r="11"/><text class="num" y="-16" text-anchor="middle" style="font-size:12px">${sign.id}</text>`
      : `<rect class="plate" x="-48" y="-19" width="96" height="38" rx="5"/><text class="num" y="-1" text-anchor="middle">${sign.id}</text><text class="name" y="13" text-anchor="middle">${esc(short(sign.isNew ? 'neu' : sign.name || '', 15))}</text>`;
    return `<g class="${cls}" transform="translate(${p.x} ${p.y})" tabindex="0" role="button" aria-label="${esc(label)}" data-node="${sign.id}"><circle class="nm-pulse" r="${compact ? 14 : 30}" data-pulse="${sign.id}"/>${body}${warn}</g>`;
  }).join('');

  const off = sender.state === 'off';
  const senderSvg = `<g class="nm-sender${off ? ' off' : ''}" transform="translate(${cx} ${cy})"><circle class="nm-pulse" r="36" data-pulse="0"/><circle class="halo" r="34"/><circle class="core" r="21"/><circle cy="-4" r="3.2" fill="#fff"/><path d="M0 0v11M-4.5 11h9" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M-7.5-10a9 9 0 0 0 0 12M7.5-10a9 9 0 0 1 0 12M-12-14a15 15 0 0 0 0 20M12-14a15 15 0 0 1 0 20" stroke="#fff" stroke-width="1.7" fill="none" stroke-linecap="round" opacity=".85"/><text y="54" text-anchor="middle">${esc(sender.label)}</text><text class="sub" y="70" text-anchor="middle">${esc(sender.sub)}</text></g>`;

  el.innerHTML = `<svg viewBox="0 0 ${width} ${height}" xmlns="${NS}" role="img" aria-label="Funknetz mit ${signs.length} Schildern">${rings}${links}${senderSvg}${nodes}</svg>${emptyHtml ? `<div class="netmap-empty">${emptyHtml}</div>` : ''}<div class="nm-tip hidden" role="tooltip"></div>`;

  const tip = el.querySelector('.nm-tip');
  const byId = new Map(signs.map(sign => [sign.id, sign]));
  const show = node => {
    const sign = byId.get(Number(node.dataset.node)); if (!sign) return;
    tip.innerHTML = `<strong>${esc(sign.name || `Schild ${sign.id}`)}</strong><span>Schild-Nr. ${sign.id}${sign.isNew ? ' · noch kein Raum' : ''}</span><br>${esc(sign.details)}`;
    tip.classList.remove('hidden');
    const box = el.getBoundingClientRect(), rect = node.getBoundingClientRect();
    const left = Math.min(box.width - 200, Math.max(8, rect.left - box.left + rect.width / 2 - 100));
    const top = rect.top - box.top > 120 ? rect.top - box.top - tip.offsetHeight - 8 : rect.bottom - box.top + 8;
    tip.style.left = `${left}px`; tip.style.top = `${top}px`;
  };
  const hide = () => tip.classList.add('hidden');
  el.querySelectorAll('[data-node]').forEach(node => {
    node.addEventListener('mouseenter', () => show(node)); node.addEventListener('mouseleave', hide);
    node.addEventListener('focus', () => show(node)); node.addEventListener('blur', hide);
    node.addEventListener('click', () => onSelect(Number(node.dataset.node)));
    node.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(Number(node.dataset.node)); } });
  });
  if (!bound) { bound = el; new ResizeObserver(() => el.dispatchEvent(new CustomEvent('netmap-resize'))).observe(el); }
}

// Kurzer Funk-Puls an einem Schild (oder am Sender, id 0), wenn etwas gesendet oder empfangen wurde.
export function pulse(el, id) {
  const ring = el.querySelector(`[data-pulse="${id}"]`); if (!ring) return;
  ring.classList.remove('go'); void ring.getBoundingClientRect(); ring.classList.add('go');
}
