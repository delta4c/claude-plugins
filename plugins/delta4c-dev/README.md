# delta4c-dev

El estándar de Delta 4C para desarrollar con Claude Code, empaquetado: lo que tiene que pasar siempre va en hooks; lo que necesita criterio va en agentes y skills.

## Instalar

```
/plugin install delta4c-dev --marketplace delta4c/claude-plugins
```

En versiones anteriores a 2.1.275: `/plugin marketplace add delta4c/claude-plugins` y después `/plugin install delta4c-dev@delta4c`.

## Qué trae

### Hooks (automáticos)

| Hook | Cuándo | Qué hace | Se activa |
| --- | --- | --- | --- |
| `proteger` | Antes de Edit/Write/Bash | Niega editar o leer `.env` y claves, push forzado, `--no-verify`, `LEFTHOOK=0`/`HUSKY=0`, `PERMITIR_TESTS=`, `rm -rf /` o `~`, y editar los archivos `protegidos` del proyecto | Siempre |
| `post-edicion` | Después de Edit/Write | Corre el `chequeoRapido` sobre el archivo editado; si falla, Claude ve el error al instante | Con `chequeoRapido` |
| `compuerta` | Al terminar cada turno (Stop) | Si el código cambió desde el inicio de la sesión o desde la última verificación verde, corre `verificar`; si algo falla, Claude no puede terminar y tiene que corregirlo | Con `verificar` |
| `acotar-tests` | Antes de Bash | Recorta la salida de los comandos de test a las últimas N líneas, conservando el código de salida | Con `acotarSalidaTests` |

La compuerta no vuelve a correr si no cambió código (cambios solo en `*.md` o `docs/` no cuentan), y suelta después de 3 intentos fallidos seguidos avisándote que el trabajo **no** quedó verificado. Para saltearla una vez: `DELTA4C_SIN_COMPUERTA=1 claude`.

### Agentes

| Agente | Modelo | Para qué |
| --- | --- | --- |
| `delta4c-dev:investigador` | Haiku | Explorar el código y devolver rutas y un resumen, sin llenar el contexto principal |
| `delta4c-dev:revisor-codigo` | Sonnet | Revisar el diff contra la spec y las reglas del repo; solo correctitud y requisitos |
| `delta4c-dev:revisor-seguridad` | Opus | Autorización, fuga entre clientes, inyección, secretos, dependencias |
| `delta4c-dev:revisor-ui` | Sonnet | Estados, accesibilidad, design system, responsive, capturas |

Todos son de solo lectura.

### Skills

| Skill | Uso |
| --- | --- |
| `/delta4c-dev:revision [rango] [spec]` | Elige revisores según el diff, los corre en paralelo, valida cada hallazgo grave con un segundo agente y da un veredicto |
| `/delta4c-dev:e2e [journey] [URL]` | Flujo con playwright-cli y los Test Agents de Playwright, con reglas para no aflojar asserts |
| `/delta4c-dev:preparar-repo [--con-ci]` | Releva el repo y crea CLAUDE.md, `.claude/delta4c.json`, permisos, worktrees y, opcional, la revisión en CI |

Convive con Superpowers: Superpowers lleva el flujo spec → plan → TDD; este plugin pone las compuertas, los revisores y la protección.

## Configuración por proyecto: `.claude/delta4c.json`

```json
{
  "verificar": ["pnpm run lint", "pnpm typecheck", "pnpm test"],
  "chequeoRapido": [
    { "extensiones": ["ts", "tsx", "json", "css"], "comando": "pnpm exec biome check --no-errors-on-unmatched {archivo}" }
  ],
  "protegidos": ["prisma/migrations/**"],
  "ignorarEnCompuerta": ["**/*.md", "docs/**"],
  "acotarSalidaTests": false
}
```

| Clave | Tipo | Default | Qué hace |
| --- | --- | --- | --- |
| `verificar` | lista de comandos | ninguno (compuerta apagada) | Lo que tiene que pasar antes de terminar un turno con cambios de código |
| `chequeoRapido` | lista de `{extensiones, comando, timeoutSegundos?}` | ninguno | Chequeo de un archivo; `{archivo}` se reemplaza por la ruta |
| `protegidos` | lista de globs | ninguno | Archivos que los agentes no editan. `*` no cruza `/`, `**` sí |
| `ignorarEnCompuerta` | lista de globs | `["**/*.md", "docs/**"]` | Cambios que no disparan la compuerta |
| `acotarSalidaTests` | `false`, `true` o número | `false` | Recorta la salida de tests (120 líneas con `true`) |
| `reintentosCompuerta` | número | 3 | Bloqueos seguidos antes de soltar con aviso |
| `timeoutCompuertaSegundos` | número | 900 | Tope por comando de `verificar` |

`.claude/delta4c.local.json` (gitignoreado) pisa claves para tu máquina.

## Desarrollo

- Tests de los hooks: `node --test tests/*.test.mjs`.
- Probar sin instalar: `claude --plugin-dir ./plugins/delta4c-dev`.
- Cada cambio sube `version` en `.claude-plugin/plugin.json`.
