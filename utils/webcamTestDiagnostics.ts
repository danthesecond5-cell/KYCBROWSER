/**
 * Webcam Test Site Diagnostics
 * 
 * Utilities to test and diagnose injection on sites like https://webcamtests.com/recorder
 */

export interface DiagnosticResult {
  timestamp: string;
  url: string;
  success: boolean;
  environment: {
    isWebView: boolean;
    userAgent: string;
    platform: string;
    vendor: string;
  };
  apiAvailable: {
    mediaDevices: boolean;
    getUserMedia: boolean;
    enumerateDevices: boolean;
    captureStream: boolean;
    canvasCaptureStream: boolean;
    audioContext: boolean;
    mediaRecorder: boolean;
  };
  injection: {
    detected: boolean;
    method: string | null;
    details: any;
  };
  testResults: {
    enumerateDevices?: {
      success: boolean;
      deviceCount: number;
      videoDeviceCount: number;
      devices: any[];
    };
    getUserMedia?: {
      success: boolean;
      streamObtained: boolean;
      trackCount: number;
      videoTrackInfo: any | null;
      error: string | null;
    };
    mediaRecorder?: {
      available: boolean;
      canRecordStream: boolean;
      recordedBytes: number;
      error: string | null;
    };
  };
  errors: string[];
  warnings: string[];
}

/**
 * Create a comprehensive diagnostic script that can be injected
 * to test all aspects of media injection on a live site
 */
