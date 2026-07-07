---
project: PreCali
created: 2026-07-07
status: draft
modified: []
commits: []
agents: []
related:
  back:
    - "plans/2026-07-02-motor-calificador-buro-mock/plan.md"
    - "OSINT research: especificación técnica del servicio de Buró de Crédito de Equifax Costa Rica (compartida por el usuario, 2026-07-07)"
  forward: []
---

# Plan: PreCali / Alineación del mock de buró con el contrato de Equifax LATAM (fase preparatoria)

## Context

Tras una investigación OSINT del portal LATAM de Equifax + manuales filtrados de Apigee +
documentación pública US OneView/Consumer Credit Report, se reconstruyó con alta confianza el
contrato técnico base de una integración real de consulta de buró. El mock actual
(`src/lib/buro/mock-equifax.ts`) y el endpoint `POST /api/buro` son funcionalmente correctos pero
**su shape diverge del contrato real** en varios puntos que van a costar trabajo en el swap.

Este plan NO es la integración real (sigue sin acceso sandbox). Es una **fase preparatoria
mínima** que cierra las brechas más seguras (altísima confianza en cualquier producto Equifax)
sin adivinar el namespace costarricense ni copiar campos US-específicos. La regla de la research
fue explícita: *"el nombre interno del nodo final sea creditReport o equivalente; en US aparece
equifaxUSConsumerCreditReport, pero ese nombre no debe copiarse sin validación al caso
costarricense"*.

**Decisión del usuario (2026-07-07):** Opción C — híbrido. Agregar solo campos de altísima
confianza, opcionalizar los operativos del request, y documentar el mapping completo al envelope
Equifax como guía del adapter futuro. NO refactorizar al envelope `consumers.creditReport[]`
(es adivinar el namespace CR).

**Estado actual relevante:**

- `src/types/buro.ts` define `BuroMockResponse` plano (sin envelope, sin status, sin hitCode,
  sin links). Ya está en inglés tras el rename del commit `31f249e`.
- `src/lib/buro/mock-equifax.ts::generateMockBuroResponse(idNumber, inquiryDate)` produce la
  respuesta. Determinístico por cédula.
- `app/api/buro/route.ts::POST` valida body con zod (`{ idNumber }` mínimo 3 chars) y devuelve
  `{ ok: true, data: BuroMockResponse }`. Auth opcional vía `PRECALI_BURO_API_KEY`.
- `src/lib/env.ts::PrecaliEnv` ya incluye `PRECALI_BURO_API_KEY`. Convención: typed env access,
  defaults defensivos en vacío.
- Tests: Vitest con `__tests__/` colocated, 73/73 verdes.
- `scripts/find-cedulas-perfiles.ts` + `src/data/casos-prueba-buro.json` generan el set canónico
  de 15 cédulas. Se regenera cuando cambian los campos.

**Convenciones a respetar:**

- TypeScript estricto, interfaces para object shapes, `type` para unions.
- Identificadores en inglés (post-rename). Strings user-facing y enum values del dominio CR
  se quedan en español.
- Comentarios en inglés, con rationale de seguridad donde aplique (CWE callouts).
- Tests: `describe`/`it` en inglés, aserciones directas, sin mocks innecesarios.
- Route handlers: `NextResponse.json`, `export const dynamic = "force-dynamic"`, zod para body.
- Env vars: typed `PrecaliEnv`, defaults en vacío = modo desarrollo.

## Signatures

