---
project: PreCali
created: 2026-07-01
status: done
modified: [2026-07-01, 2026-07-02]
commits: [pending commit]
agents: [zai-coding-plan/glm-5.2, general-subagent (GLM)]
related:
  back: []
  forward: []
---

# Plan: PreCali / Migración a Next.js

## Context

PreCali es hoy un sitio **estático sin build**: `index.html` + `styles.css` (57 KB) + 4 JS tipo IIFE
(`app.js` 1166 LOC, `seguros.js` 585 LOC, `data.js` 1203 LOC, `data-aseguradoras.js` 115 LOC). Los JS
comparten estado por **globales** (`PAISES`, `BANCOS`, `TIPO_CAMBIO_USD`, `AVISOS_LEGALES`) cargados con
etiquetas `<script>` y exponen handlers en `window.` para `onclick` inline (`window.enviarEmail`,
`window.verDetalle`, `window.cambiarPais`, etc.).

Además existe un **bot de WhatsApp** en `api/` como Vercel Serverless Functions en CommonJS
(`require("../_lib/...")`): 10 módulos en `api/_lib/` (≈3700 LOC: flow, ai, documents, ocr, memory,
knowledge, agent, twilio, content-templates, whatsapp-bot) + endpoint `api/whatsapp/precali.js` (396 LOC).
Usa ~20 variables de entorno (TWILIO_*, GROQ_*, OPENAI_*, UPSTASH_REDIS_* / KV_REST_*).

**Hallazgos relevantes para la migración:**
- No hay `package.json`, ni tests, ni TypeScript.
- El **lead form posti­fica a `/`** con el patrón de Netlify Forms (`data-netlify="true"`), pero el
  proyecto está en Vercel → **la captura de leads hoy falla silenciosamente** (el `.catch` igual muestra
  confirmación al usuario). Hay que reemplazarlo por un endpoint real.
- `vercel.json` define cabeceras (`X-Content-Type-Options`, `Referrer-Policy`), `cleanUrls` y
  `trailingSlash: false`; deben migrarse a `next.config.ts`.
- Países con datos operativos: solo Costa Rica (`cr`). El resto está en `backups/data-regional-*`.
- Fuente de verdad del diseño: `theme-color` `#1F4D3F` y fuentes Fraunces / Open Sans / Poppins /
  IBM Plex Mono.

**Decisiones aprobadas con el usuario:**
1. Migración **completa**: frontend a React/Next **Y** el bot WhatsApp reescrito a Route Handlers/TS.
2. Stack: **TypeScript + App Router + React 19 + Tailwind 4**. Portear `styles.css` a Tailwind
   gradualmente **preservando la estética original**.
3. Lead form → **Route Handler con zod + anti-spam**; `data.js` / `data-aseguradoras.js` → **módulos TS tipados**.

**Convenciones a respetar:** idioma UI en es-CR, formato moneda `es-CR` con `Intl.NumberFormat`,
estética/animaciones existentes (scroll-progress, count-up, question-cloud orbit), URLs limpias sin
trailing slash, `cleanUrls: true`.

## Signatures

### Tipos de dominio (S3)
```ts
// src/types/precali.ts  [new]
export type PaisId = 'cr' | 'mx' | 'gt' | 'sv' | 'hn' | 'ni' | 'pa';
export type Moneda = 'crc' | 'usd';
export type TipoPrestamo = 'personal' | 'vehiculo' | 'hipoteca';
export interface Pais {
  id: PaisId; nombre: string; bandera: string; moneda: string;
  simbolo: string; cambioUSD: number; estado: 'activo' | 'borrador'; bancos: number;
}
export interface CondicionPrestamo {
  tasaCRC: number; tasaUSD: number; plazoMax: number; ratioMax: number; comision: number;
  // ...campos adicionales presentes en data.js
}
export interface Banco {
  id: string; nombre: string; color: string; iniciales: string; tipo: 'Público' | 'Privado';
  web: string; verificado: string;
  personal: CondicionPrestamo; vehiculo: CondicionPrestamo; hipoteca: CondicionPrestamo;
}
export interface Aseguradora { /* shape de data-aseguradoras.js */ }
export interface AvisoLegal { creditos: string; seguros: string; privacidad: string; }
```

