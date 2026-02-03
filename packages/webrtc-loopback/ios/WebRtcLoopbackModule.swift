import Foundation
import WebRTC
import React
import AVFoundation
import Photos

@objc(WebRtcLoopback)
class WebRtcLoopback: RCTEventEmitter, RTCPeerConnectionDelegate {
  private static var sslInitialized = false
  private let peerFactory: RTCPeerConnectionFactory
  private var peerConnection: RTCPeerConnection?
  private var audioSource: RTCAudioSource?
  private var videoCapturers: [AnyObject] = []
  private var videoTracks: [RTCVideoTrack] = []
  private var statsTimer: Timer?
  private var ringRecorder: RingBufferRecorder?
  private var config: LoopbackConfig = LoopbackConfig()
  private var lastOfferId: String?
  private var adaptiveBitrateKbps: Int = 0
  private var adaptiveScale: Double = 1.0
  private var lastAdaptationTs: TimeInterval = 0
  private let cacheManager = VideoCacheManager()

  override init() {
    if !WebRtcLoopback.sslInitialized {
      RTCInitializeSSL()
      WebRtcLoopback.sslInitialized = true
    }
    let encoderFactory = RTCDefaultVideoEncoderFactory()
    let decoderFactory = RTCDefaultVideoDecoderFactory()
    self.peerFactory = RTCPeerConnectionFactory(encoderFactory: encoderFactory, decoderFactory: decoderFactory)
    super.init()
  }

  override static func requiresMainQueueSetup() -> Bool {
    return false
  }

  override func supportedEvents() -> [String]! {
    return [
      "WebRtcLoopbackIceCandidate",
      "WebRtcLoopbackStats",
      "WebRtcLoopbackError",
      "WebRtcLoopbackState",
      "WebRtcLoopbackCacheReady"
    ]
  }

  @objc(createAnswer:resolver:rejecter:)
  func createAnswer(_ payload: NSDictionary, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    guard let offerDict = payload["offer"] as? NSDictionary,
          let sdp = offerDict["sdp"] as? String,
          let type = offerDict["type"] as? String else {
      rejecter("invalid_offer", "Missing offer payload", nil)
      return
    }

    let configDict = payload["config"] as? NSDictionary
    config = LoopbackConfig(configDict: configDict)
    lastOfferId = (configDict?["offerId"] as? String) ?? nil
    adaptiveBitrateKbps = max(config.minBitrateKbps, max(config.targetBitrateKbps, config.maxBitrateKbps))
    adaptiveScale = 1.0
    cacheManager.updateConfig(ttlHours: config.cacheTTLHours, maxSizeMB: config.cacheMaxSizeMB)

    let rtcConfig = RTCConfiguration()
    rtcConfig.sdpSemantics = .unifiedPlan
    rtcConfig.iceServers = config.iceServers
    rtcConfig.iceTransportPolicy = .all
    rtcConfig.bundlePolicy = .maxBundle
    rtcConfig.rtcpMuxPolicy = .require
    rtcConfig.continualGatheringPolicy = .gatherContinually

    let constraints = RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: ["DtlsSrtpKeyAgreement": "true"])
    let pc = peerFactory.peerConnection(with: rtcConfig, constraints: constraints, delegate: self)
    peerConnection = pc

    setupLocalTracks()
    applySenderTuning()
    cacheRemoteSources()

