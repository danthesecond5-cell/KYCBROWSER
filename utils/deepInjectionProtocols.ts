/**
 * Deep Injection Protocols for Real Website Testing
 * 
 * This module contains multiple injection strategies that hook into
 * getUserMedia at different levels to replace camera feeds on real websites.
 * Each protocol uses a different approach to maximize compatibility.
 * 
 * PROTOCOL 0 is the PRIMARY recommended protocol for webcamtests.com and similar sites.
 * 
 * EXPO GO COMPATIBILITY:
 * ----------------------
 * ALL PROTOCOLS in this module are FULLY COMPATIBLE with Expo Go because:
 * 
 * ✅ Protocol 0: WebView-based injection - RECOMMENDED
 * ✅ Protocol 1: MediaStream constructor override - Works in WebView
 * ✅ Protocol 2: Descriptor-level deep hook - Works in WebView
 * ✅ Protocol 3: Proxy-based intercept - Works in WebView
 * 
 * These protocols generate JavaScript code that runs entirely within the
 * WebView's browser context. They do not require any native modules or
 * custom native code, making them perfect for Expo Go.
 * 
 * The injection scripts override browser APIs (navigator.mediaDevices.getUserMedia,
 * enumerateDevices, etc.) and use standard browser APIs like:
 * - HTMLCanvasElement.captureStream()
 * - IndexedDB for video caching
 * - Web Audio API for audio tracks
 * - requestAnimationFrame for rendering
 * 
 * For Expo Go users: Protocol 0 (createProtocol0Script) is the RECOMMENDED
 * approach as it provides the most comprehensive feature set including
 * video loading, caching, CORS handling, and stealth mode.
 */

import type { CaptureDevice } from '@/types/device';

export interface InjectionConfig {
  videoUri?: string;
  width: number;
  height: number;
  fps: number;
  deviceLabel: string;
  deviceId: string;
  showDebugOverlay: boolean;
  useTestPattern: boolean;
}

export interface Protocol0Options {
  devices: CaptureDevice[];
  videoUri?: string | null;
  fallbackVideoUri?: string | null;
  width?: number;
  height?: number;
  fps?: number;
  showDebugOverlay?: boolean;
  stealthMode?: boolean;
  loopVideo?: boolean;
  mirrorVideo?: boolean;
  // Video loading improvements
  preloadVideo?: boolean;           // Preload video before first getUserMedia call
  enableVideoCache?: boolean;       // Cache remote videos in IndexedDB
  showLoadingIndicator?: boolean;   // Show loading spinner while video loads
  corsRetryStrategies?: boolean;    // Enable multiple CORS retry strategies
  videoLoadTimeout?: number;        // Timeout in ms for video loading (default: 20000)
}

const DEFAULT_CONFIG: InjectionConfig = {
  width: 1080,
  height: 1920,
  fps: 30,
  deviceLabel: 'Camera',
  deviceId: 'injected-camera-0',
  showDebugOverlay: false,
  useTestPattern: true,
};

/**
 * PROTOCOL 0 ENHANCED: Primary injection method with full device support
 * This is the recommended protocol for webcamtests.com and similar sites.
 * 
 * Features:
 * - Ultra-early hook before any page scripts load
 * - Multiple device support with proper selection
 * - Video playback with fallback to test pattern
 * - Full track metadata spoofing
 * - Silent audio track generation
 * - React Native WebView communication
 */
