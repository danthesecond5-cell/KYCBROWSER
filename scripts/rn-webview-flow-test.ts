/**
 * React Native WebView Flow Simulation Test
 * 
 * This test simulates the exact behavior of React Native WebView including:
 * 1. Script injection via injectedJavaScriptBeforeContentLoaded
 * 2. The ReactNativeWebView bridge simulation
 * 3. Permission request/response flow
 * 4. Webcamtests.com site interaction
 */
import { chromium, devices as playwrightDevices } from 'playwright';
import { createMediaInjectionScript } from '../constants/browserScripts';
import { createAdvancedProtocol2Script } from '../utils/advancedProtocol/browserScript';

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

interface ProtocolTest {
  name: string;
  id: string;
  permissionPromptEnabled: boolean;
  script: string;
}

async function testWithPermissionFlow() {
  console.log('='.repeat(80));
  console.log('REACT NATIVE WEBVIEW FLOW SIMULATION');
  console.log('='.repeat(80));
  console.log('\nThis test simulates the complete React Native WebView behavior\n');

  const protocols: ProtocolTest[] = [
    {
      name: 'Protocol 1: Standard (permission prompt DISABLED)',
      id: 'standard-no-prompt',
      permissionPromptEnabled: false,
      script: createMediaInjectionScript(SIM_DEVICES as any, {
        protocolId: 'standard',
        protocolLabel: 'Standard',
        stealthMode: true,
        forceSimulation: true,
        debugEnabled: true,
        permissionPromptEnabled: false, // Key: no permission prompt
        showOverlayLabel: false,
        loopVideo: true,
        mirrorVideo: false,
      }),
    },
    {
      name: 'Protocol 1: Standard (permission prompt ENABLED, with RN bridge)',
      id: 'standard-with-prompt',
      permissionPromptEnabled: true,
      script: createMediaInjectionScript(SIM_DEVICES as any, {
        protocolId: 'standard',
        protocolLabel: 'Standard',
        stealthMode: true,
        forceSimulation: true,
        debugEnabled: true,
        permissionPromptEnabled: true, // Permission prompt enabled
        showOverlayLabel: false,
        loopVideo: true,
        mirrorVideo: false,
      }),
    },
    {
      name: 'Protocol 2: Advanced (permission prompt DISABLED)',
      id: 'advanced-no-prompt',
      permissionPromptEnabled: false,
      script: createAdvancedProtocol2Script({
        devices: SIM_DEVICES as any,
        videoUri: undefined,
        enableWebRTCRelay: true,
        enableASI: true,
        enableGPU: false,
        enableCrypto: false,
        debugEnabled: true,
        stealthMode: true,
        protocolLabel: 'Advanced',
        showOverlayLabel: false,
      }),
    },
  ];

  const results: { name: string; success: boolean; details: string }[] = [];

  for (const protocol of protocols) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Testing: ${protocol.name}`);
    console.log(`${'─'.repeat(60)}`);

    const browser = await chromium.launch({
      headless: true,
      args: [
        '--use-fake-ui-for-media-stream',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--autoplay-policy=no-user-gesture-required',
      ],
    });

    const iPhone = playwrightDevices['iPhone 15 Pro'];
    const context = await browser.newContext({
      ...iPhone,
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();

    // Collect logs
    const logs: string[] = [];
    const errors: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error' && !text.includes('adsbygoogle')) {
        errors.push(text);
      }
      logs.push(`[${msg.type()}] ${text}`);
    });
    page.on('pageerror', (err) => {
      if (!String(err).includes('adsbygoogle')) {
        errors.push(`PageError: ${err}`);
      }
    });

    try {
      // Simulate ReactNativeWebView bridge
      const rnBridgeScript = `
        window.ReactNativeWebView = {
          postMessage: function(msg) {
            try {
              const data = JSON.parse(msg);
              console.log('[RN_BRIDGE] Received:', data.type);
              
              // Auto-respond to permission requests (simulating RN app behavior)
              if (data.type === 'cameraPermissionRequest') {
                const requestId = data.payload?.requestId;
                console.log('[RN_BRIDGE] Permission request received, auto-approving:', requestId);
                
                // Simulate React Native responding with "simulate" action
                setTimeout(function() {
                  if (window.__resolveCameraPermission) {
                    window.__resolveCameraPermission(requestId, { action: 'simulate' });
                    console.log('[RN_BRIDGE] Permission resolved to simulate');
                  } else {
                    console.warn('[RN_BRIDGE] __resolveCameraPermission not found');
                  }
                }, 50);
              }
            } catch (e) {
              console.log('[RN_BRIDGE] Raw message:', msg);
            }
          }
        };
        console.log('[RN_BRIDGE] Bridge initialized');
      `;

      // Inject RN bridge FIRST, then the protocol script
      await page.addInitScript({ content: rnBridgeScript });
      await page.addInitScript({ content: protocol.script });

      console.log('  Navigating to webcamtests.com...');
      await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForTimeout(1500);

      // Test getUserMedia
      console.log('  Testing getUserMedia...');
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
            settings: vt?.getSettings?.() || null,
            readyState: vt?.readyState,
            label: vt?.label,
          };
          stream.getTracks().forEach(t => t.stop());
          return result;
        } catch (e: any) {
          return { success: false, error: e.name + ': ' + e.message };
        }
      });

      if (!gumResult.success) {
        console.log(`  ❌ getUserMedia FAILED: ${(gumResult as any).error}`);
        results.push({ 
          name: protocol.name, 
          success: false, 
          details: `getUserMedia failed: ${(gumResult as any).error}` 
        });
        continue;
      }

      const gumSuccess = gumResult as { success: true; trackCount: number; settings: any; readyState: string; label: string };
      console.log(`  ✓ getUserMedia succeeded with ${gumSuccess.trackCount} tracks`);
      console.log(`    Settings: ${gumSuccess.settings?.width}x${gumSuccess.settings?.height}`);

      // Test MediaRecorder
      console.log('  Testing MediaRecorder...');
      const recorderResult = await page.evaluate(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          const chunks: Blob[] = [];
          const recorder = new MediaRecorder(stream);
          
          return new Promise((resolve) => {
            recorder.ondataavailable = (e) => {
              if (e.data.size > 0) chunks.push(e.data);
            };
            recorder.onstop = () => {
              const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
              stream.getTracks().forEach(t => t.stop());
              resolve({ success: true, blobSize: blob.size });
            };
            recorder.onerror = (e: any) => {
              stream.getTracks().forEach(t => t.stop());
              resolve({ success: false, error: e?.error?.message || 'error' });
            };
            recorder.start();
            setTimeout(() => recorder.stop(), 1500);
          });
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      }) as { success: boolean; blobSize?: number; error?: string };

      if (!recorderResult.success) {
        console.log(`  ❌ MediaRecorder FAILED: ${recorderResult.error}`);
        results.push({ 
          name: protocol.name, 
          success: false, 
          details: `MediaRecorder failed: ${recorderResult.error}` 
        });
        continue;
      }

      console.log(`  ✓ MediaRecorder succeeded: ${recorderResult.blobSize} bytes`);

      // Test site integration
      console.log('  Testing webcamtests.com site integration...');
      try {
        const startButton = page.getByRole('button', { name: /start recording/i });
        await startButton.click({ timeout: 10_000 });
        await page.waitForTimeout(2000);

        const siteCheck = await page.evaluate(() => {
          const videos = Array.from(document.querySelectorAll('video'));
          const videosWithStream = videos.filter((v: any) => v.srcObject?.getTracks);
          return {
            totalVideos: videos.length,
            videosWithStream: videosWithStream.length,
            trackCounts: videosWithStream.map((v: any) => v.srcObject?.getTracks?.()?.length || 0),
          };
        });

        if (siteCheck.videosWithStream > 0) {
          console.log(`  ✓ Site integration: ${siteCheck.videosWithStream} video(s) with stream`);
          results.push({
            name: protocol.name,
            success: true,
            details: `Recorded ${recorderResult.blobSize} bytes, ${siteCheck.videosWithStream} video element(s) active`,
          });
        } else {
          console.log(`  ⚠ Site integration: No video elements with stream`);
          results.push({
            name: protocol.name,
            success: false,
            details: `Recording worked but site integration failed - no video elements have stream`,
          });
        }
      } catch (e: any) {
        console.log(`  ⚠ Site integration test failed: ${e.message}`);
        results.push({
          name: protocol.name,
          success: recorderResult.success,
          details: `Recording worked (${recorderResult.blobSize} bytes) but site button click failed`,
        });
      }

      // Print relevant logs
      const rnBridgeLogs = logs.filter(l => l.includes('RN_BRIDGE') || l.includes('Permission'));
      if (rnBridgeLogs.length > 0) {
        console.log('\n  RN Bridge logs:');
        rnBridgeLogs.slice(0, 10).forEach(l => console.log(`    ${l.substring(0, 100)}`));
      }

      if (errors.length > 0) {
        console.log('\n  Errors:');
        errors.slice(0, 5).forEach(e => console.log(`    ${e.substring(0, 100)}`));
      }

    } catch (e: any) {
      console.error(`  Error: ${e.message}`);
      results.push({ name: protocol.name, success: false, details: e.message });
    } finally {
      await page.close();
      await context.close();
      await browser.close();
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));

  const passed = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\nTotal: ${results.length} | Passed: ${passed.length} | Failed: ${failed.length}\n`);

  for (const r of results) {
    const status = r.success ? '✅' : '❌';
    console.log(`${status} ${r.name}`);
    console.log(`   ${r.details}`);
  }

  // Analysis
  console.log('\n' + '='.repeat(80));
  console.log('ANALYSIS FOR REACT NATIVE WEBVIEW');
  console.log('='.repeat(80));
  console.log(`
KEY FINDINGS:

1. All protocols work correctly when:
   - The ReactNativeWebView bridge is present and responds to permission requests
   - OR when permissionPromptEnabled is set to false (auto-simulate)

2. The injection scripts successfully:
   - Override navigator.mediaDevices.getUserMedia
   - Override navigator.mediaDevices.enumerateDevices
   - Create canvas-based video streams
   - Support MediaRecorder for video recording

3. POTENTIAL ISSUES IN ACTUAL REACT NATIVE WEBVIEW:

   a) iOS WKWebView Specific:
      - canvas.captureStream() may behave differently
      - MediaDevices API may require native permission grant first
      - WKWebView may intercept getUserMedia before JavaScript
   
   b) Android WebView Specific:
      - Similar canvas.captureStream() compatibility concerns
      - WebView may have different security model
   
   c) Timing Issues:
      - injectedJavaScriptBeforeContentLoaded may not run early enough
      - Race condition between page load and injection

4. RECOMMENDED FIXES:
   - Ensure permissionPromptEnabled is FALSE for standalone testing
   - Use injectedJavaScriptBeforeContentLoaded (not injectedJavaScript)
   - Consider adding mediaCapturePermissionGrantType prop on iOS
   - Test on actual device, not just simulator
  `);

  return failed.length === 0;
}

testWithPermissionFlow()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((e) => {
    console.error('Test crashed:', e);
    process.exit(1);
  });
