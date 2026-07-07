# Baseline — 2026-07-02, antes de construir el motor calificador

- **Tests**: 6 test files, 36 tests, 36 passed, 0 failed (`npm test`, vitest 2.1.9, 353ms).
- **Typecheck**: `tsc --noEmit` limpio, sin errores.
- **Lint**: `next lint` limpio, sin warnings ni errores.
- **Coverage**: n/a — no hay config de coverage en `vitest.config.ts`.
- **Perf**: n/a — el cambio no toca un hot path (motor de reglas puro sobre datos mock, sin I/O).
- **Golden tasks / eval_runner**: n/a — no aplica a este proyecto (no es el harness de mind-forge).

Archivos que se van a tocar: `src/types/buro.ts` (nuevo), `src/lib/buro/mock-equifax.ts` (nuevo),
`src/lib/buro/engine.ts` (nuevo), `src/lib/buro/__tests__/*` (nuevo), `src/lib/whatsapp/types.ts`,
`src/lib/whatsapp/memory.ts`, `src/lib/whatsapp/flow.ts`, `src/lib/whatsapp/ai.ts`,
`src/lib/whatsapp/__tests__/*`.
