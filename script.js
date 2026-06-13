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
      const tipo = (data.get("tipo") || "").toString();
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
    });
  }
});
