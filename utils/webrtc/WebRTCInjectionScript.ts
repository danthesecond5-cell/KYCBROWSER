/**
 * WebRTC Injection Script for WebView
 * 
 * This script runs in the WebView and:
 * 1. Receives WebRTC connection from React Native side
 * 2. Replaces getUserMedia with the received stream
 * 3. Handles signaling via window.ReactNativeWebView.postMessage
 */

export interface WebRTCInjectionConfig {
  debug?: boolean;
  stealthMode?: boolean;
  deviceLabel?: string;
  deviceId?: string;
}

/**
 * Create WebRTC injection script for WebView
 */
export function createWebRTCInjectionScript(config: WebRTCInjectionConfig = {}): string {
  const {
    debug = true,
    stealthMode = true,
    deviceLabel = 'WebRTC Camera',
    deviceId = 'webrtc-camera-001',
  } = config;

  return `
(function() {
  'use strict';
  
  // ============================================================================
  // WEBRTC INJECTION SYSTEM
  // ============================================================================
  
  if (window.__webrtcInjectionActive) {
    console.log('[WebRTCInject] Already initialized');
    return;
  }
  window.__webrtcInjectionActive = true;
  
  const DEBUG = ${debug};
  const STEALTH = ${stealthMode};
  const DEVICE_LABEL = ${JSON.stringify(deviceLabel)};
  const DEVICE_ID = ${JSON.stringify(deviceId)};
  
  const log = DEBUG ? (...args) => console.log('[WebRTCInject]', ...args) : () => {};
  const error = (...args) => console.error('[WebRTCInject]', ...args);
  
  log('========================================');
  log('WEBRTC INJECTION - INITIALIZING');
  log('Debug:', DEBUG);
  log('Stealth:', STEALTH);
  log('========================================');
  
  // ============================================================================
  // STATE
  // ============================================================================
  
  const State = {
    pc: null,
    stream: null,
    ready: false,
    connecting: false,
    iceCandidates: [],
  };
  
  // ============================================================================
  // SIGNALING
  // ============================================================================
  
  function sendMessage(type, payload) {
    const message = {
      type: type,
      payload: payload,
      timestamp: Date.now(),
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    };
    
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        webrtc: true,
        message: message,
      }));
      log('Sent message:', type);
    } else {
      error('ReactNativeWebView not available');
    }
  }
  
  function handleMessage(message) {
    log('Received message:', message.type);
    
    switch (message.type) {
      case 'offer':
        handleOffer(message.payload);
        break;
      case 'ice-candidate':
        handleIceCandidate(message.payload);
        break;
      case 'connection-state':
        handleConnectionState(message.payload);
        break;
      case 'stats':
        handleStats(message.payload);
        break;
      default:
        log('Unknown message type:', message.type);
    }
  }
  
  // Expose message handler for React Native
  window.__webrtcHandleMessage = handleMessage;
  
  // ============================================================================
  // WEBRTC CONNECTION
  // ============================================================================
  
  async function initializePeerConnection() {
    if (State.pc) {
      log('Peer connection already exists');
      return;
    }
    
    log('Creating peer connection...');
    
    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };
    
    State.pc = new RTCPeerConnection(config);
    
    // Setup event handlers
    State.pc.onicecandidate = (event) => {
      if (event.candidate) {
        log('ICE candidate:', event.candidate.candidate);
        sendMessage('ice-candidate', {
          candidate: event.candidate.toJSON(),
        });
      }
    };
    
    State.pc.ontrack = (event) => {
      log('Received track:', event.track.kind, event.track.label);
      
      if (event.streams && event.streams[0]) {
        State.stream = event.streams[0];
        log('Stream received:', State.stream.id);
        
        // Mark as ready
        State.ready = true;
        sendMessage('ready', { streamId: State.stream.id });
        
        // Spoof track metadata
        spoofStreamMetadata(State.stream);
      }
    };
    
    State.pc.onconnectionstatechange = () => {
      log('Connection state:', State.pc.connectionState);
    };
    
    State.pc.oniceconnectionstatechange = () => {
      log('ICE connection state:', State.pc.iceConnectionState);
    };
    
    log('Peer connection created');
  }
  
  async function handleOffer(payload) {
    log('Handling offer...');
    
    if (!State.pc) {
      await initializePeerConnection();
    }
    
    if (State.connecting) {
      log('Already connecting, ignoring offer');
      return;
    }
    
    State.connecting = true;
    
    try {
      const offer = new RTCSessionDescription({
        type: payload.type,
        sdp: payload.sdp,
      });
      
      await State.pc.setRemoteDescription(offer);
      log('Remote description set');
      
      // Create answer
      const answer = await State.pc.createAnswer();
      await State.pc.setLocalDescription(answer);
      log('Answer created');
      
      // Send answer
      sendMessage('answer', {
        type: answer.type,
        sdp: answer.sdp,
      });
      
      // Add any queued ICE candidates
      while (State.iceCandidates.length > 0) {
        const candidate = State.iceCandidates.shift();
        await State.pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      
    } catch (err) {
      error('Failed to handle offer:', err);
      State.connecting = false;
      sendMessage('error', { message: err.message });
    }
  }
  
  async function handleIceCandidate(payload) {
    log('Handling ICE candidate...');
    
    if (!State.pc || !State.pc.remoteDescription) {
      // Queue for later
      State.iceCandidates.push(payload.candidate);
      log('Queued ICE candidate (no remote description yet)');
      return;
    }
    
    try {
      const candidate = new RTCIceCandidate(payload.candidate);
      await State.pc.addIceCandidate(candidate);
      log('ICE candidate added');
    } catch (err) {
      error('Failed to add ICE candidate:', err);
    }
  }
  
  function handleConnectionState(payload) {
    log('Connection state update:', payload.state);
  }
  
  function handleStats(payload) {
    if (DEBUG) {
      log('Stats:', payload);
    }
  }
  
  // ============================================================================
  // STREAM METADATA SPOOFING
  // ============================================================================
  
  function spoofStreamMetadata(stream) {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      error('No video track in stream');
      return;
    }
    
    log('Spoofing track metadata...');
    
    // Spoof track ID
    try {
      Object.defineProperty(videoTrack, 'id', {
        get: () => 'track_webrtc_' + Date.now(),
        configurable: true,
      });
    } catch(e) {}
    
    // Spoof label
    try {
      Object.defineProperty(videoTrack, 'label', {
        get: () => DEVICE_LABEL,
        configurable: true,
      });
    } catch(e) {}
    
    // Spoof getSettings
    const originalGetSettings = videoTrack.getSettings ? videoTrack.getSettings.bind(videoTrack) : null;
    videoTrack.getSettings = function() {
      const settings = originalGetSettings ? originalGetSettings() : {};
      return {
        ...settings,
        deviceId: DEVICE_ID,
        groupId: 'webrtc_group',
        facingMode: 'user',
      };
    };
    
    // Spoof getCapabilities
    videoTrack.getCapabilities = function() {
      return {
        aspectRatio: { min: 0.5, max: 2.0 },
        deviceId: DEVICE_ID,
        facingMode: ['user'],
        frameRate: { min: 1, max: 60 },
        groupId: 'webrtc_group',
        height: { min: 1, max: 4320 },
        width: { min: 1, max: 7680 },
        resizeMode: ['none', 'crop-and-scale'],
      };
    };
    
    log('Track metadata spoofed');
  }
  
  // ============================================================================
  // GETUSERMEDIA OVERRIDE
  // ============================================================================
  
  const originalGetUserMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
  const originalEnumerateDevices = navigator.mediaDevices?.enumerateDevices?.bind(navigator.mediaDevices);
  
  if (!navigator.mediaDevices) {
    navigator.mediaDevices = {};
  }
  
  navigator.mediaDevices.getUserMedia = async function(constraints) {
    log('getUserMedia called:', constraints);
    
    const wantsVideo = !!(constraints && constraints.video);
    
    if (!wantsVideo) {
      // Audio only - pass through
      if (originalGetUserMedia) {
        return originalGetUserMedia(constraints);
      }
      throw new DOMException('Audio not available', 'NotFoundError');
    }
    
    // Wait for WebRTC stream
    log('Waiting for WebRTC stream...');
    
    const maxWait = 10000; // 10 seconds
    const startTime = Date.now();
    
    while (!State.ready && (Date.now() - startTime) < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (!State.ready || !State.stream) {
      error('WebRTC stream not ready');
      throw new DOMException('Could not start video source', 'NotReadableError');
    }
    
    log('Returning WebRTC stream');
    return State.stream;
  };
  
  navigator.mediaDevices.enumerateDevices = async function() {
    log('enumerateDevices called');
    
    if (STEALTH) {
      return [{
        deviceId: DEVICE_ID,
        groupId: 'webrtc_group',
        kind: 'videoinput',
        label: DEVICE_LABEL,
        toJSON: function() { return this; }
      }];
    }
    
    if (originalEnumerateDevices) {
      return originalEnumerateDevices();
    }
    
    return [];
  };
  
  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  // Initialize peer connection
  initializePeerConnection().then(() => {
    log('WebRTC injection ready');
    sendMessage('ready', { initialized: true });
  }).catch(err => {
    error('Initialization failed:', err);
    sendMessage('error', { message: err.message });
  });
  
  log('========================================');
  log('WEBRTC INJECTION - READY');
  log('========================================');
  
})();
true;
`;
}
