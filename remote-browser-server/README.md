# Remote Browser Server (iOS-safe camera replacement)

This server runs the target website inside **server-side Chromium** with a **virtual camera** (Chromium fake capture). The mobile app connects over WebSocket and receives a live JPEG stream of the page.

This is the most reliable iOS-compatible approach because iOS WKWebView cannot be hooked at the camera pipeline level in a production-safe way.

## Setup

```bash
cd remote-browser-server
npm i
npm run install:browsers
```

## Run

```bash
cd remote-browser-server
npm run dev
```

Default port: `8787`

## Create a session

```bash
curl -X POST http://localhost:8787/session \
  -H 'content-type: application/json' \
  -d '{"url":"https://webcamtests.com/recorder","fps":5}'
```

Response includes `id` and `wsPath`. Connect the app to:

`ws://<server-host>:8787/ws?sessionId=<id>`

## Self-test (server-side)

```bash
cd remote-browser-server
npm run selftest:webcamtests
```

