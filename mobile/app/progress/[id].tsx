import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  FadeIn,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import StepIndicator from "@/components/StepIndicator";
import ProgressBar from "@/components/ProgressBar";
import { Storybook, getStorybook, saveStorybook } from "@/lib/storage";
import { getJobStatus, JobStatus } from "@/lib/api";
import { getAuth } from "firebase/auth";

const STEP_INFO: Record<string, { ja: { title: string; desc: string }; en: { title: string; desc: string }; icon: string }> = {
  uploading: { 
    ja: { title: "アップロード中", desc: "画像を送信しています" },
    en: { title: "Uploading", desc: "Sending your image" },
    icon: "cloud-upload-outline"
  },
  analyzing: { 
    ja: { title: "分析中", desc: "絵を理解しています" },
    en: { title: "Analyzing", desc: "Understanding your drawing" },
    icon: "eye-outline"
  },
  generating: { 
    ja: { title: "ストーリー作成", desc: "物語を考えています" },
    en: { title: "Creating Story", desc: "Writing your tale" },
    icon: "book-outline"
  },
  illustrating: { 
    ja: { title: "イラスト生成", desc: "絵を描いています" },
    en: { title: "Illustrating", desc: "Drawing pictures" },
    icon: "color-palette-outline"
  },
  narrating: { 
    ja: { title: "ナレーション作成", desc: "声を録音しています" },
    en: { title: "Narrating", desc: "Recording voice" },
    icon: "mic-outline"
  },
  animating: { 
    ja: { title: "アニメーション", desc: "動きをつけています" },
    en: { title: "Animating", desc: "Adding motion" },
    icon: "film-outline"
  },
  composing: { 
    ja: { title: "動画合成", desc: "仕上げをしています" },
    en: { title: "Compositing", desc: "Finishing touches" },
    icon: "videocam-outline"
  },
  done: { 
    ja: { title: "完成!", desc: "絵本ができました" },
    en: { title: "Complete!", desc: "Your storybook is ready" },
    icon: "checkmark-circle"
  },
};

const POLLING_INTERVAL = 2000; // 2 seconds

