// ============================================================
// PreCali AI — Configuracion inicial de plantillas de Twilio
// ============================================================
// CORRER ESTO UNA SOLA VEZ (no se sube a Vercel, es un script local).
//
// Que hace: crea en tu cuenta de Twilio las 2 plantillas de
// contenido interactivo que necesita el bot (una lista y un
// menu de 3 botones reutilizable). Al final te muestra los SID
// (empiezan con "HX...") que tenes que copiar a las variables de
// entorno de Vercel.
//
// Como correrlo:
//   1. Asegurate de tener Node instalado.
//   2. En la terminal, parado en la carpeta del proyecto:
//        set TWILIO_ACCOUNT_SID=ACxxxxxxxx   (Windows: usa "set", Mac/Linux: usa "export")
//        set TWILIO_AUTH_TOKEN=xxxxxxxx
//        node scripts/setup-twilio-content.js
//   3. Copia los 2 SID que te imprime a tus variables de entorno
//      en Vercel: TWILIO_CONTENT_LIST_PRODUCTO y TWILIO_CONTENT_QR_GENERICO
//
// Es seguro correrlo mas de una vez: cada vez crea plantillas
// nuevas (no rompe nada), simplemente terminarias con SIDs
// duplicados en tu cuenta de Twilio. Si ya corriste esto antes y
// guardaste los SID, no hace falta volver a correrlo.

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

if (!ACCOUNT_SID || !AUTH_TOKEN) {
  console.error("Falta configurar TWILIO_ACCOUNT_SID y/o TWILIO_AUTH_TOKEN como variables de entorno antes de correr este script.");
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

const LIST_PRODUCTO = {
  friendly_name: "precali_lista_tipo_credito_" + Date.now(),
  language: "es",
  types: {
    "twilio/list-picker": {
      body: "Hola! Soy *PreCali AI*, tu asesor de credito. Que queres simular hoy?",
      button: "Ver opciones",
      items: [
        { item: "Credito personal", id: "personal", description: "Libre inversion, sin garantia" },
        { item: "Credito vehicular", id: "vehiculo", description: "Para comprar carro o moto" },
        { item: "Credito hipotecario", id: "hipoteca", description: "Para casa, apto o terreno" },
      ],
    },
    "twilio/text": {
      body: "Hola! Soy PreCali AI. Responde 1 para credito personal, 2 para vehiculo, o 3 para hipoteca.",
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
    const list = await createContent(LIST_PRODUCTO);
    console.log("✔ Lista de tipo de credito creada.");
    console.log("  TWILIO_CONTENT_LIST_PRODUCTO=" + list.sid);
  } catch (error) {
    console.error("✘ No se pudo crear la lista de tipo de credito:", error.message);
  }

  console.log("");

  try {
    const qr = await createContent(QR_GENERICO);
    console.log("✔ Menu de 3 botones (reutilizable) creado.");
    console.log("  TWILIO_CONTENT_QR_GENERICO=" + qr.sid);
  } catch (error) {
    console.error("✘ No se pudo crear el menu de 3 botones:", error.message);
  }

  console.log("\nListo. Copia las 2 lineas TWILIO_CONTENT_... que aparecen arriba");
  console.log("a las variables de entorno de tu proyecto en Vercel.");
})();
