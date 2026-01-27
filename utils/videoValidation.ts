import { Platform } from 'react-native';
import {
  isBase64VideoUri,
  isBlobUri,
  validateBase64Video,
  getMimeTypeFromDataUri,
  getFormatFromMimeType,
} from './base64VideoHandler';

export interface VideoValidationConfig {
  maxDurationSeconds: number;
  maxFileSizeMB: number;
  allowedFormats: string[];
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  requirePortrait: boolean;
  targetAspectRatio: '9:16' | '16:9' | '4:3' | '1:1' | 'any';
  aspectRatioTolerance: number;
}

export interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
  fileSize: number;
  format: string;
  codec?: string;
  fps?: number;
  bitrate?: number;
  isPortrait?: boolean;
  aspectRatio?: string;
  isBase64?: boolean;
}

export interface VideoValidationResult {
  isValid: boolean;
  errors: VideoValidationError[];
  warnings: string[];
  metadata: VideoMetadata | null;
}

export interface VideoValidationError {
  code: VideoErrorCode;
  message: string;
  details?: string;
  currentValue?: string | number;
  requiredValue?: string | number;
}

export type VideoErrorCode = 
  | 'INVALID_FORMAT'
  | 'DURATION_TOO_LONG'
  | 'FILE_TOO_LARGE'
  | 'RESOLUTION_TOO_LOW'
  | 'RESOLUTION_TOO_HIGH'
  | 'FETCH_FAILED'
  | 'METADATA_UNAVAILABLE'
  | 'INVALID_URL'
  | 'UNSUPPORTED_CODEC'
  | 'NETWORK_ERROR'
  | 'WRONG_ORIENTATION'
  | 'WRONG_ASPECT_RATIO'
  | 'INVALID_BASE64';

export const DEFAULT_VALIDATION_CONFIG: VideoValidationConfig = {
  maxDurationSeconds: 120,
  maxFileSizeMB: 50,
  allowedFormats: ['mp4', 'webm', 'mov', 'avi', 'm4v', 'quicktime'],
  minWidth: 320,
  minHeight: 240,
  maxWidth: 4096,
  maxHeight: 4096,
  requirePortrait: true,
  targetAspectRatio: '9:16',
  aspectRatioTolerance: 0.05,
};

export const PORTRAIT_VALIDATION_CONFIG: VideoValidationConfig = {
  ...DEFAULT_VALIDATION_CONFIG,
  minWidth: 480,
  minHeight: 854,
  requirePortrait: true,
  targetAspectRatio: '9:16',
  aspectRatioTolerance: 0.05,
};

export const IPHONE_FRONT_CAMERA_CONFIG: VideoValidationConfig = {
  ...DEFAULT_VALIDATION_CONFIG,
  minWidth: 720,
  minHeight: 1280,
  maxWidth: 2160,
  maxHeight: 3840,
  requirePortrait: true,
  targetAspectRatio: '9:16',
  aspectRatioTolerance: 0.05,
};

export interface VideoLoadingError {
  type: 'network' | 'cors' | 'format' | 'decode' | 'timeout' | 'unknown';
  message: string;
  solution: string;
  retryable: boolean;
}

export const VIDEO_ERROR_SOLUTIONS: Record<string, VideoLoadingError> = {
  MEDIA_ERR_ABORTED: {
    type: 'unknown',
    message: 'Video loading was aborted',
    solution: 'Try reloading the video or use a different source',
    retryable: true,
  },
  MEDIA_ERR_NETWORK: {
    type: 'network',
    message: 'Network error while loading video',
    solution: 'Check your internet connection. The video server may be slow or unavailable.',
    retryable: true,
  },
  MEDIA_ERR_DECODE: {
    type: 'decode',
    message: 'Video format not supported or file is corrupted',
    solution: 'Use MP4 (H.264) or WebM (VP8/VP9) format. The video may need to be re-encoded.',
    retryable: false,
  },
  MEDIA_ERR_SRC_NOT_SUPPORTED: {
    type: 'format',
    message: 'Video source not supported',
    solution: 'Ensure the URL points directly to a video file (.mp4, .webm), not a webpage or streaming service.',
    retryable: false,
  },
  CORS_BLOCKED: {
    type: 'cors',
    message: 'Video blocked by CORS policy',
    solution: 'The video server does not allow cross-origin requests. Use a CORS-enabled host like Catbox or direct video URLs.',
    retryable: true,
  },
  TIMEOUT: {
    type: 'timeout',
    message: 'Video loading timed out',
    solution: 'The video may be too large or the server is slow. Try a smaller file (under 20MB) or faster host.',
    retryable: true,
  },
};

