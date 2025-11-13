/**
 * Refactored Multi-Peer Connection Manager for WebRTC
 * 
 * This is a modular, maintainable version that separates concerns
 * into specialized classes for better code organization.
 */

import { EventEmitter } from 'events';
import { NodeDataChannelWebRTC } from './node-datachannel.js';
import { NodeDataChannelWebRTCReal } from './node-datachannel-real.js';
import { getGlobalSignalingServer } from './signaling-server.js';
import { PeerConnection } from './peer-connection.js';
import { MessageQueue, type MessageQueueConfig } from './message-queue.js';
import { SignalingManager, type SignalingManagerConfig } from './signaling-manager.js';
import type { WebRTCConfig, RTCDataChannel } from './types.js';
import { SignalingAdapter, createSignalingAdapter } from '../adapters/SignalingAdapter.js';
import { SignalingServer } from '../signal_server.js';
import { UnifiedWebRTCProvider } from './unified-webrtc-provider.js';

export interface MultiPeerConfig extends WebRTCConfig {
  roomId?: string;
  maxPeers?: number;
  autoConnect?: boolean;
  connectionTimeout?: number;
  heartbeatInterval?: number;
  messageQueue?: MessageQueueConfig;
  signaling?: SignalingManagerConfig;
  useMainSignalingServer?: boolean;
  mainSignalingServer?: SignalingServer;
  webrtcProvider?: 'node-datachannel' | 'node-datachannel-real' | 'unified-webrtc';
}

export interface MultiPeerStats {
  totalPeers: number;
  connectedPeers: number;
  totalQueuedMessages: number;
  uptime: number;
  signaling: {
    pendingOffers: number;
    pendingAnswers: number;
    pendingIceCandidates: number;
    totalPeers: number;
  };
}

/**
 * Refactored Multi-Peer Connection Manager
 */
export class MultiPeerManager extends EventEmitter {
  private localPeerId: string;
  private config: MultiPeerConfig;
  private peers = new Map<string, PeerConnection>();
  private messageQueues = new Map<string, MessageQueue>();
  private signalingManager: SignalingManager;
  private signalingServer = getGlobalSignalingServer();
  private signalingAdapter?: SignalingAdapter;
  private heartbeatTimer?: NodeJS.Timeout;
  private isInitialized = false;
  private startTime = Date.now();

  constructor(localPeerId: string, config: MultiPeerConfig = {}) {
    super();
    
    this.localPeerId = localPeerId;
    this.config = {
      roomId: 'default-room',
      maxPeers: 10,
      autoConnect: true,
      connectionTimeout: 30000,
      heartbeatInterval: 5000,
      debug: false,
      useMainSignalingServer: false,
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      messageQueue: {
        maxSize: 1000,
        maxRetries: 5,
        retryDelay: 1000,
        enablePriority: false
      },
      signaling: {
        debug: false,
        enableIceRestart: true,
        connectionTimeout: 30000
      },
      ...config
    };

    // Initialize signaling adapter if using main signaling server
    if (this.config.useMainSignalingServer && this.config.mainSignalingServer) {
      this.signalingAdapter = createSignalingAdapter({
        signalingServer: this.config.mainSignalingServer,
        enableWebRTC: true,
        enableLegacySupport: true,
        debug: this.config.debug
      });
      this.setupSignalingAdapterEvents();
    }

    // Initialize signaling manager
    this.signalingManager = new SignalingManager(localPeerId, this.config.signaling);
    this.setupSignalingEvents();
    this.setupSignalingHandlers();
    
    if (this.config.autoConnect) {
      this.initialize().catch(error => {
        console.error('Auto-initialization failed:', error);
      });
    }
  }

