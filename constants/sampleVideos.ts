export interface SampleVideo {
  id: string;
  name: string;
  description: string;
  category: 'test_pattern' | 'nature' | 'person' | 'animation';
  resolutions: SampleVideoResolution[];
  thumbnail?: string;
  duration?: number;
  isLooping?: boolean;
  aspectRatio?: '9:16' | '16:9' | '4:3' | '1:1';
}

export interface SampleVideoResolution {
  label: string;
  width: number;
  height: number;
  fps: number;
  url: string;
  fileSize?: string;
  isPortrait?: boolean;
}

export const PORTRAIT_RESOLUTIONS = {
  '4K': { width: 2160, height: 3840, label: '4K Portrait' },
  '1080p': { width: 1080, height: 1920, label: '1080p Portrait' },
  '720p': { width: 720, height: 1280, label: '720p Portrait' },
  '480p': { width: 480, height: 854, label: '480p Portrait' },
  '360p': { width: 360, height: 640, label: '360p Portrait' },
  '240p': { width: 240, height: 426, label: '240p Portrait' },
} as const;

export const VIDEO_RESOLUTIONS = {
  '4K': { width: 3840, height: 2160, label: '4K UHD' },
  '1080p': { width: 1920, height: 1080, label: '1080p Full HD' },
  '720p': { width: 1280, height: 720, label: '720p HD' },
  '480p': { width: 854, height: 480, label: '480p SD' },
  '360p': { width: 640, height: 360, label: '360p' },
  '240p': { width: 426, height: 240, label: '240p' },
} as const;

export const IPHONE_FRONT_CAMERA_RESOLUTIONS = {
  'iPhone15Pro': { width: 1080, height: 1920, fps: 30, label: 'iPhone 15 Pro Front (12MP)' },
  'iPhone14Pro': { width: 1080, height: 1920, fps: 30, label: 'iPhone 14 Pro Front (12MP)' },
  'iPhone13': { width: 1080, height: 1920, fps: 30, label: 'iPhone 13 Front (12MP)' },
  'iPhone12': { width: 1080, height: 1920, fps: 30, label: 'iPhone 12 Front (12MP)' },
  'iPhoneSE': { width: 720, height: 1280, fps: 30, label: 'iPhone SE Front (7MP)' },
  'default': { width: 1080, height: 1920, fps: 30, label: 'iPhone Front Camera' },
} as const;

export const DEFAULT_PORTRAIT_RESOLUTION = {
  width: 1080,
  height: 1920,
  fps: 30,
  aspectRatio: '9:16' as const,
};

