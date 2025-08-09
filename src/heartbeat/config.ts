import {type  HeartbeatConfig } from './HeartbeatManager';

/**
 * Configuraciones predefinidas para diferentes entornos
 */
export const HeartbeatConfigs = {
  /**
   * Configuración para desarrollo - más frecuente para debugging
   */
  development: {
    pingInterval: 15000,    // 15 segundos
    pongTimeout: 5000,      // 5 segundos
    maxFailedPings: 2,      // 2 intentos fallidos
    enableLogging: true     // Logging habilitado
  } as HeartbeatConfig,

  /**
   * Configuración para producción - balanceada para rendimiento
   */
  production: {
    pingInterval: 30000,    // 30 segundos
    pongTimeout: 10000,     // 10 segundos
    maxFailedPings: 3,      // 3 intentos fallidos
    enableLogging: false    // Logging deshabilitado
  } as HeartbeatConfig,

  /**
   * Configuración agresiva - para conexiones inestables
   */
  aggressive: {
    pingInterval: 10000,    // 10 segundos
    pongTimeout: 3000,      // 3 segundos
    maxFailedPings: 2,      // 2 intentos fallidos
    enableLogging: true     // Logging habilitado
  } as HeartbeatConfig,

  /**
   * Configuración conservadora - para ahorrar ancho de banda
   */
  conservative: {
    pingInterval: 60000,    // 60 segundos
    pongTimeout: 15000,     // 15 segundos
    maxFailedPings: 5,      // 5 intentos fallidos
    enableLogging: false    // Logging deshabilitado
  } as HeartbeatConfig,

  /**
   * Configuración para testing - rápida para pruebas
   */
  testing: {
    pingInterval: 5000,     // 5 segundos
    pongTimeout: 2000,      // 2 segundos
    maxFailedPings: 1,      // 1 intento fallido
    enableLogging: true     // Logging habilitado
  } as HeartbeatConfig
};

/**
 * Obtiene una configuración por nombre de entorno
 */
export function getHeartbeatConfig(environment: keyof typeof HeartbeatConfigs): HeartbeatConfig {
  return HeartbeatConfigs[environment];
}

/**
 * Crea una configuración personalizada basada en una configuración base
 */
export function createCustomHeartbeatConfig(
  baseConfig: keyof typeof HeartbeatConfigs,
  overrides: Partial<HeartbeatConfig>
): HeartbeatConfig {
  return {
    ...HeartbeatConfigs[baseConfig],
    ...overrides
  };
}

/**
 * Valida una configuración de heartbeat
 */
export function validateHeartbeatConfig(config: Partial<HeartbeatConfig>): string[] {
  const errors: string[] = [];

  if (config.pingInterval !== undefined) {
    if (config.pingInterval < 1000) {
      errors.push('pingInterval debe ser al menos 1000ms (1 segundo)');
    }
    if (config.pingInterval > 300000) {
      errors.push('pingInterval no debe exceder 300000ms (5 minutos)');
    }
  }

  if (config.pongTimeout !== undefined) {
    if (config.pongTimeout < 500) {
      errors.push('pongTimeout debe ser al menos 500ms');
    }
    if (config.pongTimeout > 60000) {
      errors.push('pongTimeout no debe exceder 60000ms (1 minuto)');
    }
  }

  if (config.maxFailedPings !== undefined) {
    if (config.maxFailedPings < 1) {
      errors.push('maxFailedPings debe ser al menos 1');
    }
    if (config.maxFailedPings > 10) {
      errors.push('maxFailedPings no debe exceder 10');
    }
  }

  // Validación de relación entre parámetros
  if (config.pingInterval && config.pongTimeout) {
    if (config.pongTimeout >= config.pingInterval) {
      errors.push('pongTimeout debe ser menor que pingInterval');
    }
  }

  return errors;
}

/**
 * Obtiene la configuración desde variables de entorno
 */
export function getHeartbeatConfigFromEnv(): Partial<HeartbeatConfig> {
  const config: Partial<HeartbeatConfig> = {};

  if (process.env.HEARTBEAT_PING_INTERVAL) {
    config.pingInterval = parseInt(process.env.HEARTBEAT_PING_INTERVAL, 10);
  }

  if (process.env.HEARTBEAT_PONG_TIMEOUT) {
    config.pongTimeout = parseInt(process.env.HEARTBEAT_PONG_TIMEOUT, 10);
  }

  if (process.env.HEARTBEAT_MAX_FAILED_PINGS) {
    config.maxFailedPings = parseInt(process.env.HEARTBEAT_MAX_FAILED_PINGS, 10);
  }

  if (process.env.HEARTBEAT_ENABLE_LOGGING) {
    config.enableLogging = process.env.HEARTBEAT_ENABLE_LOGGING.toLowerCase() === 'true';
  }

  return config;
}