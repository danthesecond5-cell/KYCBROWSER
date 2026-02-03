import { NativeModules, Platform } from 'react-native';

const LoopbackModule = NativeModules.WebRtcLoopback;

export const exportRingBufferToPhotos = async (): Promise<void> => {
  if (Platform.OS !== 'ios') {
    throw new Error('Ring buffer export is only supported on iOS.');
  }
  if (!LoopbackModule?.exportRingBufferToPhotos) {
    throw new Error('Native WebRtcLoopback module not available.');
  }
  await LoopbackModule.exportRingBufferToPhotos();
};
