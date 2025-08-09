# Guía de Implementación del Servidor de Señalización WebRTC

## Índice

1. [Introducción](#introducción)
2. [Instalación y Configuración](#instalación-y-configuración)
3. [Implementación del Servidor](#implementación-del-servidor)
   - [Con Socket.IO](#con-socketio)
   - [Con WebSocket Nativo](#con-websocket-nativo)
4. [Implementación del Cliente](#implementación-del-cliente)
   - [Conexión Básica](#conexión-básica)
   - [Gestión de Salas](#gestión-de-salas)
   - [Intercambio de Señalización](#intercambio-de-señalización)
5. [Casos de Uso Comunes](#casos-de-uso-comunes)
   - [Chat de Video](#chat-de-video)
   - [Transmisión Unidireccional](#transmisión-unidireccional)
   - [Compartir Pantalla](#compartir-pantalla)
6. [Solución de Problemas](#solución-de-problemas)
7. [Mejores Prácticas](#mejores-prácticas)

## Introducción

Esta guía proporciona instrucciones detalladas para implementar y utilizar el servidor de señalización WebRTC en diferentes escenarios. El servidor facilita la comunicación en tiempo real entre navegadores, permitiendo establecer conexiones peer-to-peer para transmisión de audio, video y datos.

## Instalación y Configuración

### Requisitos Previos

- Node.js (v14 o superior)
- npm o yarn

### Instalación

```bash
npm install webrtc-socket-api
```

Dependencias de pares (instalar en tu proyecto):

```bash
npm i express socket.io
# Si compilas TypeScript:
npm i -D @types/express @types/node
```

## Implementación del Servidor

### Con Socket.IO

Socket.IO es la implementación recomendada por su facilidad de uso y compatibilidad con diferentes navegadores.

```javascript
// server.js
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { defaultSignal } from 'webrtc-socket-api';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

// Servir archivos estáticos (opcional)
app.use(express.static('public'));

// Manejar conexiones de Socket.IO
io.on('connection', (socket) => {
  console.log(`Nuevo usuario conectado: ${socket.id}`);
  
  // Pasar el socket al servidor de señalización
  defaultSignal.handleConnection(socket);
  
  // Puedes añadir manejadores adicionales aquí
  socket.on('disconnect', () => {
    console.log(`Usuario desconectado: ${socket.id}`);
  });
});

// Iniciar el servidor
const PORT = process.env.PORT || 9001;
httpServer.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
```

### Con WebSocket Nativo

Si prefieres utilizar WebSocket nativo (mediante la biblioteca 'ws'), puedes hacerlo con el adaptador incluido.

```javascript
// server-ws.js
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { defaultSignal, WebSocketAdapter } from 'webrtc-socket-api';

const app = express();
const httpServer = createServer(app);

// Servir archivos estáticos (opcional)
app.use(express.static('public'));

// Crear servidor WebSocket
const wss = new WebSocketServer({ server: httpServer });

// Manejar conexiones WebSocket
wss.on('connection', (ws, request) => {
  console.log('Nuevo cliente WebSocket conectado');
  
  // Crear adaptador para el socket WebSocket
  const adaptedSocket = new WebSocketAdapter(ws, request);
  
  // Pasar el socket adaptado al servidor de señalización
  defaultSignal.handleConnection(adaptedSocket);
});

// Iniciar el servidor
const PORT = process.env.PORT || 9001;
httpServer.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
```

## Implementación del Cliente

### Conexión Básica

#### Con Socket.IO

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Cliente WebRTC</title>
  <script src="/socket.io/socket.io.js"></script>
</head>
<body>
  <script>
    // Conectar al servidor de señalización
    const socket = io('http://localhost:9001', {
      query: {
        userid: 'usuario-' + Math.random().toString(36).substr(2, 9), // ID aleatorio
        // Parámetros opcionales
        sessionid: '',
        maxParticipantsAllowed: '10',
        extra: JSON.stringify({ nombre: 'Usuario Ejemplo' }),
      }
    });
    
    // Manejar eventos de conexión
    socket.on('connect', () => {
      console.log('Conectado al servidor de señalización');
    });
    
    socket.on('disconnect', () => {
      console.log('Desconectado del servidor de señalización');
    });
  </script>
</body>
</html>
```

#### Con WebSocket Nativo

```html
<!-- index-ws.html -->
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Cliente WebRTC con WebSocket</title>
</head>
<body>
  <script>
    // Crear ID de usuario aleatorio
    const userid = 'usuario-' + Math.random().toString(36).substr(2, 9);
    
    // Conectar al servidor de señalización con WebSocket
    const ws = new WebSocket(`ws://localhost:9001?userid=${userid}`);
    
    ws.onopen = () => {
      console.log('Conectado al servidor de señalización');
    };
    
    ws.onclose = () => {
      console.log('Desconectado del servidor de señalización');
    };
    
    // Función para enviar eventos al servidor
    function emit(event, ...payload) {
      ws.send(JSON.stringify({ event, payload }));
    }
    
    // Función para escuchar eventos del servidor
    ws.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data);
        if (data.event) {
          // Aquí puedes manejar los eventos recibidos
          console.log('Evento recibido:', data.event, data.payload);
        }
      } catch (error) {
        console.error('Error al procesar mensaje:', error);
      }
    };
  </script>
</body>
</html>
```

### Gestión de Salas

#### Crear una Sala

```javascript
// Crear una sala
socket.emit('open-room', {
  sessionid: 'sala-ejemplo',
  session: {
    audio: true,
    video: true,
    // Opciones adicionales
    oneway: false,      // true para transmisión unidireccional
    broadcast: false,   // true para modo broadcast
    scalable: false     // true para escalabilidad
  },
  extra: { titulo: 'Sala de ejemplo' },
  identifier: 'salas-publicas', // Para listar salas públicas
  password: 'contraseña123'     // Opcional, para proteger la sala
}, (success, error) => {
  if (success) {
    console.log('Sala creada correctamente');
  } else {
    console.error('Error al crear la sala:', error);
  }
});
```

#### Unirse a una Sala

```javascript
// Unirse a una sala existente
socket.emit('join-room', {
  sessionid: 'sala-ejemplo',
  extra: { nombre: 'Participante Ejemplo' },
  password: 'contraseña123' // Si la sala está protegida
}, (success, error) => {
  if (success) {
    console.log('Unido a la sala correctamente');
  } else {
    console.error('Error al unirse a la sala:', error);
  }
});
```

#### Verificar Existencia de una Sala

```javascript
// Verificar si una sala existe
socket.emit('check-presence', 'sala-ejemplo', (isPresent, roomid, extra) => {
  if (isPresent) {
    console.log('La sala existe:', extra);
    // extra._room contiene información sobre la sala
    const isFull = extra._room.isFull;
    const isPasswordProtected = extra._room.isPasswordProtected;
  } else {
    console.log('La sala no existe');
  }
});
```

#### Listar Salas Públicas

```javascript
// Obtener lista de salas públicas con un identificador específico
socket.emit('get-public-rooms', 'salas-publicas', (rooms) => {
  if (rooms && rooms.length > 0) {
    console.log('Salas disponibles:', rooms);
    // Cada sala contiene: sessionid, owner, participants, isRoomFull, isPasswordProtected, etc.
  } else {
    console.log('No hay salas públicas disponibles');
  }
});
```

### Intercambio de Señalización

El intercambio de señalización WebRTC (SDP y ICE candidates) se realiza a través del evento `RTCMultiConnection-Message`.

```javascript
// Escuchar mensajes de señalización
socket.on('RTCMultiConnection-Message', (message) => {
  // message contiene: sender, remoteUserId, message (con SDP o ICE)
  
  // Si es una oferta SDP
  if (message.message.sdp) {
    handleSdpOffer(message);
  }
  
  // Si es un ICE candidate
  if (message.message.candidate) {
    handleIceCandidate(message);
  }
});

// Enviar oferta SDP a otro usuario
function sendSdpOffer(remoteUserId, sdp) {
  socket.emit('RTCMultiConnection-Message', {
    remoteUserId: remoteUserId,
    message: {
      sdp: sdp,
      type: 'offer'
    }
  });
}

// Enviar respuesta SDP a otro usuario
function sendSdpAnswer(remoteUserId, sdp) {
  socket.emit('RTCMultiConnection-Message', {
    remoteUserId: remoteUserId,
    message: {
      sdp: sdp,
      type: 'answer'
    }
  });
}

// Enviar ICE candidate a otro usuario
function sendIceCandidate(remoteUserId, candidate) {
  socket.emit('RTCMultiConnection-Message', {
    remoteUserId: remoteUserId,
    message: {
      candidate: candidate
    }
  });
}
```

## Casos de Uso Comunes

### Chat de Video

Este ejemplo muestra cómo implementar un chat de video básico utilizando el servidor de señalización.

```javascript
// Variables globales
let localStream;
let peerConnections = {};
const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// Iniciar cámara y micrófono
async function startLocalMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('localVideo').srcObject = localStream;
    return true;
  } catch (error) {
    console.error('Error al acceder a los dispositivos multimedia:', error);
    return false;
  }
}

// Crear o unirse a una sala
async function joinVideoChat(roomId) {
  // Iniciar medios locales primero
  const mediaReady = await startLocalMedia();
  if (!mediaReady) return;
  
  // Verificar si la sala existe
  socket.emit('check-presence', roomId, (isPresent) => {
    if (isPresent) {
      // Unirse a la sala existente
      socket.emit('join-room', { sessionid: roomId });
    } else {
      // Crear nueva sala
      socket.emit('open-room', {
        sessionid: roomId,
        session: { audio: true, video: true }
      });
    }
  });
  
  // Escuchar cuando un usuario se conecta
  socket.on('user-connected', (userId) => {
    console.log('Usuario conectado:', userId);
    // Iniciar conexión WebRTC con el nuevo usuario
    createPeerConnection(userId);
    // Enviar oferta al nuevo usuario
    createAndSendOffer(userId);
  });
  
  // Escuchar cuando un usuario se desconecta
  socket.on('user-disconnected', (userId) => {
    console.log('Usuario desconectado:', userId);
    // Limpiar conexión
    if (peerConnections[userId]) {
      peerConnections[userId].close();
      delete peerConnections[userId];
      // Eliminar elemento de video si existe
      const videoElement = document.getElementById(`video-${userId}`);
      if (videoElement) videoElement.remove();
    }
  });
  
  // Escuchar mensajes de señalización
  socket.on('RTCMultiConnection-Message', handleSignalingMessage);
}

// Crear conexión peer para un usuario
function createPeerConnection(userId) {
  const peerConnection = new RTCPeerConnection(configuration);
  peerConnections[userId] = peerConnection;
  
  // Añadir tracks locales a la conexión
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });
  
  // Escuchar ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      // Enviar ICE candidate al otro peer
      socket.emit('RTCMultiConnection-Message', {
        remoteUserId: userId,
        message: { candidate: event.candidate }
      });
    }
  };
  
  // Escuchar tracks remotos
  peerConnection.ontrack = (event) => {
    // Crear o actualizar elemento de video para el usuario remoto
    let videoElement = document.getElementById(`video-${userId}`);
    if (!videoElement) {
      videoElement = document.createElement('video');
      videoElement.id = `video-${userId}`;
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      document.getElementById('remoteVideos').appendChild(videoElement);
    }
    videoElement.srcObject = event.streams[0];
  };
  
  return peerConnection;
}

// Crear y enviar oferta SDP
async function createAndSendOffer(userId) {
  const peerConnection = peerConnections[userId];
  if (!peerConnection) return;
  
  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    // Enviar oferta al otro peer
    socket.emit('RTCMultiConnection-Message', {
      remoteUserId: userId,
      message: { sdp: peerConnection.localDescription }
    });
  } catch (error) {
    console.error('Error al crear oferta:', error);
  }
}

// Manejar mensajes de señalización
async function handleSignalingMessage(message) {
  const { sender, message: signalData } = message;
  
  // Ignorar mensajes propios
  if (sender === socket.id) return;
  
  // Asegurarse de que existe una conexión para este usuario
  let peerConnection = peerConnections[sender];
  if (!peerConnection) {
    peerConnection = createPeerConnection(sender);
  }
  
  // Procesar SDP (oferta o respuesta)
  if (signalData.sdp) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
    
    // Si es una oferta, crear y enviar respuesta
    if (signalData.sdp.type === 'offer') {
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      socket.emit('RTCMultiConnection-Message', {
        remoteUserId: sender,
        message: { sdp: peerConnection.localDescription }
      });
    }
  }
  
  // Procesar ICE candidate
  if (signalData.candidate) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(signalData.candidate));
    } catch (error) {
      console.error('Error al añadir ICE candidate:', error);
    }
  }
}
```

### Transmisión Unidireccional

Para implementar una transmisión unidireccional (por ejemplo, un presentador a múltiples espectadores), puedes utilizar la opción `oneway` o `broadcast` al crear la sala.

```javascript
// Crear sala para transmisión unidireccional
socket.emit('open-room', {
  sessionid: 'transmision-ejemplo',
  session: {
    audio: true,
    video: true,
    oneway: true  // Solo el propietario envía media
  },
  identifier: 'transmisiones-publicas'
});
```

En el cliente, debes modificar la lógica para que solo el propietario envíe streams y los demás solo reciban.

### Compartir Pantalla

Para implementar la funcionalidad de compartir pantalla, puedes utilizar `getDisplayMedia()` en lugar de `getUserMedia()`.

```javascript
async function startScreenSharing() {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    
    // Reemplazar el video de la cámara por la pantalla compartida
    const videoTrack = screenStream.getVideoTracks()[0];
    
    // Reemplazar el track en todas las conexiones peer existentes
    Object.values(peerConnections).forEach(pc => {
      const sender = pc.getSenders().find(s => s.track.kind === 'video');
      if (sender) {
        sender.replaceTrack(videoTrack);
      }
    });
    
    // Actualizar vista local
    document.getElementById('localVideo').srcObject = screenStream;
    
    // Detectar cuando el usuario detiene la compartición de pantalla
    videoTrack.onended = () => {
      stopScreenSharing();
    };
    
    return true;
  } catch (error) {
    console.error('Error al compartir pantalla:', error);
    return false;
  }
}

