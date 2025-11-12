/**
 * Tests específicos para validar conexiones P2P reales con node-datachannel
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { NodeDataChannelWebRTC } from '../../../src/webrtc/node-datachannel';
import type { WebRTCConfig } from '../../../src/webrtc/types';
import { RTCSdpType } from '../../../src/webrtc/types';
import { TEST_TIMEOUTS, createTimeoutPromise, waitFor } from '../setup';

describe('NodeDataChannelWebRTC - Connection Tests', () => {
  let webrtc1: NodeDataChannelWebRTC;
  let webrtc2: NodeDataChannelWebRTC;

  beforeEach(async () => {
    // Use unique peer names to avoid race conditions
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    
    webrtc1 = new NodeDataChannelWebRTC({
      debug: true,
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ],
      userId: `peer1-${timestamp}-${random}`
    });

    webrtc2 = new NodeDataChannelWebRTC({
      debug: true,
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ],
      userId: `peer2-${timestamp}-${random}`
    });

    // Ensure connections are established before tests
    await createTimeoutPromise(webrtc1.connect(), TEST_TIMEOUTS.CONNECTION, 'webrtc1 connection timeout');
    await createTimeoutPromise(webrtc2.connect(), TEST_TIMEOUTS.CONNECTION, 'webrtc2 connection timeout');
  });

  afterEach(async () => {
    // Proper async cleanup
    const cleanupPromises: Promise<void>[] = [];
    
    if (webrtc1 && webrtc1.isConnected()) {
      cleanupPromises.push(
        createTimeoutPromise(
          new Promise<void>((resolve) => {
            webrtc1.once('disconnect', resolve);
            webrtc1.disconnect();
            // Fallback timeout in case event doesn't fire
            setTimeout(resolve, 1000);
          }),
          TEST_TIMEOUTS.SHORT,
          'webrtc1 disconnect timeout'
        )
      );
    }
    
    if (webrtc2 && webrtc2.isConnected()) {
      cleanupPromises.push(
        createTimeoutPromise(
          new Promise<void>((resolve) => {
            webrtc2.once('disconnect', resolve);
            webrtc2.disconnect();
            // Fallback timeout in case event doesn't fire
            setTimeout(resolve, 1000);
          }),
          TEST_TIMEOUTS.SHORT,
          'webrtc2 disconnect timeout'
        )
      );
    }

    await Promise.allSettled(cleanupPromises);
  });

  it('should create offer successfully', async () => {
    const offer = await createTimeoutPromise(
      webrtc1.createOffer(),
      TEST_TIMEOUTS.MEDIUM,
      'Offer creation timeout'
    );
    
    expect(offer).toBeDefined();
    expect(offer.type).toBe(RTCSdpType.OFFER);
    expect(offer.sdp).toBeDefined();
    expect(offer.sdp).not.toBe('');
  });

  it('should create answer successfully', async () => {
    const offer = await createTimeoutPromise(
      webrtc1.createOffer(),
      TEST_TIMEOUTS.MEDIUM,
      'Offer creation timeout'
    );
    
    const answer = await createTimeoutPromise(
      webrtc2.createAnswer(offer),
      TEST_TIMEOUTS.MEDIUM,
      'Answer creation timeout'
    );
    
    expect(answer).toBeDefined();
    expect(answer.type).toBe(RTCSdpType.ANSWER);
    expect(answer.sdp).toBeDefined();
    expect(answer.sdp).not.toBe('');
  });

  it('should exchange ICE candidates', async () => {
    const offer = await createTimeoutPromise(
      webrtc1.createOffer(),
      TEST_TIMEOUTS.MEDIUM,
      'Offer creation timeout'
    );
    
    // Set up ICE candidate collection BEFORE starting operations
    const candidates1: any[] = [];
    const candidates2: any[] = [];
    
    webrtc1.on('iceCandidate', (candidate) => {
      candidates1.push(candidate);
    });
    
    webrtc2.on('iceCandidate', (candidate) => {
      candidates2.push(candidate);
    });

    // Wait for ICE candidates with a shorter, more reliable timeout
    await createTimeoutPromise(
      new Promise(resolve => {
        // Check every 100ms for candidates
        const checkInterval = setInterval(() => {
          if (candidates1.length > 0 || candidates2.length > 0) {
            clearInterval(checkInterval);
            resolve(undefined);
          }
        }, 100);
        
        // Force resolve after timeout to prevent hanging
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(undefined);
        }, 3000); // Reduced timeout for more reliability
      }),
      4000, // Overall test timeout
      'ICE candidates collection timeout'
    );
    
    // At least one peer should generate ICE candidates
    expect(candidates1.length + candidates2.length).toBeGreaterThan(0);
  });

  it('should establish complete signaling exchange', async () => {
    // Complete offer/answer exchange - just test that signaling flow works
    const offer = await createTimeoutPromise(
      webrtc1.createOffer(),
      TEST_TIMEOUTS.MEDIUM,
      'Offer creation timeout'
    );
    expect(offer.type).toBe(RTCSdpType.OFFER);
    
    // Mock the setLocalDescription since node-datachannel handles it internally
    await createTimeoutPromise(
      webrtc1.setLocalDescription(offer),
      TEST_TIMEOUTS.SHORT,
      'Set local description timeout'
    );
    
    // Mock remote description setting
    await createTimeoutPromise(
      webrtc2.setRemoteDescription(offer),
      TEST_TIMEOUTS.SHORT,
      'Set remote description timeout'
    );
    
    const answer = await createTimeoutPromise(
      webrtc2.createAnswer(offer),
      TEST_TIMEOUTS.MEDIUM,
      'Answer creation timeout'
    );
    expect(answer.type).toBe(RTCSdpType.ANSWER);
    
    // Mock the setLocalDescription since node-datachannel handles it internally
    await createTimeoutPromise(
      webrtc2.setLocalDescription(answer),
      TEST_TIMEOUTS.SHORT,
      'Set local description timeout'
    );
    
    // Mock remote description setting
    await createTimeoutPromise(
      webrtc1.setRemoteDescription(answer),
      TEST_TIMEOUTS.SHORT,
      'Set remote description timeout'
    );
    
    // Just verify that signaling completes successfully
    expect(offer.sdp).toBeDefined();
    expect(answer.sdp).toBeDefined();
  });

  it('should create data channels after connection', async () => {
    // Establish connection
    const offer = await createTimeoutPromise(
      webrtc1.createOffer(),
      TEST_TIMEOUTS.MEDIUM,
      'Offer creation timeout'
    );
    
    await createTimeoutPromise(
      webrtc1.setLocalDescription(offer),
      TEST_TIMEOUTS.SHORT,
      'Set local description timeout'
    );
    
    await createTimeoutPromise(
      webrtc2.setRemoteDescription(offer),
      TEST_TIMEOUTS.SHORT,
      'Set remote description timeout'
    );
    
    const answer = await createTimeoutPromise(
      webrtc2.createAnswer(offer),
      TEST_TIMEOUTS.MEDIUM,
      'Answer creation timeout'
    );
    
    await createTimeoutPromise(
      webrtc2.setLocalDescription(answer),
      TEST_TIMEOUTS.SHORT,
      'Set local description timeout'
    );
    
    await createTimeoutPromise(
      webrtc1.setRemoteDescription(answer),
      TEST_TIMEOUTS.SHORT,
      'Set remote description timeout'
    );
    
    // Wait for connection establishment
    await createTimeoutPromise(
      new Promise(resolve => setTimeout(resolve, TEST_TIMEOUTS.SHORT)),
      TEST_TIMEOUTS.SHORT,
      'Connection wait timeout'
    );
    
    // Create data channels
    const channel1 = webrtc1.createDataChannel('test-channel');
    const channel2 = webrtc2.createDataChannel('test-channel-2');
    
    expect(channel1).toBeDefined();
    expect(channel1.label).toBe('test-channel');
    expect(channel2).toBeDefined();
    expect(channel2.label).toBe('test-channel-2');
  });

  it('should handle connection errors gracefully', async () => {
    // Test with invalid ICE servers
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    
    const webrtcError = new NodeDataChannelWebRTC({
      debug: true,
      iceServers: [
        { urls: 'stun:invalid-server:19302' }
      ],
      userId: `error-peer-${timestamp}-${random}`
    });
    
    await createTimeoutPromise(
      webrtcError.connect(),
      TEST_TIMEOUTS.CONNECTION,
      'Error peer connection timeout'
    );
    
    // Should still create offer even with invalid ICE
    const offer = await createTimeoutPromise(
      webrtcError.createOffer(),
      TEST_TIMEOUTS.MEDIUM,
      'Error peer offer creation timeout'
    );
    expect(offer).toBeDefined();
    expect(offer.type).toBe(RTCSdpType.OFFER);
    
    webrtcError.disconnect();
  });

  it('should manage connection lifecycle correctly', async () => {
    // Connections should already be established in beforeEach
    expect(webrtc1.isConnected()).toBe(true);
    expect(webrtc2.isConnected()).toBe(true);
    
    // Test disconnect
    const disconnectPromise1 = new Promise<void>((resolve) => {
      webrtc1.once('disconnect', () => resolve());
    });
    
    const disconnectPromise2 = new Promise<void>((resolve) => {
      webrtc2.once('disconnect', () => resolve());
    });
    
    webrtc1.disconnect();
    webrtc2.disconnect();
    
    // Wait for disconnect events with timeout
    await Promise.race([
      Promise.all([disconnectPromise1, disconnectPromise2]),
      createTimeoutPromise(
        new Promise(resolve => setTimeout(resolve, TEST_TIMEOUTS.SHORT)),
        TEST_TIMEOUTS.SHORT,
        'Disconnect wait timeout'
      )
    ]);
    
    expect(webrtc1.isConnected()).toBe(false);
    expect(webrtc2.isConnected()).toBe(false);
  });

  it('should provide correct provider type and configuration', async () => {
    expect(webrtc1.getProviderType()).toBe('node-datachannel');
    
    const config = webrtc1.getConfiguration();
    expect(config.iceServers).toBeDefined();
    expect(Array.isArray(config.iceServers)).toBe(true);
  });
});
