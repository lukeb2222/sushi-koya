/* =========================================================
   SUSHI KOYA — interactions
   ========================================================= */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let SITE = null;

  /* =========================================================
     1. OPENING ANIMATION
     ========================================================= */
  const intro = $('#intro');
  let introFinished = false;

  function finishIntro() {
    if (introFinished) return;
    introFinished = true;
    intro.classList.add('is-leaving');
    document.body.classList.remove('is-loading');
    // hero choreography begins as the curtains part
    setTimeout(() => document.documentElement.classList.add('intro-done'), 250);
    setTimeout(() => intro.classList.add('is-done'), 1500);
    try { sessionStorage.setItem('koya-intro', '1'); } catch {}
  }

  (function runIntro() {
    let seen = false;
    try { seen = sessionStorage.getItem('koya-intro') === '1'; } catch {}
    if (reduceMotion) return finishIntro();
    // full ceremony on first visit; a shorter version on later visits in the same session
    const duration = seen ? 1400 : 4300;
    if (seen) intro.style.setProperty('--fast', '1');
    const t = setTimeout(finishIntro, duration);
    const skip = () => { clearTimeout(t); finishIntro(); };
    $('.intro__skip', intro).addEventListener('click', skip);
    intro.addEventListener('click', (e) => { if (e.target !== $('.intro__skip', intro)) skip(); });
    addEventListener('keydown', function onKey(e) {
      if (['Escape', 'Enter', ' '].includes(e.key)) { skip(); removeEventListener('keydown', onKey); }
    });
  })();

  /* =========================================================
     2. CONTENT (site.json) → DOM
     ========================================================= */
  async function loadSite() {
    for (const url of ['/api/site', 'data/site.json']) {
      try {
        const r = await fetch(url, { cache: 'no-cache' });
        if (r.ok) return await r.json();
      } catch {}
    }
    return null;
  }

  function render(site) {
    // Resy links everywhere
    $$('[data-resy]').forEach((a) => (a.href = site.resy));

    // Omakase cards
    const cards = $('[data-omakase]');
    if (cards && site.omakase?.length) {
      cards.innerHTML = site.omakase.map((o) => `
        <article class="course-card ${o.featured ? 'course-card--featured' : ''} reveal">
          <div class="course-card__top">
            <span class="course-card__jp">${esc(o.jp)}</span>
            <span class="course-card__count"><b>${esc(o.courses)}</b> courses</span>
          </div>
          <h3>${esc(o.name)}</h3>
          <p class="course-card__price"><sup>$</sup><span data-count="${esc(o.price)}">${esc(o.price)}</span><small>per guest</small></p>
          <p>${esc(o.summary)}</p>
          <ul>${(o.flow || []).map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
          <a class="btn ${o.featured ? 'btn--shu' : 'btn--outline'}" href="${esc(site.resy)}" target="_blank" rel="noopener" data-resy>
            <span>Reserve the ${esc(o.courses)}-course</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </a>
        </article>`).join('');
    }

    // Progression
    const prog = $('[data-progression]');
    if (prog && site.progression?.length) {
      prog.innerHTML = site.progression.map((p) => `
        <li class="prog reveal">
          <span class="prog__num">${esc(p.num)}</span>
          <span class="prog__jp">${esc(p.jp)}</span>
          <div><h3>${esc(p.name)}</h3><p>${esc(p.desc)}</p></div>
        </li>`).join('');
    }

    // Fish
    const fish = $('[data-fish]');
    if (fish && site.fish?.length) {
      fish.innerHTML = site.fish.map((f, i) => `
        <div class="fish reveal" tabindex="0" style="transition-delay:${(i % 6) * 60}ms" aria-label="${esc(f.romaji)}: ${esc(f.en)}">
          <div class="fish__inner">
            <div class="fish__face fish__front"><span class="jp">${esc(f.jp)}</span><small>${esc(f.romaji)}</small></div>
            <div class="fish__face fish__back"><strong>${esc(f.romaji)}</strong><span>${esc(f.en)}</span></div>
          </div>
        </div>`).join('');
      $$('.fish', fish).forEach((el) => el.addEventListener('click', () => el.classList.toggle('flip')));
    }
    if (site.fishNote) $('[data-fish-note]').textContent = site.fishNote;

    // Gallery
    const gal = $('[data-gallery]');
    const arts = ['nigiri', 'counter', 'knife', 'fish', 'handroll', 'don', 'tea', 'sake'];
    if (gal && site.gallery?.length) {
      gal.innerHTML = site.gallery.map((g, i) => `
        <figure class="g-item ${esc(g.size)} reveal" tabindex="0" data-index="${i}" style="transition-delay:${(i % 4) * 80}ms">
          <div class="photo" data-src="${esc(g.src)}" data-art="${arts[i % arts.length]}" role="img" aria-label="${esc(g.alt)}"></div>
          <figcaption>${esc(g.caption)}<span>${String(i + 1).padStart(2, '0')}</span></figcaption>
        </figure>`).join('');
    }

    // Reviews
    const q = $('[data-quotes]');
    if (q && site.reviews?.length) {
      q.innerHTML = site.reviews.map((r, i) => `
        <blockquote class="quote ${i === 0 ? 'is-active' : ''}">
          <p>${splitWords(`“${r.quote}”`, 'qw', 40)}</p><cite>${esc(r.source)}</cite>
        </blockquote>`).join('');
      $('[data-quote-dots]').innerHTML = site.reviews.map((_, i) => `<button aria-label="Show review ${i + 1}" class="${i === 0 ? 'is-active' : ''}"></button>`).join('');
    }
    if (site.rating) { $('[data-rating]').textContent = site.rating.score; $('[data-rating-label]').textContent = site.rating.label; }

    // FAQ
    const faq = $('[data-faq]');
    if (faq && site.faq?.length) {
      faq.innerHTML = site.faq.map((f, i) => `
        <div class="acc reveal">
          <button class="acc__q" aria-expanded="false" aria-controls="faq-${i}" id="faq-q-${i}">${esc(f.q)}<i aria-hidden="true"></i></button>
          <div class="acc__a" id="faq-${i}" role="region" aria-labelledby="faq-q-${i}"><div><p>${esc(f.a)}</p></div></div>
        </div>`).join('');
    }
  }

  function splitWords(text, cls, stagger) {
    return esc(text).split(' ').map((w, i) => `<span class="${cls}" style="transition-delay:${i * stagger}ms">${w}</span>`).join(' ');
  }

  /* =========================================================
     3. PHOTOS: use real photos when present, else ink art
     ========================================================= */
  function hydratePhotos() {
    $$('.photo').forEach((el) => {
      const key = el.dataset.photo;
      const src = el.dataset.src || (key && (SITE?.photos?.[key] || `images/${key}.jpg`));
      if (!src || el.dataset.loaded) return;
      el.dataset.loaded = '1';
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        el.style.backgroundImage = `url("${src}")`;
        el.classList.add('has-photo');
      };
      img.src = src;
    });
  }

  /* =========================================================
     4. SCROLL REVEALS, COUNTERS, WORD-BY-WORD
     ========================================================= */
  function setupReveals() {
    // split .words headings into words
    $$('.words').forEach((h) => {
      if (h.dataset.split) return;
      h.dataset.split = '1';
      h.innerHTML = h.innerHTML.split(/(\s+)/).map((t) => (/^\s+$/.test(t) ? t : `<span class="w">${t}</span>`)).join('');
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        if (e.target.dataset.clipParent) $$(':scope > .clip-reveal', e.target).forEach((c) => c.classList.add('in'));
        else e.target.classList.add('in');
        $$('[data-count]', e.target).forEach(countUp);
        if (e.target.matches('[data-count]')) countUp(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });

    $$('.reveal').forEach((el) => {
      if (reduceMotion) return el.classList.add('in');
      io.observe(el);
    });
    // fully clipped elements never "intersect", so watch their parent instead
    $$('.clip-reveal').forEach((el) => {
      if (reduceMotion) return el.classList.add('in');
      const parent = el.parentElement;
      if (!parent.dataset.clipParent) { parent.dataset.clipParent = '1'; io.observe(parent); }
    });
  }

  function countUp(el) {
    if (el.dataset.counted) return;
    el.dataset.counted = '1';
    const end = parseFloat(el.dataset.count);
    if (reduceMotion || !isFinite(end)) return;
    const dur = 1600, t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(end * eased);
      if (p < 1) requestAnimationFrame(tick);
    };
    el.textContent = '0';
    requestAnimationFrame(tick);
  }

  /* =========================================================
     5. SCROLL-LINKED: nav, word lighting, progression line, parallax
     ========================================================= */
  const nav = $('#nav');
  const mobileReserve = $('.mobile-reserve');
  let lastY = scrollY, ticking = false;

  function onScroll() {
    const y = scrollY;
    const vh = innerHeight;

    nav.classList.toggle('is-scrolled', y > 40);
    nav.classList.toggle('is-hidden', y > lastY && y > vh * 0.9 && !document.body.classList.contains('menu-open'));
    lastY = y;
    mobileReserve.classList.toggle('show', y > vh * 0.7 && (innerHeight + y) < document.body.scrollHeight - 300);

    // word-by-word lighting in story heading
    $$('.words').forEach((h) => {
      const r = h.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
      const ws = $$('.w', h);
      const lit = Math.round(p * ws.length);
      ws.forEach((w, i) => w.classList.toggle('on', i < lit));
    });

    // progression line
    const prog = $('[data-progression]');
    if (prog) {
      const r = prog.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (vh * 0.6 - r.top) / r.height));
      prog.style.setProperty('--p', p.toFixed(3));
      $$('.prog', prog).forEach((li) => li.classList.toggle('lit', li.getBoundingClientRect().top < vh * 0.6));
    }

    if (!reduceMotion) {
      // parallax frames
      $$('.parallax').forEach((el) => {
        const r = el.parentElement.getBoundingClientRect();
        const off = (r.top + r.height / 2 - vh / 2) * parseFloat(el.dataset.speed || 0.1);
        el.style.translate = `0 ${off.toFixed(1)}px`;
      });
      // hero drift
      if (y < vh) {
        const hero = $('.hero__content');
        hero.style.translate = `0 ${y * 0.25}px`;
        hero.style.opacity = String(1 - y / (vh * 0.9));
      }
      const cta = $('.cta__bg');
      if (cta) {
        const r = cta.parentElement.getBoundingClientRect();
        cta.style.translate = `0 ${((r.top) * -0.12).toFixed(1)}px`;
      }
    }

    // active nav link
    let current = '';
    $$('main section[id]').forEach((s) => { if (s.getBoundingClientRect().top < vh * 0.4) current = s.id; });
    $$('.nav__links a').forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + current));

    ticking = false;
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener('resize', onScroll);

  /* =========================================================
     6. MOBILE MENU
     ========================================================= */
  const burger = $('.nav__burger');
  const mm = $('#mobile-menu');
  function setMenu(open) {
    document.body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    mm.setAttribute('aria-hidden', !open);
    document.body.style.overflow = open ? 'hidden' : '';
  }
  burger.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
  $$('a', mm).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  /* =========================================================
     7. CURSOR, MAGNETIC BUTTONS, CARD GLOW
     ========================================================= */
  function setupPointer() {
    if (!finePointer || reduceMotion) return;
    document.documentElement.classList.add('has-cursor');
    const cur = $('.cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring');
    let mx = -100, my = -100, rx = -100, ry = -100;
    cur.style.opacity = '0';
    addEventListener('mousemove', (e) => { cur.style.opacity = '1'; mx = e.clientX; my = e.clientY; dot.style.transform = `translate(${mx}px,${my}px)`; }, { passive: true });
    (function loop() {
      rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
      ring.style.transform = `translate(${rx}px,${ry}px)`;
      requestAnimationFrame(loop);
    })();
    document.addEventListener('mouseover', (e) => {
      const t = e.target.closest('a, button, [tabindex], input, select, textarea');
      cur.classList.toggle('is-link', !!t);
      cur.classList.toggle('is-reserve', !!e.target.closest('[data-cursor="reserve"]'));
    });

    document.addEventListener('mousemove', (e) => {
      const m = e.target.closest?.('.magnetic');
      $$('.magnetic.is-mag').forEach((b) => { if (b !== m) { b.classList.remove('is-mag'); b.style.transform = ''; } });
      if (!m) return;
      const r = m.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.25;
      const y = (e.clientY - r.top - r.height / 2) * 0.35;
      m.classList.add('is-mag');
      m.style.transform = `translate(${x}px, ${y}px)`;
    }, { passive: true });

    document.addEventListener('mousemove', (e) => {
      const c = e.target.closest?.('.course-card');
      if (!c) return;
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', `${e.clientX - r.left}px`);
      c.style.setProperty('--my', `${e.clientY - r.top}px`);
    }, { passive: true });
  }

  /* =========================================================
     8. HERO: drifting motes (like light on the counter)
     ========================================================= */
  function motes() {
    const c = $('.hero__motes');
    if (!c || reduceMotion) return;
    const ctx = c.getContext('2d');
    let w, h, dpr, parts = [], running = true;
    const resize = () => {
      dpr = Math.min(2, devicePixelRatio || 1);
      w = c.clientWidth; h = c.clientHeight;
      c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(70, (w * h) / 22000));
      parts = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.6 + 0.3,
        vx: (Math.random() - 0.5) * 0.15, vy: -Math.random() * 0.25 - 0.05, a: Math.random() * 0.5 + 0.1, t: Math.random() * 6.28,
      }));
    };
    resize(); addEventListener('resize', resize);
    new IntersectionObserver(([e]) => { running = e.isIntersecting; if (running) frame(); }).observe(c);
    function frame() {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.t += 0.02;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        const alpha = p.a * (0.6 + 0.4 * Math.sin(p.t));
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283);
        ctx.fillStyle = `rgba(232, 210, 170, ${alpha})`; ctx.fill();
      }
      requestAnimationFrame(frame);
    }
    frame();
  }

  /* =========================================================
     9. REVIEWS CAROUSEL
     ========================================================= */
  function quotes() {
    const qs = $$('.quote'); const dots = $$('[data-quote-dots] button');
    if (qs.length < 2) return;
    let i = 0, timer;
    const go = (n) => {
      qs[i].classList.remove('is-active'); dots[i]?.classList.remove('is-active');
      i = (n + qs.length) % qs.length;
      qs[i].classList.add('is-active');
      if (dots[i]) { dots[i].classList.remove('is-active'); void dots[i].offsetWidth; dots[i].classList.add('is-active'); }
      clearInterval(timer); timer = setInterval(() => go(i + 1), 6000);
    };
    dots.forEach((d, n) => d.addEventListener('click', () => go(n)));
    timer = setInterval(() => go(i + 1), 6000);
  }

  /* =========================================================
     10. GALLERY LIGHTBOX
     ========================================================= */
  function lightbox() {
    const lb = $('#lightbox'); if (!lb) return;
    const items = $$('.g-item');
    const holder = $('.lightbox__img', lb), cap = $('figcaption', lb);
    let i = 0, lastFocus;
    const show = (n) => {
      i = (n + items.length) % items.length;
      const src = items[i].querySelector('.photo');
      holder.innerHTML = '';
      const p = src.cloneNode(); p.removeAttribute('style'); p.removeAttribute('data-loaded'); p.className = 'photo';
      if (src.classList.contains('has-photo')) { p.style.backgroundImage = src.style.backgroundImage; p.classList.add('has-photo'); }
      holder.appendChild(p);
      cap.textContent = items[i].querySelector('figcaption').firstChild.textContent;
    };
    const open = (n) => { lastFocus = document.activeElement; show(n); lb.hidden = false; document.body.style.overflow = 'hidden'; $('.lightbox__close', lb).focus(); };
    const close = () => { lb.hidden = true; document.body.style.overflow = ''; lastFocus?.focus(); };
    items.forEach((it, n) => {
      it.addEventListener('click', () => open(n));
      it.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(n); } });
    });
    $('.lightbox__close', lb).addEventListener('click', close);
    $('.lightbox__prev', lb).addEventListener('click', () => show(i - 1));
    $('.lightbox__next', lb).addEventListener('click', () => show(i + 1));
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    addEventListener('keydown', (e) => {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(i - 1);
      if (e.key === 'ArrowRight') show(i + 1);
    });
    let sx = 0;
    lb.addEventListener('touchstart', (e) => (sx = e.touches[0].clientX), { passive: true });
    lb.addEventListener('touchend', (e) => { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1)); });
  }

  /* =========================================================
     11. FAQ ACCORDION
     ========================================================= */
  function faq() {
    $$('.acc__q').forEach((b) => b.addEventListener('click', () => {
      const acc = b.parentElement, open = !acc.classList.contains('open');
      $$('.acc.open').forEach((a) => { a.classList.remove('open'); $('.acc__q', a).setAttribute('aria-expanded', 'false'); });
      acc.classList.toggle('open', open); b.setAttribute('aria-expanded', open);
    }));
  }

  /* =========================================================
     12. FORMS → backend
     ========================================================= */
  async function postJSON(url, data) {
    const NOT_SET_UP = { ok: false, status: 503, body: { error: 'Online inquiries aren’t available right now. Please call us at (917) 675-6355.' } };
    let r;
    try {
      r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    } catch { r = { ok: false, status: 0 }; }
    if (r.ok || r.status === 422 || r.status === 429) {
      let body = {};
      try { body = await r.json(); } catch {}
      return { ok: r.ok, status: r.status, body };
    }
    // Static hosting (GitHub Pages, Netlify…) has no /api: use a form service instead.
    const endpoint = SITE?.formEndpoint; // e.g. "https://formspree.io/f/xxxxxxx"
    if (endpoint) {
      const fr = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ ...data, _subject: `Sushi Koya: ${data['form-name'] || 'inquiry'}` }) });
      return fr.ok ? { ok: true, status: fr.status, body: {} } : NOT_SET_UP;
    }
    if (/\.netlify\.app$/.test(location.hostname) || document.querySelector('form[data-netlify]') && location.hostname.includes('netlify')) {
      const nf = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data).toString() });
      return nf.ok ? { ok: true, status: nf.status, body: {} } : NOT_SET_UP;
    }
    return NOT_SET_UP;
  }

  function forms() {
    const f = $('#inquiry-form');
    if (f) {
      const today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
      f.date.min = today.toISOString().slice(0, 10);
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = $('.form__msg', f);
        $$('.field', f).forEach((x) => { x.classList.remove('has-error'); const er = $('.field__err', x); if (er) er.textContent = ''; });
        const data = Object.fromEntries(new FormData(f));
        // client-side check
        const errs = {};
        if (!data.name || data.name.trim().length < 2) errs.name = 'Please tell us your name.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email || '')) errs.email = 'Please enter a valid email.';
        if (!data.message || data.message.trim().length < 5) errs.message = 'Please add a short message.';
        if (Object.keys(errs).length) return showErrors(f, errs, msg);

        f.classList.add('is-sending'); msg.textContent = 'Sending…';
        try {
          const res = await postJSON('/api/inquiry', data);
          if (res.ok) {
            f.classList.add('is-sent'); f.reset();
            $('button[type=submit] span', f).textContent = 'Inquiry received';
            msg.textContent = 'Thank you. We’ll be in touch shortly. ありがとうございます。';
          } else if (res.status === 422) showErrors(f, res.body.errors || {}, msg);
          else msg.textContent = res.body.error || 'Something went wrong. Please call us at (917) 675-6355.';
        } catch {
          msg.textContent = 'We couldn’t send that right now. Please call us at (917) 675-6355.';
        } finally { f.classList.remove('is-sending'); }
      });
    }

    const n = $('#news-form');
    if (n) n.addEventListener('submit', async (e) => {
      e.preventDefault();
      const out = $('.news__msg');
      const data = Object.fromEntries(new FormData(n));
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email || '')) { out.textContent = 'Please enter a valid email.'; return; }
      out.textContent = 'Subscribing…';
      try {
        const res = await postJSON('/api/newsletter', data);
        out.textContent = res.ok ? 'You’re on the list. See you at the counter.' : (res.body.errors?.email || res.body.error || 'Please try again.');
        if (res.ok) n.reset();
      } catch { out.textContent = 'Please try again in a moment.'; }
    });
  }
  function showErrors(f, errs, msg) {
    Object.entries(errs).forEach(([k, v]) => {
      const field = f.elements[k]?.closest('.field');
      if (field) { field.classList.add('has-error'); const er = $('.field__err', field); if (er) er.textContent = v; }
    });
    msg.textContent = 'Please check the highlighted fields.';
    f.querySelector('.has-error input, .has-error textarea')?.focus();
  }

  /* =========================================================
     13. OPEN / CLOSED STATUS (America/New_York)
     ========================================================= */
  function localStatus() {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
      .formatToParts(new Date()).map((p) => [p.type, p.value]));
    const m = +parts.hour * 60 + +parts.minute;
    const open = m >= 1020 && m < 1320;
    return { open, message: open ? 'Open now · until 10 pm' : m < 1020 ? 'Opens today at 5 pm' : 'Closed · opens tomorrow at 5 pm' };
  }
  async function status() {
    let s;
    try { const r = await fetch('/api/status'); if (r.ok) s = await r.json(); } catch {}
    s = s || localStatus();
    $$('[data-status]').forEach((el) => { el.classList.toggle('is-open', s.open); $('span', el).textContent = s.message; });
  }

  /* =========================================================
     BOOT
     ========================================================= */
  $$('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));

  loadSite().then((site) => {
    SITE = site;
    if (site) render(site);
    hydratePhotos();
    setupReveals();
    quotes();
    lightbox();
    faq();
    onScroll();
  });
  forms();
  status(); setInterval(status, 60_000);
  setupPointer();
  motes();
})();
