import Foundation
import AVFoundation
import Photos
import ExpoModulesCore
import WebRTC

private protocol CapturerLifecycle: AnyObject {
  func start()
  func stop()
}

private final class SyntheticVideoCapturer: RTCVideoCapturer, CapturerLifecycle {
  private var timer: DispatchSourceTimer?
  private var frameCount: Int64 = 0
  private let width: Int
  private let height: Int
  private let fps: Int

  init(delegate: RTCVideoCapturerDelegate, width: Int, height: Int, fps: Int) {
    self.width = width
    self.height = height
    self.fps = fps
    super.init(delegate: delegate)
  }

  func start() {
    if timer != nil { return }
    let queue = DispatchQueue(label: "native.media.bridge.synthetic.capturer")
    let timer = DispatchSource.makeTimerSource(queue: queue)
    let interval = DispatchTimeInterval.milliseconds(max(1, 1000 / max(1, fps)))
    timer.schedule(deadline: .now(), repeating: interval, leeway: .milliseconds(2))
    timer.setEventHandler { [weak self] in
      self?.emitFrame()
    }
    self.timer = timer
    timer.resume()
  }

  func stop() {
    timer?.cancel()
    timer = nil
  }

  private func emitFrame() {
    guard let delegate = delegate else { return }

    let buffer = RTCI420Buffer(width: width, height: height)
    let yPlane = buffer.dataY
    let uPlane = buffer.dataU
    let vPlane = buffer.dataV
    let yStride = buffer.strideY
    let uStride = buffer.strideU
    let vStride = buffer.strideV

    // Simple animated green pattern
    let baseY: UInt8 = UInt8(110 + (frameCount % 40))
    let baseU: UInt8 = 54
    let baseV: UInt8 = 34

    for y in 0..<height {
      let row = yPlane.advanced(by: y * yStride)
      for x in 0..<width {
        row[x] = baseY
      }
    }

    let chromaHeight = height / 2
    let chromaWidth = width / 2
    for y in 0..<chromaHeight {
      let uRow = uPlane.advanced(by: y * uStride)
      let vRow = vPlane.advanced(by: y * vStride)
      for x in 0..<chromaWidth {
        uRow[x] = baseU
        vRow[x] = baseV
      }
    }

    frameCount += 1
    let timeNs = Int64(CACurrentMediaTime() * 1_000_000_000)
    let frame = RTCVideoFrame(buffer: buffer, rotation: ._0, timeStampNs: timeNs)
    delegate.capturer(self, didCapture: frame)
  }
}

private final class FileVideoCapturer: RTCVideoCapturer, CapturerLifecycle {
  private let asset: AVAsset
  private let track: AVAssetTrack
  private let fps: Int
  private let loop: Bool
  private let queue: DispatchQueue
  private var reader: AVAssetReader?
  private var output: AVAssetReaderTrackOutput?
  private var timer: DispatchSourceTimer?
  private var isRunning = false

  init?(delegate: RTCVideoCapturerDelegate, url: URL, fps: Int, loop: Bool) {
    let asset = AVAsset(url: url)
    guard let track = asset.tracks(withMediaType: .video).first else {
      return nil
    }
    self.asset = asset
    self.track = track
    self.fps = fps
    self.loop = loop
    self.queue = DispatchQueue(label: "native.media.bridge.file.capturer")
    super.init(delegate: delegate)
  }

  func start() {
    if isRunning { return }
    isRunning = true
    configureReader()

    let intervalMs = max(1, 1000 / max(1, fps))
    let timer = DispatchSource.makeTimerSource(queue: queue)
    timer.schedule(deadline: .now(), repeating: .milliseconds(intervalMs), leeway: .milliseconds(2))
    timer.setEventHandler { [weak self] in
      self?.readFrame()
    }
    self.timer = timer
    timer.resume()
  }

