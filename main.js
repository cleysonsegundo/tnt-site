// TNT Propaganda — interações e animações do site
(() => {
  const html = document.documentElement;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
  const seg = (v, a, b) => clamp((v - a) / (b - a));
  const pad = (n, len = 2) => String(Math.round(n)).padStart(len, "0");
  const rand = (a, b) => a + Math.random() * (b - a);
  // Letreiros técnicos: o texto "decodifica" passando por caracteres aleatórios até assentar.
  const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+/<>=_";
  const scramble = (el, duration = 0.9) => {
    if (!el) return;
    const text = el.dataset.text || (el.dataset.text = el.textContent);
    const start = performance.now();
    cancelAnimationFrame(el._scramble);
    const step = (now) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const shown = Math.floor(t * text.length);
      let out = "";
      for (let i = 0; i < text.length; i++) out += i < shown || text[i] === " " ? text[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      el.textContent = out;
      if (t < 1) el._scramble = requestAnimationFrame(step);
    };
    el._scramble = requestAnimationFrame(step);
  };

  // Parâmetros de teste: ?debug pula o carregamento e expõe window.__tnt; ?film=0.5 posiciona a abertura; ?to=#secao rola até uma seção.
  const params = new URLSearchParams(location.search);
  const debugFilm = params.has("film") ? Number(params.get("film")) : null;
  const debugTo = params.get("to");
  const isDebug = debugFilm !== null || !!debugTo || params.has("debug");
  if (isDebug) html.classList.add("is-debug");

  // A experiência começa sempre do topo (a abertura é um filme); links com #seção são tratados depois do carregamento.
  const startHash = location.hash && location.hash.length > 1 ? location.hash : "";
  if (!isDebug && "scrollRestoration" in history) history.scrollRestoration = "manual";
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const isMobile = () => innerWidth <= 900;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  const animated = hasGsap && !reduceMotion;
  if (!animated) html.classList.add("is-reduced");

  $$(".year").forEach((el) => (el.textContent = new Date().getFullYear()));

  /* ---------- Rolagem suave ---------- */
  let lenis = null;
  if (animated) {
    gsap.registerPlugin(ScrollTrigger);
    if (window.SplitText) gsap.registerPlugin(SplitText);
    if (window.Lenis) {
      lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.95 });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    }
  }
  const headerH = () => $(".header").offsetHeight;
  const scrollToTarget = (target, offset = 0) => {
    const el = target === "#inicio" ? 0 : typeof target === "string" ? $(target) : target;
    if (el === null) return;
    if (lenis) lenis.scrollTo(el, { duration: 1.6, offset });
    else if (el === 0) scrollTo({ top: 0, behavior: "smooth" });
    else scrollTo({ top: el.getBoundingClientRect().top + scrollY + offset, behavior: "smooth" });
  };
  $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
    const href = a.getAttribute("href");
    if (href.length < 2) return;
    e.preventDefault();
    closeMenu();
    scrollToTarget(href, href === "#marcas" ? -headerH() : 0);
  }));

  /* ---------- Faíscas da TNT: cliques, aberturas e detonações ---------- */
  const fx = (() => {
    const canvas = $(".fx");
    if (!canvas || reduceMotion) return { burst() {} };
    const ctx = canvas.getContext("2d");
    const parts = [];
    let w = 0, h = 0, running = false;
    const size = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = innerWidth; h = innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    addEventListener("resize", size);
    const BITS = { fire: ["#ffcc00", "#ffffff", "#ffe066", "#3c14ff"], ink: ["#06007c", "#2700e9", "#ffffff", "#0d0195"] };
    function burst(x, y, { count = 24, power = 1, debris = 4, palette = "fire" } = {}) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2, s = (1.6 + Math.random() * 6) * power;
        parts.push({ k: "s", x, y, px: x, py: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - power, life: 1, decay: 0.02 + Math.random() * 0.03, lw: 0.8 + Math.random() * 1.6, hue: 32 + Math.random() * 22, ink: palette === "ink" });
      }
      for (let i = 0; i < debris; i++) {
        const a = Math.random() * Math.PI * 2, s = (1.2 + Math.random() * 4.5) * power;
        const colors = BITS[palette] || BITS.fire;
        parts.push({ k: "b", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2.2 * power, rot: Math.random() * 6.3, vr: rand(-0.3, 0.3), flip: Math.random() * 6.3, vf: rand(0.08, 0.3), size: rand(4, 9) * Math.min(power, 1.4), life: 1, decay: rand(0.007, 0.014), color: colors[(Math.random() * colors.length) | 0] });
      }
      if (!running) { running = true; requestAnimationFrame(loop); }
    }
    function loop() {
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= p.decay;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        if (p.k === "s") {
          p.px = p.x; p.py = p.y;
          p.vy += 0.16; p.vx *= 0.975; p.vy *= 0.975;
          p.x += p.vx; p.y += p.vy;
          ctx.globalCompositeOperation = p.ink ? "source-over" : "lighter";
          ctx.strokeStyle = p.ink ? `hsla(${246 - p.life * 10}, 100%, ${22 + (1 - p.life) * 40}%, ${Math.min(1, p.life * 1.5)})` : `hsla(${p.hue}, 100%, ${58 + p.life * 38}%, ${Math.min(1, p.life * 1.4)})`;
          ctx.lineWidth = p.lw;
          ctx.beginPath(); ctx.moveTo(p.px - p.vx * 1.4, p.py - p.vy * 1.4); ctx.lineTo(p.x, p.y); ctx.stroke();
        } else {
          p.vy += 0.12; p.vx *= 0.985; p.vy *= 0.985;
          p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.flip += p.vf;
          ctx.globalCompositeOperation = "source-over";
          ctx.save();
          ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.cos(p.flip));
          ctx.globalAlpha = Math.min(1, p.life * 2);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
          ctx.restore();
        }
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      if (parts.length) requestAnimationFrame(loop);
      else { running = false; ctx.clearRect(0, 0, w, h); }
    }
    return { burst };
  })();
  /* ---------- Sons gerados na hora (sem arquivos): o clique do interruptor e a lâmpada acendendo ---------- */
  const sfx = (() => {
    const AC = window.AudioContext || window.webkitAudioContext;
    let ac = null;
    const ctx = () => {
      if (!AC) return null;
      ac = ac || new AC();
      if (ac.state === "suspended") ac.resume();
      return ac;
    };
    const noise = (a, dur) => {
      const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = a.createBufferSource();
      src.buffer = buf;
      return src;
    };
    // O "tec" da tecla: um estalo agudo curtinho e um toque grave.
    function click() {
      const a = ctx();
      if (!a) return;
      const t = a.currentTime, n = noise(a, 0.03), bp = a.createBiquadFilter(), g = a.createGain();
      bp.type = "bandpass"; bp.frequency.value = 3200; bp.Q.value = 0.9;
      g.gain.setValueAtTime(0.45, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      n.connect(bp).connect(g).connect(a.destination);
      n.start(t);
      const o = a.createOscillator(), og = a.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.06);
      og.gain.setValueAtTime(0.3, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.connect(og).connect(a.destination);
      o.start(t); o.stop(t + 0.09);
    }
    // O zumbido baixinho da lâmpada acendendo (120 Hz, como na rede elétrica de 60 Hz).
    function hum(dur = 4) {
      const a = ctx();
      if (!a) return;
      const t = a.currentTime, lp = a.createBiquadFilter(), g = a.createGain();
      lp.type = "lowpass"; lp.frequency.value = 650;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      lp.connect(g).connect(a.destination);
      [[120, "sawtooth"], [240, "square"]].forEach(([f, type]) => {
        const o = a.createOscillator();
        o.type = type; o.frequency.value = f;
        o.connect(lp); o.start(t); o.stop(t + dur);
      });
    }
    return { click, hum };
  })();

  // Toda vez que alguém clica, uma pequena faísca: é a TNT (menos no interruptor da abertura, que precisa rodar liso).
  document.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest("input, textarea, select, label, .lightbox, .intro__power")) return;
    const light = e.target.closest(".numbers:not(.is-gl), .tape, .brands, .insights, .srv__row[aria-expanded='true'], .btn--yellow");
    fx.burst(e.clientX, e.clientY, { count: 14, power: 0.65, debris: 3, palette: light ? "ink" : "fire" });
  });

  /* ---------- Menu do celular ---------- */
  const menuBtn = $(".header__menu");
  const menu = $("#menu");
  function closeMenu() {
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    menuBtn.setAttribute("aria-expanded", "false");
    lenis?.start();
  }
  menuBtn?.addEventListener("click", () => {
    const open = menu.hidden;
    menu.hidden = !open;
    menuBtn.setAttribute("aria-expanded", String(open));
    if (open) {
      lenis?.stop();
      if (animated) gsap.from(".menu__nav a", { yPercent: 60, opacity: 0, stagger: 0.06, duration: 0.8, ease: "expo.out" });
    } else lenis?.start();
  });
  addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

  /* ---------- Formulário: abre o WhatsApp com a mensagem pronta (com detonação) ---------- */
  const contactForm = $("#form-contato");
  const composeMsg = (data, preview = false) => [
    `Olá, TNT! Sou ${data.get("nome") || (preview ? "…" : "")}${data.get("empresa") ? `, da ${data.get("empresa")}` : ""}.`,
    `Tenho interesse em: ${data.get("servico")}.`,
    data.get("mensagem"),
  ].filter(Boolean).join("\n");
  contactForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const r = $(".form__send").getBoundingClientRect();
    fx.burst(r.left + r.width / 2, r.top + r.height / 2, { count: 70, power: 1.8, debris: 26 });
    if (animated) gsap.fromTo(".form", { x: 0 }, { keyframes: { x: [0, -10, 9, -6, 4, 0] }, duration: 0.45 });
    window.open(`https://wa.me/557536324879?text=${encodeURIComponent(composeMsg(new FormData(e.target)))}`, "_blank", "noopener");
  });
  // Prévia ao vivo: a mensagem vai se montando no balão do WhatsApp enquanto a pessoa digita.
  const waText = $(".wa__text"), waMsg = $(".wa__msg");
  const renderWa = (pop) => {
    if (!contactForm || !waText) return;
    waText.textContent = composeMsg(new FormData(contactForm), true);
    if (pop && animated) gsap.fromTo(waMsg, { scale: 0.96 }, { scale: 1, duration: 0.4, ease: "back.out(3)", overwrite: true });
  };
  contactForm?.addEventListener("input", () => renderWa(true));
  renderWa(false);

  /* ---------- Ampliação de trabalhos (galeria e serviços) ---------- */
  const lightbox = $(".lightbox");
  const lbFig = $("figure", lightbox);
  const lbImg = $("img", lightbox);
  const lbCap = $("figcaption", lightbox);
  let lbList = [], lbIndex = 0;
  function showLb(i, dir = 0) {
    lbIndex = (i + lbList.length) % lbList.length;
    const item = lbList[lbIndex];
    lbImg.style.width = "";
    lbImg.onload = () => {
      // Artes pequenas aparecem um pouco maiores, sem perder nitidez demais.
      const n = lbImg.naturalWidth;
      if (n && n < 520) lbImg.style.width = `${Math.min(n * 1.6, innerWidth - 120, (innerHeight * 0.78 * n) / lbImg.naturalHeight)}px`;
    };
    lbImg.src = item.src;
    lbImg.alt = item.alt;
    lbCap.textContent = item.caption;
    $$(".lightbox__nav", lightbox).forEach((b) => (b.hidden = lbList.length < 2));
    if (animated) {
      gsap.fromTo(lbFig,
        dir ? { x: dir * 90, rotationY: dir * -28, autoAlpha: 0, scale: 0.92 } : { y: 70, rotationX: 22, autoAlpha: 0, scale: 0.86 },
        { x: 0, y: 0, rotationX: 0, rotationY: 0, autoAlpha: 1, scale: 1, duration: 0.8, ease: "expo.out", transformPerspective: 1200 });
    }
  }
  function openLightbox(list, i) {
    lbList = list;
    lightbox.hidden = false;
    lenis?.stop();
    showLb(i);
    $(".lightbox__close").focus();
  }
  function closeLightbox() { lightbox.hidden = true; lenis?.start(); }
  const workItems = $$(".work__media").map((b) => {
    const meta = b.parentElement.querySelector(".work__meta");
    return { el: b, src: b.dataset.full, alt: $("img", b).alt, caption: `${$("h3", meta).textContent} — ${$("p", meta).textContent}` };
  });
  workItems.forEach((it, i) => it.el.addEventListener("click", () => openLightbox(workItems, i)));
  $$(".srv__panel").forEach((panel) => {
    const items = $$(".srv__work", panel).map((b) => ({ el: b, src: b.dataset.full, alt: $("img", b).alt, caption: b.dataset.caption }));
    items.forEach((it, i) => it.el.addEventListener("click", () => openLightbox(items, i)));
  });
  $(".lightbox__close").addEventListener("click", closeLightbox);
  $(".lightbox__nav--prev").addEventListener("click", () => showLb(lbIndex - 1, -1));
  $(".lightbox__nav--next").addEventListener("click", () => showLb(lbIndex + 1, 1));
  lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });
  addEventListener("keydown", (e) => {
    if (lightbox.hidden) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowRight" && lbList.length > 1) showLb(lbIndex + 1, 1);
    if (e.key === "ArrowLeft" && lbList.length > 1) showLb(lbIndex - 1, -1);
  });

  /* ---------- Serviços: clique em um serviço para ver os trabalhos ---------- */
  // Recalcular a página inteira é pesado: enquanto a abertura roda, o pedido fica guardado para depois.
  let refreshT, refreshHeld = false;
  const refreshSoon = () => {
    if (!animated) return;
    if (html.classList.contains("is-gated")) { refreshHeld = true; return; }
    clearTimeout(refreshT);
    refreshT = setTimeout(() => ScrollTrigger.refresh(), 160);
  };
  const srvRows = $$(".srv__row");
  function setPanel(btn, open) {
    const panel = document.getElementById(btn.getAttribute("aria-controls"));
    btn.setAttribute("aria-expanded", String(open));
    if (!animated) { panel.hidden = !open; return; }
    gsap.killTweensOf(panel);
    if (open) {
      panel.hidden = false;
      const items = $$(".srv__work, .srv__logo, .srv__onair, .srv__audio-copy, .srv__more", panel);
      gsap.fromTo(panel, { height: 0 }, {
        height: "auto", duration: 0.9, ease: "expo.inOut",
        onComplete: () => {
          panel.style.height = "";
          refreshSoon();
          const r = panel.getBoundingClientRect();
          if (r.bottom > innerHeight || btn.getBoundingClientRect().top < headerH()) scrollToTarget(btn.closest(".srv__item"), -headerH() - 16);
        },
      });
      gsap.fromTo(items,
        { autoAlpha: 0, y: 80, rotationY: -55, rotationX: 14, z: -260, transformOrigin: "50% 100%" },
        { autoAlpha: 1, y: 0, rotationY: 0, rotationX: 0, z: 0, duration: 1.1, ease: "expo.out", stagger: 0.08, delay: 0.22 });
      const r = $(".srv__plus", btn).getBoundingClientRect();
      fx.burst(r.left + r.width / 2, r.top + r.height / 2, { count: 26, power: 0.9, debris: 7, palette: "ink" });
    } else {
      gsap.to(panel, { height: 0, duration: 0.6, ease: "expo.inOut", onComplete: () => { panel.hidden = true; panel.style.height = ""; refreshSoon(); } });
    }
  }
  srvRows.forEach((btn) => btn.addEventListener("click", () => {
    const open = btn.getAttribute("aria-expanded") === "true";
    srvRows.forEach((b) => { if (b !== btn && b.getAttribute("aria-expanded") === "true") setPanel(b, false); });
    setPanel(btn, !open);
  }));

  /* ---------- Abertura: tudo escuro até alguém apertar o interruptor ---------- */
  const gateSwitch = $(".intro__power .switch");
  const neonParts = $$(".intro__halo, .intro__glow, .intro__logo");
  // Em modo de teste não há porta: a luz já começa acesa.
  const gated = !!gateSwitch && !isDebug;
  const lightNeon = () => neonParts.forEach((el) => (el.style.opacity = "1"));
  // Coisas pesadas (como preparar as partículas dos números) esperam a abertura terminar.
  let siteOpened;
  const afterOpen = new Promise((r) => (siteOpened = r));
  const openSite = () => {
    html.classList.remove("is-gated");
    html.classList.add("is-lit");
    lenis?.start();
    if (refreshHeld) { refreshHeld = false; refreshSoon(); }
    siteOpened();
  };
  if (gated) {
    html.classList.add("is-gated");
    lenis?.stop();
    requestAnimationFrame(() => gateSwitch.focus({ preventScroll: true }));
  } else {
    html.classList.add("is-lit");
    lightNeon();
    siteOpened();
  }

  if (!animated) {
    // Sem animações: o clique acende o letreiro inteiro de uma vez e libera o site.
    if (gated) gateSwitch.addEventListener("click", () => {
      gateSwitch.setAttribute("aria-pressed", "true");
      sfx.click();
      lightNeon();
      $(".intro__power").style.display = "none";
      openSite();
    }, { once: true });
    $(".whats")?.classList.add("is-on");
    return;
  }

  /* =======================================================================
     A partir daqui: animações (GSAP + ScrollTrigger). Nenhuma seção usa "pin":
     as partes presas na tela usam position: sticky (CSS), então a ordem dos
     cálculos não pode mais fazer uma seção cobrir a outra.
     ======================================================================= */

  /* ---------- Cursor ---------- */
  if (finePointer) {
    const cursor = $(".cursor");
    cursor.classList.add("is-hidden");
    const dot = $(".cursor__dot"), ring = $(".cursor__ring"), label = $(".cursor__label");
    const dx = gsap.quickTo(dot, "x", { duration: 0.12, ease: "power3" }), dy = gsap.quickTo(dot, "y", { duration: 0.12, ease: "power3" });
    const rx = gsap.quickTo(ring, "x", { duration: 0.5, ease: "power3" }), ry = gsap.quickTo(ring, "y", { duration: 0.5, ease: "power3" });
    addEventListener("pointermove", (e) => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); cursor.classList.remove("is-hidden"); }, { passive: true });
    document.addEventListener("pointerleave", () => cursor.classList.add("is-hidden"));
    document.addEventListener("pointerover", (e) => {
      const view = e.target.closest("[data-cursor]");
      const link = e.target.closest("a, button, label");
      const open = view?.matches(".srv__row[aria-expanded='true']");
      cursor.classList.toggle("is-view", !!view);
      cursor.classList.toggle("is-link", !view && !!link);
      if (view) label.textContent = open ? "Fechar" : view.dataset.cursor;
    });
  }

  /* ---------- Botões magnéticos ---------- */
  if (finePointer) {
    $$(".btn").forEach((btn) => {
      const x = gsap.quickTo(btn, "x", { duration: 0.6, ease: "elastic.out(1, 0.4)" });
      const y = gsap.quickTo(btn, "y", { duration: 0.6, ease: "elastic.out(1, 0.4)" });
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        x((e.clientX - r.left - r.width / 2) * 0.22);
        y((e.clientY - r.top - r.height / 2) * 0.3);
      });
      btn.addEventListener("pointerleave", () => { x(0); y(0); });
    });
  }

  const header = $(".header");
  const film = $(".film");

  /* =======================================================================
     ABERTURA: a marca da TNT com a lâmpada acesa
     ======================================================================= */
  const intro = $(".intro");
  const ringPath = (el) => (el ? $("path", el) : null);
  const neonWrap = $(".intro__neon"), neonHalo = $(".intro__halo");
  const BULB = [433 / 633, 220 / 517];   // centro da lâmpada dentro do logo
  const BULB_ORIGIN = `${(BULB[0] * 100).toFixed(2)}% ${(BULB[1] * 100).toFixed(2)}%`;
  // Durante a abertura a marca cresce a partir do próprio centro; depois, o mergulho é na lâmpada.
  gsap.set(neonWrap, { transformOrigin: gated ? "50% 50%" : BULB_ORIGIN });
  // Onde o logo fica sem nenhuma transformação, e onde está o centro da lâmpada na tela.
  function neonRest() {
    const saved = neonWrap.style.transform;
    neonWrap.style.transform = "none";
    const r = neonWrap.getBoundingClientRect();
    neonWrap.style.transform = saved;
    return { r, ox: r.left + r.width * BULB[0], oy: r.top + r.height * BULB[1] };
  }
  // No escuro, a marca fica bem no meio da tela, maior.
  function neonGatePose() {
    const { r } = neonRest();
    const s = (isMobile() ? Math.min(innerWidth * 0.78, 360) : Math.min(innerWidth * 0.4, 580)) / r.width;
    return { x: innerWidth / 2 - (r.left + r.width / 2), y: innerHeight / 2 - (r.top + r.height / 2), scale: s };
  }
  // Ao rolar, a câmera mergulha na lâmpada: o centro dela vai para o meio da tela e cresce até virar luz.
  let diveCache = null;
  addEventListener("resize", () => (diveCache = null));
  function diveTarget() {
    if (diveCache) return diveCache;
    const { ox, oy } = neonRest();
    return (diveCache = { x: innerWidth / 2 - ox, y: innerHeight / 2 - oy, s: isMobile() ? 14 : 10 });
  }
  const dive = { p: 0 };
  function applyDive() {
    if (html.classList.contains("is-gated")) return;
    const D = diveTarget(), p = dive.p;
    gsap.set(neonWrap, { x: D.x * p, y: D.y * p, scale: 1 + (D.s - 1) * p });
    neonHalo.style.opacity = Math.min(1, 1 + p * 1.4).toFixed(3);
  }


  /* =======================================================================
     ABERTURA: a arte sendo construída
     ======================================================================= */
  const pin = $(".film__pin");
  const ws = $(".ws"), boardWrap = $(".board-wrap"), board = $(".board"), kv = $(".kv");
  const kvContent = $(".kv__content");
  const kvPhoto = $(".kv__photo"), kvImgs = $$(".kv__img"), kvGraded = $(".kv__graded"), kvShade = $(".kv__shade");
  const kvBar = $(".kv__bar"), kvLogo = $(".kv__logo"), kvHandle = $(".kv__handle");
  const ovThirds = $(".ov--thirds"), ovCrop = $(".ov--crop"), ovGrid = $(".ov--grid"), ovSplit = $(".ov--split");
  const ovSelect = $(".ov--select"), ovSelectLabel = $(".ov--select b"), ovCursor = $(".ov--cursor");
  const brief = $(".brief"), toast = $(".toast"), stage = $(".stage");
  const phone = $(".phone"), bb = $(".bb"), tvset = $(".tvset"), radio = $(".radio"), worldCopy = $(".world__copy");
  const flash = $(".flash");
  const steps = $$(".ws__steps li"), props = $$(".prop"), layerRows = $$(".layers li");
  const layersCount = $(".layers__count"), propSel = $(".prop__sel");
  const tlSec = $(".tl__sec"), tlFr = $(".tl__fr"), zoomLabel = $(".ws__zoom");
  const exportRows = $$(".exports li");

  // Brilho de "renderização" que passa pela arte na exportação.
  const kvShine = document.createElement("i");
  kvShine.className = "kv__shine";
  kv.append(kvShine);
  // Cursor de digitação.
  const caret = document.createElement("i");
  caret.className = "kv__caret";
  kvContent.append(caret);

  // Cada texto da arte vira letras para o efeito de digitação.
  function splitChars(el) {
    const chars = [];
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          for (const c of child.textContent) {
            const s = document.createElement("span");
            s.className = "ch";
            s.textContent = c;
            frag.append(s);
            chars.push(s);
          }
          child.replaceWith(frag);
        } else walk(child);
      });
    };
    walk(el);
    return chars;
  }
  const typing = [
    { chars: splitChars($(".kv__kicker")), from: 52, to: 54, layer: "kicker" },
    { chars: splitChars($(".kv__title")), from: 54, to: 61.5, layer: "title" },
    { chars: splitChars($(".kv__sub")), from: 61.5, to: 63.6, layer: "sub" },
  ];
  typing.forEach((g) => (g.shown = -1));

  const LAYER_ON = { photo: 24.6, grade: 37.4, shade: 46.4, kicker: 52, title: 54, sub: 61.5, logo: 65, handle: 66.4 };
  const STEP_AT = [0, 24, 36, 50, 64, 76];
  const SELECTION = [
    { at: 64, el: kvLogo, name: "Logo TNT", layer: "logo" },
    { at: 67, el: $(".kv__title"), name: "Título", layer: "title" },
    { at: 70, el: $(".kv__kicker"), name: "Chamada", layer: "kicker" },
    { at: 73, el: $(".kv__sub"), name: "Assinatura", layer: "sub" },
  ];
  let curStep = -1, curSel = -1, worldActive = false;

  function relRect(el) {
    // Posição do elemento dentro da arte (sem considerar transformações).
    let x = 0, y = 0, n = el;
    while (n && n !== kv) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  }

  function filmState(p) {
    const t = p * 100;
    worldActive = t > 86;

    // Etapa atual: abas, propriedades.
    let step = 0;
    STEP_AT.forEach((at, i) => { if (t >= at) step = i; });
    if (step !== curStep) {
      curStep = step;
      steps.forEach((li, i) => { li.classList.toggle("is-on", i === step); li.classList.toggle("is-done", i < step); });
      props.forEach((el, i) => el.classList.toggle("is-on", i === step));
    }

    // Digitação dos textos.
    let typingNow = null;
    typing.forEach((g) => {
      const shown = Math.floor(seg(t, g.from, g.to) * g.chars.length + 0.0001);
      if (shown !== g.shown) {
        g.chars.forEach((c, i) => c.classList.toggle("is-hidden", i >= shown));
        g.shown = shown;
      }
      if (t >= g.from && t < g.to + 0.4) typingNow = g;
    });
    if (typingNow && t < 64) {
      const n = typingNow.shown;
      const ref = typingNow.chars[Math.max(0, n - 1)];
      const r = relRect(ref);
      caret.style.left = `${n === 0 ? r.x : r.x + r.w}px`;
      caret.style.top = `${r.y + r.h * 0.08}px`;
      caret.style.height = `${r.h * 0.84}px`;
      caret.style.opacity = (Math.floor(t * 4) % 2 === 0 || n < typingNow.chars.length) ? 1 : 0;
    } else caret.style.opacity = 0;

    // Seleção de camadas na composição.
    let sel = -1;
    if (t >= 64 && t < 76) SELECTION.forEach((s, i) => { if (t >= s.at) sel = i; });
    if (sel !== curSel) {
      curSel = sel;
      if (sel >= 0) {
        const s = SELECTION[sel];
        const r = relRect(s.el);
        const padPx = board.offsetWidth * 0.012;
        Object.assign(ovSelect.style, { left: `${r.x - padPx}px`, top: `${r.y - padPx}px`, width: `${r.w + padPx * 2}px`, height: `${r.h + padPx * 2}px` });
        ovSelectLabel.textContent = `${s.name} · ${Math.round((r.w / board.offsetWidth) * 1080)} × ${Math.round((r.h / board.offsetWidth) * 1080)}`;
        propSel.textContent = s.name;
        gsap.to(ovCursor, { x: r.x + r.w * 0.82, y: r.y + r.h * 0.9, duration: 0.6, ease: "power3.out" });
      }
    }
    const selVis = seg(t, 64.2, 65) * (1 - seg(t, 75.4, 76));
    ovSelect.style.opacity = selVis;
    ovCursor.style.opacity = selVis;

    // Painel de camadas.
    let on = 0, active = null;
    if (step === 1) active = "photo";
    else if (step === 2) active = t < 46.4 ? "grade" : "shade";
    else if (step === 3) active = typingNow?.layer ?? "title";
    else if (step === 4 && sel >= 0) active = SELECTION[sel].layer;
    layerRows.forEach((li) => {
      const isOn = t >= LAYER_ON[li.dataset.layer];
      if (isOn) on++;
      li.classList.toggle("is-on", isOn);
      li.classList.toggle("is-active", isOn && li.dataset.layer === active && t < 76);
    });
    layersCount.textContent = on;

    // Linha do tempo (o filme dura "30 segundos") e zoom.
    const tp = seg(t, 12.4, 84);
    pin.style.setProperty("--tl", tp.toFixed(4));
    const frames = Math.round(tp * 30 * 25);
    tlSec.textContent = pad(Math.floor(frames / 25));
    tlFr.textContent = pad(frames % 25);
    zoomLabel.textContent = `${Math.round(25 + seg(t, 12.4, 34) * 41)}%`;
    exportRows.forEach((li, i) => li.classList.toggle("is-done", t >= 78.4 + i * 1.5));

    worldCopy.classList.toggle("is-live", t > 95);
  }

  // Destino da arte no fim: a área da foto no celular.
  let flipCache = null;
  function offsetIn(el, root) {
    let x = 0, y = 0, n = el;
    while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  }
  function flip() {
    if (flipCache) return flipCache;
    const b = offsetIn(board, pin), m = offsetIn($(".post__media"), pin);
    flipCache = { x: m.x + m.w / 2 - (b.x + b.w / 2), y: m.y + m.h / 2 - (b.y + b.h / 2), s: m.w / b.w };
    return flipCache;
  }
  ScrollTrigger.addEventListener("refreshInit", () => { flipCache = null; curSel = -1; });

  // Estados iniciais.
  gsap.set([ws, boardWrap, stage], { autoAlpha: 0 });
  gsap.set(board, { rotationX: 34, rotationY: -40, rotationZ: -8, z: -1300, scale: 0.7 });
  gsap.set(kvPhoto, { autoAlpha: 0, scale: 1.08 });
  gsap.set(kvGraded, { clipPath: "inset(0% 100% 0% 0%)" });
  gsap.set([kvShade, kvLogo, kvHandle], { autoAlpha: 0 });
  gsap.set(kvBar, { scaleX: 0 });
  gsap.set([brief, toast], { autoAlpha: 0 });
  gsap.set([phone, bb, tvset, radio], { autoAlpha: 0 });
  gsap.set(worldCopy, { autoAlpha: 0 });

  // A seção .film tem a altura de 8,4 telas (6,8 no celular) e a área .film__pin fica presa (sticky);
  // o filme avança conforme a rolagem percorre a seção.
  const filmTl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: { trigger: film, start: "top top", end: "bottom bottom", scrub: true },
    onUpdate: () => filmState(filmTl.progress()),
  });
  const counter = (key, from, to, at, dur, dec = 0, bar = null) => {
    const el = $(`[data-num="${key}"]`);
    const o = { v: from };
    filmTl.fromTo(o, { v: from }, {
      v: to, duration: dur, ease: "power2.inOut",
      onUpdate: () => {
        el.textContent = dec ? o.v.toFixed(dec) : Math.round(o.v);
        if (bar) bar.style.setProperty("--v", Math.abs((o.v - from) / (to - from || 1)) * bar.dataset.max);
      },
    }, at);
  };

  filmTl
    // 0–12: a câmera mergulha na lâmpada acesa até a luz tomar a tela
    .to(".intro__cue", { autoAlpha: 0, duration: 1.6 }, 0.4)
    .to(".intro__copy", { autoAlpha: 0, y: -60, duration: 5, ease: "power1.in" }, 1.6)
    .fromTo(".intro__ring", { scale: 1 }, { scale: 2.4, autoAlpha: 0, duration: 7.5, ease: "power2.in" }, 2.2)
    .to(dive, { p: 1, duration: 9.2, ease: "power3.in", onUpdate: applyDive }, 2.6)
    .to(flash, { opacity: 1, duration: 1.2 }, 10.4)
    .fromTo(flash, { "--fr": "0vmax" }, { "--fr": "190vmax", duration: 2, ease: "power2.in" }, 10.2)
    .to(intro, { autoAlpha: 0, duration: 0.2 }, 12.4)
    .to([ws, boardWrap], { autoAlpha: 1, duration: 0.2 }, 12.4)
    .to(flash, { opacity: 0, duration: 2.6 }, 12.6)
    // 12–34: a câmera mergulha e assenta na prancheta
    .to(board, { rotationX: 12, rotationY: -16, rotationZ: -2, z: -280, scale: 0.86, duration: 9.6, ease: "power2.out" }, 12.4)
    .to(board, { rotationX: 0, rotationY: 0, rotationZ: 0, z: 0, scale: 1, duration: 12, ease: "power2.inOut" }, 22)
    // 13–24: briefing
    .fromTo(brief, { autoAlpha: 0, y: 60, rotation: -4 }, { autoAlpha: 1, y: 0, rotation: -1.2, duration: 3, ease: "power3.out" }, 13.6)
    .from(".brief dl > div, .brief footer", { autoAlpha: 0, x: -14, stagger: 0.6, duration: 1.2 }, 15.2)
    .to(brief, { autoAlpha: 0, x: () => -innerWidth * (isMobile() ? 0.7 : 0.34), y: 40, rotation: -9, scale: 0.6, duration: 3.4, ease: "power2.in" }, 21.4)
    // 24–36: a foto de Salvador à noite entra e é enquadrada (a câmera desliza até o Elevador Lacerda)
    .to(kvPhoto, { autoAlpha: 1, scale: 1, duration: 2.4, ease: "power2.out" }, 24)
    .to([ovCrop, ovThirds], { autoAlpha: 1, duration: 1 }, 25)
    .fromTo(kvImgs, { "--px": "-84cqw", "--ps": 1.3 }, { "--px": "-34cqw", "--ps": 1, duration: 7.6, ease: "power2.inOut" }, 25.6)
    .to([ovCrop, ovThirds], { autoAlpha: 0, duration: 1 }, 34)
    // 36–50: tratamento de cor (antes e depois)
    .to(ovSplit, { autoAlpha: 1, duration: 0.8 }, 36.6)
    .fromTo(kvGraded, { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 8, ease: "power1.inOut" }, 37.4)
    .fromTo(ovSplit, { "--split": "0cqw" }, { "--split": "100cqw", duration: 8, ease: "power1.inOut" }, 37.4)
    .to(ovSplit, { autoAlpha: 0, duration: 0.8 }, 45.6)
    .to(".curves__line", { attr: { d: "M0 120 C34 108 76 24 120 0" }, duration: 6, ease: "power2.inOut" }, 37.4)
    .to(kvShade, { autoAlpha: 1, duration: 3 }, 46.4)
    // 50–64: tipografia
    .to(ovGrid, { autoAlpha: 1, duration: 1.2 }, 50)
    .to(kvBar, { scaleX: 1, duration: 1.2, ease: "power2.out" }, 51)
    // 64–76: composição
    .fromTo(kvLogo, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 1.6, ease: "back.out(2)" }, 65)
    .to(kvHandle, { autoAlpha: 1, duration: 1.2 }, 66.4)
    // 76–84: exportação e aprovação
    .to(ovGrid, { autoAlpha: 0, duration: 1 }, 76)
    .fromTo(kvShine, { xPercent: -120 }, { xPercent: 120, duration: 3.4, ease: "power1.inOut" }, 77)
    .fromTo(toast, { autoAlpha: 0, y: -18 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: "power3.out" }, 81.6)
    // 84–100: a campanha no mundo, em Salvador à noite
    .to(toast, { autoAlpha: 0, duration: 1 }, 85)
    .to(ws, { autoAlpha: 0, duration: 3 }, 84.4)
    .to(stage, { autoAlpha: 1, duration: 3 }, 84.6)
    .fromTo(ringPath($(".stage__ring")), { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 6.5, ease: "power2.inOut" }, 85.2)
    .fromTo(".stage__photo img", { scale: 1.25 }, { scale: 1.05, duration: 12, ease: "power2.out" }, 84.6)
    .to(kv, { boxShadow: "0px 0px 0px 0px rgba(0,0,0,0), 0px 0px 0px 0px rgba(255,255,255,0)", borderRadius: 0, duration: 4 }, 86)
    .to(board, { x: () => flip().x, y: () => flip().y, scale: () => flip().s, duration: 6, ease: "power3.inOut" }, 85.4)
    .fromTo(phone, { autoAlpha: 0, y: 70 }, { autoAlpha: 1, y: 0, duration: 4, ease: "power3.out" }, 87.4)
    .fromTo(bb, { autoAlpha: 0, y: 60, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: 4, ease: "power3.out" }, 88.2)
    .fromTo(tvset, { autoAlpha: 0, y: 70 }, { autoAlpha: 1, y: 0, duration: 4, ease: "power3.out" }, 89.4)
    .fromTo(radio, { autoAlpha: 0, y: 70 }, { autoAlpha: 1, y: 0, duration: 4, ease: "power3.out" }, 90.4)
    .fromTo(worldCopy, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 4, ease: "power3.out" }, 93)
    .set({}, {}, 100);

  // Números do painel de propriedades.
  counter("scale", 130, 100, 25.6, 7.6);
  counter("posx", 82, 34, 25.6, 7.6);
  const bars = $$(".kv-list--bars > div i");
  [[0.3, "exp", 0, 0.15, 2], [0.62, "con", 0, 24, 0], [0.5, "tem", 0, 18, 0], [0.5, "sat", 0, 20, 0]].forEach(([max, key, from, to, dec], i) => {
    bars[i].dataset.max = max;
    counter(key, from, to, 37.6 + i * 0.6, 6, dec, bars[i]);
  });
  counter("size", 0, 104, 54, 4);
  exportRows.forEach((li, i) => filmTl.fromTo(li, { "--e": 0 }, { "--e": 1, duration: 1.4 }, 77 + i * 1.5));
  filmState(0);

  // Cena final em 3D: cada objeto está numa profundidade diferente e se desloca com o mouse.
  const depthEls = [[$(".stage__photo"), -0.5], [$(".stage__ring"), -0.85], [bb, 0.4], [tvset, 1], [radio, 1.2]];
  const cam = { x: 0, y: 0, tx: 0, ty: 0 };
  if (finePointer) pin.addEventListener("pointermove", (e) => { cam.tx = e.clientX / innerWidth - 0.5; cam.ty = e.clientY / innerHeight - 0.5; });
  let worldWas = false;
  gsap.ticker.add((time) => {
    if (!worldActive) {
      if (worldWas) { depthEls.forEach(([el]) => (el.style.translate = "")); worldWas = false; }
      return;
    }
    worldWas = true;
    if (!finePointer) { cam.tx = Math.sin(time * 0.35) * 0.18; cam.ty = Math.cos(time * 0.27) * 0.1; }
    cam.x += (cam.tx - cam.x) * 0.06; cam.y += (cam.ty - cam.y) * 0.06;
    depthEls.forEach(([el, d]) => (el.style.translate = `${(-cam.x * d * 46).toFixed(2)}px ${(-cam.y * d * 30).toFixed(2)}px`));
  });

  /* ---------- Entrada da abertura (quando a luz da sala acende) ---------- */
  $$(".intro__line").forEach((line) => { line.innerHTML = `<span class="intro__in">${line.innerHTML}</span>`; line.style.overflow = "clip"; line.style.paddingBottom = "0.06em"; });
  function introIn() {
    const tl = gsap.timeline();
    // O balão acende como um letreiro: pisca e firma, crescendo um pouquinho (sem redesenhar o traço, que é pesado).
    tl.fromTo(".intro__ring", { opacity: 0 }, { keyframes: { opacity: [0, 1, 0.35, 1, 0.6, 1] }, duration: 1.1, ease: "none" }, 0.15)
      .fromTo(".intro__ring", { scale: 0.92 }, { scale: 1, duration: 1.5, ease: "expo.out" }, 0.15)
      .from(".intro__in", { yPercent: 110, duration: 1.3, ease: "expo.out", stagger: 0.1 }, 0.3)
      .from(".intro__copy .eyebrow, .intro__lead", { autoAlpha: 0, y: 20, duration: 1, ease: "power3.out", stagger: 0.1 }, 0.4)
      .from(".intro__cue > *", { autoAlpha: 0, y: 12, duration: 0.8, stagger: 0.08 }, 0.9);
    return tl;
  }

  /* ---------- O interruptor: a marca surge no meio do escuro, cresce e vai para o lugar dela ---------- */
  const powerBox = $(".intro__power"), hint = $(".intro__hint");
  function powerOn() {
    return new Promise((resolve) => {
      if (!gated) { resolve(); return; }
      const pose = () => gsap.set(neonWrap, neonGatePose());
      pose();
      addEventListener("resize", pose);
      // Quem tenta rolar no escuro ganha um empurrãozinho na frase.
      const nudge = () => gsap.fromTo(hint, { x: 0 }, { keyframes: { x: [0, -7, 7, -4, 4, 0] }, duration: 0.45, overwrite: true });
      addEventListener("wheel", nudge, { passive: true });
      addEventListener("touchmove", nudge, { passive: true });
      let tl = null;
      gateSwitch.addEventListener("click", () => {
        // Um segundo clique só apressa a sequência.
        if (tl) { tl.timeScale(3); return; }
        removeEventListener("resize", pose);
        removeEventListener("wheel", nudge);
        removeEventListener("touchmove", nudge);
        gateSwitch.setAttribute("aria-pressed", "true");
        // O som sai um instante depois: o primeiro quadro da animação não espera o áudio ficar pronto.
        setTimeout(() => sfx.click(), 0);
        const P = neonGatePose();
        tl = gsap.timeline();
        // O interruptor sai de cena assim que é ligado.
        tl.to(powerBox, { autoAlpha: 0, scale: 0.94, duration: 0.35, ease: "power2.in", onComplete: () => (powerBox.style.display = "none") }, 0)
          // A marca surge no meio do escuro, pequena, e vem crescendo na direção de quem vê...
          .fromTo(neonWrap, { scale: P.scale * 0.5 }, { scale: P.scale, duration: 2, ease: "power3.out" }, 0.2)
          .fromTo(".intro__logo", { opacity: 0 }, { opacity: 1, duration: 1.1, ease: "power2.out" }, 0.2)
          // ...com a lâmpada acesa: o brilho cresce junto e dá uma piscadinha no fim, como lâmpada de verdade.
          .fromTo(".intro__glow", { opacity: 0 }, { opacity: 1, duration: 1.4, ease: "power2.inOut" }, 0.5)
          .fromTo(".intro__halo", { opacity: 0 }, { opacity: 1, duration: 1.8, ease: "power2.out" }, 0.6)
          .to(".intro__glow", { keyframes: { opacity: [1, 0.55, 1, 0.8, 1] }, duration: 0.45, ease: "none" }, 1.95)
          .add(() => sfx.hum(2.2), 0.6)
          // ...e segue crescendo devagar até a luz tomar a sala. Aí a marca vai para o lugar dela e o site começa.
          .to(neonWrap, { scale: P.scale * 1.08, duration: 1.1, ease: "sine.inOut" }, 2.2)
          .addLabel("room", 3.1)
          .add(() => introIn(), "room")
          .to(".intro__dark", { autoAlpha: 0, duration: 1.3, ease: "power2.inOut" }, "room")
          .to(neonWrap, { x: 0, y: 0, scale: 1, duration: 1.35, ease: "expo.inOut" }, "room")
          .add(() => {
            // Daqui em diante o centro das transformações é a lâmpada (para o mergulho ao rolar).
            gsap.set(neonWrap, { transformOrigin: BULB_ORIGIN });
            openSite();
            resolve();
          }, "room+=1.35");
      });
    });
  }


  /* =======================================================================
     SEÇÕES
     ======================================================================= */
  // Dentro de áreas presas (sticky) a referência é a seção inteira, que não se move.
  const triggerFor = (el) => el.closest(".works__pin, .spot__pin") ? el.closest("section") : el;

  if (window.SplitText) {
    // Títulos: as letras chegam de todos os lados e se montam quando o título entra na tela.
    // A montagem roda inteira sozinha (não depende de onde a rolagem parou): as letras sempre terminam no lugar.
    $$("[data-explode]").forEach((el) => {
      const trig = triggerFor(el);
      const own = trig === el;
      SplitText.create(el, {
        type: "words,chars", charsClass: "ch3d", autoSplit: true,
        onSplit: (self) => gsap.from(self.chars, {
          x: () => rand(-170, 170), y: () => rand(-150, 130), z: () => rand(-520, 260),
          rotationX: () => rand(-110, 110), rotationY: () => rand(-80, 80), rotationZ: () => rand(-50, 50),
          autoAlpha: 0, transformPerspective: 700, duration: 1.3, ease: "expo.out",
          stagger: { each: 0.012, from: "random" },
          scrollTrigger: { trigger: trig, start: own ? "top 88%" : "top 72%", toggleActions: "play none none none" },
        }),
      });
    });
    // Parágrafos de destaque: linhas sobem de dentro de uma máscara.
    $$("[data-lines]").forEach((el) => {
      SplitText.create(el, {
        type: "lines", mask: "lines", autoSplit: true,
        onSplit: (self) => gsap.from(self.lines, { yPercent: 110, duration: 1.2, ease: "expo.out", stagger: 0.09, scrollTrigger: { trigger: el, start: "top 86%", once: true } }),
      });
    });
    // Quem somos: palavras acendem com a rolagem.
    $$("[data-fill]").forEach((el) => {
      SplitText.create(el, {
        type: "words", autoSplit: true,
        onSplit: (self) => gsap.fromTo(self.words, { opacity: 0.13 }, { opacity: 1, stagger: 0.1, ease: "none", scrollTrigger: { trigger: el, start: "top 78%", end: "bottom 42%", scrub: true } }),
      });
    });
  }

  // A lâmpada da TNT: pisca, acende de vez e os raios se acendem um a um; inclina com o mouse.
  const lit = $(".lit");
  if (lit) {
    const glow = [".lit__body", ".lit__core", ".lit__halo"];
    gsap.set(glow, { opacity: 0.12 });
    gsap.set(".lit__ray", { opacity: 0.12, scale: 0.55, transformOrigin: "50% 50%" });
    gsap.timeline({ scrollTrigger: { trigger: lit, start: "top 78%", once: true }, onComplete: () => lit.classList.add("is-on") })
      .to(glow, { opacity: 1, duration: 0.06 }, 0.15)
      .to(glow, { opacity: 0.2, duration: 0.05 }, "+=0.09")
      .to(glow, { opacity: 0.95, duration: 0.05 }, "+=0.12")
      .to(glow, { opacity: 0.35, duration: 0.04 }, "+=0.06")
      .to(glow, { opacity: 1, duration: 0.3, ease: "power2.out" }, "+=0.08")
      .to(".lit__ray", { opacity: 1, scale: 1, duration: 0.55, ease: "back.out(2.6)", stagger: 0.09 }, "-=0.1");
    if (finePointer) {
      const stageEl = $(".lit__stage"), bulb = $(".lit__bulb");
      stageEl.addEventListener("pointermove", (e) => {
        const r = stageEl.getBoundingClientRect();
        gsap.to(bulb, { "--ty": `${((e.clientX - r.left) / r.width - 0.5) * 34}deg`, "--tx": `${((e.clientY - r.top) / r.height - 0.5) * -26}deg`, duration: 0.6, ease: "power3.out" });
      });
      stageEl.addEventListener("pointerleave", () => gsap.to(bulb, { "--tx": "0deg", "--ty": "0deg", duration: 1, ease: "elastic.out(1, 0.5)" }));
    }
    // Um clique apaga a lâmpada; outro clique faz ela piscar e acender de novo.
    const litStage = $(".lit__stage");
    const setLit = (on) => {
      litStage.setAttribute("aria-pressed", String(on));
      litStage.dataset.cursor = on ? "Apagar" : "Acender";
      sfx.click();
      if (!on) { lit.classList.add("is-off"); return; }
      [[0, false], [80, true], [150, false], [240, true], [330, false]].forEach(([ms, off]) => setTimeout(() => lit.classList.toggle("is-off", off), ms));
      setTimeout(() => {
        const r = $(".lit__bulb").getBoundingClientRect();
        fx.burst(r.left + r.width * 0.5, r.top + r.height * 0.42, { count: 30, power: 1, debris: 0 });
      }, 340);
    };
    litStage.addEventListener("click", () => setLit(lit.classList.contains("is-off")));
    litStage.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      setLit(lit.classList.contains("is-off"));
    });
  }

  // Inclinação 3D que segue o mouse (foto do relógio).
  if (finePointer) {
    $$("[data-tilt]").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        gsap.to(el, { rotationY: ((e.clientX - r.left) / r.width - 0.5) * 18, rotationX: ((e.clientY - r.top) / r.height - 0.5) * -14, transformPerspective: 900, duration: 0.6, ease: "power3.out" });
      });
      el.addEventListener("pointerleave", () => gsap.to(el, { rotationX: 0, rotationY: 0, duration: 1, ease: "elastic.out(1, 0.5)" }));
    });
  }

  // Blocos que entram de baixo.
  gsap.utils.toArray(".manifesto__body p, .manifesto__fig, .services__side > *, .brands__top p, .tip, .contact__info, .form, .city__cols > *, .insights__aside > p, .lit figcaption, .method__list .mstep p").forEach((el) => {
    gsap.from(el, { autoAlpha: 0, y: 44, duration: 1.1, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } });
  });

  // O balão amarelo se desenha conforme a seção entra na tela.
  $$(".balao[data-draw]").forEach((svg) => {
    gsap.fromTo($("path", svg), { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: "none", scrollTrigger: { trigger: svg.parentElement, start: "top 85%", end: "top 15%", scrub: true } });
    gsap.fromTo(svg, { rotation: -8 }, { rotation: 6, ease: "none", scrollTrigger: { trigger: svg.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
  });

  // Tarja amarela: corre sozinha e acelera (e inclina) com a velocidade da rolagem.
  const tapeRow = $(".tape__row");
  let tapeX = 0, scrollVel = 0;
  ScrollTrigger.create({ start: 0, end: "max", onUpdate: (self) => { scrollVel = self.getVelocity(); } });
  gsap.ticker.add(() => {
    scrollVel *= 0.92;
    const half = tapeRow.scrollWidth / 2;
    tapeX -= 1.1 + Math.min(Math.abs(scrollVel) / 260, 14);
    if (tapeX <= -half) tapeX += half;
    tapeRow.style.transform = `translate3d(${tapeX}px, 0, 0) skewX(${clamp(-scrollVel / 400, -10, 10)}deg)`;
  });

  /* ---------- Números: milhares de partículas formam +15, 360°, 24/7 e o logo da TNT ---------- */
  const numSec = $(".numbers"), numPin = $(".numbers__pin");
  const strongDevice = (navigator.hardwareConcurrency || 8) > 4;
  const numEng = window.TNT3D ? TNT3D.particles($(".numbers__gl"), { count: isMobile() ? 10000 : strongDevice ? 22000 : 14000, layers: isMobile() ? 5 : strongDevice ? 10 : 6 }) : null;
  if (numEng) {
    numSec.classList.add("is-gl");
    $$(".numbers__sep").forEach((s) => s.remove());
    const lis = $$(".numbers__list li"), idxEl = $(".numbers__idx b"), bars = $$(".numbers__bar i");
    $(".numbers__meta b").textContent = numEng.count.toLocaleString("pt-BR");
    const loadImg = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
    // A textura do número sólido acompanha a tela: mais nítida no computador.
    const res = isMobile() ? 1000 : 1600;
    // Preparar as formas é trabalho pesado: fica para depois que a abertura termina.
    Promise.all([afterOpen, document.fonts?.load('900 100px "League Spartan"'), loadImg("assets/brand/logo-tnt-branco.png")]).then(([, , logo]) => setTimeout(() => {
      numEng.setShapes([...["+15", "360°", "24/7"].map((t) => TNT3D.textShape(t, { res })), logo ? TNT3D.imageShape(logo, { res }) : TNT3D.textShape("TNT", { res })]);
    }, 400));
    const N = { w: 1, h: 1, morph: 0, target: 0, enter: 0, enterT: 0, mx: 0, my: 0, tmx: 0, tmy: 0, px: -1e5, py: -1e5, on: false, idx: -1, seg: null, flash: 0, forged: false };
    const sizeNum = () => { N.w = numPin.clientWidth; N.h = numPin.clientHeight; numEng.resize(N.w, N.h, Math.min(devicePixelRatio || 1, 1.5)); };
    sizeNum();
    new ResizeObserver(sizeNum).observe(numPin);
    // Cada forma fica um tempo parada (sólida, legível); entre uma e outra, as partículas explodem e se remontam.
    const HOLD = 0.17, MOVE = (1 - HOLD * 4) / 3;
    const morphAt = (p) => { const i = Math.floor(p / (HOLD + MOVE)), r = p - i * (HOLD + MOVE); return Math.min(3, r < HOLD ? i : i + (r - HOLD) / MOVE); };
    ScrollTrigger.create({ trigger: numSec, start: "top bottom", end: "top top", onUpdate: (s) => (N.enterT = s.progress), onRefresh: (s) => (N.enterT = s.progress) });
    ScrollTrigger.create({ trigger: numSec, start: "top top", end: "bottom bottom", onUpdate: (s) => (N.target = morphAt(s.progress)), onRefresh: (s) => (N.target = morphAt(s.progress)) });
    ScrollTrigger.create({ trigger: numSec, start: "top bottom", end: "bottom top", onToggle: (s) => (N.on = s.isActive) });
    if (finePointer) {
      numPin.addEventListener("pointermove", (e) => {
        const r = numPin.getBoundingClientRect();
        N.px = e.clientX - r.left; N.py = e.clientY - r.top;
        N.tmx = N.px / r.width - 0.5; N.tmy = N.py / r.height - 0.5;
      });
      numPin.addEventListener("pointerleave", () => { N.px = N.py = -1e5; N.tmx = N.tmy = 0; });
    }
    gsap.ticker.add((time, dt) => {
      if (!N.on) return;
      const f = 1 - Math.pow(0.9, dt / 16.7);
      N.morph += (N.target - N.morph) * f;
      N.enter += (N.enterT - N.enter) * f;
      N.mx += (N.tmx - N.mx) * f * 0.6;
      N.my += (N.tmy - N.my) * f * 0.6;
      const mobile = isMobile();
      const cx = mobile ? N.w * 0.5 : N.w * 0.38, cy = (mobile ? N.h * 0.4 : N.h * 0.5) + Math.sin(time * 0.8) * 5;
      const frac = N.morph - Math.floor(N.morph);
      const i = Math.round(N.morph);
      // Perto de uma forma inteira, o número fica sólido; ao "forjar", um clarão.
      const solid = clamp(1 - Math.abs(N.morph - i) / 0.06) ** 2 * clamp((N.enter - 0.85) / 0.15);
      if (solid > 0.5 && !N.forged) { N.forged = true; N.flash = 1; }
      if (solid < 0.05) N.forged = false;
      N.flash = Math.max(0, N.flash - dt / 650);
      numEng.draw({
        morph: N.morph, enter: N.enter, time, blast: 0.6, size: mobile ? 2.4 : 2.8,
        scale: mobile ? N.w * 0.44 : Math.min(N.w * 0.28, 540), cx, cy,
        rx: 0.05 - N.my * 0.2 + Math.sin(time * 0.33) * 0.03,
        ry: N.mx * 0.3 + Math.sin(time * 0.4) * 0.07 + Math.sin(Math.PI * frac) * 0.6,
        mx: N.px, my: N.py, solid, idx: i, flash: N.flash,
      });
      if (i !== N.idx) {
        N.idx = i;
        lis.forEach((li, k) => li.classList.toggle("is-on", k === i));
        idxEl.textContent = pad(i + 1);
        bars.forEach((b, k) => b.classList.toggle("is-on", k <= i));
        scramble($("small", lis[i]), 0.7);
      }
      // É TNT: cada troca de forma detona.
      const seg = Math.floor(N.morph + 0.7);
      if (N.seg !== null && seg !== N.seg && N.enter > 0.95) {
        const r = numPin.getBoundingClientRect();
        fx.burst(r.left + cx, r.top + cy, { count: 46, power: 1.5, debris: 12 });
      }
      N.seg = seg;
    });
  } else {
    // Sem WebGL: a faixa amarela com os números detonando.
    const numItems = $$(".numbers__list li:not(.numbers__extra)");
    numItems.forEach((li) => { const c = $("[data-count]", li); if (c) c.textContent = "0"; });
    gsap.set(".numbers__big", { autoAlpha: 0 });
    gsap.set(".numbers__list li > span", { autoAlpha: 0, y: 30 });
    ScrollTrigger.create({
      trigger: ".numbers", start: "top 72%", once: true,
      onEnter: () => numItems.forEach((li, i) => {
        const big = $(".numbers__big", li), shk = $(".numbers__shock", li), num = $("[data-count]", li);
        const tl = gsap.timeline({ delay: i * 0.32 });
        tl.fromTo(big, { scale: 0.12, rotation: -16, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 0.95, ease: "back.out(2.6)" })
          .add(() => {
            const r = big.getBoundingClientRect();
            fx.burst(r.left + r.width * 0.45, r.top + r.height * 0.5, { count: 38, power: 1.35, debris: 16, palette: "ink" });
          }, 0.1)
          .fromTo(shk, { autoAlpha: 0.95, scale: 0.3 }, { autoAlpha: 0, scale: 3.6, duration: 1.15, ease: "power2.out" }, 0.08)
          .to(li, { keyframes: { x: [0, -9, 8, -5, 3, 0] }, duration: 0.45 }, 0.1)
          .to($(":scope > span", li), { autoAlpha: 1, y: 0, duration: 0.8, ease: "power3.out" }, 0.35);
        if (num) {
          const end = Number(num.dataset.count), o = { v: 0 };
          tl.to(o, { v: end, duration: 1.4, ease: "power3.out", onUpdate: () => (num.textContent = Math.round(o.v)) }, 0);
        }
      }),
    });
  }

  /* ---------- Trabalhos: galeria 3D (coverflow) ---------- */
  const worksSec = $(".works"), track = $(".works__track"), cards = $$(".work");
  const worksCount = $(".works__count b");
  let worksP = 0, worksDist = 0, worksActive = false;
  const setWorksDist = () => {
    worksDist = isMobile() ? 0 : Math.max(0, Math.round(track.scrollWidth - innerWidth));
    worksSec.style.setProperty("--works-dist", `${worksDist}px`);
  };
  setWorksDist();
  ScrollTrigger.addEventListener("refreshInit", setWorksDist);
  new ResizeObserver(() => { const before = worksDist; setWorksDist(); if (before !== worksDist) refreshSoon(); }).observe(track);
  const worksST = ScrollTrigger.create({ trigger: worksSec, start: "top top", end: "bottom bottom", onUpdate: (self) => (worksP = self.progress), onRefresh: (self) => (worksP = self.progress) });
  // No computador, quando a pessoa para de rolar no meio dos trabalhos, a arte mais próxima desliza até o centro.
  let worksSnapT = null;
  function snapWorks() {
    if (isMobile() || !lenis || !worksDist) return;
    const p = worksST.progress, span = worksST.end - worksST.start;
    if (p <= 0.002 || p >= 0.998) return;
    const left0 = track.getBoundingClientRect().left + p * worksDist;
    let best = p, bestGap = Infinity;
    cards.forEach((card) => {
      const target = clamp((left0 + card.offsetLeft + card.offsetWidth / 2 - innerWidth / 2) / worksDist);
      if (Math.abs(target - p) < bestGap) { bestGap = Math.abs(target - p); best = target; }
    });
    if (bestGap * span < 6) return;
    lenis.scrollTo(worksST.start + best * span, { duration: 0.75, easing: (t) => 1 - Math.pow(1 - t, 3) });
  }
  lenis?.on("scroll", () => {
    clearTimeout(worksSnapT);
    if (worksActive) worksSnapT = setTimeout(snapWorks, 260);
  });
  ScrollTrigger.create({ trigger: worksSec, start: "top bottom", end: "bottom top", onToggle: (self) => (worksActive = self.isActive) });
  // Entrada das artes: controlada aqui (e não por um tween no próprio card) para não brigar com o 3D quadro a quadro.
  const worksIn = { v: 0 };
  let worksEntered = false;
  const tilts = cards.map(() => ({ x: 0, y: 0, tx: 0, ty: 0 }));
  if (finePointer) {
    cards.forEach((card, i) => {
      const m = $(".work__media", card);
      // Brilho holográfico recortado no formato da própria arte (as TVs ficam sem).
      let glare = null;
      if (card.dataset.kind !== "tv") {
        glare = document.createElement("i");
        glare.className = "work__glare";
        if (card.dataset.kind === "cutout") {
          const mask = `url("${$("img", m).src}")`;
          glare.style.webkitMaskImage = mask;
          glare.style.maskImage = mask;
        }
        m.appendChild(glare);
      }
      m.addEventListener("pointermove", (e) => {
        const r = m.getBoundingClientRect();
        tilts[i].tx = (e.clientX - r.left) / r.width - 0.5;
        tilts[i].ty = (e.clientY - r.top) / r.height - 0.5;
        if (!glare) return;
        glare.style.setProperty("--gx", `${((tilts[i].tx + 0.5) * 100).toFixed(1)}%`);
        glare.style.setProperty("--gy", `${((tilts[i].ty + 0.5) * 100).toFixed(1)}%`);
        glare.style.setProperty("--hx", `${(50 - tilts[i].tx * 120).toFixed(1)}%`);
        glare.style.setProperty("--hy", `${(50 - tilts[i].ty * 120).toFixed(1)}%`);
      });
      m.addEventListener("pointerleave", () => { tilts[i].tx = 0; tilts[i].ty = 0; });
    });
  }
  const floorGrid = $(".works__floor i");
  let lastCount = -1;
  gsap.ticker.add((time) => {
    if (!worksActive) return;
    if (!worksEntered && worksSec.getBoundingClientRect().top < innerHeight * 0.7) {
      worksEntered = true;
      gsap.to(worksIn, { v: 1, duration: 2.2, ease: "expo.out" });
    }
    const mobile = isMobile();
    const x = mobile ? 0 : -worksP * worksDist;
    track.style.transform = mobile ? "" : `translate3d(${x.toFixed(1)}px, 0, 0)`;
    const tr = track.getBoundingClientRect();
    const scrollL = mobile ? track.scrollLeft : 0;
    floorGrid.style.transform = `translate3d(${((x - scrollL) % 110).toFixed(1)}px, 0, 0)`;
    const cx = innerWidth / 2;
    let best = 0, bestD = Infinity;
    cards.forEach((card, i) => {
      const c = tr.left + card.offsetLeft - scrollL + card.offsetWidth / 2;
      const d = clamp((c - cx) / (innerWidth * 0.55), -1.6, 1.6);
      if (Math.abs(d) < bestD) { bestD = Math.abs(d); best = i; }
      const tl = tilts[i];
      tl.x += (tl.tx - tl.x) * 0.1; tl.y += (tl.ty - tl.y) * 0.1;
      const e = clamp(worksIn.v * 1.6 - i * 0.045);
      // Artes dos lados giram de frente para o centro e recuam; a do meio fica de frente para quem vê.
      const ry = -d * 34 + tl.x * 18 + (1 - e) * -50;
      const rx = -tl.y * 14 + (1 - e) * 18;
      const z = -Math.abs(d) * 280 + (Math.abs(tl.x) + Math.abs(tl.y)) * 60 - (1 - e) * 260;
      const bob = Math.sin(time * 1.1 + i * 0.9) * 6 + (1 - e) * 110;
      card.style.transform = `translate3d(0, ${bob.toFixed(2)}px, ${z.toFixed(1)}px) rotateY(${ry.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg)`;
      card.style.opacity = ((1 - Math.min(Math.abs(d), 1.4) * 0.3) * e).toFixed(3);
    });
    if (best !== lastCount) { lastCount = best; worksCount.textContent = pad(best + 1); }
  });

  /* ---------- Marcas: onda 3D ao entrar e inclinação com o mouse ---------- */
  gsap.from(".brands__grid li", { rotationY: -90, autoAlpha: 0, transformOrigin: "0% 50%", duration: 1.1, ease: "expo.out", stagger: { grid: "auto", from: "start", amount: 0.9 }, scrollTrigger: { trigger: ".brands__grid", start: "top 82%", once: true } });
  if (finePointer) {
    $$(".brands__grid li").forEach((li) => {
      li.addEventListener("pointermove", (e) => {
        const r = li.getBoundingClientRect();
        gsap.to(li, { rotationY: ((e.clientX - r.left) / r.width - 0.5) * 22, rotationX: ((e.clientY - r.top) / r.height - 0.5) * -22, duration: 0.5, ease: "power3.out" });
      });
      li.addEventListener("pointerleave", () => gsap.to(li, { rotationX: 0, rotationY: 0, duration: 0.9, ease: "elastic.out(1, 0.5)" }));
    });
  }

  /* ---------- Serviços: as linhas entram em cascata ---------- */
  gsap.from(".srv__item", { autoAlpha: 0, y: 34, rotationX: -40, transformOrigin: "50% 0%", transformPerspective: 900, duration: 1, ease: "expo.out", stagger: 0.07, scrollTrigger: { trigger: ".srv", start: "top 85%", once: true } });

  /* ---------- Método: as palavras giram em 3D e se preenchem de amarelo ---------- */
  $$(".mstep__word").forEach((w) => {
    gsap.fromTo(w, { "--fill": "0%" }, { "--fill": "100%", ease: "none", scrollTrigger: { trigger: w, start: "top 82%", end: "top 38%", scrub: true } });
    // O giro em 3D roda inteiro quando a palavra aparece (nunca fica torta no meio do caminho).
    gsap.fromTo(w, { rotationX: -80, y: 70, autoAlpha: 0.1 }, { rotationX: 0, y: 0, autoAlpha: 1, transformPerspective: 800, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: w, start: "top 92%", toggleActions: "play none none none" } });
  });

  /* ---------- Método: cada etapa tem um efeito no mouse ---------- */
  // Ouvir: ondas que se espalham como som. Rabiscar: um traço de lápis amarelo. Criar: faíscas.
  const mList = $(".method__list");
  if (finePointer && mList) {
    const cv = document.createElement("canvas");
    cv.className = "method__fx";
    cv.setAttribute("aria-hidden", "true");
    mList.append(cv);
    const c2 = cv.getContext("2d");
    const msteps = $$(".mstep", mList);
    const rings = [], trail = [];
    let MW = 0, MH = 0, lastEmit = 0, running = false;
    const sizeFx = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      MW = mList.offsetWidth; MH = mList.offsetHeight;
      cv.width = MW * dpr; cv.height = MH * dpr;
      c2.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    sizeFx();
    new ResizeObserver(sizeFx).observe(mList);
    function drawFx(now) {
      c2.clearRect(0, 0, MW, MH);
      for (let i = rings.length - 1; i >= 0; i--) {
        const k = (now - rings[i].t) / 1100;
        if (k >= 1) { rings.splice(i, 1); continue; }
        c2.strokeStyle = `rgba(255, 204, 0, ${(0.75 * (1 - k)).toFixed(3)})`;
        c2.lineWidth = 2 * (1 - k) + 0.5;
        c2.beginPath(); c2.arc(rings[i].x, rings[i].y, 6 + k * 90, 0, Math.PI * 2); c2.stroke();
      }
      while (trail.length && now - trail[0].t > 1400) trail.shift();
      c2.lineCap = "round";
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1], b = trail[i];
        if (b.brk) continue;
        const k = 1 - (now - b.t) / 1400;
        c2.strokeStyle = `rgba(255, 214, 51, ${k.toFixed(3)})`;
        c2.lineWidth = 3.2 * k + 0.6;
        c2.beginPath(); c2.moveTo(a.x, a.y); c2.lineTo(b.x, b.y); c2.stroke();
      }
      if (rings.length || trail.length) requestAnimationFrame(drawFx);
      else { running = false; c2.clearRect(0, 0, MW, MH); }
    }
    mList.addEventListener("pointermove", (e) => {
      const r = mList.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, now = performance.now();
      const mode = msteps.findIndex((li) => { const b = li.getBoundingClientRect(); return e.clientY >= b.top && e.clientY <= b.bottom; });
      if (mode === 0 && now - lastEmit > 110) { rings.push({ x, y, t: now }); lastEmit = now; }
      if (mode === 1) {
        const prev = trail[trail.length - 1];
        trail.push({ x: x + rand(-1.4, 1.4), y: y + rand(-1.4, 1.4), t: now, brk: !prev || now - prev.t > 140 });
      }
      if (mode === 2 && now - lastEmit > 45) { fx.burst(e.clientX, e.clientY, { count: 5, power: 0.55, debris: Math.random() < 0.3 ? 1 : 0 }); lastEmit = now; }
      if (!running && (rings.length || trail.length)) { running = true; requestAnimationFrame(drawFx); }
    });
  }

  /* ---------- Salvador: revelada por um balão TNT que cresce ---------- */
  const cityMedia = $(".city__media");
  gsap.fromTo(cityMedia, { "--ms": "26%", "--ring-o": 1 }, { "--ms": () => (isMobile() ? "640%" : "430%"), "--ring-o": 0, ease: "power2.in", scrollTrigger: { trigger: ".city", start: "top 82%", end: "top 4%", scrub: true, invalidateOnRefresh: true } });
  gsap.fromTo(cityMedia, { yPercent: -7 }, { yPercent: 7, ease: "none", scrollTrigger: { trigger: ".city", start: "top bottom", end: "bottom top", scrub: true } });
  $$("[data-parallax] img").forEach((img) => gsap.fromTo(img, { yPercent: -9 }, { yPercent: 6, ease: "none", scrollTrigger: { trigger: img.parentElement, start: "top bottom", end: "bottom top", scrub: true } }));
  gsap.from(".city__clock b", { yPercent: 100, autoAlpha: 0, rotationX: -90, transformPerspective: 600, stagger: 0.12, duration: 1, ease: "expo.out", scrollTrigger: { trigger: ".city__clock", start: "top 88%", once: true } });
  // Visor: quando a foto termina de aparecer, a mira trava no Farol da Barra.
  const citySec = $(".city"), cityTarget = $(".city__target");
  const FAROL = [540 / 1694, 500 / 1080];
  const placeTarget = () => {
    const W = cityMedia.offsetWidth, H = cityMedia.offsetHeight, s = Math.max(W / 1694, H / 1080);
    cityTarget.style.left = `${((W - 1694 * s) / 2 + FAROL[0] * 1694 * s).toFixed(1)}px`;
    cityTarget.style.top = `${((H - 1080 * s) / 2 + FAROL[1] * 1080 * s).toFixed(1)}px`;
  };
  placeTarget();
  new ResizeObserver(placeTarget).observe(cityMedia);
  ScrollTrigger.create({
    trigger: citySec, start: "top 12%",
    onEnter: () => { citySec.classList.add("is-hud"); $$(".city__readout span:not(:last-child)").forEach((s, i) => setTimeout(() => scramble(s, 0.8), i * 160)); },
    onLeaveBack: () => citySec.classList.remove("is-hud"),
  });

  /* ---------- O que cabe em 30 segundos: estúdio de áudio ---------- */
  const studio = $(".studio");
  const spotPhases = $$(".spot__phases li"), zones = $$(".studio__zones i");
  // Tela baixa (notebook): o conjunto encolhe só o necessário para caber inteiro na área presa — nada fica cortado.
  const spotPin = $(".spot__pin"), spotGrid = $(".spot__grid");
  function fitSpot() {
    spotGrid.style.removeProperty("--fit");
    if (isMobile()) return;
    // Mede com uma etapa aberta (o estado mais alto), sem esperar a animação dela.
    const longest = spotPhases.reduce((a, li) => ($(":scope > span", li).textContent.length > $(":scope > span", a).textContent.length ? li : a));
    const probe = spotPhases.some((li) => li.classList.contains("is-on")) ? null : longest;
    const probeText = probe && $(":scope > span", probe);
    if (probe) { probeText.style.transition = "none"; probe.classList.add("is-on"); }
    const pr = spotPin.getBoundingClientRect(), cs = getComputedStyle(spotPin);
    const top = pr.top + parseFloat(cs.paddingTop), bottom = pr.bottom - parseFloat(cs.paddingBottom);
    let t = Infinity, b = -Infinity;
    // Conta tudo o que aparece, menos as ondas animadas em volta do rádio e as letras soltas do título
    // (antes de se montarem elas ficam espalhadas; vale a caixa do título). O rádio é contado à parte.
    $$("*", spotGrid).forEach((el) => {
      if (el.closest(".studio__waves, .studio__radio") || el.parentElement.closest("[data-explode]")) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      t = Math.min(t, r.top); b = Math.max(b, r.bottom);
    });
    // O rádio em cima do painel pode usar o espaço livre do topo (ele é só decorativo).
    const radioTop = $(".studio__radio", spotGrid).getBoundingClientRect().top;
    if (probe) { probe.classList.remove("is-on"); probeText.style.transition = ""; }
    const g = spotGrid.getBoundingClientRect(), cy = g.top + g.height / 2;
    const fit = Math.min(1,
      (cy - top) / Math.max(1, cy - t + 12),
      (bottom - cy) / Math.max(1, b - cy + 12),
      (cy - pr.top - 6) / Math.max(1, cy - radioTop));
    if (fit < 0.995) spotGrid.style.setProperty("--fit", fit.toFixed(3));
  }
  fitSpot();
  ScrollTrigger.addEventListener("refresh", fitSpot);
  const studioTime = $(".studio__time b"), studioPhase = $(".studio__phase"), studioDb = $(".studio__db"), vus = $$(".vu");
  // Trilhas do spot: onde cada som acontece (em segundos) e com que intensidade.
  const TRACKS = {
    voz: { rgb: [255, 204, 0], clips: [[0.5, 4.6, 0.9], [5.4, 14.6, 0.75], [25.5, 29.6, 0.95]], speech: true },
    trilha: { rgb: [140, 120, 255], clips: [[0, 30, 1]], env: (s) => (s < 5 ? 0.45 : s < 15 ? 0.28 : s < 25 ? 0.95 : 0.35) },
    efeitos: { rgb: [61, 220, 255], clips: [[0, 1.2, 1], [14.3, 15.7, 0.85], [24.7, 26, 0.9], [28.7, 30, 1]], hit: true },
  };
  const noise = (s, k) => 0.5 + 0.5 * Math.sin(s * (13.1 + k) + Math.sin(s * (5.3 + k * 0.7)) * 2.1) * Math.sin(s * (2.7 + k * 0.3) + 1.3);
  function amp(spec, s) {
    for (const [a, b, g] of spec.clips) {
      if (s < a || s > b) continue;
      let v = g * (spec.env ? spec.env(s) : 1);
      if (spec.speech) v *= 0.25 + 0.75 * Math.abs(Math.sin((s - a) * 8.7)) * noise(s, 1);
      else if (spec.hit) v *= Math.exp(-(s - a) * 2.6) * (0.6 + 0.4 * noise(s, 3));
      else v *= 0.55 + 0.45 * noise(s, 2);
      return clamp(v);
    }
    return 0;
  }
  function drawLane(canvas, spec, played) {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = r.width * dpr; canvas.height = r.height * dpr;
    const c = canvas.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, r.width, r.height);
    const [R, G, B] = spec.rgb;
    for (const [a, b] of spec.clips) {
      const x0 = (a / 30) * r.width, x1 = (b / 30) * r.width;
      c.fillStyle = `rgba(${R},${G},${B},${played ? 0.22 : 0.09})`;
      c.beginPath();
      if (c.roundRect) c.roundRect(x0 + 1, 3, Math.max(4, x1 - x0 - 2), r.height - 6, 6);
      else c.rect(x0 + 1, 3, Math.max(4, x1 - x0 - 2), r.height - 6);
      c.fill();
    }
    const step = 3, mid = r.height / 2;
    c.fillStyle = `rgba(${R},${G},${B},${played ? 1 : 0.38})`;
    for (let x = 0; x < r.width; x += step) {
      const v = amp(spec, (x / r.width) * 30);
      if (!v) continue;
      const hh = Math.max(1.5, v * (r.height / 2 - 6));
      c.fillRect(x, mid - hh, 2, hh * 2);
    }
  }
  const lanes = $$(".track__lane canvas").map((cv) => {
    const played = cv.cloneNode();
    played.classList.add("is-played");
    cv.after(played);
    return { base: cv, played, spec: TRACKS[cv.dataset.track] };
  });
  const drawLanes = () => lanes.forEach((l) => { drawLane(l.base, l.spec, false); drawLane(l.played, l.spec, true); });
  drawLanes();
  ScrollTrigger.addEventListener("refresh", drawLanes);
  const levelAt = (s) => Math.max(amp(TRACKS.voz, s), amp(TRACKS.trilha, s) * 0.8, amp(TRACKS.efeitos, s));

  let spotS = 0, lastSec = -1, lastPhase = -1, spotActive = false;
  function updateSpot(p) {
    studio.style.setProperty("--sp", p.toFixed(4));
    spotS = p * 30;
    studio.classList.toggle("is-live", p > 0.003 && p < 0.997);
    const sec = Math.min(30, Math.floor(spotS + 0.0001));
    if (sec !== lastSec) { lastSec = sec; studioTime.textContent = pad(sec); }
    const phase = spotS < 5 ? 0 : spotS < 15 ? 1 : spotS < 25 ? 2 : 3;
    if (phase !== lastPhase) {
      lastPhase = phase;
      spotPhases.forEach((li, i) => { li.classList.toggle("is-on", i === phase); li.classList.toggle("is-done", i < phase); });
      zones.forEach((z, i) => z.classList.toggle("is-on", i === phase));
      studioPhase.textContent = $("strong", spotPhases[phase]).textContent;
    }
  }
  updateSpot(0);
  ScrollTrigger.create({
    trigger: ".spot", scrub: true,
    start: () => (isMobile() ? "top 60%" : "top top"),
    end: () => (isMobile() ? "bottom 85%" : "bottom bottom"),
    onUpdate: (self) => updateSpot(self.progress),
    onRefresh: (self) => updateSpot(self.progress),
  });
  ScrollTrigger.create({ trigger: ".spot", start: "top bottom", end: "bottom top", onToggle: (self) => (spotActive = self.isActive) });
  const rig = { x: 0, y: 0, tx: 0, ty: 0 };
  if (finePointer) {
    studio.addEventListener("pointermove", (e) => {
      const r = studio.getBoundingClientRect();
      rig.tx = (e.clientX - r.left) / r.width - 0.5;
      rig.ty = (e.clientY - r.top) / r.height - 0.5;
    });
    studio.addEventListener("pointerleave", () => { rig.tx = 0; rig.ty = 0; });
  }
  gsap.ticker.add((time) => {
    if (!spotActive) return;
    const live = studio.classList.contains("is-live");
    const base = live ? levelAt(spotS) : 0;
    let peak = 0;
    vus.forEach((v, i) => {
      const lv = live ? clamp(base * (0.72 + 0.28 * Math.sin(time * (19 + i * 6) + i * 2))) : 0;
      peak = Math.max(peak, lv);
      v.style.setProperty("--lv", lv.toFixed(3));
    });
    studioDb.textContent = live && peak > 0.02 ? `${(-36 + peak * 36).toFixed(1)} dB` : "−∞ dB";
    if (!isMobile()) {
      rig.x += (rig.tx - rig.x) * 0.08; rig.y += (rig.ty - rig.y) * 0.08;
      const p = spotS / 30;
      studio.style.setProperty("--ry", `${(-20 + p * 12 + rig.x * 14).toFixed(2)}deg`);
      studio.style.setProperty("--rx", `${(10 - p * 4 - rig.y * 10).toFixed(2)}deg`);
    }
  });

  // Rodapé: faixa contínua.
  gsap.to(".footer__row", { xPercent: -50, duration: 38, ease: "none", repeat: -1 });

  // Cabeçalho: some ao descer, volta ao subir; fica sólido depois da abertura.
  const filmST = filmTl.scrollTrigger;
  const progressBar = $(".progress i"), rail = $(".rail");
  const syncHeader = (dir = 0) => {
    const y = scrollY, past = y > filmST.end - 10, max = ScrollTrigger.maxScroll(window);
    header.classList.toggle("is-solid", past);
    rail.classList.toggle("is-on", past);
    if (dir) header.classList.toggle("is-hidden", y > filmST.end + innerHeight * 0.5 && dir === 1 && menu.hidden);
    progressBar.style.transform = `scaleX(${max > 0 ? (y / max).toFixed(4) : 0})`;
  };
  ScrollTrigger.create({ start: 0, end: "max", onUpdate: (self) => syncHeader(self.direction) });
  // Durante um recálculo a página é medida do topo; ao terminar, o cabeçalho volta ao estado certo.
  ScrollTrigger.addEventListener("refresh", () => syncHeader());
  // Link ativo no menu.
  $$(".header__nav a").forEach((a) => {
    const target = $(a.getAttribute("href"));
    if (!target) return;
    ScrollTrigger.create({ trigger: target, start: "top 50%", end: "bottom 50%", onToggle: (self) => a.classList.toggle("is-active", self.isActive) });
  });
  // Botão do WhatsApp só depois da abertura.
  ScrollTrigger.create({ trigger: ".manifesto", start: "top 80%", onEnter: () => $(".whats").classList.add("is-on"), onLeaveBack: () => $(".whats").classList.remove("is-on") });

  /* ---------- Painel de controle: índice lateral, hora de Salvador e letreiros ---------- */
  $$(".rail a").forEach((a) => {
    const target = $(a.getAttribute("href"));
    if (!target) return;
    ScrollTrigger.create({
      trigger: target, start: "top 55%", end: "bottom 55%",
      onToggle: (self) => {
        a.classList.toggle("is-active", self.isActive);
        if (!self.isActive) return;
        rail.classList.toggle("is-light", target.matches(".brands, .insights"));
        scramble($("b", a), 0.5);
      },
    });
  });
  const clocks = $$(".js-clock");
  const ssaTime = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Bahia", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const tickClock = () => { const t = ssaTime.format(new Date()); clocks.forEach((c) => (c.textContent = t)); };
  tickClock();
  setInterval(tickClock, 1000);
  // Os letreiros das seções "decodificam" ao entrar na tela.
  $$(".sec-head > span:nth-child(2)").forEach((el) => {
    const trig = triggerFor(el);
    ScrollTrigger.create({ trigger: trig, start: trig === el ? "top 92%" : "top 70%", once: true, onEnter: () => scramble(el, 1) });
  });

  /* ---------- Grade de pontos: acende onde o mouse passa (no celular, um brilho passeia sozinho) ---------- */
  const grids = $$(".manifesto, .services, .method, .spot, .contact").map((sec) => {
    sec.classList.add("has-grid");
    const g = document.createElement("div");
    g.className = "gridfx";
    g.setAttribute("aria-hidden", "true");
    g.innerHTML = "<i></i>";
    sec.prepend(g);
    return { sec, g, spot: g.firstChild, on: false };
  });
  const pointer = { x: 0, y: 0, inside: false };
  if (finePointer) {
    addEventListener("pointermove", (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.inside = true; }, { passive: true });
    document.documentElement.addEventListener("pointerleave", () => (pointer.inside = false));
  }
  const gridIO = new IntersectionObserver((entries) => entries.forEach((en) => {
    const it = grids.find((g) => g.sec === en.target);
    if (it) it.on = en.isIntersecting;
  }));
  grids.forEach((it) => gridIO.observe(it.sec));
  let gridFrame = 0;
  gsap.ticker.add((time) => {
    gridFrame++;
    if (!finePointer && gridFrame % 2) return;
    grids.forEach((it) => {
      if (!it.on) return;
      const r = it.sec.getBoundingClientRect();
      const x = finePointer ? pointer.x - r.left : r.width * (0.5 + Math.sin(time * 0.35) * 0.34);
      const y = finePointer ? pointer.y - r.top : innerHeight * 0.55 - r.top;
      const show = !finePointer || (pointer.inside && y >= 0 && y <= r.height);
      it.g.classList.toggle("is-on", show);
      if (!show) return;
      it.spot.style.transform = `translate3d(${(x - 260).toFixed(1)}px, ${(y - 260).toFixed(1)}px, 0)`;
      it.spot.style.backgroundPosition = `${(260 - x).toFixed(1)}px ${(260 - y).toFixed(1)}px`;
    });
  });

  /* ---------- Contato: o globo dentro do balão (Salvador ligada ao mundo) ---------- */
  const orb = $(".contact__orb"), globeCanvas = $(".contact__globe");
  if (orb && globeCanvas && window.TNT3D) {
    const world = TNT3D.globe(globeCanvas, { dots: isMobile() ? 11000 : 20000 });
    const G = { on: false, down: false, lastX: 0, drag: 0, vel: 0 };
    const sizeGlobe = () => world.resize(globeCanvas.clientWidth, globeCanvas.clientHeight, Math.min(devicePixelRatio || 1, 2));
    sizeGlobe();
    new ResizeObserver(sizeGlobe).observe(globeCanvas);
    // O mapa (world-atlas, dados do Natural Earth) só é baixado quando o visitante se aproxima do contato.
    ScrollTrigger.create({ trigger: orb, start: "top 260%", once: true, onEnter: () => world.load("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json") });
    ScrollTrigger.create({ trigger: orb, start: "top bottom", end: "bottom top", onToggle: (self) => (G.on = self.isActive) });
    globeCanvas.addEventListener("pointerdown", (e) => { G.down = true; G.lastX = e.clientX; G.vel = 0; globeCanvas.setPointerCapture(e.pointerId); });
    globeCanvas.addEventListener("pointermove", (e) => {
      if (!G.down) return;
      const dx = e.clientX - G.lastX;
      G.lastX = e.clientX; G.vel = dx * 0.3; G.drag -= dx * 0.3;
    });
    const release = () => (G.down = false);
    globeCanvas.addEventListener("pointerup", release);
    globeCanvas.addEventListener("pointercancel", release);
    gsap.ticker.add((time) => {
      if (!G.on) return;
      if (!G.down) { G.drag -= G.vel; G.vel *= 0.95; }
      world.draw(time, { lon: -38.5 + Math.sin(time * 0.12) * 50 + G.drag, lat: -14 + Math.sin(time * 0.2) * 6, radius: 0.36 });
    });
  }

  // Recalcula as posições quando o conteúdo muda de altura (fontes, imagens, acordeão, janela).
  document.fonts?.ready.then(refreshSoon);
  addEventListener("load", refreshSoon);
  let lastMainH = 0;
  new ResizeObserver((entries) => {
    const h = Math.round(entries[0].contentRect.height);
    if (Math.abs(h - lastMainH) > 2) { lastMainH = h; refreshSoon(); }
  }).observe($("main"));

  /* ---------- Início ---------- */
  ScrollTrigger.refresh();
  if (isDebug) {
    const jump = (y) => { if (lenis) lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y); ScrollTrigger.update(); return Math.round(y); };
    window.__tnt = {
      film: (p) => jump(filmST.start + (filmST.end - filmST.start) * clamp(p)),
      to: (sel, off = 0) => { const el = $(sel); return el ? jump(el.getBoundingClientRect().top + scrollY + off) : -1; },
      y: (v) => jump(v),
      works: (p) => { const st = ScrollTrigger.getAll().find((s) => s.trigger === worksSec && s.vars.start === "top top"); return st ? jump(st.start + (st.end - st.start) * clamp(p)) : -1; },
      spot: (p) => { const el = $(".spot"); return jump(el.getBoundingClientRect().top + scrollY + (el.offsetHeight - innerHeight) * clamp(p)); },
      numbers: (p) => { const el = $(".numbers"); return jump(el.getBoundingClientRect().top + scrollY + (el.offsetHeight - innerHeight) * clamp(p)); },
      open: (i) => srvRows[i]?.click(),
    };
    requestAnimationFrame(() => {
      ScrollTrigger.refresh();
      if (debugFilm !== null) window.__tnt.film(debugFilm);
      else if (debugTo) window.__tnt.to(debugTo, Number(params.get("off") || 0));
    });
  } else {
    scrollTo(0, 0);
    powerOn().then(() => {
      refreshSoon();
      if (startHash && $(startHash)) setTimeout(() => scrollToTarget(startHash, startHash === "#marcas" ? -headerH() : 0), 400);
    });
  }
})();
