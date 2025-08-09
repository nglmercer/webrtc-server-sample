import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import path from 'path';
import { SignalingServer } from '../src/signal_server';
import { WebSocketAdapter } from '../src/adapters/WebSocketAdapter';
import { logger } from '../src/logger';
import statsRoutes from './api/statsRoutes';
import { getHeartbeatConfig } from '../src/heartbeat';

// Configuración del servidor
interface ServerConfig {
  port: number;
  enableCors: boolean;
  corsOrigin: string;
  enableHeartbeat: boolean;
  heartbeatConfig?: any;
  enableSocketIO: boolean;
  enableWebSocket: boolean;
  enableStats: boolean;
  maxParticipants: number;
}

const defaultConfig: ServerConfig = {
  port: parseInt(process.env.PORT || '3000'),
  enableCors: process.env.ENABLE_CORS !== 'false',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  enableHeartbeat: process.env.ENABLE_HEARTBEAT !== 'false',
  enableSocketIO: process.env.ENABLE_SOCKETIO !== 'false',
  enableWebSocket: process.env.ENABLE_WEBSOCKET !== 'false',
  enableStats: process.env.ENABLE_STATS !== 'false',
  maxParticipants: parseInt(process.env.MAX_PARTICIPANTS || '10')
};

export class WebRTCServer {
  private app: express.Application;
  private server: any;
  private io?: SocketIOServer;
  private wss?: WebSocketServer;
  private signalingServer: SignalingServer;
  private config: ServerConfig;

  constructor(config: Partial<ServerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.app = express();
    this.server = createServer(this.app);
    
    // Configurar heartbeat
    const heartbeatConfig = this.config.heartbeatConfig || 
      getHeartbeatConfig(process.env.NODE_ENV as any || 'production');
    
    // Crear servidor de señalización
    this.signalingServer = new SignalingServer({
      enableHeartbeat: this.config.enableHeartbeat,
      heartbeat: heartbeatConfig,
      maxParticipantsAllowed: this.config.maxParticipants
    });
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    
    logger.info('WebRTCServer inicializado', {
      config: this.config,
      heartbeatEnabled: this.config.enableHeartbeat
    });
  }

  private setupMiddleware(): void {
    // CORS
    if (this.config.enableCors) {
      this.app.use(cors({
        origin: this.config.corsOrigin,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true
      }));
    }

    // Middleware básico
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Logging middleware
    this.app.use((req, res, next) => {
      const start = Date.now();
      const requestId = Math.random().toString(36).substr(2, 9);
      
/*       logger.debug('HTTP Request', {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        requestId
      }); */
      
      res.on('finish', () => {
        const duration = Date.now() - start;
/*         logger.debug('HTTP Response', {
          statusCode: res.statusCode,
          duration,
          requestId
        }); */
      });
      
      next();
    });

    // Servir archivos estáticos
    this.app.use(express.static(path.join(__dirname, '../public')));
    this.app.use('/examples', express.static(path.join(__dirname, '../examples')));
  }