  func stop() {
    isRunning = false
    timer?.cancel()
    timer = nil
    reader?.cancelReading()
    reader = nil
    output = nil
  }

  private func configureReader() {
    reader?.cancelReading()
    reader = nil
    output = nil

    guard let reader = try? AVAssetReader(asset: asset) else { return }
    let settings: [String: Any] = [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarFullRange
    ]
    let output = AVAssetReaderTrackOutput(track: track, outputSettings: settings)
    output.alwaysCopiesSampleData = false
    if reader.canAdd(output) {
      reader.add(output)
    }
    reader.startReading()
    self.reader = reader
    self.output = output
  }

  private func readFrame() {
    guard isRunning, let output = output, let reader = reader else { return }
    if reader.status == .failed || reader.status == .completed {
      handleEndOfFile()
      return
    }
    guard let sampleBuffer = output.copyNextSampleBuffer() else {
      handleEndOfFile()
      return
    }
    guard let imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }

    let rtcBuffer = RTCCVPixelBuffer(pixelBuffer: imageBuffer)
    let presentationTime = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
    let timeNs = Int64(presentationTime.seconds * 1_000_000_000)
    let frame = RTCVideoFrame(buffer: rtcBuffer, rotation: ._0, timeStampNs: timeNs)
    delegate?.capturer(self, didCapture: frame)
  }

  private func handleEndOfFile() {
    if loop {
      configureReader()
    } else {
      stop()
    }
  }
}

private final class NativeBridgeSession: NSObject, RTCPeerConnectionDelegate {
  let requestId: String
  let peerConnection: RTCPeerConnection
  let capturer: CapturerLifecycle
  let stream: RTCMediaStream
  let eventSink: (String, [String: Any]) -> Void
  let tempFileURL: URL?

  init(
    requestId: String,
    peerConnection: RTCPeerConnection,
    capturer: CapturerLifecycle,
    stream: RTCMediaStream,
    tempFileURL: URL?,
    eventSink: @escaping (String, [String: Any]) -> Void
  ) {
    self.requestId = requestId
    self.peerConnection = peerConnection
    self.capturer = capturer
    self.stream = stream
    self.tempFileURL = tempFileURL
    self.eventSink = eventSink
    super.init()
    self.peerConnection.delegate = self
  }

  func close() {
    capturer.stop()
    peerConnection.close()
    if let tempFileURL = tempFileURL {
      try? FileManager.default.removeItem(at: tempFileURL)
    }
  }

  func peerConnection(_ peerConnection: RTCPeerConnection, didGenerate candidate: RTCIceCandidate) {
    eventSink("nativeGumIce", [
      "requestId": requestId,
      "candidate": [
        "candidate": candidate.sdp,
        "sdpMLineIndex": candidate.sdpMLineIndex,
        "sdpMid": candidate.sdpMid ?? ""
      ]
    ])
  }

  func peerConnection(_ peerConnection: RTCPeerConnection, didChange stateChanged: RTCSignalingState) {}
  func peerConnection(_ peerConnection: RTCPeerConnection, didAdd stream: RTCMediaStream) {}
  func peerConnection(_ peerConnection: RTCPeerConnection, didRemove stream: RTCMediaStream) {}
  func peerConnectionShouldNegotiate(_ peerConnection: RTCPeerConnection) {}
  func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceConnectionState) {}
  func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceGatheringState) {}
  func peerConnection(_ peerConnection: RTCPeerConnection, didRemove candidates: [RTCIceCandidate]) {}
  func peerConnection(_ peerConnection: RTCPeerConnection, didOpen dataChannel: RTCDataChannel) {}
}

public final class NativeMediaBridgeModule: Module {
  private var factory: RTCPeerConnectionFactory?
  private var sessions: [String: NativeBridgeSession] = [:]
  
  private struct ResolvedVideoSource {
    let url: URL?
    let tempFileURL: URL?
  }

