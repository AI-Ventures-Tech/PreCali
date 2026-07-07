// Local test chat for the PreCali WhatsApp bot, without real Twilio or WhatsApp.
// Usage: npx tsx scripts/probar-bot.ts   (or: npm run probar-bot)
//
// Simulates the full conversation in the terminal using the same engine
// (`handleIncoming`) as the real webhook. Useful for manually testing the scoring
// engine: type a different cédula on each run and observe which risk level it
// gets assigned and how the bot's message changes (rescue flow on Level 1, prima
// note on Level 2, direct offer on Level 3).

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
  if (session.buroLevel) {
    console.log(`\n   [debug] nivel de riesgo asignado: ${session.buroLevel}`);
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

// readline emits each line without waiting for the previous one to finish; we queue
// them to process one at a time and avoid two async responses racing on the session.
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
  // The lead-data step asks for name+cédula+email in ONE message with real line
  // breaks (just like WhatsApp). In the terminal, type "\n" literally where the
  // line break should go, e.g.: Juan Perez\n1-2345-6789\njuan@example.com
  await respond(line.replace(/\\n/g, "\n"), "");
}

rl.on("line", (lineRaw) => {
  queue = queue.then(() => handleLine(lineRaw));
});

queue = queue.then(() => respond("", ""));
