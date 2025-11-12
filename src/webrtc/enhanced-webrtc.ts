/**
 * Enhanced WebRTC Provider for Bun
 * 
 * This module provides an enhanced WebRTC provider that solves three main
 * limitations of WebRTC in Bun:
 * 1. ✅ Messages can be sent before connection is complete (message queuing)
 * 2. ✅ Multiple peers can connect in the same process (multi-peer manager)
 * 3. ✅ Real messaging without external signaling server (local signaling)
 */

import { EventEmitter } from 'events';
import { MultiPeerManager } from './multi-peer-manager.js';
import { getGlobalSignalingServer, resetGlobalSignalingServer } from './signaling-server.js';
import { NodeDataChannelWebRTC } from './node-datachannel.js';
import type {
  WebRTCProvider,
  WebRTCConfig,
  RTCConfiguration,
  RTCSessionDescriptionInit,
  RTCIceCandidateInit,
  RTCDataChannelInit,
  RTCDataChannel,
  RTCStatsReport,
  RTCOfferOptions,
  RTCAnswerOptions,
  MediaStream,
} from './types.js';

export interface EnhancedWebRTCConfig extends WebRTCConfig {
  // Enhanced features
  enableMultiPeer?: boolean;
  enableMessageQueuing?: boolean;
  enableLocalSignaling?: boolean;
  
  // Multi-peer settings
  roomId?: string;
  maxPeers?: number;
  autoConnect?: boolean;
  
  // Message queuing settings
  messageQueueSize?: number;
  connectionTimeout?: number;
  
  // Backward compatibility
  legacyMode?: boolean;
}

/**
 * Enhanced WebRTC Provider
 * 
 * Solves main WebRTC limitations in Bun by providing:
 * - Message queuing for pre-connection messaging
 * - Multi-peer connections in same process
 * - Local signaling server for real-time communication
 */
export class EnhancedWebRTC extends EventEmitter implements WebRTCProvider {
  private config: EnhancedWebRTCConfig;
  private multiPeerManager?: MultiPeerManager;
  private legacyProvider?: NodeDataChannelWebRTC;
  private connected = false;
  private isInitialized = false;

  constructor(config: EnhancedWebRTCConfig = {}) {
    super();
    
    this.config = {
      // Enhanced features defaults
      enableMultiPeer: true,
      enableMessageQueuing: true,
      enableLocalSignaling: true,
      
      // Multi-peer defaults
      roomId: 'enhanced-webrtc-room',
      maxPeers: 10,
      autoConnect: true,
      
      // Message queuing defaults
      messageQueueSize: 1000,
      connectionTimeout: 30000,
      
      // WebRTC defaults
      debug: false,
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      
      ...config
    };

    if (this.config.debug) {
      console.log('EnhancedWebRTC initialized with config:', this.config);
    }
  }

  /**
   * Initialize enhanced WebRTC provider
   */
  async connect(config?: EnhancedWebRTCConfig): Promise<void> {
    if (this.connected) {
      throw new Error('Already connected');
    }

    // Merge configs
    const finalConfig = { ...this.config, ...config };
    this.config = finalConfig;

    try {
      if (finalConfig.legacyMode) {
        // Use legacy single-peer mode
        await this.connectLegacy(finalConfig);
      } else {
        // Use enhanced multi-peer mode
        await this.connectEnhanced(finalConfig);
      }

      this.connected = true;
      this.isInitialized = true;
      this.emit('connected');

      if (finalConfig.debug) {
        console.log(`EnhancedWebRTC connected in ${finalConfig.legacyMode ? 'legacy' : 'enhanced'} mode`);
      }
    } catch (error) {
      console.error('Failed to connect EnhancedWebRTC:', error);
      throw error;
    }
  }

  /**
   * Disconnect from all peers and clean up
   */
  disconnect(): void {
    if (!this.connected) return;

    try {
      if (this.multiPeerManager) {
        this.multiPeerManager.disconnectAll();
        this.multiPeerManager = undefined;
      }

      if (this.legacyProvider) {
        this.legacyProvider.disconnect();
        this.legacyProvider = undefined;
      }

      this.connected = false;
      this.isInitialized = false;
      this.emit('disconnect');

      if (this.config.debug) {
        console.log('EnhancedWebRTC disconnected');
      }
    } catch (error) {
      console.error('Error during disconnect:', error);
    }
  }

