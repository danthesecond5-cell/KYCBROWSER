/**
 * Test Deep Injection Protocols (0-3) from deepInjectionProtocols.ts
 * against webcamtests.com/recorder
 * 
 * These are separate from the 5 main protocols (standard, allowlist, protected, harness, holographic)
 */

import { chromium } from 'playwright';
import {
  createProtocol0DeepHook,
  createProtocol1MediaStreamOverride,
  createProtocol2DescriptorHook,
  createProtocol3ProxyIntercept,
} from '../utils/deepInjectionProtocols';

interface DeepProtocolResult {
  protocolId: string;
  status: 'success' | 'failed';
  injectionDetected: boolean;
  getUserMediaOk: boolean;
  trackInfo: any;
  recordedBytes: number;
  errors: string[];
  diagnosis: string;
}

const TARGET_URL = 'https://webcamtests.com/recorder';

const deepProtocols = [
  { id: 'protocol0', name: 'Protocol 0: Ultra-Early Deep Hook', createScript: createProtocol0DeepHook },
  { id: 'protocol1', name: 'Protocol 1: MediaStream Constructor Override', createScript: createProtocol1MediaStreamOverride },
  { id: 'protocol2', name: 'Protocol 2: Descriptor-Level Deep Hook', createScript: createProtocol2DescriptorHook },
  { id: 'protocol3', name: 'Protocol 3: Proxy-Based Intercept', createScript: createProtocol3ProxyIntercept },
];

const config = {
  width: 1080,
  height: 1920,
  fps: 30,
  deviceLabel: 'iPhone Front Camera',
  deviceId: 'test-camera-001',
  showDebugOverlay: true,
  useTestPattern: true,
};

async function testDeepProtocol(protocol: typeof deepProtocols[0]): Promise<DeepProtocolResult> {
  const result: DeepProtocolResult = {
    protocolId: protocol.id,
    status: 'failed',
    injectionDetected: false,
    getUserMediaOk: false,
    trackInfo: null,
    recordedBytes: 0,
    errors: [],
    diagnosis: '',
  };

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
      '--no-sandbox',
    ],
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      permissions: ['camera', 'microphone'],
    });

    const page = await context.newPage();

    // Collect errors
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        result.errors.push(text);
      }
      console.log(`[${protocol.id}] Console ${type}: ${text.substring(0, 150)}`);
    });

    page.on('pageerror', (err) => {
      result.errors.push(err.message);
      console.log(`[${protocol.id}] Page Error: ${err.message.substring(0, 150)}`);
    });

    // Generate the deep injection script
    const injectionScript = protocol.createScript(config);

    // Inject BEFORE navigation
    await page.addInitScript({ content: injectionScript });

    // Navigate
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);

    // Check injection
    result.injectionDetected = await page.evaluate((protocolId) => {
      const checks: Record<string, string> = {
        'protocol0': '__protocol0Initialized',
        'protocol1': '__protocol1Initialized',
        'protocol2': '__protocol2Initialized',
        'protocol3': '__protocol3Initialized',
      };
      const checkKey = checks[protocolId];
      return Boolean((window as any)[checkKey]);
    }, protocol.id);

    // Test getUserMedia
    try {
      const gumResult = await page.evaluate(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1080 }, height: { ideal: 1920 } },
            audio: false,
          });

          if (!stream) {
            return { success: false, error: 'No stream returned' };
          }

          const videoTracks = stream.getVideoTracks();
          if (videoTracks.length === 0) {
            return { success: false, error: 'No video tracks' };
          }

          const track = videoTracks[0];
          const trackInfo = {
            label: track.label,
            readyState: track.readyState,
            muted: track.muted,
            enabled: track.enabled,
            settings: typeof track.getSettings === 'function' ? track.getSettings() : null,
          };

          // Test video display
          const video = document.createElement('video');
          video.muted = true;
          video.playsInline = true;
          video.autoplay = true;
          video.srcObject = stream;
          document.body.appendChild(video);

          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Video play timeout')), 5000);
            video.onloadedmetadata = () => {
              clearTimeout(timeout);
              resolve(null);
            };
          });

          await video.play();

          // Test MediaRecorder
          let recordedBytes = 0;
          try {
            const chunks: Blob[] = [];
            const recorder = new MediaRecorder(stream);
            recorder.ondataavailable = (e) => {
              if (e.data && e.data.size > 0) chunks.push(e.data);
            };

            const stopped = new Promise<void>((res) => {
              recorder.onstop = () => res();
            });

            recorder.start(250);
            await new Promise((r) => setTimeout(r, 1000));
            recorder.stop();
            await stopped;

            const blob = new Blob(chunks, { type: recorder.mimeType });
            recordedBytes = blob.size;
          } catch (e: any) {
            return { success: true, trackInfo, recordedBytes: 0, recorderError: e.message };
          }

          stream.getTracks().forEach((t) => t.stop());
          video.remove();

          return { success: true, trackInfo, recordedBytes };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      });

      if (gumResult.success) {
        result.getUserMediaOk = true;
        result.trackInfo = gumResult.trackInfo;
        result.recordedBytes = gumResult.recordedBytes || 0;
      } else {
        result.errors.push(`getUserMedia: ${gumResult.error}`);
      }
    } catch (e: any) {
      result.errors.push(`getUserMedia exception: ${e.message}`);
    }

    // Determine status
    if (result.getUserMediaOk && result.recordedBytes > 0) {
      result.status = 'success';
      result.diagnosis = 'Protocol works correctly. Stream created and recorded.';
    } else if (result.getUserMediaOk) {
      result.status = 'success';
      result.diagnosis = 'Protocol works. getUserMedia succeeded.';
    } else {
      result.status = 'failed';
      result.diagnosis = `Protocol failed: ${result.errors.slice(0, 2).join('; ')}`;
    }

    await context.close();
  } catch (e: any) {
    result.status = 'failed';
    result.diagnosis = `Test crashed: ${e.message}`;
    result.errors.push(e.message);
  } finally {
    await browser.close();
  }

  return result;
}

