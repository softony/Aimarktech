/* =========================================================
   AIMARKTECH — tools.js
   Lógica de las 3 herramientas con IA:
   1) Diagnóstico Express   2) Generador de Posts   3) Agenda
   ---------------------------------------------------------
   Funciona en "modo inteligente local" SIN API key (templates
   y lógica de reglas). Si existe la Netlify Function con una
   API key configurada, usa IA real automáticamente.
   ========================================================= */

const CONFIG = {
  whatsapp: "525639637740",
  whatsappMsg: "¡Hola Aimarktech! Vengo de tus herramientas con IA y quiero más información.",
  brand: "Aimarktech",
  // Endpoint de la función serverless (opcional). Si no existe, usamos modo local.
  aiEndpoint: "/.netlify/functions/ai-generate",
};

/* Colores de marca (para el lienzo del generador de posts) */
const BRAND = {
  blue: "#0A74DA",
  cyan: "#00C2FF",
  yellow: "#FFCE00",
  green: "#28A745",
  dark: "#071426",
  white: "#ffffff",
};

let AI_LIVE = false;  // true cuando la función de texto (OpenAI/Anthropic) tiene API key
let KIE_LIVE = false; // true cuando Kie AI (imágenes) está configurado

/* ============ Utilidades generales ============ */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

function waLink(text) {
  return `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;
}

/* Guardado de leads:
   1) Siempre en localStorage (respaldo y modo sin servidor).
   2) Si existe la base de datos (Supabase vía Netlify Function),
      también lo envía al servidor (sin bloquear la interfaz). */
function saveLead(lead) {
  try {
    const key = "aimarktech_leads";
    const leads = JSON.parse(localStorage.getItem(key) || "[]");
    leads.unshift({ ...lead, fecha: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(leads.slice(0, 200)));
  } catch (e) { /* almacenamiento no disponible: continuamos igual */ }

  // Envío al servidor (Supabase). Best-effort: si no está configurado, se ignora.
  try {
    fetch("/.netlify/functions/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lead),
      keepalive: true,
    }).catch(() => {});
  } catch (e) { /* sin servidor: solo queda en localStorage */ }

  // Evento de analítica (solo si el usuario aceptó cookies y GA está activo)
  if (window.amkTrack) {
    window.amkTrack("lead_capturado", { tipo: lead.tipo });
    if (lead.tipo === "Diagnóstico") window.amkTrack("diagnostico_completado", {});
  }
}

/* Llama a la función serverless si está disponible; si no, devuelve null */
async function callAI(type, payload) {
  try {
    const res = await fetch(CONFIG.aiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, payload }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.configured === false) return null;
    return data;
  } catch (e) {
    return null; // sin función (deploy estático o local): modo local
  }
}

/* Comprueba si la IA real está conectada para mostrar el estado */
async function checkAIStatus() {
  try {
    const res = await fetch(CONFIG.aiEndpoint, { method: "GET" });
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.configured) {
      AI_LIVE = true;
      const wrap = $("#aiStatus");
      const txt = $("#aiStatusText");
      if (wrap) wrap.classList.add("live");
      if (txt) txt.textContent = "IA real conectada · respuestas en vivo";
    }
  } catch (e) { /* modo local */ }
}

/* Comprueba si Kie AI (imágenes) está conectado para mostrar la opción */
async function checkKieStatus() {
  try {
    const res = await fetch("/.netlify/functions/kie-image", { method: "GET" });
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.configured) {
      KIE_LIVE = true;
      const field = $("#postAIField");
      if (field) field.hidden = false;
    }
  } catch (e) { /* Kie no configurado: queda el modo de marca */ }
}

/* ============ Inicialización común ============ */
document.addEventListener("DOMContentLoaded", () => {
  // Año del footer
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Enlaces de WhatsApp
  const link = waLink(CONFIG.whatsappMsg);
  ["waFooter", "waFloat"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.href = link;
  });

  // Menú móvil
  const toggle = $("#navToggle");
  const links = $("#navLinks");
  if (toggle && links) {
    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("open");
      toggle.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  // Pestañas
  initTabs();
  // Chips de selección
  initChips();
  // Herramientas
  initDiagnostico();
  initPosts();
  initAgenda();

  // Estado de la IA
  checkAIStatus();
  checkKieStatus();
});

/* ============ Pestañas ============ */
function initTabs() {
  const tabs = $$("#tabs .tab-btn");
  if (!tabs.length) return;
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.tab;
      tabs.forEach((b) => b.classList.toggle("active", b === btn));
      $$(".tool-panel").forEach((p) =>
        p.classList.toggle("active", p.id === `panel-${id}`)
      );
      // Desplazar suavemente al panel
      const panel = $(`#panel-${id}`);
      if (panel) {
        const y = panel.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    });
  });

  // Si la URL trae #posts / #agenda / #diagnostico, abre esa pestaña
  const hash = (location.hash || "").replace("#", "");
  if (["diagnostico", "posts", "agenda"].includes(hash)) {
    const b = tabs.find((t) => t.dataset.tab === hash);
    if (b) b.click();
  }
}

