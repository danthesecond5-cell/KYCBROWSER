import { chromium, type Browser } from 'playwright';

import { createMediaInjectionScript } from '../constants/browserScripts';
import { createSonnetProtocolScript, type SonnetProtocolConfig } from '../constants/sonnetProtocol';
import { createWorkingInjectionScript } from '../constants/workingInjection';
import type { CaptureDevice } from '../types/device';
import { createAdvancedProtocol2Script } from '../utils/advancedProtocol/browserScript';

type ProtocolId =
  | 'standard'
  | 'allowlist'
  | 'protected'
  | 'harness'
  | 'holographic'
  | 'working'
  | 'advanced2'
  | 'sonnet';

type CheckResult = {
  protocolId: ProtocolId;
  url: string;
  injectionDetected: boolean;
  getUserMediaOk: boolean;
  trackSummary?: { videoTracks: number; audioTracks: number };
  mediaRecorderOk: boolean;
  recordedBytes?: number;
  error?: string;
};

const TARGET_URL = 'https://webcamtests.com/recorder';

const protocols: ProtocolId[] = [
  'standard',
  'allowlist',
  'protected',
  'harness',
  'holographic',
  // These mirror the actual WebView injection paths used in-app.
  'working',
  'advanced2',
  'sonnet',
];

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

async function withBrowser<T>(fn: (browser: Browser) => Promise<T>): Promise<T> {
  const browser = await chromium.launch({ headless: true });
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}

async function runCheck(protocolId: ProtocolId): Promise<CheckResult> {
  return withBrowser(async (browser) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });

    const page = await context.newPage();

    const baseOptions = {
      stealthMode: true,
      forceSimulation: true,
      protocolId,
      debugEnabled: false,
      permissionPromptEnabled: false,
      showOverlayLabel: false,
    } as const;

    let injectionScript: string;
    if (protocolId === 'working') {
      injectionScript = createWorkingInjectionScript({
        videoUri: null,
        devices,
        stealthMode: true,
        debugEnabled: false,
        targetWidth: 1080,
        targetHeight: 1920,
        targetFPS: 30,
      });
    } else if (protocolId === 'advanced2') {
      injectionScript = createAdvancedProtocol2Script({
        videoUri: undefined,
        devices,
        enableWebRTCRelay: true,
        enableASI: true,
        enableGPU: false,
        enableCrypto: false,
        debugEnabled: false,
        stealthMode: true,
        protocolLabel: 'Protocol 2: Advanced Relay',
        showOverlayLabel: false,
      });
    } else if (protocolId === 'sonnet') {
      const sonnetConfig: SonnetProtocolConfig = {
        enabled: true,
        aiAdaptiveQuality: true,
        behavioralMimicry: true,
        neuralStyleTransfer: false,
        predictiveFrameOptimization: true,
        quantumTimingRandomness: true,
        biometricSimulation: true,
        realTimeProfiler: true,
        adaptiveStealth: true,
        performanceTarget: 'balanced',
        stealthIntensity: 'maximum',
        learningMode: false,
      };
      injectionScript = createSonnetProtocolScript(devices, sonnetConfig, undefined);
    } else {
      injectionScript = createMediaInjectionScript(devices, baseOptions);
    }

    // Ensure injection runs at document start for all frames.
    await page.addInitScript({ content: injectionScript });

    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const result = await page.evaluate(async () => {
      const out: Omit<CheckResult, 'protocolId' | 'url'> = {
        injectionDetected:
          Boolean((window as any).__mediaInjectorInitialized) ||
          Boolean((window as any).__mediaSimConfig) ||
          Boolean((window as any).__workingInjectionActive) ||
          Boolean((window as any).__advancedProtocol2Initialized) ||
          Boolean((window as any).__sonnetProtocolInitialized),
        getUserMediaOk: false,
        mediaRecorderOk: false,
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1080 }, height: { ideal: 1920 }, facingMode: 'user' },
          audio: true,
        });

        out.getUserMediaOk = Boolean(stream) && stream.getTracks().length > 0;
        out.trackSummary = {
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
        };

        // Attach stream to a video element to mimic real usage.
        const v = document.createElement('video');
        v.muted = true;
        v.playsInline = true;
        (v as any).srcObject = stream;
        document.body.appendChild(v);
        await v.play().catch(() => {});

        if (typeof (window as any).MediaRecorder === 'function') {
          try {
            const chunks: BlobPart[] = [];
            const rec = new MediaRecorder(stream);
            rec.ondataavailable = (e) => {
              if (e.data && e.data.size > 0) chunks.push(e.data);
            };
            const stopped = new Promise<void>((resolve) => {
              rec.onstop = () => resolve();
            });

            rec.start(250);
            await new Promise((r) => setTimeout(r, 750));
            rec.stop();
            await stopped;

            const blob = new Blob(chunks, { type: chunks[0] instanceof Blob ? (chunks[0] as Blob).type : undefined });
            out.mediaRecorderOk = blob.size > 0;
            out.recordedBytes = blob.size;
          } catch (e: any) {
            out.mediaRecorderOk = false;
            out.error = `MediaRecorder failed: ${e?.message || String(e)}`;
          }
        } else {
          out.mediaRecorderOk = false;
          out.error = 'MediaRecorder not available in this browser context';
        }

        // Cleanup tracks
        stream.getTracks().forEach((t) => t.stop());
      } catch (e: any) {
        out.error = e?.message || String(e);
      }

      return out;
    });

    await context.close();

    return {
      protocolId,
      url: TARGET_URL,
      ...result,
    };
  });
}

async function main() {
  const results: CheckResult[] = [];

  for (const protocolId of protocols) {
    // eslint-disable-next-line no-console
    console.log(`[webcamtests] Checking protocol: ${protocolId}`);
    results.push(await runCheck(protocolId));
  }

  // eslint-disable-next-line no-console
  console.log('\n[webcamtests] Results:\n' + JSON.stringify(results, null, 2));

  const failed = results.filter((r) => !r.injectionDetected || !r.getUserMediaOk);
  if (failed.length > 0) {
    // eslint-disable-next-line no-console
    console.error('\n[webcamtests] FAILED protocols:\n' + failed.map((r) => r.protocolId).join(', '));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[webcamtests] Fatal error:', err);
  process.exitCode = 1;
});