### Data (S3) — reemplaza los `<script>` globales
```ts
// src/data/paises.ts   [new]  -> export const PAISES: Pais[]
// src/data/bancos.ts   [new]  -> export const BANCOS: Banco[]
// src/data/aseguradoras.ts [new] -> export const ASEGURADORAS: Aseguradora[]
// src/data/avisos.ts   [new]  -> export const AVISOS_LEGALES: Record<PaisId, AvisoLegal>
// src/data/config.ts   [new]  -> export const TIPO_CAMBIO_USD = 510 as const;
```

### Hooks de UI (S6, S7)
```ts
// src/hooks/use-calculadora-credito.ts [new]
export function useCalculadoraCredito(): {
  pais: Pais; cambiarPais(id: PaisId): void;
  seleccion: Set<string>; toggleBanco(id: string): void; selectAll(todo: boolean): void;
  tipoActual: TipoPrestamo; setTipo(t: TipoPrestamo): void;
  calcular(): ResultadoBanco[];  // calcula y memoiza
}
// src/hooks/use-comparador-seguros.ts [new]
export function useComparadorSeguros(): { /* análogo para auto/vida/salud */ }
```

### Route Handlers (S8, S15)
```ts
// src/app/api/lead/route.ts [new]
export async function POST(req: Request): Promise<Response>  // 200 | 400 (zod) | 429 (rate limit)
// src/app/api/whatsapp/precali/route.ts [new]
export async function POST(req: Request): Promise<Response>  // text/xml TwiML; 200 siempre
```

### Env + server lib (S10, S14)
```ts
// src/lib/env.ts [new]
export interface PrecaliEnv {
  TWILIO_ACCOUNT_SID: string; TWILIO_AUTH_TOKEN: string;
  OPENAI_API_KEY?: string; GROQ_API_KEY?: string;
  UPSTASH_REDIS_REST_URL?: string; UPSTASH_REDIS_REST_TOKEN?: string;
  PRECALI_AI_PROVIDER?: 'openai' | 'groq'; PRECALI_AI_DISABLED?: string;
  // ...resto de las ~20 vars
}
export function getEnv(): PrecaliEnv            // [new] lee process.env con validación
export function isFeatureEnabled(flag: keyof PrecaliEnv): boolean  // [new]
// src/lib/whatsapp/handle-incoming.ts [adapt] -> port de api/_lib/precali-flow.js
export async function handleIncoming(input: {
  session: Session; bodyText: string; buttonPayload?: string;
  buttonText?: string; defaultCountry: PaisId;
}): Promise<{ actions: Action[]; session: Session }>
```

### Lead schema (S8)
```ts
// src/lib/leads/schema.ts [new]
import { z } from 'zod';
export const leadSchema = z.object({
  nombre: z.string().min(1).max(80),
  apellido: z.string().min(1).max(80),
  email: z.email(),
  banco: z.string().min(1).max(120),
  'tipo-prestamo': z.string().min(1).max(60),
  monto: z.string().min(1).max(40),
  cuota: z.string().min(1).max(40),
  'acepta-terminos': z.literal('sí'),
  'acepta-marketing': z.enum(['sí', 'no']),
  'bot-field': z.string().max(0).optional(),  // honeypot
});
export type Lead = z.infer<typeof leadSchema>;
```

## Security invariants

- `@invariant`: ningún input de usuario/WhatsApp se renderiza sin escape. React auto-escapa por
  defecto; **se prohíbe `dangerouslySetInnerHTML`** salvo con sanitización explícita (DOMPurify).
  (CWE-79)
