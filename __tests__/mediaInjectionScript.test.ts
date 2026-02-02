import { createMediaInjectionScript } from '@/constants/browserScripts';
import type { CaptureDevice } from '@/types/device';

const baseDevices: CaptureDevice[] = [
  {
    id: 'camera_1',
    name: 'Test Camera',
    type: 'camera',
    facing: 'front',
    lensType: 'standard',
    tested: true,
    simulationEnabled: true,
  },
];

const protocols = ['standard', 'allowlist', 'protected', 'harness', 'holographic'] as const;

describe('createMediaInjectionScript', () => {
  it('defines async getUserMedia override', () => {
    const script = createMediaInjectionScript(baseDevices, { protocolId: 'standard' });
    expect(script).toContain('mediaDevices.getUserMedia = async function');
  });

  it('uses config-based forceSimulation in shouldSimulate', () => {
    const script = createMediaInjectionScript(baseDevices, { protocolId: 'standard' });
    expect(script).toContain('cfg.forceSimulation || cfg.stealthMode');
  });

  it('embeds the provided protocol id', () => {
    protocols.forEach(protocolId => {
      const script = createMediaInjectionScript(baseDevices, { protocolId });
      expect(script).toContain(`PROTOCOL_ID: "${protocolId}"`);
    });
  });
});
