/* =========================================================
   AIMARKTECH — Netlify Function: kie-image
   ---------------------------------------------------------
   Genera imágenes con IA usando Kie AI (modelo Nano Banana 2)
   para el Generador de Posts. Es "enchufable": el sitio
   funciona sin esto (imagen compuesta con la marca). Cuando
   configures KIE_API_KEY en Netlify y tengas créditos, se
   activa la generación de imágenes con IA reales.

   Variables de entorno (Netlify):
     KIE_API_KEY   -> tu clave de kie.ai (secreta)
     KIE_MODEL     -> opcional (default: nano-banana-2)

   Endpoints:
     GET   /.netlify/functions/kie-image                  -> { configured }
     POST  /.netlify/functions/kie-image  {payload}       -> { taskId }
     GET   /.netlify/functions/kie-image?taskId=XXX       -> { state, image? }

   Flujo (async): el cliente crea la tarea (POST), recibe un
   taskId y luego consulta el estado (GET ?taskId) cada pocos
   segundos hasta que 'state' sea 'success'. Al terminar, esta
   función descarga la imagen y la devuelve como data URL
   (base64) para evitar problemas de CORS al dibujarla/descargarla.

   Requiere Node 18+ (fetch global). Sin dependencias npm.
   ========================================================= */

const KIE_API_KEY = process.env.KIE_API_KEY;
const KIE_MODEL = process.env.KIE_MODEL || "nano-banana-2";
const BASE = "https://api.kie.ai/api/v1/jobs";

const isConfigured = () => Boolean(KIE_API_KEY);

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});

const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${KIE_API_KEY}`,
});

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};

  // ---------- Consultar estado de una tarea ----------
  if (event.httpMethod === "GET" && params.taskId) {
    if (!isConfigured()) return json(200, { configured: false });
    try {
      const res = await fetch(`${BASE}/recordInfo?taskId=${encodeURIComponent(params.taskId)}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`Kie ${res.status}`);
      const data = await res.json();
      const d = data.data || {};
      const state = d.state || "waiting";

      if (state === "success") {
        let url = "";
        try { url = (JSON.parse(d.resultJson || "{}").resultUrls || [])[0] || ""; } catch (e) {}
        if (!url) return json(200, { state: "fail", error: "Sin URL de resultado" });
        // Descargamos la imagen y la devolvemos como data URL (evita CORS en canvas)
        const dataUrl = await toDataUrl(url);
        return json(200, { state: "success", image: dataUrl });
      }
      if (state === "fail") {
        return json(200, { state: "fail", error: d.failMsg || "La generación falló" });
      }
      return json(200, { state, progress: d.progress || 0 });
    } catch (e) {
      return json(200, { state: "fail", error: String(e && e.message || e) });
    }
  }

  // ---------- Estado de configuración (indicador) ----------
  if (event.httpMethod === "GET") {
    return json(200, { configured: isConfigured() });
  }

  // ---------- Crear tarea de generación ----------
  if (event.httpMethod === "POST") {
    if (!isConfigured()) return json(200, { configured: false });

    let p;
    try { p = JSON.parse(event.body || "{}"); }
    catch (e) { return json(400, { error: "Invalid JSON" }); }

    const aspect = p.formato === "story" ? "9:16" : "1:1";
    const prompt = buildPrompt(p);

    try {
      const res = await fetch(`${BASE}/createTask`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          model: KIE_MODEL,
          input: {
            prompt,
            image_input: [],
            aspect_ratio: aspect,
            resolution: "1K",
            output_format: "png",
          },
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Kie ${res.status}: ${t}`);
      }
      const data = await res.json();
      const taskId = data && data.data && data.data.taskId;
      if (!taskId) throw new Error("Sin taskId en la respuesta");
      return json(200, { configured: true, taskId });
    } catch (e) {
      return json(200, { configured: false, error: String(e && e.message || e) });
    }
  }

  return json(405, { error: "Method not allowed" });
};

/* Construye un prompt de fondo publicitario (sin texto, para
   superponer nuestra marca encima en el lienzo). */
function buildPrompt(p) {
  const negocio = (p.negocio || "un negocio").slice(0, 120);
  const producto = (p.producto || "").slice(0, 200);
  const tono = p.tono || "profesional";
  const extra = (p.prompt || "").slice(0, 300);

  const moods = {
    motivador: "energetic, inspiring, bright",
    profesional: "clean, corporate, trustworthy",
    cercano: "warm, friendly, inviting",
    urgente: "bold, high-contrast, dynamic",
  };
  const mood = moods[tono] || "modern, clean";

  return (
    `High-quality advertising background photo for a social media post of the business "${negocio}". ` +
    `Theme: ${producto}. Visual style: ${mood}, modern, premium, professional photography, soft depth of field, ` +
    `subtle blue and cyan brand accents, empty negative space in the center and bottom for text overlay. ` +
    `IMPORTANT: do NOT include any text, words, letters, logos or watermarks in the image. ` +
    (extra ? `Additional direction: ${extra}.` : "")
  );
}

/* Descarga una imagen remota y la convierte a data URL base64 */
async function toDataUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Descarga de imagen ${res.status}`);
  const contentType = res.headers.get("content-type") || "image/png";
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:${contentType};base64,${buf.toString("base64")}`;
}