async function stopScreenSharing() {
  try {
    // Volver a la cámara
    const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const videoTrack = cameraStream.getVideoTracks()[0];
    
    // Reemplazar el track en todas las conexiones peer existentes
    Object.values(peerConnections).forEach(pc => {
      const sender = pc.getSenders().find(s => s.track.kind === 'video');
      if (sender) {
        sender.replaceTrack(videoTrack);
      }
    });
    
    // Actualizar vista local
    document.getElementById('localVideo').srcObject = cameraStream;
    
    return true;
  } catch (error) {
    console.error('Error al volver a la cámara:', error);
    return false;
  }
}
```

## Solución de Problemas

### Problemas Comunes y Soluciones

1. **No se establece la conexión WebRTC**
   - Verifica que los servidores STUN/TURN estén configurados correctamente
   - Asegúrate de que los mensajes de señalización se estén enviando y recibiendo
   - Comprueba si hay errores en la consola del navegador

2. **Error "userid-already-taken"**
   - Utiliza un ID de usuario único para cada cliente
   - Maneja el evento para generar un nuevo ID automáticamente

3. **No se puede acceder a la cámara/micrófono**
   - Asegúrate de que el usuario ha concedido permisos
   - Verifica que los dispositivos estén conectados y funcionando
   - Prueba con diferentes restricciones en `getUserMedia()`

4. **Problemas de NAT/Firewall**
   - Utiliza servidores TURN para atravesar NATs y firewalls
   - Configura correctamente los servidores ICE

### Depuración

1. **Habilitar logs detallados**

```javascript
// En el servidor
const config = {
  logs: true,
  pushLogs: (type, error) => {
    console.log(`[${type}]`, error);
  }
};

