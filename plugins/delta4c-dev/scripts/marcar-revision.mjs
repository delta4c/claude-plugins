// Registra que se hizo una revisión independiente (skill delta4c-dev:revision) sobre el estado actual del repo.
// La compuerta no vuelve a exigir revisión hasta que el código cambie otra vez en `minLineas` o más.
// Uso: node marcar-revision.mjs   (desde cualquier carpeta del repo)
import {
  archivoRevision,
  escribirJson,
  estadoMasReciente,
  huella,
  leerConfig,
  lineasCambiadas,
  raizProyecto,
} from "./lib.mjs";

const raiz = raizProyecto({ cwd: process.cwd() });
const config = leerConfig(raiz);
const sesion = estadoMasReciente(raiz);
if (!sesion) {
  console.log("delta4c-dev: no hay una sesión con compuerta activa en este repo; no hace falta registrar la revisión.");
  process.exit(0);
}
const lineas = lineasCambiadas(raiz, config, sesion.estado.baseHead);
escribirJson(archivoRevision(raiz), { fecha: Date.now(), lineas, huella: huella(raiz, config) });
console.log(`delta4c-dev: revisión registrada (${lineas} líneas cambiadas en la sesión).`);
