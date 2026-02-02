/**
 * WebSocket Bridge Injection Script
 * 
 * Protocol 6: Local WebSocket Relay
 * 
 * This script is injected into the WebView and:
 * 1. Creates a canvas for rendering video frames
 * 2. Receives frame data or tick signals from React Native
 * 3. Renders frames to the canvas
 * 4. Captures the canvas as a MediaStream
 * 5. Overrides getUserMedia to return this stream
 * 
 * Key difference from other protocols:
 * - Frames are controlled by React Native via postMessage
 * - Each getUserMedia call gets a fresh stream from the same canvas
 * - The canvas render loop is driven by React Native timing
 */

import type { CaptureDevice } from '@/types/device';

export interface WebSocketInjectionConfig {
  /** Target video width */
  width: number;
  
  /** Target video height */
  height: number;
  
  /** Target FPS */
  fps: number;
  
  /** Device metadata for spoofing */
  devices: CaptureDevice[];
  
  /** Enable debug logging */
  debug: boolean;
  
  /** Enable stealth mode (spoof all device detection) */
  stealthMode: boolean;
  
  /** Protocol label for overlay */
  protocolLabel: string;
  
  /** Show overlay label */
  showOverlay: boolean;
  
  /** Video URI to load (optional - if not set, uses green screen) */
  videoUri?: string;
}

/**
 * Create the WebSocket Bridge injection script
 */
