/**
 * Enhanced Local Signaling Server for WebRTC
 * 
 * This module provides a simple in-memory signaling server that allows
 * multiple WebRTC peers to communicate within the same process without
 * requiring external signaling infrastructure.
 * 
 * Now supports integration with the main SignalingServer for enhanced
 * capabilities and backward compatibility.
 */

import { EventEmitter } from 'events';
import { SignalingServer } from '../signal_server.js';
import type { CustomSocket, User } from '../types.js';

export interface SignalingMessage {
  id: string;
  type: 'offer' | 'answer' | 'ice-candidate' | 'join-room' | 'leave-room' | 'peer-joined' | 'peer-left';
  from: string;
  to?: string;
  room?: string;
  timestamp: number;
  payload: any;
}

export interface PeerInfo {
  id: string;
  roomId: string;
  joinedAt: number;
  metadata?: any;
}

/**
 * Local Signaling Server Implementation
 * 
 * Provides in-memory signaling for WebRTC peers in the same process.
 * Eliminates the need for external signaling servers.
 * 
 * Enhanced with main SignalingServer integration capabilities.
 */
export class LocalSignalingServer extends EventEmitter {
  private peers: Map<string, PeerInfo> = new Map();
  private rooms: Map<string, Set<string>> = new Map();
  private messageQueue: Map<string, SignalingMessage[]> = new Map();
  private mainSignalingServer?: SignalingServer;
  private integrationEnabled: boolean;

  constructor(mainSignalingServer?: SignalingServer) {
    super();
    
    this.mainSignalingServer = mainSignalingServer;
    this.integrationEnabled = !!mainSignalingServer;
    
    if (this.integrationEnabled) {
      this.setupMainServerIntegration();
    }
  }

  /**
   * Register a peer with the signaling server
   */
  joinRoom(peerId: string, roomId: string, metadata?: any): void {
    // Remove peer from previous room if exists
    this.leaveRoom(peerId);

    // Register peer
    const peerInfo: PeerInfo = {
      id: peerId,
      roomId,
      joinedAt: Date.now(),
      metadata
    };

    this.peers.set(peerId, peerInfo);

    // Add to room
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId)!.add(peerId);

    // Notify other peers in the room
    const joinMessage: SignalingMessage = {
      id: this.generateMessageId(),
      type: 'peer-joined',
      from: peerId,
      room: roomId,
      timestamp: Date.now(),
      payload: { peerId, metadata }
    };

    this.broadcastToRoom(roomId, joinMessage, peerId);

    // Process any queued messages for this peer
    this.processQueuedMessages(peerId);

