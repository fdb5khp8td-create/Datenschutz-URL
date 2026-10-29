/* WorkBadge: progressive enhancements for the product and legal pages. */
(() => {
  'use strict';
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  const menuButton = document.querySelector('.menu-toggle');
  const navigation = document.getElementById('main-nav');
  if (menuButton && navigation) {
    const desktop = window.matchMedia('(min-width: 901px)');
    const setMenuOpen = (open, restoreFocus = false) => {
      const isOpen = open && !desktop.matches;
      document.body.classList.toggle('menu-open', isOpen);
      menuButton.setAttribute('aria-expanded', String(isOpen));
      menuButton.setAttribute('aria-label', isOpen ? 'Menü schließen' : 'Menü öffnen');
      if (restoreFocus) menuButton.focus();
    };
    menuButton.addEventListener('click', () => setMenuOpen(!document.body.classList.contains('menu-open')));
    navigation.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('a')) setMenuOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && document.body.classList.contains('menu-open')) setMenuOpen(false, true);
    });
    document.addEventListener('click', (event) => {
      if (event.target instanceof Node && !navigation.contains(event.target) &&
          !menuButton.contains(event.target) && document.body.classList.contains('menu-open')) setMenuOpen(false);
    });
    const onViewportChange = () => { if (desktop.matches) setMenuOpen(false); };
    if (desktop.addEventListener) desktop.addEventListener('change', onViewportChange);
    else desktop.addListener(onViewportChange);
    setMenuOpen(false);
  }

  const display = document.getElementById('badge-display');
  const displayButtons = [...document.querySelectorAll('[data-display]')];
  const displayStatus = document.getElementById('display-status');
  if (display && displayButtons.length) {
    const labels = { status: 'Status', name: 'Namensschild', focus: 'Fokuszeit' };
    const descriptions = {
      status: 'Bitte kurz anklopfen.',
      name: 'Namensschild: Marcel Klisch.',
      focus: '25 Minuten Fokuszeit. Bitte nicht stören.'
    };
    const views = [...display.querySelectorAll('.display-view[data-view]')];
    const selectDisplay = (mode, announce = true) => {
      if (!Object.prototype.hasOwnProperty.call(labels, mode) ||
          !views.some((view) => view.dataset.view === mode)) return;
      display.dataset.mode = mode;
      display.setAttribute('aria-label', `WorkBadge-Vorschau: ${descriptions[mode]}`);
      views.forEach((view) => { view.hidden = view.dataset.view !== mode; });
      displayButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.display === mode)));
      if (displayStatus && announce) displayStatus.textContent = `Anzeige: ${labels[mode]}`;
    };
    displayButtons.forEach((button) => button.addEventListener('click', () => selectDisplay(button.dataset.display)));
    const selected = displayButtons.find((button) => button.getAttribute('aria-pressed') === 'true');
    selectDisplay(selected ? selected.dataset.display : display.dataset.mode || 'status', false);
  }
})();

/* Product photographs and app examples use ordinary buttons for keyboard access. */
(() => {
  'use strict';
  const product = document.getElementById('hero-product');
  const announcement = document.getElementById('hero-announcement');
  const products = {
    status: { src: '/assets/product-status.webp', alt: 'WorkBadge in Weiß mit der Anzeige: Bitte kurz anklopfen.' },
    name: { src: '/assets/product-name.webp', alt: 'WorkBadge in Weiß als digitales Namensschild.' },
    focus: { src: '/assets/product-focus.webp', alt: 'WorkBadge in Weiß mit einer Fokuszeit-Anzeige.' }
  };
  const productButtons = [...document.querySelectorAll('[data-hero-display]')];
  productButtons.forEach(button => button.addEventListener('click', () => {
    const selected = products[button.dataset.heroDisplay];
    if (!product || !selected) return;
    product.src = selected.src;
    product.alt = selected.alt;
    productButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    if (announcement) announcement.textContent = selected.alt;
  }));
  const appButtons = [...document.querySelectorAll('[data-app]')];
  const panels = [...document.querySelectorAll('.app-panel')];
  appButtons.forEach(button => button.addEventListener('click', () => {
    const id = button.getAttribute('aria-controls');
    if (!panels.some(panel => panel.id === id)) return;
    panels.forEach(panel => { panel.hidden = panel.id !== id; });
    appButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  }));
})();

