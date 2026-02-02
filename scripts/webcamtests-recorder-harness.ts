import { chromium } from 'playwright';
import { createMediaInjectionScript } from '../constants/browserScripts';
import { createWorkingInjectionScript } from '../constants/workingInjection';
import { createSonnetProtocolScript, type SonnetProtocolConfig } from '../constants/sonnetProtocol';
import { createAdvancedProtocol2Script } from '../utils/advancedProtocol/browserScript';
import { createWebSocketInjectionScript } from '../utils/websocketBridge/injectionScript';

type ProtocolRun = {
  name: string;
  id: string;
  injectedBeforeLoad: string;
  postLoadConfig?: Record<string, any>;
};

type SimDevice = {
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
};

const TEST_URL = process.env.WEBCAMTESTS_URL || 'https://webcamtests.com/recorder';

const DEVICES: SimDevice[] = [
  {
    id: 'camera_front_0',
    nativeDeviceId: 'camera_front_0',
    groupId: 'default',
    type: 'camera',
    name: 'Front Camera',
    facing: 'front',
    simulationEnabled: true,
    assignedVideoUri: 'canvas:default',
    capabilities: { videoResolutions: [{ width: 1080, height: 1920 }] },
  },
];

async function runOnce(run: ProtocolRun) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--no-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 390, height: 844 },
  });

  const page = await context.newPage();
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    await page.addInitScript({ content: run.injectedBeforeLoad });
    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    
    if (run.postLoadConfig) {
      await page.evaluate((cfg) => {
        if (typeof (window as any).__updateMediaConfig === 'function') {
          (window as any).__updateMediaConfig(cfg);
        }
      }, run.postLoadConfig);
    }

    // Deep API validation: ensure gUM succeeds and yields a live video track.
    const gum = await page.evaluate(async () => {
      const md = (navigator as any).mediaDevices;
      if (!md || typeof md.getUserMedia !== 'function') {
        return { ok: false, step: 'mediaDevices', error: 'navigator.mediaDevices.getUserMedia missing' };
      }

      const devices = typeof md.enumerateDevices === 'function' ? await md.enumerateDevices() : [];
      try {
        const stream = await md.getUserMedia({ video: true, audio: false });
        const tracks = stream.getTracks();
        const vt = stream.getVideoTracks()[0];
        return {
          ok: true,
          devicesCount: devices.length,
          tracks: tracks.map((t: any) => ({ kind: t.kind, readyState: t.readyState, label: t.label })),
          videoSettings: vt?.getSettings?.() ?? null,
          videoCapabilities: vt?.getCapabilities?.() ?? null,
        };
      } catch (e: any) {
        return { ok: false, step: 'getUserMedia', name: e?.name || 'Error', message: e?.message || String(e) };
      }
    });

    // Site flow validation: click "Start recording" and ensure a <video> element gets a MediaStream.
    await page.getByRole('button', { name: /start recording/i }).click({ timeout: 15_000 });
    await page.waitForTimeout(1500);

    const ui = await page.evaluate(() => {
      const videos = Array.from(document.querySelectorAll('video'));
      const videosWithStream = videos.filter((v) => (v as any).srcObject && (v as any).srcObject.getTracks);
      const tracks = videosWithStream.flatMap((v) => (v as any).srcObject.getTracks());
      const stopButtons = Array.from(document.querySelectorAll('button'))
        .filter((b) => (b.textContent || '').trim().toLowerCase() === 'stop recording');

      return {
        videosFound: videos.length,
        videosWithStream: videosWithStream.length,
        streamTracksInVideoElements: tracks.length,
        stopButtonsFound: stopButtons.length,
        stopDisabled: stopButtons.map((b) => (b as HTMLButtonElement).disabled),
      };
    });

    const IGNORED_PAGE_ERROR_SUBSTRINGS = [
      // Common headless-only noise from ad slots; not injection-related.
      'adsbygoogle.push() error: No slot size',
    ];

    const relevantPageErrors = pageErrors.filter(
      (e) => !IGNORED_PAGE_ERROR_SUBSTRINGS.some((needle) => e.includes(needle))
    );

    return {
      ok: gum.ok && ui.videosWithStream > 0 && ui.streamTracksInVideoElements > 0 && relevantPageErrors.length === 0,
      gum,
      ui,
      pageErrors: relevantPageErrors,
      consoleErrors,
    };
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function main() {
  const workingInjectionScript = createWorkingInjectionScript({
    videoUri: null,
    devices: DEVICES as any,
    stealthMode: true,
    debugEnabled: false,
    targetWidth: 1080,
    targetHeight: 1920,
    targetFPS: 30,
    preferFrameGenerator: true,
  });
  
  const postLoadConfigBase = {
    devices: DEVICES as any,
    stealthMode: true,
    fallbackVideoUri: null,
    forceSimulation: true,
    protocolLabel: 'protocol',
    showOverlayLabel: false,
    loopVideo: true,
    mirrorVideo: false,
    debugEnabled: false,
    permissionPromptEnabled: false,
    useFrameGenerator: true,
  };
  
  const protocolRuns: ProtocolRun[] = [
    {
      name: 'Working Injection (app standard/allowlist path)',
      id: 'working',
      injectedBeforeLoad: createWorkingInjectionScript({
        videoUri: null,
        devices: DEVICES as any,
        stealthMode: true,
        debugEnabled: false,
        targetWidth: 1080,
        targetHeight: 1920,
        targetFPS: 30,
      }),
    },
    {
      name: 'Protocol 1: standard',
      id: 'standard',
      injectedBeforeLoad: workingInjectionScript,
      postLoadConfig: { ...postLoadConfigBase, protocolId: 'standard', protocolLabel: 'standard' },
    },
    {
      name: 'Protocol 2: allowlist (working injection path)',
      id: 'allowlist',
      injectedBeforeLoad: workingInjectionScript,
      postLoadConfig: { ...postLoadConfigBase, protocolId: 'allowlist', protocolLabel: 'allowlist' },
    },
    {
      name: 'Protocol 3: protected',
      id: 'protected',
      injectedBeforeLoad: createMediaInjectionScript(DEVICES as any, {
        protocolId: 'protected',
        protocolLabel: 'protected',
        stealthMode: true,
        forceSimulation: true,
        debugEnabled: false,
        permissionPromptEnabled: false,
        showOverlayLabel: false,
        loopVideo: true,
        mirrorVideo: false,
      }),
      postLoadConfig: { ...postLoadConfigBase, protocolId: 'protected', protocolLabel: 'protected' },
    },
    {
      name: 'Protocol 4: harness',
      id: 'harness',
      injectedBeforeLoad: createMediaInjectionScript(DEVICES as any, {
        protocolId: 'harness',
        protocolLabel: 'harness',
        stealthMode: true,
        forceSimulation: true,
        debugEnabled: false,
        permissionPromptEnabled: false,
        showOverlayLabel: false,
        loopVideo: true,
        mirrorVideo: false,
      }),
      postLoadConfig: { ...postLoadConfigBase, protocolId: 'harness', protocolLabel: 'harness' },
    },
    {
      name: 'Protocol 5: holographic (media injection fallback)',
      id: 'holographic',
      injectedBeforeLoad: createMediaInjectionScript(DEVICES as any, {
        protocolId: 'holographic',
        protocolLabel: 'holographic',
        stealthMode: true,
        forceSimulation: true,
        debugEnabled: false,
        permissionPromptEnabled: false,
        showOverlayLabel: false,
        loopVideo: true,
        mirrorVideo: false,
      }),
      postLoadConfig: { ...postLoadConfigBase, protocolId: 'holographic', protocolLabel: 'holographic' },
    },
    {
      name: 'Protocol 5: sonnet (AI-powered)',
      id: 'sonnet',
      injectedBeforeLoad: createSonnetProtocolScript(
        DEVICES as any,
        {
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
          learningMode: true,
        } as SonnetProtocolConfig,
        undefined
      ),
    },
    {
      name: 'Protocol 2: Advanced Relay (createAdvancedProtocol2Script path)',
      id: 'allowlist-advanced-relay',
      injectedBeforeLoad: createAdvancedProtocol2Script({
        devices: DEVICES as any,
        videoUri: undefined,
        enableWebRTCRelay: true,
        enableASI: true,
        enableGPU: false,
        enableCrypto: false,
        debugEnabled: false,
        stealthMode: true,
        protocolLabel: 'Protocol 2: Advanced Relay',
        showOverlayLabel: false,
      }),
      postLoadConfig: { ...postLoadConfigBase, protocolId: 'allowlist', protocolLabel: 'Protocol 2: Advanced Relay' },
    },
    {
      name: 'Protocol 6: WebSocket Bridge',
      id: 'websocket-bridge',
      injectedBeforeLoad: createWebSocketInjectionScript({
        width: 1080,
        height: 1920,
        fps: 30,
        devices: DEVICES as any,
        debug: false,
        stealthMode: true,
        protocolLabel: 'Protocol 6: WebSocket Bridge',
        showOverlay: false,
      }),
    },
  ];

  console.log(`[webcamtests] URL: ${TEST_URL}`);
  const results: Array<{ name: string; ok: boolean; details: any }> = [];

  for (const run of protocolRuns) {
    process.stdout.write(`[webcamtests] Running ${run.name}... `);
    const res = await runOnce(run);
    results.push({ name: run.name, ok: res.ok, details: res });
    console.log(res.ok ? 'OK' : 'FAIL');
    if (!res.ok) {
      console.log(JSON.stringify({ gum: res.gum, ui: res.ui, pageErrors: res.pageErrors, consoleErrors: res.consoleErrors }, null, 2));
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n[webcamtests] Summary:');
  for (const r of results) {
    console.log(`- ${r.ok ? 'PASS' : 'FAIL'}: ${r.name}`);
  }

  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('[webcamtests] Harness crashed:', e);
  process.exit(1);
});