  /**
   * Initialize the multi-peer manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Join the signaling room
      this.signalingServer.joinRoom(this.localPeerId, this.config.roomId!, {
        maxPeers: this.config.maxPeers,
        capabilities: this.getCapabilities()
      });

      // Start heartbeat
      this.startHeartbeat();

      this.isInitialized = true;

      if (this.config.debug) {
        const provider = this.config.webrtcProvider || 'node-datachannel';
        console.log(`MultiPeerManagerV2 initialized for peer ${this.localPeerId} in room ${this.config.roomId} with ${provider}`);
      }

      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize MultiPeerManagerV2:', error);
      throw error;
    }
  }

  /**
   * Connect to a specific peer
   */
  async connectToPeer(peerId: string): Promise<void> {
    if (this.peers.has(peerId)) {
      throw new Error(`Already connected to peer: ${peerId}`);
    }

    if (this.peers.size >= this.config.maxPeers!) {
      throw new Error(`Maximum peer limit reached: ${this.config.maxPeers}`);
    }

    try {
      // Create WebRTC instance based on provider
      const webrtc = this.createWebRTCInstance(peerId);

      // Create peer connection
      const peerConnection = new PeerConnection(peerId, webrtc, this.config);
      
      // Create message queue for this peer
      const messageQueue = new MessageQueue(this.config.messageQueue);
      this.messageQueues.set(peerId, messageQueue);

      // Setup peer events BEFORE connecting
      this.setupPeerEvents(peerConnection);

      // Connect to WebRTC
      await webrtc.connect();

      // Store peer connection
      this.peers.set(peerId, peerConnection);

      // Wait a bit for WebRTC to initialize
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Initiate connection process
      await this.initiateConnection(peerId);

      if (this.config.debug) {
        console.log(`Initiated connection to peer: ${peerId}`);
      }

      this.emit('peer-connecting', peerId);
    } catch (error) {
      console.error(`Failed to connect to peer ${peerId}:`, error);
      throw error;
    }
  }

  /**
   * Disconnect from a specific peer
   */
  disconnectFromPeer(peerId: string): void {
    const peerConnection = this.peers.get(peerId);
    if (!peerConnection) return;

    try {
      // Clean up peer connection
      if (peerConnection && typeof peerConnection.cleanup === 'function') {
        peerConnection.cleanup();
      }
      this.peers.delete(peerId);

      // Clean up message queue
      const messageQueue = this.messageQueues.get(peerId);
      if (messageQueue) {
        messageQueue.clear();
        this.messageQueues.delete(peerId);
      }

      // Clear signaling state
      this.signalingManager.clearPeerState(peerId);

      if (this.config.debug) {
        console.log(`Disconnected from peer: ${peerId}`);
      }

      this.emit('peer-disconnected', peerId);
    } catch (error) {
      console.error(`Error disconnecting from peer ${peerId}:`, error);
    }
  }

  /**
   * Disconnect from all peers
   */
  disconnectAll(): void {
    const peerIds = Array.from(this.peers.keys());
    peerIds.forEach(peerId => this.disconnectFromPeer(peerId));

    // Leave local signaling server
    this.signalingServer.leaveRoom(this.localPeerId);
    
    // Unregister from main signaling server if using adapter
    if (this.signalingAdapter && this.config.useMainSignalingServer) {
      this.signalingAdapter.unregisterWebRTCPeer(this.localPeerId);
    }
    
    this.stopHeartbeat();
    this.signalingManager.clear();

    this.isInitialized = false;

    if (this.config.debug) {
      console.log('Disconnected from all peers');
    }

    this.emit('all-disconnected');
  }

  /**
   * Send a message to a specific peer
   */
  sendToPeer(
    peerId: string, 
    data: string | ArrayBuffer | ArrayBufferView, 
    channelLabel: string = 'default'
  ): void {
    let peerConnection = this.peers.get(peerId);
    let messageQueue = this.messageQueues.get(peerId);
    
    // Create temporary peer and queue if peer doesn't exist
    if (!peerConnection) {
      peerConnection = new PeerConnection(peerId, null, this.config);
      messageQueue = new MessageQueue(this.config.messageQueue);
      
      this.peers.set(peerId, peerConnection);
      this.messageQueues.set(peerId, messageQueue);
      
      if (this.config.debug) {
        console.log(`Created temporary peer connection for queuing: ${peerId}`);
      }
    }

    // Update activity
    if (peerConnection && typeof peerConnection.updateActivity === 'function') {
      peerConnection.updateActivity();
    }

    // Try to send immediately if connected
    if (peerConnection.connected) {
      const openChannels = peerConnection.getOpenDataChannels();
      const channel = openChannels.get(channelLabel);
      
      if (channel) {
        try {
          channel.send(data);
          if (this.config.debug) {
            console.log(`Message sent to ${peerId} via channel ${channelLabel}`);
          }
          return;
        } catch (error) {
          console.warn(`Failed to send message to ${peerId}, queuing instead:`, error);
        }
      }
    }

    // Queue message
    messageQueue?.enqueue(data, channelLabel);
    
    if (this.config.debug) {
      console.log(`Message queued for ${peerId} via channel ${channelLabel}`);
    }
  }

