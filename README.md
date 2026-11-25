# Plugins de Claude Code · Delta 4C

Marketplace interno con el estándar de desarrollo de Delta 4C para Claude Code.

| Plugin | Qué trae |
| --- | --- |
| [`delta4c-dev`](plugins/delta4c-dev/README.md) | Revisores en contexto limpio, compuerta de verificación antes de «listo», protección de secretos y de gates, e2e con Playwright y `/preparar-repo` |

## Instalar (una vez por máquina)

Dentro de Claude Code (2.1.275 o posterior):

```
/plugin install delta4c-dev --marketplace delta4c/claude-plugins
```

En versiones anteriores:

```
/plugin marketplace add delta4c/claude-plugins
/plugin install delta4c-dev@delta4c
```

Requisitos: Node 18 o superior en el `PATH` (los hooks son scripts de Node sin dependencias) y acceso de lectura al repo `delta4c/claude-plugins` con tu cuenta de GitHub.

## Habilitarlo para todo el equipo en un repo

Corré `/delta4c-dev:preparar-repo` dentro del repo, o agregá a su `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "delta4c": { "source": { "source": "github", "repo": "delta4c/claude-plugins" } }
  },
  "enabledPlugins": { "delta4c-dev@delta4c": true }
}
```

Quien abra el repo con Claude Code recibe la propuesta de instalar el marketplace y el plugin.

## Actualizar

Subí `version` en `plugins/delta4c-dev/.claude-plugin/plugin.json` en cada cambio; después, en cada máquina, `/plugin marketplace update delta4c`.

## Validar antes de mergear

```
claude plugin validate ./plugins/delta4c-dev
claude plugin validate .
node --test plugins/delta4c-dev/tests/*.test.mjs
```
