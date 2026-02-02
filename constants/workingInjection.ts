/**
 * Working Video Injection System
 * Designed to work reliably with webcamtests.com and similar sites
 * 
 * Key improvements:
 * 1. Immediate getUserMedia override (before any page code runs)
 * 2. Robust video loading with proper error handling
 * 3. Canvas stream as reliable fallback
 * 4. Proper track metadata spoofing
 * 5. Audio track support
 */

import type { CaptureDevice } from '@/types/device';

export interface WorkingInjectionOptions {
  videoUri?: string | null;
  devices: CaptureDevice[];
  stealthMode: boolean;
  debugEnabled: boolean;
  targetWidth?: number;
  targetHeight?: number;
  targetFPS?: number;
}

/**
 * Creates a bulletproof video injection script that works with webcamtests.com
 */
export function createWorkingInjectionScript(options: WorkingInjectionOptions): string {
  const {
    videoUri,
    devices,
    stealthMode,
    debugEnabled,
    targetWidth = 1080,
    targetHeight = 1920,
    targetFPS = 30,
  } = options;

  return `
(function() {
  'use strict';
  
  // ============================================================================
  // IMMEDIATE INITIALIZATION - Run before ANY page code
  // ============================================================================
  
  if (window.__workingInjectionActive) {
    console.log('[WorkingInject] Already active');
    if (window.__updateMediaConfig) {
      window.__updateMediaConfig({
        videoUri: ${JSON.stringify(videoUri)},
        devices: ${JSON.stringify(devices)},
        stealthMode: ${stealthMode},
        debugEnabled: ${debugEnabled},
        targetWidth: ${targetWidth},
        targetHeight: ${targetHeight},
        targetFPS: ${targetFPS},
      });
      return;
    }
    // Allow dynamic re-injection (e.g. when user changes selected video/device in RN):
    // destroy the previous instance and continue booting a fresh one.
    try {
      if (window.__workingInjection && typeof window.__workingInjection.destroy === 'function') {
        window.__workingInjection.destroy();
      }
    } catch (e) {}
  }
  window.__workingInjectionActive = true;
  
  // Detect environment
  const isWebView = navigator.userAgent.includes('WebView') || 
                     navigator.userAgent.includes('wv') ||
                     !!window.ReactNativeWebView;
  console.log('[WorkingInject] Environment:', isWebView ? 'WebView' : 'Browser');
  
  const CONFIG = {
    DEBUG: ${debugEnabled},
    STEALTH: ${stealthMode},
    VIDEO_URI: ${JSON.stringify(videoUri)},
    DEVICES: ${JSON.stringify(devices)},
    TARGET_WIDTH: ${targetWidth},
    TARGET_HEIGHT: ${targetHeight},
    TARGET_FPS: ${targetFPS},
    AUDIO_ENABLED: true,
  };
  
  const log = (...args) => {
    if (CONFIG.DEBUG) console.log('[WorkingInject]', ...args);
  };
  const error = (...args) => console.error('[WorkingInject]', ...args);
  const notifyUnsupported = (reason) => {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'mediaInjectionUnsupported',
          payload: {
            reason: reason,
            protocol: 'working',
            timestamp: Date.now(),
          },
        }));
      } catch (e) {}
    }
  };
  
  function safeRemoveElement(el) {
    if (!el) return;
    try {
      if (typeof el.remove === 'function') {
        el.remove();
        return;
      }
    } catch (e) {}
    try {
      if (el.parentNode) el.parentNode.removeChild(el);
    } catch (e) {}
  }
  
  function computeVideoUriFromConfig(config) {
    if (!config) return CONFIG.VIDEO_URI || null;
    if (config.videoUri !== undefined) return config.videoUri;
    if (Array.isArray(config.devices)) {
      const primary = config.devices.find(d => d.type === 'camera' && d.simulationEnabled && d.assignedVideoUri) ||
        config.devices.find(d => d.type === 'camera' && d.assignedVideoUri);
      if (primary && primary.assignedVideoUri) return primary.assignedVideoUri;
    }
    if (config.fallbackVideoUri) return config.fallbackVideoUri;
    return CONFIG.VIDEO_URI || null;
  }
  
  function updateConfig(newConfig) {
    if (!newConfig || typeof newConfig !== 'object') return;
    
    if (typeof newConfig.stealthMode === 'boolean') {
      CONFIG.STEALTH = newConfig.stealthMode;
    }
    if (typeof newConfig.debugEnabled === 'boolean') {
      CONFIG.DEBUG = newConfig.debugEnabled;
    }
    if (Array.isArray(newConfig.devices)) {
      CONFIG.DEVICES = newConfig.devices;
    }
    if (typeof newConfig.targetWidth === 'number') {
      CONFIG.TARGET_WIDTH = newConfig.targetWidth;
    }
    if (typeof newConfig.targetHeight === 'number') {
      CONFIG.TARGET_HEIGHT = newConfig.targetHeight;
    }
    if (typeof newConfig.targetFPS === 'number') {
      CONFIG.TARGET_FPS = newConfig.targetFPS;
    }
    
    const nextVideoUri = computeVideoUriFromConfig(newConfig);
    if (nextVideoUri !== CONFIG.VIDEO_URI) {
      CONFIG.VIDEO_URI = nextVideoUri;
      State.videoLoaded = false;
      State.mode = nextVideoUri ? 'video' : 'canvas';
      if (State.videoElement) {
        try { State.videoElement.pause(); } catch (e) {}
        safeRemoveElement(State.videoElement);
      }
      State.videoElement = null;
      State.stream = null;
      
      if (nextVideoUri) {
        initVideoStream().then(videoOk => {
          State.mode = videoOk ? 'video' : 'canvas';
        }).catch(() => {});
      }
    }
    
    // Resize canvas if dimensions changed
    if (State.canvasElement) {
      State.canvasElement.width = CONFIG.TARGET_WIDTH;
      State.canvasElement.height = CONFIG.TARGET_HEIGHT;
    }
  }
  
  log('========================================');
  log('WORKING VIDEO INJECTION - INITIALIZING');
  log('Video URI:', CONFIG.VIDEO_URI ? 'SET' : 'NONE (will use canvas)');
  log('Devices:', CONFIG.DEVICES.length);
  log('========================================');
  
  // ============================================================================
  // STATE
  // ============================================================================
  
  const State = {
    ready: false,
    videoElement: null,
    canvasElement: null,
    canvasContext: null,
    animationFrameId: null,
    stream: null,
    videoLoaded: false,
    mode: 'canvas', // 'video' or 'canvas'
    // Optional WebCodecs/TrackGenerator pipeline (more native-like than canvas.captureStream).
    generators: new Set(), // Set<{ track: MediaStreamTrack, writer: any }>
    lastConstraints: null,
    unsupportedReason: null,
    capabilities: {
      canvasCaptureStream: false,
      videoCaptureStream: false,
    },
  };

  function supportsTrackGenerator() {
    return (
      typeof window !== 'undefined' &&
      typeof window.MediaStreamTrackGenerator === 'function' &&
      typeof window.VideoFrame === 'function'
    );
  }

  // ============================================================================
  // CAPABILITY DETECTION
  // ============================================================================
  
  function detectCaptureSupport() {
    try {
      State.capabilities.canvasCaptureStream = !!(window.HTMLCanvasElement &&
        (HTMLCanvasElement.prototype.captureStream ||
          HTMLCanvasElement.prototype.mozCaptureStream ||
          HTMLCanvasElement.prototype.webkitCaptureStream));
    } catch (e) {
      State.capabilities.canvasCaptureStream = false;
    }
    
    try {
      State.capabilities.videoCaptureStream = !!(window.HTMLVideoElement &&
        (HTMLVideoElement.prototype.captureStream ||
          HTMLVideoElement.prototype.mozCaptureStream ||
          HTMLVideoElement.prototype.webkitCaptureStream));
    } catch (e) {
      State.capabilities.videoCaptureStream = false;
    }
    
    if (!State.capabilities.canvasCaptureStream && !State.capabilities.videoCaptureStream) {
      State.unsupportedReason = 'captureStream not supported on this WebView';
      error('captureStream not supported - injection cannot create MediaStream');
      notifyUnsupported(State.unsupportedReason);
    }
  }

  detectCaptureSupport();
  
  // ============================================================================
  // NATIVE MEDIA BRIDGE (iOS fallback)
  // ============================================================================
  
  const NativeBridge = {
    pending: {},
    
    canUse: function() {
      return !!(window.ReactNativeWebView && window.ReactNativeWebView.postMessage && window.RTCPeerConnection);
    },
    
    requestStream: function(constraints) {
      const self = this;
      if (!self.canUse()) {
        return Promise.reject(new DOMException('Native bridge not available', 'NotSupportedError'));
      }
      
      const requestId = 'native_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      
      return new Promise(function(resolve, reject) {
        const pc = new RTCPeerConnection({ iceServers: [] });
        const entry = { pc: pc, resolve: resolve, reject: reject, completed: false };
        self.pending[requestId] = entry;
        
        pc.onicecandidate = function(event) {
          if (event && event.candidate) {
            try {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'nativeGumIce',
                payload: { requestId: requestId, candidate: event.candidate }
              }));
            } catch (e) {}
          }
        };
        
        pc.ontrack = function(event) {
          if (!event) return;
          const stream = (event.streams && event.streams[0])
            ? event.streams[0]
            : new MediaStream([event.track]);
          
          // Ensure cleanup when tracks stop
          try {
            stream.getTracks().forEach(function(track) {
              const origStop = track.stop;
              track.stop = function() {
                try { if (origStop) origStop.call(track); } catch (e) {}
                NativeBridge.cleanup(requestId);
              };
            });
          } catch (e) {}
          
          entry.completed = true;
          resolve(stream);
        };
        
        pc.onconnectionstatechange = function() {
          if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            if (!entry.completed) {
              reject(new DOMException('Native bridge connection failed', 'NotReadableError'));
            }
            NativeBridge.cleanup(requestId);
          }
        };
        
        pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: false })
          .then(function(offer) { return pc.setLocalDescription(offer); })
          .then(function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'nativeGumOffer',
              payload: {
                requestId: requestId,
                offer: pc.localDescription,
                constraints: constraints || null
              }
            }));
          })
          .catch(function(err) {
            delete self.pending[requestId];
            reject(err);
          });
        
        setTimeout(function() {
          if (self.pending[requestId] && !self.pending[requestId].completed) {
            self.pending[requestId].reject(new DOMException('Native bridge timeout', 'NotReadableError'));
            self.cleanup(requestId);
          }
        }, 15000);
      });
    },
    
    handleAnswer: function(payload) {
      const entry = payload && this.pending[payload.requestId];
      if (!entry) return;
      try {
        const desc = new RTCSessionDescription(payload.answer);
        entry.pc.setRemoteDescription(desc);
      } catch (e) {
        entry.reject(e);
        this.cleanup(payload.requestId);
      }
    },
    
    handleIce: function(payload) {
      const entry = payload && this.pending[payload.requestId];
      if (!entry || !payload.candidate) return;
      try {
        entry.pc.addIceCandidate(payload.candidate);
      } catch (e) {}
    },
    
    handleError: function(payload) {
      const entry = payload && this.pending[payload.requestId];
      if (!entry) return;
      entry.reject(new Error(payload.message || 'Native bridge error'));
      this.cleanup(payload.requestId);
    },
    
    cleanup: function(requestId) {
      const entry = this.pending[requestId];
      if (!entry) return;
      try { entry.pc.close(); } catch (e) {}
      delete this.pending[requestId];
    }
  };
  
  window.__nativeMediaBridgeRequest = function(constraints) {
    const nativeConstraints = (constraints && typeof constraints === 'object')
      ? { ...constraints }
      : {};
    if (CONFIG.VIDEO_URI && (
      CONFIG.VIDEO_URI.startsWith('file://') ||
      CONFIG.VIDEO_URI.startsWith('/') ||
      CONFIG.VIDEO_URI.startsWith('data:') ||
      CONFIG.VIDEO_URI.startsWith('ph://')
    )) {
      nativeConstraints.videoUri = CONFIG.VIDEO_URI;
    } else {
      nativeConstraints.videoUri = null;
    }
    nativeConstraints.targetWidth = CONFIG.TARGET_WIDTH;
    nativeConstraints.targetHeight = CONFIG.TARGET_HEIGHT;
    nativeConstraints.targetFPS = CONFIG.TARGET_FPS;
    nativeConstraints.loopVideo = true;
    return NativeBridge.requestStream(nativeConstraints);
  };
  window.__nativeGumAnswer = function(payload) { NativeBridge.handleAnswer(payload); };
  window.__nativeGumIce = function(payload) { NativeBridge.handleIce(payload); };
  window.__nativeGumError = function(payload) { NativeBridge.handleError(payload); };
  
  // ============================================================================
  // SILENT AUDIO GENERATOR
  // ============================================================================
  
  function createSilentAudioTrack() {
    if (!CONFIG.AUDIO_ENABLED) return null;
    
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        log('AudioContext not available');
        return null;
      }
      
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const destination = audioContext.createMediaStreamDestination();
      
      // Create silent audio
      gainNode.gain.value = 0;
      oscillator.connect(gainNode);
      gainNode.connect(destination);
      oscillator.start();
      
      const audioTracks = destination.stream.getAudioTracks();
      if (audioTracks.length > 0) {
        log('Silent audio track created');
        
        // Spoof audio track metadata
        const audioTrack = audioTracks[0];
        try {
          Object.defineProperty(audioTrack, 'label', {
            get: () => 'Built-in Microphone',
            configurable: true,
          });
        } catch (e) {}
        
        return audioTrack;
      }
    } catch (e) {
      error('Failed to create audio track:', e);
    }
    return null;
  }
  
  // ============================================================================
  // CANVAS STREAM GENERATOR
  // ============================================================================
  
  function initCanvasStream() {
    log('Initializing canvas stream...');
    
    try {
      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = CONFIG.TARGET_WIDTH;
      canvas.height = CONFIG.TARGET_HEIGHT;
      canvas.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';

      // Expose injection canvas for diagnostics / MediaRecorder polyfills
      try {
        window.__mediaSimInternal = window.__mediaSimInternal || {};
        window.__mediaSimInternal.lastCanvas = canvas;
        window.__mediaSimInternal.lastCanvasMeta = {
          width: canvas.width,
          height: canvas.height,
          source: 'workingInjection'
        };
      } catch (e) {}
      
      // Use the simplest 2D context options possible.
      // Some WebViews / headless modes behave poorly with "desynchronized" and friends,
      // and that can result in MediaRecorder producing 0-byte blobs.
      const ctx = canvas.getContext('2d', { alpha: false });
      
      if (!ctx) {
        error('Failed to get canvas context');
        return false;
      }
      
      State.canvasElement = canvas;
      State.canvasContext = ctx;
      State.mode = 'canvas';
      
      // Try to append to body (non-blocking)
      setTimeout(() => {
        if (document.body) {
          document.body.appendChild(canvas);
        } else {
          document.addEventListener('DOMContentLoaded', () => {
            if (document.body) document.body.appendChild(canvas);
          });
        }
      }, 0);
      
      log('Canvas created:', canvas.width, 'x', canvas.height);
      return true;
    } catch (e) {
      error('Canvas initialization failed:', e);
      return false;
    }
  }
  
  // ============================================================================
  // VIDEO STREAM LOADER
  // ============================================================================
  
  function initVideoStream() {
    if (!CONFIG.VIDEO_URI) {
      log('No video URI provided, using canvas only');
      return Promise.resolve(false);
    }
    
    log('Loading video from URI...');
    State.mode = 'video';
    
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.preload = 'auto';
      video.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;';
      
      const timeout = setTimeout(() => {
        log('Video load timeout, falling back to canvas');
        cleanup();
        resolve(false);
      }, 10000);
      
      function cleanup() {
        clearTimeout(timeout);
        video.onloadeddata = null;
        video.onerror = null;
        video.oncanplay = null;
      }
      
      video.onloadeddata = () => {
        log('Video loaded:', video.videoWidth, 'x', video.videoHeight);
        cleanup();
        
        // Try to play
        video.play().then(() => {
          log('Video playing successfully');
          State.videoElement = video;
          State.videoLoaded = true;
          
          // Append to DOM
          if (document.body) {
            document.body.appendChild(video);
          } else {
            document.addEventListener('DOMContentLoaded', () => {
              if (document.body) document.body.appendChild(video);
            });
          }
          
          resolve(true);
        }).catch(err => {
          log('Video autoplay failed:', err.message);
          // Still consider it loaded, will play on user interaction
          State.videoElement = video;
          State.videoLoaded = true;
          
          if (document.body) {
            document.body.appendChild(video);
          }
          
          resolve(true);
        });
      };
      
      video.onerror = (e) => {
        error('Video load error:', e);
        cleanup();
        resolve(false);
      };
      
      video.src = CONFIG.VIDEO_URI;
      video.load();
    });
  }
  
  // ============================================================================
  // RENDER LOOP
  // ============================================================================
  
  function startRenderLoop() {
    if (State.animationFrameId) {
      return; // Already running
    }
    
    const canvas = State.canvasElement;
    const ctx = State.canvasContext;
    if (!canvas || !ctx) {
      error('Canvas not initialized');
      return;
    }
    
    let lastFrameTime = 0;
    const frameInterval = 1000 / CONFIG.TARGET_FPS;
    let frameCount = 0;
    
    function render(timestamp) {
      // Frame pacing
      const elapsed = timestamp - lastFrameTime;
      if (elapsed < frameInterval * 0.9) {
        State.animationFrameId = requestAnimationFrame(render);
        return;
      }
      
      lastFrameTime = timestamp;
      frameCount++;
      
      // Render frame
      if (State.mode === 'video' && State.videoElement && State.videoLoaded) {
        // Draw video frame
        try {
          if (State.videoElement.readyState >= 2) {
            ctx.drawImage(State.videoElement, 0, 0, canvas.width, canvas.height);
          } else {
            // Video not ready, draw green screen
            drawGreenScreen(ctx, canvas.width, canvas.height, timestamp);
          }
        } catch (e) {
          // Fallback to green screen on error
          drawGreenScreen(ctx, canvas.width, canvas.height, timestamp);
        }
      } else {
        // Canvas mode - draw animated green screen
        drawGreenScreen(ctx, canvas.width, canvas.height, timestamp);
      }

      // If using TrackGenerators, push a frame into each generator.
      if (State.generators && State.generators.size > 0) {
        try {
          State.generators.forEach((entry) => {
            try {
              // VideoFrame can be constructed from a canvas in Chromium/WebView builds that support WebCodecs.
              const frame = new window.VideoFrame(canvas, { timestamp: Math.floor(timestamp * 1000) }); // microseconds-ish
              entry.writer.write(frame);
              frame.close();
            } catch (e) {
              // If any generator fails, drop it to keep the render loop healthy.
              try {
                entry.track?.stop?.();
              } catch {}
              try {
                State.generators.delete(entry);
              } catch {}
            }
          });
        } catch (e) {
          // Never let generator failures break the render loop.
        }
      }
      
      State.animationFrameId = requestAnimationFrame(render);
    }
    
    State.animationFrameId = requestAnimationFrame(render);
    log('Render loop started at', CONFIG.TARGET_FPS, 'FPS');
  }
  
  function drawGreenScreen(ctx, width, height, timestamp) {
    const t = timestamp / 1000;
    
    // Animated gradient for more realistic appearance
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    const offset = Math.sin(t * 0.5) * 10;
    
    gradient.addColorStop(0, 'rgb(0, ' + (255 + offset) + ', 0)');
    gradient.addColorStop(0.5, 'rgb(0, ' + (238 + offset) + ', 0)');
    gradient.addColorStop(1, 'rgb(0, ' + (255 + offset) + ', 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Subtle noise without readbacks (readbacks can stall captureStream/MediaRecorder).
    // Keep this extremely cheap to avoid starving the encoder.
    ctx.fillStyle = 'rgba(0,0,0,0.03)';
    for (let i = 0; i < 180; i++) {
      const x = (Math.random() * width) | 0;
      const y = (Math.random() * height) | 0;
      ctx.fillRect(x, y, 2, 2);
    }
  }
  
  // ============================================================================
  // STREAM CREATION
  // ============================================================================
  // Keep track of all created streams for cleanup
  const activeStreams = [];
  
  function getCanvasCaptureStream(canvas, fps) {
    if (!canvas) return null;
    const capture = canvas.captureStream || canvas.mozCaptureStream || canvas.webkitCaptureStream;
    if (!capture) return null;
    try {
      return capture.call(canvas, fps);
    } catch (e) {
      try {
        return capture.call(canvas);
      } catch (e2) {
        return null;
      }
    }
  }
  
  function getVideoCaptureStream(video, fps) {
    if (!video) return null;
    const capture = video.captureStream || video.mozCaptureStream || video.webkitCaptureStream;
    if (!capture) return null;
    try {
      return capture.call(video, fps);
    } catch (e) {
      try {
        return capture.call(video);
      } catch (e2) {
        return null;
      }
    }
  }
  
  function createInjectedStream(wantsAudio) {
    const canvas = State.canvasElement;
    if (!canvas) {
      error('Cannot create stream: canvas not initialized');
      return null;
    }
    
    try {
      // Preferred: MediaStreamTrackGenerator + VideoFrame (when available).
      // Fallback: captureStream from video/canvas.
      let stream = null;
      if (supportsTrackGenerator()) {
        try {
          const gen = new window.MediaStreamTrackGenerator({ kind: 'video' });
          const writer = gen.writable.getWriter();
          const track = gen;
          stream = new MediaStream([track]);
          State.generators.add({ track, writer });
          log('Using MediaStreamTrackGenerator pipeline');
        } catch (e) {
          stream = null;
        }
      }
      
      const canUseCanvas = State.capabilities.canvasCaptureStream;
      const canUseVideo = State.capabilities.videoCaptureStream && State.videoElement;
      
      if (!stream && State.mode === 'video' && canUseVideo) {
        stream = getVideoCaptureStream(State.videoElement, CONFIG.TARGET_FPS);
      }
      
      if (!stream && canUseCanvas) {
        stream = getCanvasCaptureStream(canvas, CONFIG.TARGET_FPS);
      }
      
      if (!stream && canUseVideo) {
        // Fallback to video capture if canvas capture failed
        stream = getVideoCaptureStream(State.videoElement, CONFIG.TARGET_FPS);
      }
      
      if (!stream) {
        State.unsupportedReason = 'captureStream not supported in this WebView';
        error('captureStream not supported');
        notifyUnsupported(State.unsupportedReason);
        return null;
      }
      
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length === 0) {
        error('No video tracks in captured stream');
        return null;
      }
      
      log('Stream created with', videoTracks.length, 'video track(s)');
      
      // Add silent audio only when requested.
      if (wantsAudio && CONFIG.AUDIO_ENABLED) {
        const audioTrack = createSilentAudioTrack();
        if (audioTrack) {
          stream.addTrack(audioTrack);
          log('Added audio track');
        }
      }
      
      // Store stream
      State.stream = stream;
      
      // Spoof track metadata
      spoofTrackMetadata(stream, State.lastConstraints);
      
      // Track this stream for cleanup
      activeStreams.push(stream);
      
      return stream;
    } catch (e) {
      error('Failed to create stream:', e);
      return null;
    }
  }
  
  function spoofTrackMetadata(stream, constraints) {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;
    
    const device = CONFIG.DEVICES.find(d => d.type === 'camera') || CONFIG.DEVICES[0];
    const trackId = 'track_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const facingMode = device?.facing === 'back' ? 'environment' : 'user';
    
    // CRITICAL: Spoof essential track properties for webcamtests.com compatibility
    try {
      Object.defineProperty(videoTrack, 'id', {
        get: () => trackId,
        configurable: true,
      });
    } catch (e) {}
    
    try {
      Object.defineProperty(videoTrack, 'kind', {
        get: () => 'video',
        configurable: true,
      });
    } catch (e) {}
    
    try {
      Object.defineProperty(videoTrack, 'readyState', {
        get: () => 'live',
        configurable: true,
      });
    } catch (e) {}
    
    try {
      Object.defineProperty(videoTrack, 'enabled', {
        get: () => true,
        set: () => {},
        configurable: true,
      });
    } catch (e) {}
    
    try {
      Object.defineProperty(videoTrack, 'muted', {
        get: () => false,
        configurable: true,
      });
    } catch (e) {}
    
    // Spoof getSettings
    videoTrack.getSettings = function() {
      return {
        width: CONFIG.TARGET_WIDTH,
        height: CONFIG.TARGET_HEIGHT,
        frameRate: CONFIG.TARGET_FPS,
        aspectRatio: CONFIG.TARGET_WIDTH / CONFIG.TARGET_HEIGHT,
        facingMode: facingMode,
        deviceId: device?.nativeDeviceId || device?.id || 'default',
        groupId: device?.groupId || 'default',
        resizeMode: 'none',
      };
    };
    
    // Spoof getCapabilities
    videoTrack.getCapabilities = function() {
      return {
        aspectRatio: { min: 0.5, max: 2.0 },
        deviceId: device?.nativeDeviceId || device?.id || 'default',
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
      return constraints?.video || {
        facingMode: facingMode,
        width: { ideal: CONFIG.TARGET_WIDTH },
        height: { ideal: CONFIG.TARGET_HEIGHT },
        deviceId: { exact: device?.nativeDeviceId || device?.id || 'default' },
      };
    };
    
    // Spoof applyConstraints
    videoTrack.applyConstraints = function() {
      return Promise.resolve();
    };
    
    // Spoof clone
    const originalClone = videoTrack.clone ? videoTrack.clone.bind(videoTrack) : null;
    videoTrack.clone = function() {
      return originalClone ? originalClone() : videoTrack;
    };
    
    // Spoof label
    try {
      Object.defineProperty(videoTrack, 'label', {
        get: () => device?.name || 'Camera',
        configurable: true,
      });
    } catch (e) {}
    
    log('Track metadata spoofed');
  }
  
  // ============================================================================
  // GETUSERMEDIA OVERRIDE - THE CRITICAL PART
  // ============================================================================
  
  function ensureMediaDevices() {
    let mediaDevices = navigator.mediaDevices;
    if (!mediaDevices) {
      mediaDevices = {};
      try {
        Object.defineProperty(navigator, 'mediaDevices', { value: mediaDevices, configurable: true });
      } catch (e) {
        try { navigator.mediaDevices = mediaDevices; } catch (e2) {}
      }
    }
    return mediaDevices || {};
  }
  
  const mediaDevices = ensureMediaDevices();
  
  // Store original
  const originalGetUserMedia = mediaDevices.getUserMedia ? mediaDevices.getUserMedia.bind(mediaDevices) : null;
  const originalEnumerateDevices = mediaDevices.enumerateDevices ? mediaDevices.enumerateDevices.bind(mediaDevices) : null;
  
  log('Original APIs:', {
    getUserMedia: !!originalGetUserMedia,
    enumerateDevices: !!originalEnumerateDevices,
  });
  
  // Override enumerateDevices
  mediaDevices.enumerateDevices = async function() {
    log('enumerateDevices called');
    
    if (CONFIG.STEALTH) {
      // Return spoofed devices
      const devices = CONFIG.DEVICES.map(d => {
        const info = {
          deviceId: d.nativeDeviceId || d.id || 'default',
          groupId: d.groupId || 'default',
          kind: d.type === 'camera' ? 'videoinput' : 'audioinput',
          label: d.name || (d.type === 'camera' ? 'Camera' : 'Microphone'),
          toJSON: function() { return this; }
        };
        try {
          if (typeof MediaDeviceInfo !== 'undefined') {
            Object.setPrototypeOf(info, MediaDeviceInfo.prototype);
          }
        } catch (e) {}
        return info;
      });
      
      log('Returning', devices.length, 'spoofed devices');
      return devices;
    }
    
    // Fall back to real devices
    if (originalEnumerateDevices) {
      return originalEnumerateDevices();
    }
    
    return [];
  };
  
  // Override getUserMedia - THIS IS THE KEY FUNCTION
  mediaDevices.getUserMedia = async function(constraints) {
    log('getUserMedia called with constraints:', JSON.stringify(constraints));
    
    const wantsVideo = !!(constraints && constraints.video);
    const wantsAudio = !!(constraints && constraints.audio);
    State.lastConstraints = constraints || null;
    
    log('Wants video:', wantsVideo, '| Wants audio:', wantsAudio);
    
    if (!wantsVideo) {
      // Audio only - pass through to real getUserMedia if available
      if (originalGetUserMedia && !CONFIG.STEALTH) {
        log('Audio-only request, passing through');
        return originalGetUserMedia(constraints);
      }
      
      // Create silent audio stream
      log('Creating silent audio stream');
      const audioTrack = createSilentAudioTrack();
      if (audioTrack) {
        const stream = new MediaStream([audioTrack]);
        return stream;
      }
      
      throw new DOMException('Audio not available', 'NotFoundError');
    }
    
    if (wantsVideo && State.unsupportedReason) {
      error('Injection not supported:', State.unsupportedReason);
      if (typeof window.__nativeMediaBridgeRequest === 'function') {
        log('Attempting native bridge fallback for video');
        try {
          const nativeStream = await window.__nativeMediaBridgeRequest(constraints);
          if (nativeStream) {
            spoofTrackMetadata(nativeStream, constraints);
            return nativeStream;
          }
        } catch (e) {
          error('Native bridge fallback failed:', e);
        }
      }
      if (!CONFIG.STEALTH && originalGetUserMedia) {
        log('Falling back to real getUserMedia due to unsupported injection');
        return originalGetUserMedia(constraints);
      }
      throw new DOMException(State.unsupportedReason, 'NotSupportedError');
    }
    
    // Video requested - ALWAYS create a fresh stream
    log('Video requested, creating fresh stream');
    
    // Ensure we're initialized (canvas and render loop running)
    if (!State.ready) {
      log('Not ready yet, initializing now...');
      await initializeSync();
    }
    
    // IMPORTANT: Create a fresh stream per call (closer to real getUserMedia),
    // and wait a tick so the canvas has rendered at least one frame before recording starts.
    await new Promise((resolve) => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => resolve());
      } else {
        setTimeout(resolve, 0);
      }
    });
    
    log('Creating stream on demand...');
    let stream = createInjectedStream(wantsAudio);
    if (!stream) {
      error('Failed to create stream');
      if (State.unsupportedReason) {
        throw new DOMException(State.unsupportedReason, 'NotSupportedError');
      }
      throw new DOMException('Could not start video source', 'NotReadableError');
    }
    
    // Verify the track is live
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      log('Track state:', videoTrack.readyState, '| enabled:', videoTrack.enabled);
      if (videoTrack.readyState !== 'live') {
        error('Track is not live, state:', videoTrack.readyState);
        // Try one more time
        const retryStream = createInjectedStream(wantsAudio);
        if (retryStream && retryStream.getVideoTracks()[0]?.readyState === 'live') {
          log('Retry succeeded');
          stream = retryStream;
        } else {
          throw new DOMException('Could not start video source', 'NotReadableError');
        }
      }
    }
    
    log('Returning stream with', stream.getTracks().length, 'tracks');
    return stream;
  };
  
  // Expose injected handlers for early overrides/debugging
  try {
    mediaDevices._originalGetUserMedia = originalGetUserMedia;
    mediaDevices._injectedGetUserMedia = mediaDevices.getUserMedia;
  } catch (e) {}
  
  // Watchdog to restore overrides if replaced
  const overrideEnumerateDevices = mediaDevices.enumerateDevices;
  const overrideGetUserMedia = mediaDevices.getUserMedia;
  const overrideWatchdog = setInterval(function() {
    try {
      if (navigator.mediaDevices) {
        if (navigator.mediaDevices.enumerateDevices !== overrideEnumerateDevices) {
          navigator.mediaDevices.enumerateDevices = overrideEnumerateDevices;
          log('enumerateDevices override restored');
        }
        if (navigator.mediaDevices.getUserMedia !== overrideGetUserMedia) {
          navigator.mediaDevices.getUserMedia = overrideGetUserMedia;
          log('getUserMedia override restored');
        }
      }
    } catch (e) {}
  }, 2000);
  
  // Expose config updater for RN bridge compatibility
  window.__updateMediaConfig = function(config) {
    updateConfig(config);
    log('Config updated - devices:', CONFIG.DEVICES.length);
  };
  window.__mediaInjectorInitialized = true;
  
  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  async function initializeSync() {
    if (State.ready) return;
    
    log('Initializing injection system...');
    
    // Always initialize canvas (fallback)
    const canvasOk = initCanvasStream();
    if (!canvasOk) {
      error('Canvas initialization failed - injection may not work');
      return;
    }
    
    // Try to load video if URI provided
    if (CONFIG.VIDEO_URI) {
      const videoOk = await initVideoStream();
      if (videoOk) {
        log('Video loaded successfully, using video mode');
        State.mode = 'video';
      } else {
        log('Video failed to load, using canvas mode');
        State.mode = 'canvas';
      }
    }
    
    // Start rendering
    startRenderLoop();
    
    State.ready = true;
    log('Initialization complete - mode:', State.mode);
  }
  
  // Start initialization immediately
  initializeSync().then(() => {
    log('========================================');
    log('WORKING VIDEO INJECTION - READY');
    log('Mode:', State.mode);
    log('Stream:', State.stream ? 'AVAILABLE' : 'NOT YET');
    log('========================================');
    
    // Notify React Native
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'workingInjectionReady',
        payload: {
          mode: State.mode,
          videoLoaded: State.videoLoaded,
          streamReady: !!State.stream,
          unsupportedReason: State.unsupportedReason,
          capabilities: State.capabilities,
        },
      }));
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'mediaInjectionReady',
        payload: {
          protocol: 'working',
          source: 'working',
          fallback: CONFIG.VIDEO_URI,
          forceSimulation: true,
          timestamp: Date.now(),
          unsupportedReason: State.unsupportedReason,
          capabilities: State.capabilities,
        },
      }));
    }
  }).catch(err => {
    error('Initialization error:', err);
  });
  
  // Export API for debugging
  window.__workingInjection = {
    getState: () => State,
    getStream: () => State.stream,
    reinitialize: () => initializeSync(),
    destroy: () => {
      try {
        if (State.animationFrameId) {
          cancelAnimationFrame(State.animationFrameId);
          State.animationFrameId = null;
        }
      } catch (e) {}
      
      try {
        if (State.stream) {
          State.stream.getTracks().forEach(t => {
            try { t.stop(); } catch (e) {}
          });
        }
      } catch (e) {}
      
      try {
        if (State.videoElement) {
          try { State.videoElement.pause(); } catch (e) {}
          try { State.videoElement.remove(); } catch (e) {}
        }
      } catch (e) {}
      
      try {
        if (State.canvasElement) {
          try { State.canvasElement.remove(); } catch (e) {}
        }
      } catch (e) {}
      
      State.ready = false;
      State.videoElement = null;
      State.canvasElement = null;
      State.canvasContext = null;
      State.stream = null;
      State.videoLoaded = false;
      State.mode = 'canvas';
      
      try { window.__workingInjectionActive = false; } catch (e) {}
      try { delete window.__workingInjection; } catch (e) {}
    },
    updateConfig: (config) => updateConfig(config),
  };
  
})();
true;
`;
}
