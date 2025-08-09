/**
 * Módulo de Heartbeat para WebRTC Signaling Server
 *
 * Este módulo proporciona funcionalidades para:
 * - Detección automática de conexiones perdidas
 * - Sistema de ping/pong para mantener conexiones activas
 * - Limpieza automática de recursos
 * - Métricas de conexión en tiempo real
 */
export { HeartbeatManager, type HeartbeatConfig, type HeartbeatEvents, defaultHeartbeatManager } from './HeartbeatManager.js';
export { HeartbeatConfigs, getHeartbeatConfig, createCustomHeartbeatConfig, validateHeartbeatConfig, getHeartbeatConfigFromEnv } from './config.js';
export type { HeartbeatConfig as IHeartbeatConfig } from './HeartbeatManager.js';
//# sourceMappingURL=index.d.ts.map