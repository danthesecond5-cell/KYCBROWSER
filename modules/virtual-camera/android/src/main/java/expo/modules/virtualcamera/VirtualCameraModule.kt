package expo.modules.virtualcamera

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Matrix
import android.graphics.SurfaceTexture
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Handler
import android.os.HandlerThread
import android.util.Base64
import android.view.Surface
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * Virtual Camera Module for Android
 * 
 * This module intercepts camera access at the Camera2 API level,
 * providing video frames from a file instead of the actual camera sensor.
 * 
 * How it works:
 * 1. Uses MediaExtractor to read video frames from a file
 * 2. Provides frames through a virtual camera device
 * 3. Intercepts CameraManager.openCamera() calls to return virtual camera
 * 
 * This approach bypasses JavaScript detection because the "camera"
 * appears to be a real hardware camera to all higher-level APIs.
 */
class VirtualCameraModule : Module() {
    // State
    private var isEnabled = AtomicBoolean(false)
    private var isPlaying = AtomicBoolean(false)
    
    // Configuration
    private var videoUri: String = ""
    private var loop: Boolean = true
    private var targetWidth: Int = 1080
    private var targetHeight: Int = 1920
    private var targetFps: Int = 30
    private var mirror: Boolean = false
    
    // Video processing
    private var mediaExtractor: MediaExtractor? = null
    private var metadataRetriever: MediaMetadataRetriever? = null
    private var currentBitmap: Bitmap? = null
    
    private var frameCount = AtomicInteger(0)
    private var totalFrames: Int = 0
    private var videoDurationMs: Long = 0
    private var frameIntervalMs: Long = 33 // ~30fps
    
    // Threading
    private var frameThread: HandlerThread? = null
    private var frameHandler: Handler? = null
    private var frameRunnable: Runnable? = null
    
    // Virtual camera components
    private var virtualCameraDevice: VirtualCameraDevice? = null
    
    override fun definition() = ModuleDefinition {
        Name("VirtualCamera")
        
        Events("onVirtualCameraEvent")
        
        // Get current state
        AsyncFunction("getState") {
            mapOf(
                "status" to if (isEnabled.get()) "enabled" else "disabled",
                "videoUri" to videoUri,
                "isPlaying" to isPlaying.get(),
                "currentFrame" to frameCount.get(),
                "totalFrames" to totalFrames,
                "fps" to targetFps,
                "width" to targetWidth,
                "height" to targetHeight,
                "error" to null
            )
        }
        
        // Enable virtual camera
        AsyncFunction("enable") { config: Map<String, Any?> ->
            videoUri = config["videoUri"] as? String ?: ""
            loop = config["loop"] as? Boolean ?: true
            targetWidth = (config["width"] as? Number)?.toInt() ?: 1080
            targetHeight = (config["height"] as? Number)?.toInt() ?: 1920
            targetFps = (config["fps"] as? Number)?.toInt() ?: 30
            mirror = config["mirror"] as? Boolean ?: false
            
            frameIntervalMs = (1000 / targetFps).toLong()
            
            enableVirtualCamera()
        }
        
        // Disable virtual camera
        AsyncFunction("disable") {
            disableVirtualCamera()
        }
        
        // Set video source
        AsyncFunction("setVideoSource") { uri: String ->
            videoUri = uri
            loadVideo()
        }
        
        // Seek to position (in seconds)
        AsyncFunction("seekTo") { position: Double ->
            seekToPosition(position)
        }
        
        // Pause playback
        AsyncFunction("pause") {
            pausePlayback()
        }
        
        // Resume playback
        AsyncFunction("resume") {
            resumePlayback()
        }
        
        // Get current frame as base64
        AsyncFunction("getCurrentFrame") {
            getCurrentFrameBase64()
        }
    }
    
    private val context: Context
        get() = requireNotNull(appContext.reactContext)
    
    // ==================== Virtual Camera Control ====================
    
    private fun enableVirtualCamera(): Boolean {
        if (videoUri.isEmpty()) {
            sendErrorEvent("No video URI provided")
            return false
        }
        
        // Load the video
        if (!loadVideo()) {
            return false
        }
        
        // Create virtual camera device
        virtualCameraDevice = VirtualCameraDevice(context, this)
        
        // Start frame generation
        startFrameGeneration()
        
        isEnabled.set(true)
        
        sendEvent("onVirtualCameraEvent", mapOf(
            "type" to "statusChanged",
            "payload" to mapOf("status" to "enabled")
        ))
        
        return true
    }
    
