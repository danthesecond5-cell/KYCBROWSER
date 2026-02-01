import type { CaptureDevice } from '@/types/device';
import {
  IPHONE_15_PRO_PROFILE,
  REALISTIC_TIMING,
  CANVAS_STEALTH_CONFIG,
  AUDIO_STEALTH_CONFIG,
  WEBRTC_STEALTH_CONFIG,
  STEALTH_DETECTION_CHECKS,
  PROPERTIES_TO_DELETE,
} from './stealthProfiles';
import { BUILT_IN_VIDEO_INJECTION_SCRIPT } from './builtInTestVideo';

export const SAFARI_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

export const IPHONE_DEFAULT_PORTRAIT_RESOLUTION = {
  width: 1080,
  height: 1920,
  fps: 30,
  aspectRatio: '9:16',
};

export const SAFARI_SPOOFING_SCRIPT = `
(function() {
  if (typeof window === 'undefined') return;
  if (!window.navigator) return;
  if (window.__safariSpooferInitialized) return;
  window.__safariSpooferInitialized = true;
  
  // ============ STEALTH CONFIGURATION ============
  const PROFILE = ${JSON.stringify(IPHONE_15_PRO_PROFILE)};
  const TIMING = ${JSON.stringify(REALISTIC_TIMING)};
  const CANVAS_CONFIG = ${JSON.stringify(CANVAS_STEALTH_CONFIG)};
  const AUDIO_CONFIG = ${JSON.stringify(AUDIO_STEALTH_CONFIG)};
  const WEBRTC_CONFIG = ${JSON.stringify(WEBRTC_STEALTH_CONFIG)};
  const DETECTION_CHECKS = ${JSON.stringify(STEALTH_DETECTION_CHECKS)};
  const PROPS_TO_DELETE = ${JSON.stringify(PROPERTIES_TO_DELETE)};
  
  // ============ UTILITY FUNCTIONS ============
  const getRandomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const addJitter = (value, percent) => value + (value * (percent / 100) * (Math.random() * 2 - 1));
  
  // Consistent noise generator for canvas fingerprinting
  let noiseSeed = Date.now() % 1000000;
  const consistentNoise = (x, y) => {
    const n = Math.sin(noiseSeed * 12.9898 + x * 78.233 + y * 43.1234) * 43758.5453;
    return (n - Math.floor(n)) * 2 - 1;
  };
  
  // ============ NAVIGATOR SPOOFING ============
  const navigatorOverrides = {
    userAgent: PROFILE.navigator.userAgent,
    appVersion: '5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    platform: PROFILE.navigator.platform,
    vendor: PROFILE.navigator.vendor,
    appName: 'Netscape',
    appCodeName: 'Mozilla',
    product: 'Gecko',
    productSub: '20030107',
    language: PROFILE.navigator.language,
    languages: Object.freeze(PROFILE.navigator.languages),
    onLine: true,
    cookieEnabled: true,
    doNotTrack: null,
    maxTouchPoints: PROFILE.navigator.maxTouchPoints,
    hardwareConcurrency: PROFILE.navigator.hardwareConcurrency,
    deviceMemory: PROFILE.navigator.deviceMemory,
    webdriver: false,
    pdfViewerEnabled: false,
    scheduling: undefined,
  };
  
  for (const [key, value] of Object.entries(navigatorOverrides)) {
    try {
      Object.defineProperty(navigator, key, {
        get: () => value,
        configurable: true,
        enumerable: true
      });
    } catch(e) {}
  }
  
  // ============ SAFARI OBJECT ============
  if (!window.safari) {
    window.safari = {
      pushNotification: {
        permission: function() { return 'default'; },
        requestPermission: function() {},
        toString: function() { return '[object SafariRemoteNotification]'; }
      },
      toString: function() { return '[object Safari]'; }
    };
    Object.freeze(window.safari);
  }
  
  // ============ SCREEN SPOOFING ============
  try {
    const screenProps = {
      width: { get: () => PROFILE.screen.width },
      height: { get: () => PROFILE.screen.height },
      availWidth: { get: () => PROFILE.screen.availWidth },
      availHeight: { get: () => PROFILE.screen.availHeight },
      colorDepth: { get: () => PROFILE.screen.colorDepth },
      pixelDepth: { get: () => PROFILE.screen.pixelDepth },
    };
    for (const [prop, descriptor] of Object.entries(screenProps)) {
      try {
        Object.defineProperty(screen, prop, { ...descriptor, configurable: true });
      } catch(e) {}
    }
    Object.defineProperty(window, 'devicePixelRatio', {
      get: () => PROFILE.screen.devicePixelRatio,
      configurable: true
    });
  } catch(e) {}
  
  // ============ WEBGL FINGERPRINT SPOOFING ============
  const hasCanvas = typeof HTMLCanvasElement !== 'undefined' &&
    HTMLCanvasElement.prototype &&
    typeof HTMLCanvasElement.prototype.getContext === 'function';
  if (hasCanvas) {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, attributes) {
      const context = originalGetContext.call(this, type, attributes);
    
    if (context && (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl')) {
      const originalGetParameter = context.getParameter.bind(context);
      const originalGetExtension = context.getExtension.bind(context);
      const originalGetShaderPrecisionFormat = context.getShaderPrecisionFormat?.bind(context);
      
      context.getParameter = function(param) {
        // UNMASKED_VENDOR_WEBGL
        if (param === 37445) return PROFILE.webgl.unmaskedVendor;
        // UNMASKED_RENDERER_WEBGL
        if (param === 37446) return PROFILE.webgl.unmaskedRenderer;
        // VENDOR
        if (param === 7936) return PROFILE.webgl.vendor;
        // RENDERER
        if (param === 7937) return PROFILE.webgl.renderer;
        // VERSION
        if (param === 7938) return PROFILE.webgl.version;
        // SHADING_LANGUAGE_VERSION
        if (param === 35724) return PROFILE.webgl.shadingLanguageVersion;
        // MAX_TEXTURE_SIZE - common iOS value
        if (param === 3379) return 16384;
        // MAX_VIEWPORT_DIMS
        if (param === 3386) return new Int32Array([16384, 16384]);
        // MAX_RENDERBUFFER_SIZE
        if (param === 34024) return 16384;
        // ALIASED_LINE_WIDTH_RANGE
        if (param === 33902) return new Float32Array([1, 1]);
        // ALIASED_POINT_SIZE_RANGE
        if (param === 33901) return new Float32Array([1, 511]);
        return originalGetParameter(param);
      };
      
      context.getExtension = function(name) {
        if (name === 'WEBGL_debug_renderer_info') {
          return {
            UNMASKED_VENDOR_WEBGL: 37445,
            UNMASKED_RENDERER_WEBGL: 37446
          };
        }
        return originalGetExtension(name);
      };
      
      if (originalGetShaderPrecisionFormat) {
        context.getShaderPrecisionFormat = function(shaderType, precisionType) {
          // Return consistent precision format for iOS
          const result = originalGetShaderPrecisionFormat(shaderType, precisionType);
          if (result) {
            return {
              rangeMin: result.rangeMin,
              rangeMax: result.rangeMax,
              precision: Math.min(result.precision, 23) // iOS typical precision
            };
          }
          return result;
        };
      }
    }
    
      return context;
    };
  }
  
  // ============ CANVAS FINGERPRINT PROTECTION ============
  if (CANVAS_CONFIG.addNoise &&
      typeof CanvasRenderingContext2D !== 'undefined' &&
      CanvasRenderingContext2D.prototype &&
      typeof CanvasRenderingContext2D.prototype.getImageData === 'function') {
    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {
      const imageData = originalGetImageData.call(this, sx, sy, sw, sh);
      if (CANVAS_CONFIG.modifyGetImageData) {
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const x = (i / 4) % sw;
          const y = Math.floor((i / 4) / sw);
          const noise = consistentNoise(x + sx, y + sy) * CANVAS_CONFIG.noiseIntensity * 255;
          data[i] = Math.max(0, Math.min(255, data[i] + noise));
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise * 0.9));
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise * 1.1));
        }
      }
      return imageData;
    };
    
    if (hasCanvas && typeof HTMLCanvasElement.prototype.toDataURL === 'function') {
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
        if (CANVAS_CONFIG.modifyToDataURL && this.width > 0 && this.height > 0) {
          try {
            const ctx = this.getContext('2d');
            if (ctx) {
              const imageData = ctx.getImageData(0, 0, this.width, this.height);
              ctx.putImageData(imageData, 0, 0);
            }
          } catch(e) {}
        }
        return originalToDataURL.call(this, type, quality);
      };
    }
  }
  
  // ============ AUDIO FINGERPRINT PROTECTION ============
  if (AUDIO_CONFIG.modifyAnalyserNode &&
      typeof AnalyserNode !== 'undefined' &&
      AnalyserNode.prototype) {
    const originalAnalyserGetFloatFrequencyData = AnalyserNode.prototype.getFloatFrequencyData;
    const originalAnalyserGetByteFrequencyData = AnalyserNode.prototype.getByteFrequencyData;
    
    AnalyserNode.prototype.getFloatFrequencyData = function(array) {
      originalAnalyserGetFloatFrequencyData.call(this, array);
      if (AUDIO_CONFIG.addMicroVariations) {
        for (let i = 0; i < array.length; i++) {
          array[i] += (Math.random() - 0.5) * 0.0001;
        }
      }
    };
    
    AnalyserNode.prototype.getByteFrequencyData = function(array) {
      originalAnalyserGetByteFrequencyData.call(this, array);
      if (AUDIO_CONFIG.addMicroVariations) {
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.max(0, Math.min(255, array[i] + Math.floor((Math.random() - 0.5) * 2)));
        }
      }
    };
  }
  
  if (AUDIO_CONFIG.modifyOscillator) {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (AudioContextCtor && AudioContextCtor.prototype && AudioContextCtor.prototype.createOscillator) {
      const originalCreateOscillator = AudioContextCtor.prototype.createOscillator;
      AudioContextCtor.prototype.createOscillator = function() {
        const osc = originalCreateOscillator.call(this);
        const originalStart = osc.start.bind(osc);
        osc.start = function(when) {
          // Add tiny timing variation
          const jitter = AUDIO_CONFIG.addMicroVariations ? (Math.random() - 0.5) * 0.0001 : 0;
          return originalStart(when ? when + jitter : when);
        };
        return osc;
      };
    }
  }
  
  // ============ WEBRTC LEAK PREVENTION ============
  if (WEBRTC_CONFIG.blockLocalIPs) {
    const RTCPeerConnectionCtor = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
    if (RTCPeerConnectionCtor) {
      const createIceCandidateEvent = function() {
        try {
          if (typeof RTCPeerConnectionIceEvent !== 'undefined') {
            return new RTCPeerConnectionIceEvent('icecandidate', { candidate: null });
          }
        } catch(e) {}
        try {
          if (typeof Event === 'function') {
            const evt = new Event('icecandidate');
            evt.candidate = null;
            return evt;
          }
        } catch(e) {}
        return { candidate: null };
      };
      
      window.RTCPeerConnection = function(config) {
        // Filter out STUN servers if configured
        if (config && config.iceServers && WEBRTC_CONFIG.disableSTUN) {
          config.iceServers = config.iceServers.filter(server => {
            const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
            return !urls.some(url => url && url.startsWith('stun:'));
          });
        }
        
        const pc = new RTCPeerConnectionCtor(config);
        
        // Intercept ICE candidates to block local IPs
        const originalAddEventListener = pc.addEventListener.bind(pc);
        pc.addEventListener = function(type, listener, options) {
          if (type === 'icecandidate') {
            const wrappedListener = function(event) {
              if (event.candidate && event.candidate.candidate) {
                const candidate = event.candidate.candidate;
                // Block local IP addresses
                const localIpPattern = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/gi;
                const matches = candidate.match(localIpPattern);
                if (matches) {
                  for (const ip of matches) {
                    if (ip.startsWith('192.168.') || ip.startsWith('10.') || 
                        ip.startsWith('172.16.') || ip.startsWith('172.17.') ||
                        ip.startsWith('172.18.') || ip.startsWith('172.19.') ||
                        ip.startsWith('172.2') || ip.startsWith('172.30.') ||
                        ip.startsWith('172.31.') || ip === '127.0.0.1' ||
                        ip.startsWith('169.254.') || ip.startsWith('::1') ||
                        ip.startsWith('fe80:') || ip.startsWith('fc') ||
                        ip.startsWith('fd')) {
                      // Create modified event without local IP
                      const modifiedEvent = createIceCandidateEvent();
                      return listener.call(this, modifiedEvent);
                    }
                  }
                }
              }
              return listener.call(this, event);
            };
            return originalAddEventListener(type, wrappedListener, options);
          }
          return originalAddEventListener(type, listener, options);
        };
        
        return pc;
      };
      window.RTCPeerConnection.prototype = RTCPeerConnectionCtor.prototype;
    }
  }
  
  // ============ PERMISSION API SPOOFING ============
  if (navigator.permissions) {
    const originalQuery = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = async function(permissionDesc) {
      // Add realistic delay
      await new Promise(r => setTimeout(r, getRandomDelay(5, 20)));
      
      try {
        const result = await originalQuery(permissionDesc);
        // Spoof camera/microphone as granted for stealth
        if (permissionDesc.name === 'camera' || permissionDesc.name === 'microphone') {
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
      } catch(e) {
        throw e;
      }
    };
  }
  
  // ============ BATTERY API BLOCKING ============
  try {
    Object.defineProperty(navigator, 'getBattery', {
      get: () => undefined,
      configurable: true
    });
  } catch(e) {}
  
  // ============ NETWORK INFO BLOCKING ============
  try {
    Object.defineProperty(navigator, 'connection', {
      get: () => undefined,
      configurable: true
    });
  } catch(e) {}
  
  // ============ PLUGINS/MIMETYPES SPOOFING ============
  try {
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const plugins = [];
        plugins.item = () => null;
        plugins.namedItem = () => null;
        plugins.refresh = () => {};
        Object.defineProperty(plugins, 'length', { value: 0 });
        return plugins;
      },
      configurable: true
    });
  } catch(e) {}
  
  try {
    Object.defineProperty(navigator, 'mimeTypes', {
      get: () => {
        const mimeTypes = [];
        mimeTypes.item = () => null;
        mimeTypes.namedItem = () => null;
        Object.defineProperty(mimeTypes, 'length', { value: 0 });
        return mimeTypes;
      },
      configurable: true
    });
  } catch(e) {}
  
  // ============ AUTOMATION DETECTION CLEANUP ============
  // Delete automation markers
  PROPS_TO_DELETE.forEach(prop => {
    try { delete window[prop]; } catch(e) {}
  });
  
  // Hide Chrome/automation
  try {
    Object.defineProperty(window, 'chrome', { get: () => undefined, configurable: true });
  } catch(e) {}
  
  window.InstallTrigger = undefined;
  window.opr = undefined;
  
  // ============ PROTOTYPE PROTECTION ============
  // Protect native function toString
  const originalToString = Function.prototype.toString;
  const nativeCodePattern = /^function\s*\w*\s*\([^)]*\)\s*\{\s*\[native code\]\s*\}$/;
  
  Function.prototype.toString = function() {
    const result = originalToString.call(this);
    // For overridden functions, return native-looking string
    if (this === navigator.mediaDevices?.getUserMedia ||
        this === navigator.mediaDevices?.enumerateDevices ||
        this === HTMLCanvasElement.prototype.getContext ||
        this === CanvasRenderingContext2D.prototype.getImageData) {
      return 'function ' + (this.name || '') + '() { [native code] }';
    }
    return result;
  };
  
  // ============ DATE/TIMING CONSISTENCY ============
  // Ensure consistent timezone
  const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
  Date.prototype.getTimezoneOffset = function() {
    // Return typical US timezone offset for consistency
    return originalGetTimezoneOffset.call(this);
  };
  
  // ============ TOUCH EVENT CONSISTENCY ============
  try {
    Object.defineProperty(navigator, 'maxTouchPoints', {
      get: () => PROFILE.navigator.maxTouchPoints,
      configurable: true
    });
    
    // Ensure touch events look natural
    if (!('ontouchstart' in window)) {
      window.ontouchstart = null;
    }
  } catch(e) {}
  
  console.log('[Safari Spoofer] Advanced stealth mode active');
  console.log('[Safari Spoofer] - Navigator fingerprint: spoofed');
  console.log('[Safari Spoofer] - WebGL fingerprint: spoofed');
  console.log('[Safari Spoofer] - Canvas fingerprint: protected');
  console.log('[Safari Spoofer] - Audio fingerprint: protected');
  console.log('[Safari Spoofer] - WebRTC leaks: blocked');
  console.log('[Safari Spoofer] - Automation markers: cleaned');
})();
true;
`;

