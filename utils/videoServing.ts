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
  isBuiltIn: boolean;
  mimeType: string;
  requiresDownload: boolean;
  isBase64?: boolean;
  isBlob?: boolean;
  warningMessage?: string;
}

/**
 * Check if a URI is a built-in test video
 */
export const isBuiltInVideoUri = (uri: string): boolean => {
  return uri.startsWith('builtin:');
};

/**
 * Check if a URI is a canvas-generated pattern
 */
export const isCanvasPatternUri = (uri: string): boolean => {
  return uri.startsWith('canvas:');
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

  // Handle built-in videos - always ready, no download needed
  if (isBuiltInVideoUri(uri)) {
    console.log('[VideoServing] Built-in video ready for simulation:', video.name);
    return {
      uri,
      isLocal: false,
      isBuiltIn: true,
      mimeType: 'video/mp4',
      requiresDownload: false,
    };
  }

  // Handle canvas patterns - always ready, no download needed
  if (isCanvasPatternUri(uri)) {
    console.log('[VideoServing] Canvas pattern ready for simulation:', video.name);
    return {
      uri,
      isLocal: false,
      isBuiltIn: true,
      mimeType: 'video/mp4',
      requiresDownload: false,
    };
  }

  // Handle base64 data URIs
  if (isBase64VideoUri(uri)) {
    console.log('[VideoServing] Base64 video ready for simulation:', video.name);
    return {
      uri,
      isLocal: true,
      isBuiltIn: false,
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
      isBuiltIn: false,
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
      isBuiltIn: false,
      mimeType,
      requiresDownload: false,
    };
  }
  
  if (video.sourceUrl && isKnownCorsBlockingSite(video.sourceUrl)) {
    console.log('[VideoServing] Known CORS blocking site detected:', video.sourceUrl);
    return {
      uri,
      isLocal: false,
      isBuiltIn: false,
      mimeType,
      requiresDownload: true,
      warningMessage: 'This video source may be blocked by CORS. Download it locally for reliable playback.',
    };
  }
  
  return {
    uri,
    isLocal: false,
    isBuiltIn: false,
    mimeType,
    requiresDownload: !isLocal,
  };
};

export const prepareUriForSimulation = (uri: string): VideoServingConfig => {
  // Handle built-in videos
  if (isBuiltInVideoUri(uri)) {
    return {
      uri,
      isLocal: false,
      isBuiltIn: true,
      mimeType: 'video/mp4',
      requiresDownload: false,
    };
  }

  // Handle canvas patterns
  if (isCanvasPatternUri(uri)) {
    return {
      uri,
      isLocal: false,
      isBuiltIn: true,
      mimeType: 'video/mp4',
      requiresDownload: false,
    };
  }

  const mimeType = getVideoMimeType(uri);

  // Handle base64 data URIs
  if (isBase64VideoUri(uri)) {
    return {
      uri,
      isLocal: true,
      isBuiltIn: false,
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
      isBuiltIn: false,
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
      isBuiltIn: false,
      mimeType,
      requiresDownload: false,
    };
  }

  if (isKnownCorsBlockingSite(uri)) {
    return {
      uri,
      isLocal: false,
      isBuiltIn: false,
      mimeType,
      requiresDownload: true,
      warningMessage: 'External URLs from this site are often blocked. Download the video locally for reliable playback.',
    };
  }

  return {
    uri,
    isLocal: false,
    isBuiltIn: false,
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
  
  // Built-in videos are always valid
  if (isBuiltInVideoUri(uri)) {
    return { valid: true, message: 'Built-in test video - always available' };
  }
  
  // Canvas patterns are always valid
  if (isCanvasPatternUri(uri)) {
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
  // Built-in and canvas URIs should be passed through unchanged
  // They are handled directly by the injection script
  if (isBuiltInVideoUri(uri) || isCanvasPatternUri(uri)) {
    return uri;
  }
  
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

/**
 * Get the default fallback video URI (built-in bouncing ball)
 * This is used when no video is assigned or all loading fails
 */
export const getDefaultFallbackVideoUri = (): string => {
  return 'builtin:bouncing_ball';
};

/**
 * Get available built-in video patterns
 */
export const getBuiltInVideoPatterns = (): Array<{ id: string; name: string; uri: string }> => {
  return [
    { id: 'bouncing_ball', name: 'Bouncing Balls', uri: 'builtin:bouncing_ball' },
    { id: 'color_bars', name: 'SMPTE Color Bars', uri: 'builtin:color_bars' },
    { id: 'gradient_wave', name: 'Gradient Wave', uri: 'builtin:gradient_wave' },
  ];
};

export const getRecommendedAction = (uri: string): 'use_directly' | 'download_first' | 'upload_local' | 'use_builtin' => {
  // Built-in videos can always be used directly
  if (isBuiltInVideoUri(uri) || isCanvasPatternUri(uri)) {
    return 'use_directly';
  }

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

/**
 * Check if a video is guaranteed to work (built-in or local)
 */
export const isVideoGuaranteedToWork = (uri: string): boolean => {
  return isBuiltInVideoUri(uri) || isCanvasPatternUri(uri) || isLocalFileUri(uri);
};