// En el cliente (Chrome)
webrtc.enable(true); // En la consola del navegador
```

2. **Monitorear el estado de las conexiones**

```javascript
peerConnection.oniceconnectionstatechange = () => {
  console.log('ICE Connection State:', peerConnection.iceConnectionState);
};

peerConnection.onsignalingstatechange = () => {
  console.log('Signaling State:', peerConnection.signalingState);
};
```

## Gestión y Administración del Servidor

La clase `SignalingServer` incluye métodos para la gestión programática del servidor:

### Ejemplo de Panel de Administración

```javascript
// server-admin.js
import express from 'express';
import { defaultSignal } from './path-to-signaling-server';

const adminApp = express();
adminApp.use(express.json());

// Middleware de autenticación simple (implementa uno más robusto en producción)
const authenticateAdmin = (req, res, next) => {
  const token = req.headers.authorization;
  if (token !== 'Bearer admin-secret-token') {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
};

// Obtener estadísticas del servidor
adminApp.get('/admin/stats', authenticateAdmin, (req, res) => {
  const rooms = defaultSignal.getRooms();
  const users = defaultSignal.getUsers();
  
  const stats = {
    totalRooms: Object.keys(rooms).length,
    totalUsers: Object.keys(users).length,
    roomsWithUsers: Object.values(rooms).filter(room => room.participants.length > 0).length,
    averageUsersPerRoom: Object.values(rooms).reduce((acc, room) => acc + room.participants.length, 0) / Object.keys(rooms).length || 0
  };
  
  res.json(stats);
});

// Listar todas las salas
adminApp.get('/admin/rooms', authenticateAdmin, (req, res) => {
  const rooms = defaultSignal.getRooms();
  res.json(rooms);
});

// Obtener detalles de una sala específica
adminApp.get('/admin/rooms/:roomId', authenticateAdmin, (req, res) => {
  const room = defaultSignal.getRoomById(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Sala no encontrada' });
  }
  res.json(room);
});

// Listar todos los usuarios
adminApp.get('/admin/users', authenticateAdmin, (req, res) => {
  const users = defaultSignal.getUsers();
  res.json(users);
});

// Obtener detalles de un usuario específico
adminApp.get('/admin/users/:userId', authenticateAdmin, (req, res) => {
  const user = defaultSignal.getUserById(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
  res.json(user);
});

// Expulsar un usuario
adminApp.post('/admin/users/:userId/kick', authenticateAdmin, (req, res) => {
  const success = defaultSignal.kickUser(req.params.userId);
  res.json({ success, message: success ? 'Usuario expulsado' : 'Usuario no encontrado' });
});

// Cerrar una sala
adminApp.post('/admin/rooms/:roomId/close', authenticateAdmin, (req, res) => {
  const success = defaultSignal.closeRoom(req.params.roomId);
  res.json({ success, message: success ? 'Sala cerrada' : 'Sala no encontrada' });
});

// Iniciar servidor de administración
const ADMIN_PORT = process.env.ADMIN_PORT || 3001;
adminApp.listen(ADMIN_PORT, () => {
  console.log(`Panel de administración ejecutándose en http://localhost:${ADMIN_PORT}`);
});
```

### Monitoreo en Tiempo Real

```javascript
// monitoring.js
import { defaultSignal } from './path-to-signaling-server';

// Función para obtener estadísticas en tiempo real
function getServerStats() {
  const rooms = defaultSignal.getRooms();
  const users = defaultSignal.getUsers();
  
  return {
    timestamp: new Date().toISOString(),
    rooms: {
      total: Object.keys(rooms).length,
      active: Object.values(rooms).filter(room => room.participants.length > 0).length,
      empty: Object.values(rooms).filter(room => room.participants.length === 0).length
    },
    users: {
      total: Object.keys(users).length,
      connected: Object.values(users).filter(user => user.socket.connected).length
    },
    memory: process.memoryUsage()
  };
}

// Monitoreo cada 30 segundos
setInterval(() => {
  const stats = getServerStats();
  console.log('📊 Estadísticas del servidor:', JSON.stringify(stats, null, 2));
  
  // Aquí podrías enviar las estadísticas a un servicio de monitoreo
  // como DataDog, New Relic, o simplemente guardarlas en una base de datos
}, 30000);

// Exportar función para uso externo
export { getServerStats };
```

## Mejores Prácticas

1. **Seguridad**
   - Utiliza HTTPS para el servidor de señalización
   - Implementa autenticación para los usuarios
   - Valida todos los datos recibidos del cliente
   - Protege los endpoints de administración con autenticación robusta

2. **Rendimiento**
   - Limita el número de participantes por sala según las capacidades del cliente
   - Utiliza restricciones de video adaptativas según el ancho de banda disponible
   - Considera utilizar WebRTC DataChannels para mensajes pequeños en lugar de WebSocket
   - Usa los métodos `getRooms()` y `getUsers()` para implementar métricas personalizadas

3. **Experiencia de Usuario**
   - Implementa indicadores de conexión y calidad
   - Proporciona opciones para silenciar audio/video
   - Maneja reconexiones automáticas en caso de pérdida de conexión

4. **Escalabilidad**
   - Utiliza un modelo de malla (mesh) para grupos pequeños (< 5 participantes)
   - Considera un servidor SFU (Selective Forwarding Unit) para grupos más grandes
   - Implementa límites de recursos por usuario y por sala
   - Utiliza los métodos de gestión para implementar balanceadores de carga inteligentes