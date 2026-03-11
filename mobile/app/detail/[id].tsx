import React, { useEffect, useState, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  Dimensions,
  Platform,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Video, ResizeMode } from "expo-av";
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { Storybook, getStorybook, saveStorybook } from "@/lib/storage";
import { getVideoUrls } from "@/lib/api";
import { getAuth } from "firebase/auth";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PAGE_WIDTH = SCREEN_WIDTH - 40;

function PageCard({
  page,
  index,
  language,
}: {
  page: Storybook["pages"][0];
  index: number;
  language: string;
}) {
  const isHighlight = page.animationMode === "highlight";

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).duration(500)}
      style={styles.pageCard}
    >
      <View style={styles.pageHeader}>
        <View style={styles.pageNumberBadge}>
          <Text style={styles.pageNumber}>{page.pageNumber}</Text>
        </View>
        {isHighlight && (
          <View style={styles.highlightBadge}>
            <Ionicons name="star" size={12} color={Colors.secondary} />
            <Text style={styles.highlightText}>Highlight</Text>
          </View>
        )}
      </View>

      <View style={styles.pageIllustration}>
        <LinearGradient
          colors={[
            isHighlight ? Colors.secondary + "30" : Colors.accent + "20",
            isHighlight ? Colors.primary + "20" : Colors.background,
          ]}
          style={styles.illustrationPlaceholder}
        >
          <Ionicons
            name={isHighlight ? "star-outline" : "image-outline"}
            size={40}
            color={isHighlight ? Colors.secondary : Colors.accent}
          />
          <Text style={styles.illustrationHint}>
            {language === "ja" ? "イラスト" : "Illustration"}
          </Text>
        </LinearGradient>
      </View>

      <Text style={styles.narrationText}>{page.narrationText}</Text>
    </Animated.View>
  );
}

