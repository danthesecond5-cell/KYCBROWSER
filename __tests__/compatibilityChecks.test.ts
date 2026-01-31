import { checkResolution } from '@/utils/compatibility/checks/resolutionCheck';
import { checkAspectRatio } from '@/utils/compatibility/checks/aspectRatioCheck';
import { checkDuration } from '@/utils/compatibility/checks/durationCheck';
import { checkFileSize } from '@/utils/compatibility/checks/fileSizeCheck';
import { checkFormat } from '@/utils/compatibility/checks/formatCheck';
import { checkOrientation } from '@/utils/compatibility/checks/orientationCheck';
import { IDEAL_WEBCAM_SPECS, ACCEPTABLE_SPECS } from '@/utils/compatibility/specs';

describe('Compatibility Checks', () => {
  describe('checkResolution', () => {
    it('returns warning for 0/undefined dimensions', () => {
      const result = checkResolution(0, 0);
      expect(result.status).toBe('warning');
      expect(result.message).toContain('could not be determined');

      const result2 = checkResolution(undefined, undefined);
      expect(result2.status).toBe('warning');
    });

    it('returns perfect for ideal dimensions', () => {
      const result = checkResolution(IDEAL_WEBCAM_SPECS.width, IDEAL_WEBCAM_SPECS.height);
      expect(result.status).toBe('perfect');
      expect(result.message).toContain('Perfect resolution match');
    });

    it('returns compatible for acceptable dimensions', () => {
      // Min acceptable
      const result = checkResolution(ACCEPTABLE_SPECS.minWidth, ACCEPTABLE_SPECS.minHeight);
      expect(result.status).toBe('compatible');

      // Non-ideal but acceptable
      const nonIdealWidth = IDEAL_WEBCAM_SPECS.width + 10;
      const nonIdealHeight = IDEAL_WEBCAM_SPECS.height + 10;
      
      if (nonIdealWidth <= ACCEPTABLE_SPECS.maxWidth && nonIdealHeight <= ACCEPTABLE_SPECS.maxHeight) {
          const result3 = checkResolution(nonIdealWidth, nonIdealHeight);
          expect(result3.status).toBe('compatible');
      }
    });

    it('returns incompatible for dimensions outside acceptable range', () => {
      const result = checkResolution(100, 100); // Too small
      expect(result.status).toBe('incompatible');

      const result2 = checkResolution(10000, 10000); // Too big
      expect(result2.status).toBe('incompatible');
    });
  });

  describe('checkAspectRatio', () => {
    it('returns warning for undefined inputs', () => {
      const result = checkAspectRatio(undefined, undefined, undefined);
      expect(result.status).toBe('warning');
    });

    it('calculates ratio from dimensions if aspect ratio is missing', () => {
      // 9:16
      const result = checkAspectRatio(undefined, 1080, 1920);
      expect(result.status).toBe('perfect');
      expect(result.message).toContain('9:16');

      // 16:9 (incompatible but calculated)
      const result2 = checkAspectRatio(undefined, 1920, 1080);
      expect(result2.status).toBe('incompatible');
    });

    it('returns perfect for ideal aspect ratio', () => {
      const result = checkAspectRatio('9:16', 1080, 1920);
      expect(result.status).toBe('perfect');
    });

    it('returns incompatible for bad aspect ratio', () => {
      const result = checkAspectRatio('16:9', 1920, 1080);
      expect(result.status).toBe('incompatible');
    });
  });

  describe('checkDuration', () => {
    it('returns warning for undefined/0 duration', () => {
      expect(checkDuration(undefined).status).toBe('warning');
      expect(checkDuration(0).status).toBe('warning');
    });

    it('returns perfect for short duration <= 30s', () => {
      expect(checkDuration(15).status).toBe('perfect');
      expect(checkDuration(30).status).toBe('perfect');
    });

    it('returns compatible for acceptable duration', () => {
        // Ideal max is 120s
      expect(checkDuration(60).status).toBe('compatible');
      expect(checkDuration(120).status).toBe('compatible');
    });

    it('returns incompatible for too long duration', () => {
      expect(checkDuration(121).status).toBe('incompatible');
    });
  });

  describe('checkFileSize', () => {
    it('returns warning for 0 file size', () => {
      expect(checkFileSize(0).status).toBe('warning');
    });

    it('returns perfect for small file size (<= 50% max)', () => {
      // Max is 50MB. 50% is 25MB.
      const bytes = 10 * 1024 * 1024; // 10MB
      expect(checkFileSize(bytes).status).toBe('perfect');
    });

    it('returns compatible for acceptable file size', () => {
      // Between 25MB and 50MB
      const bytes = 40 * 1024 * 1024; // 40MB
      expect(checkFileSize(bytes).status).toBe('compatible');
    });

    it('returns incompatible for too large file size', () => {
      const bytes = 51 * 1024 * 1024; // 51MB
      expect(checkFileSize(bytes).status).toBe('incompatible');
    });
  });

  describe('checkFormat', () => {
    it('returns warning for empty inputs', () => {
      expect(checkFormat('', '').status).toBe('warning');
    });

    it('returns perfect for mp4', () => {
      expect(checkFormat('video.mp4', 'video.mp4').status).toBe('perfect');
    });

    it('returns compatible for mov/webm', () => {
      expect(checkFormat('video.mov', 'video.mov').status).toBe('compatible');
      expect(checkFormat('video.webm', 'video.webm').status).toBe('compatible');
    });

    it('returns incompatible for unsupported format', () => {
      expect(checkFormat('video.avi', 'video.avi').status).toBe('incompatible');
    });

    it('extracts extension correctly', () => {
      // Pass empty name to force fallback to URI
      expect(checkFormat('path/to/video.mp4', '').status).toBe('perfect');
      expect(checkFormat('uri', 'video.MOV').status).toBe('compatible'); // case insensitive
    });
  });

  describe('checkOrientation', () => {
    it('returns warning for 0/undefined dimensions', () => {
      expect(checkOrientation(0, 0).status).toBe('warning');
      expect(checkOrientation(undefined, undefined).status).toBe('warning');
    });

    it('returns perfect for portrait (h > w)', () => {
      expect(checkOrientation(1080, 1920).status).toBe('perfect');
    });

    it('returns incompatible for landscape (w >= h)', () => {
      expect(checkOrientation(1920, 1080).status).toBe('incompatible');
      expect(checkOrientation(1080, 1080).status).toBe('incompatible'); // Square is not portrait
    });
  });
});
