/**
 * Deep Live Test for webcamtests.com/recorder
 * 
 * This script performs a comprehensive test that:
 * 1. Navigates to webcamtests.com/recorder
 * 2. Waits for the page to fully load
 * 3. Clicks the record button on the actual page
 * 4. Verifies that the camera stream is working correctly
 * 5. Tests recording functionality
 * 6. Captures detailed diagnostics about each protocol
 */

import { chromium, type Browser, type Page } from 'playwright';
import { createMediaInjectionScript } from '../constants/browserScripts';
import type { CaptureDevice } from '../types/device';

type ProtocolId = 'standard' | 'allowlist' | 'protected' | 'harness' | 'holographic';

interface DeepTestResult {
  protocolId: ProtocolId;
  status: 'success' | 'partial' | 'failed';
  injectionDetected: boolean;
  getUserMediaOk: boolean;
  enumerateDevicesOk: boolean;
  deviceCount: number;
  trackMetadata: {
    label: string;
    readyState: string;
    muted: boolean;
    enabled: boolean;
    settings: any;
  } | null;
  videoDisplayed: boolean;
  mediaRecorderOk: boolean;
  recordedBytes: number;
  consoleErrors: string[];
  pageErrors: string[];
  siteRecordButtonWorks: boolean;
  timings: {
    pageLoad: number;
    getUserMedia: number;
    recording: number;
  };
  diagnosis: string;
}

const TARGET_URL = 'https://webcamtests.com/recorder';

const protocols: ProtocolId[] = ['standard', 'allowlist', 'protected', 'harness', 'holographic'];

const devices: CaptureDevice[] = [
  {
    id: 'cam_front',
    nativeDeviceId: 'native_cam_front_001',
    name: 'iPhone Front Camera',
    type: 'camera',
    facing: 'front',
    lensType: 'wide',
    tested: true,
    simulationEnabled: true,
    groupId: 'default_group',
    capabilities: {
      photoResolutions: [],
      videoResolutions: [
        { width: 1080, height: 1920, label: '1080p', maxFps: 30 },
        { width: 720, height: 1280, label: '720p', maxFps: 60 },
      ],
      supportedModes: ['video'],
    },
  },
  {
    id: 'cam_back',
    nativeDeviceId: 'native_cam_back_001',
    name: 'iPhone Back Camera',
    type: 'camera',
    facing: 'back',
    lensType: 'wide',
    tested: true,
    simulationEnabled: true,
    groupId: 'default_group',
    capabilities: {
      photoResolutions: [],
      videoResolutions: [
        { width: 3840, height: 2160, label: '4K', maxFps: 60 },
        { width: 1920, height: 1080, label: '1080p', maxFps: 60 },
      ],
      supportedModes: ['video'],
    },
  },
];

