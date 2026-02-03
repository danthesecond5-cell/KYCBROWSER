Pod::Spec.new do |s|
  s.name         = "WebRtcLoopback"
  s.version      = "1.0.0"
  s.summary      = "Native WebRTC loopback bridge for iOS WKWebView."
  s.license      = { :type => "MIT" }
  s.author       = "Rork"
  s.homepage     = "https://rork.com/"
  s.platforms    = { :ios => "13.0" }
  s.source       = { :path => "." }
  s.source_files = "WebRtcLoopback*.{h,m,mm,swift}", "AdvancedTestPatternCapturer.swift", "VideoFileCapturer.swift", "RingBufferRecorder.swift", "VideoCacheManager.swift"
  s.requires_arc = true
  s.swift_version = "5.9"

  s.dependency "React-Core"
  s.dependency "React-RCTBridge"
  s.dependency "React-RCTEventEmitter"
  s.dependency "GoogleWebRTC"
end