export function getVideoErrorSolution(errorCode?: number, context?: string): VideoLoadingError {
  if (context === 'cors') return VIDEO_ERROR_SOLUTIONS.CORS_BLOCKED;
  if (context === 'timeout') return VIDEO_ERROR_SOLUTIONS.TIMEOUT;
  
  switch (errorCode) {
    case 1: return VIDEO_ERROR_SOLUTIONS.MEDIA_ERR_ABORTED;
    case 2: return VIDEO_ERROR_SOLUTIONS.MEDIA_ERR_NETWORK;
    case 3: return VIDEO_ERROR_SOLUTIONS.MEDIA_ERR_DECODE;
    case 4: return VIDEO_ERROR_SOLUTIONS.MEDIA_ERR_SRC_NOT_SUPPORTED;
    default: return {
      type: 'unknown',
      message: 'Unknown error occurred',
      solution: 'Try a different video source. Recommended: Use .webm or .mp4 files from catbox.moe or similar hosts.',
      retryable: true,
    };
  }
}



/**
 * Check if a URL is a valid video URL (supports http(s), data URIs, and blob URLs)
 */
export function isValidVideoUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  
  const trimmedUrl = url.trim();
  
  // Base64 data URIs are valid
  if (isBase64VideoUri(trimmedUrl)) {
    return true;
  }
  
  // Blob URLs are valid
  if (isBlobUri(trimmedUrl)) {
    return true;
  }
  
  // Standard HTTP(S) URLs
  try {
    const parsed = new URL(trimmedUrl);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function getVideoFormatFromUrl(url: string): string | null {
  // Handle base64 data URIs
  if (isBase64VideoUri(url)) {
    const mimeType = getMimeTypeFromDataUri(url);
    return getFormatFromMimeType(mimeType);
  }
  
  // Handle blob URLs (assume mp4 as default)
  if (isBlobUri(url)) {
    return 'mp4';
  }
  
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    const extension = pathname.split('.').pop();
    
    if (extension && DEFAULT_VALIDATION_CONFIG.allowedFormats.includes(extension)) {
      return extension;
    }
    
    return null;
  } catch {
    return null;
  }
}

