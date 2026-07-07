// Chat de prueba local para el bot de WhatsApp de PreCali, sin Twilio ni WhatsApp real.
// Uso: npx tsx scripts/probar-bot.ts   (o: npm run probar-bot)
//
// Simula la conversacion completa en la terminal usando el mismo motor (`handleIncoming`)
// que usa el webhook real. Sirve para probar a mano el motor calificador: escribi una
// cedula distinta en cada corrida y fijate que nivel de riesgo le asigna y como cambia
// el mensaje del bot (rescate en Nivel 1, nota de prima en Nivel 2, oferta directa en Nivel 3).

import * as readline from "node:readline";
import { handleIncoming } from "../src/lib/whatsapp/flow";
import { defaultSession } from "../src/lib/whatsapp/memory";
import type { Session, Action, ButtonOption } from "../src/lib/whatsapp/types";

let session: Session = defaultSession();
let lastButtons: ButtonOption[] = [];

function printActions(actions: Action[]): void {
  for (const a of actions) {
    console.log(`\n🤖 ${a.body}`);
    if (a.kind === "buttons") {
      a.options.forEach((o, i) => console.log(`   ${i + 1}. ${o.title}  (o escribi: ${o.id})`));
      lastButtons = a.options;
    } else {
      lastButtons = [];
    }
  }
  if (session.buroResult) {
    console.log(`\n   [debug] nivel de riesgo asignado: ${session.buroResult.nivel} (categoria ${session.buroResult.categoriaSugef})`);
  }
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "\n> " });

console.log("=== PreCali — chat de prueba local (sin WhatsApp real) ===");
console.log("Escribi como si fueras el usuario. Para elegir una opcion, escribi el numero o el texto exacto.");
console.log('Cuando pida nombre+cedula+correo en un mensaje, usa "\\n" para separar lineas: Juan Perez\\n1-2345-6789\\njuan@example.com');
console.log("Comandos: /reset reinicia la conversacion. Ctrl+C para salir.");

async function respond(bodyText: string, buttonPayload: string): Promise<void> {
  const result = await handleIncoming({ session, bodyText, buttonPayload, defaultCountry: "cr" });
  session = result.session;
  printActions(result.actions);
  rl.prompt();
}

// readline emite cada linea sin esperar a que termine la anterior; encolamos para
// procesar una a la vez y evitar que dos respuestas async pisen la sesion en curso.
let queue: Promise<void> = Promise.resolve();

async function handleLine(lineRaw: string): Promise<void> {
  const line = lineRaw.trim();

  if (line === "/reset") {
    session = defaultSession();
    lastButtons = [];
    await respond("", "");
    return;
  }

  const asIndex = Number(line);
  if (Number.isInteger(asIndex) && asIndex >= 1 && asIndex <= lastButtons.length) {
    await respond("", lastButtons[asIndex - 1].id);
    return;
  }
  if (lastButtons.some((b) => b.id === line)) {
    await respond("", line);
    return;
  }
  // El paso de datos del lead pide nombre+cedula+correo en UN solo mensaje con saltos
  // de linea reales (como en WhatsApp). En la terminal escribi "\n" literal donde iria
  // el salto de linea, ej: Juan Perez\n1-2345-6789\njuan@example.com
  await respond(line.replace(/\\n/g, "\n"), "");
}

rl.on("line", (lineRaw) => {
  queue = queue.then(() => handleLine(lineRaw));
});

queue = queue.then(() => respond("", ""));
