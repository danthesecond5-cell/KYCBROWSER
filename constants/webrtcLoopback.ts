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
  iceServers?: Array<{ urls: string | string[]; username?: string; credential?: string }>;
  preferredCodec?: 'auto' | 'h264' | 'vp8' | 'vp9' | 'av1';
  enableAdaptiveBitrate?: boolean;
  enableAdaptiveResolution?: boolean;
  minBitrateKbps?: number;
  targetBitrateKbps?: number;
  maxBitrateKbps?: number;
  keepAliveIntervalMs?: number;
  statsIntervalMs?: number;
  enableDataChannel?: boolean;
  enableIceRestart?: boolean;
  enableSimulcast?: boolean;
  recordingEnabled?: boolean;
  ringBufferSeconds?: number;
  ringSegmentSeconds?: number;
  cacheRemoteVideos?: boolean;
  cacheTTLHours?: number;
  cacheMaxSizeMB?: number;
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
    iceServers = [],
    preferredCodec = 'auto',
    enableAdaptiveBitrate = true,
    enableAdaptiveResolution = true,
    minBitrateKbps = 300,
    targetBitrateKbps = 1200,
    maxBitrateKbps = 0,
    keepAliveIntervalMs = 5000,
    statsIntervalMs = 4000,
    enableDataChannel = true,
    enableIceRestart = true,
    enableSimulcast = false,
    recordingEnabled = true,
    ringBufferSeconds = 15,
    ringSegmentSeconds = 3,
    cacheRemoteVideos = true,
    cacheTTLHours = 24,
    cacheMaxSizeMB = 1024,
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
    ICE_SERVERS: ${JSON.stringify(iceServers)},
    PREFERRED_CODEC: ${JSON.stringify(preferredCodec)},
    ENABLE_ADAPTIVE_BITRATE: ${enableAdaptiveBitrate},
    ENABLE_ADAPTIVE_RESOLUTION: ${enableAdaptiveResolution},
    MIN_BITRATE_KBPS: ${minBitrateKbps},
    TARGET_BITRATE_KBPS: ${targetBitrateKbps},
    MAX_BITRATE_KBPS: ${maxBitrateKbps},
    KEEPALIVE_INTERVAL_MS: ${keepAliveIntervalMs},
    STATS_INTERVAL_MS: ${statsIntervalMs},
    ENABLE_DATA_CHANNEL: ${enableDataChannel},
    ENABLE_ICE_RESTART: ${enableIceRestart},
    ENABLE_SIMULCAST: ${enableSimulcast},
    RECORDING_ENABLED: ${recordingEnabled},
    RING_BUFFER_SECONDS: ${ringBufferSeconds},
    RING_SEGMENT_SECONDS: ${ringSegmentSeconds},
    CACHE_REMOTE_VIDEOS: ${cacheRemoteVideos},
    CACHE_TTL_HOURS: ${cacheTTLHours},
    CACHE_MAX_SIZE_MB: ${cacheMaxSizeMB},
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
    offerId: null,
    statsInterval: null,
    keepAliveInterval: null,
    remoteVideoTracks: [],
    remoteAudioTrack: null,
    trackAssignments: {},
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

  function getConstraintValue(constraint) {
    if (!constraint) return null;
    if (typeof constraint === 'string') return constraint;
    if (Array.isArray(constraint)) return constraint[0];
    if (typeof constraint === 'object') {
      return constraint.exact || constraint.ideal || null;
    }
    return null;
  }

  function normalizeFacingMode(value) {
    if (!value) return null;
    const v = String(value).toLowerCase();
    if (v.includes('environment') || v.includes('back')) return 'back';
    if (v.includes('user') || v.includes('front')) return 'front';
    return null;
  }

  function selectDevice(devices, reqDeviceId, reqFacing) {
    if (!devices || !devices.length) return null;
    if (reqDeviceId) {
      const byId = devices.find(d => d.id === reqDeviceId || d.nativeDeviceId === reqDeviceId);
      if (byId) return byId;
    }
    if (reqFacing) {
      const byFacing = devices.find(d => normalizeFacingMode(d.facing) === reqFacing);
      if (byFacing) return byFacing;
    }
    return devices.find(d => d.type === 'camera') || devices[0];
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
  function assignTracksToDevices() {
    const devices = (CONFIG.DEVICES || []).filter(d => d.type === 'camera');
    const tracks = State.remoteVideoTracks;
    const assignments = {};
    devices.forEach((device, idx) => {
      const track = tracks[idx] || tracks[0];
      if (track) {
        assignments[device.id] = track;
      }
    });
    State.trackAssignments = assignments;
  }

  function failStream(err) {
    State.lastError = err;
    if (State.readyReject) {
      State.readyReject(err);
    }
  }

  function applyCodecPreferences(transceiver) {
    const preferred = (CONFIG.PREFERRED_CODEC || 'auto').toLowerCase();
    if (preferred === 'auto') return;
    if (!window.RTCRtpReceiver || !RTCRtpReceiver.getCapabilities) return;
    try {
      const caps = RTCRtpReceiver.getCapabilities('video');
      if (!caps || !caps.codecs) return;
      const preferredCodecs = caps.codecs.filter(c => c.mimeType && c.mimeType.toLowerCase().includes(preferred));
      if (preferredCodecs.length === 0) return;
      const others = caps.codecs.filter(c => !preferredCodecs.includes(c));
      if (transceiver && typeof transceiver.setCodecPreferences === 'function') {
        transceiver.setCodecPreferences([...preferredCodecs, ...others]);
      }
    } catch (e) {
      warn('Failed to apply codec preferences:', e?.message || e);
    }
  }

  function startStatsLoop() {
    if (!State.pc || !CONFIG.STATS_INTERVAL_MS) return;
    let last = { frames: 0, ts: 0 };
    State.statsInterval = setInterval(async () => {
      if (!State.pc) return;
      try {
        const report = await State.pc.getStats();
        let inbound = null;
        report.forEach(stat => {
          if (stat.type === 'inbound-rtp' && stat.kind === 'video') inbound = stat;
        });
        if (!inbound) return;
        const frames = inbound.framesDecoded || 0;
        const ts = inbound.timestamp || Date.now();
        const fps = last.ts ? ((frames - last.frames) / ((ts - last.ts) / 1000)) : 0;
        last = { frames, ts };
        postMessage('webrtcLoopbackStats', {
          fps: Number.isFinite(fps) ? Math.max(0, fps) : 0,
          packetsLost: inbound.packetsLost || 0,
          jitter: inbound.jitter || 0,
          bytesReceived: inbound.bytesReceived || 0,
          frameWidth: inbound.frameWidth,
          frameHeight: inbound.frameHeight,
        });
      } catch (e) {
        // ignore
      }
    }, CONFIG.STATS_INTERVAL_MS);
  }

  function startKeepAlive(channel) {
    if (!channel || !CONFIG.KEEPALIVE_INTERVAL_MS) return;
    State.keepAliveInterval = setInterval(() => {
      try {
        channel.send(JSON.stringify({ type: 'ping', t: Date.now() }));
      } catch (e) {}
    }, CONFIG.KEEPALIVE_INTERVAL_MS);
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

    const pc = new RTCPeerConnection({
      iceServers: CONFIG.ICE_SERVERS || [],
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceTransportPolicy: 'all',
    });
    State.pc = pc;

    let videoTransceiver = null;
    let audioTransceiver = null;
    try {
      if (pc.addTransceiver) {
        videoTransceiver = pc.addTransceiver('video', { direction: 'recvonly' });
        audioTransceiver = pc.addTransceiver('audio', { direction: 'recvonly' });
        applyCodecPreferences(videoTransceiver);
      }
    } catch (e) {
      warn('Failed to add transceivers:', e?.message || e);
    }

    pc.ontrack = function(event) {
      const stream = (event.streams && event.streams[0]) || new MediaStream([event.track]);
      if (event.track && event.track.kind === 'video') {
        if (!State.remoteVideoTracks.includes(event.track)) {
          State.remoteVideoTracks.push(event.track);
        }
        assignTracksToDevices();
      } else if (event.track && event.track.kind === 'audio') {
        State.remoteAudioTrack = event.track;
      }
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
        if (CONFIG.ENABLE_ICE_RESTART && typeof pc.restartIce === 'function') {
          try {
            pc.restartIce();
            log('ICE restart triggered');
            return;
          } catch (e) {}
        }
        failStream(makeError('NotReadableError', 'WebRTC loopback connection failed.'));
      }
    };

    try {
      if (CONFIG.ENABLE_DATA_CHANNEL) {
        const channel = pc.createDataChannel('loopback');
        channel.onopen = () => startKeepAlive(channel);
      }
      const offer = await pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      State.offerSent = true;
      const offerId = 'offer_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      State.offerId = offerId;
      postMessage('webrtcLoopbackOffer', {
        offerId,
        sdp: offer.sdp,
        type: offer.type,
        target: { width: CONFIG.TARGET_WIDTH, height: CONFIG.TARGET_HEIGHT, fps: CONFIG.TARGET_FPS },
        config: {
          preferredCodec: CONFIG.PREFERRED_CODEC,
          enableAdaptiveBitrate: CONFIG.ENABLE_ADAPTIVE_BITRATE,
          enableAdaptiveResolution: CONFIG.ENABLE_ADAPTIVE_RESOLUTION,
          minBitrateKbps: CONFIG.MIN_BITRATE_KBPS,
          targetBitrateKbps: CONFIG.TARGET_BITRATE_KBPS,
          maxBitrateKbps: CONFIG.MAX_BITRATE_KBPS,
          enableSimulcast: CONFIG.ENABLE_SIMULCAST,
          recordingEnabled: CONFIG.RECORDING_ENABLED,
          ringBufferSeconds: CONFIG.RING_BUFFER_SECONDS,
          ringSegmentSeconds: CONFIG.RING_SEGMENT_SECONDS,
          cacheRemoteVideos: CONFIG.CACHE_REMOTE_VIDEOS,
          cacheTTLHours: CONFIG.CACHE_TTL_HOURS,
          cacheMaxSizeMB: CONFIG.CACHE_MAX_SIZE_MB,
          iceServers: CONFIG.ICE_SERVERS,
        },
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

    startStatsLoop();
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

    const devices = (CONFIG.DEVICES || []).filter(d => d.type === 'camera');
    const reqDeviceId = typeof constraints.video === 'object' ? getConstraintValue(constraints.video.deviceId) : null;
    const reqFacing = typeof constraints.video === 'object' ? normalizeFacingMode(getConstraintValue(constraints.video.facingMode)) : null;
    const selectedDevice = selectDevice(devices, reqDeviceId, reqFacing);
    const selectedTrack = selectedDevice ? State.trackAssignments[selectedDevice.id] : null;

    if (selectedTrack) {
      const tracks = [selectedTrack];
      if (wantsAudio && State.remoteAudioTrack) {
        tracks.push(State.remoteAudioTrack);
      }
      return new MediaStream(tracks);
    }

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

  function stopLoopback() {
    if (State.keepAliveInterval) {
      clearInterval(State.keepAliveInterval);
      State.keepAliveInterval = null;
    }
    if (State.statsInterval) {
      clearInterval(State.statsInterval);
      State.statsInterval = null;
    }
    if (State.pc) {
      try { State.pc.close(); } catch (e) {}
      State.pc = null;
    }
    State.stream = null;
    State.started = false;
    State.offerSent = false;
    State.offerId = null;
    State.readyPromise = null;
    State.readyResolve = null;
    State.readyReject = null;
  }

  function updateConfig(newConfig) {
    if (!newConfig || typeof newConfig !== 'object') return;
    if (Array.isArray(newConfig.devices)) {
      CONFIG.DEVICES = newConfig.devices;
      assignTracksToDevices();
    }
    if (typeof newConfig.targetWidth === 'number') CONFIG.TARGET_WIDTH = newConfig.targetWidth;
    if (typeof newConfig.targetHeight === 'number') CONFIG.TARGET_HEIGHT = newConfig.targetHeight;
    if (typeof newConfig.targetFPS === 'number') CONFIG.TARGET_FPS = newConfig.targetFPS;
    if (typeof newConfig.signalingTimeoutMs === 'number') CONFIG.SIGNALING_TIMEOUT_MS = newConfig.signalingTimeoutMs;
    if (typeof newConfig.autoStart === 'boolean') CONFIG.AUTO_START = newConfig.autoStart;
    if (typeof newConfig.requireNativeBridge === 'boolean') CONFIG.REQUIRE_NATIVE_BRIDGE = newConfig.requireNativeBridge;
    if (Array.isArray(newConfig.iceServers)) CONFIG.ICE_SERVERS = newConfig.iceServers;
    if (typeof newConfig.preferredCodec === 'string') CONFIG.PREFERRED_CODEC = newConfig.preferredCodec;
    if (typeof newConfig.enableAdaptiveBitrate === 'boolean') CONFIG.ENABLE_ADAPTIVE_BITRATE = newConfig.enableAdaptiveBitrate;
    if (typeof newConfig.enableAdaptiveResolution === 'boolean') CONFIG.ENABLE_ADAPTIVE_RESOLUTION = newConfig.enableAdaptiveResolution;
    if (typeof newConfig.minBitrateKbps === 'number') CONFIG.MIN_BITRATE_KBPS = newConfig.minBitrateKbps;
    if (typeof newConfig.targetBitrateKbps === 'number') CONFIG.TARGET_BITRATE_KBPS = newConfig.targetBitrateKbps;
    if (typeof newConfig.maxBitrateKbps === 'number') CONFIG.MAX_BITRATE_KBPS = newConfig.maxBitrateKbps;
    if (typeof newConfig.keepAliveIntervalMs === 'number') CONFIG.KEEPALIVE_INTERVAL_MS = newConfig.keepAliveIntervalMs;
    if (typeof newConfig.statsIntervalMs === 'number') CONFIG.STATS_INTERVAL_MS = newConfig.statsIntervalMs;
    if (typeof newConfig.enableDataChannel === 'boolean') CONFIG.ENABLE_DATA_CHANNEL = newConfig.enableDataChannel;
    if (typeof newConfig.enableIceRestart === 'boolean') CONFIG.ENABLE_ICE_RESTART = newConfig.enableIceRestart;
    if (typeof newConfig.enableSimulcast === 'boolean') CONFIG.ENABLE_SIMULCAST = newConfig.enableSimulcast;
    if (typeof newConfig.recordingEnabled === 'boolean') CONFIG.RECORDING_ENABLED = newConfig.recordingEnabled;
    if (typeof newConfig.ringBufferSeconds === 'number') CONFIG.RING_BUFFER_SECONDS = newConfig.ringBufferSeconds;
    if (typeof newConfig.ringSegmentSeconds === 'number') CONFIG.RING_SEGMENT_SECONDS = newConfig.ringSegmentSeconds;
    if (typeof newConfig.cacheRemoteVideos === 'boolean') CONFIG.CACHE_REMOTE_VIDEOS = newConfig.cacheRemoteVideos;
    if (typeof newConfig.cacheTTLHours === 'number') CONFIG.CACHE_TTL_HOURS = newConfig.cacheTTLHours;
    if (typeof newConfig.cacheMaxSizeMB === 'number') CONFIG.CACHE_MAX_SIZE_MB = newConfig.cacheMaxSizeMB;

    if (State.pc && newConfig.iceServers) {
      try {
        State.pc.restartIce?.();
      } catch (e) {}
    }
  }

  window.__webrtcLoopbackUpdateConfig = updateConfig;
  window.__updateMediaConfig = function(config) {
    updateConfig(config);
  };
  window.__webrtcLoopbackStop = stopLoopback;
  window.__webrtcLoopbackRestart = function() {
    stopLoopback();
    return startLoopback();
  };
  window.__mediaInjectorInitialized = true;

  if (CONFIG.AUTO_START) {
    startLoopback().catch((e) => error('Auto-start failed:', e?.message || e));
  }
})();
true;
`;
}