```ts
// src/types/buro.ts  [adapt]
export type BuroReportStatus = "completed" | "pending" | "error";

export interface BuroReportLink {
  identifier: string;          // ej: "Individual Report 1"
  type: "GET" | "POST";        // verbo del link
  href: string;                // URL relativa o absoluta al recurso del reporte
}

export interface BuroMockResponse {
  // ...campos existentes sin rename (idNumber, score, sugefCategory, etc.)
  status: BuroReportStatus;    // [new] siempre "completed" en mock; type permite otros para forward-compat
  hitCode: { code: string };   // [new] siempre { code: "1" } = hit en mock; field shape fiel a Equifax US
  links: BuroReportLink[];     // [new] siempre [] en mock; se puebla cuando llegue async retrieval real
}

// src/lib/env.ts  [adapt] — nuevos campos opcionales para configuración operativa
export interface PrecaliEnv {
  // ...existentes
  PRECALI_EQUIFAX_MEMBER_NUMBER: string;     // [new] member number asignado por Equifax al onboarding
  PRECALI_EQUIFAX_SECURITY_CODE: string;     // [new] security code del cliente en Equifax
  PRECALI_EQUIFAX_CUSTOMER_CODE: string;     // [new] customer code del cliente en Equifax
}

// app/api/buro/route.ts  [adapt] — schema zod acepta campos operativos opcionales
const bodySchema = z.object({
  idNumber: z.string().trim().min(3, "idNumber required (min 3 chars)"),
  // Operativos opcionales — ignorados en mock, requeridos cuando llegue el cliente real.
  // Se aceptan para fijar la firma HTTP del endpoint sin romper callers existentes.
  customerReferenceIdentifier: z.string().trim().optional(),
  memberNumber: z.string().trim().optional(),
  securityCode: z.string().trim().optional(),
  customerCode: z.string().trim().optional(),
});
```

## Security invariants

- `@invariant`: los campos operativos (`memberNumber`, `securityCode`, `customerCode`) son
  credenciales/identificadores del cliente en Equifax y **nunca se loguean en texto plano**
  (CWE-532). El log `[buro]` existente solo registra `{ts, category, score}`; los nuevos campos
  del request se descartan explícitamente del log. Ya cubierto por el test CWE-532 actual; se
  extiende la aserción a los nuevos campos.
- `@invariant`: el invariante PII (INV-1, CWE-200) se mantiene — solo `riskLevel` (1/2/3) llega
  al LLM. Los nuevos campos del response (`status`, `hitCode`, `links`) se quedan en la capa
  HTTP/engine; **nunca se interpolan** en `SYSTEM_PROMPT_TEMPLATE` ni en `riskLevelInstruction`.
  Verificado por aserción en `agent.test.ts`.
- `@invariant`: `links[].href` se trata como URL no confiable. En mock es siempre `[]`, pero
  el type lo permite; cuando llegue el real, **debe validarse contra allowlist de hosts de
  Equifax antes de cualquier fetch automático** (CWE-918 / SSRF). El motor NO debe seguir links
  automáticamente; el caller decide. Se documenta como regla en el comentario del tipo
  `BuroReportLink` y se deja como `@invariant` pendiente de implementar cuando exista fetch.
- `@invariant`: los campos operativos del request (`memberNumber` etc.) son **ignorados por el
  mock** — nunca afectan la respuesta. El determinismo por cédula se preserva (CWE-20 inverso:
  inputs "operativos" no deben sesgar el resultado simulado).

## Subtasks

<!-- state legend: [ ] todo | [~] in-progress | [x] done | [!] blocked/failed (reason inline) -->
<!-- deps: append [needs: S1, S2] to gate a subtask; no needs = runs in parallel -->
<!-- tier: append [tier: cheap|mid|hard|batch] to route the subtask to a model tier -->

- [ ] S1: Extender tipos en `src/types/buro.ts`: agregar `BuroReportStatus`, `BuroReportLink`, y
  los campos `status`, `hitCode`, `links` a `BuroMockResponse`. Incluir bloque de comentario al
  tope del archivo con el **mapping table** "nuestro schema ↔ envelope Equifax probable" para
  guiar el adapter futuro (referencia: research OSINT 2026-07-07). [tier: cheap]
  -- verify: `npm run typecheck`

- [ ] S2: Actualizar `src/lib/buro/mock-equifax.ts::generateMockBuroResponse` para poblar los
  nuevos campos: `status: "completed"`, `hitCode: { code: "1" }`, `links: []`. Comentario
  indicando que son fijos en mock (no determinismo extra) y documentación inline del contrato.
  [needs: S1] [tier: cheap]
  -- verify: `npm run typecheck`

