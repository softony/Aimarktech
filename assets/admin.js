/* =========================================================
   AIMARKTECH — admin.js  ·  Dashboard
   ---------------------------------------------------------
   Panel privado tipo dashboard. Más que un CRM:
   - KPIs en vivo (prospectos, diagnósticos, citas, posts)
   - Insights (nuevos esta semana, madurez promedio, última actividad)
   - Gráfica de tendencia (14 días, sin librerías)
   - Segmentación: Prospectos (con contacto + acciones) vs Contenido
   - Búsqueda, filtro por fecha y exportación CSV por vista

   Dos modos automáticos (igual que antes):
   - SERVIDOR (Supabase vía Netlify) si está configurado.
   - LOCAL (localStorage) como respaldo.
   ========================================================= */

const ADMIN_PASS = "Aimark2026"; // fallback local (modo sin Supabase). Cámbiala.
const LEADS_KEY = "aimarktech_leads";
const SESSION_KEY = "aimarktech_admin_ok";
const TOKEN_KEY = "aimarktech_admin_token";
const LEADS_ENDPOINT = "/.netlify/functions/leads";

const $ = (s) => document.querySelector(s);

let MODE = "local";       // 'local' | 'server'
let SERVER_LEADS = [];
let ALL_LEADS = [];       // cache normalizado para los controles

// Estado de la vista
const STATE = { view: "prospectos", search: "", dateFilter: "all" };

const PROSPECT_TYPES = ["Diagnóstico", "Cita agendada"];

document.addEventListener("DOMContentLoaded", () => {
  // ¿Sesión previa? Reintenta con el token guardado.
  if (sessionStorage.getItem(SESSION_KEY) === "1") {
    const tk = sessionStorage.getItem(TOKEN_KEY) || "";
    attemptLogin(tk, true);
  }

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await attemptLogin($("#pass").value, false);
  });

  $("#btnLogout").addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    location.reload();
  });

  $("#btnExport").addEventListener("click", exportCSV);

  // Controles del dashboard
  $("#tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    STATE.view = btn.dataset.view;
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === btn));
    renderTable();
  });

  $("#search").addEventListener("input", (e) => { STATE.search = e.target.value.trim().toLowerCase(); renderTable(); });
  $("#dateFilter").addEventListener("change", (e) => { STATE.dateFilter = e.target.value; renderTable(); });
});

/* ===================== AUTENTICACIÓN ===================== */
async function attemptLogin(pass, silent) {
  const status = $("#loginStatus");
  if (status) status.textContent = silent ? "" : "Verificando…";

  const server = await tryServer(pass);

  if (server.mode === "server") {
    MODE = "server";
    SERVER_LEADS = server.leads || [];
    sessionStorage.setItem(SESSION_KEY, "1");
    sessionStorage.setItem(TOKEN_KEY, pass);
    showPanel();
    return;
  }
  if (server.mode === "unauthorized") {
    if (status) status.textContent = "Contraseña incorrecta.";
    sessionStorage.removeItem(SESSION_KEY);
    return;
  }
  // Modo local
  if (pass === ADMIN_PASS) {
    MODE = "local";
    sessionStorage.setItem(SESSION_KEY, "1");
    sessionStorage.setItem(TOKEN_KEY, pass);
    showPanel();
  } else if (!silent) {
    if (status) status.textContent = "Contraseña incorrecta.";
  }
}

async function tryServer(token) {
  try {
    const res = await fetch(`${LEADS_ENDPOINT}?token=${encodeURIComponent(token)}`);
    if (res.status === 401) return { mode: "unauthorized" };
    if (!res.ok) return { mode: "local" };
    const data = await res.json();
    if (data && data.configured && Array.isArray(data.leads)) {
      return { mode: "server", leads: data.leads };
    }
    return { mode: "local" };
  } catch (e) {
    return { mode: "local" };
  }
}

function showPanel() {
  $("#login").classList.add("hidden");
  $("#panel").classList.remove("hidden");
  ALL_LEADS = getLeads();
  renderModeBadge();
  renderStats();
  renderInsights();
  renderTrend();
  renderTable();
}

/* ===================== DATOS ===================== */
function normalize(l) {
  return {
    tipo: l.tipo, nombre: l.nombre, negocio: l.negocio,
    contacto: l.contacto, detalle: l.detalle,
    fecha: l.fecha || l.created_at,
  };
}

function getLeads() {
  if (MODE === "server") return SERVER_LEADS.map(normalize);
  try { return JSON.parse(localStorage.getItem(LEADS_KEY) || "[]"); }
  catch (e) { return []; }
}

const isProspect = (l) => PROSPECT_TYPES.includes(l.tipo);

function parseScore(detalle) {
  const m = /Puntuaci[oó]n:\s*(\d+)/i.exec(detalle || "");
  return m ? parseInt(m[1], 10) : null;
}

