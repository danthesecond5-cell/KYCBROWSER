/**
 * Mobile WebView Simulation Test
 * 
 * This test simulates the constraints and behaviors specific to:
 * - iOS WKWebView
 * - Android WebView
 * - React Native WebView wrapper
 * 
 * Key differences from desktop Chrome:
 * 1. canvas.captureStream() may not be available or work differently
 * 2. MediaDevices API may be limited
 * 3. AudioContext may require user interaction
 * 4. WebRTC may be restricted
 * 5. Script injection timing may differ
 */
import { chromium, devices as playwrightDevices } from 'playwright';
import { createMediaInjectionScript } from '../constants/browserScripts';

const TEST_URL = 'https://webcamtests.com/recorder';

interface SimDevice {
  id: string;
  nativeDeviceId?: string;
  groupId?: string;
  type: 'camera' | 'microphone';
  name?: string;
  facing?: 'front' | 'back';
  simulationEnabled?: boolean;
  assignedVideoUri?: string | null;
  capabilities?: {
    videoResolutions?: Array<{ width: number; height: number }>;
  };
}

const SIM_DEVICES: SimDevice[] = [
  {
    id: 'camera_front_0',
    nativeDeviceId: 'camera_front_0',
    groupId: 'default',
    type: 'camera',
    name: 'Front Camera',
    facing: 'front',
    simulationEnabled: true,
    assignedVideoUri: null,
    capabilities: { videoResolutions: [{ width: 1080, height: 1920 }] },
  },
];

