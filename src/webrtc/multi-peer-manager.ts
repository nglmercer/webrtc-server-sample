/**
 * Multi-Peer Connection Manager for WebRTC
 * 
 * This module manages multiple WebRTC peer connections within the same process,
 * enabling peer-to-peer communication without external infrastructure.
 */

import { EventEmitter } from 'events';
import { NodeDataChannelWebRTC } from './node-datachannel.js';
import { getGlobalSignalingServer, SignalingMessage } from './signaling-server.js';
import type { WebRTCConfig, RTCSessionDescriptionInit, RTCIceCandidateInit, RTCDataChannel } from './types.js';
import { RTCSdpType, RTCDataChannelState } from './types.js';

export interface QueuedMessage {
  data: string | ArrayBuffer | ArrayBufferView;
  timestamp: number;
  channelLabel: string;
  retryCount: number;
  maxRetries: number;
}

export interface PeerConnection {
  peerId: string;
  webrtc: NodeDataChannelWebRTC | null;
  connected: boolean;
  dataChannels: Map<string, RTCDataChannel>;
  messageQueue: QueuedMessage[];
  createdAt: number;
  lastActivity: number;
}

export interface MultiPeerConfig extends WebRTCConfig {
  roomId?: string;
  maxPeers?: number;
  autoConnect?: boolean;
  messageQueueSize?: number;
  connectionTimeout?: number;
  heartbeatInterval?: number;
}

/**
 * Multi-Peer Connection Manager
 * 
 * Manages multiple WebRTC connections, handles signaling, and provides
 * message queuing for reliable communication.
 */
export class MultiPeerManager extends EventEmitter {
  private localPeerId: string;
  private config: MultiPeerConfig;
  private peers: Map<string, PeerConnection> = new Map();
  private signalingServer = getGlobalSignalingServer();
  private heartbeatTimer?: NodeJS.Timeout;
  private isInitialized = false;

  constructor(localPeerId: string, config: MultiPeerConfig = {}) {
    super();
    
    this.localPeerId = localPeerId;
    this.config = {
      roomId: 'default-room',
      maxPeers: 10,
      autoConnect: true,
      messageQueueSize: 1000,
      connectionTimeout: 30000,
      heartbeatInterval: 5000,
      debug: false,
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      ...config
    };

    this.setupSignalingHandlers();
    
    if (this.config.autoConnect) {
      this.initialize();
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
        console.log(`MultiPeerManager initialized for peer ${this.localPeerId} in room ${this.config.roomId}`);
      }

      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize MultiPeerManager:', error);
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
      // Create WebRTC instance for this peer
      const webrtc = new NodeDataChannelWebRTC({
        ...this.config,
        userId: `${this.localPeerId}-${peerId}`, // Unique ID per connection
        debug: this.config.debug
      });

      // Create peer connection record
      const peerConnection: PeerConnection = {
        peerId,
        webrtc,
        connected: false,
        dataChannels: new Map(),
        messageQueue: [],
        createdAt: Date.now(),
        lastActivity: Date.now()
      };

      // Set up event handlers
      this.setupPeerHandlers(peerConnection);

      // Connect to WebRTC
      await webrtc.connect();

      // Store peer connection
      this.peers.set(peerId, peerConnection);

      // Start connection process
      await this.initiateConnection(peerConnection);

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
      // Close WebRTC connection only if it exists
      if (peerConnection.webrtc) {
        peerConnection.webrtc.disconnect();
      }

      // Clean up data channels
      peerConnection.dataChannels.forEach(channel => {
        try {
          channel.close();
        } catch (error) {
          // Ignore cleanup errors
        }
      });

      // Remove from peers map
      this.peers.delete(peerId);

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

    this.signalingServer.leaveRoom(this.localPeerId);
    this.stopHeartbeat();

    this.isInitialized = false;

    if (this.config.debug) {
      console.log('Disconnected from all peers');
    }

    this.emit('all-disconnected');
  }

