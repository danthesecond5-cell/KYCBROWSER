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
    return;
  }
  window.__workingInjectionActive = true;
  
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
  
  const log = CONFIG.DEBUG 
    ? (...args) => console.log('[WorkingInject]', ...args)
    : () => {};
  const error = (...args) => console.error('[WorkingInject]', ...args);
  
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
    captureSupported: null,
  };

  function postStatus(type, payload) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload }));
      }
    } catch (e) {}
  }

  function safeDefine(target, prop, value) {
    if (!target) return false;
    try {
      Object.defineProperty(target, prop, {
        configurable: true,
        writable: true,
        value,
      });
      return true;
    } catch (e) {
      try {
        target[prop] = value;
        return true;
      } catch (e2) {
        return false;
      }
    }
  }
  
  // ============================================================================
  // SILENT AUDIO GENERATOR
  // ============================================================================
  
  function createSilentAudioTrack() {
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
        return audioTracks[0];
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
      
      const ctx = canvas.getContext('2d', { 
        alpha: false,
        desynchronized: true,
        willReadFrequently: false 
      });
      
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
    
    // Add subtle noise for realism
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Only add noise to every 10th pixel for performance
    for (let i = 0; i < data.length; i += 40) {
      const noise = (Math.random() - 0.5) * 10;
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    }
    
    ctx.putImageData(imageData, 0, 0);
  }
  
  // ============================================================================
  // STREAM CREATION
  // ============================================================================
  
  function createInjectedStream() {
    const canvas = State.canvasElement;
    if (!canvas) {
      error('Cannot create stream: canvas not initialized');
      return null;
    }
    
    try {
      // Create video stream from canvas
      let stream;
      const captureFn = canvas.captureStream || canvas.mozCaptureStream || canvas.webkitCaptureStream;
      if (!captureFn) {
        State.captureSupported = false;
        error('captureStream not supported');
        postStatus('videoError', {
          error: {
            message: 'Canvas captureStream not supported in this WebView',
            solution: 'This environment cannot generate a fake camera stream via JS injection.'
          }
        });
        return null;
      }
      State.captureSupported = true;
      stream = captureFn.call(canvas, CONFIG.TARGET_FPS);
      
      if (!stream) {
        error('captureStream returned null');
        return null;
      }
      
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length === 0) {
        error('No video tracks in captured stream');
        return null;
      }
      
      log('Stream created with', videoTracks.length, 'video track(s)');
      
      // Add silent audio if enabled
      if (CONFIG.AUDIO_ENABLED) {
        const audioTrack = createSilentAudioTrack();
        if (audioTrack) {
          stream.addTrack(audioTrack);
          log('Added audio track');
        }
      }
      
      // Store stream
      State.stream = stream;
      
      // Spoof track metadata
      spoofTrackMetadata(stream);
      
      return stream;
    } catch (e) {
      error('Failed to create stream:', e);
      return null;
    }
  }
  
  function spoofTrackMetadata(stream) {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;
    
    const device = CONFIG.DEVICES.find(d => d.type === 'camera') || CONFIG.DEVICES[0];
    
    // Spoof getSettings
    const originalGetSettings = videoTrack.getSettings?.bind(videoTrack);
    if (videoTrack.getSettings) {
      videoTrack.getSettings = function() {
        return {
          width: CONFIG.TARGET_WIDTH,
          height: CONFIG.TARGET_HEIGHT,
          frameRate: CONFIG.TARGET_FPS,
          aspectRatio: CONFIG.TARGET_WIDTH / CONFIG.TARGET_HEIGHT,
          facingMode: device?.facing === 'back' ? 'environment' : 'user',
          deviceId: device?.nativeDeviceId || device?.id || 'default',
          groupId: device?.groupId || 'default',
          resizeMode: 'none',
        };
      };
    }
    
    // Spoof getCapabilities
    if (!videoTrack.getCapabilities) {
      videoTrack.getCapabilities = function() {
        return {
          aspectRatio: { min: 0.5, max: 2.0 },
          deviceId: device?.nativeDeviceId || device?.id || 'default',
          facingMode: [device?.facing === 'back' ? 'environment' : 'user'],
          frameRate: { min: 1, max: 60 },
          groupId: device?.groupId || 'default',
          height: { min: 1, max: 4320 },
          width: { min: 1, max: 7680 },
          resizeMode: ['none', 'crop-and-scale'],
        };
      };
    }
    
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
  
  let mediaDevices = navigator.mediaDevices;
  if (!mediaDevices) {
    try {
      Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true });
    } catch (e) {
      try { navigator.mediaDevices = {}; } catch (e2) {}
    }
    mediaDevices = navigator.mediaDevices || {};
  }

  // Store original
  const originalGetUserMedia = mediaDevices.getUserMedia ? mediaDevices.getUserMedia.bind(mediaDevices) : null;
  const originalEnumerateDevices = mediaDevices.enumerateDevices ? mediaDevices.enumerateDevices.bind(mediaDevices) : null;

  // Permission API spoofing (camera/microphone = granted)
  try {
    if (navigator.permissions && typeof navigator.permissions.query === 'function') {
      const originalQuery = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = async function(permissionDesc) {
        try {
          const result = await originalQuery(permissionDesc);
          if (permissionDesc && (permissionDesc.name === 'camera' || permissionDesc.name === 'microphone')) {
            return {
              state: 'granted',
              name: permissionDesc.name,
              onchange: null,
              addEventListener: result.addEventListener?.bind(result),
              removeEventListener: result.removeEventListener?.bind(result),
              dispatchEvent: result.dispatchEvent?.bind(result)
            };
          }
          return result;
        } catch (e) {
          return { state: 'granted', name: permissionDesc?.name || 'camera', onchange: null };
        }
      };
    }
  } catch (e) {}

  // Override enumerateDevices
  const overrideEnumerateDevices = async function() {
    log('enumerateDevices called');
    
    if (CONFIG.STEALTH) {
      // Return spoofed devices
      const devices = CONFIG.DEVICES.map(d => ({
        deviceId: d.nativeDeviceId || d.id || 'default',
        groupId: d.groupId || 'default',
        kind: d.type === 'camera' ? 'videoinput' : 'audioinput',
        label: d.name || (d.type === 'camera' ? 'Camera' : 'Microphone'),
        toJSON: function() { return this; }
      }));
      
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
  const overrideGetUserMedia = async function(constraints) {
    log('getUserMedia called with constraints:', JSON.stringify(constraints));
    
    const wantsVideo = !!(constraints && constraints.video);
    const wantsAudio = !!(constraints && constraints.audio);
    
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
    
    // Video requested - return our injected stream
    log('Video requested, returning injected stream');
    
    // Ensure we're initialized
    if (!State.ready) {
      log('Not ready yet, initializing now...');
      await initializeSync();
    }
    
    // Try to create stream if not already created
    if (!State.stream) {
      log('Creating stream on demand...');
      const stream = createInjectedStream();
      if (!stream) {
        error('Failed to create stream');
        throw new DOMException('Could not start video source', 'NotReadableError');
      }
    }
    
    // Return the stream
    log('Returning stream with', State.stream.getTracks().length, 'tracks');
    return State.stream;
  };

  const enumerateApplied = safeDefine(mediaDevices, 'enumerateDevices', overrideEnumerateDevices);
  const gumApplied = safeDefine(mediaDevices, 'getUserMedia', overrideGetUserMedia);

  if (window.MediaDevices && window.MediaDevices.prototype) {
    if (!enumerateApplied) {
      safeDefine(window.MediaDevices.prototype, 'enumerateDevices', overrideEnumerateDevices);
    }
    if (!gumApplied) {
      safeDefine(window.MediaDevices.prototype, 'getUserMedia', overrideGetUserMedia);
    }
  }

  // Legacy getUserMedia shims
  const legacyGetUserMedia = function(constraints, successCb, errorCb) {
    overrideGetUserMedia(constraints).then(successCb).catch(errorCb);
  };
  safeDefine(navigator, 'getUserMedia', legacyGetUserMedia);
  safeDefine(navigator, 'webkitGetUserMedia', legacyGetUserMedia);
  safeDefine(navigator, 'mozGetUserMedia', legacyGetUserMedia);

  window.__workingInjectionStatus = {
    getUserMediaOverridden: gumApplied,
    enumerateDevicesOverridden: enumerateApplied,
    captureStreamSupported: State.captureSupported,
  };
  
  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  function cleanupState() {
    if (State.animationFrameId) {
      cancelAnimationFrame(State.animationFrameId);
      State.animationFrameId = null;
    }
    if (State.stream) {
      try {
        State.stream.getTracks().forEach(t => t.stop());
      } catch (e) {}
    }
    if (State.videoElement && State.videoElement.parentNode) {
      try { State.videoElement.parentNode.removeChild(State.videoElement); } catch (e) {}
    }
    if (State.canvasElement && State.canvasElement.parentNode) {
      try { State.canvasElement.parentNode.removeChild(State.canvasElement); } catch (e) {}
    }
    State.videoElement = null;
    State.canvasElement = null;
    State.canvasContext = null;
    State.stream = null;
    State.videoLoaded = false;
    State.mode = 'canvas';
    State.captureSupported = null;
    State.ready = false;
  }

  function resolveVideoUriFromConfig(config) {
    if (!config || typeof config !== 'object') return undefined;
    if (config.videoUri !== undefined) return config.videoUri;
    const devices = Array.isArray(config.devices) ? config.devices : [];
    const primaryDevice =
      devices.find(d => d.type === 'camera' && d.simulationEnabled) ||
      devices.find(d => d.type === 'camera') ||
      devices[0];
    return primaryDevice?.assignedVideoUri || config.fallbackVideoUri || null;
  }

  async function initializeSync(force) {
    if (State.ready && !force) return;
    if (force) {
      cleanupState();
    }

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
    
    // Create initial stream
    const stream = createInjectedStream();
    if (stream) {
      log('Initial stream created successfully');
    } else {
      error('Failed to create initial stream');
    }
    
    State.ready = true;
    log('Initialization complete - mode:', State.mode);
  }

  function updateConfig(newConfig) {
    if (!newConfig || typeof newConfig !== 'object') return;

    const prevVideoUri = CONFIG.VIDEO_URI;
    const prevWidth = CONFIG.TARGET_WIDTH;
    const prevHeight = CONFIG.TARGET_HEIGHT;
    const prevFps = CONFIG.TARGET_FPS;

    if (typeof newConfig.stealthMode === 'boolean') CONFIG.STEALTH = newConfig.stealthMode;
    if (typeof newConfig.debugEnabled === 'boolean') CONFIG.DEBUG = newConfig.debugEnabled;
    if (Array.isArray(newConfig.devices)) CONFIG.DEVICES = newConfig.devices;
    if (typeof newConfig.targetWidth === 'number') CONFIG.TARGET_WIDTH = newConfig.targetWidth;
    if (typeof newConfig.targetHeight === 'number') CONFIG.TARGET_HEIGHT = newConfig.targetHeight;
    if (typeof newConfig.targetFPS === 'number') CONFIG.TARGET_FPS = newConfig.targetFPS;

    const nextVideoUri = resolveVideoUriFromConfig(newConfig);
    if (nextVideoUri !== undefined) {
      CONFIG.VIDEO_URI = nextVideoUri;
    }

    const needsRestart =
      prevVideoUri !== CONFIG.VIDEO_URI ||
      prevWidth !== CONFIG.TARGET_WIDTH ||
      prevHeight !== CONFIG.TARGET_HEIGHT ||
      prevFps !== CONFIG.TARGET_FPS ||
      Array.isArray(newConfig.devices);

    if (needsRestart) {
      log('Config updated, reinitializing injection');
      initializeSync(true);
    }
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
          captureStreamSupported: State.captureSupported,
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
    reinitialize: () => initializeSync(true),
    updateConfig: (config) => updateConfig(config),
  };

  // Align with legacy injector update flow
  window.__updateMediaConfig = function(config) {
    updateConfig(config);
  };
  window.__mediaInjectorInitialized = true;
  
})();
true;
`;
}
