// integration-example.js - Ejemplo de integración del logging con el servidor de señalización

const { getLogger, LogLevel, getConfigForEnvironment } = require('../../src/logger');
const { SignalingServer } = require('../../src/signaling_server');
const { WebSocketAdapter } = require('../../src/adapters/websocket_adapter');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

// Configurar logger según el entorno
const environment = process.env.NODE_ENV || 'development';
const logger = getLogger(getConfigForEnvironment(environment));

console.log('=== Integración del Sistema de Logging ===\n');

// Ejemplo 1: Configuración del servidor con logging mejorado
class LoggedSignalingServer {
  constructor(config = {}) {
    this.config = {
      port: 3000,
      maxParticipants: 100,
      ...config
    };
    
    // Inicializar servidor de señalización
    this.signalingServer = new SignalingServer(this.config);
    
    // Configurar logging para eventos del servidor
    this.setupLogging();
    
    logger.info('SERVER_INIT', 'Servidor de señalización inicializado', {
      port: this.config.port,
      maxParticipants: this.config.maxParticipants,
      environment
    });
  }
  
  setupLogging() {
    // Log de conexiones
    this.signalingServer.on('user-connected', (data) => {
      logger.info('USER_CONNECTED', 'Usuario conectado al servidor', {
        userId: data.userId,
        socketId: data.socketId,
        timestamp: Date.now()
      }, {
        event: 'connection',
        source: 'signaling-server'
      });
    });
    
    // Log de desconexiones
    this.signalingServer.on('user-disconnected', (data) => {
      logger.info('USER_DISCONNECTED', 'Usuario desconectado del servidor', {
        userId: data.userId,
        reason: data.reason,
        duration: data.duration
      }, {
        event: 'disconnection',
        source: 'signaling-server'
      });
    });
    
    // Log de creación de salas
    this.signalingServer.on('room-created', (data) => {
      logger.info('ROOM_CREATED', 'Nueva sala creada', {
        roomId: data.roomId,
        createdBy: data.createdBy,
        maxParticipants: data.maxParticipants
      }, {
        event: 'room-management',
        source: 'signaling-server'
      });
    });
    
    // Log de unión a salas
    this.signalingServer.on('user-joined-room', (data) => {
      logger.info('USER_JOINED_ROOM', 'Usuario se unió a una sala', {
        userId: data.userId,
        roomId: data.roomId,
        participantCount: data.participantCount
      }, {
        event: 'room-management',
        source: 'signaling-server'
      });
    });
    
    // Log de salida de salas
    this.signalingServer.on('user-left-room', (data) => {
      logger.info('USER_LEFT_ROOM', 'Usuario salió de una sala', {
        userId: data.userId,
        roomId: data.roomId,
        remainingParticipants: data.remainingParticipants
      }, {
        event: 'room-management',
        source: 'signaling-server'
      });
    });
    
    // Log de errores
    this.signalingServer.on('error', (error) => {
      logger.error('SIGNALING_ERROR', 'Error en el servidor de señalización', error, {
        event: 'error',
        source: 'signaling-server',
        severity: 'high'
      });
    });
    
    // Log de mensajes WebRTC
    this.signalingServer.on('webrtc-message', (data) => {
      logger.debug('WEBRTC_MESSAGE', 'Mensaje WebRTC procesado', {
        type: data.type,
        from: data.from,
        to: data.to,
        roomId: data.roomId
      }, {
        event: 'webrtc-signaling',
        source: 'signaling-server'
      });
    });
  }
  
  // Método para obtener estadísticas con logging
  getStats() {
    const stats = this.signalingServer.getServerStats();
    
    logger.info('STATS_REQUESTED', 'Estadísticas del servidor solicitadas', stats, {
      event: 'monitoring',
      source: 'admin'
    });
    
    return stats;
  }
  
