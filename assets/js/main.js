// Vardhman Constructions — Main JS

(function () {
  'use strict';

  // Haptic feedback on tappable elements
  // Works on Android Chrome/Firefox (Web Vibration API). iOS Safari has no
  // equivalent web API — there is no workaround for iOS.
  (function () {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    var isTouch = matchMedia('(hover: none) and (pointer: coarse)').matches
      || ('ontouchstart' in window)
      || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
    if (!isTouch) return;

    var tapSelector = 'a, button, input[type="submit"], input[type="button"], .btn, .nav-toggle, .logo-tile, .ebook-card, .carousel-btn, [data-haptic]';
    var TAP_MS = 25;
    var unlocked = false;

    // Some Android browsers gate vibrate() behind a user-gesture activation.
    // Fire a single zero-length vibrate on the first interaction to "unlock".
    var unlock = function () {
      if (unlocked) return;
      try { navigator.vibrate(0); navigator.vibrate(1); unlocked = true; } catch (_) {}
    };
    window.addEventListener('touchstart', unlock, { passive: true, once: true });
    window.addEventListener('pointerdown', unlock, { passive: true, once: true });

    var buzz = function (e) {
      var t = e.target && e.target.closest ? e.target.closest(tapSelector) : null;
      if (!t || t.disabled) return;
      try { navigator.vibrate(TAP_MS); } catch (_) {}
    };

    // pointerdown fires fastest; click is a fallback for browsers that
    // delay/cancel pointer events.
    document.addEventListener('pointerdown', buzz, { passive: true });
    document.addEventListener('click', buzz, { passive: true });
  })();

  const nav = document.querySelector('.nav');
  const navToggle = document.querySelector('.nav-toggle');
  const body = document.body;

  // Scrolled nav state
  const onScroll = () => {
    if (window.scrollY > 40) { nav.classList.add('scrolled'); nav.classList.add('solid'); }
    else { nav.classList.remove('scrolled'); nav.classList.remove('solid'); }
  };
  if (nav) {
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Mobile nav toggle
  if (navToggle) {
    navToggle.addEventListener('click', () => {
      navToggle.classList.toggle('open');
      body.classList.toggle('nav-open');
    });
    document.querySelectorAll('.nav-links a').forEach(a => {
      a.addEventListener('click', () => {
        navToggle.classList.remove('open');
        body.classList.remove('nav-open');
      });
    });
  }

  // Scroll reveal
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    reveals.forEach(el => io.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('in'));
  }

  // Stat counter — finds any [data-count] element
  const stats = document.querySelectorAll('[data-count]');
  if (stats.length && 'IntersectionObserver' in window) {
    const animate = el => {
      const target = parseInt(el.dataset.count, 10);
      const suffix = el.dataset.suffix || '';
      const dur = 1800;
      const start = performance.now();
      const tick = now => {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.floor(target * eased).toLocaleString() + suffix;
        if (p < 1) requestAnimationFrame(tick);
        else el.textContent = target.toLocaleString() + suffix;
      };
      requestAnimationFrame(tick);
    };
    const io2 = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { animate(e.target); io2.unobserve(e.target); }
      });
    }, { threshold: 0.4 });
    stats.forEach(s => io2.observe(s));
  }

  // Projects filter
  const filterPills = document.querySelectorAll('.filter-pill');
  const projectCards = document.querySelectorAll('[data-project-status]');
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const filter = pill.dataset.filter;
      projectCards.forEach(card => {
        const match = filter === 'all' || card.dataset.projectStatus === filter;
        card.style.display = match ? '' : 'none';
      });
    });
  });

  // Contact form (no backend — opens mailto)
  const form = document.querySelector('.contact-form');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const d = new FormData(form);
      const name = d.get('name') || '';
      const email = d.get('email') || '';
      const phone = d.get('phone') || '';
      const project = d.get('project') || '';
      const message = d.get('message') || '';
      const body = `Name: ${name}%0D%0AEmail: ${email}%0D%0APhone: ${phone}%0D%0AInterested in: ${project}%0D%0A%0D%0A${message}`;
      window.location.href = `mailto:vardhmanbhopal130@gmail.com?subject=Website Enquiry from ${encodeURIComponent(name)}&body=${body}`;
    });
  }

  // Lightbox (photo carousel)
  const lightbox = document.querySelector('[data-lightbox]');
  if (lightbox) {
    const lbImg = lightbox.querySelector('[data-lightbox-image]');
    const lbCounter = lightbox.querySelector('[data-lightbox-counter]');
    const lbCaption = lightbox.querySelector('[data-lightbox-caption]');
    const cards = Array.from(document.querySelectorAll('[data-lightbox-src]'));
    const srcs = cards.map(c => c.dataset.lightboxSrc);
    const captions = cards.map(c => c.dataset.lightboxCaption || '');
    let idx = 0;
    const total = srcs.length;
    const show = i => {
      idx = (i + total) % total;
      lbImg.src = srcs[idx];
      lbImg.alt = captions[idx] || '';
      if (lbCounter) lbCounter.textContent = `${String(idx+1).padStart(2,'0')} / ${String(total).padStart(2,'0')}`;
      if (lbCaption) lbCaption.textContent = captions[idx];
    };
    const open = i => { show(i); lightbox.classList.add('open'); document.body.classList.add('lightbox-open'); };
    const close = () => { lightbox.classList.remove('open'); document.body.classList.remove('lightbox-open'); };
    cards.forEach((c, i) => c.addEventListener('click', e => { e.preventDefault(); open(i); }));
    lightbox.querySelector('[data-lightbox-close]')?.addEventListener('click', close);
    lightbox.querySelector('[data-lightbox-prev]')?.addEventListener('click', () => show(idx - 1));
    lightbox.querySelector('[data-lightbox-next]')?.addEventListener('click', () => show(idx + 1));
    lightbox.addEventListener('click', e => { if (e.target === lightbox) close(); });
    document.addEventListener('keydown', e => {
      if (!lightbox.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === 'ArrowRight') show(idx + 1);
    });
  }

  // Reel sound toggle
  document.querySelectorAll('[data-reel-sound]').forEach(btn => {
    const frame = btn.closest('.reel-frame');
    const video = frame?.querySelector('[data-reel-video]') || frame?.querySelector('video');
    if (!video) return;
    btn.addEventListener('click', () => {
      const on = video.muted;
      video.muted = !on;
      if (!video.muted) video.play().catch(() => {});
      btn.classList.toggle('on', !video.muted);
      btn.setAttribute('aria-label', video.muted ? 'Unmute' : 'Mute');
    });
  });

  // Rail scroll controls + progress + dots
  document.querySelectorAll('[data-rail]').forEach(group => {
    const rail = group.querySelector('.rail, .photo-rail');
    const prev = group.querySelector('[data-rail-prev]');
    const next = group.querySelector('[data-rail-next]');
    const fill = group.querySelector('[data-rail-fill]');
    const current = group.querySelector('[data-rail-current]');
    const dotsBox = group.querySelector('[data-rail-dots]');
    if (!rail) return;
    const cards = rail.querySelectorAll('.rail-card, .photo-card');
    const total = cards.length;
    const step = () => Math.min(rail.clientWidth * 0.8, 500);
    prev?.addEventListener('click', () => rail.scrollBy({ left: -step(), behavior: 'smooth' }));
    next?.addEventListener('click', () => rail.scrollBy({ left: step(), behavior: 'smooth' }));

    let dots = [];
    if (dotsBox && total) {
      while (dotsBox.firstChild) dotsBox.removeChild(dotsBox.firstChild);
      for (let i = 0; i < total; i++) {
        const d = document.createElement('button');
        d.type = 'button';
        d.setAttribute('aria-label', `Go to image ${i + 1} of ${total}`);
        d.addEventListener('click', () => {
          const target = cards[i];
          if (!target) return;
          rail.scrollTo({ left: target.offsetLeft - rail.offsetLeft, behavior: 'smooth' });
        });
        dotsBox.appendChild(d);
        dots.push(d);
      }
    }

    const updateProgress = () => {
      const max = rail.scrollWidth - rail.clientWidth;
      const pct = max > 0 ? rail.scrollLeft / max : 0;
      if (fill) fill.style.width = (12 + pct * 88) + '%';
      if (current && total) {
        const idx = Math.min(total, Math.round(pct * (total - 1)) + 1);
        current.textContent = String(idx).padStart(2, '0');
      }
      if (dots.length) {
        const active = Math.min(total - 1, Math.round(pct * (total - 1)));
        dots.forEach((d, i) => d.classList.toggle('active', i === active));
      }
    };
    rail.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  });

  // Active nav highlight based on path
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path || (path === '' && href === 'index.html')) a.classList.add('active');
    if (path.startsWith('vardhman') && href === 'projects.html') a.classList.add('active');
  });
})();

// --- LIVE PRESENCE TRACKING (broadcasts this visitor to the dashboard) ---
(function loadPresence() {
  if (window.location.pathname.indexOf('/dashboard') === 0) return; // dashboard tracks itself separately
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  s.onload = function () {
    try {
      var SUPABASE_URL = 'https://ojxtrnxpqvrysvxipaea.supabase.co';
      var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qeHRybnhwcXZyeXN2eGlwYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzE0MzMsImV4cCI6MjA5NjE0NzQzM30.4OLm_vG0auBfpiULta_y3xllGdFNJYRsC6wqyoINPFg';
      var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      var visitorId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'v_' + Math.random().toString(36).slice(2) + Date.now();
      var channel = client.channel('online_users', { config: { presence: { key: visitorId } } });
      channel.subscribe(async function (status) {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            page: window.location.pathname + window.location.search,
            title: document.title,
            joined_at: new Date().toISOString()
          });
        }
      });
      window.addEventListener('beforeunload', function () { try { channel.untrack(); } catch (e) {} });
    } catch (err) { /* presence is non-critical */ }
  };
  document.head.appendChild(s);
})();
