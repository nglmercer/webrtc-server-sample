# Ejemplos de Código para el Servidor de Señalización WebRTC

Este documento proporciona ejemplos de código para diferentes casos de uso del servidor de señalización WebRTC. Cada ejemplo incluye código tanto para el servidor como para el cliente.

## Índice

1. [Configuración Básica](#configuración-básica)
2. [Chat de Video](#chat-de-video)
3. [Chat de Texto](#chat-de-texto)
4. [Compartir Pantalla](#compartir-pantalla)
5. [Transmisión Unidireccional](#transmisión-unidireccional)
6. [Salas con Contraseña](#salas-con-contraseña)
7. [Listado de Salas Públicas](#listado-de-salas-públicas)
8. [Eventos Personalizados](#eventos-personalizados)

## Configuración Básica

### Servidor (Node.js con Express y Socket.IO)

```javascript
// server.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { defaultSignal } from './index'; // Ajusta la ruta según tu proyecto

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

// Servir archivos estáticos
app.use(express.static('public'));

// Manejar conexiones de Socket.IO
io.on('connection', (socket) => {
  console.log(`Nuevo usuario conectado: ${socket.id}`);
  
  // Pasar el socket al servidor de señalización
  defaultSignal.handleConnection(socket);
  
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

### Cliente (HTML/JavaScript)

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cliente WebRTC</title>
  <script src="/socket.io/socket.io.js"></script>
</head>
<body>
  <h1>Cliente WebRTC</h1>
  <div id="status">Desconectado</div>
  
  <script>
    // Generar ID de usuario aleatorio
    const userid = 'user-' + Math.random().toString(36).substring(2, 9);
    
    // Conectar al servidor de señalización
    const socket = io('http://localhost:9001', {
      query: {
        userid: userid,
        extra: JSON.stringify({ name: 'Usuario de Prueba' })
      }
    });
    
    // Manejar eventos de conexión
    socket.on('connect', () => {
      document.getElementById('status').textContent = 'Conectado como: ' + userid;
      console.log('Conectado al servidor de señalización');
    });
    
    socket.on('disconnect', () => {
      document.getElementById('status').textContent = 'Desconectado';
      console.log('Desconectado del servidor de señalización');
    });
  </script>
</body>
</html>
```

## Chat de Video

### Cliente (HTML/JavaScript)

```html
<!-- video-chat.html -->
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chat de Video WebRTC</title>
  <script src="/socket.io/socket.io.js"></script>
  <style>
    .video-container {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    video {
      width: 320px;
      height: 240px;
      background-color: #222;
      border-radius: 8px;
    }
    .controls {
      margin: 20px 0;
    }
    button {
      padding: 8px 16px;
      margin-right: 10px;
    }
  </style>
</head>
<body>
  <h1>Chat de Video WebRTC</h1>
  
  <div class="controls">
    <input type="text" id="roomId" placeholder="ID de la sala" value="sala-prueba">
    <button id="joinBtn">Unirse a la sala</button>
    <button id="leaveBtn" disabled>Salir de la sala</button>
    <button id="muteAudioBtn" disabled>Silenciar Audio</button>
    <button id="muteVideoBtn" disabled>Apagar Video</button>
  </div>
  
  <div class="video-container">
    <div>
      <h3>Video Local</h3>
      <video id="localVideo" autoplay muted playsinline></video>
    </div>
    <div id="remoteVideos"></div>
  </div>
  
  <script>
    // Variables globales
    let localStream;
    let peerConnections = {};
    let roomId;
    let isAudioMuted = false;
    let isVideoMuted = false;
    const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    
    // Elementos DOM
    const localVideo = document.getElementById('localVideo');
    const remoteVideos = document.getElementById('remoteVideos');
    const roomIdInput = document.getElementById('roomId');
    const joinBtn = document.getElementById('joinBtn');
    const leaveBtn = document.getElementById('leaveBtn');
    const muteAudioBtn = document.getElementById('muteAudioBtn');
    const muteVideoBtn = document.getElementById('muteVideoBtn');
    
    // Generar ID de usuario aleatorio
    const userid = 'user-' + Math.random().toString(36).substring(2, 9);
    
    // Conectar al servidor de señalización
    const socket = io('http://localhost:9001', {
      query: {
        userid: userid,
        extra: JSON.stringify({ name: 'Usuario de Video' })
      }
    });
    
    // Iniciar cámara y micrófono
    async function startLocalMedia() {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        return true;
      } catch (error) {
        console.error('Error al acceder a los dispositivos multimedia:', error);
        alert('No se pudo acceder a la cámara o micrófono. Verifica los permisos.');
        return false;
      }
    }
    
    // Unirse a una sala
    async function joinRoom() {
      roomId = roomIdInput.value.trim();
      if (!roomId) {
        alert('Ingresa un ID de sala válido');
        return;
      }
      
      // Iniciar medios locales primero
      const mediaReady = await startLocalMedia();
      if (!mediaReady) return;
      
      // Verificar si la sala existe
      socket.emit('check-presence', roomId, (isPresent) => {
        if (isPresent) {
          // Unirse a la sala existente
          socket.emit('join-room', { sessionid: roomId }, (success, error) => {
            if (success) {
              console.log('Unido a la sala:', roomId);
              updateUIForRoom(true);
            } else {
              alert('Error al unirse a la sala: ' + error);
            }
          });
        } else {
          // Crear nueva sala
          socket.emit('open-room', {
            sessionid: roomId,
            session: { audio: true, video: true }
          }, (success, error) => {
            if (success) {
              console.log('Sala creada:', roomId);
              updateUIForRoom(true);
            } else {
              alert('Error al crear la sala: ' + error);
            }
          });
        }
      });
    }
    
    // Salir de la sala
    function leaveRoom() {
      // Cerrar todas las conexiones peer
      Object.values(peerConnections).forEach(pc => pc.close());
      peerConnections = {};
      
      // Limpiar videos remotos
      remoteVideos.innerHTML = '';
      
      // Detener stream local
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localVideo.srcObject = null;
      }
      
      // Actualizar UI
      updateUIForRoom(false);
      
      console.log('Salió de la sala:', roomId);
    }
    
    // Actualizar UI según estado de la sala
    function updateUIForRoom(inRoom) {
      joinBtn.disabled = inRoom;
      leaveBtn.disabled = !inRoom;
      muteAudioBtn.disabled = !inRoom;
      muteVideoBtn.disabled = !inRoom;
      roomIdInput.disabled = inRoom;
    }
    
    // Crear conexión peer para un usuario
    function createPeerConnection(userId) {
      if (peerConnections[userId]) return peerConnections[userId];
      
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
        let videoContainer = document.getElementById(`video-container-${userId}`);
        if (!videoContainer) {
          videoContainer = document.createElement('div');
          videoContainer.id = `video-container-${userId}`;
          
          const nameLabel = document.createElement('h3');
          nameLabel.textContent = `Usuario: ${userId}`;
          
          const videoElement = document.createElement('video');
          videoElement.id = `video-${userId}`;
          videoElement.autoplay = true;
          videoElement.playsInline = true;
          
          videoContainer.appendChild(nameLabel);
          videoContainer.appendChild(videoElement);
          remoteVideos.appendChild(videoContainer);
        }
        
        const videoElement = document.getElementById(`video-${userId}`);
        if (videoElement.srcObject !== event.streams[0]) {
          videoElement.srcObject = event.streams[0];
        }
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
      if (sender === userid) return;
      
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
    
    // Silenciar/activar audio
    function toggleAudio() {
      if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
          isAudioMuted = !isAudioMuted;
          audioTrack.enabled = !isAudioMuted;
          muteAudioBtn.textContent = isAudioMuted ? 'Activar Audio' : 'Silenciar Audio';
        }
      }
    }
    
    // Apagar/encender video
    function toggleVideo() {
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          isVideoMuted = !isVideoMuted;
          videoTrack.enabled = !isVideoMuted;
          muteVideoBtn.textContent = isVideoMuted ? 'Encender Video' : 'Apagar Video';
        }
      }
    }
    
    // Event listeners
    joinBtn.addEventListener('click', joinRoom);
    leaveBtn.addEventListener('click', leaveRoom);
    muteAudioBtn.addEventListener('click', toggleAudio);
    muteVideoBtn.addEventListener('click', toggleVideo);
    
    // Socket.IO event listeners
    socket.on('connect', () => {
      console.log('Conectado al servidor de señalización como:', userid);
    });
    
    socket.on('user-connected', (userId) => {
      console.log('Usuario conectado:', userId);
      // Iniciar conexión WebRTC con el nuevo usuario
      createPeerConnection(userId);
      // Enviar oferta al nuevo usuario
      createAndSendOffer(userId);
    });
    
    socket.on('user-disconnected', (userId) => {
      console.log('Usuario desconectado:', userId);
      // Limpiar conexión
      if (peerConnections[userId]) {
        peerConnections[userId].close();
        delete peerConnections[userId];
      }
      
      // Eliminar elemento de video
      const videoContainer = document.getElementById(`video-container-${userId}`);
      if (videoContainer) {
        videoContainer.remove();
      }
    });
    
    // Escuchar mensajes de señalización
    socket.on('RTCMultiConnection-Message', handleSignalingMessage);
  </script>
</body>
</html>
```

## Chat de Texto

### Cliente (HTML/JavaScript)

```html
<!-- text-chat.html -->
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chat de Texto WebRTC</title>
  <script src="/socket.io/socket.io.js"></script>
  <style>
    .chat-container {
      max-width: 600px;
      margin: 0 auto;
      border: 1px solid #ccc;
      border-radius: 8px;
      overflow: hidden;
    }
    .chat-header {
      background-color: #4CAF50;
      color: white;
      padding: 10px;
      text-align: center;
    }
    .chat-messages {
      height: 300px;
      overflow-y: auto;
      padding: 10px;
      background-color: #f9f9f9;
    }
    .message {
      margin-bottom: 10px;
      padding: 8px;
      border-radius: 5px;
    }
    .message.sent {
      background-color: #DCF8C6;
      margin-left: 40px;
      text-align: right;
    }
    .message.received {
      background-color: #ECECEC;
      margin-right: 40px;
    }
    .chat-input {
      display: flex;
      padding: 10px;
      background-color: #f1f1f1;
    }
    .chat-input input {
      flex: 1;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-right: 10px;
    }
    .chat-input button {
      padding: 8px 16px;
      background-color: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .user-list {
      width: 150px;
      padding: 10px;
      background-color: #f1f1f1;
      border-right: 1px solid #ddd;
    }
    .user-item {
      padding: 5px;
      margin-bottom: 5px;
      border-radius: 4px;
      cursor: pointer;
    }
    .user-item:hover {
      background-color: #e0e0e0;
    }
    .user-item.active {
      background-color: #4CAF50;
      color: white;
    }
    .flex-container {
      display: flex;
    }
    .controls {
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <h1>Chat de Texto WebRTC</h1>
  
  <div class="controls">
    <input type="text" id="roomId" placeholder="ID de la sala" value="chat-texto">
    <input type="text" id="username" placeholder="Tu nombre" value="Usuario">
    <button id="joinBtn">Unirse al chat</button>
    <button id="leaveBtn" disabled>Salir del chat</button>
  </div>
  
  <div class="flex-container" style="display: none;" id="chatUI">
    <div class="user-list" id="userList">
      <h3>Usuarios</h3>
      <div id="users"></div>
    </div>
    
    <div class="chat-container">
      <div class="chat-header" id="chatHeader">Chat de Texto</div>
      <div class="chat-messages" id="chatMessages"></div>
      <div class="chat-input">
        <input type="text" id="messageInput" placeholder="Escribe un mensaje...">
        <button id="sendBtn">Enviar</button>
      </div>
    </div>
  </div>
  
  <script>
    // Variables globales
    let roomId;
    let username;
    let dataChannels = {};
    let peerConnections = {};
    let selectedUser = null;
    const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    
    // Elementos DOM
    const roomIdInput = document.getElementById('roomId');
    const usernameInput = document.getElementById('username');
    const joinBtn = document.getElementById('joinBtn');
    const leaveBtn = document.getElementById('leaveBtn');
    const chatUI = document.getElementById('chatUI');
    const userList = document.getElementById('users');
    const chatHeader = document.getElementById('chatHeader');
    const chatMessages = document.getElementById('chatMessages');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    
    // Generar ID de usuario aleatorio
    const userid = 'user-' + Math.random().toString(36).substring(2, 9);
    
    // Conectar al servidor de señalización
    const socket = io('http://localhost:9001', {
      query: {
        userid: userid
      }
    });
    
    // Unirse a una sala
    function joinRoom() {
      roomId = roomIdInput.value.trim();
      username = usernameInput.value.trim() || 'Anónimo';
      
      if (!roomId) {
        alert('Ingresa un ID de sala válido');
        return;
      }
      
      // Actualizar datos extra con el nombre de usuario
      socket.emit('extra-data-updated', { username: username });
      
      // Verificar si la sala existe
      socket.emit('check-presence', roomId, (isPresent) => {
        if (isPresent) {
          // Unirse a la sala existente
          socket.emit('join-room', { sessionid: roomId }, (success, error) => {
            if (success) {
              console.log('Unido a la sala:', roomId);
              updateUIForRoom(true);
            } else {
              alert('Error al unirse a la sala: ' + error);
            }
          });
        } else {
          // Crear nueva sala
          socket.emit('open-room', {
            sessionid: roomId,
            session: { audio: false, video: false }, // Sin audio ni video para chat de texto
            extra: { username: username }
          }, (success, error) => {
            if (success) {
              console.log('Sala creada:', roomId);
              updateUIForRoom(true);
            } else {
              alert('Error al crear la sala: ' + error);
            }
          });
        }
      });
    }
    
    // Salir de la sala
    function leaveRoom() {
      // Cerrar todas las conexiones peer
      Object.values(peerConnections).forEach(pc => pc.close());
      peerConnections = {};
      dataChannels = {};
      
      // Limpiar mensajes y usuarios
      chatMessages.innerHTML = '';
      userList.innerHTML = '';
      
      // Actualizar UI
      updateUIForRoom(false);
      
      console.log('Salió de la sala:', roomId);
    }
    
    // Actualizar UI según estado de la sala
    function updateUIForRoom(inRoom) {
      joinBtn.disabled = inRoom;
      leaveBtn.disabled = !inRoom;
      roomIdInput.disabled = inRoom;
      usernameInput.disabled = inRoom;
      chatUI.style.display = inRoom ? 'flex' : 'none';
      chatHeader.textContent = `Chat de Texto - Sala: ${roomId}`;
    }
    
    // Crear conexión peer para un usuario
    function createPeerConnection(userId) {
      if (peerConnections[userId]) return peerConnections[userId];
      
      const peerConnection = new RTCPeerConnection(configuration);
      peerConnections[userId] = peerConnection;
      
      // Crear canal de datos
      const dataChannel = peerConnection.createDataChannel('chat', {
        ordered: true
      });
      
      setupDataChannel(dataChannel, userId);
      dataChannels[userId] = dataChannel;
      
      // Escuchar canales de datos entrantes
      peerConnection.ondatachannel = (event) => {
        setupDataChannel(event.channel, userId);
        dataChannels[userId] = event.channel;
      };
      
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
      
      return peerConnection;
    }
    
    // Configurar canal de datos
    function setupDataChannel(channel, userId) {
      channel.onopen = () => {
        console.log(`Canal de datos abierto con ${userId}`);
        // Actualizar UI para mostrar que el usuario está conectado
        updateUserList();
      };
      
      channel.onclose = () => {
        console.log(`Canal de datos cerrado con ${userId}`);
        // Actualizar UI para mostrar que el usuario está desconectado
        updateUserList();
      };
      
      channel.onmessage = (event) => {
        // Procesar mensaje recibido
        const data = JSON.parse(event.data);
        displayMessage(data.username, data.message, false);
      };
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
      if (sender === userid) return;
      
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
    
    // Enviar mensaje de chat
    function sendMessage() {
      const message = messageInput.value.trim();
      if (!message) return;
      
      // Si no hay usuario seleccionado, enviar a todos
      if (!selectedUser || selectedUser === 'all') {
        // Enviar mensaje a todos los usuarios conectados
        Object.entries(dataChannels).forEach(([userId, channel]) => {
          if (channel.readyState === 'open') {
            channel.send(JSON.stringify({
              username: username,
              message: message
            }));
          }
        });
      } else {
        // Enviar mensaje solo al usuario seleccionado
        const channel = dataChannels[selectedUser];
        if (channel && channel.readyState === 'open') {
          channel.send(JSON.stringify({
            username: username,
            message: message
          }));
        }
      }
      
      // Mostrar mensaje propio en el chat
      displayMessage(username, message, true);
      
      // Limpiar campo de entrada
      messageInput.value = '';
    }
    
    // Mostrar mensaje en el chat
    function displayMessage(sender, message, isSent) {
      const messageElement = document.createElement('div');
      messageElement.className = `message ${isSent ? 'sent' : 'received'}`;
      messageElement.innerHTML = `<strong>${sender}:</strong> ${message}`;
      chatMessages.appendChild(messageElement);
      
      // Scroll al final
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Actualizar lista de usuarios
    function updateUserList() {
      // Limpiar lista actual
      userList.innerHTML = '';
      
      // Añadir opción para todos
      const allItem = document.createElement('div');
      allItem.className = `user-item ${selectedUser === 'all' ? 'active' : ''}`;
      allItem.textContent = 'Todos';
      allItem.onclick = () => selectUser('all');
      userList.appendChild(allItem);
      
      // Añadir usuarios conectados
      socket.emit('get-public-rooms', roomId, (rooms) => {
        if (rooms && rooms.length > 0) {
          const room = rooms[0];
          
          // Obtener participantes de la sala
          room.participants.forEach(participantId => {
            if (participantId !== userid) {
              // Obtener datos extra del usuario
              socket.emit('get-remote-user-extra-data', participantId, (extra) => {
                const username = extra?.username || participantId.substring(0, 8);
                
                const userItem = document.createElement('div');
                userItem.className = `user-item ${selectedUser === participantId ? 'active' : ''}`;
                userItem.textContent = username;
                userItem.onclick = () => selectUser(participantId);
                userList.appendChild(userItem);
              });
            }
          });
        }
      });
    }
    
    // Seleccionar usuario para chat
    function selectUser(userId) {
      selectedUser = userId;
      
      // Actualizar UI
      document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('active');
      });
      
      const selectedItem = Array.from(document.querySelectorAll('.user-item')).find(
        item => item.textContent === (userId === 'all' ? 'Todos' : userId)
      );
      
      if (selectedItem) {
        selectedItem.classList.add('active');
      }
      
      // Actualizar encabezado del chat
      chatHeader.textContent = `Chat de Texto - ${userId === 'all' ? 'Todos' : userId}`;
    }
    
    // Event listeners
    joinBtn.addEventListener('click', joinRoom);
    leaveBtn.addEventListener('click', leaveRoom);
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
    
    // Socket.IO event listeners
    socket.on('connect', () => {
      console.log('Conectado al servidor de señalización como:', userid);
    });
    
    socket.on('user-connected', (userId) => {
      console.log('Usuario conectado:', userId);
      // Iniciar conexión WebRTC con el nuevo usuario
      createPeerConnection(userId);
      // Enviar oferta al nuevo usuario
      createAndSendOffer(userId);
      // Actualizar lista de usuarios
      updateUserList();
    });
    
    socket.on('user-disconnected', (userId) => {
      console.log('Usuario desconectado:', userId);
      // Limpiar conexión
      if (peerConnections[userId]) {
        peerConnections[userId].close();
        delete peerConnections[userId];
      }
      
      if (dataChannels[userId]) {
        delete dataChannels[userId];
      }
      
      // Actualizar lista de usuarios
      updateUserList();
    });
    
    // Escuchar mensajes de señalización
    socket.on('RTCMultiConnection-Message', handleSignalingMessage);
    
    // Escuchar actualizaciones de datos extra
    socket.on('extra-data-updated', (userId, extra) => {
      console.log('Datos extra actualizados para:', userId, extra);
      // Actualizar lista de usuarios
      updateUserList();
    });
  </script>
</body>
</html>
```

## Compartir Pantalla

```javascript
// Función para iniciar compartición de pantalla
async function startScreenSharing() {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
      video: { cursor: 'always' },
      audio: false
    });
    
    // Guardar referencia al stream original
    const originalStream = localStream;
    
    // Reemplazar el video de la cámara por la pantalla compartida
    const videoTrack = screenStream.getVideoTracks()[0];
    
    // Reemplazar el track en todas las conexiones peer existentes
    Object.values(peerConnections).forEach(pc => {
      const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) {
        sender.replaceTrack(videoTrack);
      }
    });
    
    // Actualizar vista local
    localVideo.srcObject = screenStream;
    
    // Detectar cuando el usuario detiene la compartición de pantalla
    videoTrack.onended = () => {
      // Restaurar la cámara
      const cameraTrack = originalStream.getVideoTracks()[0];
      if (cameraTrack) {
        Object.values(peerConnections).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(cameraTrack);
          }
        });
        
        localVideo.srcObject = originalStream;
      }
    };
    
    return true;
  } catch (error) {
    console.error('Error al compartir pantalla:', error);
    return false;
  }
}

// Añadir botón para compartir pantalla
const shareScreenBtn = document.createElement('button');
shareScreenBtn.textContent = 'Compartir Pantalla';
shareScreenBtn.onclick = startScreenSharing;
document.querySelector('.controls').appendChild(shareScreenBtn);
```

## Transmisión Unidireccional

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
}, (success, error) => {
  if (success) {
    console.log('Sala de transmisión creada');
    // Iniciar cámara solo para el propietario
    startLocalMedia();
  } else {
    console.error('Error al crear sala de transmisión:', error);
  }
});

// Para los espectadores, modificar la función joinRoom
async function joinRoom() {
  roomId = roomIdInput.value.trim();
  if (!roomId) {
    alert('Ingresa un ID de sala válido');
    return;
  }
  
  // Verificar si la sala existe
  socket.emit('check-presence', roomId, (isPresent, roomid, extra) => {
    if (isPresent) {
      // Verificar si es una sala unidireccional
      const isOneway = extra?._room?.session?.oneway;
      
      // Unirse a la sala existente
      socket.emit('join-room', { sessionid: roomId }, async (success, error) => {
        if (success) {
          console.log('Unido a la sala:', roomId);
          updateUIForRoom(true);
          
          // Si es espectador en sala unidireccional, no iniciar cámara
          if (!isOneway) {
            await startLocalMedia();
          }
        } else {
          alert('Error al unirse a la sala: ' + error);
        }
      });
    } else {
      alert('La sala no existe');
    }
  });
}
```

## Salas con Contraseña

```javascript
// Crear sala con contraseña
socket.emit('open-room', {
  sessionid: 'sala-privada',
  session: { audio: true, video: true },
  password: 'contraseña123'
}, (success, error) => {
  if (success) {
    console.log('Sala privada creada');
  } else {
    console.error('Error al crear sala privada:', error);
  }
});

// Unirse a sala con contraseña
function joinPrivateRoom() {
  const roomId = roomIdInput.value.trim();
  const password = passwordInput.value.trim();
  
  if (!roomId) {
    alert('Ingresa un ID de sala válido');
    return;
  }
  
  // Verificar si la sala existe
  socket.emit('check-presence', roomId, (isPresent, roomid, extra) => {
    if (isPresent) {
      // Verificar si la sala tiene contraseña
      if (extra?._room?.isPasswordProtected) {
        // Verificar contraseña
        socket.emit('is-valid-password', password, roomId, (isValid, roomid, error) => {
          if (isValid) {
            // Unirse a la sala con la contraseña
            socket.emit('join-room', { 
              sessionid: roomId,
              password: password
            }, (success, error) => {
              if (success) {
                console.log('Unido a la sala privada:', roomId);
                updateUIForRoom(true);
              } else {
                alert('Error al unirse a la sala: ' + error);
              }
            });
          } else {
            alert('Contraseña incorrecta: ' + error);
          }
        });
      } else {
        // La sala no tiene contraseña
        socket.emit('join-room', { sessionid: roomId }, (success, error) => {
          if (success) {
            console.log('Unido a la sala:', roomId);
            updateUIForRoom(true);
          } else {
            alert('Error al unirse a la sala: ' + error);
          }
        });
      }
    } else {
      alert('La sala no existe');
    }
  });
}
```

## Listado de Salas Públicas

```html
<!-- public-rooms.html -->
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Salas Públicas WebRTC</title>
  <script src="/socket.io/socket.io.js"></script>
  <style>
    .room-list {
      max-width: 600px;
      margin: 20px auto;
    }
    .room-item {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 10px;
      background-color: #f9f9f9;
    }
    .room-item h3 {
      margin-top: 0;
      color: #4CAF50;
    }
    .room-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .room-actions {
      margin-top: 10px;
    }
    button {
      padding: 8px 16px;
      background-color: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      margin-right: 10px;
    }
    button:disabled {
      background-color: #cccccc;
      cursor: not-allowed;
    }
    .password-input {
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-right: 10px;
    }
  </style>
</head>
<body>
  <h1>Salas Públicas WebRTC</h1>
  
  <div class="controls">
    <input type="text" id="identifier" placeholder="Identificador de salas" value="salas-publicas">
    <button id="refreshBtn">Actualizar Lista</button>
  </div>
  
  <div class="room-list" id="roomList">
    <p>No hay salas disponibles</p>
  </div>
  
  <script>
    // Elementos DOM
    const identifierInput = document.getElementById('identifier');
    const refreshBtn = document.getElementById('refreshBtn');
    const roomList = document.getElementById('roomList');
    
    // Generar ID de usuario aleatorio
    const userid = 'user-' + Math.random().toString(36).substring(2, 9);
    
    // Conectar al servidor de señalización
    const socket = io('http://localhost:9001', {
      query: {
        userid: userid
      }
    });
    
    // Obtener lista de salas públicas
    function getRooms() {
      const identifier = identifierInput.value.trim();
      if (!identifier) {
        alert('Ingresa un identificador válido');
        return;
      }
      
      socket.emit('get-public-rooms', identifier, (rooms) => {
        if (rooms && rooms.length > 0) {
          displayRooms(rooms);
        } else {
          roomList.innerHTML = '<p>No hay salas disponibles con este identificador</p>';
        }
      });
    }
    
    // Mostrar lista de salas
    function displayRooms(rooms) {
      roomList.innerHTML = '';
      
      rooms.forEach(room => {
        const roomElement = document.createElement('div');
        roomElement.className = 'room-item';
        
        const roomTitle = document.createElement('h3');
        roomTitle.textContent = `Sala: ${room.sessionid}`;
        
        const roomInfo = document.createElement('div');
        roomInfo.className = 'room-info';
        
        const participantsInfo = document.createElement('div');
        participantsInfo.innerHTML = `<strong>Participantes:</strong> ${room.participants.length}/${room.maxParticipantsAllowed}`;
        
        const statusInfo = document.createElement('div');
        statusInfo.innerHTML = `
          <strong>Estado:</strong> ${room.isRoomFull ? 'Llena' : 'Disponible'}<br>
          <strong>Contraseña:</strong> ${room.isPasswordProtected ? 'Sí' : 'No'}
        `;
        
        roomInfo.appendChild(participantsInfo);
        roomInfo.appendChild(statusInfo);
        
        const roomActions = document.createElement('div');
        roomActions.className = 'room-actions';
        
        // Si la sala requiere contraseña, mostrar campo de entrada
        if (room.isPasswordProtected) {
          const passwordInput = document.createElement('input');
          passwordInput.type = 'password';
          passwordInput.className = 'password-input';
          passwordInput.placeholder = 'Contraseña';
          roomActions.appendChild(passwordInput);
        }
        
        const joinButton = document.createElement('button');
        joinButton.textContent = 'Unirse';
        joinButton.disabled = room.isRoomFull;
        joinButton.onclick = () => {
          const password = roomElement.querySelector('.password-input')?.value || '';
          joinRoom(room.sessionid, password);
        };
        
        roomActions.appendChild(joinButton);
        
        roomElement.appendChild(roomTitle);
        roomElement.appendChild(roomInfo);
        roomElement.appendChild(roomActions);
        
        roomList.appendChild(roomElement);
      });
    }
    
    // Unirse a una sala
    function joinRoom(roomId, password = '') {
      // Si la sala tiene contraseña, verificarla primero
      if (password) {
        socket.emit('is-valid-password', password, roomId, (isValid, roomid, error) => {
          if (isValid) {
            // Unirse a la sala con la contraseña
            socket.emit('join-room', { 
              sessionid: roomId,
              password: password
            }, (success, error) => {
              if (success) {
                alert(`Unido a la sala: ${roomId}`);
                // Aquí podrías redirigir a la página de chat/video
                window.location.href = `/video-chat.html?room=${roomId}`;
              } else {
                alert('Error al unirse a la sala: ' + error);
              }
            });
          } else {
            alert('Contraseña incorrecta: ' + error);
          }
        });
      } else {
        // Unirse a la sala sin contraseña
        socket.emit('join-room', { sessionid: roomId }, (success, error) => {
          if (success) {
            alert(`Unido a la sala: ${roomId}`);
            // Aquí podrías redirigir a la página de chat/video
            window.location.href = `/video-chat.html?room=${roomId}`;
          } else {
            alert('Error al unirse a la sala: ' + error);
          }
        });
      }
    }
    
    // Event listeners
    refreshBtn.addEventListener('click', getRooms);
    
    // Cargar salas al iniciar
    socket.on('connect', () => {
      console.log('Conectado al servidor de señalización');
      getRooms();
    });
  </script>
</body>
</html>
```

## Eventos Personalizados

```javascript
// Registrar un evento personalizado en el servidor
socket.emit('set-custom-socket-event-listener', 'mi-evento-personalizado');

// Enviar un evento personalizado a todos los usuarios
socket.emit('mi-evento-personalizado', {
  tipo: 'notificacion',
  mensaje: 'Esto es un mensaje personalizado',
  timestamp: Date.now()
});

// Escuchar eventos personalizados
socket.on('mi-evento-personalizado', (data) => {
  console.log('Evento personalizado recibido:', data);
  // Manejar el evento según sea necesario
});
```

## Administración del Servidor

### Panel de Control Básico

```html
<!-- admin-panel.html -->
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Panel de Administración WebRTC</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 20px;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }
    .stat-item {
      text-align: center;
      padding: 15px;
      background: #4CAF50;
      color: white;
      border-radius: 8px;
    }
    .stat-number {
      font-size: 2em;
      font-weight: bold;
    }
    .stat-label {
      font-size: 0.9em;
      opacity: 0.9;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background-color: #f8f9fa;
    }
    button {
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      margin-right: 5px;
    }
    .btn-danger {
      background-color: #dc3545;
      color: white;
    }
    .btn-warning {
      background-color: #ffc107;
      color: black;
    }
    .refresh-btn {
      background-color: #007bff;
      color: white;
      padding: 10px 20px;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Panel de Administración WebRTC</h1>
    
    <button class="refresh-btn" onclick="loadData()">🔄 Actualizar Datos</button>
    
    <!-- Estadísticas -->
    <div class="card">
      <h2>Estadísticas del Servidor</h2>
      <div class="stats" id="stats">
        <div class="stat-item">
          <div class="stat-number" id="totalRooms">-</div>
          <div class="stat-label">Salas Totales</div>
        </div>
        <div class="stat-item">
          <div class="stat-number" id="totalUsers">-</div>
          <div class="stat-label">Usuarios Conectados</div>
        </div>
        <div class="stat-item">
          <div class="stat-number" id="activeRooms">-</div>
          <div class="stat-label">Salas Activas</div>
        </div>
        <div class="stat-item">
          <div class="stat-number" id="avgUsers">-</div>
          <div class="stat-label">Promedio Usuarios/Sala</div>
        </div>
      </div>
    </div>
    
    <!-- Lista de Salas -->
    <div class="card">
      <h2>Salas Activas</h2>
      <table>
        <thead>
          <tr>
            <th>ID de Sala</th>
            <th>Participantes</th>
            <th>Propietario</th>
            <th>Contraseña</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="roomsTable">
          <tr><td colspan="5">Cargando...</td></tr>
        </tbody>
      </table>
    </div>
    
    <!-- Lista de Usuarios -->
    <div class="card">
      <h2>Usuarios Conectados</h2>
      <table>
        <thead>
          <tr>
            <th>ID de Usuario</th>
            <th>Sala Actual</th>
            <th>Datos Extra</th>
            <th>Conectado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="usersTable">
          <tr><td colspan="5">Cargando...</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  
  <script>
    const API_BASE = 'http://localhost:3001/admin';
    const AUTH_TOKEN = 'Bearer admin-secret-token';
    
    // Función para hacer peticiones autenticadas
    async function apiRequest(endpoint, options = {}) {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': AUTH_TOKEN,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    }
    
    // Cargar estadísticas
    async function loadStats() {
      try {
        const stats = await apiRequest('/stats');
        
        document.getElementById('totalRooms').textContent = stats.totalRooms;
        document.getElementById('totalUsers').textContent = stats.totalUsers;
        document.getElementById('activeRooms').textContent = stats.roomsWithUsers;
        document.getElementById('avgUsers').textContent = stats.averageUsersPerRoom.toFixed(1);
      } catch (error) {
        console.error('Error cargando estadísticas:', error);
      }
    }
    
    // Cargar lista de salas
    async function loadRooms() {
      try {
        const rooms = await apiRequest('/rooms');
        const tbody = document.getElementById('roomsTable');
        
        if (Object.keys(rooms).length === 0) {
          tbody.innerHTML = '<tr><td colspan="5">No hay salas activas</td></tr>';
          return;
        }
        
        tbody.innerHTML = Object.entries(rooms).map(([roomId, room]) => `
          <tr>
            <td>${roomId}</td>
            <td>${room.participants.length}/${room.maxParticipantsAllowed}</td>
            <td>${room.owner || 'N/A'}</td>
            <td>${room.isPasswordProtected ? '🔒 Sí' : '🔓 No'}</td>
            <td>
              <button class="btn-danger" onclick="closeRoom('${roomId}')">Cerrar Sala</button>
            </td>
          </tr>
        `).join('');
      } catch (error) {
        console.error('Error cargando salas:', error);
        document.getElementById('roomsTable').innerHTML = '<tr><td colspan="5">Error cargando datos</td></tr>';
      }
    }
    
    // Cargar lista de usuarios
    async function loadUsers() {
      try {
        const users = await apiRequest('/users');
        const tbody = document.getElementById('usersTable');
        
        if (Object.keys(users).length === 0) {
          tbody.innerHTML = '<tr><td colspan="5">No hay usuarios conectados</td></tr>';
          return;
        }
        
        tbody.innerHTML = Object.entries(users).map(([userId, user]) => `
          <tr>
            <td>${userId}</td>
            <td>${user.connectedWith || 'Ninguna'}</td>
            <td>${JSON.stringify(user.extra || {})}</td>
            <td>${user.socket?.connected ? '🟢 Sí' : '🔴 No'}</td>
            <td>
              <button class="btn-danger" onclick="kickUser('${userId}')">Expulsar</button>
            </td>
          </tr>
        `).join('');
      } catch (error) {
        console.error('Error cargando usuarios:', error);
        document.getElementById('usersTable').innerHTML = '<tr><td colspan="5">Error cargando datos</td></tr>';
      }
    }
    
    // Expulsar usuario
    async function kickUser(userId) {
      if (!confirm(`¿Estás seguro de que quieres expulsar al usuario ${userId}?`)) {
        return;
      }
      
      try {
        const result = await apiRequest(`/users/${userId}/kick`, { method: 'POST' });
        
        if (result.success) {
          alert('Usuario expulsado exitosamente');
          loadData();
        } else {
          alert('Error: ' + result.message);
        }
      } catch (error) {
        console.error('Error expulsando usuario:', error);
        alert('Error al expulsar usuario');
      }
    }
    
    // Cerrar sala
    async function closeRoom(roomId) {
      if (!confirm(`¿Estás seguro de que quieres cerrar la sala ${roomId}?`)) {
        return;
      }
      
      try {
        const result = await apiRequest(`/rooms/${roomId}/close`, { method: 'POST' });
        
        if (result.success) {
          alert('Sala cerrada exitosamente');
          loadData();
        } else {
          alert('Error: ' + result.message);
        }
      } catch (error) {
        console.error('Error cerrando sala:', error);
        alert('Error al cerrar sala');
      }
    }
    
    // Cargar todos los datos
    async function loadData() {
      await Promise.all([
        loadStats(),
        loadRooms(),
        loadUsers()
      ]);
    }
    
    // Cargar datos al iniciar
    loadData();
    
    // Actualizar datos cada 30 segundos
    setInterval(loadData, 30000);
  </script>
</body>
</html>
```

### Script de Monitoreo del Servidor

```javascript
// server-monitor.js
import { defaultSignal } from './path-to-signaling-server';
import fs from 'fs';
import path from 'path';

class ServerMonitor {
  constructor(logFile = 'server-stats.log') {
    this.logFile = logFile;
    this.startTime = Date.now();
    this.stats = {
      totalConnections: 0,
      totalDisconnections: 0,
      peakConcurrentUsers: 0,
      peakConcurrentRooms: 0
    };
  }
  
  // Obtener estadísticas actuales
  getCurrentStats() {
    const rooms = defaultSignal.getRooms();
    const users = defaultSignal.getUsers();
    
    const currentUsers = Object.keys(users).length;
    const currentRooms = Object.keys(rooms).length;
    
    // Actualizar picos
    if (currentUsers > this.stats.peakConcurrentUsers) {
      this.stats.peakConcurrentUsers = currentUsers;
    }
    
    if (currentRooms > this.stats.peakConcurrentRooms) {
      this.stats.peakConcurrentRooms = currentRooms;
    }
    
    return {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      current: {
        users: currentUsers,
        rooms: currentRooms,
        activeRooms: Object.values(rooms).filter(room => room.participants.length > 0).length
      },
      peaks: {
        users: this.stats.peakConcurrentUsers,
        rooms: this.stats.peakConcurrentRooms
      },
      totals: {
        connections: this.stats.totalConnections,
        disconnections: this.stats.totalDisconnections
      },
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    };
  }
  
  // Registrar conexión
  logConnection(userId) {
    this.stats.totalConnections++;
    console.log(`✅ Usuario conectado: ${userId} (Total: ${this.stats.totalConnections})`);
  }
  
  // Registrar desconexión
  logDisconnection(userId) {
    this.stats.totalDisconnections++;
    console.log(`❌ Usuario desconectado: ${userId} (Total: ${this.stats.totalDisconnections})`);
  }
  
  // Guardar estadísticas en archivo
  saveStats() {
    const stats = this.getCurrentStats();
    const logEntry = JSON.stringify(stats) + '\n';
    
    fs.appendFileSync(this.logFile, logEntry);
  }
  
  // Generar reporte
  generateReport() {
    const stats = this.getCurrentStats();
    
    console.log('\n📊 REPORTE DEL SERVIDOR WebRTC');
    console.log('================================');
    console.log(`⏱️  Tiempo activo: ${Math.floor(stats.uptime / 1000 / 60)} minutos`);
    console.log(`👥 Usuarios actuales: ${stats.current.users}`);
    console.log(`🏠 Salas actuales: ${stats.current.rooms} (${stats.current.activeRooms} activas)`);
    console.log(`📈 Pico de usuarios: ${stats.peaks.users}`);
    console.log(`📈 Pico de salas: ${stats.peaks.rooms}`);
    console.log(`🔗 Total conexiones: ${stats.totals.connections}`);
    console.log(`💔 Total desconexiones: ${stats.totals.disconnections}`);
    console.log(`💾 Memoria usada: ${Math.round(stats.memory.heapUsed / 1024 / 1024)} MB`);
    console.log('================================\n');
    
    return stats;
  }
  
  // Iniciar monitoreo
  start(intervalMinutes = 5) {
    console.log(`🚀 Iniciando monitoreo del servidor (cada ${intervalMinutes} minutos)`);
    
    // Generar reporte inicial
    this.generateReport();
    
    // Programar reportes periódicos
    setInterval(() => {
      this.generateReport();
      this.saveStats();
    }, intervalMinutes * 60 * 1000);
    
    // Guardar estadísticas cada minuto
    setInterval(() => {
      this.saveStats();
    }, 60 * 1000);
  }
}

// Crear instancia del monitor
const monitor = new ServerMonitor();

// Exportar para uso en otros módulos
export default monitor;

// Si se ejecuta directamente, iniciar monitoreo
if (import.meta.url === `file://${process.argv[1]}`) {
  monitor.start();
}
```

Estos ejemplos proporcionan una base sólida para implementar diferentes funcionalidades utilizando el servidor de señalización WebRTC, incluyendo herramientas de administración y monitoreo que aprovechan los métodos de gestión ya disponibles en la clase SignalingServer. Puedes adaptarlos y combinarlos según tus necesidades específicas.