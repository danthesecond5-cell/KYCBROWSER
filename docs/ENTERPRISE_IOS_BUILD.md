 # Enterprise iOS Build (Private WebKit Flags)
 
 This project includes an **enterprise-only** WebView configuration that enables
 private WebKit flags to unlock camera spoofing features when standard APIs are missing.
 
 ## ⚠️ Important
 - These settings are **not App Store safe**.
 - Use **internal or enterprise distribution only**.
 - Private WebKit flags can change or break between iOS releases.
 
 ## What this enables
 - Attempts to enable **WebCodecs** (`MediaStreamTrackGenerator` / `VideoFrame`)
 - Attempts to enable **captureStream** and media device flags
 - Allows the app to spoof `getUserMedia()` even on restricted WKWebView builds
 
## In-app toggle
The Protocol Settings modal includes an **Enterprise iOS WebKit** toggle. This:
- Controls whether the app attempts to use enterprise-only features.
- Forces a WebView reload on change.
- Requires developer mode.

 ## How it works
 We patch `react-native-webview` to apply private WebKit flags using KVC when the
 `RNCEnterpriseWebKit` Info.plist flag is set to true.
 
## Optional custom flags
You can pass additional private keys or defaults via Info.plist:

- `RNCEnterpriseWebKitCustomPreferenceFlags` (array of strings)
- `RNCEnterpriseWebKitCustomConfigFlags` (array of strings)
- `RNCEnterpriseWebKitDefaults` (dictionary applied to `com.apple.WebKit` defaults)
- `RNCEnterpriseWebKitCustomPreferenceSettings` (dictionary of key/value pairs)
- `RNCEnterpriseWebKitCustomConfigSettings` (dictionary of key/value pairs)
- `RNCEnterpriseWebKitFrameworkPaths` (array of framework dylib paths to `dlopen`)
- `RNCEnterpriseWebKitFrameworkPath` (single framework dylib path)

These are **enterprise-only** and may break between iOS releases.

## Custom WebKit build (attempt)
If you maintain a custom WebKit build or private framework fork, you can **attempt**
to load it by embedding the dylib/framework and setting:

- `RNCEnterpriseWebKitFrameworkPaths` (preferred, array)
- `RNCEnterpriseWebKitFrameworkPath` (single path fallback)

The app will `dlopen()` the path(s) during WebView setup. This does **not** guarantee
WKWebView will use the custom engine, but it allows private symbols and keys from
your build to become available for KVC toggles.

This is enterprise-only and may require entitlements or internal signing workflows.

## Config plugin (auto-embed framework)
If you place a custom framework in:

```
enterprise/webkit/CustomWebKit.framework
```

the `withEnterpriseWebKit` config plugin will:
- Copy it into `ios/Frameworks/`
- Embed it in the Xcode project

By default the plugin requires the framework to exist and will fail prebuild
if it is missing. You can disable the requirement by setting:

```
{ "required": false }
```

This runs during:

```
npx expo prebuild --clean --platform ios
```

 ## Build Steps (Enterprise)
 1. Install dependencies:
    ```
    npm install
    ```
 
 2. Prebuild native iOS project:
    ```
    npx expo prebuild --clean --platform ios
    ```
 
3. Build with EAS enterprise profile:
    ```
    eas build -p ios --profile enterprise-ios
    ```

## Checksum validation
The custom framework binary is checksum-validated during prebuild.

Set a SHA256 via env:

```
CUSTOM_WEBKIT_SHA256=... eas build -p ios --profile enterprise-ios
```

To compute the hash:

```
shasum -a 256 enterprise/webkit/CustomWebKit.framework/CustomWebKit
```

If the SHA256 env var is not provided, the plugin will auto-generate and
write a checksum file next to the framework:

```
enterprise/webkit/CustomWebKit.framework.sha256
```

This becomes the expected checksum for subsequent builds.

## Multiple framework variants (per iOS version)
You can supply multiple frameworks and map them to iOS version ranges.
Example:

```
"plugins": [
  [
    "./plugins/withEnterpriseWebKit",
    {
      "frameworkVariants": [
        { "path": "enterprise/webkit/WebKit_iOS17.framework", "minVersion": "17.0" },
        { "path": "enterprise/webkit/WebKit_iOS18.framework", "minVersion": "18.0" }
      ],
      "checksumRequired": true,
      "autoGenerateChecksum": true
    }
  ]
]
```
 
## Hook telemetry (UI)
When enterprise hooks run, the native layer posts a report to the WebView
and the app will surface it in a modal:

- Applied flags
- Failed flags
- Loaded frameworks
- Failed frameworks

This helps validate which private keys actually stuck.

 ## Info.plist Flag
 This is enabled in `app.json`:
 
 ```
 ios.infoPlist.RNCEnterpriseWebKit = true
 ```
 
 If you need to disable it for App Store builds, set it to false or remove it.
 
 ## Troubleshooting
 - If iOS reports spoofing is unavailable, WebKit may still block these features.
 - Use the in-app capability logs:
   ```
   [WebView Capabilities] { captureStream: ..., frameGenerator: ..., spoofingAvailable: ... }
   ```
 
