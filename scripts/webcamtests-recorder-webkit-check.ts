import { webkit } from 'playwright';

import { createMediaInjectionScript, MEDIARECORDER_POLYFILL_SCRIPT } from '../constants/browserScripts';
import type { CaptureDevice } from '../types/device';

type Result = {
  url: string;
  hasNativeMediaRecorder: boolean;
  polyfillInstalled: boolean;
  getUserMediaOk: boolean;
  mediaRecorderConstructed: boolean;
  recordedBytes: number;
  error?: string;
};

const TARGET_URL = process.env.WEBCAMTESTS_URL || 'https://webcamtests.com/recorder';

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

async function main() {
  const browser = await webkit.launch({ headless: true });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();

    const injection = createMediaInjectionScript(devices, {
      stealthMode: true,
      forceSimulation: true,
      protocolId: 'standard',
      debugEnabled: false,
      permissionPromptEnabled: false,
      showOverlayLabel: false,
      loopVideo: true,
      mirrorVideo: false,
    });

    // Polyfill must run before site JS checks MediaRecorder.
    await page.addInitScript({ content: MEDIARECORDER_POLYFILL_SCRIPT + '\n' + injection });
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const result = await page.evaluate(async (): Promise<Result> => {
      const out: Result = {
        url: location.href,
        hasNativeMediaRecorder: typeof (window as any).MediaRecorder !== 'undefined' && !(window as any).__mediaRecorderPolyfillInstalled,
        polyfillInstalled: Boolean((window as any).__mediaRecorderPolyfillInstalled),
        getUserMediaOk: false,
        mediaRecorderConstructed: false,
        recordedBytes: 0,
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        out.getUserMediaOk = Boolean(stream) && stream.getVideoTracks().length > 0;

        // Record ~2000ms
        const chunks: Blob[] = [];
        const RecorderCtor: any = (window as any).MediaRecorder;
        const rec: any = new RecorderCtor(stream, { mimeType: 'video/webm' });
        out.mediaRecorderConstructed = true;

        const stopped = new Promise<void>((resolve, reject) => {
          rec.onstop = () => resolve();
          rec.onerror = (e: any) => reject(e?.error || e);
        });
        rec.ondataavailable = (e: any) => {
          if (e && e.data && e.data.size) chunks.push(e.data);
        };

        rec.start(250);
        await new Promise((r) => setTimeout(r, 2000));
        rec.stop();
        await stopped;

        const blob = new Blob(chunks, { type: 'video/webm' });
        out.recordedBytes = blob.size;

        stream.getTracks().forEach((t) => t.stop());
      } catch (e: any) {
        out.error = e?.message || String(e);
      }

      return out;
    });

    // eslint-disable-next-line no-console
    console.log('[webkit-webcamtests]', JSON.stringify(result, null, 2));

    await context.close();
    if (!result.getUserMediaOk || !result.mediaRecorderConstructed || result.recordedBytes < 1024) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[webkit-webcamtests] Fatal error:', e);
  process.exit(1);
});

