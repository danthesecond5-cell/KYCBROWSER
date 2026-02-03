/**
 * Live Diagnostic Script for webcamtests.com/recorder
 * 
 * This script will be injected into webcamtests.com/recorder to test
 * each protocol and report back detailed diagnostics about what works
 * and what doesn't.
 * 
 * Usage: Inject this before any page scripts load
 */

import type { CaptureDevice } from '@/types/device';

export interface ProtocolTestResult {
  protocolName: string;
  protocolId: string;
  success: boolean;
  steps: {
    injectionLoaded: boolean;
    getUserMediaOverridden: boolean;
    enumerateDevicesOverridden: boolean;
    streamCreated: boolean;
    streamHasTracks: boolean;
    trackHasCorrectMetadata: boolean;
    webcamTestsDetectsCamera: boolean;
    videoElementWorks: boolean;
  };
  errors: string[];
  details: any;
}

/**
 * Creates a comprehensive diagnostic script that tests all protocols
 */
export function createWebcamTestsLiveDiagnostic(testDevices: CaptureDevice[]): string {
  return `
(function() {
  'use strict';
  
  console.log('[WebcamTests Live Diagnostic] Starting...');
  
  // ============================================================================
  // TEST CONFIGURATION
  // ============================================================================
  
  const TEST_DEVICES = ${JSON.stringify(testDevices)};
  const TEST_RESULTS = [];
  let currentProtocol = null;
  
  // ============================================================================
  // DIAGNOSTIC UTILITIES
  // ============================================================================
  
  function log(...args) {
    console.log('[DIAGNOSTIC]', ...args);
  }
  
  function error(...args) {
    console.error('[DIAGNOSTIC]', ...args);
  }
  
  function reportResult(result) {
    TEST_RESULTS.push(result);
    
    // Send to React Native
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'protocolTestResult',
        payload: result,
      }));
    }
    
    log('Test Result:', result);
  }
  
  // ============================================================================
  // CHECK CURRENT STATE
  // ============================================================================
  
  function checkCurrentState() {
    const state = {
      timestamp: Date.now(),
      location: window.location.href,
      
      // Check if protocols are loaded
      hasWorkingInjection: !!window.__workingInjectionActive,
      hasAdvancedProtocol2: !!window.__advancedProtocol2Initialized,
      hasSonnetProtocol: !!window.__sonnetProtocolInitialized,
      
      // Check MediaDevices API
      hasMediaDevices: !!navigator.mediaDevices,
      hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      hasEnumerateDevices: !!(navigator.mediaDevices && navigator.mediaDevices.enumerateDevices),
      
      // Check if APIs have been overridden
      getUserMediaString: navigator.mediaDevices?.getUserMedia?.toString() || 'NOT FOUND',
      enumerateDevicesString: navigator.mediaDevices?.enumerateDevices?.toString() || 'NOT FOUND',
    };
    
    log('Current State:', state);
    return state;
  }
  
  // ============================================================================
  // TEST PROTOCOL FUNCTIONALITY
  // ============================================================================
  
  async function testProtocol(protocolName, protocolId) {
    log('========================================');
    log('Testing Protocol:', protocolName);
    log('========================================');
    
    const result = {
      protocolName,
      protocolId,
      success: false,
      steps: {
        injectionLoaded: false,
        getUserMediaOverridden: false,
        enumerateDevicesOverridden: false,
        streamCreated: false,
        streamHasTracks: false,
        trackHasCorrectMetadata: false,
        webcamTestsDetectsCamera: false,
        videoElementWorks: false,
      },
      errors: [],
      details: {},
    };
    
    try {
      // Step 1: Check if injection is loaded
      const state = checkCurrentState();
      result.details.initialState = state;
      
      if (protocolId === 'working' && state.hasWorkingInjection) {
        result.steps.injectionLoaded = true;
      } else if (protocolId === 'protocol2' && state.hasAdvancedProtocol2) {
        result.steps.injectionLoaded = true;
      } else if (protocolId === 'sonnet' && state.hasSonnetProtocol) {
        result.steps.injectionLoaded = true;
      }
      
      // Step 2: Check getUserMedia override
      if (state.hasGetUserMedia) {
        const funcString = state.getUserMediaString;
        // Check if it's been overridden (native code shows different pattern)
        if (funcString.includes('function getUserMedia()') || 
            funcString.includes('async function(') ||
            funcString.includes('[native code]') === false) {
          result.steps.getUserMediaOverridden = true;
        }
      }
      
      // Step 3: Check enumerateDevices override
      if (state.hasEnumerateDevices) {
        const funcString = state.enumerateDevicesString;
        if (funcString.includes('function enumerateDevices()') || 
            funcString.includes('async function()') ||
            funcString.includes('[native code]') === false) {
          result.steps.enumerateDevicesOverridden = true;
        }
      }
      
      // Step 4: Try to enumerate devices
      log('Attempting to enumerate devices...');
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        log('Devices found:', devices.length);
        result.details.devices = devices;
        
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        log('Video devices:', videoDevices.length);
        
        if (videoDevices.length > 0) {
          result.steps.webcamTestsDetectsCamera = true;
          result.details.videoDevices = videoDevices;
        } else {
          result.errors.push('No video devices found');
        }
      } catch (e) {
        error('enumerateDevices failed:', e);
        result.errors.push('enumerateDevices error: ' + e.message);
      }
      
      // Step 5: Try to get user media
      log('Attempting getUserMedia...');
      try {
        const constraints = {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        log('Stream created:', stream);
        result.steps.streamCreated = true;
        result.details.stream = {
          id: stream.id,
          active: stream.active,
          trackCount: stream.getTracks().length,
        };
        
        // Step 6: Check tracks
        const videoTracks = stream.getVideoTracks();
        log('Video tracks:', videoTracks.length);
        
        if (videoTracks.length > 0) {
          result.steps.streamHasTracks = true;
          const track = videoTracks[0];
          
          // Check track metadata
          const trackInfo = {
            id: track.id,
            kind: track.kind,
            label: track.label,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
          };
          
          log('Track info:', trackInfo);
          result.details.track = trackInfo;
          
          // Check getSettings
          if (typeof track.getSettings === 'function') {
            const settings = track.getSettings();
            log('Track settings:', settings);
            result.details.settings = settings;
            
            // Verify settings look camera-like
            if (settings.width && settings.height && settings.frameRate) {
              result.steps.trackHasCorrectMetadata = true;
            } else {
              result.errors.push('Track settings missing width/height/frameRate');
            }
          } else {
            result.errors.push('Track.getSettings not available');
          }
          
          // Check getCapabilities
          if (typeof track.getCapabilities === 'function') {
            const capabilities = track.getCapabilities();
            log('Track capabilities:', capabilities);
            result.details.capabilities = capabilities;
          }
          
          // Step 7: Test with video element
          log('Testing with video element...');
          try {
            const video = document.createElement('video');
            video.muted = true;
            video.autoplay = true;
            video.playsInline = true;
            video.srcObject = stream;
            video.style.cssText = 'position:fixed;top:10px;right:10px;width:320px;height:240px;z-index:999999;border:2px solid red;';
            
            // Wait for video to load
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => reject(new Error('Video load timeout')), 5000);
              
              video.onloadedmetadata = () => {
                clearTimeout(timeout);
                log('Video loaded:', video.videoWidth, 'x', video.videoHeight);
                resolve(null);
              };
              
              video.onerror = (e) => {
                clearTimeout(timeout);
                reject(new Error('Video error: ' + e));
              };
            });
            
            // Append to body for visual verification
            if (document.body) {
              document.body.appendChild(video);
            }
            
            result.steps.videoElementWorks = true;
            result.details.videoElement = {
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              readyState: video.readyState,
            };
          } catch (e) {
            error('Video element test failed:', e);
            result.errors.push('Video element error: ' + e.message);
          }
        } else {
          result.errors.push('Stream has no video tracks');
        }
        
      } catch (e) {
        error('getUserMedia failed:', e);
        result.errors.push('getUserMedia error: ' + e.message);
      }
      
      // Determine overall success
      result.success = result.steps.streamCreated && 
                       result.steps.streamHasTracks && 
                       result.steps.trackHasCorrectMetadata &&
                       result.steps.videoElementWorks;
      
    } catch (e) {
      error('Protocol test failed:', e);
      result.errors.push('Test error: ' + e.message);
    }
    
    log('========================================');
    log('Test Complete:', protocolName);
    log('Success:', result.success);
    log('========================================');
    
    reportResult(result);
    return result;
  }
  
  // ============================================================================
  // DETECT WHICH PROTOCOL IS ACTIVE
  // ============================================================================
  
  function detectActiveProtocol() {
    const state = checkCurrentState();
    
    if (state.hasSonnetProtocol) {
      return { name: 'Sonnet Protocol', id: 'sonnet' };
    } else if (state.hasAdvancedProtocol2) {
      return { name: 'Advanced Protocol 2', id: 'protocol2' };
    } else if (state.hasWorkingInjection) {
      return { name: 'Working Injection', id: 'working' };
    } else if (state.hasGetUserMedia && state.getUserMediaString.includes('[native code]') === false) {
      return { name: 'Unknown Protocol', id: 'unknown' };
    } else {
      return { name: 'No Protocol Active', id: 'none' };
    }
  }
  
  // ============================================================================
  // AUTO-TEST ON LOAD
  // ============================================================================
  
  async function runAutoTest() {
    log('========================================');
    log('WEBCAMTESTS.COM LIVE DIAGNOSTIC');
    log('========================================');
    
    // Wait for page to be ready
    await new Promise(resolve => {
      if (document.readyState === 'complete') {
        resolve(null);
      } else {
        window.addEventListener('load', () => resolve(null));
      }
    });
    
    // Give protocols time to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const protocol = detectActiveProtocol();
    log('Active Protocol:', protocol.name);
    
    if (protocol.id === 'none') {
      log('WARNING: No injection protocol detected!');
      reportResult({
        protocolName: 'None',
        protocolId: 'none',
        success: false,
        steps: {},
        errors: ['No injection protocol is active'],
        details: { state: checkCurrentState() },
      });
    } else {
      await testProtocol(protocol.name, protocol.id);
    }
    
    log('========================================');
    log('DIAGNOSTIC COMPLETE');
    log('========================================');
    
    // Notify completion
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'diagnosticComplete',
        payload: { results: TEST_RESULTS },
      }));
    }
  }
  
  // Export API for manual testing
  window.__webcamTestsDiagnostic = {
    checkCurrentState,
    testProtocol,
    detectActiveProtocol,
    getResults: () => TEST_RESULTS,
    runTest: runAutoTest,
  };
  
  // Run auto-test
  runAutoTest().catch(e => {
    error('Auto-test failed:', e);
  });
  
})();
true;
`;
}
