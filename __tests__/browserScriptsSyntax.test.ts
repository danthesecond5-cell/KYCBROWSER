import { BULLETPROOF_INJECTION_SCRIPT, createMediaInjectionScript } from '@/constants/browserScripts';
import type { CaptureDevice } from '@/types/device';

describe('browserScripts syntax', () => {
  it('BULLETPROOF_INJECTION_SCRIPT is valid JavaScript', () => {
    expect(() => new Function(BULLETPROOF_INJECTION_SCRIPT)).not.toThrow();
  });

  it('createMediaInjectionScript returns valid JavaScript', () => {
    const devices: CaptureDevice[] = [
      {
        id: 'cam_front',
        name: 'Front Camera',
        type: 'camera',
        facing: 'front',
        lensType: 'wide',
        tested: true,
        simulationEnabled: true,
        capabilities: {
          photoResolutions: [],
          videoResolutions: [{ width: 1080, height: 1920, label: '1080p', maxFps: 30 }],
          supportedModes: ['video'],
        },
      },
    ];

    const script = createMediaInjectionScript(devices, {
      stealthMode: true,
      forceSimulation: true,
      protocolId: 'standard',
      debugEnabled: false,
      permissionPromptEnabled: false,
    });

    expect(() => new Function(script)).not.toThrow();
  });
});