export function getVideoFormatFromMime(mimeType: string): string | null {
  const mimeMap: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'video/x-m4v': 'm4v',
    'video/avi': 'avi',
    'video/x-msvideo': 'avi',
    'video/mov': 'mov',
  };
  
  return mimeMap[mimeType.toLowerCase()] || null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDurationForDisplay(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function isPortraitVideo(width: number, height: number): boolean {
  return height > width;
}

export function calculateAspectRatio(width: number, height: number): number {
  return width / height;
}

export function getAspectRatioString(width: number, height: number): string {
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const divisor = gcd(width, height);
  const ratioW = width / divisor;
  const ratioH = height / divisor;
  
  const ratio = width / height;
  // Use consistent 0.05 tolerance across all video utilities
  if (Math.abs(ratio - 9/16) < 0.05) return '9:16';   // 9/16 = 0.5625
  if (Math.abs(ratio - 16/9) < 0.05) return '16:9';   // 16/9 = 1.7778
  if (Math.abs(ratio - 3/4) < 0.05) return '3:4';     // 3/4 = 0.75
  if (Math.abs(ratio - 4/3) < 0.05) return '4:3';     // 4/3 = 1.3333
  if (Math.abs(ratio - 1) < 0.05) return '1:1';       // 1/1 = 1.0
  
  return `${ratioW}:${ratioH}`;
}

export function isValidAspectRatio(
  width: number, 
  height: number, 
  targetRatio: '9:16' | '16:9' | '4:3' | '1:1' | 'any',
  tolerance: number = 0.08
): boolean {
  if (targetRatio === 'any') return true;
  
  const ratio = width / height;
  let targetValue: number;
  
  switch (targetRatio) {
    case '9:16':
      targetValue = 9 / 16;
      break;
    case '16:9':
      targetValue = 16 / 9;
      break;
    case '4:3':
      targetValue = 4 / 3;
      break;
    case '1:1':
      targetValue = 1;
      break;
    default:
      return true;
  }
  
  return Math.abs(ratio - targetValue) <= tolerance;
}

export function validatePortraitRequirement(
  width: number,
  height: number,
  config: VideoValidationConfig
): VideoValidationError | null {
  if (!config.requirePortrait) return null;
  
  if (!isPortraitVideo(width, height)) {
    return {
      code: 'WRONG_ORIENTATION',
      message: `Video must be in portrait orientation (9:16)`,
      details: `Your video is ${width}x${height} (landscape). Required: portrait orientation like 1080x1920`,
      currentValue: `${width}x${height} (landscape)`,
      requiredValue: 'Portrait (e.g., 1080x1920)',
    };
  }
  
  if (config.targetAspectRatio !== 'any') {
    if (!isValidAspectRatio(width, height, config.targetAspectRatio, config.aspectRatioTolerance)) {
      const currentRatio = getAspectRatioString(width, height);
      return {
        code: 'WRONG_ASPECT_RATIO',
        message: `Video aspect ratio must be ${config.targetAspectRatio}`,
        details: `Your video is ${currentRatio} (${width}x${height}). Required: ${config.targetAspectRatio} portrait ratio`,
        currentValue: currentRatio,
        requiredValue: config.targetAspectRatio,
      };
    }
  }
  
  return null;
}

export async function fetchVideoHeaders(url: string): Promise<{
  contentLength: number | null;
  contentType: string | null;
  corsBlocked: boolean;
}> {
  console.log('[VideoValidation] Fetching headers for:', url);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, { 
      method: 'HEAD',
      signal: controller.signal,
      mode: 'cors',
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn('[VideoValidation] HEAD request failed, status:', response.status);
      return { contentLength: null, contentType: null, corsBlocked: false };
    }
    
    const contentLength = response.headers.get('content-length');
    const contentType = response.headers.get('content-type');
    
    console.log('[VideoValidation] Headers received:', { contentLength, contentType });
    
    return {
      contentLength: contentLength ? parseInt(contentLength, 10) : null,
      contentType,
      corsBlocked: false,
    };
  } catch (error: any) {
    const isCorsError = error?.message?.includes('CORS') || 
                        error?.message?.includes('NetworkError') ||
                        error?.message?.includes('Failed to fetch') ||
                        error?.name === 'AbortError' ||
                        error?.name === 'TypeError';
    
    console.warn('[VideoValidation] Failed to fetch headers (CORS likely):', error?.message || error);
    return { contentLength: null, contentType: null, corsBlocked: isCorsError };
  }
}

