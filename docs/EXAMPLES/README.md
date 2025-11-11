# Ejemplos y Guías de Implementación

Esta sección contiene ejemplos detallados y guías para diferentes casos de uso del servidor de señalización WebRTC.

## 📁 Archivos Disponibles

### Guías Principales
- **[EJEMPLOS_CODIGO.md](./EJEMPLOS_CODIGO.md)** - Ejemplos de código completos en español
- **[PUBLISHING.md](./PUBLISHING.md)** - Guía de publicación y distribución
- **[ws.md](./ws.md)** - Ejemplos con WebSocket nativo

---

## 🚀 Ejemplos Rápidos

### 1. Servidor Básico (Node.js + Socket.IO)

```typescript
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { SignalingServer } from "webrtc-socket-api";

const app = express();
const http = createServer(app);
const io = new Server(http, { cors: { origin: "*" } });

const signalingServer = new SignalingServer({
  heartbeat: { enableHeartbeat: true },
  maxParticipantsAllowed: 10
});

io.on("connection", (socket) => {
  signalingServer.handleConnection(socket);
});

http.listen(9001, () => {
  console.log("Servidor en http://localhost:9001");
});
```

### 2. Servidor Optimizado para Bun

```typescript
import { SignalingServer, BunWebSocketAdapter } from "webrtc-socket-api";

const signalingServer = new SignalingServer({
  heartbeat: { enableHeartbeat: true }
});

const server = Bun.serve({
  port: 9000,
  fetch(req, server) {
    // Servir archivos estáticos
    return new Response(Bun.file("./public" + new URL(req.url).pathname));
  },
  websocket: {
    open(ws) {
      const adapter = new BunWebSocketAdapter(ws);
      signalingServer.handleConnection(adapter);
    },
    message(ws, message) {
      ws.data.adapter?.handleMessage(message);
    },
    close(ws, code, reason) {
      ws.data.adapter?.handleClose(code, reason);
    }
  }
});
```

### 3. Cliente WebRTC Básico

```html
<!DOCTYPE html>
<html>
<head>
    <title>WebRTC Client</title>
</head>
<body>
    <video id="localVideo" autoplay muted></video>
    <video id="remoteVideo" autoplay></video>
    
    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io("http://localhost:9001");
        let localStream, remoteStream;
        let peerConnection;

        // Configuración WebRTC
        const configuration = {
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        };

        // Inicializar conexión
        async function init() {
            localStream = await navigator.mediaDevices.getUserMedia({
                video: true, audio: true
            });
            document.getElementById("localVideo").srcObject = localStream;
            
            peerConnection = new RTCPeerConnection(configuration);
            localStream.getTracks().forEach(track => 
                peerConnection.addTrack(track, localStream)
            );

            peerConnection.ontrack = (event) => {
                document.getElementById("remoteVideo").srcObject = event.streams[0];
            };

            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit("RTCMultiConnection-Message", {
                        remoteUserId: "other-user",
                        message: { ice: event.candidate }
                    });
                }
            };
        }

        // Unirse a sala
        socket.on("connect", () => {
            socket.emit("open-room", {
                sessionid: "test-room",
                session: { audio: true, video: true },
                identifier: "public-chat"
            });
        });

        // Manejar mensajes de señalización
        socket.on("RTCMultiConnection-Message", async (data) => {
            if (data.message.sdp) {
                await peerConnection.setRemoteDescription(data.message.sdp);
                if (data.message.sdp.type === "offer") {
                    const answer = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(answer);
                    socket.emit("RTCMultiConnection-Message", {
                        remoteUserId: data.remoteUserId,
                        message: { sdp: answer }
                    });
                }
            } else if (data.message.ice) {
                await peerConnection.addIceCandidate(data.message.ice);
            }
        });

        init();
    </script>
</body>
</html>
```

---

## 🔧 Casos de Uso Avanzados

### Videoconferencia Múltiple

```typescript
// Manejo de múltiples participantes
socket.on("user-connected", async (remoteUserId) => {
    const peerConnection = new RTCPeerConnection(configuration);
    
    localStream.getTracks().forEach(track => 
        peerConnection.addTrack(track, localStream)
    );
    
    peerConnection.ontrack = (event) => {
        // Crear elemento de video para el nuevo participante
        const videoElement = document.createElement("video");
        videoElement.srcObject = event.streams[0];
        videoElement.autoplay = true;
        document.getElementById("remoteVideos").appendChild(videoElement);
    };
    
    // Crear y enviar offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    socket.emit("RTCMultiConnection-Message", {
        remoteUserId,
        message: { sdp: offer }
    });
});
```

### Chat Integrado

```typescript
// Enviar mensaje de chat
socket.emit("custom-chat-message", {
    roomid: "test-room",
    message: "Hola a todos!",
    username: "Usuario1"
});

// Recibir mensajes
socket.on("custom-chat-message", (data) => {
    console.log(`${data.username}: ${data.message}`);
});
```

---

## 📋 Scripts Útiles

### Iniciar Servidor de Desarrollo

```bash
# Node.js
npm run dev

# Bun
npm run bun:dev

# Construir para producción
npm run build

# Ejecutar pruebas
npm run test
```

### Verificar Construcción

```bash
# Previsualizar paquete NPM
npm run pack:check

# Publicación de prueba
npm run publish:dry-run
```

---

## 🛠️ Configuraciones Recomendadas

### Producción

```typescript
const productionConfig = {
  heartbeat: {
    enableHeartbeat: true,
    pingInterval: 30000,
    pingTimeout: 5000,
    maxMissedPings: 3,
    cleanupInterval: 60000
  },
  maxParticipantsAllowed: 50,
  logToFile: true,
  logPath: "./logs"
};
```

### Desarrollo

```typescript
const developmentConfig = {
  heartbeat: {
    enableHeartbeat: true,
    pingInterval: 10000,
    pingTimeout: 3000,
    maxMissedPings: 5,
    cleanupInterval: 30000
  },
  maxParticipantsAllowed: 10,
  logToFile: false
};
```

---

## 📚 Referencias Adicionales

- **[Documentación Principal](../../README.md)** - Documentación completa
- **[API Reference](../../README.ES.md)** - Referencia de eventos y configuración
- **[Socket.IO Adapter](../../docs/SOCKETIO_ADAPTER.md)** - Adaptador personalizado
- **[Guía de Publicación](../../docs/PUBLISHING_NPM.md)** - Estrategia de distribución

---

## 🤝 Contribuciones

¿Tienes un ejemplo interesante? ¡Contribuye!

1. Crea un nuevo archivo en esta carpeta
2. Sigue el formato de los ejemplos existentes
3. Agrega documentación clara
4. Incluye un README si es necesario

---

## 📄 Licencia

Todos los ejemplos están bajo la misma licencia MIT que el proyecto principal.
