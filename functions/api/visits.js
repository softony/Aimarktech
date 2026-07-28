/* =========================================================
   AIMARKTECH — Cloudflare Pages Function: visits
   ---------------------------------------------------------
   Contador REAL de visitas al sitio. Los datos viven en tu
   base de datos Supabase, así que el número es global y
   persistente entre todos los dispositivos.

   El sitio funciona SIN esto: si no está configurado, el
   contador simplemente no se muestra (no rompe nada).

   Reutiliza las MISMAS variables de entorno que ya tienes:
     SUPABASE_URL          -> URL de tu proyecto (https://xxxx.supabase.co)
     SUPABASE_SERVICE_KEY  -> service_role / secret key (¡secreta!)

   Ruta pública (Cloudflare Pages):
     POST /api/visits  -> suma +1 y devuelve el total (visita nueva)
     GET  /api/visits  -> solo lee el total actual (sin sumar)

   Requiere la tabla 'site_visits' y la función 'increment_visits'
   en Supabase (ver el SQL en docs/contador-visitas.sql).

   Runtime Workers (fetch global). Sin dependencias npm.
   ========================================================= */

export async function onRequest(context) {
  const { request, env } = context;

  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY;

  const isConfigured = Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);

  const json = (statusCode, body) =>
    new Response(JSON.stringify(body), {
      status: statusCode,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });

  const sbHeaders = () => ({
    "Content-Type": "application/json",
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  });

  if (!isConfigured) return json(200, { configured: false });

  // ---------- Sumar una visita (visita nueva) ----------
  if (request.method === "POST") {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_visits`, {
        method: "POST",
        headers: sbHeaders(),
        body: "{}",
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Supabase ${res.status}: ${txt}`);
      }
      // La función RPC devuelve el nuevo total como número escalar.
      const total = await res.json();
      return json(200, { configured: true, total: toNum(total) });
    } catch (e) {
      return json(200, { configured: false, error: String((e && e.message) || e) });
    }
  }

  // ---------- Leer el total actual (sin sumar) ----------
  if (request.method === "GET") {
    try {
      const url = `${SUPABASE_URL}/rest/v1/site_visits?select=total&id=eq.1`;
      const res = await fetch(url, { headers: sbHeaders() });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Supabase ${res.status}: ${txt}`);
      }
      const rows = await res.json();
      const total = rows && rows[0] ? rows[0].total : 0;
      return json(200, { configured: true, total: toNum(total) });
    } catch (e) {
      return json(200, { configured: false, error: String((e && e.message) || e) });
    }
  }

  return json(405, { error: "Method not allowed" });
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}