    let offerDescription = RTCSessionDescription(type: type == "offer" ? .offer : .answer, sdp: sdp)
    pc.setRemoteDescription(offerDescription) { [weak self] error in
      if let error = error {
        self?.emitError("Failed to set remote description: \(error.localizedDescription)")
        rejecter("remote_description_failed", error.localizedDescription, error)
        return
      }

      let answerConstraints = RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil)
      pc.answer(for: answerConstraints) { answer, err in
        if let err = err {
          self?.emitError("Failed to create answer: \(err.localizedDescription)")
          rejecter("answer_failed", err.localizedDescription, err)
          return
        }
        guard let answer = answer else {
          self?.emitError("Answer was nil")
          rejecter("answer_failed", "Answer was nil", nil)
          return
        }

        pc.setLocalDescription(answer) { setErr in
          if let setErr = setErr {
            self?.emitError("Failed to set local description: \(setErr.localizedDescription)")
            rejecter("local_description_failed", setErr.localizedDescription, setErr)
            return
          }

          self?.startStatsLoop()
          resolver(["sdp": answer.sdp, "type": "answer"])
        }
      }
    }
  }

  @objc(addIceCandidate:resolver:rejecter:)
  func addIceCandidate(_ payload: NSDictionary, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    guard let pc = peerConnection else {
      resolver(nil)
      return
    }
    guard let sdp = payload["candidate"] as? String,
          let sdpMid = payload["sdpMid"] as? String,
          let sdpMLineIndex = payload["sdpMLineIndex"] as? Int else {
      resolver(nil)
      return
    }
    let candidate = RTCIceCandidate(sdp: sdp, sdpMLineIndex: Int32(sdpMLineIndex), sdpMid: sdpMid)
    pc.add(candidate) { _ in
      resolver(nil)
    }
  }

  @objc(updateConfig:resolver:rejecter:)
  func updateConfig(_ payload: NSDictionary, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    config = LoopbackConfig(configDict: payload)
    adaptiveBitrateKbps = max(config.minBitrateKbps, max(config.targetBitrateKbps, config.maxBitrateKbps))
    cacheManager.updateConfig(ttlHours: config.cacheTTLHours, maxSizeMB: config.cacheMaxSizeMB)
    let shouldReloadSources =
      payload["videoSources"] != nil ||
      payload["targetWidth"] != nil ||
      payload["targetHeight"] != nil ||
      payload["targetFPS"] != nil
    if shouldReloadSources {
      setupLocalTracks()
    } else {
      configureRingRecorder()
    }
    applySenderTuning()
    if let pc = peerConnection, config.enableIceRestart {
      pc.restartIce()
    }
    cacheRemoteSources()
    resolver(nil)
  }

  @objc(stop:rejecter:)
  func stop(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    teardown()
    resolver(nil)
  }

  @objc(getStats:rejecter:)
  func getStats(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    guard let pc = peerConnection else {
      resolver([:])
      return
    }
    pc.statistics { report in
      resolver(self.extractStats(report))
    }
  }

  @objc(getRingBufferSegments:rejecter:)
  func getRingBufferSegments(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    resolver(ringRecorder?.getSegments() ?? [])
  }

  @objc(clearRingBuffer:rejecter:)
  func clearRingBuffer(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    ringRecorder?.clearSegments()
    resolver(nil)
  }

  @objc(exportRingBufferToPhotos:rejecter:)
  func exportRingBufferToPhotos(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    let segments = ringRecorder?.getSegments() ?? []
    guard !segments.isEmpty else {
      rejecter("no_segments", "Ring buffer is empty", nil)
      return
    }

    let exportURL = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("loopback_export_\(Int(Date().timeIntervalSince1970)).mp4")
    try? FileManager.default.removeItem(at: exportURL)

    let composition = AVMutableComposition()
    let compVideoTrack = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)
    let compAudioTrack = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)

    var currentTime = CMTime.zero
    for path in segments {
      let url = URL(fileURLWithPath: path)
      let asset = AVURLAsset(url: url)
      if let videoTrack = asset.tracks(withMediaType: .video).first {
        try? compVideoTrack?.insertTimeRange(CMTimeRange(start: .zero, duration: asset.duration), of: videoTrack, at: currentTime)
      }
      if let audioTrack = asset.tracks(withMediaType: .audio).first {
        try? compAudioTrack?.insertTimeRange(CMTimeRange(start: .zero, duration: asset.duration), of: audioTrack, at: currentTime)
      }
      currentTime = CMTimeAdd(currentTime, asset.duration)
    }

    guard let exporter = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality) else {
      rejecter("export_failed", "Unable to create export session", nil)
      return
    }
    exporter.outputURL = exportURL
    exporter.outputFileType = .mp4
    exporter.exportAsynchronously {
      if exporter.status != .completed {
        rejecter("export_failed", exporter.error?.localizedDescription ?? "Export failed", exporter.error)
        return
      }
      PHPhotoLibrary.requestAuthorization { status in
        guard status == .authorized || status == .limited else {
          rejecter("photos_denied", "Photo library permission denied", nil)
          return
        }
        PHPhotoLibrary.shared().performChanges({
          PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL: exportURL)
        }) { success, error in
          if success {
            resolver(nil)
          } else {
            rejecter("photos_failed", error?.localizedDescription ?? "Failed to save to Photos", error)
          }
        }
      }
    }
  }

  private func setupLocalTracks() {
    clearVideoTracks()
    configureRingRecorder()

    let sources = config.videoSources.isEmpty
      ? [VideoSourceConfig(id: "default", uri: nil, label: "Default", loop: true)]
      : config.videoSources

    for (index, source) in sources.enumerated() {
      let rtcSource = peerFactory.videoSource()
      let trackId = source.id.isEmpty ? "loopback_video_\(index)" : source.id
      let videoTrack = peerFactory.videoTrack(with: rtcSource, trackId: trackId)
      _ = peerConnection?.add(videoTrack, streamIds: ["loopback_stream", source.id])

      if let url = resolveVideoURL(source.uri) {
        let fileCapturer = VideoFileCapturer(delegate: rtcSource)
        if index == 0 {
          fileCapturer.onFrame = { [weak self] buffer, ts in
            self?.ringRecorder?.append(pixelBuffer: buffer, timeNs: ts)
          }
          fileCapturer.onAudioSample = { [weak self] sample, ts in
            self?.ringRecorder?.appendAudioSample(sample, timeNs: ts)
          }
        }
        fileCapturer.start(url: url, fps: config.targetFps, loop: source.loop)
        videoCapturers.append(fileCapturer)
      } else {
        let patternCapturer = AdvancedTestPatternCapturer(delegate: rtcSource)
        if index == 0 {
          patternCapturer.onFrame = { [weak self] buffer, ts in
            self?.ringRecorder?.append(pixelBuffer: buffer, timeNs: ts)
          }
        }
        patternCapturer.start(width: config.targetWidth, height: config.targetHeight, fps: config.targetFps)
        videoCapturers.append(patternCapturer)
      }

      videoTracks.append(videoTrack)
    }

    let audioConstraints = RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil)
    let audioSource = peerFactory.audioSource(with: audioConstraints)
    self.audioSource = audioSource
    let audioTrack = peerFactory.audioTrack(with: audioSource, trackId: "loopback_audio")
    _ = peerConnection?.add(audioTrack, streamIds: ["loopback_stream"])
  }

  private func clearVideoTracks() {
    for capturer in videoCapturers {
      if let pattern = capturer as? AdvancedTestPatternCapturer {
        pattern.stop()
      } else if let file = capturer as? VideoFileCapturer {
        file.stop()
      }
    }
    videoCapturers.removeAll()
    videoTracks.removeAll()
    ringRecorder?.stop()
    ringRecorder = nil
  }

  private func configureRingRecorder() {
    guard config.recordingEnabled else {
      ringRecorder?.stop()
      ringRecorder = nil
      return
    }
    let recorder = RingBufferRecorder(
      width: config.targetWidth,
      height: config.targetHeight,
      fps: config.targetFps,
      ringBufferSeconds: Double(config.ringBufferSeconds),
      segmentSeconds: Double(config.ringSegmentSeconds)
    )
    ringRecorder = recorder
  }

  private func resolveVideoURL(_ uri: String?) -> URL? {
    guard let uri = uri, !uri.isEmpty else { return nil }
    if uri.hasPrefix("builtin:") || uri.hasPrefix("canvas:") || uri.hasPrefix("data:") || uri.hasPrefix("blob:") || uri.hasPrefix("ph:") {
      return nil
    }
    if uri.hasPrefix("file://") {
      return URL(string: uri)
    }
    if uri.hasPrefix("/") {
      return URL(fileURLWithPath: uri)
    }
    if uri.hasPrefix("http://") || uri.hasPrefix("https://") {
      guard let remoteURL = URL(string: uri) else { return nil }
      if config.cacheRemoteVideos, let cached = cacheManager.cachedFileURL(for: remoteURL) {
        return cached
      }
      return remoteURL
    }
    return nil
  }

  private func cacheRemoteSources() {
    guard config.cacheRemoteVideos else { return }
    for source in config.videoSources {
      guard let uri = source.uri,
            uri.hasPrefix("http://") || uri.hasPrefix("https://"),
            let remoteURL = URL(string: uri) else { continue }
      cacheManager.fetch(remoteURL: remoteURL) { [weak self] cachedURL in
        guard let self = self, let cachedURL = cachedURL else { return }
        self.updateSource(id: source.id, newUri: cachedURL.absoluteString)
        DispatchQueue.main.async {
          self.setupLocalTracks()
        }
        self.sendEvent(withName: "WebRtcLoopbackCacheReady", body: ["id": source.id, "uri": cachedURL.absoluteString])
      }
    }
  }

  private func updateSource(id: String, newUri: String) {
    if let idx = config.videoSources.firstIndex(where: { $0.id == id }) {
      let existing = config.videoSources[idx]
      config.videoSources[idx] = VideoSourceConfig(id: existing.id, uri: newUri, label: existing.label, loop: existing.loop)
    }
  }

  private func applySenderTuning() {
    guard let pc = peerConnection else { return }
    for sender in pc.senders {
      guard sender.track?.kind == kRTCMediaStreamTrackKindVideo else { continue }
      var params = sender.parameters
      let scaleDown = config.enableAdaptiveResolution ? adaptiveScale : 1.0
      if config.enableSimulcast {
        let full = RTCRtpEncodingParameters()
        full.rid = "f"
        full.scaleResolutionDownBy = NSNumber(value: scaleDown)
        let half = RTCRtpEncodingParameters()
        half.rid = "h"
        half.scaleResolutionDownBy = NSNumber(value: scaleDown * 2.0)
        let quarter = RTCRtpEncodingParameters()
        quarter.rid = "q"
        quarter.scaleResolutionDownBy = NSNumber(value: scaleDown * 4.0)
        params.encodings = [full, half, quarter]
      } else if params.encodings.isEmpty {
        let base = RTCRtpEncodingParameters()
        base.scaleResolutionDownBy = NSNumber(value: scaleDown)
        params.encodings = [base]
      } else if config.enableAdaptiveResolution {
        params.encodings = params.encodings.map { encoding in
          let updated = encoding
          updated.scaleResolutionDownBy = NSNumber(value: scaleDown)
          return updated
        }
      }

      let bitrate = adaptiveBitrateKbps > 0 ? adaptiveBitrateKbps : config.maxBitrateKbps
      if bitrate > 0 {
        params.encodings = params.encodings.map { encoding in
          let updated = encoding
          updated.maxBitrateBps = NSNumber(value: bitrate * 1000)
          return updated
        }
      }
      sender.parameters = params
    }

    if let transceivers = pc.transceivers as? [RTCRtpTransceiver] {
      if let video = transceivers.first(where: { $0.mediaType == .video }) {
        applyCodecPreferences(transceiver: video)
      }
    }
  }

  private func applyCodecPreferences(transceiver: RTCRtpTransceiver) {
    let preferred = config.preferredCodec.lowercased()
    guard preferred != "auto",
          let caps = RTCRtpReceiver.getCapabilities(.video) else { return }
    let preferredCodecs = caps.codecs.filter { $0.mimeType.lowercased().contains(preferred) }
    if preferredCodecs.isEmpty { return }
    let otherCodecs = caps.codecs.filter { !preferredCodecs.contains($0) }
    transceiver.setCodecPreferences(preferredCodecs + otherCodecs)
  }

  private func startStatsLoop() {
    statsTimer?.invalidate()
    statsTimer = nil
    guard config.statsIntervalMs > 0 else { return }
    statsTimer = Timer.scheduledTimer(withTimeInterval: TimeInterval(config.statsIntervalMs) / 1000.0, repeats: true) { [weak self] _ in
      guard let self = self, let pc = self.peerConnection else { return }
      pc.statistics { report in
        let stats = self.extractStats(report)
        self.applyAdaptiveTuning(stats: stats)
        self.sendEvent(withName: "WebRtcLoopbackStats", body: stats)
      }
    }
  }

  private func extractStats(_ report: RTCStatisticsReport) -> [String: Any] {
    var result: [String: Any] = [:]
    for stat in report.statistics.values {
      if stat.type == "inbound-rtp", let kind = stat.values["kind"] as? String, kind == "video" {
        result["fps"] = stat.values["framesPerSecond"]
        result["packetsLost"] = stat.values["packetsLost"]
        result["jitter"] = stat.values["jitter"]
        result["bytesReceived"] = stat.values["bytesReceived"]
        result["frameWidth"] = stat.values["frameWidth"]
        result["frameHeight"] = stat.values["frameHeight"]
      }
      if stat.type == "outbound-rtp", let kind = stat.values["kind"] as? String, kind == "video" {
        result["packetsSent"] = stat.values["packetsSent"]
        result["bytesSent"] = stat.values["bytesSent"]
        result["framesPerSecond"] = stat.values["framesPerSecond"]
      }
    }
    result["timestamp"] = Date().timeIntervalSince1970
    return result
  }

  private func applyAdaptiveTuning(stats: [String: Any]) {
    guard config.enableAdaptiveBitrate || config.enableAdaptiveResolution else { return }
    let now = Date().timeIntervalSince1970
    if now - lastAdaptationTs < 2.0 {
      return
    }

    let fps = (stats["fps"] as? Double) ?? (stats["framesPerSecond"] as? Double) ?? 0
    let packetsLost = (stats["packetsLost"] as? Double) ?? 0
    let packetsSent = (stats["packetsSent"] as? Double) ?? 0
    let lossRatio = packetsSent > 0 ? packetsLost / packetsSent : 0
    let targetFps = Double(config.targetFps)

    var adjusted = false
    if lossRatio > 0.05 || (targetFps > 0 && fps < targetFps * 0.6) {
      if config.enableAdaptiveBitrate {
        let next = max(config.minBitrateKbps, Int(Double(max(adaptiveBitrateKbps, config.targetBitrateKbps)) * 0.8))
        if next != adaptiveBitrateKbps {
          adaptiveBitrateKbps = next
          adjusted = true
        }
      }
      if config.enableAdaptiveResolution {
        adaptiveScale = min(4.0, adaptiveScale * 1.5)
        adjusted = true
      }
    } else if lossRatio < 0.01 && (targetFps == 0 || fps > targetFps * 0.9) {
      if config.enableAdaptiveBitrate {
        let maxCap = config.maxBitrateKbps > 0 ? config.maxBitrateKbps : Int(Double(config.targetBitrateKbps) * 2.0)
        let next = min(maxCap, Int(Double(max(adaptiveBitrateKbps, config.targetBitrateKbps)) * 1.1))
        if next != adaptiveBitrateKbps {
          adaptiveBitrateKbps = next
          adjusted = true
        }
      }
      if config.enableAdaptiveResolution {
        adaptiveScale = max(1.0, adaptiveScale / 1.5)
        adjusted = true
      }
    }

    if adjusted {
      lastAdaptationTs = now
      applySenderTuning()
    }
  }

  private func emitError(_ message: String) {
    sendEvent(withName: "WebRtcLoopbackError", body: ["message": message])
  }

  private func teardown() {
    statsTimer?.invalidate()
    statsTimer = nil
    clearVideoTracks()
    audioSource = nil
    peerConnection?.close()
    peerConnection = nil
  }

  // MARK: - RTCPeerConnectionDelegate
  func peerConnection(_ peerConnection: RTCPeerConnection, didChange stateChanged: RTCSignalingState) {
    sendEvent(withName: "WebRtcLoopbackState", body: ["signaling": "\(stateChanged.rawValue)"])
  }

  func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceConnectionState) {
    sendEvent(withName: "WebRtcLoopbackState", body: ["iceConnection": "\(newState.rawValue)"])
  }

  func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceGatheringState) {
    sendEvent(withName: "WebRtcLoopbackState", body: ["iceGathering": "\(newState.rawValue)"])
  }

  func peerConnection(_ peerConnection: RTCPeerConnection, didGenerate candidate: RTCIceCandidate) {
    sendEvent(withName: "WebRtcLoopbackIceCandidate", body: [
      "candidate": [
        "candidate": candidate.sdp,
        "sdpMid": candidate.sdpMid ?? "",
        "sdpMLineIndex": Int(candidate.sdpMLineIndex)
      ],
      "offerId": lastOfferId ?? ""
    ])
  }

  func peerConnection(_ peerConnection: RTCPeerConnection, didRemove candidates: [RTCIceCandidate]) {}
  func peerConnectionShouldNegotiate(_ peerConnection: RTCPeerConnection) {}
  func peerConnection(_ peerConnection: RTCPeerConnection, didOpen dataChannel: RTCDataChannel) {}
  func peerConnection(_ peerConnection: RTCPeerConnection, didAdd stream: RTCMediaStream) {}
  func peerConnection(_ peerConnection: RTCPeerConnection, didRemove stream: RTCMediaStream) {}
  func peerConnection(_ peerConnection: RTCPeerConnection, didStartReceivingOn transceiver: RTCRtpTransceiver) {}
}

