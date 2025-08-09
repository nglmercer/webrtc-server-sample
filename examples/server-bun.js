import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { SignalingServer } from '../src/signal_server';
import { BunWebSocketAdapter } from '../src/adapters/BunWebSocketAdapter';
import { logger } from '../src/logger';
import { getHeartbeatConfig } from '../src/heartbeat';

// Configuración del servidor
const defaultConfig = {
  port: parseInt(process.env.PORT || '9000'),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  maxParticipants: parseInt(process.env.MAX_PARTICIPANTS || '999')
};

const app = express();

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

// Configurar servidor con Bun.serve para WebSocket nativo
const server = Bun.serve({
  port: defaultConfig.port,
  fetch(req, server) {
    // Intentar upgrade a WebSocket para rutas específicas
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      const clientIP = server.requestIP(req);
      logger.info('Intento de conexión WebSocket', {
        clientIP,
        userAgent: req.headers.get('user-agent')
      });
      
      const success = server.upgrade(req, {
        data: {
          clientIP,
          userAgent: req.headers.get('user-agent')
        }
      });
      
      if (success) {
        return undefined; // Upgrade exitoso
      }
      
      return new Response('WebSocket upgrade failed', { status: 400 });
    }
    const filePath = './public' + new URL(req.url).pathname;
    console.log("filePath",filePath)
    new Response(Bun.file(filePath)).headers.get("Content-Type");
  },
  websocket: {
    open(ws) {
      logger.info('Nueva conexión WebSocket', {
        clientIP: ws.data.clientIP,
        userAgent: ws.data.userAgent
      });
      
      const adapter = new BunWebSocketAdapter(ws);
      signalingServer.handleConnection(adapter);
    },
    message(ws, message) {
      // Los mensajes son manejados por el adapter
      const adapter = ws.data.adapter;
      if (adapter) {
        adapter.handleMessage(message);
      }
    },
    close(ws, code, reason) {
      logger.info('Desconexión WebSocket', {
        code,
        reason,
        clientIP: ws.data.clientIP
      });
      
      const adapter = ws.data.adapter;
      if (adapter) {
        adapter.handleClose(code, reason);
      }
    },
    error(ws, error) {
      logger.error('Error WebSocket', error, {
        clientIP: ws.data.clientIP
      });
      
      const adapter = ws.data.adapter;
      if (adapter) {
        adapter.handleError(error);
      }
    }
  }
});

// Crear servidor HTTP separado para Socket.IO
const httpServer = createServer(app);

// Configurar Socket.IO
const io = new SocketIOServer(httpServer, {
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

// Iniciar servidor HTTP en puerto diferente para Socket.IO
const socketIOPort = defaultConfig.port + 1;
httpServer.listen(socketIOPort, () => {
  logger.info('Servidor Socket.IO iniciado', { port: socketIOPort });
});

console.log(`\n🚀 Servidor WebRTC ejecutándose en puerto ${defaultConfig.port}`);
console.log(`📡 Socket.IO: Puerto ${socketIOPort}`);
console.log(`🔌 WebSocket nativo: Puerto ${defaultConfig.port}/ws`);
console.log(`💓 Heartbeat: Habilitado`);
console.log(`\n📋 Endpoints disponibles:`);
console.log(`   • ws://localhost:${socketIOPort}/socket.io/ - Socket.IO`);
console.log(`   • ws://localhost:${defaultConfig.port}/ws - WebSocket nativo`);

process.on('SIGINT', () => {
  logger.info('Cerrando servidor...');
  server.stop();
  httpServer.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Cerrando servidor...');
  server.stop();
  httpServer.close();
  process.exit(0);
});