export const SAMPLE_VIDEOS: SampleVideo[] = [
  // ===== BUILT-IN TEST VIDEOS (Always Available) =====
  {
    id: 'builtin_bouncing_ball',
    name: 'Built-in: Bouncing Balls',
    description: 'Animated bouncing balls - perfect for testing camera injection. No upload needed!',
    category: 'test_pattern',
    duration: 999,
    isLooping: true,
    aspectRatio: '9:16',
    resolutions: [
      {
        label: '1080x1920 30fps',
        width: 1080,
        height: 1920,
        fps: 30,
        url: 'builtin:bouncing_ball',
        fileSize: 'Built-in',
        isPortrait: true,
      },
    ],
  },
  {
    id: 'builtin_color_bars',
    name: 'Built-in: SMPTE Color Bars',
    description: 'Classic SMPTE color bars with animated shimmer - industry standard test pattern',
    category: 'test_pattern',
    duration: 999,
    isLooping: true,
    aspectRatio: '9:16',
    resolutions: [
      {
        label: '1080x1920 30fps',
        width: 1080,
        height: 1920,
        fps: 30,
        url: 'builtin:color_bars',
        fileSize: 'Built-in',
        isPortrait: true,
      },
    ],
  },
  {
    id: 'builtin_gradient_wave',
    name: 'Built-in: Gradient Wave',
    description: 'Smooth animated gradient waves with floating circles - visually appealing test',
    category: 'animation',
    duration: 999,
    isLooping: true,
    aspectRatio: '9:16',
    resolutions: [
      {
        label: '1080x1920 30fps',
        width: 1080,
        height: 1920,
        fps: 30,
        url: 'builtin:gradient_wave',
        fileSize: 'Built-in',
        isPortrait: true,
      },
    ],
  },
  // ===== CANVAS-GENERATED VIDEOS =====
  {
    id: 'canvas_color_bars',
    name: 'Color Bars Test',
    description: 'Professional SMPTE-style color bars - perfect for testing video pipeline',
    category: 'test_pattern',
    duration: 999,
    isLooping: true,
    aspectRatio: '9:16',
    resolutions: [
      {
        label: '1080x1920 30fps',
        width: 1080,
        height: 1920,
        fps: 30,
        url: 'canvas:color_bars',
        fileSize: 'Generated',
        isPortrait: true,
      },
      {
        label: '720x1280 30fps',
        width: 720,
        height: 1280,
        fps: 30,
        url: 'canvas:color_bars',
        fileSize: 'Generated',
        isPortrait: true,
      },
    ],
  },
  {
    id: 'canvas_face_sim',
    name: 'Face Simulation',
    description: 'Animated face placeholder with blinking - ideal for selfie camera testing',
    category: 'person',
    duration: 999,
    isLooping: true,
    aspectRatio: '9:16',
    resolutions: [
      {
        label: '1080x1920 30fps',
        width: 1080,
        height: 1920,
        fps: 30,
        url: 'canvas:face',
        fileSize: 'Generated',
        isPortrait: true,
      },
      {
        label: '720x1280 30fps',
        width: 720,
        height: 1280,
        fps: 30,
        url: 'canvas:face',
        fileSize: 'Generated',
        isPortrait: true,
      },
    ],
  },
  {
    id: 'canvas_motion_test',
    name: 'Motion Test Pattern',
    description: 'Animated circles with motion tracking - tests video smoothness',
    category: 'animation',
    duration: 999,
    isLooping: true,
    aspectRatio: '9:16',
    resolutions: [
      {
        label: '1080x1920 30fps',
        width: 1080,
        height: 1920,
        fps: 30,
        url: 'canvas:motion',
        fileSize: 'Generated',
        isPortrait: true,
      },
      {
        label: '720x1280 30fps',
        width: 720,
        height: 1280,
        fps: 30,
        url: 'canvas:motion',
        fileSize: 'Generated',
        isPortrait: true,
      },
    ],
  },
  {
    id: 'canvas_webcam_ready',
    name: 'Webcam Ready',
    description: 'Standard webcam simulation pattern - shows resolution & frame info',
    category: 'test_pattern',
    duration: 999,
    isLooping: true,
    aspectRatio: '9:16',
    resolutions: [
      {
        label: '1080x1920 30fps',
        width: 1080,
        height: 1920,
        fps: 30,
        url: 'canvas:default',
        fileSize: 'Generated',
        isPortrait: true,
      },
      {
        label: '720x1280 30fps',
        width: 720,
        height: 1280,
        fps: 30,
        url: 'canvas:default',
        fileSize: 'Generated',
        isPortrait: true,
      },
      {
        label: '480x854 30fps',
        width: 480,
        height: 854,
        fps: 30,
        url: 'canvas:default',
        fileSize: 'Generated',
        isPortrait: true,
      },
    ],
  },
];

export function isPortraitResolution(width: number, height: number): boolean {
  return height > width;
}

export function getAspectRatio(width: number, height: number): string {
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const divisor = gcd(width, height);
  const ratioW = width / divisor;
  const ratioH = height / divisor;
  
  if (ratioW === 9 && ratioH === 16) return '9:16';
  if (ratioW === 16 && ratioH === 9) return '16:9';
  if (ratioW === 3 && ratioH === 4) return '3:4';
  if (ratioW === 4 && ratioH === 3) return '4:3';
  if (ratioW === 1 && ratioH === 1) return '1:1';
  
  const ratio = width / height;
  if (ratio > 0.55 && ratio < 0.57) return '9:16';
  if (ratio > 1.75 && ratio < 1.79) return '16:9';
  
  return `${ratioW}:${ratioH}`;
}

export function findBestMatchingResolution(
  video: SampleVideo,
  targetWidth: number,
  targetHeight: number,
  targetFps?: number,
  preferPortrait: boolean = true
): SampleVideoResolution | null {
  if (video.resolutions.length === 0) return null;

  let filtered = video.resolutions;
  
  if (preferPortrait) {
    const portraitResolutions = filtered.filter(r => r.isPortrait || r.height > r.width);
    if (portraitResolutions.length > 0) {
      filtered = portraitResolutions;
    }
  }

  const sorted = [...filtered].sort((a, b) => {
    const aPixels = a.width * a.height;
    const bPixels = b.width * b.height;
    const targetPixels = targetWidth * targetHeight;

    const aDiff = Math.abs(aPixels - targetPixels);
    const bDiff = Math.abs(bPixels - targetPixels);

    if (aDiff !== bDiff) return aDiff - bDiff;

    if (targetFps) {
      const aFpsDiff = Math.abs(a.fps - targetFps);
      const bFpsDiff = Math.abs(b.fps - targetFps);
      return aFpsDiff - bFpsDiff;
    }

    return bPixels - aPixels;
  });

  return sorted[0];
}

export function getResolutionMatchedVideos(
  targetWidth: number,
  targetHeight: number,
  targetFps?: number,
  preferPortrait: boolean = true
): { video: SampleVideo; resolution: SampleVideoResolution }[] {
  const results: { video: SampleVideo; resolution: SampleVideoResolution }[] = [];

  for (const video of SAMPLE_VIDEOS) {
    const match = findBestMatchingResolution(video, targetWidth, targetHeight, targetFps, preferPortrait);
    if (match) {
      results.push({ video, resolution: match });
    }
  }

  return results;
}

