import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { Platform } from 'react-native';
import {
  SavedVideo,
  DownloadProgress,
  downloadVideoFromUrl,
  copyLocalVideo,
  deleteVideo,
  listSavedVideos,
  getVideoFileInfo,
  ensureVideosDirectory,
  generateVideoId,
  regenerateThumbnail,
  isVideoReadyForSimulation,
  extractVideoMetadataFromUri,
} from '@/utils/videoManager';
import {
  checkVideoCompatibilityWithPlayback,
  type CompatibilityResult,
} from '@/utils/videoCompatibilityChecker';
import { ensureBundledSampleVideo, isBundledSampleVideo } from '@/utils/sampleVideo';

interface ProcessingState {
  isProcessing: boolean;
  progress: number;
  stage: 'idle' | 'copying' | 'downloading' | 'processing' | 'generating_thumbnail' | 'extracting_metadata' | 'complete' | 'error';
  message: string;
  error?: string;
}

interface VideoLibraryContextValue {
  savedVideos: SavedVideo[];
  isLoading: boolean;
  processingState: ProcessingState;
  downloadAndSaveVideo: (url: string) => Promise<SavedVideo | null>;
  saveLocalVideo: (uri: string, name: string) => Promise<SavedVideo | null>;
  removeVideo: (id: string) => Promise<boolean>;
  refreshVideoList: () => Promise<void>;
  clearProcessingState: () => void;
  getVideoById: (id: string) => SavedVideo | undefined;
  regenerateVideoThumbnail: (id: string) => Promise<boolean>;
  isVideoReady: (id: string) => boolean;
  selectVideoForSimulation: (id: string) => SavedVideo | undefined;
  checkCompatibility: (idOrVideo: string | SavedVideo) => Promise<CompatibilityResult | null>;
  pendingVideoForApply: SavedVideo | null;
  setPendingVideoForApply: (video: SavedVideo | null) => void;
}

const VIDEOS_METADATA_KEY = '@video_library_metadata_v2';

const initialProcessingState: ProcessingState = {
  isProcessing: false,
  progress: 0,
  stage: 'idle',
  message: '',
};

const getStageMessage = (stage: DownloadProgress['stage'] | 'extracting_metadata' | 'copying', progress: number): string => {
  switch (stage) {
    case 'copying':
      return `Copying video... ${Math.round(progress * 100)}%`;
    case 'downloading':
      return `Downloading video... ${Math.round(progress * 100)}%`;
    case 'processing':
      return 'Processing video file...';
    case 'generating_thumbnail':
      return 'Generating thumbnail...';
    case 'extracting_metadata':
      return 'Analyzing video dimensions...';
    case 'complete':
      return 'Video saved successfully!';
    default:
      return 'Processing...';
  }
};

