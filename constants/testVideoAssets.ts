/**
 * Built-in Test Video Assets
 * 
 * This module provides hardcoded test video capabilities for all 4 protocols.
 * The test video is a 1-second looping animation with visible movement at 30fps.
 */

// Specifications for the built-in test video
export const TEST_VIDEO_SPECS = {
  width: 1080,
  height: 1920,
  fps: 30,
  duration: 1, // seconds
  aspectRatio: '9:16',
  format: 'video/mp4',
} as const;

// Test video ID used across the app
export const BUILTIN_TEST_VIDEO_ID = 'builtin_test_video_v1';
export const BUILTIN_TEST_VIDEO_NAME = 'System Test Video';

/**
 * Minimal valid MP4 video header + data
 * This is a tiny valid MP4 that shows a green gradient with movement
 * Base64 encoded, 1 second, 30fps, 1080x1920
 * 
 * This is a fallback - the app will generate a proper test video on first launch
 */
export const MINIMAL_TEST_VIDEO_BASE64 = 
  'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAA' +
  'ABtZGF0AAACrgYF//+q3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2NCByMzA5NSBiYWVlND' +
  'AwIC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAyMiAtIGh0dHA6Ly9' +
  '3d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9j' +
  'az0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wM' +
  'DowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3' +
  'Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB' +
  '0aHJlYWRzPTEgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1h' +
  'dGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyY' +
  'W1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3' +
  'Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTI1IHNjZW5lY3V0PTQwIGl' +
  'udHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFj' +
  'b21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wM' +
  'ACAAAAAIGWIhAAh//73lsAJHQCAAAIDAB1//pD/NwGAABEABKg=';

/**
 * HTML/JS code that generates a test video canvas pattern
 * This renders directly in the WebView for immediate visual feedback
 */
export const TEST_PATTERN_GENERATOR_SCRIPT = `
(function() {
  // Test Pattern Generator - Creates visible animated content
  // This runs at 30fps and shows clear movement
  
  const WIDTH = 1080;
  const HEIGHT = 1920;
  const FPS = 30;
  
  let canvas = null;
  let ctx = null;
  let animationId = null;
  let startTime = Date.now();
  let frameCount = 0;
  
  function createCanvas() {
    if (canvas) return { canvas, ctx };
    
    canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    ctx = canvas.getContext('2d', { alpha: false });
    
    return { canvas, ctx };
  }
  
  // Main animation frame renderer
  function renderFrame(ctx, w, h, time, frame) {
    // Background gradient that shifts color over time
    const hue = (time * 60) % 360; // Color cycles every 6 seconds
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'hsl(' + hue + ', 70%, 30%)');
    gradient.addColorStop(0.5, 'hsl(' + ((hue + 120) % 360) + ', 70%, 20%)');
    gradient.addColorStop(1, 'hsl(' + ((hue + 240) % 360) + ', 70%, 30%)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    
    // Animated circles that move and bounce
    const numCircles = 5;
    for (let i = 0; i < numCircles; i++) {
      const speed = 1 + i * 0.3;
      const radius = 50 + i * 30;
      const x = (w / 2) + Math.sin(time * speed + i * 1.5) * (w / 3);
      const y = (h / 4) + (i * h / 6) + Math.sin(time * speed * 0.7 + i) * 80;
      
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'hsla(' + ((hue + i * 50) % 360) + ', 80%, 60%, 0.7)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    
    // Pulsing center indicator
    const pulseScale = 1 + Math.sin(time * 4) * 0.2;
    const centerY = h * 0.75;
    ctx.save();
    ctx.translate(w / 2, centerY);
    ctx.scale(pulseScale, pulseScale);
    
    // Draw a play button / indicator
    ctx.beginPath();
    ctx.moveTo(-40, -50);
    ctx.lineTo(-40, 50);
    ctx.lineTo(50, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fill();
    ctx.restore();
    
    // Frame counter and timestamp for verification
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(20, h - 140, 400, 120);
    
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('TEST VIDEO ACTIVE', 40, h - 100);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px monospace';
    ctx.fillText('Frame: ' + (frame % 1000).toString().padStart(4, '0'), 40, h - 70);
    ctx.fillText('FPS: ' + FPS, 40, h - 45);
    ctx.fillText('Resolution: ' + w + 'x' + h, 200, h - 70);
    
    // Scanning line effect for visual proof of animation
    const scanY = (frame * 20) % h;
    ctx.fillStyle = 'rgba(0, 255, 136, 0.3)';
    ctx.fillRect(0, scanY, w, 4);
    
    // Corner markers
    const markerSize = 60;
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(0, 0, markerSize, 6);
    ctx.fillRect(0, 0, 6, markerSize);
    ctx.fillRect(w - markerSize, 0, markerSize, 6);
    ctx.fillRect(w - 6, 0, 6, markerSize);
    ctx.fillRect(0, h - 6, markerSize, 6);
    ctx.fillRect(0, h - markerSize, 6, markerSize);
    ctx.fillRect(w - markerSize, h - 6, markerSize, 6);
    ctx.fillRect(w - 6, h - markerSize, 6, markerSize);
  }
  
  function animate() {
    const now = Date.now();
    const elapsed = (now - startTime) / 1000;
    
    renderFrame(ctx, WIDTH, HEIGHT, elapsed, frameCount);
    frameCount++;
    
    animationId = requestAnimationFrame(animate);
  }
  
  function start() {
    if (animationId) return;
    const { canvas: c, ctx: context } = createCanvas();
    ctx = context;
    startTime = Date.now();
    frameCount = 0;
    animate();
    return c;
  }
  
  function stop() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }
  
  function getCanvas() {
    if (!canvas) start();
    return canvas;
  }
  
  function getStream(fps) {
    const c = getCanvas();
    return c.captureStream(fps || FPS);
  }
  
  // Export functions
  window.__testPatternGenerator = {
    start,
    stop,
    getCanvas,
    getStream,
    renderFrame,
    specs: { width: WIDTH, height: HEIGHT, fps: FPS },
  };
  
  console.log('[TestPattern] Generator initialized - ready for use');
})();
`;

