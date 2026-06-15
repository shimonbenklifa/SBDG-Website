/* =========================================================
   SB DEVELOPMENT GROUP — interaction layer
   Progressive enhancement: if GSAP/Lenis fail to load, a
   fallback reveals all content so the site is never broken.
   ========================================================= */
(function () {
  'use strict';

  var hasGSAP  = typeof window.gsap !== 'undefined';
  var hasST    = hasGSAP && typeof window.ScrollTrigger !== 'undefined';
  var hasLenis = typeof window.Lenis !== 'undefined';
  var reduce   = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine     = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (hasST) gsap.registerPlugin(ScrollTrigger);

  /* ----------------------------------------------------------
     0. SAFETY NET — guarantee everything is visible eventually
     ---------------------------------------------------------- */
  function revealAllFallback() {
    document.querySelectorAll('[data-reveal], .reveal-line, .reveal-fade').forEach(function (el) {
      el.classList.add('in');
    });
    document.querySelectorAll('.hero__title .word, .contact__title .word, .split-word > span').forEach(function (el) {
      el.style.transform = 'none';
      el.style.opacity = '1';
    });
  }
  // If something throws, still show content.
  window.addEventListener('error', revealAllFallback, { once: true });

  /* ----------------------------------------------------------
     1. SMOOTH SCROLL (Lenis) + ScrollTrigger sync
     ---------------------------------------------------------- */
  var lenis = null;
  if (hasLenis && !reduce) {
    lenis = new Lenis({
      duration: 1.1,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      lerp: 0.1
    });
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);

    if (hasST) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    }
  }

  // Anchor links -> smooth scroll
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      closeMenu();
      if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.2 });
      else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    });
  });

  /* ----------------------------------------------------------
     2. PRELOADER
     ---------------------------------------------------------- */
  var loader = document.getElementById('loader');
  var bar = document.getElementById('loaderBar');
  var count = document.getElementById('loaderCount');
  if (lenis) lenis.stop();
  document.body.style.overflow = 'hidden';

  function startSite() {
    document.body.style.overflow = '';
    if (lenis) lenis.start();
    introAnimation();
  }

  if (loader && !reduce) {
    requestAnimationFrame(function () { loader.classList.add('is-in'); });
    var pct = 0;
    var tick = setInterval(function () {
      pct += Math.random() * 16 + 4;
      if (pct >= 100) { pct = 100; clearInterval(tick); finishLoad(); }
      if (bar) bar.style.width = pct + '%';
      if (count) count.textContent = Math.floor(pct);
    }, 130);

    function finishLoad() {
      setTimeout(function () {
        loader.classList.add('is-out');
        setTimeout(function () { loader.classList.add('gone'); startSite(); }, 1100);
      }, 350);
    }
    // hard fallback in case interval stalls
    setTimeout(function () {
      if (!loader.classList.contains('gone')) { loader.classList.add('gone'); startSite(); }
    }, 5000);
  } else {
    if (loader) loader.classList.add('gone');
    startSite();
  }

  /* ----------------------------------------------------------
     3. HERO + SPLIT INTRO ANIMATION
     ---------------------------------------------------------- */
  function introAnimation() {
    if (reduce || !hasGSAP) { revealAllFallback(); return; }

    var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.to('.hero__eyebrow span', { y: 0, opacity: 1, duration: 0.9 })
      .to('.hero__title .word', {
        y: 0, duration: 1.1, stagger: 0.06
      }, '-=0.6')
      .to('.hero__lede', { y: 0, opacity: 1, duration: 1 }, '-=0.7')
      .to('.hero__scroll', { opacity: 1, duration: 0.8 }, '-=0.6');

    // mark reveal-line / reveal-fade as in
    document.querySelectorAll('.reveal-line, .reveal-fade').forEach(function (el) { el.classList.add('in'); });
  }

  /* ----------------------------------------------------------
     4. SCROLL REVEALS (IntersectionObserver — robust, no dep)
     ---------------------------------------------------------- */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('[data-reveal]').forEach(function (el) { io.observe(el); });

  /* ----------------------------------------------------------
     5. SPLIT-TEXT reveals for [data-split] headings
     ---------------------------------------------------------- */
  function splitToWords(el) {
    var text = el.textContent;
    el.innerHTML = '';
    text.split(/(\s+)/).forEach(function (chunk) {
      if (chunk.trim() === '') { el.appendChild(document.createTextNode(chunk)); return; }
      var wrap = document.createElement('span');
      wrap.className = 'split-word';
      var inner = document.createElement('span');
      inner.textContent = chunk;
      wrap.appendChild(inner);
      el.appendChild(wrap);
    });
    return el.querySelectorAll('.split-word > span');
  }

  document.querySelectorAll('[data-split]').forEach(function (el) {
    var words = splitToWords(el);
    if (reduce || !hasGSAP) {
      words.forEach(function (w) { w.style.transform = 'none'; });
      return;
    }
    if (hasST) {
      gsap.to(words, {
        y: 0, duration: 1, ease: 'power3.out', stagger: 0.025,
        scrollTrigger: { trigger: el, start: 'top 82%' }
      });
    } else {
      var so = new IntersectionObserver(function (en) {
        en.forEach(function (e) {
          if (e.isIntersecting) {
            gsap.to(words, { y: 0, duration: 1, ease: 'power3.out', stagger: 0.025 });
            so.unobserve(e.target);
          }
        });
      }, { threshold: 0.2 });
      so.observe(el);
    }
  });

  /* ----------------------------------------------------------
     6. COUNTERS
     ---------------------------------------------------------- */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count')) || 0;
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';
    var dur = 1600, start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = Math.round(target * eased);
      el.textContent = prefix + val + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var countIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { animateCount(e.target); countIO.unobserve(e.target); }
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('[data-count]').forEach(function (el) { countIO.observe(el); });

  /* ----------------------------------------------------------
     7. PARALLAX (GSAP ScrollTrigger if available)
     ---------------------------------------------------------- */
  if (hasST && !reduce) {
    document.querySelectorAll('[data-parallax]').forEach(function (el) {
      var amt = parseFloat(el.getAttribute('data-parallax')) || 0.15;
      gsap.to(el, {
        yPercent: amt * 100,
        ease: 'none',
        scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });
    // subtle hero scale-out on scroll
    gsap.to('.hero__img', {
      scale: 1.18, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
    });
  }

  /* ----------------------------------------------------------
     8. NAV scroll state
     ---------------------------------------------------------- */
  var nav = document.getElementById('nav');
  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop;
    nav.classList.toggle('scrolled', y > 60);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  if (lenis) lenis.on('scroll', function (e) { nav.classList.toggle('scrolled', e.scroll > 60); });
  onScroll();

  /* ----------------------------------------------------------
     9. MOBILE MENU
     ---------------------------------------------------------- */
  var burger = document.getElementById('burger');
  var menu = document.getElementById('menu');
  function closeMenu() {
    if (!menu) return;
    menu.classList.remove('open');
    document.body.classList.remove('menu-open');
    if (lenis) lenis.start();
  }
  if (burger && menu) {
    burger.addEventListener('click', function () {
      var open = menu.classList.toggle('open');
      document.body.classList.toggle('menu-open', open);
      if (lenis) { open ? lenis.stop() : lenis.start(); }
    });
  }

  /* ----------------------------------------------------------
     10. CUSTOM CURSOR (+ magnetic buttons)
     ---------------------------------------------------------- */
  if (fine && !reduce) {
    var cursor = document.querySelector('.cursor');
    var dot = document.querySelector('.cursor__dot');
    var ring = document.querySelector('.cursor__ring');
    var label = document.querySelector('.cursor__label');
    var mx = window.innerWidth / 2, my = window.innerHeight / 2;
    var rx = mx, ry = my, dx = mx, dy = my;

    window.addEventListener('mousemove', function (e) { mx = e.clientX; my = e.clientY; });
    (function loop() {
      dx += (mx - dx) * 0.85; dy += (my - dy) * 0.85;
      rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
      if (dot) dot.style.transform = 'translate(' + dx + 'px,' + dy + 'px) translate(-50%,-50%)';
      if (ring) ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px) translate(-50%,-50%)';
      if (label) label.style.transform = 'translate(' + rx + 'px,' + ry + 'px) translate(-50%,-50%)';
      requestAnimationFrame(loop);
    })();

    var hoverTargets = document.querySelectorAll('a, button, [data-cursor], [data-magnetic]');
    hoverTargets.forEach(function (t) {
      t.addEventListener('mouseenter', function () {
        var txt = t.getAttribute('data-cursor');
        if (txt) {
          document.body.classList.add('cursor-label');
          if (label) label.textContent = txt;
        } else {
          document.body.classList.add('cursor-hover');
        }
      });
      t.addEventListener('mouseleave', function () {
        document.body.classList.remove('cursor-hover', 'cursor-label');
      });
    });

    // Magnetic effect
    document.querySelectorAll('[data-magnetic]').forEach(function (el) {
      var strength = 0.4;
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var x = e.clientX - (r.left + r.width / 2);
        var y = e.clientY - (r.top + r.height / 2);
        el.style.transform = 'translate(' + x * strength + 'px,' + y * strength + 'px)';
      });
      el.addEventListener('mouseleave', function () {
        el.style.transform = 'translate(0,0)';
        el.style.transition = 'transform .5s cubic-bezier(0.22,1,0.36,1)';
        setTimeout(function () { el.style.transition = ''; }, 500);
      });
    });
  }

  /* ----------------------------------------------------------
     11. INFINITE MARQUEES (hero ticker + discipline strip)
     ---------------------------------------------------------- */
  function marquee(el, speed) {
    if (!el || reduce) return;
    var x = 0;
    var w = el.scrollWidth / 2;
    function run() {
      x -= speed;
      if (Math.abs(x) >= w) x = 0;
      el.style.transform = 'translateX(' + x + 'px)';
      requestAnimationFrame(run);
    }
    run();
  }
  marquee(document.getElementById('heroTicker'), 0.55);
  var strip = document.querySelector('.strip__track');
  marquee(strip, 0.7);

  /* ----------------------------------------------------------
     12. FOOTER big-word reveal + year
     ---------------------------------------------------------- */
  var yr = document.getElementById('year');
  if (yr) yr.textContent = new Date().getFullYear();

  /* Refresh ScrollTrigger after load (images may shift layout) */
  window.addEventListener('load', function () {
    if (hasST) ScrollTrigger.refresh();
  });

})();