async function runDeepTest(protocolId: ProtocolId): Promise<DeepTestResult> {
  const startTime = Date.now();
  const result: DeepTestResult = {
    protocolId,
    status: 'failed',
    injectionDetected: false,
    getUserMediaOk: false,
    enumerateDevicesOk: false,
    deviceCount: 0,
    trackMetadata: null,
    videoDisplayed: false,
    mediaRecorderOk: false,
    recordedBytes: 0,
    consoleErrors: [],
    pageErrors: [],
    siteRecordButtonWorks: false,
    timings: {
      pageLoad: 0,
      getUserMedia: 0,
      recording: 0,
    },
    diagnosis: '',
  };

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      permissions: ['camera', 'microphone'],
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    });

    const page = await context.newPage();

    // Collect console errors
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        result.consoleErrors.push(text);
      }
      // Log all console for debugging
      console.log(`[${protocolId}] Console ${type}: ${text.substring(0, 200)}`);
    });

    page.on('pageerror', (err) => {
      result.pageErrors.push(err.message);
      console.log(`[${protocolId}] Page Error: ${err.message.substring(0, 200)}`);
    });

    // Generate the injection script
    const injectionScript = createMediaInjectionScript(devices, {
      stealthMode: true,
      forceSimulation: true,
      protocolId,
      debugEnabled: true, // Enable debugging for diagnostics
      permissionPromptEnabled: false,
      showOverlayLabel: false,
      loopVideo: true,
      mirrorVideo: false,
    });

    // Inject BEFORE navigation
    await page.addInitScript({ content: injectionScript });

    // Navigate to the page
    const loadStartTime = Date.now();
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 60000 });
    result.timings.pageLoad = Date.now() - loadStartTime;

    // Wait a bit for any JS to finish
    await page.waitForTimeout(2000);

    // Check injection
    result.injectionDetected = await page.evaluate(() => {
      return Boolean(
        (window as any).__mediaInjectorInitialized ||
        (window as any).__mediaSimConfig ||
        (window as any).__workingInjectionActive ||
        (window as any).__advancedProtocol2Initialized ||
        (window as any).__sonnetProtocolInitialized
      );
    });

    // Test enumerateDevices
    try {
      const deviceInfo = await page.evaluate(async () => {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(d => d.kind === 'videoinput');
        return {
          count: cameras.length,
          devices: cameras.map(d => ({
            deviceId: d.deviceId,
            label: d.label,
            kind: d.kind,
          })),
        };
      });
      result.enumerateDevicesOk = deviceInfo.count > 0;
      result.deviceCount = deviceInfo.count;
      console.log(`[${protocolId}] Devices found: ${deviceInfo.count}`, deviceInfo.devices);
    } catch (e: any) {
      result.consoleErrors.push(`enumerateDevices failed: ${e.message}`);
    }

    // Test getUserMedia
    const gumStartTime = Date.now();
    try {
      const gumResult = await page.evaluate(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1080 },
              height: { ideal: 1920 },
              facingMode: 'user',
            },
            audio: true,
          });

          if (!stream) {
            return { success: false, error: 'No stream returned' };
          }

          const videoTracks = stream.getVideoTracks();
          if (videoTracks.length === 0) {
            return { success: false, error: 'No video tracks' };
          }

          const track = videoTracks[0];
          const metadata = {
            label: track.label,
            readyState: track.readyState,
            muted: track.muted,
            enabled: track.enabled,
            settings: typeof track.getSettings === 'function' ? track.getSettings() : null,
            capabilities: typeof track.getCapabilities === 'function' ? track.getCapabilities() : null,
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

          const videoDisplayed = video.videoWidth > 0 && video.videoHeight > 0;

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
            return {
              success: true,
              videoDisplayed,
              metadata,
              recordedBytes: 0,
              recorderError: e.message,
            };
          }

          // Cleanup
          stream.getTracks().forEach((t) => t.stop());
          video.remove();

          return {
            success: true,
            videoDisplayed,
            metadata,
            recordedBytes,
          };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      });

      result.timings.getUserMedia = Date.now() - gumStartTime;

      if (gumResult.success) {
        result.getUserMediaOk = true;
        result.videoDisplayed = gumResult.videoDisplayed || false;
        result.trackMetadata = gumResult.metadata || null;
        result.recordedBytes = gumResult.recordedBytes || 0;
        result.mediaRecorderOk = (gumResult.recordedBytes || 0) > 100;
      } else {
        result.consoleErrors.push(`getUserMedia: ${gumResult.error}`);
      }
    } catch (e: any) {
      result.consoleErrors.push(`getUserMedia exception: ${e.message}`);
    }

    // Try to click the actual record button on webcamtests.com
    try {
      // Wait for page elements
      await page.waitForTimeout(1000);

      // Look for the record button (webcamtests.com uses a specific structure)
      const recordButton = await page.$('button:has-text("Record"), .record-button, #recordButton, [data-action="record"]');
      if (recordButton) {
        await recordButton.click();
        await page.waitForTimeout(2000);
        result.siteRecordButtonWorks = true;
      } else {
        // Try to find any button that might start recording
        const buttons = await page.$$('button');
        for (const btn of buttons) {
          const text = await btn.textContent();
          if (text && text.toLowerCase().includes('record')) {
            await btn.click();
            await page.waitForTimeout(2000);
            result.siteRecordButtonWorks = true;
            break;
          }
        }
      }
    } catch (e: any) {
      console.log(`[${protocolId}] Could not find/click record button: ${e.message}`);
    }

    // Determine overall status
    if (result.getUserMediaOk && result.mediaRecorderOk && result.videoDisplayed) {
      result.status = 'success';
      result.diagnosis = 'Protocol works correctly. Video stream is created, displayed, and recorded successfully.';
    } else if (result.getUserMediaOk) {
      result.status = 'partial';
      if (!result.mediaRecorderOk) {
        result.diagnosis = 'Stream created but MediaRecorder failed.';
      } else if (!result.videoDisplayed) {
        result.diagnosis = 'Stream created but video display failed.';
      } else {
        result.diagnosis = 'Partial success with some features not working.';
      }
    } else {
      result.status = 'failed';
      result.diagnosis = `Protocol failed to create stream. Errors: ${result.consoleErrors.join('; ')}`;
    }

    await context.close();
  } catch (e: any) {
    result.status = 'failed';
    result.diagnosis = `Test crashed: ${e.message}`;
    result.pageErrors.push(e.message);
  } finally {
    await browser.close();
  }

  return result;
}

async function main() {
  console.log('='.repeat(80));
  console.log('DEEP WEBCAMTESTS.COM/RECORDER PROTOCOL TEST');
  console.log('='.repeat(80));
  console.log('');

  const results: DeepTestResult[] = [];

  for (const protocolId of protocols) {
    console.log(`\n${'='.repeat(40)}`);
    console.log(`Testing Protocol: ${protocolId.toUpperCase()}`);
    console.log('='.repeat(40));
    
    const result = await runDeepTest(protocolId);
    results.push(result);

    console.log(`\n[${protocolId}] Result: ${result.status.toUpperCase()}`);
    console.log(`[${protocolId}] Diagnosis: ${result.diagnosis}`);
    console.log(`[${protocolId}] Injection Detected: ${result.injectionDetected}`);
    console.log(`[${protocolId}] getUserMedia OK: ${result.getUserMediaOk}`);
    console.log(`[${protocolId}] Devices Found: ${result.deviceCount}`);
    console.log(`[${protocolId}] Video Displayed: ${result.videoDisplayed}`);
    console.log(`[${protocolId}] Recorded Bytes: ${result.recordedBytes}`);
    if (result.trackMetadata) {
      console.log(`[${protocolId}] Track Label: ${result.trackMetadata.label}`);
      console.log(`[${protocolId}] Track Settings: ${JSON.stringify(result.trackMetadata.settings)}`);
    }
    if (result.consoleErrors.length > 0) {
      console.log(`[${protocolId}] Errors: ${result.consoleErrors.slice(0, 5).join('\n  ')}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));

  for (const result of results) {
    const icon = result.status === 'success' ? '✅' : result.status === 'partial' ? '⚠️' : '❌';
    console.log(`${icon} ${result.protocolId}: ${result.status} - ${result.diagnosis.substring(0, 80)}`);
  }

  const failed = results.filter((r) => r.status === 'failed');
  if (failed.length > 0) {
    console.log(`\n❌ FAILED protocols: ${failed.map((r) => r.protocolId).join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\n✅ All protocols working!');
  }

  // Output JSON for further analysis
  console.log('\n' + '='.repeat(80));
  console.log('FULL RESULTS JSON:');
  console.log('='.repeat(80));
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exitCode = 1;
});
