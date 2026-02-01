/**
 * Base64 Video Handler
 * 
 * Provides utilities for handling base64-encoded MP4 videos of any length.
 * Implements chunked processing to avoid memory issues with large videos.
 */

import { Platform } from 'react-native';

// Constants for base64 video handling
export const BASE64_VIDEO_CONSTANTS = {
  // Maximum chunk size for processing large base64 strings (in characters)
  CHUNK_SIZE: 65536, // 64KB chunks
  // Timeout for processing operations (in ms)
  PROCESSING_TIMEOUT: 60000,
  // Minimum valid base64 video size
  MIN_BASE64_LENGTH: 100,
  // Maximum recommended base64 size (in characters) - approximately 50MB video
  MAX_RECOMMENDED_SIZE: 70_000_000,
  // Data URI prefix patterns for video
  VIDEO_DATA_URI_PATTERNS: [
    'data:video/mp4;base64,',
    'data:video/webm;base64,',
    'data:video/quicktime;base64,',
    'data:video/x-m4v;base64,',
    'data:video/avi;base64,',
    'data:video/x-msvideo;base64,',
    'data:video/mov;base64,',
    'data:video/3gpp;base64,',
    'data:application/octet-stream;base64,',
  ],
};

export interface Base64VideoInfo {
  isValid: boolean;
  mimeType: string | null;
  estimatedSizeBytes: number;
  base64Length: number;
  isLargeFile: boolean;
  error?: string;
}

export interface Base64ProcessingResult {
  success: boolean;
  uri?: string;
  blob?: Blob;
  objectUrl?: string;
  sizeBytes?: number;
  error?: string;
}

export interface Base64ProcessingProgress {
  phase: 'validating' | 'decoding' | 'creating_blob' | 'complete' | 'error';
  progress: number;
  message: string;
}

/**
 * Check if a string is a base64 video data URI
 */
export function isBase64VideoUri(uri: string | null | undefined): boolean {
  if (!uri || typeof uri !== 'string') return false;
  
  const trimmedUri = uri.trim();
  
  // Check for standard video data URI prefixes
  for (const prefix of BASE64_VIDEO_CONSTANTS.VIDEO_DATA_URI_PATTERNS) {
    if (trimmedUri.startsWith(prefix)) {
      return true;
    }
  }
  
  // Check for generic base64 video pattern
  if (trimmedUri.startsWith('data:video/') && trimmedUri.includes(';base64,')) {
    return true;
  }
  
  return false;
}

/**
 * Check if a string is a blob URL
 */
export function isBlobUri(uri: string | null | undefined): boolean {
  if (!uri || typeof uri !== 'string') return false;
  return uri.trim().startsWith('blob:');
}

/**
 * Check if a string is any data URI (including video base64)
 */
export function isDataUri(uri: string | null | undefined): boolean {
  if (!uri || typeof uri !== 'string') return false;
  return uri.trim().startsWith('data:');
}

/**
 * Extract MIME type from base64 data URI
 */
