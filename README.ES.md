# WebRTC Socket API

Un servidor de señalización flexible y basado en salas para WebRTC, construido sobre Node.js y Socket.IO. Este módulo está diseñado para gestionar las conexiones, salas y el intercambio de mensajes necesarios para establecer comunicaciones peer-to-peer (P2P).

Es una solución ideal para aplicaciones de videoconferencia, chats de video, juegos en línea o cualquier sistema que requiera comunicación directa entre clientes.

## ✨ Características

- **Gestión de Salas (Rooms)**: Crea, únete, protege con contraseña y cierra salas de comunicación.
- **Gestión de Usuarios**: Maneja la conexión, desconexión y asignación de identificadores únicos para cada usuario.
- **Presencia de Usuarios y Salas**: Verifica si un usuario está conectado o si una sala existe y está disponible.
- **Transmisión de Mensajes (Signaling)**: Retransmite de forma segura los mensajes de señalización WebRTC (ofertas, respuestas, candidatos ICE) entre pares.
- **Datos Personalizados (`extra`)**: Asocia y sincroniza metadatos personalizados con usuarios y salas.
- **Salas Públicas**: Permite listar salas públicas basadas en un identificador común.
- **Manejo de Propietarios (Owners)**: Las salas tienen un propietario que puede realizar acciones administrativas, como cerrar la sesión completa.
- **Transferencia de Propiedad**: Si el propietario de una sala se desconecta, la propiedad se transfiere automáticamente a otro participante.
- **Tipado (TypeScript)**: Exporta tipos como `User`, `Room`, y `CustomSocket` para una mejor integración con proyectos de TypeScript.

## 📦 Instalación

```bash
npm install webrtc-socket-api
```
*(Nota: El nombre del paquete `webrtc-socket-api` se asume basado en la URL de npm proporcionada).*

## 🚀 Uso y Ejemplo

### 1. Lado del Servidor (Server-side)

Configura un servidor básico con `Express` y `Socket.IO`, y luego integra `signaling_server`.

`server.js`
```javascript
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
// Asegúrate de que la ruta de importación coincida con la estructura de tu proyecto
const { signaling_server } = require('webrtc-socket-api'); 

const app = express();
const server = http.createServer(app);

// Configura Socket.IO con CORS para permitir conexiones desde el cliente
const io = new Server(server, {
  cors: {
    origin: "*", // En producción, especifica tu dominio del cliente
    methods: ["GET", "POST"]
  }
});

// El corazón de la lógica: por cada nueva conexión, se inicializa el manejador de señalización
io.on('connection', (socket) => {
    console.log(`[INFO] Nuevo usuario conectado: ${socket.id}`);
    
    // Pasa el socket recién conectado a tu módulo de señalización
    // El segundo argumento es un objeto de configuración opcional
    signaling_server(socket, { /* config opcional */ });
});

const PORT = process.env.PORT || 9001;
server.listen(PORT, () => {
    console.log(`🚀 Servidor de señalización escuchando en el puerto *:${PORT}`);
});
```

### 2. Lado del Cliente (Client-side)

Este es un ejemplo básico de cómo un cliente se conectaría usando `socket.io-client` para crear y unirse a una sala.

`client.js`
```javascript
import { io } from 'socket.io-client';

const SIGNALING_SERVER_URL = 'http://localhost:9001';
const MY_USER_ID = `user_${Math.floor(Math.random() * 1000)}`;
const ROOM_ID = 'public-room-123';
const MESSAGE_EVENT_NAME = 'RTCMultiConnection-Message'; // Evento de mensajería por defecto

// 1. Conectar al servidor de señalización con parámetros
const socket = io(SIGNALING_SERVER_URL, {
    query: {
        userid: MY_USER_ID,
        sessionid: ROOM_ID,
        extra: JSON.stringify({ name: 'Alice' }) // Datos personalizados
    }
});

// 2. Escuchar eventos del servidor
socket.on('connect', () => {
    console.log(`Conectado al servidor con ID de socket: ${socket.id} y UserID: ${MY_USER_ID}`);
    
    // A. Crear una nueva sala (si eres el primero)
    openRoom(ROOM_ID);
    
    // B. O unirse a una sala existente
    // joinRoom(ROOM_ID);
});

socket.on('user-connected', (remoteUserId) => {
    console.log(`¡Nuevo usuario conectado a la sala!: ${remoteUserId}`);
    // Aquí es donde iniciarías el proceso de negociación de WebRTC con el 'remoteUserId'
    // Por ejemplo, creando una oferta y enviándola.
    sendSignalingMessage(remoteUserId, { sdp: "..." /* tu oferta SDP */ });
});

socket.on('user-disconnected', (remoteUserId) => {
    console.log(`Usuario desconectado: ${remoteUserId}`);
    // Aquí deberías cerrar la conexión PeerConnection asociada a ese usuario.
});

// Escuchar los mensajes de señalización entrantes
socket.on(MESSAGE_EVENT_NAME, (message) => {
    console.log('Mensaje de señalización recibido:', message);
    // Procesa el mensaje (p. ej., setRemoteDescription si es una oferta/respuesta)
});

socket.on('userid-already-taken', (oldUserid, newUserid) => {
    console.warn(`El ID de usuario '${oldUserid}' ya estaba en uso. Se te asignó: '${newUserid}'`);
    // Actualiza tu ID de usuario local si es necesario
});

// 3. Funciones para interactuar con el servidor
function openRoom(roomId) {
    const roomData = {
        sessionid: roomId,
        session: { audio: true, video: true }, // Define el tipo de sesión
        extra: { roomName: 'Sala de Pruebas' } // Datos extra para la sala
    };
    socket.emit('open-room', roomData, (success, error) => {
        if (success) {
            console.log(`Sala '${roomId}' creada exitosamente.`);
        } else {
            console.error(`Error al crear la sala: ${error}`);
        }
    });
}

function joinRoom(roomId) {
    const joinData = {
        sessionid: roomId,
        extra: { name: 'Bob' } // Tus datos como participante
    };
    socket.emit('join-room', joinData, (success, error) => {
        if (success) {
            console.log(`Te uniste a la sala '${roomId}' exitosamente.`);
        } else {
            console.error(`Error al unirse a la sala: ${error}`);
        }
    });
}

// 4. Función para enviar mensajes de señalización a otros usuarios
function sendSignalingMessage(remoteUserId, data) {
    const message = {
        remoteUserId: remoteUserId,
        message: data // payload de WebRTC (SDP, ICE candidate, etc.)
    };
    socket.emit(MESSAGE_EVENT_NAME, message);
    console.log(`Enviando mensaje de señalización a ${remoteUserId}`);
}
```