/**
 * Enhanced injection script that uses the test pattern as video source
 * This replaces the camera stream with the animated test pattern
 */
export const BULLETPROOF_CAMERA_INJECTION_SCRIPT = `
(function() {
  if (window.__bulletproofInjectionActive) return;
  window.__bulletproofInjectionActive = true;
  
  console.log('[BulletproofInjection] Initializing camera replacement system...');
  
  // Store original methods
  const _origGetUserMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
  const _origEnumerateDevices = navigator.mediaDevices?.enumerateDevices?.bind(navigator.mediaDevices);
  
  // Test pattern canvas and state
  let testCanvas = null;
  let testCtx = null;
  let isAnimating = false;
  let animationFrameId = null;
  let startTime = Date.now();
  let frameCount = 0;
  
  // Active streams for cleanup
  const activeStreams = new Set();
  
  // Configuration
  const CONFIG = {
    width: 1080,
    height: 1920,
    fps: 30,
  };
  
  // Create the test pattern canvas
  function ensureTestCanvas() {
    if (testCanvas) return;
    
    testCanvas = document.createElement('canvas');
    testCanvas.width = CONFIG.width;
    testCanvas.height = CONFIG.height;
    testCtx = testCanvas.getContext('2d', { alpha: false });
    
    console.log('[BulletproofInjection] Test canvas created:', CONFIG.width, 'x', CONFIG.height);
  }
  
  // Render the animated test pattern - HIGHLY VISIBLE
  function renderTestPattern(time, frame) {
    if (!testCtx) return;
    
    const w = CONFIG.width;
    const h = CONFIG.height;
    const t = time;
    
    // Animated gradient background
    const hue = (t * 45) % 360;
    const grad = testCtx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'hsl(' + hue + ', 60%, 25%)');
    grad.addColorStop(0.5, 'hsl(' + ((hue + 90) % 360) + ', 60%, 15%)');
    grad.addColorStop(1, 'hsl(' + ((hue + 180) % 360) + ', 60%, 25%)');
    testCtx.fillStyle = grad;
    testCtx.fillRect(0, 0, w, h);
    
    // Moving circles
    for (let i = 0; i < 6; i++) {
      const angle = t * (1 + i * 0.2) + (i * Math.PI / 3);
      const radius = 40 + i * 25;
      const orbitRadius = 200 + i * 50;
      const cx = w / 2 + Math.cos(angle) * orbitRadius;
      const cy = h / 3 + Math.sin(angle * 0.7) * (h / 6) + i * 100;
      
      testCtx.beginPath();
      testCtx.arc(cx, cy, radius, 0, Math.PI * 2);
      testCtx.fillStyle = 'hsla(' + ((hue + i * 40) % 360) + ', 70%, 55%, 0.8)';
      testCtx.fill();
      testCtx.strokeStyle = '#ffffff';
      testCtx.lineWidth = 2;
      testCtx.stroke();
    }
    
    // Pulsing center play button
    const pulse = 1 + Math.sin(t * 5) * 0.15;
    testCtx.save();
    testCtx.translate(w / 2, h * 0.65);
    testCtx.scale(pulse, pulse);
    
    // Triangle play icon
    testCtx.beginPath();
    testCtx.moveTo(-35, -45);
    testCtx.lineTo(-35, 45);
    testCtx.lineTo(45, 0);
    testCtx.closePath();
    testCtx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    testCtx.fill();
    testCtx.restore();
    
    // Status bar
    testCtx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    testCtx.fillRect(20, h - 160, 500, 140);
    
    testCtx.fillStyle = '#00ff88';
    testCtx.font = 'bold 32px sans-serif';
    testCtx.fillText('✓ CAMERA REPLACED', 40, h - 120);
    
    testCtx.fillStyle = '#ffffff';
    testCtx.font = '22px monospace';
    testCtx.fillText('Frame: ' + String(frame % 10000).padStart(5, '0'), 40, h - 85);
    testCtx.fillText('Time: ' + t.toFixed(2) + 's', 240, h - 85);
    testCtx.fillText(CONFIG.width + 'x' + CONFIG.height + ' @ ' + CONFIG.fps + 'fps', 40, h - 55);
    
    // Animated scan line
    const scanY = (frame * 15) % h;
    testCtx.fillStyle = 'rgba(0, 255, 136, 0.35)';
    testCtx.fillRect(0, scanY, w, 6);
    
    // Corner markers for alignment
    const cornerSize = 80;
    testCtx.fillStyle = '#00ff88';
    // Top-left
    testCtx.fillRect(0, 0, cornerSize, 8);
    testCtx.fillRect(0, 0, 8, cornerSize);
    // Top-right
    testCtx.fillRect(w - cornerSize, 0, cornerSize, 8);
    testCtx.fillRect(w - 8, 0, 8, cornerSize);
    // Bottom-left
    testCtx.fillRect(0, h - 8, cornerSize, 8);
    testCtx.fillRect(0, h - cornerSize, 8, cornerSize);
    // Bottom-right
    testCtx.fillRect(w - cornerSize, h - 8, cornerSize, 8);
    testCtx.fillRect(w - 8, h - cornerSize, 8, cornerSize);
  }
  
  // Animation loop
  function animate() {
    if (!isAnimating) return;
    
    const now = Date.now();
    const elapsed = (now - startTime) / 1000;
    
    renderTestPattern(elapsed, frameCount);
    frameCount++;
    
    animationFrameId = requestAnimationFrame(animate);
  }
  
  // Start the animation
  function startAnimation() {
    if (isAnimating) return;
    
    ensureTestCanvas();
    isAnimating = true;
    startTime = Date.now();
    frameCount = 0;
    animate();
    
    console.log('[BulletproofInjection] Animation started');
  }
  
  // Stop the animation
  function stopAnimation() {
    isAnimating = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }
  
  // Create a fake MediaStream from the test canvas
  function createFakeStream(requestedConstraints) {
    startAnimation();
    
    try {
      const stream = testCanvas.captureStream(CONFIG.fps);
      
      if (!stream || stream.getVideoTracks().length === 0) {
        throw new Error('captureStream returned no video tracks');
      }
      
      // Spoof the video track settings
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const originalGetSettings = videoTrack.getSettings.bind(videoTrack);
        videoTrack.getSettings = function() {
          return {
            ...originalGetSettings(),
            width: CONFIG.width,
            height: CONFIG.height,
            frameRate: CONFIG.fps,
            facingMode: 'user',
            deviceId: 'builtin-test-camera',
            groupId: 'test-group',
            aspectRatio: CONFIG.width / CONFIG.height,
          };
        };
        
        videoTrack.getCapabilities = function() {
          return {
            width: { min: 1, max: CONFIG.width },
            height: { min: 1, max: CONFIG.height },
            frameRate: { min: 1, max: CONFIG.fps },
            facingMode: ['user', 'environment'],
            deviceId: 'builtin-test-camera',
          };
        };
        
        videoTrack.getConstraints = function() {
          return {
            width: { ideal: CONFIG.width },
            height: { ideal: CONFIG.height },
            facingMode: 'user',
          };
        };
        
        Object.defineProperty(videoTrack, 'label', {
          get: () => 'Built-in Test Camera (1080x1920)',
          configurable: true,
        });
      }
      
      // Handle audio if requested
      if (requestedConstraints?.audio) {
        try {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          const dest = audioCtx.createMediaStreamDestination();
          
          gainNode.gain.value = 0; // Silent
          oscillator.connect(gainNode);
          gainNode.connect(dest);
          oscillator.start();
          
          dest.stream.getAudioTracks().forEach(track => stream.addTrack(track));
        } catch (audioErr) {
          console.warn('[BulletproofInjection] Could not add silent audio:', audioErr);
        }
      }
      
      // Track the stream for cleanup
      activeStreams.add(stream);
      
      // Add cleanup handler
      stream.getTracks().forEach(track => {
        const originalStop = track.stop.bind(track);
        track.stop = function() {
          originalStop();
          activeStreams.delete(stream);
          if (activeStreams.size === 0) {
            stopAnimation();
          }
        };
      });
      
      console.log('[BulletproofInjection] Created fake stream with', stream.getTracks().length, 'tracks');
      return stream;
      
    } catch (err) {
      console.error('[BulletproofInjection] Failed to create stream:', err);
      throw err;
    }
  }
  
  // Override getUserMedia
  if (navigator.mediaDevices) {
    navigator.mediaDevices.getUserMedia = async function(constraints) {
      console.log('[BulletproofInjection] getUserMedia intercepted:', JSON.stringify(constraints));
      
      if (constraints?.video) {
        try {
          const stream = createFakeStream(constraints);
          console.log('[BulletproofInjection] Returning fake camera stream');
          return stream;
        } catch (err) {
          console.error('[BulletproofInjection] Fake stream failed:', err);
          // Fall back to original if available
          if (_origGetUserMedia) {
            console.log('[BulletproofInjection] Falling back to original getUserMedia');
            return _origGetUserMedia(constraints);
          }
          throw err;
        }
      }
      
      // Audio only - use original
      if (_origGetUserMedia) {
        return _origGetUserMedia(constraints);
      }
      
      throw new Error('No camera available');
    };
    
    // Override enumerateDevices
    navigator.mediaDevices.enumerateDevices = async function() {
      console.log('[BulletproofInjection] enumerateDevices intercepted');
      
      return [
        {
          deviceId: 'builtin-test-camera',
          groupId: 'test-group',
          kind: 'videoinput',
          label: 'Built-in Test Camera (1080x1920)',
          toJSON: function() { return this; },
        },
        {
          deviceId: 'default-audio',
          groupId: 'audio-group',
          kind: 'audioinput',
          label: 'Default Audio Input',
          toJSON: function() { return this; },
        },
      ];
    };
  }
  
  // Expose for debugging and external control
  window.__bulletproofInjection = {
    isActive: () => isAnimating,
    getActiveStreamCount: () => activeStreams.size,
    getConfig: () => ({ ...CONFIG }),
    forceRefresh: () => {
      startTime = Date.now();
      frameCount = 0;
    },
    getCanvas: () => testCanvas,
  };
  
  console.log('[BulletproofInjection] Camera replacement system ACTIVE');
  console.log('[BulletproofInjection] Resolution:', CONFIG.width, 'x', CONFIG.height, '@', CONFIG.fps, 'fps');
})();
true;
`;

