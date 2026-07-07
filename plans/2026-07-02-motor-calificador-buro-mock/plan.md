---
project: PreCali
created: 2026-07-02
status: done
modified: [2026-07-02]
commits: [pending commit]
agents: [claude-sonnet-5, claude-sonnet-5-subagent(s2-mock-equifax), claude-opus-subagent(s3-engine), claude-sonnet-5-subagent(s6-ai-tone), claude-sonnet-5-subagent(s8-tests-buro)]
related:
  back:
    - "/Users/brolag/Downloads/Hoja_de_Ruta_PreCali_Zero_Friction (1).pdf"
    - "/Users/brolag/Downloads/integracion_buro (1).pdf"
  forward: []
---

# Plan: PreCali / Motor calificador con mock de buró (Equifax/SUGEF ICIC)

## Context

PreCali quiere clasificar cada lead del bot de WhatsApp en un nivel de riesgo crediticio (Fase 3 del
roadmap "Zero-Friction") para (a) decidir qué bancos mostrar y (b) ajustar el tono de la IA. Hoy **no
hay acceso real a Equifax**, así que este plan cubre solo el **mock** del buró + el motor de
clasificación puro, dejando la integración real como trabajo futuro explícitamente fuera de alcance.

**Fuentes de research (ya hechas, ver `## Notes` para detalle y caveats):**
- SUGEF CIC (regulador, fuente pública verificada): 8 categorías reales `A1,A2,B1,B2,C1,C2,D,E`,
  Comportamiento de Pago Histórico (CPH) en 3 niveles, historial de 48 meses, actualización mensual.
- Equifax LATAM ICIC (portal `developer.latam.equifax.com`): confirma OAuth2 client_credentials +
  sandbox, pero el JSON schema exacto de respuesta está detrás de login — no es públicamente
  accesible. Se usa como referencia de forma/convención (camelCase, arrays de operaciones/consultas),
  no como schema exacto.
- Dos PDFs del cliente: reglas de negocio (3 niveles) y reglas técnicas de precalificación (umbrales,
  campos ICIC, legal Ley 8968/9859).

**Arquitectura actual relevante (ya migrada a Next.js/TS, revisada antes de proponer archivos):**
- `src/lib/whatsapp/flow.ts`: máquina de estados. `stepLeadDatos` (línea ~724) parsea
  `fullName/idNumber/email` y transiciona a `lead_fuente_ingresos` → `esperar_documentos` →
  `stepAutorizarSoftPreCali` (línea ~818, hoy solo hace **extracción OCR** de documentos subidos vía
  `extractDocumentSummary`, no consulta ningún buró).