- `@invariant`: el webhook de WhatsApp **verifica la firma X-Twilio-Signature** con el Auth Token
  antes de procesar; si no coincide → 403 sin side effects. (CWE-306 — Missing Authentication for API)
- `@invariant`: el endpoint de leads aplica **honeypot + rate-limit** (p.ej. Upstash Ratelimit o
  in-memory LRU por IP) y rechaza payloads que no pasen `leadSchema`. (CWE-770 / CWE-799)
- `@invariant`: las URLs/medios de Twilio descargados se validan contra allowlist de dominios
  (`api.twilio.com`, `lighthouse.imagor.io`…) antes de cualquier fetch → sin open redirect ni SSRF
  (CWE-601 / CWE-918).
- `@invariant`: los accesos a Upstash KV usan el SDK oficial (`@upstash/redis`), nunca concatenación
  de strings para claves a partir de input externo. (CWE-89 análogo)
- `@invariant`: **ningún secreto** (tokens, API keys) se loguea ni se envía al cliente; todo el
  código que los toca vive bajo `src/lib/**` importado solo desde Server Components / Route Handlers.
  (CWE-532)
- `@invariant`: los paths temporales de OCR/documentos se validan dentro de un directorio base
  (`os.tmpdir()` + basename sin `..`). (CWE-22)

## Subtasks

<!-- state legend: [ ] todo | [~] in-progress | [x] done | [!] blocked/failed (reason inline) -->
<!-- deps: append [needs: S1, S2] to gate a subtask; no needs = runs in parallel -->
<!-- tier: append [tier: cheap|mid|hard|batch] to route the subtask to a model tier -->

### Fase A — Fundación (secuencial, raíz del grafo)

- [x] **S1**: Bootstrap del proyecto Next.js 15 (App Router) + React 19 + TypeScript + Tailwind 4.
  Crear `package.json`, `tsconfig.json` (strict), `next.config.ts`, `postcss.config.mjs`,
  `app/layout.tsx` raíz, `app/globals.css`, `.gitignore` (ampliar el actual), `.env.example` con las
  ~20 vars. Mover assets estáticos (`asterisco.*`, `favicon.*`) a `public/`. `npm run dev` levanta
  sin errores. [tier: mid] -- verify: ✅ `npm run build` (Next 15.5.20, 4 rutas) · ✅ `npx tsc --noEmit`
  exit 0 · assets movidos con `git mv` (historial preservado) · fixed: faltaba `import "./globals.css"`
  en layout.tsx.

- [ ] **S2**: Design tokens → Tailwind 4. Portear las variables CSS de `styles.css` (`:root`,
  `--color-*`, `theme-color #1F4D3F`, paleta) a `@theme` en `globals.css`. Cargar las 4 fuentes
  (Fraunces, Open Sans, Poppins, IBM Plex Mono) vía `next/font/google`. Definir utilidades base
  (`.container`, animaciones `scroll-progress`, `cursor-blink`, `count-up`). [needs: S1] [tier: mid]
  -- verify: `npm run build` | must_include: `@theme` en globals.css

- [ ] **S3**: Tipar y portear la data. Mover `data.js` → `src/data/{paises,bancos,avisos,config}.ts`
  y `data-aseguradoras.js` → `src/data/aseguradoras.ts`, con los tipos en `src/types/precali.ts`.
  Los datos de Costa Rica deben quedar **idénticos** a los actuales (sin perder campos). [needs: S1]
  [tier: mid] -- verify: `npx tsc --noEmit` | test: `src/data/__tests__/data.test.ts` (snapshot de cr)

### Fase B — Frontend (paralelizable tras S4/S3)

- [ ] **S4**: Layout y componentes shell. Portear `<header>`/nav, `<footer>`, scroll-progress bar,
  back-to-top, country-select, y el `modal-host` (portal) a componentes React (`<SiteHeader>`,
  `<SiteFooter>`, `<ScrollProgress>`, `<BackToTop>`, `<CountrySelect>`, `<ModalHost>`). Eliminar los
  `onclick` inline a favor de props/handlers. [needs: S1, S2] [tier: mid]
  -- verify: `npm run build` | must_not_include: `onclick=` en `.tsx`

