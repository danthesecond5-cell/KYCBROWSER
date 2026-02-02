/**
 * Early Injection Script
 * 
 * This MUST be the first thing that runs in injectedJavaScriptBeforeContentLoaded.
 * It captures and overrides getUserMedia BEFORE any page scripts can run.
 * 
 * This is critical for sites like https://webcamtests.com/recorder that
 * immediately try to access mediaDevices on page load.
 */

/**
 * Create the absolutely earliest possible getUserMedia override
 * This runs SYNCHRONOUSLY before ANYTHING else
 */
export const EARLY_GETUSERMEDIA_OVERRIDE = `
// ============================================================================
// EARLY getUserMedia OVERRIDE - RUNS FIRST, ALWAYS
// ============================================================================
(function() {
  'use strict';
  
  // Check if already initialized
  if (window.__earlyOverrideActive) {
    console.log('[EarlyOverride] Already active');
    return;
  }
  window.__earlyOverrideActive = true;
  
  console.log('[EarlyOverride] ================================================');
  console.log('[EarlyOverride] ACTIVATING EARLY getUserMedia OVERRIDE');
  console.log('[EarlyOverride] This runs BEFORE any page scripts');
  console.log('[EarlyOverride] ================================================');
  
  // CRITICAL: Capture originals IMMEDIATELY
  const _navigator = window.navigator;
  const _mediaDevices = _navigator?.mediaDevices;
  
  if (!_mediaDevices) {
    console.error('[EarlyOverride] CRITICAL: navigator.mediaDevices not available!');
    return;
  }
  
  // Store originals
  const _originalGetUserMedia = _mediaDevices.getUserMedia?.bind?.(_mediaDevices);
  const _originalEnumerateDevices = _mediaDevices.enumerateDevices?.bind?.(_mediaDevices);
  
  console.log('[EarlyOverride] Original APIs captured:', {
    getUserMedia: !!_originalGetUserMedia,
    enumerateDevices: !!_originalEnumerateDevices,
  });
  
  // Global state for protocol initialization
  window.__earlyOverrideState = {
    originalGetUserMedia: _originalGetUserMedia,
    originalEnumerateDevices: _originalEnumerateDevices,
    protocolReady: false,
    protocolHandler: null,
    pendingCalls: [],
    initialized: Date.now(),
  };
  
  // Minimal canvas stream creator (used if protocol not ready)
  function createFallbackStream() {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new DOMException('Canvas context failed', 'NotSupportedError');
    }
    
    // Simple animated pattern
    let frame = 0;
    function render() {
      const t = frame / 30;
      const hue = (t * 40) % 360;
      
      // Gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, \`hsl(\${hue}, 70%, 30%)\`);
      gradient.addColorStop(1, \`hsl(\${(hue + 180) % 360}, 70%, 30%)\`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Text indicator
      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 40px sans-serif';
      ctx.fillText('FALLBACK STREAM', 50, 100);
      ctx.font = '30px monospace';
      ctx.fillText(\`Frame: \${frame}\`, 50, 160);
      
      frame++;
      requestAnimationFrame(render);
    }
    
    requestAnimationFrame(render);
    
    // Create stream
    try {
      const captureStream = canvas.captureStream || canvas.mozCaptureStream || canvas.webkitCaptureStream;
      if (!captureStream) {
        throw new DOMException('captureStream not supported', 'NotSupportedError');
      }
      
      const stream = captureStream.call(canvas, 30);
      const videoTrack = stream.getVideoTracks()[0];
      
      // Spoof track metadata
      if (videoTrack) {
        videoTrack.getSettings = function() {
          return {
            width: 1080,
            height: 1920,
            frameRate: 30,
            facingMode: 'user',
            deviceId: 'fallback-camera-0',
          };
        };
        
        Object.defineProperty(videoTrack, 'label', {
          get: function() { return 'Fallback Camera (1080x1920)'; },
        });
      }
      
      console.log('[EarlyOverride] Fallback stream created');
      return stream;
    } catch (err) {
      console.error('[EarlyOverride] Fallback stream creation failed:', err);
      throw new DOMException('Stream creation failed', 'NotReadableError');
    }
  }
  
  // Override getUserMedia IMMEDIATELY
  _mediaDevices.getUserMedia = async function(constraints) {
    console.log('[EarlyOverride] ====================================');
    console.log('[EarlyOverride] getUserMedia INTERCEPTED');
    console.log('[EarlyOverride] Constraints:', constraints);
    console.log('[EarlyOverride] ====================================');
    
    const state = window.__earlyOverrideState;
    
    // If video is not requested, try original
    if (!constraints?.video) {
      console.log('[EarlyOverride] Audio only, using original');
      if (_originalGetUserMedia) {
        return _originalGetUserMedia(constraints);
      }
      throw new DOMException('getUserMedia not available', 'NotSupportedError');
    }
    
    // Wait for protocol handler (with timeout)
    if (!state.protocolReady && state.protocolHandler === null) {
      console.log('[EarlyOverride] Waiting for protocol handler...');
      
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max
      
      while (!state.protocolReady && state.protocolHandler === null && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (!state.protocolReady && state.protocolHandler === null) {
        console.warn('[EarlyOverride] Protocol handler timeout, using fallback');
        return createFallbackStream();
      }
    }
    
    // Use protocol handler if available
    if (state.protocolHandler && typeof state.protocolHandler === 'function') {
      console.log('[EarlyOverride] Delegating to protocol handler');
      try {
        return await state.protocolHandler(constraints);
      } catch (err) {
        console.error('[EarlyOverride] Protocol handler failed:', err);
        console.log('[EarlyOverride] Falling back to fallback stream');
        return createFallbackStream();
      }
    }
    
    // Ultimate fallback
    console.log('[EarlyOverride] No protocol handler, using fallback stream');
    return createFallbackStream();
  };
  
  // Override enumerateDevices
  _mediaDevices.enumerateDevices = async function() {
    console.log('[EarlyOverride] enumerateDevices INTERCEPTED');
    
    const state = window.__earlyOverrideState;
    
    // If protocol has custom enumerator, use it
    if (state.enumerateDevicesHandler && typeof state.enumerateDevicesHandler === 'function') {
      try {
        return await state.enumerateDevicesHandler();
      } catch (err) {
        console.error('[EarlyOverride] Custom enumerator failed:', err);
      }
    }
    
    // Return simulated devices
    return [
      {
        deviceId: 'injected-camera-front',
        groupId: 'injected-group',
        kind: 'videoinput',
        label: 'Injected Camera (Front - 1080x1920)',
        toJSON: function() { return this; },
      },
      {
        deviceId: 'injected-camera-back',
        groupId: 'injected-group',
        kind: 'videoinput',
        label: 'Injected Camera (Back - 1080x1920)',
        toJSON: function() { return this; },
      },
      {
        deviceId: 'injected-audio',
        groupId: 'injected-group',
        kind: 'audioinput',
        label: 'Injected Microphone',
        toJSON: function() { return this; },
      },
    ];
  };
  
  // Watchdog to restore overrides if they get replaced
  const watchdogInterval = setInterval(function() {
    try {
      if (_mediaDevices.getUserMedia.name !== 'getUserMedia' || 
          _mediaDevices.getUserMedia.toString().indexOf('[EarlyOverride]') === -1) {
        console.warn('[EarlyOverride] Detected override replacement, restoring...');
        // Re-capture the current function (might be a wrapper)
        const currentGetUserMedia = _mediaDevices.getUserMedia;
        // Restore our override
        _mediaDevices.getUserMedia = async function(constraints) {
          console.log('[EarlyOverride] Restored override called');
          return currentGetUserMedia.call(this, constraints);
        };
      }
    } catch (e) {}
  }, 1000);
  
  // Public API for protocols to register their handler
  window.__registerProtocolHandler = function(handler, enumerateHandler) {
    console.log('[EarlyOverride] Protocol handler registered');
    window.__earlyOverrideState.protocolHandler = handler;
    if (enumerateHandler) {
      window.__earlyOverrideState.enumerateDevicesHandler = enumerateHandler;
    }
    window.__earlyOverrideState.protocolReady = true;
  };
  
  console.log('[EarlyOverride] ================================================');
  console.log('[EarlyOverride] EARLY OVERRIDE ACTIVE');
  console.log('[EarlyOverride] Waiting for protocol registration...');
  console.log('[EarlyOverride] ================================================');
  
  // Notify React Native
  if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'earlyOverrideReady',
      timestamp: Date.now(),
    }));
  }
})();
true;
`;