  /**
   * Broadcast a message to all connected peers
   */
  broadcast(
    data: string | ArrayBuffer | ArrayBufferView, 
    channelLabel: string = 'default'
  ): void {
    const connectedPeers = this.getConnectedPeers();
    
    if (this.config.debug) {
      console.log(`Broadcasting message to ${connectedPeers.length} peers via channel ${channelLabel}`);
    }

    connectedPeers.forEach(peerId => {
      try {
        this.sendToPeer(peerId, data, channelLabel);
      } catch (error) {
        console.warn(`Failed to broadcast to peer ${peerId}:`, error);
      }
    });
  }

  /**
   * Create a data channel for a specific peer
   */
  async createDataChannel(
    peerId: string, 
    label: string, 
    options: any = {}
  ): Promise<RTCDataChannel> {
    let peerConnection = this.peers.get(peerId);
    
    // Create peer connection if it doesn't exist
    if (!peerConnection) {
      if (this.config.debug) {
        console.log(`Creating connection for data channel '${label}' with peer ${peerId}`);
      }
      
      await this.connectToPeer(peerId);
      peerConnection = this.peers.get(peerId)!;
    }

    // Wait for WebRTC connection to be established with retry logic
    let retries = 0;
    const maxRetries = 10; // Reduced from 20 for faster testing
    
    while (!peerConnection?.webrtc && retries < maxRetries) {
      if (this.config.debug) {
        console.log(`Waiting for WebRTC connection to ${peerId}, attempt ${retries + 1}/${maxRetries}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500)); // Reduced from 1000ms
      peerConnection = this.peers.get(peerId);
      retries++;
    }

    if (!peerConnection?.webrtc) {
      throw new Error(`WebRTC connection not established for peer: ${peerId} after ${maxRetries} attempts`);
    }

    const dataChannel = peerConnection.webrtc.createDataChannel(label, options);
    
    if (this.config.debug) {
      console.log(`Data channel ${label} created for peer ${peerId}`);
    }

    this.emit('data-channel-created', { peerId, label, dataChannel });
    return dataChannel;
  }

  /**
   * Get list of connected peers
   */
  getConnectedPeers(): string[] {
    return Array.from(this.peers.values())
      .filter(peer => peer.connected)
      .map(peer => peer.peerId);
  }

  /**
   * Get list of all peers
   */
  getAllPeers(): string[] {
    return Array.from(this.peers.keys());
  }

  /**
   * Check if peer is connected
   */
  isPeerConnected(peerId: string): boolean {
    const peerConnection = this.peers.get(peerId);
    return peerConnection?.connected || false;
  }

  /**
   * Get comprehensive statistics
   */
  getStats(): MultiPeerStats {
    let totalQueuedMessages = 0;
    this.messageQueues.forEach(queue => {
      totalQueuedMessages += queue.size();
    });

    const signalingStats = this.signalingManager.getStats();

    return {
      totalPeers: this.peers.size,
      connectedPeers: this.getConnectedPeers().length,
      totalQueuedMessages,
      uptime: Date.now() - this.startTime,
      signaling: signalingStats
    };
  }

  /**
   * Get detailed peer information
   */
  getPeerInfo(peerId: string): PeerConnection | undefined {
    return this.peers.get(peerId);
  }

  /**
   * Create WebRTC instance based on provider configuration
   */
  private createWebRTCInstance(peerId: string) {
    const provider = this.config.webrtcProvider || 'node-datachannel';
    
    if (provider === 'unified-webrtc') {
      if (this.config.debug) {
        console.log(`🔧 Creating UNIFIED WebRTC instance for peer ${peerId}`);
      }
      return new UnifiedWebRTCProvider({
        ...this.config,
        userId: `${this.localPeerId}-${peerId}`,
        debug: this.config.debug,
        useRealWebRTC: true
      });
    } else if (provider === 'node-datachannel-real') {
      if (this.config.debug) {
        console.log(`🌐 Creating REAL WebRTC instance for peer ${peerId}`);
      }
      return new NodeDataChannelWebRTCReal({
        ...this.config,
        userId: `${this.localPeerId}-${peerId}`,
        debug: this.config.debug
      });
    } else {
      if (this.config.debug) {
        console.log(`🎭 Creating MOCK WebRTC instance for peer ${peerId}`);
      }
      return new NodeDataChannelWebRTC({
        ...this.config,
        userId: `${this.localPeerId}-${peerId}`,
        debug: this.config.debug
      });
    }
  }

  private setupSignalingEvents(): void {
    this.signalingManager.on('offer-received', async ({ peerId, offer }) => {
      let peerConnection = this.peers.get(peerId);
      if (!peerConnection || !peerConnection.webrtc) {
        // Create peer connection if it doesn't exist (for incoming connections)
        if (!peerConnection) {
          if (this.config.debug) {
            console.log(`Creating peer connection for incoming offer from ${peerId}`);
          }
          
          const webrtc = this.createWebRTCInstance(peerId);
          
          const newPeerConnection = new PeerConnection(peerId, webrtc, this.config);
          const messageQueue = new MessageQueue(this.config.messageQueue);
          this.messageQueues.set(peerId, messageQueue);
          this.peers.set(peerId, newPeerConnection);
          
          this.setupPeerEvents(newPeerConnection);
          await webrtc.connect();
          
          peerConnection = newPeerConnection;
        }
      }

      try {
        if (peerConnection.webrtc) {
          await peerConnection.webrtc.setRemoteDescription(offer);
          const answer = await peerConnection.webrtc.createAnswer(offer);
          await this.signalingManager.createAnswer(peerId, answer);
          
          this.sendSignalingMessage('answer', peerId, answer);
        }
      } catch (error) {
        console.error(`Error handling offer from ${peerId}:`, error);
      }
    });

    this.signalingManager.on('answer-received', async ({ peerId, answer }) => {
      const peerConnection = this.peers.get(peerId);
      if (!peerConnection || !peerConnection.webrtc) return;

      try {
        await peerConnection.webrtc.setRemoteDescription(answer);
      } catch (error) {
        console.error(`Error handling answer from ${peerId}:`, error);
      }
    });

    this.signalingManager.on('ice-candidate-received', async ({ peerId, candidate }) => {
      const peerConnection = this.peers.get(peerId);
      if (!peerConnection || !peerConnection.webrtc) return;

      try {
        await peerConnection.webrtc.addIceCandidate(candidate);
      } catch (error) {
        console.error(`Error adding ICE candidate from ${peerId}:`, error);
      }
    });
  }

  private setupSignalingAdapterEvents(): void {
    if (!this.signalingAdapter) return;

    this.signalingAdapter.on('peer-joined', (peerInfo) => {
      if (peerInfo.roomId === this.config.roomId && peerInfo.id !== this.localPeerId) {
        this.emit('peer-joined', peerInfo);
        
        // Register with main signaling server
        if (this.config.useMainSignalingServer) {
          this.signalingAdapter?.registerWebRTCPeer(this.localPeerId, this.config.roomId!, {
            capabilities: this.getCapabilities()
          });
        }
        
        // Auto-connect if enabled
        if (this.config.autoConnect && this.peers.size < this.config.maxPeers!) {
          this.connectToPeer(peerInfo.id).catch(error => {
            console.warn(`Auto-connect to peer ${peerInfo.id} failed:`, error);
          });
        }
      }
    });

    this.signalingAdapter.on('peer-left', (peerInfo) => {
      if (peerInfo.id !== this.localPeerId) {
        this.disconnectFromPeer(peerInfo.id);
        this.emit('peer-left', peerInfo);
      }
    });

    this.signalingAdapter.on('webrtc-message', (message) => {
      this.handleSignalingMessage(message);
    });

    this.signalingAdapter.on('legacy-message', ({ socket, message }) => {
      // Handle legacy messages through adapter
      if (this.config.debug) {
        console.log('Processing legacy message through adapter:', message);
      }
    });
  }

  private setupSignalingHandlers(): void {
    this.signalingServer.on(`message:${this.localPeerId}`, (message) => {
      this.handleSignalingMessage(message);
    });

    this.signalingServer.on('peer-joined', (peerInfo: any) => {
      if (peerInfo.roomId === this.config.roomId && peerInfo.id !== this.localPeerId) {
        this.emit('peer-joined', peerInfo);
        
        // Auto-connect if enabled (but avoid duplicate connections)
        if (this.config.autoConnect && !this.peers.has(peerInfo.id) && this.peers.size < this.config.maxPeers!) {
          this.connectToPeer(peerInfo.id).catch(error => {
            console.warn(`Auto-connect to peer ${peerInfo.id} failed:`, error);
          });
        }
      }
    });

    this.signalingServer.on('peer-left', (peerInfo: any) => {
      if (peerInfo.id !== this.localPeerId) {
        this.disconnectFromPeer(peerInfo.id);
        this.emit('peer-left', peerInfo);
      }
    });
  }

  private setupPeerEvents(peerConnection: PeerConnection): void {
    peerConnection.on('connected', () => {
      if (this.config.debug) {
        console.log(`Peer connected: ${peerConnection.peerId}`);
      }
      this.emit('peer-connected', peerConnection.peerId);
    });

    peerConnection.on('disconnected', () => {
      if (this.config.debug) {
        console.log(`Peer disconnected: ${peerConnection.peerId}`);
      }
      this.emit('peer-disconnected', peerConnection.peerId);
    });

    peerConnection.on('error', (error) => {
      if (this.config.debug) {
        console.log(`Peer error: ${peerConnection.peerId}`, error);
      }
      this.emit('peer-error', { peerId: peerConnection.peerId, error });
    });

    peerConnection.on('ice-candidate', (candidate) => {
      if (this.config.debug) {
        console.log(`ICE candidate from ${peerConnection.peerId}:`, candidate);
      }
      this.sendSignalingMessage('ice-candidate', peerConnection.peerId, candidate);
    });

    peerConnection.on('message', ({ data, channel }) => {
      if (this.config.debug) {
        console.log(`Message from ${peerConnection.peerId} via ${channel}:`, data);
      }
      this.emit('message', {
        from: peerConnection.peerId,
        data,
        channel
      });
    });

    peerConnection.on('data-channel-open', ({ label }) => {
      if (this.config.debug) {
        console.log(`Data channel opened: ${label} for ${peerConnection.peerId}`);
      }
      
      // Process queued messages when data channel opens
      const messageQueue = this.messageQueues.get(peerConnection.peerId);
      if (messageQueue) {
        messageQueue.process(async (queuedMsg) => {
          const channel = peerConnection.dataChannels.get(queuedMsg.channelLabel);
          if (channel && channel.readyState === 'open') {
            try {
              channel.send(queuedMsg.data);
              if (this.config.debug) {
                console.log(`Sent queued message to ${peerConnection.peerId}:`, queuedMsg.data);
              }
            } catch (error) {
              console.warn(`Failed to send queued message to ${peerConnection.peerId}:`, error);
            }
          }
          return false; // Don't retry, just remove from queue
        });
      }
    });
  }

  private async initiateConnection(peerId: string): Promise<void> {
    const peerConnection = this.peers.get(peerId);
    if (!peerConnection?.webrtc) return;

    try {
      const offer = await peerConnection.webrtc.createOffer();
      await this.signalingManager.createOffer(peerId, offer);
      
      this.sendSignalingMessage('offer', peerId, offer);
    } catch (error) {
      console.error(`Failed to initiate connection with ${peerId}:`, error);
      throw error;
    }
  }

  private async handleSignalingMessage(message: any): Promise<void> {
    try {
      if (this.config.debug) {
        console.log(`Handling signaling message:`, message);
      }
      
      switch (message.type) {
        case 'offer':
          await this.signalingManager.handleOffer(message.from, message.payload);
          break;
        case 'answer':
          await this.signalingManager.handleAnswer(message.from, message.payload);
          break;
        case 'ice-candidate':
          await this.signalingManager.handleIceCandidate(message.from, message.payload);
          break;
      }
    } catch (error) {
      console.error(`Error handling signaling message:`, error);
    }
  }

  private sendSignalingMessage(type: 'offer' | 'answer' | 'ice-candidate', to: string, payload: any): void {
    const message = {
      type,
      from: this.localPeerId,
      to,
      payload
    };

    // Use signaling adapter if available (main signaling server integration)
    if (this.signalingAdapter) {
      this.signalingAdapter.sendSignalingMessage(message);
    } else {
      // Fallback to local signaling server
      this.signalingServer.sendMessage(message);
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      const timeout = this.config.connectionTimeout!;
      
      this.peers.forEach((peerConnection, peerId) => {
        // Check if peerConnection exists and has isTimedOut method
        if (peerConnection && typeof peerConnection.isTimedOut === 'function') {
          try {
            if (peerConnection.isTimedOut(timeout)) {
              console.warn(`Peer ${peerId} connection timeout, disconnecting`);
              this.disconnectFromPeer(peerId);
            }
          } catch (error) {
            console.error(`Error checking timeout for peer ${peerId}:`, error);
            // Remove problematic peer connection
            this.disconnectFromPeer(peerId);
          }
        }
      });
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private getCapabilities(): string[] {
    return [
      'data-channels',
      'message-queuing',
      'multi-peer',
      'auto-reconnect',
      'signaling-v2'
    ];
  }
}
