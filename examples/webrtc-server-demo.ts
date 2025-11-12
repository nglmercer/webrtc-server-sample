/**
 * Demostración de WebRTC Server-to-Server con Enhanced WebRTC
 * 
 * Este ejemplo muestra cómo usar Enhanced WebRTC para comunicación
 * entre servidores sin necesidad de cliente frontend
 */

import { EnhancedWebRTC } from '../src/webrtc/enhanced-webrtc';
import type { EnhancedWebRTCConfig } from '../src/webrtc/enhanced-webrtc';

// Configuración para ambos servidores WebRTC
const createWebRTCConfig = (userId: string, roomId: string): EnhancedWebRTCConfig => ({
  enableMultiPeer: true,
  enableMessageQueuing: true,
  enableLocalSignaling: true,
  roomId: roomId,
  maxPeers: 5,
  autoConnect: true,
  messageQueueSize: 100,
  connectionTimeout: 15000,
  debug: true,
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ],
  userId
});

// Clase para demostrar WebRTC Server
class WebRTCServer {
  private webrtc: EnhancedWebRTC;
  private serverId: string;
  private messageCount: number = 0;

  constructor(userId: string, roomId: string) {
    this.serverId = userId;
    
    console.log(`🚀 Iniciando servidor WebRTC: ${userId}`);
    
    // Crear instancia Enhanced WebRTC
    this.webrtc = new EnhancedWebRTC(createWebRTCConfig(userId, roomId));
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Conexión de peers
    this.webrtc.on('peer-connected', (peerId: string) => {
      console.log(`✅ [${this.serverId}] Peer conectado:`, peerId);
    });

    this.webrtc.on('peer-disconnected', (peerId: string) => {
      console.log(`❌ [${this.serverId}] Peer desconectado:`, peerId);
    });

    this.webrtc.on('peer-joined', (peerInfo: any) => {
      console.log(`👋 [${this.serverId}] Peer joined room:`, peerInfo);
    });

    this.webrtc.on('peer-left', (peerInfo: any) => {
      console.log(`👋 [${this.serverId}] Peer left room:`, peerInfo);
    });

    // Mensajes
    this.webrtc.on('message', (message: any) => {
      this.messageCount++;
      console.log(`📨 [${this.serverId}] Mensaje #${this.messageCount}:`, message);
      
      // Echo automático para demostrar comunicación bidireccional
      if (message.content?.type !== 'echo') {
        this.sendToPeer(message.from, {
          type: 'echo',
          original: message.content,
          timestamp: Date.now(),
          fromServer: this.serverId
        });
      }
    });

    // Data channels
    this.webrtc.on('data-channel-created', (info: any) => {
      console.log(`🔗 [${this.serverId}] Data channel creado:`, info);
    });

    this.webrtc.on('data-channel-open', (info: any) => {
      console.log(`🔓 [${this.serverId}] Data channel abierto:`, info);
    });

    // Errores
    this.webrtc.on('peer-error', (error: any) => {
      console.error(`❌ [${this.serverId}] Error de peer:`, error);
    });

    // Conexión establecida
    this.webrtc.on('connected', () => {
      console.log(`🔗 [${this.serverId}] Conectado al servidor de signaling`);
    });

    this.webrtc.on('disconnect', () => {
      console.log(`🔌 [${this.serverId}] Desconectado del servidor de signaling`);
    });
  }

  // Conectar al servidor de signaling
  async connect(): Promise<void> {
    console.log(`🔗 [${this.serverId}] Conectando al servidor de signaling...`);
    
    try {
      await this.webrtc.connect();
      console.log(`✅ [${this.serverId}] Conectado exitosamente`);
    } catch (error) {
      console.error(`❌ [${this.serverId}] Error conectando:`, error);
      throw error;
    }
  }

  // Conectar a otro peer específico
  async connectToPeer(peerId: string): Promise<void> {
    console.log(`🔗 [${this.serverId}] Iniciando conexión con ${peerId}`);
    
    try {
      await this.webrtc.connectToPeer(peerId);
      console.log(`📤 [${this.serverId}] Solicitud de conexión enviada a ${peerId}`);
    } catch (error) {
      console.error(`❌ [${this.serverId}] Error conectando a ${peerId}:`, error);
      throw error;
    }
  }

  // Enviar mensaje a un peer específico
  sendToPeer(targetPeerId: string, content: any): void {
    console.log(`📤 [${this.serverId}] Enviando mensaje a ${targetPeerId}:`, content);
    
    try {
      this.webrtc.sendToPeer(targetPeerId, JSON.stringify(content));
    } catch (error) {
      console.error(`❌ [${this.serverId}] Error enviando mensaje:`, error);
    }
  }

  // Broadcast a todos los peers conectados
  broadcast(content: any): void {
    console.log(`📢 [${this.serverId}] Broadcasting...:`, content);
    
    try {
      this.webrtc.broadcast(JSON.stringify(content));
    } catch (error) {
      console.error(`❌ [${this.serverId}] Error en broadcast:`, error);
    }
  }

  // Crear data channel para un peer específico
  createDataChannelForPeer(peerId: string, label: string, options: any = {}): void {
    console.log(`🔗 [${this.serverId}] Creando data channel '${label}' para ${peerId}`);
    
    try {
      this.webrtc.createDataChannelForPeer(peerId, label, {
        ordered: true,
        maxRetransmits: 3,
        ...options
      });
    } catch (error) {
      console.error(`❌ [${this.serverId}] Error creando data channel:`, error);
    }
  }

