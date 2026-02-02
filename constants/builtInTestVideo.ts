/**
 * Built-in Test Video System
 * 
 * This module provides a hardcoded test video that's always available
 * for testing all 4 protocols without requiring user uploads.
 * 
 * The test video is a 1-second, 30fps, 1080x1920 (9:16 portrait) 
 * animated pattern that clearly shows motion for testing.
 */

export interface BuiltInTestVideo {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  aspectRatio: string;
  isBuiltIn: true;
  // Canvas pattern type for generation
  patternType: 'motion_test' | 'color_bars' | 'bouncing_ball' | 'gradient_wave';
}

// The built-in test video configuration
export const BUILT_IN_TEST_VIDEO: BuiltInTestVideo = {
  id: 'builtin_motion_test',
  name: 'Built-in Motion Test',
  description: 'Animated test pattern with moving elements - 1 second looping at 30fps',
  width: 1080,
  height: 1920,
  fps: 30,
  duration: 1,
  aspectRatio: '9:16',
  isBuiltIn: true,
  patternType: 'bouncing_ball',
};

// Additional built-in patterns
export const BUILT_IN_TEST_PATTERNS: BuiltInTestVideo[] = [
  BUILT_IN_TEST_VIDEO,
  {
    id: 'builtin_color_bars',
    name: 'Color Bars Pattern',
    description: 'SMPTE color bars - classic test pattern',
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 1,
    aspectRatio: '9:16',
    isBuiltIn: true,
    patternType: 'color_bars',
  },
  {
    id: 'builtin_gradient_wave',
    name: 'Gradient Wave',
    description: 'Smooth gradient wave animation',
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 1,
    aspectRatio: '9:16',
    isBuiltIn: true,
    patternType: 'gradient_wave',
  },
];

/**
 * Generate the JavaScript code for rendering a built-in test pattern
 * This is injected directly into the webview for maximum reliability
 */
export function generateTestPatternScript(patternType: BuiltInTestVideo['patternType']): string {
  switch (patternType) {
    case 'bouncing_ball':
      return BOUNCING_BALL_PATTERN_SCRIPT;
    case 'color_bars':
      return COLOR_BARS_PATTERN_SCRIPT;
    case 'gradient_wave':
      return GRADIENT_WAVE_PATTERN_SCRIPT;
    default:
      return BOUNCING_BALL_PATTERN_SCRIPT;
  }
}

// Bouncing ball pattern - most visible motion test
const BOUNCING_BALL_PATTERN_SCRIPT = `
function renderBouncingBall(ctx, w, h, t, frame) {
  // Dark background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, w, h);
  
  // Multiple bouncing balls for clear motion
  const balls = [
    { radius: 60, color: '#ff6b6b', phase: 0, speed: 2 },
    { radius: 45, color: '#4ecdc4', phase: Math.PI / 3, speed: 2.5 },
    { radius: 35, color: '#ffe66d', phase: Math.PI * 2 / 3, speed: 3 },
  ];
  
  balls.forEach((ball, i) => {
    const bounceY = Math.abs(Math.sin((t * ball.speed + ball.phase) * Math.PI)) * (h * 0.6);
    const x = w / 2 + Math.sin(t * 0.5 + ball.phase) * (w * 0.3);
    const y = h * 0.2 + bounceY;
    
    // Ball shadow
    ctx.beginPath();
    ctx.ellipse(x, h * 0.85, ball.radius * 0.8, ball.radius * 0.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fill();
    
    // Ball gradient
    const gradient = ctx.createRadialGradient(
      x - ball.radius * 0.3, y - ball.radius * 0.3, 0,
      x, y, ball.radius
    );
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.3, ball.color);
    gradient.addColorStop(1, ball.color.replace(/[^#]/g, (c, i) => {
      const hex = parseInt(c, 16);
      return Math.max(0, hex - 4).toString(16);
    }));
    
    ctx.beginPath();
    ctx.arc(x, y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  });
  
  // Timestamp and frame counter for verification
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = 'bold 28px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BUILT-IN TEST VIDEO', w / 2, 60);
  
  ctx.font = '20px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillText(\`Frame: \${frame} | FPS: 30\`, w / 2, h - 80);
  ctx.fillText(\`Time: \${t.toFixed(2)}s | 1080x1920\`, w / 2, h - 50);
  
  // Animated border for extra visibility
  const borderWidth = 8;
  const hue = (t * 60) % 360;
  ctx.strokeStyle = \`hsl(\${hue}, 80%, 60%)\`;
  ctx.lineWidth = borderWidth;
  ctx.strokeRect(borderWidth/2, borderWidth/2, w - borderWidth, h - borderWidth);
}
`;

