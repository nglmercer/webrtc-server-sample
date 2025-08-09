# Documentación del Servidor de Señalización WebRTC

## Índice

1. [Introducción](#introducción)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Componentes Principales](#componentes-principales)
4. [Flujo de Comunicación](#flujo-de-comunicación)
5. [API y Eventos](#api-y-eventos)
6. [Implementación de Ejemplo](#implementación-de-ejemplo)
7. [Tareas Pendientes y Mejoras](#tareas-pendientes-y-mejoras)

## Introducción

Este proyecto implementa un servidor de señalización para WebRTC (Web Real-Time Communication) que facilita la comunicación en tiempo real entre navegadores. El servidor actúa como intermediario para el intercambio de metadatos necesarios para establecer conexiones peer-to-peer, pero no transmite el contenido multimedia en sí.

El servidor de señalización proporciona las siguientes funcionalidades:

- Gestión de usuarios con IDs únicos
- Creación y administración de salas (rooms)
- Protección de salas con contraseñas
- Listado de salas públicas
- Verificación de presencia de usuarios y salas
- Transmisión de mensajes de señalización (SDP, ICE candidates)
- Soporte para eventos personalizados

## Arquitectura del Sistema

```
┌─────────────┐                ┌──────────────────┐
│  Cliente A  │◄──────────────►│  Signaling Server│
└─────────────┘   WebSocket    │                  │
                               └──────┬───────────┘
                                      │
                               ┌──────┴───────────┐
                               │  Cliente B / N   │
                               └──────────────────┘
```

El sistema sigue una arquitectura modular con los siguientes componentes:

1. **Servidor de Señalización**: Núcleo del sistema que gestiona conexiones, salas y mensajes.
2. **Adaptador WebSocket**: Permite utilizar diferentes implementaciones de WebSocket (Socket.IO o WebSocket nativo).
3. **Manejadores de Eventos**: Módulos especializados para gestionar diferentes tipos de eventos (salas, usuarios, mensajes).
4. **Utilidades**: Funciones auxiliares para operaciones comunes.

## Componentes Principales

### SignalingServer (signal_server.ts)

Clase principal que implementa la lógica del servidor de señalización. Mantiene el estado de las salas y usuarios, y proporciona métodos para su gestión.

**Responsabilidades:**
- Manejar nuevas conexiones de clientes
- Mantener el registro de usuarios y salas
- Proporcionar API para gestionar salas y usuarios

### WebSocketAdapter (WebSocketAdapter.ts)

Adaptador que permite utilizar diferentes implementaciones de WebSocket con la misma interfaz. Actualmente soporta WebSocket nativo (ws) y puede extenderse para otras implementaciones.

**Responsabilidades:**
- Adaptar diferentes implementaciones de WebSocket a una interfaz común
- Manejar la serialización/deserialización de mensajes
- Gestionar eventos de conexión/desconexión

### Manejadores de Eventos

1. **roomHandlers.ts**: Gestiona eventos relacionados con salas (crear, unirse, verificar presencia, etc.)
2. **userHandlers.ts**: Gestiona eventos relacionados con usuarios (actualizar datos, cambiar ID, etc.)
3. **messageHandlers.ts**: Gestiona la transmisión de mensajes de señalización entre usuarios

### Utilidades

1. **roomUtils.ts**: Funciones para gestionar salas (añadir usuarios, cerrar salas, etc.)
2. **userUtils.ts**: Funciones para gestionar usuarios (añadir usuarios, etc.)
3. **socketUtils.ts**: Funciones para gestionar sockets (manejar desconexiones, etc.)

## Flujo de Comunicación

1. **Conexión Inicial**:
   - Cliente se conecta al servidor mediante WebSocket
   - Se asigna un ID único al cliente si no lo proporciona
   - Se registra el usuario en el sistema

2. **Creación/Unión a Sala**:
   - Cliente crea una sala (`open-room`) o se une a una existente (`join-room`)
   - Se verifican permisos, contraseñas y límites de participantes
   - Se notifica a los participantes existentes

3. **Intercambio de Señalización**:
   - Los clientes intercambian mensajes SDP y ICE candidates a través del servidor
   - El servidor reenvía estos mensajes al destinatario correcto

4. **Desconexión**:
   - Cuando un cliente se desconecta, se notifica a los demás participantes
   - Si el propietario de la sala se desconecta, se elige un nuevo propietario o se cierra la sala

## API y Eventos

### Eventos del Cliente al Servidor

| Evento | Descripción |
|--------|-------------|
| `open-room` | Crea una nueva sala |
| `join-room` | Se une a una sala existente |
| `check-presence` | Verifica si una sala existe |
| `get-public-rooms` | Obtiene lista de salas públicas |
| `set-password` | Establece contraseña para una sala |
| `is-valid-password` | Verifica si una contraseña es válida |
| `close-entire-session` | Cierra una sala completa |
| `extra-data-updated` | Actualiza datos adicionales del usuario |
| `get-remote-user-extra-data` | Obtiene datos de otro usuario |
| `changed-uuid` | Cambia el ID del usuario |
| `disconnect-with` | Desconecta de un usuario específico |
| `RTCMultiConnection-Message` | Transmite mensajes de señalización WebRTC |

### Eventos del Servidor al Cliente

| Evento | Descripción |
|--------|-------------|
| `userid-already-taken` | Notifica que el ID de usuario ya está en uso |
| `user-connected` | Notifica que un usuario se ha conectado |
| `user-disconnected` | Notifica que un usuario se ha desconectado |
| `extra-data-updated` | Notifica cambios en los datos de un usuario |
| `user-not-found` | Notifica que un usuario no se ha encontrado |
| `set-isInitiator-true` | Notifica que el usuario es ahora el propietario de la sala |
| `room-closed-by-admin` | Notifica que la sala ha sido cerrada por un administrador |
| `kicked-by-admin` | Notifica que el usuario ha sido expulsado por un administrador |

## Implementación de Ejemplo

### Servidor con Socket.IO (example.js)

```javascript
// Servidor de prueba WebRTC
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { defaultSignal, WebSocketAdapter } from './index';

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
    }
});

app.use(express.static('public'));
const PORT = process.env.PORT || 9001;

io.on('connection', (socket) => {
    console.log(`\n[Server] New user connected with socket ID: ${socket.id}`);

    defaultSignal.handleConnection(socket);
    
    // Monitoreo periódico del estado del servidor
    setInterval(() => {
        console.log('alldata', defaultSignal.getRooms());
        console.log('alldata', defaultSignal.getUsers());
    }, 10000);
    
    socket.on('disconnect', () => {
        console.log(`[Server] User with socket ID ${socket.id} has disconnected.`);
    });
});

httpServer.listen(PORT, () => {
    console.log(`Test server running at http://localhost:${PORT}`);
});
```

### Servidor con WebSocket Nativo (ws.md)

```javascript
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws'; 
import { defaultSignal, WebSocketAdapter } from './index';

const app = express();
const httpServer = http.createServer(app);
app.use(express.static('public'));
const PORT = process.env.PORT || 9001;

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, request) => {
    console.log(`\n[Server] New WebSocket client connected.`);
    const adaptedSocket = new WebSocketAdapter(ws, request);
    defaultSignal.handleConnection(adaptedSocket);
});

setInterval(() => {
    console.log('--- Server State ---');
    console.log('Active Rooms:', defaultSignal.getRooms());
    console.log('Connected Users:', defaultSignal.getUsers());
    console.log('--------------------');
}, 15000);

httpServer.listen(PORT, () => {
    console.log(`✅ Test server with ws running at http://localhost:${PORT}`);
});
```

## API de Gestión Disponible

La clase `SignalingServer` ya incluye métodos públicos para la gestión programática del servidor:

### Métodos de Consulta

```typescript
// Obtener todas las salas activas
const rooms = signalingServer.getRooms();

// Obtener todos los usuarios conectados
const users = signalingServer.getUsers();

// Obtener una sala específica
const room = signalingServer.getRoomById('sala-123');

// Obtener un usuario específico
const user = signalingServer.getUserById('user-456');
```

### Métodos de Administración

```typescript
// Expulsar un usuario del servidor
const success = signalingServer.kickUser('user-456');

// Cerrar una sala y desconectar a todos sus participantes
const closed = signalingServer.closeRoom('sala-123');
```

### Integración con Aplicaciones Web

Estos métodos pueden ser utilizados para crear interfaces de administración:

```javascript
// Ejemplo de integración con Express.js
app.get('/admin/rooms', (req, res) => {
  const rooms = signalingServer.getRooms();
  res.json(rooms);
});

app.post('/admin/kick-user/:userId', (req, res) => {
  const success = signalingServer.kickUser(req.params.userId);
  res.json({ success });
});
```

## Tareas Pendientes y Mejoras

A continuación se detallan las tareas pendientes y mejoras que podrían implementarse en el proyecto:

### API y Funcionalidades

1. **Wrapper HTTP Opcional**:
   - Crear wrapper REST opcional que utilice los métodos de gestión existentes
   - Crear una API para estadísticas y monitoreo del servidor

2. **Emisores y Receptores**:
   - Mejorar la documentación y acceso a los emisores de eventos
   - Implementar más receptores para eventos personalizados

3. **Middlewares**:
   - Añadir soporte para middlewares que permitan personalizar la lógica de autenticación y autorización
   - Implementar middlewares para validación de datos

4. **Gestión de Conexiones**:
   - Mejorar el manejo de cierre de conexiones
   - Implementar reconexión automática
   - Añadir mecanismos de heartbeat para detectar conexiones zombies

### Seguridad

1. **Autenticación y Autorización**:
   - Implementar autenticación mediante tokens JWT
   - Añadir roles y permisos para diferentes tipos de usuarios

2. **Protección contra ataques**:
   - Implementar rate limiting para prevenir ataques de denegación de servicio
   - Añadir validación de origen para prevenir conexiones no autorizadas

### Escalabilidad

1. **Persistencia**:
   - Añadir soporte para almacenar el estado en bases de datos externas
   - Implementar mecanismos de recuperación ante fallos

2. **Clustering**:
   - Permitir que múltiples instancias del servidor compartan estado
   - Implementar balanceo de carga entre instancias

### Monitoreo y Depuración

1. **Logging**:
   - Mejorar el sistema de logs para facilitar la depuración
   - Añadir niveles de log configurables

2. **Métricas**:
   - Implementar recolección de métricas de rendimiento
   - Crear dashboard para visualizar el estado del servidor

### Documentación

1. **Ejemplos**:
   - Añadir más ejemplos de uso para diferentes escenarios
   - Crear tutoriales paso a paso

2. **Referencia de API**:
   - Completar la documentación de todos los métodos y eventos
   - Generar documentación automática a partir de los comentarios del código

### Pruebas

1. **Pruebas Unitarias**:
   - Aumentar la cobertura de pruebas unitarias
   - Implementar pruebas para todos los componentes

2. **Pruebas de Integración**:
   - Crear pruebas que verifiquen la interacción entre componentes
   - Implementar pruebas de carga y estrés

### Compatibilidad

1. **Soporte para más implementaciones de WebSocket**:
   - Añadir adaptadores para otras bibliotecas de WebSocket
   - Mejorar la compatibilidad con diferentes navegadores y clientes

2. **Versiones de Node.js**:
   - Garantizar compatibilidad con diferentes versiones de Node.js
   - Documentar requisitos mínimos