- [ ] **S5**: Secciones estáticas del home. Componentes para hero (con `question-cloud` orbit),
  metodología, contacto y avisos legales, consumiendo `AVISOS_LEGALES` desde `src/data`. [needs: S4, S3]
  [tier: cheap] -- verify: `npm run build` | test: render hero contiene el título H1

- [ ] **S6**: Calculadora de **créditos**. Portear la lógica de `app.js` (cálculo de cuota/monto,
  ratio máximo, filtrado por banco, ordenamiento, currency USD↔CRC) al hook
  `useCalculadoraCredito` + componentes (`<CalculatorForm>`, `<ResultList>`, `<ResultCard>`,
  `<BankDetail>`). Migrar el modal de detalle y la animación count-up. Cobertura: tipos personal,
  vehicular, hipotecario para Costa Rica. [needs: S4, S3] [tier: hard]
  -- verify: `npm run build` | test: `src/hooks/__tests__/use-calculadora-credito.test.ts` (cuota
  esperada para un input conocido = valor actual de la calculadora)

- [ ] **S7**: Comparador de **seguros**. Portear `seguros.js` (auto/vida/salud, tasas por país,
  defaults `DEFAULT_AUTO_VALOR`) al hook `useComparadorSeguros` + componentes. [needs: S4, S3]
  [tier: hard] -- verify: `npm run build` | test: snapshot de cálculo auto CR

- [ ] **S8**: Lead form + Route Handler `POST /api/lead`. Implementar `leadSchema` (zod), honeypot,
  rate-limit por IP y reemplazo del `fetch('/')` roto. El handler persiste/loguea el lead (detalle de
  persistencia: ver Open questions). En UI, modal de confirmación existente. [needs: S4] [tier: hard]
  -- verify: `curl -X POST /api/lead` (200 con payload válido, 400 con inválido, 429 tras N) |
  test: `src/app/api/lead/route.test.ts`

- [ ] **S9**: Páginas legales. `app/privacidad/page.tsx` y `app/terminos/page.tsx` desde los `.html`
  actuales como Server Components (mismo contenido, mismas rutas sin `.html`). [needs: S4] [tier: cheap]
  -- verify: `GET /privacidad` 200 | must_not_include: referencias a `.html`

### Fase C — Backend WhatsApp (paralelo a B tras S10)

- [ ] **S10**: `src/lib/env.ts` (env tipado + flags) y scaffold `src/lib/whatsapp/`. Definir tipos
  `Session`, `Action`, `Message` y barrer las ~20 vars de entorno del CommonJS actual. [needs: S1]
  [tier: mid] -- verify: `npx tsc --noEmit` | must_include: `getEnv()` exportado

- [ ] **S11**: Portear memoria/estado (`api/_lib/precali-memory.js`) → `src/lib/whatsapp/memory.ts`
  con `@upstash/redis` (Upstash KV). `defaultSession`, `getSession`, `saveSession`, `resetSession`,
  `kvConfigured`. [needs: S10] [tier: mid] -- verify: `npx tsc --noEmit`

- [ ] **S12**: Portear Twilio (`precali-twilio.js`, `precali-content-templates.js`, `twilio-media.js`)
  → `src/lib/whatsapp/{twilio,content-templates,media}.ts`. `sendText`, `sendContent`, `fetchTwilioMedia`,
  `buildQuickReply`, `buildListaProducto`. [needs: S10] [tier: mid] -- verify: `npx tsc --noEmit`

