import { Platform } from 'react-native';
import type { SavedVideo } from './videoManager';
import {
  isBase64VideoUri,
  isBlobUri,
  getMimeTypeFromDataUri,
} from './base64VideoHandler';

export interface VideoServingConfig {
  uri: string;
  isLocal: boolean;
  mimeType: string;
  requiresDownload: boolean;
  isBase64?: boolean;
  isBlob?: boolean;
  warningMessage?: string;
  // New optimization fields
  estimatedLoadTime?: 'fast' | 'medium' | 'slow';
  cacheable?: boolean;
  priority?: 'high' | 'normal' | 'low';
  compressionLevel?: 'none' | 'light' | 'heavy';
}

// Video serving optimization constants
export const VIDEO_SERVING_CONSTANTS = {
  // Size thresholds for load time estimation
  FAST_LOAD_THRESHOLD: 5 * 1024 * 1024, // 5MB
  MEDIUM_LOAD_THRESHOLD: 20 * 1024 * 1024, // 20MB
  // Cache hints
  LOCAL_CACHE_PRIORITY: 'high' as const,
  EXTERNAL_CACHE_PRIORITY: 'normal' as const,
  // Compression detection patterns
  COMPRESSED_FORMATS: ['mp4', 'webm', 'm4v'],
  UNCOMPRESSED_FORMATS: ['avi', 'mov'],
};

const VIDEO_MIME_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  m4v: 'video/x-m4v',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  '3gp': 'video/3gpp',
};

export const getVideoMimeType = (uri: string): string => {
  // Handle base64 data URIs
  if (isBase64VideoUri(uri)) {
    const mimeType = getMimeTypeFromDataUri(uri);
    return mimeType || 'video/mp4';
  }
  
  // Handle blob URLs (default to mp4)
  if (isBlobUri(uri)) {
    return 'video/mp4';
  }
  
  const extension = uri.split('.').pop()?.toLowerCase()?.split('?')[0] || 'mp4';
  return VIDEO_MIME_TYPES[extension] || 'video/mp4';
};

export const isLocalFileUri = (uri: string): boolean => {
  if (!uri) return false;
  const trimmed = uri.trim();

  if (
    trimmed.startsWith('file://') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('ph://') ||
    trimmed.startsWith('content://')
  ) {
    return true;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return false;
  }

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  if (!hasScheme && (trimmed.includes('Documents/') || trimmed.includes('saved_videos/'))) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'file:' || parsed.protocol === 'content:' || parsed.protocol === 'ph:';
  } catch {
    return false;
  }
};

export const isExternalUrl = (uri: string): boolean => {
  return uri.startsWith('http://') || uri.startsWith('https://');
};

/**
 * Check if the URI is a base64 video data URI
 */
export { isBase64VideoUri, isBlobUri } from './base64VideoHandler';

export const isKnownCorsBlockingSite = (url: string): boolean => {
  const blockingSites = [
    'imgur.com',
    'giphy.com',
    'gfycat.com',
    'streamable.com',
    'gyazo.com',
  ];
  
  const lowerUrl = url.toLowerCase();
  return blockingSites.some(site => lowerUrl.includes(site));
};

export const prepareVideoForSimulation = (video: SavedVideo): VideoServingConfig => {
  const uri = video.uri;
  const mimeType = getVideoMimeType(uri);
  
  // Handle base64 data URIs
  if (isBase64VideoUri(uri)) {
    console.log('[VideoServing] Base64 video ready for simulation:', video.name);
    return {
      uri,
      isLocal: true,
      isBase64: true,
      mimeType,
      requiresDownload: false,
    };
  }
  
  // Handle blob URLs
  if (isBlobUri(uri)) {
    console.log('[VideoServing] Blob video ready for simulation:', video.name);
    return {
      uri,
      isLocal: true,
      isBlob: true,
      mimeType,
      requiresDownload: false,
    };
  }
  
  const isLocal = isLocalFileUri(uri);
  
  if (isLocal) {
    console.log('[VideoServing] Local video ready for simulation:', video.name);
    return {
      uri,
      isLocal: true,
      mimeType,
      requiresDownload: false,
    };
  }
  
  if (video.sourceUrl && isKnownCorsBlockingSite(video.sourceUrl)) {
    console.log('[VideoServing] Known CORS blocking site detected:', video.sourceUrl);
    return {
      uri,
      isLocal: false,
      mimeType,
      requiresDownload: true,
      warningMessage: 'This video source may be blocked by CORS. Download it locally for reliable playback.',
    };
  }
  
  return {
    uri,
    isLocal: false,
    mimeType,
    requiresDownload: !isLocal,
  };
};

