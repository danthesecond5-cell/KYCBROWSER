import Foundation
import WebRTC
import AVFoundation

final class VideoFileCapturer: RTCVideoCapturer {
  private let queue = DispatchQueue(label: "webrtc.loopback.filecapturer")
  private let audioQueue = DispatchQueue(label: "webrtc.loopback.fileaudio")
  private var player: AVPlayer?
  private var output: AVPlayerItemVideoOutput?
  private var audioReader: AVAssetReader?
  private var audioOutput: AVAssetReaderTrackOutput?
  private var timer: DispatchSourceTimer?
  private var fps: Int = 30
  private var loop: Bool = true
  private var lastTick: CFTimeInterval = 0
  private var startWallClockNs: Int64 = 0
  private var currentAsset: AVURLAsset?

  var onFrame: ((CVPixelBuffer, Int64) -> Void)?
  var onAudioSample: ((CMSampleBuffer, Int64) -> Void)?

  func start(url: URL, fps: Int, loop: Bool) {
    self.fps = max(1, fps)
    self.loop = loop
    stop()

    let asset = AVURLAsset(url: url)
    currentAsset = asset
    let item = AVPlayerItem(asset: asset)
    let attrs: [String: Any] = [
      kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA),
      kCVPixelBufferMetalCompatibilityKey as String: true,
      kCVPixelBufferOpenGLESCompatibilityKey as String: true,
      kCVPixelBufferIOSurfacePropertiesKey as String: [:],
    ]
    let output = AVPlayerItemVideoOutput(pixelBufferAttributes: attrs)
    output.suppressesPlayerRendering = true
    item.add(output)

    let player = AVPlayer(playerItem: item)
    player.actionAtItemEnd = .none
    self.player = player
    self.output = output

    if loop {
      NotificationCenter.default.addObserver(
        self,
        selector: #selector(handleDidPlayToEnd),
        name: .AVPlayerItemDidPlayToEndTime,
        object: item
      )
    }

    startWallClockNs = Int64(CACurrentMediaTime() * 1_000_000_000)
    startAudioReader(asset: asset)
    player.play()
    startTimer()
  }

  func stop() {
    timer?.cancel()
    timer = nil
    player?.pause()
    player = nil
    output = nil
    audioReader?.cancelReading()
    audioReader = nil
    audioOutput = nil
    NotificationCenter.default.removeObserver(self)
  }

  private func startTimer() {
    let timer = DispatchSource.makeTimerSource(queue: queue)
    let interval = DispatchTimeInterval.milliseconds(1000 / max(fps, 1))
    timer.schedule(deadline: .now(), repeating: interval)
    timer.setEventHandler { [weak self] in
      self?.captureFrame()
    }
    self.timer = timer
    timer.resume()
  }

  @objc private func handleDidPlayToEnd() {
    guard loop, let player = player else { return }
    player.seek(to: .zero)
    if let asset = currentAsset {
      startWallClockNs = Int64(CACurrentMediaTime() * 1_000_000_000)
      startAudioReader(asset: asset)
    }
    player.play()
  }

  private func captureFrame() {
    guard let output = output else { return }
    let now = CACurrentMediaTime()
    if now - lastTick < 1.0 / Double(max(fps, 1)) {
      return
    }
    lastTick = now

    let itemTime = output.itemTime(forHostTime: now)
    guard output.hasNewPixelBuffer(forItemTime: itemTime),
          let pixelBuffer = output.copyPixelBuffer(forItemTime: itemTime, itemTimeForDisplay: nil) else {
      return
    }

    let timestampNs = Int64(now * 1_000_000_000)
    let rtcBuffer = RTCCVPixelBuffer(pixelBuffer: pixelBuffer)
    let frame = RTCVideoFrame(buffer: rtcBuffer, rotation: ._0, timeStampNs: timestampNs)
    delegate?.capturer(self, didCapture: frame)
    onFrame?(pixelBuffer, timestampNs)
  }

  private func startAudioReader(asset: AVURLAsset) {
    audioReader?.cancelReading()
    audioReader = nil
    audioOutput = nil

    guard let audioTrack = asset.tracks(withMediaType: .audio).first else { return }
    guard let reader = try? AVAssetReader(asset: asset) else { return }
    let settings: [String: Any] = [
      AVFormatIDKey: kAudioFormatLinearPCM,
      AVLinearPCMIsFloatKey: false,
      AVLinearPCMBitDepthKey: 16,
      AVLinearPCMIsNonInterleaved: false,
    ]
    let output = AVAssetReaderTrackOutput(track: audioTrack, outputSettings: settings)
    output.alwaysCopiesSampleData = false
    if reader.canAdd(output) {
      reader.add(output)
    }
    reader.startReading()
    audioReader = reader
    audioOutput = output

    audioQueue.async { [weak self] in
      self?.readAudioSamples()
    }
  }

  private func readAudioSamples() {
    guard let reader = audioReader, let output = audioOutput else { return }
    while reader.status == .reading {
      guard let sample = output.copyNextSampleBuffer() else { break }
      let pts = CMSampleBufferGetPresentationTimeStamp(sample)
      let ptsSeconds = CMTimeGetSeconds(pts)
      let targetNs = startWallClockNs + Int64(ptsSeconds * 1_000_000_000)
      let nowNs = Int64(CACurrentMediaTime() * 1_000_000_000)
      if targetNs > nowNs {
        let sleepNs = targetNs - nowNs
        if sleepNs > 0 {
          Thread.sleep(forTimeInterval: Double(sleepNs) / 1_000_000_000.0)
        }
      }
      onAudioSample?(sample, targetNs)
    }
  }
}
