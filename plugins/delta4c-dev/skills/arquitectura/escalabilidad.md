# Escalabilidad: decisión y checklist

## Elegir

| Señal | Vertical (más recursos a una instancia) | Horizontal (más instancias) |
| --- | --- | --- |
| Usuarios | Internos o pocos cientos | Miles, tráfico público |
| Carga | Estable | Variable o con picos |
| Disponibilidad | Se tolera una ventana de mantenimiento | No se puede caer en deploys |
| Equipo y presupuesto | Chico, un servidor | Puede operar balanceador, varias instancias, colas |

Default para Delta 4C: **vertical, pero escrito como si fuera horizontal**. Pasar después cuesta configuración, no reescritura.

## Requisitos siempre (permiten pasar a horizontal)

- [ ] Sin estado en memoria entre requests: sesiones, caché y rate limiting en Redis o en la base.
- [ ] Archivos subidos en almacenamiento de objetos (S3 o compatible), no en el disco del servidor.
- [ ] Jobs programados que no se dupliquen si hay dos instancias (lock en base o Redis, o un único worker).
- [ ] Trabajo lento (emails, PDFs, integraciones) en colas con reintentos, fuera del request.
- [ ] Jobs y webhooks idempotentes (clave de idempotencia o upsert).
- [ ] Configuración por variables de entorno; nada atado a una máquina.
- [ ] Health check y apagado prolijo (terminar requests en curso).

## Requisitos de eficiencia (escalado vertical)

- [ ] Sin consultas N+1: eager loading o consultas armadas.
- [ ] Índices para cada filtro y orden frecuentes; revisar con EXPLAIN las consultas lentas.
- [ ] Paginación en todo listado (cursor para listas grandes).
- [ ] Caché de lecturas caras con invalidación explícita.
- [ ] Sin operaciones bloqueantes en el hilo del request (I/O síncrono, CPU pesada).
- [ ] Pool de conexiones a la base dimensionado.

## Escalar el desarrollo con Claude Code

- **Horizontal (más trabajo en paralelo)**: `claude --worktree <nombre>` por tarea independiente; `/batch` para cambios mecánicos en muchos archivos; subagentes con `isolation: worktree`. El límite real es cuánto puede revisar una persona.
- **Vertical (tareas más largas)**: spec cerrada con condición de fin verificable, compuerta activa, Opus solo para diseño y Sonnet para implementar.