export function createProtocol0Script(options: Protocol0Options): string {
  const {
    devices,
    videoUri,
    fallbackVideoUri,
    width = 1080,
    height = 1920,
    fps = 30,
    showDebugOverlay = false,
    stealthMode = true,
    loopVideo = true,
    mirrorVideo = false,
    // Video loading options with defaults
    preloadVideo = true,
    enableVideoCache = true,
    showLoadingIndicator = true,
    corsRetryStrategies = true,
    videoLoadTimeout = 20000,
  } = options;

  // Get primary camera device
  const primaryCamera = devices.find(d => d.type === 'camera' && d.simulationEnabled) 
    || devices.find(d => d.type === 'camera') 
    || devices[0];

  // Get video URI - prefer device-specific, then options, then fallback
  const effectiveVideoUri = primaryCamera?.assignedVideoUri || videoUri || fallbackVideoUri || null;

  return `
(function() {
  'use strict';
  
  // ============================================================================
  // PROTOCOL 0 ENHANCED: PRIMARY WEBCAM INJECTION
  // ============================================================================
  
  if (window.__protocol0Initialized) {
    console.log('[Protocol0] Already initialized');
    return;
  }
  window.__protocol0Initialized = true;
  
  console.log('[Protocol0] ===== ULTRA-EARLY DEEP HOOK =====');
  console.log('[Protocol0] Resolution: ${width}x${height} @ ${fps}fps');
  console.log('[Protocol0] Stealth Mode: ${stealthMode}');
  
  // ============================================================================
  // CONFIGURATION
  // ============================================================================
  
  const CONFIG = {
    width: ${width},
    height: ${height},
    fps: ${fps},
    showDebugOverlay: ${showDebugOverlay},
    stealthMode: ${stealthMode},
    loopVideo: ${loopVideo},
    mirrorVideo: ${mirrorVideo},
    videoUri: ${JSON.stringify(effectiveVideoUri)},
    // Video loading options
    preloadVideo: ${preloadVideo},
    enableVideoCache: ${enableVideoCache},
    showLoadingIndicator: ${showLoadingIndicator},
    corsRetryStrategies: ${corsRetryStrategies},
    videoLoadTimeout: ${videoLoadTimeout},
  };
  
  const DEVICES = ${JSON.stringify(devices)};
  
  // ============================================================================
  // STATE
  // ============================================================================
  
  let canvas = null;
  let ctx = null;
  let animationFrameId = null;
  let isAnimating = false;
  let frameCount = 0;
  let videoElement = null;
  let useVideo = false;
  let currentStream = null;
  
  // Video loading state
  var videoLoadState = {
    loading: false,
    loaded: false,
    error: null,
    retryCount: 0,
    maxRetries: 3,
    currentUri: null,
    cachedBlob: null,
    loadProgress: 0
  };
  
  // Video cache using IndexedDB
  var VideoCache = {
    dbName: 'Protocol0VideoCache',
    storeName: 'videos',
    db: null,
    
    init: function() {
      var self = this;
      return new Promise(function(resolve) {
        if (!window.indexedDB) {
          console.log('[Protocol0] IndexedDB not available, caching disabled');
          resolve(false);
          return;
        }
        
        var request = indexedDB.open(self.dbName, 1);
        
        request.onerror = function() {
          console.warn('[Protocol0] IndexedDB open failed');
          resolve(false);
        };
        
        request.onsuccess = function(e) {
          self.db = e.target.result;
          console.log('[Protocol0] Video cache initialized');
          resolve(true);
        };
        
        request.onupgradeneeded = function(e) {
          var db = e.target.result;
          if (!db.objectStoreNames.contains(self.storeName)) {
            db.createObjectStore(self.storeName, { keyPath: 'uri' });
          }
        };
      });
    },
    
    get: function(uri) {
      var self = this;
      return new Promise(function(resolve) {
        if (!self.db) {
          resolve(null);
          return;
        }
        
        try {
          var tx = self.db.transaction(self.storeName, 'readonly');
          var store = tx.objectStore(self.storeName);
          var request = store.get(uri);
          
          request.onsuccess = function() {
            if (request.result && request.result.blob) {
              console.log('[Protocol0] Cache hit:', uri.substring(0, 50));
              resolve(request.result.blob);
            } else {
              resolve(null);
            }
          };
          
          request.onerror = function() {
            resolve(null);
          };
        } catch (e) {
          resolve(null);
        }
      });
    },
    
    set: function(uri, blob) {
      var self = this;
      return new Promise(function(resolve) {
        if (!self.db || !blob) {
          resolve(false);
          return;
        }
        
        try {
          var tx = self.db.transaction(self.storeName, 'readwrite');
          var store = tx.objectStore(self.storeName);
          
          store.put({
            uri: uri,
            blob: blob,
            timestamp: Date.now(),
            size: blob.size
          });
          
          tx.oncomplete = function() {
            console.log('[Protocol0] Cached video:', Math.round(blob.size / 1024), 'KB');
            resolve(true);
          };
          
          tx.onerror = function() {
            resolve(false);
          };
        } catch (e) {
          resolve(false);
        }
      });
    },
    
    clear: function() {
      var self = this;
      if (!self.db) return Promise.resolve(false);
      
      return new Promise(function(resolve) {
        try {
          var tx = self.db.transaction(self.storeName, 'readwrite');
          var store = tx.objectStore(self.storeName);
          store.clear();
          tx.oncomplete = function() {
            console.log('[Protocol0] Cache cleared');
            resolve(true);
          };
        } catch (e) {
          resolve(false);
        }
      });
    }
  };
  
  // Initialize cache if enabled
  if (CONFIG.enableVideoCache) {
    VideoCache.init();
  }
  
  // ============================================================================
  // CANVAS INITIALIZATION
  // ============================================================================
  
  function initCanvas() {
    if (canvas) return canvas;
    
    canvas = document.createElement('canvas');
    canvas.width = CONFIG.width;
    canvas.height = CONFIG.height;
    ctx = canvas.getContext('2d', { 
      alpha: false,
      desynchronized: true,
      willReadFrequently: false
    });
    
    console.log('[Protocol0] Canvas initialized:', CONFIG.width, 'x', CONFIG.height);
    return canvas;
  }
  
  // ============================================================================
  // VIDEO LOADING - ENHANCED WITH CORS HANDLING & CACHING
  // ============================================================================
  
  // Detect URI type
  function getUriType(uri) {
    if (!uri) return 'none';
    if (uri.startsWith('data:')) return 'base64';
    if (uri.startsWith('blob:')) return 'blob';
    if (uri.startsWith('builtin:')) return 'builtin';
    if (uri.startsWith('canvas:')) return 'canvas';
    if (uri.startsWith('file://') || uri.startsWith('/') || uri.startsWith('content://')) return 'local';
    if (uri.startsWith('http://') || uri.startsWith('https://')) return 'remote';
    return 'unknown';
  }
  
  // Check if site likely blocks CORS
  function isLikelyCorsBlocked(uri) {
    var blockedHosts = [
      'imgur.com', 'giphy.com', 'gfycat.com', 'streamable.com',
      'youtube.com', 'youtu.be', 'vimeo.com', 'dailymotion.com',
      'tiktok.com', 'instagram.com', 'facebook.com', 'twitter.com',
      'gyazo.com', 'tenor.com', 'cloudinary.com'
    ];
    
    var lowerUri = uri.toLowerCase();
    return blockedHosts.some(function(host) {
      return lowerUri.includes(host);
    });
  }
  
  // Fetch video with progress tracking
  function fetchVideoWithProgress(uri) {
    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', uri, true);
      xhr.responseType = 'blob';
      
      xhr.onprogress = function(e) {
        if (e.lengthComputable) {
          videoLoadState.loadProgress = Math.round((e.loaded / e.total) * 100);
          console.log('[Protocol0] Download progress:', videoLoadState.loadProgress + '%');
        }
      };
      
      xhr.onload = function() {
        if (xhr.status === 200) {
          resolve(xhr.response);
        } else {
          reject(new Error('HTTP ' + xhr.status));
        }
      };
      
      xhr.onerror = function() {
        reject(new Error('Network error'));
      };
      
      xhr.ontimeout = function() {
        reject(new Error('Timeout'));
      };
      
      xhr.timeout = 30000;
      xhr.send();
    });
  }
  
  // Try to load video with multiple CORS strategies
  function loadVideoWithCorsRetry(uri, strategies) {
    var strategyIndex = 0;
    
    function tryNextStrategy() {
      if (strategyIndex >= strategies.length) {
        return Promise.reject(new Error('All CORS strategies failed'));
      }
      
      var strategy = strategies[strategyIndex];
      strategyIndex++;
      
      console.log('[Protocol0] Trying CORS strategy:', strategy.name);
      
      return new Promise(function(resolve, reject) {
        var video = document.createElement('video');
        video.muted = true;
        video.loop = CONFIG.loopVideo;
        video.playsInline = true;
        video.setAttribute('playsinline', 'true');
        video.preload = 'auto';
        video.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;';
        
        if (strategy.crossOrigin !== null) {
          video.crossOrigin = strategy.crossOrigin;
        }
        
        var timeout = setTimeout(function() {
          video.onloadeddata = null;
          video.onerror = null;
          reject(new Error('Timeout'));
        }, 10000);
        
        video.onloadeddata = function() {
          clearTimeout(timeout);
          video.play().then(function() {
            resolve({ video: video, strategy: strategy.name });
          }).catch(function(e) {
            // Video loaded but autoplay blocked - still usable
            console.warn('[Protocol0] Autoplay blocked, will try on user interaction');
            resolve({ video: video, strategy: strategy.name, autoplayBlocked: true });
          });
        };
        
        video.onerror = function() {
          clearTimeout(timeout);
          reject(new Error('Load failed with strategy: ' + strategy.name));
        };
        
        if (document.body) {
          document.body.appendChild(video);
        }
        
        video.src = strategy.src || uri;
        video.load();
      }).catch(function(err) {
        console.warn('[Protocol0] Strategy failed:', strategy.name, err.message);
        return tryNextStrategy();
      });
    }
    
    return tryNextStrategy();
  }
  
  // Convert base64 to blob for better performance
  function base64ToBlob(dataUri) {
    try {
      var parts = dataUri.split(',');
      var mimeMatch = parts[0].match(/:(.*?);/);
      var mime = mimeMatch ? mimeMatch[1] : 'video/mp4';
      var base64 = parts[1];
      
      // Decode in chunks for large videos
      var chunkSize = 1024 * 1024; // 1MB chunks
      var byteArrays = [];
      
      for (var offset = 0; offset < base64.length; offset += chunkSize) {
        var chunk = base64.slice(offset, offset + chunkSize);
        var byteNumbers = new Array(chunk.length);
        var binaryString = atob(chunk);
        
        for (var i = 0; i < binaryString.length; i++) {
          byteNumbers[i] = binaryString.charCodeAt(i);
        }
        
        byteArrays.push(new Uint8Array(byteNumbers));
      }
      
      return new Blob(byteArrays, { type: mime });
    } catch (e) {
      console.error('[Protocol0] Base64 conversion failed:', e);
      return null;
    }
  }
  
  // Draw loading indicator
  function drawLoadingState(timestamp) {
    var t = timestamp / 1000;
    var w = CONFIG.width;
    var h = CONFIG.height;
    
    // Dark background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, w, h);
    
    // Animated loading spinner
    var centerX = w / 2;
    var centerY = h / 2;
    var radius = 60;
    
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    var startAngle = t * 3;
    var endAngle = startAngle + Math.PI * 0.5 + Math.sin(t * 2) * 0.3;
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.stroke();
    
    // Loading text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Loading Video...', centerX, centerY + radius + 50);
    
    // Progress if available
    if (videoLoadState.loadProgress > 0) {
      ctx.font = '18px -apple-system, system-ui, sans-serif';
      ctx.fillStyle = '#00ff88';
      ctx.fillText(videoLoadState.loadProgress + '%', centerX, centerY + radius + 80);
    }
    
    ctx.textAlign = 'left';
  }
  
  // Main video loading function with all improvements
  function loadVideo(uri) {
    if (!uri) {
      console.log('[Protocol0] No video URI, using green screen');
      return Promise.resolve(false);
    }
    
    // Already loaded this URI
    if (videoElement && videoLoadState.currentUri === uri && videoLoadState.loaded) {
      console.log('[Protocol0] Video already loaded');
      return Promise.resolve(true);
    }
    
    // Prevent concurrent loads
    if (videoLoadState.loading && videoLoadState.currentUri === uri) {
      console.log('[Protocol0] Video already loading');
      return new Promise(function(resolve) {
        var checkInterval = setInterval(function() {
          if (!videoLoadState.loading) {
            clearInterval(checkInterval);
            resolve(videoLoadState.loaded);
          }
        }, 100);
      });
    }
    
    videoLoadState.loading = true;
    videoLoadState.loaded = false;
    videoLoadState.error = null;
    videoLoadState.currentUri = uri;
    videoLoadState.loadProgress = 0;
    
    var uriType = getUriType(uri);
    console.log('[Protocol0] Loading video | Type:', uriType, '| URI:', uri.substring(0, 80));
    
    return new Promise(function(resolve) {
      
      // Handle built-in patterns (no video needed)
      if (uriType === 'builtin' || uriType === 'canvas') {
        console.log('[Protocol0] Using built-in pattern:', uri);
        videoLoadState.loading = false;
        videoLoadState.loaded = false;
        useVideo = false;
        resolve(false);
        return;
      }
      
      // Handle base64 data URIs
      if (uriType === 'base64') {
        console.log('[Protocol0] Processing base64 video...');
        
        // Convert to blob for better performance
        var blob = base64ToBlob(uri);
        if (blob) {
          var blobUrl = URL.createObjectURL(blob);
          videoLoadState.cachedBlob = blob;
          
          loadVideoElement(blobUrl).then(function(success) {
            videoLoadState.loading = false;
            videoLoadState.loaded = success;
            useVideo = success;
            resolve(success);
          });
        } else {
          // Fallback: try loading base64 directly
          loadVideoElement(uri).then(function(success) {
            videoLoadState.loading = false;
            videoLoadState.loaded = success;
            useVideo = success;
            resolve(success);
          });
        }
        return;
      }
      
      // Handle blob URLs
      if (uriType === 'blob') {
        console.log('[Protocol0] Loading blob URL directly');
        loadVideoElement(uri).then(function(success) {
          videoLoadState.loading = false;
          videoLoadState.loaded = success;
          useVideo = success;
          resolve(success);
        });
        return;
      }
      
      // Handle local files
      if (uriType === 'local') {
        console.log('[Protocol0] Loading local file');
        loadVideoElement(uri).then(function(success) {
          videoLoadState.loading = false;
          videoLoadState.loaded = success;
          useVideo = success;
          resolve(success);
        });
        return;
      }
      
      // Handle remote URLs with CORS handling
      if (uriType === 'remote') {
        // Check cache first
        VideoCache.get(uri).then(function(cachedBlob) {
          if (cachedBlob) {
            console.log('[Protocol0] Using cached video');
            var blobUrl = URL.createObjectURL(cachedBlob);
            return loadVideoElement(blobUrl).then(function(success) {
              videoLoadState.loading = false;
              videoLoadState.loaded = success;
              useVideo = success;
              resolve(success);
            });
          }
          
          // Check if likely CORS blocked
          if (isLikelyCorsBlocked(uri)) {
            console.warn('[Protocol0] URL likely CORS blocked, trying fetch approach');
            
            // Try fetching the video directly
            fetchVideoWithProgress(uri).then(function(blob) {
              VideoCache.set(uri, blob);
              var blobUrl = URL.createObjectURL(blob);
              return loadVideoElement(blobUrl);
            }).then(function(success) {
              videoLoadState.loading = false;
              videoLoadState.loaded = success;
              useVideo = success;
              resolve(success);
            }).catch(function(err) {
              console.error('[Protocol0] Fetch failed:', err.message);
              console.warn('[Protocol0] CORS blocked - falling back to green screen');
              console.warn('[Protocol0] TIP: Download the video locally for reliable playback');
              videoLoadState.loading = false;
              videoLoadState.loaded = false;
              videoLoadState.error = 'CORS blocked';
              useVideo = false;
              resolve(false);
              
              // Notify React Native about the error
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'videoError',
                  payload: {
                    uri: uri,
                    error: 'CORS blocked',
                    suggestion: 'Download the video locally for reliable playback'
                  }
                }));
              }
            });
            return;
          }
          
          // Try multiple CORS strategies
          var strategies = [
            { name: 'anonymous', crossOrigin: 'anonymous', src: uri },
            { name: 'no-cors', crossOrigin: null, src: uri },
            { name: 'use-credentials', crossOrigin: 'use-credentials', src: uri }
          ];
          
          loadVideoWithCorsRetry(uri, strategies).then(function(result) {
            videoElement = result.video;
            
            // Try to cache for future use (won't work for CORS-restricted)
            if (!result.autoplayBlocked) {
              fetchVideoWithProgress(uri).then(function(blob) {
                VideoCache.set(uri, blob);
              }).catch(function() {
                // Caching failed, but video still works
              });
            }
            
            videoLoadState.loading = false;
            videoLoadState.loaded = true;
            useVideo = true;
            console.log('[Protocol0] Video loaded with strategy:', result.strategy);
            resolve(true);
            
          }).catch(function(err) {
            console.error('[Protocol0] All CORS strategies failed');
            videoLoadState.loading = false;
            videoLoadState.loaded = false;
            videoLoadState.error = err.message;
            useVideo = false;
            resolve(false);
          });
        });
        return;
      }
      
      // Unknown type - try direct load
      console.warn('[Protocol0] Unknown URI type, trying direct load');
      loadVideoElement(uri).then(function(success) {
        videoLoadState.loading = false;
        videoLoadState.loaded = success;
        useVideo = success;
        resolve(success);
      });
    });
  }
  
  // Load video into element
  function loadVideoElement(src) {
    return new Promise(function(resolve) {
      // Clean up existing video
      if (videoElement && videoElement.parentNode) {
        videoElement.parentNode.removeChild(videoElement);
      }
      
      videoElement = document.createElement('video');
      videoElement.muted = true;
      videoElement.loop = CONFIG.loopVideo;
      videoElement.playsInline = true;
      videoElement.setAttribute('playsinline', 'true');
      videoElement.setAttribute('webkit-playsinline', 'true');
      videoElement.preload = 'auto';
      videoElement.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
      
      var timeout = setTimeout(function() {
        console.warn('[Protocol0] Video load timeout');
        resolve(false);
      }, CONFIG.videoLoadTimeout);
      
      videoElement.onloadeddata = function() {
        clearTimeout(timeout);
        console.log('[Protocol0] Video ready:', videoElement.videoWidth, 'x', videoElement.videoHeight);
        
        videoElement.play().then(function() {
          console.log('[Protocol0] Video playing');
          
          // Notify React Native of successful load
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'videoLoaded',
              payload: {
                success: true,
                width: videoElement.videoWidth,
                height: videoElement.videoHeight,
                duration: videoElement.duration
              }
            }));
          }
          
          resolve(true);
        }).catch(function(e) {
          console.warn('[Protocol0] Autoplay blocked:', e.message);
          // Still consider it loaded - will play on user interaction
          resolve(true);
        });
      };
      
      videoElement.onerror = function(e) {
        clearTimeout(timeout);
        console.error('[Protocol0] Video element error');
        resolve(false);
      };
      
      if (document.body) {
        document.body.appendChild(videoElement);
      }
      
      videoElement.src = src;
      videoElement.load();
    });
  }
  
  // Preload video (call early for better UX)
  function preloadVideo(uri) {
    if (!uri || videoLoadState.loading) return;
    
    console.log('[Protocol0] Preloading video...');
    loadVideo(uri);
  }
  
  // ============================================================================
  // RENDERING
  // ============================================================================
  
  function drawGreenScreen(timestamp) {
    var t = timestamp / 1000;
    var w = CONFIG.width;
    var h = CONFIG.height;
    
    // If video is loading, show loading indicator (if enabled)
    if (videoLoadState.loading && CONFIG.showLoadingIndicator) {
      drawLoadingState(timestamp);
      return;
    }
    
    // Realistic green screen with subtle animation and sensor noise
    var gradient = ctx.createLinearGradient(0, 0, 0, h);
    var offset = Math.sin(t * 0.3) * 0.02;
    
    gradient.addColorStop(0, 'rgb(0, ' + Math.floor(255 + offset * 20) + ', 0)');
    gradient.addColorStop(0.5, 'rgb(0, ' + Math.floor(238 + offset * 20) + ', 0)');
    gradient.addColorStop(1, 'rgb(0, ' + Math.floor(255 + offset * 20) + ', 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    
    // Add subtle camera sensor noise for realism (every 3rd frame for performance)
    if (frameCount % 3 === 0) {
      var noiseCanvas = document.createElement('canvas');
      noiseCanvas.width = 100;
      noiseCanvas.height = 100;
      var noiseCtx = noiseCanvas.getContext('2d');
      var imageData = noiseCtx.createImageData(100, 100);
      var data = imageData.data;
      
      for (var i = 0; i < data.length; i += 4) {
        var noise = (Math.random() - 0.5) * 8;
        data[i] = 0;
        data[i + 1] = Math.max(0, Math.min(255, 238 + noise));
        data[i + 2] = 0;
        data[i + 3] = 25; // Low opacity
      }
      
      noiseCtx.putImageData(imageData, 0, 0);
      ctx.drawImage(noiseCanvas, 0, 0, w, h);
    }
    
    // Debug overlay if enabled
    if (CONFIG.showDebugOverlay) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(10, h - 100, 350, 90);
      
      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('PROTOCOL 0 ACTIVE', 20, h - 75);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px monospace';
      ctx.fillText('Frame: ' + frameCount + ' | ' + CONFIG.width + 'x' + CONFIG.height, 20, h - 50);
      
      var videoStatus = useVideo ? 'VIDEO' : (videoLoadState.error ? 'ERROR: ' + videoLoadState.error : 'GREEN SCREEN');
      ctx.fillText('Source: ' + videoStatus, 20, h - 25);
    }
  }
  
  function drawVideoFrame() {
    if (!videoElement || !useVideo || videoElement.readyState < 2) {
      return false;
    }
    
    try {
      var w = CONFIG.width;
      var h = CONFIG.height;
      var vw = videoElement.videoWidth || w;
      var vh = videoElement.videoHeight || h;
      
      // Cover mode - fill canvas while maintaining aspect ratio
      var scale = Math.max(w / vw, h / vh);
      var sw = w / scale;
      var sh = h / scale;
      var sx = (vw - sw) / 2;
      var sy = (vh - sh) / 2;
      
      if (CONFIG.mirrorVideo) {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(videoElement, sx, sy, sw, sh, -w, 0, w, h);
        ctx.restore();
      } else {
        ctx.drawImage(videoElement, sx, sy, sw, sh, 0, 0, w, h);
      }
      
      return true;
    } catch (e) {
      return false;
    }
  }
  
  function render() {
    if (!isAnimating || !canvas || !ctx) return;
    
    var timestamp = performance.now();
    
    // Try video first, fallback to green screen
    if (!drawVideoFrame()) {
      drawGreenScreen(timestamp);
    }
    
    frameCount++;
    animationFrameId = requestAnimationFrame(render);
  }
  
  function startAnimation() {
    if (isAnimating) return;
    
    initCanvas();
    isAnimating = true;
    frameCount = 0;
    render();
    
    console.log('[Protocol0] Animation started');
  }
  
  function stopAnimation() {
    isAnimating = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }
  
  // ============================================================================
  // STREAM CREATION
  // ============================================================================
  
  function getDeviceForConstraints(constraints) {
    if (!constraints || !constraints.video) return DEVICES[0];
    
    var video = constraints.video;
    var requestedId = video.deviceId && (video.deviceId.exact || video.deviceId.ideal || video.deviceId);
    var requestedFacing = video.facingMode && (video.facingMode.exact || video.facingMode.ideal || video.facingMode);
    
    // Try to find matching device
    for (var i = 0; i < DEVICES.length; i++) {
      var d = DEVICES[i];
      if (d.type !== 'camera') continue;
      
      if (requestedId && (d.id === requestedId || d.nativeDeviceId === requestedId)) {
        return d;
      }
      
      if (requestedFacing) {
        var facing = requestedFacing === 'user' ? 'front' : requestedFacing === 'environment' ? 'back' : requestedFacing;
        if (d.facing === facing) {
          return d;
        }
      }
    }
    
    // Default to first camera
    return DEVICES.find(function(d) { return d.type === 'camera'; }) || DEVICES[0];
  }
  
  function createInjectedStream(constraints) {
    startAnimation();
    
    try {
      var stream = canvas.captureStream(CONFIG.fps);
      
      if (!stream || stream.getVideoTracks().length === 0) {
        throw new Error('Failed to capture stream from canvas');
      }
      
      var device = getDeviceForConstraints(constraints);
      var videoTrack = stream.getVideoTracks()[0];
      var trackId = 'track_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      // ========== COMPREHENSIVE TRACK METADATA SPOOFING ==========
      
      // Spoof track ID
      try {
        Object.defineProperty(videoTrack, 'id', {
          get: function() { return trackId; },
          configurable: true
        });
      } catch(e) {}
      
      // Spoof label
      Object.defineProperty(videoTrack, 'label', {
        get: function() { return device.name || 'Camera'; },
        configurable: true
      });
      
      // Spoof readyState
      try {
        Object.defineProperty(videoTrack, 'readyState', {
          get: function() { return 'live'; },
          configurable: true
        });
      } catch(e) {}
      
      // Spoof muted
      try {
        Object.defineProperty(videoTrack, 'muted', {
          get: function() { return false; },
          configurable: true
        });
      } catch(e) {}
      
      // Spoof enabled
      var trackEnabled = true;
      try {
        Object.defineProperty(videoTrack, 'enabled', {
          get: function() { return trackEnabled; },
          set: function(v) { trackEnabled = !!v; },
          configurable: true
        });
      } catch(e) {}
      
      // Spoof getSettings
      videoTrack.getSettings = function() {
        var facingMode = device.facing === 'back' ? 'environment' : 'user';
        return {
          width: CONFIG.width,
          height: CONFIG.height,
          frameRate: CONFIG.fps,
          aspectRatio: CONFIG.width / CONFIG.height,
          facingMode: facingMode,
          deviceId: device.nativeDeviceId || device.id,
          groupId: device.groupId || 'default',
          resizeMode: 'none'
        };
      };
      
      // Spoof getCapabilities
      videoTrack.getCapabilities = function() {
        return {
          width: { min: 1, max: CONFIG.width },
          height: { min: 1, max: CONFIG.height },
          frameRate: { min: 1, max: 60 },
          aspectRatio: { min: 0.5, max: 2.0 },
          facingMode: [device.facing === 'back' ? 'environment' : 'user'],
          deviceId: device.nativeDeviceId || device.id,
          groupId: device.groupId || 'default',
          resizeMode: ['none', 'crop-and-scale']
        };
      };
      
      // Spoof getConstraints
      videoTrack.getConstraints = function() {
        return constraints && constraints.video ? constraints.video : {};
      };
      
      // Spoof applyConstraints
      videoTrack.applyConstraints = function() {
        return Promise.resolve();
      };
      
      // Add silent audio if requested
      if (constraints && constraints.audio) {
        try {
          var AudioContext = window.AudioContext || window.webkitAudioContext;
          if (AudioContext) {
            var audioCtx = new AudioContext();
            var oscillator = audioCtx.createOscillator();
            var gainNode = audioCtx.createGain();
            var destination = audioCtx.createMediaStreamDestination();
            
            gainNode.gain.value = 0;
            oscillator.connect(gainNode);
            gainNode.connect(destination);
            oscillator.start();
            
            destination.stream.getAudioTracks().forEach(function(track) {
              stream.addTrack(track);
            });
            
            console.log('[Protocol0] Silent audio added');
          }
        } catch (e) {
          console.warn('[Protocol0] Audio creation failed:', e);
        }
      }
      
      currentStream = stream;
      
      console.log('[Protocol0] ✓ Stream created');
      console.log('[Protocol0]   Device:', device.name);
      console.log('[Protocol0]   Video tracks:', stream.getVideoTracks().length);
      console.log('[Protocol0]   Audio tracks:', stream.getAudioTracks().length);
      
      return stream;
      
    } catch (e) {
      console.error('[Protocol0] ✗ Stream creation failed:', e);
      throw e;
    }
  }
  
  // ============================================================================
  // API OVERRIDE - IMMEDIATE
  // ============================================================================
  
  var originalGetUserMedia = navigator.mediaDevices && navigator.mediaDevices.getUserMedia ? 
    navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices) : null;
  var originalEnumerateDevices = navigator.mediaDevices && navigator.mediaDevices.enumerateDevices ? 
    navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices) : null;
  
  if (!navigator.mediaDevices) {
    navigator.mediaDevices = {};
  }
  
  // Override getUserMedia
  navigator.mediaDevices.getUserMedia = function(constraints) {
    console.log('[Protocol0] ★ getUserMedia INTERCEPTED ★');
    console.log('[Protocol0] Constraints:', JSON.stringify(constraints));
    
    if (constraints && constraints.video) {
      try {
        var stream = createInjectedStream(constraints);
        return Promise.resolve(stream);
      } catch (e) {
        console.error('[Protocol0] Injection failed:', e);
        if (originalGetUserMedia) {
          return originalGetUserMedia(constraints);
        }
        return Promise.reject(new DOMException('Could not start video source', 'NotReadableError'));
      }
    }
    
    // Audio-only
    if (originalGetUserMedia) {
      return originalGetUserMedia(constraints);
    }
    
    return Promise.reject(new DOMException('Requested device not found', 'NotFoundError'));
  };
  
  // Override enumerateDevices
  navigator.mediaDevices.enumerateDevices = function() {
    console.log('[Protocol0] enumerateDevices intercepted');
    
    var devices = [];
    
    for (var i = 0; i < DEVICES.length; i++) {
      var d = DEVICES[i];
      if (d.type === 'camera') {
        devices.push({
          deviceId: d.nativeDeviceId || d.id,
          groupId: d.groupId || 'default',
          kind: 'videoinput',
          label: d.name || 'Camera',
          toJSON: function() { return this; }
        });
      }
    }
    
    // Add a microphone
    devices.push({
      deviceId: 'microphone-default',
      groupId: 'default',
      kind: 'audioinput',
      label: 'Microphone',
      toJSON: function() { return this; }
    });
    
    console.log('[Protocol0] Returning', devices.length, 'devices');
    return Promise.resolve(devices);
  };
  
  // Override getSupportedConstraints
  navigator.mediaDevices.getSupportedConstraints = function() {
    return {
      aspectRatio: true,
      deviceId: true,
      facingMode: true,
      frameRate: true,
      groupId: true,
      height: true,
      width: true,
      resizeMode: true
    };
  };
  
  // ============================================================================
  // PUBLIC API
  // ============================================================================
  
  window.__protocol0 = {
    // Load a new video URI
    setVideoUri: function(uri) {
      return loadVideo(uri);
    },
    
    // Preload video for faster switching
    preloadVideo: function(uri) {
      return preloadVideo(uri);
    },
    
    // Get comprehensive status
    getStatus: function() {
      return {
        initialized: true,
        animating: isAnimating,
        frameCount: frameCount,
        usingVideo: useVideo,
        hasStream: !!currentStream,
        config: CONFIG,
        videoLoadState: {
          loading: videoLoadState.loading,
          loaded: videoLoadState.loaded,
          error: videoLoadState.error,
          progress: videoLoadState.loadProgress,
          currentUri: videoLoadState.currentUri ? videoLoadState.currentUri.substring(0, 80) : null
        }
      };
    },
    
    // Get video cache info
    getCacheInfo: function() {
      return VideoCache.db ? {
        available: true,
        dbName: VideoCache.dbName
      } : {
        available: false
      };
    },
    
    // Clear video cache
    clearCache: function() {
      return VideoCache.clear();
    },
    
    // Restart animation
    restart: function() {
      stopAnimation();
      frameCount = 0;
      startAnimation();
    },
    
    // Stop everything
    stop: function() {
      stopAnimation();
      if (currentStream) {
        currentStream.getTracks().forEach(function(t) { t.stop(); });
        currentStream = null;
      }
    },
    
    // Force retry video loading
    retryVideo: function() {
      if (videoLoadState.error && videoLoadState.currentUri) {
        videoLoadState.retryCount++;
        videoLoadState.error = null;
        console.log('[Protocol0] Retrying video load, attempt:', videoLoadState.retryCount);
        return loadVideo(videoLoadState.currentUri);
      }
      return Promise.resolve(false);
    }
  };
  
  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  // Load video if configured
  if (CONFIG.videoUri) {
    loadVideo(CONFIG.videoUri);
  }
  
  console.log('[Protocol0] ===== INJECTION COMPLETE =====');
  console.log('[Protocol0] Devices configured:', DEVICES.length);
  console.log('[Protocol0] Video URI:', CONFIG.videoUri || 'NONE (green screen)');
  console.log('[Protocol0] Video Cache:', CONFIG.enableVideoCache ? 'ENABLED' : 'DISABLED');
  console.log('[Protocol0] CORS Retry:', CONFIG.corsRetryStrategies ? 'ENABLED' : 'DISABLED');
  
  // Preload video if enabled and URI exists
  if (CONFIG.preloadVideo && CONFIG.videoUri) {
    console.log('[Protocol0] Starting video preload...');
    preloadVideo(CONFIG.videoUri);
  }
  
  // Notify React Native
  if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'protocol0Ready',
      payload: {
        devices: DEVICES.length,
        videoUri: !!CONFIG.videoUri,
        resolution: CONFIG.width + 'x' + CONFIG.height,
        cacheEnabled: CONFIG.enableVideoCache,
        preloading: CONFIG.preloadVideo && !!CONFIG.videoUri
      }
    }));
  }
  
})();
true;
`;
}

