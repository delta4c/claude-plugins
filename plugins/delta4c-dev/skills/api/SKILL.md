---
name: api
description: Estándar de backend de Delta 4C (contratos de API, validación, errores, paginación, autorización por recurso, multi-cliente, migraciones, transacciones, jobs, integraciones y observabilidad). Usar al crear o cambiar endpoints, acciones de servidor, modelos de datos, migraciones, webhooks, jobs o integraciones externas.
---

# Backend y APIs

## Antes de escribir

1. Leé cómo lo hace el repo: un endpoint o acción existente parecido, su test, y la capa por la que pasan las escrituras. Seguí ese patrón.
2. Definí el **contrato primero**: entrada, salida, errores y permisos. Si el repo usa OpenAPI, Zod, Pydantic o Form Requests, el contrato va ahí y es la fuente de verdad.

## Reglas

**Contratos**
- Recursos en plural, minúscula y kebab-case en rutas (`/ordenes-de-compra/{id}`); JSON con un único estilo de claves (el del repo).
- Fechas en ISO 8601 con zona horaria; montos como entero en centavos o decimal en string, nunca float.
- Versionado cuando hay clientes externos (`/v1/`); cambios incompatibles = versión nueva.

**Validación**
- Todo input externo (HTTP, webhooks, colas, archivos, respuestas de terceros) se valida con esquema antes de usarse.
- Webhooks: verificar firma y descartar duplicados.

**Errores**
- Formato único (preferido RFC 9457 `application/problem+json`): código estable, mensaje para personas y detalle por campo.
- 400 entrada inválida, 401 sin autenticar, 403 sin permiso, 404 no existe o no es tuyo, 409 conflicto, 422 regla de negocio, 429 límite. Nunca un 500 por un error del cliente.
- Sin stack traces, SQL ni secretos en respuestas o logs.

**Autorización y multi-cliente**
- Cada acción verifica que el usuario puede operar sobre **ese** recurso, no solo que está logueado.
- Si hay varios clientes u organismos, el filtro por cliente se aplica en la capa de datos (scope global, política o RLS), no a mano en cada consulta.

**Listados**
- Siempre paginados (cursor para listas grandes), con límite máximo y orden estable.

**Datos y migraciones**
- Una migración aplicada no se edita: se crea otra.
- Cambios sin downtime en dos pasos (expand/contract): agregar columna nullable → backfill → hacer obligatoria → quitar la vieja.
- Escrituras relacionadas dentro de una transacción; nada de llamadas a terceros dentro de la transacción.
- Índices para cada filtro y orden frecuentes; restricciones de unicidad en la base, no solo en el código.

**Jobs e integraciones**
- Trabajo lento o a terceros en colas, con reintentos con backoff y timeout.
- Todo job y webhook es idempotente.
- Clientes de APIs externas con timeout, reintentos acotados y circuit breaker si la integración es crítica.

**Seguridad**
- Secretos solo por variables de entorno; nuevas variables documentadas en `.env.example`.
- Rate limiting en login, envío de mensajes y endpoints caros.
- Consultas parametrizadas siempre; nada de SQL armado con strings.

**Observabilidad**
- Logs estructurados (JSON) con id de request, usuario y cliente; sin datos personales innecesarios.
- Errores a un tracker (Sentry o similar) con contexto.

## Tests

- Por endpoint o acción: caso feliz, entrada inválida, sin permiso, recurso de otro cliente y conflicto.
- Integración contra una base real (contenedor o base efímera), no mocks del ORM.
- Para revisar seguridad con ojos frescos: agente `delta4c-dev:revisor-seguridad`.
