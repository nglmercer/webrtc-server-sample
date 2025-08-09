/**
 * Módulo de Heartbeat para WebRTC Signaling Server
 *
 * Este módulo proporciona funcionalidades para:
 * - Detección automática de conexiones perdidas
 * - Sistema de ping/pong para mantener conexiones activas
 * - Limpieza automática de recursos
 * - Métricas de conexión en tiempo real
 */
export { HeartbeatManager, defaultHeartbeatManager } from './HeartbeatManager.js';
export { HeartbeatConfigs, getHeartbeatConfig, createCustomHeartbeatConfig, validateHeartbeatConfig, getHeartbeatConfigFromEnv } from './config.js';
//# sourceMappingURL=index.js.map