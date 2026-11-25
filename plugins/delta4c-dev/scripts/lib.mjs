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
