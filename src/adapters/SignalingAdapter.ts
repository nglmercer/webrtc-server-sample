/**
 * Signaling Adapter
 * 
 * This adapter bridges the main SignalingServer with WebRTC capabilities.
 * It provides a unified interface for WebRTC signaling while maintaining
 * compatibility with the existing infrastructure.
 */

import { EventEmitter } from 'events';
import { SignalingServer } from '../signal_server.js';
import type { User, Room, CustomSocket } from '../types.js';
import type { SignalingMessage, PeerInfo } from '../webrtc/signaling-server.js';

export interface SignalingAdapterConfig {
  signalingServer: SignalingServer;
  enableWebRTC?: boolean;
  enableLegacySupport?: boolean;
  debug?: boolean;
}

export interface WebRTCPeerInfo extends PeerInfo {
  socket?: CustomSocket;
  capabilities?: string[];
}

/**
 * Adapter class that integrates the main SignalingServer with WebRTC
 */
export class SignalingAdapter extends EventEmitter {
  private config: SignalingAdapterConfig;
  private webrtcPeers: Map<string, WebRTCPeerInfo> = new Map();
  private roomPeers: Map<string, Set<string>> = new Map();
  private messageQueues: Map<string, SignalingMessage[]> = new Map();

  constructor(config: SignalingAdapterConfig) {
    super();
    this.config = {
      enableWebRTC: true,
      enableLegacySupport: true,
      debug: false,
      ...config
    };

    this.setupSignalingServerIntegration();
  }

  /**
   * Register a WebRTC peer with the adapter
   */
  registerWebRTCPeer(peerId: string, roomId: string, metadata?: any): void {
    // Find corresponding user in the main signaling server
    const user = this.config.signalingServer.getUserById(peerId);
    
    const peerInfo: WebRTCPeerInfo = {
      id: peerId,
      roomId,
      joinedAt: Date.now(),
      metadata,
      socket: user?.socket,
      capabilities: this.getPeerCapabilities()
    };

    this.webrtcPeers.set(peerId, peerInfo);

    // Add to room tracking
    if (!this.roomPeers.has(roomId)) {
      this.roomPeers.set(roomId, new Set());
    }
    this.roomPeers.get(roomId)!.add(peerId);

    // Process any queued messages
    this.processQueuedMessages(peerId);

    if (this.config.debug) {
      console.log(`WebRTC peer registered: ${peerId} in room ${roomId}`);
    }

    this.emit('peer-joined', peerInfo);
  }

  /**
   * Unregister a WebRTC peer
   */
  unregisterWebRTCPeer(peerId: string): void {
    const peerInfo = this.webrtcPeers.get(peerId);
    if (!peerInfo) return;

    // Remove from room first
    const initialRoom = this.roomPeers.get(peerInfo.roomId);
    if (initialRoom) {
      initialRoom.delete(peerId);
      if (initialRoom.size === 0) {
        this.roomPeers.delete(peerInfo.roomId);
      }
    }

    // Clean up peer - ensure synchronous deletion
    this.webrtcPeers.delete(peerId);
    this.messageQueues.delete(peerId);

    if (this.config.debug) {
      console.log(`WebRTC peer unregistered: ${peerId}`);
    }

    this.emit('peer-left', peerInfo);
    
    // Force synchronous cleanup - ensure peer is completely removed
    const roomId = peerInfo.roomId;
    
    // Double-check peer removal from webrtcPeers
    if (this.webrtcPeers.has(peerId)) {
      this.webrtcPeers.delete(peerId);
    }
    
    // Remove from room tracking
    const roomTracker = this.roomPeers.get(roomId);
    if (roomTracker) {
      roomTracker.delete(peerId);
      if (roomTracker.size === 0) {
        this.roomPeers.delete(roomId);
      }
    }
    
    // Final verification - ensure no traces remain
    const finalCheck = this.roomPeers.get(roomId);
    if (finalCheck && finalCheck.has(peerId)) {
      finalCheck.delete(peerId);
    }
    if (finalCheck && finalCheck.size === 0) {
      this.roomPeers.delete(roomId);
    }
  }

  /**
   * Send a WebRTC signaling message
   */
  sendSignalingMessage(message: Omit<SignalingMessage, 'id' | 'timestamp'>): void {
    const fullMessage: SignalingMessage = {
      id: this.generateMessageId(),
      timestamp: Date.now(),
      ...message
    };

    // Emit the message for testing/listeners
    this.emit('webrtc-message', fullMessage);

    if (message.to) {
      // Direct message to specific peer
      this.sendToPeer(message.to, fullMessage);
    } else if (message.room) {
      // Broadcast to room
      this.broadcastToRoom(message.room, fullMessage, message.from);
    }
  }

  /**
   * Get all WebRTC peers in a room
   */
  getWebRTCPeersInRoom(roomId: string): WebRTCPeerInfo[] {
    const room = this.roomPeers.get(roomId);
    if (!room) return [];

    return Array.from(room).map(peerId => this.webrtcPeers.get(peerId)!).filter(Boolean);
  }

  /**
   * Get WebRTC peer information
   */
  getWebRTCPeerInfo(peerId: string): WebRTCPeerInfo | undefined {
    return this.webrtcPeers.get(peerId);
  }