export function getVideosByCategory(category: SampleVideo['category']): SampleVideo[] {
  return SAMPLE_VIDEOS.filter(v => v.category === category);
}

export function getLoopingVideos(): SampleVideo[] {
  return SAMPLE_VIDEOS.filter(v => v.isLooping);
}

export function getPortraitVideos(): SampleVideo[] {
  return SAMPLE_VIDEOS.filter(v => v.aspectRatio === '9:16');
}

export function getVideosForIPhoneFrontCamera(): SampleVideo[] {
  return SAMPLE_VIDEOS.filter(v => {
    if (v.aspectRatio !== '9:16') return false;
    return v.resolutions.some(r => 
      r.isPortrait && 
      r.width === 1080 && 
      r.height === 1920
    );
  });
}

export function getHighQualityVideos(minWidth: number = 1080): SampleVideo[] {
  return SAMPLE_VIDEOS.filter(v =>
    v.resolutions.some(r => Math.max(r.width, r.height) >= minWidth)
  );
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function getResolutionLabel(width: number, height: number): string {
  const maxDim = Math.max(width, height);
  if (maxDim >= 3840) return '4K';
  if (maxDim >= 2560) return '1440p';
  if (maxDim >= 1920) return '1080p';
  if (maxDim >= 1280) return '720p';
  if (maxDim >= 854) return '480p';
  if (maxDim >= 640) return '360p';
  return '240p';
}

export function getPortraitResolutionLabel(width: number, height: number): string {
  const isPortrait = height > width;
  const label = getResolutionLabel(width, height);
  return isPortrait ? `${label} Portrait` : label;
}

export const QUICK_SAMPLE_VIDEOS = SAMPLE_VIDEOS.filter(v => 
  v.isLooping && v.aspectRatio === '9:16'
).slice(0, 5);

export const RECOMMENDED_FOR_WEBCAM = [
  'builtin_bouncing_ball',  // Best for testing - always works
  'builtin_color_bars',     // Industry standard test pattern
  'builtin_gradient_wave',  // Visually appealing animated test
  'canvas_face_sim',
  'canvas_color_bars',
  'canvas_motion_test',
  'canvas_webcam_ready',
];

/**
 * Get built-in videos that are always available without upload
 */
export function getBuiltInVideos(): SampleVideo[] {
  return SAMPLE_VIDEOS.filter(v => v.id.startsWith('builtin_'));
}

/**
 * Check if a video URL is a built-in test video
 */
export function isBuiltInVideo(url: string): boolean {
  return url.startsWith('builtin:');
}

export function getRecommendedVideos(): SampleVideo[] {
  return SAMPLE_VIDEOS.filter(v => RECOMMENDED_FOR_WEBCAM.includes(v.id));
}

export function getDefaultPortraitResolutionForDevice(deviceName?: string): { width: number; height: number; fps: number } {
  if (!deviceName) return { ...DEFAULT_PORTRAIT_RESOLUTION };
  
  const lowerName = deviceName.toLowerCase();
  
  if (lowerName.includes('iphone 15') || lowerName.includes('iphone15')) {
    return { ...IPHONE_FRONT_CAMERA_RESOLUTIONS.iPhone15Pro };
  }
  if (lowerName.includes('iphone 14') || lowerName.includes('iphone14')) {
    return { ...IPHONE_FRONT_CAMERA_RESOLUTIONS.iPhone14Pro };
  }
  if (lowerName.includes('iphone 13') || lowerName.includes('iphone13')) {
    return { ...IPHONE_FRONT_CAMERA_RESOLUTIONS.iPhone13 };
  }
  if (lowerName.includes('iphone 12') || lowerName.includes('iphone12')) {
    return { ...IPHONE_FRONT_CAMERA_RESOLUTIONS.iPhone12 };
  }
  if (lowerName.includes('iphone se') || lowerName.includes('iphonese')) {
    return { ...IPHONE_FRONT_CAMERA_RESOLUTIONS.iPhoneSE };
  }
  
  return { ...IPHONE_FRONT_CAMERA_RESOLUTIONS.default };
}

export function validatePortraitAspectRatio(width: number, height: number): { isValid: boolean; message: string } {
  const aspectRatio = width / height;
  const targetRatio = 9 / 16;
  const tolerance = 0.05;
  
  if (Math.abs(aspectRatio - targetRatio) <= tolerance) {
    return { isValid: true, message: 'Valid 9:16 portrait aspect ratio' };
  }
  
  if (height <= width) {
    return { 
      isValid: false, 
      message: `Video is in landscape orientation (${width}x${height}). Required: 9:16 portrait (e.g., 1080x1920)` 
    };
  }
  
  return { 
    isValid: false, 
    message: `Video aspect ratio is ${getAspectRatio(width, height)}. Required: 9:16 portrait` 
  };
}
