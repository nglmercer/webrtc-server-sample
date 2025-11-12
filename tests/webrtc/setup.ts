/**
 * WebRTC Test Setup
 * 
 * Configuración global para los tests de WebRTC con manejo mejorado de timeouts
 * y utilidades de testing reutilizables.
 */

// Configuración global de timeouts para tests
export const TEST_TIMEOUTS = {
  SHORT: 1000,      // Para operaciones rápidas
  MEDIUM: 5000,     // Para operaciones estándar
  LONG: 15000,      // Para operaciones complejas
  CONNECTION: 10000, // Para establecimiento de conexiones
  ICE_GATHERING: 8000 // Para recolección de candidatos ICE
} as const;

// Configuración de retries para tests inestables
export const TEST_RETRIES = {
  CONNECTION: 2,    // Reintentos para conexiones
  NETWORK: 1,       // Reintentos para operaciones de red
  TIMEOUT: 0        // Sin reintentos para timeouts explícitos
} as const;

/**
 * Utilidad para crear promises con timeout controlado
 */
export function createTimeoutPromise<T>(
  promise: Promise<T>, 
  timeoutMs: number,
  timeoutMessage: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    })
  ]);
}

/**
 * Utilidad para esperar con timeout controlado
 */
export function waitFor(
  condition: () => boolean,
  timeoutMs: number = TEST_TIMEOUTS.MEDIUM,
  intervalMs: number = 100
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = () => {
      if (condition()) {
        resolve();
        return;
      }
      
      if (Date.now() - startTime > timeoutMs) {
        reject(new Error(`Condition not met within ${timeoutMs}ms`));
        return;
      }
      
      setTimeout(check, intervalMs);
    };
    
    check();
  });
}

/**
 * Utilidad para crear datos mock de WebRTC
 */
export const mockWebRTCData = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ],
  
  mockSessionDescription: {
    type: 'offer' as const,
    sdp: 'v=0\r\no=- 123456789 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n'
  },
  
  mockIceCandidate: {
    candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 54400 typ host',
    sdpMid: '0',
    sdpMLineIndex: 0
  },
  
  mockStream: {
    id: 'mock-stream-1',
    active: true,
    getAudioTracks: () => [{ id: 'audio-track-1', enabled: true }],
    getVideoTracks: () => [{ id: 'video-track-1', enabled: true }],
    getTracks: () => [
      { id: 'audio-track-1', enabled: true },
      { id: 'video-track-1', enabled: true }
    ],
    addTrack: () => {},
    removeTrack: () => {},
    clone: function() { return { ...this }; }
  } as any
};

/**
 * Clase base para manejar cleanup en tests
 */
export class TestCleanup {
  private cleanupFunctions: Array<() => void | Promise<void>> = [];
  
  addCleanup(fn: () => void | Promise<void>) {
    this.cleanupFunctions.push(fn);
  }
  
  async cleanup() {
    for (const fn of this.cleanupFunctions) {
      try {
        await fn();
      } catch (error) {
        console.warn('Cleanup function failed:', error);
      }
    }
    this.cleanupFunctions = [];
  }
}

/**
 * Wrapper para tests con manejo automático de cleanup
 */
export function withCleanup(testFn: (cleanup: TestCleanup) => void | Promise<void>) {
  return async () => {
    const cleanup = new TestCleanup();
    try {
      await testFn(cleanup);
    } finally {
      await cleanup.cleanup();
    }
  };
}

/**
 * Configuración global para Bun tests
 */
if (typeof global !== 'undefined') {
  // Configurar timeouts por defecto para todos los tests
  (global as any).TEST_TIMEOUTS = TEST_TIMEOUTS;
  (global as any).TEST_RETRIES = TEST_RETRIES;
}

export default {
  TEST_TIMEOUTS,
  TEST_RETRIES,
  createTimeoutPromise,
  waitFor,
  mockWebRTCData,
  TestCleanup,
  withCleanup
};