export function extractVideoExtension(url: string): string | null {
  // Handle base64 data URIs
  if (isBase64VideoUri(url)) {
    const mimeType = getMimeTypeFromDataUri(url);
    return getFormatFromMimeType(mimeType);
  }
  
  // Handle blob URLs
  if (isBlobUri(url)) {
    return 'mp4'; // Default for blob URLs
  }
  
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    const parts = pathname.split('/');
    const filename = parts[parts.length - 1] || '';
    
    if (filename.includes('.')) {
      const ext = filename.split('.').pop()?.toLowerCase();
      if (ext && DEFAULT_VALIDATION_CONFIG.allowedFormats.includes(ext)) {
        return ext;
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

export async function validateVideoUrl(
  url: string,
  config: VideoValidationConfig = DEFAULT_VALIDATION_CONFIG
): Promise<VideoValidationResult> {
  console.log('[VideoValidation] Starting URL validation for:', url?.substring(0, 100));
  
  const warnings: string[] = [];
  
  if (!url || typeof url !== 'string') {
    return { 
      isValid: false, 
      errors: [{
        code: 'INVALID_URL',
        message: 'Video URL is required',
        details: 'Please provide a valid video URL',
      }], 
      warnings, 
      metadata: null 
    };
  }
  
  const trimmedUrl = url.trim();
  
  if (trimmedUrl.startsWith('canvas:')) {
    console.log('[VideoValidation] Canvas pattern URL - always valid');
    return { 
      isValid: true, 
      errors: [], 
      warnings: ['Canvas test pattern selected'], 
      metadata: { width: 1080, height: 1920, duration: 0, fileSize: 0, format: 'canvas' }
    };
  }
  
  // Handle base64 data URIs
  if (isBase64VideoUri(trimmedUrl)) {
    console.log('[VideoValidation] Base64 video data URI detected');
    const base64Validation = validateBase64Video(trimmedUrl);
    
    if (!base64Validation.isValid) {
      return {
        isValid: false,
        errors: [{
          code: 'INVALID_BASE64',
          message: 'Invalid base64 video data',
          details: base64Validation.error || 'The base64 video data is malformed or corrupted',
        }],
        warnings,
        metadata: null,
      };
    }
    
    const format = getFormatFromMimeType(base64Validation.mimeType);
    const fileSizeMB = base64Validation.estimatedSizeBytes / (1024 * 1024);
    
    if (fileSizeMB > config.maxFileSizeMB) {
      warnings.push(`Large video detected (${fileSizeMB.toFixed(1)}MB). Processing may take longer.`);
    }
    
    if (base64Validation.isLargeFile) {
      warnings.push('Very large base64 video. Consider using a file URL for better performance.');
    }
    
    return {
      isValid: true,
      errors: [],
      warnings: [`Base64 video format: ${format.toUpperCase()}`, ...warnings],
      metadata: {
        width: 0,
        height: 0,
        duration: 0,
        fileSize: base64Validation.estimatedSizeBytes,
        format,
        isBase64: true,
      },
    };
  }
  
  // Handle blob URLs
  if (isBlobUri(trimmedUrl)) {
    console.log('[VideoValidation] Blob URL detected - valid');
    return {
      isValid: true,
      errors: [],
      warnings: ['Blob URL video'],
      metadata: {
        width: 0,
        height: 0,
        duration: 0,
        fileSize: 0,
        format: 'mp4',
      },
    };
  }
  
  if (!isValidVideoUrl(trimmedUrl)) {
    return { 
      isValid: false, 
      errors: [{
        code: 'INVALID_URL',
        message: 'Invalid video URL format',
        details: 'URL must start with http://, https://, data:video/, or blob:',
        currentValue: trimmedUrl.substring(0, 50),
      }], 
      warnings, 
      metadata: null 
    };
  }
  
  const formatFromUrl = extractVideoExtension(trimmedUrl);
  
  if (formatFromUrl) {
    console.log('[VideoValidation] Valid video extension detected:', formatFromUrl);
    return { 
      isValid: true, 
      errors: [], 
      warnings: [`Video format: ${formatFromUrl.toUpperCase()}`], 
      metadata: {
        width: 0,
        height: 0,
        duration: 0,
        fileSize: 0,
        format: formatFromUrl,
      }
    };
  }
  
  console.log('[VideoValidation] No extension detected, accepting URL optimistically');
  warnings.push('Format will be verified during playback');
  return { isValid: true, errors: [], warnings, metadata: null };
}

export interface LocalVideoMetadata {
  uri: string;
  width?: number;
  height?: number;
  duration?: number;
  fileSize?: number;
  type?: string;
  fileName?: string;
}

export async function validateLocalVideo(
  videoInfo: LocalVideoMetadata,
  config: VideoValidationConfig = DEFAULT_VALIDATION_CONFIG
): Promise<VideoValidationResult> {
  console.log('[VideoValidation] Starting local video validation:', videoInfo);
  console.log('[VideoValidation] Portrait requirement:', config.requirePortrait, 'Target ratio:', config.targetAspectRatio);
  
  const errors: VideoValidationError[] = [];
  const warnings: string[] = [];
  
  const uri = videoInfo.uri || '';
  const fileName = videoInfo.fileName || uri.split('/').pop() || 'video';
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  
  if (!config.allowedFormats.includes(extension)) {
    errors.push({
      code: 'INVALID_FORMAT',
      message: `Unsupported video format: .${extension}`,
      details: `Supported formats: ${config.allowedFormats.join(', ')}`,
      currentValue: extension,
      requiredValue: config.allowedFormats.join(', '),
    });
  }
  
  if (videoInfo.fileSize !== undefined) {
    const fileSizeMB = videoInfo.fileSize / (1024 * 1024);
    
    if (fileSizeMB > config.maxFileSizeMB) {
      errors.push({
        code: 'FILE_TOO_LARGE',
        message: `Video file is too large (${formatFileSize(videoInfo.fileSize)})`,
        details: `Maximum allowed size is ${config.maxFileSizeMB}MB. Please compress or trim the video.`,
        currentValue: formatFileSize(videoInfo.fileSize),
        requiredValue: `${config.maxFileSizeMB}MB`,
      });
    }
  } else {
    warnings.push('Could not determine file size. Size validation skipped.');
  }
  
  if (videoInfo.duration !== undefined) {
    const durationSeconds = videoInfo.duration / 1000;
    
    if (durationSeconds > config.maxDurationSeconds) {
      errors.push({
        code: 'DURATION_TOO_LONG',
        message: `Video is too long (${formatDurationForDisplay(durationSeconds)})`,
        details: `Maximum allowed duration is ${config.maxDurationSeconds} seconds. Please trim the video.`,
        currentValue: formatDurationForDisplay(durationSeconds),
        requiredValue: `${config.maxDurationSeconds}s`,
      });
    }
  } else {
    warnings.push('Could not determine video duration. Duration will be validated during playback.');
  }
  
  if (videoInfo.width !== undefined && videoInfo.height !== undefined) {
    const portraitError = validatePortraitRequirement(videoInfo.width, videoInfo.height, config);
    if (portraitError) {
      errors.push(portraitError);
    }
    
    const effectiveMinWidth = config.requirePortrait ? Math.min(config.minWidth, config.minHeight) : config.minWidth;
    const effectiveMinHeight = config.requirePortrait ? Math.max(config.minWidth, config.minHeight) : config.minHeight;
    
    if (videoInfo.width < effectiveMinWidth || videoInfo.height < effectiveMinHeight) {
      errors.push({
        code: 'RESOLUTION_TOO_LOW',
        message: `Video resolution is too low (${videoInfo.width}x${videoInfo.height})`,
        details: `Minimum resolution is ${effectiveMinWidth}x${effectiveMinHeight} for portrait video`,
        currentValue: `${videoInfo.width}x${videoInfo.height}`,
        requiredValue: `${effectiveMinWidth}x${effectiveMinHeight}`,
      });
    }
    
    if (videoInfo.width > config.maxWidth || videoInfo.height > config.maxHeight) {
      warnings.push(`Video resolution (${videoInfo.width}x${videoInfo.height}) exceeds recommended maximum. May affect performance.`);
    }
  }
  
  const isPortrait = videoInfo.width && videoInfo.height ? isPortraitVideo(videoInfo.width, videoInfo.height) : undefined;
  const aspectRatioStr = videoInfo.width && videoInfo.height ? getAspectRatioString(videoInfo.width, videoInfo.height) : undefined;
  
  const metadata: VideoMetadata = {
    width: videoInfo.width || 0,
    height: videoInfo.height || 0,
    duration: videoInfo.duration ? videoInfo.duration / 1000 : 0,
    fileSize: videoInfo.fileSize || 0,
    format: extension,
    isPortrait,
    aspectRatio: aspectRatioStr,
  };
  
  const isValid = errors.length === 0;
  
  console.log('[VideoValidation] Local video validation complete:', { isValid, errorsCount: errors.length, isPortrait, aspectRatio: aspectRatioStr });
  
  return { isValid, errors, warnings, metadata };
}

export async function validateVideoWithPlayback(
  uri: string,
  config: VideoValidationConfig = DEFAULT_VALIDATION_CONFIG
): Promise<VideoValidationResult> {
  console.log('[VideoValidation] Starting playback validation for:', uri);
  console.log('[VideoValidation] Requiring portrait:', config.requirePortrait);
  
  const errors: VideoValidationError[] = [];
  const warnings: string[] = [];
  let metadata: VideoMetadata | null = null;
  
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      
      const timeout = setTimeout(() => {
        video.src = '';
        errors.push({
          code: 'FETCH_FAILED',
          message: 'Video loading timed out',
          details: 'The video took too long to load metadata. Please try a different video.',
        });
        resolve({ isValid: false, errors, warnings, metadata: null });
      }, 15000);
      
      video.onloadedmetadata = () => {
        clearTimeout(timeout);
        
        const duration = video.duration;
        const width = video.videoWidth;
        const height = video.videoHeight;
        
        console.log('[VideoValidation] Web metadata loaded:', { duration, width, height });
        
        if (duration > config.maxDurationSeconds) {
          errors.push({
            code: 'DURATION_TOO_LONG',
            message: `Video is too long (${formatDurationForDisplay(duration)})`,
            details: `Maximum allowed duration is ${config.maxDurationSeconds} seconds`,
            currentValue: formatDurationForDisplay(duration),
            requiredValue: `${config.maxDurationSeconds}s`,
          });
        }
        
        const portraitError = validatePortraitRequirement(width, height, config);
        if (portraitError) {
          errors.push(portraitError);
        }
        
        const effectiveMinWidth = config.requirePortrait ? Math.min(config.minWidth, config.minHeight) : config.minWidth;
        const effectiveMinHeight = config.requirePortrait ? Math.max(config.minWidth, config.minHeight) : config.minHeight;
        
        if (width < effectiveMinWidth || height < effectiveMinHeight) {
          errors.push({
            code: 'RESOLUTION_TOO_LOW',
            message: `Video resolution is too low (${width}x${height})`,
            details: `Minimum resolution is ${effectiveMinWidth}x${effectiveMinHeight}`,
            currentValue: `${width}x${height}`,
            requiredValue: `${effectiveMinWidth}x${effectiveMinHeight}`,
          });
        }
        
        const isPortrait = isPortraitVideo(width, height);
        const aspectRatioStr = getAspectRatioString(width, height);
        
        metadata = {
          width,
          height,
          duration,
          fileSize: 0,
          format: uri.split('.').pop() || 'unknown',
          isPortrait,
          aspectRatio: aspectRatioStr,
        };
        
        video.src = '';
        resolve({ isValid: errors.length === 0, errors, warnings, metadata });
      };
      
      video.onerror = () => {
        clearTimeout(timeout);
        errors.push({
          code: 'FETCH_FAILED',
          message: 'Failed to load video',
          details: 'The video could not be loaded. Please check the URL or try a different video.',
        });
        resolve({ isValid: false, errors, warnings, metadata: null });
      };
      
      video.src = uri;
    });
  }
  
  warnings.push('Full playback validation requires video to be loaded. Metadata will be verified during assignment.');
  
  return { isValid: true, errors, warnings, metadata };
}

