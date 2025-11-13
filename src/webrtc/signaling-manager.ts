/**
 * Signaling Manager
 * 
 * Handles WebRTC signaling logic, offer/answer exchange,
 * and ICE candidate management.
 */

import { EventEmitter } from 'events';
import type { RTCSessionDescriptionInit, RTCIceCandidateInit } from './types.js';
import { SignalingMessage } from './signaling-server.js';

export interface SignalingManagerConfig {
  debug: boolean;
  enableIceRestart: boolean;
  connectionTimeout: number;
}

/**
 * Signaling State Manager
 */
export class SignalingManager extends EventEmitter {
  private config: SignalingManagerConfig;
  private localPeerId: string;
  private pendingOffers = new Map<string, RTCSessionDescriptionInit>();
  private pendingAnswers = new Map<string, RTCSessionDescriptionInit>();
  private iceCandidates = new Map<string, RTCIceCandidateInit[]>();

  constructor(localPeerId: string, config: Partial<SignalingManagerConfig> = {}) {
    super();
    this.localPeerId = localPeerId;
    this.config = {
      debug: false,
      enableIceRestart: true,
      connectionTimeout: 30000,
      ...config
    };
  }

  /**
   * Create and track offer
   */
  async createOffer(peerId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    this.pendingOffers.set(peerId, offer);
    
    if (this.config.debug) {
      console.log(`[Signaling] Created offer for ${peerId}:`, offer.type);
    }

    this.emit('offer-created', { peerId, offer });
  }

  /**
   * Handle incoming offer
   */
  async handleOffer(peerId: string, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
    if (this.config.debug) {
      console.log(`[Signaling] Received offer from ${peerId}:`, offer.type);
    }

    // Validate offer
    if (!this.isValidOffer(offer)) {
      this.emit('offer-invalid', { peerId, offer });
      return null;
    }

    this.emit('offer-received', { peerId, offer });
    return offer;
  }

  /**
   * Create and track answer
   */
  async createAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    this.pendingAnswers.set(peerId, answer);
    
    if (this.config.debug) {
      console.log(`[Signaling] Created answer for ${peerId}:`, answer.type);
    }

