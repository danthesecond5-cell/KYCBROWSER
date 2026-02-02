/**
 * Deep Analysis Script for webcamtests.com
 * 
 * This script runs on webcamtests.com/recorder and performs deep analysis
 * of why the video injection might not be working.
 * 
 * It checks:
 * 1. Timing - when does the page try to access the camera?
 * 2. Detection - is the page detecting our injection?
 * 3. Canvas - does canvas.captureStream() actually work?
 * 4. Tracks - are the track properties properly spoofed?
 * 5. Video element - can a video element display our stream?
 */

export function createDeepAnalysisScript(): string {
  return `
(function() {
  'use strict';
  
  console.log('[DeepAnalysis] ==========================================');
  console.log('[DeepAnalysis] WEBCAMTESTS.COM DEEP ANALYSIS');
  console.log('[DeepAnalysis] ==========================================');
  
  const results = {
    timestamp: Date.now(),
    url: window.location.href,
    checks: {},
    errors: [],
    warnings: [],
    info: [],
  };
  
  function log(message) {
    console.log('[DeepAnalysis]', message);
    results.info.push(message);
  }
  
  function warn(message) {
    console.warn('[DeepAnalysis]', message);
    results.warnings.push(message);
  }
  
  function error(message) {
    console.error('[DeepAnalysis]', message);
    results.errors.push(message);
  }
  
  // ============================================================================
  // CHECK 1: BASIC ENVIRONMENT
  // ============================================================================
  
  log('Check 1: Basic Environment');
  results.checks.environment = {
    hasWindow: typeof window !== 'undefined',
    hasDocument: typeof document !== 'undefined',
    hasNavigator: typeof navigator !== 'undefined',
    hasMediaDevices: !!(navigator && navigator.mediaDevices),
    hasGetUserMedia: !!(navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    hasEnumerateDevices: !!(navigator && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices),
    hasCanvas: typeof HTMLCanvasElement !== 'undefined',
    hasCaptureStream: typeof HTMLCanvasElement !== 'undefined' && 
                      typeof HTMLCanvasElement.prototype.captureStream === 'function',
  };
  
  log('Environment check: ' + JSON.stringify(results.checks.environment, null, 2));
  
  if (!results.checks.environment.hasGetUserMedia) {
    error('CRITICAL: navigator.mediaDevices.getUserMedia not available!');
  }
  
  if (!results.checks.environment.hasCaptureStream) {
    error('CRITICAL: Canvas.captureStream() not available!');
  }
  
  // ============================================================================
  // CHECK 2: PROTOCOL DETECTION
  // ============================================================================
  
  log('Check 2: Protocol Detection');
  results.checks.protocols = {
    workingInjection: !!window.__workingInjectionActive,
    mediaInjector: !!window.__mediaInjectorInitialized,
    advancedProtocol2: !!window.__advancedProtocol2Initialized,
    sonnetProtocol: !!window.__sonnetProtocolInitialized,
    anyProtocolActive: false,
  };
  
  results.checks.protocols.anyProtocolActive = 
    results.checks.protocols.workingInjection ||
    results.checks.protocols.mediaInjector ||
    results.checks.protocols.advancedProtocol2 ||
    results.checks.protocols.sonnetProtocol;
  
  log('Protocol detection: ' + JSON.stringify(results.checks.protocols, null, 2));
  
  if (!results.checks.protocols.anyProtocolActive) {
    error('CRITICAL: No injection protocol detected! Injection may not have loaded.');
  } else {
    log('✓ At least one protocol is active');
  }
  
  // ============================================================================
  // CHECK 3: FUNCTION OVERRIDE DETECTION
  // ============================================================================
  
  log('Check 3: Function Override Detection');
  
  const getUserMediaString = navigator.mediaDevices.getUserMedia.toString();
  const enumerateDevicesString = navigator.mediaDevices.enumerateDevices.toString();
  
  results.checks.overrides = {
    getUserMediaOverridden: !getUserMediaString.includes('[native code]'),
    enumerateDevicesOverridden: !enumerateDevicesString.includes('[native code]'),
    getUserMediaLength: getUserMediaString.length,
    enumerateDevicesLength: enumerateDevicesString.length,
  };
  
  log('Override detection: ' + JSON.stringify(results.checks.overrides, null, 2));
  
  if (!results.checks.overrides.getUserMediaOverridden) {
    error('CRITICAL: getUserMedia appears to be native code - not overridden!');
  } else {
    log('✓ getUserMedia has been overridden');
  }
  
  if (!results.checks.overrides.enumerateDevicesOverridden) {
    warn('WARNING: enumerateDevices appears to be native code - not overridden');
  } else {
    log('✓ enumerateDevices has been overridden');
  }
  
  // ============================================================================
  // CHECK 4: CANVAS STREAM TEST
  // ============================================================================
  
  log('Check 4: Canvas Stream Test');
  
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Could not get 2D context');
    }
    
    // Draw something
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Try to capture stream
    const stream = canvas.captureStream(30);
    
    results.checks.canvasStream = {
      streamCreated: !!stream,
      streamId: stream ? stream.id : null,
      streamActive: stream ? stream.active : false,
      trackCount: stream ? stream.getTracks().length : 0,
      videoTrackCount: stream ? stream.getVideoTracks().length : 0,
    };
    
    if (stream && stream.getVideoTracks().length > 0) {
      const track = stream.getVideoTracks()[0];
      results.checks.canvasStream.track = {
        id: track.id,
        kind: track.kind,
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        hasGetSettings: typeof track.getSettings === 'function',
        hasGetCapabilities: typeof track.getCapabilities === 'function',
      };
      
      if (typeof track.getSettings === 'function') {
        const settings = track.getSettings();
        results.checks.canvasStream.settings = settings;
        
        if (!settings.width || !settings.height) {
          warn('WARNING: Canvas track settings missing width/height');
        }
        if (!settings.deviceId) {
          warn('WARNING: Canvas track settings missing deviceId');
        }
        if (!settings.facingMode) {
          warn('WARNING: Canvas track settings missing facingMode');
        }
      }
      
      log('✓ Canvas stream test PASSED');
    } else {
      throw new Error('No video tracks in canvas stream');
    }
    
  } catch (e) {
    error('Canvas stream test FAILED: ' + e.message);
    results.checks.canvasStream = { error: e.message };
  }
  
  log('Canvas stream test: ' + JSON.stringify(results.checks.canvasStream, null, 2));
  
  // ============================================================================
  // CHECK 5: ENUMERATE DEVICES TEST
  // ============================================================================
  
  log('Check 5: enumerateDevices Test');
  
  (async function testEnumerateDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      results.checks.enumerateDevices = {
        totalDevices: devices.length,
        videoInputs: devices.filter(d => d.kind === 'videoinput').length,
        audioInputs: devices.filter(d => d.kind === 'audioinput').length,
        audioOutputs: devices.filter(d => d.kind === 'audiooutput').length,
        devices: devices.map(d => ({
          kind: d.kind,
          label: d.label,
          deviceId: d.deviceId.substring(0, 20) + '...',
          groupId: d.groupId,
        })),
      };
      
      log('enumerateDevices test: ' + JSON.stringify(results.checks.enumerateDevices, null, 2));
      
      if (results.checks.enumerateDevices.videoInputs === 0) {
        error('CRITICAL: enumerateDevices returned 0 video inputs!');
      } else {
        log('✓ enumerateDevices test PASSED');
      }
      
    } catch (e) {
      error('enumerateDevices test FAILED: ' + e.message);
      results.checks.enumerateDevices = { error: e.message };
    }
    
    // Continue to next check
    await testGetUserMedia();
  })();
  
  // ============================================================================
  // CHECK 6: GETUSERMEDIA TEST
  // ============================================================================
  
  async function testGetUserMedia() {
    log('Check 6: getUserMedia Test');
    
    try {
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      };
      
      log('Calling getUserMedia with constraints: ' + JSON.stringify(constraints));
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      results.checks.getUserMedia = {
        streamCreated: true,
        streamId: stream.id,
        streamActive: stream.active,
        trackCount: stream.getTracks().length,
        videoTrackCount: stream.getVideoTracks().length,
        audioTrackCount: stream.getAudioTracks().length,
      };
      
      if (stream.getVideoTracks().length > 0) {
        const track = stream.getVideoTracks()[0];
        
        results.checks.getUserMedia.track = {
          id: track.id,
          kind: track.kind,
          label: track.label,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          hasGetSettings: typeof track.getSettings === 'function',
          hasGetCapabilities: typeof track.getCapabilities === 'function',
          hasGetConstraints: typeof track.getConstraints === 'function',
        };
        
        if (typeof track.getSettings === 'function') {
          results.checks.getUserMedia.settings = track.getSettings();
        }
        
        if (typeof track.getCapabilities === 'function') {
          results.checks.getUserMedia.capabilities = track.getCapabilities();
        }
        
        log('✓ getUserMedia test PASSED');
        log('Stream: ' + JSON.stringify(results.checks.getUserMedia, null, 2));
        
        // Test with video element
        await testVideoElement(stream);
        
      } else {
        throw new Error('Stream has no video tracks');
      }
      
    } catch (e) {
      error('getUserMedia test FAILED: ' + e.message);
      error('Error name: ' + e.name);
      error('Error stack: ' + (e.stack || 'no stack'));
      results.checks.getUserMedia = { 
        error: e.message,
        errorName: e.name,
        errorStack: e.stack,
      };
      
      // Still output results even if failed
      outputResults();
    }
  }
  
  // ============================================================================
  // CHECK 7: VIDEO ELEMENT TEST
  // ============================================================================
  
  async function testVideoElement(stream) {
    log('Check 7: Video Element Test');
    
    try {
      const video = document.createElement('video');
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.setAttribute('playsinline', 'true');
      video.style.cssText = 'position:fixed;top:10px;right:10px;width:320px;height:240px;z-index:999999;border:4px solid lime;';
      
      video.srcObject = stream;
      
      // Wait for video to load
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Video load timeout after 5 seconds'));
        }, 5000);
        
        video.onloadedmetadata = () => {
          clearTimeout(timeout);
          resolve(null);
        };
        
        video.onerror = (e) => {
          clearTimeout(timeout);
          reject(new Error('Video error: ' + e));
        };
      });
      
      results.checks.videoElement = {
        loaded: true,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState,
        currentTime: video.currentTime,
        duration: video.duration,
        paused: video.paused,
        ended: video.ended,
        error: video.error ? video.error.message : null,
      };
      
      // Append to page for visual verification
      if (document.body) {
        document.body.appendChild(video);
      }
      
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        error('Video element dimensions are 0!');
      } else {
        log('✓ Video element test PASSED');
      }
      
      log('Video element: ' + JSON.stringify(results.checks.videoElement, null, 2));
      
    } catch (e) {
      error('Video element test FAILED: ' + e.message);
      results.checks.videoElement = { error: e.message };
    }
    
    // Output final results
    outputResults();
  }
  
  // ============================================================================
  // OUTPUT RESULTS
  // ============================================================================
  
  function outputResults() {
    log('==========================================');
    log('DEEP ANALYSIS COMPLETE');
    log('==========================================');
    
    const summary = {
      totalChecks: Object.keys(results.checks).length,
      passed: 0,
      failed: 0,
      warnings: results.warnings.length,
      errors: results.errors.length,
    };
    
    // Count passed/failed
    Object.values(results.checks).forEach(check => {
      if (typeof check === 'object' && check !== null) {
        if (check.error) {
          summary.failed++;
        } else {
          summary.passed++;
        }
      }
    });
    
    log('Summary: ' + JSON.stringify(summary, null, 2));
    log('Full results: ' + JSON.stringify(results, null, 2));
    
    // Send to React Native if available
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'deepAnalysisResults',
        payload: results,
      }));
    }
    
    // Also make available globally for console access
    window.__deepAnalysisResults = results;
    
    log('Results saved to window.__deepAnalysisResults');
    log('==========================================');
  }
  
})();
true;
`;
}