export const NO_SPOOFING_SCRIPT = `
(function() {
  console.log('[Safari Spoofer] Spoofing disabled');
})();
true;
`;

export const MOTION_INJECTION_SCRIPT = `
(function() {
  if (typeof window === 'undefined') return;
  if (window.__motionInjectorInitialized) return;
  window.__motionInjectorInitialized = true;
  
  const createFallbackEvent = function(type, payload) {
    try {
      if (typeof Event === 'function') {
        const evt = new Event(type);
        if (payload && typeof payload === 'object') {
          Object.keys(payload).forEach(function(key) { evt[key] = payload[key]; });
        }
        return evt;
      }
    } catch (e) {}
    return null;
  };
  
  const createMotionEvent = function(payload) {
    try {
      if (typeof DeviceMotionEvent === 'function') {
        return new DeviceMotionEvent('devicemotion', payload);
      }
    } catch (e) {}
    return createFallbackEvent('devicemotion', payload);
  };
  
  const createOrientationEvent = function(payload) {
    try {
      if (typeof DeviceOrientationEvent === 'function') {
        return new DeviceOrientationEvent('deviceorientation', payload);
      }
    } catch (e) {}
    return createFallbackEvent('deviceorientation', payload);
  };
  
  window.__simulatedMotion = {
    acceleration: { x: 0, y: 0, z: 9.8 },
    accelerationIncludingGravity: { x: 0, y: 0, z: 9.8 },
    rotationRate: { alpha: 0, beta: 0, gamma: 0 },
    orientation: { alpha: 0, beta: 0, gamma: 0 },
    interval: 16,
    active: false
  };
  
  window.__updateMotionData = function(data) {
    window.__simulatedMotion = { ...window.__simulatedMotion, ...data };
    
    if (window.__simulatedMotion.active) {
      const motionEvent = createMotionEvent({
        acceleration: window.__simulatedMotion.acceleration,
        accelerationIncludingGravity: window.__simulatedMotion.accelerationIncludingGravity,
        rotationRate: window.__simulatedMotion.rotationRate,
        interval: window.__simulatedMotion.interval
      });
      if (motionEvent) window.dispatchEvent(motionEvent);
      
      const orientEvent = createOrientationEvent({
        alpha: window.__simulatedMotion.orientation.alpha,
        beta: window.__simulatedMotion.orientation.beta,
        gamma: window.__simulatedMotion.orientation.gamma,
        absolute: false
      });
      if (orientEvent) window.dispatchEvent(orientEvent);
    }
  };
  
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('message', function(e) {
      try {
        if (typeof e.data !== 'string' || !e.data.startsWith('{')) return;
        const data = JSON.parse(e.data);
        if (data && data.type === 'motion') {
          window.__updateMotionData(data.payload);
        }
      } catch(err) {}
    });
  }
  
  window.addEventListener('message', function(e) {
    try {
      if (!e.data) return;
      let data;
      if (typeof e.data === 'string') {
        if (!e.data.startsWith('{')) return;
        data = JSON.parse(e.data);
      } else {
        data = e.data;
      }
      if (data && data.type === 'motion') {
        window.__updateMotionData(data.payload);
      }
    } catch(err) {}
  });
  
  console.log('[Motion Dev] Motion injector initialized');
})();
true;
`;

export const CONSOLE_CAPTURE_SCRIPT = `
(function() {
  if (window.__consoleCaptureInitialized) return;
  window.__consoleCaptureInitialized = true;
  
  const originalConsole = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console)
  };
  
  function sendToRN(level, args) {
    try {
      const message = args.map(arg => {
        if (arg === null) return 'null';
        if (arg === undefined) return 'undefined';
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
      
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'console',
          level: level,
          message: message
        }));
      }
    } catch (e) {}
  }
  
  console.log = function(...args) {
    originalConsole.log(...args);
    sendToRN('log', args);
  };
  
  console.warn = function(...args) {
    originalConsole.warn(...args);
    sendToRN('warn', args);
  };
  
  console.error = function(...args) {
    originalConsole.error(...args);
    sendToRN('error', args);
  };
  
  console.info = function(...args) {
    originalConsole.info(...args);
    sendToRN('info', args);
  };
  
  console.debug = function(...args) {
    originalConsole.debug(...args);
    sendToRN('debug', args);
  };
  
  window.onerror = function(message, source, lineno, colno, error) {
    sendToRN('error', ['[Window Error]', message, 'at', source + ':' + lineno + ':' + colno]);
    return false;
  };
  
  window.onunhandledrejection = function(event) {
    sendToRN('error', ['[Unhandled Promise Rejection]', event.reason]);
  };
})();
true;
`;

export interface MediaInjectionOptions {
  stealthMode?: boolean;
  fallbackVideoUri?: string | null;
  forceSimulation?: boolean;
  protocolId?: string;
  protocolLabel?: string;
  showOverlayLabel?: boolean;
  loopVideo?: boolean;
  mirrorVideo?: boolean;
  debugEnabled?: boolean;
  permissionPromptEnabled?: boolean;
}

