// Test data fixtures for WebRTC signaling server tests

export const mockUsers = {
  owner: {
    userid: 'test-owner-123',
    socketId: 'socket-owner-123',
    extra: {
      avatar: '👨‍💼',
      nickname: 'Room Owner',
      role: 'admin'
    }
  },
  participant1: {
    userid: 'test-participant-1',
    socketId: 'socket-participant-1',
    extra: {
      avatar: '👤',
      nickname: 'Participant 1',
      role: 'user'
    }
  },
  participant2: {
    userid: 'test-participant-2',
    socketId: 'socket-participant-2',
    extra: {
      avatar: '👤',
      nickname: 'Participant 2',
      role: 'user'
    }
  },
  moderator: {
    userid: 'test-moderator',
    socketId: 'socket-moderator',
    extra: {
      avatar: '🛡️',
      nickname: 'Moderator',
      role: 'moderator'
    }
  }
};

export const mockRooms = {
  publicRoom: {
    sessionid: 'public-room-123',
    identifier: 'public-chat',
    session: {
      audio: true,
      video: true,
      oneway: false,
      broadcast: false,
      scalable: false
    },
    maxParticipantsAllowed: 10,
    password: undefined,
    extra: {
      title: 'Public Chat Room',
      description: 'A public room for testing',
      tags: ['public', 'chat', 'test']
    }
  },
  privateRoom: {
    sessionid: 'private-room-456',
    identifier: '',
    session: {
      audio: true,
      video: true,
      oneway: false,
      broadcast: false,
      scalable: false
    },
    maxParticipantsAllowed: 5,
    password: 'secret123',
    extra: {
      title: 'Private Meeting Room',
      description: 'A private room for testing',
      tags: ['private', 'meeting', 'test']
    }
  },
  broadcastRoom: {
    sessionid: 'broadcast-room-789',
    identifier: 'livestream',
    session: {
      audio: true,
      video: true,
      oneway: true,
      broadcast: true,
      scalable: false
    },
    maxParticipantsAllowed: 100,
    password: undefined,
    extra: {
      title: 'Live Broadcast',
      description: 'Broadcast stream room',
      tags: ['broadcast', 'live', 'stream']
    }
  },
  scalableRoom: {
    sessionid: 'scalable-room-999',
    identifier: 'conference',
    session: {
      audio: true,
      video: true,
      oneway: false,
      broadcast: false,
      scalable: true
    },
    maxParticipantsAllowed: 50,
    password: 'conference-pass',
    extra: {
      title: 'Scalable Conference',
      description: 'Large conference room with scalability',
      tags: ['conference', 'scalable', 'large']
    }
  }
};

export const webRTCData = {
  sdpOffer: {
    type: 'offer',
    sdp: `v=0\r\no=- ${Date.now()} 2 IN IP4 127.0.0.1\r\n
           s=-\r\n
           t=0 0\r\n
           a=group:BUNDLE audio video\r\n
           m=audio 9 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8 106 105 13 126\r\n
           c=IN IP4 0.0.0.0\r\n
           a=rtcp:9 IN IP4 0.0.0.0\r\n
           a=ice-ufrag:test\r\n
           a=ice-pwd:testpass\r\n
           a=fingerprint:sha-256 AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99\r\n
           a=setup:actpass\r\n
           a=mid:audio\r\n
           a=sendrecv\r\n
           a=rtcp-mux\r\n
           a=rtpmap:111 opus/48000/2\r\n
           a=fmtp:111 minptime=10;useinbandfec=1\r\n
           m=video 9 UDP/TLS/RTP/SAVPF 96 97 98 99 100 101 127\r\n
           c=IN IP4 0.0.0.0\r\n
           a=rtcp:9 IN IP4 0.0.0.0\r\n
           a=ice-ufrag:test\r\n
           a=ice-pwd:testpass\r\n
           a=fingerprint:sha-256 AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99\r\n
           a=setup:actpass\r\n
           a=mid:video\r\n
           a=sendrecv\r\n
           a=rtcp-mux\r\n
           a=rtpmap:96 VP8/90000\r\n
           a=rtcp-fb:96 goog-remb\r\n
           a=rtcp-fb:96 ccm fir\r\n
           a=rtcp-fb:96 nack\r\n
           a=rtcp-fb:96 nack pli\r\n`
  },
  sdpAnswer: {
    type: 'answer',
    sdp: `v=0\r\no=- ${Date.now()} 2 IN IP4 127.0.0.1\r\n
           s=-\r\n
           t=0 0\r\n
           a=group:BUNDLE audio video\r\n
           m=audio 9 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8 106 105 13 126\r\n
           c=IN IP4 0.0.0.0\r\n
           a=rtcp:9 IN IP4 0.0.0.0\r\n
           a=ice-ufrag:answer\r\n
           a=ice-pwd:answerpass\r\n
           a=fingerprint:sha-256 11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF\r\n
           a=setup:active\r\n
           a=mid:audio\r\n
           a=sendrecv\r\n
           a=rtcp-mux\r\n
           a=rtpmap:111 opus/48000/2\r\n
           a=fmtp:111 minptime=10;useinbandfec=1\r\n
           m=video 9 UDP/TLS/RTP/SAVPF 96 97 98 99 100 101 127\r\n
           c=IN IP4 0.0.0.0\r\n
           a=rtcp:9 IN IP4 0.0.0.0\r\n
           a=ice-ufrag:answer\r\n
           a=ice-pwd:answerpass\r\n
           a=fingerprint:sha-256 11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF\r\n
           a=setup:active\r\n
           a=mid:video\r\n
           a=sendrecv\r\n
           a=rtcp-mux\r\n
           a=rtpmap:96 VP8/90000\r\n
           a=rtcp-fb:96 goog-remb\r\n
           a=rtcp-fb:96 ccm fir\r\n
           a=rtcp-fb:96 nack\r\n
           a=rtcp-fb:96 nack pli\r\n`
  },
  iceCandidate: {
    candidate: 'candidate:1 1 UDP 2130706431 192.168.1.100 54400 typ host generation 0 ufrag test network-id 1',
    sdpMLineIndex: 0,
    sdpMid: '0',
    usernameFragment: 'test'
  },
  srtpCandidate: {
    candidate: 'candidate:2 1 UDP 1694498815 203.0.113.100 54401 typ srflx raddr 192.168.1.100 rport 54400 generation 0 ufrag test network-id 2',
    sdpMLineIndex: 0,
    sdpMid: '0',
    usernameFragment: 'test'
  },
  relayCandidate: {
    candidate: 'candidate:3 1 TCP 2105524479 203.0.113.200 443 typ relay raddr 203.0.113.100 rport 54401 generation 0 ufrag test network-id 3',
    sdpMLineIndex: 1,
    sdpMid: '1',
    usernameFragment: 'test'
  }
};

