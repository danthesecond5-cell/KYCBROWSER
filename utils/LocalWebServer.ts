import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

/**
 * LocalWebServer provides utilities for serving local assets
 * in the app's document directory. It creates worklet files and
 * other audio/video assets needed for media injection.
 *
 * On web, assets are served via blob URLs.
 * On native, assets are written to the document directory and
 * referenced via file:// URIs.
 */

const WORKLET_FILENAME = 'pink-noise-processor.js';

const PINK_NOISE_WORKLET_SOURCE = `
class PinkNoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.b0 = 0; this.b1 = 0; this.b2 = 0; this.b3 = 0;
    this.b4 = 0; this.b5 = 0; this.b6 = 0;
  }
  process(inputs, outputs) {
    const output = outputs[0];
    for (let channel = 0; channel < output.length; ++channel) {
      const outputChannel = output[channel];
      for (let i = 0; i < outputChannel.length; ++i) {
        const white = Math.random() * 2 - 1;
        this.b0 = 0.99886 * this.b0 + white * 0.0555179;
        this.b1 = 0.99332 * this.b1 + white * 0.075076;
        this.b2 = 0.96900 * this.b2 + white * 0.1538520;
        this.b3 = 0.86650 * this.b3 + white * 0.3104856;
        this.b4 = 0.55000 * this.b4 + white * 0.5329522;
        this.b5 = -0.7616 * this.b5 - white * 0.0168980;
        outputChannel[i] = this.b0 + this.b1 + this.b2 + this.b3 + this.b4 + this.b5 + this.b6 + white * 0.5362;
        outputChannel[i] *= 0.11;
        this.b6 = white * 0.115926;
      }
    }
    return true;
  }
}
registerProcessor('pink-noise-processor', PinkNoiseProcessor);
`.trim();

let workletUri: string | null = null;

export const LocalWebServer = {
  /**
   * Prepare local assets (write worklet files to document directory).
   * Returns the URI of the pink noise worklet file.
   */
  async prepareAssets(): Promise<string> {
    if (workletUri) return workletUri;

    if (Platform.OS === 'web') {
      // On web, create a blob URL for the worklet
      const blob = new Blob([PINK_NOISE_WORKLET_SOURCE], { type: 'application/javascript' });
      workletUri = URL.createObjectURL(blob);
      console.log('[LocalWebServer] Web worklet blob URL created');
      return workletUri;
    }

    // On native, write the worklet to the document directory
    const docDir = FileSystem.documentDirectory;
    if (!docDir) {
      console.error('[LocalWebServer] Document directory not available');
      return '';
    }

    const targetPath = docDir + WORKLET_FILENAME;

    try {
      const fileInfo = await FileSystem.getInfoAsync(targetPath);
      if (!fileInfo.exists) {
        await FileSystem.writeAsStringAsync(targetPath, PINK_NOISE_WORKLET_SOURCE, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        console.log('[LocalWebServer] Worklet written to:', targetPath);
      } else {
        console.log('[LocalWebServer] Worklet already exists at:', targetPath);
      }

      workletUri = targetPath;
      return workletUri;
    } catch (error) {
      console.error('[LocalWebServer] Failed to prepare assets:', error);
      return '';
    }
  },

  /**
   * Get the URI of the pink noise worklet file.
   * Call prepareAssets() first if this returns null.
   */
  getWorkletUri(): string | null {
    return workletUri;
  },

  /**
   * Write arbitrary content to the app's document directory.
   */
  async writeFile(filename: string, content: string): Promise<string> {
    if (Platform.OS === 'web') {
      const blob = new Blob([content], { type: 'text/plain' });
      return URL.createObjectURL(blob);
    }

    const docDir = FileSystem.documentDirectory;
    if (!docDir) {
      throw new Error('Document directory not available');
    }

    const targetPath = docDir + filename;
    await FileSystem.writeAsStringAsync(targetPath, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return targetPath;
  },

  /**
   * Read a file from the app's document directory.
   */
  async readFile(filename: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      console.warn('[LocalWebServer] readFile not supported on web');
      return null;
    }

    const docDir = FileSystem.documentDirectory;
    if (!docDir) return null;

    const targetPath = docDir + filename;

    try {
      const info = await FileSystem.getInfoAsync(targetPath);
      if (!info.exists) return null;

      return await FileSystem.readAsStringAsync(targetPath, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    } catch (error) {
      console.error('[LocalWebServer] Failed to read file:', error);
      return null;
    }
  },

  /**
   * Clean up resources (revoke blob URLs on web).
   */
  cleanup(): void {
    if (Platform.OS === 'web' && workletUri) {
      URL.revokeObjectURL(workletUri);
    }
    workletUri = null;
    console.log('[LocalWebServer] Cleaned up');
  },
};
