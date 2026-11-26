---
name: e2e
description: Tests end-to-end y QA en navegador con Playwright (playwright-cli y Test Agents planner/generator/healer). Usar cuando pidan "test e2e", "probá el flujo", "QA", "verificá en el navegador", "cubrí el journey de X", o al cerrar una feature con pantallas.
argument-hint: "[journey o pantalla] [URL]"
---

# E2E y QA con Playwright

El agente escribe y mantiene los tests; los tests son deterministas y corren en CI. El agente nunca reemplaza al test.

## Elegir la herramienta

| Necesidad | Herramienta | Por qué |
| --- | --- | --- |
| Mirar una pantalla, reproducir un bug, sacar capturas | `playwright-cli` | Guarda snapshots y capturas en disco; vos decidís qué leer. Gasta mucho menos contexto que el MCP |
| Cubrir un journey crítico con un test nuevo | Playwright Test Agents (planner → generator → healer) | Exploran la app real y escriben el test verificando selectores en vivo |
| Arreglar un test que se rompió por un cambio de UI | healer | Repara locators y esperas; **revisá su diff** |

Los Test Agents son caros (el planner solo puede consumir más de 100k tokens): usalos para journeys críticos (login, alta y edición de la entidad central, pagos, permisos), no para cada pantalla.

## Preparar el repo (una vez)

1. Playwright 1.56 o superior instalado como dependencia de desarrollo.
2. `npx playwright init-agents --loop=claude`: crea los tres agentes en `.claude/agents/`, el `.mcp.json` y `specs/`. Volvé a correrlo cada vez que actualices Playwright.
3. Un seed test (`tests/seed.spec.ts` o el que indique la config) que deje la app logueada y con datos sintéticos.
4. `playwright-cli` para el día a día: `npm install -g @playwright/cli@latest` y `playwright-cli install --skills`.
5. En `playwright.config`: `trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'` y reintentos solo en CI.

## Flujo para un journey

1. **Plan**: el planner explora y escribe `specs/<journey>.md`. Una persona lo aprueba antes de seguir: el plan define qué se considera correcto.
2. **Generación**: el generator escribe `tests/<journey>.spec.ts`. Correlo; es normal que falle algo la primera vez.
3. **Reparación**: el healer solo para fallos de locator o de tiempos. Si el fallo es de comportamiento, es un bug: se arregla el código, no el test.
4. **Revisión del diff del healer**: rechazá todo cambio que afloje un assert (`toHaveText` → `toBeVisible`, valores → presencia), agregue `skip`/`fixme`/`fail`, o borre pasos. Si el repo tiene `scripts/assert-skip-check.sh`, corrélo.

## Reglas para los tests

- Selectores por rol, label o `data-testid` (`getByRole`, `getByLabel`, `getByTestId`). Nunca por clases CSS ni por posición.
- Sin `waitForTimeout`: esperas por estado (`expect(...).toBeVisible()`, `toHaveURL`).
- Datos sintéticos creados por el test o el seed; nunca datos reales de clientes.
- Un test por comportamiento observable; cada test independiente del orden.
- Accesibilidad: en las pantallas principales, un chequeo con `@axe-core/playwright` sin violaciones serias.

## Conectarlo a la compuerta

Para que Claude no pueda cerrar un turno que toca pantallas sin pasar los e2e, en `.claude/delta4c.json`:

```json
"verificarE2E": ["pnpm exec playwright test --reporter=line"],
"disparadoresE2E": ["src/app/**", "src/components/**", "**/*.tsx", "resources/views/**"]
```

La compuerta corre `verificarE2E` solo si los cambios de la sesión tocan algún disparador. Mantené esa suite en los journeys críticos para que tarde pocos minutos; la suite completa corre en CI.

## Cierre

Reportá con evidencia: el comando que corriste, cuántos tests pasaron y, si hubo cambios visuales, las capturas a 375 y 1280 px.
