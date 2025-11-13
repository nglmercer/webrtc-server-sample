/**
 * Individual Peer Connection Management
 * 
 * Handles a single WebRTC peer connection with its state,
 * data channels, and message queue.
 */

import { EventEmitter } from 'events';
import { NodeDataChannelWebRTC } from './node-datachannel.js';
import { NodeDataChannelWebRTCReal } from './node-datachannel-real.js';
import { UnifiedWebRTCProvider } from './unified-webrtc-provider.js';
import type { RTCDataChannel, RTCSessionDescriptionInit, RTCIceCandidateInit, WebRTCConfig } from './types.js';
import { RTCDataChannelState } from './types.js';

export interface QueuedMessage {
  data: string | ArrayBuffer | ArrayBufferView;
  timestamp: number;
  channelLabel: string;
  retryCount: number;
  maxRetries: number;
}

/**
 * Peer Connection State
 */
export class PeerConnection extends EventEmitter {
  public readonly peerId: string;
  public webrtc: NodeDataChannelWebRTC | NodeDataChannelWebRTCReal | UnifiedWebRTCProvider | null;
  public connected = false;
  public dataChannels = new Map<string, RTCDataChannel>();
  public messageQueue: QueuedMessage[] = [];
  public readonly createdAt: number;
  public lastActivity: number;

  constructor(
    peerId: string,
    webrtc: NodeDataChannelWebRTC | NodeDataChannelWebRTCReal | UnifiedWebRTCProvider | null,
    config: WebRTCConfig
  ) {
    super();
    this.peerId = peerId;
    this.webrtc = webrtc;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();

    if (webrtc) {
      this.setupWebRTCEvents();
    }
  }

  /**
   * Update last activity timestamp
   */
  updateActivity(): void {
    this.lastActivity = Date.now();
  }

  /**
   * Check if peer has exceeded connection timeout
   */
  isTimedOut(timeoutMs: number): boolean {
    return !this.connected && (Date.now() - this.lastActivity) > timeoutMs;
  }

  /**
   * Get all open data channels
   */
  getOpenDataChannels(): Map<string, RTCDataChannel> {
    const openChannels = new Map<string, RTCDataChannel>();
    this.dataChannels.forEach((channel, label) => {
      if (channel.readyState === RTCDataChannelState.OPEN) {
        openChannels.set(label, channel);
      }
    });
    return openChannels;
  }

  /**
   * Add data channel
   */
  addDataChannel(label: string, channel: RTCDataChannel): void {
    this.dataChannels.set(label, channel);
    this.setupDataChannelEvents(channel);
  }

  /**
   * Remove data channel
   */
  removeDataChannel(label: string): void {
    this.dataChannels.delete(label);
  }

  /**
   * Queue message for delivery
   */
  queueMessage(data: string | ArrayBuffer | ArrayBufferView, channelLabel: string, maxRetries: number = 5): void {
    const queuedMessage: QueuedMessage = {
      data,
      timestamp: Date.now(),
      channelLabel,
      retryCount: 0,
      maxRetries
    };

    this.messageQueue.push(queuedMessage);
  }

  /**
   * Process queued messages
   */
  processQueuedMessages(): void {
    if (!this.connected || this.messageQueue.length === 0) {
      return;
    }

    const remainingMessages: QueuedMessage[] = [];
    
    this.messageQueue.forEach(queuedMessage => {
      const channel = this.dataChannels.get(queuedMessage.channelLabel);
      
      if (channel && channel.readyState === RTCDataChannelState.OPEN) {
        try {
          channel.send(queuedMessage.data);
          this.emit('message-sent', {
            peerId: this.peerId,
            channelLabel: queuedMessage.channelLabel,
            data: queuedMessage.data
          });
        } catch (error) {
          if (queuedMessage.retryCount < queuedMessage.maxRetries) {
            queuedMessage.retryCount++;
            remainingMessages.push(queuedMessage);
          } else {
            this.emit('message-discarded', {
              peerId: this.peerId,
              channelLabel: queuedMessage.channelLabel,
              error,
              retries: queuedMessage.retryCount
            });
          }
        }
      } else {
        remainingMessages.push(queuedMessage);
      }
    });

    this.messageQueue = remainingMessages;
  }

