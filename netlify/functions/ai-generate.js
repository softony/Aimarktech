/* =========================================================
   AIMARKTECH — Netlify Function: ai-generate
   ---------------------------------------------------------
   IA "enchufable". El sitio funciona sin esto (modo local).
   Cuando configures una API key en las variables de entorno
   de Netlify, esta función responde con IA real:

     OPENAI_API_KEY      -> usa OpenAI (gpt-4o-mini por defecto)
     ANTHROPIC_API_KEY   -> usa Anthropic (Claude)

   Variables opcionales:
     OPENAI_MODEL    (default: gpt-4o-mini)
     ANTHROPIC_MODEL (default: claude-3-5-haiku-latest)

   Respuestas:
     GET   -> { configured: true|false }   (para el indicador de estado)
     POST  -> { diagnostico: {...} } | { post: {...} } | { configured:false }

   Requiere Node 18+ (fetch global). Sin dependencias npm.
   ========================================================= */

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";

const isConfigured = () => Boolean(OPENAI_KEY || ANTHROPIC_KEY);

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  // Estado para el indicador del frontend
  if (event.httpMethod === "GET") {
    return json(200, { configured: isConfigured() });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  // Si no hay API key, devolvemos configured:false -> el frontend usa modo local
  if (!isConfigured()) {
    return json(200, { configured: false });
  }

  let payload, type;
  try {
    const parsed = JSON.parse(event.body || "{}");
    type = parsed.type;
    payload = parsed.payload || {};
  } catch (e) {
    return json(400, { error: "Invalid JSON" });
  }

  try {
    if (type === "diagnostico") {
      const data = await generateDiagnostico(payload);
      return json(200, { configured: true, diagnostico: data });
    }
    if (type === "post") {
      const data = await generatePost(payload);
      return json(200, { configured: true, post: data });
    }
    return json(400, { error: "Unknown type" });
  } catch (e) {
    // Cualquier fallo -> el frontend cae a modo local con elegancia
    return json(200, { configured: false, error: String(e && e.message || e) });
  }
};

/* ---------- Prompts ---------- */
function diagnosticoPrompt(p) {
  return `Eres un consultor de negocios de la agencia "Aimarktech" (IA, Marketing y Mentalidad Empresarial).
Filosofía: "Primero trabajamos en el empresario, después en el negocio". Trabajan 3 pilares:
Mentalidad, Tecnología & IA, y Crecimiento medible.

Genera un diagnóstico EXPRESS para este negocio. Responde SOLO con un JSON válido, sin texto extra, con esta forma exacta:
{
  "score": <número 15-95 de madurez digital>,
  "nivel": "<2-4 palabras, ej. 'En crecimiento'>",
  "resumen": "<1-2 frases motivadoras y realistas>",
  "fortaleza": "<1 frase sobre su punto a favor>",
  "recomendaciones": [
    {"pilar": "🧠 Mentalidad", "txt": "<recomendación accionable>"},
    {"pilar": "🤖 Tecnología & IA", "txt": "<recomendación accionable>"},
    {"pilar": "📈 Crecimiento", "txt": "<recomendación accionable>"}
  ]
}

Datos del negocio:
- Nombre del dueño: ${p.nombre}
- Giro del negocio: ${p.negocio}
- Reto principal: ${p.reto}
- Objetivo principal a 6 meses: ${p.objetivo || "no especificado"}
- Qué ha intentado para crecer: ${p.intentado || "no especificado"}
- Nivel de madurez digital (1-5): ${p.digital}

Las 3 recomendaciones deben ser hallazgos accionables y específicos para su giro y su objetivo (son un adelanto de valor real; el plan completo de 90 días se entrega en una sesión).

Tono: cercano, profesional y en español de México. Recomendaciones concretas y específicas para su giro.`;
}

function postPrompt(p) {
  return `Eres un copywriter experto en redes sociales de la agencia "Aimarktech".
Crea una publicación para Instagram. Responde SOLO con un JSON válido, sin texto extra, con esta forma exacta:
{
  "headline": "<titular corto y potente para la imagen, máx 45 caracteres>",
  "caption": "<copy persuasivo de 2-4 líneas con emojis y una llamada a la acción>",
  "hashtags": "<6-8 hashtags relevantes separados por espacio>",
  "cta": "<2-3 palabras para el botón, ej. 'Agenda hoy'>"
}

Datos:
- Negocio: ${p.negocio}
- Producto/promoción: ${p.producto}
- Tono: ${p.tono}

Español de México, persuasivo y natural.`;
}

/* ---------- Generadores ---------- */
async function generateDiagnostico(p) {
  const raw = await chat(diagnosticoPrompt(p));
  const data = parseJSON(raw);
  // Normalización defensiva
  data.score = clamp(parseInt(data.score, 10) || 50, 15, 95);
  if (!Array.isArray(data.recomendaciones)) data.recomendaciones = [];
  return data;
}

async function generatePost(p) {
  const raw = await chat(postPrompt(p));
  return parseJSON(raw);
}

/* ---------- Llamada al LLM (OpenAI o Anthropic) ---------- */
async function chat(prompt) {
  if (OPENAI_KEY) return chatOpenAI(prompt);
  if (ANTHROPIC_KEY) return chatAnthropic(prompt);
  throw new Error("No API key");
}

async function chatOpenAI(prompt) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "{}";
}

async function chatAnthropic(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text || "{}";
}

/* ---------- Utilidades ---------- */
function parseJSON(raw) {
  try { return JSON.parse(raw); }
  catch (e) {
    // Intenta extraer el primer bloque {...}
    const m = (raw || "").match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("Respuesta de IA no es JSON válido");
  }
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