export function createWebSocketInjectionScript(config: WebSocketInjectionConfig): string {
  const {
    width = 1080,
    height = 1920,
    fps = 30,
    devices = [],
    debug = false,
    stealthMode = true,
    protocolLabel = 'Protocol 6: WebSocket Bridge',
    showOverlay = false,
    videoUri,
  } = config;

  return `
(function() {
  'use strict';
  
  // ============================================================================
  // WEBSOCKET BRIDGE INJECTION - PROTOCOL 6
  // ============================================================================
  
  if (window.__wsBridgeInitialized) {
    console.log('[WSBridge] Already initialized');
    return;
  }
  window.__wsBridgeInitialized = true;
  
  // ============================================================================
  // CONFIGURATION
  // ============================================================================
  
  const CONFIG = {
    WIDTH: ${width},
    HEIGHT: ${height},
    FPS: ${fps},
    DEBUG: ${debug},
    STEALTH: ${stealthMode},
    DEVICES: ${JSON.stringify(devices)},
    PROTOCOL_LABEL: ${JSON.stringify(protocolLabel)},
    SHOW_OVERLAY: ${showOverlay},
    VIDEO_URI: ${JSON.stringify(videoUri || null)},
  };
  
  // ============================================================================
  // LOGGING
  // ============================================================================
  
  const Logger = {
    enabled: CONFIG.DEBUG,
    prefix: '[WSBridge]',
    log: function(...args) { if (this.enabled) console.log(this.prefix, ...args); },
    warn: function(...args) { if (this.enabled) console.warn(this.prefix, ...args); },
    error: function(...args) { console.error(this.prefix, ...args); },
  };
  
  Logger.log('='.repeat(60));
  Logger.log('PROTOCOL 6: WEBSOCKET BRIDGE INITIALIZING');
  Logger.log('Resolution:', CONFIG.WIDTH, 'x', CONFIG.HEIGHT);
  Logger.log('FPS:', CONFIG.FPS);
  Logger.log('Stealth:', CONFIG.STEALTH);
  Logger.log('='.repeat(60));
  
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
  // STATE
  // ============================================================================
  
  const State = {
    isActive: false,
    canvas: null,
    ctx: null,
    videoElement: null,
    videoLoaded: false,
    lastFrameTime: 0,
    frameCount: 0,
    currentFps: 0,
    activeStreams: [],
    renderLoopRunning: false,
  };
  
  // ============================================================================
  // CANVAS INITIALIZATION
  // ============================================================================
  
  function initCanvas() {
    Logger.log('Initializing canvas...');
    
    const canvas = document.createElement('canvas');
    canvas.width = CONFIG.WIDTH;
    canvas.height = CONFIG.HEIGHT;
    canvas.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
    
    const ctx = canvas.getContext('2d', { 
      alpha: false,
      desynchronized: true,
      willReadFrequently: false,
    });
    
    if (!ctx) {
      Logger.error('Failed to get canvas context');
      return false;
    }
    
    State.canvas = canvas;
    State.ctx = ctx;
    
    // Append to DOM when ready
    if (document.body) {
      document.body.appendChild(canvas);
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        if (document.body) document.body.appendChild(canvas);
      });
    }
    
    Logger.log('Canvas initialized:', CONFIG.WIDTH, 'x', CONFIG.HEIGHT);
    return true;
  }
  
  // ============================================================================
  // VIDEO LOADING (Optional)
  // ============================================================================
  
  function loadVideo() {
    if (!CONFIG.VIDEO_URI) {
      Logger.log('No video URI, using synthetic frames');
      return Promise.resolve(false);
    }
    
    Logger.log('Loading video from:', CONFIG.VIDEO_URI.substring(0, 50));
    
    return new Promise(function(resolve) {
      const video = document.createElement('video');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;';
      
      const timeout = setTimeout(function() {
        Logger.warn('Video load timeout');
        resolve(false);
      }, 15000);
      
      video.onloadeddata = function() {
        clearTimeout(timeout);
        Logger.log('Video loaded:', video.videoWidth, 'x', video.videoHeight);
        
        video.play().then(function() {
          State.videoElement = video;
          State.videoLoaded = true;
          if (document.body) document.body.appendChild(video);
          resolve(true);
        }).catch(function(err) {
          Logger.warn('Video autoplay failed:', err);
          State.videoElement = video;
          State.videoLoaded = true;
          if (document.body) document.body.appendChild(video);
          resolve(true);
        });
      };
      
      video.onerror = function() {
        clearTimeout(timeout);
        Logger.warn('Video load failed');
        resolve(false);
      };
      
      video.src = CONFIG.VIDEO_URI;
      video.load();
    });
  }
  
  // ============================================================================
  // FRAME RENDERING
  // ============================================================================
  
  function renderFrame(timestamp) {
    if (!State.ctx || !State.canvas) return;
    
    const ctx = State.ctx;
    const w = State.canvas.width;
    const h = State.canvas.height;
    
    State.frameCount++;
    
    // Update FPS calculation
    if (State.lastFrameTime > 0) {
      const delta = timestamp - State.lastFrameTime;
      if (State.frameCount % 30 === 0) {
        State.currentFps = Math.round(1000 / delta);
      }
    }
    State.lastFrameTime = timestamp;
    
    if (State.videoLoaded && State.videoElement && State.videoElement.readyState >= 2) {
      // Render video frame
      try {
        const vw = State.videoElement.videoWidth || 1;
        const vh = State.videoElement.videoHeight || 1;
        
        // Center crop to fill canvas (9:16 aspect ratio)
        const targetRatio = w / h;
        const videoRatio = vw / vh;
        
        let sx = 0, sy = 0, sw = vw, sh = vh;
        
        if (videoRatio > targetRatio) {
          sw = vh * targetRatio;
          sx = (vw - sw) / 2;
        } else {
          sh = vw / targetRatio;
          sy = (vh - sh) / 2;
        }
        
        ctx.drawImage(State.videoElement, sx, sy, sw, sh, 0, 0, w, h);
      } catch (e) {
        renderSyntheticFrame(ctx, w, h, timestamp);
      }
    } else {
      // Render synthetic green screen
      renderSyntheticFrame(ctx, w, h, timestamp);
    }
  }
  
  function renderSyntheticFrame(ctx, w, h, timestamp) {
    const t = timestamp / 1000;
    
    // Animated gradient green screen
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    const offset = Math.sin(t * 0.5) * 10;
    
    gradient.addColorStop(0, 'rgb(0, ' + Math.floor(250 + offset) + ', 0)');
    gradient.addColorStop(0.5, 'rgb(0, ' + Math.floor(235 + offset) + ', 0)');
    gradient.addColorStop(1, 'rgb(0, ' + Math.floor(250 + offset) + ', 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    
    // Add subtle animation indicator
    const indicatorY = h * 0.1;
    const pulseSize = 10 + Math.sin(t * 2) * 5;
    
    ctx.beginPath();
    ctx.arc(w * 0.9, indicatorY, pulseSize, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fill();
    
    // Frame counter (debug only)
    if (CONFIG.DEBUG) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(10, h - 40, 200, 30);
      ctx.fillStyle = '#00ff88';
      ctx.font = '16px monospace';
      ctx.fillText('Frame: ' + State.frameCount + ' | FPS: ' + State.currentFps, 20, h - 18);
    }
  }
  
  // ============================================================================
  // RENDER LOOP
  // ============================================================================
  
  function startRenderLoop() {
    if (State.renderLoopRunning) return;
    State.renderLoopRunning = true;
    
    const targetFrameTime = 1000 / CONFIG.FPS;
    let lastRenderTime = 0;
    
    function loop(timestamp) {
      if (!State.renderLoopRunning) return;
      
      const elapsed = timestamp - lastRenderTime;
      if (elapsed >= targetFrameTime * 0.9) {
        lastRenderTime = timestamp;
        renderFrame(timestamp);
      }
      
      requestAnimationFrame(loop);
    }
    
    requestAnimationFrame(loop);
    Logger.log('Render loop started at', CONFIG.FPS, 'FPS');
  }
  
  function stopRenderLoop() {
    State.renderLoopRunning = false;
    Logger.log('Render loop stopped');
  }
  
  // ============================================================================
  // STREAM CREATION
  // ============================================================================
  
  function createFreshStream() {
    if (!State.canvas) {
      Logger.error('Cannot create stream: canvas not initialized');
      return null;
    }
    
    try {
      // CRITICAL: Always create a NEW stream
      const stream = State.canvas.captureStream(CONFIG.FPS);
      
      if (!stream || stream.getVideoTracks().length === 0) {
        Logger.error('captureStream failed');
        return null;
      }
      
      // Spoof track metadata
      spoofTrackMetadata(stream);
      
      // Track active streams
      State.activeStreams.push(stream);
      
      Logger.log('Fresh stream created, total active:', State.activeStreams.length);
      return stream;
    } catch (e) {
      Logger.error('Failed to create stream:', e);
      return null;
    }
  }
  
  function spoofTrackMetadata(stream) {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;
    
    const device = CONFIG.DEVICES.find(function(d) { return d.type === 'camera'; }) || CONFIG.DEVICES[0] || {};
    const trackId = 'wsbtrack_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const deviceId = device.nativeDeviceId || device.id || 'ws-bridge-camera-0';
    const facingMode = device.facing === 'back' ? 'environment' : 'user';
    const label = device.name || 'WebSocket Bridge Camera';
    
    // Spoof readyState to always be live
    try {
      Object.defineProperty(videoTrack, 'readyState', {
        get: function() { return 'live'; },
        configurable: true,
      });
    } catch(e) {}
    
    // Spoof enabled
    try {
      Object.defineProperty(videoTrack, 'enabled', {
        get: function() { return true; },
        set: function() {},
        configurable: true,
      });
    } catch(e) {}
    
    // Spoof muted
    try {
      Object.defineProperty(videoTrack, 'muted', {
        get: function() { return false; },
        configurable: true,
      });
    } catch(e) {}
    
    // Spoof label
    try {
      Object.defineProperty(videoTrack, 'label', {
        get: function() { return label; },
        configurable: true,
      });
    } catch(e) {}
    
    // Spoof getSettings
    videoTrack.getSettings = function() {
      return {
        width: CONFIG.WIDTH,
        height: CONFIG.HEIGHT,
        frameRate: CONFIG.FPS,
        aspectRatio: CONFIG.WIDTH / CONFIG.HEIGHT,
        facingMode: facingMode,
        deviceId: deviceId,
        groupId: device.groupId || 'ws-bridge-group',
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
        groupId: device.groupId || 'ws-bridge-group',
        height: { min: 1, max: 4320 },
        width: { min: 1, max: 7680 },
        resizeMode: ['none', 'crop-and-scale'],
      };
    };
    
    // Spoof getConstraints
    videoTrack.getConstraints = function() {
      return {
        facingMode: facingMode,
        width: { ideal: CONFIG.WIDTH },
        height: { ideal: CONFIG.HEIGHT },
        deviceId: { exact: deviceId },
      };
    };
    
    // Spoof applyConstraints
    videoTrack.applyConstraints = function() {
      return Promise.resolve();
    };
    
    Logger.log('Track spoofed:', label, '| id:', trackId);
  }
  
  // ============================================================================
  // SILENT AUDIO
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
      
      dest.stream.getAudioTracks().forEach(function(t) {
        stream.addTrack(t);
      });
      
      Logger.log('Silent audio added');
    } catch (e) {
      Logger.warn('Failed to add audio:', e);
    }
  }
  
  // ============================================================================
  // MEDIADEVICES OVERRIDE
  // ============================================================================
  
  const originalGetUserMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
  const originalEnumerateDevices = navigator.mediaDevices?.enumerateDevices?.bind(navigator.mediaDevices);
  
  if (!navigator.mediaDevices) {
    navigator.mediaDevices = {};
  }
  
  navigator.mediaDevices.enumerateDevices = async function() {
    Logger.log('enumerateDevices called');
    
    if (CONFIG.STEALTH) {
      const devices = CONFIG.DEVICES.map(function(d) {
        return {
          deviceId: d.nativeDeviceId || d.id || 'ws-bridge-camera-0',
          groupId: d.groupId || 'ws-bridge-group',
          kind: d.type === 'camera' ? 'videoinput' : 'audioinput',
          label: d.name || 'WebSocket Bridge Camera',
          toJSON: function() { return this; },
        };
      });
      
      // Add default devices if none configured
      if (devices.length === 0) {
        devices.push({
          deviceId: 'ws-bridge-camera-0',
          groupId: 'ws-bridge-group',
          kind: 'videoinput',
          label: 'WebSocket Bridge Camera (1080x1920)',
          toJSON: function() { return this; },
        });
      }
      
      Logger.log('Returning', devices.length, 'spoofed devices');
      return devices;
    }
    
    if (originalEnumerateDevices) {
      return originalEnumerateDevices();
    }
    
    return [];
  };
  
  navigator.mediaDevices.getUserMedia = async function(constraints) {
    Logger.log('getUserMedia called:', constraints);
    
    const wantsVideo = !!constraints?.video;
    const wantsAudio = !!constraints?.audio;
    
    if (!wantsVideo) {
      Logger.log('Audio-only request');
      if (originalGetUserMedia) {
        return originalGetUserMedia(constraints);
      }
      throw new DOMException('Audio not available', 'NotFoundError');
    }
    
    Logger.log('Video requested - creating fresh WebSocket bridge stream');
    
    // Ensure render loop is running
    if (!State.renderLoopRunning) {
      startRenderLoop();
    }
    
    // Create fresh stream
    const stream = createFreshStream();
    
    if (!stream) {
      Logger.error('Failed to create stream');
      throw new DOMException('Could not start video source', 'NotReadableError');
    }
    
    // Verify track is live
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      throw new DOMException('No video track', 'NotReadableError');
    }
    
    // Add audio if requested
    if (wantsAudio) {
      addSilentAudio(stream);
    }
    
    State.isActive = true;
    
    // Notify React Native
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'wsBridgeStreamReady',
        payload: {
          tracks: stream.getTracks().length,
          width: CONFIG.WIDTH,
          height: CONFIG.HEIGHT,
        },
        timestamp: Date.now(),
      }));
    }
    
    Logger.log('Returning stream with', stream.getTracks().length, 'tracks');
    return stream;
  };
  
  // ============================================================================
  // REACT NATIVE MESSAGE HANDLERS
  // ============================================================================
  
  // Receive frame data from React Native (for actual video frames)
  window.__wsBridgeReceiveFrame = function(message) {
    if (!message || !message.frame) return;
    
    const frame = message.frame;
    
    if (frame.data && State.ctx && State.canvas) {
      // Decode base64 image and draw to canvas
      const img = new Image();
      img.onload = function() {
        State.ctx.drawImage(img, 0, 0, State.canvas.width, State.canvas.height);
      };
      img.src = 'data:image/jpeg;base64,' + frame.data;
    }
  };
  
  // Receive tick signal from React Native (for synthetic frames)
  window.__wsBridgeTick = function(message) {
    // Tick is handled by the render loop
    // This could be used to sync timing if needed
  };
  
  // ============================================================================
  // OVERLAY BADGE
  // ============================================================================
  
  function createOverlay() {
    if (!CONFIG.SHOW_OVERLAY) return;
    
    const badge = document.createElement('div');
    badge.id = '__wsBridgeBadge';
    badge.style.cssText = [
      'position: fixed',
      'top: 12px',
      'right: 12px',
      'z-index: 2147483647',
      'background: rgba(0, 0, 0, 0.8)',
      'color: #00aaff',
      'padding: 6px 12px',
      'border-radius: 8px',
      'font-size: 11px',
      'font-family: -apple-system, system-ui, sans-serif',
      'font-weight: 600',
      'pointer-events: none',
      'backdrop-filter: blur(4px)',
      'border: 1px solid rgba(0, 170, 255, 0.4)',
    ].join(';');
    badge.textContent = CONFIG.PROTOCOL_LABEL;
    
    if (document.body) {
      document.body.appendChild(badge);
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        document.body?.appendChild(badge);
      });
    }
  }
  
  // ============================================================================
  // PUBLIC API
  // ============================================================================
  
  window.__wsBridge = {
    getState: function() {
      return {
        isActive: State.isActive,
        frameCount: State.frameCount,
        currentFps: State.currentFps,
        activeStreams: State.activeStreams.length,
        renderLoopRunning: State.renderLoopRunning,
        videoLoaded: State.videoLoaded,
      };
    },
    
    restart: function() {
      stopRenderLoop();
      startRenderLoop();
    },
    
    stop: function() {
      stopRenderLoop();
      State.activeStreams.forEach(function(s) {
        s.getTracks().forEach(function(t) { t.stop(); });
      });
      State.activeStreams = [];
      State.isActive = false;
    },
  };
  
  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  async function initialize() {
    Logger.log('Initializing WebSocket Bridge...');
    
    // Initialize canvas
    if (!initCanvas()) {
      Logger.error('Canvas initialization failed');
      return;
    }
    
    // Try to load video if configured
    await loadVideo();
    
    // Start render loop
    startRenderLoop();
    
    // Create overlay
    createOverlay();
    
    Logger.log('='.repeat(60));
    Logger.log('PROTOCOL 6: WEBSOCKET BRIDGE READY');
    Logger.log('Video loaded:', State.videoLoaded);
    Logger.log('Render loop:', State.renderLoopRunning);
    Logger.log('='.repeat(60));
    
    // Notify React Native
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'wsBridgeReady',
        payload: {
          videoLoaded: State.videoLoaded,
          width: CONFIG.WIDTH,
          height: CONFIG.HEIGHT,
          fps: CONFIG.FPS,
        },
        timestamp: Date.now(),
      }));
    }
  }
  
  // Start initialization
  initialize();
  
})();
true;
`;
}