  /**
   * Process queued messages for specific channel
   */
  processQueuedMessagesForChannel(channelLabel: string): void {
    if (!this.connected) return;

    const remainingMessages: QueuedMessage[] = [];
    
    this.messageQueue.forEach(queuedMessage => {
      if (queuedMessage.channelLabel === channelLabel) {
        const channel = this.dataChannels.get(channelLabel);
        
        if (channel && channel.readyState === RTCDataChannelState.OPEN) {
          try {
            channel.send(queuedMessage.data);
            this.emit('message-sent', {
              peerId: this.peerId,
              channelLabel,
              data: queuedMessage.data
            });
          } catch (error) {
            if (queuedMessage.retryCount < queuedMessage.maxRetries) {
              queuedMessage.retryCount++;
              remainingMessages.push(queuedMessage);
            } else {
              this.emit('message-discarded', {
                peerId: this.peerId,
                channelLabel,
                error,
                retries: queuedMessage.retryCount
              });
            }
          }
        } else {
          remainingMessages.push(queuedMessage);
        }
      } else {
        remainingMessages.push(queuedMessage);
      }
    });

    this.messageQueue = remainingMessages;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.webrtc) {
      this.webrtc.disconnect();
      this.webrtc = null;
    }

    this.dataChannels.forEach(channel => {
      try {
        channel.close();
      } catch (error) {
        // Ignore cleanup errors
      }
    });
    this.dataChannels.clear();
    this.messageQueue = [];
    this.connected = false;

    this.emit('cleanup', this.peerId);
  }

  private setupWebRTCEvents(): void {
    if (!this.webrtc) return;

    this.webrtc.on('connect', () => {
      this.connected = true;
      this.updateActivity();
      this.processQueuedMessages();
      this.emit('connected');
    });

    this.webrtc.on('disconnect', () => {
      this.connected = false;
      this.emit('disconnected');
    });

    this.webrtc.on('error', (error: Error) => {
      this.emit('error', error);
    });

    this.webrtc.on('iceCandidate', (candidate: RTCIceCandidateInit) => {
      this.emit('ice-candidate', candidate);
    });

    this.webrtc.on('dataChannel', (channel: RTCDataChannel) => {
      this.addDataChannel(channel.label, channel);
      this.emit('data-channel-received', channel);
    });

    // Also listen for connectionStateChange events for better compatibility
    this.webrtc.on('connectionStateChange', (state: string) => {
      if (state === 'connected' && !this.connected) {
        this.connected = true;
        this.updateActivity();
        this.processQueuedMessages();
        this.emit('connected');
      } else if (state === 'disconnected' && this.connected) {
        this.connected = false;
        this.emit('disconnected');
      }
    });
  }

  private setupDataChannelEvents(channel: RTCDataChannel): void {
    channel.onopen = () => {
      this.updateActivity();
      this.processQueuedMessagesForChannel(channel.label);
      this.emit('data-channel-open', {
        peerId: this.peerId,
        label: channel.label,
        channel
      });
    };

    channel.onmessage = (event: MessageEvent) => {
      this.updateActivity();
      this.emit('message', {
        peerId: this.peerId,
        data: event.data,
        channel: channel.label
      });
    };

    channel.onerror = (error: Event) => {
      this.emit('data-channel-error', {
        peerId: this.peerId,
        label: channel.label,
        error
      });
    };

    channel.onclose = () => {
      this.removeDataChannel(channel.label);
      this.emit('data-channel-close', {
        peerId: this.peerId,
        label: channel.label
      });
    };
  }
}
