import type { CaptureDevice } from '@/types/device';

export interface WebRtcLoopbackOptions {
  devices: CaptureDevice[];
  debugEnabled: boolean;
  targetWidth?: number;
  targetHeight?: number;
  targetFPS?: number;
  signalingTimeoutMs?: number;
  autoStart?: boolean;
  requireNativeBridge?: boolean;
}

/**
 * WebRTC Loopback Injection (iOS)
 * Requires a native bridge to provide a remote WebRTC track.
 */
export function createWebRtcLoopbackInjectionScript(options: WebRtcLoopbackOptions): string {
  const {
    devices,
    debugEnabled,
    targetWidth = 1080,
    targetHeight = 1920,
    targetFPS = 30,
    signalingTimeoutMs = 12000,
    autoStart = true,
    requireNativeBridge = true,
  } = options;

  return `
(function() {
  'use strict';

  if (window.__webrtcLoopbackInitialized) {
    if (window.__webrtcLoopbackUpdateConfig) {
      window.__webrtcLoopbackUpdateConfig({
        devices: ${JSON.stringify(devices)},
        debugEnabled: ${debugEnabled},
        targetWidth: ${targetWidth},
        targetHeight: ${targetHeight},
        targetFPS: ${targetFPS},
        signalingTimeoutMs: ${signalingTimeoutMs},
        autoStart: ${autoStart},
        requireNativeBridge: ${requireNativeBridge}
      });
    }
    return;
  }
  window.__webrtcLoopbackInitialized = true;

  const CONFIG = {
    DEVICES: ${JSON.stringify(devices)},
    DEBUG: ${debugEnabled},
    TARGET_WIDTH: ${targetWidth},
    TARGET_HEIGHT: ${targetHeight},
    TARGET_FPS: ${targetFPS},
    SIGNALING_TIMEOUT_MS: ${signalingTimeoutMs},
    AUTO_START: ${autoStart},
    REQUIRE_NATIVE_BRIDGE: ${requireNativeBridge},
  };

  const log = CONFIG.DEBUG
    ? (...args) => console.log('[WebRTCLoopback]', ...args)
    : () => {};
  const warn = (...args) => console.warn('[WebRTCLoopback]', ...args);
  const error = (...args) => console.error('[WebRTCLoopback]', ...args);

  const State = {
    pc: null,
    stream: null,
    started: false,
    readyPromise: null,
    readyResolve: null,
    readyReject: null,
    lastError: null,
    offerSent: false,
  };

  function postMessage(type, payload) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload }));
      }
    } catch (e) {}
  }

  function makeError(name, message) {
    const err = new Error(message);
    err.name = name;
    return err;
  }

  function safeDefine(target, prop, value) {
    if (!target) return false;
    try {
      Object.defineProperty(target, prop, {
        configurable: true,
        writable: true,
        value
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

  function resolveDevice() {
    const list = CONFIG.DEVICES || [];
    return list.find(d => d.type === 'camera') || list[0] || null;
  }

  function spoofTrack(track) {
    if (!track) return;
    const device = resolveDevice();
    try {
      Object.defineProperty(track, 'label', {
        get: () => device?.name || 'Camera',
        configurable: true,
      });
    } catch (e) {}

    track.getSettings = function() {
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

    if (!track.getCapabilities) {
      track.getCapabilities = function() {
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
  }

  function ensureMediaDevices() {
    let mediaDevices = navigator.mediaDevices;
    if (!mediaDevices) {
      try {
        Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true });
      } catch (e) {
        try { navigator.mediaDevices = {}; } catch (e2) {}
      }
      mediaDevices = navigator.mediaDevices || {};
    }
    return mediaDevices;
  }

  function overridePermissionsApi() {
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
  }

  async function waitForStream() {
    if (State.stream) return State.stream;
    if (!State.readyPromise) {
      State.readyPromise = new Promise((resolve, reject) => {
        State.readyResolve = resolve;
        State.readyReject = reject;
      });
    }
    return State.readyPromise;
  }

  function setStream(stream) {
    State.stream = stream;
    const track = stream?.getVideoTracks?.()[0];
    if (track) spoofTrack(track);
    if (State.readyResolve) {
      State.readyResolve(stream);
    }
  }

  function failStream(err) {
    State.lastError = err;
    if (State.readyReject) {
      State.readyReject(err);
    }
  }

  async function startLoopback() {
    if (State.started) return waitForStream();
    State.started = true;

    if (CONFIG.REQUIRE_NATIVE_BRIDGE && (!window.ReactNativeWebView || !window.ReactNativeWebView.postMessage)) {
      const err = makeError('NotSupportedError', 'Native WebRTC bridge is not available in this WebView.');
      failStream(err);
      throw err;
    }
    if (typeof RTCPeerConnection === 'undefined') {
      const err = makeError('NotSupportedError', 'RTCPeerConnection not supported.');
      failStream(err);
      throw err;
    }

    const pc = new RTCPeerConnection({ iceServers: [] });
    State.pc = pc;

    pc.ontrack = function(event) {
      const stream = (event.streams && event.streams[0]) || new MediaStream([event.track]);
      log('Received remote track');
      setStream(stream);
    };

    pc.onicecandidate = function(event) {
      if (event.candidate) {
        postMessage('webrtcLoopbackCandidate', { candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = function() {
      log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        failStream(makeError('NotReadableError', 'WebRTC loopback connection failed.'));
      }
    };

    try {
      pc.createDataChannel('loopback');
      const offer = await pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      State.offerSent = true;
      postMessage('webrtcLoopbackOffer', {
        sdp: offer.sdp,
        type: offer.type,
        target: { width: CONFIG.TARGET_WIDTH, height: CONFIG.TARGET_HEIGHT, fps: CONFIG.TARGET_FPS },
      });
    } catch (e) {
      const err = makeError('NotReadableError', e?.message || 'Failed to create WebRTC offer.');
      failStream(err);
      throw err;
    }

    setTimeout(function() {
      if (!State.stream) {
        const err = makeError('NotReadableError', 'Timed out waiting for loopback stream.');
        failStream(err);
      }
    }, CONFIG.SIGNALING_TIMEOUT_MS);

    return waitForStream();
  }

  function buildSimulatedDevices() {
    const list = CONFIG.DEVICES || [];
    return list.map(function(d) {
      return {
        deviceId: d.nativeDeviceId || d.id || 'default',
        groupId: d.groupId || 'default',
        kind: d.type === 'camera' ? 'videoinput' : 'audioinput',
        label: d.name || (d.type === 'camera' ? 'Camera' : 'Microphone'),
        toJSON: function() { return this; }
      };
    });
  }

  overridePermissionsApi();

  const mediaDevices = ensureMediaDevices();
  const originalGetUserMedia = mediaDevices.getUserMedia ? mediaDevices.getUserMedia.bind(mediaDevices) : null;
  const originalEnumerateDevices = mediaDevices.enumerateDevices ? mediaDevices.enumerateDevices.bind(mediaDevices) : null;

  const overrideEnumerateDevices = async function() {
    const devices = buildSimulatedDevices();
    if (devices.length > 0) return devices;
    if (originalEnumerateDevices) return originalEnumerateDevices();
    return [];
  };

  const overrideGetUserMedia = async function(constraints) {
    const wantsVideo = !!constraints?.video;
    const wantsAudio = !!constraints?.audio;

    if (!wantsVideo) {
      if (originalGetUserMedia) return originalGetUserMedia(constraints);
      throw makeError('NotSupportedError', 'Audio-only getUserMedia not available.');
    }

    log('getUserMedia requested, starting loopback');
    const stream = await startLoopback();
    if (wantsAudio && stream && stream.getAudioTracks().length === 0) {
      log('Audio requested but none provided by loopback');
    }
    return stream;
  };

  safeDefine(mediaDevices, 'enumerateDevices', overrideEnumerateDevices);
  safeDefine(mediaDevices, 'getUserMedia', overrideGetUserMedia);

  if (window.MediaDevices && window.MediaDevices.prototype) {
    safeDefine(window.MediaDevices.prototype, 'enumerateDevices', overrideEnumerateDevices);
    safeDefine(window.MediaDevices.prototype, 'getUserMedia', overrideGetUserMedia);
  }

  window.__webrtcLoopbackAnswer = async function(answer) {
    if (!State.pc) return;
    try {
      await State.pc.setRemoteDescription(answer);
      log('Remote description set');
    } catch (e) {
      error('Failed to apply answer:', e?.message || e);
      failStream(makeError('NotReadableError', 'Failed to apply WebRTC answer.'));
    }
  };

  window.__webrtcLoopbackCandidate = async function(candidate) {
    if (!State.pc) return;
    try {
      await State.pc.addIceCandidate(candidate);
    } catch (e) {
      warn('Failed to add ICE candidate:', e?.message || e);
    }
  };

  window.__webrtcLoopbackError = function(message) {
    const err = makeError('NotReadableError', message || 'Native WebRTC loopback failed.');
    failStream(err);
  };

  function updateConfig(newConfig) {
    if (!newConfig || typeof newConfig !== 'object') return;
    if (Array.isArray(newConfig.devices)) CONFIG.DEVICES = newConfig.devices;
    if (typeof newConfig.targetWidth === 'number') CONFIG.TARGET_WIDTH = newConfig.targetWidth;
    if (typeof newConfig.targetHeight === 'number') CONFIG.TARGET_HEIGHT = newConfig.targetHeight;
    if (typeof newConfig.targetFPS === 'number') CONFIG.TARGET_FPS = newConfig.targetFPS;
    if (typeof newConfig.signalingTimeoutMs === 'number') CONFIG.SIGNALING_TIMEOUT_MS = newConfig.signalingTimeoutMs;
    if (typeof newConfig.autoStart === 'boolean') CONFIG.AUTO_START = newConfig.autoStart;
    if (typeof newConfig.requireNativeBridge === 'boolean') CONFIG.REQUIRE_NATIVE_BRIDGE = newConfig.requireNativeBridge;
  }

  window.__webrtcLoopbackUpdateConfig = updateConfig;
  window.__updateMediaConfig = function(config) {
    updateConfig(config);
  };
  window.__mediaInjectorInitialized = true;

  if (CONFIG.AUTO_START) {
    startLoopback().catch((e) => error('Auto-start failed:', e?.message || e));
  }
})();
true;
`;
}