export const prepareUriForSimulation = (uri: string): VideoServingConfig => {
  const mimeType = getVideoMimeType(uri);
  
  // Handle base64 data URIs
  if (isBase64VideoUri(uri)) {
    return {
      uri,
      isLocal: true,
      isBase64: true,
      mimeType,
      requiresDownload: false,
    };
  }
  
  // Handle blob URLs
  if (isBlobUri(uri)) {
    return {
      uri,
      isLocal: true,
      isBlob: true,
      mimeType,
      requiresDownload: false,
    };
  }
  
  const isLocal = isLocalFileUri(uri);
  
  if (isLocal) {
    return {
      uri,
      isLocal: true,
      mimeType,
      requiresDownload: false,
    };
  }
  
  if (isKnownCorsBlockingSite(uri)) {
    return {
      uri,
      isLocal: false,
      mimeType,
      requiresDownload: true,
      warningMessage: 'External URLs from this site are often blocked. Download the video locally for reliable playback.',
    };
  }
  
  return {
    uri,
    isLocal: false,
    mimeType,
    requiresDownload: isExternalUrl(uri),
    warningMessage: isExternalUrl(uri) 
      ? 'External video URLs may fail due to CORS. For best results, download the video first.'
      : undefined,
  };
};

export const getVideoServingInstructions = (): string[] => {
  if (Platform.OS === 'web') {
    return [
      'On web, videos must be from CORS-enabled sources',
      'Use direct video URLs (.mp4, .mov) from permissive hosts',
      'YouTube, TikTok, and social media URLs are not supported',
    ];
  }
  
  return [
    'For best results, download videos to your device first',
    'Local videos play more reliably than external URLs',
    'Use Photos or Files app to upload videos',
    'Downloaded videos are stored permanently until deleted',
  ];
};

export const validateVideoForWebView = (uri: string): { valid: boolean; message?: string } => {
  if (!uri || uri.trim().length === 0) {
    return { valid: false, message: 'No video URL provided' };
  }
  
  if (uri.startsWith('canvas:')) {
    return { valid: true };
  }
  
  // Base64 data URIs are valid
  if (isBase64VideoUri(uri)) {
    return { valid: true };
  }
  
  // Blob URLs are valid
  if (isBlobUri(uri)) {
    return { valid: true };
  }
  
  const isLocal = isLocalFileUri(uri);
  if (isLocal) {
    return { valid: true };
  }
  
  if (isExternalUrl(uri)) {
    if (isKnownCorsBlockingSite(uri)) {
      return {
        valid: false,
        message: 'This video host often blocks playback in apps. Please download the video to your device first.',
      };
    }
    
    const videoExtensions = ['.mp4', '.mov', '.webm', '.m4v', '.avi', '.mkv', '.3gp'];
    const hasVideoExtension = videoExtensions.some(ext => 
      uri.toLowerCase().includes(ext)
    );
    
    if (!hasVideoExtension) {
      return {
        valid: true,
        message: 'URL may not point to a video file. Ensure it ends with .mp4, .mov, etc.',
      };
    }
    
    return { valid: true };
  }
  
  return { valid: false, message: 'Invalid video URL format' };
};

export const formatVideoUriForWebView = (uri: string): string => {
  if (Platform.OS === 'web') {
    return uri;
  }
  
  // Base64 data URIs should be passed through as-is
  if (isBase64VideoUri(uri)) {
    return uri;
  }
  
  // Blob URLs should be passed through as-is
  if (isBlobUri(uri)) {
    return uri;
  }
  
  if (uri.startsWith('file://')) {
    return uri;
  }
  
  if (uri.startsWith('/')) {
    return `file://${uri}`;
  }
  
  return uri;
};

export const getRecommendedAction = (uri: string): 'use_directly' | 'download_first' | 'upload_local' => {
  // Base64 and blob URIs can be used directly
  if (isBase64VideoUri(uri) || isBlobUri(uri)) {
    return 'use_directly';
  }
  
  if (isLocalFileUri(uri)) {
    return 'use_directly';
  }
  
  if (isKnownCorsBlockingSite(uri)) {
    return 'download_first';
  }
  
  if (isExternalUrl(uri)) {
    return 'download_first';
  }
  
  return 'upload_local';
};

// ============ OPTIMIZATION UTILITIES ============

/**
 * Estimate video load time based on URI type and size hints
 */
export const estimateLoadTime = (uri: string, fileSizeBytes?: number): 'fast' | 'medium' | 'slow' => {
  // Local and base64 are fast
  if (isLocalFileUri(uri) || isBase64VideoUri(uri) || isBlobUri(uri)) {
    if (fileSizeBytes && fileSizeBytes > VIDEO_SERVING_CONSTANTS.MEDIUM_LOAD_THRESHOLD) {
      return 'medium';
    }
    return 'fast';
  }
  
  // External URLs are slower
  if (isExternalUrl(uri)) {
    if (isKnownCorsBlockingSite(uri)) {
      return 'slow';
    }
    return 'medium';
  }
  
  return 'medium';
};

