---
name: preparar-repo
description: Deja un repo listo para trabajar con Claude Code según el estándar de Delta 4C (CLAUDE.md, arquitectura documentada, compuerta de verificación, e2e y revisión obligatoria, permisos, sandbox, worktrees, plugins del equipo y revisión en CI).
argument-hint: "[--con-ci]"
disable-model-invocation: true
---

# Preparar un repo

Las plantillas están en `${CLAUDE_PLUGIN_ROOT}/skills/preparar-repo/plantillas/`. No pises nada que ya exista sin mostrar el cambio y pedir confirmación: muchos repos ya tienen reglas propias (`AGENTS.md`, lefthook, CI).

## 1. Relevar (sin escribir)

Detectá y mostrá en una tabla corta:

- **Stack y gestor de paquetes**: `package.json` + lockfile (`pnpm-lock.yaml` → pnpm, `package-lock.json` → npm, `yarn.lock`, `bun.lock`), `composer.json` (Laravel/PHP), `pyproject.toml`, `go.mod`.
- **Comandos reales** de lint, formato, typecheck, tests, e2e y build (scripts, Makefile, README).
- **Reglas y docs existentes**: `CLAUDE.md`, `AGENTS.md`, `.claude/`, `docs/arquitectura.md`, `docs/adr/`, `lefthook.yml` o `.husky/`, `.github/workflows/`.
- **Calidad disponible**: linter de accesibilidad, Playwright, tests de integración.
- **Archivos sensibles o intocables**: `.env*`, claves, migraciones aplicadas, código generado.

Preguntá lo que no se pueda deducir.

## 2. Arquitectura

Si no hay `docs/arquitectura.md` (o equivalente), ofrecé correr `/delta4c-dev:arquitectura` al terminar este setup. Sin arquitectura escrita, Claude la deduce cada vez y a veces mal.

## 3. Instrucciones del repo

- Hay `AGENTS.md` y no `CLAUDE.md`: creá `CLAUDE.md` con una sola línea, `@AGENTS.md`.
- No hay ninguno: partí de `plantillas/CLAUDE.md.plantilla` y completá **solo** lo que Claude no puede deducir del código (comandos, reglas de la casa, arquitectura en 3–6 líneas, trampas). Menos de 200 líneas.
- Ya hay `CLAUDE.md`: no lo reescribas; proponé recortes o agregados puntuales, incluida la sección "Al compactar".

## 4. Compuerta (`.claude/delta4c.json`)

Partí de `plantillas/delta4c.json`, elegí el ejemplo del stack y ajustalo:

| Clave | Qué poner |
| --- | --- |
| `verificar` | Exactamente lo que el repo exige antes de "listo" (lint, typecheck, tests). Si AGENTS.md o CLAUDE.md ya lo define, esa lista |
| `chequeoRapido` | Lint o formato de un solo archivo, menos de 10 s. Vacío si no se puede |
| `verificarE2E` + `disparadoresE2E` | Si hay Playwright: la suite de journeys críticos y los globs de UI que la disparan. Si no hay, ofrecé `/delta4c-dev:e2e` para armarla |
| `revisionObligatoria` | `{ "minLineas": 40 }` por defecto: sesiones que cambian 40 líneas o más no cierran sin `/delta4c-dev:revision` |
| `protegidos` | Migraciones aplicadas, código generado, vendor |
| `acotarSalidaTests` | `true` solo si nada más reescribe los comandos de test en esa máquina |

Antes de guardar, corré cada comando de `verificar` y `verificarE2E` una vez para confirmar que existen y pasan.

## 5. Equipo y permisos (`.claude/settings.json`)

Fusioná `plantillas/settings.json`: habilita este plugin y Superpowers para todo el que abra el repo, niega leer secretos y activa el sandbox (en Windows nativo no aplica; en macOS, Linux y WSL2 sí). No borres reglas existentes.

## 6. Worktrees y gitignore

- `.worktreeinclude` con los `.env` locales que existan.
- En `.gitignore`, si faltan: `.claude/worktrees/`, `.claude/delta4c.local.json`, `.claude/settings.local.json`.

## 7. Compuertas de git (JS/TS sin nada parecido)

Ofrecé copiar `plantillas/assert-skip-check.sh` a `scripts/` y sumarlo al pre-commit (lefthook o husky): rechaza commits que salteen tests o debiliten asserts. Viene de `delta4c/hq`. Si no hay escaneo de secretos en pre-commit, ofrecé gitleaks.

## 8. Calidad de frontend y backend

- Front sin linter de accesibilidad: proponé el del stack (`eslint-plugin-jsx-a11y`, `eslint-plugin-vuejs-accessibility`, o `@axe-core/playwright` en los e2e).
- `/delta4c-dev:ui` y `/delta4c-dev:api` guían a Claude con el estándar; si el repo tiene convenciones propias distintas, anotalas en CLAUDE.md.

## 9. CI (con `--con-ci` o si la persona lo pide)

Copiá `plantillas/claude-revision.yml` a `.github/workflows/`. Hace falta el secret `ANTHROPIC_API_KEY` (o `CLAUDE_CODE_OAUTH_TOKEN`) y la GitHub App de Claude instalada en el repo.

## 10. Cierre

Listá archivos creados o cambiados, resultado de los comandos, y lo pendiente para una persona (secrets, decisiones, `/delta4c-dev:arquitectura`). No hagas commit salvo que te lo pidan. Si es la primera vez en esta computadora, recordá `/delta4c-dev:configurar-maquina`.
