import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import path from 'path';
import { SignalingServer,WebSocketAdapter,logger,getHeartbeatConfig } from '../dist/index.js'; //prod=  'webrtc-socket-api'  || dev= './index' ../src/signal_server'
//import { WebSocketAdapter } from '../src/adapters/WebSocketAdapter';
//import { logger } from '../src/logger';
//import { getHeartbeatConfig } from '../src/heartbeat';

// Configuración del servidor
const defaultConfig = {
  port: parseInt(process.env.PORT || '9001'),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  maxParticipants: parseInt(process.env.MAX_PARTICIPANTS || '999')
};

const app = express();
const server = createServer(app);

// Obtener configuración de heartbeat por defecto
const heartbeatConfig = getHeartbeatConfig(process.env.NODE_ENV || 'production');

// Crear servidor de señalización
const signalingServer = new SignalingServer({
  enableHeartbeat: true,
  heartbeat: heartbeatConfig,
  maxParticipantsAllowed: defaultConfig.maxParticipants
});

// Middlewares
app.use(cors({
  origin: defaultConfig.corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const publicPath = process.cwd();
app.use(express.static(path.join(publicPath, 'public')));


// Configurar Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: defaultConfig.corsOrigin,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

io.on('connection', (socket) => {
  logger.info('Nueva conexión Socket.IO', {
    socketId: socket.id,
    transport: socket.conn.transport.name
  });
  signalingServer.handleConnection(socket);
  socket.on('disconnect', (reason) => {
    logger.info('Desconexión Socket.IO', {
      socketId: socket.id,
      reason
    });
  });
  socket.on('error', (error) => {
    logger.error('Error Socket.IO', error, {
      socketId: socket.id
    });
  });
});

// Configurar WebSocket nativo
const wss = new WebSocketServer({
  server: server,
  path: '/ws',
  perMessageDeflate: false
});

wss.on('connection', (ws, request) => {
  const clientIP = request.socket.remoteAddress;
  logger.info('Nueva conexión WebSocket', {
    clientIP,
    userAgent: request.headers['user-agent']
  });
  const adapter = new WebSocketAdapter(ws, request);
  signalingServer.handleConnection(adapter);
  ws.on('close', (code, reason) => {
    logger.info('Desconexión WebSocket', {
      socketId: adapter.id,
      code,
      reason: reason.toString(),
      clientIP
    });
  });
  ws.on('error', (error) => {
    logger.error('Error WebSocket', error, {
      socketId: adapter.id,
      clientIP
    });
  });
});

// Iniciar servidor
server.listen(defaultConfig.port, () => {
  logger.info('Servidor WebRTC iniciado', {});
  console.log(`\n🚀 Servidor WebRTC ejecutándose en puerto ${defaultConfig.port}`);
  console.log(`📡 Socket.IO: Habilitado`);
  console.log(`🔌 WebSocket: Habilitado`);
  console.log(`💓 Heartbeat: Habilitado`);
  console.log(`\n📋 Endpoints disponibles:`);
  console.log(`   • ws://localhost:${defaultConfig.port}/socket.io/ - Socket.IO`);
  console.log(`   • ws://localhost:${defaultConfig.port}/ws - WebSocket nativo`);
});

server.on('error', (error) => {
  logger.error('Error del servidor:', error);
});