  /**
   * Check if connected to at least one peer
   */
  isConnected(): boolean {
    if (this.config.legacyMode) {
      return this.legacyProvider?.isConnected() || false;
    }

    // Return true if multi-peer manager is initialized (even without connected peers)
    return Boolean(this.multiPeerManager && this.multiPeerManager['isInitialized']);
  }

  /**
   * Send a message to a specific peer
   */
  sendToPeer(peerId: string, data: string | ArrayBuffer | ArrayBufferView, channelLabel: string = 'default'): void {
    if (this.config.legacyMode) {
      throw new Error('sendToPeer not available in legacy mode. Use EnhancedWebRTC with legacyMode: false');
    }

    if (!this.multiPeerManager) {
      throw new Error('Multi-peer manager not initialized. Call connect() first.');
    }

    this.multiPeerManager.sendToPeer(peerId, data, channelLabel);
  }

  /**
   * Broadcast a message to all connected peers
   */
  broadcast(data: string | ArrayBuffer | ArrayBufferView, channelLabel: string = 'default'): void {
    if (this.config.legacyMode) {
      throw new Error('broadcast not available in legacy mode. Use EnhancedWebRTC with legacyMode: false');
    }

    if (!this.multiPeerManager) {
      throw new Error('Multi-peer manager not initialized. Call connect() first.');
    }

    this.multiPeerManager.broadcast(data, channelLabel);
  }

  /**
   * Connect to a specific peer (enhanced mode only)
   */
  async connectToPeer(peerId: string): Promise<void> {
    if (this.config.legacyMode) {
      throw new Error('connectToPeer not available in legacy mode');
    }

    if (!this.multiPeerManager) {
      throw new Error('Multi-peer manager not initialized. Call connect() first.');
    }

    return this.multiPeerManager.connectToPeer(peerId);
  }

  /**
   * Disconnect from a specific peer (enhanced mode only)
   */
  disconnectFromPeer(peerId: string): void {
    if (this.config.legacyMode) {
      throw new Error('disconnectFromPeer not available in legacy mode');
    }

    if (!this.multiPeerManager) {
      throw new Error('Multi-peer manager not initialized. Call connect() first.');
    }

    this.multiPeerManager.disconnectFromPeer(peerId);
  }

  /**
   * Get list of connected peers (enhanced mode only)
   */
  getConnectedPeers(): string[] {
    if (this.config.legacyMode) {
      return this.legacyProvider?.isConnected() ? ['legacy-peer'] : [];
    }

    return this.multiPeerManager?.getConnectedPeers() || [];
  }

  /**
   * Get list of all peers (enhanced mode only)
   */
  getAllPeers(): string[] {
    if (this.config.legacyMode) {
      return this.legacyProvider?.isConnected() ? ['legacy-peer'] : [];
    }

    return this.multiPeerManager?.getAllPeers() || [];
  }

  /**
   * Create a data channel for a specific peer (enhanced mode only)
   */
  createDataChannelForPeer(peerId: string, label: string, options: RTCDataChannelInit = {}): RTCDataChannel {
    if (this.config.legacyMode) {
      throw new Error('createDataChannelForPeer not available in legacy mode. Use createDataChannel() instead');
    }

    if (!this.multiPeerManager) {
      throw new Error('Multi-peer manager not initialized. Call connect() first.');
    }

    return this.multiPeerManager.createDataChannel(peerId, label, options);
  }

  // Legacy WebRTC interface methods

  async createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit> {
    if (this.legacyProvider) {
      return this.legacyProvider.createOffer(options);
    }
    
    throw new Error('createOffer not available in enhanced multi-peer mode. Use connectToPeer() instead');
  }

  async createAnswer(offer: RTCSessionDescriptionInit, options?: RTCAnswerOptions): Promise<RTCSessionDescriptionInit> {
    if (this.legacyProvider) {
      return this.legacyProvider.createAnswer(offer, options);
    }
    
    throw new Error('createAnswer not available in enhanced multi-peer mode');
  }