async function main() {
  console.log('='.repeat(80));
  console.log('DEEP INJECTION PROTOCOLS (0-3) TEST');
  console.log('Testing against webcamtests.com/recorder');
  console.log('='.repeat(80));
  console.log('');

  const results: DeepProtocolResult[] = [];

  for (const protocol of deepProtocols) {
    console.log(`\n${'='.repeat(40)}`);
    console.log(`Testing: ${protocol.name}`);
    console.log('='.repeat(40));

    const result = await testDeepProtocol(protocol);
    results.push(result);

    console.log(`\n[${protocol.id}] Status: ${result.status.toUpperCase()}`);
    console.log(`[${protocol.id}] Injection Detected: ${result.injectionDetected}`);
    console.log(`[${protocol.id}] getUserMedia OK: ${result.getUserMediaOk}`);
    console.log(`[${protocol.id}] Recorded Bytes: ${result.recordedBytes}`);
    if (result.trackInfo) {
      console.log(`[${protocol.id}] Track Label: ${result.trackInfo.label}`);
      console.log(`[${protocol.id}] Track Settings:`, result.trackInfo.settings);
    }
    console.log(`[${protocol.id}] Diagnosis: ${result.diagnosis}`);
    if (result.errors.length > 0) {
      console.log(`[${protocol.id}] Errors: ${result.errors.slice(0, 3).join('\n  ')}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));

  for (const result of results) {
    const icon = result.status === 'success' ? '✅' : '❌';
    console.log(`${icon} ${result.protocolId}: ${result.status} - ${result.diagnosis}`);
  }

  const failed = results.filter((r) => r.status === 'failed');
  if (failed.length > 0) {
    console.log(`\n❌ FAILED: ${failed.map((r) => r.protocolId).join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\n✅ All deep protocols working!');
  }

  console.log('\n' + '='.repeat(80));
  console.log('FULL RESULTS JSON:');
  console.log('='.repeat(80));
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exitCode = 1;
});
