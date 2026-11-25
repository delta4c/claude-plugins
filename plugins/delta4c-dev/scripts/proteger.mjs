// PreToolUse (Edit|Write|NotebookEdit|Bash): niega lo que nunca debería hacer un agente.
// Siempre activo, con o sin `.claude/delta4c.json`. Lo que bloquea lo puede hacer una persona a mano.
import path from "node:path";
import { coincideGlob, leerConfig, leerEntrada, negar, raizProyecto, rutaRelativa } from "./lib.mjs";

const entrada = await leerEntrada();
const herramienta = entrada.tool_name || "";
const datos = entrada.tool_input || {};
const raiz = raizProyecto(entrada);

const PLANTILLAS_ENV = /^\.env\.(example|sample|template|dist)$/;

/** Motivo por el que un archivo no se edita, o null. */
function motivoArchivo(rutaRel, protegidos) {
  const nombre = path.posix.basename(rutaRel);
  if (/^\.env(\..+)?$/.test(nombre) && !PLANTILLAS_ENV.test(nombre)) {
    return `${rutaRel} guarda secretos: los agentes no lo editan. Si hace falta una variable nueva, agregala a .env.example y avisá para que una persona cargue el valor.`;
  }
  if (/\.(pem|key|p12|pfx|jks|keystore)$/i.test(nombre) || /^id_(rsa|ed25519|ecdsa)/.test(nombre)) {
    return `${rutaRel} es una clave o certificado: los agentes no lo tocan.`;
  }
  for (const patron of protegidos) {
    if (coincideGlob(rutaRel, patron)) {
      return `${rutaRel} está protegido por .claude/delta4c.json («${patron}»). No se edita: creá un archivo nuevo (por ejemplo, una migración nueva) o pedile a una persona que lo cambie.`;
    }
  }
  return null;
}

/** Motivo por el que un comando no corre, o null. */
function motivoComando(comando) {
  // Los flags se buscan fuera de comillas, para que un mensaje de commit que menciona «--no-verify» no se bloquee.
  const sinComillas = comando.replace(/'[^']*'|"[^"]*"/g, '""');
  // Se analiza cada tramo separado por ; && || | para no confundir un comando con el siguiente.
  for (const tramo of sinComillas.split(/;|&&|\|\||\|/)) {
    const t = tramo.trim();
    if (/\bgit\s+push\b/.test(t)) {
      const fuerza =
        /(^|\s)--force(\s|=|$)/.test(t) ||
        /(^|\s)-(?!-)[a-zA-Z]*f[a-zA-Z]*(\s|$)/.test(t) ||
        /(^|\s)\+\S+/.test(t.replace(/^.*?\bpush\b/, ""));
      if (fuerza) {
        return "Push forzado bloqueado: reescribe historia compartida. Usá `git push --force-with-lease` si de verdad hace falta, o pedíselo a una persona.";
      }
    }
    if (/\bgit\s+(commit|push|merge|rebase)\b/.test(t) && /(^|\s)--no-verify(\s|$)/.test(t)) {
      return "--no-verify saltea las compuertas del repo (lint, typecheck, secretos, tests). Corregí lo que falla en vez de saltearlo.";
    }
    if (/(^|\s)(LEFTHOOK|HUSKY)=0(\s|$)/.test(t)) {
      return "Desactivar los git hooks (LEFTHOOK=0 / HUSKY=0) saltea las compuertas del repo. Corregí lo que falla en vez de saltearlo.";
    }
    if (/(^|\s)PERMITIR_TESTS=/.test(t)) {
      return "PERMITIR_TESTS es la salida de emergencia de assert-skip-check y la decide una persona, no un agente. Explicá por qué el test estaría mal y frená.";
    }
  }
  // Rutas: se miran con las comillas puestas (`rm -rf "/"`, `cat ".env"`).
  for (const tramo of comando.split(/;|&&|\|\||\|/)) {
    const t = tramo.trim();
    if (/\brm\s+(-[a-zA-Z]*\s+)*-[a-zA-Z]*r[a-zA-Z]*\s+(-[a-zA-Z]+\s+)*("|')?(\/|~|\$HOME)("|')?(\/\*?)?(\s|$)/.test(t)) {
      return "Borrado recursivo de la raíz o del home bloqueado.";
    }
    if (
      /(^|\s)(cat|less|more|head|tail|bat|nl|strings|xxd|od)\s/.test(t) &&
      /(^|[\s/'"])\.env(\.[\w-]+)?(['"]|\s|$)/.test(t) &&
      !/\.env\.(example|sample|template|dist)\b/.test(t)
    ) {
      return "Leer un .env vuelca secretos en la conversación. Mirá .env.example para saber qué variables existen.";
    }
  }
  return null;
}

if (herramienta === "Bash") {
  const motivo = motivoComando(String(datos.command || ""));
  if (motivo) negar(motivo);
} else if (["Edit", "Write", "NotebookEdit"].includes(herramienta)) {
  const ruta = datos.file_path || datos.notebook_path;
  if (ruta) {
    const config = leerConfig(raiz);
    const protegidos = Array.isArray(config.protegidos) ? config.protegidos : [];
    const motivo = motivoArchivo(rutaRelativa(raiz, ruta), protegidos);
    if (motivo) negar(motivo);
  }
}
process.exit(0);