export const createMediaInjectionScript = (
  devices: CaptureDevice[],
  options: MediaInjectionOptions = {}
): string => {
  const {
    stealthMode = true,
    fallbackVideoUri = null,
    forceSimulation = false,
    protocolId = 'standard',
    protocolLabel = '',
    showOverlayLabel = false,
    loopVideo = true,
    mirrorVideo = false,
    debugEnabled,
    permissionPromptEnabled = true,
  } = options;
  const frontCamera = devices.find(d => d.facing === 'front' && d.type === 'camera');
  const defaultRes = frontCamera?.capabilities?.videoResolutions?.[0];
  
  const placeholderWidth = defaultRes?.width || IPHONE_DEFAULT_PORTRAIT_RESOLUTION.width;
  const placeholderHeight = defaultRes?.height || IPHONE_DEFAULT_PORTRAIT_RESOLUTION.height;

  // Include the built-in video injection script for fallback
  const builtInVideoScript = BUILT_IN_VIDEO_INJECTION_SCRIPT;

  return `
// ===== BUILT-IN VIDEO SYSTEM =====
${builtInVideoScript}

(function() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__mediaInjectorInitialized) {
    console.log('[MediaSim] Already initialized, updating config');
    if (window.__updateMediaConfig) {
      window.__updateMediaConfig({
        devices: ${JSON.stringify(devices)},
        stealthMode: ${stealthMode},
        fallbackVideoUri: ${JSON.stringify(fallbackVideoUri)},
        forceSimulation: ${forceSimulation ? 'true' : 'false'},
        protocolId: ${JSON.stringify(protocolId)},
        overlayLabelText: ${JSON.stringify(protocolLabel)},
        showOverlayLabel: ${showOverlayLabel ? 'true' : 'false'},
        loopVideo: ${loopVideo ? 'true' : 'false'},
        mirrorVideo: ${mirrorVideo ? 'true' : 'false'},
        debugEnabled: ${debugEnabled === undefined ? 'undefined' : JSON.stringify(debugEnabled)},
        permissionPromptEnabled: ${permissionPromptEnabled ? 'true' : 'false'}
      });
    }
    return;
  }
  window.__mediaInjectorInitialized = true;
  
  // ============ CONFIGURATION ============
  const CONFIG = {
    DEBUG_ENABLED: ${debugEnabled === undefined ? 'true' : JSON.stringify(debugEnabled)},
    FALLBACK_VIDEO_URI: ${JSON.stringify(fallbackVideoUri)},
    FORCE_SIMULATION: ${forceSimulation ? 'true' : 'false'},
    PROTOCOL_ID: ${JSON.stringify(protocolId)},
    PROTOCOL_LABEL: ${JSON.stringify(protocolLabel)},
    SHOW_OVERLAY_LABEL: ${showOverlayLabel ? 'true' : 'false'},
    LOOP_VIDEO: ${loopVideo ? 'true' : 'false'},
    MIRROR_VIDEO: ${mirrorVideo ? 'true' : 'false'},
    PERMISSION_PROMPT_ENABLED: ${permissionPromptEnabled ? 'true' : 'false'},
    PORTRAIT_WIDTH: ${IPHONE_DEFAULT_PORTRAIT_RESOLUTION.width},
    PORTRAIT_HEIGHT: ${IPHONE_DEFAULT_PORTRAIT_RESOLUTION.height},
    TARGET_FPS: ${IPHONE_DEFAULT_PORTRAIT_RESOLUTION.fps},
    VIDEO_LOAD_TIMEOUT: 12000,
    MAX_RETRY_ATTEMPTS: 4,
    INITIAL_RETRY_DELAY: 500,
    HEALTH_CHECK_INTERVAL: 5000,
    MIN_ACCEPTABLE_FPS: 15,
    CORS_STRATEGIES: ['anonymous', 'use-credentials', null],
    PERFORMANCE_SAMPLE_SIZE: 60,
    QUALITY_HIGH_FPS_THRESHOLD: 25,
    QUALITY_MEDIUM_FPS_THRESHOLD: 18,
    QUALITY_LOW_FPS_THRESHOLD: 12,
    QUALITY_ADAPTATION_INTERVAL: 3000,
    QUALITY_LEVELS: [
      { name: 'high', scale: 1.0, fps: 30 },
      { name: 'medium', scale: 0.75, fps: 24 },
      { name: 'low', scale: 0.5, fps: 15 },
    ],
    MAX_ACTIVE_STREAMS: 3,
    CLEANUP_DELAY: 100,
  };
  
  // ============ EXPO/WEBVIEW COMPATIBILITY ============
  if (!window.performance) {
    window.performance = { now: function() { return Date.now(); } };
  } else if (typeof window.performance.now !== 'function') {
    window.performance.now = function() { return Date.now(); };
  }
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = function(cb) { return setTimeout(function() { cb(Date.now()); }, 16); };
  }
  if (!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = function(id) { clearTimeout(id); };
  }
  
  function safeRemoveElement(el) {
    if (!el) return;
    try {
      if (typeof el.remove === 'function') {
        el.remove();
        return;
      }
    } catch (e) {}
    try {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    } catch (e) {}
  }
  
  function getCanvasStream(canvas, fps) {
    if (!canvas) return null;
    const capture = canvas.captureStream || canvas.mozCaptureStream || canvas.webkitCaptureStream;
    if (!capture) return null;
    try {
      return capture.call(canvas, fps);
    } catch (e) {
      try {
        return capture.call(canvas);
      } catch (e2) {
        return null;
      }
    }
  }
  
  // ============ LOGGING SYSTEM ============
  const Logger = {
    enabled: CONFIG.DEBUG_ENABLED,
    prefix: '[MediaSim]',
    
    log: function(...args) {
      if (this.enabled) console.log(this.prefix, ...args);
    },
    warn: function(...args) {
      if (this.enabled) console.warn(this.prefix, ...args);
    },
    error: function(...args) {
      console.error(this.prefix, ...args);
    },
    metric: function(name, value, unit) {
      if (this.enabled) console.log(this.prefix, '[METRIC]', name + ':', value, unit || '');
    },
    setEnabled: function(enabled) {
      this.enabled = enabled;
    }
  };

  function notifyReady(source) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'mediaInjectionReady',
        payload: {
          protocol: CONFIG.PROTOCOL_ID,
          source: source,
          fallback: CONFIG.FALLBACK_VIDEO_URI,
          forceSimulation: CONFIG.FORCE_SIMULATION,
          timestamp: Date.now()
        }
      }));
    }
  }
  
  Logger.log('======== WEBCAM SIMULATION INIT ========');
  Logger.log('Protocol:', CONFIG.PROTOCOL_ID, '| Devices:', ${devices.length}, '| Stealth:', ${stealthMode}, '| ForceSim:', CONFIG.FORCE_SIMULATION);
  
  // ============ METRICS TRACKING ============
  const Metrics = {
    videoLoadStartTime: 0,
    videoLoadEndTime: 0,
    frameCount: 0,
    lastFrameTime: 0,
    fpsHistory: [],
    errorCount: 0,
    retryCount: 0,
    successfulLoads: 0,
    failedLoads: 0,
    
    startVideoLoad: function() {
      this.videoLoadStartTime = performance.now();
    },
    endVideoLoad: function(success) {
      this.videoLoadEndTime = performance.now();
      const loadTime = this.videoLoadEndTime - this.videoLoadStartTime;
      Logger.metric('Video Load Time', loadTime.toFixed(2), 'ms');
      if (success) this.successfulLoads++;
      else this.failedLoads++;
    },
    recordFrame: function() {
      const now = performance.now();
      if (this.lastFrameTime > 0) {
        const delta = now - this.lastFrameTime;
        const fps = 1000 / delta;
        this.fpsHistory.push(fps);
        if (this.fpsHistory.length > CONFIG.PERFORMANCE_SAMPLE_SIZE) {
          this.fpsHistory.shift();
        }
      }
      this.lastFrameTime = now;
      this.frameCount++;
    },
    getAverageFps: function() {
      if (this.fpsHistory.length === 0) return 0;
      const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
      return sum / this.fpsHistory.length;
    },
    getSummary: function() {
      return {
        avgFps: this.getAverageFps().toFixed(1),
        totalFrames: this.frameCount,
        successfulLoads: this.successfulLoads,
        failedLoads: this.failedLoads,
        retryCount: this.retryCount,
        errorCount: this.errorCount,
      };
    }
  };
  
  // ============ STREAM REGISTRY (Memory Management) ============
  const StreamRegistry = {
    activeStreams: new Map(),
    cleanupCallbacks: [],
    
    register: function(streamId, stream, cleanup) {
      if (this.activeStreams.size >= CONFIG.MAX_ACTIVE_STREAMS) {
        Logger.warn('Max active streams reached, cleaning oldest...');
        const oldestKey = this.activeStreams.keys().next().value;
        this.unregister(oldestKey);
      }
      this.activeStreams.set(streamId, { stream, cleanup, createdAt: Date.now() });
      Logger.log('Stream registered:', streamId, '| Active:', this.activeStreams.size);
    },
    
    unregister: function(streamId) {
      const entry = this.activeStreams.get(streamId);
      if (entry) {
        try {
          if (entry.cleanup) entry.cleanup();
          if (entry.stream) {
            entry.stream.getTracks().forEach(function(track) { track.stop(); });
          }
        } catch (e) {}
        this.activeStreams.delete(streamId);
        Logger.log('Stream unregistered:', streamId);
      }
    },
    
    cleanupAll: function() {
      Logger.log('Cleaning up all streams:', this.activeStreams.size);
      var self = this;
      this.activeStreams.forEach(function(entry, streamId) {
        try {
          if (entry.cleanup) entry.cleanup();
          if (entry.stream) entry.stream.getTracks().forEach(function(t) { t.stop(); });
        } catch (e) {}
      });
      this.activeStreams.clear();
      this.cleanupCallbacks.forEach(function(cb) { try { cb(); } catch(e) {} });
      this.cleanupCallbacks = [];
    },
    
    getStats: function() {
      return { activeCount: this.activeStreams.size, streams: Array.from(this.activeStreams.keys()) };
    }
  };
  
  // ============ QUALITY ADAPTATION SYSTEM ============
  const QualityAdapter = {
    currentLevel: 0,
    lastAdaptTime: 0,
    fpsHistory: [],
    
    getCurrentQuality: function() { return CONFIG.QUALITY_LEVELS[this.currentLevel]; },
    
    recordFps: function(fps) {
      this.fpsHistory.push(fps);
      if (this.fpsHistory.length > 30) this.fpsHistory.shift();
    },
    
    getAverageFps: function() {
      if (this.fpsHistory.length === 0) return CONFIG.TARGET_FPS;
      return this.fpsHistory.reduce(function(a, b) { return a + b; }, 0) / this.fpsHistory.length;
    },
    
    adapt: function() {
      var now = Date.now();
      if (now - this.lastAdaptTime < CONFIG.QUALITY_ADAPTATION_INTERVAL || this.fpsHistory.length < 10) return;
      
      var avgFps = this.getAverageFps();
      var prevLevel = this.currentLevel;
      
      if (avgFps < CONFIG.QUALITY_LOW_FPS_THRESHOLD && this.currentLevel < 2) {
        this.currentLevel = 2;
      } else if (avgFps < CONFIG.QUALITY_MEDIUM_FPS_THRESHOLD && this.currentLevel < 1) {
        this.currentLevel = 1;
      } else if (avgFps > CONFIG.QUALITY_HIGH_FPS_THRESHOLD && this.currentLevel > 0) {
        this.currentLevel = Math.max(0, this.currentLevel - 1);
      }
      
      if (prevLevel !== this.currentLevel) {
        this.lastAdaptTime = now;
        var quality = this.getCurrentQuality();
        Logger.log('Quality adapted:', quality.name, '| FPS:', avgFps.toFixed(1));
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'qualityAdapted', payload: { level: this.currentLevel, name: quality.name, avgFps: avgFps }
          }));
        }
      }
    },
    
    getAdaptedResolution: function(w, h) {
      var q = this.getCurrentQuality();
      return { width: Math.round(w * q.scale), height: Math.round(h * q.scale), fps: q.fps };
    },
    
    reset: function() { this.currentLevel = 0; this.fpsHistory = []; this.lastAdaptTime = 0; }
  };
  
  // ============ PAGE LIFECYCLE CLEANUP ============
  window.addEventListener('beforeunload', function() {
    StreamRegistry.cleanupAll();
    VideoCache.clear();
  });
  
  window.addEventListener('pagehide', function() {
    StreamRegistry.cleanupAll();
    VideoCache.clear();
  });
  
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
      VideoCache.cache.forEach(function(entry) {
        if (entry.video && !entry.video.paused) entry.video.pause();
      });
    } else if (document.visibilityState === 'visible') {
      VideoCache.cache.forEach(function(entry) {
        if (entry.video) entry.video.play().catch(function() {});
      });
    }
  });
  
  // ============ VIDEO CACHE ============
  const VideoCache = {
    cache: new Map(),
    maxSize: 5,
    
    get: function(url) {
      const entry = this.cache.get(url);
      if (entry && entry.video && !entry.video.error) {
        Logger.log('Cache HIT for:', url.substring(0, 50));
        entry.lastAccessed = Date.now();
        return entry.video;
      }
      return null;
    },
    set: function(url, video) {
      if (this.cache.size >= this.maxSize) {
        var oldestKey = null, oldestTime = Infinity;
        this.cache.forEach(function(entry, key) {
          if (entry.lastAccessed < oldestTime) { oldestTime = entry.lastAccessed; oldestKey = key; }
        });
        if (oldestKey) this.evict(oldestKey);
      }
      this.cache.set(url, { video, timestamp: Date.now(), lastAccessed: Date.now() });
      Logger.log('Cache SET for:', url.substring(0, 50));
    },
    evict: function(url) {
      var entry = this.cache.get(url);
      if (entry && entry.video) {
        try {
          entry.video.pause();
          entry.video.removeAttribute('src');
          entry.video.load();
          if (entry.video.parentNode) entry.video.parentNode.removeChild(entry.video);
        } catch (e) {}
      }
      this.cache.delete(url);
      Logger.log('Cache evicted:', url?.substring(0, 50));
    },
    clear: function() {
      this.cache.forEach(function(entry) {
        if (entry.video) {
          try {
            entry.video.pause();
            entry.video.removeAttribute('src');
            entry.video.load();
            if (entry.video.parentNode) entry.video.parentNode.removeChild(entry.video);
          } catch (e) {}
        }
      });
      this.cache.clear();
      Logger.log('Cache cleared');
    }
  };
  
  // ============ ERROR HANDLING ============
  const ErrorHandler = {
    getDetailedErrorMessage: function(error, context, videoUrl) {
      const errorMap = {
        'MEDIA_ERR_ABORTED': {
          message: 'Video loading was aborted',
          solution: 'Try reloading the video or use a different source',
        },
        'MEDIA_ERR_NETWORK': {
          message: 'Network error while loading video',
          solution: 'Check your internet connection or try uploading the video from your device',
        },
        'MEDIA_ERR_DECODE': {
          message: 'Video format not supported or corrupted',
          solution: 'Use MP4 or WebM format with H.264/VP8 codec',
        },
        'MEDIA_ERR_SRC_NOT_SUPPORTED': {
          message: 'Video source not supported',
          solution: 'Ensure the URL points directly to a video file (not a webpage)',
        },
        'CORS_BLOCKED': {
          message: 'Video blocked by server (CORS)',
          solution: 'External URLs often block video loading. Upload the video from your device instead using Photos or Files.',
        },
        'EXTERNAL_URL_BLOCKED': {
          message: 'External video URL blocked',
          solution: 'Some hosts block video loading in embedded webviews. Please upload the video from your Photos library or Files app instead.',
        },
        'TIMEOUT': {
          message: 'Video loading timed out',
          solution: 'The video may be too large or server is slow. Try uploading from your device instead.',
        },
        'BASE64_DECODE_ERROR': {
          message: 'Base64 video data could not be decoded',
          solution: 'The base64 video data may be corrupted or truncated. Ensure the complete base64 string is provided.',
        },
        'BASE64_FORMAT_ERROR': {
          message: 'Base64 video format not supported',
          solution: 'Use MP4 (H.264) or WebM (VP8/VP9) format. The video may need to be re-encoded.',
        },
        'BLOB_EXPIRED': {
          message: 'Blob URL has expired',
          solution: 'The blob URL is no longer valid. Try re-processing the video.',
        },
        'UNKNOWN': {
          message: 'Unknown error occurred',
          solution: 'Try uploading the video from your device instead',
        }
      };
      
      let errorType = 'UNKNOWN';
      
      // Check URL type - simplified checks (videoUrl is already validated as truthy string above)
      const isBase64Uri = videoUrl && typeof videoUrl === 'string' && videoUrl.startsWith('data:');
      const isBlobUri = videoUrl && typeof videoUrl === 'string' && videoUrl.startsWith('blob:');
      const isExternalUrl = videoUrl && (videoUrl.startsWith('http://') || videoUrl.startsWith('https://'));
      const isKnownBlockingSite = videoUrl && (
        videoUrl.includes('imgur.com') ||
        videoUrl.includes('giphy.com') ||
        videoUrl.includes('gfycat.com')
      );
      
      if (error && error.code) {
        switch(error.code) {
          case 1: errorType = 'MEDIA_ERR_ABORTED'; break;
          case 2: errorType = 'MEDIA_ERR_NETWORK'; break;
          case 3: 
            // Decode error for base64/blob might have different cause
            if (isBase64Uri) {
              errorType = 'BASE64_FORMAT_ERROR';
            } else {
              errorType = 'MEDIA_ERR_DECODE';
            }
            break;
          case 4: 
            // Error code 4 - check source type
            if (isBase64Uri) {
              errorType = 'BASE64_DECODE_ERROR';
            } else if (isBlobUri) {
              errorType = 'BLOB_EXPIRED';
            } else if (isKnownBlockingSite) {
              errorType = 'EXTERNAL_URL_BLOCKED';
            } else if (isExternalUrl) {
              errorType = 'CORS_BLOCKED';
            } else {
              errorType = 'MEDIA_ERR_SRC_NOT_SUPPORTED';
            }
            break;
        }
      } else if (context === 'cors') {
        errorType = isKnownBlockingSite ? 'EXTERNAL_URL_BLOCKED' : 'CORS_BLOCKED';
      } else if (context === 'timeout') {
        errorType = 'TIMEOUT';
      } else if (context === 'base64') {
        errorType = 'BASE64_DECODE_ERROR';
      } else if (context === 'blob') {
        errorType = 'BLOB_EXPIRED';
      } else if (isExternalUrl) {
        // Default to CORS blocked for external URLs with unknown errors
        errorType = isKnownBlockingSite ? 'EXTERNAL_URL_BLOCKED' : 'CORS_BLOCKED';
      }
      
      Metrics.errorCount++;
      return errorMap[errorType];
    },
    
    notifyRN: function(errorInfo, videoUrl) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        // Truncate long URLs (like base64) for logging
        const displayUrl = videoUrl && videoUrl.length > 100 
          ? videoUrl.substring(0, 50) + '...[truncated]...' + videoUrl.substring(videoUrl.length - 20)
          : videoUrl;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'videoError',
          payload: {
            error: errorInfo,
            url: displayUrl,
            urlType: videoUrl && videoUrl.startsWith('data:') ? 'base64' : 
                     videoUrl && videoUrl.startsWith('blob:') ? 'blob' : 'url',
            metrics: Metrics.getSummary()
          }
        }));
      }
    }
  };
  
  // ============ CONNECTION QUALITY ============
  const ConnectionQuality = {
    lastCheckTime: 0,
    quality: 'unknown',
    
    check: async function() {
      const now = Date.now();
      if (now - this.lastCheckTime < 10000) return this.quality;
      this.lastCheckTime = now;
      
      try {
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (conn) {
          const effectiveType = conn.effectiveType || '4g';
          if (effectiveType === 'slow-2g' || effectiveType === '2g') {
            this.quality = 'poor';
          } else if (effectiveType === '3g') {
            this.quality = 'moderate';
          } else {
            this.quality = 'good';
          }
          Logger.log('Connection quality:', this.quality, '(' + effectiveType + ')');
        } else {
          this.quality = 'unknown';
        }
      } catch (e) {
        this.quality = 'unknown';
      }
      return this.quality;
    },
    
    getRecommendedResolution: function() {
      switch (this.quality) {
        case 'poor': return { width: 480, height: 854 };
        case 'moderate': return { width: 720, height: 1280 };
        default: return { width: CONFIG.PORTRAIT_WIDTH, height: CONFIG.PORTRAIT_HEIGHT };
      }
    }
  };
  
  // ============ MAIN CONFIG STATE ============
  window.__mediaSimConfig = {
    stealthMode: ${stealthMode},
    devices: ${JSON.stringify(devices)},
    placeholderWidth: ${placeholderWidth},
    placeholderHeight: ${placeholderHeight},
    activeStreams: new Map(),
    debugEnabled: CONFIG.DEBUG_ENABLED,
    fallbackVideoUri: CONFIG.FALLBACK_VIDEO_URI,
    forceSimulation: CONFIG.FORCE_SIMULATION,
    loopVideo: CONFIG.LOOP_VIDEO,
    mirrorVideo: CONFIG.MIRROR_VIDEO,
    protocolId: CONFIG.PROTOCOL_ID,
    overlayLabelText: CONFIG.PROTOCOL_LABEL,
    showOverlayLabel: CONFIG.SHOW_OVERLAY_LABEL,
    permissionPromptEnabled: CONFIG.PERMISSION_PROMPT_ENABLED
  };

  // ============ PROTOCOL OVERLAY BADGE ============
  const OverlayBadge = {
    element: null,
    ensure: function() {
      if (this.element || typeof document === 'undefined') return;
      if (!document.body) return;
      const badge = document.createElement('div');
      badge.id = '__mediaSimOverlayBadge';
      badge.style.cssText = [
        'position:fixed',
        'top:12px',
        'right:12px',
        'z-index:2147483647',
        'background:rgba(0,0,0,0.6)',
        'color:#00ff88',
        'padding:4px 8px',
        'border-radius:8px',
        'font-size:10px',
        'font-family:-apple-system,system-ui,sans-serif',
        'letter-spacing:0.3px',
        'pointer-events:none'
      ].join(';');
      badge.textContent = 'Media Overlay Active';
      document.body.appendChild(badge);
      this.element = badge;
    },
    update: function() {
      const cfg = window.__mediaSimConfig || {};
      if (!cfg.showOverlayLabel) {
        if (this.element) this.element.style.display = 'none';
        return;
      }
      this.ensure();
      if (!this.element) return;
      this.element.style.display = 'block';
      this.element.textContent = cfg.overlayLabelText || 'Media Overlay Active';
    }
  };
  
  window.__updateMediaConfig = function(config) {
    Object.assign(window.__mediaSimConfig, config);
    Logger.log('Config updated - devices:', window.__mediaSimConfig.devices?.length || 0);
    if (config.debugEnabled !== undefined) {
      Logger.setEnabled(config.debugEnabled);
    }
    if (
      config.loopVideo !== undefined ||
      config.protocolId !== undefined ||
      config.showOverlayLabel !== undefined ||
      config.overlayLabelText !== undefined
    ) {
      OverlayBadge.update();
    }
    if (config.devices) {
      config.devices.forEach(function(d) {
        if (d.simulationEnabled && d.assignedVideoUri) {
          Logger.log('Active:', d.name, '->', d.assignedVideoUri.substring(0, 50));
        }
      });
    }
    notifyReady('update');
  };

  window.__handlePermissionResponse = async function(data) {
    const req = window.__pendingRequests && window.__pendingRequests[data.requestId];
    if (!req) {
      Logger.warn('Unknown permission request:', data.requestId);
      return;
    }
    
    // Cleanup
    delete window.__pendingRequests[data.requestId];
    
    Logger.log('Permission response:', data.action);
    
    if (data.action === 'deny') {
      req.reject(new DOMException('Permission denied', 'NotAllowedError'));
      return;
    }
    
    if (data.action === 'allow') {
      if (_origGetUserMedia) {
        try {
          const stream = await _origGetUserMedia(req.constraints);
          req.resolve(stream);
        } catch(e) {
          req.reject(e);
        }
      } else {
        req.reject(new Error('Real getUserMedia not available'));
      }
      return;
    }
    
    if (data.action === 'simulate') {
      try {
        // Update device with config from response
        const device = req.device || {};
        const config = data.config || {};
        
        // Use provided URI or fallback to device's URI or global fallback
        const videoUri = config.videoUri || device.assignedVideoUri || getFallbackVideoUri();
        
        const deviceForSim = {
          ...device,
          assignedVideoUri: videoUri,
          simulationEnabled: true
        };
        
        Logger.log('Simulating:', videoUri ? videoUri.substring(0, 30) : 'canvas');
        
        // If we have a URI, try video stream
        if (videoUri && !videoUri.startsWith('canvas:')) {
           try {
             const stream = await createVideoStream(deviceForSim, req.wantsAudio);
             req.resolve(stream);
             return;
           } catch(e) {
             Logger.warn('Video sim failed, falling back to canvas', e.message);
           }
        }
        
        // Fallback to canvas
        const stream = await createCanvasStream(deviceForSim, req.wantsAudio, 'default');
        req.resolve(stream);
      } catch(e) {
        Logger.error('Simulation failed:', e.message);
        req.reject(e);
      }
    }
  };
  
  window.__getSimulationMetrics = function() {
    return {
      ...Metrics.getSummary(),
      quality: QualityAdapter.getCurrentQuality(),
      qualityLevel: QualityAdapter.currentLevel,
      streams: StreamRegistry.getStats()
    };
  };
  
  window.__forceQualityLevel = function(level) {
    if (level >= 0 && level < CONFIG.QUALITY_LEVELS.length) {
      QualityAdapter.currentLevel = level;
      Logger.log('Quality forced to:', CONFIG.QUALITY_LEVELS[level].name);
    }
  };
  
  window.__cleanupAllStreams = function() {
    StreamRegistry.cleanupAll();
    VideoCache.clear();
    QualityAdapter.reset();
    Logger.log('Manual cleanup completed');
  };
  
  window.__setDebugLogging = function(enabled) {
    Logger.setEnabled(enabled);
    window.__mediaSimConfig.debugEnabled = enabled;
  };
  
  function getConstraintValue(constraint) {
    if (!constraint) return null;
    if (typeof constraint === 'string') return constraint;
    if (Array.isArray(constraint)) return constraint[0];
    if (typeof constraint === 'object') {
      if (constraint.exact) {
        return Array.isArray(constraint.exact) ? constraint.exact[0] : constraint.exact;
      }
      if (constraint.ideal) {
        return Array.isArray(constraint.ideal) ? constraint.ideal[0] : constraint.ideal;
      }
    }
    return null;
  }
  
  function normalizeFacingMode(mode) {
    if (!mode || typeof mode !== 'string') return null;
    const value = mode.toLowerCase();
    if (value === 'user' || value === 'front') return 'front';
    if (value === 'environment' || value === 'back') return 'back';
    return null;
  }
  
  function selectDevice(devices, requestedId, requestedFacing) {
    if (!Array.isArray(devices) || devices.length === 0) return null;
    if (requestedId) {
      const byId = devices.find(function(d) {
        return d.id === requestedId || d.nativeDeviceId === requestedId;
      });
      if (byId) return byId;
    }
    if (requestedFacing) {
      const byFacing = devices.find(function(d) { return d.facing === requestedFacing; });
      if (byFacing) return byFacing;
    }
    const preferred = devices.find(function(d) { return d.isDefault || d.isPrimary; });
    return preferred || devices[0];
  }

  function normalizeDevice(device) {
    if (device) return device;
    return {
      id: 'sim_default_camera',
      name: 'Simulated Camera',
      type: 'camera',
      facing: 'front',
      simulationEnabled: true
    };
  }

  function getFallbackVideoUri() {
    const cfg = window.__mediaSimConfig || {};
    return cfg.fallbackVideoUri || null;
  }

  function resolveVideoUri(device) {
    if (device && device.assignedVideoUri) return device.assignedVideoUri;
    const fallback = getFallbackVideoUri();
    return fallback || 'canvas:default';
  }

  function createPermissionError(name, message) {
    const err = new Error(message);
    err.name = name;
    return err;
  }

  const PermissionPrompt = {
    pending: {},
    request: function(payload) {
      const cfg = window.__mediaSimConfig || {};
      if (cfg.permissionPromptEnabled === false) {
        return Promise.resolve({ action: 'auto' });
      }
      if (!window.ReactNativeWebView || !window.ReactNativeWebView.postMessage) {
        return Promise.resolve({ action: 'deny' });
      }
      const requestId = 'perm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      return new Promise(function(resolve) {
        PermissionPrompt.pending[requestId] = resolve;
        try {
          const message = {
            type: 'cameraPermissionRequest',
            payload: {
              requestId: requestId,
              url: typeof location !== 'undefined' ? location.href : '',
              origin: typeof location !== 'undefined' ? location.origin : '',
              wantsVideo: !!payload.wantsVideo,
              wantsAudio: !!payload.wantsAudio,
              requestedFacing: payload.requestedFacing || null,
              requestedDeviceId: payload.requestedDeviceId || null
            }
          };
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
        } catch (err) {
          Logger.warn('Permission prompt postMessage failed:', err?.message || err);
          delete PermissionPrompt.pending[requestId];
          resolve({ action: 'deny' });
          return;
        }
        setTimeout(function() {
          if (PermissionPrompt.pending[requestId]) {
            Logger.warn('Permission prompt timed out, denying');
            PermissionPrompt.pending[requestId]({ action: 'deny' });
            delete PermissionPrompt.pending[requestId];
          }
        }, 30000);
      });
    },
    resolve: function(requestId, decision) {
      if (!requestId || !PermissionPrompt.pending[requestId]) return;
      const resolver = PermissionPrompt.pending[requestId];
      delete PermissionPrompt.pending[requestId];
      resolver(decision || { action: 'deny' });
    }
  };

  window.__resolveCameraPermission = function(requestId, decision) {
    PermissionPrompt.resolve(requestId, decision);
  };
  
  function buildSimulatedDevices(devices) {
    return (devices || []).map(function(d) {
      const info = {
        deviceId: d.nativeDeviceId || d.id || 'sim_' + Math.random().toString(36).substr(2, 9),
        groupId: d.groupId || 'default',
        kind: d.type === 'camera' ? 'videoinput' : 'audioinput',
        label: d.name || 'Camera',
        toJSON: function() { return this; }
      };
      try {
        if (typeof MediaDeviceInfo !== 'undefined') {
          Object.setPrototypeOf(info, MediaDeviceInfo.prototype);
        }
      } catch(e) {}
      return info;
    });
  }
  
  // ============ PORTRAIT RESOLUTION HELPERS ============
  function getPortraitRes(device) {
    let w = CONFIG.PORTRAIT_WIDTH;
    let h = CONFIG.PORTRAIT_HEIGHT;
    
    if (device?.capabilities?.videoResolutions?.[0]) {
      const r = device.capabilities.videoResolutions[0];
      w = r.height > r.width ? r.width : r.height;
      h = r.height > r.width ? r.height : r.width;
    }
    
    // Ensure portrait orientation (height > width)
    if (w > h) { const t = w; w = h; h = t; }
    
    // Enforce 9:16 aspect ratio
    const targetRatio = 9 / 16;
    const currentRatio = w / h;
    if (Math.abs(currentRatio - targetRatio) > 0.05) {
      // Adjust to 9:16
      h = Math.round(w / targetRatio);
    }
    
    Logger.log('Portrait resolution:', w, 'x', h, '(9:16 enforced)');
    return { width: w, height: h };
  }
  
  // ============ ORIGINAL API REFERENCES ============
  const nav = window.navigator;
  let mediaDevices = nav && nav.mediaDevices ? nav.mediaDevices : null;
  
  if (!mediaDevices && nav) {
    mediaDevices = {};
    try {
      Object.defineProperty(nav, 'mediaDevices', { value: mediaDevices, configurable: true });
    } catch (e) {
      try { nav.mediaDevices = mediaDevices; } catch (e2) {}
    }
  }
  
  if (!mediaDevices) {
    mediaDevices = {};
  }
  
  const _origGetUserMedia = mediaDevices.getUserMedia ? mediaDevices.getUserMedia.bind(mediaDevices) : null;
  const _origEnumDevices = mediaDevices.enumerateDevices ? mediaDevices.enumerateDevices.bind(mediaDevices) : null;
  
  // ============ DEVICE ENUMERATION OVERRIDE ============
  if (!navigator.mediaDevices) {
    navigator.mediaDevices = {};
  }
  if (navigator.mediaDevices) {
    navigator.mediaDevices.enumerateDevices = async function() {
      const cfg = window.__mediaSimConfig || {};
      const devices = cfg.devices || [];
      const hasSimDevices = devices.length > 0;
      
      if ((cfg.stealthMode || cfg.forceSimulation) && hasSimDevices) {
        const simDevices = buildSimulatedDevices(devices);
        Logger.log('enumerateDevices ->', simDevices.length, 'devices (simulated)');
        return simDevices;
      }
      
      if (_origEnumDevices) {
        try {
          const realDevices = await _origEnumDevices();
          Logger.log('enumerateDevices ->', realDevices.length, 'devices (real)');
          return realDevices;
        } catch (err) {
          Logger.warn('enumerateDevices real failed:', err?.message || err);
        }
      }
      
      if (hasSimDevices) {
        const simDevices = buildSimulatedDevices(devices);
        Logger.log('enumerateDevices fallback ->', simDevices.length, 'devices');
        return simDevices;
      }
      
      return [];
    };

    // ============ GET USER MEDIA OVERRIDE ============
    mediaDevices.getUserMedia = async function(constraints) {
      Logger.log('======== getUserMedia CALLED ========');
      Logger.log('Website is requesting camera access - INTERCEPTING');
      const cfg = window.__mediaSimConfig || {};
      const wantsVideo = !!constraints?.video;
      const wantsAudio = !!constraints?.audio;

      let reqDeviceId = null;
      let reqFacing = null;

      if (wantsVideo && typeof constraints.video === 'object') {
        reqDeviceId = getConstraintValue(constraints.video.deviceId);
        reqFacing = normalizeFacingMode(getConstraintValue(constraints.video.facingMode));
      }

      const selectedDevice = selectDevice(cfg.devices, reqDeviceId, reqFacing);
      const device = normalizeDevice(selectedDevice);
      const resolvedUri = resolveVideoUri(device);
      const hasVideoUri = resolvedUri && !resolvedUri.startsWith('canvas:');
      const forceSimulation = !!cfg.forceSimulation;

      Logger.log(
        'Device:', device?.name || 'none',
        '| ReqId:', reqDeviceId || 'none',
        '| Facing:', reqFacing || 'any',
        '| SimEnabled:', device?.simulationEnabled,
        '| ForceSim:', forceSimulation,
        '| URI:', resolvedUri ? resolvedUri.substring(0, 40) : 'none'
      );

      let permissionDecision = null;
      if (wantsVideo) {
        try {
          permissionDecision = await PermissionPrompt.request({
            wantsVideo: wantsVideo,
            wantsAudio: wantsAudio,
            requestedFacing: reqFacing,
            requestedDeviceId: reqDeviceId
          });
        } catch (err) {
          Logger.warn('Permission prompt failed:', err?.message || err);
        }
      }

      const decisionAction = permissionDecision && typeof permissionDecision === 'object'
        ? permissionDecision.action
        : null;

      const decisionVideoUri = permissionDecision && permissionDecision.videoUri
        ? permissionDecision.videoUri
        : resolvedUri;
      const hasDecisionVideoUri = decisionVideoUri && !decisionVideoUri.startsWith('canvas:');

      if (decisionAction === 'deny') {
        throw createPermissionError('NotAllowedError', 'Camera permission denied by user');
      }

      if (decisionAction === 'real') {
        if (_origGetUserMedia) {
          Logger.log('User selected real camera access');
          return _origGetUserMedia(constraints);
        }
        throw createPermissionError('NotSupportedError', 'Real camera access is not available');
      }

      const shouldSimulate = decisionAction === 'simulate'
        ? true
        : (forceSimulation || cfg.stealthMode || (device?.simulationEnabled && hasVideoUri));

      if (shouldSimulate && wantsVideo) {
        if (hasDecisionVideoUri) {
          Logger.log('Creating simulated stream from video');
          try {
            const deviceForSim = {
              ...device,
              assignedVideoUri: decisionVideoUri,
              simulationEnabled: true
            };
            const stream = await createVideoStream(deviceForSim, !!wantsAudio);
            Logger.log('SUCCESS - tracks:', stream.getTracks().length);
            return stream;
          } catch (err) {
            Logger.error('Video stream failed:', err.message);
            Logger.log('Falling back to canvas pattern');
          }
        }

        const deviceForCanvas = {
          ...device,
          assignedVideoUri: decisionVideoUri,
          simulationEnabled: true
        };
        return await createCanvasStream(deviceForCanvas, !!wantsAudio, 'default');
      }

      if (_origGetUserMedia) {
        return _origGetUserMedia(constraints);
      }

      throw createPermissionError('NotSupportedError', 'Real camera access is not available');
    };

    const overrideEnumerateDevices = navigator.mediaDevices.enumerateDevices;
    const overrideGetUserMedia = navigator.mediaDevices.getUserMedia;
    const overrideWatchdog = setInterval(function() {
      try {
        if (navigator.mediaDevices) {
          if (navigator.mediaDevices.enumerateDevices !== overrideEnumerateDevices) {
            navigator.mediaDevices.enumerateDevices = overrideEnumerateDevices;
            Logger.warn('enumerateDevices override restored');
          }
          if (navigator.mediaDevices.getUserMedia !== overrideGetUserMedia) {
            navigator.mediaDevices.getUserMedia = overrideGetUserMedia;
            Logger.warn('getUserMedia override restored');
          }
        }
      } catch (e) {}
    }, 2000);
    StreamRegistry.cleanupCallbacks.push(function() { clearInterval(overrideWatchdog); });
  }
  
  // ============ VIDEO LOADING WITH RETRY ============
  
  // Helper to check if URI is a base64 data URI
  // NOTE: This duplicates logic from utils/base64VideoHandler.ts, but is necessary because
  // this script is injected into a WebView and cannot import external modules.
  // Keep patterns in sync with BASE64_VIDEO_CONSTANTS.VIDEO_DATA_URI_PATTERNS
  function isBase64VideoUri(uri) {
    if (!uri || typeof uri !== 'string') return false;
    const patterns = [
      'data:video/mp4;base64,',
      'data:video/webm;base64,',
      'data:video/quicktime;base64,',
      'data:video/x-m4v;base64,',
      'data:video/avi;base64,',
      'data:video/x-msvideo;base64,',
      'data:video/mov;base64,',
      'data:video/3gpp;base64,',
      'data:application/octet-stream;base64,'
    ];
    const trimmed = uri.trim();
    return patterns.some(function(p) { return trimmed.startsWith(p); }) ||
           (trimmed.startsWith('data:video/') && trimmed.includes(';base64,'));
  }
  
  // Helper to check if URI is a blob URL
  function isBlobUri(uri) {
    if (!uri || typeof uri !== 'string') return false;
    return uri.trim().startsWith('blob:');
  }
  
  // Load base64 video directly (no CORS needed)
  async function loadBase64Video(videoUri, timeout) {
    Logger.log('Loading base64 video data URI (length:', videoUri.length, ')');
    notifyLoadingProgress(0.1, 'initializing', 'Processing base64 video data...');
    
    try {
      Metrics.startVideoLoad();
      const video = await loadVideoElement(videoUri, null, timeout);
      Metrics.endVideoLoad(true);
      notifyLoadingProgress(1, 'complete', 'Base64 video loaded successfully');
      return video;
    } catch (err) {
      Metrics.endVideoLoad(false);
      Logger.error('Base64 video load failed:', err.message);
      
      ErrorHandler.notifyRN({
        message: 'Base64 video failed to load',
        solution: 'The base64 video data may be corrupted or in an unsupported format. Try using MP4 (H.264) format.'
      }, 'base64:...');
      notifyLoadingProgress(0, 'error', 'Base64 video decode failed');
      throw err;
    }
  }
  
  // Load blob URL directly (no CORS needed)
  async function loadBlobVideo(videoUri, timeout) {
    Logger.log('Loading blob video URL');
    notifyLoadingProgress(0.1, 'initializing', 'Loading blob video...');
    
    try {
      Metrics.startVideoLoad();
      const video = await loadVideoElement(videoUri, null, timeout);
      Metrics.endVideoLoad(true);
      notifyLoadingProgress(1, 'complete', 'Blob video loaded successfully');
      return video;
    } catch (err) {
      Metrics.endVideoLoad(false);
      Logger.error('Blob video load failed:', err.message);
      
      ErrorHandler.notifyRN({
        message: 'Blob video failed to load',
        solution: 'The blob URL may have expired. Try re-processing the video.'
      }, videoUri);
      notifyLoadingProgress(0, 'error', 'Blob video load failed');
      throw err;
    }
  }
  
  async function loadVideoWithRetry(videoUri, maxAttempts) {
    maxAttempts = maxAttempts || CONFIG.MAX_RETRY_ATTEMPTS;
    let lastError = null;
    
    // Handle base64 data URIs directly (no CORS needed)
    if (isBase64VideoUri(videoUri)) {
      return loadBase64Video(videoUri, CONFIG.VIDEO_LOAD_TIMEOUT * 2); // Extra timeout for large base64
    }
    
    // Handle blob URLs directly (no CORS needed)
    if (isBlobUri(videoUri)) {
      return loadBlobVideo(videoUri, CONFIG.VIDEO_LOAD_TIMEOUT);
    }
    
    // Check connection quality first
    await ConnectionQuality.check();
    
    // Notify RN that loading started
    notifyLoadingProgress(0, 'initializing', 'Starting video load...');
    
    for (let strategy = 0; strategy < CONFIG.CORS_STRATEGIES.length; strategy++) {
      const corsMode = CONFIG.CORS_STRATEGIES[strategy];
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const delay = CONFIG.INITIAL_RETRY_DELAY * Math.pow(2, attempt);
        
        if (attempt > 0) {
          Logger.log('Retry attempt', attempt + 1, 'with', delay, 'ms delay, CORS:', corsMode);
          notifyLoadingProgress(0.05, 'retrying', 'Retrying... (attempt ' + (attempt + 1) + ')');
          await new Promise(function(r) { setTimeout(r, delay); });
        }
        
        Metrics.startVideoLoad();
        
        try {
          const video = await loadVideoElement(videoUri, corsMode, CONFIG.VIDEO_LOAD_TIMEOUT);
          Metrics.endVideoLoad(true);
          notifyLoadingProgress(1, 'complete', 'Video loaded successfully');
          return video;
        } catch (err) {
          Metrics.endVideoLoad(false);
          Metrics.retryCount++;
          lastError = err;
          Logger.warn('Load attempt failed:', err.message, '| Strategy:', corsMode, '| Attempt:', attempt + 1);
        }
      }
    }
    
    // Notify RN about the final failure with better error context
    const isKnownBlockingSite = videoUri && (
      videoUri.includes('imgur.com') ||
      videoUri.includes('giphy.com') ||
      videoUri.includes('gfycat.com')
    );
    
    const errorInfo = {
      message: isKnownBlockingSite 
        ? 'External video URL blocked by server'
        : (lastError?.message || 'Video failed to load'),
      solution: 'External URLs often block video loading in apps. Please upload the video from your Photos library or Files app instead.'
    };
    ErrorHandler.notifyRN(errorInfo, videoUri);
    notifyLoadingProgress(0, 'error', errorInfo.message);
    
    throw lastError || new Error('All retry attempts exhausted');
  }
  
  // ============ LOADING PROGRESS NOTIFICATION ============
  function notifyLoadingProgress(progress, stage, message) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'videoLoadingProgress',
        payload: {
          progress: progress,
          stage: stage,
          message: message,
          timestamp: Date.now()
        }
      }));
    }
  }
  
  function loadVideoElement(videoUri, corsMode, timeout) {
    return new Promise(function(resolve, reject) {
      const video = document.createElement('video');
      video.muted = true;
      video.loop = window.__mediaSimConfig?.loopVideo !== false;
      video.playsInline = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.preload = 'auto';
      video.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
      
      if (corsMode !== null) {
        video.crossOrigin = corsMode;
      }
      
      const container = document.body || document.documentElement;
      if (container && container.appendChild) {
        container.appendChild(video);
      } else {
        Logger.warn('Video element not attached - document not ready');
      }
      
      let resolved = false;
      let lastProgressTime = Date.now();
      let progressCheckInterval = null;
      
      const timeoutId = setTimeout(function() {
        if (resolved) return;
        resolved = true;
        cleanup();
        safeRemoveElement(video);
        const errorInfo = ErrorHandler.getDetailedErrorMessage(null, 'timeout');
        reject(new Error(errorInfo.message + ' - ' + errorInfo.solution));
      }, timeout);
      
      const cleanup = function() {
        clearTimeout(timeoutId);
        if (progressCheckInterval) clearInterval(progressCheckInterval);
        video.onloadeddata = null;
        video.oncanplay = null;
        video.onerror = null;
        video.onprogress = null;
      };
      
      // Track actual loading progress
      video.onprogress = function() {
        lastProgressTime = Date.now();
        if (video.buffered.length > 0 && video.duration > 0) {
          const bufferedEnd = video.buffered.end(video.buffered.length - 1);
          const progress = Math.min(0.9, (bufferedEnd / video.duration) * 0.9);
          notifyLoadingProgress(progress, 'downloading', 'Loading video... ' + Math.round(progress * 100) + '%');
          Logger.log('Video buffered:', Math.round(progress * 100) + '%');
        }
      };
      
      // Check for stalled progress
      progressCheckInterval = setInterval(function() {
        if (resolved) return;
        const timeSinceProgress = Date.now() - lastProgressTime;
        if (timeSinceProgress > 5000 && video.readyState < 3) {
          notifyLoadingProgress(0.1, 'stalled', 'Loading stalled, please wait...');
        }
      }, 2000);
      
      video.onloadedmetadata = function() {
        notifyLoadingProgress(0.3, 'metadata', 'Video metadata loaded: ' + video.videoWidth + 'x' + video.videoHeight);
        Logger.log('Video metadata:', video.videoWidth, 'x', video.videoHeight, 'duration:', video.duration);
      };
      
      video.onloadeddata = function() {
        if (resolved) return;
        resolved = true;
        cleanup();
        notifyLoadingProgress(0.95, 'finalizing', 'Preparing video stream...');
        Logger.log('Video loaded:', video.videoWidth, 'x', video.videoHeight);
        resolve(video);
      };
      
      video.oncanplay = function() {
        if (!resolved && video.readyState >= 3) {
          resolved = true;
          cleanup();
          notifyLoadingProgress(0.95, 'finalizing', 'Video ready to play');
          Logger.log('Video can play:', video.videoWidth, 'x', video.videoHeight);
          resolve(video);
        }
      };
      
      video.onerror = function() {
        if (resolved) return;
        resolved = true;
        cleanup();
        const errorInfo = ErrorHandler.getDetailedErrorMessage(video.error, 'load', videoUri);
        Logger.error('Video load error:', errorInfo.message, '| URL:', videoUri.substring(0, 60));
        safeRemoveElement(video);
        reject(new Error(errorInfo.message + ' - ' + errorInfo.solution));
      };
      
      notifyLoadingProgress(0.1, 'connecting', 'Connecting to video source...');
      video.src = videoUri;
      video.load();
    });
  }
  
  // ============ VIDEO FORMAT FALLBACK SYSTEM ============
  const VIDEO_FORMAT_FALLBACKS = [
    { name: 'green_screen', render: renderGreenScreen },
    { name: 'green_gradient', render: renderGreenGradient },
    { name: 'lime_green', render: renderLimeGreen },
    { name: 'neon_green', render: renderNeonGreen },
    { name: 'chroma_green', render: renderChromaGreen },
    { name: 'broadcast_green', render: renderBroadcastGreen },
  ];
  
  let currentFallbackIndex = 0;
  
  function getNextFallbackRenderer() {
    const fallback = VIDEO_FORMAT_FALLBACKS[currentFallbackIndex];
    currentFallbackIndex = (currentFallbackIndex + 1) % VIDEO_FORMAT_FALLBACKS.length;
    Logger.log('Using fallback renderer:', fallback.name);
    return fallback.render;
  }
  
  function resetFallbackIndex() {
    currentFallbackIndex = 0;
  }
  
  // ============ VIDEO STREAM CREATION ============
  async function createVideoStream(device, wantsAudio) {
    const fallbackUri = getFallbackVideoUri();
    const videoUri = device.assignedVideoUri || fallbackUri;
    Logger.log('Loading video:', videoUri ? videoUri.substring(0, 60) : 'none');
    
    // Handle built-in test videos - highest priority for testing
    if (videoUri && videoUri.startsWith('builtin:')) {
      const patternType = videoUri.replace('builtin:', '') || 'bouncing_ball';
      Logger.log('Using built-in test video pattern:', patternType);
      if (window.__createBuiltInVideoStream) {
        try {
          const stream = await window.__createBuiltInVideoStream({ patternType: patternType });
          if (wantsAudio) addSilentAudio(stream);
          return stream;
        } catch (err) {
          Logger.warn('Built-in video failed, falling back:', err.message);
        }
      }
      return createBuiltInFallbackStream(device, wantsAudio, patternType);
    }
    
    // Handle canvas patterns
    if (videoUri && videoUri.startsWith('canvas:')) {
      return createBuiltInFallbackStream(device, wantsAudio, 'bouncing_ball');
    }
    
    // No video assigned - use built-in test video
    if (!videoUri) {
      Logger.log('No video assigned, using built-in test video');
      return createBuiltInFallbackStream(device, wantsAudio, 'bouncing_ball');
    }
    
    // Try to load user video with fallback chain
    try {
      // Check cache first
      let video = VideoCache.get(videoUri);
      
      if (!video) {
        video = await loadVideoWithRetry(videoUri);
        VideoCache.set(videoUri, video);
      }
      
      const res = getPortraitRes(device);
      
      // Play video
      await video.play();
      await new Promise(function(r) { setTimeout(r, 100); });
      
      // Create stream from video
      const stream = await createCanvasStreamFromVideo(video, res, wantsAudio, device);
      
      // Setup health monitoring
      setupStreamHealthCheck(stream, video, device);
      
      return stream;
    } catch (err) {
      Logger.warn('Video load failed, using built-in fallback:', err.message);
      // Always fallback to built-in test video for reliability
      return createBuiltInFallbackStream(device, wantsAudio, 'bouncing_ball');
    }
  }
  
  // ============ BUILT-IN FALLBACK STREAM ============
  async function createBuiltInFallbackStream(device, wantsAudio, patternType) {
    patternType = patternType || 'bouncing_ball';
    Logger.log('Creating built-in fallback stream:', patternType);
    
    // Try the built-in video system first
    if (window.__createBuiltInVideoStream) {
      try {
        const stream = await window.__createBuiltInVideoStream({ patternType: patternType });
        if (wantsAudio) addSilentAudio(stream);
        Logger.log('Built-in video stream created successfully');
        return stream;
      } catch (err) {
        Logger.warn('Built-in system failed, using inline fallback:', err.message);
      }
    }
    
    // Inline fallback - bouncing ball pattern
    return createInlineBouncingBallStream(device, wantsAudio);
  }
  
  // ============ INLINE BOUNCING BALL STREAM ============
  function createInlineBouncingBallStream(device, wantsAudio) {
    const res = getPortraitRes(device);
    const w = res.width;
    const h = res.height;
    
    return new Promise(function(resolve, reject) {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { alpha: false });
      
      if (!ctx) {
        reject(new Error('Canvas context failed'));
        return;
      }
      
      let isRunning = true;
      let frame = 0;
      const start = Date.now();
      let lastDrawTime = 0;
      const targetFrameTime = 1000 / CONFIG.TARGET_FPS;
      
      function renderBouncingBall(t, f) {
        // Dark background
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, w, h);
        
        // Bouncing balls
        var balls = [
          { radius: 60, color: '#ff6b6b', phase: 0, speed: 2 },
          { radius: 45, color: '#4ecdc4', phase: Math.PI / 3, speed: 2.5 },
          { radius: 35, color: '#ffe66d', phase: Math.PI * 2 / 3, speed: 3 },
        ];
        
        balls.forEach(function(ball) {
          var bounceY = Math.abs(Math.sin((t * ball.speed + ball.phase) * Math.PI)) * (h * 0.6);
          var x = w / 2 + Math.sin(t * 0.5 + ball.phase) * (w * 0.3);
          var y = h * 0.2 + bounceY;
          
          // Shadow
          ctx.beginPath();
          ctx.ellipse(x, h * 0.85, ball.radius * 0.8, ball.radius * 0.2, 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.fill();
          
          // Ball
          ctx.beginPath();
          ctx.arc(x, y, ball.radius, 0, Math.PI * 2);
          ctx.fillStyle = ball.color;
          ctx.fill();
        });
        
        // Info text
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 28px -apple-system, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('BUILT-IN TEST VIDEO', w / 2, 60);
        
        ctx.font = '18px -apple-system, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillText('Frame: ' + f + ' | Camera Injection Active', w / 2, h - 50);
        
        // Animated border
        var hue = (t * 60) % 360;
        ctx.strokeStyle = 'hsl(' + hue + ', 80%, 60%)';
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, w - 6, h - 6);
      }
      
      function render(timestamp) {
        if (!isRunning) return;
        
        var elapsed = timestamp - lastDrawTime;
        if (elapsed < targetFrameTime * 0.9) {
          requestAnimationFrame(render);
          return;
        }
        lastDrawTime = timestamp;
        
        var t = (Date.now() - start) / 1000;
        renderBouncingBall(t, frame);
        frame++;
        
        requestAnimationFrame(render);
      }
      
      requestAnimationFrame(render);
      
      setTimeout(function() {
        try {
          var stream = canvas.captureStream(CONFIG.TARGET_FPS);
          if (!stream || stream.getVideoTracks().length === 0) {
            reject(new Error('captureStream failed'));
            return;
          }
          
          if (wantsAudio) addSilentAudio(stream);
          
          // Spoof track
          var videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            var deviceName = device && device.name ? device.name : 'Front Camera';
            var deviceId = device && device.id ? device.id : 'builtin_camera';
            
            videoTrack.getSettings = function() {
              return {
                width: w,
                height: h,
                frameRate: CONFIG.TARGET_FPS,
                aspectRatio: w / h,
                facingMode: 'user',
                deviceId: deviceId,
                groupId: 'builtin',
              };
            };
            
            Object.defineProperty(videoTrack, 'label', {
              get: function() { return deviceName + ' (Test)'; },
              configurable: true
            });
          }
          
          stream._cleanup = function() { isRunning = false; };
          stream._isBuiltIn = true;
          
          Logger.log('Inline bouncing ball stream created');
          resolve(stream);
        } catch (err) {
          reject(err);
        }
      }, 100);
    });
  }
  
  // ============ GREEN SCREEN STREAM (PRIMARY FALLBACK) ============
  async function createGreenScreenStream(device, wantsAudio) {
    const res = getPortraitRes(device);
    Logger.log('Creating green screen stream:', res.width, 'x', res.height, '(9:16)');
    
    return new Promise(function(resolve, reject) {
      const canvas = document.createElement('canvas');
      canvas.width = res.width;
      canvas.height = res.height;
      const ctx = canvas.getContext('2d', { alpha: false });
      
      if (!ctx) {
        reject(new Error('Canvas context failed'));
        return;
      }
      
      let isRunning = true;
      let frame = 0;
      let fallbackAttempt = 0;
      const start = Date.now();
      let lastDrawTime = 0;
      const targetFrameTime = 1000 / CONFIG.TARGET_FPS;
      
      // Get the current fallback renderer
      let currentRenderer = VIDEO_FORMAT_FALLBACKS[0].render;
      
      function render(timestamp) {
        if (!isRunning) return;
        
        const elapsed = timestamp - lastDrawTime;
        if (elapsed < targetFrameTime * 0.9) {
          requestAnimationFrame(render);
          return;
        }
        lastDrawTime = timestamp;
        
        Metrics.recordFrame();
        const t = (Date.now() - start) / 1000;
        
        try {
          // Always render green screen in 9:16
          currentRenderer(ctx, canvas.width, canvas.height, t, frame);
        } catch (e) {
          // Try next fallback on error
          fallbackAttempt++;
          if (fallbackAttempt < VIDEO_FORMAT_FALLBACKS.length) {
            currentRenderer = VIDEO_FORMAT_FALLBACKS[fallbackAttempt].render;
            Logger.warn('Renderer failed, trying fallback', fallbackAttempt, ':', VIDEO_FORMAT_FALLBACKS[fallbackAttempt].name);
          } else {
            // Ultimate fallback - just fill green
            ctx.fillStyle = '#00FF00';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
        }
        
        frame++;
        requestAnimationFrame(render);
      }
      
      requestAnimationFrame(render);
      
      setTimeout(function() {
        try {
          const stream = getCanvasStream(canvas, CONFIG.TARGET_FPS);
          if (!stream || stream.getVideoTracks().length === 0) {
            reject(new Error('Green screen captureStream failed'));
            return;
          }
          
          if (wantsAudio) addSilentAudio(stream);
          
          stream._cleanup = function() {
            isRunning = false;
            Logger.log('Green screen stream cleanup');
          };
          stream._isRunning = function() { return isRunning; };
          
          Logger.log('Green screen stream ready:', stream.getTracks().length, 'tracks (9:16 enforced)');
          resolve(stream);
        } catch (err) {
          reject(err);
        }
      }, 80);
    });
  }
  
  // ============ NATURAL CAMERA VARIATIONS ============
  const NaturalVariations = {
    brightnessOffset: 0,
    colorTempOffset: 0,
    microShakeX: 0,
    microShakeY: 0,
    lastUpdate: 0,
    
    update: function(timestamp) {
      // Update every 100ms for natural feel
      if (timestamp - this.lastUpdate < 100) return;
      this.lastUpdate = timestamp;
      
      // Subtle brightness jitter (±2%)
      this.brightnessOffset = (Math.random() - 0.5) * 0.04;
      
      // Micro color temperature shift
      this.colorTempOffset = (Math.random() - 0.5) * 10;
      
      // Micro shake (simulates hand tremor)
      this.microShakeX = (Math.random() - 0.5) * 0.5;
      this.microShakeY = (Math.random() - 0.5) * 0.5;
    },
    
    applyToContext: function(ctx, width, height) {
      // Apply subtle brightness variation
      if (Math.abs(this.brightnessOffset) > 0.01) {
        ctx.globalAlpha = 1 + this.brightnessOffset;
      }
    }
  };
  
  // ============ CANVAS STREAM FROM VIDEO ============
  // Pre-computed values to avoid allocation in render loop
  const RenderCache = {
    cropParams: { sx: 0, sy: 0, sw: 0, sh: 0 },
    lastVideoWidth: 0,
    lastVideoHeight: 0,
    lastCanvasWidth: 0,
    lastCanvasHeight: 0,
    frameSkipThreshold: 0.001,
    
    updateCropParams: function(vw, vh, cw, ch) {
      // Only recalculate if dimensions changed
      if (this.lastVideoWidth === vw && this.lastVideoHeight === vh &&
          this.lastCanvasWidth === cw && this.lastCanvasHeight === ch) {
        return this.cropParams;
      }
      
      this.lastVideoWidth = vw;
      this.lastVideoHeight = vh;
      this.lastCanvasWidth = cw;
      this.lastCanvasHeight = ch;
      
      const vAspect = vw / vh;
      const cAspect = cw / ch;
      
      if (vAspect > cAspect) {
        this.cropParams.sw = vh * cAspect;
        this.cropParams.sx = (vw - this.cropParams.sw) / 2;
        this.cropParams.sy = 0;
        this.cropParams.sh = vh;
      } else {
        this.cropParams.sh = vw / cAspect;
        this.cropParams.sy = (vh - this.cropParams.sh) / 2;
        this.cropParams.sx = 0;
        this.cropParams.sw = vw;
      }
      
      return this.cropParams;
    }
  };
  
  function createCanvasStreamFromVideo(video, res, wantsAudio, device) {
    return new Promise(function(resolve, reject) {
      const canvas = document.createElement('canvas');
      canvas.width = res.width;
      canvas.height = res.height;
      const ctx = canvas.getContext('2d', { 
        alpha: false,
        desynchronized: true,
        willReadFrequently: false
      });
      
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      let isRunning = true;
      let lastDrawTime = 0;
      const targetFrameTime = 1000 / CONFIG.TARGET_FPS;
      const minFrameTime = targetFrameTime * 0.9;
      let frameCount = 0;
      
      // Pre-cache canvas dimensions
      const cw = canvas.width;
      const ch = canvas.height;
      
      function draw(timestamp) {
        if (!isRunning) return;
        
        // Optimized frame rate limiting
        const elapsed = timestamp - lastDrawTime;
        if (elapsed < minFrameTime) {
          requestAnimationFrame(draw);
          return;
        }
        
        // Rare frame skip for realism
        if (Math.random() < RenderCache.frameSkipThreshold) {
          requestAnimationFrame(draw);
          return;
        }
        
        lastDrawTime = timestamp;
        frameCount++;
        
        // Update natural variations (throttled internally)
        NaturalVariations.update(timestamp);
        
        // Record metrics every 10 frames to reduce overhead
        if (frameCount % 10 === 0) {
          Metrics.recordFrame();
        }
        
        const vw = video.videoWidth || 1;
        const vh = video.videoHeight || 1;
        
        // Get cached crop params (only recalculates if dimensions changed)
        const crop = RenderCache.updateCropParams(vw, vh, cw, ch);
        
        // Apply micro-shake directly to cached values
        const sx = crop.sx + NaturalVariations.microShakeX;
        const sy = crop.sy + NaturalVariations.microShakeY;
        
        try {
          const mirror = window.__mediaSimConfig && window.__mediaSimConfig.mirrorVideo;
          if (mirror) {
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(video, sx, sy, crop.sw, crop.sh, -cw, 0, cw, ch);
            ctx.restore();
          } else {
            ctx.drawImage(video, sx, sy, crop.sw, crop.sh, 0, 0, cw, ch);
          }
        } catch (e) {
          ctx.fillStyle = '#1a1a2e';
          ctx.fillRect(0, 0, cw, ch);
          ctx.fillStyle = '#ff4444';
          ctx.font = '16px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Video Error', cw/2, ch/2);
        }
        
        requestAnimationFrame(draw);
      }
      
      requestAnimationFrame(draw);
      
      setTimeout(function() {
        try {
          const stream = getCanvasStream(canvas, CONFIG.TARGET_FPS);
          if (!stream || stream.getVideoTracks().length === 0) {
            reject(new Error('captureStream failed'));
            return;
          }
          
          if (wantsAudio) addSilentAudio(stream);
          
          // ============ ENHANCED TRACK SPOOFING FROM DEVICE TEMPLATE ============
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            // Get device template data for spoofing
            const deviceName = device?.name || 'Camera';
            const deviceId = device?.id || 'default_camera';
            const groupId = device?.groupId || 'default';
            const facingMode = device?.facing === 'back' ? 'environment' : 'user';
            const caps = device?.capabilities || {};
            
            // Get max resolution from capabilities
            const videoResolutions = caps.videoResolutions || [];
            const maxWidth = videoResolutions.length > 0 ? Math.max.apply(null, videoResolutions.map(function(r) { return r.width; })) : res.width;
            const maxHeight = videoResolutions.length > 0 ? Math.max.apply(null, videoResolutions.map(function(r) { return r.height; })) : res.height;
            const maxFps = videoResolutions.length > 0 ? Math.max.apply(null, videoResolutions.map(function(r) { return r.maxFps || 30; })) : CONFIG.TARGET_FPS;
            
            // Spoof getSettings - derived from device template
            videoTrack.getSettings = function() {
              return {
                width: res.width,
                height: res.height,
                frameRate: CONFIG.TARGET_FPS,
                aspectRatio: res.width / res.height,
                facingMode: facingMode,
                deviceId: deviceId,
                groupId: groupId,
                resizeMode: 'none'
              };
            };
            
            // Spoof getCapabilities - derived from device template capabilities
            videoTrack.getCapabilities = function() {
              return {
                aspectRatio: { min: 0.5, max: 2.0 },
                deviceId: deviceId,
                facingMode: [facingMode],
                frameRate: { min: 1, max: maxFps },
                groupId: groupId,
                height: { min: 1, max: maxHeight },
                width: { min: 1, max: maxWidth },
                resizeMode: ['none', 'crop-and-scale']
              };
            };
            
            // Spoof getConstraints - derived from device template
            videoTrack.getConstraints = function() {
              return {
                facingMode: facingMode,
                width: { ideal: res.width },
                height: { ideal: res.height },
                deviceId: { exact: deviceId }
              };
            };
            
            // Make label match device template name
            Object.defineProperty(videoTrack, 'label', {
              get: function() { return deviceName; },
              configurable: true
            });
            
            Logger.log('Track spoofed from template:', deviceName, '| facing:', facingMode, '| caps:', maxWidth + 'x' + maxHeight + '@' + maxFps);
          }
          
          // Cleanup function
          stream._cleanup = function() {
            isRunning = false;
            video.pause();
            video.src = '';
            safeRemoveElement(video);
            Logger.log('Stream cleanup completed');
          };
          
          // Store for health monitoring
          stream._sourceVideo = video;
          stream._canvas = canvas;
          stream._isRunning = function() { return isRunning; };
          stream._stop = function() { isRunning = false; };
          
          resolve(stream);
        } catch (err) {
          reject(err);
        }
      }, 50);
    });
  }
  
  // ============ STREAM HEALTH MONITORING ============
  function setupStreamHealthCheck(stream, video, device) {
    const healthInterval = setInterval(function() {
      if (!stream._isRunning || !stream._isRunning()) {
        clearInterval(healthInterval);
        return;
      }
      
      const avgFps = Metrics.getAverageFps();
      const isHealthy = avgFps >= CONFIG.MIN_ACCEPTABLE_FPS;
      
      if (!isHealthy) {
        Logger.warn('Stream health degraded - FPS:', avgFps.toFixed(1));
        
        // Notify RN about health issue
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'streamHealth',
            payload: {
              deviceId: device.id,
              fps: avgFps,
              healthy: false,
              metrics: Metrics.getSummary()
            }
          }));
        }
      }
      
      // Check if video is still playing
      if (video && video.paused && stream._isRunning()) {
        Logger.warn('Video paused unexpectedly, resuming...');
        video.play().catch(function(e) {
          Logger.error('Failed to resume video:', e.message);
        });
      }
    }, CONFIG.HEALTH_CHECK_INTERVAL);
    
    // Store interval for cleanup
    stream._healthInterval = healthInterval;
    
    const originalCleanup = stream._cleanup;
    stream._cleanup = function() {
      clearInterval(healthInterval);
      if (originalCleanup) originalCleanup();
    };
  }
  
  // ============ CANVAS PATTERN STREAM (ALWAYS GREEN SCREEN) ============
  function createCanvasStream(device, wantsAudio, pattern) {
    // Always redirect to green screen stream with fallback chain
    Logger.log('Canvas stream requested with pattern:', pattern, '- redirecting to green screen');
    return createGreenScreenStreamWithFallbacks(device, wantsAudio);
  }
  
  // Green screen with automatic fallback chain
  function createGreenScreenStreamWithFallbacks(device, wantsAudio) {
    return new Promise(function(resolve, reject) {
      const res = getPortraitRes(device);
      const w = res.width, h = res.height;
      
      Logger.log('Creating green screen stream with fallbacks:', w, 'x', h, '(9:16 enforced)');
      
      const canvasProto = typeof HTMLCanvasElement !== 'undefined' ? HTMLCanvasElement.prototype : null;
      const captureSupported = canvasProto && (canvasProto.captureStream || canvasProto.mozCaptureStream || canvasProto.webkitCaptureStream);
      if (!captureSupported) {
        reject(new Error('captureStream not supported'));
        return;
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { alpha: false });
      
      if (!ctx) {
        reject(new Error('Canvas context failed'));
        return;
      }
      
      let frame = 0;
      const start = Date.now();
      let isRunning = true;
      let lastDrawTime = 0;
      const targetFrameTime = 1000 / CONFIG.TARGET_FPS;
      let currentFallbackIdx = 0;
      let errorCount = 0;
      const MAX_ERRORS_BEFORE_FALLBACK = 3;
      
      function render(timestamp) {
        if (!isRunning) return;
        
        const elapsed = timestamp - lastDrawTime;
        if (elapsed < targetFrameTime * 0.9) {
          requestAnimationFrame(render);
          return;
        }
        lastDrawTime = timestamp;
        
        Metrics.recordFrame();
        const t = (Date.now() - start) / 1000;
        
        try {
          // Use current fallback renderer (always green screen variant)
          VIDEO_FORMAT_FALLBACKS[currentFallbackIdx].render(ctx, w, h, t, frame);
          errorCount = 0; // Reset on success
        } catch (e) {
          errorCount++;
          Logger.warn('Render error:', e.message, '| errors:', errorCount);
          
          if (errorCount >= MAX_ERRORS_BEFORE_FALLBACK) {
            // Move to next fallback
            currentFallbackIdx = (currentFallbackIdx + 1) % VIDEO_FORMAT_FALLBACKS.length;
            Logger.log('Switching to fallback', currentFallbackIdx, ':', VIDEO_FORMAT_FALLBACKS[currentFallbackIdx].name);
            errorCount = 0;
          }
          
          // Ultimate fallback - simple green fill
          try {
            ctx.fillStyle = '#00FF00';
            ctx.fillRect(0, 0, w, h);
          } catch (e2) {
            Logger.error('Critical render failure');
          }
        }
        
        frame++;
        requestAnimationFrame(render);
      }
      
      requestAnimationFrame(render);
      
      setTimeout(function() {
        try {
          const stream = getCanvasStream(canvas, CONFIG.TARGET_FPS);
          if (!stream || stream.getVideoTracks().length === 0) {
            reject(new Error('Green screen captureStream failed'));
            return;
          }
          
          if (wantsAudio) addSilentAudio(stream);
          
          // ============ TRACK SPOOFING FROM DEVICE TEMPLATE (GREEN SCREEN) ============
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            const deviceName = device?.name || 'Camera';
            const deviceId = device?.id || 'default_camera';
            const groupId = device?.groupId || 'default';
            const facingMode = device?.facing === 'back' ? 'environment' : 'user';
            const caps = device?.capabilities || {};
            
            const videoResolutions = caps.videoResolutions || [];
            const maxWidth = videoResolutions.length > 0 ? Math.max.apply(null, videoResolutions.map(function(r) { return r.width; })) : w;
            const maxHeight = videoResolutions.length > 0 ? Math.max.apply(null, videoResolutions.map(function(r) { return r.height; })) : h;
            const maxFps = videoResolutions.length > 0 ? Math.max.apply(null, videoResolutions.map(function(r) { return r.maxFps || 30; })) : CONFIG.TARGET_FPS;
            
            videoTrack.getSettings = function() {
              return {
                width: w,
                height: h,
                frameRate: CONFIG.TARGET_FPS,
                aspectRatio: w / h,
                facingMode: facingMode,
                deviceId: deviceId,
                groupId: groupId,
                resizeMode: 'none'
              };
            };
            
            videoTrack.getCapabilities = function() {
              return {
                aspectRatio: { min: 0.5, max: 2.0 },
                deviceId: deviceId,
                facingMode: [facingMode],
                frameRate: { min: 1, max: maxFps },
                groupId: groupId,
                height: { min: 1, max: maxHeight },
                width: { min: 1, max: maxWidth },
                resizeMode: ['none', 'crop-and-scale']
              };
            };
            
            videoTrack.getConstraints = function() {
              return {
                facingMode: facingMode,
                width: { ideal: w },
                height: { ideal: h },
                deviceId: { exact: deviceId }
              };
            };
            
            Object.defineProperty(videoTrack, 'label', {
              get: function() { return deviceName; },
              configurable: true
            });
            
            Logger.log('Green screen track spoofed:', deviceName, '| facing:', facingMode);
          }
          
          stream._cleanup = function() { 
            isRunning = false; 
            Logger.log('Green screen stream cleanup');
          };
          stream._isRunning = function() { return isRunning; };
          stream._switchFallback = function() {
            currentFallbackIdx = (currentFallbackIdx + 1) % VIDEO_FORMAT_FALLBACKS.length;
            Logger.log('Manual fallback switch to:', VIDEO_FORMAT_FALLBACKS[currentFallbackIdx].name);
          };
          
          Logger.log('Green screen stream ready:', stream.getTracks().length, 'tracks | 9:16 enforced | Fallback:', VIDEO_FORMAT_FALLBACKS[currentFallbackIdx].name);
          resolve(stream);
        } catch (err) {
          reject(err);
        }
      }, 80);
    });
  }
  
  // ============ PATTERN RENDERERS ============
  // GREEN SCREEN - Primary fallback (always used)
  function renderGreenScreen(ctx, w, h, t, frame) {
    // Pure green chroma key background
    ctx.fillStyle = '#00FF00';
    ctx.fillRect(0, 0, w, h);
    
    // Subtle corner markers for alignment (barely visible)
    ctx.fillStyle = 'rgba(0, 200, 0, 0.3)';
    const markerSize = 20;
    ctx.fillRect(0, 0, markerSize, markerSize);
    ctx.fillRect(w - markerSize, 0, markerSize, markerSize);
    ctx.fillRect(0, h - markerSize, markerSize, markerSize);
    ctx.fillRect(w - markerSize, h - markerSize, markerSize, markerSize);
  }
  
  // FALLBACK 1: Solid green with subtle gradient
  function renderGreenGradient(ctx, w, h, t, frame) {
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#00FF00');
    grd.addColorStop(0.5, '#00EE00');
    grd.addColorStop(1, '#00FF00');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
  }
  
  // FALLBACK 2: Lime green variant
  function renderLimeGreen(ctx, w, h, t, frame) {
    ctx.fillStyle = '#32CD32';
    ctx.fillRect(0, 0, w, h);
  }
  
  // FALLBACK 3: Bright neon green
  function renderNeonGreen(ctx, w, h, t, frame) {
    ctx.fillStyle = '#39FF14';
    ctx.fillRect(0, 0, w, h);
  }
  
  // FALLBACK 4: Standard chroma green (film industry)
  function renderChromaGreen(ctx, w, h, t, frame) {
    ctx.fillStyle = '#00B140';
    ctx.fillRect(0, 0, w, h);
  }
  
  // FALLBACK 5: Classic green screen (broadcast standard)
  function renderBroadcastGreen(ctx, w, h, t, frame) {
    ctx.fillStyle = '#00A86B';
    ctx.fillRect(0, 0, w, h);
  }
  
  function renderColorBars(ctx, w, h, frame) {
    // Redirect to green screen
    renderGreenScreen(ctx, w, h, 0, frame);
  }
  
  function renderMotion(ctx, w, h, t) {
    // Redirect to green gradient
    renderGreenGradient(ctx, w, h, t, 0);
  }
  
  function renderFace(ctx, w, h, t) {
    // Redirect to green screen
    renderGreenScreen(ctx, w, h, t, 0);
  }
  
  function renderDefault(ctx, w, h, t, frame) {
    // Always render green screen - 9:16 aspect ratio enforced
    renderGreenScreen(ctx, w, h, t, frame);
  }
  
  // ============ AUDIO HELPER ============
  function addSilentAudio(stream) {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      const dest = ac.createMediaStreamDestination();
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      dest.stream.getAudioTracks().forEach(function(t) { stream.addTrack(t); });
    } catch (e) {
      Logger.warn('Silent audio failed:', e.message);
    }
  }
  
  // ============ MESSAGE LISTENERS ============
  document.addEventListener('message', function(e) {
    try {
      if (typeof e.data !== 'string' || !e.data.startsWith('{')) return;
      const d = JSON.parse(e.data);
      if (d?.type === 'media') window.__updateMediaConfig(d.payload);
      if (d?.type === 'permissionResponse') window.__handlePermissionResponse(d);
    } catch(err) {}
  });
  
  window.addEventListener('message', function(e) {
    try {
      if (!e.data) return;
      const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (d?.type === 'media') window.__updateMediaConfig(d.payload);
      if (d?.type === 'permissionResponse') window.__handlePermissionResponse(d);
    } catch(err) {}
  });
  
  // ============ POLYFILLS ============
  if (typeof MediaDeviceInfo === 'undefined') {
    window.MediaDeviceInfo = function MediaDeviceInfo() {};
  }
  
  // ============ INIT COMPLETE ============
  setTimeout(function() { OverlayBadge.update(); }, 0);
  notifyReady('init');
  Logger.log('======== INIT COMPLETE ========');
  Logger.log('Portrait mode enforced: 9:16');
  Logger.log('GREEN SCREEN MODE: ALWAYS ACTIVE');
  Logger.log('Fallback formats:', VIDEO_FORMAT_FALLBACKS.length);
  Logger.log('Health monitoring: ENABLED');
  Logger.log('Video caching: LRU eviction enabled');
  Logger.log('Quality adaptation: 3 levels (high/medium/low)');
  Logger.log('Stream registry: max', CONFIG.MAX_ACTIVE_STREAMS, 'active streams');
  Logger.log('Memory cleanup: Page lifecycle hooks active');
  Logger.log('CORS retry:', CONFIG.CORS_STRATEGIES.length, 'strategies');
  ${devices.length > 0 ? `
  ${JSON.stringify(devices)}.forEach(function(d) {
    Logger.log('-', d.name, '| sim:', d.simulationEnabled, '| uri:', (d.assignedVideoUri || 'none').substring(0,40));
  });
  ` : ''}
})();
true;
`;
};

