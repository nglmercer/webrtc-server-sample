# Integración de SocketIOLikeAdapter

Este documento explica las dos formas de usar `SocketIOLikeServer` en tu aplicación.

## 📋 Métodos Disponibles

### 1. Método `listen()` - Puerto Dedicado

Usa un puerto dedicado exclusivamente para WebSocket.

```typescript
import { SocketIOLikeServer } from '../src/adapters/SocketIOLikeAdapter.js';

const io = new SocketIOLikeServer();

// Escuchar en puerto dedicado
io.listen(8080, () => {
    console.log('Servidor WebSocket en puerto 8080');
});

io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);
    
    socket.on('mensaje', (data) => {
        socket.emit('respuesta', `Echo: ${data}`);
    });
});
```

### 2. Método `attach()` - Servidor HTTP Compartido

Comparte el mismo puerto con un servidor HTTP/Express existente.

```typescript
import express from 'express';
import http from 'http';
import { SocketIOLikeServer } from '../src/adapters/SocketIOLikeAdapter.js';

const app = express();
const server = http.createServer(app);
const io = new SocketIOLikeServer();

// Rutas de Express
app.get('/', (req, res) => {
    res.send('Servidor HTTP + WebSocket');
});

// Adjuntar WebSocket al servidor HTTP
io.attach(server, () => {
    console.log('WebSocket adjuntado al servidor HTTP');
});

io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);
});

// Un solo puerto para HTTP y WebSocket
server.listen(3000, () => {
    console.log('Servidor en http://localhost:3000');
});
```

## 🚀 Ejemplos Prácticos

### Ejecutar Ejemplos

```bash
# Ejemplo con TypeScript (ambos métodos)
node -r ts-node/register examples/adapter-comparison.ts

# Ejemplo con JavaScript (método attach)
node examples/express-integration.js
```

### Ejemplo Completo con Express

Ver `examples/express-integration.js` para un ejemplo completo que incluye:

- ✅ Servidor Express con rutas
- ✅ Archivos estáticos
- ✅ WebSocket integrado
- ✅ Interfaz web de prueba
- ✅ Manejo de salas
- ✅ API REST para estadísticas

## 🔧 Configuración del Cliente

### Cliente WebSocket Nativo

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.onopen = () => {
    console.log('Conectado');
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Recibido:', data);
};

// Enviar mensaje
const message = {
    event: 'mensaje',
    payload: ['Hola servidor']
};
ws.send(JSON.stringify(message));
```

### Cliente HTML Completo

```html
<!DOCTYPE html>
<html>
<head>
    <title>Cliente WebSocket</title>
</head>
<body>
    <div id="messages"></div>
    <input type="text" id="messageInput" placeholder="Mensaje...">
    <button onclick="sendMessage()">Enviar</button>
    
    <script>
        const ws = new WebSocket('ws://localhost:3000');
        
        ws.onmessage = function(event) {
            const data = JSON.parse(event.data);
            document.getElementById('messages').innerHTML += 
                '<div>' + JSON.stringify(data) + '</div>';
        };
        
        function sendMessage() {
            const input = document.getElementById('messageInput');
            const message = {
                event: 'mensaje',
                payload: [input.value]
            };
            ws.send(JSON.stringify(message));
            input.value = '';
        }
    </script>
</body>
</html>
```

## 📊 Comparación de Métodos

| Característica | `listen()` | `attach()` |
|----------------|------------|------------|
| **Puerto** | Dedicado | Compartido |
| **Uso de recursos** | Más puertos | Menos puertos |
| **Integración** | Separado | Con Express |
| **Archivos estáticos** | No incluido | Sí (Express) |
| **APIs REST** | No incluido | Sí (Express) |
| **Complejidad** | Simple | Moderada |
| **Escalabilidad** | Alta | Alta |

## 🎯 Cuándo Usar Cada Método

### Usa `listen()` cuando:
- Necesites un servidor WebSocket puro
- Quieras separar HTTP de WebSocket
- Tengas microservicios especializados
- Requieras máximo rendimiento WebSocket

### Usa `attach()` cuando:
- Tengas una aplicación Express existente
- Quieras servir archivos estáticos
- Necesites APIs REST junto con WebSocket
- Quieras minimizar el número de puertos
- Tengas restricciones de infraestructura

## 🔍 Funcionalidades Avanzadas

### Salas (Rooms)

```typescript
socket.on('join-room', ({ room }) => {
    socket.join(room);
    socket.to(room).emit('user-joined', { socketId: socket.id });
});

socket.on('room-message', ({ room, message }) => {
    io.broadcastToRoom(room, 'room-message', [{ message, from: socket.id }]);
});
```

### Mensajes Privados

```typescript
socket.on('private-message', ({ targetId, message }) => {
    const target = io.getUser(targetId);
    if (target) {
        target.socket.emit('private-message', { from: socket.id, message });
    }
});
```

### Estadísticas del Servidor

```typescript
const stats = io.getStats();
console.log('Usuarios conectados:', stats.totalUsers);
console.log('Salas activas:', stats.totalRooms);
```

## 🛠️ Solución de Problemas

### Error: Puerto en Uso
```bash
# Cambiar puerto o matar proceso
lsof -ti:3000 | xargs kill -9  # macOS/Linux
netstat -ano | findstr :3000   # Windows
```

### Error: Cannot attach to server
- Asegúrate de que el servidor HTTP esté creado antes de attach()
- Verifica que no hayas llamado listen() en el servidor HTTP antes de attach()

### Conexión WebSocket Falla
- Verifica que el puerto esté correcto
- Asegúrate de usar `ws://` (no `wss://` en desarrollo)
- Revisa que no haya firewall bloqueando el puerto

## 📚 Recursos Adicionales

- [Documentación WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Express.js Guide](https://expressjs.com/)
- [Node.js HTTP Module](https://nodejs.org/api/http.html)