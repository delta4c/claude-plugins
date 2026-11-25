// PostToolUse (Edit|Write): chequeo rápido del archivo recién editado (formato, lint, tipos).
// Se configura en .claude/delta4c.json con "chequeoRapido": [{ "extensiones": ["ts","tsx"], "comando": "… {archivo}" }].
// Si el chequeo falla, Claude ve el error al instante (exit 2) y lo corrige antes de seguir.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { citar, leerConfig, leerEntrada, raizProyecto, rutaRelativa, ultimasLineas } from "./lib.mjs";

const entrada = await leerEntrada();
const ruta = entrada.tool_input?.file_path;
if (!ruta) process.exit(0);

const raiz = raizProyecto(entrada);
const config = leerConfig(raiz);
const chequeos = Array.isArray(config.chequeoRapido) ? config.chequeoRapido : [];
if (chequeos.length === 0) process.exit(0);

const rutaRel = rutaRelativa(raiz, ruta);
if (rutaRel.startsWith("..") || !existsSync(path.join(raiz, rutaRel))) process.exit(0);
const extension = path.posix.extname(rutaRel).slice(1).toLowerCase();

const fallas = [];
for (const chequeo of chequeos) {
  const extensiones = (chequeo.extensiones || []).map((e) => String(e).replace(/^\./, "").toLowerCase());
  if (!chequeo.comando || (extensiones.length > 0 && !extensiones.includes(extension))) continue;
  const comando = chequeo.comando.replaceAll("{archivo}", citar(rutaRel));
  const resultado = spawnSync(comando, {
    cwd: raiz,
    shell: true,
    encoding: "utf8",
    timeout: (chequeo.timeoutSegundos || 90) * 1000,
  });
  if (resultado.status !== 0) {
    const salida = `${resultado.stdout || ""}${resultado.stderr || ""}` || String(resultado.error || "sin salida");
    fallas.push(`\`${comando}\` falló (exit ${resultado.status ?? "timeout"}):\n${ultimasLineas(salida, 40)}`);
  }
}

if (fallas.length > 0) {
  process.stderr.write(`Chequeo rápido de ${rutaRel}:\n\n${fallas.join("\n\n")}\n\nCorregilo antes de seguir.\n`);
  process.exit(2);
}
process.exit(0);