    this.emit('peer-joined', peerInfo);
  }

  /**
   * Remove a peer from their current room
   */
  leaveRoom(peerId: string): void {
    const peerInfo = this.peers.get(peerId);
    if (!peerInfo) return;

    const { roomId } = peerInfo;
    
    // Remove from room
    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(peerId);
      if (room.size === 0) {
        this.rooms.delete(roomId);
      }
    }

    // Remove peer
    this.peers.delete(peerId);
    this.messageQueue.delete(peerId);

    // Notify other peers
    const leaveMessage: SignalingMessage = {
      id: this.generateMessageId(),
      type: 'peer-left',
      from: peerId,
      room: roomId,
      timestamp: Date.now(),
      payload: { peerId }
    };

    this.broadcastToRoom(roomId, leaveMessage);

    this.emit('peer-left', peerInfo);
  }

  /**
   * Send a signaling message to another peer
   */
  sendMessage(message: Omit<SignalingMessage, 'id' | 'timestamp'>): void {
    const fullMessage: SignalingMessage = {
      id: this.generateMessageId(),
      timestamp: Date.now(),
      ...message
    };

    if (message.to) {
      // Direct message to specific peer
      this.sendToPeer(message.to, fullMessage);
    } else if (message.room) {
      // Broadcast to room
      this.broadcastToRoom(message.room, fullMessage, message.from);
    }
  }

  /**
   * Get all peers in a room
   */
  getPeersInRoom(roomId: string): PeerInfo[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];

    return Array.from(room).map(peerId => this.peers.get(peerId)!).filter(Boolean);
  }

  /**
   * Get peer information
   */
  getPeerInfo(peerId: string): PeerInfo | undefined {
    return this.peers.get(peerId);
  }

  /**
   * Get all rooms
   */
  getRooms(): string[] {
    return Array.from(this.rooms.keys());
  }

  /**
   * Get server statistics
   */
  getStats(): {
    totalPeers: number;
    totalRooms: number;
    queuedMessages: number;
  } {
    let queuedMessages = 0;
    this.messageQueue.forEach(queue => {
      queuedMessages += queue.length;
    });

    return {
      totalPeers: this.peers.size,
      totalRooms: this.rooms.size,
      queuedMessages
    };
  }

  /**
   * Clear all data (useful for testing)
   */
  clear(): void {
    this.peers.clear();
    this.rooms.clear();
    this.messageQueue.clear();
  }

  private sendToPeer(peerId: string, message: SignalingMessage): void {
    const targetPeer = this.peers.get(peerId);
    if (!targetPeer) {
      // Queue message for peer if not online
      this.queueMessage(peerId, message);
      return;
    }

    // Emit message to target peer
    this.emit(`message:${peerId}`, message);
  }

  private broadcastToRoom(roomId: string, message: SignalingMessage, excludePeer?: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.forEach(peerId => {
      if (peerId !== excludePeer) {
        this.sendToPeer(peerId, message);
      }
    });
  }

  private queueMessage(peerId: string, message: SignalingMessage): void {
    if (!this.messageQueue.has(peerId)) {
      this.messageQueue.set(peerId, []);
    }

    const queue = this.messageQueue.get(peerId)!;
    queue.push(message);

    // Limit queue size to prevent memory issues
    if (queue.length > 100) {
      queue.shift(); // Remove oldest message
    }
  }

  private processQueuedMessages(peerId: string): void {
    const queue = this.messageQueue.get(peerId);
    if (!queue || queue.length === 0) return;

    // Process all queued messages
    setTimeout(() => {
      const messages = queue.splice(0); // Get and clear queue
      messages.forEach(message => {
        this.emit(`message:${peerId}`, message);
      });
    }, 100); // Small delay to ensure peer is fully ready
  }

  private setupMainServerIntegration(): void {
    if (!this.mainSignalingServer) return;

    // Note: Main SignalingServer integration is handled through the adapter
    // This local server can work independently or in conjunction with the adapter
    console.log('[LocalSignalingServer] Main SignalingServer integration available');
  }

  private handleMainServerMessage(socket: CustomSocket, message: any): void {
    const { type, from, to, payload } = message;
    
    // Convert main server message to local format
    const localMessage: SignalingMessage = {
      id: this.generateMessageId(),
      type: type as SignalingMessage['type'],
      from,
      to,
      timestamp: Date.now(),
      payload
    };

    // Route through local signaling
    this.sendMessage(localMessage);
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Global signaling server instance
 * This allows multiple WebRTC instances to share the same signaling server
 */
let globalSignalingServer: LocalSignalingServer | null = null;

/**
 * Get or create the global signaling server
 */
export function getGlobalSignalingServer(): LocalSignalingServer {
  if (!globalSignalingServer) {
    globalSignalingServer = new LocalSignalingServer();
    // Set max listeners to prevent memory leak warnings during tests
    globalSignalingServer.setMaxListeners(50);
  }
  return globalSignalingServer;
}

/**
 * Reset the global signaling server (useful for testing)
 */
export function resetGlobalSignalingServer(): void {
  if (globalSignalingServer) {
    globalSignalingServer.clear();
    globalSignalingServer.removeAllListeners();
    // Set max listeners to prevent memory leak warnings during tests
    globalSignalingServer.setMaxListeners(100);
  }
  globalSignalingServer = null;
}
