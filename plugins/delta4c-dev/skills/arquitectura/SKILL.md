---
name: arquitectura
description: Define o revisa la arquitectura, el stack y la estructura de un proyecto o de un módulo grande, y la deja escrita en docs/arquitectura.md y en ADRs. Usar al arrancar un proyecto, al sumar un módulo o integración grande, al elegir tecnología, cuando se discute cómo escalar (horizontal o vertical), o cuando pidan "definí la arquitectura", "qué stack usamos", "cómo lo estructuramos".
argument-hint: "[proyecto o módulo]"
---

# Arquitectura, stack y estructura

La arquitectura la decide una persona; vos la hacés explícita, comparás opciones con criterio y la dejás escrita para que cualquier sesión futura la respete. Nada de esto se improvisa en medio de una implementación.

Material de apoyo en `${CLAUDE_PLUGIN_ROOT}/skills/arquitectura/`: `plantilla-arquitectura.md`, `plantilla-adr.md` y `escalabilidad.md`.

## 1. Relevar antes de preguntar

- Si el repo existe: leé `CLAUDE.md`/`AGENTS.md`, `docs/`, el manifiesto de dependencias y la estructura de carpetas (usá el agente `delta4c-dev:investigador` si el repo es grande). Anotá el stack real, los patrones que ya se usan y las inconsistencias.
- Si hay `docs/arquitectura.md` o ADRs, partí de ahí: esto es una revisión, no una hoja en blanco.

## 2. Entrevistar (AskUserQuestion, de a 2–4 preguntas)

Solo lo que no se pueda deducir. Cubrí:

1. **Negocio y usuarios**: quién lo usa, cuántos (hoy y en 12 meses), picos esperables, criticidad (qué pasa si se cae una hora).
2. **Datos**: qué se guarda, si hay datos personales o de organismos públicos, multi-cliente (tenants) o no, retención, reportes.
3. **Integraciones**: ERPs, pagos, WhatsApp, APIs de terceros; síncronas o por colas/webhooks.
4. **Restricciones**: hosting disponible (VPS, Hostinger, cloud), presupuesto mensual, quién lo mantiene, stack que el equipo ya domina, plazos.
5. **Requisitos no funcionales**: latencia, disponibilidad, auditoría, compliance (por ejemplo ISO 27001), accesibilidad, offline/móvil.

## 3. Proponer con opciones, no con una sola respuesta

Para cada decisión importante (lenguaje y framework, base de datos, estilo de arquitectura, hosting, autenticación, colas, frontend) presentá 2–3 opciones en una tabla: qué es, a favor, en contra, costo de operar, y tu recomendación con el porqué. Criterios por defecto para un equipo chico:

- **Estilo**: monolito modular con vertical slices (cada feature en su carpeta con UI, lógica, datos y tests) sobre un **esqueleto** común definido por humanos: auth, acceso a datos, manejo de errores, logging, design tokens. Microservicios solo con equipos independientes o escalado muy dispar entre partes.
- **Stack**: el que el equipo ya domina gana salvo razón fuerte. Tipado estricto siempre (TypeScript strict, tipos en PHP, Pydantic).
- **Escritura de datos por un solo camino** (acciones o servicios de aplicación), usado por UI, API y agentes por igual.
- **Lógica fuera de los componentes de UI**, en módulos puros testeables.
- **Escalado**: decidilo con `escalabilidad.md` y dejalo como ADR. Default: escala vertical, pero sin estado en memoria desde el día uno para poder pasar a horizontal sin reescribir.

## 4. Escribir

1. `docs/arquitectura.md` desde la plantilla: contexto, decisiones, estructura de carpetas, flujo de datos, escalado, seguridad, observabilidad, estrategia de tests. Con un diagrama Mermaid de componentes.
2. Un ADR por decisión importante en `docs/adr/NNNN-titulo.md` (numeración correlativa), desde `plantilla-adr.md`. Un ADR no se edita después de aceptado: si cambia la decisión, se escribe uno nuevo que lo reemplaza.
3. En `CLAUDE.md` (o `AGENTS.md`), una sección corta "Arquitectura" con 3–6 líneas, el archivo ejemplo de cada patrón y un puntero a `docs/arquitectura.md`. No copies el documento entero: CLAUDE.md se carga en cada sesión.
4. Si el repo usa `.claude/delta4c.json`, sumá a `protegidos` lo que la arquitectura declara intocable (migraciones aplicadas, código generado).

## 5. Cerrar

Mostrá el resumen de decisiones y las preguntas abiertas. Las decisiones quedan "Propuestas" hasta que una persona las marque "Aceptadas".
