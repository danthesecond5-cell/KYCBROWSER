/**
 * Advanced Protocol 2 Browser Injection Script
 * 
 * This script is injected into WebViews to intercept and manipulate
 * WebRTC and MediaDevices APIs at the deepest possible level for
 * maximum stealth and compatibility.
 */

import type { CaptureDevice } from '@/types/device';

export interface AdvancedProtocol2ScriptOptions {
  videoUri?: string;
  devices: CaptureDevice[];
  enableWebRTCRelay: boolean;
  enableASI: boolean;
  enableGPU: boolean;
  enableCrypto: boolean;
  debugEnabled: boolean;
  stealthMode: boolean;
  protocolLabel?: string;
  showOverlayLabel: boolean;
}

/**
 * Generate the Advanced Protocol 2 injection script
 */
export function createAdvancedProtocol2Script(
  options: AdvancedProtocol2ScriptOptions
): string {
  const {
    videoUri,
    devices,
    enableWebRTCRelay,
    enableASI,
    enableGPU,
    enableCrypto,
    debugEnabled,
    stealthMode,
    protocolLabel = 'Protocol 2: Advanced Relay',
    showOverlayLabel,
  } = options;

  return `
(function() {
  'use strict';
  
  // ============================================================================
  // INITIALIZATION CHECK
  // ============================================================================
  
  if (typeof window === 'undefined') return;
  if (window.__advancedProtocol2Initialized) {
    console.log('[AdvP2] Already initialized');
    return;
  }
  window.__advancedProtocol2Initialized = true;
  
  // ============================================================================
  // CONFIGURATION
  // ============================================================================
  
  const CONFIG = {
    DEBUG: ${debugEnabled},
    STEALTH_MODE: ${stealthMode},
    VIDEO_URI: ${JSON.stringify(videoUri)},
    DEVICES: ${JSON.stringify(devices)},
    ENABLE_WEBRTC_RELAY: ${enableWebRTCRelay},
    ENABLE_ASI: ${enableASI},
    ENABLE_GPU: ${enableGPU},
    ENABLE_CRYPTO: ${enableCrypto},
    PROTOCOL_LABEL: ${JSON.stringify(protocolLabel)},
    SHOW_OVERLAY: ${showOverlayLabel},
    PORTRAIT_WIDTH: 1080,
    PORTRAIT_HEIGHT: 1920,
    TARGET_FPS: 30,
  };
  
  // ============================================================================
  // LOGGING
  // ============================================================================
  
  const Logger = {
    enabled: CONFIG.DEBUG,
    prefix: '[AdvP2]',
    log: function(...args) { if (this.enabled) console.log(this.prefix, ...args); },
    warn: function(...args) { if (this.enabled) console.warn(this.prefix, ...args); },
    error: function(...args) { console.error(this.prefix, ...args); },
  };
  
  Logger.log('========================================');
  Logger.log('ADVANCED PROTOCOL 2: INITIALIZING');
  Logger.log('WebRTC Relay:', CONFIG.ENABLE_WEBRTC_RELAY);
  Logger.log('ASI:', CONFIG.ENABLE_ASI);
  Logger.log('GPU:', CONFIG.ENABLE_GPU);
  Logger.log('Crypto:', CONFIG.ENABLE_CRYPTO);
  Logger.log('Stealth:', CONFIG.STEALTH_MODE);
  Logger.log('Devices:', CONFIG.DEVICES.length);
  Logger.log('========================================');
  
  // ============================================================================
  // POLYFILLS
  // ============================================================================
  
  if (!window.performance) {
    window.performance = { now: function() { return Date.now(); } };
  }
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = function(cb) { return setTimeout(function() { cb(Date.now()); }, 16); };
  }
  
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  
  const State = {
    isActive: false,
    activeStreams: new Map(),
    videoCache: new Map(),
    metrics: {
      framesProcessed: 0,
      fps: 0,
      lastFrameTime: 0,
      errors: 0,
    },
    asi: {
      siteProfile: null,
      threats: [],
      adaptations: [],
    },
  };
  
  window.__advancedProtocol2State = State;
  
  // ============================================================================
  // CRYPTO MODULE (Frame Signing)
  // ============================================================================
  
  const CryptoModule = {
    enabled: CONFIG.ENABLE_CRYPTO,
    keyId: 'key_' + Date.now(),
    frameCounter: 0,
    
    generateSignature: function(frameId) {
      if (!this.enabled) return null;
      return {
        frameId: frameId,
        keyId: this.keyId,
        timestamp: Date.now(),
        signature: this.simpleHash(frameId + ':' + this.keyId),
      };
    },
    
    simpleHash: function(input) {
      let hash = 0;
      for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(16);
    },
  };
  
  // ============================================================================
  // ASI MODULE (Adaptive Stream Intelligence)
  // ============================================================================
  
  const ASIModule = {
    enabled: CONFIG.ENABLE_ASI,
    interceptedCalls: [],
    siteFingerprint: null,
    
    init: function() {
      if (!this.enabled) return;
      
      // Analyze current site
      this.siteFingerprint = {
        domain: window.location.hostname,
        userAgent: navigator.userAgent,
        screenSize: { width: screen.width, height: screen.height },
        timestamp: Date.now(),
      };
      
      Logger.log('ASI: Site fingerprint collected');
    },
    
    recordGetUserMediaCall: function(constraints) {
      if (!this.enabled) return;
      
      this.interceptedCalls.push({
        type: 'getUserMedia',
        constraints: constraints,
        timestamp: Date.now(),
      });
      
      // Analyze patterns
      this.analyzePatterns();
    },
    
    analyzePatterns: function() {
      const recentCalls = this.interceptedCalls.filter(
        c => Date.now() - c.timestamp < 5000
      );
      
      // Detect potential fingerprinting
      if (recentCalls.length > 5) {
        const threat = {
          type: 'high_frequency_calls',
          severity: 'medium',
          timestamp: Date.now(),
        };
        State.asi.threats.push(threat);
        Logger.warn('ASI: Potential fingerprinting detected');
      }
    },
    
    getRecommendedResolution: function() {
      // Analyze site preferences from intercepted calls
      const resolutions = this.interceptedCalls
        .filter(c => c.constraints && c.constraints.video)
        .map(c => {
          const v = c.constraints.video;
          return {
            width: v.width?.ideal || v.width?.exact || v.width || null,
            height: v.height?.ideal || v.height?.exact || v.height || null,
          };
        })
        .filter(r => r.width && r.height);
      
      if (resolutions.length > 0) {
        return resolutions[0];
      }
      
      return { width: CONFIG.PORTRAIT_WIDTH, height: CONFIG.PORTRAIT_HEIGHT };
    },
  };
  
  // ============================================================================
  // GPU MODULE (Shader-based Processing)
  // ============================================================================
  
  const GPUModule = {
    enabled: CONFIG.ENABLE_GPU,
    canvas: null,
    gl: null,
    program: null,
    
    init: function(width, height) {
      if (!this.enabled) return false;
      
      try {
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        
        this.gl = this.canvas.getContext('webgl2') || this.canvas.getContext('webgl');
        if (!this.gl) {
          Logger.warn('GPU: WebGL not available');
          return false;
        }
        
        Logger.log('GPU: Initialized', width, 'x', height);
        return true;
      } catch (e) {
        Logger.error('GPU: Init failed', e);
        return false;
      }
    },
    
    processFrame: function(source) {
      if (!this.enabled || !this.gl) return source;
      
      // In full implementation, this would apply shaders
      // For now, just pass through
      return source;
    },
    
    getCanvas: function() {
      return this.canvas;
    },
  };
  
  // ============================================================================
  // WEBRTC RELAY MODULE
  // ============================================================================
  
  const WebRTCRelayModule = {
    enabled: CONFIG.ENABLE_WEBRTC_RELAY,
    originalRTCPeerConnection: null,
    connections: new Map(),
    injectedStream: null,
    
    init: function() {
      if (!this.enabled) return;
      if (typeof RTCPeerConnection === 'undefined') return;
      
      this.originalRTCPeerConnection = RTCPeerConnection;
      this.interceptRTCPeerConnection();
      
      Logger.log('WebRTC Relay: Initialized');
    },
    
    setInjectedStream: function(stream) {
      this.injectedStream = stream;
      Logger.log('WebRTC Relay: Stream set');
    },
    
    interceptRTCPeerConnection: function() {
      const module = this;
      const OriginalPC = this.originalRTCPeerConnection;
      
      window.RTCPeerConnection = function(config) {
        Logger.log('WebRTC Relay: Intercepted connection');
        
        const pc = new OriginalPC(config);
        const connectionId = 'pc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        module.connections.set(connectionId, pc);
        
        // Intercept addTrack
        const originalAddTrack = pc.addTrack.bind(pc);
        pc.addTrack = function(track, ...streams) {
          // Replace video tracks with our injected stream
          if (module.injectedStream && track.kind === 'video') {
            const injectedTrack = module.injectedStream.getVideoTracks()[0];
            if (injectedTrack) {
              Logger.log('WebRTC Relay: Replacing video track');
              return originalAddTrack(injectedTrack, ...streams);
            }
          }
          return originalAddTrack(track, ...streams);
        };
        
        // Intercept createOffer for SDP manipulation
        const originalCreateOffer = pc.createOffer.bind(pc);
        pc.createOffer = async function(options) {
          const offer = await originalCreateOffer(options);
          // Could manipulate SDP here
          return offer;
        };
        
        return pc;
      };
      
      // Preserve prototype
      window.RTCPeerConnection.prototype = OriginalPC.prototype;
    },
  };
  
  // ============================================================================
  // VIDEO SOURCE MANAGER
  // ============================================================================
  
  const VideoSourceManager = {
    sources: new Map(),
    activeSourceId: null,
    
    addSource: async function(id, uri, type) {
      Logger.log('VideoSource: Adding', id, type);
      
      const source = {
        id: id,
        uri: uri,
        type: type,
        status: 'loading',
        video: null,
        canvas: null,
        ctx: null,
      };
      
      if (type === 'local_file' || type === 'video') {
        source.video = await this.loadVideo(uri);
        if (source.video) {
          source.canvas = document.createElement('canvas');
          source.canvas.width = source.video.videoWidth || CONFIG.PORTRAIT_WIDTH;
          source.canvas.height = source.video.videoHeight || CONFIG.PORTRAIT_HEIGHT;
          source.ctx = source.canvas.getContext('2d', { alpha: false });
          source.status = 'ready';
        } else {
          source.status = 'error';
        }
      } else if (type === 'synthetic') {
        source.canvas = document.createElement('canvas');
        source.canvas.width = CONFIG.PORTRAIT_WIDTH;
        source.canvas.height = CONFIG.PORTRAIT_HEIGHT;
        source.ctx = source.canvas.getContext('2d', { alpha: false });
        source.status = 'ready';
      }
      
      this.sources.set(id, source);
      
      if (!this.activeSourceId) {
        this.activeSourceId = id;
      }
      
      return source;
    },
    
    loadVideo: function(uri) {
      return new Promise((resolve) => {
        const video = document.createElement('video');
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.setAttribute('playsinline', 'true');
        video.preload = 'auto';
        video.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;';
        
        const timeout = setTimeout(() => {
          Logger.warn('VideoSource: Load timeout');
          resolve(null);
        }, 15000);
        
        video.onloadeddata = () => {
          clearTimeout(timeout);
          Logger.log('VideoSource: Loaded', video.videoWidth, 'x', video.videoHeight);
          resolve(video);
        };
        
        video.onerror = () => {
          clearTimeout(timeout);
          Logger.error('VideoSource: Load failed');
          resolve(null);
        };
        
        document.body?.appendChild(video);
        video.src = uri;
        video.load();
      });
    },
    
    getActiveSource: function() {
      if (!this.activeSourceId) return null;
      return this.sources.get(this.activeSourceId);
    },
    
    switchSource: function(id) {
      if (this.sources.has(id)) {
        this.activeSourceId = id;
        Logger.log('VideoSource: Switched to', id);
        return true;
      }
      return false;
    },
  };
  
  // ============================================================================
  // STREAM GENERATOR
  // ============================================================================
  
  const StreamGenerator = {
    isRunning: false,
    animationFrameId: null,
    outputCanvas: null,
    outputCtx: null,
    outputStream: null,
    lastFrameTime: 0,
    frameCount: 0,
    
    init: function(width, height) {
      this.outputCanvas = document.createElement('canvas');
      this.outputCanvas.width = width;
      this.outputCanvas.height = height;
      this.outputCtx = this.outputCanvas.getContext('2d', { 
        alpha: false,
        desynchronized: true 
      });
      
      Logger.log('StreamGenerator: Initialized', width, 'x', height);
    },
    
    start: function() {
      if (this.isRunning) return this.outputStream;
      
      this.isRunning = true;
      this.lastFrameTime = performance.now();
      
      const generator = this;
      const targetFrameTime = 1000 / CONFIG.TARGET_FPS;
      
      function render(timestamp) {
        if (!generator.isRunning) return;
        
        const elapsed = timestamp - generator.lastFrameTime;
        if (elapsed < targetFrameTime * 0.9) {
          generator.animationFrameId = requestAnimationFrame(render);
          return;
        }
        
        generator.lastFrameTime = timestamp;
        generator.frameCount++;
        
        // Record metrics
        State.metrics.framesProcessed++;
        State.metrics.lastFrameTime = timestamp;
        
        // Calculate FPS
        if (generator.frameCount % 30 === 0) {
          State.metrics.fps = 1000 / elapsed;
        }
        
        // Get active source
        const source = VideoSourceManager.getActiveSource();
        
        if (source && source.status === 'ready') {
          if (source.video && source.video.readyState >= 2) {
            // Draw video frame
            source.ctx.drawImage(source.video, 0, 0, source.canvas.width, source.canvas.height);
            generator.outputCtx.drawImage(source.canvas, 0, 0);
          } else if (source.type === 'synthetic') {
            // Draw synthetic frame (green screen)
            generator.drawGreenScreen(source.ctx, source.canvas.width, source.canvas.height, timestamp);
            generator.outputCtx.drawImage(source.canvas, 0, 0);
          }
        } else {
          // Fallback: draw green screen directly
          generator.drawGreenScreen(generator.outputCtx, generator.outputCanvas.width, generator.outputCanvas.height, timestamp);
        }
        
        // Apply GPU processing if enabled
        if (GPUModule.enabled) {
          GPUModule.processFrame(generator.outputCanvas);
        }
        
        // Generate crypto signature if enabled
        if (CryptoModule.enabled) {
          CryptoModule.generateSignature(generator.frameCount);
        }
        
        generator.animationFrameId = requestAnimationFrame(render);
      }
      
      requestAnimationFrame(render);
      
      // Create output stream
      try {
        this.outputStream = this.outputCanvas.captureStream(CONFIG.TARGET_FPS);
        Logger.log('StreamGenerator: Started, tracks:', this.outputStream.getTracks().length);
        return this.outputStream;
      } catch (e) {
        Logger.error('StreamGenerator: captureStream failed', e);
        return null;
      }
    },
    
    drawGreenScreen: function(ctx, width, height, timestamp) {
      const t = timestamp / 1000;
      
      // Create subtle animated gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      const offset = Math.sin(t * 0.3) * 0.03;
      
      gradient.addColorStop(0, 'rgb(0, ' + Math.floor(255 + offset * 20) + ', 0)');
      gradient.addColorStop(0.5, 'rgb(0, ' + Math.floor(238 + offset * 20) + ', 0)');
      gradient.addColorStop(1, 'rgb(0, ' + Math.floor(255 + offset * 20) + ', 0)');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    },
    
    stop: function() {
      this.isRunning = false;
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      if (this.outputStream) {
        this.outputStream.getTracks().forEach(t => t.stop());
        this.outputStream = null;
      }
      Logger.log('StreamGenerator: Stopped');
    },
    
    getStream: function() {
      return this.outputStream;
    },
  };
  
  // ============================================================================
  // MEDIADEVICES OVERRIDE
  // ============================================================================
  
  const originalGetUserMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
  const originalEnumerateDevices = navigator.mediaDevices?.enumerateDevices?.bind(navigator.mediaDevices);
  
  if (!navigator.mediaDevices) {
    navigator.mediaDevices = {};
  }
  
  navigator.mediaDevices.enumerateDevices = async function() {
    // Record for ASI
    ASIModule.recordGetUserMediaCall({ enumerate: true });
    
    if (CONFIG.STEALTH_MODE) {
      // Return simulated devices
      const simDevices = CONFIG.DEVICES.map(d => ({
        deviceId: d.nativeDeviceId || d.id,
        groupId: d.groupId || 'default',
        kind: d.type === 'camera' ? 'videoinput' : 'audioinput',
        label: d.name || 'Camera',
        toJSON: function() { return this; }
      }));
      
      Logger.log('enumerateDevices: Returning', simDevices.length, 'simulated devices');
      return simDevices;
    }
    
    if (originalEnumerateDevices) {
      return originalEnumerateDevices();
    }
    
    return [];
  };
  
  navigator.mediaDevices.getUserMedia = async function(constraints) {
    Logger.log('getUserMedia: Called with', constraints);
    
    // Record for ASI
    ASIModule.recordGetUserMediaCall(constraints);
    
    const wantsVideo = !!constraints?.video;
    const wantsAudio = !!constraints?.audio;
    
    // Get recommended resolution from ASI
    const recommendedRes = ASIModule.getRecommendedResolution();
    
    if (wantsVideo && (CONFIG.STEALTH_MODE || CONFIG.VIDEO_URI)) {
      Logger.log('getUserMedia: Returning simulated stream');
      
      // Ensure stream generator is initialized
      if (!StreamGenerator.outputCanvas) {
        StreamGenerator.init(recommendedRes.width, recommendedRes.height);
      }
      
      // Add video source if configured
      if (CONFIG.VIDEO_URI && !VideoSourceManager.sources.has('primary')) {
        await VideoSourceManager.addSource('primary', CONFIG.VIDEO_URI, 'local_file');
        
        // Play video
        const source = VideoSourceManager.getActiveSource();
        if (source?.video) {
          await source.video.play().catch(e => Logger.warn('Video autoplay blocked:', e));
        }
      } else if (!VideoSourceManager.sources.has('synthetic')) {
        await VideoSourceManager.addSource('synthetic', null, 'synthetic');
      }
      
      // Start stream generation
      let stream = StreamGenerator.start();
      
      if (!stream) {
        Logger.error('getUserMedia: Failed to create stream');
        throw new DOMException('Could not start video source', 'NotReadableError');
      }
      
      // Set stream for WebRTC relay
      if (WebRTCRelayModule.enabled) {
        WebRTCRelayModule.setInjectedStream(stream);
      }
      
      // Add audio if requested
      if (wantsAudio) {
        addSilentAudio(stream);
      }
      
      // Spoof track metadata
      spoofTrackMetadata(stream, constraints);
      
      State.isActive = true;
      notifyReactNative('streamReady', { 
        tracks: stream.getTracks().length,
        resolution: recommendedRes,
      });
      
      return stream;
    }
    
    // Fall back to real getUserMedia
    if (originalGetUserMedia) {
      return originalGetUserMedia(constraints);
    }
    
    throw new DOMException('getUserMedia not supported', 'NotSupportedError');
  };
  
  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================
  
  function addSilentAudio(stream) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      
      const ac = new AudioContext();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      const dest = ac.createMediaStreamDestination();
      
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      
      dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
      Logger.log('Added silent audio track');
    } catch (e) {
      Logger.warn('Failed to add silent audio:', e);
    }
  }
  
  function spoofTrackMetadata(stream, constraints) {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;
    
    const device = CONFIG.DEVICES.find(d => d.type === 'camera') || CONFIG.DEVICES[0];
    const recommendedRes = ASIModule.getRecommendedResolution();
    const trackId = 'track_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const deviceId = device?.nativeDeviceId || device?.id || 'camera_0';
    const facingMode = device?.facing === 'back' ? 'environment' : 'user';
    
    // CRITICAL: Spoof essential track properties for webcamtests.com compatibility
    try {
      Object.defineProperty(videoTrack, 'id', {
        get: function() { return trackId; },
        configurable: true,
      });
    } catch(e) {}
    
    try {
      Object.defineProperty(videoTrack, 'kind', {
        get: function() { return 'video'; },
        configurable: true,
      });
    } catch(e) {}
    
    try {
      Object.defineProperty(videoTrack, 'readyState', {
        get: function() { return 'live'; },
        configurable: true,
      });
    } catch(e) {}
    
    try {
      Object.defineProperty(videoTrack, 'enabled', {
        get: function() { return true; },
        set: function(v) { /* ignore */ },
        configurable: true,
      });
    } catch(e) {}
    
    try {
      Object.defineProperty(videoTrack, 'muted', {
        get: function() { return false; },
        configurable: true,
      });
    } catch(e) {}
    
    // Spoof getSettings
    videoTrack.getSettings = function() {
      return {
        width: recommendedRes.width,
        height: recommendedRes.height,
        frameRate: CONFIG.TARGET_FPS,
        aspectRatio: recommendedRes.width / recommendedRes.height,
        facingMode: facingMode,
        deviceId: deviceId,
        groupId: device?.groupId || 'default',
        resizeMode: 'none',
      };
    };
    
    // Spoof getCapabilities
    videoTrack.getCapabilities = function() {
      return {
        aspectRatio: { min: 0.5, max: 2.0 },
        deviceId: deviceId,
        facingMode: [facingMode],
        frameRate: { min: 1, max: 60 },
        groupId: device?.groupId || 'default',
        height: { min: 1, max: 4320 },
        width: { min: 1, max: 7680 },
        resizeMode: ['none', 'crop-and-scale'],
      };
    };
    
    // Spoof getConstraints
    videoTrack.getConstraints = function() {
      return {
        facingMode: facingMode,
        width: { ideal: recommendedRes.width },
        height: { ideal: recommendedRes.height },
        deviceId: { exact: deviceId }
      };
    };
    
    // Spoof applyConstraints
    videoTrack.applyConstraints = function(constraints) {
      return Promise.resolve();
    };
    
    // Spoof label
    Object.defineProperty(videoTrack, 'label', {
      get: function() { return device?.name || 'Camera'; },
      configurable: true,
    });
    
    Logger.log('Track metadata spoofed:', device?.name, '| id:', trackId);
  }
  
  function notifyReactNative(type, payload) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'advancedProtocol2_' + type,
        payload: payload,
        timestamp: Date.now(),
      }));
    }
  }
  
  // ============================================================================
  // OVERLAY BADGE
  // ============================================================================
  
  function createOverlayBadge() {
    if (!CONFIG.SHOW_OVERLAY) return;
    
    const badge = document.createElement('div');
    badge.id = '__advP2Badge';
    badge.style.cssText = [
      'position: fixed',
      'top: 12px',
      'right: 12px',
      'z-index: 2147483647',
      'background: rgba(0, 0, 0, 0.7)',
      'color: #00ff88',
      'padding: 6px 12px',
      'border-radius: 8px',
      'font-size: 11px',
      'font-family: -apple-system, system-ui, sans-serif',
      'font-weight: 500',
      'letter-spacing: 0.3px',
      'pointer-events: none',
      'backdrop-filter: blur(4px)',
      'border: 1px solid rgba(0, 255, 136, 0.3)',
    ].join(';');
    badge.textContent = CONFIG.PROTOCOL_LABEL;
    
    if (document.body) {
      document.body.appendChild(badge);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        document.body?.appendChild(badge);
      });
    }
  }
  
  // ============================================================================
  // PUBLIC API
  // ============================================================================
  
  window.__advancedProtocol2 = {
    getState: function() { return State; },
    getMetrics: function() { return State.metrics; },
    
    addVideoSource: async function(uri) {
      const id = 'source_' + Date.now();
      return VideoSourceManager.addSource(id, uri, 'local_file');
    },
    
    switchSource: function(id) {
      return VideoSourceManager.switchSource(id);
    },
    
    getSiteProfile: function() {
      return ASIModule.siteFingerprint;
    },
    
    getThreats: function() {
      return State.asi.threats;
    },
    
    stop: function() {
      StreamGenerator.stop();
      State.isActive = false;
      Logger.log('Protocol stopped');
    },
    
    restart: function() {
      StreamGenerator.stop();
      StreamGenerator.start();
      Logger.log('Protocol restarted');
    },
  };
  
  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  // Initialize modules
  ASIModule.init();
  GPUModule.init(CONFIG.PORTRAIT_WIDTH, CONFIG.PORTRAIT_HEIGHT);
  WebRTCRelayModule.init();
  
  // Create overlay badge
  createOverlayBadge();
  
  // Notify ready
  notifyReactNative('ready', {
    modules: {
      asi: ASIModule.enabled,
      gpu: GPUModule.enabled,
      webrtc: WebRTCRelayModule.enabled,
      crypto: CryptoModule.enabled,
    },
    config: {
      stealth: CONFIG.STEALTH_MODE,
      devices: CONFIG.DEVICES.length,
    },
  });
  
  Logger.log('========================================');
  Logger.log('ADVANCED PROTOCOL 2: READY');
  Logger.log('========================================');
  
})();
true;
`;
}

/**
 * Create a minimal initialization script for Protocol 2
 */
export function createAdvancedProtocol2InitScript(): string {
  return `
(function() {
  if (window.__advancedProtocol2Initialized) {
    console.log('[AdvP2] Already initialized');
    return;
  }
  console.log('[AdvP2] Waiting for full initialization...');
})();
true;
`;
}