/* Respect explicit playback choices, reduced motion and background tabs. */
(() => {
  'use strict';
  const video = document.getElementById('film');
  if (!video) return;
  const figure = video.closest('figure');
  const button = figure && figure.querySelector('.film-toggle');
  if (button) video.removeAttribute('controls');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let userPaused = reducedMotion.matches;
  let isVisible = !('IntersectionObserver' in window);
  let playRequest = 0;
  video.muted = true;
  video.defaultMuted = true;
  video.removeAttribute('autoplay');

  const syncButton = () => {
    const paused = video.paused || video.ended;
    if (figure) figure.classList.toggle('film-paused', paused);
    if (button) {
      button.textContent = paused ? 'Abspielen' : 'Pause';
      button.setAttribute('aria-label', paused ? 'Produktfilm abspielen' : 'Produktfilm pausieren');
    }
  };
  const shouldPlay = () => !userPaused && isVisible && !document.hidden;
  const syncPlayback = () => {
    const request = ++playRequest;
    if (!shouldPlay()) {
      video.pause();
      syncButton();
      return;
    }
    const promise = video.play();
    if (promise && typeof promise.then === 'function') {
      promise.then(() => {
        // A pending play() may finish after a pause, scroll or tab change.
        if (request !== playRequest && !shouldPlay()) video.pause();
        syncButton();
      }).catch(syncButton);
    }
  };
  video.addEventListener('play', syncButton);
  video.addEventListener('pause', syncButton);
  video.addEventListener('ended', syncButton);
  video.addEventListener('error', syncButton);
  video.addEventListener('canplay', syncPlayback, { once: true });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      const entry = entries.find((item) => item.target === video);
      if (!entry) return;
      isVisible = entry.isIntersecting && entry.intersectionRatio >= 0.2;
      syncPlayback();
    }, { threshold: [0, 0.2] });
    observer.observe(video);
  }
  if (button) {
    button.addEventListener('click', () => {
      userPaused = !video.paused;
      syncPlayback();
    });
  }
  const onReducedMotionChange = () => {
    if (reducedMotion.matches) {
      userPaused = true;
      syncPlayback();
    }
  };
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', onReducedMotionChange);
  else reducedMotion.addListener(onReducedMotionChange);
  document.addEventListener('visibilitychange', syncPlayback);
  syncPlayback();
  syncButton();
})();

/* Existing Plausible events, using only explicitly labelled interactions. */
(() => {
  'use strict';
  const track = (name, properties) => {
    try {
      if (window.plausible) window.plausible(name, properties ? { props: properties } : undefined);
    } catch (_) { /* Analytics must never interrupt an interaction. */ }
  };
  window.wbTrack = track;
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest('[data-track]');
    if (!link) return;
    const section = link.closest('section,header,footer');
    track(link.dataset.track, { Ort: section ? section.id || section.className.split(' ')[0] : 'seite' });
  });
  const video = document.getElementById('film');
  if (video) video.addEventListener('playing', () => track('Video gestartet'), { once: true });
  const shopSection = document.getElementById('kaufen');
  if (shopSection && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        track('Kaufbereich gesehen');
        observer.disconnect();
      }
    }, { threshold: 0.4 });
    observer.observe(shopSection);
  }
})();

/* Shopify-Shop (Buy Button). Zum Aktivieren die drei Werte eintragen. */
const WB_SHOP={
  domain:'6t1d70-k9.myshopify.com', // Shopify-Shop WorkBadge
  token:'',           // Storefront-Zugriffstoken aus dem Buy-Button-Kanal – erst zum Shop-Start eintragen
  productId:'16219532886348'        // Produkt „WorkBadge – Namensschild (E-Ink)“
};