export function formatValidationErrors(errors: VideoValidationError[]): string {
  if (errors.length === 0) return '';
  
  return errors.map(err => {
    let message = `• ${err.message}`;
    if (err.currentValue && err.requiredValue) {
      message += ` (got: ${err.currentValue}, required: ${err.requiredValue})`;
    }
    return message;
  }).join('\n');
}

export function getErrorSummary(errors: VideoValidationError[]): string {
  if (errors.length === 0) return 'Video is compatible';
  if (errors.length === 1) return errors[0].message;
  return `${errors.length} compatibility issues found`;
}

export function isResolutionCompatible(
  videoWidth: number,
  videoHeight: number,
  targetWidth: number,
  targetHeight: number,
  tolerance: number = 0.2
): boolean {
  const videoAspect = videoWidth / videoHeight;
  const targetAspect = targetWidth / targetHeight;
  const aspectDiff = Math.abs(videoAspect - targetAspect) / targetAspect;
  
  if (aspectDiff > tolerance) {
    return false;
  }
  
  const videoPixels = videoWidth * videoHeight;
  const targetPixels = targetWidth * targetHeight;
  const pixelRatio = videoPixels / targetPixels;
  
  return pixelRatio >= (1 - tolerance) && pixelRatio <= (1 + tolerance * 2);
}