async function testMobileWebViewSimulation() {
  console.log('='.repeat(80));
  console.log('MOBILE WEBVIEW SIMULATION TEST');
  console.log('='.repeat(80));
  console.log('\nSimulating mobile WebView behavior with webcamtests.com/recorder\n');

  // Use iPhone 15 Pro device emulation
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });

  // Use iPhone device profile
  const iPhone = playwrightDevices['iPhone 15 Pro'];
  const context = await browser.newContext({
    ...iPhone,
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();
  
  // Collect all console logs
  const logs: { type: string; text: string }[] = [];
  page.on('console', (msg) => {
    logs.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', (err) => {
    logs.push({ type: 'pageerror', text: String(err) });
  });

  // Create the injection script
  const injectionScript = createMediaInjectionScript(SIM_DEVICES as any, {
    protocolId: 'standard',
    protocolLabel: 'Mobile WebView Test',
    stealthMode: true,
    forceSimulation: true,
    debugEnabled: true,
    permissionPromptEnabled: false,
    showOverlayLabel: false,
    loopVideo: true,
    mirrorVideo: false,
  });

  // Inject the script
  await page.addInitScript({ content: injectionScript });

  console.log('Step 1: Navigating to webcamtests.com/recorder...');
  await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(2000);

  console.log('Step 2: Checking API availability...');
  const apiCheck = await page.evaluate(() => {
    return {
      mediaDevices: typeof navigator.mediaDevices !== 'undefined',
      getUserMedia: typeof navigator.mediaDevices?.getUserMedia === 'function',
      enumerateDevices: typeof navigator.mediaDevices?.enumerateDevices === 'function',
      MediaRecorder: typeof MediaRecorder === 'function',
      AudioContext: typeof (window as any).AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined',
      canvas: typeof HTMLCanvasElement !== 'undefined',
      captureStream: (() => {
        try {
          const c = document.createElement('canvas');
          return typeof c.captureStream === 'function';
        } catch { return false; }
      })(),
    };
  });
  console.log('  API Check:', JSON.stringify(apiCheck, null, 2));

  console.log('Step 3: Testing enumerateDevices...');
  const devices = await page.evaluate(async () => {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      return devs.map(d => ({ kind: d.kind, label: d.label, deviceId: d.deviceId?.substring(0, 20) }));
    } catch (e: any) {
      return { error: e.message };
    }
  });
  console.log('  Devices:', JSON.stringify(devices, null, 2));

  console.log('Step 4: Testing getUserMedia...');
  const gumResult = await page.evaluate(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: false 
      });
      const vt = stream.getVideoTracks()[0];
      const result = {
        success: true,
        trackCount: stream.getTracks().length,
        videoTrackCount: stream.getVideoTracks().length,
        audioTrackCount: stream.getAudioTracks().length,
        settings: vt?.getSettings?.() || null,
        capabilities: vt?.getCapabilities?.() || null,
        readyState: vt?.readyState,
        label: vt?.label,
      };
      stream.getTracks().forEach(t => t.stop());
      return result;
    } catch (e: any) {
      return { success: false, error: e.name + ': ' + e.message };
    }
  });
  console.log('  getUserMedia result:', JSON.stringify(gumResult, null, 2));

  console.log('Step 5: Testing MediaRecorder with injected stream...');
  const recorderResult = await page.evaluate(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream);
      
      return new Promise((resolve) => {
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
          stream.getTracks().forEach(t => t.stop());
          resolve({
            success: true,
            blobSize: blob.size,
            mimeType: recorder.mimeType,
          });
        };
        recorder.onerror = (e: any) => {
          stream.getTracks().forEach(t => t.stop());
          resolve({ success: false, error: e?.error?.message || 'MediaRecorder error' });
        };
        
        recorder.start();
        setTimeout(() => recorder.stop(), 1500);
      });
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });
  console.log('  MediaRecorder result:', JSON.stringify(recorderResult, null, 2));

  console.log('Step 6: Testing webcamtests.com site integration...');
  try {
    // Click the "Start recording" button
    const startButton = page.getByRole('button', { name: /start recording/i });
    await startButton.click({ timeout: 15_000 });
    console.log('  Clicked "Start recording" button');
    
    await page.waitForTimeout(2000);

    // Check if video elements have streams
    const siteCheck = await page.evaluate(() => {
      const videos = Array.from(document.querySelectorAll('video'));
      const videosWithStream = videos.filter((v: any) => v.srcObject && v.srcObject.getTracks);
      
      const results: any = {
        totalVideos: videos.length,
        videosWithStream: videosWithStream.length,
        videoDetails: videos.map((v: any, i) => ({
          index: i,
          hasStream: !!(v.srcObject && v.srcObject.getTracks),
          trackCount: v.srcObject?.getTracks?.()?.length || 0,
          videoWidth: v.videoWidth,
          videoHeight: v.videoHeight,
          readyState: v.readyState,
        })),
      };

      // Check for stop button
      const stopButtons = Array.from(document.querySelectorAll('button'))
        .filter((b) => (b.textContent || '').toLowerCase().includes('stop'));
      results.stopButtonsFound = stopButtons.length;

      return results;
    });
    console.log('  Site integration check:', JSON.stringify(siteCheck, null, 2));

    // Try to stop recording
    const stopButton = page.getByRole('button', { name: /stop recording/i });
    if (await stopButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await stopButton.click();
      console.log('  Clicked "Stop recording" button');
      await page.waitForTimeout(1500);

      // Check for download button
      const downloadCheck = await page.evaluate(() => {
        const downloadButtons = Array.from(document.querySelectorAll('button, a'))
          .filter((el) => {
            const text = (el.textContent || '').toLowerCase();
            return text.includes('download') || text.includes('save');
          });
        return {
          downloadButtonsFound: downloadButtons.length,
          texts: downloadButtons.map(b => (b.textContent || '').substring(0, 50)),
        };
      });
      console.log('  Download buttons:', JSON.stringify(downloadCheck, null, 2));
    }

  } catch (e: any) {
    console.log('  Site integration error:', e.message);
  }

  // Print relevant logs
  console.log('\nStep 7: Console logs from page:');
  const relevantLogs = logs.filter(l => 
    l.text.includes('MediaSim') || 
    l.text.includes('Bulletproof') ||
    l.text.includes('WorkingInject') ||
    l.text.includes('getUserMedia') ||
    l.text.includes('Camera') ||
    l.type === 'error' ||
    l.type === 'pageerror'
  );
  
  for (const log of relevantLogs.slice(0, 30)) {
    console.log(`  [${log.type}] ${log.text.substring(0, 150)}`);
  }

  await page.close();
  await context.close();
  await browser.close();

  console.log('\n' + '='.repeat(80));
  console.log('TEST COMPLETE');
  console.log('='.repeat(80));

  // Final summary
  const success = gumResult.success && 
                  (recorderResult as any).success && 
                  (recorderResult as any).blobSize > 1000;
  
  console.log(`\nFinal Result: ${success ? '✅ PASS' : '❌ FAIL'}`);
  
  if (!success) {
    console.log('\nPotential issues:');
    if (!gumResult.success) {
      console.log('  - getUserMedia failed');
    }
    if (!(recorderResult as any).success) {
      console.log('  - MediaRecorder failed');
    }
    if ((recorderResult as any).blobSize <= 1000) {
      console.log('  - Recording size too small (no video data)');
    }
  }

  return success;
}

testMobileWebViewSimulation()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((e) => {
    console.error('Test crashed:', e);
    process.exit(1);
  });
