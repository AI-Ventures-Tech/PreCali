// ============================================================
// PreCali AI — Cliente REST de Twilio
// ============================================================
// TwiML (la respuesta sincronica al webhook) solo permite texto
// plano. Para enviar listas o botones interactivos hay que usar
// la API REST de Mensajes de Twilio de forma proactiva. Este
// modulo encapsula esas dos formas de envio.

const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";

function authHeader() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("twilio_credentials_missing");
  return "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
}

async function postMessage(params) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const body = new URLSearchParams(params);

  const response = await fetch(`${TWILIO_API_BASE}/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const raw = await response.text();
  if (!response.ok) {
    const error = new Error(`twilio_send_${response.status}`);
    error.body = raw.slice(0, 500);
    throw error;
  }
  return JSON.parse(raw);
}

// Envia texto plano (se usa poco ahora; la mayoria de los pasos de
// texto se responden directo por TwiML, que es mas rapido).
async function sendText({ to, from, body }) {
  return postMessage({ To: to, From: from, Body: body });
}

// Envia un mensaje basado en un Content Template (lista o botones).
// contentVariables es un objeto plano { "1": "valor", "2": "valor" }.
async function sendContent({ to, from, contentSid, contentVariables }) {
  const params = { To: to, From: from, ContentSid: contentSid };
  if (contentVariables && Object.keys(contentVariables).length) {
    params.ContentVariables = JSON.stringify(contentVariables);
  }
  return postMessage(params);
}

module.exports = {
  sendText,
  sendContent,
};