/* ============ Chips (selección simple) ============ */
function initChips() {
  $$('.chip-row[data-single="true"], .format-toggle[data-single="true"]').forEach((row) => {
    row.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      $$(".chip", row).forEach((c) => c.classList.toggle("selected", c === chip));
    });
  });
}
function getChip(rowId) {
  const sel = $(`#${rowId} .chip.selected`);
  return sel ? sel.dataset.value : "";
}

/* =========================================================
   1) DIAGNÓSTICO EXPRESS
   ========================================================= */
/* Definición de las 6 dimensiones (orden del radar) */
const DIM_DEFS = [
  { key: "mentalidad", row: "dimMentalidad", label: "Mentalidad Empresarial", short: "Mentalidad" },
  { key: "marketing", row: "dimMarketing", label: "Marketing", short: "Marketing" },
  { key: "tecnologia", row: "dimTecnologia", label: "Tecnología", short: "Tecnología" },
  { key: "ia", row: "dimIA", label: "Inteligencia Artificial", short: "IA" },
  { key: "procesos", row: "dimProcesos", label: "Procesos", short: "Procesos" },
  { key: "marca", row: "dimMarca", label: "Marca", short: "Marca" },
];

/* Lee una dimensión (score + etiqueta) del chip seleccionado */
function getDim(rowId) {
  const sel = $(`#${rowId} .chip.selected`);
  if (!sel) return null;
  return { score: parseInt(sel.dataset.score, 10) || 0, label: sel.dataset.label || sel.textContent.trim() };
}

function maturityCategory(s) {
  if (s < 35) return { label: "Inicial", emoji: "🔴", color: "#dc3545" };
  if (s < 60) return { label: "En Desarrollo", emoji: "🟡", color: "#E0A800" };
  if (s < 80) return { label: "Escalable", emoji: "🟢", color: "#28A745" };
  return { label: "Optimizado", emoji: "🔵", color: "#0A74DA" };
}

function validContacto(v) {
  v = (v || "").trim();
  if (v.includes("@")) return /\S+@\S+\.\S+/.test(v);
  return v.replace(/\D/g, "").length >= 8;
}

/* Dimensiones ordenadas de mayor a menor (fortalezas / áreas) */
function rankDims(dims) {
  return DIM_DEFS.map((d) => ({ label: d.label, short: d.short, score: dims[d.key] || 0 }))
    .sort((a, b) => b.score - a.score);
}

function initDiagnostico() {
  const form = $("#diagForm");
  if (!form) return;

  const steps = $$(".diag-step", form);
  const total = steps.length;
  const bar = $("#diagBar");
  const label = $("#diagStepLabel");
  const prevBtn = $("#diagPrev");
  const nextBtn = $("#diagNext");
  const submitBtn = $("#diagSubmit");
  const titles = ["Tu negocio", "Cómo operas", "Crecimiento y tecnología", "Recibe tu diagnóstico"];
  let cur = 1;

  function show(step) {
    cur = Math.max(1, Math.min(total, step));
    steps.forEach((s) => s.classList.toggle("active", Number(s.dataset.step) === cur));
    if (bar) bar.style.width = `${(cur / total) * 100}%`;
    if (label) label.textContent = `Paso ${cur} de ${total} · ${titles[cur - 1] || ""}`;
    if (prevBtn) prevBtn.hidden = cur === 1;
    if (nextBtn) nextBtn.hidden = cur === total;
    if (submitBtn) submitBtn.hidden = cur !== total;
  }

  function validateStep(step) {
    if (step === 1) {
      if (!$("#diagNombre").value.trim() || !$("#diagNegocio").value.trim()) {
        alert("Escribe tu nombre y a qué se dedica tu negocio."); return false;
      }
      if (!getChip("diagSituacion") || !getChip("diagClientes") || !getChip("diagInversion")) {
        alert("Elige una opción en situación, clientes e inversión."); return false;
      }
    }
    if (step === 2) {
      if (!getDim("dimMentalidad") || !getDim("dimProcesos") || !getDim("dimMarca")) {
        alert("Responde las 3 preguntas de este paso."); return false;
      }
    }
    if (step === 3) {
      if (!getDim("dimMarketing") || !getDim("dimTecnologia") || !getDim("dimIA")) {
        alert("Responde las 3 preguntas de este paso."); return false;
      }
    }
    if (step === 4) {
      if (!validContacto($("#diagContacto").value)) {
        alert("Escribe un correo o teléfono válido para enviarte tu diagnóstico."); return false;
      }
    }
    return true;
  }

  if (nextBtn) nextBtn.addEventListener("click", () => { if (validateStep(cur)) show(cur + 1); });
  if (prevBtn) prevBtn.addEventListener("click", () => show(cur - 1));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    for (let s = 1; s <= total; s++) { if (!validateStep(s)) { show(s); return; } }

    const dims = {};
    const respuestas = {};
    DIM_DEFS.forEach((d) => {
      const g = getDim(d.row);
      dims[d.key] = g ? g.score : 0;
      respuestas[d.key] = g ? g.label : "";
    });
    const overall = Math.round(DIM_DEFS.reduce((a, d) => a + dims[d.key], 0) / DIM_DEFS.length);
    const cat = maturityCategory(overall);

    const payload = {
      nombre: $("#diagNombre").value.trim(),
      negocio: $("#diagNegocio").value.trim(),
      contacto: $("#diagContacto").value.trim(),
      situacion: getChip("diagSituacion"),
      clientes: getChip("diagClientes"),
      inversion: getChip("diagInversion"),
      dims, respuestas, overall, categoria: cat.label,
    };

    const out = $("#diagResult");
    out.innerHTML = thinkingHTML("Analizando tu negocio con IA…");

    let result = await callAI("diagnostico", payload);
    let narr = result && result.diagnostico ? result.diagnostico : null;
    if (!narr || !Array.isArray(narr.plan30)) {
      narr = localDiagnostico(payload);
    }

    renderDiagnostico(out, narr, payload, cat);

    saveLead({
      tipo: "Diagnóstico",
      nombre: payload.nombre, negocio: payload.negocio, contacto: payload.contacto,
      detalle: `Madurez: ${overall}/100 (${cat.label}) · Situación: ${payload.situacion} · Clientes/mes: ${payload.clientes} · Inversión: ${payload.inversion} · Puntuación: ${overall}`,
    });
  });

  show(1);
}

