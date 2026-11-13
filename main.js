/* BUHURT — interaction layer */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const debounce = (fn, ms = 150) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  /* no text selection, no image dragging */
  addEventListener('dragstart', (e) => e.preventDefault());
  addEventListener('selectstart', (e) => e.preventDefault());

  gsap.registerPlugin(ScrollTrigger);

  /* ─────────────── smooth scroll ─────────────── */
  let lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  const scrollTo = (target) => (lenis ? lenis.scrollTo(target, { duration: 1.6 }) : (typeof target === 'number' ? scrollTo({ top: target }) : $(target)?.scrollIntoView({ behavior: 'smooth' })));
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length > 1 && $(id)) { e.preventDefault(); scrollTo(id); }
  }));

  /* ─────────────── sparks ─────────────── */
  const sparkCanvas = $('#sparks');
  const sctx = sparkCanvas.getContext('2d');
  let DPR = Math.min(window.devicePixelRatio || 1, 2);
  const sparks = [];
  const flashes = [];
  function sizeSparks() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    sparkCanvas.width = innerWidth * DPR; sparkCanvas.height = innerHeight * DPR;
  }
  sizeSparks();
  addEventListener('resize', debounce(sizeSparks, 100));
  let sparksDirty = false;
  function burst(x, y, count = 46, power = 1) {
    for (let i = 0; i < count; i++) {
      const a = rand(-Math.PI, 0) + rand(-0.5, 0.5);
      const sp = rand(3, 15) * power;
      sparks.push({ x, y, px: x, py: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rand(0, 3), life: 0, max: rand(26, 64), w: rand(0.8, 2.4), h: rand(28, 52) });
    }
    flashes.push({ x, y, life: 0, r: 90 * power });
  }
  function tickSparks() {
    // idle: nothing to draw, so skip the full-screen clear every frame
    if (!sparks.length && !flashes.length) {
      if (sparksDirty) { sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.clearRect(0, 0, sparkCanvas.width, sparkCanvas.height); sparksDirty = false; }
      return;
    }
    sparksDirty = true;
    sctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    sctx.clearRect(0, 0, innerWidth, innerHeight);
    sctx.globalCompositeOperation = 'lighter';
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i]; f.life++;
      const k = 1 - f.life / 10;
      if (k <= 0) { flashes.splice(i, 1); continue; }
      const g = sctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * (1.4 - k * 0.4));
      g.addColorStop(0, `rgba(255,245,220,${0.85 * k})`);
      g.addColorStop(0.25, `rgba(255,170,60,${0.4 * k})`);
      g.addColorStop(1, 'rgba(255,80,20,0)');
      sctx.fillStyle = g;
      sctx.beginPath(); sctx.arc(f.x, f.y, f.r * 1.4, 0, Math.PI * 2); sctx.fill();
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.px = p.x; p.py = p.y;
      p.vx *= 0.975; p.vy = p.vy * 0.975 + 0.42;
      p.x += p.vx; p.y += p.vy; p.life++;
      const k = 1 - p.life / p.max;
      if (k <= 0) { sparks.splice(i, 1); continue; }
      sctx.strokeStyle = `hsla(${p.h},100%,${55 + 40 * k}%,${k})`;
      sctx.lineWidth = p.w;
      sctx.lineCap = 'round';
      sctx.beginPath(); sctx.moveTo(p.px - p.vx * 1.6, p.py - p.vy * 1.6); sctx.lineTo(p.x, p.y); sctx.stroke();
    }
    sctx.globalCompositeOperation = 'source-over';
  }
  gsap.ticker.add(tickSparks);

  /* ─────────────── helpers: split ─────────────── */
  function splitChars(el) {
    const text = el.textContent;
    el.textContent = '';
    return [...text].map((c) => {
      const s = document.createElement('span');
      s.className = 'ch'; s.textContent = c;
      el.appendChild(s);
      return s;
    });
  }
  function splitWords(root) {
    const words = [];
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const parts = n.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((p) => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
            const s = document.createElement('span'); s.className = 'w'; s.textContent = p;
            frag.appendChild(s); words.push(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && !n.classList.contains('pill') && !n.classList.contains('dropcap')) {
          walk(n);
        } else if (n.nodeType === 1) {
          n.classList.add('w'); words.push(n);
        }
      });
    };
    walk(root);
    return words;
  }

  /* ─────────────── loader + intro ─────────────── */
  const titleChars = splitChars($('.hero__title span'));
  gsap.set(titleChars, { yPercent: 110, rotate: 4, opacity: 0 });
  gsap.set('.hero__stage', { scale: 1.25 });
  gsap.set('.hero__ui > *', { opacity: 0, y: 20 });

  const toLoad = ['assets/img/hero.webp', 'assets/img/hero-cut.webp'];
  const loadState = { v: 0 };
  let loaded = 0;
  const counter = $('.loader__count');
  const bar = $('.loader__bar i');
  gsap.to('.loader__glyph', { clipPath: 'inset(0% 0 0 0)', duration: 1.1, ease: 'power3.inOut' });
  const loadPromise = Promise.all([
    ...toLoad.map((src) => new Promise((res) => { const i = new Image(); i.onload = i.onerror = () => { loaded++; res(); }; i.src = src; })),
    document.fonts ? document.fonts.ready : Promise.resolve(),
    new Promise((r) => setTimeout(r, 1300))
  ]);
  const progressTween = gsap.to(loadState, {
    v: 92, duration: 1.3, ease: 'power2.out',
    onUpdate: () => { counter.textContent = String(Math.round(loadState.v)).padStart(3, '0'); bar.style.transform = `scaleX(${loadState.v / 100})`; }
  });
  loadPromise.then(() => {
    progressTween.kill();
    gsap.timeline({
      onComplete: () => {
        $('.loader').remove();
        window.scrollTo(0, 0);
        document.body.classList.remove('is-loading');
        lenis && lenis.start();
        ScrollTrigger.refresh();
      }
    })
      .to(loadState, { v: 100, duration: 0.35, onUpdate: () => { counter.textContent = String(Math.round(loadState.v)).padStart(3, '0'); bar.style.transform = `scaleX(${loadState.v / 100})`; } })
      .to('.loader__inner', { opacity: 0, y: -30, duration: 0.45, ease: 'power2.in' }, '+=0.1')
      .to('.loader__panel--a', { yPercent: -101, duration: 1.1, ease: 'expo.inOut' }, '<')
      .to('.loader__panel--b', { yPercent: 101, duration: 1.1, ease: 'expo.inOut' }, '<')
      .to('.hero__stage', { scale: 1, duration: 2.2, ease: 'expo.out' }, '<0.15')
      .to(titleChars, { yPercent: 0, rotate: 0, opacity: 1, duration: 1.4, stagger: 0.06, ease: 'expo.out' }, '<0.35')
      .to('.hero__ui > *', { opacity: 1, y: 0, duration: 1, stagger: 0.1, ease: 'power3.out' }, '<0.4');
  });

  /* ─────────────── hero scroll + mouse depth ─────────────── */
  const heroTl = gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom bottom', scrub: true } });
  heroTl
    // scroll zoom lives on the images, not on .hero__stage, so it never fights the intro zoom-out
    .fromTo('.hero__bg, .hero__cut', { scale: 1 }, { scale: 1.18, ease: 'none', immediateRender: false }, 0)
    .to('.hero__title', { yPercent: -48, ease: 'none' }, 0)
    .to('.hero__title span', { opacity: 0.0, ease: 'power1.in' }, 0.25)
    .to('.hero__ui', { opacity: 0, ease: 'none', duration: 0.3 }, 0)
    .to('.hero__shade', { backgroundColor: 'rgba(13,12,11,.85)', ease: 'none' }, 0.2);

  if (finePointer && !reduced) {
    const tx = gsap.quickTo('.hero__title', 'x', { duration: 1.2, ease: 'power3' });
    const sx = gsap.quickTo('.hero__bg, .hero__cut', 'x', { duration: 1.2, ease: 'power3' });
    const sy = gsap.quickTo('.hero__bg, .hero__cut', 'y', { duration: 1.2, ease: 'power3' });
    $('.hero').addEventListener('pointermove', (e) => {
      const nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5;
      tx(-nx * 50); sx(nx * 18); sy(ny * 12);
    });
  }

  /* ─────────────── manifesto words ─────────────── */
  const words = splitWords($('[data-words]'));
  gsap.to(words, {
    opacity: 1, stagger: 0.08, ease: 'none',
    scrollTrigger: { trigger: '.manifesto__text', start: 'top 80%', end: 'bottom 45%', scrub: 0.6 }
  });
  gsap.from('.pill', {
    width: 0, duration: 1, ease: 'expo.out', stagger: 0.15,
    scrollTrigger: { trigger: '.manifesto__text', start: 'top 70%' }
  });
  gsap.from('.folio__col', {
    y: 40, opacity: 0, duration: 1, stagger: 0.12, ease: 'power3.out',
    scrollTrigger: { trigger: '.folio', start: 'top 85%' }
  });

  /* ─────────────── counters ─────────────── */
  $$('[data-count]').forEach((el) => {
    const end = +el.dataset.count;
    const o = { v: 0 };
    ScrollTrigger.create({
      trigger: el, start: 'top 88%', once: true,
      onEnter: () => gsap.to(o, { v: end, duration: end > 50 ? 2 : 1.4, ease: 'power3.out', onUpdate: () => (el.textContent = Math.round(o.v)) })
    });
    el.textContent = '0';
  });

  /* ─────────────── ledger rows ─────────────── */
  $$('.ledger__row').forEach((row) => {
    gsap.from(row.children, {
      yPercent: 40, opacity: 0, duration: 1.1, stagger: 0.08, ease: 'expo.out',
      scrollTrigger: { trigger: row, start: 'top 90%' }
    });
  });
  if (finePointer) {
    const float = $('.ledger__float');
    const fimg = $('img', float);
    const fx = gsap.quickTo(float, 'x', { duration: 0.6, ease: 'power3' });
    const fy = gsap.quickTo(float, 'y', { duration: 0.6, ease: 'power3' });
    const fr = gsap.quickTo(float, 'rotate', { duration: 0.8, ease: 'power3' });
    let px = -1, py = -1, lastX = 0, shown = false, currentImg = '';
    function syncFloat() {
      const el = px < 0 ? null : document.elementFromPoint(px, py);
      const row = el && el.closest('.ledger__row');
      if (row) {
        if (row.dataset.img !== currentImg) { currentImg = row.dataset.img; fimg.src = currentImg; }
        if (!shown) { shown = true; gsap.to(float, { opacity: 1, scale: 1, duration: 0.5, ease: 'expo.out', overwrite: 'auto' }); }
      } else if (shown) {
        shown = false;
        gsap.to(float, { opacity: 0, scale: 0.6, duration: 0.3, ease: 'power2.in', overwrite: 'auto' });
      }
    }
    addEventListener('pointermove', (e) => {
      px = e.clientX; py = e.clientY;
      fx(px + 170); fy(py); fr(clamp((px - lastX) * 0.6, -14, 14)); lastX = px;
      syncFloat();
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { px = -1; syncFloat(); });
    addEventListener('scroll', syncFloat, { passive: true });
    if (lenis) lenis.on('scroll', syncFloat);
  }

  /* ─────────────── LEX horizontal ─────────────── */
  const track = $('.lex__track');
  const laws = $$('.law');
  // extra room after the last law so it can settle in the middle of the screen (wide screens only)
  const lexTail = () => (innerWidth > 860 ? Math.max(0, (innerWidth - laws[laws.length - 1].offsetWidth) / 2) : 0);
  const lexDistance = () => track.scrollWidth - innerWidth + lexTail();
  const LEX_SLOW = 1.35; // more scroll per pixel of sideways travel, so each law stays in focus longer
  // snap points: the intro at the start, then each law centred on screen
  const lexStops = () => {
    const d = lexDistance();
    return [0, ...laws.map((l) => clamp((l.offsetLeft + l.offsetWidth / 2 - innerWidth / 2) / d, 0, 1))];
  };
  const lexTween = gsap.to(track, {
    x: () => -lexDistance(), ease: 'none',
    scrollTrigger: {
      trigger: '.lex', pin: '.lex__pin', start: 'top top', end: () => '+=' + lexDistance() * LEX_SLOW, scrub: 0.8, invalidateOnRefresh: true,
      onUpdate: (st) => gsap.set('.lex__progress b', { scaleX: st.progress })
    }
  });
  // gentle snap: once scrolling rests inside the rules, glide to the nearest law (done through Lenis so the two never fight)
  if (lenis) {
    let snapTimer = 0;
    lenis.on('scroll', () => {
      clearTimeout(snapTimer);
      snapTimer = setTimeout(() => {
        const st = lexTween.scrollTrigger;
        const y = window.scrollY; // the real position (Lenis' own value lags behind native/touch scrolling)
        if (!st || y <= st.start + 4 || y >= st.end - 4) return; // leave the ends free so you can scroll out
        const p = (y - st.start) / (st.end - st.start);
        const stop = lexStops().reduce((a, b) => (Math.abs(b - p) < Math.abs(a - p) ? b : a));
        const ty = st.start + stop * (st.end - st.start);
        if (Math.abs(ty - y) > 6) lenis.scrollTo(ty, { duration: 0.8, easing: (t) => 1 - Math.pow(1 - t, 3) });
      }, 220);
    });
  }
  laws.forEach((law) => {
    // every reveal is complete by the time the whole law is on screen (its right edge reaches the viewport edge)
    const st = { trigger: law, containerAnimation: lexTween, start: 'left 90%', end: 'right 100%', scrub: true };
    gsap.fromTo($('.law__num', law), { yPercent: 30, opacity: 0.1 }, { yPercent: 0, opacity: 1, ease: 'none', scrollTrigger: st });
    // photo effects are keyed to the photo itself (it sits on the right of the law), so they play while it is on screen
    const plate = $('.plate', law);
    const cut = $('.plate__cut', law);
    const frame = $('.plate__frame', law);
    const pst = { trigger: plate, containerAnimation: lexTween, scrub: true };
    if (frame) gsap.fromTo(frame, { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', ease: 'none', scrollTrigger: { ...pst, start: 'left 100%', end: 'left 55%' } });
    if (cut) gsap.fromTo(cut, { yPercent: 10, scale: 0.94 }, { yPercent: -2, scale: 1.02, ease: 'none', scrollTrigger: { ...pst, start: 'left 100%', end: 'left 30%' } });
    gsap.from($('.law__copy', law).children, {
      x: 60, opacity: 0, stagger: 0.06, ease: 'none',
      scrollTrigger: { ...st, start: 'left 80%' }
    });
  });

  /* ─────────────── ARMA armoury ─────────────── */
  const weapons = $$('.arma__weapon img');
  const indexItems = $$('.arma__index li');
  const specs = $$('.spec');
  const ghost = $('.arma__ghost span');
  const counterEl = $('.arma__counter b');
  const names = indexItems.map((li) => li.lastChild.textContent.trim());
  let current = 0;
  const armaST = ScrollTrigger.create({
    trigger: '.arma', pin: '.arma__pin', start: 'top top', end: '+=' + (names.length - 1) * 55 + '%', scrub: true,
    onUpdate: (st) => {
      const i = clamp(Math.round(st.progress * (names.length - 1)), 0, names.length - 1);
      if (i !== current) showWeapon(i, i > current ? 1 : -1);
    }
  });
  const CLIP_FULL = 'polygon(0% 0%, 130% 0%, 100% 100%, -30% 100%)';
  const CLIP_R = 'polygon(130% 0%, 130% 0%, 100% 100%, 100% 100%)';
  const CLIP_L = 'polygon(0% 0%, 0% 0%, -30% 100%, -30% 100%)';
  function showWeapon(i, dir) {
    const prev = weapons[current];
    const next = weapons[i];
    current = i;
    gsap.killTweensOf(weapons);
    // fast scrolling can skip several weapons: anything not involved vanishes at once
    weapons.forEach((w) => {
      if (w !== prev && w !== next) { w.classList.remove('is-active'); gsap.set(w, { opacity: 0, clipPath: CLIP_FULL, y: 0 }); }
    });
    // 1) the old weapon wipes out quickly...
    if (prev !== next) {
      gsap.to(prev, {
        clipPath: dir > 0 ? CLIP_R : CLIP_L, y: -30 * dir, opacity: 0, duration: 0.32, ease: 'power2.in',
        onComplete: () => prev.classList.remove('is-active')
      });
    }
    // 2) ...and the new one only starts as the old one leaves, so the two never overlap
    next.classList.add('is-active');
    gsap.fromTo(next,
      { clipPath: dir > 0 ? CLIP_L : CLIP_R, y: 50 * dir, opacity: 1 },
      { clipPath: CLIP_FULL, y: 0, duration: 0.75, delay: prev !== next ? 0.26 : 0, ease: 'expo.out' });
    indexItems.forEach((li, k) => li.classList.toggle('is-active', k === i));
    specs.forEach((s, k) => s.classList.toggle('is-active', k === i));
    gsap.fromTo(specs[i].children, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.06, ease: 'expo.out' });
    gsap.timeline()
      .to(ghost, { yPercent: -30 * dir, opacity: 0, duration: 0.25, ease: 'power2.in' })
      .add(() => { ghost.textContent = names[i]; })
      .fromTo(ghost, { yPercent: 30 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.7, ease: 'expo.out' });
    counterEl.textContent = String(i + 1).padStart(2, '0');
  }
  gsap.set(weapons, { clipPath: CLIP_FULL });
  indexItems.forEach((li, k) => li.addEventListener('click', () => {
    const st = armaST;
    scrollTo(st.start + (st.end - st.start) * (k / (names.length - 1)) + 2);
  }));
  // idle float + tilt
  gsap.to('.arma__weapon', { y: -14, duration: 3, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  if (finePointer) {
    const ry = gsap.quickTo(weapons, 'rotationY', { duration: 1, ease: 'power3' });
    const rx = gsap.quickTo(weapons, 'rotationX', { duration: 1, ease: 'power3' });
    const gx = gsap.quickTo('.arma__ghost', 'x', { duration: 1.4, ease: 'power3' });
    $('.arma').addEventListener('pointermove', (e) => {
      const nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5;
      ry(nx * 26); rx(-ny * 10); gx(-nx * 60);
    });
  }

  /* ─────────────── HARNISCH anatomy ─────────────── */
  const fig = $('.anatomy__figure');
  const svg = $('.anatomy__lines');
  const pins = $$('.anatomy__pins li');
  const NS = 'http://www.w3.org/2000/svg';
  function drawAnatomy() {
    const w = fig.clientWidth, h = fig.clientHeight;
    const gap = innerWidth < 1100 ? 24 : 60;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', w); svg.setAttribute('height', h);
    svg.innerHTML = '';
    pins.forEach((li) => {
      const x = (+li.dataset.x / 100) * w, y = (+li.dataset.y / 100) * h;
      li.style.top = y + 'px';
      const ex = li.dataset.side === 'l' ? -gap + 6 : w + gap - 6;
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', x); line.setAttribute('y1', y); line.setAttribute('x2', ex); line.setAttribute('y2', y);
      const len = Math.abs(ex - x);
      line.style.strokeDasharray = len; line.style.strokeDashoffset = len;
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('r', 4);
      const ring = document.createElementNS(NS, 'circle');
      ring.setAttribute('cx', x); ring.setAttribute('cy', y); ring.setAttribute('r', 10);
      ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', 'var(--gules)'); ring.setAttribute('stroke-width', '1');
      svg.append(line, ring, dot);
      li._line = line; li._dot = dot; li._ring = ring;
      if (li._shown) line.style.strokeDashoffset = 0;
      else gsap.set([dot, ring], { scale: 0, transformOrigin: 'center', transformBox: 'fill-box' });
    });
  }
  svg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible;pointer-events:none;';
  drawAnatomy();
  addEventListener('resize', debounce(() => { drawAnatomy(); ScrollTrigger.refresh(); }, 200));
  pins.forEach((li) => {
    gsap.set(li, { opacity: 0, x: li.dataset.side === 'l' ? 20 : -20 });
    ScrollTrigger.create({
      trigger: fig, start: () => `top+=${(+li.dataset.y / 100) * fig.clientHeight - innerHeight * 0.6} top`,
      onEnter: () => {
        li._shown = true;
        gsap.to(li._line, { strokeDashoffset: 0, duration: 0.8, ease: 'power3.out' });
        gsap.to([li._dot, li._ring], { scale: 1, duration: 0.6, ease: 'back.out(3)' });
        gsap.to(li, { opacity: 1, x: 0, duration: 0.8, delay: 0.25, ease: 'expo.out' });
      },
      onLeaveBack: () => {
        li._shown = false;
        gsap.to([li._dot, li._ring], { scale: 0, duration: 0.3 });
        gsap.to(li._line, { strokeDashoffset: li._line.style.strokeDasharray, duration: 0.4 });
        gsap.to(li, { opacity: 0, duration: 0.3 });
      }
    });
  });
  gsap.fromTo('.anatomy__bar i', { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: '.anatomy__weight', start: 'top 85%', end: 'top 40%', scrub: true } });
  gsap.from('.anatomy__figure > img', { yPercent: 6, opacity: 0, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: fig, start: 'top 80%' } });
  gsap.from('.helms__row figure', {
    y: 80, opacity: 0, duration: 1.3, stagger: 0.12, ease: 'expo.out',
    scrollTrigger: { trigger: '.helms__row', start: 'top 85%' }
  });

  /* ─────────────── MELEE simulation ─────────────── */
  const field = $('.melee__field');
  const mc = $('.melee__canvas');
  const mx = mc.getContext('2d');
  const result = $('.melee__result');
  const countG = $('[data-team="g"]');
  const countA = $('[data-team="a"]');
  let fighters = [];
  let teamSize = 5;
  let phase = 'ready';
  let fw = 0, fh = 0;
  let melDPR = 1;
  const COLORS = { g: '#d1241b', a: '#2550a8' };

  function sizeMelee() {
    melDPR = Math.min(devicePixelRatio || 1, 2);
    fw = field.clientWidth; fh = field.clientHeight;
    mc.width = fw * melDPR; mc.height = fh * melDPR;
  }
  function form(n) {
    teamSize = n; phase = 'ready';
    sizeMelee();
    fighters = [];
    const r = n >= 150 ? fh / 70 : n >= 30 ? fh / 36 : n >= 12 ? fh / 24 : n >= 5 ? fh / 15 : fh / 9;
    const ranks = n >= 150 ? 10 : n >= 30 ? 5 : n >= 12 ? 3 : 1;
    const perRank = Math.ceil(n / ranks);
    ['g', 'a'].forEach((team) => {
      for (let i = 0; i < n; i++) {
        const rank = Math.floor(i / perRank);
        const idx = i % perRank;
        const inRank = Math.min(perRank, n - rank * perRank);
        const spanY = fh * 0.72;
        const y = fh / 2 + (inRank === 1 ? 0 : (idx / (inRank - 1) - 0.5) * spanY);
        const front = fw * 0.2 + (n === 1 ? fw * 0.06 : 0);
        const x0 = front - rank * r * 2.4;
        const x = team === 'g' ? x0 : fw - x0;
        fighters.push({ team, x, y, vx: 0, vy: 0, r, alive: true, fall: 0, rot: rand(-1, 1), speed: rand(0.75, 1.25), grit: rand(0.6, 1.4), wob: rand(0, 6.28) });
      }
    });
    result.style.opacity = 0;
    updateCounts();
  }
  function updateCounts() {
    countG.textContent = fighters.filter((f) => f.team === 'g' && f.alive).length;
    countA.textContent = fighters.filter((f) => f.team === 'a' && f.alive).length;
  }
  function shieldPath(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x - r * 0.8, y - r * 0.85);
    ctx.lineTo(x + r * 0.8, y - r * 0.85);
    ctx.lineTo(x + r * 0.8, y - r * 0.1);
    ctx.quadraticCurveTo(x + r * 0.75, y + r * 0.7, x, y + r);
    ctx.quadraticCurveTo(x - r * 0.75, y + r * 0.7, x - r * 0.8, y - r * 0.1);
    ctx.closePath();
  }
  function drawMelee(t) {
    mx.setTransform(melDPR, 0, 0, melDPR, 0, 0);
    mx.clearRect(0, 0, fw, fh);
    // downed first
    fighters.forEach((f) => {
      if (f.alive) return;
      mx.save(); mx.translate(f.x, f.y); mx.rotate(f.rot * f.fall * 1.4);
      mx.globalAlpha = 0.85;
      shieldPath(mx, 0, 0, f.r * 0.9);
      mx.fillStyle = f.team === 'g' ? 'rgba(120,40,35,.55)' : 'rgba(40,60,110,.55)'; mx.fill();
      mx.strokeStyle = 'rgba(239,233,222,.35)'; mx.lineWidth = 1;
      mx.beginPath(); mx.moveTo(-f.r * .5, -f.r * .5); mx.lineTo(f.r * .5, f.r * .5); mx.moveTo(f.r * .5, -f.r * .5); mx.lineTo(-f.r * .5, f.r * .5); mx.stroke();
      mx.restore();
    });
    fighters.forEach((f) => {
      if (!f.alive) return;
      const bob = phase === 'ready' ? Math.sin(t * 2 + f.wob) * f.r * 0.06 : 0;
      shieldPath(mx, f.x, f.y + bob, f.r);
      mx.fillStyle = COLORS[f.team]; mx.fill();
      mx.lineWidth = Math.max(1, f.r * 0.08); mx.strokeStyle = '#efe9de'; mx.stroke();
      if (f.r > 9) {
        mx.strokeStyle = 'rgba(239,233,222,.9)'; mx.lineWidth = Math.max(1, f.r * 0.12);
        mx.beginPath();
        if (f.team === 'g') { mx.moveTo(f.x, f.y - f.r * 0.6 + bob); mx.lineTo(f.x, f.y + f.r * 0.6 + bob); mx.moveTo(f.x - f.r * 0.5, f.y - f.r * 0.15 + bob); mx.lineTo(f.x + f.r * 0.5, f.y - f.r * 0.15 + bob); }
        else { mx.moveTo(f.x - f.r * 0.5, f.y - f.r * 0.5 + bob); mx.lineTo(f.x + f.r * 0.5, f.y + f.r * 0.4 + bob); }
        mx.stroke();
      }
    });
  }
  let lastSpark = 0;
  function stepMelee(t) {
    if (phase !== 'fight') return;
    const alive = fighters.filter((f) => f.alive);
    const rect = field.getBoundingClientRect();
    for (const f of alive) {
      let best = null, bd = Infinity;
      for (const e of alive) {
        if (e.team === f.team) continue;
        const d = (e.x - f.x) ** 2 + (e.y - f.y) ** 2;
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) continue;
      const d = Math.sqrt(bd);
      const reach = (f.r + best.r) * 1.05;
      if (d > reach) {
        const sp = f.speed * Math.max(2, fw / 260);
        f.vx += ((best.x - f.x) / d) * sp * 0.25; f.vy += ((best.y - f.y) / d) * sp * 0.25;
      } else if (Math.random() < 0.02 * f.grit * (60 / Math.max(5, teamSize * 0.6 + 4))) {
        best.alive = false;
        gsap.to(best, { fall: 1, duration: 0.5, ease: 'power2.out' });
        best.vx = (best.x - f.x) / d * 3; best.vy = (best.y - f.y) / d * 3;
        if (t - lastSpark > 0.06 && rect.top < innerHeight && rect.bottom > 0) {
          burst(rect.left + best.x, rect.top + best.y, teamSize >= 30 ? 10 : 22, teamSize >= 30 ? 0.5 : 0.8);
          lastSpark = t;
        }
        updateCounts();
      }
      // separation
      for (const o of alive) {
        if (o === f) continue;
        const dx = f.x - o.x, dy = f.y - o.y, dd = Math.hypot(dx, dy) || 0.01, min = (f.r + o.r) * 0.95;
        if (dd < min) { const push = (min - dd) / dd * 0.25; f.vx += dx * push; f.vy += dy * push; }
      }
    }
    for (const f of fighters) {
      f.vx *= f.alive ? 0.82 : 0.86; f.vy *= f.alive ? 0.82 : 0.86;
      f.x = clamp(f.x + f.vx, f.r, fw - f.r); f.y = clamp(f.y + f.vy, f.r + 30, fh - f.r);
    }
    const g = alive.filter((f) => f.team === 'g' && f.alive).length;
    const a = alive.filter((f) => f.team === 'a' && f.alive).length;
    if (!g || !a) {
      phase = 'done';
      const win = g ? 'Gules' : 'Azure';
      const left = g || a;
      result.innerHTML = `${win} holds<br>the field<small>${left} ${left === 1 ? 'knight' : 'knights'} left standing</small>`;
      result.style.color = g ? '#ff5a4f' : '#7aa2ff';
      gsap.fromTo(result, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.8, ease: 'expo.out' });
      $('.melee__charge span').textContent = 'Again';
    }
  }
  let meleeVisible = false;
  ScrollTrigger.create({ trigger: '.melee', start: 'top bottom', end: 'bottom top', onToggle: (s) => (meleeVisible = s.isActive) });
  gsap.ticker.add((t) => { if (!meleeVisible) return; stepMelee(t); drawMelee(t); });
  form(5);
  addEventListener('resize', debounce(() => form(teamSize), 200));
  $$('.melee__tabs button').forEach((b) => b.addEventListener('click', () => {
    $$('.melee__tabs button').forEach((x) => x.classList.toggle('is-active', x === b));
    form(+b.dataset.n);
    $('.melee__charge span').textContent = 'Charge';
  }));
  $('.melee__charge').addEventListener('click', (e) => {
    if (phase === 'done') { form(teamSize); $('.melee__charge span').textContent = 'Charge'; return; }
    if (phase === 'fight') return;
    phase = 'fight';
  });
  gsap.from('.melee__title', { yPercent: 30, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.melee', start: 'top 70%' } });
  gsap.fromTo('.melee__bg', { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: '.melee', start: 'top bottom', end: 'bottom top', scrub: true } });

  /* ─────────────── gallery ─────────────── */
  $$('.gallery__col').forEach((col) => {
    const s = +col.dataset.speed;
    gsap.fromTo(col, { yPercent: -s * 60 }, { yPercent: s * 60, ease: 'none', scrollTrigger: { trigger: '.gallery', start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  $$('.g').forEach((g) => {
    gsap.fromTo(g, { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: g, start: 'top 92%' } });
  });
  gsap.from('.gallery__head h2', { yPercent: 40, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.gallery__head', start: 'top 80%' } });

  /* lightbox */
  const lb = $('.lightbox');
  const lbImg = $('img', lb);
  const lbCap = $('.lightbox__cap', lb);
  function openLb(src, cap) {
    lbImg.src = src; lbCap.textContent = cap || '';
    lb.classList.add('is-open'); lb.setAttribute('aria-hidden', 'false');
    lenis && lenis.stop();
  }
  function closeLb() { lb.classList.remove('is-open'); lb.setAttribute('aria-hidden', 'true'); lenis && lenis.start(); }
  $$('.g, .plate').forEach((el) => el.addEventListener('click', (e) => {
    const img = $('img', el);
    const cap = $('figcaption', el)?.textContent.replace(/^\s*\d+\s·\s*/, '').replace(/^Pl\.\s*\d+\s*/, '');
    openLb(img.currentSrc || img.src, cap);
  }));
  lb.addEventListener('click', closeLb);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLb(); });

  /* ─────────────── marquee: seamless loop ─────────────── */
  const mTrack = $('.marquee__track');
  if (mTrack) {
    const unit = mTrack.firstElementChild.cloneNode(true);
    let mTween = null;
    let marqueeOn = true; // runs by default; the observer below pauses it while off screen
    const buildMarquee = () => {
      mTrack.replaceChildren(unit.cloneNode(true));
      const uw = mTrack.firstElementChild.getBoundingClientRect().width;
      if (!uw) return;
      // each half must be wider than the (rotated, scaled) band, so the loop never shows a gap
      const reps = Math.ceil((mTrack.parentElement.getBoundingClientRect().width * 1.2) / uw);
      const frag = document.createDocumentFragment();
      for (let i = 0; i < reps * 2; i++) frag.appendChild(unit.cloneNode(true));
      mTrack.replaceChildren(frag);
      const half = mTrack.children[reps].getBoundingClientRect().left - mTrack.children[0].getBoundingClientRect().left;
      if (mTween) mTween.kill();
      gsap.set(mTrack, { x: 0 });
      if (reduced) return;
      mTween = gsap.to(mTrack, { x: -half, duration: half / 110, ease: 'none', repeat: -1, paused: !marqueeOn });
    };
    // only animate while the band is on screen (real visibility, independent of scroll-trigger positions)
    new IntersectionObserver(([e]) => {
      marqueeOn = e.isIntersecting;
      if (mTween) { if (marqueeOn) mTween.play(); else mTween.pause(); }
    }).observe(mTrack.parentElement);
    let bandW = 0;
    const rebuild = debounce(buildMarquee, 150);
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
      buildMarquee();
      // rebuild whenever the band's width really changes (window resize, zoom, late layout)
      new ResizeObserver(([e]) => {
        const w = Math.round(e.contentRect.width);
        if (w !== bandW) { bandW = w; rebuild(); }
      }).observe(mTrack.parentElement);
    });
  }

  /* ─────────────── finale ─────────────── */
  gsap.fromTo('.finale__bg', { yPercent: -8 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: '.finale', start: 'top bottom', end: 'bottom top', scrub: true } });
  $$('.finale__title span').forEach((line) => {
    const chars = splitChars(line);
    gsap.from(chars, { yPercent: 100, opacity: 0, rotate: 6, stagger: 0.05, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: '.finale__title', start: 'top 85%' } });
  });

  /* ─────────────── generic reveals ─────────────── */
  $$('.chapter-head').forEach((h) => {
    gsap.from(h.children, { y: 30, opacity: 0, stagger: 0.08, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 85%' } });
    gsap.from($('.chapter-head__rule', h), { scaleX: 0, transformOrigin: 'left', duration: 1.6, ease: 'expo.inOut', scrollTrigger: { trigger: h, start: 'top 85%' } });
  });
  gsap.from('.anatomy__intro > *', { y: 50, opacity: 0, stagger: 0.1, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.anatomy', start: 'top 75%' } });

  /* ─────────────── nav current chapter ─────────────── */
  // the browser tab follows along: "Buhurt – Armour", or just "Buhurt" outside the chapters
  let titleOwner = null;
  $$('.nav__chapters a').forEach((a) => {
    const sec = $(a.getAttribute('href'));
    if (!sec) return;
    const name = a.lastChild.textContent.trim();
    ScrollTrigger.create({
      trigger: sec, start: 'top 50%', end: 'bottom 50%',
      onToggle: (s) => {
        a.classList.toggle('is-current', s.isActive);
        if (s.isActive) { titleOwner = a; document.title = `Buhurt – ${name}`; }
        else if (titleOwner === a) { titleOwner = null; document.title = 'Buhurt'; }
      }
    });
  });

  addEventListener('load', () => ScrollTrigger.refresh());
  // lazy images can change section heights after load: re-measure scroll positions once they arrive
  const refreshSoon = debounce(() => ScrollTrigger.refresh(), 300);
  $$('img[loading="lazy"]').forEach((img) => { if (!img.complete) img.addEventListener('load', refreshSoon, { once: true }); });
})();
