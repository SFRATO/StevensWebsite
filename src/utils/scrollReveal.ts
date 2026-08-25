/**
 * Scroll-driven presentation for the homepage narrative.
 *
 * Two independent behaviours, both IntersectionObserver-based and both fully
 * inert under `prefers-reduced-motion`:
 *
 *  1. reveal   — `[data-reveal]` elements gain `.in-view` once they enter the
 *                viewport. One-shot; the observer unobserves after firing so
 *                scrolling back up does not re-animate.
 *  2. scrolly  — `[data-scrolly]` wraps a sticky figure panel plus a column of
 *                `[data-step="<key>"]` narrative blocks. As each step reaches
 *                the middle of the viewport, the matching
 *                `[data-panel="<key>"]` becomes the active panel.
 *
 * Both bind on `astro:page-load` (NOT DOMContentLoaded — that does not re-fire
 * under <ViewTransitions />) and guard with a dataset flag so repeat
 * navigations do not stack observers.
 */

const REDUCED = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function initReveal(): void {
  const targets = document.querySelectorAll<HTMLElement>('[data-reveal]:not([data-reveal-bound])');
  if (!targets.length) return;

  // Reduced motion (or no IO support): show everything immediately.
  if (REDUCED() || !('IntersectionObserver' in window)) {
    targets.forEach((el) => {
      el.dataset.revealBound = '1';
      el.classList.add('in-view');
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.15 }
  );

  targets.forEach((el) => {
    el.dataset.revealBound = '1';
    observer.observe(el);
  });
}

function initScrolly(): void {
  const scenes = document.querySelectorAll<HTMLElement>('[data-scrolly]:not([data-scrolly-bound])');

  scenes.forEach((scene) => {
    scene.dataset.scrollyBound = '1';

    const steps = Array.from(scene.querySelectorAll<HTMLElement>('[data-step]'));
    const panels = Array.from(scene.querySelectorAll<HTMLElement>('[data-panel]'));
    if (!steps.length || !panels.length) return;

    const activate = (key: string) => {
      panels.forEach((p) => p.classList.toggle('is-active', p.dataset.panel === key));
      steps.forEach((s) => s.classList.toggle('is-active', s.dataset.step === key));
    };

    // First panel is active in the markup already; this only re-asserts it.
    activate(steps[0].dataset.step as string);

    if (REDUCED() || !('IntersectionObserver' in window)) {
      // No pinning: every step reads as its own block, all panels visible.
      scene.classList.add('scrolly-static');
      panels.forEach((p) => p.classList.add('is-active'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const key = (entry.target as HTMLElement).dataset.step;
          if (entry.isIntersecting && key) activate(key);
        });
      },
      // A thin band across the middle of the viewport: a step becomes active
      // as it crosses the centre line, which is where the sticky panel sits.
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    );

    steps.forEach((step) => observer.observe(step));
  });
}

export function initScrollNarrative(): void {
  initReveal();
  initScrolly();
}

export default initScrollNarrative;
