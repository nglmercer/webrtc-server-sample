# Adaptador SocketIO-like para WebSocket

Este adaptador proporciona una implementación completa que emula las funcionalidades de Socket.IO usando WebSocket nativo y el sistema de eventos personalizado `Emitter`.

## Características Principales

### 🚀 Funcionalidades Implementadas

- ✅ **Eventos personalizados** usando `Emitter`
- ✅ **Registro de usuarios** automático
- ✅ **Sistema de salas** (join/leave)
- ✅ **Broadcast a todos los usuarios**
- ✅ **Broadcast a salas específicas**
- ✅ **Mensajes privados**
- ✅ **Estadísticas del servidor**
- ✅ **Gestión de conexiones** con heartbeat
- ✅ **Compatibilidad con métodos Socket.IO** (on, emit, once, off)
- ✅ **Manejo de errores** robusto
- ✅ **Logging integrado**

### 🔧 API Compatible con Socket.IO

```typescript
// Servidor
wsio.on('connection', (socket) => {
  socket.on('evento', (data) => { /* ... */ });
  socket.emit('respuesta', data);
  socket.join('sala');
  socket.to('sala').emit('mensaje', data);
});

// Cliente (JavaScript)
socket.emit('evento', data);
socket.on('respuesta', (data) => { /* ... */ });
```

## Instalación y Uso

### 1. Importar el Adaptador

```typescript
import { wsio, SocketIOLikeSocket } from './adapters/SocketIOLikeAdapter.js';
```

### 2. Configurar el Servidor

```typescript
// Iniciar servidor en puerto 8080
wsio.listen(8080, () => {
  console.log('Servidor iniciado en puerto 8080');
});

// Manejar conexiones
wsio.on('connection', (socket: SocketIOLikeSocket) => {
  console.log(`Cliente conectado: ${socket.id}`);
  
  // Eventos del socket
  socket.on('mensaje', (data) => {
    console.log('Mensaje recibido:', data);
  });
  
  socket.on('disconnect', () => {
    console.log(`Cliente desconectado: ${socket.id}`);
  });
});
```

### 3. Cliente HTML/JavaScript

```html
<script>
  const socket = new WebSocket('ws://localhost:8080');
  
  socket.onopen = () => {
    // Enviar evento al servidor
    socket.send(JSON.stringify({
      event: 'mensaje',
      payload: ['Hola servidor!']
    }));
  };
  
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Evento recibido:', data.event, data.payload);
  };
</script>
```

## Métodos del Socket

### Eventos

```typescript
// Escuchar eventos
socket.on('evento', (data) => { /* ... */ });
socket.once('evento', (data) => { /* ... */ }); // Solo una vez
socket.off('evento', callback); // Remover listener

// Emitir eventos
socket.emit('evento', data1, data2, ...); // Al cliente
```

### Salas

```typescript
// Unirse a una sala
socket.join('sala1');

// Salir de una sala
socket.leave('sala1');

// Obtener salas del socket
const salas = socket.getRooms();

// Emitir a una sala específica
socket.to('sala1').emit('mensaje', data);

// Broadcast (excluye al remitente)
socket.broadcast.emit('mensaje', data);
socket.broadcast.to('sala1').emit('mensaje', data);
```

### Información de Conexión

```typescript
// Verificar si está conectado
const isAlive = socket.isAlive();

// Obtener información detallada
const info = socket.getConnectionInfo();
// Retorna: { id, isConnected, readyState, lastActivity, connectionDuration, rooms }

// Ping manual
socket.ping();
```

## Métodos del Servidor

### Broadcast

```typescript
// Broadcast a todos los usuarios
wsio.emit('anuncio', 'Mensaje para todos');

// Broadcast a todos excepto uno
wsio.broadcastToAll('evento', [data], excludeSocketId);

// Broadcast a una sala específica
wsio.broadcastToRoom('sala1', 'evento', [data], excludeSocketId);
```

### Gestión de Usuarios

```typescript
// Obtener usuario por ID
const user = wsio.getUser(socketId);

// Obtener usuarios en una sala
const users = wsio.getUsersInRoom('sala1');

// Estadísticas del servidor
const stats = wsio.getStats();
// Retorna: { totalUsers, totalRooms, users, rooms }
```

