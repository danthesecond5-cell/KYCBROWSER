import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, Dimensions } from 'react-native';
import { Stack, router } from 'expo-router';
import { ChevronLeft, Cloud, Link as LinkIcon } from 'lucide-react-native';
import { APP_CONFIG } from '@/constants/app';

type ServerMsg =
  | { type: 'status'; status: 'starting' | 'ready' | 'closed' | 'error'; detail?: string }
  | { type: 'meta'; viewport: { width: number; height: number; deviceScaleFactor: number } }
  | { type: 'frame'; mime: 'image/jpeg'; width: number; height: number; ts: number; jpegBase64: string };

export default function RemoteBrowserScreen() {
  const [serverBaseUrl, setServerBaseUrl] = useState<string>('http://localhost:8787');
  const [targetUrl, setTargetUrl] = useState<string>(APP_CONFIG.WEBVIEW.TEST_URL);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('disconnected');
  const [frameUri, setFrameUri] = useState<string | null>(null);
  const [viewport, setViewport] = useState<{ width: number; height: number } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const imageLayoutRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const normalizedServer = useMemo(() => serverBaseUrl.replace(/\/+$/, ''), [serverBaseUrl]);

  const disconnect = useCallback(() => {
    try {
      wsRef.current?.close();
    } catch {}
    wsRef.current = null;
    setSessionId(null);
    setStatus('disconnected');
  }, []);

  useEffect(() => () => disconnect(), [disconnect]);

  const startSession = useCallback(async () => {
    disconnect();
    setStatus('starting');
    setFrameUri(null);

    const resp = await fetch(`${normalizedServer}/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: targetUrl,
        fps: 5,
        viewport: { width: 390, height: 844, deviceScaleFactor: 2 },
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => 'failed');
      setStatus(`server error: ${txt}`);
      return;
    }
    const data = (await resp.json()) as { id: string; wsPath: string };
    setSessionId(data.id);

    const wsUrl = `${normalizedServer.replace(/^http/i, 'ws')}${data.wsPath}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setStatus('connected');
    ws.onclose = () => setStatus('closed');
    ws.onerror = () => setStatus('ws error');
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as ServerMsg;
        if (msg.type === 'status') {
          setStatus(msg.status + (msg.detail ? `: ${msg.detail}` : ''));
        } else if (msg.type === 'meta') {
          setViewport({ width: msg.viewport.width, height: msg.viewport.height });
        } else if (msg.type === 'frame') {
          setFrameUri(`data:${msg.mime};base64,${msg.jpegBase64}`);
        }
      } catch {
        // ignore
      }
    };
  }, [disconnect, normalizedServer, targetUrl]);

  const handleTap = useCallback(
    (evt: any) => {
      const ws = wsRef.current;
      const vp = viewport;
      const box = imageLayoutRef.current;
      if (!ws || ws.readyState !== 1 || !vp || !box) return;

      const { locationX, locationY } = evt.nativeEvent;
      const rx = Math.max(0, Math.min(1, locationX / box.w));
      const ry = Math.max(0, Math.min(1, locationY / box.h));
      const x = Math.round(rx * vp.width);
      const y = Math.round(ry * vp.height);
      ws.send(JSON.stringify({ type: 'tap', x, y }));
    },
    [viewport]
  );

  const screenW = Dimensions.get('window').width;
  const previewH = Math.min(520, Math.floor(screenW * 1.6));

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Remote Browser',
          headerStyle: { backgroundColor: '#0a0a0a' },
          headerTintColor: '#ffffff',
          headerLeft: () => (
            <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
              <ChevronLeft size={24} color="#00ff88" />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.form}>
        <View style={styles.row}>
          <Cloud size={16} color="#00aaff" />
          <Text style={styles.label}>Server</Text>
        </View>
        <TextInput
          value={serverBaseUrl}
          onChangeText={setServerBaseUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://<server>:8787"
          placeholderTextColor="rgba(255,255,255,0.35)"
          style={styles.input}
        />

        <View style={[styles.row, { marginTop: 10 }]}>
          <LinkIcon size={16} color="#00aaff" />
          <Text style={styles.label}>Target URL</Text>
        </View>
        <TextInput
          value={targetUrl}
          onChangeText={setTargetUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={APP_CONFIG.WEBVIEW.TEST_URL}
          placeholderTextColor="rgba(255,255,255,0.35)"
          style={styles.input}
        />

        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryBtn} onPress={startSession}>
            <Text style={styles.primaryBtnText}>Start Session</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={disconnect}>
            <Text style={styles.secondaryBtnText}>Disconnect</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.meta}>
          Status: {status} {sessionId ? `• ${sessionId}` : ''}
        </Text>
      </View>

      <View style={[styles.preview, { height: previewH }]}>
        {frameUri ? (
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.previewTouchable}
            onPress={handleTap}
            onLayout={(e) => {
              const { x, y, width, height } = e.nativeEvent.layout;
              imageLayoutRef.current = { x, y, w: width, h: height };
            }}
          >
            <Image source={{ uri: frameUri }} style={styles.previewImage} resizeMode="cover" />
          </TouchableOpacity>
        ) : (
          <View style={styles.previewEmpty}>
            <Text style={styles.previewEmptyText}>No frames yet</Text>
            <Text style={styles.previewEmptyHint}>Start a session to stream the remote Chromium UI.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  headerButton: { padding: 8 },
  form: { padding: 16, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600' },
  input: {
    height: 42,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#ffffff',
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  primaryBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#00ff88',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#0a0a0a', fontWeight: '700' },
  secondaryBtn: {
    height: 42,
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { color: '#ffffff', fontWeight: '600' },
  meta: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 6 },
  preview: {
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.25)',
    backgroundColor: '#111111',
  },
  previewTouchable: { flex: 1 },
  previewImage: { width: '100%', height: '100%', backgroundColor: '#000' },
  previewEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  previewEmptyText: { color: '#ffffff', fontWeight: '700', marginBottom: 6 },
  previewEmptyHint: { color: 'rgba(255,255,255,0.6)', fontSize: 12, textAlign: 'center' },
});