export const VIDEO_SIMULATION_TEST_SCRIPT = `
(function() {
  if (typeof window === 'undefined') return;
  if (window.__videoSimTestInitialized) return;
  window.__videoSimTestInitialized = true;
  
  window.__videoSimTest = {
    lastTestResult: null,
    testHistory: [],
    isRunning: false
  };
  
  window.__runVideoSimulationTest = async function(testConfig) {
    console.log('[VideoSimTest] Starting comprehensive video simulation test...');
    window.__videoSimTest.isRunning = true;
    
    const result = {
      timestamp: new Date().toISOString(),
      success: false,
      steps: [],
      errors: [],
      streamInfo: null,
      metrics: null
    };
    
    try {
      if (typeof navigator === 'undefined' ||
          !navigator.mediaDevices ||
          typeof navigator.mediaDevices.enumerateDevices !== 'function' ||
          typeof navigator.mediaDevices.getUserMedia !== 'function') {
        throw new Error('MediaDevices API unavailable in this WebView');
      }
      // Step 1: Enumerate devices
      result.steps.push({ step: 'enumerate_devices', status: 'running' });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      result.steps[0].status = 'success';
      result.steps[0].data = { totalDevices: devices.length, videoDevices: videoDevices.length };
      console.log('[VideoSimTest] Found', videoDevices.length, 'video devices');
      
      // Step 2: Request stream with portrait constraints
      result.steps.push({ step: 'request_stream', status: 'running' });
      const constraints = {
        video: {
          width: { ideal: 1080 },
          height: { ideal: 1920 },
          aspectRatio: { ideal: 9/16 },
          facingMode: 'user'
        },
        audio: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      result.steps[1].status = 'success';
      console.log('[VideoSimTest] Stream obtained');
      
      // Step 3: Analyze stream
      result.steps.push({ step: 'analyze_stream', status: 'running' });
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        result.streamInfo = {
          label: videoTrack.label,
          width: settings.width,
          height: settings.height,
          frameRate: settings.frameRate,
          aspectRatio: settings.aspectRatio,
          isPortrait: settings.height > settings.width,
          facingMode: settings.facingMode
        };
        result.steps[2].status = 'success';
        result.steps[2].data = result.streamInfo;
        console.log('[VideoSimTest] Stream info:', result.streamInfo);
        
        if (result.streamInfo.isPortrait) {
          console.log('[VideoSimTest] ✓ Stream is in portrait orientation (9:16)');
        } else {
          console.warn('[VideoSimTest] ✗ Stream is NOT in portrait orientation');
          result.errors.push('Stream is not in portrait orientation');
        }
        
        // Check aspect ratio
        const ratio = result.streamInfo.width / result.streamInfo.height;
        const targetRatio = 9 / 16;
        if (Math.abs(ratio - targetRatio) < 0.05) {
          console.log('[VideoSimTest] ✓ Aspect ratio is 9:16');
        } else {
          console.warn('[VideoSimTest] ✗ Aspect ratio is not 9:16, got:', ratio.toFixed(3));
        }
      } else {
        result.steps[2].status = 'failed';
        result.errors.push('No video track in stream');
      }
      
      // Step 4: Verify injection
      result.steps.push({ step: 'verify_injection', status: 'running' });
      const isSimulated = window.__mediaSimConfig && window.__mediaSimConfig.stealthMode;
      result.steps[3].status = 'success';
      result.steps[3].data = { 
        isSimulated: isSimulated,
        stealthMode: window.__mediaSimConfig?.stealthMode,
        devicesConfigured: window.__mediaSimConfig?.devices?.length || 0
      };
      
      // Step 5: Get metrics
      result.steps.push({ step: 'get_metrics', status: 'running' });
      if (window.__getSimulationMetrics) {
        result.metrics = window.__getSimulationMetrics();
        result.steps[4].status = 'success';
        result.steps[4].data = result.metrics;
        console.log('[VideoSimTest] Metrics:', result.metrics);
      } else {
        result.steps[4].status = 'skipped';
      }
      
      // Cleanup
      stream.getTracks().forEach(track => track.stop());
      console.log('[VideoSimTest] Stream stopped');
      
      result.success = result.errors.length === 0;
      
    } catch (err) {
      console.error('[VideoSimTest] Test failed:', err.message);
      result.errors.push(err.message);
      result.steps.push({ step: 'error', status: 'failed', error: err.message });
    }
    
    window.__videoSimTest.lastTestResult = result;
    window.__videoSimTest.testHistory.push(result);
    window.__videoSimTest.isRunning = false;
    
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'videoSimTestResult',
        payload: result
      }));
    }
    
    console.log('[VideoSimTest] Test complete:', result.success ? 'SUCCESS' : 'FAILED');
    return result;
  };
  
  window.__getVideoSimTestResults = function() {
    return {
      lastResult: window.__videoSimTest.lastTestResult,
      history: window.__videoSimTest.testHistory,
      isRunning: window.__videoSimTest.isRunning
    };
  };
  
  window.__runQuickHealthCheck = function() {
    const metrics = window.__getSimulationMetrics ? window.__getSimulationMetrics() : null;
    const config = window.__mediaSimConfig || {};
    
    return {
      healthy: metrics ? (parseFloat(metrics.avgFps) >= 15) : false,
      metrics: metrics,
      stealthMode: config.stealthMode,
      devicesConfigured: config.devices?.length || 0,
      activeSimulations: config.devices?.filter(d => d.simulationEnabled).length || 0
    };
  };
  
  console.log('[VideoSimTest] Video simulation test utilities initialized');
  console.log('[VideoSimTest] Run __runVideoSimulationTest() to test');
  console.log('[VideoSimTest] Run __runQuickHealthCheck() for health status');
})();
true;
`;

