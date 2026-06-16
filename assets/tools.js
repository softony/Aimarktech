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

let AI_LIVE = false; // true cuando la función serverless tiene API key

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
  const titles = ["Sobre tu negocio", "Tu situación actual", "Recibe tu diagnóstico"];
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
        alert("Escribe tu nombre y a qué se dedica tu negocio.");
        return false;
      }
    }
    if (step === 2) {
      if (!getChip("diagRetos")) { alert("Elige tu reto principal."); return false; }
      if (!getChip("diagObjetivo")) { alert("Elige tu objetivo principal."); return false; }
    }
    return true;
  }

  if (nextBtn) nextBtn.addEventListener("click", () => { if (validateStep(cur)) show(cur + 1); });
  if (prevBtn) prevBtn.addEventListener("click", () => show(cur - 1));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validateStep(1)) { show(1); return; }
    if (!validateStep(2)) { show(2); return; }

    const payload = {
      nombre: $("#diagNombre").value.trim(),
      negocio: $("#diagNegocio").value.trim(),
      reto: getChip("diagRetos"),
      objetivo: getChip("diagObjetivo"),
      intentado: getChip("diagIntentado"),
      digital: parseInt($("#diagDigital").value, 10),
      contacto: $("#diagContacto").value.trim(),
    };

    const out = $("#diagResult");
    out.innerHTML = thinkingHTML("Analizando tu negocio con IA…");

    // Intento de IA real; si no, lógica local inteligente
    let result = await callAI("diagnostico", payload);
    if (!result || !result.diagnostico) {
      result = { diagnostico: localDiagnostico(payload) };
    }

    renderDiagnostico(out, result.diagnostico, payload);

    saveLead({
      tipo: "Diagnóstico",
      nombre: payload.nombre, negocio: payload.negocio, contacto: payload.contacto,
      detalle: `Reto: ${payload.reto} · Objetivo: ${payload.objetivo} · Madurez: ${payload.digital}/5 · Puntuación: ${result.diagnostico.score}`,
    });
  });

  show(1);
}

function localDiagnostico({ nombre, negocio, reto, objetivo, digital }) {
  // Puntuación base por madurez digital + ajuste por reto
  const base = [0, 22, 38, 55, 70, 84][digital] || 40;
  const jitter = Math.floor(Math.random() * 8);
  const score = Math.max(15, Math.min(92, base + jitter));

  let nivel, resumen;
  if (score < 40) {
    nivel = "Etapa de despegue";
    resumen = "Tienes una gran oportunidad por delante: con bases sólidas puedes crecer rápido y ordenado.";
  } else if (score < 65) {
    nivel = "En crecimiento";
    resumen = "Ya tienes avances, pero te falta estrategia e integración para que todo trabaje junto.";
  } else {
    nivel = "Madurez avanzada";
    resumen = "Vas muy bien. Ahora toca optimizar, automatizar con IA y escalar lo que ya funciona.";
  }

  // Recomendaciones según los 3 pilares de Aimarktech, adaptadas al reto
  const retoMap = {
    "Consigo pocos clientes nuevos": {
      crecimiento: `Diseña un embudo simple para ${negocio}: una oferta gancho + campaña medible para atraer clientes nuevos cada semana.`,
      tech: `Implementa un asistente con IA que responda dudas y agende citas 24/7, para no perder clientes por no contestar a tiempo.`,
    },
    "Todo depende de mí": {
      crecimiento: `Documenta tus 3 procesos clave de ${negocio} para poder delegarlos y dejar de ser el cuello de botella.`,
      tech: `Automatiza tareas repetitivas (respuestas, recordatorios, reportes) con IA para liberar varias horas a la semana.`,
    },
    "Mi marketing no da resultados medibles": {
      crecimiento: `Define 2-3 métricas clave (costo por cliente, retorno por peso invertido) y mide cada campaña antes de invertir más.`,
      tech: `Centraliza tus datos en un tablero simple para ver qué canal te trae clientes reales, no solo "likes".`,
    },
    "No sé cómo usar la IA": {
      crecimiento: `Empieza con un caso de uso de alto impacto en ${negocio}: contenido para redes o atención automatizada.`,
      tech: `Conecta una IA a tu negocio para generar publicaciones, responder mensajes y crear materiales en minutos.`,
    },
    "Pierdo tiempo en tareas repetitivas": {
      crecimiento: `Haz una lista de tus tareas semanales y marca las repetitivas: ahí está tu mayor ahorro de tiempo.`,
      tech: `Automatiza esas tareas con flujos de IA (mensajes, agendas, generación de contenido) para recuperar tu tiempo.`,
    },
    "No tengo presencia digital": {
      crecimiento: `Crea una presencia mínima viable: perfil profesional + 1 canal donde estén tus clientes + oferta clara.`,
      tech: `Usa IA para generar tu contenido inicial y un sitio o catálogo digital sin complicarte con lo técnico.`,
    },
  };
  const r = retoMap[reto] || retoMap["No sé cómo usar la IA"];

  const recomendaciones = [
    { pilar: "🧠 Mentalidad", txt: `Define una meta clara${objetivo ? ` ("${objetivo.toLowerCase()}")` : ""} para ${negocio} y bloquea tiempo cada semana para trabajar EN el negocio, no solo EN la operación.` },
    { pilar: "🤖 Tecnología & IA", txt: r.tech },
    { pilar: "📈 Crecimiento", txt: r.crecimiento },
  ];

  // Fortaleza y foco
  const fortaleza = digital >= 4
    ? "Ya tienes herramientas y presencia: tu base técnica es una ventaja."
    : "Tienes intención de crecer y claridad de tu reto principal: ese es el primer paso.";
  const foco = reto;

  return { score, nivel, resumen, recomendaciones, fortaleza, foco, nombre, negocio };
}

