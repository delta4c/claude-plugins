---
name: configurar-maquina
description: Configura Claude Code en esta computadora con el estándar de Delta 4C (status line con contexto y costo, modelo por defecto, bloqueo global de secretos, sandbox donde se pueda, Superpowers y Playwright CLI). Se corre una vez por máquina.
disable-model-invocation: true
---

# Configurar esta máquina

Todo va en la configuración de usuario (`~/.claude/settings.json`; en Windows `%USERPROFILE%\.claude\settings.json`). Leé el archivo actual, **fusioná** sin borrar claves existentes, mostrá el diff y pedí confirmación antes de escribir. JSON estricto: sin comentarios ni comas finales.

## 1. Relevar

- Sistema: Windows nativo, WSL2, macOS o Linux (`uname -a`, o `$env:OS` en PowerShell).
- `node --version` (≥ 18), `git --version`, y si está `gh`.
- Plugins instalados: `claude plugin list`.

## 2. Status line (contexto y costo siempre visibles)

1. Copiá `${CLAUDE_PLUGIN_ROOT}/scripts/statusline.mjs` a `~/.claude/delta4c-statusline.mjs` (ruta absoluta real de esta máquina).
2. En settings: `"statusLine": { "type": "command", "command": "node \"<ruta absoluta>/delta4c-statusline.mjs\"" }`.

Muestra modelo, barra de contexto (amarilla desde 50%, roja desde 70% con la sugerencia de `/clear` o `/compact`), costo estimado de la sesión y rama.

## 3. Modelo por defecto

Preguntá con AskUserQuestion. Recomendado: `"model": "sonnet"` por defecto y pasar a Opus con `/model` solo para arquitectura, specs o problemas difíciles. Es la palanca de costo más grande.

## 4. Secretos bloqueados en todos los repos

Sumá a `permissions.deny` (sin duplicar):

```json
"Read(**/.env)", "Read(**/.env.local)", "Read(**/.env.development)", "Read(**/.env.production)", "Read(**/.env.test)", "Read(**/*.pem)", "Read(**/*.key)"
```

## 5. Sandbox

- **macOS, Linux o WSL2**: proponé `"sandbox": { "enabled": true }`. Aísla filesystem y red de los comandos, también de los subprocesos. En WSL2 hace falta `bubblewrap` y `socat` (`sudo apt install bubblewrap socat`).
- **Windows nativo**: el sandbox no está soportado y los comandos corren sin aislar. Decilo claro y recomendá WSL2 para repos con datos sensibles de clientes. La protección de hooks del plugin sí funciona igual.

## 6. Superpowers

Si `claude plugin list` no muestra `superpowers`, instalalo: `claude plugin install superpowers@claude-plugins-official`. El plugin lo declara como dependencia, pero esto asegura que esté aunque la dependencia no se haya resuelto.

## 7. Playwright CLI (opcional, para QA en navegador)

`npm install -g @playwright/cli@latest` y después `playwright-cli install --skills`.

## 8. Telemetría (opcional, para compliance o costo por cliente)

Solo si la organización tiene un colector OpenTelemetry: en el bloque `env` de la configuración de usuario, `CLAUDE_CODE_ENABLE_TELEMETRY=1` y las variables `OTEL_*` del colector (ver https://code.claude.com/docs/en/monitoring-usage). Las variables de telemetría no se toman desde el `.claude/settings.json` de un repo. Sin colector, para costo por cliente alcanza con `/usage` y una clave o workspace de API por cliente.

## 9. Cerrar

Listá lo que cambió y lo que quedó pendiente. Indicá reiniciar Claude Code para que tome todo.
