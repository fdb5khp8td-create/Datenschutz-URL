/* Optional product views and an explicitly illustrative Rooms display. */
(() => {
  'use strict';
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const image = document.getElementById('detail-image');
  const buttons = [...document.querySelectorAll('[data-detail]')];
  const views = {
    front: {
      src: '/assets/details/front.webp', count: '01 / 03',
      alt: '3D-Ansicht der WorkBadge-Vorderseite mit weißem Gehäuse und E-Ink-Statusanzeige: Bitte kurz anklopfen.',
      heading: 'Deine Botschaft bleibt.',
      text: 'Das 2,13-Zoll-E-Ink-Display zeigt Name, Status oder deine eigene Nachricht. Die zuletzt übertragene Anzeige bleibt auch ohne Strom sichtbar.',
      footer: 'PAPIERÄHNLICH. PERSÖNLICH.'
    },
    back: {
      src: '/assets/details/back.webp', count: '02 / 03',
      alt: '3D-Ansicht der WorkBadge-Rückseite mit der magnetischen Halterung am weißen Gehäuse.',
      heading: 'Auch die Rückseite zählt.',
      text: 'Die Ansicht zeigt das 3D-gedruckte Gehäuse und die magnetische Halterung. Die Darstellung basiert auf den vorhandenen Gehäusedaten.',
      footer: 'EIN ANDERER BLICKWINKEL.'
    },
    assembly: {
      src: '/assets/details/assembly.webp', count: '03 / 03',
      alt: 'Explosionsansicht von WorkBadge: weißer Frontrahmen, schematisches Display, Gehäuserückseite und Halterung räumlich getrennt.',
      heading: 'Ein Blick auf den Aufbau.',
      text: 'Rahmen, Gehäuse und Halterung werden hier räumlich getrennt gezeigt. So wird der Aufbau verständlich. Display und Montage sind schematisch dargestellt.',
      footer: 'DIE TEILE. DAS GANZE.'
    }
  };
  let selected = 'front';
  let imageRequest = 0;
  let imageAnimation;
  if (image && buttons.length) {
    buttons.forEach(button => button.addEventListener('click', async () => {
      const key = button.dataset.detail;
      const view = views[key];
      if (!view) return;
      const request = ++imageRequest;
      if (key === selected) return;
      const preload = new Image();
      preload.src = view.src;
      try {
        await preload.decode();
      } catch (_) {
        if (request === imageRequest) document.getElementById('detail-announcement').textContent = 'Diese Ansicht konnte nicht geladen werden. Bitte versuche es erneut.';
        return;
      }
      if (request !== imageRequest) return;
      selected = key;
      if (imageAnimation) imageAnimation.cancel();
      image.src = view.src;
      image.alt = view.alt;
      document.getElementById('detail-count').textContent = view.count;
      document.getElementById('detail-heading').textContent = view.heading;
      document.getElementById('detail-text').textContent = view.text;
      document.getElementById('detail-stage-footer').textContent = view.footer;
      buttons.forEach(item => item.setAttribute('aria-pressed', String(item.dataset.detail === key)));
      document.getElementById('detail-announcement').textContent = `${button.textContent}: ${view.heading}`;
      if (!motion.matches && typeof image.animate === 'function') {
        imageAnimation = image.animate([{ opacity: .3, transform: 'translateY(7px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 300, easing: 'ease-out' });
      }
    }));
  }

  const preview = document.getElementById('room-preview');
  const roomButtons = [...document.querySelectorAll('[data-room-state]')];
  const states = {
    free: { status: 'Frei', until: 'bis 14:00 Uhr', time: '14:00–15:00', event: 'Team-Meeting', label: 'Beispielanzeige: Raum Elbe. Frei bis 14:00 Uhr. Nächster Termin: 14:00 bis 15:00 Uhr, Team-Meeting.' },
    busy: { status: 'Belegt', until: 'bis 15:00 Uhr', time: '15:30–16:00', event: 'Kundentermin', label: 'Beispielanzeige: Raum Elbe. Belegt bis 15:00 Uhr. Nächster Termin: 15:30 bis 16:00 Uhr, Kundentermin.' }
  };
  let previewAnimation;
  if (preview) roomButtons.forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.roomState;
    const state = states[key];
    if (!state || preview.dataset.state === key) return;
    if (previewAnimation) previewAnimation.cancel();
    preview.dataset.state = key;
    preview.setAttribute('aria-label', state.label);
    document.getElementById('room-status').textContent = state.status;
    document.getElementById('room-until').textContent = state.until;
    document.getElementById('room-time').textContent = state.time;
    document.getElementById('room-event').textContent = state.event;
    roomButtons.forEach(item => item.setAttribute('aria-pressed', String(item.dataset.roomState === key)));
    document.getElementById('room-announcement').textContent = state.label;
    if (!motion.matches && typeof preview.animate === 'function') {
      previewAnimation = preview.animate([{ opacity: .55 }, { opacity: 1 }], { duration: 250, easing: 'ease-out' });
    }
    if (window.wbTrack) window.wbTrack('Rooms Beispiel', { Status: state.status });
  }));
  const cancelMotion = () => {
    if (!motion.matches && !document.hidden) return;
    if (imageAnimation) imageAnimation.cancel();
    if (previewAnimation) previewAnimation.cancel();
  };
  if (motion.addEventListener) motion.addEventListener('change', cancelMotion);
  else motion.addListener(cancelMotion);
  document.addEventListener('visibilitychange', cancelMotion);
})();