export const [VideoLibraryProvider, useVideoLibrary] = createContextHook<VideoLibraryContextValue>(() => {
  const [savedVideos, setSavedVideos] = useState<SavedVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingState, setProcessingState] = useState<ProcessingState>(initialProcessingState);
  const [pendingVideoForApply, setPendingVideoForApply] = useState<SavedVideo | null>(null);
  
  const isMountedRef = useRef(true);
  const isRefreshingRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const saveQueueRef = useRef(Promise.resolve());

  const loadVideosMetadata = useCallback(async (): Promise<SavedVideo[]> => {
    try {
      const stored = await AsyncStorage.getItem(VIDEOS_METADATA_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          console.log('[VideoLibrary] Loaded', parsed.length, 'videos from storage');
          return parsed;
        }
      }
    } catch (error) {
      console.error('[VideoLibrary] Failed to load metadata:', error);
    }
    return [];
  }, []);

  const saveVideosMetadata = useCallback(async (videos: SavedVideo[]): Promise<void> => {
    try {
      await AsyncStorage.setItem(VIDEOS_METADATA_KEY, JSON.stringify(videos));
      console.log('[VideoLibrary] Saved metadata for', videos.length, 'videos');
    } catch (error) {
      console.error('[VideoLibrary] Failed to save metadata:', error);
    }
  }, []);

  const queueSaveVideos = useCallback((videos: SavedVideo[]) => {
    saveQueueRef.current = saveQueueRef.current
      .then(() => saveVideosMetadata(videos))
      .catch(() => saveVideosMetadata(videos));
  }, [saveVideosMetadata]);

  const persistCompatibilityResult = useCallback((videoId: string, result: CompatibilityResult) => {
    const compatibility = {
      overallStatus: result.overallStatus,
      score: result.score,
      readyForSimulation: result.readyForSimulation,
      checkedAt: new Date().toISOString(),
    };

    setSavedVideos(prev => {
      const updated = prev.map(video =>
        video.id === videoId
          ? { ...video, compatibility }
          : video
      );
      queueSaveVideos(updated);
      return updated;
    });
  }, [queueSaveVideos]);

  const syncWithFileSystem = useCallback(async (): Promise<SavedVideo[]> => {
    const storedMetadata = await loadVideosMetadata();
    const existingSample = storedMetadata.find(isBundledSampleVideo) || null;
    const sampleVideo = await ensureBundledSampleVideo(existingSample);

    if (Platform.OS === 'web') {
      const filtered = storedMetadata.filter(video => !isBundledSampleVideo(video));
      const allVideos = sampleVideo ? [sampleVideo, ...filtered] : filtered;
      const shouldSave = Boolean(sampleVideo && (!existingSample || existingSample.uri !== sampleVideo.uri));

      if (shouldSave) {
        await saveVideosMetadata(allVideos);
      }

      return allVideos;
    }

    console.log('[VideoLibrary] Syncing with file system...');
    ensureVideosDirectory();

    const actualFiles = listSavedVideos();
    const actualUris = new Set(actualFiles.map(f => f.uri));
    const fallbackSample = existingSample && actualUris.has(existingSample.uri) ? existingSample : null;
    const sampleToUse = sampleVideo || fallbackSample;
    const sampleUri = sampleToUse?.uri;

    const validMetadata = storedMetadata.filter(v =>
      actualUris.has(v.uri) && !isBundledSampleVideo(v)
    );

    const metadataUris = new Set(validMetadata.map(v => v.uri));
    const newFiles = actualFiles.filter(f =>
      !metadataUris.has(f.uri) && (!sampleUri || f.uri !== sampleUri)
    );

    const newVideosPromises = newFiles.map(async (file) => {
      const info = getVideoFileInfo(file);
      const id = await generateVideoId();
      return {
        id,
        name: info.name || 'Unknown',
        originalName: info.originalName || 'Unknown',
        uri: file.uri,
        sourceType: 'local' as const,
        fileSize: info.fileSize || 0,
        createdAt: info.createdAt || new Date().toISOString(),
      };
    });

    const newVideos = await Promise.all(newVideosPromises);
    let allVideos = [...validMetadata, ...newVideos];

    if (sampleToUse) {
      allVideos = [
        sampleToUse,
        ...allVideos.filter(video => !isBundledSampleVideo(video)),
      ];
    }

    allVideos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const baseChanged = validMetadata.length !== storedMetadata.filter(v => !isBundledSampleVideo(v)).length;
    const sampleChanged = Boolean(sampleToUse && (!existingSample || existingSample.uri !== sampleToUse.uri));
    const shouldSave = baseChanged || newVideos.length > 0 || sampleChanged;

    if (shouldSave) {
      await saveVideosMetadata(allVideos);
    }

    console.log('[VideoLibrary] Sync complete:', allVideos.length, 'videos');
    return allVideos;
  }, [loadVideosMetadata, saveVideosMetadata]);

  const refreshVideoList = useCallback(async (): Promise<void> => {
    if (isRefreshingRef.current) {
      console.log('[VideoLibrary] Refresh already in progress, skipping');
      return;
    }
    
    isRefreshingRef.current = true;
    setIsLoading(true);
    
    try {
      // Use setTimeout to yield to the main thread and prevent blocking
      await new Promise(resolve => setTimeout(resolve, 0));
      
      if (!isMountedRef.current) {
        console.log('[VideoLibrary] Component unmounted during refresh, aborting');
        return;
      }
      
      const videos = await syncWithFileSystem();
      
      if (isMountedRef.current) {
        setSavedVideos(videos);
      }
    } catch (error) {
      console.error('[VideoLibrary] Failed to refresh:', error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
      isRefreshingRef.current = false;
    }
  }, [syncWithFileSystem]);

  // Only run once on mount - don't depend on refreshVideoList to avoid re-running
  useEffect(() => {
    console.log('[VideoLibrary] Provider mounted, initializing...');
    isMountedRef.current = true;
    
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      refreshVideoList();
    }
    
    return () => {
      console.log('[VideoLibrary] Provider unmounting');
      isMountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps intentionally - only run once on mount

  const downloadAndSaveVideo = useCallback(async (url: string): Promise<SavedVideo | null> => {
    console.log('[VideoLibrary] Starting video download:', url);
    
    setProcessingState({
      isProcessing: true,
      progress: 0.05,
      stage: 'downloading',
      message: 'Starting download...',
    });

    const onProgress = (progress: DownloadProgress) => {
      const normalizedProgress = progress.progress * 0.5; // 0-50%
      setProcessingState(prev => ({
        ...prev,
        progress: normalizedProgress,
        stage: progress.stage,
        message: getStageMessage(progress.stage, progress.progress),
      }));
    };

    const result = await downloadVideoFromUrl(url, onProgress);

    if (!result.success || !result.video) {
      setProcessingState({
        isProcessing: false,
        progress: 0,
        stage: 'error',
        message: 'Download failed',
        error: result.error,
      });
      return null;
    }

    setProcessingState({
      isProcessing: true,
      progress: 0.55,
      stage: 'extracting_metadata',
      message: 'Analyzing video dimensions...',
    });

    const onMetadataProgress = (progress: number, message: string) => {
      const normalizedProgress = 0.55 + (progress * 0.4); // 55-95%
      setProcessingState(prev => ({
        ...prev,
        progress: normalizedProgress,
        message: message || 'Analyzing video...',
      }));
    };

    const metadata = await extractVideoMetadataFromUri(result.video.uri, onMetadataProgress);
    const videoWithMetadata: SavedVideo = {
      ...result.video,
      metadata,
    };

    console.log('[VideoLibrary] Extracted metadata:', metadata);

    setProcessingState({
      isProcessing: true,
      progress: 0.98,
      stage: 'complete',
      message: 'Saving to library...',
    });

    setSavedVideos(prev => {
      const updated = [videoWithMetadata, ...prev];
      queueSaveVideos(updated);
      return updated;
    });

    setProcessingState({
      isProcessing: false,
      progress: 1,
      stage: 'complete',
      message: 'Video saved successfully!',
    });

    console.log('[VideoLibrary] Video saved:', videoWithMetadata.name);
    return videoWithMetadata;
  }, [queueSaveVideos]);

  const saveLocalVideo = useCallback(async (uri: string, name: string): Promise<SavedVideo | null> => {
    console.log('[VideoLibrary] Saving local video:', uri);
    
    setProcessingState({
      isProcessing: true,
      progress: 0.05,
      stage: 'copying',
      message: 'Starting import...',
    });

    const onProgress = (progress: DownloadProgress) => {
      const normalizedProgress = progress.progress * 0.5; // 0-50%
      let stage: 'copying' | 'processing' | 'generating_thumbnail' | 'complete' = 'copying';
      if (progress.stage === 'processing') stage = 'processing';
      else if (progress.stage === 'generating_thumbnail') stage = 'generating_thumbnail';
      else if (progress.stage === 'complete') stage = 'generating_thumbnail';
      
      setProcessingState(prev => ({
        ...prev,
        progress: normalizedProgress,
        stage,
        message: getStageMessage(stage, normalizedProgress),
      }));
    };

    const result = await copyLocalVideo(uri, name, onProgress);

    if (!result.success || !result.video) {
      setProcessingState({
        isProcessing: false,
        progress: 0,
        stage: 'error',
        message: 'Failed to save video',
        error: result.error,
      });
      return null;
    }

    setProcessingState({
      isProcessing: true,
      progress: 0.55,
      stage: 'extracting_metadata',
      message: 'Analyzing video dimensions...',
    });

    const onMetadataProgress = (progress: number, message: string) => {
      const normalizedProgress = 0.55 + (progress * 0.4); // 55-95%
      setProcessingState(prev => ({
        ...prev,
        progress: normalizedProgress,
        message: message || 'Analyzing video...',
      }));
    };

    const metadata = await extractVideoMetadataFromUri(result.video.uri, onMetadataProgress);
    const videoWithMetadata: SavedVideo = {
      ...result.video,
      metadata,
    };

    console.log('[VideoLibrary] Extracted metadata:', metadata);

    setProcessingState({
      isProcessing: true,
      progress: 0.98,
      stage: 'complete',
      message: 'Saving to library...',
    });

    setSavedVideos(prev => {
      const updated = [videoWithMetadata, ...prev];
      queueSaveVideos(updated);
      return updated;
    });

    setProcessingState({
      isProcessing: false,
      progress: 1,
      stage: 'complete',
      message: 'Video saved to library!',
    });

    console.log('[VideoLibrary] Local video saved:', videoWithMetadata.name);
    return videoWithMetadata;
  }, [queueSaveVideos]);

  const removeVideo = useCallback(async (id: string): Promise<boolean> => {
    const video = savedVideos.find(v => v.id === id);
    if (!video) {
      console.warn('[VideoLibrary] Video not found:', id);
      return false;
    }
    if (isBundledSampleVideo(video)) {
      console.warn('[VideoLibrary] Attempted to delete bundled sample video');
      return false;
    }

    const deleted = await deleteVideo(video.uri, video.thumbnailUri);
    if (!deleted) {
      console.error('[VideoLibrary] Failed to delete file');
    }

    const updatedVideos = savedVideos.filter(v => v.id !== id);
    setSavedVideos(updatedVideos);
    await saveVideosMetadata(updatedVideos);

    console.log('[VideoLibrary] Video removed:', id);
    return true;
  }, [savedVideos, saveVideosMetadata]);

  const clearProcessingState = useCallback(() => {
    setProcessingState(initialProcessingState);
  }, []);

  const getVideoById = useCallback((id: string): SavedVideo | undefined => {
    return savedVideos.find(v => v.id === id);
  }, [savedVideos]);

  const regenerateVideoThumbnail = useCallback(async (id: string): Promise<boolean> => {
    const video = savedVideos.find(v => v.id === id);
    if (!video) {
      console.warn('[VideoLibrary] Video not found for thumbnail regeneration:', id);
      return false;
    }

    const newThumbnailUri = await regenerateThumbnail(video);
    if (!newThumbnailUri) {
      console.error('[VideoLibrary] Failed to regenerate thumbnail');
      return false;
    }

    const updatedVideos = savedVideos.map(v => 
      v.id === id ? { ...v, thumbnailUri: newThumbnailUri } : v
    );
    setSavedVideos(updatedVideos);
    await saveVideosMetadata(updatedVideos);

    console.log('[VideoLibrary] Thumbnail regenerated for:', video.name);
    return true;
  }, [savedVideos, saveVideosMetadata]);

  const isVideoReady = useCallback((id: string): boolean => {
    const video = savedVideos.find(v => v.id === id);
    if (!video) return false;
    return isVideoReadyForSimulation(video);
  }, [savedVideos]);

  const selectVideoForSimulation = useCallback((id: string): SavedVideo | undefined => {
    const video = savedVideos.find(v => v.id === id);
    if (!video) {
      console.warn('[VideoLibrary] Video not found for simulation:', id);
      return undefined;
    }

    if (!video.compatibility?.readyForSimulation) {
      console.warn('[VideoLibrary] Video not compatible for simulation:', video.name);
      return undefined;
    }

    if (!isVideoReadyForSimulation(video)) {
      console.warn('[VideoLibrary] Video file not ready:', video.name);
      return undefined;
    }

    console.log('[VideoLibrary] Selected video for simulation:', video.name, video.uri);
    return video;
  }, [savedVideos]);

  const checkCompatibility = useCallback(async (idOrVideo: string | SavedVideo): Promise<CompatibilityResult | null> => {
    console.log('[VideoLibrary] ========== COMPATIBILITY CHECK START ==========');
    
    let video: SavedVideo | undefined;
    
    if (typeof idOrVideo === 'string') {
      console.log('[VideoLibrary] Looking for video with id:', idOrVideo);
      console.log('[VideoLibrary] Total saved videos:', savedVideos.length);
      video = savedVideos.find(v => v.id === idOrVideo);
      if (!video) {
        console.error('[VideoLibrary] ERROR: Video not found for compatibility check!');
        console.error('[VideoLibrary] Available video IDs:', savedVideos.map(v => v.id));
        return null;
      }
    } else {
      console.log('[VideoLibrary] Using provided video object directly');
      video = idOrVideo;
    }

    console.log('[VideoLibrary] Found video:', {
      id: video.id,
      name: video.name,
      uri: video.uri,
      fileSize: video.fileSize,
      sourceType: video.sourceType,
      metadata: video.metadata,
    });

    try {
      console.log('[VideoLibrary] Calling checkVideoCompatibilityWithPlayback...');
      const result = await checkVideoCompatibilityWithPlayback(video);
      
      console.log('[VideoLibrary] Compatibility check completed:', {
        overallStatus: result.overallStatus,
        score: result.score,
        readyForSimulation: result.readyForSimulation,
        itemCount: result.items?.length,
        summary: result.summary,
      });

      persistCompatibilityResult(video.id, result);
      
      console.log('[VideoLibrary] ========== COMPATIBILITY CHECK END ==========');
      return result;
    } catch (error) {
      console.error('[VideoLibrary] CRITICAL ERROR in checkCompatibility:', error);
      console.error('[VideoLibrary] Error type:', typeof error);
      console.error('[VideoLibrary] Error stack:', error instanceof Error ? error.stack : 'No stack available');
      console.log('[VideoLibrary] ========== COMPATIBILITY CHECK FAILED ==========');
      throw error;
    }
  }, [savedVideos, persistCompatibilityResult]);

  return {
    savedVideos,
    isLoading,
    processingState,
    downloadAndSaveVideo,
    saveLocalVideo,
    removeVideo,
    refreshVideoList,
    clearProcessingState,
    getVideoById,
    regenerateVideoThumbnail,
    isVideoReady,
    selectVideoForSimulation,
    checkCompatibility,
    pendingVideoForApply,
    setPendingVideoForApply,
  };
});
