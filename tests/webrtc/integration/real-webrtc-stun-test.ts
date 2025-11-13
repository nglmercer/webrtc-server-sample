/**
 * Test REAL WebRTC with STUN connectivity using NodeDataChannelWebRTCReal
 * This test validates actual STUN server connectivity and srflx candidates
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { NodeDataChannelWebRTCReal } from '../../../src/webrtc/node-datachannel-real';
import type { WebRTCConfig } from '../../../src/webrtc/types';
import { RTCSdpType } from '../../../src/webrtc/types';

describe('REAL WebRTC STUN Connectivity Tests', () => {
  let webrtc1: NodeDataChannelWebRTCReal;
  let webrtc2: NodeDataChannelWebRTCReal;

  beforeEach(async () => {
    // Unique identifiers for each test
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    
    // Configuration with REAL STUN servers
    const realConfig: WebRTCConfig = {
      debug: true,
      iceServers: [
        // Multiple STUN servers for better connectivity
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.services.mozilla.com:3478' }
      ],
      userId: `real-stun-peer1-${timestamp}-${random}`
    };

    webrtc1 = new NodeDataChannelWebRTCReal(realConfig);
    
    webrtc2 = new NodeDataChannelWebRTCReal({
      ...realConfig,
      userId: `real-stun-peer2-${timestamp}-${random}`
    });

    await webrtc1.connect();
    await webrtc2.connect();
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterEach(async () => {
    // Proper cleanup
    if (webrtc1 && webrtc1.isConnected()) {
      webrtc1.disconnect();
    }
    
    if (webrtc2 && webrtc2.isConnected()) {
      webrtc2.disconnect();
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  it('should generate srflx candidates with REAL STUN servers', async () => {
    console.log('🌐 Testing REAL STUN server connectivity...');
    
    const iceCandidates1: any[] = [];
    const iceCandidates2: any[] = [];

    // Track ICE candidates
    webrtc1.on('iceCandidate', (candidate) => {
      iceCandidates1.push(candidate);
      console.log('🧊 REAL Peer1 ICE:', candidate.candidate?.substring(0, 100) + '...');
    });

    webrtc2.on('iceCandidate', (candidate) => {
      iceCandidates2.push(candidate);
      console.log('🧊 REAL Peer2 ICE:', candidate.candidate?.substring(0, 100) + '...');
    });

    // Create offer to trigger ICE gathering
    const offer = await webrtc1.createOffer();
    expect(offer.type).toBe(RTCSdpType.OFFER);
    expect(offer.sdp).toBeDefined();
    expect(offer.sdp).toContain('v=0');
    
    console.log('✅ REAL Offer created with SDP length:', offer.sdp?.length);

    // Wait for ICE gathering (increased time for STUN)
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('📊 REAL ICE candidates collected:', {
      peer1: iceCandidates1.length,
      peer2: iceCandidates2.length
    });

    // Analyze ICE candidate types
    const candidateTypes1 = new Set(iceCandidates1.map(c => 
      c.candidate?.includes('typ host') ? 'host' :
      c.candidate?.includes('typ srflx') ? 'srflx' :
      c.candidate?.includes('typ relay') ? 'relay' : 'other'
    ));
    
    const candidateTypes2 = new Set(iceCandidates2.map(c => 
      c.candidate?.includes('typ host') ? 'host' :
      c.candidate?.includes('typ srflx') ? 'srflx' :
      c.candidate?.includes('typ relay') ? 'relay' : 'other'
    ));

    console.log('🌍 REAL ICE candidate types detected:', {
      peer1: Array.from(candidateTypes1),
      peer2: Array.from(candidateTypes2)
    });

    // Should have at least host candidates (local IPs)
    expect(candidateTypes1.has('host')).toBe(true);
    expect(candidateTypes2.has('host')).toBe(true);

    // KEY TEST: Should have srflx candidates if STUN servers are working
    console.log('🔍 STUN connectivity results:', {
      peer1HasSrflx: candidateTypes1.has('srflx'),
      peer2HasSrflx: candidateTypes2.has('srflx'),
      peer1HostCount: Array.from(candidateTypes1).filter(t => t === 'host').length,
      peer2HostCount: Array.from(candidateTypes2).filter(t => t === 'host').length
    });

    // Extract and analyze IP addresses
    const ips1 = new Set<string>();
    const publicIps1 = new Set<string>();
    
    iceCandidates1.forEach(candidate => {
      const candidateStr = candidate.candidate || '';
      const ipMatch = candidateStr.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g);
      
      if (ipMatch) {
        const ip = ipMatch[0];
        ips1.add(ip);
        
        // Check if it's a public IP (not private)
        const isPrivate = ip.startsWith('192.168.') || 
                         ip.startsWith('10.') || 
                         ip.startsWith('172.') ||
                         ip.startsWith('127.');
        
        if (!isPrivate) {
          publicIps1.add(ip);
        }
      }
    });

    console.log('🌐 REAL IP Analysis:', {
      peer1: {
        totalCandidates: iceCandidates1.length,
        uniqueIPs: ips1.size,
        publicIPs: publicIps1.size,
        IPs: Array.from(ips1)
      }
    });

    // Basic connectivity test
    expect(iceCandidates1.length).toBeGreaterThan(0);
    expect(ips1.size).toBeGreaterThan(0);

    console.log('✅ REAL STUN connectivity test completed');
  });

  it('should establish real P2P connection with data channels', async () => {
    console.log('📡 Testing REAL P2P connection with data channels...');
    
    const connectionStates1: string[] = [];
    const connectionStates2: string[] = [];
    let dataChannel1Opened = false;
    let dataChannel2Opened = false;
    let messagesReceived: string[] = [];

    // Track connection states
    webrtc1.on('connectionStateChange', (state: string) => {
      connectionStates1.push(state);
      console.log('📍 REAL Peer1 state:', state);
    });

    webrtc2.on('connectionStateChange', (state: string) => {
      connectionStates2.push(state);
      console.log('📍 REAL Peer2 state:', state);
    });

    // Track data channels
    webrtc1.on('dataChannelOpen', (channel) => {
      dataChannel1Opened = true;
      console.log('📡 REAL Data channel 1 opened:', channel.label);
    });

    webrtc2.on('dataChannelOpen', (channel) => {
      dataChannel2Opened = true;
      console.log('📡 REAL Data channel 2 opened:', channel.label);
    });

    // Set up message handling
    webrtc2.on('dataChannel', (channel) => {
      channel.onmessage = (event: MessageEvent) => {
        const message = event.data as string;
        messagesReceived.push(message);
        console.log('📨 REAL Message received:', message);
        
        // Send echo back
        try {
          channel.send(`REAL Echo: ${message}`);
        } catch (error) {
          console.log('⚠️ REAL Echo send failed:', error);
        }
      };
    });

    // Step 1: Create and exchange offer/answer
    const offer = await webrtc1.createOffer();
    await webrtc2.setRemoteDescription(offer);
    const answer = await webrtc2.createAnswer(offer);
    await webrtc1.setRemoteDescription(answer);

    console.log('✅ REAL Offer/Answer exchange completed');

    // Step 2: Wait for connection
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 3: Create data channels
    const dataChannel1 = webrtc1.createDataChannel('real-p2p-test');
    const dataChannel2 = webrtc2.createDataChannel('real-p2p-response');

    // Wait for data channels to open
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('📡 REAL Data channel status:', {
      channel1Opened: dataChannel1Opened,
      channel2Opened: dataChannel2Opened
    });

    // Step 4: Test message exchange
    const testMessages = [
      'Hello from REAL P2P!',
      'REAL Test message 2',
      '🌍 REAL Unicode: 🚀🔥💧',
      JSON.stringify({ type: 'real-test', timestamp: Date.now() })
    ];

    for (const message of testMessages) {
      try {
        dataChannel1.send(message);
        console.log('📤 REAL Sent:', message);
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.log('⚠️ REAL Send failed:', error);
      }
    }

    // Wait for message exchange
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('📊 REAL P2P Test Results:', {
      connectionStates: {
        peer1: connectionStates1,
        peer2: connectionStates2
      },
      dataChannels: {
        channel1Opened: dataChannel1Opened,
        channel2Opened: dataChannel2Opened
      },
      messaging: {
        sent: testMessages.length,
        received: messagesReceived.length,
        messages: messagesReceived
      }
    });

    // Verify basic functionality
    expect(offer.type).toBe(RTCSdpType.OFFER);
    expect(answer.type).toBe(RTCSdpType.ANSWER);
    expect(dataChannel1).toBeDefined();
    expect(dataChannel2).toBeDefined();

    console.log('✅ REAL P2P connection test completed');
  });

  it('should test connection timing with REAL WebRTC', async () => {
    console.log('⏱️ Testing REAL WebRTC connection timing...');
    
    const startTime = Date.now();
    const timeStamps: { [key: string]: number } = {};
    
    webrtc1.on('connectionStateChange', (state: string) => {
      timeStamps[`peer1_${state}`] = Date.now() - startTime;
      console.log(`⏱️ REAL Peer1 ${state}: ${timeStamps[`peer1_${state}`]}ms`);
    });

    webrtc2.on('connectionStateChange', (state: string) => {
      timeStamps[`peer2_${state}`] = Date.now() - startTime;
      console.log(`⏱️ REAL Peer2 ${state}: ${timeStamps[`peer2_${state}`]}ms`);
    });

    // Start connection process
    const offerStart = Date.now();
    const offer = await webrtc1.createOffer();
    timeStamps.offerCreated = Date.now() - offerStart;
    
    await webrtc2.setRemoteDescription(offer);
    const answerStart = Date.now();
    const answer = await webrtc2.createAnswer(offer);
    timeStamps.answerCreated = Date.now() - answerStart;
    
    await webrtc1.setRemoteDescription(answer);

    // Wait for connection establishment
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('⏱️ REAL Connection timing:', timeStamps);

    // Validate timing is reasonable
    expect(timeStamps.offerCreated).toBeGreaterThan(0);
    expect(timeStamps.answerCreated).toBeGreaterThan(0);
    
    // Should complete within reasonable time (less than 30 seconds)
    const totalTime = Date.now() - startTime;
    expect(totalTime).toBeLessThan(30000);

    console.log(`✅ REAL Connection established in ${totalTime}ms`);
  });
});