- El cálculo/tabla de opciones bancarias (`lastResults`) se genera **antes** de que el usuario elija un
  banco y muy antes de `stepLeadDatos` — es decir, **la cédula no existe todavía cuando se muestra la
  primera simulación de bancos**. Esto contradice la visión literal del roadmap ("score gatea la
  primera oferta"). El usuario confirmó alcance mínimo: esa primera simulación queda como está, el
  nivel aplica desde la captura de cédula en adelante (ver decisión 4 abajo).
- `src/lib/whatsapp/types.ts`: `Session`/`Lead`/`Profile` no tienen ningún campo de score/buró hoy.
- `src/data/bancos.ts` (1152 líneas): catálogo de bancos con `tipo: 'Público' | 'Privado'` únicamente.
  **No existe concepto de "cooperativa"** en el modelo de datos — el roadmap pide priorizar
  cooperativas para Nivel 2, pero no hay dato de esa naturaleza; se usa un proxy (ver S7).
- `src/lib/whatsapp/ai.ts`: `buildGroqAdvisorPrompt` arma el system prompt del asesor conversacional a
  partir de `profile`/`results` — es el punto de enganche para inyectar reglas de tono por nivel.
- Convenciones: TypeScript estricto, tests con Vitest en `__tests__/` junto al código, alias `@/` →
  `src/`.

**Decisiones confirmadas por el usuario (2026-07-02):**
1. `B2` mapea a **Nivel 1** (Alto Riesgo). Se corrige del default inicial (Nivel 2) — el usuario
   confirmó que una categoría B2 debe tratarse como riesgo alto, no medio.
2. El soft-pull mock se dispara **justo después de capturar la cédula** en `stepLeadDatos`, sin tocar
   el paso OCR existente (`stepAutorizarSoftPreCali` sigue igual, es un paso distinto y posterior).
3. El mock es **determinístico por cédula** (mismo idNumber → mismo resultado siempre), vía hash seed.
4. Alcance **mínimo-disruptivo** confirmado: el nivel de riesgo aplica desde la captura de cédula en
   adelante (tono de IA, hard pull, reordenamiento de bancos), pero **no** gatea la primera tabla de
   simulación de bancos que se muestra antes de conocer la cédula (eso queda fuera de este plan).

## Signatures

```ts
// src/types/buro.ts  [new]
export type SugefCategoria = "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "D" | "E";
export type ComportamientoPagoHistorico = 1 | 2 | 3; // 1=bueno 2=aceptable 3=deficiente
export interface OperacionCredito {
  tipo: "hipotecario" | "prendario" | "personal" | "tarjeta";
  entidad: string;
  montoAdeudado: number;
  diasAtraso: number;
  cancelada: boolean;
}
export interface BuroMockResponse {
  idNumber: string;
  score: number; // 300-850, ver Notes sobre la escala asumida
  categoriaSugef: SugefCategoria;
  comportamientoPagoHistorico: ComportamientoPagoHistorico;
  operaciones: OperacionCredito[];
  montoTotalAdeudado: number;
  entidadesConsultantesUltimos30Dias: number;
  protestosComerciales: number; // capa propia de Equifax, no viene de SUGEF
  historialMeses: 48;
  fechaConsulta: string; // ISO, generada por el caller (ver @invariant Date.now())
}
export type NivelCalificacion = 1 | 2 | 3;
export interface EngineConfig {
  scorePrimeThreshold: number; // default 700
  ratioDeudaIngresoAlerta: number; // default 0.50
  ratioDeudaIngresoPrecalificado: number; // default 0.45
  moraActivaDiasLimite: number; // default 90
  shoppingCreditoConsultas30d: number; // default 5
}
export interface EngineResult {
  nivel: NivelCalificacion;
  categoriaSugef: SugefCategoria;
  score: number;
  ratioDeudaIngreso: number;
  moraActivaSevera: boolean;
  shoppingCredito: boolean;
  ratioAlto: boolean;
  motivo: string; // regla que determinó el nivel, para logging/debug
}

// src/lib/buro/mock-equifax.ts  [new]
export function generateMockBuroResponse(idNumber: string, fechaConsulta: string): BuroMockResponse

// src/lib/buro/engine.ts  [new]
export const DEFAULT_ENGINE_CONFIG: EngineConfig
export function calificarLead(
  buro: BuroMockResponse,
  profile: Pick<import("@/lib/whatsapp/types").Profile, "income" | "debt">,
  config?: Partial<EngineConfig>,
): EngineResult

// src/lib/whatsapp/types.ts  [adapt]
export interface Session {
  // ...existentes
  buroResult: EngineResult | null; // [new field]
}

// src/lib/whatsapp/ai.ts  [adapt]
// AdvisorInput gana buroResult?: EngineResult | null; buildGroqAdvisorPrompt lo usa para
// inyectar instrucciones de tono por nivel (no reemplaza reglas existentes, las extiende).
```

## Security invariants

- `@invariant`: la cédula (`idNumber`) y el payload mock del buró (score, operaciones, protestos) son
  PII/datos financieros sensibles — nunca se reenvían completos al proveedor de IA externo (Groq). El
  prompt en `ai.ts` solo recibe el `nivel` derivado y flags booleanos (`ratioAlto`, `moraActivaSevera`,
  `shoppingCredito`), nunca `BuroMockResponse` crudo. (CWE-200: exposición de información sensible)
- `@invariant`: `EngineConfig` valida sus umbrales al construirse (rechaza `NaN`/`undefined`/negativos y
  cae a `DEFAULT_ENGINE_CONFIG`) — un umbral corrupto no debe aprobar o rechazar leads silenciosamente.
  (CWE-20: validación de entrada incorrecta)
- `@invariant`: el hash usado para sembrar el PRNG determinístico es puramente aritmético sobre el
  string de `idNumber` (sin `eval`, sin interpolación en plantillas/comandos). (CWE-77/78: inyección)
- `@invariant`: no se persiste `BuroMockResponse` ni `EngineResult` fuera de la sesión en memoria de
  `memory.ts` en esta fase — el TTL/purga de 90 días (Ley 8968) queda documentado como gap pendiente
  para cuando exista una capa de persistencia real, no se implementa aquí. (CWE-359: exposición de
  información privada por retención)

## Subtasks

<!-- state legend: [ ] todo | [~] in-progress | [x] done | [!] blocked/failed (reason inline) -->
<!-- deps: [needs: S1, S2] gatea el subtask; sin needs = corre en paralelo -->

- [x] S1: Tipos de dominio del buró en `src/types/buro.ts` (`SugefCategoria`, `ComportamientoPagoHistorico`,
  `OperacionCredito`, `BuroMockResponse`, `NivelCalificacion`, `EngineConfig`, `EngineResult`). [tier: cheap]
  -- verify: `npm run typecheck`

- [x] S2: Mock generator `generateMockBuroResponse` en `src/lib/buro/mock-equifax.ts`: PRNG determinístico
  (hash del `idNumber` como seed) con distribución realista de categorías (mayoría en A2/B1/B2, colas
  pequeñas en A1 y en C2/D/E) y operaciones/consultas coherentes con la categoría generada. [needs: S1] [tier: mid]
  -- when: `generateMockBuroResponse("1-2345-6789", iso)` / requires: mismo idNumber invocado 2 veces /
     ensures: resultado byte-a-byte idéntico -- verify: `npm test -- mock-equifax`

- [x] S3: Motor `calificarLead` en `src/lib/buro/engine.ts` con la precedencia exacta:
  (1) mora activa > `moraActivaDiasLimite` en cualquier operación → Nivel 1;
  (2) categoría `B2/C1/C2/D/E` → Nivel 1 (confirmado: B2 cuenta como riesgo alto, igual que C1-E);
  (3) categoría `A1/A2/B1` con `score >= scorePrimeThreshold` y `ratioDeudaIngreso <= ratioDeudaIngresoPrecalificado` → Nivel 3;
  (4) categoría `A1/A2/B1` que no cumple (3) → Nivel 2;
  (5) `ratioDeudaIngreso > ratioDeudaIngresoAlerta` → cap a Nivel 2 como máximo (nunca Nivel 3), marca `ratioAlto=true`;
  (6) `entidadesConsultantesUltimos30Dias > shoppingCreditoConsultas30d` → `shoppingCredito=true`, no cambia nivel.
  [needs: S1] [tier: hard]
  -- when: `calificarLead(buro, profile)` / requires: `buro.categoriaSugef in ["B2","C1","C2","D","E"]` /
     ensures: `resultado.nivel === 1` -- verify: `npm test -- engine`
  -- when: mismo caso con `diasAtraso > 90` en cualquier operación aunque la categoría sea `A1` /
     ensures: `resultado.nivel === 1` (override duro) -- verify: `npm test -- engine`
  -- when: categoría `B2` específicamente, sin mora activa / ensures: `resultado.nivel === 1`
     -- verify: `npm test -- engine` (test explícito para esta categoría por ser la ambigüedad que el
     usuario resolvió en vivo)

- [x] S4: Extender `Session` en `src/lib/whatsapp/types.ts` con `buroResult: EngineResult | null` y
  actualizar el factory de sesión vacía en `src/lib/whatsapp/memory.ts` (default `null`). [needs: S1] [tier: cheap]
  -- verify: `npm run typecheck` -- must_include: `buroResult: null` en `memory.ts`

- [x] S5: Enganchar el mock+motor en `flow.ts::stepLeadDatos` — al validar `parsed.idNumber` (antes de
  transicionar a `lead_fuente_ingresos`), llamar `generateMockBuroResponse` + `calificarLead` y guardar
  en `session.buroResult`. Agregar una línea de consentimiento breve en el mismo mensaje donde se pide
  la cédula (ver Open Question Q1, no bloqueante) — sin agregar un paso/botón nuevo, para no romper la
  fricción cero.
  [needs: S2, S3, S4] [tier: mid]
  -- when: `stepLeadDatos` recibe un `bodyText` con nombre+cédula+email válidos /
     ensures: `session.buroResult !== null` y `session.buroResult.nivel` es 1, 2 o 3
     -- verify: `npm test -- flow` (o el archivo de test nuevo de S9)

- [x] S6: Consumir el nivel de riesgo en el asesor conversacional para ajustar el tono por Nivel 1/2/3
  (no vender banco + plan de saneamiento / prima-monto ajustado + cooperativas / conversión rápida).
  **Corrección de alcance descubierta en la implementación** (ver `## Notes`): la firma original del
  plan apuntaba a `src/lib/whatsapp/ai.ts` (`AdvisorInput`/`buildGroqAdvisorPrompt`), pero ese camino
  resultó ser código sin ningún caller en el repo (`writeAdvisorReplyWithPreCaliAi` no se invoca desde
  ningún lado) — no tiene efecto real en el bot. El camino que sí está vivo es
  `src/lib/whatsapp/agent.ts::resolverDuda` (invocado desde `flow.ts::manejarDuda`, que maneja toda
  pregunta/duda fuera de guion). Se implementó ahí: `ResolverDudaContext.nivelRiesgo` +
  `nivelRiesgoInstruccion()` inyectada en `buildSystemPrompt`, y `flow.ts::manejarDuda` ahora pasa
  `session.buroResult?.nivel ?? null`. El cambio en `ai.ts` (hecho por el subagente antes de este
  hallazgo) se dejó tal cual — es código correcto y con el mismo invariante de seguridad, listo por si
  ese camino se activa a futuro, pero hoy no es el que ejecuta el bot. [needs: S5] [tier: mid]
  -- must_include: en `agent.ts`, `ResolverDudaContext.nivelRiesgo` consumido dentro de
     `buildSystemPrompt`/`nivelRiesgoInstruccion`; en `flow.ts::manejarDuda`, `nivelRiesgo: session.buroResult?.nivel ?? null`
  -- must_not_include: `score`, `categoriaSugef`, `operaciones` ni ningún otro campo crudo del buro
     interpolado en `SYSTEM_PROMPT_TEMPLATE` o en `nivelRiesgoInstruccion` -- verify: `npx tsc --noEmit`
     y revisión manual del diff (confirmado)

- [x] S7: Consumir `session.buroResult` en el flujo de bancos (`flow.ts`): en `goToHardPull`, si
  `nivel === 1` redirigir a un mensaje de "flujo de rescate" (guía de saneamiento a 6 meses) en vez de
  proceder al hard pull (`session.step` pasa a `pausado`); si `nivel === 2`, agregar una nota informativa
  de que hará falta mayor prima o ajuste de monto antes del botón "Autorizo banco".
  **Ajuste de alcance descubierto en la implementación** (ver `## Notes`): el "reordenar/priorizar
  cooperativas" de la redacción original del plan no tiene dónde engancharse — el banco a aplicar ya
  se elige en `stepElegirBancoAplicar`, **antes** de capturar la cédula (mismo hallazgo de la Q4 de
  arquitectura), así que no existe una segunda lista de bancos post-cédula para reordenar. Se
  implementó la nota informativa en su lugar; reordenar la selección real de banco requeriría mover la
  captura de cédula antes de elegir banco, que es exactamente el rediseño mayor descartado en Q4.
  [needs: S5] [tier: mid]
  -- when: `session.buroResult.nivel === 1` y el usuario confirma los datos extraídos /
     ensures: la acción devuelta es el mensaje de flujo de rescate y `session.step === "pausado"`,
     nunca se ofrece el botón "Autorizo banco" -- verificado con script ad-hoc (ver Notes)

- [x] S8: Tests unitarios para `mock-equifax.ts` y `engine.ts` en `src/lib/buro/__tests__/`: determinismo
  por cédula, cobertura de cada rama de precedencia (S3), y sanity check de que la distribución de
  categorías generadas por S2 no colapsa siempre en el mismo valor (ej. 200 cédulas de prueba producen
  al menos 3 categorías distintas). [needs: S2, S3] [tier: cheap]
  -- verify: `npm test -- src/lib/buro`

- [x] S9: Test de integración para `stepLeadDatos` en `src/lib/whatsapp/__tests__/flow.test.ts` (nuevo o
  extendido si ya existe): dado un `bodyText` con cédula fija, `session.buroResult` queda poblado y es
  reproducible entre corridas. [needs: S5] [tier: cheap]
  -- verify: `npm test -- flow`

## Out of scope

- Integración real con Equifax LATAM ICIC (credenciales sandbox, OAuth 2.0, whitelisting de IPs) —
  este plan es puramente el mock + motor, sin ningún llamado de red externo.
- Persistencia del resultado de buró más allá de la sesión en memoria, y el mecanismo de TTL/purga de
  90 días exigido por Ley 8968 (no hay capa de base de datos para esto todavía).
- Rediseñar el flujo para que la **primera** tabla de simulación de bancos (antes de `lead_datos`)
  quede gateada por el score — el usuario confirmó el alcance mínimo-disruptivo (decisión 4).
- Agregar bancos/cooperativas reales nuevas a `src/data/bancos.ts` — S7 usa campos existentes como
  proxy, no incorpora datos nuevos de instituciones.
- Validación legal formal de que el texto de consentimiento agregado en S5 cumple Ley 8968/9859 —
  se deja como nota para revisión de abogado, no se resuelve en este plan.
- Calibración numérica fina de `scorePrimeThreshold` y los ratios contra datos reales de producción —
  los defaults en `DEFAULT_ENGINE_CONFIG` son un punto de partida razonable, no un valor validado por
  el negocio.

## Open questions

Las 4 preguntas bloqueantes originales quedaron resueltas por el usuario el 2026-07-02 (ver
`## Notes` y las decisiones confirmadas en `## Context`): mapeo de B2 → Nivel 1, punto de enganche
justo tras la cédula, mock determinístico por cédula, y alcance mínimo (sin gatear la primera
simulación de bancos). Quedan dos preguntas abiertas, ninguna bloqueante:

- **Q1 [no bloqueante]** — Consentimiento legal del soft-pull mock: el PDF técnico exige un
  consentimiento explícito (checkbox "Pantalla 2") antes de consultar el buró (Ley 9859 art. 44 bis).
  Este plan (S5) modela esto como una línea de texto en el mismo mensaje donde se pide la cédula, sin
  agregar un paso de botones nuevo, para preservar la fricción cero. ¿Es aceptable para esta fase mock,
  o se requiere un gate de consentimiento explícito con botones (más fiel al PDF, más fricción)?
- **Q2 [no bloqueante]** — Escala numérica del score: ningún documento público confirma el rango
  exacto de score que usa Equifax LATAM/CR (el portal con el schema está detrás de login). Este plan
  asume una escala 300-850 (convención común tipo FICO/VantageScore) con `scorePrimeThreshold = 700`
  como placeholder razonable pero no verificado. Se recalibra cuando exista acceso real al sandbox.

## Notes

- Research verificado con fuentes públicas: SUGEF (`sugef.fi.cr`, FAQ oficial del CIC y normativa
  1-05/7-06) para las 8 categorías reales y sus reglas; `developer.latam.equifax.com` y
  `developer.equifax.com` para confirmar el mecanismo OAuth2 y como plantilla de convenciones de
  payload (camelCase, arrays de tradelines/inquiries) — el JSON schema exacto de ICIC no está
  públicamente disponible sin cuenta, así que el shape de `BuroMockResponse` es una síntesis razonada,
  no una copia de un schema real.
- Se intentó `AskUserQuestion` antes de escribir el plan (timeout de 60s, sin respuesta), así que se
  avanzó con defaults recomendados. El usuario los revisó luego en una explicación en lenguaje simple
  y confirmó 2026-07-02: corrigió el mapeo de B2 (de Nivel 2 a Nivel 1) y confirmó el alcance mínimo
  para la primera simulación de bancos. Los otros dos defaults (punto de enganche y determinismo del
  mock) quedaron confirmados implícitamente al aprobar la explicación general, que los describía como
  parte del diseño.
- Gap de datos descubierto: `src/data/bancos.ts` no modela "cooperativas" ni un campo de apetito de
  riesgo. En la implementación esto resultó irrelevante para S7 (ver más abajo): no hay una segunda
  lista de bancos post-cédula para reordenar, así que el proxy `ratioMax`/`primaMin` nunca llegó a
  necesitarse.
- **Dos correcciones de alcance descubiertas durante `/craft` (2026-07-02), documentadas en sus
  subtareas y aplicadas sin volver a `/spec` por ser refinamientos del mismo objetivo, no cambios de
  objetivo:**
  1. **S6**: la firma original apuntaba a `src/lib/whatsapp/ai.ts` (`AdvisorInput`/`buildGroqAdvisorPrompt`),
     pero ese código no tiene ningún caller real en el repo. Se corrigió hacia `agent.ts::resolverDuda`,
     que es el camino de IA realmente invocado por `flow.ts::manejarDuda` en cada duda del usuario.
  2. **S7**: "reordenar la lista de bancos por apetito de riesgo" no tiene dónde engancharse — el banco
     ya se elige en `stepElegirBancoAplicar`, antes de la captura de cédula (mismo hallazgo de la Q4
     de arquitectura del plan original). Se implementó una nota informativa en el paso de hard pull en
     su lugar; el reordenamiento real requeriría el rediseño mayor que Q4 ya había descartado.
- Ejecución: S1 y S4 se hicieron directo (mecánicos, un solo archivo). S2 (mock, Sonnet) y S3 (motor,
  Opus) corrieron en paralelo como subagentes en background apenas S1 estuvo listo, mientras se hacía
  S4 en el hilo principal. S5 y S7 se hicieron directo por tocar el mismo `flow.ts` con contexto exacto
  de línea. S6 y S8 corrieron en paralelo como subagentes tras S5; S9 se hizo directo. Cada subtask se
  verificó de forma independiente (typecheck + script ad-hoc o test real) antes de marcarse `[x]`, no
  se confió en el resumen de texto del subagente sin inspeccionar el archivo real.

## Amend log
<!-- append-only; post-approval changes: YYYY-MM-DD - qué cambió - por qué -->
- 2026-07-02 - Ronda 1 de `/vet` (Codex gpt-5.5, contexto limpio) dio HOLD con 1 MEDIUM (huecos de test:
  sanitización de config, tono de `agent.ts`, rescate/nota de nivel en hard pull) y 1 LOW (bug real:
  `redisplayStep` en `confirmar_hard_pull` no repetía la nota de Nivel 2 al re-renderizar) y 1 SLOP
  (código muerto dejado en `ai.ts` durante la corrección de S6). Se corrigieron los tres: se extrajo
  `hardPullPrompt()` compartido entre `goToHardPull` y `redisplayStep`, se revirtió por completo el
  cambio dormido en `ai.ts` (diff a cero en ese archivo), se agregaron tests de sanitización de config
  (`engine.test.ts`), tono por nivel sin fuga de campos crudos (`agent.test.ts`, nuevo, exporta
  `buildSystemPrompt` para poder testearlo) y rescate/nota/redisplay en hard pull (`flow.test.ts`).
  63 tests en total, todos en verde.
- 2026-07-02 - Ronda 2 de `/vet` (Codex gpt-5.5) → **SHIP**, sin findings nuevos. Confirmó los 9
  criterios de aceptación PASS, `ai.ts` con diff vacío, y `npm test` en 63/63.
- 2026-07-02 - `/exercise`: se corrió la conversación completa (producto → ingreso → deudas → elegir
  banco → datos del lead → fuente de ingresos → documentos → autorización → confirmación) para una
  cédula real de cada nivel (encontradas por búsqueda directa contra el generador+motor reales, no
  construidas a mano), observando el texto exacto que el bot le mostraría a un usuario real. Log
  completo en `evidence/exercise-conversation-log.txt`. Nivel 1 → mensaje de rescate y sesión pausada,
  sin botón "Autorizo banco"; Nivel 2 → hard pull con nota de prima/ajuste; Nivel 3 → hard pull limpio,
  igual que el comportamiento previo al cambio. `npm test` 63/63 verde.