export const createDiagnosticScript = (): string => {
  return `
(function() {
  if (window.__webcamTestDiagnostics) {
    console.log('[Diagnostics] Already initialized');
    return window.__webcamTestDiagnostics;
  }
  
  console.log('[Diagnostics] ================================================');
  console.log('[Diagnostics] WEBCAM INJECTION DIAGNOSTICS INITIALIZING');
  console.log('[Diagnostics] ================================================');
  
  const results = {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    success: false,
    environment: {
      isWebView: false,
      userAgent: '',
      platform: '',
      vendor: '',
    },
    apiAvailable: {
      mediaDevices: false,
      getUserMedia: false,
      enumerateDevices: false,
      captureStream: false,
      canvasCaptureStream: false,
      audioContext: false,
      mediaRecorder: false,
    },
    injection: {
      detected: false,
      method: null,
      details: {},
    },
    testResults: {},
    errors: [],
    warnings: [],
  };
  
  // Detect environment
  try {
    results.environment.userAgent = navigator.userAgent || '';
    results.environment.platform = navigator.platform || '';
    results.environment.vendor = navigator.vendor || '';
    results.environment.isWebView = navigator.userAgent.includes('WebView') || 
                                     navigator.userAgent.includes('wv') ||
                                     !!window.ReactNativeWebView;
    
    console.log('[Diagnostics] Environment Detection:');
    console.log('[Diagnostics]   Is WebView:', results.environment.isWebView);
    console.log('[Diagnostics]   User Agent:', results.environment.userAgent);
    console.log('[Diagnostics]   Platform:', results.environment.platform);
  } catch (e) {
    results.warnings.push('Environment detection failed: ' + e.message);
  }
  
  // Check API availability
  try {
    results.apiAvailable.mediaDevices = typeof navigator !== 'undefined' && !!navigator.mediaDevices;
    results.apiAvailable.getUserMedia = results.apiAvailable.mediaDevices && 
      typeof navigator.mediaDevices.getUserMedia === 'function';
    results.apiAvailable.enumerateDevices = results.apiAvailable.mediaDevices && 
      typeof navigator.mediaDevices.enumerateDevices === 'function';
    results.apiAvailable.captureStream = typeof HTMLCanvasElement !== 'undefined' &&
      HTMLCanvasElement.prototype &&
      !!(HTMLCanvasElement.prototype.captureStream || 
         HTMLCanvasElement.prototype.mozCaptureStream || 
         HTMLCanvasElement.prototype.webkitCaptureStream);
    results.apiAvailable.canvasCaptureStream = results.apiAvailable.captureStream;
    results.apiAvailable.audioContext = !!(window.AudioContext || window.webkitAudioContext);
    results.apiAvailable.mediaRecorder = typeof MediaRecorder !== 'undefined';
    
    console.log('[Diagnostics] API Availability:');
    console.log('[Diagnostics]   mediaDevices:', results.apiAvailable.mediaDevices);
    console.log('[Diagnostics]   getUserMedia:', results.apiAvailable.getUserMedia);
    console.log('[Diagnostics]   enumerateDevices:', results.apiAvailable.enumerateDevices);
    console.log('[Diagnostics]   captureStream:', results.apiAvailable.captureStream);
    console.log('[Diagnostics]   AudioContext:', results.apiAvailable.audioContext);
    console.log('[Diagnostics]   MediaRecorder:', results.apiAvailable.mediaRecorder);
    
    // Detailed canvas captureStream check
    if (typeof HTMLCanvasElement !== 'undefined') {
      const canvas = document.createElement('canvas');
      const hasCaptureStream = typeof canvas.captureStream === 'function';
      const hasMozCaptureStream = typeof canvas.mozCaptureStream === 'function';
      const hasWebkitCaptureStream = typeof canvas.webkitCaptureStream === 'function';
      console.log('[Diagnostics] Canvas methods:', {
        captureStream: hasCaptureStream,
        mozCaptureStream: hasMozCaptureStream,
        webkitCaptureStream: hasWebkitCaptureStream,
      });
    }
  } catch (e) {
    results.errors.push('API check failed: ' + e.message);
  }
  
  // Detect injection methods
  try {
    if (window.__mediaInjectorInitialized) {
      results.injection.detected = true;
      results.injection.method = 'Standard Media Injector';
      results.injection.details = {
        config: window.__mediaSimConfig || null,
        hasUpdateFunction: typeof window.__updateMediaConfig === 'function',
      };
    }
    
    if (window.__bulletproofActive) {
      results.injection.detected = true;
      results.injection.method = 'Bulletproof Injection';
      results.injection.details = {
        config: window.__bulletproofConfig?.getStatus?.() || null,
      };
    }
    
    if (window.__advancedProtocol2Initialized) {
      results.injection.detected = true;
      results.injection.method = 'Advanced Protocol 2';
      results.injection.details = {
        state: window.__advancedProtocol2State || null,
      };
    }
    
    if (window.__sonnetProtocolInitialized) {
      results.injection.detected = true;
      results.injection.method = 'Sonnet Protocol';
      results.injection.details = {
        api: window.__sonnetProtocol || null,
      };
    }
    
    console.log('[Diagnostics] Injection Detection:', results.injection);
  } catch (e) {
    results.errors.push('Injection detection failed: ' + e.message);
  }
  
  // Test enumerateDevices
  async function testEnumerateDevices() {
    console.log('[Diagnostics] Testing enumerateDevices...');
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      
      results.testResults.enumerateDevices = {
        success: true,
        deviceCount: devices.length,
        videoDeviceCount: videoDevices.length,
        devices: devices.map(d => ({
          kind: d.kind,
          label: d.label,
          deviceId: d.deviceId ? d.deviceId.substring(0, 20) + '...' : '',
        })),
      };
      
      console.log('[Diagnostics] ✓ enumerateDevices successful');
      console.log('[Diagnostics]   Total devices:', devices.length);
      console.log('[Diagnostics]   Video devices:', videoDevices.length);
      
      return true;
    } catch (e) {
      results.testResults.enumerateDevices = {
        success: false,
        deviceCount: 0,
        videoDeviceCount: 0,
        devices: [],
      };
      results.errors.push('enumerateDevices failed: ' + e.message);
      console.error('[Diagnostics] ✗ enumerateDevices failed:', e);
      return false;
    }
  }
  
  // Test getUserMedia
  async function testGetUserMedia() {
    console.log('[Diagnostics] Testing getUserMedia...');
    try {
      const constraints = {
        video: {
          width: { ideal: 1080 },
          height: { ideal: 1920 },
          facingMode: 'user',
        },
        audio: true,
      };
      
      console.log('[Diagnostics] Requesting stream with constraints:', JSON.stringify(constraints));
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      let videoTrackInfo = null;
      
      if (videoTracks.length > 0) {
        const track = videoTracks[0];
        const settings = track.getSettings ? track.getSettings() : {};
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
        videoTrackInfo = {
          label: track.label,
          id: track.id ? track.id.substring(0, 20) + '...' : '',
          kind: track.kind,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          settings: settings,
          hasCapabilities: !!track.getCapabilities,
          hasConstraints: !!track.getConstraints,
        };
      }
      
      results.testResults.getUserMedia = {
        success: true,
        streamObtained: true,
        trackCount: stream.getTracks().length,
        videoTrackInfo: videoTrackInfo,
        error: null,
      };
      
      console.log('[Diagnostics] ✓ getUserMedia successful');
      console.log('[Diagnostics]   Total tracks:', stream.getTracks().length);
      console.log('[Diagnostics]   Video tracks:', videoTracks.length);
      console.log('[Diagnostics]   Audio tracks:', audioTracks.length);
      if (videoTrackInfo) {
        console.log('[Diagnostics]   Video track details:', videoTrackInfo);
      }
      
      // Test MediaRecorder if available
      if (typeof MediaRecorder !== 'undefined') {
        await testMediaRecorder(stream);
      } else {
        console.warn('[Diagnostics] MediaRecorder not available');
        results.warnings.push('MediaRecorder not available');
      }
      
      // Clean up
      stream.getTracks().forEach(t => t.stop());
      
      return true;
    } catch (e) {
      results.testResults.getUserMedia = {
        success: false,
        streamObtained: false,
        trackCount: 0,
        videoTrackInfo: null,
        error: e.message,
      };
      results.errors.push('getUserMedia failed: ' + e.message);
      console.error('[Diagnostics] ✗ getUserMedia failed:', e);
      return false;
    }
  }
  
  // Test MediaRecorder
  async function testMediaRecorder(stream) {
    console.log('[Diagnostics] Testing MediaRecorder...');
    try {
      const chunks = [];
      const recorder = new MediaRecorder(stream);
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn('[Diagnostics] MediaRecorder test timeout');
          results.warnings.push('MediaRecorder test timeout');
          resolve();
        }, 2000);
        
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunks.push(e.data);
            console.log('[Diagnostics] Recorded chunk:', e.data.size, 'bytes');
          }
        };
        
        recorder.onstop = () => {
          clearTimeout(timeout);
          const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
          const totalBytes = blob.size;
          
          results.testResults.mediaRecorder = {
            available: true,
            canRecordStream: totalBytes > 0,
            recordedBytes: totalBytes,
            error: null,
          };
          
          if (totalBytes > 0) {
            console.log('[Diagnostics] ✓ MediaRecorder successful - recorded', totalBytes, 'bytes');
          } else {
            console.warn('[Diagnostics] ⚠ MediaRecorder recorded 0 bytes');
            results.warnings.push('MediaRecorder recorded 0 bytes');
          }
          
          resolve();
        };
        
        recorder.onerror = (e) => {
          clearTimeout(timeout);
          const errorMsg = e.error ? e.error.message : 'Unknown error';
          results.testResults.mediaRecorder = {
            available: true,
            canRecordStream: false,
            recordedBytes: 0,
            error: errorMsg,
          };
          results.errors.push('MediaRecorder error: ' + errorMsg);
          console.error('[Diagnostics] ✗ MediaRecorder failed:', errorMsg);
          resolve();
        };
        
        try {
          recorder.start();
          console.log('[Diagnostics] MediaRecorder started');
          setTimeout(() => {
            if (recorder.state === 'recording') {
              recorder.stop();
              console.log('[Diagnostics] MediaRecorder stopped');
            }
          }, 1000);
        } catch (e) {
          clearTimeout(timeout);
          results.testResults.mediaRecorder = {
            available: true,
            canRecordStream: false,
            recordedBytes: 0,
            error: e.message,
          };
          results.errors.push('MediaRecorder start failed: ' + e.message);
          console.error('[Diagnostics] ✗ MediaRecorder start failed:', e);
          resolve();
        }
      });
    } catch (e) {
      results.testResults.mediaRecorder = {
        available: false,
        canRecordStream: false,
        recordedBytes: 0,
        error: e.message,
      };
      results.errors.push('MediaRecorder unavailable: ' + e.message);
      console.error('[Diagnostics] ✗ MediaRecorder unavailable:', e);
    }
  }
  
  // Run all tests
  async function runAllTests() {
    console.log('[Diagnostics] Running comprehensive tests...');
    
    if (!results.apiAvailable.mediaDevices) {
      results.errors.push('MediaDevices API not available');
      console.error('[Diagnostics] CRITICAL: MediaDevices API not available!');
      return results;
    }
    
    await testEnumerateDevices();
    await testGetUserMedia();
    
    results.success = results.errors.length === 0;
    
    console.log('[Diagnostics] ================================================');
    console.log('[Diagnostics] TEST COMPLETE');
    console.log('[Diagnostics] Success:', results.success);
    console.log('[Diagnostics] Errors:', results.errors.length);
    console.log('[Diagnostics] ================================================');
    
    // Send to React Native
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'diagnosticResults',
        payload: results,
      }));
    }
    
    return results;
  }
  
  // Public API
  window.__webcamTestDiagnostics = {
    results: results,
    runAllTests: runAllTests,
    testEnumerateDevices: testEnumerateDevices,
    testGetUserMedia: testGetUserMedia,
    getResults: function() { return results; },
  };
  
  console.log('[Diagnostics] Diagnostics ready. Run window.__webcamTestDiagnostics.runAllTests()');
  
  // Auto-run after a short delay
  setTimeout(function() {
    console.log('[Diagnostics] Auto-running tests in 1 second...');
    runAllTests();
  }, 1000);
  
  return window.__webcamTestDiagnostics;
})();
true;
`;
};