  /**
   * Send a message to a specific peer
   */
  sendToPeer(peerId: string, data: string | ArrayBuffer | ArrayBufferView, channelLabel: string = 'default'): void {
    let peerConnection = this.peers.get(peerId);
    
    // If peer doesn't exist, create a temporary connection for queuing
    if (!peerConnection) {
      peerConnection = {
        peerId,
        webrtc: null, // Will be created when actually connecting
        connected: false,
        dataChannels: new Map(),
        messageQueue: [],
        createdAt: Date.now(),
        lastActivity: Date.now()
      };
      
      this.peers.set(peerId, peerConnection);
      
      if (this.config.debug) {
        console.log(`Created temporary peer connection for queuing: ${peerId}`);
      }
    }

    // Update last activity
    peerConnection.lastActivity = Date.now();

    // Try to send immediately if connected
    if (peerConnection.connected && peerConnection.dataChannels.has(channelLabel)) {
      const channel = peerConnection.dataChannels.get(channelLabel)!;
      if (channel.readyState === RTCDataChannelState.OPEN) {
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

    // Queue the message if immediate send failed
    this.queueMessage(peerConnection, data, channelLabel);
  }

  /**
   * Broadcast a message to all connected peers
   */
  broadcast(data: string | ArrayBuffer | ArrayBufferView, channelLabel: string = 'default'): void {
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
  createDataChannel(peerId: string, label: string, options: any = {}): RTCDataChannel {
    const peerConnection = this.peers.get(peerId);
    if (!peerConnection) {
      throw new Error(`Not connected to peer: ${peerId}`);
    }

    if (peerConnection.dataChannels.has(label)) {
      throw new Error(`Data channel already exists: ${label}`);
    }

    if (!peerConnection.webrtc) {
      throw new Error(`WebRTC connection not established for peer: ${peerId}`);
    }

    const dataChannel = peerConnection.webrtc.createDataChannel(label, options);
    peerConnection.dataChannels.set(label, dataChannel);

    // Set up data channel handlers
    this.setupDataChannelHandlers(peerConnection, dataChannel);

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
   * Get list of all peers (connected and connecting)
   */
  getAllPeers(): string[] {
    return Array.from(this.peers.keys());
  }

  /**
   * Get connection status for a specific peer
   */
  isPeerConnected(peerId: string): boolean {
    const peerConnection = this.peers.get(peerId);
    return peerConnection?.connected || false;
  }

  /**
   * Get statistics for the multi-peer manager
   */
  getStats(): {
    totalPeers: number;
    connectedPeers: number;
    totalQueuedMessages: number;
    uptime: number;
  } {
    let totalQueuedMessages = 0;
    this.peers.forEach(peer => {
      totalQueuedMessages += peer.messageQueue.length;
    });

    return {
      totalPeers: this.peers.size,
      connectedPeers: this.getConnectedPeers().length,
      totalQueuedMessages,
      uptime: Date.now() - (this.peers.size > 0 ? Math.min(...Array.from(this.peers.values()).map(p => p.createdAt)) : Date.now())
    };
  }

  /**
   * Get detailed peer information
   */
  getPeerInfo(peerId: string): PeerConnection | undefined {
    return this.peers.get(peerId);
  }

  private setupSignalingHandlers(): void {
    // Handle incoming signaling messages
    this.signalingServer.on(`message:${this.localPeerId}`, (message: SignalingMessage) => {
      this.handleSignalingMessage(message);
    });

    // Handle peer join/leave events
    this.signalingServer.on('peer-joined', (peerInfo) => {
      if (peerInfo.roomId === this.config.roomId && peerInfo.id !== this.localPeerId) {
        this.emit('peer-joined', peerInfo);
        
        // Auto-connect if enabled
        if (this.config.autoConnect && this.peers.size < this.config.maxPeers!) {
          this.connectToPeer(peerInfo.id).catch(error => {
            console.warn(`Auto-connect to peer ${peerInfo.id} failed:`, error);
          });
        }
      }
    });

    this.signalingServer.on('peer-left', (peerInfo) => {
      if (peerInfo.id !== this.localPeerId) {
        this.disconnectFromPeer(peerInfo.id);
        this.emit('peer-left', peerInfo);
      }
    });
  }

  private setupPeerHandlers(peerConnection: PeerConnection): void {
    const { webrtc, peerId } = peerConnection;

    if (!webrtc) return;

    // Handle WebRTC events
    webrtc.on('connect', () => {
      peerConnection.connected = true;
      peerConnection.lastActivity = Date.now();
      
      // Process queued messages
      this.processQueuedMessages(peerConnection);
      
      if (this.config.debug) {
        console.log(`Connected to peer: ${peerId}`);
      }
      
      this.emit('peer-connected', peerId);
    });

    webrtc.on('disconnect', () => {
      peerConnection.connected = false;
      
      if (this.config.debug) {
        console.log(`Disconnected from peer: ${peerId}`);
      }
      
      this.emit('peer-disconnected', peerId);
    });

    webrtc.on('error', (error: Error) => {
      console.error(`WebRTC error for peer ${peerId}:`, error);
      this.emit('peer-error', { peerId, error });
    });

    webrtc.on('iceCandidate', (candidate: RTCIceCandidateInit) => {
      // Send ICE candidate to peer
      this.signalingServer.sendMessage({
        type: 'ice-candidate',
        from: this.localPeerId,
        to: peerId,
        payload: candidate
      });
    });

    webrtc.on('dataChannel', (channel: RTCDataChannel) => {
      peerConnection.dataChannels.set(channel.label, channel);
      this.setupDataChannelHandlers(peerConnection, channel);
      
      this.emit('data-channel-received', { peerId, channel });
    });
  }

  private setupDataChannelHandlers(peerConnection: PeerConnection, channel: RTCDataChannel): void {
    channel.onopen = () => {
      peerConnection.lastActivity = Date.now();
      
      // Process queued messages for this channel
      this.processQueuedMessagesForChannel(peerConnection, channel.label);
      
      if (this.config.debug) {
        console.log(`Data channel ${channel.label} opened for peer ${peerConnection.peerId}`);
      }
      
      this.emit('data-channel-open', { peerId: peerConnection.peerId, label: channel.label });
    };

    channel.onmessage = (event: MessageEvent) => {
      peerConnection.lastActivity = Date.now();
      
      this.emit('message', {
        from: peerConnection.peerId,
        data: event.data,
        channel: channel.label
      });
    };

    channel.onerror = (error: Event) => {
      console.error(`Data channel error for peer ${peerConnection.peerId}:`, error);
      this.emit('data-channel-error', { peerId: peerConnection.peerId, label: channel.label, error });
    };

    channel.onclose = () => {
      peerConnection.dataChannels.delete(channel.label);
      
      if (this.config.debug) {
        console.log(`Data channel ${channel.label} closed for peer ${peerConnection.peerId}`);
      }
      
      this.emit('data-channel-close', { peerId: peerConnection.peerId, label: channel.label });
    };
  }

  private async initiateConnection(peerConnection: PeerConnection): Promise<void> {
    if (!peerConnection.webrtc) return;

    try {
      // Create offer
      const offer = await peerConnection.webrtc.createOffer();
      
      // Send offer to peer
      this.signalingServer.sendMessage({
        type: 'offer',
        from: this.localPeerId,
        to: peerConnection.peerId,
        payload: offer
      });
    } catch (error) {
      console.error(`Failed to initiate connection with peer ${peerConnection.peerId}:`, error);
      throw error;
    }
  }

  private async handleSignalingMessage(message: SignalingMessage): Promise<void> {
    const peerConnection = this.peers.get(message.from);
    if (!peerConnection) {
      // Ignore messages from unknown peers
      return;
    }

    if (!peerConnection.webrtc) {
      // Ignore messages for peers without WebRTC connections
      return;
    }

    try {
      switch (message.type) {
        case 'offer':
          await this.handleOffer(peerConnection, message.payload);
          break;
        case 'answer':
          await this.handleAnswer(peerConnection, message.payload);
          break;
        case 'ice-candidate':
          await this.handleIceCandidate(peerConnection, message.payload);
          break;
        default:
          if (this.config.debug) {
            console.log(`Unhandled signaling message type: ${message.type}`);
          }
      }
    } catch (error) {
      console.error(`Error handling signaling message from ${message.from}:`, error);
    }
  }

  private async handleOffer(peerConnection: PeerConnection, offer: RTCSessionDescriptionInit): Promise<void> {
    if (!peerConnection.webrtc) return;

    // Set remote description
    await peerConnection.webrtc.setRemoteDescription(offer);
    
    // Create answer
    const answer = await peerConnection.webrtc.createAnswer(offer);
    
    // Send answer back
    this.signalingServer.sendMessage({
      type: 'answer',
      from: this.localPeerId,
      to: peerConnection.peerId,
      payload: answer
    });
  }

  private async handleAnswer(peerConnection: PeerConnection, answer: RTCSessionDescriptionInit): Promise<void> {
    if (!peerConnection.webrtc) return;

    await peerConnection.webrtc.setRemoteDescription(answer);
  }

  private async handleIceCandidate(peerConnection: PeerConnection, candidate: RTCIceCandidateInit): Promise<void> {
    if (!peerConnection.webrtc) return;

    await peerConnection.webrtc.addIceCandidate(candidate);
  }

  private queueMessage(peerConnection: PeerConnection, data: string | ArrayBuffer | ArrayBufferView, channelLabel: string): void {
    const queuedMessage: QueuedMessage = {
      data,
      timestamp: Date.now(),
      channelLabel,
      retryCount: 0,
      maxRetries: 5
    };

    // Add to queue (at the end)
    peerConnection.messageQueue.push(queuedMessage);

    // Limit queue size
    if (peerConnection.messageQueue.length > this.config.messageQueueSize!) {
      peerConnection.messageQueue.shift(); // Remove oldest message
    }

    if (this.config.debug) {
      console.log(`Message queued for peer ${peerConnection.peerId}, channel ${channelLabel}`);
    }
  }

  private processQueuedMessages(peerConnection: PeerConnection): void {
    if (!peerConnection.connected || peerConnection.messageQueue.length === 0) {
      return;
    }

    // Process messages in order
    const remainingMessages: QueuedMessage[] = [];
    
    peerConnection.messageQueue.forEach(queuedMessage => {
      const channel = peerConnection.dataChannels.get(queuedMessage.channelLabel);
      
      if (channel && channel.readyState === RTCDataChannelState.OPEN) {
        try {
          channel.send(queuedMessage.data);
          
          if (this.config.debug) {
            console.log(`Queued message sent to ${peerConnection.peerId} via channel ${queuedMessage.channelLabel}`);
          }
        } catch (error) {
          // Retry or discard
          if (queuedMessage.retryCount < queuedMessage.maxRetries) {
            queuedMessage.retryCount++;
            remainingMessages.push(queuedMessage);
          } else {
            console.warn(`Discarding queued message for ${peerConnection.peerId} after ${queuedMessage.maxRetries} retries`);
          }
        }
      } else {
        // Channel not ready, keep in queue
        remainingMessages.push(queuedMessage);
      }
    });

    // Update queue
    peerConnection.messageQueue = remainingMessages;
  }

  private processQueuedMessagesForChannel(peerConnection: PeerConnection, channelLabel: string): void {
    if (!peerConnection.connected) return;

    // Process messages for this specific channel
    const remainingMessages: QueuedMessage[] = [];
    
    peerConnection.messageQueue.forEach(queuedMessage => {
      if (queuedMessage.channelLabel === channelLabel) {
        const channel = peerConnection.dataChannels.get(channelLabel);
        
        if (channel && channel.readyState === RTCDataChannelState.OPEN) {
          try {
            channel.send(queuedMessage.data);
            
            if (this.config.debug) {
              console.log(`Queued message sent to ${peerConnection.peerId} via channel ${channelLabel}`);
            }
          } catch (error) {
            // Retry
            if (queuedMessage.retryCount < queuedMessage.maxRetries) {
              queuedMessage.retryCount++;
              remainingMessages.push(queuedMessage);
            }
          }
        } else {
          remainingMessages.push(queuedMessage);
        }
      } else {
        // Different channel, keep in queue
        remainingMessages.push(queuedMessage);
      }
    });

    // Update queue
    peerConnection.messageQueue = remainingMessages;
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      const timeout = this.config.connectionTimeout!;
      
      this.peers.forEach((peerConnection, peerId) => {
        // Check for inactive peers
        if (now - peerConnection.lastActivity > timeout && !peerConnection.connected) {
          console.warn(`Peer ${peerId} connection timeout, disconnecting`);
          this.disconnectFromPeer(peerId);
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
      'auto-reconnect'
    ];
  }
}
