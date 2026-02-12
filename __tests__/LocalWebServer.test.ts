import { Platform } from 'react-native';
import { LocalWebServer, PINK_NOISE_WORKLET_SOURCE } from '@/utils/LocalWebServer';

// Mock react-native Platform
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

// Mock expo-file-system with the legacy API used by LocalWebServer
const mockGetInfoAsync = jest.fn();
const mockWriteAsStringAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock/documents/',
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
  writeAsStringAsync: (...args: unknown[]) => mockWriteAsStringAsync(...args),
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
  EncodingType: { UTF8: 'utf8' },
}));

const setPlatformOS = (os: string) => {
  (Platform as { OS: string }).OS = os;
};

describe('LocalWebServer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    LocalWebServer.cleanup();
    setPlatformOS('ios');
  });

  describe('PINK_NOISE_WORKLET_SOURCE', () => {
    it('should export the pink noise worklet source as a non-empty string', () => {
      expect(typeof PINK_NOISE_WORKLET_SOURCE).toBe('string');
      expect(PINK_NOISE_WORKLET_SOURCE.length).toBeGreaterThan(0);
    });

    it('should contain the AudioWorkletProcessor class', () => {
      expect(PINK_NOISE_WORKLET_SOURCE).toContain('PinkNoiseProcessor');
      expect(PINK_NOISE_WORKLET_SOURCE).toContain('AudioWorkletProcessor');
      expect(PINK_NOISE_WORKLET_SOURCE).toContain('registerProcessor');
    });
  });

  describe('prepareAssets (native)', () => {
    it('should write worklet to document directory when file does not exist', async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: false });
      mockWriteAsStringAsync.mockResolvedValue(undefined);

      const uri = await LocalWebServer.prepareAssets();

      expect(uri).toBe('file:///mock/documents/pink-noise-processor.js');
      expect(mockWriteAsStringAsync).toHaveBeenCalledWith(
        'file:///mock/documents/pink-noise-processor.js',
        PINK_NOISE_WORKLET_SOURCE,
        { encoding: 'utf8' },
      );
    });

    it('should skip writing if worklet file already exists', async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true });

      const uri = await LocalWebServer.prepareAssets();

      expect(uri).toBe('file:///mock/documents/pink-noise-processor.js');
      expect(mockWriteAsStringAsync).not.toHaveBeenCalled();
    });

    it('should return cached URI on subsequent calls', async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: false });
      mockWriteAsStringAsync.mockResolvedValue(undefined);

      const uri1 = await LocalWebServer.prepareAssets();
      const uri2 = await LocalWebServer.prepareAssets();

      expect(uri1).toBe(uri2);
      // Should only write once
      expect(mockWriteAsStringAsync).toHaveBeenCalledTimes(1);
    });

    it('should cache failed promise and reject on retry', async () => {
      mockGetInfoAsync.mockRejectedValue(new Error('disk full'));

      await expect(LocalWebServer.prepareAssets()).rejects.toThrow('disk full');
      // Subsequent call should return the same cached rejection
      await expect(LocalWebServer.prepareAssets()).rejects.toThrow('disk full');
      // getInfoAsync should only have been called once
      expect(mockGetInfoAsync).toHaveBeenCalledTimes(1);
    });

    it('should allow retry after cleanup', async () => {
      mockGetInfoAsync.mockRejectedValueOnce(new Error('disk full'));

      await expect(LocalWebServer.prepareAssets()).rejects.toThrow('disk full');

      LocalWebServer.cleanup();

      mockGetInfoAsync.mockResolvedValue({ exists: false });
      mockWriteAsStringAsync.mockResolvedValue(undefined);

      const uri = await LocalWebServer.prepareAssets();
      expect(uri).toBe('file:///mock/documents/pink-noise-processor.js');
    });
  });

  describe('getWorkletUri', () => {
    it('should return null before prepareAssets is called', () => {
      expect(LocalWebServer.getWorkletUri()).toBeNull();
    });

    it('should return the URI after prepareAssets completes', async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true });

      await LocalWebServer.prepareAssets();

      expect(LocalWebServer.getWorkletUri()).toBe('file:///mock/documents/pink-noise-processor.js');
    });
  });

  describe('writeFile (native)', () => {
    it('should write content to document directory', async () => {
      mockWriteAsStringAsync.mockResolvedValue(undefined);

      const path = await LocalWebServer.writeFile('test.js', 'console.log("hello")');

      expect(path).toBe('file:///mock/documents/test.js');
      expect(mockWriteAsStringAsync).toHaveBeenCalledWith(
        'file:///mock/documents/test.js',
        'console.log("hello")',
        { encoding: 'utf8' },
      );
    });
  });

  describe('readFile (native)', () => {
    it('should return file content when file exists', async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true });
      mockReadAsStringAsync.mockResolvedValue('file content');

      const content = await LocalWebServer.readFile('test.js');

      expect(content).toBe('file content');
    });

    it('should return null when file does not exist', async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: false });

      const content = await LocalWebServer.readFile('missing.js');

      expect(content).toBeNull();
    });

    it('should return null on web platform', async () => {
      setPlatformOS('web');

      const content = await LocalWebServer.readFile('test.js');

      expect(content).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('should reset workletUri', async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true });
      await LocalWebServer.prepareAssets();

      expect(LocalWebServer.getWorkletUri()).not.toBeNull();

      LocalWebServer.cleanup();

      expect(LocalWebServer.getWorkletUri()).toBeNull();
    });
  });
});