/**
 * Determine if video should be cached
 */
export const shouldCache = (uri: string): boolean => {
  // Don't cache blob URLs (they have their own lifecycle)
  if (isBlobUri(uri)) {
    return false;
  }
  
  // Cache base64 if not too large
  if (isBase64VideoUri(uri)) {
    return uri.length < VIDEO_SERVING_CONSTANTS.MEDIUM_LOAD_THRESHOLD;
  }
  
  // Cache local files
  if (isLocalFileUri(uri)) {
    return true;
  }
  
  // Cache external URLs that we've verified work
  return true;
};

/**
 * Get priority for loading a video
 */
export const getLoadPriority = (uri: string, isActive: boolean = false): 'high' | 'normal' | 'low' => {
  if (isActive) {
    return 'high';
  }
  
  if (isLocalFileUri(uri) || isBlobUri(uri)) {
    return VIDEO_SERVING_CONSTANTS.LOCAL_CACHE_PRIORITY;
  }
  
  return VIDEO_SERVING_CONSTANTS.EXTERNAL_CACHE_PRIORITY;
};

/**
 * Detect compression level from format
 */
export const detectCompressionLevel = (uri: string): 'none' | 'light' | 'heavy' => {
  const extension = uri.split('.').pop()?.toLowerCase()?.split('?')[0] || '';
  
  if (VIDEO_SERVING_CONSTANTS.COMPRESSED_FORMATS.includes(extension)) {
    return 'heavy';
  }
  
  if (VIDEO_SERVING_CONSTANTS.UNCOMPRESSED_FORMATS.includes(extension)) {
    return 'none';
  }
  
  return 'light';
};

/**
 * Enhanced video preparation with full optimization metadata
 */
export const prepareVideoForSimulationOptimized = (
  video: SavedVideo,
  isActive: boolean = false
): VideoServingConfig => {
  const baseConfig = prepareVideoForSimulation(video);
  
  return {
    ...baseConfig,
    estimatedLoadTime: estimateLoadTime(video.uri, video.fileSize),
    cacheable: shouldCache(video.uri),
    priority: getLoadPriority(video.uri, isActive),
    compressionLevel: detectCompressionLevel(video.uri),
  };
};

/**
 * Batch prepare multiple videos with optimization
 */
export const batchPrepareVideos = (
  videos: SavedVideo[],
  activeVideoId?: string
): VideoServingConfig[] => {
  return videos.map(video => 
    prepareVideoForSimulationOptimized(video, video.id === activeVideoId)
  );
};

/**
 * Get optimal video loading order based on priority and load time
 */
export const getOptimalLoadingOrder = (configs: VideoServingConfig[]): VideoServingConfig[] => {
  const priorityOrder = { high: 0, normal: 1, low: 2 };
  const loadTimeOrder = { fast: 0, medium: 1, slow: 2 };
  
  return [...configs].sort((a, b) => {
    // First sort by priority
    const priorityDiff = priorityOrder[a.priority || 'normal'] - priorityOrder[b.priority || 'normal'];
    if (priorityDiff !== 0) return priorityDiff;
    
    // Then by estimated load time
    return loadTimeOrder[a.estimatedLoadTime || 'medium'] - loadTimeOrder[b.estimatedLoadTime || 'medium'];
  });
};

/**
 * Check if a video URI is ready for immediate use
 */
export const isReadyForImmediateUse = (uri: string): boolean => {
  // Base64, blob, and local files are immediately ready
  return isBase64VideoUri(uri) || isBlobUri(uri) || isLocalFileUri(uri);
};

/**
 * Get video serving strategy recommendation
 */
export const getServingStrategy = (uri: string): {
  strategy: 'direct' | 'stream' | 'preload' | 'download';
  reason: string;
} => {
  if (isBase64VideoUri(uri)) {
    return {
      strategy: 'direct',
      reason: 'Base64 data is embedded and ready for immediate use'
    };
  }
  
  if (isBlobUri(uri)) {
    return {
      strategy: 'direct',
      reason: 'Blob URL points to already-loaded data'
    };
  }
  
  if (isLocalFileUri(uri)) {
    return {
      strategy: 'preload',
      reason: 'Local file should be preloaded for best performance'
    };
  }
  
  if (isKnownCorsBlockingSite(uri)) {
    return {
      strategy: 'download',
      reason: 'Source site blocks streaming, download required'
    };
  }
  
  if (isExternalUrl(uri)) {
    return {
      strategy: 'stream',
      reason: 'External URL will be streamed with potential CORS issues'
    };
  }
  
  return {
    strategy: 'download',
    reason: 'Unknown source type, download recommended'
  };
};