export function isPortraitResolutionCompatible(
  videoWidth: number,
  videoHeight: number,
  targetWidth: number = 1080,
  targetHeight: number = 1920
): boolean {
  if (!isPortraitVideo(videoWidth, videoHeight)) {
    return false;
  }
  
  if (!isValidAspectRatio(videoWidth, videoHeight, '9:16', 0.05)) {
    return false;
  }
  
  return videoWidth >= targetWidth * 0.5 && videoHeight >= targetHeight * 0.5;
}

export function suggestResolution(
  videoWidth: number,
  videoHeight: number,
  availableResolutions: { width: number; height: number; label: string }[]
): { width: number; height: number; label: string } | null {
  if (availableResolutions.length === 0) return null;
  
  const videoPixels = videoWidth * videoHeight;
  
  let bestMatch = availableResolutions[0];
  let bestDiff = Infinity;
  
  for (const res of availableResolutions) {
    const resPixels = res.width * res.height;
    const diff = Math.abs(resPixels - videoPixels);
    
    if (diff < bestDiff) {
      bestDiff = diff;
      bestMatch = res;
    }
  }
  
  return bestMatch;
}

export function getPortraitValidationSummary(width: number, height: number): string {
  const isPortrait = isPortraitVideo(width, height);
  const aspectRatio = getAspectRatioString(width, height);
  const is916 = isValidAspectRatio(width, height, '9:16', 0.08);
  
  if (isPortrait && is916) {
    return `✓ Valid portrait video (${width}x${height}, ${aspectRatio})`;
  }
  
  if (!isPortrait) {
    return `✗ Landscape video detected (${width}x${height}). Must be portrait 9:16 format.`;
  }
  
  return `✗ Wrong aspect ratio (${aspectRatio}). Must be 9:16 portrait format.`;
}

