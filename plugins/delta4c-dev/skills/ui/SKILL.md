---
name: ui
description: Estándar de frontend, UX y UI de Delta 4C (design tokens, estados, accesibilidad WCAG 2.2 AA, responsive, formularios, contenido, performance y dirección visual). Usar al crear o cambiar pantallas, componentes, estilos o flujos de usuario, en cualquier framework.
---

# Frontend, UX y UI

## Antes de escribir

1. Buscá el design system del repo: archivo de tokens (CSS variables, `tailwind.config`, `theme.ts`), carpeta de componentes compartidos y una pantalla parecida que sirva de ejemplo. Seguilos; no inventes estilos nuevos.
2. Si hay diseño de referencia (captura, Figma), trabajá contra él. Si no, decidí una dirección visual explícita antes de codear: tipografía, escala de espaciado, color de acento, densidad. Nada de "look genérico" (gradientes violetas por defecto, todo centrado, sombras gruesas).
3. Escribí el texto real de la pantalla (títulos, botones, errores, estados vacíos) en el idioma y tono del producto.

## Reglas

**Tokens y componentes**
- Colores, espaciados, radios, sombras y tipografías salen de tokens. Ningún valor suelto (`#3b82f6`, `13px`) en componentes.
- Reutilizá antes de crear. Un componente nuevo compartido va a la carpeta de UI compartida con sus variantes.

**Estados (todos, en cada componente interactivo)**
- default, hover, focus visible, activo, deshabilitado, cargando, error, vacío y éxito.
- Listas y tablas: estado vacío con acción sugerida, carga con skeleton y error con reintento.

**Accesibilidad (WCAG 2.2 AA)**
- Elementos interactivos reales: `button` para acciones, `a` para navegación. Nada de `div` con `onClick`.
- Cada input con `label` asociado; errores ligados al campo (`aria-describedby`) y anunciados.
- Foco visible y orden lógico; modales que atrapan y devuelven el foco; todo usable con teclado.
- Contraste mínimo 4.5:1 en texto y 3:1 en componentes; nada que dependa solo del color.
- Imágenes con `alt` útil, o vacío si son decorativas. Áreas táctiles de al menos 24×24 px (44 recomendado).

**Responsive**
- Mobile first. Probar a 375, 768 y 1280 px. Sin scroll horizontal; tablas anchas con scroll propio o vista de tarjetas.

**Formularios**
- Validación en el cliente para UX y siempre en el servidor. Mensajes que dicen cómo corregir.
- No borrar lo que la persona escribió si falla el envío. Botón deshabilitado y con indicador mientras envía.

**Lógica y datos**
- Lógica de pantalla fuera del componente, en un módulo puro y testeable (si el repo usa `modelo.ts` u otro patrón, ese).
- Formatos locales: fechas `dd/mm/aaaa`, moneda con separador de miles y coma decimal si el producto es para Argentina.

**Performance**
- Imágenes con tamaño explícito y formato moderno; carga diferida debajo del pliegue.
- No traer librerías pesadas para algo chico. Vigilar el tamaño del bundle si el repo tiene presupuesto.

## Verificar

- Si el repo tiene lint de accesibilidad (`eslint-plugin-jsx-a11y` o similar) y axe en los e2e, tienen que pasar.
- Captura del resultado a 375 y 1280 px, comparada con el diseño; corregí las diferencias.
- Para revisar con ojos frescos: agente `delta4c-dev:revisor-ui`.