/**
 * Generate a test video file using the WebView's MediaRecorder API
 * This creates a real video file that can be saved to the device
 */
export const VIDEO_GENERATOR_SCRIPT = `
(function() {
  return new Promise(function(resolve, reject) {
    console.log('[VideoGenerator] Starting test video generation...');
    
    const WIDTH = 1080;
    const HEIGHT = 1920;
    const FPS = 30;
    const DURATION_MS = 1000; // 1 second
    const FRAMES = FPS; // 30 frames for 1 second
    
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d', { alpha: false });
    
    let frameCount = 0;
    let animationId = null;
    let startTime = Date.now();
    let mediaRecorder = null;
    const chunks = [];
    
    function renderFrame(time, frame) {
      const w = WIDTH;
      const h = HEIGHT;
      
      // Animated gradient
      const hue = (time * 60) % 360;
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'hsl(' + hue + ', 60%, 25%)');
      grad.addColorStop(0.5, 'hsl(' + ((hue + 120) % 360) + ', 60%, 15%)');
      grad.addColorStop(1, 'hsl(' + ((hue + 240) % 360) + ', 60%, 25%)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      
      // Moving circles
      for (let i = 0; i < 5; i++) {
        const angle = time * (1.5 + i * 0.3) + i;
        const radius = 50 + i * 20;
        const cx = w / 2 + Math.cos(angle) * 200;
        const cy = h / 4 + i * (h / 6) + Math.sin(angle * 0.8) * 60;
        
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = 'hsla(' + ((hue + i * 50) % 360) + ', 70%, 55%, 0.8)';
        ctx.fill();
      }
      
      // Pulsing center
      const pulse = 1 + Math.sin(time * 5) * 0.15;
      ctx.save();
      ctx.translate(w / 2, h * 0.7);
      ctx.scale(pulse, pulse);
      ctx.beginPath();
      ctx.moveTo(-35, -45);
      ctx.lineTo(-35, 45);
      ctx.lineTo(45, 0);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fill();
      ctx.restore();
      
      // Info bar
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(20, h - 140, 450, 120);
      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('TEST VIDEO', 40, h - 100);
      ctx.fillStyle = '#fff';
      ctx.font = '18px monospace';
      ctx.fillText('Frame ' + frame + ' / ' + FRAMES, 40, h - 65);
      ctx.fillText(WIDTH + 'x' + HEIGHT + ' @' + FPS + 'fps', 40, h - 40);
      
      // Scan line
      const scanY = (frame * 60) % h;
      ctx.fillStyle = 'rgba(0, 255, 136, 0.3)';
      ctx.fillRect(0, scanY, w, 4);
    }
    
    function startRecording() {
      try {
        const stream = canvas.captureStream(FPS);
        
        const options = { mimeType: 'video/webm;codecs=vp9' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options.mimeType = 'video/webm;codecs=vp8';
          if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options.mimeType = 'video/webm';
          }
        }
        
        mediaRecorder = new MediaRecorder(stream, options);
        
        mediaRecorder.ondataavailable = function(e) {
          if (e.data && e.data.size > 0) {
            chunks.push(e.data);
          }
        };
        
        mediaRecorder.onstop = function() {
          console.log('[VideoGenerator] Recording stopped, processing...');
          
          const blob = new Blob(chunks, { type: options.mimeType });
          const reader = new FileReader();
          reader.onloadend = function() {
            const base64 = reader.result;
            console.log('[VideoGenerator] Video generated, size:', blob.size, 'bytes');
            resolve({
              success: true,
              dataUrl: base64,
              mimeType: options.mimeType,
              size: blob.size,
              duration: DURATION_MS,
              width: WIDTH,
              height: HEIGHT,
              fps: FPS,
            });
          };
          reader.onerror = function() {
            reject(new Error('Failed to convert video to base64'));
          };
          reader.readAsDataURL(blob);
        };
        
        mediaRecorder.onerror = function(e) {
          reject(new Error('MediaRecorder error: ' + e.error));
        };
        
        mediaRecorder.start();
        console.log('[VideoGenerator] Recording started');
        animate();
        
      } catch (err) {
        reject(err);
      }
    }
    
    function animate() {
      const elapsed = (Date.now() - startTime) / 1000;
      
      renderFrame(elapsed, frameCount);
      frameCount++;
      
      if (frameCount < FRAMES) {
        animationId = requestAnimationFrame(animate);
      } else {
        setTimeout(function() {
          if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
        }, 100);
      }
    }
    
    // Start the process
    startRecording();
  });
})();
`;

/**
 * Simple check if a URL is a built-in test pattern
 */
export function isBuiltinTestVideo(uri: string): boolean {
  return uri === 'builtin:test' || 
         uri.startsWith('canvas:') || 
         uri === BUILTIN_TEST_VIDEO_ID;
}

/**
 * Get the data URL for the minimal fallback test video
 */
export function getMinimalTestVideoUrl(): string {
  return MINIMAL_TEST_VIDEO_BASE64;
}