export default function DetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [book, setBook] = useState<Storybook | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const videoRef = useRef<Video>(null);

  useEffect(() => {
    if (id) {
      loadStorybook();
    }
  }, [id]);

  const loadStorybook = async () => {
    if (!id) return;
    
    const data = await getStorybook(id);
    if (!data) {
      setVideoError("Storybook not found");
      return;
    }
    
    setBook(data);
    setEditedTitle(data.title);
    
    // Fetch video URLs if not already loaded
    if (data.status === "done" && !videoUrl) {
      await fetchVideoUrls();
    }
  };

  const fetchVideoUrls = async () => {
    if (!id) return;
    
    setIsLoadingVideo(true);
    setVideoError(null);
    
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        setVideoError("Authentication required");
        return;
      }
      
      const idToken = await user.getIdToken();
      const urls = await getVideoUrls(id, idToken);
      
      setVideoUrl(urls.videoUrl);
      setDownloadUrl(urls.downloadUrl);
    } catch (error) {
      console.error("Failed to fetch video URLs:", error);
      setVideoError(error instanceof Error ? error.message : "Failed to load video");
    } finally {
      setIsLoadingVideo(false);
    }
  };

  const handleTitleEdit = () => {
    setIsEditingTitle(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleTitleSave = async () => {
    if (!book || !editedTitle.trim()) return;
    
    setIsSaving(true);
    
    try {
      const updatedBook = {
        ...book,
        title: editedTitle.trim(),
        updatedAt: Date.now(),
      };
      
      await saveStorybook(updatedBook);
      setBook(updatedBook);
      setIsEditingTitle(false);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Failed to save title:", error);
      Alert.alert(
        book.language === "ja" ? "エラー" : "Error",
        book.language === "ja" ? "タイトルの保存に失敗しました" : "Failed to save title"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleTitleCancel = () => {
    setEditedTitle(book?.title || "");
    setIsEditingTitle(false);
  };

  const handleDownload = async () => {
    if (!downloadUrl || !book) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const filename = `${book.title.replace(/[^a-zA-Z0-9]/g, "_")}.mp4`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;
      
      // Download the file
      const downloadResult = await FileSystem.downloadAsync(downloadUrl, fileUri);
      
      // Share the downloaded file
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(downloadResult.uri);
      } else {
        Alert.alert(
          book.language === "ja" ? "ダウンロード完了" : "Download Complete",
          book.language === "ja" 
            ? `動画を保存しました: ${filename}` 
            : `Video saved: ${filename}`
        );
      }
    } catch (error) {
      console.error("Download error:", error);
      Alert.alert(
        book.language === "ja" ? "エラー" : "Error",
        book.language === "ja" 
          ? "ダウンロードに失敗しました" 
          : "Failed to download video"
      );
    }
  };

  const handlePlayVideo = async () => {
    if (videoRef.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await videoRef.current.playAsync();
    }
  };

  if (!book) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[Colors.background, "#FFF5EB", Colors.background]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [
            styles.backButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {book.title}
        </Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          hitSlop={8}
          style={styles.shareButton}
        >
          <Ionicons
            name="share-outline"
            size={22}
            color={Colors.text}
          />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 24 },
        ]}
      >
        <Animated.View entering={FadeIn.duration(600)} style={styles.heroSection}>
          <View style={styles.heroDrawing}>
            <Image
              source={{ uri: book.drawingUri }}
              style={styles.heroImage}
              contentFit="cover"
              transition={300}
            />
          </View>
          <View style={styles.heroInfo}>
            {isEditingTitle ? (
              <View style={styles.titleEditContainer}>
                <TextInput
                  style={styles.titleInput}
                  value={editedTitle}
                  onChangeText={setEditedTitle}
                  autoFocus
                  multiline
                  maxLength={100}
                  placeholder={book.language === "ja" ? "タイトルを入力" : "Enter title"}
                  placeholderTextColor={Colors.textTertiary}
                />
                <View style={styles.titleEditButtons}>
                  <Pressable
                    onPress={handleTitleCancel}
                    style={({ pressed }) => [
                      styles.titleEditButton,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Ionicons name="close" size={18} color={Colors.textSecondary} />
                  </Pressable>
                  <Pressable
                    onPress={handleTitleSave}
                    disabled={isSaving || !editedTitle.trim()}
                    style={({ pressed }) => [
                      styles.titleEditButton,
                      styles.titleSaveButton,
                      pressed && { opacity: 0.7 },
                      (!editedTitle.trim() || isSaving) && { opacity: 0.5 },
                    ]}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    )}
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable onPress={handleTitleEdit} style={styles.titleContainer}>
                <Text style={styles.heroTitle}>{book.title}</Text>
                <Ionicons name="pencil" size={16} color={Colors.textSecondary} />
              </Pressable>
            )}
            <View style={styles.heroMeta}>
              <View style={styles.metaItem}>
                <Ionicons name="book-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.metaText}>
                  {book.pages.length} {book.language === "ja" ? "ページ" : "pages"}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="globe-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.metaText}>
                  {book.language === "ja" ? "Japanese" : "English"}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        <View style={styles.videoSection}>
          {isLoadingVideo ? (
            <View style={styles.videoLoading}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.videoLoadingText}>
                {book.language === "ja" ? "動画を読み込み中..." : "Loading video..."}
              </Text>
            </View>
          ) : videoError ? (
            <View style={styles.videoError}>
              <Ionicons name="alert-circle-outline" size={32} color={Colors.error} />
              <Text style={styles.videoErrorText}>{videoError}</Text>
              <Pressable
                onPress={fetchVideoUrls}
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={styles.retryButtonText}>
                  {book.language === "ja" ? "再試行" : "Retry"}
                </Text>
              </Pressable>
            </View>
          ) : videoUrl ? (
            <>
              <View style={styles.videoPlayer}>
                <Video
                  ref={videoRef}
                  source={{ uri: videoUrl }}
                  style={styles.video}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                  isLooping={false}
                  onError={(error) => {
                    console.error("Video playback error:", error);
                    setVideoError(book.language === "ja" ? "動画の再生に失敗しました" : "Failed to play video");
                  }}
                />
              </View>
              
              <Pressable
                onPress={handleDownload}
                style={({ pressed }) => [
                  styles.downloadButton,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Ionicons name="download-outline" size={20} color={Colors.primary} />
                <Text style={styles.downloadText}>
                  {book.language === "ja" ? "ダウンロード" : "Download"}
                </Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={handlePlayVideo}
              style={({ pressed }) => [
                styles.videoButton,
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
            >
              <LinearGradient
                colors={[Colors.primary, Colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.videoButtonGradient}
              >
                <Ionicons name="play-circle" size={28} color="#fff" />
                <View>
                  <Text style={styles.videoButtonTitle}>
                    {book.language === "ja" ? "動画を再生" : "Play Video"}
                  </Text>
                  <Text style={styles.videoButtonSub}>
                    {book.language === "ja"
                      ? "アニメーション付き絵本"
                      : "Animated storybook"}
                  </Text>
                </View>
              </LinearGradient>
            </Pressable>
          )}
        </View>

        <View style={styles.pagesSection}>
          <Text style={styles.pagesSectionTitle}>
            {book.language === "ja" ? "ストーリー" : "Story Pages"}
          </Text>
          {book.pages.map((page, index) => (
            <PageCard
              key={page.id}
              page={page}
              index={index}
              language={book.language}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    textAlign: "center",
    marginHorizontal: 8,
  },
  shareButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  heroSection: {
    flexDirection: "row",
    gap: 16,
    marginTop: 8,
    marginBottom: 24,
  },
  heroDrawing: {
    width: 120,
    height: 120,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: Colors.shimmer,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroInfo: {
    flex: 1,
    justifyContent: "center",
    gap: 8,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    lineHeight: 30,
    flex: 1,
  },
  titleEditContainer: {
    gap: 8,
  },
  titleInput: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    lineHeight: 30,
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  titleEditButtons: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
  },
  titleEditButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  titleSaveButton: {
    backgroundColor: Colors.primary,
  },
  heroMeta: {
    gap: 6,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  videoSection: {
    gap: 10,
    marginBottom: 28,
  },
  videoLoading: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 12,
  },
  videoLoadingText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  videoError: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
  },
  videoErrorText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.error,
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  retryButtonText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  videoPlayer: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000",
    aspectRatio: 16 / 9,
  },
  video: {
    width: "100%",
    height: "100%",
  },
  videoButton: {
    borderRadius: 16,
    overflow: "hidden",
  },
  videoButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  videoButtonTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  videoButtonSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.8)",
    marginTop: 1,
  },
  downloadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary + "40",
    backgroundColor: Colors.primary + "08",
  },
  downloadText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  pagesSection: {
    gap: 14,
  },
  pagesSectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 4,
  },
  pageCard: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pageNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.primary + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  pageNumber: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  highlightBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Colors.secondary + "20",
  },
  highlightText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.secondary,
  },
  pageIllustration: {
    borderRadius: 12,
    overflow: "hidden",
  },
  illustrationPlaceholder: {
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
  },
  illustrationHint: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textTertiary,
  },
  narrationText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    lineHeight: 24,
  },
});