export default function ProgressScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [book, setBook] = useState<Storybook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  const sparkle = useSharedValue(0);

  useEffect(() => {
    sparkle.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const sparkleStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + sparkle.value * 0.7,
    transform: [{ rotate: `${sparkle.value * 360}deg` }],
  }));

  /**
   * Map backend stage to frontend step for display
   */
  const mapStageToStep = (stage: string): string => {
    const stageMap: Record<string, string> = {
      analyzing: "analyzing",
      generating: "generating",
      illustrating: "illustrating",
      narrating: "narrating",
      animating: "animating",
      composing: "composing",
    };
    return stageMap[stage] || stage;
  };

  /**
   * Update local storybook with job status data
   */
  const updateBookFromJobStatus = useCallback(
    async (jobStatus: JobStatus, currentBook: Storybook) => {
      const updatedBook: Storybook = {
        ...currentBook,
        status: jobStatus.status,
        updatedAt: Date.now(),
      };

      // Update progress information
      if (jobStatus.progress) {
        updatedBook.currentStep = mapStageToStep(jobStatus.progress.stage);
        updatedBook.progress = jobStatus.progress.percentage;
      }

      // Update queue position (only when pending and position > 0)
      if (jobStatus.queuePosition !== undefined && jobStatus.queuePosition > 0) {
        updatedBook.queuePosition = jobStatus.queuePosition;
      } else {
        updatedBook.queuePosition = undefined;
      }

      // Update result data when done
      if (jobStatus.status === "done" && jobStatus.result) {
        updatedBook.title = jobStatus.result.title;
        updatedBook.videoUrl = jobStatus.result.videoUrl;
        
        // Map story text to pages
        if (jobStatus.result.storyText && jobStatus.result.storyText.length > 0) {
          updatedBook.pages = jobStatus.result.storyText.map((text, idx) => ({
            id: `${jobStatus.jobId}-page-${idx}`,
            pageNumber: idx + 1,
            narrationText: text,
            imagePrompt: "",
            animationMode: "standard" as const,
          }));
        }
      }

      // Update error message
      if (jobStatus.status === "error" && jobStatus.error) {
        updatedBook.errorMessage = jobStatus.error;
      }

      await saveStorybook(updatedBook);
      if (isMountedRef.current) {
        setBook(updatedBook);
      }

      return updatedBook;
    },
    []
  );

  /**
   * Poll job status from backend API
   */
  const pollJobStatus = useCallback(async () => {
    if (!id) return;

    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        setError("Authentication required. Please sign in again.");
        return;
      }

      // Get latest book state
      const currentBook = await getStorybook(id);
      if (!currentBook) {
        setError("Storybook not found");
        return;
      }

      const idToken = await user.getIdToken();
      const jobStatus = await getJobStatus(id, idToken);

      const updatedBook = await updateBookFromJobStatus(jobStatus, currentBook);

      // Stop polling if job is complete or errored
      if (jobStatus.status === "done" || jobStatus.status === "error") {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }

        // Trigger haptic feedback on completion
        if (jobStatus.status === "done") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }

      // Clear any previous errors
      if (error) {
        setError(null);
      }
    } catch (err) {
      console.error("Polling error:", err);
      
      // Only show error if it's not a transient network issue
      if (err instanceof Error) {
        if (err.message.includes("Network error")) {
          setError(err.message);
        } else {
          setError("Failed to check status. Please try again.");
        }
      }
    }
  }, [id, error, updateBookFromJobStatus]);

  /**
   * Retry after error
   */
  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    setError(null);
    
    try {
      await pollJobStatus();
      
      // Restart polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      pollingIntervalRef.current = setInterval(pollJobStatus, POLLING_INTERVAL);
    } catch (err) {
      console.error("Retry error:", err);
    } finally {
      setIsRetrying(false);
    }
  }, [pollJobStatus]);

  /**
   * Load storybook and start polling
   */
  const loadAndStartPolling = useCallback(async () => {
    if (!id) return;

    const data = await getStorybook(id);
    if (!data) {
      setError("Storybook not found");
      return;
    }

    setBook(data);

    // Only start polling if job is not complete
    if (data.status !== "done" && data.status !== "error") {
      // Clear any existing interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      // Poll immediately
      pollJobStatus();

      // Set up interval for subsequent polls
      pollingIntervalRef.current = setInterval(pollJobStatus, POLLING_INTERVAL);
    }
  }, [id, pollJobStatus]);

  // Initial load
  useEffect(() => {
    loadAndStartPolling();

    return () => {
      isMountedRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [loadAndStartPolling]);

  if (!book) {
    return (
      <View style={[styles.screen, styles.center]}>
        <LinearGradient
          colors={[Colors.background, Colors.backgroundAlt]}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.loadingText}>
          {error || "Loading..."}
        </Text>
      </View>
    );
  }

  const lang = book.language;
  const stepInfo = STEP_INFO[book.currentStep] || STEP_INFO.uploading;
  const stepTitle = stepInfo[lang]?.title || stepInfo.en.title;
  const stepDesc = stepInfo[lang]?.desc || stepInfo.en.desc;
  const isDone = book.status === "done";
  const hasError = book.status === "error" || error !== null;

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[Colors.background, Colors.backgroundAlt, Colors.background]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {isDone
            ? lang === "ja"
              ? "完成!"
              : "Complete!"
            : lang === "ja"
            ? "作成中..."
            : "Creating..."}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.drawingSection}>
          <View style={styles.drawingWrapper}>
            <Image
              source={{ uri: book.drawingUri }}
              style={styles.drawingImage}
              contentFit="cover"
              transition={300}
            />
            {!isDone && (
              <Animated.View style={[styles.sparkleOverlay, sparkleStyle]}>
                <Ionicons name="sparkles" size={32} color={Colors.secondary} />
              </Animated.View>
            )}
          </View>
          {book.title ? (
            <Animated.Text entering={FadeIn.duration(500)} style={styles.bookTitle}>
              {book.title}
            </Animated.Text>
          ) : null}
        </View>

        {book.queuePosition !== undefined && book.queuePosition > 0 && (
          <Animated.View entering={FadeIn.duration(400)} style={styles.queueSection}>
            <View style={styles.queueCard}>
              <Ionicons name="hourglass-outline" size={24} color={Colors.primary} />
              <Text style={styles.queueText}>
                {lang === "ja" 
                  ? `順番待ち: ${book.queuePosition}番目`
                  : `You are #${book.queuePosition} in queue`}
              </Text>
              <Text style={styles.queueSubtext}>
                {lang === "ja"
                  ? `約${book.queuePosition * 3}分お待ちください`
                  : `Estimated wait: ~${book.queuePosition * 3} minutes`}
              </Text>
            </View>
          </Animated.View>
        )}

        <View style={styles.progressSection}>
          <View style={styles.currentStepCard}>
            <View style={styles.stepIconWrapper}>
              <Ionicons 
                name={stepInfo.icon as any} 
                size={48} 
                color={isDone ? Colors.success : Colors.primary} 
              />
            </View>
            <Text style={styles.stepTitle}>{stepTitle}</Text>
            <Text style={styles.stepDescription}>{stepDesc}</Text>
          </View>

          <View style={styles.progressInfo}>
            <ProgressBar progress={book.progress} height={10} />
            <Text style={styles.percentText}>{book.progress}%</Text>
          </View>
        </View>

        {isDone && (
          <Animated.View entering={FadeIn.duration(600)} style={styles.doneSection}>
            <Pressable
              onPress={() =>
                router.replace({
                  pathname: "/detail/[id]",
                  params: { id: book.id },
                })
              }
              style={({ pressed }) => [
                styles.viewButton,
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
            >
              <LinearGradient
                colors={[Colors.primary, Colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.viewButtonGradient}
              >
                <Ionicons name="play" size={22} color="#fff" />
                <Text style={styles.viewButtonText}>
                  {lang === "ja" ? "絵本を見る" : "View Storybook"}
                </Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}

        {hasError && (
          <Animated.View entering={FadeIn.duration(600)} style={styles.errorSection}>
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle" size={32} color={Colors.error} />
              <Text style={styles.errorTitle}>
                {lang === "ja" ? "エラーが発生しました" : "An Error Occurred"}
              </Text>
              <Text style={styles.errorMessage}>
                {error || book.errorMessage || (lang === "ja" ? "処理中にエラーが発生しました" : "An error occurred during processing")}
              </Text>
              <Pressable
                onPress={handleRetry}
                disabled={isRetrying}
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed && { opacity: 0.9 },
                  isRetrying && { opacity: 0.6 },
                ]}
              >
                <LinearGradient
                  colors={[Colors.primary, Colors.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.retryButtonGradient}
                >
                  <Ionicons 
                    name={isRetrying ? "hourglass" : "refresh"} 
                    size={20} 
                    color="#fff" 
                  />
                  <Text style={styles.retryButtonText}>
                    {isRetrying 
                      ? (lang === "ja" ? "再試行中..." : "Retrying...") 
                      : (lang === "ja" ? "再試行" : "Retry")}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </Animated.View>
        )}
      </View>
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
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  drawingSection: {
    alignItems: "center",
    gap: 14,
    marginTop: 16,
  },
  drawingWrapper: {
    width: 180,
    height: 180,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: Colors.shimmer,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  drawingImage: {
    width: "100%",
    height: "100%",
  },
  sparkleOverlay: {
    position: "absolute",
    top: -8,
    right: -8,
  },
  bookTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    textAlign: "center",
  },
  queueSection: {
    marginTop: 20,
  },
  queueCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.primary + "20",
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  queueText: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    textAlign: "center",
  },
  queueSubtext: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  progressSection: {
    marginTop: 32,
    gap: 20,
  },
  currentStepCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    gap: 16,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  stepIconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  stepTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    textAlign: "center",
  },
  stepDescription: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  progressInfo: {
    gap: 12,
    paddingHorizontal: 4,
  },
  percentText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
    textAlign: "center",
  },
  doneSection: {
    marginTop: 32,
  },
  viewButton: {
    borderRadius: 16,
    overflow: "hidden",
  },
  viewButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  viewButtonText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  errorSection: {
    marginTop: 32,
  },
  errorCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: Colors.error,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    textAlign: "center",
  },
  errorMessage: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 8,
    borderRadius: 12,
    overflow: "hidden",
    width: "100%",
  },
  retryButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});