export const signalingMessages = {
  connectionEstablished: {
    type: 'connection-established',
    userId: 'test-user-123',
    timestamp: Date.now(),
    quality: 'excellent'
  },
  mediaStateChange: {
    type: 'media-state',
    audio: {
      enabled: true,
      muted: false,
      volume: 0.8
    },
    video: {
      enabled: true,
      muted: false,
      resolution: '1280x720',
      framerate: 30
    },
    screen: {
      enabled: false,
      sharing: false
    }
  },
  chatMessage: {
    type: 'chat',
    id: 'msg-123',
    text: 'Hello, this is a test message!',
    timestamp: Date.now(),
    userId: 'test-user-123',
    userNickname: 'Test User',
    metadata: {
      roomId: 'test-room-123',
      messageType: 'text'
    }
  },
  fileTransfer: {
    type: 'file-transfer',
    id: 'file-456',
    fileName: 'test-document.pdf',
    fileSize: 1024000,
    fileType: 'application/pdf',
    userId: 'test-user-123',
    timestamp: Date.now(),
    metadata: {
      checksum: 'abc123def456',
      description: 'Test file for transfer'
    }
  },
  reaction: {
    type: 'reaction',
    emoji: '👍',
    userId: 'test-user-123',
    timestamp: Date.now(),
    targetMessageId: 'msg-123'
  },
  raiseHand: {
    type: 'raise-hand',
    userId: 'test-user-123',
    timestamp: Date.now(),
    lowered: false
  },
  screenShareStart: {
    type: 'screen-share-start',
    streamId: 'screen-stream-789',
    userId: 'test-user-123',
    timestamp: Date.now(),
    source: 'screen',
    resolution: '1920x1080'
  },
  screenShareStop: {
    type: 'screen-share-stop',
    streamId: 'screen-stream-789',
    userId: 'test-user-123',
    timestamp: Date.now()
  },
  recordingStart: {
    type: 'recording-start',
    userId: 'test-user-123',
    timestamp: Date.now(),
    options: {
      includeAudio: true,
      includeVideo: true,
      quality: 'high'
    }
  },
  recordingStop: {
    type: 'recording-stop',
    userId: 'test-user-123',
    timestamp: Date.now(),
    recordingId: 'rec-123',
    duration: 120000,
    size: 52428800
  }
};