(() => {
  'use strict';
  const node = document.getElementById('shop-product');
  if (!node || !WB_SHOP.domain || !WB_SHOP.token || !WB_SHOP.productId) return;
  const showShop = (active) => {
    document.querySelectorAll('[data-shop-on]').forEach((element) => { element.hidden = !active; });
    document.querySelectorAll('[data-shop-off]').forEach((element) => { element.hidden = active; });
  };
  const font = { 'font-family': 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif' };
  const buttonStyle = {
    ...font, 'font-weight': '700', 'font-size': '15px', 'padding-top': '16px',
    'padding-bottom': '16px', 'border-radius': '10px', 'background-color': '#d5f2df',
    color: '#171e1b', ':hover': { 'background-color': '#c0e8ce', color: '#171e1b' },
    ':focus': { 'background-color': '#c0e8ce' }
  };
  node.setAttribute('aria-busy', 'true');
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://sdks.shopifycdn.com/buy-button/latest/buy-button-storefront.min.js';
  script.onload = async () => {
    try {
      const client = window.ShopifyBuy.buildClient({ domain: WB_SHOP.domain, storefrontAccessToken: WB_SHOP.token });
      const ui = await window.ShopifyBuy.UI.onReady(client);
      await ui.createComponent('product', {
        id: WB_SHOP.productId, node, moneyFormat: '{{amount_with_comma_separator}} €',
        options: {
          product: {
            layout: 'vertical', width: '100%',
            contents: { img: true, title: true, price: true, options: true, quantity: true, quantityIncrement: true, quantityDecrement: true, button: true, description: false },
            text: { button: 'In den Warenkorb', outOfStock: 'Ausverkauft', unavailable: 'Nicht verfügbar' },
            styles: {
              product: { ...font, 'max-width': '100%', 'text-align': 'left' },
              title: { ...font, color: '#171e1b', 'font-size': '24px', 'font-weight': '700' },
              price: { ...font, color: '#171e1b', 'font-size': '22px', 'font-weight': '700' },
              compareAt: { color: '#657269' }, button: { ...buttonStyle, width: '100%' },
              quantityInput: { 'font-size': '16px', 'padding-top': '16px', 'padding-bottom': '16px', 'background-color': '#ffffff', color: '#171e1b', 'border-color': '#dce2db' },
              quantityButton: { color: '#171e1b', 'background-color': '#ffffff', 'border-color': '#dce2db' }, img: { 'border-radius': '16px' }
            },
            events: { addVariantToCart: () => window.wbTrack && window.wbTrack('In den Warenkorb') }
          },
          productSet: {}, modalProduct: {},
          option: { styles: { label: { color: '#657269' }, select: { 'background-color': '#ffffff', color: '#171e1b', 'border-color': '#dce2db' } } },
          cart: {
            text: { title: 'Warenkorb', empty: 'Dein Warenkorb ist leer.', button: 'Zur Kasse', total: 'Zwischensumme', notice: 'Versand und Rabattcodes werden an der Kasse berechnet.', noteDescription: 'Anmerkung zur Bestellung' },
            popup: false,
            styles: {
              button: buttonStyle, cart: { 'background-color': '#fafbf8' }, title: { color: '#171e1b' },
              header: { color: '#171e1b' }, lineItems: { color: '#171e1b' }, subtotalText: { color: '#171e1b' },
              subtotal: { color: '#171e1b' }, notice: { color: '#657269' }, currency: { color: '#657269' },
              close: { color: '#171e1b', ':hover': { color: '#37694b' } }, empty: { color: '#657269' },
              footer: { 'background-color': '#fafbf8' }
            },
            events: { openCheckout: () => window.wbTrack && window.wbTrack('Zur Kasse') }
          },
          lineItem: { styles: {
            variantTitle: { color: '#657269' }, title: { color: '#171e1b' }, price: { color: '#171e1b' },
            quantity: { color: '#171e1b' }, quantityIncrement: { color: '#171e1b', 'border-color': '#dce2db' },
            quantityDecrement: { color: '#171e1b', 'border-color': '#dce2db' }, quantityInput: { color: '#171e1b', 'border-color': '#dce2db' }
          } },
          toggle: { styles: {
            toggle: { ...font, 'background-color': '#d5f2df', ':hover': { 'background-color': '#c0e8ce' } },
            count: { color: '#171e1b' }, iconPath: { fill: '#171e1b' }
          } }
        }
      });
      showShop(true);
    } catch (_) {
      showShop(false);
    } finally {
      node.setAttribute('aria-busy', 'false');
    }
  };
  script.onerror = () => {
    node.setAttribute('aria-busy', 'false');
    showShop(false);
  };
  document.head.appendChild(script);
})();