// Color bars pattern - SMPTE style
const COLOR_BARS_PATTERN_SCRIPT = `
function renderColorBars(ctx, w, h, t, frame) {
  const bars = [
    '#ffffff', // White
    '#ffff00', // Yellow
    '#00ffff', // Cyan
    '#00ff00', // Green
    '#ff00ff', // Magenta
    '#ff0000', // Red
    '#0000ff', // Blue
    '#000000', // Black
  ];
  
  const barWidth = w / bars.length;
  const mainHeight = h * 0.7;
  
  // Main bars
  bars.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(i * barWidth, 0, barWidth, mainHeight);
  });
  
  // Animated shimmer effect
  const shimmerX = ((t * 200) % (w + 100)) - 50;
  const shimmerGradient = ctx.createLinearGradient(shimmerX - 50, 0, shimmerX + 50, 0);
  shimmerGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
  shimmerGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
  shimmerGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = shimmerGradient;
  ctx.fillRect(0, 0, w, mainHeight);
  
  // Bottom section - grayscale
  const grays = ['#000000', '#111111', '#222222', '#333333', '#444444', '#555555', '#666666', '#777777'];
  const grayHeight = h * 0.15;
  grays.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(i * barWidth, mainHeight, barWidth, grayHeight);
  });
  
  // Info section
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, mainHeight + grayHeight, w, h - mainHeight - grayHeight);
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SMPTE COLOR BARS', w / 2, mainHeight + grayHeight + 50);
  
  ctx.font = '18px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillText(\`Frame: \${frame} | Built-in Test\`, w / 2, mainHeight + grayHeight + 90);
}
`;

// Gradient wave pattern
const GRADIENT_WAVE_PATTERN_SCRIPT = `
function renderGradientWave(ctx, w, h, t, frame) {
  // Animated gradient background
  const waveCount = 5;
  for (let i = 0; i < waveCount; i++) {
    const y = (h / waveCount) * i;
    const height = h / waveCount;
    const phase = t * 2 + (i * Math.PI / waveCount);
    const hue1 = ((t * 30) + (i * 40)) % 360;
    const hue2 = ((t * 30) + (i * 40) + 60) % 360;
    
    const gradient = ctx.createLinearGradient(
      Math.sin(phase) * 100 + w / 2,
      y,
      Math.cos(phase) * 100 + w / 2,
      y + height
    );
    gradient.addColorStop(0, \`hsl(\${hue1}, 70%, 50%)\`);
    gradient.addColorStop(0.5, \`hsl(\${hue2}, 80%, 60%)\`);
    gradient.addColorStop(1, \`hsl(\${hue1}, 70%, 50%)\`);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, y, w, height + 1);
  }
  
  // Floating circles
  for (let i = 0; i < 8; i++) {
    const x = w / 2 + Math.sin(t * (0.5 + i * 0.1) + i) * (w * 0.4);
    const y = h / 2 + Math.cos(t * (0.7 + i * 0.1) + i * 0.5) * (h * 0.35);
    const radius = 30 + Math.sin(t * 2 + i) * 15;
    
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = \`rgba(255, 255, 255, \${0.2 + Math.sin(t + i) * 0.1})\`;
    ctx.fill();
  }
  
  // Label
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(w / 2 - 200, 30, 400, 80);
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GRADIENT WAVE TEST', w / 2, 65);
  
  ctx.font = '16px -apple-system, system-ui, sans-serif';
  ctx.fillText(\`Frame: \${frame} | 1080x1920 @ 30fps\`, w / 2, 95);
}
`;

/**
 * Complete injection script that creates a built-in test video stream
 * This is the primary fallback when no user video is available
 */