  private setupRoutes(): void {
    // Ruta principal
    this.app.get('/', (req, res) => {
      res.json({
        name: 'WebRTC Signaling Server',
        version: '1.0.0',
        status: 'running',
        features: {
          socketIO: this.config.enableSocketIO,
          webSocket: this.config.enableWebSocket,
          heartbeat: this.config.enableHeartbeat,
          stats: this.config.enableStats
        },
        endpoints: {
          socketIO: this.config.enableSocketIO ? '/socket.io/' : null,
          webSocket: this.config.enableWebSocket ? '/ws' : null,
          stats: this.config.enableStats ? '/api/stats' : null,
          examples: '/examples'
        }
      });
    });

    // Rutas de estadísticas
    if (this.config.enableStats) {
      this.app.use('/api/stats', statsRoutes);
    }

    // Ruta de salud
    this.app.get('/health', (req, res) => {
      const stats = this.signalingServer.getConnectionStats();
      const heartbeatStatus = this.signalingServer.getHeartbeatStatus();
      
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        connections: stats.totalUsers,
        rooms: stats.totalRooms,
        heartbeat: heartbeatStatus
      });
    });

    // Ruta para ejemplos
    this.app.get('/examples/client', (req, res) => {
      res.sendFile(path.join(__dirname, '../examples/client-reconnection.html'));
    });

    // Manejo de errores
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Error en aplicación Express:', err);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Error interno'
      });
    });
  }

  private setupWebSocket(): void {
    // Configurar Socket.IO
    if (this.config.enableSocketIO) {
      this.io = new SocketIOServer(this.server, {
        cors: this.config.enableCors ? {
          origin: this.config.corsOrigin,
          methods: ['GET', 'POST']
        } : undefined,
        transports: ['websocket', 'polling']
      });

      this.io.on('connection', (socket) => {
        logger.info('Nueva conexión Socket.IO', {
          socketId: socket.id,
          transport: socket.conn.transport.name
        });

        // Conectar al servidor de señalización
        this.signalingServer.handleConnection(socket);

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
    }

    // Configurar WebSocket nativo
    if (this.config.enableWebSocket) {
      this.wss = new WebSocketServer({
        server: this.server,
        path: '/ws',
        perMessageDeflate: false
      });

      this.wss.on('connection', (ws, request) => {
        const clientIP = request.socket.remoteAddress;
        logger.info('Nueva conexión WebSocket', {
          clientIP,
          userAgent: request.headers['user-agent']
        });

        // Crear adaptador
        const adapter = new WebSocketAdapter(ws, request);

        // Conectar al servidor de señalización
        this.signalingServer.handleConnection(adapter);

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
    }
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server.listen(this.config.port, () => {
          logger.info('Servidor WebRTC iniciado', {});

          console.log(`\n🚀 Servidor WebRTC ejecutándose en puerto ${this.config.port}`);
          console.log(`📡 Socket.IO: ${this.config.enableSocketIO ? 'Habilitado' : 'Deshabilitado'}`);
          console.log(`🔌 WebSocket: ${this.config.enableWebSocket ? 'Habilitado' : 'Deshabilitado'}`);
          console.log(`💓 Heartbeat: ${this.config.enableHeartbeat ? 'Habilitado' : 'Deshabilitado'}`);
          console.log(`📊 Estadísticas: ${this.config.enableStats ? 'Habilitado' : 'Deshabilitado'}`);
          console.log(`\n📋 Endpoints disponibles:`);
          console.log(`   • http://localhost:${this.config.port} - Información del servidor`);
          console.log(`   • http://localhost:${this.config.port}/health - Estado de salud`);
          if (this.config.enableStats) {
            console.log(`   • http://localhost:${this.config.port}/api/stats - Estadísticas`);
          }
          console.log(`   • http://localhost:${this.config.port}/examples/client - Cliente de prueba`);
          if (this.config.enableSocketIO) {
            console.log(`   • ws://localhost:${this.config.port}/socket.io/ - Socket.IO`);
          }
          if (this.config.enableWebSocket) {
            console.log(`   • ws://localhost:${this.config.port}/ws - WebSocket nativo`);
          }

          resolve();
        });

        this.server.on('error', (error: any) => {
          logger.error('Error del servidor:', error);
          reject(error);
        });
      } catch (error) {
        logger.error('Error iniciando servidor:', error);
        reject(error);
      }
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      logger.info('Cerrando servidor WebRTC...',this.config);

      // Detener heartbeat
      this.signalingServer.stopHeartbeat();

      // Cerrar WebSocket Server
      if (this.wss) {
        this.wss.close();
      }

      // Cerrar Socket.IO
      if (this.io) {
        this.io.close();
      }

      // Cerrar servidor HTTP
      this.server.close(() => {
        logger.info('Servidor WebRTC cerrado correctamente', this.config);
        resolve();
      });
    });
  }

  public getStats() {
    return this.signalingServer.getConnectionStats();
  }

  public getHeartbeatStatus() {
    return this.signalingServer.getHeartbeatStatus();
  }

  public getSignalingServer(): SignalingServer {
    return this.signalingServer;
  }
}

// Función para crear y iniciar servidor con configuración por defecto
export async function createWSServer(config?: Partial<ServerConfig>): Promise<WebRTCServer> {
  const server = new WebRTCServer(config);
  await server.start();
  return server;
}

// Manejo de cierre graceful
function setupGracefulShutdown(server: WebRTCServer): void {
  const shutdown = async (signal: string) => {
    logger.info(`Señal ${signal} recibida, cerrando servidor...`, { });
    try {
      await server.stop();
      process.exit(0);
    } catch (error) {
      logger.error('Error durante el cierre:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Exportar instancia por defecto si se ejecuta directamente
  createWSServer()
    .then((server) => {
      setupGracefulShutdown(server);
    })
    .catch((error) => {
      logger.error('Error iniciando servidor:', error);
      process.exit(1);
    });


export default WebRTCServer;