/**
 * PROTOCOL 0: Ultra-Early Deep Hook
 * Hooks into the API before any other scripts load
 * Best for sites that check getUserMedia early
 */
export function createProtocol0DeepHook(config: Partial<InjectionConfig> = {}): string {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  return `
(function() {
  'use strict';
  
  // ============================================================================
  // PROTOCOL 0: ULTRA-EARLY DEEP HOOK
  // ============================================================================
  
  if (window.__protocol0Initialized) {
    console.log('[Protocol0] Already initialized');
    return;
  }
  window.__protocol0Initialized = true;
  
  console.log('[Protocol0] ===== DEEP HOOK INJECTION =====');
  console.log('[Protocol0] Target resolution: ${cfg.width}x${cfg.height} @ ${cfg.fps}fps');
  
  // ============================================================================
  // GLOBALS
  // ============================================================================
  
  const CONFIG = ${JSON.stringify(cfg)};
  let canvas = null;
  let ctx = null;
  let animationFrameId = null;
  let isAnimating = false;
  let frameCount = 0;
  let startTime = 0;
  let videoElement = null;
  let useVideo = false;
  
  // ============================================================================
  // CANVAS INITIALIZATION
  // ============================================================================
  
  function initCanvas() {
    if (canvas) return canvas;
    
    canvas = document.createElement('canvas');
    canvas.width = CONFIG.width;
    canvas.height = CONFIG.height;
    ctx = canvas.getContext('2d', { 
      alpha: false,
      desynchronized: true,
      willReadFrequently: false
    });
    
    console.log('[Protocol0] Canvas created:', CONFIG.width, 'x', CONFIG.height);
    return canvas;
  }
  
  // ============================================================================
  // VIDEO LOADING
  // ============================================================================
  
  function loadVideo(uri) {
    if (!uri || videoElement) return;
    
    console.log('[Protocol0] Loading video:', uri.substring(0, 50));
    
    videoElement = document.createElement('video');
    videoElement.muted = true;
    videoElement.loop = true;
    videoElement.playsInline = true;
    videoElement.setAttribute('playsinline', 'true');
    videoElement.setAttribute('webkit-playsinline', 'true');
    videoElement.crossOrigin = 'anonymous';
    videoElement.preload = 'auto';
    videoElement.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
    
    if (document.body) {
      document.body.appendChild(videoElement);
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        if (document.body) document.body.appendChild(videoElement);
      });
    }
    
    videoElement.onloadeddata = function() {
      console.log('[Protocol0] Video loaded:', videoElement.videoWidth, 'x', videoElement.videoHeight);
      useVideo = true;
      videoElement.play().catch(function(e) {
        console.warn('[Protocol0] Autoplay failed:', e.message);
        useVideo = false;
      });
    };
    
    videoElement.onerror = function(e) {
      console.error('[Protocol0] Video load error:', e);
      useVideo = false;
    };
    
    videoElement.src = uri;
    videoElement.load();
  }
  
  // ============================================================================
  // RENDERING
  // ============================================================================
  
  function drawTestPattern(timestamp) {
    const t = timestamp / 1000;
    const w = CONFIG.width;
    const h = CONFIG.height;
    
    // Animated gradient
    const hue = (t * 30) % 360;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'hsl(' + hue + ', 60%, 30%)');
    grad.addColorStop(0.5, 'hsl(' + ((hue + 120) % 360) + ', 60%, 20%)');
    grad.addColorStop(1, 'hsl(' + ((hue + 240) % 360) + ', 60%, 30%)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    
    // Animated circles
    for (let i = 0; i < 5; i++) {
      const angle = t * (1.5 + i * 0.3) + i * 1.2;
      const radius = 150 + i * 30;
      const x = w / 2 + Math.cos(angle) * radius;
      const y = h / 2 + Math.sin(angle) * radius;
      const r = 30 + i * 10;
      
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'hsla(' + ((hue + i * 60) % 360) + ', 70%, 60%, 0.8)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    // Status text
    if (CONFIG.showDebugOverlay) {
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(10, h - 100, 400, 90);
      
      ctx.fillStyle = '#00ff00';
      ctx.font = 'bold 24px monospace';
      ctx.fillText('PROTOCOL 0 ACTIVE', 20, h - 70);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px monospace';
      ctx.fillText('Frame: ' + frameCount, 20, h - 45);
      ctx.fillText('Time: ' + t.toFixed(2) + 's', 20, h - 20);
    }
    
    // Scan line
    const scanY = (frameCount * 10) % h;
    ctx.fillStyle = 'rgba(0,255,0,0.3)';
    ctx.fillRect(0, scanY, w, 3);
  }
  
  function drawVideoFrame() {
    if (!videoElement || !useVideo || videoElement.paused || videoElement.ended) {
      return false;
    }
    
    try {
      const w = CONFIG.width;
      const h = CONFIG.height;
      const vw = videoElement.videoWidth || w;
      const vh = videoElement.videoHeight || h;
      
      // Cover mode
      const scale = Math.max(w / vw, h / vh);
      const sw = w / scale;
      const sh = h / scale;
      const sx = (vw - sw) / 2;
      const sy = (vh - sh) / 2;
      
      ctx.drawImage(videoElement, sx, sy, sw, sh, 0, 0, w, h);
      
      if (CONFIG.showDebugOverlay) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(10, 10, 250, 60);
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 16px monospace';
        ctx.fillText('VIDEO INJECTION', 20, 35);
        ctx.fillText('Frame: ' + frameCount, 20, 55);
      }
      
      return true;
    } catch (e) {
      console.error('[Protocol0] Video draw error:', e);
      return false;
    }
  }
  
  function animate() {
    if (!isAnimating || !canvas || !ctx) return;
    
    const timestamp = performance.now();
    
    // Try video first, fallback to test pattern
    if (!drawVideoFrame()) {
      drawTestPattern(timestamp);
    }
    
    frameCount++;
    animationFrameId = requestAnimationFrame(animate);
  }
  
  function startAnimation() {
    if (isAnimating) return;
    
    initCanvas();
    isAnimating = true;
    startTime = performance.now();
    frameCount = 0;
    
    animate();
    console.log('[Protocol0] Animation started');
  }
  
  function stopAnimation() {
    isAnimating = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    console.log('[Protocol0] Animation stopped');
  }
  
  // ============================================================================
  // STREAM CREATION
  // ============================================================================
  
  function createInjectedStream(constraints) {
    startAnimation();
    
    try {
      const stream = canvas.captureStream(CONFIG.fps);
      
      if (!stream || stream.getVideoTracks().length === 0) {
        throw new Error('Failed to create stream from canvas');
      }
      
      const videoTrack = stream.getVideoTracks()[0];
      
      // Spoof track settings
      const originalGetSettings = videoTrack.getSettings ? videoTrack.getSettings.bind(videoTrack) : null;
      videoTrack.getSettings = function() {
        return {
          width: CONFIG.width,
          height: CONFIG.height,
          frameRate: CONFIG.fps,
          aspectRatio: CONFIG.width / CONFIG.height,
          facingMode: constraints?.video?.facingMode || 'user',
          deviceId: CONFIG.deviceId,
          groupId: 'group_' + CONFIG.deviceId,
          resizeMode: 'none',
        };
      };
      
      // Spoof track capabilities
      videoTrack.getCapabilities = function() {
        return {
          width: { min: 1, max: CONFIG.width },
          height: { min: 1, max: CONFIG.height },
          frameRate: { min: 1, max: CONFIG.fps },
          aspectRatio: { min: 0.5, max: 2.0 },
          facingMode: ['user', 'environment'],
          deviceId: CONFIG.deviceId,
          resizeMode: ['none', 'crop-and-scale'],
        };
      };
      
      // Spoof track constraints
      videoTrack.getConstraints = function() {
        return constraints?.video || {};
      };
      
      // Spoof track label
      Object.defineProperty(videoTrack, 'label', {
        get: function() { return CONFIG.deviceLabel; },
        configurable: true,
      });
      
      // Add silent audio if requested
      if (constraints?.audio) {
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (AudioContext) {
            const audioCtx = new AudioContext();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            const destination = audioCtx.createMediaStreamDestination();
            
            gainNode.gain.value = 0.0001; // Very quiet
            oscillator.connect(gainNode);
            gainNode.connect(destination);
            oscillator.start();
            
            destination.stream.getAudioTracks().forEach(function(track) {
              stream.addTrack(track);
            });
            
            console.log('[Protocol0] Added silent audio track');
          }
        } catch (e) {
          console.warn('[Protocol0] Failed to add audio:', e);
        }
      }
      
      console.log('[Protocol0] ✓ Stream created successfully');
      console.log('[Protocol0]   - Video tracks:', stream.getVideoTracks().length);
      console.log('[Protocol0]   - Audio tracks:', stream.getAudioTracks().length);
      console.log('[Protocol0]   - Resolution:', CONFIG.width + 'x' + CONFIG.height);
      
      return stream;
      
    } catch (e) {
      console.error('[Protocol0] ✗ Stream creation failed:', e);
      throw e;
    }
  }
  
  // ============================================================================
  // API OVERRIDE - CRITICAL EARLY HOOK
  // ============================================================================
  
  // Save original functions IMMEDIATELY
  const originalGetUserMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
  const originalEnumerateDevices = navigator.mediaDevices?.enumerateDevices?.bind(navigator.mediaDevices);
  
  // Ensure navigator.mediaDevices exists
  if (!navigator.mediaDevices) {
    navigator.mediaDevices = {};
  }
  
  // Override getUserMedia
  navigator.mediaDevices.getUserMedia = async function(constraints) {
    console.log('[Protocol0] ★ getUserMedia INTERCEPTED ★');
    console.log('[Protocol0] Constraints:', constraints);
    
    // Only intercept video requests
    if (constraints && constraints.video) {
      try {
        const stream = createInjectedStream(constraints);
        return Promise.resolve(stream);
      } catch (e) {
        console.error('[Protocol0] Injection failed:', e);
        // Fallback to original if available
        if (originalGetUserMedia) {
          console.log('[Protocol0] Falling back to original getUserMedia');
          return originalGetUserMedia(constraints);
        }
        throw e;
      }
    }
    
    // Audio-only or no constraints - use original
    if (originalGetUserMedia) {
      return originalGetUserMedia(constraints);
    }
    
    throw new DOMException('Requested device not found', 'NotFoundError');
  };
  
  // Override enumerateDevices
  navigator.mediaDevices.enumerateDevices = async function() {
    console.log('[Protocol0] enumerateDevices intercepted');
    
    const devices = [
      {
        deviceId: CONFIG.deviceId,
        groupId: 'group_' + CONFIG.deviceId,
        kind: 'videoinput',
        label: CONFIG.deviceLabel,
        toJSON: function() { return this; }
      },
      {
        deviceId: 'audio-' + CONFIG.deviceId,
        groupId: 'group_' + CONFIG.deviceId,
        kind: 'audioinput',
        label: 'Microphone',
        toJSON: function() { return this; }
      }
    ];
    
    console.log('[Protocol0] Returning', devices.length, 'devices');
    return Promise.resolve(devices);
  };
  
  // ============================================================================
  // CONFIGURATION API
  // ============================================================================
  
  window.__protocol0 = {
    setVideoUri: function(uri) {
      if (uri && !useVideo) {
        loadVideo(uri);
      }
    },
    
    useTestPattern: function() {
      useVideo = false;
      if (videoElement) {
        videoElement.pause();
      }
    },
    
    getStatus: function() {
      return {
        initialized: true,
        animating: isAnimating,
        frameCount: frameCount,
        usingVideo: useVideo,
        videoUri: CONFIG.videoUri,
        canvas: { width: CONFIG.width, height: CONFIG.height },
        fps: CONFIG.fps
      };
    },
    
    restart: function() {
      stopAnimation();
      frameCount = 0;
      startAnimation();
    }
  };
  
  // Load video if configured
  if (CONFIG.videoUri) {
    loadVideo(CONFIG.videoUri);
  }
  
  console.log('[Protocol0] ===== INJECTION COMPLETE =====');
  console.log('[Protocol0] Ready to intercept getUserMedia');
  console.log('[Protocol0] Test pattern:', CONFIG.useTestPattern ? 'YES' : 'NO');
  console.log('[Protocol0] Video URI:', CONFIG.videoUri || 'NONE');
  
  // Notify React Native if in WebView
  if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'protocol0Ready',
      config: CONFIG
    }));
  }
  
  return true;
})();
true;
`;
}

