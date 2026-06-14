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
   Ligera: canvas + requestAnimationFrame, se pausa fuera de vista.
   --------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("heroNet");
  if (!canvas) return;

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = canvas.getContext("2d");
  const host = canvas.parentElement;

  let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  let particles = [];
  let raf = null;
  let running = false;

  // Colores de marca
  const NODE = "rgba(10,116,218,0.9)";   // azul
  const NODE2 = "rgba(0,194,255,0.9)";   // cyan
  const LINK = "10,116,218";             // base para líneas (con alpha variable)
  const MAX_DIST = 120;                  // distancia máxima para conectar

  function size() {
    w = host.clientWidth;
    h = host.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Densidad según área (limitada para mantenerlo ligero)
    const count = Math.max(18, Math.min(46, Math.round((w * h) / 9000)));
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: 1.5 + Math.random() * 1.8,
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
          const alpha = (1 - dist / MAX_DIST) * 0.5;
          ctx.strokeStyle = `rgba(${LINK},${alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // Nodos
    for (const p of particles) {
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function step() {
    for (const p of particles) {
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

  // Inicializar
  size();
  draw(); // primer fotograma estático (también cubre reduce-motion)

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
      size();
      draw();
      if (wasRunning) start();
    }, 200);
  });
});