/* Dibuja el radar de 6 dimensiones (sin librerías) */
function drawRadar(canvas, dims) {
  const order = DIM_DEFS, N = order.length, size = 320;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = size * dpr; canvas.height = size * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2, cy = size / 2 + 4, R = size * 0.32;

  for (let g = 1; g <= 4; g++) {
    const rr = (R * g) / 4;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / N;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = "rgba(10,116,218,0.12)"; ctx.lineWidth = 1; ctx.stroke();
  }

  ctx.fillStyle = "#46566b"; ctx.font = "700 11px Montserrat, sans-serif";
  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / N;
    const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
    ctx.strokeStyle = "rgba(10,116,218,0.12)"; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
    const lx = cx + Math.cos(a) * (R + 16), ly = cy + Math.sin(a) * (R + 16);
    ctx.textAlign = Math.abs(Math.cos(a)) < 0.3 ? "center" : (Math.cos(a) > 0 ? "left" : "right");
    ctx.textBaseline = "middle";
    ctx.fillText(order[i].short, lx, ly);
  }

  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / N;
    const v = (dims[order[i].key] || 0) / 100;
    const x = cx + Math.cos(a) * R * v, y = cy + Math.sin(a) * R * v;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(0,194,255,0.25)"; ctx.fill();
  ctx.strokeStyle = "#0A74DA"; ctx.lineWidth = 2; ctx.stroke();
  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / N;
    const v = (dims[order[i].key] || 0) / 100;
    const x = cx + Math.cos(a) * R * v, y = cy + Math.sin(a) * R * v;
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fillStyle = "#0A74DA"; ctx.fill();
  }
}

