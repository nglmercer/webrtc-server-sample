// Configuración del Servidor Básico
module.exports = {
  // Puerto del servidor
  port: process.env.PORT || 3000,
  
  // Configuración de CORS
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  
  // Habilitar logs del servidor de señalización
  enableLogs: process.env.ENABLE_LOGS !== 'false',
  
  // Máximo número de participantes por sala
  maxParticipantsAllowed: parseInt(process.env.MAX_PARTICIPANTS) || 10,
  
  // Intervalo de heartbeat para WebSocket nativo (ms)
  heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL) || 30000,
  
  // Configuración de la aplicación
  app: {
    name: 'Servidor WebRTC Básico',
    version: '1.0.0',
    description: 'Ejemplo básico de servidor de señalización WebRTC'
  },
  
  // Configuración de desarrollo
  development: {
    // Mostrar información detallada de conexiones
    verboseLogging: process.env.NODE_ENV === 'development',
    
    // Recargar automáticamente en cambios
    hotReload: process.env.NODE_ENV === 'development'
  },
  
  // Límites de recursos
  limits: {
    // Máximo número de salas simultáneas
    maxRooms: parseInt(process.env.MAX_ROOMS) || 100,
    
    // Máximo número de usuarios conectados
    maxUsers: parseInt(process.env.MAX_USERS) || 1000,
    
    // Tamaño máximo de mensaje (bytes)
    maxMessageSize: parseInt(process.env.MAX_MESSAGE_SIZE) || 64 * 1024, // 64KB
    
    // Tiempo de vida de sala inactiva (ms)
    roomInactivityTimeout: parseInt(process.env.ROOM_TIMEOUT) || 30 * 60 * 1000 // 30 minutos
  },
  
  // Configuración de seguridad
  security: {
    // Habilitar validación de origen
    validateOrigin: process.env.VALIDATE_ORIGIN === 'true',
    
    // Lista de orígenes permitidos
    allowedOrigins: process.env.ALLOWED_ORIGINS ? 
      process.env.ALLOWED_ORIGINS.split(',') : 
      ['http://localhost:3000', 'http://127.0.0.1:3000'],
    
    // Habilitar rate limiting
    enableRateLimit: process.env.ENABLE_RATE_LIMIT === 'true',
    
    // Máximo de conexiones por IP
    maxConnectionsPerIP: parseInt(process.env.MAX_CONNECTIONS_PER_IP) || 10
  }
};