### Control del Servidor

```typescript
// Cerrar servidor
wsio.close(() => {
  console.log('Servidor cerrado');
});
```

## Eventos del Sistema

### Eventos del Socket

- `connection` - Nueva conexión establecida
- `disconnect` - Cliente desconectado
- `error` - Error en la conexión
- `ping`/`pong` - Heartbeat nativo de WebSocket

### Eventos Personalizados (Ejemplos)

- `join-room` - Unirse a una sala
- `leave-room` - Salir de una sala
- `chat-message` - Mensaje de chat
- `private-message` - Mensaje privado
- `get-stats` - Solicitar estadísticas
- `global-broadcast` - Broadcast global

## Ejemplo Completo

### Servidor

```typescript
import { wsio } from './adapters/SocketIOLikeAdapter.js';

wsio.listen(8080);

wsio.on('connection', (socket) => {
  // Bienvenida
  socket.emit('welcome', { message: 'Bienvenido!', id: socket.id });
  
  // Chat en sala
  socket.on('join-room', ({ room, username }) => {
    socket.join(room);
    socket.to(room).emit('user-joined', { username, room });
  });
  
  socket.on('chat-message', ({ room, message, username }) => {
    wsio.broadcastToRoom(room, 'chat-message', [{ username, message, timestamp: Date.now() }]);
  });
  
  // Mensaje privado
  socket.on('private-message', ({ targetId, message }) => {
    const target = wsio.getUser(targetId);
    if (target) {
      target.socket.emit('private-message', { from: socket.id, message });
    }
  });
});
```

### Cliente

```javascript
const socket = new WebSocket('ws://localhost:8080');

function sendEvent(event, ...payload) {
  socket.send(JSON.stringify({ event, payload }));
}

socket.onmessage = (event) => {
  const { event: eventName, payload } = JSON.parse(event.data);
  
  switch (eventName) {
    case 'welcome':
      console.log('Conectado:', payload[0]);
      break;
    case 'chat-message':
      console.log('Mensaje:', payload[0]);
      break;
  }
};

// Unirse a sala
sendEvent('join-room', { room: 'general', username: 'Usuario1' });

// Enviar mensaje
sendEvent('chat-message', { room: 'general', message: 'Hola!', username: 'Usuario1' });
```

## Archivos Incluidos

1. **`SocketIOLikeAdapter.ts`** - Adaptador principal
2. **`socketio_server.ts`** - Servidor de ejemplo con eventos
3. **`socketio-client-example.html`** - Cliente web de prueba
4. **`SOCKETIO_ADAPTER.md`** - Esta documentación

## Ejecutar el Ejemplo

```bash
# Compilar TypeScript (si es necesario)
npx tsc

# Ejecutar servidor
node dist/socketio_server.js

# Abrir cliente en navegador
# Abrir examples/socketio-client-example.html
```

## Diferencias con Socket.IO Original

### ✅ Implementado
- Eventos personalizados
- Sistema de salas
- Broadcast
- Namespaces básicos
- Heartbeat (ping/pong)
- Manejo de errores

### ❌ No Implementado (pero puede añadirse)
- Middlewares
- Autenticación automática
- Reconexión automática
- Compresión de mensajes
- Transporte HTTP long-polling
- Namespaces avanzados

## Ventajas

- 🚀 **Rendimiento**: WebSocket nativo sin overhead
- 🔧 **Personalizable**: Código fuente disponible
- 📦 **Ligero**: Sin dependencias pesadas
- 🎯 **Específico**: Adaptado a necesidades exactas
- 🔍 **Debuggeable**: Logging integrado

## Casos de Uso

- Chat en tiempo real
- Notificaciones push
- Colaboración en tiempo real
- Gaming multijugador
- Dashboards en vivo
- Streaming de datos

---

**Nota**: Este adaptador está diseñado para ser una alternativa ligera y personalizable a Socket.IO, manteniendo la compatibilidad de API más importante mientras usa WebSocket nativo para mejor rendimiento.