/* Detecta si un contacto es email o teléfono y arma enlaces de acción */
function contactInfo(contacto) {
  const raw = (contacto || "").trim();
  if (!raw) return { type: "none", raw };
  if (raw.includes("@")) return { type: "email", raw, href: `mailto:${raw}` };
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 8) {
    const wa = digits.length === 10 ? `52${digits}` : digits; // default MX para 10 dígitos
    return { type: "phone", raw, digits, href: `https://wa.me/${wa}`, tel: `tel:${digits}` };
  }
  return { type: "other", raw };
}

function withinDate(iso, days) {
  if (days === "all") return true;
  const d = new Date(iso).getTime();
  if (isNaN(d)) return true;
  return d >= Date.now() - parseInt(days, 10) * 86400000;
}

/* Lista filtrada según la vista + búsqueda + fecha */
function filteredLeads() {
  return ALL_LEADS.filter((l) => {
    if (STATE.view === "prospectos" && !isProspect(l)) return false;
    if (STATE.view === "contenido" && l.tipo !== "Post generado") return false;
    if (!withinDate(l.fecha, STATE.dateFilter)) return false;
    if (STATE.search) {
      const hay = [l.nombre, l.negocio, l.contacto, l.detalle, l.tipo].join(" ").toLowerCase();
      if (!hay.includes(STATE.search)) return false;
    }
    return true;
  });
}

/* ===================== RENDER ===================== */
function renderModeBadge() {
  $("#modeBadge").innerHTML = MODE === "server"
    ? "🟢 Conectado a Supabase · datos centralizados (todos los dispositivos)"
    : "🟡 Modo local · datos solo de este navegador";
}

function renderStats() {
  const leads = ALL_LEADS;
  const prospectos = leads.filter(isProspect).length;
  const diag = leads.filter((l) => l.tipo === "Diagnóstico").length;
  const citas = leads.filter((l) => l.tipo === "Cita agendada").length;
  const posts = leads.filter((l) => l.tipo === "Post generado").length;

  $("#stats").innerHTML = `
    <div class="stat is-star"><div class="num">${prospectos}</div><div class="lbl">👥 Prospectos (con contacto)</div></div>
    <div class="stat"><div class="num">${diag}</div><div class="lbl">🧠 Diagnósticos</div></div>
    <div class="stat"><div class="num">${citas}</div><div class="lbl">📅 Citas agendadas</div></div>
    <div class="stat"><div class="num">${posts}</div><div class="lbl">📱 Posts creados</div></div>
  `;
}

function renderInsights() {
  const leads = ALL_LEADS;
  const nuevos7 = leads.filter((l) => withinDate(l.fecha, "7")).length;

  const scores = leads.map((l) => parseScore(l.detalle)).filter((s) => s !== null);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  const fechas = leads.map((l) => new Date(l.fecha).getTime()).filter((t) => !isNaN(t));
  const ultima = fechas.length ? fmtDate(new Date(Math.max(...fechas)).toISOString()) : "—";

  $("#insights").innerHTML = `
    <div class="insight"><div class="ico">🆕</div><div class="v">${nuevos7}</div><div class="k">Nuevos registros (últimos 7 días)</div></div>
    <div class="insight"><div class="ico">🎯</div><div class="v">${avg !== null ? avg + "/100" : "—"}</div><div class="k">Madurez digital promedio (diagnósticos)</div></div>
    <div class="insight"><div class="ico">🕐</div><div class="v">${ultima}</div><div class="k">Última actividad registrada</div></div>
  `;
}

function renderTrend() {
  const days = 14;
  const buckets = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    buckets.push({ date: d, count: 0 });
  }
  ALL_LEADS.forEach((l) => {
    const t = new Date(l.fecha); if (isNaN(t)) return;
    t.setHours(0, 0, 0, 0);
    const b = buckets.find((x) => x.date.getTime() === t.getTime());
    if (b) b.count++;
  });
  const max = Math.max(1, ...buckets.map((b) => b.count));

  $("#trend").innerHTML = buckets.map((b) => {
    const pct = b.count ? Math.max(6, Math.round((b.count / max) * 100)) : 0;
    const label = b.date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
    return `<div class="bar-wrap" title="${label}: ${b.count} registro(s)">
      <div class="bar ${b.count ? "" : "zero"}" style="height:${pct}%"></div>
      <div class="d">${b.date.getDate()}</div>
    </div>`;
  }).join("");
}

function badge(tipo) {
  if (tipo === "Diagnóstico") return '<span class="badge b-diag">🧠 Diagnóstico</span>';
  if (tipo === "Post generado") return '<span class="badge b-post">📱 Post</span>';
  if (tipo === "Cita agendada") return '<span class="badge b-cita">📅 Cita</span>';
  return `<span class="badge">${esc(tipo || "—")}</span>`;
}