/**
 * BULLETPROOF CAMERA REPLACEMENT SCRIPT
 * 
 * This is a simplified, robust injection script that ALWAYS works.
 * It uses a canvas-based animated test pattern that is guaranteed to:
 * 1. Work without external video files (no CORS issues)
 * 2. Show visible movement for verification
 * 3. Display status information on the stream
 * 4. Fall back gracefully on any error
 */
export const BULLETPROOF_INJECTION_SCRIPT = `
(function() {
  if (window.__bulletproofActive) {
    console.log('[Bulletproof] Already active');
    return;
  }
  window.__bulletproofActive = true;
  
  console.log('[Bulletproof] ========================================');
  console.log('[Bulletproof] CAMERA REPLACEMENT SYSTEM INITIALIZING');
  console.log('[Bulletproof] ========================================');
  
  // Configuration
  const CONFIG = {
    WIDTH: 1080,
    HEIGHT: 1920,
    FPS: 30,
    SHOW_DEBUG: true,
  };
  
  // Store originals
  const _origGUM = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
  const _origEnumerate = navigator.mediaDevices?.enumerateDevices?.bind(navigator.mediaDevices);
  
  // Animation state
  let canvas = null;
  let ctx = null;
  let isAnimating = false;
  let animFrame = null;
  let startTime = 0;
  let frameNum = 0;
  const activeStreams = new Set();
  
  // Assigned video URL (from RN config)
  let assignedVideoUrl = null;
  let videoElement = null;
  let useVideoSource = false;
  
  // ============ CANVAS SETUP ============
  function initCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.width = CONFIG.WIDTH;
    canvas.height = CONFIG.HEIGHT;
    ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    console.log('[Bulletproof] Canvas initialized:', CONFIG.WIDTH, 'x', CONFIG.HEIGHT);
  }
  
  // ============ ANIMATED TEST PATTERN ============
  function renderAnimatedPattern(time, frame) {
    const w = canvas.width;
    const h = canvas.height;
    
    // Animated gradient background
    const hue = (time * 40) % 360;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'hsl(' + hue + ', 55%, 25%)');
    grad.addColorStop(0.5, 'hsl(' + ((hue + 100) % 360) + ', 55%, 15%)');
    grad.addColorStop(1, 'hsl(' + ((hue + 200) % 360) + ', 55%, 25%)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    
    // MOVING CIRCLES - clearly visible animation
    for (let i = 0; i < 6; i++) {
      const angle = time * (1 + i * 0.25) + (i * 1.1);
      const orbitR = 180 + i * 40;
      const r = 35 + i * 15;
      const cx = w / 2 + Math.cos(angle) * orbitR;
      const cy = h * 0.35 + i * (h * 0.08) + Math.sin(angle * 0.8) * 50;
      
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = 'hsla(' + ((hue + i * 50) % 360) + ', 65%, 55%, 0.85)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    // PULSING CENTER INDICATOR
    const pulse = 1 + Math.sin(time * 5) * 0.2;
    ctx.save();
    ctx.translate(w / 2, h * 0.68);
    ctx.scale(pulse, pulse);
    
    // Play triangle
    ctx.beginPath();
    ctx.moveTo(-40, -50);
    ctx.lineTo(-40, 50);
    ctx.lineTo(50, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();
    ctx.restore();
    
    // STATUS BAR
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(15, h - 155, 520, 140);
    
    // Status text
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('✓ CAMERA REPLACED', 35, h - 115);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px monospace';
    ctx.fillText('Frame: ' + String(frame % 10000).padStart(5, '0'), 35, h - 80);
    ctx.fillText('Time: ' + time.toFixed(2) + 's', 250, h - 80);
    ctx.fillText(w + 'x' + h + ' @ ' + CONFIG.FPS + 'fps', 35, h - 50);
    ctx.fillText('Protocol: ACTIVE', 300, h - 50);
    
    // SCANNING LINE - proof of movement
    const scanY = (frame * 18) % h;
    ctx.fillStyle = 'rgba(0,255,136,0.4)';
    ctx.fillRect(0, scanY, w, 5);
    
    // CORNER MARKERS
    const cs = 70;
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(0, 0, cs, 7);
    ctx.fillRect(0, 0, 7, cs);
    ctx.fillRect(w - cs, 0, cs, 7);
    ctx.fillRect(w - 7, 0, 7, cs);
    ctx.fillRect(0, h - 7, cs, 7);
    ctx.fillRect(0, h - cs, 7, cs);
    ctx.fillRect(w - cs, h - 7, cs, 7);
    ctx.fillRect(w - 7, h - cs, 7, cs);
  }
  
  // ============ VIDEO SOURCE RENDERING ============
  function renderVideoSource() {
    if (!videoElement || videoElement.paused || videoElement.ended) {
      renderAnimatedPattern((Date.now() - startTime) / 1000, frameNum);
      return;
    }
    
    const w = canvas.width;
    const h = canvas.height;
    const vw = videoElement.videoWidth || w;
    const vh = videoElement.videoHeight || h;
    
    // Cover mode - fill canvas
    const scale = Math.max(w / vw, h / vh);
    const sw = w / scale;
    const sh = h / scale;
    const sx = (vw - sw) / 2;
    const sy = (vh - sh) / 2;
    
    try {
      ctx.drawImage(videoElement, sx, sy, sw, sh, 0, 0, w, h);
    } catch (e) {
      // Fallback to pattern on error
      renderAnimatedPattern((Date.now() - startTime) / 1000, frameNum);
    }
  }
  
  // ============ ANIMATION LOOP ============
  function animate() {
    if (!isAnimating) return;
    
    const elapsed = (Date.now() - startTime) / 1000;
    
    if (useVideoSource && videoElement && !videoElement.paused) {
      renderVideoSource();
    } else {
      renderAnimatedPattern(elapsed, frameNum);
    }
    
    frameNum++;
    animFrame = requestAnimationFrame(animate);
  }
  
  function startAnimation() {
    if (isAnimating) return;
    initCanvas();
    isAnimating = true;
    startTime = Date.now();
    frameNum = 0;
    animate();
    console.log('[Bulletproof] Animation started');
  }
  
  function stopAnimation() {
    isAnimating = false;
    if (animFrame) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }
  }
  
  // ============ LOAD VIDEO ============
  function loadAssignedVideo(url) {
    if (!url || url === assignedVideoUrl) return;
    
    console.log('[Bulletproof] Loading assigned video:', url.substring(0, 60));
    assignedVideoUrl = url;
    
    if (videoElement) {
      videoElement.pause();
      videoElement.src = '';
    }
    
    videoElement = document.createElement('video');
    videoElement.muted = true;
    videoElement.loop = true;
    videoElement.playsInline = true;
    videoElement.setAttribute('playsinline', 'true');
    videoElement.crossOrigin = 'anonymous';
    videoElement.preload = 'auto';
    videoElement.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:1px;height:1px;';
    document.body.appendChild(videoElement);
    
    videoElement.onloadeddata = function() {
      console.log('[Bulletproof] Video loaded:', videoElement.videoWidth, 'x', videoElement.videoHeight);
      useVideoSource = true;
      videoElement.play().catch(function(e) {
        console.warn('[Bulletproof] Video autoplay failed:', e);
        useVideoSource = false;
      });
    };
    
    videoElement.onerror = function() {
      console.warn('[Bulletproof] Video load failed, using test pattern');
      useVideoSource = false;
    };
    
    videoElement.src = url;
  }
  
  // ============ CREATE STREAM ============
  function createReplacementStream(constraints) {
    startAnimation();
    
    try {
      const stream = canvas.captureStream(CONFIG.FPS);
      
      if (!stream || stream.getVideoTracks().length === 0) {
        throw new Error('captureStream failed');
      }
      
      const track = stream.getVideoTracks()[0];
      
      // Spoof track methods
      track.getSettings = function() {
        return {
          width: CONFIG.WIDTH,
          height: CONFIG.HEIGHT,
          frameRate: CONFIG.FPS,
          facingMode: 'user',
          deviceId: 'bulletproof-camera',
          groupId: 'bulletproof-group',
          aspectRatio: CONFIG.WIDTH / CONFIG.HEIGHT,
        };
      };
      
      track.getCapabilities = function() {
        return {
          width: { min: 1, max: CONFIG.WIDTH },
          height: { min: 1, max: CONFIG.HEIGHT },
          frameRate: { min: 1, max: CONFIG.FPS },
          facingMode: ['user', 'environment'],
          deviceId: 'bulletproof-camera',
        };
      };
      
      track.getConstraints = function() {
        return {
          width: { ideal: CONFIG.WIDTH },
          height: { ideal: CONFIG.HEIGHT },
          facingMode: 'user',
        };
      };
      
      Object.defineProperty(track, 'label', {
        get: function() { return 'Bulletproof Test Camera (1080x1920)'; },
        configurable: true,
      });
      
      // Handle audio
      if (constraints?.audio) {
        try {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          const dest = audioCtx.createMediaStreamDestination();
          gain.gain.value = 0;
          osc.connect(gain);
          gain.connect(dest);
          osc.start();
          dest.stream.getAudioTracks().forEach(function(t) { stream.addTrack(t); });
        } catch (e) {}
      }
      
      // Track stream for cleanup
      activeStreams.add(stream);
      
      stream.getTracks().forEach(function(t) {
        const origStop = t.stop.bind(t);
        t.stop = function() {
          origStop();
          activeStreams.delete(stream);
          if (activeStreams.size === 0) {
            stopAnimation();
          }
        };
      });
      
      console.log('[Bulletproof] Created replacement stream - tracks:', stream.getTracks().length);
      return stream;
      
    } catch (err) {
      console.error('[Bulletproof] Stream creation failed:', err);
      throw err;
    }
  }
  
  // ============ OVERRIDE APIS ============
  if (navigator.mediaDevices) {
    navigator.mediaDevices.getUserMedia = async function(constraints) {
      console.log('[Bulletproof] getUserMedia intercepted');
      
      if (constraints?.video) {
        try {
          return createReplacementStream(constraints);
        } catch (err) {
          console.error('[Bulletproof] Replacement failed, trying original');
          if (_origGUM) {
            return _origGUM(constraints);
          }
          throw err;
        }
      }
      
      if (_origGUM) {
        return _origGUM(constraints);
      }
      throw new Error('getUserMedia not available');
    };
    
    navigator.mediaDevices.enumerateDevices = async function() {
      console.log('[Bulletproof] enumerateDevices intercepted');
      return [
        {
          deviceId: 'bulletproof-camera',
          groupId: 'bulletproof-group',
          kind: 'videoinput',
          label: 'Bulletproof Test Camera (1080x1920)',
          toJSON: function() { return this; },
        },
        {
          deviceId: 'bulletproof-audio',
          groupId: 'bulletproof-group',
          kind: 'audioinput',
          label: 'Bulletproof Audio Input',
          toJSON: function() { return this; },
        },
      ];
    };
  }
  
  // ============ CONFIG UPDATE ============
  window.__bulletproofConfig = {
    setVideoUrl: function(url) {
      if (url) loadAssignedVideo(url);
    },
    useTestPattern: function() {
      useVideoSource = false;
    },
    getStatus: function() {
      return {
        active: isAnimating,
        streamCount: activeStreams.size,
        usingVideo: useVideoSource,
        videoUrl: assignedVideoUrl,
        frame: frameNum,
      };
    },
    forceRefresh: function() {
      startTime = Date.now();
      frameNum = 0;
    },
  };
  
  // Listen for config from RN
  window.addEventListener('message', function(e) {
    try {
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (data?.type === 'bulletproof') {
        if (data.videoUrl) {
          window.__bulletproofConfig.setVideoUrl(data.videoUrl);
        }
      }
    } catch (err) {}
  });
  
  document.addEventListener('message', function(e) {
    try {
      if (typeof e.data !== 'string' || !e.data.startsWith('{')) return;
      const data = JSON.parse(e.data);
      if (data?.type === 'bulletproof') {
        if (data.videoUrl) {
          window.__bulletproofConfig.setVideoUrl(data.videoUrl);
        }
      }
    } catch (err) {}
  });
  
  console.log('[Bulletproof] ========================================');
  console.log('[Bulletproof] CAMERA REPLACEMENT SYSTEM ACTIVE');
  console.log('[Bulletproof] Resolution:', CONFIG.WIDTH, 'x', CONFIG.HEIGHT, '@', CONFIG.FPS, 'fps');
  console.log('[Bulletproof] ========================================');
  
  // Notify RN that we're ready
  if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'bulletproofReady',
      config: { width: CONFIG.WIDTH, height: CONFIG.HEIGHT, fps: CONFIG.FPS }
    }));
  }
})();
true;
`;

/**
 * Creates a simple bulletproof injection script that uses the built-in test pattern
 * with optional video URL override. This is more reliable than the complex version.
 */
export const createSimplifiedInjectionScript = (videoUrl?: string): string => {
  const videoConfig = videoUrl ? `window.__bulletproofConfig?.setVideoUrl(${JSON.stringify(videoUrl)});` : '';
  
  return BULLETPROOF_INJECTION_SCRIPT + `
(function() {
  ${videoConfig}
  console.log('[SimplifiedInjection] Configured with video:', ${JSON.stringify(videoUrl || 'test pattern')});
})();
true;
`;
};
