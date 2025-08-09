import { type HeartbeatConfig } from './HeartbeatManager.js';
/**
 * Configuraciones predefinidas para diferentes entornos
 */
export declare const HeartbeatConfigs: {
    /**
     * Configuración para desarrollo - más frecuente para debugging
     */
    development: HeartbeatConfig;
    /**
     * Configuración para producción - balanceada para rendimiento
     */
    production: HeartbeatConfig;
    /**
     * Configuración agresiva - para conexiones inestables
     */
    aggressive: HeartbeatConfig;
    /**
     * Configuración conservadora - para ahorrar ancho de banda
     */
    conservative: HeartbeatConfig;
    /**
     * Configuración para testing - rápida para pruebas
     */
    testing: HeartbeatConfig;
};
/**
 * Obtiene una configuración por nombre de entorno
 */
export declare function getHeartbeatConfig(environment: keyof typeof HeartbeatConfigs): HeartbeatConfig;
/**
 * Crea una configuración personalizada basada en una configuración base
 */
export declare function createCustomHeartbeatConfig(baseConfig: keyof typeof HeartbeatConfigs, overrides: Partial<HeartbeatConfig>): HeartbeatConfig;
/**
 * Valida una configuración de heartbeat
 */
export declare function validateHeartbeatConfig(config: Partial<HeartbeatConfig>): string[];
/**
 * Obtiene la configuración desde variables de entorno
 */
export declare function getHeartbeatConfigFromEnv(): Partial<HeartbeatConfig>;
//# sourceMappingURL=config.d.ts.map