/**
 * Create a GUARANTEED working injection for webcamtests.com
 * This uses the most aggressive, earliest-possible interception
 * ENHANCED for React Native WebView environments
 */
export const createGuaranteedInjection = (): string => {
  return `
(function() {
  'use strict';
  
  // CRITICAL: Run before ANYTHING else
  if (window.__guaranteedInjection) {
    console.log('[Guaranteed] Already active');
    return;
  }
  window.__guaranteedInjection = true;
  
  console.log('[Guaranteed] ================================================');
  console.log('[Guaranteed] GUARANTEED INJECTION ACTIVATING');
  console.log('[Guaranteed] Target: webcamtests.com and all webcam test sites');
  console.log('[Guaranteed] Environment:', navigator.userAgent.includes('WebView') ? 'WebView' : 'Browser');
  console.log('[Guaranteed] ================================================');
  
  // Ensure mediaDevices exists (critical for WebView)
  if (!navigator.mediaDevices) {
    console.log('[Guaranteed] Creating navigator.mediaDevices');
    navigator.mediaDevices = {};
  }
  
  // Store original IMMEDIATELY
  const _origGUM = navigator.mediaDevices?.getUserMedia?.bind?.(navigator.mediaDevices);
  const _origEnum = navigator.mediaDevices?.enumerateDevices?.bind?.(navigator.mediaDevices);
  
  console.log('[Guaranteed] Original APIs captured:', {
    getUserMedia: !!_origGUM,
    enumerateDevices: !!_origEnum,
  });
  
  // Canvas and animation state
  let canvas = null;
  let ctx = null;
  let animationId = null;
  let frameCount = 0;
  let startTime = Date.now();
  
  // Configuration
  const CONFIG = {
    WIDTH: 1080,
    HEIGHT: 1920,
    FPS: 30,
  };
  
  // Initialize canvas
  function initCanvas() {
    if (canvas) return canvas;
    
    canvas = document.createElement('canvas');
    canvas.width = CONFIG.WIDTH;
    canvas.height = CONFIG.HEIGHT;
    ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    
    console.log('[Guaranteed] Canvas initialized:', CONFIG.WIDTH, 'x', CONFIG.HEIGHT);
    return canvas;
  }
  
  // Render animated frame
  function renderFrame() {
    if (!ctx) return;
    
    const w = CONFIG.WIDTH;
    const h = CONFIG.HEIGHT;
    const time = (Date.now() - startTime) / 1000;
    
    // Animated gradient background
    const hue = (time * 40) % 360;
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, \`hsl(\${hue}, 70%, 30%)\`);
    gradient.addColorStop(0.5, \`hsl(\${(hue + 120) % 360}, 70%, 20%)\`);
    gradient.addColorStop(1, \`hsl(\${(hue + 240) % 360}, 70%, 30%)\`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    
    // Moving circles
    for (let i = 0; i < 5; i++) {
      const angle = time * (1 + i * 0.3) + i;
      const radius = 40 + i * 20;
      const orbitRadius = 200 + i * 30;
      const x = w / 2 + Math.cos(angle) * orbitRadius;
      const y = h / 3 + Math.sin(angle * 0.8) * 100 + i * 60;
      
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = \`hsla(\${(hue + i * 60) % 360}, 80%, 60%, 0.9)\`;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    
    // Pulsing center indicator
    const pulse = 1 + Math.sin(time * 4) * 0.3;
    ctx.save();
    ctx.translate(w / 2, h * 0.65);
    ctx.scale(pulse, pulse);
    
    // Play triangle
    ctx.beginPath();
    ctx.moveTo(-50, -60);
    ctx.lineTo(-50, 60);
    ctx.lineTo(60, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();
    ctx.restore();
    
    // Status bar
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(10, h - 160, 550, 150);
    
    // Status text
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('✓ CAMERA INJECTED', 30, h - 120);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px monospace';
    ctx.fillText(\`Frame: \${String(frameCount).padStart(6, '0')}\`, 30, h - 85);
    ctx.fillText(\`Time: \${time.toFixed(1)}s\`, 320, h - 85);
    ctx.fillText(\`\${w}x\${h} @ \${CONFIG.FPS}fps\`, 30, h - 50);
    ctx.fillText('ACTIVE', 400, h - 50);
    
    // Scan line
    const scanY = (frameCount * 20) % h;
    ctx.fillStyle = 'rgba(0,255,136,0.5)';
    ctx.fillRect(0, scanY, w, 6);
    
    // Corner markers
    const cornerSize = 80;
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(0, 0, cornerSize, 8);
    ctx.fillRect(0, 0, 8, cornerSize);
    ctx.fillRect(w - cornerSize, 0, cornerSize, 8);
    ctx.fillRect(w - 8, 0, 8, cornerSize);
    ctx.fillRect(0, h - 8, cornerSize, 8);
    ctx.fillRect(0, h - cornerSize, 8, cornerSize);
    ctx.fillRect(w - cornerSize, h - 8, cornerSize, 8);
    ctx.fillRect(w - 8, h - cornerSize, 8, cornerSize);
    
    frameCount++;
  }
  
  // Animation loop
  function startAnimation() {
    if (animationId) return;
    
    function animate() {
      renderFrame();
      animationId = requestAnimationFrame(animate);
    }
    
    animate();
    console.log('[Guaranteed] Animation started');
  }
  
  // Create stream from canvas
  function createStream(constraints) {
    initCanvas();
    startAnimation();
    
    try {
      const captureStream = canvas.captureStream || 
                          canvas.mozCaptureStream || 
                          canvas.webkitCaptureStream;
      
      if (!captureStream) {
        throw new Error('captureStream not supported');
      }
      
      const stream = captureStream.call(canvas, CONFIG.FPS);
      
      if (!stream || stream.getVideoTracks().length === 0) {
        throw new Error('No video tracks in stream');
      }
      
      const videoTrack = stream.getVideoTracks()[0];
      
      // Spoof track metadata
      videoTrack.getSettings = function() {
        return {
          width: CONFIG.WIDTH,
          height: CONFIG.HEIGHT,
          frameRate: CONFIG.FPS,
          aspectRatio: CONFIG.WIDTH / CONFIG.HEIGHT,
          facingMode: 'user',
          deviceId: 'injected-camera-0',
          groupId: 'injected-group-0',
        };
      };
      
      videoTrack.getCapabilities = function() {
        return {
          width: { min: 1, max: CONFIG.WIDTH },
          height: { min: 1, max: CONFIG.HEIGHT },
          frameRate: { min: 1, max: CONFIG.FPS },
          facingMode: ['user'],
          deviceId: 'injected-camera-0',
        };
      };
      
      Object.defineProperty(videoTrack, 'label', {
        get: function() { return 'Injected Camera (1080x1920)'; },
        configurable: true,
      });
      
      // Add silent audio if requested
      if (constraints?.audio) {
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          const audioCtx = new AudioContext();
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          const destination = audioCtx.createMediaStreamDestination();
          
          gainNode.gain.value = 0;
          oscillator.connect(gainNode);
          gainNode.connect(destination);
          oscillator.start();
          
          destination.stream.getAudioTracks().forEach(t => stream.addTrack(t));
          console.log('[Guaranteed] Silent audio track added');
        } catch (e) {
          console.warn('[Guaranteed] Failed to add audio:', e);
        }
      }
      
      console.log('[Guaranteed] Stream created successfully');
      console.log('[Guaranteed]   Tracks:', stream.getTracks().length);
      console.log('[Guaranteed]   Video tracks:', stream.getVideoTracks().length);
      console.log('[Guaranteed]   Audio tracks:', stream.getAudioTracks().length);
      
      return stream;
      
    } catch (err) {
      console.error('[Guaranteed] Stream creation failed:', err);
      throw err;
    }
  }
  
  // OVERRIDE getUserMedia - AGGRESSIVELY WITH MULTIPLE METHODS
  
  // Method 1: Direct function replacement
  const newGetUserMedia = async function(constraints) {
    console.log('[Guaranteed] getUserMedia INTERCEPTED');
    console.log('[Guaranteed] Constraints:', JSON.stringify(constraints));
    
    // If video is requested, return our stream
    if (constraints?.video) {
      try {
        const stream = createStream(constraints);
        console.log('[Guaranteed] Returning injected stream');
        console.log('[Guaranteed] Stream has', stream.getTracks().length, 'tracks');
        return stream;
      } catch (err) {
        console.error('[Guaranteed] Injection failed:', err);
        if (_origGUM) {
          console.log('[Guaranteed] Falling back to original getUserMedia');
          return _origGUM(constraints);
        }
        throw err;
      }
    }
    
    // If only audio, try original
    if (_origGUM) {
      console.log('[Guaranteed] Audio only, using original');
      return _origGUM(constraints);
    }
    
    throw new DOMException('getUserMedia not available', 'NotSupportedError');
  };
  
  // Apply the override
  if (navigator.mediaDevices) {
    navigator.mediaDevices.getUserMedia = newGetUserMedia;
    
    // Method 2: Also try to lock it in place with defineProperty
    try {
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        value: newGetUserMedia,
        writable: true,  // Keep writable to avoid WebView errors
        configurable: true,
        enumerable: true,
      });
      console.log('[Guaranteed] getUserMedia locked with defineProperty');
    } catch (e) {
      console.warn('[Guaranteed] Could not use defineProperty:', e);
    }
    
    // Override enumerateDevices
    const newEnumerateDevices = async function() {
      console.log('[Guaranteed] enumerateDevices INTERCEPTED');
      
      const injectedDevices = [
        {
          deviceId: 'injected-camera-0',
          groupId: 'injected-group-0',
          kind: 'videoinput',
          label: 'Injected Camera (Front - 1080x1920)',
          toJSON: function() { return this; },
        },
        {
          deviceId: 'injected-camera-1',
          groupId: 'injected-group-0',
          kind: 'videoinput',
          label: 'Injected Camera (Back - 1080x1920)',
          toJSON: function() { return this; },
        },
        {
          deviceId: 'injected-audio-0',
          groupId: 'injected-group-0',
          kind: 'audioinput',
          label: 'Injected Microphone',
          toJSON: function() { return this; },
        },
      ];
      
      console.log('[Guaranteed] Returning', injectedDevices.length, 'injected devices');
      return injectedDevices;
    };
    
    navigator.mediaDevices.enumerateDevices = newEnumerateDevices;
    
    try {
      Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', {
        value: newEnumerateDevices,
        writable: true,
        configurable: true,
        enumerable: true,
      });
      console.log('[Guaranteed] enumerateDevices locked with defineProperty');
    } catch (e) {
      console.warn('[Guaranteed] Could not use defineProperty for enumerateDevices:', e);
    }
    
    console.log('[Guaranteed] navigator.mediaDevices methods overridden');
  } else {
    console.error('[Guaranteed] CRITICAL: navigator.mediaDevices not available!');
    console.error('[Guaranteed] This is a fatal error - injection cannot proceed');
  }
  
  // Protect against re-definition (but keep configurable for WebView compatibility)
  try {
    const originalToString = Function.prototype.toString;
    Function.prototype.toString = function() {
      if (this === navigator.mediaDevices?.getUserMedia ||
          this === navigator.mediaDevices?.enumerateDevices) {
        return 'function ' + (this.name || 'getUserMedia') + '() { [native code] }';
      }
      return originalToString.call(this);
    };
    console.log('[Guaranteed] Function.prototype.toString protected');
  } catch (e) {
    console.warn('[Guaranteed] Could not protect toString:', e);
  }
  
  // Also freeze the navigator object to prevent tampering (but catch errors)
  try {
    Object.preventExtensions(navigator.mediaDevices);
    console.log('[Guaranteed] navigator.mediaDevices protected from extensions');
  } catch (e) {
    console.warn('[Guaranteed] Could not prevent extensions:', e);
  }
  
  console.log('[Guaranteed] ================================================');
  console.log('[Guaranteed] GUARANTEED INJECTION ACTIVE');
  console.log('[Guaranteed] All getUserMedia calls will be intercepted');
  console.log('[Guaranteed] ================================================');
  
  // Expose status API
  window.__guaranteedInjectionStatus = {
    active: true,
    config: CONFIG,
    frameCount: function() { return frameCount; },
    isAnimating: function() { return !!animationId; },
  };
  
  // Notify React Native
  if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'guaranteedInjectionReady',
      config: CONFIG,
    }));
  }
})();
true;
`;
};
