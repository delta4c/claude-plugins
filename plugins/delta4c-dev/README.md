# delta4c-dev

El estándar de Delta 4C para desarrollar con Claude Code, en un solo plugin. Lo obligatorio va en hooks (pasa siempre); lo que necesita criterio va en skills y agentes. Instala también [Superpowers](https://github.com/obra/superpowers) como dependencia, para el flujo spec → plan → TDD.

## Instalar

```
/plugin install delta4c-dev --marketplace delta4c/claude-plugins
```

Requisitos: Claude Code 2.1.275 o posterior, Node 18+, acceso de lectura a `delta4c/claude-plugins`, y el marketplace oficial `claude-plugins-official` registrado (Claude Code lo registra solo al abrir una sesión interactiva; si instalás desde una terminal recién configurada, antes corré `claude plugin marketplace add anthropics/claude-plugins-official`).

Después, una vez por máquina: `/delta4c-dev:configurar-maquina`. Y en cada repo: `/delta4c-dev:preparar-repo`.

## Qué cubre

| Pauta | Cómo la cubre | Tipo |
| --- | --- | --- |
| 1. Arquitectura, tecnología y estructura | `/arquitectura`: entrevista, compara opciones de stack, escribe `docs/arquitectura.md` y ADRs; vertical slices sobre esqueleto común; `preparar-repo` deja CLAUDE.md corto con punteros | Skill + plantillas |
| 2. Agentes, subagentes y reviewers | 4 agentes de solo lectura (investigador Haiku, revisores de código, seguridad y UI); `/revision` los corre en paralelo y valida cada hallazgo grave con un segundo agente; **la compuerta exige revisión** en cambios de 40+ líneas; revisión de PR en CI | Agentes + skill + hook + CI |
| 3. Testing e2e y QA | **La compuerta exige** lint, typecheck y tests antes de terminar, y e2e cuando se tocan pantallas; `/e2e` arma Playwright (CLI y Test Agents) con reglas contra aflojar tests; TDD de Superpowers; `assert-skip-check` en pre-commit | Hook + skill + dependencia |
| 4. Escalado horizontal y vertical | Decisión de escalado como ADR con checklist (`escalabilidad.md`); revisor de código busca N+1, estado en memoria y falta de paginación; worktrees, `/batch` y subagentes en paralelo para escalar el desarrollo | Skill + agente |
| 5. Tokens y contexto | Haiku para explorar, revisores en contexto aislado, Sonnet por defecto, status line con % de contexto y costo, recorte de salida de tests, instrucciones de compactación, skills que se cargan solo cuando se usan (~870 tokens fijos por sesión, más los de Superpowers) | Configuración + hooks + agentes |
| 6. Buenas prácticas FE, BE y UX/UI | `/ui` (tokens, estados, WCAG 2.2 AA, responsive, formularios, performance) y `/api` (contratos, errores RFC 9457, autorización por recurso, multi-cliente, migraciones expand/contract, idempotencia, observabilidad); revisores que los chequean; chequeo rápido por archivo | Skills + agentes + hook |
| 7. Aristas | Bloqueo de secretos, push forzado y salteo de compuertas; sandbox (macOS, Linux, WSL2); permisos deny; telemetría opcional para compliance y costo por cliente; plugins del equipo declarados en el repo | Hooks + configuración |

**Límites conocidos**: en Windows nativo no hay sandbox (sí en WSL2); los hooks y permisos funcionan igual. La compuerta y la revisión obligatoria se activan por repo con `.claude/delta4c.json`; sin ese archivo solo actúan la protección y las skills.

## Componentes

### Hooks (automáticos)

| Hook | Cuándo | Qué hace | Se activa |
| --- | --- | --- | --- |
| `proteger` | Antes de Edit/Write/Bash | Niega editar o leer `.env` y claves, push forzado, `--no-verify`, `LEFTHOOK=0`/`HUSKY=0`, `PERMITIR_TESTS=`, `rm -rf` de raíz o home, y editar `protegidos` | Siempre |
| `post-edicion` | Después de Edit/Write | `chequeoRapido` sobre el archivo editado; si falla, Claude lo ve al instante | Con `chequeoRapido` |
| `compuerta` | Fin de cada turno | Si cambió código: `verificar` → `verificarE2E` (si se tocaron `disparadoresE2E`) → revisión registrada (si `revisionObligatoria` y el cambio es grande). Si algo falta, Claude no puede terminar | Con cualquiera de esas claves |
| `acotar-tests` | Antes de Bash | Recorta la salida de tests a las últimas N líneas, conservando el código de salida | Con `acotarSalidaTests` |

La compuerta no corre si no cambió código (cambios solo en `*.md` o `docs/` no cuentan), no repite una verificación ya verde y suelta tras 3 intentos fallidos avisando que el trabajo **no** quedó verificado. Para saltearla una vez: `DELTA4C_SIN_COMPUERTA=1 claude`.

### Skills

| Skill | Uso |
| --- | --- |
| `/delta4c-dev:feature [qué]` | Flujo completo: tamaño → spec → plan → TDD → verificación → revisión → e2e → PR |
| `/delta4c-dev:arquitectura [proyecto]` | Arquitectura, stack, estructura y escalado, con `docs/arquitectura.md` y ADRs |
| `/delta4c-dev:revision [rango] [spec]` | Revisores en paralelo, validación de hallazgos graves, veredicto y registro |
| `/delta4c-dev:e2e [journey] [URL]` | Playwright CLI y Test Agents, conectado a la compuerta |
| `/delta4c-dev:ui` | Estándar de frontend, UX y UI (Claude lo carga solo al trabajar en pantallas) |
| `/delta4c-dev:api` | Estándar de backend y APIs (Claude lo carga solo al trabajar en endpoints y datos) |
| `/delta4c-dev:preparar-repo [--con-ci]` | Deja un repo listo: CLAUDE.md, compuerta, permisos, sandbox, worktrees, CI |
| `/delta4c-dev:configurar-maquina` | Una vez por computadora: status line, modelo, secretos, sandbox, Superpowers, Playwright CLI |

### Agentes (solo lectura)

| Agente | Modelo | Para qué |
| --- | --- | --- |
| `delta4c-dev:investigador` | Haiku | Explorar el código y devolver rutas y un resumen |
| `delta4c-dev:revisor-codigo` | Sonnet | Correctitud y requisitos contra la spec y las reglas del repo |
| `delta4c-dev:revisor-seguridad` | Opus | Autorización, fuga entre clientes, inyección, secretos, dependencias |
| `delta4c-dev:revisor-ui` | Sonnet | Estados, accesibilidad, design system, responsive, capturas |

## Configuración por repo: `.claude/delta4c.json`

```json
{
  "verificar": ["pnpm run lint", "pnpm typecheck", "pnpm test"],
  "chequeoRapido": [
    { "extensiones": ["ts", "tsx", "json", "css"], "comando": "pnpm exec biome check --no-errors-on-unmatched {archivo}" }
  ],
  "verificarE2E": ["pnpm exec playwright test --reporter=line"],
  "disparadoresE2E": ["src/app/**", "**/*.tsx"],
  "revisionObligatoria": { "minLineas": 40 },
  "protegidos": ["prisma/migrations/**"],
  "ignorarEnCompuerta": ["**/*.md", "docs/**"],
  "acotarSalidaTests": false
}
```

| Clave | Tipo | Default | Qué hace |
| --- | --- | --- | --- |
| `verificar` | comandos | ninguno | Tiene que pasar antes de terminar un turno con cambios de código |
| `verificarE2E` | comandos | ninguno | Corre después de `verificar` si los cambios tocan `disparadoresE2E` |
| `disparadoresE2E` | globs | todos | Qué archivos disparan los e2e |
| `revisionObligatoria` | `true` o `{ "minLineas": n }` | apagada | Cambios de `n` líneas o más (40 con `true`) exigen `/revision` registrada |
| `chequeoRapido` | `{extensiones, comando, timeoutSegundos?}[]` | ninguno | Chequeo de un archivo; `{archivo}` se reemplaza por la ruta |
| `protegidos` | globs | ninguno | Archivos que los agentes no editan. `*` no cruza `/`, `**` sí |
| `ignorarEnCompuerta` | globs | `["**/*.md", "docs/**"]` | Cambios que no disparan la compuerta |
| `acotarSalidaTests` | `false`, `true` o número | `false` | Recorta la salida de tests (120 líneas con `true`) |
| `reintentosCompuerta` | número | 3 | Bloqueos seguidos antes de soltar con aviso |
| `timeoutCompuertaSegundos` | número | 900 | Tope por comando |

`.claude/delta4c.local.json` (gitignoreado) pisa claves en tu máquina.

## Desarrollo

- Tests de los hooks: `node --test tests/*.test.mjs`.
- Probar sin instalar: `claude --plugin-dir ./plugins/delta4c-dev`.
- Cada cambio sube `version` en `.claude-plugin/plugin.json`. Para actualizar una máquina: `claude plugin marketplace update delta4c` y `claude plugin update delta4c-dev@delta4c`.
