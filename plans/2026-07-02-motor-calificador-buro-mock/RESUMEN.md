# Resumen — Motor calificador con mock de buró (PreCali)

Repo: `/Users/brolag/Sites/ai-ventures/PreCali` · rama: `develop` · nada commiteado todavía.

## 1. Objetivo

PreCali quiere clasificar cada lead del bot de WhatsApp en un nivel de riesgo crediticio (1/2/3, "Fase 3" del roadmap de negocio) para que el bot:
- Ajuste su tono (educativo vs. comercial).
- Decida si le ofrece un banco tradicional, una alternativa con más apetito de riesgo, o directamente lo redirige a un plan de saneamiento.

No hay acceso real a Equifax todavía, así que este trabajo cubre **el mock del buró + el motor de clasificación**, no la integración real.

## 2. De dónde salió esto

El usuario compartió dos PDFs:
- `Hoja de Ruta PreCali Zero-Friction` — visión de negocio, 3 niveles.
- `integracion_buro` (Equifax Costa Rica / ICIC) — reglas técnicas propuestas, campos del buró, legal (Ley 8968/9859).

Antes de planear, se investigó si existía documentación pública real para no inventar el mock desde cero:
- El portal `developer.latam.equifax.com` confirma OAuth2 + sandbox, pero el JSON schema exacto está detrás de login.
- El **CIC de SUGEF** (regulador costarricense, fuente pública y verificable) sí tiene documentación oficial: 8 categorías reales de riesgo (`A1, A2, B1, B2, C1, C2, D, E`), Comportamiento de Pago Histórico en 3 niveles, historial de 48 meses. Esto se usó como base del mock en vez de inventar categorías.

## 3. El plan (`/spec`)

Documento completo en [`plan.md`](./plan.md) (+ vista visual en [`plan.html`](./plan.html)). Quedó `status: done`.

**Decisiones tomadas con el usuario** (dos preguntas por `AskUserQuestion` no tuvieron respuesta a tiempo, se avanzó con defaults y se corrigieron después en conversación):
1. La categoría **B2 mapea a Nivel 1** (alto riesgo), no a Nivel 2 — corregido explícitamente por el usuario sobre el default inicial.
2. El mock se dispara **justo después de capturar la cédula**, sin tocar el paso de OCR de documentos que ya existía.
3. El mock es **determinístico por cédula** (mismo número → mismo resultado siempre), para que sea reproducible en pruebas y demos.
4. **Alcance mínimo confirmado**: se descubrió que la primera tabla de bancos se muestra *antes* de pedir la cédula, así que el nivel de riesgo no puede gatear esa primera oferta sin un rediseño mayor (fuera de este trabajo). El nivel aplica desde la captura de cédula en adelante.

## 4. Qué se construyó (`/craft`)

9 subtareas, ejecutadas por una mezcla de trabajo directo y subagentes en paralelo (Sonnet para las normales, Opus para el motor de reglas):

**Piezas nuevas:**
- `src/types/buro.ts` — tipos: categorías SUGEF, `BuroMockResponse`, `EngineConfig`, `EngineResult`.
- `src/lib/buro/mock-equifax.ts` — genera una respuesta de buró simulada y realista a partir de la cédula (hash + PRNG determinístico, distribución ponderada de las 8 categorías, sin `Math.random`/`Date.now`).
- `src/lib/buro/engine.ts` — `calificarLead()`: toma el mock + el perfil (ingreso/deudas) y decide el Nivel 1/2/3 con una precedencia de reglas fija (mora activa > umbral, categoría SUGEF, score, ratio deuda/ingreso, shopping de crédito).
- Tests para ambas piezas.

**Conectado al bot existente:**
- `src/lib/whatsapp/types.ts` / `memory.ts` — la sesión ahora guarda `buroResult`.
- `src/lib/whatsapp/flow.ts` — al capturar la cédula (`stepLeadDatos`) se calcula el nivel; en el paso de autorizar al banco (`goToHardPull`), Nivel 1 redirige a un mensaje de "flujo de rescate" (sin ofrecer el botón de autorizar), Nivel 2 agrega una nota de que va a hacer falta más prima.
- `src/lib/whatsapp/agent.ts` — el asesor de IA que responde dudas del usuario ahora ajusta su tono según el nivel (solo le llega el número de nivel, nunca el detalle del buró).

## 5. Dos correcciones descubiertas durante la implementación

- **Dónde vive realmente la IA conversacional**: el plan original apuntaba a `ai.ts` (`buildGroqAdvisorPrompt`), pero se descubrió que ese código no lo llama nadie en el bot real. El camino real es `agent.ts::resolverDuda`. Se corrigió ahí y se revirtió el cambio en `ai.ts` (quedó sin diff).
- **No hay una segunda lista de bancos para reordenar**: el plan quería priorizar cooperativas para Nivel 2, pero el banco ya se elige *antes* de pedir la cédula (mismo hallazgo del punto 4 arriba). Se implementó una nota informativa en su lugar en vez de forzar un reordenamiento que no tiene dónde mostrarse.

## 6. Revisión y pruebas

- **`/vet` (revisor independiente, Codex, sin contexto previo)**: primera ronda dio **HOLD** — faltaban tests (sanitización de config, tono de `agent.ts`, rescate/nota en hard pull) y había un bug real (`redisplayStep` perdía la nota de Nivel 2 al re-mostrarse) más código muerto dejado en `ai.ts`. Se corrigieron los tres. Segunda ronda: **SHIP**.
- **`/exercise`**: se simuló la conversación completa de WhatsApp (elegir producto → ingreso → deudas → banco → cédula → documentos → confirmación) para una cédula real de cada nivel, leyendo el texto exacto que vería un usuario. Log completo en [`evidence/exercise-conversation-log.txt`](./evidence/exercise-conversation-log.txt).
- Estado final: **63 tests** pasando (arrancó en 36), typecheck limpio, lint limpio.

## 7. Cómo probarlo a mano

```
npm run probar-bot
```

Abre un chat de prueba en la terminal (usa el mismo motor que el webhook real, sin necesitar Twilio/WhatsApp). Al final de cada respuesta muestra el nivel de riesgo asignado a la cédula que escribiste. Detalle completo en `scripts/probar-bot.ts`.

## 8. Resultado visual

`artifacts/2026-07-04-result-motor-calificador-buro.html` — reporte del resultado en lenguaje simple (abrir en el navegador).

## 9. Estado actual y qué falta

- **Nada está commiteado.** `git status` muestra 11 archivos de código nuevos/modificados + el plan + el script de prueba + `package.json`/`package-lock.json` (se agregó `tsx` como devDependency).
- **Preguntas abiertas, no bloqueantes** (ver `plan.md` → Open questions):
  1. ¿El texto de autorización de cédula alcanza con una línea, o hace falta un paso de confirmación aparte (más fiel a Ley 9859)?
  2. ¿La escala de score 300-850 (con umbral prime en 700) sirve como referencia hasta tener acceso real a Equifax?
- **Fuera de alcance, para más adelante:** integración real con Equifax LATAM (OAuth2, sandbox), purga de datos a los 90 días (Ley 8968, requiere una capa de persistencia que no existe aún), y rediseñar el flujo para que la cédula se capture al principio (si se quiere que el nivel gatee también la primera oferta de bancos).
