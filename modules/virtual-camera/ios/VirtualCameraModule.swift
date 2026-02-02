import ExpoModulesCore
import AVFoundation
import UIKit
import CoreImage

/**
 * Virtual Camera Module for iOS
 * 
 * This module intercepts camera access at the AVFoundation level,
 * providing video frames from a file instead of the actual camera sensor.
 * 
 * How it works:
 * 1. Swizzles AVCaptureSession methods to inject our virtual session
 * 2. Reads frames from an AVAssetReader
 * 3. Provides frames through AVCaptureVideoDataOutput delegate
 * 
 * This approach bypasses JavaScript detection because the "camera"
 * appears to be a real hardware camera to all higher-level APIs.
 */
public class VirtualCameraModule: Module {
    // MARK: - Properties
    
    private var isEnabled = false
    private var videoAsset: AVAsset?
    private var assetReader: AVAssetReader?
    private var videoTrackOutput: AVAssetReaderTrackOutput?
    private var displayLink: CADisplayLink?
    private var currentPixelBuffer: CVPixelBuffer?
    
    private var config: VirtualCameraConfig = VirtualCameraConfig()
    private var frameCount: Int = 0
    private var totalFrames: Int = 0
    private var lastFrameTime: TimeInterval = 0
    
    private var virtualSession: VirtualCaptureSession?
    private static var swizzled = false
    
    // MARK: - Configuration
    
    struct VirtualCameraConfig {
        var videoUri: String = ""
        var loop: Bool = true
        var width: Int = 1080
        var height: Int = 1920
        var fps: Int = 30
        var mirror: Bool = false
    }
    
    // MARK: - Module Definition
    
    public func definition() -> ModuleDefinition {
        Name("VirtualCamera")
        
        Events("onVirtualCameraEvent")
        
        // Get current state
        AsyncFunction("getState") { () -> [String: Any] in
            return [
                "status": self.isEnabled ? "enabled" : "disabled",
                "videoUri": self.config.videoUri,
                "isPlaying": self.displayLink != nil,
                "currentFrame": self.frameCount,
                "totalFrames": self.totalFrames,
                "fps": self.config.fps,
                "width": self.config.width,
                "height": self.config.height,
                "error": nil as String?
            ]
        }
        
        // Enable virtual camera
        AsyncFunction("enable") { (configDict: [String: Any]) -> Bool in
            self.config.videoUri = configDict["videoUri"] as? String ?? ""
            self.config.loop = configDict["loop"] as? Bool ?? true
            self.config.width = configDict["width"] as? Int ?? 1080
            self.config.height = configDict["height"] as? Int ?? 1920
            self.config.fps = configDict["fps"] as? Int ?? 30
            self.config.mirror = configDict["mirror"] as? Bool ?? false
            
            return self.enableVirtualCamera()
        }
        
        // Disable virtual camera
        AsyncFunction("disable") { () -> Bool in
            return self.disableVirtualCamera()
        }
        
        // Set video source
        AsyncFunction("setVideoSource") { (videoUri: String) -> Bool in
            self.config.videoUri = videoUri
            return self.loadVideo()
        }
        
        // Seek to position
        AsyncFunction("seekTo") { (position: Double) -> Bool in
            return self.seekTo(position: position)
        }
        
        // Pause playback
        AsyncFunction("pause") { () -> Bool in
            self.stopDisplayLink()
            return true
        }
        
        // Resume playback
        AsyncFunction("resume") { () -> Bool in
            self.startDisplayLink()
            return true
        }
        
        // Get current frame as base64
        AsyncFunction("getCurrentFrame") { () -> String? in
            return self.getCurrentFrameBase64()
        }
    }
    
    // MARK: - Virtual Camera Control
    