- [ ] S3: Extender `src/lib/env.ts::PrecaliEnv` con `PRECALI_EQUIFAX_MEMBER_NUMBER`,
  `PRECALI_EQUIFAX_SECURITY_CODE`, `PRECALI_EQUIFAX_CUSTOMER_CODE` (todos `string`, default `""`
  vía `read()`). Comentario explicando que son para el futuro cliente Equifax y se ignoran en
  modo mock. [tier: cheap]
  -- verify: `npm run typecheck`

- [ ] S4: Extender `bodySchema` en `app/api/buro/route.ts` con campos operativos opcionales
  (`customerReferenceIdentifier`, `memberNumber`, `securityCode`, `customerCode` — todos
  `z.string().trim().optional()`). El handler los ignora en mock (NO los pasa al generador).
  Test nuevo: enviar payload con los operativos, verificar que la respuesta es idéntica a sin
  ellos (determinismo preservado). [needs: S3] [tier: cheap]
  -- when: POST `/api/buro` con `{idNumber, memberNumber:"X"}` / ensures: respuesta idéntica a
     POST con solo `{idNumber}`
  -- verify: `npm test -- buro`

- [ ] S5: Actualizar `app/api/buro/route.test.ts`: extender el test CWE-532 existente para
     afirmar que `memberNumber`/`securityCode`/`customerCode` del request nunca aparecen en el
     log. Agregar test de "campos operativos no afectan la respuesta". [needs: S4] [tier: cheap]
  -- verify: `npm test -- route`

- [ ] S6: Actualizar `src/lib/buro/__tests__/mock-equifax.test.ts`: agregar aserciones de que
  `status === "completed"`, `hitCode.code === "1"`, `links` es `[]` en todas las respuestas
  generadas (100 cédulas). Test de tipo del link (`identifier`, `type`, `href`).
  [needs: S2] [tier: cheap]
  -- verify: `npm test -- mock-equifax`

- [ ] S7: Regenerar `src/data/casos-prueba-buro.json` con `npx tsx
  scripts/find-cedulas-perfiles.ts` para que los registros incluyan los nuevos campos. Actualizar
  `scripts/find-cedulas-perfiles.ts` para que el `Match` interface y el output reflejen los nuevos
  campos del response. [needs: S2] [tier: cheap]
  -- verify: `npx tsx scripts/find-cedulas-perfiles.ts | head -3` muestra `status: "completed"`

- [ ] S8: Validación final completa: typecheck + todos los tests + lint. Confirmar que
  `agent.test.ts` sigue pasando (invariante PII no rota por los nuevos campos).
  [needs: S1, S2, S3, S4, S5, S6, S7] [tier: cheap]
  -- verify: `npm test && npm run typecheck && npm run lint`

## Out of scope

- **Refactor al envelope `consumers.creditReport[]`**: diferido al adapter layer cuando llegue
  acceso real al sandbox. Razón: el namespace y el nombre del nodo son CR-específicos; copiar
  el shape US es adivinar y nos obligaría a refactor dos veces.
- **Renombrar `operations` → `trades`** o `inquiriesLast30Days` → `inquiries[]`: diferido al
  adapter. Los nombres actuales son un modelo de dominio CR claro; el adapter hace la
  traducción al jargon Equifax.
- **Implementar OAuth2 client credentials**: fuera de scope. Solo se documentan las env vars
  operativas (`PRECALI_EQUIFAX_*`); el flujo OAuth2 (`POST /v2/oauth/token`, bearer token,
  refresh) vive en el futuro `src/lib/buro/equifax-client.ts`.
- **Patrón async retrieval por UUID** (seguir `links[].href`): fuera de scope. El tipo
  `BuroReportLink` se introduce para fijar el contrato, pero el mock siempre devuelve `links: []`.
- **Integración real con Equifax**: fuera de scope total. Sigue sin acceso sandbox.
- **Modelar casos de error** (`status: "error"`, `hitCode: { code: "0" }` no-hit): el type lo
  permite para forward-compat, pero el mock no los genera. Se modelarán cuando llegue el cliente
  real y tengamos casos de error reales que reproducir.
- **Adaptar `EngineResult`**: no cambia. El motor consume `BuroMockResponse` y los nuevos campos
  no afectan la decisión (no son inputs del scoring).

## Open questions