  private func parseBool(_ value: Any?, defaultValue: Bool) -> Bool {
    if let v = value as? Bool { return v }
    if let v = value as? String { return (v as NSString).boolValue }
    return defaultValue
  }

  private func parseInt(_ value: Any?, defaultValue: Int) -> Int {
    if let v = value as? Int { return v }
    if let v = value as? Double { return Int(v) }
    if let v = value as? String, let parsed = Int(v) { return parsed }
    return defaultValue
  }

  private func parseVideoUriString(_ constraints: [String: Any]?) -> String? {
    guard let constraints = constraints else { return nil }
    if let uri = constraints["videoUri"] as? String {
      return uri
    }
    if let video = constraints["video"] as? [String: Any],
       let uri = video["videoUri"] as? String {
      return uri
    }
    return nil
  }

  private func resolveFileURL(_ uri: String) -> URL? {
    let trimmed = uri.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty { return nil }
    if trimmed.hasPrefix("file://") {
      return URL(string: trimmed)
    }
    if trimmed.hasPrefix("/") {
      return URL(fileURLWithPath: trimmed)
    }
    return nil
  }
  
  private func mimeTypeToExtension(_ mimeType: String) -> String {
    switch mimeType.lowercased() {
    case "video/mp4":
      return "mp4"
    case "video/quicktime":
      return "mov"
    case "video/webm":
      return "webm"
    case "video/x-m4v":
      return "m4v"
    default:
      return "mp4"
    }
  }
  
  private func createTempFileURL(extension ext: String) -> URL {
    let filename = "native_bridge_\(UUID().uuidString).\(ext)"
    return FileManager.default.temporaryDirectory.appendingPathComponent(filename)
  }
  
  private func resolveDataUri(_ uri: String) throws -> ResolvedVideoSource? {
    guard let commaRange = uri.range(of: ",") else { return nil }
    let header = String(uri[..<commaRange.lowerBound])
    let dataPart = String(uri[commaRange.upperBound...])
    guard header.contains("base64") else { return nil }
    
    let mime = header.replacingOccurrences(of: "data:", with: "")
      .split(separator: ";")
      .first
      .map(String.init) ?? "video/mp4"
    
    let sanitized = dataPart.replacingOccurrences(of: "\n", with: "")
    guard let data = Data(base64Encoded: sanitized, options: .ignoreUnknownCharacters) else {
      return nil
    }
    
    let fileExt = mimeTypeToExtension(mime)
    let tempURL = createTempFileURL(extension: fileExt)
    try data.write(to: tempURL, options: .atomic)
    return ResolvedVideoSource(url: tempURL, tempFileURL: tempURL)
  }

  private func ensurePhotoLibraryAccess() async -> Bool {
    let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
    if status == .authorized || status == .limited { return true }
    if status == .notDetermined {
      return await withCheckedContinuation { continuation in
        PHPhotoLibrary.requestAuthorization(for: .readWrite) { newStatus in
          continuation.resume(returning: newStatus == .authorized || newStatus == .limited)
        }
      }
    }
    return false
  }
  