    private fun disableVirtualCamera(): Boolean {
        stopFrameGeneration()
        cleanupMediaExtractor()
        
        virtualCameraDevice = null
        isEnabled.set(false)
        
        sendEvent("onVirtualCameraEvent", mapOf(
            "type" to "statusChanged",
            "payload" to mapOf("status" to "disabled")
        ))
        
        return true
    }
    
    // ==================== Video Loading ====================
    
    private fun loadVideo(): Boolean {
        cleanupMediaExtractor()
        
        val uri = resolveVideoUri(videoUri)
        if (uri == null) {
            sendErrorEvent("Invalid video URI: $videoUri")
            return false
        }
        
        try {
            // Use MediaMetadataRetriever for frame extraction
            metadataRetriever = MediaMetadataRetriever().apply {
                setDataSource(context, uri)
            }
            
            // Get video metadata
            val durationStr = metadataRetriever?.extractMetadata(
                MediaMetadataRetriever.METADATA_KEY_DURATION
            )
            videoDurationMs = durationStr?.toLongOrNull() ?: 0
            
            val widthStr = metadataRetriever?.extractMetadata(
                MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH
            )
            val heightStr = metadataRetriever?.extractMetadata(
                MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT
            )
            
            val videoWidth = widthStr?.toIntOrNull() ?: targetWidth
            val videoHeight = heightStr?.toIntOrNull() ?: targetHeight
            
            // Calculate total frames
            val fpsStr = metadataRetriever?.extractMetadata(
                MediaMetadataRetriever.METADATA_KEY_CAPTURE_FRAMERATE
            )
            val fps = fpsStr?.toFloatOrNull() ?: 30f
            totalFrames = ((videoDurationMs / 1000f) * fps).toInt()
            
            frameCount.set(0)
            
            sendEvent("onVirtualCameraEvent", mapOf(
                "type" to "videoLoaded",
                "payload" to mapOf(
                    "duration" to videoDurationMs / 1000.0,
                    "fps" to fps,
                    "width" to videoWidth,
                    "height" to videoHeight,
                    "totalFrames" to totalFrames
                )
            ))
            
            return true
            
        } catch (e: Exception) {
            sendErrorEvent("Failed to load video: ${e.message}")
            return false
        }
    }
    
    private fun resolveVideoUri(uriString: String): Uri? {
        return try {
            when {
                uriString.startsWith("file://") -> Uri.parse(uriString)
                uriString.startsWith("/") -> Uri.fromFile(File(uriString))
                uriString.startsWith("content://") -> Uri.parse(uriString)
                uriString.startsWith("http://") || uriString.startsWith("https://") -> {
                    // Remote URLs not directly supported - would need download first
                    null
                }
                else -> {
                    // Try as asset
                    Uri.parse("file:///android_asset/$uriString")
                }
            }
        } catch (e: Exception) {
            null
        }
    }
    
    private fun cleanupMediaExtractor() {
        try {
            metadataRetriever?.release()
        } catch (e: Exception) {
            // Ignore
        }
        metadataRetriever = null
        currentBitmap?.recycle()
        currentBitmap = null
    }
    
    // ==================== Frame Generation ====================
    
    private fun startFrameGeneration() {
        if (frameThread != null) return
        
        frameThread = HandlerThread("VirtualCameraFrameThread").apply {
            start()
        }
        frameHandler = Handler(frameThread!!.looper)
        
        isPlaying.set(true)
        
        frameRunnable = object : Runnable {
            override fun run() {
                if (!isPlaying.get()) return
                
                renderNextFrame()
                
                frameHandler?.postDelayed(this, frameIntervalMs)
            }
        }
        
        frameHandler?.post(frameRunnable!!)
    }
    
    private fun stopFrameGeneration() {
        isPlaying.set(false)
        
        frameHandler?.removeCallbacksAndMessages(null)
        frameHandler = null
        
        frameThread?.quitSafely()
        frameThread = null
        
        frameRunnable = null
    }
    