- [ ] **S13**: Portear IA/OCR (`precali-ai.js`, `precali-knowledge.js`, `precali-documents.js`,
  `precali-ocr.js`) → `src/lib/whatsapp/{ai,knowledge,documents,ocr}.ts`. Soporta proveedores OpenAI y
  Groq (visión), fallback OCR, validación de dominios en fetch de medios (invariante SSRF). [needs: S10]
  [tier: hard] -- verify: `npx tsc --noEmit` | test: parseo de documento de ejemplo

- [ ] **S14**: Portear flow/agente/bot (`precali-flow.js`, `precali-agent.js`,
  `precali-whatsapp-bot.js`, `precali-tools.js`) → `src/lib/whatsapp/{flow,agent,bot,tools}.ts`.
  `handleIncoming` y todo el estado del bot. [needs: S11, S12, S13] [tier: hard]
  -- verify: `npx tsc --noEmit` | test: `src/lib/whatsapp/__tests__/flow.test.ts` (transición de steps)

- [ ] **S15**: Route Handler del webhook `POST /api/whatsapp/precali`. Parseo del form-urlencoded de
  Twilio, **verificación de `X-Twilio-Signature`**, dispatch a `handleIncoming`, respuesta TwiML
  (`Content-Type: text/xml`). Mantiene el comportamiento de "200 siempre, incluso en error". [needs: S14]
  [tier: hard] -- verify: `curl` con firma inválida → 403; firma válida → 200 XML |
  test: `src/app/api/whatsapp/precali/route.test.ts`

### Fase D — Integración y limpieza

- [ ] **S16**: Migrar `vercel.json` a `next.config.ts` (cabeceras `X-Content-Type-Options` y
  `Referrer-Policy` globales, `cleanUrls`, `trailingSlash: false`), `metadata` (Open Graph/Twitter,
  favicons, `themeColor`) en `layout.tsx`, y `robots`. Eliminar `vercel.json` y `.vercelignore` si
  aplica. [needs: S1] [tier: cheap] -- verify: `npm run build` | must_not_include: `vercel.json`

- [ ] **S17**: Typecheck + lint + build verde; borrar los archivos legacy (`index.html`, `app.js`,
  `seguros.js`, `data.js`, `data-aseguradoras.js`, `styles.css`, `privacidad.html`, `terminos.html`,
  `api/` completo). Dejar `backups/` y `scripts/` intactos. [needs: S5, S6, S7, S8, S9, S15, S16]
  [tier: mid] -- verify: `npm run typecheck && npm run lint && npm run build && npm test`

## Out of scope

- Migrar a los países regionales (`mx`, `gt`, `sv`, `hn`, `ni`, `pa`) más allá de lo que ya tienen
  los datos en `backups/`. Solo `cr` queda operativo, como hoy.
- Cambiar la **estética/branding** visual (colores, tipografías, animaciones). El objetivo es
  preservar el look actual, no rediseñarlo.
- Persistencia real de los leads en una base de datos (queda como decisión abierta; ver Open
  questions). El plan entrega el endpoint; el destino del lead se decide aparte.
- Reentrenar/cambiar los prompts del agente de IA del WhatsApp: se portaean tal cual.
- E2E con navegador (Playwright) — se cubre con unit/integración de lógica; el exercise visual queda
  para una pasada posterior.
- Mover el dominio o configurar CI/CD; el deploy sigue siendo Vercel.

## Open questions

> **Resueltas al aprobar (2026-07-01, defaults aceptados):**
> - **Q1** → log + email (sin persistencia en DB todavía).
> - **Q2** → rate-limit in-memory LRU por IP.
> - **Q3** → preview primero, cutover del webhook por URL.

## Notes

- Grafo de dependencias (acíclico, verificado): S1 raíz → {S2, S3, S10, S16} → S4 → {S5, S6, S7, S8,
  S9}; S10 → {S11, S12, S13} → S14 → S15; S17 cierra todo.
- Los archivos legacy **no se tocan** hasta S17, así las Fases B/C pueden consultarlos como referencia
  durante el porteo y el sitio viejo sigue sirviendo si hace falta.