  private func exportAVAssetToTempFile(_ asset: AVAsset) async throws -> ResolvedVideoSource {
    return try await withCheckedThrowingContinuation { continuation in
      guard let export = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetHighestQuality) else {
        continuation.resume(throwing: NSError(domain: "NativeMediaBridge", code: 5, userInfo: [NSLocalizedDescriptionKey: "Export session unavailable"]))
        return
      }
      
      let tempURL = createTempFileURL(extension: "mp4")
      if FileManager.default.fileExists(atPath: tempURL.path) {
        try? FileManager.default.removeItem(at: tempURL)
      }
      
      export.outputURL = tempURL
      export.outputFileType = .mp4
      export.exportAsynchronously {
        switch export.status {
        case .completed:
          continuation.resume(returning: ResolvedVideoSource(url: tempURL, tempFileURL: tempURL))
        case .failed, .cancelled:
          let message = export.error?.localizedDescription ?? "Export failed"
          continuation.resume(throwing: NSError(domain: "NativeMediaBridge", code: 6, userInfo: [NSLocalizedDescriptionKey: message]))
        default:
          let message = export.error?.localizedDescription ?? "Export failed"
          continuation.resume(throwing: NSError(domain: "NativeMediaBridge", code: 7, userInfo: [NSLocalizedDescriptionKey: message]))
        }
      }
    }
  }
  
  private func resolvePhotoLibraryUri(_ uri: String) async throws -> ResolvedVideoSource? {
    let identifier = uri.replacingOccurrences(of: "ph://", with: "")
    if identifier.isEmpty { return nil }

    let permitted = await ensurePhotoLibraryAccess()
    if !permitted { return nil }
    
    return try await withCheckedThrowingContinuation { continuation in
      let assets = PHAsset.fetchAssets(withLocalIdentifiers: [identifier], options: nil)
      guard let asset = assets.firstObject else {
        continuation.resume(returning: nil)
        return
      }
      
      let options = PHVideoRequestOptions()
      options.isNetworkAccessAllowed = true
      options.deliveryMode = .highQualityFormat
      
      PHImageManager.default().requestAVAsset(forVideo: asset, options: options) { avAsset, _, _ in
        if let urlAsset = avAsset as? AVURLAsset {
          continuation.resume(returning: ResolvedVideoSource(url: urlAsset.url, tempFileURL: nil))
          return
        }
        if let avAsset = avAsset {
          Task {
            do {
              let exported = try await self.exportAVAssetToTempFile(avAsset)
              continuation.resume(returning: exported)
            } catch {
              continuation.resume(returning: nil)
            }
          }
          return
        }
        continuation.resume(returning: nil)
      }
    }
  }
  
  private func resolveVideoSource(_ constraints: [String: Any]?) async -> ResolvedVideoSource? {
    guard let uri = parseVideoUriString(constraints) else { return nil }
    let trimmed = uri.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty { return nil }
    
    if let fileURL = resolveFileURL(trimmed) {
      return ResolvedVideoSource(url: fileURL, tempFileURL: nil)
    }
    
    if trimmed.hasPrefix("data:") {
      return try? resolveDataUri(trimmed)
    }
    
    if trimmed.hasPrefix("ph://") {
      return try? await resolvePhotoLibraryUri(trimmed)
    }
    
    return nil
  }

  public func definition() -> ModuleDefinition {
    Name("NativeMediaBridge")
    Events("nativeGumIce", "nativeGumError")

    AsyncFunction("createSession") { (requestId: String, offer: [String: Any], constraints: [String: Any]?, rtcConfig: [String: Any]?) -> [String: Any] in
      let inputConstraints = constraints
      if self.factory == nil {
        RTCInitializeSSL()
        self.factory = RTCPeerConnectionFactory()
      }
      guard let factory = self.factory else {
        throw NSError(domain: "NativeMediaBridge", code: 1, userInfo: [NSLocalizedDescriptionKey: "WebRTC factory unavailable"])
      }

      let config = RTCConfiguration()
      config.iceServers = []

      let rtcConstraints = RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil)
      guard let peerConnection = factory.peerConnection(with: config, constraints: rtcConstraints, delegate: nil) else {
        throw NSError(domain: "NativeMediaBridge", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to create RTCPeerConnection"])
      }

      let targetWidth = parseInt(inputConstraints?["targetWidth"], defaultValue: 1080)
      let targetHeight = parseInt(inputConstraints?["targetHeight"], defaultValue: 1920)
      let targetFPS = parseInt(inputConstraints?["targetFPS"], defaultValue: 30)
      let loopVideo = parseBool(inputConstraints?["loopVideo"], defaultValue: true)

      let videoSource = factory.videoSource()
      let resolvedSource = await resolveVideoSource(inputConstraints)
      let capturer: CapturerLifecycle
      if let url = resolvedSource?.url, let fileCapturer = FileVideoCapturer(delegate: videoSource, url: url, fps: targetFPS, loop: loopVideo) {
        capturer = fileCapturer
      } else {
        capturer = SyntheticVideoCapturer(delegate: videoSource, width: targetWidth, height: targetHeight, fps: targetFPS)
      }
      let videoTrack = factory.videoTrack(with: videoSource, trackId: "native_video_\(requestId)")

      let stream = factory.mediaStream(withStreamId: "native_stream_\(requestId)")
      stream.addVideoTrack(videoTrack)
      _ = peerConnection.add(videoTrack, streamIds: [stream.streamId])

      let session = NativeBridgeSession(
        requestId: requestId,
        peerConnection: peerConnection,
        capturer: capturer,
        stream: stream,
        tempFileURL: resolvedSource?.tempFileURL,
        eventSink: { [weak self] eventName, payload in
          self?.sendEvent(eventName, payload)
        }
      )
      sessions[requestId] = session

      capturer.start()

      guard
        let sdp = offer["sdp"] as? String,
        let type = offer["type"] as? String
      else {
        sessions.removeValue(forKey: requestId)
        session.close()
        throw NSError(domain: "NativeMediaBridge", code: 3, userInfo: [NSLocalizedDescriptionKey: "Invalid offer payload"])
      }
      
      let sessionType: RTCSdpType
      switch type.lowercased() {
      case "offer":
        sessionType = .offer
      case "answer":
        sessionType = .answer
      case "pranswer":
        sessionType = .prAnswer
      case "rollback":
        sessionType = .rollback
      default:
        sessions.removeValue(forKey: requestId)
        session.close()
        throw NSError(domain: "NativeMediaBridge", code: 3, userInfo: [NSLocalizedDescriptionKey: "Unsupported SDP type"])
      }

      let remoteDesc = RTCSessionDescription(type: sessionType, sdp: sdp)
      return try await withCheckedThrowingContinuation { continuation in
        peerConnection.setRemoteDescription(remoteDesc) { error in
          if let error = error {
            session.close()
            self.sessions.removeValue(forKey: requestId)
            continuation.resume(throwing: error)
            return
          }

          peerConnection.answer(for: RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil)) { answer, answerError in
            if let answerError = answerError {
              session.close()
              self.sessions.removeValue(forKey: requestId)
              continuation.resume(throwing: answerError)
              return
            }

            guard let answer = answer else {
              session.close()
              self.sessions.removeValue(forKey: requestId)
              continuation.resume(throwing: NSError(domain: "NativeMediaBridge", code: 4, userInfo: [NSLocalizedDescriptionKey: "No answer created"]))
              return
            }

            peerConnection.setLocalDescription(answer) { localError in
              if let localError = localError {
                session.close()
                self.sessions.removeValue(forKey: requestId)
                continuation.resume(throwing: localError)
                return
              }

              continuation.resume(returning: [
                "type": "answer",
                "sdp": answer.sdp
              ])
            }
          }
        }
      }
    }

    AsyncFunction("addIceCandidate") { (requestId: String, candidate: [String: Any]) -> Void in
      guard let session = self.sessions[requestId] else { return }
      guard let sdp = candidate["candidate"] as? String else { return }
      let sdpMid = candidate["sdpMid"] as? String
      let sdpMLineIndex = candidate["sdpMLineIndex"] as? Int32 ?? 0
      let iceCandidate = RTCIceCandidate(sdp: sdp, sdpMLineIndex: sdpMLineIndex, sdpMid: sdpMid)
      session.peerConnection.add(iceCandidate)
    }

    AsyncFunction("closeSession") { (requestId: String) -> Void in
      guard let session = self.sessions[requestId] else { return }
      session.close()
      self.sessions.removeValue(forKey: requestId)
    }
  }
}
