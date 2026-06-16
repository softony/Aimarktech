/* =========================================================
   AIMARKTECH — Netlify Function: leads
   ---------------------------------------------------------
   Guarda y lee prospectos en una base de datos Supabase, para
   centralizar lo que capturan las herramientas (diagnósticos,
   posts y citas) desde CUALQUIER dispositivo.

   El sitio funciona SIN esto (modo local con localStorage).
   Cuando configures estas variables de entorno en Netlify,
   se activa automáticamente:

     SUPABASE_URL          -> URL de tu proyecto (https://xxxx.supabase.co)
     SUPABASE_SERVICE_KEY  -> service_role key (¡secreta!)
     ADMIN_TOKEN           -> contraseña para leer prospectos en el panel

   Endpoints:
     POST /.netlify/functions/leads        -> inserta un prospecto (público)
     GET  /.netlify/functions/leads?token= -> lista prospectos (requiere ADMIN_TOKEN)

   Requiere Node 18+ (fetch global). Sin dependencias npm.
   ========================================================= */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

const isConfigured = () => Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});

const sbHeaders = () => ({
  "Content-Type": "application/json",
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
});

exports.handler = async (event) => {
  // ---------- LISTAR (panel admin) ----------
  if (event.httpMethod === "GET") {
    if (!isConfigured() || !ADMIN_TOKEN) {
      // Sin base de datos o sin token configurado -> el panel usa modo local
      return json(200, { configured: false });
    }
    const token = (event.queryStringParameters || {}).token || "";
    if (token !== ADMIN_TOKEN) {
      return json(401, { error: "unauthorized" });
    }
    try {
      const url = `${SUPABASE_URL}/rest/v1/leads?select=*&order=created_at.desc&limit=300`;
      const res = await fetch(url, { headers: sbHeaders() });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      const leads = await res.json();
      return json(200, { configured: true, leads });
    } catch (e) {
      return json(200, { configured: false, error: String(e && e.message || e) });
    }
  }

  // ---------- INSERTAR (desde las herramientas) ----------
  if (event.httpMethod === "POST") {
    if (!isConfigured()) return json(200, { configured: false });

    let lead;
    try {
      lead = JSON.parse(event.body || "{}");
    } catch (e) {
      return json(400, { error: "Invalid JSON" });
    }

    // Solo guardamos campos esperados (evita inyectar columnas raras)
    const row = {
      tipo: str(lead.tipo),
      nombre: str(lead.nombre),
      negocio: str(lead.negocio),
      contacto: str(lead.contacto),
      detalle: str(lead.detalle),
    };

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
        method: "POST",
        headers: { ...sbHeaders(), Prefer: "return=minimal" },
        body: JSON.stringify(row),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Supabase ${res.status}: ${txt}`);
      }
      return json(200, { configured: true, ok: true });
    } catch (e) {
      return json(200, { configured: false, error: String(e && e.message || e) });
    }
  }

  return json(405, { error: "Method not allowed" });
};

function str(v) {
  if (v === undefined || v === null) return null;
  return String(v).slice(0, 1000);
}
