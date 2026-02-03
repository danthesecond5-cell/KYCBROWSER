import Foundation
import CryptoKit

final class VideoCacheManager {
  private let queue = DispatchQueue(label: "webrtc.loopback.cache")
  private var inflight: [String: [((URL?) -> Void)]] = [:]
  private let cacheDirectory: URL
  private var ttlHours: Int
  private var maxSizeMB: Int

  init(ttlHours: Int = 24, maxSizeMB: Int = 1024) {
    let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
    cacheDirectory = base.appendingPathComponent("webrtc_loopback_cache", isDirectory: true)
    self.ttlHours = ttlHours
    self.maxSizeMB = maxSizeMB
    ensureDirectory()
  }

  func updateConfig(ttlHours: Int, maxSizeMB: Int) {
    self.ttlHours = ttlHours
    self.maxSizeMB = maxSizeMB
  }

  func cachedFileURL(for remoteURL: URL) -> URL? {
    ensureDirectory()
    let key = cacheKey(for: remoteURL)
    let fileURL = cacheDirectory.appendingPathComponent(key)
    guard FileManager.default.fileExists(atPath: fileURL.path) else { return nil }
    if isExpired(fileURL: fileURL) {
      try? FileManager.default.removeItem(at: fileURL)
      return nil
    }
    touch(fileURL: fileURL)
    return fileURL
  }

  func fetch(remoteURL: URL, completion: @escaping (URL?) -> Void) {
    queue.async {
      if let cached = self.cachedFileURL(for: remoteURL) {
        completion(cached)
        return
      }
      let key = self.cacheKey(for: remoteURL)
      if self.inflight[key] != nil {
        self.inflight[key]?.append(completion)
        return
      }
      self.inflight[key] = [completion]
      let task = URLSession.shared.downloadTask(with: remoteURL) { temp, _, _ in
        self.queue.async {
          var resultURL: URL? = nil
          if let temp = temp {
            let target = self.cacheDirectory.appendingPathComponent(key)
            try? FileManager.default.removeItem(at: target)
            do {
              try FileManager.default.moveItem(at: temp, to: target)
              resultURL = target
              self.touch(fileURL: target)
              self.pruneIfNeeded()
            } catch {
              resultURL = nil
            }
          }
          let callbacks = self.inflight[key] ?? []
          self.inflight[key] = nil
          callbacks.forEach { $0(resultURL) }
        }
      }
      task.resume()
    }
  }

  private func cacheKey(for url: URL) -> String {
    let data = Data(url.absoluteString.utf8)
    let hash = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    let ext = url.pathExtension.isEmpty ? "mp4" : url.pathExtension
    return "\(hash).\(ext)"
  }

  private func ensureDirectory() {
    if !FileManager.default.fileExists(atPath: cacheDirectory.path) {
      try? FileManager.default.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
    }
  }

  private func isExpired(fileURL: URL) -> Bool {
    guard ttlHours > 0 else { return false }
    guard let attrs = try? FileManager.default.attributesOfItem(atPath: fileURL.path),
          let modified = attrs[.modificationDate] as? Date else { return false }
    let expiry = modified.addingTimeInterval(TimeInterval(ttlHours * 3600))
    return Date() > expiry
  }

  private func touch(fileURL: URL) {
    try? FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: fileURL.path)
  }

  private func pruneIfNeeded() {
    guard maxSizeMB > 0 else { return }
    guard let files = try? FileManager.default.contentsOfDirectory(at: cacheDirectory, includingPropertiesForKeys: [.contentModificationDateKey, .fileSizeKey], options: []) else {
      return
    }
    let sorted = files.sorted { lhs, rhs in
      let l = (try? lhs.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? Date.distantPast
      let r = (try? rhs.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? Date.distantPast
      return l < r
    }
    var totalBytes = files.reduce(0) { acc, url in
      let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
      return acc + size
    }
    let maxBytes = maxSizeMB * 1024 * 1024
    if totalBytes <= maxBytes { return }
    for url in sorted {
      try? FileManager.default.removeItem(at: url)
      let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
      totalBytes -= size
      if totalBytes <= maxBytes { break }
    }
  }
}