function scorePill(detalle) {
  const s = parseScore(detalle);
  if (s === null) return "";
  const cls = s >= 70 ? "score-hi" : s >= 40 ? "score-mid" : "score-lo";
  return `<span class="score-pill ${cls}">${s}/100</span>`;
}

function contactCell(contacto) {
  const c = contactInfo(contacto);
  if (c.type === "none") return '<span style="color:var(--ink-soft)">—</span>';

  let actions = "";
  if (c.type === "email") {
    actions = `<a class="mini-btn" href="${esc(c.href)}">✉️ Email</a>`;
  } else if (c.type === "phone") {
    actions = `<a class="mini-btn wa" href="${esc(c.href)}" target="_blank" rel="noopener">💬 WhatsApp</a>`;
  }
  actions += `<button class="mini-btn" type="button" data-copy="${esc(c.raw)}">📋 Copiar</button>`;

  return `<span class="contact-val">${esc(c.raw)}</span><div class="row-actions">${actions}</div>`;
}

function renderTable() {
  const cont = $("#leadsContainer");
  const leads = filteredLeads();

  if (!leads.length) {
    const msg = STATE.search || STATE.dateFilter !== "all"
      ? "No hay registros que coincidan con tu búsqueda o filtro."
      : STATE.view === "prospectos"
        ? "Aún no hay prospectos con contacto. Cuando alguien complete un diagnóstico o agende una cita, aparecerá aquí."
        : STATE.view === "contenido"
          ? "Aún no has generado posts. Los que crees con la herramienta aparecerán aquí."
          : "Aún no hay registros. Cuando uses tus herramientas, aparecerán aquí.";
    cont.innerHTML = `<div class="empty-state"><span class="big">📭</span><p>${msg}</p></div>`;
    return;
  }

  const showContact = STATE.view !== "contenido";

  const head = STATE.view === "contenido"
    ? "<tr><th>Tipo</th><th>Negocio</th><th>Detalle</th><th>Fecha</th></tr>"
    : `<tr><th>Tipo</th><th>Nombre / Negocio</th>${showContact ? "<th>Contacto</th>" : ""}<th>Detalle</th><th>Fecha</th></tr>`;

  const rows = leads.map((l) => {
    if (STATE.view === "contenido") {
      return `<tr>
        <td data-l="Tipo">${badge(l.tipo)}</td>
        <td data-l="Negocio">${esc(l.negocio || l.nombre || "—")}</td>
        <td data-l="Detalle">${esc(l.detalle || "—")}</td>
        <td data-l="Fecha">${fmtDate(l.fecha)}</td>
      </tr>`;
    }
    const nombre = esc(l.nombre || "—") +
      (l.negocio && l.negocio !== l.nombre ? `<br><small style="color:var(--ink-soft)">${esc(l.negocio)}</small>` : "");
    return `<tr>
      <td data-l="Tipo">${badge(l.tipo)}</td>
      <td data-l="Nombre / Negocio">${nombre}</td>
      ${showContact ? `<td data-l="Contacto">${contactCell(l.contacto)}</td>` : ""}
      <td data-l="Detalle">${esc(l.detalle || "—")}${scorePill(l.detalle)}</td>
      <td data-l="Fecha">${fmtDate(l.fecha)}</td>
    </tr>`;
  }).join("");

  cont.innerHTML = `<table class="lead-table"><thead>${head}</thead><tbody>${rows}</tbody></table>`;

  // Botones de copiar
  cont.querySelectorAll("[data-copy]").forEach((b) => {
    b.addEventListener("click", () => copyToClipboard(b.dataset.copy));
  });
}

/* ===================== ACCIONES ===================== */
function copyToClipboard(text) {
  const done = () => showToast("📋 Copiado: " + text);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}
function fallbackCopy(text, cb) {
  const ta = document.createElement("textarea");
  ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); cb && cb(); } catch (e) {}
  document.body.removeChild(ta);
}

let toastTimer = null;
function showToast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

function exportCSV() {
  const leads = filteredLeads();
  if (!leads.length) { showToast("No hay datos para exportar en esta vista."); return; }
  const headers = ["Tipo", "Nombre", "Negocio", "Contacto", "Detalle", "Puntuación", "Fecha"];
  const lines = [headers.join(",")];
  leads.forEach((l) => {
    const score = parseScore(l.detalle);
    const row = [l.tipo, l.nombre, l.negocio, l.contacto, l.detalle, score !== null ? score : "", l.fecha]
      .map((v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`)
      .join(",");
    lines.push(row);
  });
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `aimarktech-${STATE.view}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  showToast("⬇️ Exportado: " + leads.length + " registro(s)");
}

/* ===================== UTILIDADES ===================== */
function fmtDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) +
      " " + d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  } catch (e) { return iso; }
}

function esc(str) {
  return (str || "").toString().replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