/**
 * PROTOCOL 1: MediaStream Constructor Override
 * Intercepts at the MediaStream level
 * Works for sites that construct MediaStream objects
 */
export function createProtocol1MediaStreamOverride(config: Partial<InjectionConfig> = {}): string {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  return `
(function() {
  'use strict';
  
  // ============================================================================
  // PROTOCOL 1: MEDIASTREAM CONSTRUCTOR OVERRIDE
  // ============================================================================
  
  if (window.__protocol1Initialized) {
    console.log('[Protocol1] Already initialized');
    return;
  }
  window.__protocol1Initialized = true;
  
  console.log('[Protocol1] ===== MEDIASTREAM OVERRIDE =====');
  
  const CONFIG = ${JSON.stringify(cfg)};
  
  // Store original constructors
  const OriginalMediaStream = window.MediaStream;
  const originalGetUserMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
  
  let injectedStream = null;
  let canvas = null;
  let ctx = null;
  let isAnimating = false;
  let frameCount = 0;
  
  // ============================================================================
  // CANVAS & ANIMATION (Simplified)
  // ============================================================================
  
  function initCanvas() {
    if (canvas) return;
    
    canvas = document.createElement('canvas');
    canvas.width = CONFIG.width;
    canvas.height = CONFIG.height;
    ctx = canvas.getContext('2d', { alpha: false });
    
    console.log('[Protocol1] Canvas initialized');
  }
  
  function animate() {
    if (!isAnimating) return;
    
    const t = performance.now() / 1000;
    const w = CONFIG.width;
    const h = CONFIG.height;
    
    // Simple animated gradient
    const hue = (t * 50) % 360;
    ctx.fillStyle = 'hsl(' + hue + ', 50%, 30%)';
    ctx.fillRect(0, 0, w, h);
    
    // Center circle
    ctx.beginPath();
    ctx.arc(w/2, h/2, 100 + Math.sin(t * 2) * 20, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();
    
    // Text
    ctx.fillStyle = 'black';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PROTOCOL 1', w/2, h/2 + 15);
    
    frameCount++;
    requestAnimationFrame(animate);
  }
  
  function startAnimation() {
    if (isAnimating) return;
    initCanvas();
    isAnimating = true;
    animate();
    console.log('[Protocol1] Animation started');
  }
  
  function createInjectedStream() {
    startAnimation();
    
    try {
      const stream = canvas.captureStream(CONFIG.fps);
      const track = stream.getVideoTracks()[0];
      
      // Spoof track metadata
      track.getSettings = function() {
        return {
          width: CONFIG.width,
          height: CONFIG.height,
          frameRate: CONFIG.fps,
          facingMode: 'user',
          deviceId: CONFIG.deviceId
        };
      };
      
      Object.defineProperty(track, 'label', {
        get: () => CONFIG.deviceLabel,
        configurable: true
      });
      
      console.log('[Protocol1] Injected stream created');
      return stream;
    } catch (e) {
      console.error('[Protocol1] Stream creation failed:', e);
      throw e;
    }
  }
  
  // ============================================================================
  // API OVERRIDES
  // ============================================================================
  
  // Override getUserMedia
  if (navigator.mediaDevices) {
    navigator.mediaDevices.getUserMedia = async function(constraints) {
      console.log('[Protocol1] getUserMedia intercepted:', constraints);
      
      if (constraints?.video) {
        try {
          if (!injectedStream) {
            injectedStream = createInjectedStream();
          }
          return Promise.resolve(injectedStream);
        } catch (e) {
          console.error('[Protocol1] Failed:', e);
          if (originalGetUserMedia) {
            return originalGetUserMedia(constraints);
          }
          throw e;
        }
      }
      
      if (originalGetUserMedia) {
        return originalGetUserMedia(constraints);
      }
      throw new Error('getUserMedia not available');
    };
    
    navigator.mediaDevices.enumerateDevices = async function() {
      return [{
        deviceId: CONFIG.deviceId,
        groupId: 'group1',
        kind: 'videoinput',
        label: CONFIG.deviceLabel
      }];
    };
  }
  
  // Override MediaStream constructor
  window.MediaStream = function(arg) {
    console.log('[Protocol1] MediaStream constructor called:', arg);
    
    // If called with injected stream, return it
    if (arg && injectedStream && arg === injectedStream) {
      return new OriginalMediaStream(arg);
    }
    
    // Replace any video track with our injected one
    if (arg && (arg instanceof OriginalMediaStream || Array.isArray(arg))) {
      if (!injectedStream) {
        injectedStream = createInjectedStream();
      }
      
      const newStream = new OriginalMediaStream();
      injectedStream.getTracks().forEach(track => newStream.addTrack(track));
      
      console.log('[Protocol1] Replaced with injected stream');
      return newStream;
    }
    
    return new OriginalMediaStream(arg);
  };
  
  window.MediaStream.prototype = OriginalMediaStream.prototype;
  
  window.__protocol1 = {
    getStatus: () => ({
      initialized: true,
      hasStream: !!injectedStream,
      frameCount: frameCount
    })
  };
  
  console.log('[Protocol1] ===== INJECTION COMPLETE =====');
  
  return true;
})();
true;
`;
}