  // Obtener lista de peers conectados
  getConnectedPeers(): string[] {
    return this.webrtc.getConnectedPeers();
  }

  // Obtener lista de todos los peers
  getAllPeers(): string[] {
    return this.webrtc.getAllPeers();
  }

  // Obtener estadísticas
  async getStats(): Promise<any> {
    try {
      const basicStats = await this.webrtc.getStats();
      const enhancedStats = this.webrtc.getEnhancedStats();
      
      return {
        basic: basicStats,
        enhanced: enhancedStats,
        messageCount: this.messageCount
      };
    } catch (error) {
      console.error(`❌ [${this.serverId}] Error obteniendo estadísticas:`, error);
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  // Obtener información del servidor
  getInfo(): any {
    return {
      serverId: this.serverId,
      providerType: this.webrtc.getProviderType(),
      configuration: this.webrtc.getConfiguration(),
      isConnected: this.webrtc.isConnected(),
      connectedPeers: this.getConnectedPeers(),
      allPeers: this.getAllPeers(),
      messageCount: this.messageCount
    };
  }

  // Desconectar
  disconnect(): void {
    console.log(`👋 [${this.serverId}] Desconectando...`);
    this.webrtc.disconnect();
  }
}

// Demo principal
async function runWebRTCDemo(): Promise<void> {
  console.log('🎬 Iniciando Demo WebRTC Server-to-Server\n');

  // Crear dos servidores WebRTC en la misma sala
  const server1 = new WebRTCServer('server-alpha', 'demo-room-server');
  const server2 = new WebRTCServer('server-beta', 'demo-room-server');

  try {
    console.log('\n🔗 Conectando servidores al signaling...\n');

    // Conectar ambos servidores al servidor de signaling local
    await server1.connect();
    await server2.connect();

    // Esperar a que se establezca la conexión
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n📊 Estado inicial de los servidores:');
    console.log('Server Alpha:', server1.getInfo());
    console.log('Server Beta:', server2.getInfo());

    console.log('\n🔗 Verificando conexión P2P entre servidores...\n');

    // Esperar a que se establezca la conexión P2P automáticamente
    // (ya se conectaron al unirse a la sala)
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n📊 Estado después de conexión P2P:');
    console.log('Server Alpha:', server1.getInfo());
    console.log('Server Beta:', server2.getInfo());

    console.log('\n📨 Probando comunicación P2P...\n');

    // Server Alpha envía mensaje a Server Beta
    server1.sendToPeer('server-beta', {
      type: 'greeting',
      message: 'Hola desde Server Alpha!',
      timestamp: Date.now()
    });

    // Esperar procesamiento
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Server Beta responde
    server2.sendToPeer('server-alpha', {
      type: 'response',
      message: 'Respuesta desde Server Beta!',
      timestamp: Date.now()
    });

    // Esperar procesamiento
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n🔗 Creando data channels específicos...\n');

    // Server Alpha crea data channel para Server Beta
    server1.createDataChannelForPeer('server-beta', 'file-transfer', {
      ordered: false,
      maxRetransmits: 0
    });

    // Server Beta crea data channel para Server Alpha
    server2.createDataChannelForPeer('server-alpha', 'control-channel');

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n📢 Probando broadcast...\n');

    // Server Alpha hace broadcast
    server1.broadcast({
      type: 'announcement',
      message: 'Broadcast desde Server Alpha',
      timestamp: Date.now()
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n📊 Obteniendo estadísticas finales...\n');

    // Mostrar estadísticas
    const stats1 = await server1.getStats();
    const stats2 = await server2.getStats();

    console.log('📈 Server Alpha Stats:', stats1);
    console.log('📈 Server Beta Stats:', stats2);

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n🧪 Probando desconexión...\n');

    // Simular desconexión (solo disconnect total disponible)
    console.log('🔌 Desconectando Server Alpha...');
    server1.disconnect();

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n📊 Estado después de desconexión:');
    console.log('Server Alpha:', server1.getInfo());
    console.log('Server Beta:', server2.getInfo());

    console.log('\n✅ Demo completada exitosamente!');

  } catch (error) {
    console.error('❌ Error en la demo:', error);
  } finally {
    // Limpiar
    server1.disconnect();
    server2.disconnect();
  }
}

// Demo simple para prueba rápida
async function runSimpleDemo(): Promise<void> {
  console.log('🎬 Iniciando Demo Simple WebRTC\n');

  const server = new WebRTCServer('test-server', 'demo-room-simple');

  try {
    await server.connect();
    
    console.log('\n📊 Información del servidor:');
    console.log(server.getInfo());
    
    console.log('\n✅ Demo simple completada!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    server.disconnect();
  }
}

// Ejecutar demo
if (require.main === module) {
  const demoType = process.argv[2] || 'full';
  
  if (demoType === 'simple') {
    runSimpleDemo()
      .then(() => {
        console.log('\n🏁 Demo simple finalizada');
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n💥 Error fatal:', error);
        process.exit(1);
      });
  } else {
    runWebRTCDemo()
      .then(() => {
        console.log('\n🏁 Demo finalizada');
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n💥 Error fatal:', error);
        process.exit(1);
      });
  }
}

export { WebRTCServer, runWebRTCDemo, runSimpleDemo };
