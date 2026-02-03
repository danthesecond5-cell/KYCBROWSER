import Foundation
import WebRTC
import CoreVideo
import CoreGraphics

final class AdvancedTestPatternCapturer: RTCVideoCapturer {
  private let queue = DispatchQueue(label: "webrtc.loopback.capturer")
  private var timer: DispatchSourceTimer?
  private var width: Int = 1080
  private var height: Int = 1920
  private var fps: Int = 30
  private var frameIndex: Int64 = 0
  var onFrame: ((CVPixelBuffer, Int64) -> Void)?

  func start(width: Int, height: Int, fps: Int) {
    self.width = max(2, width)
    self.height = max(2, height)
    self.fps = max(1, fps)
    stop()

    let timer = DispatchSource.makeTimerSource(queue: queue)
    timer.schedule(deadline: .now(), repeating: .milliseconds(1000 / self.fps))
    timer.setEventHandler { [weak self] in
      self?.generateFrame()
    }
    self.timer = timer
    timer.resume()
  }

  func stop() {
    timer?.cancel()
    timer = nil
  }

  private func generateFrame() {
    guard let pixelBuffer = createPixelBuffer(width: width, height: height) else { return }

    let timeStampNs = Int64(CACurrentMediaTime() * 1_000_000_000)
    let rtcBuffer = RTCCVPixelBuffer(pixelBuffer: pixelBuffer)
    let frame = RTCVideoFrame(buffer: rtcBuffer, rotation: ._0, timeStampNs: timeStampNs)
    delegate?.capturer(self, didCapture: frame)
    onFrame?(pixelBuffer, timeStampNs)
    frameIndex += 1
  }

  private func createPixelBuffer(width: Int, height: Int) -> CVPixelBuffer? {
    var pixelBuffer: CVPixelBuffer?
    let attrs: [CFString: Any] = [
      kCVPixelBufferPixelFormatTypeKey: kCVPixelFormatType_32BGRA,
      kCVPixelBufferWidthKey: width,
      kCVPixelBufferHeightKey: height,
      kCVPixelBufferCGImageCompatibilityKey: true,
      kCVPixelBufferCGBitmapContextCompatibilityKey: true,
    ]
    let status = CVPixelBufferCreate(kCFAllocatorDefault, width, height, kCVPixelFormatType_32BGRA, attrs as CFDictionary, &pixelBuffer)
    guard status == kCVReturnSuccess, let buffer = pixelBuffer else { return nil }

    CVPixelBufferLockBaseAddress(buffer, [])
    if let baseAddress = CVPixelBufferGetBaseAddress(buffer) {
      let bytesPerRow = CVPixelBufferGetBytesPerRow(buffer)
      let time = Double(frameIndex) / Double(max(fps, 1))
      let phase = sin(time * 2.0)

      for y in 0..<height {
        let row = baseAddress.advanced(by: y * bytesPerRow)
        let rowPtr = row.bindMemory(to: UInt8.self, capacity: bytesPerRow)
        for x in 0..<width {
          let offset = x * 4
          let gradient = Double(x) / Double(width)
          let pulse = (gradient * 180.0 + 40.0 + (phase * 30.0))
          let noise = Double((x * 31 + y * 17 + Int(frameIndex)) % 20)

          rowPtr[offset] = UInt8(max(0, min(255, pulse + noise))) // B
          rowPtr[offset + 1] = UInt8(max(0, min(255, 120 + noise))) // G
          rowPtr[offset + 2] = UInt8(max(0, min(255, 200 - noise))) // R
          rowPtr[offset + 3] = 255 // A
        }
      }
    }
    CVPixelBufferUnlockBaseAddress(buffer, [])
    return buffer
  }
}