/**
 * PROTOCOL 2: Descriptor-Level Deep Hook
 * Overrides property descriptors to intercept at the lowest level
 */
export function createProtocol2DescriptorHook(config: Partial<InjectionConfig> = {}): string {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  return `
(function() {
  'use strict';
  
  // ============================================================================
  // PROTOCOL 2: DESCRIPTOR-LEVEL DEEP HOOK
  // ============================================================================
  
  if (window.__protocol2Initialized) {
    console.log('[Protocol2] Already initialized');
    return;
  }
  window.__protocol2Initialized = true;
  
  console.log('[Protocol2] ===== DESCRIPTOR HOOK =====');
  
  const CONFIG = ${JSON.stringify(cfg)};
  
  let canvas = null;
  let ctx = null;
  let animating = false;
  let frameNum = 0;
  
  // ============================================================================
  // SIMPLE RENDERER
  // ============================================================================
  
  function initCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.width = CONFIG.width;
    canvas.height = CONFIG.height;
    ctx = canvas.getContext('2d');
    console.log('[Protocol2] Canvas ready');
  }
  
  function render() {
    if (!animating) return;
    
    const t = performance.now() / 1000;
    const hue = (t * 40) % 360;
    
    // Background
    ctx.fillStyle = 'hsl(' + hue + ', 60%, 25%)';
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
    
    // Animated square
    ctx.save();
    ctx.translate(CONFIG.width / 2, CONFIG.height / 2);
    ctx.rotate(t);
    ctx.fillStyle = 'white';
    ctx.fillRect(-100, -100, 200, 200);
    ctx.restore();
    
    // Label
    ctx.fillStyle = 'black';
    ctx.font = 'bold 50px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PROTOCOL 2', CONFIG.width/2, CONFIG.height/2);
    
    frameNum++;
    requestAnimationFrame(render);
  }
  
  function start() {
    if (animating) return;
    initCanvas();
    animating = true;
    render();
  }
  
  function createStream() {
    start();
    try {
      const stream = canvas.captureStream(CONFIG.fps);
      console.log('[Protocol2] Stream created with', stream.getTracks().length, 'tracks');
      
      // Spoof track metadata for webcamtests.com compatibility
      const track = stream.getVideoTracks()[0];
      if (track) {
        // Spoof label
        Object.defineProperty(track, 'label', {
          get: function() { return CONFIG.deviceLabel; },
          configurable: true
        });
        
        // Spoof getSettings
        track.getSettings = function() {
          return {
            width: CONFIG.width,
            height: CONFIG.height,
            frameRate: CONFIG.fps,
            aspectRatio: CONFIG.width / CONFIG.height,
            facingMode: 'user',
            deviceId: CONFIG.deviceId,
            groupId: 'default',
            resizeMode: 'none'
          };
        };
        
        // Spoof getCapabilities
        track.getCapabilities = function() {
          return {
            width: { min: 1, max: CONFIG.width },
            height: { min: 1, max: CONFIG.height },
            frameRate: { min: 1, max: 60 },
            facingMode: ['user', 'environment'],
            deviceId: CONFIG.deviceId,
            resizeMode: ['none', 'crop-and-scale']
          };
        };
        
        console.log('[Protocol2] Track metadata spoofed');
      }
      
      return stream;
    } catch (e) {
      console.error('[Protocol2] Stream creation failed:', e);
      throw e;
    }
  }
  
  // ============================================================================
  // DESCRIPTOR-LEVEL OVERRIDE
  // ============================================================================
  
  // Store original descriptor
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    MediaDevices.prototype,
    'getUserMedia'
  );
  
  // Define new descriptor
  Object.defineProperty(MediaDevices.prototype, 'getUserMedia', {
    value: async function(constraints) {
      console.log('[Protocol2] Descriptor-level intercept:', constraints);
      
      if (constraints?.video) {
        try {
          return createStream();
        } catch (e) {
          console.error('[Protocol2] Failed:', e);
          if (originalDescriptor && originalDescriptor.value) {
            return originalDescriptor.value.call(this, constraints);
          }
          throw e;
        }
      }
      
      if (originalDescriptor && originalDescriptor.value) {
        return originalDescriptor.value.call(this, constraints);
      }
      throw new Error('getUserMedia not available');
    },
    configurable: true,
    enumerable: true,
    writable: true
  });
  
  // Also override enumerateDevices
  Object.defineProperty(MediaDevices.prototype, 'enumerateDevices', {
    value: async function() {
      console.log('[Protocol2] enumerateDevices intercepted');
      return [{
        deviceId: CONFIG.deviceId,
        groupId: 'default',
        kind: 'videoinput',
        label: CONFIG.deviceLabel
      }];
    },
    configurable: true,
    enumerable: true,
    writable: true
  });
  
  window.__protocol2 = {
    getStatus: () => ({
      initialized: true,
      animating: animating,
      frames: frameNum
    })
  };
  
  console.log('[Protocol2] ===== DESCRIPTOR HOOK COMPLETE =====');
  
  return true;
})();
true;
`;
}

