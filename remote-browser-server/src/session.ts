import type { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright';
import type WebSocket from 'ws';
import { ensureSyntheticY4m } from './y4m';

export type SessionId = string;

export type RemoteFrameMessage = {
  type: 'frame';
  mime: 'image/jpeg';
  width: number;
  height: number;
  ts: number;
  jpegBase64: string;
};

export type RemoteStatusMessage =
  | { type: 'status'; status: 'starting' | 'ready' | 'closed' | 'error'; detail?: string }
  | { type: 'meta'; viewport: { width: number; height: number; deviceScaleFactor: number } };

export type RemoteClientMessage =
  | { type: 'navigate'; url: string }
  | { type: 'tap'; x: number; y: number }
  | { type: 'click'; x: number; y: number; button?: 'left' | 'middle' | 'right' }
  | { type: 'scroll'; dx: number; dy: number }
  | { type: 'type'; text: string }
  | { type: 'key'; key: string }
  | { type: 'viewport'; width: number; height: number; deviceScaleFactor?: number };

export type CreateSessionOptions = {
  startUrl: string;
  viewport?: { width: number; height: number; deviceScaleFactor?: number };
  fps?: number;
};

export class RemoteBrowserSession {
  readonly id: SessionId;

  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private clients = new Set<WebSocket>();
  private closed = false;
  private lastFrameAt = 0;
  private frameInFlight = false;
  private frameTimer: NodeJS.Timeout | null = null;

  private viewport = { width: 390, height: 844, deviceScaleFactor: 2 };

  constructor(id: SessionId) {
    this.id = id;
  }

  async start(opts: CreateSessionOptions) {
    this.viewport = {
      width: opts.viewport?.width ?? 390,
      height: opts.viewport?.height ?? 844,
      deviceScaleFactor: opts.viewport?.deviceScaleFactor ?? 2,
    };

    const fakeVideoPath = ensureSyntheticY4m({
      width: 640,
      height: 480,
      fps: 30,
      seconds: 3,
    });

    // Enterprise iOS path: browser runs remotely, camera is replaced at Chromium level.
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--autoplay-policy=no-user-gesture-required',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-video-capture=${fakeVideoPath}`,
      ],
    });

    this.context = await this.browser.newContext({
      viewport: { width: this.viewport.width, height: this.viewport.height },
      deviceScaleFactor: this.viewport.deviceScaleFactor,
      ignoreHTTPSErrors: true,
    });
    await this.context.grantPermissions(['camera', 'microphone']);

    this.page = await this.context.newPage();
    await this.page.goto(opts.startUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    this.broadcast({ type: 'meta', viewport: this.viewport });
    this.broadcast({ type: 'status', status: 'ready' });

    const fps = Math.max(1, Math.min(12, opts.fps ?? 5)); // keep bandwidth sane
    const intervalMs = Math.floor(1000 / fps);
    this.frameTimer = setInterval(() => void this.tickFrame(), intervalMs);
  }

  attachClient(ws: WebSocket) {
    this.clients.add(ws);
    ws.on('close', () => this.clients.delete(ws));
    // Immediately send status/meta if ready
    this.broadcast({ type: 'meta', viewport: this.viewport }, ws);
    this.broadcast({ type: 'status', status: this.page ? 'ready' : 'starting' }, ws);
  }

  async handleClientMessage(msg: RemoteClientMessage) {
    const page = this.page;
    if (!page) return;

    switch (msg.type) {
      case 'navigate':
        await page.goto(msg.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        return;
      case 'tap':
        await page.mouse.click(msg.x, msg.y);
        return;
      case 'click':
        await page.mouse.click(msg.x, msg.y, { button: msg.button ?? 'left' });
        return;
      case 'scroll':
        await page.mouse.wheel(msg.dx, msg.dy);
        return;
      case 'type':
        await page.keyboard.type(msg.text);
        return;
      case 'key':
        await page.keyboard.press(msg.key);
        return;
      case 'viewport': {
        const ctx = this.context;
        if (!ctx) return;
        this.viewport = {
          width: Math.max(200, Math.min(1200, msg.width)),
          height: Math.max(200, Math.min(2000, msg.height)),
          deviceScaleFactor: msg.deviceScaleFactor ?? this.viewport.deviceScaleFactor,
        };
        await ctx.setViewportSize({ width: this.viewport.width, height: this.viewport.height });
        this.broadcast({ type: 'meta', viewport: this.viewport });
        return;
      }
    }
  }

  private async tickFrame() {
    if (this.closed) return;
    if (!this.page) return;
    if (this.frameInFlight) return;
    const now = Date.now();
    if (now - this.lastFrameAt < 50) return;
    this.frameInFlight = true;
    try {
      const jpeg = await this.page.screenshot({ type: 'jpeg', quality: 60, fullPage: false });
      const msg: RemoteFrameMessage = {
        type: 'frame',
        mime: 'image/jpeg',
        width: this.viewport.width,
        height: this.viewport.height,
        ts: Date.now(),
        jpegBase64: jpeg.toString('base64'),
      };
      this.broadcast(msg);
      this.lastFrameAt = now;
    } catch (e: any) {
      this.broadcast({ type: 'status', status: 'error', detail: e?.message || String(e) });
    } finally {
      this.frameInFlight = false;
    }
  }

  private broadcast(msg: RemoteStatusMessage | RemoteFrameMessage, only?: WebSocket) {
    const payload = JSON.stringify(msg);
    const targets = only ? [only] : Array.from(this.clients);
    for (const ws of targets) {
      try {
        ws.send(payload);
      } catch {}
    }
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    if (this.frameTimer) clearInterval(this.frameTimer);
    this.broadcast({ type: 'status', status: 'closed' });
    for (const ws of this.clients) {
      try {
        ws.close();
      } catch {}
    }
    this.clients.clear();
    await this.page?.close().catch(() => {});
    await this.context?.close().catch(() => {});
    await this.browser?.close().catch(() => {});
    this.page = null;
    this.context = null;
    this.browser = null;
  }
}