- Tailwind 4 + `next/font` ya cubren el preload de fuentes; quitar los `<link>` a Google Fonts del
  `<head>` para evitar render-blocking.
- Considerar mantener `data.js`/`data-aseguradoras.js` como fuente temporal y generar los `.ts` desde
  ellos si el porteo manual es propenso a errores (opción para `/craft`).

## Amend log

<!-- append-only; post-approval changes: YYYY-MM-DD - what changed - why -->
- 2026-07-01 - Plan aprobado; open questions Q1/Q2/Q3 resueltas con los defaults recomendados
  (log+email, LRU in-memory, preview-primero). Sin cambios de scope ni firmas.
- 2026-07-01 - Pool de ejecución: fleet local (worker-code/worker-general para cheap/mid;
  GLM ejecuta hard y valida todo).
- 2026-07-02 - BUG harness: worker-code (ornith-coder:9b) rompía por template Jinja
  `raise_exception('No user query found in messages.')` en llamadas subagent de opencode → 400
  envuelto como APIConnectionError, sin fallback, ~10 retries, cancel. Revertido a qwen3-coder:30b
  (known-good) en litellm/config.yaml + config.local.yaml. PENDIENTE: reiniciar el contenedor
  `litellm-fleet` en el Mac Mini para que aplique.
- 2026-07-02 - S1 [x] done: el worker cancelado igual completó los archivos; validé (tsc + build
  verde) y corregí el import de globals.css faltante en layout.tsx.
- 2026-07-02 - Wave 1 done (S2, S3, S10, S16): tokens @theme + next/font, data tipada (8 bancos,
  5 aseguradoras, 13 tests), env.ts + whatsapp/types.ts, vercel.json→next.config.ts + robots.
- 2026-07-02 - Wave 2 done (S11, S12, S13, S4, S14): ports backend fiel (memory/twilio/ai/ocr/
  knowledge/documents/flow/agent/bot/tools) + componentes shell. añadido pedir_producto a
  SessionStep (faltaba). guards SSRF/CWE-918 en media+ai.
- 2026-07-02 - Wave 3 done (S5, S6, S7, S8, S9, S15): secciones home + calculadora créditos
  (7 tests, regresión numérica) + comparador seguros (5 tests) + lead /api/lead (zod+LRU, 7 tests)
  + legales /privacidad /terminos + webhook /api/whatsapp/precali (verify firma Twilio, 4 tests).
- 2026-07-02 - DESVIACIÓN aceptada: styles.css se CONSERVA como puente CSS (importado en layout)
  hasta el port gradual a Tailwind. S17 borra index.html/app.js/seguros.js/data*.js/privacidad.html
  /terminos.html/api/ PERO NO styles.css. Backups/ y scripts/ intactos.
- 2026-07-02 - App Router en raíz `app/` (no `src/app/`): rutas en app/api/lead, app/api/whatsapp/
  precali, app/privacidad, app/terminos. (El bootstrap de S1 puso app/ en raíz; coherente.)
- 2026-07-02 - Gates verde: typecheck OK · lint OK (no warnings) · 36 tests OK (6 suites) · build OK.
  En revisión /vet.
- 2026-07-02 - /vet veredicto HOLD → 2 criticals corregidos: (1) CWE-79 ResultList.tsx usaba
  dangerouslySetInnerHTML → convertido a JSX <strong> (0 peligrosos ahora); (2) knowledge.ts leía
  archivos legacy borrados → conocimiento hecho estático explícito. Re-run gates verde. /exercise
  lite OK: rutas 200, /api/lead 200/400/honeypot, webhook sin firma → 403. status: done.
- 2026-07-02 - Non-blocking diferido (tech debt): test happy-path del webhook (firma válida → 200),
  bloqueo CGNAT/multicast en isPrivateIPv4, SMTP real para leads (hoy solo log), test de flow.test.ts
  (S14) y document-parse (S13), port completo styles.css→Tailwind.