export const BUILT_IN_VIDEO_INJECTION_SCRIPT = `
(function() {
  if (window.__builtInVideoInjectorInitialized) return;
  window.__builtInVideoInjectorInitialized = true;
  
  console.log('[BuiltInVideo] Initializing built-in test video system...');
  
  // Pattern renderers
  ${BOUNCING_BALL_PATTERN_SCRIPT}
  ${COLOR_BARS_PATTERN_SCRIPT}
  ${GRADIENT_WAVE_PATTERN_SCRIPT}
  
  const PATTERN_RENDERERS = {
    'bouncing_ball': renderBouncingBall,
    'color_bars': renderColorBars,
    'gradient_wave': renderGradientWave,
  };
  
  window.__builtInVideoConfig = {
    patternType: 'bouncing_ball',
    width: 1080,
    height: 1920,
    fps: 30,
  };
  
  window.__setBuiltInPattern = function(patternType) {
    if (PATTERN_RENDERERS[patternType]) {
      window.__builtInVideoConfig.patternType = patternType;
      console.log('[BuiltInVideo] Pattern set to:', patternType);
    }
  };
  
  /**
   * Creates a MediaStream from the built-in test video canvas
   */
  window.__createBuiltInVideoStream = function(options) {
    options = options || {};
    const config = window.__builtInVideoConfig;
    const w = options.width || config.width;
    const h = options.height || config.height;
    const fps = options.fps || config.fps;
    const patternType = options.patternType || config.patternType;
    
    console.log('[BuiltInVideo] Creating stream:', w + 'x' + h, '@', fps + 'fps', 'pattern:', patternType);
    
    return new Promise(function(resolve, reject) {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { alpha: false });
      
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      let isRunning = true;
      let frame = 0;
      const start = Date.now();
      let lastDrawTime = 0;
      const targetFrameTime = 1000 / fps;
      
      const renderer = PATTERN_RENDERERS[patternType] || renderBouncingBall;
      
      function render(timestamp) {
        if (!isRunning) return;
        
        const elapsed = timestamp - lastDrawTime;
        if (elapsed < targetFrameTime * 0.9) {
          requestAnimationFrame(render);
          return;
        }
        lastDrawTime = timestamp;
        
        const t = (Date.now() - start) / 1000;
        renderer(ctx, w, h, t, frame);
        frame++;
        
        requestAnimationFrame(render);
      }
      
      requestAnimationFrame(render);
      
      // Create stream after a short delay to ensure first frame is drawn
      setTimeout(function() {
        try {
          const stream = canvas.captureStream(fps);
          if (!stream || stream.getVideoTracks().length === 0) {
            reject(new Error('Failed to capture stream from canvas'));
            return;
          }
          
          // Spoof track settings - CRITICAL for webcamtests.com compatibility
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            const trackId = 'builtin_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            // Essential track properties
            try {
              Object.defineProperty(videoTrack, 'id', {
                get: function() { return trackId; },
                configurable: true
              });
            } catch(e) {}
            
            try {
              Object.defineProperty(videoTrack, 'kind', {
                get: function() { return 'video'; },
                configurable: true
              });
            } catch(e) {}
            
            try {
              Object.defineProperty(videoTrack, 'readyState', {
                get: function() { return 'live'; },
                configurable: true
              });
            } catch(e) {}
            
            try {
              Object.defineProperty(videoTrack, 'enabled', {
                get: function() { return true; },
                set: function(v) { /* ignore */ },
                configurable: true
              });
            } catch(e) {}
            
            try {
              Object.defineProperty(videoTrack, 'muted', {
                get: function() { return false; },
                configurable: true
              });
            } catch(e) {}
            
            videoTrack.getSettings = function() {
              return {
                width: w,
                height: h,
                frameRate: fps,
                aspectRatio: w / h,
                facingMode: 'user',
                deviceId: 'builtin_test_video',
                groupId: 'builtin',
                resizeMode: 'none'
              };
            };
            
            videoTrack.getCapabilities = function() {
              return {
                aspectRatio: { min: 0.5, max: 2.0 },
                deviceId: 'builtin_test_video',
                facingMode: ['user', 'environment'],
                frameRate: { min: 1, max: 60 },
                groupId: 'builtin',
                height: { min: 1, max: 2160 },
                width: { min: 1, max: 3840 },
              };
            };
            
            videoTrack.getConstraints = function() {
              return {
                facingMode: 'user',
                width: { ideal: w },
                height: { ideal: h }
              };
            };
            
            videoTrack.applyConstraints = function(constraints) {
              return Promise.resolve();
            };
            
            Object.defineProperty(videoTrack, 'label', {
              get: function() { return 'Built-in Test Video (' + patternType + ')'; },
              configurable: true
            });
          }
          
          stream._cleanup = function() {
            isRunning = false;
            console.log('[BuiltInVideo] Stream cleanup');
          };
          stream._isBuiltIn = true;
          stream._patternType = patternType;
          
          console.log('[BuiltInVideo] Stream created successfully');
          resolve(stream);
        } catch (err) {
          reject(err);
        }
      }, 100);
    });
  };
  
  console.log('[BuiltInVideo] Built-in test video system ready');
  console.log('[BuiltInVideo] Available patterns:', Object.keys(PATTERN_RENDERERS).join(', '));
})();
true;
`;

/**
 * Get the marker for a built-in video URI
 */
export function getBuiltInVideoUri(patternType: BuiltInTestVideo['patternType'] = 'bouncing_ball'): string {
  return `builtin:${patternType}`;
}

/**
 * Check if a URI is a built-in video
 */
export function isBuiltInVideoUri(uri: string): boolean {
  return uri.startsWith('builtin:');
}

/**
 * Extract the pattern type from a built-in video URI
 */
export function getPatternFromBuiltInUri(uri: string): BuiltInTestVideo['patternType'] {
  if (!isBuiltInVideoUri(uri)) return 'bouncing_ball';
  const pattern = uri.replace('builtin:', '') as BuiltInTestVideo['patternType'];
  return pattern || 'bouncing_ball';
}