private struct VideoSourceConfig {
  let id: String
  let uri: String?
  let label: String?
  let loop: Bool
}

private struct LoopbackConfig {
  var targetWidth: Int = 1080
  var targetHeight: Int = 1920
  var targetFps: Int = 30
  var preferredCodec: String = "auto"
  var enableAdaptiveBitrate: Bool = true
  var enableAdaptiveResolution: Bool = true
  var minBitrateKbps: Int = 300
  var targetBitrateKbps: Int = 1200
  var maxBitrateKbps: Int = 0
  var enableSimulcast: Bool = false
  var enableIceRestart: Bool = true
  var statsIntervalMs: Int = 4000
  var recordingEnabled: Bool = true
  var ringBufferSeconds: Int = 15
  var ringSegmentSeconds: Int = 3
  var cacheRemoteVideos: Bool = true
  var cacheTTLHours: Int = 24
  var cacheMaxSizeMB: Int = 1024
  var iceServers: [RTCIceServer] = []
  var videoSources: [VideoSourceConfig] = []

  init() {}

  init(configDict: NSDictionary?) {
    if let target = configDict?["target"] as? NSDictionary {
      targetWidth = target["width"] as? Int ?? targetWidth
      targetHeight = target["height"] as? Int ?? targetHeight
      targetFps = target["fps"] as? Int ?? targetFps
    }
    targetWidth = configDict?["targetWidth"] as? Int ?? targetWidth
    targetHeight = configDict?["targetHeight"] as? Int ?? targetHeight
    targetFps = configDict?["targetFPS"] as? Int ?? targetFps
    preferredCodec = configDict?["preferredCodec"] as? String ?? preferredCodec
    enableAdaptiveBitrate = configDict?["enableAdaptiveBitrate"] as? Bool ?? enableAdaptiveBitrate
    enableAdaptiveResolution = configDict?["enableAdaptiveResolution"] as? Bool ?? enableAdaptiveResolution
    minBitrateKbps = configDict?["minBitrateKbps"] as? Int ?? minBitrateKbps
    targetBitrateKbps = configDict?["targetBitrateKbps"] as? Int ?? targetBitrateKbps
    maxBitrateKbps = configDict?["maxBitrateKbps"] as? Int ?? maxBitrateKbps
    enableSimulcast = configDict?["enableSimulcast"] as? Bool ?? enableSimulcast
    enableIceRestart = configDict?["enableIceRestart"] as? Bool ?? enableIceRestart
    statsIntervalMs = configDict?["statsIntervalMs"] as? Int ?? statsIntervalMs
    recordingEnabled = configDict?["recordingEnabled"] as? Bool ?? recordingEnabled
    ringBufferSeconds = configDict?["ringBufferSeconds"] as? Int ?? ringBufferSeconds
    ringSegmentSeconds = configDict?["ringSegmentSeconds"] as? Int ?? ringSegmentSeconds
    cacheRemoteVideos = configDict?["cacheRemoteVideos"] as? Bool ?? cacheRemoteVideos
    cacheTTLHours = configDict?["cacheTTLHours"] as? Int ?? cacheTTLHours
    cacheMaxSizeMB = configDict?["cacheMaxSizeMB"] as? Int ?? cacheMaxSizeMB

    if let sources = configDict?["videoSources"] as? [NSDictionary] {
      videoSources = sources.map { source in
        let id = source["id"] as? String ?? UUID().uuidString
        let uri = source["uri"] as? String
        let label = source["label"] as? String
        let loop = source["loop"] as? Bool ?? true
        return VideoSourceConfig(id: id, uri: uri, label: label, loop: loop)
      }
    }

    if let ice = configDict?["iceServers"] as? [NSDictionary] {
      iceServers = ice.compactMap { server in
        guard let urls = server["urls"] else { return nil }
        let username = server["username"] as? String
        let credential = server["credential"] as? String
        if let urlString = urls as? String {
          return RTCIceServer(urlStrings: [urlString], username: username ?? "", credential: credential ?? "")
        } else if let urlArray = urls as? [String] {
          return RTCIceServer(urlStrings: urlArray, username: username ?? "", credential: credential ?? "")
        }
        return nil
      }
    }
  }
}
