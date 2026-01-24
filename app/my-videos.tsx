import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { ChevronLeft, Grid3X3, List } from 'lucide-react-native';
import { useVideoSelection } from '@/hooks/useVideoSelection';
import { CompatibilityCheckModal } from '@/components/browser/modals';
import {
  VideoGridItem,
  VideoListItem,
  VideosHeader,
  EmptyVideosState,
  VideoListFooter,
  styles,
  GRID_COLUMNS,
} from '@/components/my-videos';
import type { SavedVideo } from '@/utils/videoManager';

type ViewMode = 'grid' | 'list';

export default function MyVideosScreen() {
  const {
    savedVideos,
    isLoading,
    selectedVideoId,
    isRefreshing,
    regeneratingId,
    compatibilityModalVisible,
    compatibilityResult,
    isCheckingCompatibility,
    checkingVideoName,
    handleRefresh,
    handleSelectVideo,
    handleDeleteVideo,
    handleRegenerateThumbnail,
    handleCheckCompatibility,
    closeCompatibilityModal,
    toggleVideoSelection,
  } = useVideoSelection();

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredVideos = useMemo(() => {
    if (!searchQuery.trim()) return savedVideos;
    const query = searchQuery.toLowerCase();
    return savedVideos.filter(v => 
      v.name.toLowerCase().includes(query) ||
      v.originalName.toLowerCase().includes(query)
    );
  }, [savedVideos, searchQuery]);

  const renderGridItem = useCallback(({ item: video }: { item: SavedVideo }) => (
    <VideoGridItem
      video={video}
      isSelected={selectedVideoId === video.id}
      isRegenerating={regeneratingId === video.id}
      onSelect={() => toggleVideoSelection(video.id)}
      onUse={() => handleSelectVideo(video)}
      onCheck={() => handleCheckCompatibility(video)}
      onRegenerate={() => handleRegenerateThumbnail(video.id)}
      onDelete={() => handleDeleteVideo(video.id, video.name)}
    />
  ), [selectedVideoId, regeneratingId, toggleVideoSelection, handleSelectVideo, handleCheckCompatibility, handleRegenerateThumbnail, handleDeleteVideo]);

  const renderListItem = useCallback(({ item: video }: { item: SavedVideo }) => (
    <VideoListItem
      video={video}
      isSelected={selectedVideoId === video.id}
      onSelect={() => toggleVideoSelection(video.id)}
      onUse={() => handleSelectVideo(video)}
      onCheck={() => handleCheckCompatibility(video)}
      onDelete={() => handleDeleteVideo(video.id, video.name)}
    />
  ), [selectedVideoId, toggleVideoSelection, handleSelectVideo, handleCheckCompatibility, handleDeleteVideo]);

  const keyExtractor = useCallback((item: SavedVideo) => item.id, []);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'My Videos',
            headerStyle: { backgroundColor: '#0a0a0a' },
            headerTintColor: '#ffffff',
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00ff88" />
          <Text style={styles.loadingText}>Loading videos...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'My Videos',
          headerStyle: { backgroundColor: '#0a0a0a' },
          headerTintColor: '#ffffff',
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => {
                Keyboard.dismiss();
                requestAnimationFrame(() => {
                  router.back();
                });
              }}
              style={styles.headerButton}
            >
              <ChevronLeft size={24} color="#00ff88" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={[styles.viewModeBtn, viewMode === 'grid' && styles.viewModeBtnActive]}
                onPress={() => setViewMode('grid')}
              >
                <Grid3X3 size={18} color={viewMode === 'grid' ? '#00ff88' : 'rgba(255,255,255,0.5)'} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewModeBtn, viewMode === 'list' && styles.viewModeBtnActive]}
                onPress={() => setViewMode('list')}
              >
                <List size={18} color={viewMode === 'list' ? '#00ff88' : 'rgba(255,255,255,0.5)'} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <KeyboardAvoidingView 
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <VideosHeader
            videoCount={filteredVideos.length}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />

          {filteredVideos.length === 0 ? (
            <EmptyVideosState searchQuery={searchQuery} />
          ) : viewMode === 'grid' ? (
            <FlatList
              testID="videos-grid-list"
              data={filteredVideos}
              key={`grid-${GRID_COLUMNS}`}
              numColumns={GRID_COLUMNS}
              keyExtractor={keyExtractor}
              renderItem={renderGridItem}
              ListFooterComponent={VideoListFooter}
              contentContainerStyle={styles.gridContent}
              columnWrapperStyle={styles.gridWrapper}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              initialNumToRender={8}
              maxToRenderPerBatch={8}
              windowSize={5}
              removeClippedSubviews={Platform.OS === 'android'}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  tintColor="#00ff88"
                  colors={['#00ff88']}
                />
              }
            />
          ) : (
            <FlatList
              testID="videos-list"
              data={filteredVideos}
              key="list"
              keyExtractor={keyExtractor}
              renderItem={renderListItem}
              ListFooterComponent={VideoListFooter}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={Platform.OS === 'android'}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  tintColor="#00ff88"
                  colors={['#00ff88']}
                />
              }
            />
          )}
        </KeyboardAvoidingView>
        
        <CompatibilityCheckModal
          visible={compatibilityModalVisible}
          onClose={closeCompatibilityModal}
          result={compatibilityResult}
          isChecking={isCheckingCompatibility}
          videoName={checkingVideoName}
        />
      </SafeAreaView>
    </View>
  );
}
