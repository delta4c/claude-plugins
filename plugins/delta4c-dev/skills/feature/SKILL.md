---
name: feature
description: Flujo completo para construir una feature con calidad de Delta 4C, de la spec al PR (spec, plan, implementación con TDD, verificación, revisión independiente, e2e y PR con evidencia). Usar cuando pidan implementar, construir o agregar una funcionalidad, pantalla, endpoint o integración que no sea un cambio trivial.
argument-hint: "[qué construir]"
---

# Construir una feature

Un bucle corto y verificable. Ajustá el tamaño del proceso al tamaño del cambio, pero no te saltees la verificación ni la revisión.

## 0. Medir el tamaño

| Tamaño | Ejemplo | Proceso |
| --- | --- | --- |
| Chico | Texto, estilo, bug de una línea con causa clara | Directo: test que reproduce (si es bug) → arreglo → verificación |
| Mediano | Un endpoint, una pantalla, un cambio en 2–5 archivos | Plan mode → aprobación → implementación con TDD → revisión |
| Grande | Una feature de más de un día, varios módulos, datos nuevos | Spec → plan → implementación por tareas → revisión → e2e → PR |

Si la feature cambia la arquitectura (módulo nuevo, tecnología nueva, cambio de escalado), primero `/delta4c-dev:arquitectura`.

## 1. Spec (grande)

- Si Superpowers está instalado, usá su skill `superpowers:brainstorming`: entrevista y spec en `docs/superpowers/specs/`.
- Si no, entrevistá con AskUserQuestion (implementación, UI/UX, casos borde, fuera de alcance) y escribí `docs/superpowers/specs/AAAA-MM-DD-<tema>.md`.
- Una buena spec nombra archivos e interfaces, dice qué queda fuera y termina con **cómo se verifica end-to-end**.
- La persona la aprueba antes de seguir.

## 2. Plan (mediano y grande)

- Grande: `superpowers:writing-plans` si está disponible; si no, un plan numerado de tareas chicas (2–5 minutos cada una) con archivos, test a escribir y comando de verificación.
- Mediano: plan mode alcanza.
- Usá `delta4c-dev:investigador` para explorar sin llenar el contexto.
- Mirá las convenciones: `/delta4c-dev:ui` si hay pantallas, `/delta4c-dev:api` si hay endpoints, datos o integraciones.

## 3. Implementar

- Arrancá en una sesión limpia (`/clear`) o en un worktree (`claude --worktree <tema>`) con la spec y el plan como entrada.
- **TDD**: test que falla → código mínimo → verde → refactor (`superpowers:test-driven-development` si está). Para bugs, primero el test que reproduce.
- Tareas independientes entre sí: subagentes en paralelo (`superpowers:subagent-driven-development` o subagentes con `isolation: worktree`). Tareas que tocan los mismos archivos: en serie.
- Un commit por tarea, en español, explicando el porqué.

## 4. Verificar

La compuerta del plugin corre sola al terminar cada turno (`verificar` y, si tocaste pantallas, `verificarE2E`). Si falla, arreglá la causa; nunca aflojes un test.

## 5. Revisar

`/delta4c-dev:revision` sobre el rango de la feature, contra la spec. Corregí lo confirmado, volvé a verificar y registrá la revisión (el comando lo indica la skill). Si el repo tiene `revisionObligatoria`, la compuerta no te deja cerrar sin esto.

## 6. E2E y QA visual (si hay UI o un journey crítico)

`/delta4c-dev:e2e`: test del journey nuevo o actualizado y capturas a 375 y 1280 px comparadas con el diseño.

## 7. PR

Título y descripción en español: qué cambia y por qué, link a la spec, evidencia (comandos y resultados de verificación, veredicto de la revisión, capturas), riesgos y cómo probarlo. Nunca mergees sin revisión humana.

## Contexto y costo durante el flujo

- `/clear` entre fases que no necesitan el historial (spec → implementación).
- Después de dos correcciones fallidas sobre lo mismo, `/clear` y un prompt mejor.
- Opus o effort alto solo para spec y plan; Sonnet para implementar.
