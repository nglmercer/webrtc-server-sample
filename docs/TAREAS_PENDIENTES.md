# Tareas Pendientes

Este documento detalla las tareas pendientes y mejoras propuestas para el servidor de señalización WebRTC. Está organizado por categorías de prioridad y complejidad para facilitar la planificación del desarrollo.

## Índice

1. [Prioridad Alta](#prioridad-alta)
2. [Prioridad Media](#prioridad-media)
3. [Prioridad Baja](#prioridad-baja)
4. [Mejoras Futuras](#mejoras-futuras)
5. [Documentación](#documentación)

## Prioridad Alta

Estas tareas son críticas para la estabilidad y funcionalidad básica del servidor.

### Wrapper HTTP/REST para Métodos de Gestión

- **Descripción**: Crear un wrapper HTTP opcional que exponga los métodos de gestión existentes de la clase SignalingServer a través de endpoints REST.
- **Complejidad**: Baja-Media
- **Archivos afectados**: Nuevos archivos en `/src/http-wrapper/` (opcional)
- **Detalles**:
  - La librería ya incluye métodos de gestión en `SignalingServer`: `getRooms()`, `getUsers()`, `kickUser()`, `closeRoom()`, etc.
  - Crear wrapper HTTP opcional que utilice estos métodos existentes
  - Implementar middleware de autenticación para el wrapper
  - **Nota**: La librería está diseñada para WebSocket, el wrapper REST sería una funcionalidad adicional opcional

### Mejora del Manejo de Desconexiones

- **Descripción**: Mejorar la detección y gestión de desconexiones abruptas.
- **Complejidad**: Media
- **Archivos afectados**: `src/utils/socketUtils.ts`
- **Detalles**:
  - Implementar mecanismo de heartbeat para detectar conexiones zombies
  - Mejorar la limpieza de recursos cuando un usuario se desconecta
  - Añadir reconexión automática con recuperación de estado

### Sistema de Middlewares para WebSocket

- **Descripción**: Añadir soporte para middlewares que permitan personalizar la lógica de autenticación y autorización en conexiones WebSocket.
- **Complejidad**: Alta
- **Archivos afectados**: `src/signaling_server.ts`, `src/signal_server.ts`
- **Detalles**:
  - Crear sistema de middlewares para eventos WebSocket
  - Implementar middleware de autenticación para conexiones
  - Añadir middleware para validación de datos en tiempo real
  - Permitir interceptar y modificar eventos antes de su procesamiento

## Prioridad Media

Estas tareas mejoran significativamente la funcionalidad pero no son críticas para la operación básica.

### Soporte para Persistencia

- **Descripción**: Añadir soporte para almacenar el estado en bases de datos externas.
- **Complejidad**: Alta
- **Archivos afectados**: Nuevos archivos en `/src/storage/`
- **Detalles**:
  - Crear interfaces para diferentes backends de almacenamiento
  - Implementar adaptadores para MongoDB, Redis, etc.
  - Añadir mecanismos de recuperación ante fallos

### Mejora del Sistema de Logs

- **Descripción**: Mejorar el sistema de logs para facilitar la depuración.
- **Complejidad**: Baja
- **Archivos afectados**: `src/pushLogs.ts`
- **Detalles**:
  - Añadir niveles de log configurables (debug, info, warn, error)
  - Implementar rotación de logs
  - Añadir soporte para servicios de log externos

### Implementación de Métricas

- **Descripción**: Recolectar y exponer métricas de rendimiento.
- **Complejidad**: Media
- **Archivos afectados**: Nuevos archivos en `/src/metrics/`
- **Detalles**:
  - Recolectar métricas de conexiones, salas, mensajes, etc.
  - Exponer métricas en formato Prometheus
  - Crear dashboard para visualizar el estado del servidor

## Prioridad Baja

Estas tareas son mejoras que pueden esperar a futuras versiones.

### Soporte para WebTransport

- **Descripción**: Añadir soporte para WebTransport como alternativa a WebSocket.
- **Complejidad**: Alta
- **Archivos afectados**: Nuevos archivos en `/src/adapters/`
- **Detalles**:
  - Crear adaptador para WebTransport
  - Implementar compatibilidad con la API existente
  - Añadir ejemplos de uso

### Implementación de Salas Efímeras

- **Descripción**: Añadir soporte para salas que se eliminan automáticamente después de un tiempo de inactividad.
- **Complejidad**: Baja
- **Archivos afectados**: `src/utils/roomUtils.ts`
- **Detalles**:
  - Implementar temporizador de inactividad para salas
  - Añadir configuración para tiempo de vida de salas
  - Notificar a los usuarios antes de eliminar una sala

### Soporte para Grabación

- **Descripción**: Añadir soporte para grabar sesiones WebRTC en el servidor.
- **Complejidad**: Alta
- **Archivos afectados**: Nuevos archivos en `/src/recording/`
- **Detalles**:
  - Implementar servidor de grabación
  - Añadir API para iniciar/detener grabación
  - Implementar almacenamiento y gestión de grabaciones

## Mejoras Futuras

Estas son ideas para futuras versiones que requieren investigación adicional.

### Implementación de SFU

- **Descripción**: Implementar un Selective Forwarding Unit para mejorar la escalabilidad de las videoconferencias.
- **Complejidad**: Muy Alta
- **Detalles**:
  - Investigar opciones de SFU existentes
  - Integrar SFU con el servidor de señalización
  - Implementar lógica de enrutamiento de medios

### Soporte para E2E Encryption

- **Descripción**: Añadir soporte para cifrado de extremo a extremo en las comunicaciones WebRTC.
- **Complejidad**: Muy Alta
- **Detalles**:
  - Investigar opciones de cifrado compatibles con WebRTC
  - Implementar intercambio seguro de claves
  - Añadir ejemplos de uso

### Federación de Servidores

- **Descripción**: Permitir que múltiples instancias del servidor se comuniquen entre sí para formar una red federada.
- **Complejidad**: Muy Alta
- **Detalles**:
  - Diseñar protocolo de federación
  - Implementar descubrimiento de servidores
  - Añadir enrutamiento de mensajes entre servidores

## Documentación

Estas tareas mejoran la documentación del proyecto.

### Métodos de Gestión Disponibles

- **Descripción**: Documentar mejor los métodos de gestión ya implementados en la clase SignalingServer.
- **Complejidad**: Baja
- **Archivos afectados**: `docs/DOCUMENTACION.md`, `docs/GUIA_IMPLEMENTACION.md`
- **Detalles**:
  - Documentar métodos existentes: `getRooms()`, `getUsers()`, `getRoomById()`, `getUserById()`, `kickUser()`, `closeRoom()`
  - Crear ejemplos de uso de estos métodos para administración
  - Explicar cómo integrar estos métodos en aplicaciones externas

### Ejemplos de Uso

- **Descripción**: Ampliar los ejemplos de uso existentes para diferentes escenarios.
- **Complejidad**: Baja
- **Archivos afectados**: `docs/EJEMPLOS_CODIGO.md`, nuevos archivos en `/examples/`
- **Detalles**:
  - Crear ejemplos de administración usando los métodos de SignalingServer
  - Añadir ejemplos de integración con frameworks web
  - Implementar ejemplos de monitoreo y estadísticas

### Documentación de API

- **Descripción**: Completar la documentación de todos los métodos y eventos.
- **Complejidad**: Media
- **Archivos afectados**: Todos los archivos de código fuente
- **Detalles**:
  - Añadir comentarios JSDoc a todas las funciones y clases
  - Generar documentación automática
  - Crear referencia de API en formato web

### Tutoriales

- **Descripción**: Crear tutoriales paso a paso para diferentes casos de uso.
- **Complejidad**: Media
- **Archivos afectados**: Nuevos archivos en `/docs/tutorials/`
- **Detalles**:
  - Crear tutorial para implementación básica
  - Añadir tutorial para integración con frameworks populares (React, Vue, Angular)
  - Implementar tutorial para despliegue en producción

---

## Cómo Contribuir

Si deseas contribuir a alguna de estas tareas, sigue estos pasos:

1. Crea un fork del repositorio
2. Crea una rama para tu tarea (`git checkout -b feature/nombre-tarea`)
3. Implementa los cambios necesarios
4. Asegúrate de que el código pasa las pruebas existentes
5. Añade pruebas para tu nueva funcionalidad si es necesario
6. Envía un pull request

Antes de comenzar a trabajar en una tarea, es recomendable abrir un issue para discutir la implementación y asegurarse de que no hay duplicación de esfuerzos.