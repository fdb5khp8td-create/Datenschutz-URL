/* Progressive movement: no hidden starting state and no dependency on animation. */
(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Map();
  let revealObserver;

  const cancelReveals = () => {
    animations.forEach((animation) => animation.cancel());
    animations.clear();
  };

  const reveal = (element) => {
    if (reducedMotion.matches || document.hidden || element.contains(document.activeElement)) return;
    const delay = Math.min(180, Math.max(0, Number(element.dataset.revealDelay) || 0));
    try {
      const animation = element.animate([
        { opacity: 0, translate: '0 18px' },
        { opacity: 1, translate: '0 0' }
      ], { duration: 620, delay, easing: 'cubic-bezier(.22,.68,0,1)', fill: 'backwards' });
      animations.set(element, animation);
      const forget = () => {
        if (animations.get(element) === animation) animations.delete(element);
      };
      animation.addEventListener('finish', forget, { once: true });
      animation.addEventListener('cancel', forget, { once: true });
    } catch (_) { /* Unsupported animation must leave the ordinary page intact. */ }
  };

  if ('IntersectionObserver' in window && typeof Element.prototype.animate === 'function') {
    const selectors = [
      '[data-reveal]', '.section-heading', '.section-title', '.setup-heading',
      '.film-copy', '.product-film', '.faq-layout > div:first-child',
      '.buy-copy', '.buy-card', '.contact-row', '.usp-grid > li',
      '.setup-grid > li', '.try-steps > li'
    ];
    const candidates = [...document.querySelectorAll(selectors.join(','))];
    const candidateSet = new Set(candidates);
    const elements = candidates.filter((element) => {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (candidateSet.has(parent)) return false;
      }
      return true;
    });
    // Each row reads as one short sequence, with no long cascade on small screens.
    document.querySelectorAll('.usp-grid, .setup-grid, .try-steps').forEach((group) => {
      [...group.children].forEach((element, index) => {
        if (!element.hasAttribute('data-reveal-delay')) {
          element.dataset.revealDelay = String((index % 3) * 65);
        }
      });
    });
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        revealObserver.unobserve(entry.target);
        reveal(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });
    elements.forEach((element) => revealObserver.observe(element));
  }

  // Keyboard focus is immediate, even during the brief entrance animation.
  document.addEventListener('focusin', (event) => {
    if (!(event.target instanceof Node)) return;
    animations.forEach((animation, element) => {
      if (element.contains(event.target)) animation.cancel();
    });
  });

  const onMotionChange = () => {
    if (!reducedMotion.matches) return;
    cancelReveals();
    if (revealObserver) revealObserver.disconnect();
  };
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', onMotionChange);
  else reducedMotion.addListener(onMotionChange);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelReveals();
  });

  const header = document.querySelector('.site-header');
  if (!header || !document.querySelector('main > section')) return;
  const progress = document.createElement('div');
  progress.className = 'reading-progress';
  progress.setAttribute('aria-hidden', 'true');
  const bar = document.createElement('span');
  progress.appendChild(bar);
  header.appendChild(progress);

  let frame = 0;
  const updateProgress = () => {
    frame = 0;
    const max = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const fraction = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    bar.style.transform = `scaleX(${fraction})`;
  };
  const requestProgress = () => {
    if (!frame) frame = window.requestAnimationFrame(updateProgress);
  };
  window.addEventListener('scroll', requestProgress, { passive: true });
  window.addEventListener('resize', requestProgress, { passive: true });
  window.addEventListener('pageshow', requestProgress);
  window.addEventListener('load', requestProgress, { once: true });
  if ('ResizeObserver' in window) {
    new ResizeObserver(requestProgress).observe(document.body);
  }
  updateProgress();
})();