  // Método para expulsar usuario con logging
  kickUser(userId, reason = 'No especificado') {
    try {
      const result = this.signalingServer.kickUser(userId);
      
      if (result.success) {
        logger.warn('USER_KICKED', 'Usuario expulsado del servidor', {
          userId,
          reason,
          kickedBy: 'admin'
        }, {
          event: 'moderation',
          source: 'admin'
        });
      } else {
        logger.warn('USER_KICK_FAILED', 'Falló la expulsión del usuario', {
          userId,
          reason: result.error
        }, {
          event: 'moderation',
          source: 'admin'
        });
      }
      
      return result;
    } catch (error) {
      logger.error('USER_KICK_ERROR', 'Error al expulsar usuario', error, {
        event: 'moderation',
        source: 'admin',
        userId
      });
      throw error;
    }
  }
  
  // Método para cerrar sala con logging
  closeRoom(roomId, reason = 'No especificado') {
    try {
      const result = this.signalingServer.closeRoom(roomId);
      
      if (result.success) {
        logger.warn('ROOM_CLOSED', 'Sala cerrada por administrador', {
          roomId,
          reason,
          affectedUsers: result.affectedUsers,
          closedBy: 'admin'
        }, {
          event: 'room-management',
          source: 'admin'
        });
      } else {
        logger.warn('ROOM_CLOSE_FAILED', 'Falló el cierre de la sala', {
          roomId,
          reason: result.error
        }, {
          event: 'room-management',
          source: 'admin'
        });
      }
      
      return result;
    } catch (error) {
      logger.error('ROOM_CLOSE_ERROR', 'Error al cerrar sala', error, {
        event: 'room-management',
        source: 'admin',
        roomId
      });
      throw error;
    }
  }
}

