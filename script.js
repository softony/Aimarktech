/* =========================================================
   AIMARKTECH — script.js
   --------------------------------------------------------- */

/* ====== CONFIGURACIÓN RÁPIDA ======
   Cambia estos datos por los tuyos reales. */
const CONFIG = {
  // Número de WhatsApp en formato internacional SIN signos ni espacios.
  // Ejemplo México: 52 + 10 dígitos  ->  "521234567890"
  whatsapp: "525639637740",
  // Mensaje con el que se abre WhatsApp
  whatsappMsg: "¡Hola Aimarktech! Vi tu sitio y me interesa agendar un diagnóstico para mi negocio.",
};

document.addEventListener("DOMContentLoaded", () => {
  /* ---------- Año en el footer ---------- */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Enlaces de WhatsApp ---------- */
  const waLink = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(CONFIG.whatsappMsg)}`;
  ["waHero", "waCta", "waFooter", "waFloat"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.href = waLink;
  });

  /* ---------- Menú móvil ---------- */
  const toggle = document.getElementById("navToggle");
  const links = document.getElementById("navLinks");
  if (toggle && links) {
    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("open");
      toggle.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
    });
    // Cerrar al hacer clic en un enlace
    links.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => {
        links.classList.remove("open");
        toggle.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      })
    );
  }

  /* ---------- Animación al hacer scroll (reveal) ---------- */
  const revealEls = document.querySelectorAll(
    ".section-head, .pain-card, .pill-step, .metodo-card, .serv-card, .ventaja-card, .process-card, .price-card, .deliverable-card, .audience-card, .honest-box, .faq-list details, .porque-text, .porque-media, .cta-box, .filosofia-text, .quote, .local-copy, .local-coverage"
  );
  revealEls.forEach((el) => el.classList.add("reveal"));

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("visible"));
  }

  /* ---------- Formulario de contacto ---------- */
  const form = document.getElementById("contactForm");
  const status = document.getElementById("formStatus");

  /* Mostrar/ocultar el campo "Otro" según la selección */
  const tipoSel = document.getElementById("tipo");
  const fieldOtro = document.getElementById("fieldOtro");
  const otroInput = document.getElementById("otro");
  if (tipoSel && fieldOtro) {
    const toggleOtro = () => {
      const isOtro = tipoSel.value === "Otro";
      fieldOtro.hidden = !isOtro;
      if (isOtro) {
        otroInput.focus();
      } else {
        otroInput.value = "";
      }
    };
    tipoSel.addEventListener("change", toggleOtro);
  }

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const nombre = (data.get("nombre") || "").toString().trim();
      const contacto = (data.get("email") || "").toString().trim();

      if (!nombre || !contacto) {
        status.style.color = "#d33";
        status.textContent = "Por favor llena tu nombre y un medio de contacto.";
        return;
      }

      // Sin backend todavía: enviamos los datos a WhatsApp.
      let tipo = (data.get("tipo") || "").toString();
      const otro = (data.get("otro") || "").toString().trim();
      if (tipo === "Otro") {
        tipo = otro ? `Otro: ${otro}` : "Otro (sin especificar)";
      }
      const mensaje = (data.get("mensaje") || "").toString();
      const texto =
        `Hola Aimarktech, soy ${nombre}.\n` +
        `Contacto: ${contacto}\n` +
        `Caso: ${tipo}\n` +
        (mensaje ? `Mensaje: ${mensaje}` : "");

      status.style.color = "";
      status.textContent = "¡Listo! Te llevo a WhatsApp para enviar tu solicitud…";
      window.open(`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(texto)}`, "_blank");
      form.reset();
      if (fieldOtro) fieldOtro.hidden = true;
    });
  }
});


/* =========================================================
   RED DE PARTÍCULAS DEL HERO (constelación tecnológica)
   Cubre todo el hero, reacciona al cursor y los nodos brillan.
   Ligera: canvas + requestAnimationFrame, se pausa fuera de vista.
   --------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("heroNet");
  if (!canvas) return;

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = canvas.getContext("2d");
  const host = canvas.parentElement; // .hero (cubre toda la sección)

  let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  let particles = [];
  let raf = null;
  let running = false;
  const mouse = { x: null, y: null };

  // Estado de la animación de entrada (las partículas forman la letra "A")
  let mode = "free";       // "intro" mientras forman la "A", luego "free"
  let holdStart = 0;       // marca de tiempo cuando la "A" ya está formada
  let extras = [];         // partículas TEMPORALES para nitidez (se desvanecen)

  // Colores de marca
  const NODE = "rgba(10,116,218,0.95)";  // azul
  const NODE2 = "rgba(0,194,255,0.95)";  // cyan
  const LINK = "10,116,218";             // líneas entre nodos
  const LINK_M = "0,194,255";            // líneas hacia el cursor
  const MAX_DIST = 130;                  // conexión entre partículas
  const MOUSE_DIST = 180;                // conexión e influencia del cursor

  function size() {
    w = host.clientWidth;
    h = host.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Densidad según área (limitada para mantenerlo ligero)
    const count = Math.max(30, Math.min(82, Math.round((w * h) / 10500)));
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: 1.4 + Math.random() * 2,
        c: Math.random() > 0.5 ? NODE : NODE2,
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    // Líneas entre partículas cercanas
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist < MAX_DIST) {
          const alpha = (1 - dist / MAX_DIST) * 0.45;
          ctx.strokeStyle = `rgba(${LINK},${alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // Líneas hacia el cursor (más brillantes)
      if (mouse.x !== null) {
        const dxm = a.x - mouse.x, dym = a.y - mouse.y;
        const dm = Math.hypot(dxm, dym);
        if (dm < MOUSE_DIST) {
          const alpha = (1 - dm / MOUSE_DIST) * 0.8;
          ctx.strokeStyle = `rgba(${LINK_M},${alpha})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }
    }

    // Nodos con brillo neón
    ctx.shadowBlur = 8;
    for (const p of particles) {
      ctx.shadowColor = p.c;
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Partículas temporales del logo (con desvanecido)
    for (const e of extras) {
      ctx.globalAlpha = e.alpha;
      ctx.shadowColor = e.c;
      ctx.fillStyle = e.c;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function step() {
    // Fase de entrada: las partículas se mueven hacia la silueta del logo
    if (mode === "intro") {
      let allClose = true;
      for (const p of particles) {
        if (p.tx == null) { allClose = false; continue; }
        p.x += (p.tx - p.x) * 0.07;
        p.y += (p.ty - p.y) * 0.07;
        if (Math.abs(p.tx - p.x) > 1.3 || Math.abs(p.ty - p.y) > 1.3) allClose = false;
      }
      for (const e of extras) {
        e.x += (e.tx - e.x) * 0.07;
        e.y += (e.ty - e.y) * 0.07;
        if (Math.abs(e.tx - e.x) > 1.3 || Math.abs(e.ty - e.y) > 1.3) allClose = false;
      }
      if (allClose) {
        if (!holdStart) {
          holdStart = performance.now();
        } else if (performance.now() - holdStart > 1100) {
          // Liberar: dispersión suave hacia la red libre; las extra se desvanecen
          mode = "free";
          for (const p of particles) {
            p.vx = (Math.random() - 0.5) * 0.5;
            p.vy = (Math.random() - 0.5) * 0.5;
          }
          for (const e of extras) {
            e.fade = true;
            e.vx = (Math.random() - 0.5) * 0.6;
            e.vy = (Math.random() - 0.5) * 0.6;
          }
        }
      }
      draw();
      raf = requestAnimationFrame(step);
      return;
    }

    // Desvanecer y retirar las partículas temporales del logo
    if (extras.length) {
      for (const e of extras) {
        e.x += e.vx || 0;
        e.y += e.vy || 0;
        e.alpha -= 0.02;
      }
      extras = extras.filter((e) => e.alpha > 0.02);
    }

    // Fase libre: red interactiva (comportamiento normal)
    for (const p of particles) {
      // Atracción suave hacia el cursor
      if (mouse.x !== null) {
        const dx = mouse.x - p.x, dy = mouse.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < MOUSE_DIST && d > 1) {
          p.vx += (dx / d) * 0.012;
          p.vy += (dy / d) * 0.012;
        }
      }
      // Límite de velocidad (evita que se amontonen)
      const sp = Math.hypot(p.vx, p.vy);
      const max = 0.85;
      if (sp > max) { p.vx = (p.vx / sp) * max; p.vy = (p.vy / sp) * max; }

      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
    }
    draw();
    raf = requestAnimationFrame(step);
  }

  function start() {
    if (running || prefersReduced) return;
    running = true;
    raf = requestAnimationFrame(step);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  // Interacción con el cursor (el canvas no captura clics; escuchamos en el hero)
  host.addEventListener("pointermove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  host.addEventListener("pointerleave", () => { mouse.x = mouse.y = null; });

  // Genera puntos a lo largo de los trazos de la letra "A" (coords normalizadas, centro 0)
  function letterAPoints(total) {
    const apex = [0, -0.46], bl = [-0.30, 0.46], br = [0.30, 0.46];
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const tcb = 0.62; // posición del travesaño
    const lc = lerp(apex, bl, tcb), rc = lerp(apex, br, tcb);
    const segs = [[apex, bl], [apex, br], [lc, rc]]; // pierna izq, pierna der, travesaño
    const lens = segs.map((s) => Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]));
    const tot = lens.reduce((a, b) => a + b, 0);
    const pts = [];
    for (let s = 0; s < segs.length; s++) {
      const n = Math.max(2, Math.round((total * lens[s]) / tot));
      for (let i = 0; i < n; i++) pts.push(lerp(segs[s][0], segs[s][1], n > 1 ? i / (n - 1) : 0));
    }
    return pts;
  }

  // Asigna destinos formando la letra "A"; distribución uniforme + partículas extra temporales
  function assignLogoTargets() {
    const L = Math.min(w, h) * 0.6;
    const cx = w * 0.5, cy = h * 0.46;
    const GREEN = "rgba(40,167,69,0.95)";
    const want = Math.max(160, particles.length + 90);
    const pool = letterAPoints(want);

    // Baraja para una formación más orgánica (Fisher-Yates)
    for (let i = pool.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    const jit = () => (Math.random() - 0.5) * 3; // pequeño desorden para que no se vea rígido
    const T = pool.length, n = particles.length;

    // Partículas permanentes a los primeros destinos
    for (let k = 0; k < n; k++) {
      const pt = pool[k % T];
      particles[k].tx = cx + pt[0] * L + jit();
      particles[k].ty = cy + pt[1] * L + jit();
    }

    // El resto son partículas TEMPORALES (se desvanecen al liberar). La base va en verde.
    extras = [];
    for (let i = n; i < T; i++) {
      const pt = pool[i];
      extras.push({
        x: Math.random() * w, y: Math.random() * h,
        tx: cx + pt[0] * L + jit(), ty: cy + pt[1] * L + jit(),
        r: 1.4 + Math.random() * 1.5,
        c: pt[1] > 0.2 ? GREEN : (Math.random() > 0.5 ? NODE : NODE2),
        alpha: 1, fade: false, vx: 0, vy: 0,
      });
    }
    return true;
  }

  // Inicializar
  size();
  draw(); // primer fotograma estático (también cubre reduce-motion)

  // Animación de entrada: las partículas forman la letra "A"
  if (assignLogoTargets()) {
    if (prefersReduced) {
      // Sin animación: dejar la "A" formada de forma estática
      for (const p of particles) { p.x = p.tx; p.y = p.ty; }
      for (const e of extras) { e.x = e.tx; e.y = e.ty; }
      draw();
    } else {
      mode = "intro";
      holdStart = 0;
    }
  }

  // Pausar cuando el hero no está visible (ahorra batería/CPU)
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => (e.isIntersecting ? start() : stop())),
      { threshold: 0.05 }
    );
    io.observe(host);
  } else {
    start();
  }

  // Redimensionar con debounce
  let rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      const wasRunning = running;
      stop();
      mode = "free"; // evita destinos obsoletos tras recrear partículas
      extras = [];   // descarta partículas temporales del logo
      size();
      draw();
      if (wasRunning) start();
    }, 200);
  });
});