    private func enableVirtualCamera() -> Bool {
        guard !config.videoUri.isEmpty else {
            sendEvent("onVirtualCameraEvent", [
                "type": "error",
                "payload": ["message": "No video URI provided"]
            ])
            return false
        }
        
        // Load the video
        guard loadVideo() else {
            return false
        }
        
        // Swizzle AVCaptureSession if not already done
        if !VirtualCameraModule.swizzled {
            swizzleAVCaptureSession()
            VirtualCameraModule.swizzled = true
        }
        
        // Create virtual session
        virtualSession = VirtualCaptureSession(module: self)
        
        // Start frame generation
        startDisplayLink()
        
        isEnabled = true
        
        sendEvent("onVirtualCameraEvent", [
            "type": "statusChanged",
            "payload": ["status": "enabled"]
        ])
        
        return true
    }
    
    private func disableVirtualCamera() -> Bool {
        stopDisplayLink()
        cleanupAssetReader()
        
        virtualSession = nil
        isEnabled = false
        
        sendEvent("onVirtualCameraEvent", [
            "type": "statusChanged",
            "payload": ["status": "disabled"]
        ])
        
        return true
    }
    
    // MARK: - Video Loading
    
    private func loadVideo() -> Bool {
        cleanupAssetReader()
        
        guard let url = resolveVideoUrl(config.videoUri) else {
            sendEvent("onVirtualCameraEvent", [
                "type": "error",
                "payload": ["message": "Invalid video URI: \(config.videoUri)"]
            ])
            return false
        }
        
        videoAsset = AVAsset(url: url)
        
        guard let asset = videoAsset else {
            return false
        }
        
        // Get video track
        guard let videoTrack = asset.tracks(withMediaType: .video).first else {
            sendEvent("onVirtualCameraEvent", [
                "type": "error",
                "payload": ["message": "No video track found in asset"]
            ])
            return false
        }
        
        // Calculate total frames
        let duration = CMTimeGetSeconds(asset.duration)
        let nominalFrameRate = videoTrack.nominalFrameRate
        totalFrames = Int(duration * Double(nominalFrameRate))
        
        // Create asset reader
        do {
            assetReader = try AVAssetReader(asset: asset)
        } catch {
            sendEvent("onVirtualCameraEvent", [
                "type": "error",
                "payload": ["message": "Failed to create asset reader: \(error.localizedDescription)"]
            ])
            return false
        }
        
        // Configure output settings for pixel buffer
        let outputSettings: [String: Any] = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
            kCVPixelBufferWidthKey as String: config.width,
            kCVPixelBufferHeightKey as String: config.height
        ]
        
        videoTrackOutput = AVAssetReaderTrackOutput(track: videoTrack, outputSettings: outputSettings)
        videoTrackOutput?.alwaysCopiesSampleData = false
        
        if let output = videoTrackOutput {
            assetReader?.add(output)
        }
        
        assetReader?.startReading()
        
        frameCount = 0
        
        sendEvent("onVirtualCameraEvent", [
            "type": "videoLoaded",
            "payload": [
                "duration": duration,
                "fps": nominalFrameRate,
                "width": videoTrack.naturalSize.width,
                "height": videoTrack.naturalSize.height,
                "totalFrames": totalFrames
            ]
        ])
        
