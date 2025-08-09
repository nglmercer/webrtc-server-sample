// Ejemplo: Servidor Básico con Socket.IO
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const config = require('./config');

// Importar el servidor de señalización
const { signaling_server } = require('../../dist/signaling_server');

// Crear aplicación Express
const app = express();
const server = createServer(app);

// Configurar Socket.IO
const io = new Server(server, {
  cors: config.cors,
  transports: ['websocket', 'polling']
});

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Configurar el servidor de señalización
io.on('connection', (socket) => {
  console.log(`✅ Nueva conexión: ${socket.id}`);
  
  // Inicializar el servidor de señalización para este socket
  signaling_server(socket, {
    enableLogs: config.enableLogs,
    maxParticipantsAllowed: config.maxParticipantsAllowed
  });
  
  // Eventos adicionales para monitoreo
  socket.on('disconnect', (reason) => {
    console.log(`❌ Desconexión: ${socket.id} - Razón: ${reason}`);
  });
  
  socket.on('error', (error) => {
    console.error(`🚨 Error en socket ${socket.id}:`, error);
  });
});

// Manejo de errores del servidor
server.on('error', (error) => {
  console.error('🚨 Error del servidor:', error);
});

// Iniciar servidor
server.listen(config.port, () => {
  console.log('🚀 Servidor de señalización WebRTC iniciado');
  console.log(`📡 Socket.IO ejecutándose en http://localhost:${config.port}`);
  console.log(`📊 Logs habilitados: ${config.enableLogs}`);
  console.log(`👥 Máximo participantes por sala: ${config.maxParticipantsAllowed}`);
  console.log('\n📋 Endpoints disponibles:');
  console.log(`   • http://localhost:${config.port} - Cliente de prueba`);
  console.log(`   • ws://localhost:${config.port} - Conexión WebSocket`);
});

// Manejo de cierre graceful
process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

// Exportar para uso en otros módulos
module.exports = { app, server, io };