// Compuerta de fin de turno. Claude no puede dar el turno por terminado si cambió código y:
//   1. no pasa `verificar` (lint, typecheck, tests);
//   2. no pasa `verificarE2E`, cuando los cambios tocan algún glob de `disparadoresE2E`;
//   3. no se corrió /delta4c-dev:revision, cuando `revisionObligatoria` está activa y el cambio es grande.
// Todo se configura en .claude/delta4c.json (ver README). Sin configuración no hace nada.
// Modo "inicio" (SessionStart) guarda cómo estaba el repo; modo "fin" (Stop) evalúa.
// Para saltearla una vez, una persona exporta DELTA4C_SIN_COMPUERTA=1.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  archivoRevision,
  archivosCambiados,
  cabeza,
  carpetaDatos,
  coincideGlob,
  esRepoGit,
  escribirJson,
  huella,
  leerConfig,
  leerEntrada,
  leerJson,
  lineasCambiadas,
  raizProyecto,
  responder,
  sha,
  ultimasLineas,
} from "./lib.mjs";

const modo = process.argv[2];
const entrada = await leerEntrada();
const raiz = raizProyecto(entrada);
const config = leerConfig(raiz);

const lista = (valor) => (Array.isArray(valor) ? valor.filter(Boolean) : []);
const verificar = lista(config.verificar);
const verificarE2E = lista(config.verificarE2E);
const disparadoresE2E = lista(config.disparadoresE2E);
const revision = config.revisionObligatoria;
const minLineasRevision = revision === true ? 40 : Number(revision?.minLineas) || (revision ? 40 : 0);

if (process.env.DELTA4C_SIN_COMPUERTA === "1") process.exit(0);
if (verificar.length === 0 && verificarE2E.length === 0 && !minLineasRevision) process.exit(0);
if (!esRepoGit(raiz)) process.exit(0);

const archivoEstado = path.join(
  carpetaDatos("compuerta"),
  `${sha(`${entrada.session_id || "sin-sesion"}\n${raiz}`).slice(0, 32)}.json`,
);
const estado = leerJson(archivoEstado);
const guardar = (cambios) => escribirJson(archivoEstado, Object.assign(estado, cambios));

if (modo === "inicio") {
  // Tras /compact o al retomar, la sesión ya tiene base: no se pisa, así no se pierden cambios sin verificar.
  if (!estado.base) guardar({ raiz, base: huella(raiz, config), baseHead: cabeza(raiz), inicio: Date.now(), bloqueos: 0 });
  process.exit(0);
}
if (modo !== "fin") process.exit(0);

// Sesión sin SessionStart registrado (plugin instalado a mitad de sesión): se toma la base ahora.
if (!estado.base) {
  guardar({ raiz, base: huella(raiz, config), baseHead: cabeza(raiz), inicio: Date.now(), bloqueos: 0 });
  process.exit(0);
}

const actual = huella(raiz, config);
if (actual === estado.base) {
  if (estado.bloqueos) guardar({ bloqueos: 0 });
  process.exit(0);
}

const maxBloqueos = Number.isInteger(config.reintentosCompuerta) ? config.reintentosCompuerta : 3;
if (entrada.stop_hook_active && (estado.bloqueos || 0) >= maxBloqueos) {
  guardar({ bloqueos: 0 });
  responder({
    systemMessage: `delta4c-dev: la compuerta sigue sin pasar después de ${maxBloqueos} intentos. El trabajo NO está verificado o revisado; revisalo antes de darlo por terminado.`,
  });
}

function bloquear(mensaje) {
  guardar({ bloqueos: (estado.bloqueos || 0) + 1 });
  process.stderr.write(mensaje);
  process.exit(2);
}

function correr(comandos, etapa) {
  for (const comando of comandos) {
    const inicio = Date.now();
    const r = spawnSync(comando, {
      cwd: raiz,
      shell: true,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      timeout: (config.timeoutCompuertaSegundos || 900) * 1000,
      env: { ...process.env, CI: process.env.CI || "1", FORCE_COLOR: "0" },
    });
    if (r.status !== 0) {
      const salida = `${r.stdout || ""}${r.stderr || ""}` || String(r.error || "sin salida");
      bloquear(
        `Compuerta (${etapa}): \`${comando}\` falló (exit ${r.status ?? "timeout"}, ${Math.round((Date.now() - inicio) / 1000)}s). Últimas líneas:\n\n` +
          `${ultimasLineas(salida, 60)}\n\n` +
          "Corregí la causa en el código (no aflojes ni saltees tests) y volvé a verificar. " +
          "Si el fallo no es tuyo o no se puede resolver acá, explicalo y frená.\n",
      );
    }
  }
}

// 1 y 2. Verificación y e2e, una vez por estado del código.
if (actual !== estado.ok) {
  correr(verificar, "verificación");
  if (verificarE2E.length > 0) {
    const tocados = archivosCambiados(raiz, config, estado.baseHead);
    const dispara = disparadoresE2E.length === 0 || tocados.some((a) => disparadoresE2E.some((g) => coincideGlob(a, g)));
    if (dispara) correr(verificarE2E, "e2e");
  }
  guardar({ ok: actual });
}

// 3. Revisión independiente para cambios grandes.
if (minLineasRevision) {
  const total = lineasCambiadas(raiz, config, estado.baseHead);
  if (total >= minLineasRevision) {
    const marca = leerJson(archivoRevision(raiz), null);
    const vigente = marca && marca.fecha >= estado.inicio && total - marca.lineas < minLineasRevision;
    if (!vigente) {
      const marcar = path.join(path.dirname(fileURLToPath(import.meta.url)), "marcar-revision.mjs");
      bloquear(
        `Compuerta (revisión): esta sesión cambió ${total} líneas de código${marca && marca.fecha >= estado.inicio ? " desde la última revisión" : ""} y el repo exige revisión independiente desde ${minLineasRevision}.\n\n` +
          "Corré la skill delta4c-dev:revision sobre los cambios de la sesión" +
          (estado.baseHead ? ` (rango ${estado.baseHead.slice(0, 12)}..árbol de trabajo)` : "") +
          ". Corregí los problemas confirmados, volvé a verificar y registrá la revisión con:\n\n" +
          `  node "${marcar}"\n`,
      );
    }
  }
}

guardar({ bloqueos: 0 });
process.exit(0);