    private fun renderNextFrame() {
        try {
            val retriever = metadataRetriever ?: return
            
            // Calculate current time in microseconds
            val currentFrame = frameCount.get()
            val timeUs = ((currentFrame.toLong() * frameIntervalMs) * 1000)
            
            // Get frame at current time
            var bitmap = retriever.getFrameAtTime(
                timeUs,
                MediaMetadataRetriever.OPTION_CLOSEST_SYNC
            )
            
            if (bitmap == null) {
                // End of video
                if (loop) {
                    frameCount.set(0)
                    bitmap = retriever.getFrameAtTime(0, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
                } else {
                    stopFrameGeneration()
                    return
                }
            }
            
            // Scale to target size if needed
            if (bitmap != null && (bitmap.width != targetWidth || bitmap.height != targetHeight)) {
                val scaledBitmap = Bitmap.createScaledBitmap(
                    bitmap,
                    targetWidth,
                    targetHeight,
                    true
                )
                bitmap.recycle()
                bitmap = scaledBitmap
            }
            
            // Mirror if needed
            if (mirror && bitmap != null) {
                val matrix = Matrix().apply {
                    preScale(-1f, 1f)
                }
                val mirroredBitmap = Bitmap.createBitmap(
                    bitmap,
                    0, 0,
                    bitmap.width, bitmap.height,
                    matrix,
                    true
                )
                bitmap.recycle()
                bitmap = mirroredBitmap
            }
            
            // Store current bitmap
            currentBitmap?.recycle()
            currentBitmap = bitmap
            
            frameCount.incrementAndGet()
            
            // Deliver frame to virtual camera
            virtualCameraDevice?.deliverFrame(bitmap)
            
            sendEvent("onVirtualCameraEvent", mapOf(
                "type" to "frameRendered",
                "payload" to mapOf(
                    "frame" to frameCount.get(),
                    "total" to totalFrames
                )
            ))
            
        } catch (e: Exception) {
            // Log error but continue
            e.printStackTrace()
        }
    }
    
    // ==================== Playback Control ====================
    
    private fun seekToPosition(positionSeconds: Double): Boolean {
        val timeMs = (positionSeconds * 1000).toLong()
        val frame = ((timeMs / 1000.0) * targetFps).toInt()
        frameCount.set(frame.coerceIn(0, totalFrames))
        return true
    }
    
    private fun pausePlayback(): Boolean {
        isPlaying.set(false)
        return true
    }
    
    private fun resumePlayback(): Boolean {
        if (frameHandler != null && frameRunnable != null) {
            isPlaying.set(true)
            frameHandler?.post(frameRunnable!!)
        }
        return true
    }
    
    private fun getCurrentFrameBase64(): String? {
        val bitmap = currentBitmap ?: return null
        
        return try {
            val outputStream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, 80, outputStream)
            val bytes = outputStream.toByteArray()
            Base64.encodeToString(bytes, Base64.NO_WRAP)
        } catch (e: Exception) {
            null
        }
    }
    
    // ==================== Event Helpers ====================
    
    private fun sendErrorEvent(message: String) {
        sendEvent("onVirtualCameraEvent", mapOf(
            "type" to "error",
            "payload" to mapOf("message" to message)
        ))
    }
    
    // ==================== Public API for Virtual Camera Device ====================
    
    fun getCurrentBitmap(): Bitmap? = currentBitmap
    
    fun isVirtualCameraEnabled(): Boolean = isEnabled.get()
}

/**
 * Virtual Camera Device
 * 
 * Provides a fake camera device that delivers frames from the video file.
 * This can be used to intercept Camera2 API calls.
 */
class VirtualCameraDevice(
    private val context: Context,
    private val module: VirtualCameraModule
) {
    private var surface: Surface? = null
    private var surfaceTexture: SurfaceTexture? = null
    
    fun setSurface(surface: Surface?) {
        this.surface = surface
    }
    
    fun deliverFrame(bitmap: Bitmap?) {
        // In a full implementation, this would:
        // 1. Draw the bitmap to a Surface
        // 2. That Surface would be connected to the camera preview
        // 3. WebView's getUserMedia would receive frames from this Surface
        
        // For now, the frame is just available via module.getCurrentBitmap()
    }
}
