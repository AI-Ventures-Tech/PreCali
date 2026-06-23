// ============================================================
// PreCali AI — Plantillas de contenido interactivo
// ============================================================
// Usa los Content SID creados una sola vez con
// scripts/setup-twilio-content.js (guardados como variables de
// entorno). Esta capa arma el "contentVariables" correcto para
// cada momento de la conversacion.

function listProductoSid() {
  return process.env.TWILIO_CONTENT_LIST_PRODUCTO || "";
}

function quickReplySid() {
  return process.env.TWILIO_CONTENT_QR_GENERICO || "";
}

function templatesConfigured() {
  return Boolean(listProductoSid() && quickReplySid());
}

// Arma un envio de lista (solo se usa para elegir tipo de credito).
function buildListaProducto() {
  return {
    contentSid: listProductoSid(),
    contentVariables: {},
  };
}

// Arma un envio de menu de 3 botones, siempre con la misma forma:
// texto + boton1/boton2/boton3. options = [{ id, title }, { id, title }, { id, title }]
function buildQuickReply(bodyText, options) {
  const padded = options.slice(0, 3);
  while (padded.length < 3) padded.push({ id: "na", title: "—" });

  return {
    contentSid: quickReplySid(),
    contentVariables: {
      1: bodyText,
      2: padded[0].id,
      3: padded[0].title,
      4: padded[1].id,
      5: padded[1].title,
      6: padded[2].id,
      7: padded[2].title,
    },
  };
}

module.exports = {
  templatesConfigured,
  buildListaProducto,
  buildQuickReply,
};
