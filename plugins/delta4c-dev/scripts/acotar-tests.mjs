// PreToolUse (Bash), opcional: recorta la salida de la suite de tests para no llenar el contexto.
// Se activa con "acotarSalidaTests": true (120 líneas) o un número de líneas en .claude/delta4c.json.
// Conserva el código de salida (pipefail), así un fallo sigue siendo un fallo.
import { leerConfig, leerEntrada, raizProyecto, responder } from "./lib.mjs";

const entrada = await leerEntrada();
const comando = String(entrada.tool_input?.command || "").trim();
const config = leerConfig(raizProyecto(entrada));
const ajuste = config.acotarSalidaTests;
if (!ajuste || !comando) process.exit(0);

const lineas = Number.isInteger(ajuste) && ajuste > 0 ? ajuste : 120;

// Solo comandos de test simples: sin encadenar, redirigir ni sustituir, para no cambiar su significado.
if (/[;&|<>`$(){}]/.test(comando)) process.exit(0);
const RUNNERS = [
  /^(pnpm|npm|yarn|bun)( run)? test(\s|$)/,
  /^(npx |pnpm exec |pnpm dlx |bunx )?(vitest|jest)(\s|$)/,
  /^(npx |pnpm exec )?playwright test(\s|$)/,
  /^(python -m )?pytest(\s|$)/,
  /^php artisan test(\s|$)/,
  /^(\.\/)?vendor\/bin\/(phpunit|pest)(\s|$)/,
  /^composer test(\s|$)/,
  /^go test(\s|$)/,
];
if (!RUNNERS.some((r) => r.test(comando))) process.exit(0);

responder({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    updatedInput: {
      ...entrada.tool_input,
      command: `set -o pipefail; ${comando} 2>&1 | tail -n ${lineas}`,
    },
  },
});
