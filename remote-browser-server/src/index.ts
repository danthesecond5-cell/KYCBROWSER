import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import type WebSocket from 'ws';
import crypto from 'node:crypto';
import { RemoteBrowserSession, type RemoteClientMessage } from './session';

const PORT = Number(process.env.PORT || 8787);

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const sessions = new Map<string, RemoteBrowserSession>();

function newId() {
  return crypto.randomBytes(12).toString('hex');
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, sessions: sessions.size });
});

app.post('/session', async (req, res) => {
  const startUrl = String(req.body?.url || 'https://webcamtests.com/recorder');
  const fps = req.body?.fps ? Number(req.body.fps) : 5;
  const viewport = req.body?.viewport || undefined;

  const id = newId();
  const session = new RemoteBrowserSession(id);
  sessions.set(id, session);

  try {
    await session.start({ startUrl, fps, viewport });
    res.json({
      id,
      wsPath: `/ws?sessionId=${encodeURIComponent(id)}`,
    });
  } catch (e: any) {
    sessions.delete(id);
    await session.close().catch(() => {});
    res.status(500).json({ error: e?.message || String(e) });
  }
});

app.delete('/session/:id', async (req, res) => {
  const id = String(req.params.id);
  const s = sessions.get(id);
  if (!s) return res.status(404).json({ error: 'not_found' });
  sessions.delete(id);
  await s.close().catch(() => {});
  res.json({ ok: true });
});

const server = app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[remote-browser] listening on :${PORT}`);
});

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws: WebSocket, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const sessionId = url.searchParams.get('sessionId');
  if (!sessionId) {
    ws.close();
    return;
  }
  const session = sessions.get(sessionId);
  if (!session) {
    ws.close();
    return;
  }

  session.attachClient(ws);

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(String(data)) as RemoteClientMessage;
      await session.handleClientMessage(msg);
    } catch {
      // ignore
    }
  });
});

