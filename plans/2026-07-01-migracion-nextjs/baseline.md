# Baseline — PreCali migración a Next.js

**Capturada:** 2026-07-01 (antes de S1)
**Estado git:** limpio salvo `plans/` sin trackear. Commit base `3aa9d47`.

## Métricas "before"

| Métrica | Valor | Nota |
|---|---|---|
| Test runner | **ninguno** | no existe `package.json` ni suite de tests |
| Tests (count pass/fail) | **0 / 0** | n/a — sin runner |
| Cobertura | **n/a** | sin tests |
| Lint | **n/a** | no hay linter configurado |
| Typecheck | **n/a** | no hay TypeScript |
| Build | **n/a** | sitio estático sin build (`node --check` válido) |
| `node --check` JS | **OK** | app.js, data.js, seguros.js, data-aseguradoras.js parsean |
| LOC frontend legacy | ~3275 | index.html 484 + app.js 1166 + seguros.js 585 + data.js 1203 + data-aseguradoras.js 115 + styles.css (no cuenta como JS) — se migran/borraran |
| LOC backend legacy | ~4070 | api/_lib/* (≈3700) + api/whatsapp/precali.js (396) — se portea a TS |
| Archivos raíz a migrar | 8 | index.html, privacidad.html, terminos.html, app.js, seguros.js, data.js, data-aseguradoras.js, styles.css |
| Env vars backend | ~20 | TWILIO_*, GROQ_*, OPENAI_*, UPSTASH/KV_* |
| Países activos | 1 (cr) | regional en backups/ |

## Funcionalidad que debe preservarse (contrato del usuario)

- Calculadora de créditos (personal/vehicular/hipotecario) para Costa Rica con cálculo idéntico de cuota/monto.
- Comparador de seguros (auto/vida/salud).
- Captura de leads (hoy rota → debe quedar funcional vía `/api/lead`).
- Bot WhatsApp con verificación de firma Twilio y flujo guiado IA.
- Estética visual (paleta `#1F4D3F`, 4 fuentes, animaciones) sin cambios.

## Cómo se medirá el delta (after)

- `npm run typecheck && npm run lint && npm run build` verde.
- `npm test` > 0 tests pasando (hooks de cálculo + route handlers).
- Cálculo de créditos: test con input conocido = valor actual de la calculadora (regresión numérica).
- Cero archivos legacy en raíz tras S17.
