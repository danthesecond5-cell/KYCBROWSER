/**
 * Minimal Video Injection - Absolutely Bulletproof
 * 
 * This is the simplest possible video injection that can work.
 * If this doesn't work, then the environment doesn't support video injection at all.
 * 
 * NO React Native dependencies
 * NO permission prompts
 * NO complex initialization
 * 
 * Just: Override getUserMedia, return canvas stream, done.
 */

export function createMinimalInjectionScript(): string {
  return `
(function() {
  'use strict';
  
  console.log('[MinimalInject] ====================================');
  console.log('[MinimalInject] MINIMAL VIDEO INJECTION STARTING');
  console.log('[MinimalInject] ====================================');
  
  if (window.__minimalInjectionActive) {
    console.log('[MinimalInject] Already active');
    return;
  }
  window.__minimalInjectionActive = true;
  
  // ============================================================================
  // STEP 1: CREATE CANVAS WITH ANIMATED CONTENT
  // ============================================================================
  
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  canvas.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
  
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    console.error('[MinimalInject] FATAL: Cannot get 2D context');
    return;
  }
  
  console.log('[MinimalInject] Canvas created: 1280x720');
  
  // Append to body (helps with some browsers)
  if (document.body) {
    document.body.appendChild(canvas);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.body) document.body.appendChild(canvas);
    });
  }
  
  // ============================================================================
  // STEP 2: RENDER LOOP - ANIMATED GREEN SCREEN
  // ============================================================================
  
  let frameCount = 0;
  
  function render() {
    frameCount++;
    const time = Date.now() / 1000;
    
    // Create animated gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    const brightness = Math.sin(time) * 20;
    
    gradient.addColorStop(0, 'rgb(0, ' + (235 + brightness) + ', 0)');
    gradient.addColorStop(0.5, 'rgb(0, ' + (255 + brightness) + ', 0)');
    gradient.addColorStop(1, 'rgb(0, ' + (235 + brightness) + ', 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add frame counter for debugging
    ctx.fillStyle = 'black';
    ctx.font = '48px monospace';
    ctx.fillText('Frame: ' + frameCount, 50, 100);
    ctx.fillText('Time: ' + time.toFixed(1) + 's', 50, 160);
    
    requestAnimationFrame(render);
  }
  
  render();
  console.log('[MinimalInject] Render loop started');
  
  // ============================================================================
  // STEP 3: CREATE MEDIA STREAM FROM CANVAS
  // ============================================================================
  
  let globalStream = null;
  
  try {
    globalStream = canvas.captureStream(30);
    console.log('[MinimalInject] Stream created:', globalStream.id);
    console.log('[MinimalInject] Active:', globalStream.active);
    console.log('[MinimalInject] Tracks:', globalStream.getTracks().length);
    
    const videoTrack = globalStream.getVideoTracks()[0];
    if (videoTrack) {
      console.log('[MinimalInject] Video track:', videoTrack.id);
      console.log('[MinimalInject] Track label:', videoTrack.label);
      console.log('[MinimalInject] Track state:', videoTrack.readyState);
      
      // Spoof track label
      try {
        Object.defineProperty(videoTrack, 'label', {
          get: () => 'Minimal Test Camera',
          configurable: true,
          enumerable: true
        });
      } catch (e) {
        console.warn('[MinimalInject] Could not spoof label:', e);
      }
      
      // Spoof getSettings
      const originalGetSettings = videoTrack.getSettings;
      videoTrack.getSettings = function() {
        return {
          width: 1280,
          height: 720,
          frameRate: 30,
          aspectRatio: 1280 / 720,
          facingMode: 'user',
          deviceId: 'minimal-test-camera',
          groupId: 'minimal-test-group',
        };
      };
      
      console.log('[MinimalInject] Track metadata spoofed');
      console.log('[MinimalInject] New label:', videoTrack.label);
      console.log('[MinimalInject] Settings:', videoTrack.getSettings());
    } else {
      console.error('[MinimalInject] ERROR: No video track in stream!');
    }
    
  } catch (e) {
    console.error('[MinimalInject] FATAL: captureStream failed:', e);
    return;
  }
  
  // ============================================================================
  // STEP 4: OVERRIDE GETUSERMEDIA
  // ============================================================================
  
  // Store original
  const originalGetUserMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
  
  // Ensure mediaDevices exists
  if (!navigator.mediaDevices) {
    navigator.mediaDevices = {};
  }
  
  // Override getUserMedia
  navigator.mediaDevices.getUserMedia = async function(constraints) {
    console.log('[MinimalInject] ====================================');
    console.log('[MinimalInject] getUserMedia CALLED');
    console.log('[MinimalInject] Constraints:', JSON.stringify(constraints));
    console.log('[MinimalInject] ====================================');
    
    const wantsVideo = !!(constraints && constraints.video);
    
    if (!wantsVideo) {
      console.log('[MinimalInject] Audio-only request, passing through');
      if (originalGetUserMedia) {
        return originalGetUserMedia(constraints);
      }
      throw new DOMException('getUserMedia not available', 'NotSupportedError');
    }
    
    console.log('[MinimalInject] Returning injected stream');
    console.log('[MinimalInject] Stream ID:', globalStream.id);
    console.log('[MinimalInject] Stream active:', globalStream.active);
    console.log('[MinimalInject] Track count:', globalStream.getTracks().length);
    
    return globalStream;
  };
  
  // Override enumerateDevices
  navigator.mediaDevices.enumerateDevices = async function() {
    console.log('[MinimalInject] enumerateDevices CALLED');
    
    const fakeDevices = [
      {
        deviceId: 'minimal-test-camera',
        groupId: 'minimal-test-group',
        kind: 'videoinput',
        label: 'Minimal Test Camera',
        toJSON: function() { return this; }
      },
      {
        deviceId: 'minimal-test-mic',
        groupId: 'minimal-test-group',
        kind: 'audioinput',
        label: 'Minimal Test Microphone',
        toJSON: function() { return this; }
      },
    ];
    
    console.log('[MinimalInject] Returning', fakeDevices.length, 'fake devices');
    return fakeDevices;
  };
  
  console.log('[MinimalInject] ====================================');
  console.log('[MinimalInject] MINIMAL INJECTION COMPLETE');
  console.log('[MinimalInject] getUserMedia: OVERRIDDEN');
  console.log('[MinimalInject] enumerateDevices: OVERRIDDEN');
  console.log('[MinimalInject] Stream: READY');
  console.log('[MinimalInject] ====================================');
  
  // Test immediately
  setTimeout(async function() {
    console.log('[MinimalInject] Running self-test...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      console.log('[MinimalInject] ✓ Self-test PASSED');
      console.log('[MinimalInject] Stream:', stream.id);
      console.log('[MinimalInject] Tracks:', stream.getTracks().map(t => t.kind + ':' + t.label).join(', '));
    } catch (e) {
      console.error('[MinimalInject] ✗ Self-test FAILED:', e);
    }
  }, 100);
  
  // Export for debugging
  window.__minimalInjection = {
    canvas: canvas,
    stream: globalStream,
    getStream: () => globalStream,
  };
  
})();
true;
`;
}
