import Foundation
import AVFoundation
import CoreVideo

final class RingBufferRecorder {
  private let queue = DispatchQueue(label: "webrtc.loopback.ringbuffer")
  private let width: Int
  private let height: Int
  private let fps: Int
  private let segmentSeconds: Double
  private let maxSegments: Int
  private var writer: AVAssetWriter?
  private var input: AVAssetWriterInput?
  private var adaptor: AVAssetWriterInputPixelBufferAdaptor?
  private var audioInput: AVAssetWriterInput?
  private var segmentStartTime: CMTime?
  private var segments: [URL] = []

  init(width: Int, height: Int, fps: Int, ringBufferSeconds: Double, segmentSeconds: Double) {
    self.width = width
    self.height = height
    self.fps = max(1, fps)
    self.segmentSeconds = max(1.0, segmentSeconds)
    self.maxSegments = max(1, Int(ceil(ringBufferSeconds / segmentSeconds)))
  }

  func append(pixelBuffer: CVPixelBuffer, timeNs: Int64) {
    queue.async { [weak self] in
      self?._append(pixelBuffer: pixelBuffer, timeNs: timeNs)
    }
  }

  func appendAudioSample(_ sample: CMSampleBuffer, timeNs: Int64) {
    queue.async { [weak self] in
      self?._appendAudioSample(sample, timeNs: timeNs)
    }
  }

  func stop() {
    queue.sync {
      finishCurrentSegment()
      segments.removeAll()
    }
  }

  func getSegments() -> [String] {
    let sorted = segments.sorted { lhs, rhs in
      let lDate = (try? lhs.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? Date.distantPast
      let rDate = (try? rhs.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? Date.distantPast
      return lDate < rDate
    }
    return sorted.map { $0.path }
  }

  func clearSegments() {
    queue.sync {
      for url in segments {
        try? FileManager.default.removeItem(at: url)
      }
      segments.removeAll()
    }
  }

  private func _append(pixelBuffer: CVPixelBuffer, timeNs: Int64) {
    let time = CMTime(value: timeNs, timescale: 1_000_000_000)
    if writer == nil {
      startNewSegment(at: time)
    }

    guard let writer = writer, let input = input, let adaptor = adaptor else { return }
    if writer.status == .failed || writer.status == .cancelled {
      finishCurrentSegment()
      return
    }

    if input.isReadyForMoreMediaData {
      adaptor.append(pixelBuffer, withPresentationTime: time)
    }

    if let start = segmentStartTime {
      let elapsed = CMTimeGetSeconds(CMTimeSubtract(time, start))
      if elapsed >= segmentSeconds {
        rotateSegment()
      }
    }
  }

  private func _appendAudioSample(_ sample: CMSampleBuffer, timeNs: Int64) {
    let time = CMTime(value: timeNs, timescale: 1_000_000_000)
    if writer == nil {
      startNewSegment(at: time)
    }
    guard let writer = writer else { return }
    if audioInput == nil {
      setupAudioInput(from: sample, writer: writer)
    }
    guard let audioInput = audioInput else { return }
    guard writer.status == .writing else { return }
    if let retimed = retime(sample: sample, to: time), audioInput.isReadyForMoreMediaData {
      audioInput.append(retimed)
    }

    if let start = segmentStartTime {
      let elapsed = CMTimeGetSeconds(CMTimeSubtract(time, start))
      if elapsed >= segmentSeconds {
        rotateSegment()
      }
    }
  }

  private func startNewSegment(at time: CMTime) {
    let fileName = "loopback_segment_\(Int(Date().timeIntervalSince1970 * 1000)).mp4"
    let url = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent(fileName)
    try? FileManager.default.removeItem(at: url)

    guard let writer = try? AVAssetWriter(outputURL: url, fileType: .mp4) else { return }
    let settings: [String: Any] = [
      AVVideoCodecKey: AVVideoCodecType.h264,
      AVVideoWidthKey: width,
      AVVideoHeightKey: height,
    ]
    let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
    input.expectsMediaDataInRealTime = true
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
      kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA),
      kCVPixelBufferWidthKey as String: width,
      kCVPixelBufferHeightKey as String: height,
    ])
    if writer.canAdd(input) {
      writer.add(input)
    }
    writer.startWriting()
    writer.startSession(atSourceTime: time)

    self.writer = writer
    self.input = input
    self.adaptor = adaptor
    self.audioInput = nil
    self.segmentStartTime = time
  }

  private func rotateSegment() {
    finishCurrentSegment()
    if segments.count > maxSegments {
      let overflow = segments.count - maxSegments
      let toRemove = segments.prefix(overflow)
      toRemove.forEach { try? FileManager.default.removeItem(at: $0) }
      segments.removeFirst(overflow)
    }
  }

  private func finishCurrentSegment() {
    guard let writer = writer, let input = input else { return }
    input.markAsFinished()
    audioInput?.markAsFinished()
    writer.finishWriting {
      if writer.status == .completed {
        self.segments.append(writer.outputURL)
      }
    }
    self.writer = nil
    self.input = nil
    self.adaptor = nil
    self.audioInput = nil
    self.segmentStartTime = nil
  }

  private func setupAudioInput(from sample: CMSampleBuffer, writer: AVAssetWriter) {
    guard let format = CMSampleBufferGetFormatDescription(sample),
          let asbd = CMAudioFormatDescriptionGetStreamBasicDescription(format)?.pointee else { return }
    let settings: [String: Any] = [
      AVFormatIDKey: kAudioFormatMPEG4AAC,
      AVSampleRateKey: asbd.mSampleRate,
      AVNumberOfChannelsKey: Int(asbd.mChannelsPerFrame),
      AVEncoderBitRateKey: 128_000,
    ]
    let audioInput = AVAssetWriterInput(mediaType: .audio, outputSettings: settings)
    audioInput.expectsMediaDataInRealTime = true
    if writer.canAdd(audioInput) {
      writer.add(audioInput)
      self.audioInput = audioInput
    }
  }

  private func retime(sample: CMSampleBuffer, to time: CMTime) -> CMSampleBuffer? {
    var count: CMItemCount = 0
    CMSampleBufferGetSampleTimingInfoArray(sample, entryCount: 0, arrayToFill: nil, entriesNeededOut: &count)
    var timingInfo = Array(repeating: CMSampleTimingInfo(duration: .invalid, presentationTimeStamp: .invalid, decodeTimeStamp: .invalid), count: count)
    CMSampleBufferGetSampleTimingInfoArray(sample, entryCount: count, arrayToFill: &timingInfo, entriesNeededOut: &count)

    let original = CMSampleBufferGetPresentationTimeStamp(sample)
    let delta = CMTimeSubtract(time, original)
    for i in 0..<timingInfo.count {
      timingInfo[i].presentationTimeStamp = CMTimeAdd(timingInfo[i].presentationTimeStamp, delta)
    }
    var retimed: CMSampleBuffer?
    CMSampleBufferCreateCopyWithNewTiming(allocator: kCFAllocatorDefault, sampleBuffer: sample, sampleTimingEntryCount: count, sampleTimingArray: &timingInfo, sampleBufferOut: &retimed)
    return retimed
  }
}