export function getMimeTypeFromDataUri(dataUri: string): string | null {
  if (!isDataUri(dataUri)) return null;
  
  try {
    const match = dataUri.match(/^data:([^;,]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Get video format extension from MIME type
 */
export function getFormatFromMimeType(mimeType: string | null): string {
  if (!mimeType) return 'mp4';
  
  const mimeToFormat: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'video/x-m4v': 'm4v',
    'video/avi': 'avi',
    'video/x-msvideo': 'avi',
    'video/mov': 'mov',
    'video/3gpp': '3gp',
    'application/octet-stream': 'mp4', // Default to mp4 for binary
  };
  
  return mimeToFormat[mimeType.toLowerCase()] || 'mp4';
}

/**
 * Validate base64 video data and return info about it
 */
export function validateBase64Video(dataUri: string): Base64VideoInfo {
  if (!dataUri || typeof dataUri !== 'string') {
    return {
      isValid: false,
      mimeType: null,
      estimatedSizeBytes: 0,
      base64Length: 0,
      isLargeFile: false,
      error: 'Invalid or empty data URI',
    };
  }

  const trimmedUri = dataUri.trim();

  if (!isBase64VideoUri(trimmedUri)) {
    return {
      isValid: false,
      mimeType: null,
      estimatedSizeBytes: 0,
      base64Length: trimmedUri.length,
      isLargeFile: false,
      error: 'Not a valid video data URI. Expected format: data:video/mp4;base64,...',
    };
  }

  const mimeType = getMimeTypeFromDataUri(trimmedUri);
  
  // Find the base64 content start
  const base64Start = trimmedUri.indexOf(',');
  if (base64Start === -1) {
    return {
      isValid: false,
      mimeType,
      estimatedSizeBytes: 0,
      base64Length: 0,
      isLargeFile: false,
      error: 'Malformed data URI - missing comma separator',
    };
  }

  const base64Content = trimmedUri.slice(base64Start + 1);
  const base64Length = base64Content.length;

  if (base64Length < BASE64_VIDEO_CONSTANTS.MIN_BASE64_LENGTH) {
    return {
      isValid: false,
      mimeType,
      estimatedSizeBytes: 0,
      base64Length,
      isLargeFile: false,
      error: 'Base64 content too short to be a valid video',
    };
  }

  // Validate base64 format (check for valid characters in a sample)
  const sampleSize = Math.min(1000, base64Length);
  const sample = base64Content.slice(0, sampleSize);
  const base64Regex = /^[A-Za-z0-9+/=]+$/;
  
  if (!base64Regex.test(sample)) {
    return {
      isValid: false,
      mimeType,
      estimatedSizeBytes: 0,
      base64Length,
      isLargeFile: false,
      error: 'Invalid base64 encoding detected',
    };
  }

  // Calculate estimated decoded size (base64 is ~4/3 the size of binary)
  const estimatedSizeBytes = Math.floor((base64Length * 3) / 4);
  const isLargeFile = trimmedUri.length > BASE64_VIDEO_CONSTANTS.MAX_RECOMMENDED_SIZE;

  return {
    isValid: true,
    mimeType,
    estimatedSizeBytes,
    base64Length,
    isLargeFile,
  };
}

/**
 * Convert base64 string to Uint8Array in chunks to avoid memory issues
 * Suitable for large videos
 * Note: This function uses atob() which is only available on web platforms.
 * On native platforms, use processBase64Video which checks for platform compatibility.
 */
export function base64ToUint8Array(
  base64: string,
  onProgress?: (progress: number) => void
): Uint8Array {
  // Check if atob is available (only on web platforms)
  if (typeof atob !== 'function') {
    throw new Error('base64ToUint8Array is only supported on web platforms. atob is not available.');
  }
  
  // Remove any whitespace
  const cleanBase64 = base64.replace(/\s/g, '');
  
  // Use native atob for smaller strings (fast path)
  if (cleanBase64.length < 100000) {
    try {
      const binaryString = atob(cleanBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      onProgress?.(1);
      return bytes;
    } catch {
      // Fall through to chunked processing
    }
  }

  // For larger strings, process in chunks to avoid memory issues
  const chunkSize = BASE64_VIDEO_CONSTANTS.CHUNK_SIZE;
  const totalChunks = Math.ceil(cleanBase64.length / chunkSize);
  const outputChunks: Uint8Array[] = [];
  let totalBytes = 0;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    // Ensure chunk ends at a multiple of 4 (base64 padding requirement)
    let end = Math.min(start + chunkSize, cleanBase64.length);
    // Adjust end to be a multiple of 4 unless it's the last chunk
    if (i < totalChunks - 1) {
      end = start + Math.floor((end - start) / 4) * 4;
    }
    
    const chunk = cleanBase64.slice(start, end);
    
    try {
      const binaryString = atob(chunk);
      const bytes = new Uint8Array(binaryString.length);
      for (let j = 0; j < binaryString.length; j++) {
        bytes[j] = binaryString.charCodeAt(j);
      }
      outputChunks.push(bytes);
      totalBytes += bytes.length;
    } catch (e) {
      console.error('[Base64VideoHandler] Chunk decode error at chunk', i, e);
      throw new Error(`Failed to decode base64 at position ${start}: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    onProgress?.((i + 1) / totalChunks);
  }

  // Merge all chunks into a single Uint8Array
  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of outputChunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * Process a base64 video data URI and create a blob URL for playback
 * Handles any length of base64 video with proper memory management
 */
export async function processBase64Video(
  dataUri: string,
  onProgress?: (progress: Base64ProcessingProgress) => void
): Promise<Base64ProcessingResult> {
  // Web platform only - other platforms should use file system
  if (Platform.OS !== 'web') {
    return {
      success: false,
      error: 'Base64 to blob conversion is only supported on web platform. Use file system for native platforms.',
    };
  }

  const reportProgress = (phase: Base64ProcessingProgress['phase'], progress: number, message: string) => {
    onProgress?.({ phase, progress, message });
  };

  try {
    reportProgress('validating', 0.05, 'Validating base64 video data...');

    // Validate the base64 video
    const validationResult = validateBase64Video(dataUri);
    if (!validationResult.isValid) {
      reportProgress('error', 0, validationResult.error || 'Validation failed');
      return {
        success: false,
        error: validationResult.error,
      };
    }

    const { mimeType, estimatedSizeBytes, isLargeFile } = validationResult;
    console.log('[Base64VideoHandler] Processing video:', {
      mimeType,
      estimatedSizeBytes,
      isLargeFile,
    });

    if (isLargeFile) {
      reportProgress('decoding', 0.1, 'Processing large video file... This may take a moment.');
    } else {
      reportProgress('decoding', 0.1, 'Decoding video data...');
    }

    // Extract base64 content
    const base64Start = dataUri.indexOf(',');
    const base64Content = dataUri.slice(base64Start + 1);

    // Convert to binary data
    const binaryData = base64ToUint8Array(base64Content, (progress) => {
      const scaledProgress = 0.1 + progress * 0.7; // 10% to 80%
      reportProgress('decoding', scaledProgress, `Decoding: ${Math.round(progress * 100)}%`);
    });

    reportProgress('creating_blob', 0.85, 'Creating video blob...');

    // Create blob with proper MIME type
    // Use slice to create a copy with ArrayBuffer for Blob compatibility
    const bufferSlice = binaryData.buffer.slice(binaryData.byteOffset, binaryData.byteOffset + binaryData.byteLength);
    const blob = new Blob([bufferSlice as ArrayBuffer], { type: mimeType || 'video/mp4' });
    
    // Create object URL for playback
    const objectUrl = URL.createObjectURL(blob);

    reportProgress('complete', 1, 'Video ready for playback');

    console.log('[Base64VideoHandler] Video processed successfully:', {
      blobSize: blob.size,
      objectUrl: objectUrl.substring(0, 50),
    });

    return {
      success: true,
      blob,
      objectUrl,
      sizeBytes: blob.size,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
    console.error('[Base64VideoHandler] Processing failed:', error);
    reportProgress('error', 0, errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Revoke a previously created blob URL to free memory
 */
export function revokeBlobUrl(url: string | null | undefined): void {
  if (url && typeof url === 'string' && url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
      console.log('[Base64VideoHandler] Revoked blob URL');
    } catch (e) {
      console.warn('[Base64VideoHandler] Failed to revoke blob URL:', e);
    }
  }
}

/**
 * Estimate the memory usage for processing a base64 video
 */
export function estimateMemoryUsage(base64Length: number): {
  peakMemoryMB: number;
  finalMemoryMB: number;
  isHighMemory: boolean;
} {
  // Base64 string memory + decoded binary + blob = roughly 3x decoded size during processing
  const decodedSize = Math.floor((base64Length * 3) / 4);
  const peakMemory = base64Length + decodedSize * 2; // String + 2 copies during processing
  const finalMemory = decodedSize; // Just the blob after cleanup
  
  return {
    peakMemoryMB: peakMemory / (1024 * 1024),
    finalMemoryMB: finalMemory / (1024 * 1024),
    isHighMemory: peakMemory > 100 * 1024 * 1024, // > 100MB peak
  };
}

/**
 * Create a safe video URI from various input types
 * Handles: base64 data URIs, blob URLs, file paths, http(s) URLs
 */
export function normalizeVideoUri(uri: string | null | undefined): {
  uri: string | null;
  type: 'base64' | 'blob' | 'file' | 'http' | 'unknown' | 'invalid';
  requiresProcessing: boolean;
} {
  if (!uri || typeof uri !== 'string') {
    return { uri: null, type: 'invalid', requiresProcessing: false };
  }

  const trimmed = uri.trim();
  
  if (isBase64VideoUri(trimmed)) {
    return { uri: trimmed, type: 'base64', requiresProcessing: true };
  }
  
  if (isBlobUri(trimmed)) {
    return { uri: trimmed, type: 'blob', requiresProcessing: false };
  }
  
  if (trimmed.startsWith('file://') || trimmed.startsWith('/') ||
      trimmed.startsWith('ph://') || trimmed.startsWith('content://')) {
    return { uri: trimmed, type: 'file', requiresProcessing: false };
  }
  
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return { uri: trimmed, type: 'http', requiresProcessing: false };
  }

  return { uri: trimmed, type: 'unknown', requiresProcessing: false };
}