    this.emit('answer-created', { peerId, answer });
  }

  /**
   * Handle incoming answer
   */
  async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
    if (this.config.debug) {
      console.log(`[Signaling] Received answer from ${peerId}:`, answer.type);
    }

    // Validate answer
    if (!this.isValidAnswer(answer)) {
      this.emit('answer-invalid', { peerId, answer });
      return null;
    }

    // Check if we have a matching offer
    const pendingOffer = this.pendingOffers.get(peerId);
    if (pendingOffer) {
      this.pendingOffers.delete(peerId);
      this.emit('offer-answered', { peerId, offer: pendingOffer, answer });
    }

    this.emit('answer-received', { peerId, answer });
    return answer;
  }

  /**
   * Add ICE candidate
   */
  addIceCandidate(peerId: string, candidate: RTCIceCandidateInit): void {
    if (!this.iceCandidates.has(peerId)) {
      this.iceCandidates.set(peerId, []);
    }

    const candidates = this.iceCandidates.get(peerId)!;
    
    // Check for duplicate candidates
    const isDuplicate = candidates.some(c => 
      c.candidate === candidate.candidate && 
      c.sdpMid === candidate.sdpMid
    );

    if (!isDuplicate) {
      candidates.push(candidate);
      
      if (this.config.debug) {
        console.log(`[Signaling] Added ICE candidate for ${peerId}:`, candidate.candidate?.substring(0, 50) + '...');
      }

      this.emit('ice-candidate-added', { peerId, candidate });
    }
  }

  /**
   * Handle incoming ICE candidate
   */
  handleIceCandidate(peerId: string, candidate: RTCIceCandidateInit): RTCIceCandidateInit | null {
    if (this.config.debug) {
      console.log(`[Signaling] Received ICE candidate from ${peerId}:`, candidate.candidate?.substring(0, 50) + '...');
    }

    // Validate candidate
    if (!this.isValidIceCandidate(candidate)) {
      this.emit('ice-candidate-invalid', { peerId, candidate });
      return null;
    }

    this.emit('ice-candidate-received', { peerId, candidate });
    return candidate;
  }

  /**
   * Get pending ICE candidates for peer
   */
  getPendingIceCandidates(peerId: string): RTCIceCandidateInit[] {
    return this.iceCandidates.get(peerId) || [];
  }

  /**
   * Clear pending state for peer
   */
  clearPeerState(peerId: string): void {
    this.pendingOffers.delete(peerId);
    this.pendingAnswers.delete(peerId);
    this.iceCandidates.delete(peerId);
    
    if (this.config.debug) {
      console.log(`[Signaling] Cleared state for ${peerId}`);
    }
  }

  /**
   * Get signaling statistics
   */
  getStats(): {
    pendingOffers: number;
    pendingAnswers: number;
    pendingIceCandidates: number;
    totalPeers: number;
  } {
    const totalIceCandidates = Array.from(this.iceCandidates.values())
      .reduce((total, candidates) => total + candidates.length, 0);

    return {
      pendingOffers: this.pendingOffers.size,
      pendingAnswers: this.pendingAnswers.size,
      pendingIceCandidates: totalIceCandidates,
      totalPeers: new Set([
        ...this.pendingOffers.keys(),
        ...this.pendingAnswers.keys(),
        ...this.iceCandidates.keys()
      ]).size
    };
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.pendingOffers.clear();
    this.pendingAnswers.clear();
    this.iceCandidates.clear();
    
    if (this.config.debug) {
      console.log('[Signaling] Cleared all state');
    }
  }

  /**
   * Validate offer SDP
   */
  private isValidOffer(offer: RTCSessionDescriptionInit): boolean {
    if (!offer || !offer.type || offer.type !== 'offer') {
      return false;
    }

    if (!offer.sdp || !offer.sdp.includes('v=0')) {
      return false;
    }

    // Check for required SDP attributes
    const requiredAttributes = ['a=ice-ufrag', 'a=ice-pwd', 'a=fingerprint'];
    return requiredAttributes.every(attr => offer.sdp!.includes(attr));
  }

  /**
   * Validate answer SDP
   */
  private isValidAnswer(answer: RTCSessionDescriptionInit): boolean {
    if (!answer || !answer.type || answer.type !== 'answer') {
      return false;
    }

    if (!answer.sdp || !answer.sdp.includes('v=0')) {
      return false;
    }

    // Check for required SDP attributes
    const requiredAttributes = ['a=ice-ufrag', 'a=ice-pwd', 'a=fingerprint'];
    return requiredAttributes.every(attr => answer.sdp!.includes(attr));
  }

  /**
   * Validate ICE candidate
   */
  private isValidIceCandidate(candidate: RTCIceCandidateInit): boolean {
    if (!candidate) {
      return false;
    }

    // Check for candidate foundation if available
    if (candidate.candidate && !candidate.candidate.includes('candidate:')) {
      return false;
    }

    return true;
  }

  /**
   * Create signaling message
   */
  createSignalingMessage(
    type: SignalingMessage['type'],
    to: string,
    payload: any
  ): Omit<SignalingMessage, 'id' | 'from' | 'timestamp'> {
    return {
      type,
      to,
      payload
    };
  }

  /**
   * Handle signaling timeout
   */
  startConnectionTimeout(peerId: string): NodeJS.Timeout {
    return setTimeout(() => {
      if (this.pendingOffers.has(peerId) || this.pendingAnswers.has(peerId)) {
        this.emit('connection-timeout', { peerId });
        this.clearPeerState(peerId);
      }
    }, this.config.connectionTimeout);
  }

  /**
   * Cancel connection timeout
   */
  cancelConnectionTimeout(peerId: string, timeoutId: NodeJS.Timeout): void {
    clearTimeout(timeoutId);
  }
}