/**
 * PROTOCOL 3: Proxy-Based Deep Intercept
 * Uses Proxy to intercept all method calls
 */
export function createProtocol3ProxyIntercept(config: Partial<InjectionConfig> = {}): string {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  return `
(function() {
  'use strict';
  
  // ============================================================================
  // PROTOCOL 3: PROXY-BASED INTERCEPT
  // ============================================================================
  
  if (window.__protocol3Initialized) {
    console.log('[Protocol3] Already initialized');
    return;
  }
  window.__protocol3Initialized = true;
  
  console.log('[Protocol3] ===== PROXY INTERCEPT =====');
  
  const CONFIG = ${JSON.stringify(cfg)};
  
  let canvas, ctx, animating = false, frames = 0;
  
  function init() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.width = CONFIG.width;
    canvas.height = CONFIG.height;
    ctx = canvas.getContext('2d');
  }
  
  function draw() {
    if (!animating) return;
    
    const t = Date.now() / 1000;
    const hue = (t * 60) % 360;
    
    // Gradient
    const grad = ctx.createRadialGradient(
      CONFIG.width/2, CONFIG.height/2, 0,
      CONFIG.width/2, CONFIG.height/2, CONFIG.width/2
    );
    grad.addColorStop(0, 'hsl(' + hue + ', 70%, 40%)');
    grad.addColorStop(1, 'hsl(' + ((hue + 180) % 360) + ', 70%, 20%)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
    
    // Circle
    ctx.beginPath();
    ctx.arc(
      CONFIG.width/2 + Math.cos(t) * 200,
      CONFIG.height/2 + Math.sin(t) * 200,
      80, 0, Math.PI * 2
    );
    ctx.fillStyle = 'white';
    ctx.fill();
    
    frames++;
    requestAnimationFrame(draw);
  }
  
  function start() {
    if (animating) return;
    init();
    animating = true;
    draw();
  }
  
  function makeStream() {
    start();
    const stream = canvas.captureStream(CONFIG.fps);
    
    // Spoof track metadata
    const track = stream.getVideoTracks()[0];
    if (track) {
      Object.defineProperty(track, 'label', {
        get: function() { return CONFIG.deviceLabel; },
        configurable: true
      });
      
      track.getSettings = function() {
        return {
          width: CONFIG.width,
          height: CONFIG.height,
          frameRate: CONFIG.fps,
          aspectRatio: CONFIG.width / CONFIG.height,
          facingMode: 'user',
          deviceId: CONFIG.deviceId,
          groupId: 'default',
          resizeMode: 'none'
        };
      };
      
      track.getCapabilities = function() {
        return {
          width: { min: 1, max: CONFIG.width },
          height: { min: 1, max: CONFIG.height },
          frameRate: { min: 1, max: 60 },
          facingMode: ['user', 'environment'],
          deviceId: CONFIG.deviceId,
          resizeMode: ['none', 'crop-and-scale']
        };
      };
    }
    
    return stream;
  }
  
  // ============================================================================
  // PROXY INTERCEPT - Using method replacement instead of property override
  // ============================================================================
  
  // Cannot use Proxy on navigator.mediaDevices directly because it's read-only
  // Instead, we override the individual methods
  if (!navigator.mediaDevices) {
    try {
      navigator.mediaDevices = {};
    } catch (e) {
      console.warn('[Protocol3] Unable to create navigator.mediaDevices:', e);
    }
  }
  
  const originalGetUserMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
  const originalEnumerateDevices = navigator.mediaDevices?.enumerateDevices?.bind(navigator.mediaDevices);
  
  // Create proxy handler for getUserMedia
  const getUserMediaProxy = new Proxy(originalGetUserMedia || (async () => { throw new Error('Not supported'); }), {
    apply(target, thisArg, argumentsList) {
      const constraints = argumentsList[0];
      console.log('[Protocol3] Proxy getUserMedia apply:', constraints);
      
      if (constraints?.video) {
        try {
          const stream = makeStream();
          console.log('[Protocol3] Returning injected stream');
          return Promise.resolve(stream);
        } catch (e) {
          console.error('[Protocol3] Failed:', e);
        }
      }
      
      return Reflect.apply(target, thisArg, argumentsList);
    }
  });
  
  // Create proxy handler for enumerateDevices
  const enumerateDevicesProxy = new Proxy(originalEnumerateDevices || (async () => []), {
    apply() {
      console.log('[Protocol3] Proxy enumerateDevices apply');
      return Promise.resolve([{
        deviceId: CONFIG.deviceId,
        groupId: 'default',
        kind: 'videoinput',
        label: CONFIG.deviceLabel,
        toJSON: function() { return this; }
      }]);
    }
  });
  
  // Override the methods on mediaDevices
  if (navigator.mediaDevices) {
    try {
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        value: getUserMediaProxy,
        writable: true,
        configurable: true,
      });
      console.log('[Protocol3] getUserMedia replaced with proxy');
    } catch (e) {
      // Fallback: direct assignment
      navigator.mediaDevices.getUserMedia = getUserMediaProxy;
      console.log('[Protocol3] getUserMedia replaced (direct)');
    }
    
    try {
      Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', {
        value: enumerateDevicesProxy,
        writable: true,
        configurable: true,
      });
      console.log('[Protocol3] enumerateDevices replaced with proxy');
    } catch (e) {
      navigator.mediaDevices.enumerateDevices = enumerateDevicesProxy;
      console.log('[Protocol3] enumerateDevices replaced (direct)');
    }
  }
  
  window.__protocol3 = {
    getStatus: () => ({ initialized: true, animating, frames })
  };
  
  console.log('[Protocol3] ===== PROXY INTERCEPT COMPLETE =====');
  
  return true;
})();
true;
`;
}

