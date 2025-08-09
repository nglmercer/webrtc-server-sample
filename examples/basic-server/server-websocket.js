// Ejemplo: Servidor Básico con WebSocket Nativo
const express = require('express');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const config = require('./config');

// Importar el servidor de señalización y adaptador
const { signaling_server } = require('../../dist/signaling_server');
const { WebSocketAdapter } = require('../../dist/WebSocketAdapter');

// Crear aplicación Express
const app = express();
const server = createServer(app);

// Configurar WebSocket Server
const wss = new WebSocketServer({ 
  server,
  path: '/socket.io/',
  perMessageDeflate: false
});

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index-websocket.html'));
});

// Configurar el servidor de señalización
wss.on('connection', (ws, request) => {
  console.log(`✅ Nueva conexión WebSocket desde: ${request.socket.remoteAddress}`);
  
  // Crear adaptador para WebSocket nativo
  const socketAdapter = new WebSocketAdapter(ws);
  
  // Inicializar el servidor de señalización
  signaling_server(socketAdapter, {
    enableLogs: config.enableLogs,
    maxParticipantsAllowed: config.maxParticipantsAllowed
  });
  
  // Eventos adicionales para monitoreo
  ws.on('close', (code, reason) => {
    console.log(`❌ WebSocket cerrado: ${socketAdapter.id} - Código: ${code}, Razón: ${reason}`);
  });
  
  ws.on('error', (error) => {
    console.error(`🚨 Error en WebSocket ${socketAdapter.id}:`, error);
  });
  
  ws.on('pong', () => {
    console.log(`💓 Pong recibido de ${socketAdapter.id}`);
  });
});

// Implementar heartbeat para detectar conexiones muertas
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log(`💀 Terminando conexión muerta: ${ws.socketAdapter?.id}`);
      return ws.terminate();
    }
    
    ws.isAlive = false;
    ws.ping();
  });
}, config.heartbeatInterval || 30000);

// Manejo de errores del servidor
server.on('error', (error) => {
  console.error('🚨 Error del servidor:', error);
});

wss.on('error', (error) => {
  console.error('🚨 Error del WebSocket Server:', error);
});

// Iniciar servidor
server.listen(config.port, () => {
  console.log('🚀 Servidor de señalización WebRTC iniciado');
  console.log(`📡 WebSocket nativo ejecutándose en ws://localhost:${config.port}`);
  console.log(`📊 Logs habilitados: ${config.enableLogs}`);
  console.log(`👥 Máximo participantes por sala: ${config.maxParticipantsAllowed}`);
  console.log(`💓 Heartbeat cada: ${config.heartbeatInterval || 30000}ms`);
  console.log('\n📋 Endpoints disponibles:');
  console.log(`   • http://localhost:${config.port} - Cliente de prueba`);
  console.log(`   • ws://localhost:${config.port}/socket.io/ - Conexión WebSocket`);
});

// Manejo de cierre graceful
process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando servidor...');
  
  // Limpiar heartbeat
  clearInterval(heartbeatInterval);
  
  // Cerrar todas las conexiones WebSocket
  wss.clients.forEach((ws) => {
    ws.close(1000, 'Servidor cerrando');
  });
  
  // Cerrar servidor
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

// Exportar para uso en otros módulos
module.exports = { app, server, wss };