---

## 📚 Referencia de la API (Eventos de Socket.IO)

### Parámetros de Conexión

Al conectar, el cliente puede pasar los siguientes parámetros en `socket.handshake.query`:

-   `userid` (string): Un ID único para el usuario. Si no se proporciona, el servidor generará uno.
-   `sessionid` (string): Un ID de sesión o sala por defecto.
-   `extra` (string): Una cadena JSON con datos personalizados del usuario.
-   `msgEvent` (string): Opcional. Nombre del evento para los mensajes de señalización. Por defecto: `RTCMultiConnection-Message`.

### Eventos (Cliente → Servidor)

El cliente emite estos eventos para interactuar con el servidor.

| Evento | Argumentos | Callback | Descripción |
| :--- | :--- | :--- | :--- |
| **`open-room`** | `(data: object)` | `(success: boolean, error?: string)` | Crea una nueva sala. `data` debe contener `sessionid`, `session` y `extra`. |
| **`join-room`** | `(data: object)` | `(success: boolean, error?: string)` | Se une a una sala existente. `data` debe contener `sessionid`. |
| **`check-presence`**| `(roomid: string)` | `(isPresent: boolean, roomid: string, extra: any)` | Verifica si una sala existe y tiene participantes. |
| **`get-public-rooms`** | `(identifier: string)` | `(rooms: any[] \| null, error?: string)` | Obtiene una lista de salas públicas marcadas con un `identifier`. |
| **`set-password`** | `(password: string)` | `(success: boolean, roomid: string, error: string)` | Establece una contraseña para la sala que posees. |
| **`is-valid-password`** | `(password: string, roomid: string)` | `(isValid: boolean, roomid: string, error: string)` | Verifica si la contraseña para una sala es correcta. |
| **`close-entire-session`**| `()` | `(success: boolean, error?: string)` | Cierra la sala. Solo el propietario puede hacerlo. |
| **`extra-data-updated`**| `(extra: any)` | - | Actualiza tus datos `extra` y los sincroniza con otros usuarios. |
| **`get-remote-user-extra-data`**| `(remoteUserId: string)` | `(extra: any)` | Obtiene los datos `extra` de un usuario remoto. |
| **`changed-uuid`**| `(newUserId: string)` | `()` | Cambia tu ID de usuario en el servidor. |
| **`disconnect-with`**| `(remoteUserId: string)`| `()` | Desconecta tu enlace con un usuario específico. |
| **`{msgEvent}`** | `(message: object)` | - | Envía un mensaje de señalización. Por defecto, el evento es `RTCMultiConnection-Message`. `message` debe tener `remoteUserId` y `message` (el payload). |

### Eventos (Servidor → Cliente)

El cliente debe escuchar estos eventos emitidos por el servidor.

| Evento | Argumentos | Descripción |
| :--- | :--- | :--- |
| **`userid-already-taken`** | `(oldUserid: string, newUserid: string)` | Se emite si el `userid` solicitado ya está en uso. El servidor asigna uno nuevo. |
| **`user-connected`** | `(remoteUserId: string)` | Notifica que un nuevo usuario se ha unido a la sala y está listo para conectar. |
| **`user-disconnected`** | `(remoteUserId: string)` | Notifica que un usuario se ha desconectado de la sala. |
| **`extra-data-updated`** | `(remoteUserId: string, extra: any)` | Notifica que los datos `extra` de un usuario remoto han sido actualizados. |
| **`set-isInitiator-true`** | `(roomid: string)` | Se emite cuando te conviertes en el nuevo propietario de una sala. |
| **`user-not-found`** | `(remoteUserId: string)` | Se emite si intentaste enviar un mensaje a un usuario que no existe. |
| **`{msgEvent}`** | `(message: object)` | Un mensaje de señalización entrante de otro usuario. |

## TypeScript

Este módulo está escrito con TypeScript en mente y exporta los siguientes tipos para su uso:

```typescript
import { User, Room, CustomSocket, ISocket } from 'webrtc-socket-api';
```

-   `ISocket`: Interfaz genérica para un objeto socket.
-   `CustomSocket`: Extensión de `ISocket` con propiedades específicas como `userid`.
-   `User`: Define la estructura de un objeto de usuario en el servidor.
-   `Room`: Define la estructura de un objeto de sala en el servidor.