function renderDiagnostico(out, d, payload) {
  const recs = d.recomendaciones.map(
    (r) => `<li><span class="ic">${r.pilar.split(" ")[0]}</span><div><strong>${escapeHTML(r.pilar.replace(/^\S+\s/, ""))}:</strong> ${escapeHTML(r.txt)}</div></li>`
  ).join("");

  const waText =
    `Hola Aimarktech, soy ${payload.nombre} (${payload.negocio}).\n` +
    `Hice el Diagnóstico Express: ${d.score}/100 — ${d.nivel}.\n` +
    `Mi reto: ${payload.reto}. Mi objetivo: ${payload.objetivo}.\n` +
    `Quiero reservar mi lugar para la Sesión Estratégica Privada.`;

  out.innerHTML = `
    <div class="diag-score">
      <div class="diag-ring" style="--val:${d.score}"><span>${d.score}</span></div>
      <div>
        <h3>${escapeHTML(d.nivel)}</h3>
        <p>${escapeHTML(d.resumen)}</p>
      </div>
    </div>

    <div class="diag-block">
      <h4>✅ Tu punto a favor</h4>
      <ul class="diag-list"><li><span class="ic">💪</span><div>${escapeHTML(d.fortaleza)}</div></li></ul>
    </div>

    <div class="diag-block">
      <h4>🎯 3 hallazgos para empezar ya</h4>
      <ul class="diag-list pillars">${recs}</ul>
    </div>

    <div class="plan-locked premium-offer">
      <div class="plan-locked-head">🔒 Diagnóstico Estratégico Premium</div>
      <p class="premium-intro">Tu diagnóstico express ya identificó oportunidades. Ahora, en una <strong>Sesión Estratégica Privada</strong>, transformamos esos hallazgos en un plan de acción real para los próximos 90 días.</p>
      <ul>
        <li><span class="ic">✅</span> Prioridades claras de crecimiento</li>
        <li><span class="ic">✅</span> Automatizaciones con IA aplicables a tu negocio</li>
        <li><span class="ic">✅</span> Sistema de captación de clientes</li>
        <li><span class="ic">✅</span> Próximos pasos para escalar</li>
      </ul>
      <p class="premium-scarcity">⚠️ Solo abrimos 10 lugares al mes para garantizar atención personalizada.</p>
    </div>

    <button type="button" class="btn btn-primary btn-block" id="diagToAgenda">🚀 Reservar mi lugar</button>
    <a href="${waLink(waText)}" target="_blank" rel="noopener" class="btn btn-whatsapp btn-block" style="margin-top:10px;">
      O escríbeme directo por WhatsApp
    </a>
    <p class="cta-note byaf" style="text-align:center;margin-top:12px;">Tú decides si lo aplicas. Sin compromiso.</p>
  `;

  const toAgenda = $("#diagToAgenda");
  if (toAgenda) {
    toAgenda.addEventListener("click", () => {
      const tab = document.querySelector('#tabs .tab-btn[data-tab="agenda"]');
      if (tab) tab.click();
    });
  }
}

/* =========================================================
   2) GENERADOR DE POSTS
   ========================================================= */
function initPosts() {
  const form = $("#postForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const negocio = $("#postNegocio").value.trim();
    const producto = $("#postProducto").value.trim();
    const tono = getChip("postTono") || "motivador";
    const formato = getChip("postFormato") || "square";

    if (!negocio || !producto) {
      alert("Escribe el nombre de tu negocio y la promoción o producto.");
      return;
    }

    const out = $("#postResult");
    out.innerHTML = thinkingHTML("Creando tu publicación con IA…");

    const payload = { negocio, producto, tono, formato };

    let result = await callAI("post", payload);
    if (!result || !result.post) {
      result = { post: localPost(payload) };
    }

    renderPost(out, result.post, payload);

    saveLead({
      tipo: "Post generado",
      nombre: negocio, negocio,
      detalle: `Promo: ${producto} · Tono: ${tono} · ${formato}`,
    });
  });
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

function renderPost(out, post, payload) {
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
  drawPostImage(canvas, post, payload);

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

/* Dibuja la imagen del post con la marca Aimarktech */
function drawPostImage(canvas, post, payload) {
  const isStory = payload.formato === "story";
  const W = 1080, H = isStory ? 1920 : 1080;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

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

  const pad = 90;
  const cy = H / 2;

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

  // Firma inferior
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = "700 26px Montserrat, sans-serif";
  ctx.fillText(`✨ Generado con IA · ${CONFIG.brand}`, pad, H - pad + 20);
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
