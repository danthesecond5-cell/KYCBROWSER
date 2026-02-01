/**
 * Enhanced Stealth Profiles
 * Additional modern fingerprinting protection techniques
 * Optimizations for existing stealth system
 */

// ============ ENHANCED DEVICE PROFILES ============

export const ENHANCED_DEVICE_PROFILES = {
  // Modern high-end device profiles
  IPHONE_15_PRO_MAX: {
    navigator: {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
      platform: 'iPhone',
      vendor: 'Apple Computer, Inc.',
      language: 'en-US',
      languages: ['en-US', 'en'],
      hardwareConcurrency: 6,
      deviceMemory: 8,
      maxTouchPoints: 5,
    },
    screen: {
      width: 430,
      height: 932,
      availWidth: 430,
      availHeight: 932,
      colorDepth: 24,
      pixelDepth: 24,
      devicePixelRatio: 3,
    },
    performance: {
      cpuClass: 'high',
      gpuTier: 3,
      memory: 8192
    }
  },
  
  SAMSUNG_S24_ULTRA: {
    navigator: {
      userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
      platform: 'Linux armv81',
      vendor: 'Google Inc.',
      language: 'en-US',
      languages: ['en-US', 'en'],
      hardwareConcurrency: 8,
      deviceMemory: 12,
      maxTouchPoints: 5,
    },
    screen: {
      width: 1440,
      height: 3120,
      availWidth: 1440,
      availHeight: 3120,
      colorDepth: 24,
      pixelDepth: 24,
      devicePixelRatio: 3.5,
    },
    performance: {
      cpuClass: 'high',
      gpuTier: 3,
      memory: 12288
    }
  }
};

// ============ ADVANCED FINGERPRINTING TECHNIQUES ============

