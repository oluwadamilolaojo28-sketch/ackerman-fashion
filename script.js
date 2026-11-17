/* ============================================================
   ACKERMAN — script.js
   Hero intro · scroll handoff (wordmark → nav) · ambient motion · navigation

   Requires GSAP and ScrollTrigger (loaded before this file).
   If they fail to load, the page still renders in its final state.
   ============================================================ */

(function () {
  'use strict';

  var root = document.documentElement;
  var INTRO_KEY = 'ackerman-intro-seen';

  var reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var desktopQuery = window.matchMedia('(min-width: 761px)');
  var fineHoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');

  /* ---------- Utilities ---------- */

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  function markIntroSeen() {
    try { sessionStorage.setItem(INTRO_KEY, '1'); } catch (e) { /* storage blocked: intro may repeat, which is harmless */ }
  }

  /* ---------- Wordmark preparation ---------- */

  // Splits the blackletter text into individually clipped letters for the reveal.
  // If the logo is an SVG (data-logo="svg"), returns the SVG as a single animatable part.
  function prepareWordmark(el) {
    if (!el) return [];

    if (el.getAttribute('data-logo') === 'svg') {
      var svg = el.querySelector('svg');
      return svg ? [svg] : [];
    }

    var text = el.textContent.trim();
    el.setAttribute('aria-label', text);
    el.textContent = '';

    return text.split('').map(function (ch) {
      var wrap = document.createElement('span');
      wrap.className = 'hero__letter';
      wrap.setAttribute('aria-hidden', 'true');

      var inner = document.createElement('span');
      inner.textContent = ch;

      wrap.appendChild(inner);
      el.appendChild(wrap);
      return inner;
    });
  }

  /* ---------- Navigation (mobile panel) ---------- */

  function initNav(els) {
    var toggle = els.toggle;
    var panel = els.panel;

    function setOpen(open) {
      panel.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.textContent = open ? 'Close' : 'Menu';
      document.body.classList.toggle('menu-open', open);
    }

    toggle.addEventListener('click', function () {
      setOpen(!panel.classList.contains('is-open'));
    });

    $$('a', panel).forEach(function (link) {
      link.addEventListener('click', function () { setOpen(false); });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });

    if (desktopQuery.addEventListener) {
      desktopQuery.addEventListener('change', function (e) {
        if (e.matches) setOpen(false);
      });
    }
  }

  /* ---------- Intro timeline (plays once per tab session) ---------- */

  function playIntro(els) {
    markIntroSeen();

    var mobile = !desktopQuery.matches;
    var startSpacing = mobile ? '0.16em' : '0.3em';
    var isSvg = els.logoIsSvg;

    var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    // 0.0 – 1.2s: hairline draws across, then fades; the wall and beam resolve
    tl.fromTo(els.hairline, { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: 0.6, ease: 'expo.inOut' }, 0)
      .to(els.hairline, { opacity: 0, duration: 0.5, ease: 'power2.out' }, 0.6)
      .fromTo(els.wall, { opacity: 0 }, { opacity: 1, duration: 1.2, ease: 'power2.out' }, 0.6)
      .fromTo(els.beam, { opacity: 0, xPercent: -30 }, { opacity: 1, xPercent: 0, duration: 1.4, ease: 'expo.inOut' }, 0.6)

    // 1.4 – 3.0s: wordmark stamps in letter by letter; tracking tightens
      .fromTo(
        els.logoParts,
        isSvg ? { opacity: 0 } : { yPercent: 100 },
        isSvg
          ? { opacity: 1, duration: 1.2, ease: 'power2.out' }
          : { yPercent: 0, duration: 1.1, stagger: 0.07, ease: 'power3.out' },
        1.4
      )
      .fromTo(els.wordmark, { letterSpacing: startSpacing }, { letterSpacing: '0.08em', duration: 1.6, ease: 'power3.out' }, 1.4)

    // 2.6 – 3.8s: model image lifts in through an inset mask, colour returns
      .fromTo(
        els.media,
        { clipPath: 'inset(100% 0% 0% 0%)', scale: 1.12 },
        { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration: 1.2, ease: 'expo.out' },
        2.6
      )
      .fromTo(els.photo, { filter: 'saturate(0.3)' }, { filter: 'saturate(1)', duration: 1.6, ease: 'power2.out' }, 2.6)

    // 3.4 – 4.4s: tagline resolves from blur; labels, nav and cue follow
      .fromTo(
        els.tagline,
        { opacity: 0, y: 6, filter: 'blur(6px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1 },
        3.4
      )
      .fromTo(els.labels, { opacity: 0 }, { opacity: 1, duration: 0.8, stagger: 0.1 }, 3.5)
      .fromTo(els.navItems, { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.06 }, 3.8)
      .fromTo(els.scroll, { opacity: 0 }, { opacity: 1, duration: 0.8 }, 4.0);

    // Initial states are applied synchronously by fromTo, so removing the class now causes no flash.
    root.classList.remove('intro-pending');

    return tl;
  }

  /* ---------- Scroll handoff: pinned hero → showroom ---------- */

  function buildHandoff(els) {
    // Measures where the wordmark must travel and how much it must shrink to land on the nav logo.
    function measure() {
      var from = els.wordmark.getBoundingClientRect();
      var to = els.navLogo.getBoundingClientRect();
      return {
        x: to.left - from.left,
        y: to.top - from.top,
        s: to.width / from.width
      };
    }

    var pinTl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: els.hero,
        start: 'top top',
        end: '+=150%',
        pin: true,
        scrub: 0.8,
        anticipatePin: 1,
        invalidateOnRefresh: true
      }
    });

    pinTl
      // Light sweeps off-frame to the right
      .to(els.beam, { xPercent: 160 }, 0)
      .to(els.wall, { opacity: 0.5 }, 0)

      // Model sinks into shadow
      .to(els.media, { yPercent: -6, opacity: 0.3 }, 0)

      // Copy and cues recede
      .to(els.tagline, { opacity: 0, y: -14 }, 0)
      .to(els.labels, { opacity: 0, duration: 0.3 }, 0)
      .to(els.scroll, { opacity: 0, duration: 0.2 }, 0)

      // The wordmark becomes the navigation mark
      .to(els.wordmark, {
        x: function () { return measure().x; },
        y: function () { return measure().y; },
        scale: function () { return measure().s; },
        duration: 1
      }, 0)

      // Handoff completes: nav mark takes over, hero mark dissolves
      .fromTo(els.navLogo, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 }, 0.85)
      .to(els.wordmark, { autoAlpha: 0, duration: 0.1 }, 0.9);
  }

  /* ---------- Ambient motion (idle drift, pointer tilt) ---------- */

  function setupAmbient(els) {
    // Slow breathing drift in the light beam, paused whenever the hero is off-screen
    var drift = gsap.to(els.beamCore, {
      xPercent: 4,
      yPercent: -2,
      duration: 9,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1
    });

    ScrollTrigger.create({
      trigger: els.hero,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: function (self) {
        if (self.isActive) { drift.play(); } else { drift.pause(); }
      }
    });

    // Subtle pointer tilt, capped at 3 degrees; desktop with a fine pointer only
    if (fineHoverQuery.matches) {
      var rotX = gsap.quickTo(els.tilt, 'rotationX', { duration: 0.9, ease: 'power3.out' });
      var rotY = gsap.quickTo(els.tilt, 'rotationY', { duration: 0.9, ease: 'power3.out' });

      els.hero.addEventListener('pointermove', function (e) {
        var r = els.hero.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        rotY(clamp(px * 6, -3, 3));
        rotX(clamp(-py * 6, -3, 3));
      });

      els.hero.addEventListener('pointerleave', function () {
        rotX(0);
        rotY(0);
      });
    }
  }

  /* ---------- Reduced motion: no pin, no intro; logo appears after hero ---------- */

  function setupReducedNavLogo(els) {
    gsap.set(els.navLogo, { autoAlpha: 0 });

    ScrollTrigger.create({
      trigger: els.hero,
      start: 'bottom top+=80',
      end: 'max',
      onToggle: function (self) {
        gsap.to(els.navLogo, { autoAlpha: self.isActive ? 1 : 0, duration: 0.4 });
      }
    });
  }

  /* ---------- Init ---------- */

  function init() {
    var els = {
      hero: $('#top'),
      nav: $('#nav'),
      navLogo: $('.nav__logo-text'),
      toggle: $('#navToggle'),
      panel: $('#navPanel'),
      navItems: $$('.nav__links a'),
      wall: $('.hero__wall'),
      beam: $('.hero__beam'),
      beamCore: $('.hero__beam-core'),
      hairline: $('.hero__hairline'),
      media: $('.hero__media'),
      tilt: $('.hero__tilt'),
      photo: $('.hero__photo, .hero__placeholder'),
      wordmark: $('#heroTitle'),
      tagline: $('.hero__tagline'),
      labels: $$('.hero__label'),
      scroll: $('.hero__scroll')
    };

    els.logoIsSvg = els.wordmark.getAttribute('data-logo') === 'svg';
    els.logoParts = prepareWordmark(els.wordmark);

    initNav(els);

    // Graceful fallback: no GSAP means the final, fully readable state
    if (!window.gsap || !window.ScrollTrigger) {
      root.classList.remove('intro-pending');
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    // Prevents layout jumps when Android browser chrome shows or hides
    ScrollTrigger.config({ ignoreMobileResize: true });

    // Nav gains its charcoal background once the page begins to scroll
    ScrollTrigger.create({
      start: 40,
      end: 'max',
      onToggle: function (self) {
        els.nav.classList.toggle('is-scrolled', self.isActive);
      }
    });

    if (reduceQuery.matches) {
      root.classList.remove('intro-pending');
      setupReducedNavLogo(els);
    } else {
      // Hide the nav mark until the handoff reveals it
      gsap.set(els.navLogo, { autoAlpha: 0 });
      setupAmbient(els);

      if (root.classList.contains('intro-pending')) {
        // Build the scroll handoff only after the intro, so measurements use the final wordmark size
        var intro = playIntro(els);
        intro.eventCallback('onComplete', function () {
          buildHandoff(els);
          ScrollTrigger.refresh();
        });
      } else {
        root.classList.remove('intro-pending');
        buildHandoff(els);
      }
    }

    // Recalculate once the blackletter font has loaded, so measurements are accurate
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