// Ejemplo 2: Middleware de logging para Express
function createLoggingMiddleware() {
  return (req, res, next) => {
    const start = Date.now();
    const requestId = Math.random().toString(36).substr(2, 9);
    
    // Log de request entrante
    logger.info('HTTP_REQUEST', 'Request HTTP recibido', {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      requestId
    }, {
      event: 'http',
      source: 'express-middleware'
    });
    
    // Interceptar la respuesta
    const originalSend = res.send;
    res.send = function(data) {
      const duration = Date.now() - start;
      
      logger.info('HTTP_RESPONSE', 'Response HTTP enviado', {
        statusCode: res.statusCode,
        duration,
        contentLength: data ? data.length : 0,
        requestId
      }, {
        event: 'http',
        source: 'express-middleware'
      });
      
      // Log de respuestas lentas
      if (duration > 1000) {
        logger.warn('SLOW_RESPONSE', 'Respuesta HTTP lenta detectada', {
          duration,
          url: req.url,
          method: req.method,
          requestId
        }, {
          event: 'performance',
          source: 'express-middleware'
        });
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
}

// Ejemplo 3: Servidor completo con logging integrado
function createServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocket.Server({ server });
  
  // Aplicar middleware de logging
  app.use(createLoggingMiddleware());
  app.use(express.json());
  
  // Crear servidor de señalización con logging
  const loggedServer = new LoggedSignalingServer();
  
  // Configurar WebSocket con logging
  wss.on('connection', (ws, req) => {
    logger.info('WEBSOCKET_CONNECTION', 'Nueva conexión WebSocket', {
      ip: req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    }, {
      event: 'websocket',
      source: 'ws-server'
    });
    
    // Crear adaptador WebSocket
    const adapter = new WebSocketAdapter(ws);
    
    // Conectar al servidor de señalización
    loggedServer.signalingServer.handleConnection(adapter);
    
    ws.on('close', (code, reason) => {
      logger.info('WEBSOCKET_DISCONNECTION', 'Conexión WebSocket cerrada', {
        code,
        reason: reason.toString(),
        ip: req.socket.remoteAddress
      }, {
        event: 'websocket',
        source: 'ws-server'
      });
    });
    
    ws.on('error', (error) => {
      logger.error('WEBSOCKET_ERROR', 'Error en conexión WebSocket', error, {
        event: 'websocket',
        source: 'ws-server',
        ip: req.socket.remoteAddress
      });
    });
  });
  
  // Rutas de administración con logging
  app.get('/admin/stats', (req, res) => {
    try {
      const stats = loggedServer.getStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error('ADMIN_STATS_ERROR', 'Error al obtener estadísticas', error, {
        event: 'admin-api',
        source: 'express-route'
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });
  
  app.post('/admin/kick-user', (req, res) => {
    try {
      const { userId, reason } = req.body;
      const result = loggedServer.kickUser(userId, reason);
      res.json(result);
    } catch (error) {
      logger.error('ADMIN_KICK_ERROR', 'Error en endpoint de expulsión', error, {
        event: 'admin-api',
        source: 'express-route'
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });
  
  app.post('/admin/close-room', (req, res) => {
    try {
      const { roomId, reason } = req.body;
      const result = loggedServer.closeRoom(roomId, reason);
      res.json(result);
    } catch (error) {
      logger.error('ADMIN_CLOSE_ROOM_ERROR', 'Error en endpoint de cierre de sala', error, {
        event: 'admin-api',
        source: 'express-route'
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });
  
  return { app, server, loggedServer };
}

// Ejemplo 4: Monitoreo de salud del sistema
function setupHealthMonitoring(loggedServer) {
  setInterval(() => {
    const stats = loggedServer.signalingServer.getServerStats();
    const memUsage = process.memoryUsage();
    
    // Log de métricas de salud
    logger.info('HEALTH_CHECK', 'Verificación de salud del sistema', {
      activeUsers: stats.activeUsers,
      activeRooms: stats.activeRooms,
      memoryUsage: {
        rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB'
      },
      uptime: Math.round(process.uptime()) + 's'
    }, {
      event: 'health-monitoring',
      source: 'system-monitor'
    });
    
    // Alertas de salud
    if (memUsage.heapUsed > 100 * 1024 * 1024) { // 100MB
      logger.warn('HIGH_MEMORY_USAGE', 'Uso de memoria alto detectado', {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
        threshold: '100MB'
      }, {
        event: 'health-alert',
        source: 'system-monitor'
      });
    }
    
    if (stats.activeUsers > 80) {
      logger.warn('HIGH_USER_COUNT', 'Número alto de usuarios conectados', {
        activeUsers: stats.activeUsers,
        maxParticipants: loggedServer.config.maxParticipants
      }, {
        event: 'capacity-alert',
        source: 'system-monitor'
      });
    }
  }, 30000); // Cada 30 segundos
}

// Ejemplo de uso
if (require.main === module) {
  const { server, loggedServer } = createServer();
  
  // Configurar monitoreo de salud
  setupHealthMonitoring(loggedServer);
  
  // Manejar cierre graceful
  process.on('SIGTERM', () => {
    logger.info('SHUTDOWN_SIGNAL', 'Señal de cierre recibida', {
      signal: 'SIGTERM'
    }, {
      event: 'system',
      source: 'process'
    });
    
    server.close(() => {
      logger.info('SERVER_SHUTDOWN', 'Servidor cerrado correctamente', {}, {
        event: 'system',
        source: 'process'
      });
      process.exit(0);
    });
  });
  
  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    logger.info('SERVER_STARTED', 'Servidor iniciado y escuchando', {
      port,
      environment,
      pid: process.pid
    }, {
      event: 'system',
      source: 'server'
    });
    
    console.log(`\n🚀 Servidor ejecutándose en puerto ${port}`);
    console.log(`📊 Logs disponibles en: ${logger.getConfig().logDirectory}`);
    console.log(`🔧 Entorno: ${environment}`);
  });
}

module.exports = {
  LoggedSignalingServer,
  createLoggingMiddleware,
  createServer,
  setupHealthMonitoring
};