export const ADVANCED_FINGERPRINTING_PROTECTION = `
(function() {
  if (window.__advancedFingerprintProtection) return;
  window.__advancedFingerprintProtection = true;
  
  console.log('[Enhanced Stealth] Activating advanced fingerprinting protection');
  
  // ============ FONT FINGERPRINTING PROTECTION ============
  const originalDocumentFonts = Object.getOwnPropertyDescriptor(Document.prototype, 'fonts');
  if (originalDocumentFonts) {
    Object.defineProperty(Document.prototype, 'fonts', {
      get: function() {
        const fonts = originalDocumentFonts.get.call(this);
        // Return controlled font list
        const controlledFonts = new Set(['Arial', 'Helvetica', 'Times New Roman', 'Courier']);
        const proxiedFonts = new Proxy(fonts, {
          get(target, prop) {
            if (prop === 'check') {
              return function(font) {
                // Only confirm presence of common fonts
                const fontFamily = font.split(' ').pop().replace(/['""]/g, '');
                return controlledFonts.has(fontFamily);
              };
            }
            return target[prop];
          }
        });
        return proxiedFonts;
      },
      configurable: true
    });
  }
  
  // ============ MEDIA DEVICE FINGERPRINTING PROTECTION ============
  const originalEnumerateDevices = navigator.mediaDevices?.enumerateDevices;
  if (originalEnumerateDevices && navigator.mediaDevices) {
    navigator.mediaDevices.enumerateDevices = async function() {
      const devices = await originalEnumerateDevices.call(this);
      // Return consistent device list
      return [
        { deviceId: 'default', groupId: 'default', kind: 'audioinput', label: 'Default - Microphone' },
        { deviceId: 'default', groupId: 'default', kind: 'audiooutput', label: 'Default - Speaker' },
        { deviceId: 'default', groupId: 'default', kind: 'videoinput', label: 'Default - Camera' }
      ];
    };
  }
  
  // ============ TIMEZONE FINGERPRINTING PROTECTION ============
  const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
  Date.prototype.getTimezoneOffset = function() {
    // Return consistent timezone (EST)
    return 300; // UTC-5
  };
  
  // Also protect Intl.DateTimeFormat
  if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
    const originalResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
    Intl.DateTimeFormat.prototype.resolvedOptions = function() {
      const options = originalResolvedOptions.call(this);
      return {
        ...options,
        timeZone: 'America/New_York'
      };
    };
  }
  
  // ============ WEBRTC LOCAL IP LEAK PREVENTION ============
  if (typeof RTCPeerConnection !== 'undefined') {
    const originalCreateOffer = RTCPeerConnection.prototype.createOffer;
    const originalCreateAnswer = RTCPeerConnection.prototype.createAnswer;
    const originalSetLocalDescription = RTCPeerConnection.prototype.setLocalDescription;
    
    // Intercept SDP to remove local IPs
    function sanitizeSDP(sdp) {
      if (!sdp || !sdp.sdp) return sdp;
      
      // Remove local IP addresses from SDP
      const sanitized = sdp.sdp
        .replace(/c=IN IP4 (192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[01])\.\d+\.\d+)/g, 'c=IN IP4 0.0.0.0')
        .replace(/a=candidate.*192\.168\.\d+\.\d+.*\r\n/g, '')
        .replace(/a=candidate.*10\.\d+\.\d+\.\d+.*\r\n/g, '')
        .replace(/a=candidate.*172\.(1[6-9]|2[0-9]|3[01])\.\d+\.\d+.*\r\n/g, '');
      
      return new RTCSessionDescription({
        type: sdp.type,
        sdp: sanitized
      });
    }
    
    RTCPeerConnection.prototype.setLocalDescription = function(desc) {
      return originalSetLocalDescription.call(this, sanitizeSDP(desc));
    };
  }
  
  // ============ SENSOR API FINGERPRINTING PROTECTION ============
  // Protect accelerometer, gyroscope, magnetometer
  const sensorAPIs = ['Accelerometer', 'Gyroscope', 'Magnetometer', 'LinearAccelerationSensor', 'AbsoluteOrientationSensor'];
  sensorAPIs.forEach(api => {
    if (typeof window[api] === 'function') {
      const OriginalSensor = window[api];
      window[api] = function(...args) {
        const sensor = new OriginalSensor(...args);
        // Add noise to sensor readings
        const originalStart = sensor.start;
        sensor.start = function() {
          originalStart.call(this);
          // Inject subtle noise
          const props = ['x', 'y', 'z'];
          props.forEach(prop => {
            if (sensor[prop] !== undefined) {
              const originalValue = sensor[prop];
              Object.defineProperty(sensor, prop, {
                get: () => originalValue + (Math.random() - 0.5) * 0.001,
                configurable: true
              });
            }
          });
        };
        return sensor;
      };
      window[api].prototype = OriginalSensor.prototype;
    }
  });
  
  // ============ CLIENT HINTS PROTECTION ============
  if (navigator.userAgentData) {
    const spoofedHighEntropyValues = {
      architecture: 'arm',
      bitness: '64',
      brands: [
        { brand: 'Not A(Brand', version: '99' },
        { brand: 'Safari', version: '17' }
      ],
      fullVersionList: [
        { brand: 'Not A(Brand', version: '99.0.0.0' },
        { brand: 'Safari', version: '17.4.1' }
      ],
      mobile: true,
      model: 'iPhone',
      platform: 'iOS',
      platformVersion: '17.4.1',
      uaFullVersion: '17.4.1'
    };
    
    const originalGetHighEntropyValues = navigator.userAgentData.getHighEntropyValues;
    navigator.userAgentData.getHighEntropyValues = async function(hints) {
      // Return spoofed values regardless of hints
      return spoofedHighEntropyValues;
    };
  }
  
  // ============ PERFORMANCE API FINGERPRINTING PROTECTION ============
  if (typeof Performance !== 'undefined' && Performance.prototype.getEntries) {
    const originalGetEntries = Performance.prototype.getEntries;
    Performance.prototype.getEntries = function() {
      const entries = originalGetEntries.call(this);
      // Filter out potentially identifying entries
      return entries.filter(entry => {
        return !entry.name.includes('analytics') &&
               !entry.name.includes('tracking') &&
               !entry.name.includes('fingerprint');
      });
    };
  }
  
  // ============ SCREEN ORIENTATION LOCK FINGERPRINTING ============
  if (screen.orientation && screen.orientation.lock) {
    const originalLock = screen.orientation.lock;
    screen.orientation.lock = async function(orientation) {
      // Add realistic delay
      await new Promise(r => setTimeout(r, Math.random() * 50 + 10));
      return originalLock.call(this, orientation);
    };
  }
  
  // ============ NOTIFICATION API FINGERPRINTING ============
  if (typeof Notification !== 'undefined' && Notification.requestPermission) {
    const originalRequestPermission = Notification.requestPermission;
    Notification.requestPermission = async function() {
      // Add realistic delay
      await new Promise(r => setTimeout(r, Math.random() * 100 + 50));
      return 'default'; // Consistent response
    };
  }
  
  // ============ GAMEPAD API FINGERPRINTING PROTECTION ============
  if (navigator.getGamepads) {
    const originalGetGamepads = navigator.getGamepads;
    navigator.getGamepads = function() {
      // Return empty array (no gamepads connected)
      return [];
    };
  }
  
  // ============ CLIPBOARD API PROTECTION ============
  if (navigator.clipboard) {
    const clipboardMethods = ['read', 'readText', 'write', 'writeText'];
    clipboardMethods.forEach(method => {
      if (navigator.clipboard[method]) {
        const original = navigator.clipboard[method];
        navigator.clipboard[method] = async function(...args) {
          // Add realistic delay
          await new Promise(r => setTimeout(r, Math.random() * 20 + 10));
          return original.call(this, ...args);
        };
      }
    });
  }
  
  // ============ STORAGE QUOTA FINGERPRINTING PROTECTION ============
  if (navigator.storage && navigator.storage.estimate) {
    const originalEstimate = navigator.storage.estimate;
    navigator.storage.estimate = async function() {
      const estimate = await originalEstimate.call(this);
      // Return consistent values
      return {
        quota: 10737418240, // 10GB
        usage: 1073741824,  // 1GB
        usageDetails: {
          indexedDB: 536870912, // 512MB
          caches: 268435456,    // 256MB
          serviceWorkerRegistrations: 0
        }
      };
    };
  }
  
  // ============ SPEECH SYNTHESIS FINGERPRINTING PROTECTION ============
  if (window.speechSynthesis && speechSynthesis.getVoices) {
    const originalGetVoices = speechSynthesis.getVoices;
    speechSynthesis.getVoices = function() {
      // Return consistent voice list
      return [
        { name: 'Samantha', lang: 'en-US', default: true, localService: true, voiceURI: 'Samantha' }
      ];
    };
  }
  
  console.log('[Enhanced Stealth] Advanced fingerprinting protection active');
  console.log('[Enhanced Stealth] Protected: Fonts, Media Devices, Timezone, WebRTC IPs');
  console.log('[Enhanced Stealth] Protected: Sensors, Client Hints, Performance API');
  console.log('[Enhanced Stealth] Protected: Orientation, Notifications, Gamepad');
  console.log('[Enhanced Stealth] Protected: Clipboard, Storage, Speech Synthesis');
})();
true;
`;