export const IPHONE_PORTRAIT_SPECS = {
  frontCamera: {
    width: 1080,
    height: 1920,
    aspectRatio: '9:16' as const,
    fps: 30,
    label: 'iPhone Front Camera (1080x1920)',
  },
  frontCameraHD: {
    width: 720,
    height: 1280,
    aspectRatio: '9:16' as const,
    fps: 30,
    label: 'iPhone Front Camera HD (720x1280)',
  },
};

export async function testVideoPlayability(url: string, timeoutMs: number = 10000): Promise<{
  playable: boolean;
  error?: VideoLoadingError;
  metadata?: { width: number; height: number; duration: number };
}> {
  console.log('[VideoValidation] Testing playability for:', url);
  
  if (url.startsWith('canvas:')) {
    return { playable: true, metadata: { width: 1080, height: 1920, duration: 0 } };
  }
  
  if (Platform.OS !== 'web') {
    console.log('[VideoValidation] Non-web platform, skipping playability test');
    return { playable: true };
  }
  
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve({ playable: true });
      return;
    }
    
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    
    let corsAttempt = 0;
    const corsStrategies = ['anonymous', 'use-credentials', null];
    let resolved = false;
    
    const timeout = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      video.src = '';
      video.remove();
      resolve({ playable: false, error: VIDEO_ERROR_SOLUTIONS.TIMEOUT });
    }, timeoutMs);
    
    const tryLoad = () => {
      const corsMode = corsStrategies[corsAttempt];
      if (corsMode !== null) {
        video.crossOrigin = corsMode;
      } else {
        video.removeAttribute('crossOrigin');
      }
      video.src = url;
      video.load();
    };
    
    video.onloadedmetadata = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      
      const metadata = {
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
      };
      
      console.log('[VideoValidation] Video playable:', metadata);
      video.src = '';
      video.remove();
      resolve({ playable: true, metadata });
    };
    
    video.onerror = () => {
      if (resolved) return;
      
      corsAttempt++;
      if (corsAttempt < corsStrategies.length) {
        console.log('[VideoValidation] Retrying with CORS strategy:', corsStrategies[corsAttempt]);
        tryLoad();
        return;
      }
      
      resolved = true;
      clearTimeout(timeout);
      
      const errorSolution = getVideoErrorSolution(video.error?.code);
      console.log('[VideoValidation] Video not playable:', errorSolution.message);
      
      video.src = '';
      video.remove();
      resolve({ playable: false, error: errorSolution });
    };
    
    tryLoad();
  });
}

export function getRecommendedVideoHosts(): string[] {
  return [
    'catbox.moe - Direct file hosting, CORS-friendly',
    'litterbox.catbox.moe - Temporary file hosting',
    'Direct .mp4/.webm URLs from any CORS-enabled CDN',
  ];
}