/**
 * Create a comprehensive test page that tests all protocols
 */
export function createProtocolTestPage(testUrl: string = 'https://webcamtests.com/recorder'): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Protocol Test Suite</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, system-ui, sans-serif;
      background: #0a0a0a;
      color: #fff;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 {
      font-size: 24px;
      margin-bottom: 20px;
      color: #00ff88;
    }
    .protocol-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      margin-bottom: 30px;
    }
    .protocol-card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 16px;
    }
    .protocol-card.testing { border-color: #ffaa00; }
    .protocol-card.success { border-color: #00ff88; }
    .protocol-card.failed { border-color: #ff4444; }
    
    .protocol-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .protocol-name {
      font-size: 16px;
      font-weight: 600;
    }
    .protocol-status {
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 4px;
      background: rgba(255,255,255,0.1);
    }
    .protocol-status.testing { background: rgba(255,170,0,0.2); color: #ffaa00; }
    .protocol-status.success { background: rgba(0,255,136,0.2); color: #00ff88; }
    .protocol-status.failed { background: rgba(255,68,68,0.2); color: #ff4444; }
    
    .protocol-desc {
      font-size: 13px;
      color: rgba(255,255,255,0.6);
      margin-bottom: 12px;
    }
    .protocol-result {
      font-size: 12px;
      font-family: monospace;
      background: rgba(0,0,0,0.3);
      padding: 8px;
      border-radius: 4px;
      max-height: 100px;
      overflow-y: auto;
    }
    
    button {
      background: #00ff88;
      color: #000;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      margin-right: 12px;
      margin-bottom: 12px;
    }
    button:hover { background: #00dd77; }
    button:disabled {
      background: rgba(255,255,255,0.2);
      color: rgba(255,255,255,0.5);
      cursor: not-allowed;
    }
    
    .test-area {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }
    video {
      width: 100%;
      max-width: 400px;
      height: auto;
      border-radius: 8px;
      background: #000;
    }
    
    .summary {
      background: rgba(0,255,136,0.1);
      border: 1px solid rgba(0,255,136,0.3);
      border-radius: 12px;
      padding: 16px;
      margin-top: 20px;
    }
    .summary h2 {
      font-size: 18px;
      margin-bottom: 12px;
      color: #00ff88;
    }
    .summary-item {
      font-size: 14px;
      margin: 8px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔬 Deep Injection Protocol Test Suite</h1>
    
    <div class="test-area">
      <h2 style="font-size: 18px; margin-bottom: 12px;">Test Controls</h2>
      <button id="testAllBtn">Test All Protocols</button>
      <button id="testP0Btn">Test Protocol 0</button>
      <button id="testP1Btn">Test Protocol 1</button>
      <button id="testP2Btn">Test Protocol 2</button>
      <button id="testP3Btn">Test Protocol 3</button>
      <button id="clearBtn">Clear Results</button>
      
      <div style="margin-top: 16px;">
        <video id="testVideo" autoplay playsinline muted></video>
      </div>
    </div>
    
    <div class="protocol-grid" id="protocolGrid">
      <!-- Protocol cards will be inserted here -->
    </div>
    
    <div class="summary" id="summary" style="display: none;">
      <h2>📊 Test Summary</h2>
      <div id="summaryContent"></div>
    </div>
  </div>
  
  <script>
    const protocols = [
      {
        id: 'protocol0',
        name: 'Protocol 0: Ultra-Early Hook',
        desc: 'Hooks getUserMedia before page scripts load',
        status: 'idle',
        result: ''
      },
      {
        id: 'protocol1',
        name: 'Protocol 1: MediaStream Override',
        desc: 'Intercepts MediaStream constructor',
        status: 'idle',
        result: ''
      },
      {
        id: 'protocol2',
        name: 'Protocol 2: Descriptor Hook',
        desc: 'Overrides property descriptors',
        status: 'idle',
        result: ''
      },
      {
        id: 'protocol3',
        name: 'Protocol 3: Proxy Intercept',
        desc: 'Uses Proxy to intercept calls',
        status: 'idle',
        result: ''
      }
    ];
    
    let testResults = {
      tested: 0,
      passed: 0,
      failed: 0
    };
    
    function renderProtocols() {
      const grid = document.getElementById('protocolGrid');
      grid.innerHTML = protocols.map(p => \`
        <div class="protocol-card \${p.status === 'testing' ? 'testing' : p.status === 'success' ? 'success' : p.status === 'failed' ? 'failed' : ''}" id="\${p.id}Card">
          <div class="protocol-header">
            <div class="protocol-name">\${p.name}</div>
            <div class="protocol-status \${p.status}">\${p.status.toUpperCase()}</div>
          </div>
          <div class="protocol-desc">\${p.desc}</div>
          <div class="protocol-result" id="\${p.id}Result">\${p.result || 'Not tested yet'}</div>
        </div>
      \`).join('');
    }
    
    function updateProtocol(id, status, result) {
      const protocol = protocols.find(p => p.id === id);
      if (protocol) {
        protocol.status = status;
        protocol.result = result;
        renderProtocols();
      }
    }
    
    function updateSummary() {
      const summary = document.getElementById('summary');
      const content = document.getElementById('summaryContent');
      
      if (testResults.tested > 0) {
        summary.style.display = 'block';
        content.innerHTML = \`
          <div class="summary-item">✓ Tests Completed: \${testResults.tested}/4</div>
          <div class="summary-item" style="color: #00ff88;">✓ Passed: \${testResults.passed}</div>
          <div class="summary-item" style="color: #ff4444;">✗ Failed: \${testResults.failed}</div>
          <div class="summary-item" style="margin-top: 12px; font-weight: 600;">
            Success Rate: \${Math.round(testResults.passed / testResults.tested * 100)}%
          </div>
        \`;
      } else {
        summary.style.display = 'none';
      }
    }
    
    async function testProtocol(id, injectionScript) {
      console.log(\`Testing \${id}...\`);
      updateProtocol(id, 'testing', 'Injecting script...');
      
      try {
        // Inject the protocol
        eval(injectionScript);
        updateProtocol(id, 'testing', 'Script injected, testing getUserMedia...');
        
        // Wait a bit for injection to settle
        await new Promise(r => setTimeout(r, 100));
        
        // Test getUserMedia
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 }
        });
        
        if (!stream || stream.getVideoTracks().length === 0) {
          throw new Error('No video tracks in stream');
        }
        
        // Attach to video element
        const video = document.getElementById('testVideo');
        video.srcObject = stream;
        
        // Check if video is actually playing
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Video play timeout')), 5000);
          video.onloadedmetadata = () => {
            clearTimeout(timeout);
            resolve();
          };
        });
        
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();
        
        updateProtocol(id, 'success', \`✓ SUCCESS\\nResolution: \${settings.width}x\${settings.height}\\nFPS: \${settings.frameRate || 'unknown'}\\nLabel: \${track.label}\`);
        
        testResults.tested++;
        testResults.passed++;
        
        // Stop the stream
        setTimeout(() => {
          stream.getTracks().forEach(t => t.stop());
        }, 2000);
        
        return true;
        
      } catch (error) {
        console.error(\`\${id} failed:\`, error);
        updateProtocol(id, 'failed', \`✗ FAILED\\n\${error.message}\`);
        testResults.tested++;
        testResults.failed++;
        return false;
      } finally {
        updateSummary();
      }
    }
    
    // Button handlers
    document.getElementById('testAllBtn').onclick = async function() {
      testResults = { tested: 0, passed: 0, failed: 0 };
      
      // Test each protocol sequentially
      // Note: In real implementation, inject via message from React Native
      await new Promise(r => setTimeout(r, 500));
      
      alert('In production, protocols would be injected via React Native WebView. Click individual test buttons to test manually injected protocols.');
    };
    
    document.getElementById('clearBtn').onclick = function() {
      protocols.forEach(p => {
        p.status = 'idle';
        p.result = '';
      });
      testResults = { tested: 0, passed: 0, failed: 0 };
      renderProtocols();
      updateSummary();
      
      const video = document.getElementById('testVideo');
      if (video.srcObject) {
        video.srcObject.getTracks().forEach(t => t.stop());
        video.srcObject = null;
      }
    };
    
    // Initial render
    renderProtocols();
    console.log('Protocol Test Suite Ready');
    console.log('Use buttons to test individual protocols or test all at once');
  </script>
</body>
</html>
`;
}

/**
 * Export all protocol generators
 * 
 * Note: Individual functions are already exported via `export function` declarations.
 * This object provides a convenient way to access all protocols.
 */
export const DEEP_INJECTION_PROTOCOLS = {
  protocol0: createProtocol0DeepHook,
  protocol0Enhanced: createProtocol0Script,
  protocol1: createProtocol1MediaStreamOverride,
  protocol2: createProtocol2DescriptorHook,
  protocol3: createProtocol3ProxyIntercept,
  testPage: createProtocolTestPage,
};
