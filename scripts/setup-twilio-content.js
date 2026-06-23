// ============================================================
// PreCali AI - Configuracion inicial de plantillas de Twilio
// ============================================================
// Crea plantillas de quick reply buttons para WhatsApp.
// Ya no usamos interactive list para el primer paso, porque abre
// un panel extra y la gente se pierde.
//
// En CMD:
//   set "TWILIO_ACCOUNT_SID=ACxxxxxxxx"
//   set "TWILIO_AUTH_TOKEN=xxxxxxxx"
//   node scripts\setup-twilio-content.js
//
// Copia los SID que imprime a Vercel:
//   TWILIO_CONTENT_LIST_PRODUCTO=HX...
//   TWILIO_CONTENT_QR_GENERICO=HX...
//
// Nota: TWILIO_CONTENT_LIST_PRODUCTO se conserva por compatibilidad
// de nombre, pero ahora tambien es una plantilla quick-reply.

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

if (!ACCOUNT_SID || !AUTH_TOKEN) {
  console.error("Falta configurar TWILIO_ACCOUNT_SID y/o TWILIO_AUTH_TOKEN antes de correr este script.");
  process.exit(1);
}

function authHeader() {
  return "Basic " + Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString("base64");
}

async function createContent(definition) {
  const response = await fetch("https://content.twilio.com/v1/Content", {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(definition),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Error creando "${definition.friendly_name}" (HTTP ${response.status}): ${raw}`);
  }
  return JSON.parse(raw);
}

const PRODUCTO_BOTONES = {
  friendly_name: "precali_botones_tipo_credito_" + Date.now(),
  language: "es",
  variables: { 1: "texto", 2: "id1", 3: "Boton 1", 4: "id2", 5: "Boton 2", 6: "id3", 7: "Boton 3" },
  types: {
    "twilio/quick-reply": {
      body: "{{1}}",
      actions: [
        { id: "{{2}}", title: "{{3}}" },
        { id: "{{4}}", title: "{{5}}" },
        { id: "{{6}}", title: "{{7}}" },
      ],
    },
    "twilio/text": {
      body: "{{1}}",
    },
  },
};

const QR_GENERICO = {
  friendly_name: "precali_confirmacion_generica_" + Date.now(),
  language: "es",
  variables: { 1: "texto", 2: "id1", 3: "Boton 1", 4: "id2", 5: "Boton 2", 6: "id3", 7: "Boton 3" },
  types: {
    "twilio/quick-reply": {
      body: "{{1}}",
      actions: [
        { id: "{{2}}", title: "{{3}}" },
        { id: "{{4}}", title: "{{5}}" },
        { id: "{{6}}", title: "{{7}}" },
      ],
    },
    "twilio/text": {
      body: "{{1}}",
    },
  },
};

(async () => {
  console.log("Creando plantillas de Twilio para PreCali AI...\n");

  try {
    const producto = await createContent(PRODUCTO_BOTONES);
    console.log("OK Botones de tipo de credito creados.");
    console.log("  TWILIO_CONTENT_LIST_PRODUCTO=" + producto.sid);
  } catch (error) {
    console.error("ERROR No se pudieron crear los botones de tipo de credito:", error.message);
  }

  console.log("");

  try {
    const qr = await createContent(QR_GENERICO);
    console.log("OK Menu de 3 botones reutilizable creado.");
    console.log("  TWILIO_CONTENT_QR_GENERICO=" + qr.sid);
  } catch (error) {
    console.error("ERROR No se pudo crear el menu de 3 botones:", error.message);
  }

  console.log("\nListo. Copia las 2 lineas TWILIO_CONTENT_... a Vercel.");
})();