  async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (this.legacyProvider) {
      return this.legacyProvider.setLocalDescription(description);
    }
    
    throw new Error('setLocalDescription not available in enhanced multi-peer mode');
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (this.legacyProvider) {
      return this.legacyProvider.setRemoteDescription(description);
    }
    
    throw new Error('setRemoteDescription not available in enhanced multi-peer mode');
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (this.legacyProvider) {
      return this.legacyProvider.addIceCandidate(candidate);
    }
    
    throw new Error('addIceCandidate not available in enhanced multi-peer mode');
  }

  createDataChannel(label: string, options: RTCDataChannelInit = {}): RTCDataChannel {
    if (this.legacyProvider) {
      return this.legacyProvider.createDataChannel(label, options);
    }
    
    throw new Error('createDataChannel not available in enhanced multi-peer mode. Use createDataChannelForPeer() instead');
  }

  getLocalStreams(): MediaStream[] {
    if (this.legacyProvider) {
      return this.legacyProvider.getLocalStreams();
    }
    
    return [];
  }

  getRemoteStreams(): MediaStream[] {
    if (this.legacyProvider) {
      return this.legacyProvider.getRemoteStreams();
    }
    
    return [];
  }

  addStream(stream: MediaStream): void {
    if (this.legacyProvider) {
      this.legacyProvider.addStream(stream);
    }
  }

  removeStream(stream: MediaStream): void {
    if (this.legacyProvider) {
      this.legacyProvider.removeStream(stream);
    }
  }

  async getStats(): Promise<RTCStatsReport> {
    if (this.legacyProvider) {
      return this.legacyProvider.getStats();
    }
    
    // Return basic stats for enhanced mode
    const stats = this.multiPeerManager?.getStats();
    if (stats) {
      return {
        'enhanced-webrtc': {
          timestamp: Date.now(),
          type: 'session' as any,
          id: 'enhanced-webrtc',
          totalPeers: stats.totalPeers,
          connectedPeers: stats.connectedPeers,
          totalQueuedMessages: stats.totalQueuedMessages,
          uptime: stats.uptime
        }
      };
    }
    
    return {};
  }

  getProviderType(): string {
    if (this.config.legacyMode) {
      return 'enhanced-webrtc-legacy';
    }
    
    return 'enhanced-webrtc-multi-peer';
  }

  getConfiguration(): RTCConfiguration {
    return {
      iceServers: this.config.iceServers || [],
      iceCandidatePoolSize: this.config.iceCandidatePoolSize,
    };
  }

  /**
   * Get enhanced statistics
   */
  getEnhancedStats(): {
    mode: 'legacy' | 'enhanced';
    connected: boolean;
    peers?: {
      total: number;
      connected: number;
      list: string[];
    };
    messageQueuing?: {
      totalQueued: number;
      queueSize: number;
    };
    signaling?: {
      serverStats: any;
    };
  } {
    const baseStats = {
      mode: this.config.legacyMode ? 'legacy' as const : 'enhanced' as const,
      connected: this.isConnected()
    };

    if (this.config.legacyMode) {
      return {
        ...baseStats,
        peers: {
          total: this.legacyProvider?.isConnected() ? 1 : 0,
          connected: this.legacyProvider?.isConnected() ? 1 : 0,
          list: this.legacyProvider?.isConnected() ? ['legacy-peer'] : []
        }
      };
    }

    const managerStats = this.multiPeerManager?.getStats();
    const signalingServer = getGlobalSignalingServer();
    
    return {
      ...baseStats,
      peers: {
        total: this.multiPeerManager?.getAllPeers().length || 0,
        connected: this.multiPeerManager?.getConnectedPeers().length || 0,
        list: this.multiPeerManager?.getConnectedPeers() || []
      },
      messageQueuing: managerStats ? {
        totalQueued: managerStats.totalQueuedMessages,
        queueSize: this.config.messageQueueSize || 1000
      } : undefined,
      signaling: {
        serverStats: signalingServer.getStats()
      }
    };
  }

  private async connectEnhanced(config: EnhancedWebRTCConfig): Promise<void> {
    // Generate unique peer ID
    const peerId = config.userId || `enhanced-peer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create multi-peer manager
    this.multiPeerManager = new MultiPeerManager(peerId, {
      roomId: config.roomId,
      maxPeers: config.maxPeers,
      autoConnect: config.autoConnect,
      messageQueueSize: config.messageQueueSize,
      connectionTimeout: config.connectionTimeout,
      debug: config.debug,
      iceServers: config.iceServers
    });

    // Set up event forwarding
    this.setupEnhancedEventHandlers();

    // Initialize manager
    await this.multiPeerManager.initialize();
  }

  private async connectLegacy(config: EnhancedWebRTCConfig): Promise<void> {
    // Create legacy provider
    this.legacyProvider = new NodeDataChannelWebRTC({
      userId: config.userId,
      debug: config.debug,
      iceServers: config.iceServers
    });

    // Set up event forwarding
    this.setupLegacyEventHandlers();

    // Connect legacy provider
    await this.legacyProvider.connect();
  }

  private setupEnhancedEventHandlers(): void {
    if (!this.multiPeerManager) return;

    // Forward all multi-peer manager events
    this.multiPeerManager.on('initialized', () => this.emit('initialized'));
    this.multiPeerManager.on('peer-connecting', (peerId) => this.emit('peer-connecting', peerId));
    this.multiPeerManager.on('peer-connected', (peerId) => this.emit('peer-connected', peerId));
    this.multiPeerManager.on('peer-disconnected', (peerId) => this.emit('peer-disconnected', peerId));
    this.multiPeerManager.on('peer-joined', (peerInfo) => this.emit('peer-joined', peerInfo));
    this.multiPeerManager.on('peer-left', (peerInfo) => this.emit('peer-left', peerInfo));
    this.multiPeerManager.on('peer-error', (error) => this.emit('peer-error', error));
    this.multiPeerManager.on('message', (message) => this.emit('message', message));
    this.multiPeerManager.on('data-channel-created', (info) => this.emit('data-channel-created', info));
    this.multiPeerManager.on('data-channel-received', (info) => this.emit('data-channel-received', info));
    this.multiPeerManager.on('data-channel-open', (info) => this.emit('data-channel-open', info));
    this.multiPeerManager.on('data-channel-close', (info) => this.emit('data-channel-close', info));
    this.multiPeerManager.on('data-channel-error', (info) => this.emit('data-channel-error', info));
    this.multiPeerManager.on('all-disconnected', () => this.emit('all-disconnected'));
  }

  private setupLegacyEventHandlers(): void {
    if (!this.legacyProvider) return;

    // Forward all legacy provider events
    this.legacyProvider.on('connect', () => this.emit('connect'));
    this.legacyProvider.on('disconnect', () => this.emit('disconnect'));
    this.legacyProvider.on('error', (error) => this.emit('error', error));
    this.legacyProvider.on('iceCandidate', (candidate) => this.emit('iceCandidate', candidate));
    this.legacyProvider.on('connectionStateChange', (state) => this.emit('connectionStateChange', state));
    this.legacyProvider.on('iceGatheringStateChange', (state) => this.emit('iceGatheringStateChange', state));
    this.legacyProvider.on('dataChannel', (channel) => this.emit('dataChannel', channel));
    this.legacyProvider.on('dataChannelOpen', (channel) => this.emit('dataChannelOpen', channel));
    this.legacyProvider.on('dataChannelMessage', (channel, message) => this.emit('dataChannelMessage', channel, message));
    this.legacyProvider.on('dataChannelError', (channel, error) => this.emit('dataChannelError', channel, error));
    this.legacyProvider.on('dataChannelClose', (channel) => this.emit('dataChannelClose', channel));
  }

  /**
   * Reset global signaling server (useful for testing)
   */
  static resetGlobalSignalingServer(): void {
    resetGlobalSignalingServer();
  }

  /**
   * Get global signaling server instance
   */
  static getGlobalSignalingServer() {
    return getGlobalSignalingServer();
  }
}

// Export enhanced class as default WebRTC provider
export { EnhancedWebRTC as WebRTC };