/* Genera y descarga el diagnóstico en PDF (usa jsPDF si está disponible) */
function buildDiagnosticoPDF(d, payload, cat) {
  const Ctor = window.jspdf && window.jspdf.jsPDF;
  if (!Ctor) { alert("No se pudo cargar el generador de PDF. Revisa tu conexión e inténtalo de nuevo."); return; }
  const doc = new Ctor({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = 0;
  const ensure = (need) => { if (y + need > H - 60) { doc.addPage(); y = 60; } };

  doc.setFillColor(7, 20, 38); doc.rect(0, 0, W, 90, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text("AIMARKTECH", M, 42);
  doc.setFont("helvetica", "normal"); doc.setFontSize(12);
  doc.text("Diagnostico Estrategico Empresarial", M, 64);
  doc.setFontSize(9);
  doc.text(new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" }), W - M, 64, { align: "right" });

  y = 122; doc.setTextColor(20, 27, 44); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text(String(payload.nombre || ""), M, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(70, 86, 107);
  y += 16; doc.text(`Negocio: ${payload.negocio || "-"}`, M, y);
  y += 14; doc.text(`Contacto: ${payload.contacto || "-"}`, M, y);

  y += 28; doc.setTextColor(10, 116, 218); doc.setFont("helvetica", "bold"); doc.setFontSize(15);
  doc.text(`Nivel de Madurez: ${payload.overall}/100  -  ${cat.label}`, M, y);

  const radar = document.getElementById("diagRadar");
  if (radar) { try { doc.addImage(radar.toDataURL("image/png"), "PNG", W - M - 170, y - 4, 170, 170); } catch (e) {} }

  y += 22; doc.setTextColor(20, 27, 44); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("Puntuacion por area:", M, y);
  doc.setFont("helvetica", "normal"); doc.setTextColor(70, 86, 107); doc.setFontSize(10);
  DIM_DEFS.forEach((dm) => { y += 15; doc.text(`- ${dm.label}: ${payload.dims[dm.key] || 0}/100`, M, y); });

  const sections = [
    ["Resumen ejecutivo", [d.resumen]],
    ["Principales obstaculos", d.obstaculos],
    ["Oportunidades de crecimiento", d.oportunidades],
    ["Recomendaciones de IA y tecnologia", d.recomendaciones],
    ["Plan de accion de 30 dias", d.plan30],
  ];
  sections.forEach(([title, items]) => {
    ensure(46); y += 24;
    doc.setTextColor(10, 116, 218); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text(title, M, y);
    doc.setTextColor(40, 50, 70); doc.setFont("helvetica", "normal"); doc.setFontSize(10.5);
    (items || []).filter(Boolean).forEach((it) => {
      const lines = doc.splitTextToSize("-  " + it, W - M * 2);
      ensure(lines.length * 14 + 8); y += 16;
      doc.text(lines, M, y); y += (lines.length - 1) * 13;
    });
  });

  ensure(70); y += 28;
  doc.setDrawColor(225, 235, 244); doc.line(M, y, W - M, y); y += 18;
  doc.setTextColor(10, 116, 218); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("Listo para tu plan de 90 dias? Agenda tu Sesion Estrategica Privada.", M, y);
  y += 15; doc.setTextColor(70, 86, 107); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text("WhatsApp: +52 56 3963 7740   -   soyaimarktech.netlify.app", M, y);

  const safe = (payload.negocio || "negocio").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
  doc.save(`diagnostico-aimarktech-${safe}.pdf`);
}

function localDiagnostico(p) {
  const ranked = rankDims(p.dims);
  const low = ranked.slice(-2).reverse(); // las 2 más bajas, peor primero

  const dimAdvice = {
    "Mentalidad Empresarial": {
      obs: "El negocio depende demasiado de ti, lo que limita tu crecimiento y tu tiempo.",
      opp: "Delegar y sistematizar para que el negocio opere sin depender de ti.",
      rec: "Documenta y delega tus 3 tareas más repetitivas; apóyate en asistentes con IA para las respuestas iniciales.",
    },
    "Marketing": {
      obs: "No tienes un sistema constante para atraer prospectos; el flujo de clientes es irregular.",
      opp: "Construir un embudo simple y medible que genere prospectos cada semana.",
      rec: "Crea una oferta gancho y automatiza la captación con un formulario y seguimiento por WhatsApp.",
    },
    "Tecnología": {
      obs: "Trabajas con herramientas dispersas (o ninguna), lo que genera desorden y pérdida de información.",
      opp: "Centralizar tu operación en herramientas integradas (CRM) para no perder clientes ni datos.",
      rec: "Implementa un CRM sencillo para registrar prospectos y dar seguimiento automático.",
    },
    "Inteligencia Artificial": {
      obs: "Aún no aprovechas la IA, una de tus mayores oportunidades de ahorro de tiempo y ventaja competitiva.",
      opp: "Usar IA para contenido, atención y automatizaciones que ahorran horas cada semana.",
      rec: "Empieza con un caso concreto: generación de contenido y respuestas automáticas con IA.",
    },
    "Procesos": {
      obs: "Tus procesos viven en tu cabeza; eso dificulta delegar y mantener la calidad.",
      opp: "Documentar tus procesos clave para escalar con orden.",
      rec: "Escribe paso a paso tus 3 procesos principales y conviértelos en checklists.",
    },
    "Marca": {
      obs: "Tu marca no proyecta una imagen clara y coherente, lo que resta confianza.",
      opp: "Fortalecer tu identidad para generar confianza y atraer mejores clientes.",
      rec: "Unifica tu identidad visual y tu mensaje en todos tus canales.",
    },
  };

  const obstaculos = low.map((d) => dimAdvice[d.label] && dimAdvice[d.label].obs).filter(Boolean);
  const oportunidades = low.map((d) => dimAdvice[d.label] && dimAdvice[d.label].opp).filter(Boolean);
  const recomendaciones = low.map((d) => dimAdvice[d.label] && dimAdvice[d.label].rec).filter(Boolean);
  if (obstaculos.length < 3) obstaculos.push("Falta integrar mentalidad, tecnología y marketing en una sola estrategia coherente.");
  if (oportunidades.length < 3) oportunidades.push("Tu experiencia y un mercado definido son una base sólida para escalar de forma rentable.");
  if (recomendaciones.length < 3) recomendaciones.push("Antes de invertir más en publicidad, ordena tu proceso comercial y automatiza la atención inicial con IA.");

  const resumen = `Tu negocio "${p.negocio}" está en nivel ${p.categoria} (${p.overall}/100). ` +
    `Tu mayor fortaleza es ${ranked[0].short} y tu mayor oportunidad está en ${low[0].short}.`;

  const plan30 = [
    `Semana 1: Documenta y prioriza. Define una meta clara para ${p.negocio} y escribe tus 3 procesos más importantes.`,
    "Semana 2: Activa la IA. Implementa una automatización (contenido o atención inicial) para ahorrar tiempo desde ya.",
    "Semana 3: Ordena tu captación. Crea una oferta gancho y un seguimiento simple para nuevos prospectos.",
    "Semana 4: Mide y ajusta. Define 2-3 métricas clave y revisa qué está funcionando para escalarlo.",
  ];

  return {
    resumen,
    obstaculos: obstaculos.slice(0, 3),
    oportunidades: oportunidades.slice(0, 3),
    recomendaciones: recomendaciones.slice(0, 3),
    plan30,
  };
}

function renderDiagnostico(out, d, payload, cat) {
  const overall = payload.overall;
  const ranked = rankDims(payload.dims);
  const fortalezas = ranked.slice(0, 2);
  const areas = ranked.slice(-2).reverse();

  const li = (arr) => (arr || []).filter(Boolean)
    .map((t) => `<li><span class="ic">•</span><div>${escapeHTML(t)}</div></li>`).join("");

  const dimRows = DIM_DEFS.map((dm) => {
    const v = payload.dims[dm.key] || 0;
    return `<div class="dim-bar"><span class="dim-bar-label">${dm.short}</span><div class="dim-bar-track"><span style="width:${v}%"></span></div><span class="dim-bar-val">${v}</span></div>`;
  }).join("");

  const waText =
    `Hola Aimarktech, soy ${payload.nombre} (${payload.negocio}).\n` +
    `Hice el Diagnóstico Estratégico: ${overall}/100 — nivel ${cat.label}.\n` +
    `Quiero reservar mi lugar para la Sesión Estratégica Privada.`;

  out.innerHTML = `
    <div class="diag-score">
      <div class="diag-ring" style="--val:${overall};--ring:${cat.color}"><span>${overall}</span></div>
      <div>
        <p class="diag-kicker">Nivel de Madurez Empresarial</p>
        <h3>${cat.emoji} ${escapeHTML(cat.label)}</h3>
        <p>${escapeHTML(d.resumen || "")}</p>
      </div>
    </div>

    <div class="diag-radar-card">
      <canvas id="diagRadar" width="320" height="320" aria-label="Gráfica de madurez por área"></canvas>
      <div class="diag-dims">${dimRows}</div>
    </div>

    <div class="diag-exec">
      <div class="exec-col exec-ok">
        <h4>✓ Fortalezas</h4>
        <ul>${fortalezas.map((f) => `<li>${escapeHTML(f.label)} <b>(${f.score})</b></li>`).join("")}</ul>
      </div>
      <div class="exec-col exec-warn">
        <h4>⚠ Áreas de oportunidad</h4>
        <ul>${areas.map((f) => `<li>${escapeHTML(f.label)} <b>(${f.score})</b></li>`).join("")}</ul>
      </div>
    </div>

    <div class="diag-block"><h4>🚧 Principales obstáculos detectados</h4><ul class="diag-list">${li(d.obstaculos)}</ul></div>
    <div class="diag-block"><h4>🌱 Oportunidades de crecimiento</h4><ul class="diag-list">${li(d.oportunidades)}</ul></div>
    <div class="diag-block"><h4>🤖 Recomendaciones de IA y tecnología</h4><ul class="diag-list">${li(d.recomendaciones)}</ul></div>
    <div class="diag-block"><h4>🗓️ Plan de acción de 30 días</h4><ul class="diag-list pillars">${li(d.plan30)}</ul></div>

    <div class="plan-locked premium-offer">
      <div class="plan-locked-head">🔒 Lleva tu diagnóstico al siguiente nivel</div>
      <p class="premium-intro">Este diagnóstico ya te muestra el mapa. En una <strong>Sesión Estratégica Privada</strong> convertimos estos hallazgos en un plan de 90 días hecho a la medida de ${escapeHTML(payload.negocio)}.</p>
      <p class="premium-scarcity">⚠️ Solo abrimos 10 sesiones al mes para garantizar atención personalizada.</p>
    </div>

    <div class="btn-row">
      <button type="button" class="btn btn-primary" id="diagPDF">📄 Descargar mi diagnóstico (PDF)</button>
      <button type="button" class="btn btn-ghost" id="diagToAgenda">📅 Reservar mi sesión</button>
    </div>
    <a href="${waLink(waText)}" target="_blank" rel="noopener" class="btn btn-whatsapp btn-block" style="margin-top:10px;">O escríbeme directo por WhatsApp</a>
    <p class="cta-note byaf" style="text-align:center;margin-top:12px;">Tú decides si lo aplicas. Sin compromiso.</p>
  `;

  const radar = $("#diagRadar");
  if (radar) drawRadar(radar, payload.dims);

  const toAgenda = $("#diagToAgenda");
  if (toAgenda) toAgenda.addEventListener("click", () => {
    const tab = document.querySelector('#tabs .tab-btn[data-tab="agenda"]');
    if (tab) tab.click();
  });

  const pdfBtn = $("#diagPDF");
  if (pdfBtn) pdfBtn.addEventListener("click", () => buildDiagnosticoPDF(d, payload, cat));
}

/* =========================================================
   2) GENERADOR DE POSTS
   ========================================================= */
function initPosts() {
  const form = $("#postForm");
  if (!form) return;

  // Mostrar/ocultar el campo de descripción según el interruptor
  const useAIChk = $("#postUseAI");
  const promptField = $("#postPromptField");
  if (useAIChk && promptField) {
    useAIChk.addEventListener("change", () => { promptField.hidden = !useAIChk.checked; });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const negocio = $("#postNegocio").value.trim();
    const producto = $("#postProducto").value.trim();
    const contacto = $("#postContacto") ? $("#postContacto").value.trim() : "";
    const tono = getChip("postTono") || "motivador";
    const formato = getChip("postFormato") || "square";
    const useAI = !!(useAIChk && useAIChk.checked && KIE_LIVE);
    const imgPrompt = $("#postPrompt") ? $("#postPrompt").value.trim() : "";

    if (!negocio || !producto) {
      alert("Escribe el nombre de tu negocio y la promoción o producto.");
      return;
    }

    const out = $("#postResult");
    out.innerHTML = thinkingHTML("Creando tu publicación con IA…");

    const payload = { negocio, producto, tono, formato, prompt: imgPrompt, contacto };

    // 1) Texto del post (IA real o local)
    let result = await callAI("post", payload);
    if (!result || !result.post) {
      result = { post: localPost(payload) };
    }

    // 2) Imagen con IA (Kie AI), solo si se activó
    let bgDataUrl = null;
    if (useAI) {
      out.innerHTML = thinkingHTML("Generando imagen con IA… puede tardar ~30-40s ⏳");
      bgDataUrl = await generateKieImage(payload, out);
    }

    renderPost(out, result.post, payload, bgDataUrl);

    saveLead({
      tipo: "Post generado",
      nombre: negocio, negocio, contacto,
      detalle: `Promo: ${producto} · Tono: ${tono} · ${formato}${useAI ? " · imagen IA" : ""}`,
    });
  });
}

/* Genera una imagen con Kie AI: crea la tarea y sondea hasta que termina.
   Devuelve un data URL (base64) o null si falla / no está configurado. */
async function generateKieImage(payload, out) {
  try {
    const res = await fetch("/.netlify/functions/kie-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data || !data.taskId) return null;

    const taskId = data.taskId;
    const started = Date.now();
    while (Date.now() - started < 90000) { // hasta 90s
      await sleep(3000);
      const sRes = await fetch(`/.netlify/functions/kie-image?taskId=${encodeURIComponent(taskId)}`);
      const s = await sRes.json();
      if (s.state === "success" && s.image) return s.image;
      if (s.state === "fail") return null;
      if (out) {
        const pct = s.progress ? ` (${s.progress}%)` : "";
        out.innerHTML = thinkingHTML(`Generando imagen con IA…${pct} ⏳`);
      }
    }
    return null; // tiempo agotado
  } catch (e) {
    return null;
  }
}

function localPost({ negocio, producto, tono }) {
  const hooks = {
    motivador: ["🚀", `Tu próximo nivel empieza con ${producto}.`],
    profesional: ["✅", `Presentamos: ${producto}.`],
    cercano: ["😊", `¡Tenemos algo especial para ti! ${producto}.`],
    urgente: ["🔥", `¡Solo por tiempo limitado! ${producto}.`],
  };
  const closers = {
    motivador: "No esperes el momento perfecto, créalo. 💪",
    profesional: "Calidad y resultados que puedes medir.",
    cercano: "Te esperamos, eres parte de la familia. 🤍",
    urgente: "Aprovecha hoy, mañana puede ser tarde. ⏳",
  };
  const [emoji, hook] = hooks[tono] || hooks.motivador;

  const headline = producto.length <= 42 ? producto : producto.slice(0, 40) + "…";

  const caption =
    `${emoji} ${hook}\n\n` +
    `En ${negocio} lo hacemos posible. ${closers[tono] || ""}\n\n` +
    `📲 Escríbenos y agenda hoy mismo.`;

  const baseTags = ["#" + slug(negocio), "#Negocios", "#Emprender", "#IA", "#Marketing", "#Crecimiento"];
  const prodTags = slug(producto).length > 2 ? ["#" + slug(producto)] : [];
  const hashtags = [...new Set([...prodTags, ...baseTags])].slice(0, 8).join(" ");

  return { headline, caption, hashtags, cta: "Agenda hoy" };
}

function renderPost(out, post, payload, bgDataUrl) {
  out.innerHTML = `
    <div class="post-preview">
      <div class="post-canvas-wrap"><canvas id="postCanvas"></canvas></div>
    </div>
    <div class="post-caption" id="postCaption"></div>
    <div class="btn-row">
      <button class="btn btn-primary" id="btnDownload">⬇️ Descargar imagen</button>
      <button class="btn btn-ghost" id="btnCopy">📋 Copiar copy</button>
    </div>
    <a href="${waLink(`Hola Aimarktech, generé un post para ${payload.negocio} (${payload.producto}) y quiero ayuda para mi estrategia de redes.`)}"
       target="_blank" rel="noopener" class="btn btn-whatsapp btn-block" style="margin-top:12px;">
       Quiero una estrategia de contenido como esta
    </a>
    <div class="info-note" style="margin-top:14px;">
      <span class="ic">🎨</span>
      <span>Esta imagen usa los colores de tu marca y es 100% descargable. El estilo se puede personalizar a tu gusto.</span>
    </div>
  `;

  const captionEl = $("#postCaption");
  captionEl.textContent = post.caption;
  const tags = document.createElement("div");
  tags.className = "post-hashtags";
  tags.style.marginTop = "10px";
  tags.textContent = post.hashtags;
  captionEl.appendChild(tags);

  const canvas = $("#postCanvas");
  drawPostImage(canvas, post, payload, bgDataUrl);

  $("#btnDownload").addEventListener("click", () => {
    const a = document.createElement("a");
    a.download = `post-${slug(payload.negocio)}-${payload.formato}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  });
  $("#btnCopy").addEventListener("click", () => {
    const full = post.caption + "\n\n" + post.hashtags;
    navigator.clipboard?.writeText(full);
    const b = $("#btnCopy");
    const old = b.textContent;
    b.textContent = "✅ ¡Copiado!";
    setTimeout(() => (b.textContent = old), 1600);
  });
}

/* Dibuja la imagen del post. Si hay bgDataUrl (imagen IA), la usa de
   fondo con una capa oscura; si no, usa el gradiente de marca. */
function drawPostImage(canvas, post, payload, bgDataUrl) {
  if (bgDataUrl) {
    const img = new Image();
    img.onload = () => paintPost(canvas, post, payload, img);
    img.onerror = () => paintPost(canvas, post, payload, null);
    img.src = bgDataUrl;
  } else {
    paintPost(canvas, post, payload, null);
  }
}

function paintPost(canvas, post, payload, bgImg) {
  const isStory = payload.formato === "story";
  const W = 1080, H = isStory ? 1920 : 1080;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  if (bgImg) {
    // Imagen de IA tipo "cover" + capa oscura para legibilidad del texto
    drawCover(ctx, bgImg, W, H);
    const ov = ctx.createLinearGradient(0, 0, 0, H);
    ov.addColorStop(0, "rgba(7,20,38,0.30)");
    ov.addColorStop(0.5, "rgba(7,20,38,0.55)");
    ov.addColorStop(1, "rgba(7,20,38,0.90)");
    ctx.fillStyle = ov;
    ctx.fillRect(0, 0, W, H);
  } else {
    // Fondo: gradiente diagonal de marca
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, BRAND.dark);
    g.addColorStop(0.55, BRAND.blue);
    g.addColorStop(1, BRAND.cyan);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Círculos decorativos (glow)
    drawGlow(ctx, W * 0.85, H * 0.12, 360, "rgba(0,194,255,0.35)");
    drawGlow(ctx, W * 0.1, H * 0.9, 420, "rgba(10,116,218,0.4)");
    drawGlow(ctx, W * 0.9, H * 0.85, 200, "rgba(255,206,0,0.18)");
  }

  const pad = 90;

  // Nombre del negocio (arriba)
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "800 38px Montserrat, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(payload.negocio.toUpperCase(), pad, pad);

  // Línea decorativa
  ctx.fillStyle = BRAND.yellow;
  ctx.fillRect(pad, pad + 56, 110, 7);

  // Etiqueta de tono / promo
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "700 26px Montserrat, sans-serif";
  ctx.fillText("OFERTA ESPECIAL", pad, isStory ? H * 0.30 : H * 0.24);

  // Titular grande (envuelto)
  ctx.fillStyle = "#ffffff";
  const titleSize = isStory ? 96 : 84;
  ctx.font = `900 ${titleSize}px Montserrat, sans-serif`;
  const lines = wrapText(ctx, post.headline, W - pad * 2);
  let ty = isStory ? H * 0.34 : H * 0.28;
  lines.slice(0, 4).forEach((ln) => {
    ctx.fillText(ln, pad, ty);
    ty += titleSize * 1.08;
  });

  // Subtítulo / closer corto
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "400 34px Lato, sans-serif";
  const sub = wrapText(ctx, captionFirstLine(post.caption), W - pad * 2);
  ty += 14;
  sub.slice(0, 2).forEach((ln) => {
    ctx.fillText(ln, pad, ty);
    ty += 46;
  });

  // Botón CTA (pill)
  const ctaText = (post.cta || "Agenda hoy").toUpperCase();
  ctx.font = "800 32px Montserrat, sans-serif";
  const ctaW = ctx.measureText(ctaText).width + 80;
  const ctaH = 78;
  const ctaY = isStory ? H * 0.8 : H * 0.74;
  roundRect(ctx, pad, ctaY, ctaW, ctaH, 40);
  ctx.fillStyle = BRAND.yellow;
  ctx.fill();
  ctx.fillStyle = BRAND.dark;
  ctx.textBaseline = "middle";
  ctx.fillText(ctaText, pad + 40, ctaY + ctaH / 2 + 2);

  // Contacto del autor (si lo capturó): se incrusta en el diseño
  if (payload.contacto) {
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = "700 34px Montserrat, sans-serif";
    let ct = "📲 " + payload.contacto;
    let truncated = false;
    while (ctx.measureText(ct).width > W - pad * 2 && ct.length > 8) {
      ct = ct.slice(0, -2);
      truncated = true;
    }
    if (truncated) ct += "…";
    ctx.fillText(ct, pad, ctaY + ctaH + 34);
  }

  // Firma inferior
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = "700 26px Montserrat, sans-serif";
  ctx.fillText(`✨ Generado con IA · ${CONFIG.brand}`, pad, H - pad + 20);
}

/* Dibuja una imagen cubriendo todo el lienzo (object-fit: cover) */
function drawCover(ctx, img, W, H) {
  const ir = img.width / img.height;
  const cr = W / H;
  let dw, dh, dx, dy;
  if (ir > cr) { dh = H; dw = H * ir; dx = (W - dw) / 2; dy = 0; }
  else { dw = W; dh = W / ir; dx = 0; dy = (H - dh) / 2; }
  ctx.drawImage(img, dx, dy, dw, dh);
}

function captionFirstLine(caption) {
  const parts = caption.split("\n").filter(Boolean);
  return parts[1] || parts[0] || "";
}

/* =========================================================
   3) AGENDA
   ========================================================= */
function initAgenda() {
  const form = $("#agendaForm");
  if (!form) return;

  const diasWrap = $("#agDias");
  const horasWrap = $("#agHoras");
  const summary = $("#agSummary");
  const success = $("#agSuccess");

  // Construir próximos 6 días hábiles (lun-sáb)
  const dias = [];
  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const monthNames = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  let d = new Date();
  d.setDate(d.getDate() + 1);
  while (dias.length < 6) {
    if (d.getDay() !== 0) { // saltar domingos
      dias.push(new Date(d));
    }
    d.setDate(d.getDate() + 1);
  }
  diasWrap.innerHTML = dias.map((day, i) =>
    `<div class="slot" data-day="${day.toISOString().slice(0,10)}" data-label="${dayNames[day.getDay()]} ${day.getDate()} ${monthNames[day.getMonth()]}">
       ${dayNames[day.getDay()]}<small>${day.getDate()} ${monthNames[day.getMonth()]}</small>
     </div>`
  ).join("");

  // Horarios
  const horas = ["10:00", "11:30", "13:00", "16:00", "17:30", "19:00"];
  horasWrap.innerHTML = horas.map((h) =>
    `<div class="slot" data-hora="${h}">${h}<small>hrs</small></div>`
  ).join("");

  let selDay = null, selHora = null;

  function refreshSummary() {
    if (selDay && selHora) {
      summary.hidden = false;
      summary.innerHTML = `📅 Tu cita: <strong>${selDay.label}</strong> a las <strong>${selHora} hrs</strong> (30 min, en línea o por teléfono).`;
    } else {
      summary.hidden = true;
    }
  }

  diasWrap.addEventListener("click", (e) => {
    const s = e.target.closest(".slot");
    if (!s) return;
    $$(".slot", diasWrap).forEach((x) => x.classList.toggle("selected", x === s));
    selDay = { value: s.dataset.day, label: s.dataset.label };
    refreshSummary();
  });
  horasWrap.addEventListener("click", (e) => {
    const s = e.target.closest(".slot");
    if (!s) return;
    $$(".slot", horasWrap).forEach((x) => x.classList.toggle("selected", x === s));
    selHora = s.dataset.hora;
    refreshSummary();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const nombre = $("#agNombre").value.trim();
    const contacto = $("#agContacto").value.trim();
    if (!nombre || !contacto) { alert("Escribe tu nombre y un medio de contacto."); return; }
    if (!selDay || !selHora) { alert("Elige un día y un horario para tu cita."); return; }

    const waText =
      `Hola Aimarktech, soy ${nombre}.\n` +
      `Quiero agendar mi sesión de diagnóstico gratuita.\n` +
      `📅 Día: ${selDay.label}\n⏰ Hora: ${selHora} hrs\n` +
      `Contacto: ${contacto}`;

    saveLead({
      tipo: "Cita agendada",
      nombre, contacto,
      detalle: `${selDay.label} · ${selHora} hrs`,
    });

    success.classList.add("show");
    success.innerHTML = `✅ ¡Listo, ${escapeHTML(nombre)}! Te llevamos a WhatsApp para confirmar tu cita del <strong>${escapeHTML(selDay.label)}</strong> a las <strong>${escapeHTML(selHora)} hrs</strong>.`;
    window.open(waLink(waText), "_blank");
    form.reset();
    $$(".slot", diasWrap).forEach((x) => x.classList.remove("selected"));
    $$(".slot", horasWrap).forEach((x) => x.classList.remove("selected"));
    selDay = selHora = null;
    summary.hidden = true;
  });
}

/* =========================================================
   Helpers de dibujo y texto
   ========================================================= */
function thinkingHTML(msg) {
  return `<div class="result-empty"><div class="thinking"><span class="spinner"></span>${escapeHTML(msg)}</div></div>`;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function wrapText(ctx, text, maxWidth) {
  const words = (text || "").split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawGlow(ctx, x, y, radius, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function slug(str) {
  return (str || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .replace(/^(.)/, (m) => m.toUpperCase());
}

function escapeHTML(str) {
  return (str || "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