- **Q1 [no bloqueante]** — ¿`hitCode` debe incluir también un campo `description`/`message`
  además de `code`? Equifax US expone `{ code: "1" }` (object con code). La research no muestra
  un campo de descripción pública. **Default propuesto:** solo `code` por ahora, `description`
  se agrega si el sandbox real lo devuelve. Queda documentado en `## Notes`.

- **Q2 [no bloqueante]** — ¿Los campos operativos opcionales del request deben pasar a ser
  **requeridos** cuando el cliente Equifax real esté disponible? Sí, pero el mecanismo es por
  env var: si `PRECALI_EQUIFAX_MEMBER_NUMBER` está seteada, el handler real la usa; si no, el
  modo mock los ignora. **Default propuesto:** opcionales en el schema zod, el handler decide
  modo mock vs real según env var (cuando exista el cliente real).

## Notes

### Mapping table: nuestro schema ↔ envelope Equifax probable

Esta tabla vive como comentario en `src/types/buro.ts` (S1) y como referencia para el futuro
`src/lib/buro/equifax-client.ts`. **No es un contrato confirmado** — es la hipótesis de mapping
que se validará contra el sandbox real.

| Campo nuestro (plano) | Campo Equifax probable (envelope) | Confianza |
|---|---|---|
| `idNumber` | `consumers.document[0].number` | alta (shape) |
| `score` | `consumers.creditReport[0].models[0].score` | media (puede haber múltiples models) |
| `sugefCategory` | `consumers.creditReport[0].hitCode` o equivalente local CR | baja (CR-específico) |
| `historicalPaymentBehavior` | (parte de `models[]` o custom CR field) | baja |
| `operations[]` | `consumers.creditReport[0].trades[]` | alta (semántica) |
| `operations[].amountOwed` | `trades[].currentBalance` o similar | media |
| `operations[].daysPastDue` | `trades[].daysPastDue` o `delinquency` | alta (jargon estándar) |
| `totalAmountOwed` | suma calculada de `trades[]` | — (derivado) |
| `inquiriesLast30Days` (count) | `consumers.creditReport[0].inquiries[]` filtrado por fecha | alta (semántica) |
| `commercialProtests` | `consumers.creditReport[0].publicRecords[]` o diverse alerts | media |
| `historyMonths: 48` | (metadata del reporte, no campo directo) | baja |
| `inquiryDate` | top-level `reportDate` o similar | media |
| `status: "completed"` | top-level `status` | alta (confirmado) |
| `hitCode: { code: "1" }` | `consumers.creditReport[0].hitCode` | alta (shape US) |
| `links[]` | top-level `links[]` | alta (confirmado) |

### Endpoints LATAM confirmados (referencia)

- Auth: `POST /v2/oauth/token` (sandbox/uat/live) — `Authorization: Basic base64(client_id:client_secret)`, `grant_type=client_credentials`, `scope=<url-del-producto>`.
- Bases: `api.sandbox.latam.equifax.com`, `api.uat.latam.equifax.com`, `api.latam.equifax.com`.
- Recurso US (no copiar literal a CR): `POST /business/consumer-credit/v1/reports/credit-report`.
- Recurso CR: namespace desconocido públicamente — requiere acceso Partner Product.

### Decisiones implícitas (defaults)

- `status` siempre `"completed"` en mock — el type admite `"pending"` / `"error"` para
  forward-compat pero el mock no los genera. Se modelarán con datos reales cuando existan.
- `hitCode.code` siempre `"1"` (hit) en mock. `"0"` (no-hit) requeriría modelar consumers no
  encontrados, que no tiene sentido con cédula CR válida en modo determinístico.
- `links` siempre `[]` en mock. Cuando el cliente real devuelva links, se validan contra
  allowlist antes de cualquier fetch (CWE-918).
- Los campos operativos del request se ignoran en mock **para no romper el determinismo por
  cédula**. Si se usarán como inputs del mock, dos calls idénticas con distinto `memberNumber`
  tendrían que devolver respuestas distintas, lo cual rompe la propiedad fundamental del mock.

## Amend log

<!-- append-only; post-approval changes: YYYY-MM-DD - qué cambió - por qué -->
