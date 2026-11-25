---
name: revision
description: Revisión del diff con revisores en contexto limpio (código, seguridad y UI) y validación de cada hallazgo grave antes de reportarlo. Usar antes de abrir un PR o de dar una tarea por terminada, o cuando pidan "revisá", "revisión", "code review" o "¿está listo para merge?".
argument-hint: "[rango git o PR] [ruta de la spec]"
---

# Revisión en capas

Objetivo: que lo que llegue a la persona que revisa ya haya pasado una revisión independiente, sin ruido. Un revisor al que le piden problemas siempre encuentra alguno; por eso acá solo cuentan los que rompen correctitud o requisitos, y los graves se validan dos veces.

## 1. Delimitar qué se revisa

- Si `$ARGUMENTS` trae un rango (`origin/main...HEAD`) o un número de PR (`gh pr diff <n>`), usalo.
- Si no: rama actual contra su base (`git merge-base HEAD origin/main`) más los cambios sin commitear.
- Corré `git diff --stat` sobre el rango. Si está vacío, decilo y terminá.
- Buscá la spec o el plan: lo que venga en `$ARGUMENTS`, o el archivo más reciente en `docs/superpowers/specs/`, `docs/superpowers/plans/`, `specs/` o `SPEC.md` que corresponda a esta rama. Si no hay, se revisa contra las reglas del repo.

## 2. Elegir revisores (según el diff, para no gastar de más)

| Revisor | Cuándo |
| --- | --- |
| `delta4c-dev:revisor-codigo` | Siempre |
| `delta4c-dev:revisor-seguridad` | El diff toca auth, permisos, endpoints, webhooks, SQL u ORM, subida de archivos, integraciones externas, `.env.example`, dependencias, o supera ~200 líneas |
| `delta4c-dev:revisor-ui` | El diff toca `.tsx`, `.jsx`, `.vue`, `.svelte`, `.blade.php`, `.css` o `.html` |

Un diff chico (menos de ~30 líneas) y sin riesgo: solo `revisor-codigo`.

## 3. Lanzar en paralelo

Lanzá todos los revisores elegidos **en un solo mensaje** para que corran en paralelo. A cada uno pasale: el rango exacto, la ruta de la spec, la URL del servidor de desarrollo si está corriendo (solo a `revisor-ui`) y esta instrucción: «Reportá solo; no edites archivos».

## 4. Validar lo grave

Para cada hallazgo **crítico o alto**, lanzá un subagente nuevo (`delta4c-dev:revisor-codigo`, o `revisor-seguridad` si es de seguridad) que reciba solo el hallazgo, el rango y la spec, con la consigna: «Confirmá o refutá este hallazgo con evidencia del código. Respondé CONFIRMADO o REFUTADO y por qué». Lanzalos en paralelo. Descartá los refutados; los dudosos bajan a media.

## 5. Reportar

```
Veredicto: Listo para merge | Requiere atención | Requiere trabajo
Revisado: <rango> contra <spec o "reglas del repo"> · revisores: <lista>

Problemas (confirmados, de mayor a menor)
1. [crítica|alta|media] ruta:línea — qué y por qué · arreglo sugerido

Sugerencias (opcionales, máximo 5)
- …

Sin revisar: …
```

Los revisores sin hallazgos van en una línea cada uno.

## 6. Después

- Si la persona pidió revisar, entregá el reporte y no toques código.
- Si estás en medio de implementar una tarea, corregí los problemas confirmados, volvé a correr la verificación del proyecto y repetí la revisión solo sobre lo que cambió. Las sugerencias se aplican solo si son baratas y no amplían el alcance.
