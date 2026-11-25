---
name: preparar-repo
description: Deja un repo listo para trabajar con Claude Code según el estándar de Delta 4C (CLAUDE.md, compuerta de verificación, permisos, worktrees, plugin habilitado para el equipo y CI opcional).
argument-hint: "[--con-ci]"
disable-model-invocation: true
---

# Preparar un repo

Las plantillas están en `${CLAUDE_PLUGIN_ROOT}/skills/preparar-repo/plantillas/`. No pises nada que ya exista sin mostrar el cambio y pedir confirmación: muchos repos ya tienen reglas propias (por ejemplo `AGENTS.md`, lefthook, CI).

## 1. Relevar (sin escribir)

Detectá y anotá:

- **Stack y gestor de paquetes**: `package.json` + lockfile (`pnpm-lock.yaml` → pnpm, `package-lock.json` → npm, `yarn.lock`, `bun.lock`), `composer.json` (Laravel/PHP), `pyproject.toml`, `go.mod`.
- **Comandos reales** de lint, formato, typecheck, tests y build (scripts de `package.json`, `composer.json`, Makefile, README).
- **Reglas existentes**: `CLAUDE.md`, `AGENTS.md`, `.claude/`, `lefthook.yml` o `.husky/`, `.github/workflows/`, `docs/`.
- **Archivos sensibles**: `.env*`, claves, y carpetas que no se deben editar a mano (migraciones ya aplicadas, código generado).

Mostrá el relevamiento en una tabla corta y preguntá lo que no se pueda deducir.

## 2. Instrucciones del repo

- Si hay `AGENTS.md` y no `CLAUDE.md`: creá `CLAUDE.md` con una sola línea, `@AGENTS.md`, para que Claude Code lo cargue sin duplicar.
- Si no hay ninguno: partí de `plantillas/CLAUDE.md.plantilla` y completalo **solo** con lo que Claude no puede deducir del código: comandos, reglas de la casa, decisiones de arquitectura, trampas conocidas. Menos de 200 líneas. Borrá las secciones que no apliquen.
- Si ya hay `CLAUDE.md`: no lo reescribas; proponé recortes o agregados puntuales.

## 3. Compuerta y chequeos (`.claude/delta4c.json`)

Partí de `plantillas/delta4c.json` y elegí el ejemplo del stack. Debe tener:

- `verificar`: los mismos comandos que el repo exige antes de dar algo por listo (lint, typecheck, tests). Si el repo ya define una lista (por ejemplo «Evidencia antes de listo» en AGENTS.md), usá exactamente esa.
- `chequeoRapido`: lint o typecheck de **un archivo** (rápido, menos de 10 s). Si no hay forma de chequear un solo archivo, dejalo vacío.
- `protegidos`: globs de lo que no se edita (migraciones aplicadas, código generado, vendor).
- `acotarSalidaTests`: `true` solo si nadie más reescribe los comandos de test en esa máquina.

Antes de guardar, corré cada comando de `verificar` una vez para confirmar que existe y anda.

## 4. Permisos y equipo (`.claude/settings.json`)

Fusioná `plantillas/settings.json` con lo que ya haya: habilita este plugin para todo el que abra el repo y niega leer secretos. No borres reglas existentes.

## 5. Worktrees y gitignore

- `.worktreeinclude` con los `.env` locales que existan (para que cada worktree arranque con su config).
- Agregá a `.gitignore`, si faltan: `.claude/worktrees/`, `.claude/delta4c.local.json`, `.claude/settings.local.json`.

## 6. Compuertas de git (solo si el repo es JS/TS y no tiene nada parecido)

Ofrecé copiar `plantillas/assert-skip-check.sh` a `scripts/` y sumarlo al pre-commit (lefthook o husky): rechaza commits que salteen tests o debiliten asserts. Viene de `delta4c/hq`.

## 7. CI (solo con `--con-ci` o si la persona lo pide)

Copiá `plantillas/claude-revision.yml` a `.github/workflows/`. Avisá que hace falta el secret `ANTHROPIC_API_KEY` (o `CLAUDE_CODE_OAUTH_TOKEN`) y que la GitHub App de Claude esté instalada en el repo.

## 8. Cierre

Listá los archivos creados o cambiados, el resultado de correr `verificar`, y lo que quedó pendiente para una persona (secrets, decisiones). No hagas commit salvo que te lo pidan.