        return true
    }
    
    private func resolveVideoUrl(_ uri: String) -> URL? {
        // Handle different URI schemes
        if uri.hasPrefix("file://") {
            return URL(string: uri)
        } else if uri.hasPrefix("/") {
            return URL(fileURLWithPath: uri)
        } else if uri.hasPrefix("http://") || uri.hasPrefix("https://") {
            // For remote URLs, you'd need to download first
            // For now, return nil (not supported)
            return nil
        } else if uri.hasPrefix("ph://") {
            // Photos library asset - would need to fetch from PHAsset
            return nil
        } else {
            // Try as a bundle resource
            if let path = Bundle.main.path(forResource: uri, ofType: nil) {
                return URL(fileURLWithPath: path)
            }
            return nil
        }
    }
    
    private func cleanupAssetReader() {
        assetReader?.cancelReading()
        assetReader = nil
        videoTrackOutput = nil
        currentPixelBuffer = nil
    }
    
    // MARK: - Frame Generation
    
    private func startDisplayLink() {
        guard displayLink == nil else { return }
        
        displayLink = CADisplayLink(target: self, selector: #selector(renderFrame))
        displayLink?.preferredFramesPerSecond = config.fps
        displayLink?.add(to: .main, forMode: .common)
        
        lastFrameTime = CACurrentMediaTime()
    }
    
    private func stopDisplayLink() {
        displayLink?.invalidate()
        displayLink = nil
    }
    
    @objc private func renderFrame() {
        guard let output = videoTrackOutput,
              let reader = assetReader,
              reader.status == .reading else {
            // If we're at the end and looping is enabled, restart
            if config.loop {
                _ = loadVideo()
                startDisplayLink()
            }
            return
        }
        
        // Read next sample buffer
        guard let sampleBuffer = output.copyNextSampleBuffer(),
              let imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
            // End of video
            if config.loop {
                _ = loadVideo()
            } else {
                stopDisplayLink()
            }
            return
        }
        
        // Apply mirror if needed
        if config.mirror {
            currentPixelBuffer = mirrorPixelBuffer(imageBuffer)
        } else {
            currentPixelBuffer = imageBuffer
        }
        
        frameCount += 1
        
        // Notify virtual session of new frame
        virtualSession?.deliverFrame(currentPixelBuffer)
        
        sendEvent("onVirtualCameraEvent", [
            "type": "frameRendered",
            "payload": [
                "frame": frameCount,
                "total": totalFrames
            ]
        ])
    }
    
    private func mirrorPixelBuffer(_ pixelBuffer: CVPixelBuffer) -> CVPixelBuffer? {
        let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
        let mirroredImage = ciImage.transformed(by: CGAffineTransform(scaleX: -1, y: 1))
        
        let context = CIContext()
        var outputBuffer: CVPixelBuffer?
        
        CVPixelBufferCreate(
            kCFAllocatorDefault,
            CVPixelBufferGetWidth(pixelBuffer),
            CVPixelBufferGetHeight(pixelBuffer),
            kCVPixelFormatType_32BGRA,
            nil,
            &outputBuffer
        )
        
        if let buffer = outputBuffer {
            context.render(mirroredImage, to: buffer)
        }
        
        return outputBuffer
    }
    
    // MARK: - Seek and Control
    
    private func seekTo(position: Double) -> Bool {
        guard let asset = videoAsset else { return false }
        
        let targetTime = CMTime(seconds: position, preferredTimescale: 600)
        
        // Recreate asset reader at new position
        cleanupAssetReader()
        
        guard let videoTrack = asset.tracks(withMediaType: .video).first else {
            return false
        }
        
        do {
            assetReader = try AVAssetReader(asset: asset)
        } catch {
            return false
        }
        
        assetReader?.timeRange = CMTimeRange(start: targetTime, duration: CMTime.positiveInfinity)
        
        let outputSettings: [String: Any] = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
        ]
        
        videoTrackOutput = AVAssetReaderTrackOutput(track: videoTrack, outputSettings: outputSettings)
        
        if let output = videoTrackOutput {
            assetReader?.add(output)
        }
        
        assetReader?.startReading()
        
        frameCount = Int(position * Double(config.fps))
        
        return true
    }
    
    private func getCurrentFrameBase64() -> String? {
        guard let pixelBuffer = currentPixelBuffer else { return nil }
        
        let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
        let context = CIContext()
        
        guard let cgImage = context.createCGImage(ciImage, from: ciImage.extent) else {
            return nil
        }
        
        let uiImage = UIImage(cgImage: cgImage)
        guard let imageData = uiImage.jpegData(compressionQuality: 0.8) else {
            return nil
        }
        
        return imageData.base64EncodedString()
    }
    
    // MARK: - Method Swizzling
    
    /**
     * Swizzle AVCaptureSession to intercept camera access
     * 
     * This replaces the actual camera session with our virtual one
     * that provides frames from the video file.
     */
    private func swizzleAVCaptureSession() {
        // Swizzle startRunning
        let originalStartRunning = class_getInstanceMethod(AVCaptureSession.self, #selector(AVCaptureSession.startRunning))
        let swizzledStartRunning = class_getInstanceMethod(VirtualCameraModule.self, #selector(VirtualCameraModule.swizzled_startRunning))
        
        if let original = originalStartRunning, let swizzled = swizzledStartRunning {
            method_exchangeImplementations(original, swizzled)
        }
        
        // Swizzle addInput
        let originalAddInput = class_getInstanceMethod(AVCaptureSession.self, #selector(AVCaptureSession.addInput(_:)))
        let swizzledAddInput = class_getInstanceMethod(VirtualCameraModule.self, #selector(VirtualCameraModule.swizzled_addInput(_:)))
        
        if let original = originalAddInput, let swizzled = swizzledAddInput {
            method_exchangeImplementations(original, swizzled)
        }
    }
    
    @objc private func swizzled_startRunning() {
        // If virtual camera is enabled, don't start the real session
        if VirtualCameraModule.sharedInstance?.isEnabled == true {
            print("[VirtualCamera] Intercepted startRunning - using virtual camera")
            return
        }
        
        // Call original (now swizzled to this method)
        self.swizzled_startRunning()
    }
    
    @objc private func swizzled_addInput(_ input: AVCaptureInput) {
        // If virtual camera is enabled and this is a camera input, skip it
        if VirtualCameraModule.sharedInstance?.isEnabled == true {
            if input is AVCaptureDeviceInput {
                let deviceInput = input as! AVCaptureDeviceInput
                if deviceInput.device.hasMediaType(.video) {
                    print("[VirtualCamera] Intercepted addInput for video device - skipping real camera")
                    return
                }
            }
        }
        
        // Call original
        self.swizzled_addInput(input)
    }
    
    // MARK: - Singleton for swizzling access
    
    private static var sharedInstance: VirtualCameraModule?
    
    override init() {
        super.init()
        VirtualCameraModule.sharedInstance = self
    }
    
    // MARK: - Current Frame Access
    
    func getCurrentPixelBuffer() -> CVPixelBuffer? {
        return currentPixelBuffer
    }
}

// MARK: - Virtual Capture Session

/**
 * A mock AVCaptureSession that delivers video frames from our video file
 */
class VirtualCaptureSession: NSObject {
    weak var module: VirtualCameraModule?
    private var outputs: [AVCaptureOutput] = []
    private var videoDataOutputs: [AVCaptureVideoDataOutput] = []
    
    init(module: VirtualCameraModule) {
        self.module = module
        super.init()
    }
    
    func addOutput(_ output: AVCaptureOutput) {
        outputs.append(output)
        
        if let videoOutput = output as? AVCaptureVideoDataOutput {
            videoDataOutputs.append(videoOutput)
        }
    }
    
    func deliverFrame(_ pixelBuffer: CVPixelBuffer?) {
        guard let buffer = pixelBuffer else { return }
        
        // Create a sample buffer from the pixel buffer
        var sampleBuffer: CMSampleBuffer?
        var timingInfo = CMSampleTimingInfo()
        timingInfo.presentationTimeStamp = CMTime(seconds: CACurrentMediaTime(), preferredTimescale: 600)
        timingInfo.duration = CMTime.invalid
        timingInfo.decodeTimeStamp = CMTime.invalid
        
        var formatDescription: CMVideoFormatDescription?
        CMVideoFormatDescriptionCreateForImageBuffer(
            allocator: kCFAllocatorDefault,
            imageBuffer: buffer,
            formatDescriptionOut: &formatDescription
        )
        
        guard let format = formatDescription else { return }
        
        CMSampleBufferCreateReadyWithImageBuffer(
            allocator: kCFAllocatorDefault,
            imageBuffer: buffer,
            formatDescription: format,
            sampleTiming: &timingInfo,
            sampleBufferOut: &sampleBuffer
        )
        
        guard let sample = sampleBuffer else { return }
        
        // Deliver to all registered video data outputs
        for output in videoDataOutputs {
            if let delegate = output.sampleBufferDelegate,
               let queue = output.sampleBufferCallbackQueue {
                queue.async {
                    delegate.captureOutput?(
                        output,
                        didOutput: sample,
                        from: AVCaptureConnection(inputPorts: [], output: output)
                    )
                }
            }
        }
    }
}