// ============ PERFORMANCE OPTIMIZATIONS ============

export const OPTIMIZED_RENDER_LOOP = `
// Optimized render loop with better frame pacing
const FramePacer = {
  targetFPS: 30,
  frameTime: 1000 / 30,
  lastFrameTime: 0,
  drift: 0,
  
  shouldRenderFrame(timestamp) {
    const elapsed = timestamp - this.lastFrameTime + this.drift;
    
    if (elapsed >= this.frameTime) {
      this.drift = elapsed - this.frameTime;
      // Cap drift to prevent runaway
      if (this.drift > this.frameTime) {
        this.drift = 0;
      }
      this.lastFrameTime = timestamp;
      return true;
    }
    
    return false;
  }
};
`;

export const MEMORY_OPTIMIZATION_PATTERNS = {
  // Object pooling for frequently created objects
  objectPool: `
const ObjectPool = {
  pools: new Map(),
  
  create(type, factory, initialSize = 10) {
    if (!this.pools.has(type)) {
      const pool = {
        items: [],
        factory: factory,
        active: new Set()
      };
      
      for (let i = 0; i < initialSize; i++) {
        pool.items.push(factory());
      }
      
      this.pools.set(type, pool);
    }
  },
  
  acquire(type) {
    const pool = this.pools.get(type);
    if (!pool) return null;
    
    let item = pool.items.pop();
    if (!item) {
      item = pool.factory();
    }
    
    pool.active.add(item);
    return item;
  },
  
  release(type, item) {
    const pool = this.pools.get(type);
    if (!pool) return;
    
    pool.active.delete(item);
    pool.items.push(item);
  }
};
  `,
  
  // Efficient image data processing
  efficientImageProcessing: `
// Use OffscreenCanvas for better performance (where available)
function createOptimizedCanvas(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}
  `
};
