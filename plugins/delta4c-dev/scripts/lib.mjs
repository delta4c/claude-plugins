// Utilidades compartidas por los hooks de delta4c-dev. Sin dependencias: solo Node ≥ 18.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** Lee el JSON que Claude Code manda por stdin. Devuelve {} si no hay nada o no parsea. */
export async function leerEntrada() {
  let texto = "";
  for await (const trozo of process.stdin) texto += trozo;
  try {
    return texto.trim() ? JSON.parse(texto) : {};
  } catch {
    return {};
  }
}

/** Raíz del repo donde trabaja Claude. En un worktree, `cwd` sigue al worktree y CLAUDE_PROJECT_DIR no. */
export function raizProyecto(entrada) {
  const base = entrada.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  try {
    return execFileSync("git", ["-C", base, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return process.env.CLAUDE_PROJECT_DIR || base;
  }
}

/**
 * Configuración del proyecto: `.claude/delta4c.json` (versionado) y, encima,
 * `.claude/delta4c.local.json` (personal, gitignoreado). Sin archivo, todo queda apagado
 * salvo la protección de secretos y de gates.
 */
export function leerConfig(raiz) {
  const config = {};
  for (const nombre of ["delta4c.json", "delta4c.local.json"]) {
    const archivo = path.join(raiz, ".claude", nombre);
    if (!existsSync(archivo)) continue;
    try {
      Object.assign(config, JSON.parse(readFileSync(archivo, "utf8")));
    } catch (error) {
      process.stderr.write(`delta4c-dev: no pude leer ${archivo}: ${error.message}\n`);
    }
  }
  return config;
}

/** Ruta relativa a la raíz, con barras normales. */
export function rutaRelativa(raiz, ruta) {
  const absoluta = path.isAbsolute(ruta) ? ruta : path.join(raiz, ruta);
  return path.relative(raiz, absoluta).split(path.sep).join("/");
}

/**
 * Glob mínimo: `*` no cruza `/`, `**` sí, `?` es un carácter.
 * Alcanza para patrones como `prisma/migrations/**` o `database/migrations/*.php`.
 */
export function coincideGlob(ruta, patron) {
  let regex = "";
  for (let i = 0; i < patron.length; i++) {
    const c = patron[i];
    if (c === "*" && patron[i + 1] === "*") {
      regex += ".*";
      i++;
      if (patron[i + 1] === "/") i++;
    } else if (c === "*") regex += "[^/]*";
    else if (c === "?") regex += "[^/]";
    else regex += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${regex}$`).test(ruta);
}

/** Comillas simples seguras para sh. */
export function citar(texto) {
  return `'${String(texto).replace(/'/g, `'\\''`)}'`;
}

/** Últimas `n` líneas de un texto. */
export function ultimasLineas(texto, n) {
  const lineas = String(texto).trimEnd().split("\n");
  return lineas.slice(-n).join("\n");
}

/** Responde a Claude Code con JSON por stdout y sale con 0. */
export function responder(objeto) {
  process.stdout.write(JSON.stringify(objeto));
  process.exit(0);
}

/** Niega una herramienta en PreToolUse con un motivo que Claude lee. */
export function negar(motivo) {
  responder({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: motivo,
    },
  });
}

// ---------- Estado del repo (compartido por compuerta y marcar-revision) ----------

import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";

const ARBOL_VACIO = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

export const sha = (texto) => createHash("sha256").update(texto).digest("hex");

export function git(raiz, args) {
  return execFileSync("git", ["-C", raiz, ...args], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });
}

export function esRepoGit(raiz) {
  try {
    git(raiz, ["rev-parse", "--git-dir"]);
    return true;
  } catch {
    return false;
  }
}

export function cabeza(raiz) {
  try {
    return git(raiz, ["rev-parse", "HEAD"]).trim();
  } catch {
    return null;
  }
}

function exclusiones(config) {
  const ignorar = Array.isArray(config.ignorarEnCompuerta) ? config.ignorarEnCompuerta : ["**/*.md", "docs/**"];
  return ignorar.map((g) => `:(exclude,glob)${g}`);
}

function nuevos(raiz, config) {
  return git(raiz, ["ls-files", "--others", "--exclude-standard", "--", ".", ...exclusiones(config)])
    .split("\n")
    .filter(Boolean);
}

/** Huella del código: HEAD + cambios sin commitear + archivos nuevos, sin lo ignorado. */
export function huella(raiz, config) {
  const excluir = exclusiones(config);
  const head = cabeza(raiz) || ARBOL_VACIO;
  let diff = "";
  try {
    diff = git(raiz, ["diff", head, "--binary", "--", ".", ...excluir]);
  } catch {
    diff = "";
  }
  const contenidoNuevos = nuevos(raiz, config)
    .map((archivo) => {
      try {
        return `${archivo}:${sha(readFileSync(path.join(raiz, archivo)))}`;
      } catch {
        return archivo;
      }
    })
    .join("\n");
  return sha(`${head}\n${diff}\n${contenidoNuevos}`);
}

/** Archivos que cambiaron desde `base` (commit), incluidos los nuevos sin trackear. */
export function archivosCambiados(raiz, config, base) {
  let lista = [];
  try {
    lista = git(raiz, ["diff", "--name-only", base || ARBOL_VACIO, "--", ".", ...exclusiones(config)]).split("\n");
  } catch {}
  return [...new Set([...lista, ...nuevos(raiz, config)].filter(Boolean))];
}

/** Líneas agregadas + borradas desde `base`, contando los archivos nuevos completos. */
export function lineasCambiadas(raiz, config, base) {
  let total = 0;
  try {
    for (const linea of git(raiz, ["diff", "--numstat", base || ARBOL_VACIO, "--", ".", ...exclusiones(config)]).split("\n")) {
      const [mas, menos] = linea.split("\t");
      if (/^\d+$/.test(mas)) total += Number(mas) + Number(menos);
    }
  } catch {}
  for (const archivo of nuevos(raiz, config)) {
    try {
      total += readFileSync(path.join(raiz, archivo), "utf8").split("\n").length;
    } catch {}
  }
  return total;
}

/** Carpeta de datos persistentes del plugin. */
export function carpetaDatos(sub) {
  const carpeta = path.join(process.env.CLAUDE_PLUGIN_DATA || path.join(os.tmpdir(), "delta4c-dev"), sub);
  mkdirSync(carpeta, { recursive: true });
  return carpeta;
}

export function leerJson(archivo, porDefecto = {}) {
  try {
    return existsSync(archivo) ? JSON.parse(readFileSync(archivo, "utf8")) : porDefecto;
  } catch {
    return porDefecto;
  }
}

export function escribirJson(archivo, datos) {
  writeFileSync(archivo, JSON.stringify(datos, null, 2));
}

/** Estado de sesión más reciente para una raíz (lo usa marcar-revision, que no recibe session_id). */
export function estadoMasReciente(raiz) {
  const carpeta = carpetaDatos("compuerta");
  let mejor = null;
  for (const nombre of readdirSync(carpeta)) {
    const archivo = path.join(carpeta, nombre);
    const estado = leerJson(archivo, null);
    if (!estado || estado.raiz !== raiz) continue;
    const mtime = statSync(archivo).mtimeMs;
    if (!mejor || mtime > mejor.mtime) mejor = { archivo, estado, mtime };
  }
  return mejor;
}

export const archivoRevision = (raiz) => path.join(carpetaDatos("revisiones"), `${sha(raiz).slice(0, 32)}.json`);
