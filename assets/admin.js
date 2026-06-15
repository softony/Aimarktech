/* =========================================================
   AIMARKTECH — admin.js
   Panel privado para ver prospectos capturados por las
   herramientas (diagnósticos, posts y citas).
   ---------------------------------------------------------
   Nota: la contraseña aquí es solo una barrera básica del
   lado cliente (igual que el ejemplo del video). Para datos
   sensibles se debe usar autenticación real en el servidor.
   ========================================================= */

const ADMIN_PASS = "Aimark2026"; // cámbiala por la tuya
const LEADS_KEY = "aimarktech_leads";
const SESSION_KEY = "aimarktech_admin_ok";

const $ = (s) => document.querySelector(s);

document.addEventListener("DOMContentLoaded", () => {
  const login = $("#login");
  const panel = $("#panel");

  // ¿Sesión ya iniciada?
  if (sessionStorage.getItem(SESSION_KEY) === "1") {
    showPanel();
  }

  $("#loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const val = $("#pass").value;
    if (val === ADMIN_PASS) {
      sessionStorage.setItem(SESSION_KEY, "1");
      showPanel();
    } else {
      $("#loginStatus").textContent = "Contraseña incorrecta.";
    }
  });

  $("#btnLogout").addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    location.reload();
  });

  $("#btnClear").addEventListener("click", () => {
    if (confirm("¿Seguro que quieres vaciar todos los prospectos guardados?")) {
      localStorage.removeItem(LEADS_KEY);
      render();
    }
  });

  $("#btnExport").addEventListener("click", exportCSV);

  function showPanel() {
    login.classList.add("hidden");
    panel.classList.remove("hidden");
    render();
  }
});

function getLeads() {
  try { return JSON.parse(localStorage.getItem(LEADS_KEY) || "[]"); }
  catch (e) { return []; }
}

function render() {
  const leads = getLeads();
  renderStats(leads);
  renderTable(leads);
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
