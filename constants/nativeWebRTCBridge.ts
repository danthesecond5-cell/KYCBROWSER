/**
 * Native WebRTC Bridge Injection Script
 * Provides a WebView-side getUserMedia override that negotiates a
 * WebRTC connection with the React Native layer for a real MediaStream.
 */

export const NATIVE_WEBRTC_BRIDGE_SCRIPT = `
(function() {
  if (window.__nativeWebRTCBridgeInitialized) return;
  window.__nativeWebRTCBridgeInitialized = true;
  
  var DEFAULT_CONFIG = {
    enabled: false,
    preferNative: false,
    forceNative: false,
    timeoutMs: 8000,
    debug: false
  };
  
  if (!window.__nativeWebRTCBridgeConfig) {
    window.__nativeWebRTCBridgeConfig = DEFAULT_CONFIG;
  } else {
    window.__nativeWebRTCBridgeConfig = Object.assign({}, DEFAULT_CONFIG, window.__nativeWebRTCBridgeConfig || {});
  }
  
  var pending = {};
  var pcs = {};
  var requestCounter = 0;
  
  function log() {
    if (window.__nativeWebRTCBridgeConfig && window.__nativeWebRTCBridgeConfig.debug) {
      console.log('[NativeBridge]', ...arguments);
    }
  }
  
  function warn() {
    if (window.__nativeWebRTCBridgeConfig && window.__nativeWebRTCBridgeConfig.debug) {
      console.warn('[NativeBridge]', ...arguments);
    }
  }
  
  function sendToRN(message) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(message));
      }
    } catch (e) {}
  }
  
  function cleanupRequest(requestId) {
    var entry = pending[requestId];
    if (entry && entry.timeoutId) {
      clearTimeout(entry.timeoutId);
    }
    delete pending[requestId];
    
    var pc = pcs[requestId];
    if (pc) {
      try { pc.close(); } catch (e) {}
    }
    delete pcs[requestId];
  }
  
  function buildPeerConnection(requestId, constraints) {
    var pc = new RTCPeerConnection({ iceServers: [] });
    pcs[requestId] = pc;
    
    var wantsAudio = !!(constraints && constraints.audio);
    var wantsVideo = !!(constraints && constraints.video);
    
    if (pc.addTransceiver) {
      if (wantsVideo) pc.addTransceiver('video', { direction: 'recvonly' });
      if (wantsAudio) pc.addTransceiver('audio', { direction: 'recvonly' });
    }
    
    pc.onicecandidate = function(event) {
      if (event && event.candidate) {
        sendToRN({
          type: 'nativeWebRTCIceCandidate',
          payload: { requestId: requestId, candidate: event.candidate }
        });
      }
    };
    
    pc.onconnectionstatechange = function() {
      var state = pc.connectionState || pc.iceConnectionState;
      if (state === 'failed' || state === 'closed' || state === 'disconnected') {
        cleanupRequest(requestId);
      }
    };
    
    return pc;
  }
  
  function requestStream(constraints) {
    var config = window.__nativeWebRTCBridgeConfig || DEFAULT_CONFIG;
    if (!config.enabled) {
      return Promise.reject(new Error('Native bridge disabled'));
    }
    if (!window.ReactNativeWebView || !window.ReactNativeWebView.postMessage) {
      return Promise.reject(new Error('Native bridge unavailable'));
    }
    if (typeof RTCPeerConnection === 'undefined') {
      return Promise.reject(new Error('WebRTC not available in WebView'));
    }
    
    var requestId = 'native_gum_' + Date.now() + '_' + (++requestCounter);
    var pc = buildPeerConnection(requestId, constraints || {});
    
    return new Promise(function(resolve, reject) {
      var timeoutId = setTimeout(function() {
        cleanupRequest(requestId);
        reject(new Error('Native bridge timeout'));
      }, config.timeoutMs || 8000);
      
      pending[requestId] = {
        resolve: resolve,
        reject: reject,
        pc: pc,
        timeoutId: timeoutId,
        constraints: constraints || {},
        queuedCandidates: []
      };
      
      pc.ontrack = function(event) {
        var entry = pending[requestId];
        if (!entry) return;
        var stream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([event.track]);
        
        var wantsAudio = !!entry.constraints.audio;
        var wantsVideo = !!entry.constraints.video;
        var hasVideo = stream.getVideoTracks().length > 0;
        var hasAudio = stream.getAudioTracks().length > 0;
        
        if ((wantsVideo && hasVideo) || (!wantsVideo && (hasAudio || hasVideo))) {
          clearTimeout(entry.timeoutId);
          delete pending[requestId];
          resolve(stream);
        } else if (wantsAudio && !hasAudio) {
          // Wait for audio track if requested
        } else {
          clearTimeout(entry.timeoutId);
          delete pending[requestId];
          resolve(stream);
        }
      };
      
      pc.createOffer({
        offerToReceiveAudio: !!(constraints && constraints.audio),
        offerToReceiveVideo: !!(constraints && constraints.video)
      }).then(function(offer) {
        return pc.setLocalDescription(offer).then(function() {
          sendToRN({
            type: 'nativeWebRTCOffer',
            payload: {
              requestId: requestId,
              sdp: offer.sdp,
              constraints: constraints || {}
            }
          });
        });
      }).catch(function(err) {
        clearTimeout(timeoutId);
        delete pending[requestId];
        reject(err);
      });
    });
  }
  
  window.__nativeWebRTCBridgeRequest = requestStream;
  
  window.__nativeWebRTCBridgeHandleMessage = function(message) {
    if (!message || !message.type || !message.requestId) return;
    var requestId = message.requestId;
    var entry = pending[requestId];
    var pc = pcs[requestId];
    
    if (message.type === 'answer') {
      if (!pc || !message.sdp) return;
      pc.setRemoteDescription({ type: 'answer', sdp: message.sdp }).then(function() {
        var queued = entry && entry.queuedCandidates ? entry.queuedCandidates : [];
        queued.forEach(function(c) {
          try { pc.addIceCandidate(c); } catch (e) {}
        });
        if (entry) entry.queuedCandidates = [];
      }).catch(function(err) {
        warn('Remote description failed:', err && err.message ? err.message : err);
      });
      return;
    }
    
    if (message.type === 'ice') {
      if (!pc || !message.candidate) return;
      if (pc.remoteDescription && pc.remoteDescription.type) {
        try { pc.addIceCandidate(message.candidate); } catch (e) {}
      } else if (entry) {
        entry.queuedCandidates.push(message.candidate);
      }
      return;
    }
    
    if (message.type === 'error') {
      if (entry) {
        clearTimeout(entry.timeoutId);
        entry.reject(new Error(message.message || 'Native bridge error'));
      }
      cleanupRequest(requestId);
      return;
    }
    
    if (message.type === 'close') {
      cleanupRequest(requestId);
    }
  };
  
  window.__updateNativeWebRTCBridgeConfig = function(config) {
    window.__nativeWebRTCBridgeConfig = Object.assign({}, DEFAULT_CONFIG, window.__nativeWebRTCBridgeConfig || {}, config || {});
  };
  
  var originalGetUserMedia = navigator.mediaDevices && navigator.mediaDevices.getUserMedia
    ? navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    : null;
  
  if (!navigator.mediaDevices) {
    navigator.mediaDevices = {};
  }
  
  navigator.mediaDevices.getUserMedia = function(constraints) {
    var cfg = window.__nativeWebRTCBridgeConfig || DEFAULT_CONFIG;
    if (!cfg.enabled) {
      if (originalGetUserMedia) return originalGetUserMedia(constraints);
      return Promise.reject(new DOMException('getUserMedia not available', 'NotSupportedError'));
    }
    
    var forceNative = cfg.forceNative === true || cfg.preferNative === true;
    return requestStream(constraints).catch(function(err) {
      if (originalGetUserMedia && !forceNative) {
        return originalGetUserMedia(constraints);
      }
      throw err;
    });
  };
  
  log('Native WebRTC bridge ready');
})();
true;
`;
