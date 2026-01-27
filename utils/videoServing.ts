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
}

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
  return (
    uri.startsWith('file://') ||
    uri.startsWith('/') ||
    uri.startsWith('ph://') ||
    uri.startsWith('content://') ||
    uri.includes('Documents/') ||
    uri.includes('saved_videos/')
  );
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