  /**
   * Get all WebRTC rooms
   */
  getWebRTCRooms(): string[] {
    return Array.from(this.roomPeers.keys());
  }

  /**
   * Send a message through the main signaling server
   */
  sendMainSignalingMessage(socketId: string, event: string, data: any): void {
    const user = this.config.signalingServer.getUserById(socketId);
    if (user?.socket) {
      user.socket.emit(event, data);
    }
  }

  /**
   * Handle message from main signaling server
   */
  handleMainSignalingMessage(socket: CustomSocket, message: any): void {
    const peerId = socket.userid;
    
    // Check if this is a WebRTC peer
    const webrtcPeer = this.webrtcPeers.get(peerId);
    if (webrtcPeer) {
      // Convert to WebRTC signaling format
      const webrtcMessage = this.convertToWebRTCMessage(peerId, message);
      if (webrtcMessage) {
        this.emit('webrtc-message', webrtcMessage);
        this.sendSignalingMessage(webrtcMessage);
      }
    }

    // Handle legacy message routing if enabled
    if (this.config.enableLegacySupport) {
      this.handleLegacyMessage(socket, message);
    }
  }

  /**
   * Get adapter statistics
   */
  getStats(): {
    totalWebRTCPeers: number;
    totalWebRTCRooms: number;
    queuedMessages: number;
    mainServerStats: any;
  } {
    let queuedMessages = 0;
    this.messageQueues.forEach(queue => {
      queuedMessages += queue.length;
    });

    return {
      totalWebRTCPeers: this.webrtcPeers.size,
      totalWebRTCRooms: this.roomPeers.size,
      queuedMessages,
      mainServerStats: this.config.signalingServer.getConnectionStats()
    };
  }

  private setupSignalingServerIntegration(): void {
    // Monitor user connections in the main signaling server
    const originalHandleConnection = this.config.signalingServer.handleConnection.bind(this.config.signalingServer);
    
    this.config.signalingServer.handleConnection = (socket: any) => {
      const result = originalHandleConnection(socket);
      
      // Set up message handler for this socket
      socket.on('webrtc-message', (message: any) => {
        this.handleMainSignalingMessage(socket, message);
      });

      return result;
    };
  }

  private sendToPeer(peerId: string, message: SignalingMessage): void {
    const targetPeer = this.webrtcPeers.get(peerId);
    if (!targetPeer) {
      // Queue message for peer if not online
      this.queueMessage(peerId, message);
      return;
    }

    // Send via main signaling server if socket is available
    if (targetPeer.socket) {
      targetPeer.socket.emit('webrtc-message', message);
    } else {
      // Emit directly for WebRTC peers without main socket
      this.emit(`message:${peerId}`, message);
    }
  }

  private broadcastToRoom(roomId: string, message: SignalingMessage, excludePeer?: string): void {
    const room = this.roomPeers.get(roomId);
    if (!room) return;

    room.forEach(peerId => {
      if (peerId !== excludePeer) {
        this.sendToPeer(peerId, message);
      }
    });
  }

  private queueMessage(peerId: string, message: SignalingMessage): void {
    if (!this.messageQueues.has(peerId)) {
      this.messageQueues.set(peerId, []);
    }

    const queue = this.messageQueues.get(peerId)!;
    queue.push(message);

    // Limit queue size to prevent memory issues
    if (queue.length > 100) {
      queue.shift(); // Remove oldest message
    }
  }

  private processQueuedMessages(peerId: string): void {
    const queue = this.messageQueues.get(peerId);
    if (!queue || queue.length === 0) return;

    // Process all queued messages
    setTimeout(() => {
      const messages = queue.splice(0); // Get and clear queue
      messages.forEach(message => {
        this.emit(`message:${peerId}`, message);
      });
    }, 100); // Small delay to ensure peer is fully ready
  }

  private convertToWebRTCMessage(peerId: string, message: any): SignalingMessage | null {
    // Convert legacy message format to WebRTC signaling format
    if (message.message?.offer || message.message?.answer || message.message?.iceCandidate) {
      const payload = message.message.offer || message.message.answer || message.message.iceCandidate;
      const type = message.message.offer ? 'offer' : 
                   message.message.answer ? 'answer' : 'ice-candidate';

      return {
        id: this.generateMessageId(),
        type: type as 'offer' | 'answer' | 'ice-candidate',
        from: peerId,
        to: message.remoteUserId,
        timestamp: Date.now(),
        payload
      };
    }

    return null;
  }

  private handleLegacyMessage(socket: CustomSocket, message: any): void {
    // Handle legacy message routing through the main system
    // This ensures backward compatibility
    if (this.config.debug) {
      console.log(`Handling legacy message from ${socket.userid}:`, message);
    }

    this.emit('legacy-message', { socket, message });
  }

  private getPeerCapabilities(): string[] {
    return [
      'data-channels',
      'audio',
      'video',
      'screen-sharing',
      'signaling-v2',
      'main-server-integration'
    ];
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Create a new SignalingAdapter instance
 */
export function createSignalingAdapter(config: SignalingAdapterConfig): SignalingAdapter {
  return new SignalingAdapter(config);
}