/**
 * Wrap any protocol injection script to work with the early override
 */
export function wrapWithEarlyOverride(protocolScript: string): string {
  return `
${EARLY_GETUSERMEDIA_OVERRIDE}

// ============================================================================
// PROTOCOL-SPECIFIC CODE STARTS HERE
// ============================================================================

${protocolScript}

// ============================================================================
// REGISTER PROTOCOL WITH EARLY OVERRIDE
// ============================================================================
(function() {
  // Wait a bit for protocol to fully initialize
  setTimeout(function() {
    if (typeof window.__registerProtocolHandler === 'function') {
      // Try to find the protocol's getUserMedia handler
      let handler = null;
      let enumerateHandler = null;
      
      // Check for different protocol types
      if (window.__mediaSimConfig && typeof navigator.mediaDevices._injectedGetUserMedia === 'function') {
        handler = navigator.mediaDevices._injectedGetUserMedia;
        console.log('[Registration] Registering standard media injection handler');
      } else if (window.__advancedProtocol2 && typeof window.__advancedProtocol2.getStream === 'function') {
        handler = async function(constraints) {
          // Call the protocol's stream creator
          return window.__advancedProtocol2.getStream(constraints);
        };
        console.log('[Registration] Registering Advanced Protocol 2 handler');
      } else if (window.__bulletproofConfig) {
        handler = async function(constraints) {
          // Bulletproof creates its own stream
          return navigator.mediaDevices._originalGetUserMedia(constraints);
        };
        console.log('[Registration] Registering Bulletproof handler');
      } else if (window.__sonnetProtocol) {
        handler = async function(constraints) {
          // Sonnet protocol
          return navigator.mediaDevices._originalGetUserMedia(constraints);
        };
        console.log('[Registration] Registering Sonnet Protocol handler');
      }
      
      if (handler) {
        window.__registerProtocolHandler(handler, enumerateHandler);
      } else {
        console.warn('[Registration] No protocol handler found, early override will use fallback');
      }
    }
  }, 100);
})();
true;
`;
}
