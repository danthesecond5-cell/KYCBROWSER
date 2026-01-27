import {
  isBase64VideoUri,
  isBlobUri,
  isDataUri,
  getMimeTypeFromDataUri,
  getFormatFromMimeType,
  validateBase64Video,
  base64ToUint8Array,
  estimateMemoryUsage,
  normalizeVideoUri,
  BASE64_VIDEO_CONSTANTS,
} from '../utils/base64VideoHandler';

describe('base64VideoHandler', () => {
  describe('isBase64VideoUri', () => {
    it('should return true for valid base64 video data URIs', () => {
      expect(isBase64VideoUri('data:video/mp4;base64,AAAA')).toBe(true);
      expect(isBase64VideoUri('data:video/webm;base64,BBBB')).toBe(true);
      expect(isBase64VideoUri('data:video/quicktime;base64,CCCC')).toBe(true);
    });

    it('should return false for non-video data URIs', () => {
      expect(isBase64VideoUri('data:image/png;base64,AAAA')).toBe(false);
      expect(isBase64VideoUri('data:text/plain;base64,AAAA')).toBe(false);
    });

    it('should return false for regular URLs', () => {
      expect(isBase64VideoUri('https://example.com/video.mp4')).toBe(false);
      expect(isBase64VideoUri('http://example.com/video.mp4')).toBe(false);
    });

    it('should return false for null/undefined/empty strings', () => {
      expect(isBase64VideoUri(null)).toBe(false);
      expect(isBase64VideoUri(undefined)).toBe(false);
      expect(isBase64VideoUri('')).toBe(false);
    });

    it('should handle whitespace', () => {
      expect(isBase64VideoUri('  data:video/mp4;base64,AAAA  ')).toBe(true);
    });
  });

  describe('isBlobUri', () => {
    it('should return true for blob URLs', () => {
      expect(isBlobUri('blob:https://example.com/12345-67890')).toBe(true);
      expect(isBlobUri('blob:null/abcdef')).toBe(true);
    });

    it('should return false for non-blob URLs', () => {
      expect(isBlobUri('https://example.com/video.mp4')).toBe(false);
      expect(isBlobUri('data:video/mp4;base64,AAAA')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(isBlobUri(null)).toBe(false);
      expect(isBlobUri(undefined)).toBe(false);
    });
  });

  describe('isDataUri', () => {
    it('should return true for any data URI', () => {
      expect(isDataUri('data:video/mp4;base64,AAAA')).toBe(true);
      expect(isDataUri('data:image/png;base64,AAAA')).toBe(true);
      expect(isDataUri('data:text/plain,Hello')).toBe(true);
    });

    it('should return false for non-data URIs', () => {
      expect(isDataUri('https://example.com')).toBe(false);
      expect(isDataUri('blob:https://example.com/123')).toBe(false);
    });
  });

  describe('getMimeTypeFromDataUri', () => {
    it('should extract MIME type from data URI', () => {
      expect(getMimeTypeFromDataUri('data:video/mp4;base64,AAAA')).toBe('video/mp4');
      expect(getMimeTypeFromDataUri('data:video/webm;base64,AAAA')).toBe('video/webm');
      expect(getMimeTypeFromDataUri('data:application/octet-stream;base64,AAAA')).toBe('application/octet-stream');
    });

    it('should return null for non-data URIs', () => {
      expect(getMimeTypeFromDataUri('https://example.com')).toBe(null);
    });
  });

  describe('getFormatFromMimeType', () => {
    it('should return correct format for known MIME types', () => {
      expect(getFormatFromMimeType('video/mp4')).toBe('mp4');
      expect(getFormatFromMimeType('video/webm')).toBe('webm');
      expect(getFormatFromMimeType('video/quicktime')).toBe('mov');
    });

    it('should return mp4 as default for unknown MIME types', () => {
      expect(getFormatFromMimeType('video/unknown')).toBe('mp4');
      expect(getFormatFromMimeType(null)).toBe('mp4');
    });
  });

  describe('validateBase64Video', () => {
    it('should validate correct base64 video data URI', () => {
      const validBase64 = 'data:video/mp4;base64,' + 'A'.repeat(200);
      const result = validateBase64Video(validBase64);
      expect(result.isValid).toBe(true);
      expect(result.mimeType).toBe('video/mp4');
      expect(result.estimatedSizeBytes).toBeGreaterThan(0);
    });

    it('should reject invalid data URIs', () => {
      const result = validateBase64Video('not a data uri');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject empty or null input', () => {
      expect(validateBase64Video('')).toEqual(expect.objectContaining({ isValid: false }));
      expect(validateBase64Video(null as unknown as string)).toEqual(expect.objectContaining({ isValid: false }));
    });

    it('should reject too short base64 content', () => {
      const result = validateBase64Video('data:video/mp4;base64,AA');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('too short');
    });

    it('should detect large files', () => {
      // Create a large base64 string (just above the recommended size)
      const largeBase64 = 'data:video/mp4;base64,' + 'A'.repeat(BASE64_VIDEO_CONSTANTS.MAX_RECOMMENDED_SIZE + 100);
      const result = validateBase64Video(largeBase64);
      expect(result.isValid).toBe(true);
      expect(result.isLargeFile).toBe(true);
    });
  });

  describe('base64ToUint8Array', () => {
    it('should convert base64 to Uint8Array', () => {
      // "Hello" in base64
      const base64 = 'SGVsbG8=';
      const result = base64ToUint8Array(base64);
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(5);
      expect(String.fromCharCode(...result)).toBe('Hello');
    });

    it('should call progress callback', () => {
      const base64 = 'SGVsbG8=';
      const progressCallback = jest.fn();
      base64ToUint8Array(base64, progressCallback);
      expect(progressCallback).toHaveBeenCalledWith(1);
    });
  });

  describe('estimateMemoryUsage', () => {
    it('should estimate memory usage correctly', () => {
      const base64Length = 1000000; // 1MB of base64
      const result = estimateMemoryUsage(base64Length);
      
      expect(result.peakMemoryMB).toBeGreaterThan(0);
      expect(result.finalMemoryMB).toBeGreaterThan(0);
      expect(result.peakMemoryMB).toBeGreaterThan(result.finalMemoryMB);
    });

    it('should detect high memory usage', () => {
      // Very large base64 string
      const largeBase64Length = 200 * 1024 * 1024; // ~200MB
      const result = estimateMemoryUsage(largeBase64Length);
      expect(result.isHighMemory).toBe(true);
    });
  });

  describe('normalizeVideoUri', () => {
    it('should identify base64 URIs', () => {
      const result = normalizeVideoUri('data:video/mp4;base64,AAAA');
      expect(result.type).toBe('base64');
      expect(result.requiresProcessing).toBe(true);
    });

    it('should identify blob URIs', () => {
      const result = normalizeVideoUri('blob:https://example.com/123');
      expect(result.type).toBe('blob');
      expect(result.requiresProcessing).toBe(false);
    });

    it('should identify file URIs', () => {
      expect(normalizeVideoUri('file:///path/to/video.mp4').type).toBe('file');
      expect(normalizeVideoUri('/path/to/video.mp4').type).toBe('file');
    });

    it('should identify http URIs', () => {
      expect(normalizeVideoUri('https://example.com/video.mp4').type).toBe('http');
      expect(normalizeVideoUri('http://example.com/video.mp4').type).toBe('http');
    });

    it('should handle invalid input', () => {
      expect(normalizeVideoUri(null).type).toBe('invalid');
      expect(normalizeVideoUri(undefined).type).toBe('invalid');
      expect(normalizeVideoUri('').type).toBe('invalid');
    });
  });
});
