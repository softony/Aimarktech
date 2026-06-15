/* =========================================================
   AIMARKTECH — admin.js
   Panel privado para ver prospectos capturados por las
   herramientas (diagnósticos, posts y citas).
   ---------------------------------------------------------
   Dos modos automáticos:
   - SERVIDOR: si Supabase está configurado en Netlify, lee los
     prospectos de la base de datos (centralizados, multi-dispositivo).
     La contraseña que escribes se valida contra ADMIN_TOKEN.
   - LOCAL: si no hay servidor, usa los datos guardados en este
     navegador (localStorage) y la contraseña local de abajo.
   ========================================================= */

const ADMIN_PASS = "Aimark2026"; // fallback local (modo sin Supabase). Cámbiala.
const LEADS_KEY = "aimarktech_leads";
const SESSION_KEY = "aimarktech_admin_ok";
const TOKEN_KEY = "aimarktech_admin_token";
const LEADS_ENDPOINT = "/.netlify/functions/leads";

const $ = (s) => document.querySelector(s);

let MODE = "local";       // 'local' | 'server'
let SERVER_LEADS = [];

document.addEventListener("DOMContentLoaded", () => {
  // ¿Sesión previa? Reintenta con el token guardado.
  if (sessionStorage.getItem(SESSION_KEY) === "1") {
    const tk = sessionStorage.getItem(TOKEN_KEY) || "";
    attemptLogin(tk, true);
  }

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const val = $("#pass").value;
    await attemptLogin(val, false);
  });

  $("#btnLogout").addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    location.reload();
  });

  $("#btnClear").addEventListener("click", () => {
    if (MODE === "server") {
      alert("Los prospectos están en tu base de datos Supabase. Para borrarlos, hazlo desde el panel de Supabase (tabla 'leads').");
      return;
    }
    if (confirm("¿Seguro que quieres vaciar todos los prospectos guardados en este navegador?")) {
      localStorage.removeItem(LEADS_KEY);
      render();
    }
  });

  $("#btnExport").addEventListener("click", exportCSV);
});

/* Intenta iniciar sesión: primero servidor, luego local */
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

  // Modo local (sin servidor configurado)
  if (pass === ADMIN_PASS) {
    MODE = "local";
    sessionStorage.setItem(SESSION_KEY, "1");
    sessionStorage.setItem(TOKEN_KEY, pass);
    showPanel();
  } else if (!silent) {
    if (status) status.textContent = "Contraseña incorrecta.";
  }
}

/* Consulta el servidor. Devuelve {mode:'server'|'local'|'unauthorized', leads} */
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
    return { mode: "local" }; // sin función / deploy estático
  }
}

function showPanel() {
  $("#login").classList.add("hidden");
  $("#panel").classList.remove("hidden");
  render();
}

/* Normaliza un lead del servidor al formato de la tabla */
function normalize(l) {
  return {
    tipo: l.tipo,
    nombre: l.nombre,
    negocio: l.negocio,
    contacto: l.contacto,
    detalle: l.detalle,
    fecha: l.fecha || l.created_at,
  };
}

function getLeads() {
  if (MODE === "server") return SERVER_LEADS.map(normalize);
  try { return JSON.parse(localStorage.getItem(LEADS_KEY) || "[]"); }
  catch (e) { return []; }
}

function render() {
  const leads = getLeads();
  renderStats(leads);
  renderTable(leads);
  renderModeBadge();
}

function renderModeBadge() {
  let el = $("#modeBadge");
  if (!el) {
    el = document.createElement("p");
    el.id = "modeBadge";
    el.style.cssText = "color:var(--ink-soft);font-size:.86rem;margin-top:-14px;";
    const head = document.querySelector(".admin-head div");
    if (head) head.appendChild(el);
  }
  el.innerHTML = MODE === "server"
    ? '🟢 Conectado a Supabase · datos centralizados (todos los dispositivos)'
    : '🟡 Modo local · datos solo de este navegador';
}

function renderStats(leads) {
  const diag = leads.filter((l) => l.tipo === "Diagnóstico").length;
  const posts = leads.filter((l) => l.tipo === "Post generado").length;
  const citas = leads.filter((l) => l.tipo === "Cita agendada").length;

  $("#stats").innerHTML = `
    <div class="stat"><div class="num">${leads.length}</div><div class="lbl">Total de registros</div></div>
    <div class="stat"><div class="num">${diag}</div><div class="lbl">🧠 Diagnósticos</div></div>
    <div class="stat"><div class="num">${posts}</div><div class="lbl">📱 Posts generados</div></div>
    <div class="stat"><div class="num">${citas}</div><div class="lbl">📅 Citas agendadas</div></div>
  `;
}

function badge(tipo) {
  if (tipo === "Diagnóstico") return '<span class="badge b-diag">🧠 Diagnóstico</span>';
  if (tipo === "Post generado") return '<span class="badge b-post">📱 Post</span>';
  if (tipo === "Cita agendada") return '<span class="badge b-cita">📅 Cita</span>';
  return `<span class="badge">${esc(tipo || "—")}</span>`;
}

function renderTable(leads) {
  const cont = $("#leadsContainer");
  if (!leads.length) {
    cont.innerHTML = `
      <div class="empty-state">
        <span class="big">📭</span>
        <p>Aún no hay prospectos. Cuando alguien use tus herramientas, aparecerán aquí.</p>
      </div>`;
    return;
  }

  const rows = leads.map((l) => `
    <tr>
      <td data-l="Tipo">${badge(l.tipo)}</td>
      <td data-l="Nombre / Negocio">${esc(l.nombre || "—")}${l.negocio && l.negocio !== l.nombre ? `<br><small style="color:var(--ink-soft)">${esc(l.negocio)}</small>` : ""}</td>
      <td data-l="Contacto">${esc(l.contacto || "—")}</td>
      <td data-l="Detalle">${esc(l.detalle || "—")}</td>
      <td data-l="Fecha">${fmtDate(l.fecha)}</td>
    </tr>
  `).join("");

  cont.innerHTML = `
    <table class="lead-table">
      <thead>
        <tr><th>Tipo</th><th>Nombre / Negocio</th><th>Contacto</th><th>Detalle</th><th>Fecha</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function exportCSV() {
  const leads = getLeads();
  if (!leads.length) { alert("No hay datos para exportar."); return; }
  const headers = ["Tipo", "Nombre", "Negocio", "Contacto", "Detalle", "Fecha"];
  const lines = [headers.join(",")];
  leads.forEach((l) => {
    const row = [l.tipo, l.nombre, l.negocio, l.contacto, l.detalle, l.fecha]
      .map((v) => `"${String(v || "").replace(/"/g, '""')}"`)
      .join(",");
    lines.push(row);
  });
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `prospectos-aimarktech-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

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
