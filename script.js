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
    ".section-head, .pain-card, .pill-step, .metodo-card, .serv-card, .dif-item, .porque-text, .porque-media, .cta-box, .filosofia-text, .quote"
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

  // Estado de la animación de entrada (las partículas forman el logo)
  let mode = "free";       // "intro" mientras forman el logo, luego "free"
  let holdStart = 0;       // marca de tiempo cuando el logo ya está formado
  let logoTargets = [];    // puntos (normalizados) muestreados del logo

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
      if (allClose) {
        if (!holdStart) {
          holdStart = performance.now();
        } else if (performance.now() - holdStart > 1100) {
          // Liberar: dispersión suave hacia la red libre
          mode = "free";
          for (const p of particles) {
            p.vx = (Math.random() - 0.5) * 0.5;
            p.vy = (Math.random() - 0.5) * 0.5;
          }
        }
      }
      draw();
      raf = requestAnimationFrame(step);
      return;
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

  // Muestrea los píxeles del logo para obtener puntos de la silueta (solo el emblema)
  function buildLogoTargets(cb) {
    const img = new Image();
    img.onload = () => {
      try {
        const SS = 132;
        const ratio = img.naturalHeight / img.naturalWidth || 1;
        const sw = SS, sh = Math.max(1, Math.round(SS * ratio));
        const off = document.createElement("canvas");
        off.width = sw; off.height = sh;
        const octx = off.getContext("2d");
        octx.drawImage(img, 0, 0, sw, sh);
        const maxY = Math.round(sh * 0.72); // recorta el texto "Aimarktech" inferior
        const data = octx.getImageData(0, 0, sw, maxY).data;
        const pts = [];
        for (let y = 0; y < maxY; y += 2) {
          for (let x = 0; x < sw; x += 2) {
            const i = (y * sw + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
            // Incluir píxeles visibles que no sean casi blancos (fondo)
            if (a > 130 && !(r > 235 && g > 235 && b > 235)) {
              pts.push([x / sw, y / sw]); // normalizado por ancho (logo ~cuadrado)
            }
          }
        }
        cb(pts);
      } catch (e) { cb([]); }
    };
    img.onerror = () => cb([]);
    img.src = "assets/logo.png";
  }

  // Asigna a cada partícula un punto destino dentro del hero
  function assignLogoTargets() {
    if (!logoTargets.length) return false;
    const L = Math.min(w, h) * 0.62;
    const cx = w * 0.5, cy = h * 0.46;
    for (const p of particles) {
      const pt = logoTargets[(Math.random() * logoTargets.length) | 0];
      p.tx = cx + (pt[0] - 0.5) * L;
      p.ty = cy + (pt[1] - 0.34) * L;
    }
    return true;
  }

  // Inicializar
  size();
  draw(); // primer fotograma estático (también cubre reduce-motion)

  // Intentar la animación de entrada formando el logo
  buildLogoTargets((pts) => {
    logoTargets = pts;
    if (!assignLogoTargets()) return; // sin puntos -> se queda en modo libre
    if (prefersReduced) {
      // Sin animación: dejar las partículas formando el logo de forma estática
      for (const p of particles) { p.x = p.tx; p.y = p.ty; }
      draw();
    } else {
      mode = "intro";
      holdStart = 0;
    }
  });

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
      size();
      draw();
      if (wasRunning) start();
    }, 200);
  });
});
