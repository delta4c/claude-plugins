// Compuerta de verificación: Claude no puede dar el turno por terminado si cambió código y
// la verificación del proyecto no pasa. Se configura en .claude/delta4c.json:
//   "verificar": ["pnpm run lint", "pnpm typecheck", "pnpm test"]
//   "ignorarEnCompuerta": ["**/*.md", "docs/**"]   (opcional; cambios que no disparan la compuerta)
//   "reintentosCompuerta": 3                          (opcional; bloqueos seguidos antes de soltar)
// Modo "inicio" (SessionStart): guarda cómo estaba el repo al empezar, para no verificar si no se tocó nada.
// Modo "fin" (Stop): si el código cambió desde el inicio o desde la última verificación verde, corre la lista.
// Para saltearla una vez, una persona exporta DELTA4C_SIN_COMPUERTA=1.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { leerConfig, leerEntrada, raizProyecto, responder, ultimasLineas } from "./lib.mjs";

const modo = process.argv[2];
const entrada = await leerEntrada();
const raiz = raizProyecto(entrada);
const config = leerConfig(raiz);
const comandos = Array.isArray(config.verificar) ? config.verificar.filter(Boolean) : [];
if (comandos.length === 0 || process.env.DELTA4C_SIN_COMPUERTA === "1") process.exit(0);

const hash = (texto) => createHash("sha256").update(texto).digest("hex");

function git(args) {
  return execFileSync("git", ["-C", raiz, ...args], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });
}

/** Huella del código: HEAD + cambios sin commitear + archivos nuevos, sin lo ignorado. Null si no es repo git. */
function huella() {
  const ignorar = Array.isArray(config.ignorarEnCompuerta) ? config.ignorarEnCompuerta : ["**/*.md", "docs/**"];
  const excluir = ignorar.map((g) => `:(exclude,glob)${g}`);
  try {
    git(["rev-parse", "--git-dir"]);
  } catch {
    return null;
  }
  let cabeza = "sin-commits";
  let diff = "";
  try {
    cabeza = git(["rev-parse", "HEAD"]).trim();
    diff = git(["diff", "HEAD", "--binary", "--", ".", ...excluir]);
  } catch {
    // Repo sin commits todavía: se compara lo que haya en stage y en el árbol.
    try {
      diff = git(["diff", "--cached", "--binary", "--", ".", ...excluir]) + git(["diff", "--binary", "--", ".", ...excluir]);
    } catch {
      diff = "";
    }
  }
  const nuevos = git(["ls-files", "--others", "--exclude-standard", "--", ".", ...excluir])
    .split("\n")
    .filter(Boolean)
    .map((archivo) => {
      try {
        return `${archivo}:${hash(readFileSync(path.join(raiz, archivo)))}`;
      } catch {
        return archivo;
      }
    })
    .join("\n");
  return hash(`${cabeza}\n${diff}\n${nuevos}`);
}

const carpeta = path.join(process.env.CLAUDE_PLUGIN_DATA || path.join(os.tmpdir(), "delta4c-dev"), "compuerta");
mkdirSync(carpeta, { recursive: true });
const archivoEstado = path.join(carpeta, `${hash(`${entrada.session_id || "sin-sesion"}\n${raiz}`).slice(0, 32)}.json`);
const leerEstado = () => {
  try {
    return existsSync(archivoEstado) ? JSON.parse(readFileSync(archivoEstado, "utf8")) : {};
  } catch {
    return {};
  }
};
const guardarEstado = (estado) => writeFileSync(archivoEstado, JSON.stringify(estado));

const actual = huella();
if (actual === null) process.exit(0);
const estado = leerEstado();

if (modo === "inicio") {
  // Tras /compact o al retomar, la sesión ya tiene base: no se pisa, así no se pierden cambios sin verificar.
  if (!estado.base) guardarEstado({ ...estado, base: actual, bloqueos: 0 });
  process.exit(0);
}

if (modo !== "fin") process.exit(0);
if (actual === estado.base || actual === estado.ok) {
  if (estado.bloqueos) guardarEstado({ ...estado, bloqueos: 0 });
  process.exit(0);
}

const maxBloqueos = Number.isInteger(config.reintentosCompuerta) ? config.reintentosCompuerta : 3;
if (entrada.stop_hook_active && (estado.bloqueos || 0) >= maxBloqueos) {
  guardarEstado({ ...estado, bloqueos: 0 });
  responder({
    systemMessage: `delta4c-dev: la compuerta de verificación sigue fallando después de ${maxBloqueos} intentos. El trabajo NO está verificado; revisalo antes de darlo por terminado.`,
  });
}

for (const comando of comandos) {
  const inicio = Date.now();
  const resultado = spawnSync(comando, {
    cwd: raiz,
    shell: true,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    timeout: (config.timeoutCompuertaSegundos || 900) * 1000,
    env: { ...process.env, CI: process.env.CI || "1", FORCE_COLOR: "0" },
  });
  if (resultado.status !== 0) {
    guardarEstado({ ...estado, bloqueos: (estado.bloqueos || 0) + 1 });
    const salida = `${resultado.stdout || ""}${resultado.stderr || ""}` || String(resultado.error || "sin salida");
    const segundos = Math.round((Date.now() - inicio) / 1000);
    process.stderr.write(
      `Compuerta de verificación: \`${comando}\` falló (exit ${resultado.status ?? "timeout"}, ${segundos}s). Últimas líneas:\n\n` +
        `${ultimasLineas(salida, 60)}\n\n` +
        "Corregí la causa en el código (no aflojes ni saltees tests) y volvé a verificar. " +
        "Si el fallo no es tuyo o no se puede resolver acá, explicalo y frená.\n",
    );
    process.exit(2);
  }
}

guardarEstado({ ...estado, ok: actual, bloqueos: 0 });
process.exit(0);