export const performanceTestData = {
  highVolumeMessages: Array.from({ length: 1000 }, (_, i) => ({
    type: 'performance-test',
    sequence: i,
    timestamp: Date.now(),
    payload: `Test message ${i} with additional content to simulate real usage scenarios and test performance under load`.repeat(5)
  })),
  largePayload: {
    type: 'large-data',
    metadata: {
      id: 'large-payload-test',
      timestamp: Date.now(),
      version: '1.0.0',
      tags: ['performance', 'large', 'test', 'webinar', 'conference', 'scalability']
    },
    data: {
      users: Array.from({ length: 1000 }, (_, i) => ({
        id: `user-${i}`,
        name: `Test User ${i}`,
        email: `user${i}@test.com`,
        avatar: `avatar-${i}.jpg`,
        status: i % 3 === 0 ? 'online' : i % 3 === 1 ? 'away' : 'offline',
        role: i % 10 === 0 ? 'admin' : 'user',
        permissions: ['read', 'write', i % 5 === 0 ? 'admin' : ''],
        metadata: {
          joined: new Date(Date.now() - Math.random() * 86400000).toISOString(),
          lastSeen: new Date().toISOString(),
          device: ['desktop', 'mobile', 'tablet'][i % 3],
          browser: ['chrome', 'firefox', 'safari', 'edge'][i % 4],
          location: {
            country: ['US', 'UK', 'DE', 'FR', 'JP', 'AU', 'CA', 'BR'][i % 8],
            city: `City-${i}`,
            timezone: ['UTC', 'EST', 'PST', 'GMT', 'CET'][i % 5]
          }
        }
      })),
      rooms: Array.from({ length: 50 }, (_, i) => ({
        id: `room-${i}`,
        name: `Test Room ${i}`,
        description: `This is test room number ${i} for performance testing`,
        capacity: 50 + (i * 10),
        currentUsers: Math.floor(Math.random() * 50),
        settings: {
          allowAnonymous: i % 2 === 0,
          requirePassword: i % 3 === 0,
          enableRecording: i % 4 === 0,
          enableScreenShare: true,
          enableChat: true,
          enableReactions: i % 5 === 0
        },
        tags: [`tag-${i % 10}`, `category-${i % 5}`, `type-${i % 3}`]
      }))
    }
  },
  concurrentMessages: Array.from({ length: 100 }, (_, i) => ({
    type: 'concurrent-test',
    id: `concurrent-${i}`,
    data: {
      sender: `user-${i % 10}`,
      receiver: `user-${(i + 1) % 10}`,
      message: `Concurrent message ${i}`,
      priority: ['low', 'normal', 'high'][i % 3],
      category: ['chat', 'system', 'notification', 'alert'][i % 4],
      metadata: {
        sequence: i,
        timestamp: Date.now() + i,
        attempts: 0,
        maxAttempts: 3
      }
    }
  }))
};

export const errorScenarios = {
  malformedSDP: {
    type: 'offer',
    sdp: 'invalid-sdp-content-that-cannot-be-parsed'
  },
  incompleteMessage: {
    remoteUserId: 'test-user'
    // Missing message field
  },
  invalidTargetUser: {
    remoteUserId: '',
    message: { type: 'test' }
  },
  emptyMessage: {
    remoteUserId: 'test-user',
    message: null
  },
  oversizedMessage: {
    remoteUserId: 'test-user',
    message: {
      type: 'oversized',
      data: 'x'.repeat(10000000) // 10MB string
    }
  },
  maliciousContent: {
    remoteUserId: 'test-user',
    message: {
      type: 'test',
      html: '<script>alert("xss")</script>',
      js: 'javascript:alert("xss")',
      sql: "DROP TABLE users; --",
      path: '../../../etc/passwd'
    }
  },
  circularReference: (() => {
    const obj: any = { type: 'circular', name: 'test' };
    obj.self = obj;
    return {
      remoteUserId: 'test-user',
      message: obj
    };
  })()
};

export const benchmarkMetrics = {
  connectionsPerSecond: 100,
  messagesPerSecond: 1000,
  maxConcurrentConnections: 1000,
  maxRoomSize: 500,
  maxConcurrentRooms: 50,
  acceptableLatency: 100, // ms
  memoryThreshold: 100 * 1024 * 1024, // 100MB
  cpuThreshold: 80, // percentage
  networkBandwidth: 10 * 1024 * 1024 // 10MB/s
};

export const testTimeouts = {
  quick: 100,
  normal: 500,
  slow: 2000,
  verySlow: 10000,
  connectionEstablishment: 5000,
  roomOperations: 3000,
  messageDelivery: 1000,
  bulkOperations: 5000,
  cleanupOperations: 2000
};

export const testConstants = {
  testPrefix: 'test-',
  mockIpAddresses: [
    '127.0.0.1',
    '192.168.1.100',
    '10.0.0.1',
    '172.16.0.1',
    '203.0.113.100'
  ],
  mockUserAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15'
  ],
  testRoomIdentifiers: [
    'test-chat',
    'test-meeting',
    'test-conference',
    'test-broadcast',
    'test-webinar'
  ]
};
