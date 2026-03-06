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
import { Storybook, getStorybook } from "@/lib/storage";
import { simulateGeneration } from "@/lib/mock-generation";

const STEP_MESSAGES: Record<string, { ja: string; en: string }> = {
  uploading: { ja: "画像をアップロード中...", en: "Uploading image..." },
  analyzing: { ja: "絵を分析中...", en: "Analyzing drawing..." },
  generating_story: { ja: "ストーリーを作成中...", en: "Creating story..." },
  generating_illustrations: { ja: "イラストを生成中...", en: "Generating illustrations..." },
  generating_narration: { ja: "ナレーションを作成中...", en: "Creating narration..." },
  generating_animation: { ja: "アニメーションを作成中...", en: "Animating pages..." },
  compositing: { ja: "動画を合成中...", en: "Compositing video..." },
  done: { ja: "完成しました!", en: "Complete!" },
};

export default function ProgressScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [book, setBook] = useState<Storybook | null>(null);
  const hasStarted = useRef(false);

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

  const loadAndStart = useCallback(async () => {
    if (!id || hasStarted.current) return;
    const data = await getStorybook(id);
    if (!data) return;
    setBook(data);

    if (data.status === "done") return;

    hasStarted.current = true;
    simulateGeneration(data, (updated) => {
      setBook({ ...updated });
      if (updated.status === "done") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    });
  }, [id]);

  useEffect(() => {
    loadAndStart();
  }, [loadAndStart]);

  if (!book) {
    return (
      <View style={[styles.screen, styles.center]}>
        <LinearGradient
          colors={[Colors.background, Colors.backgroundAlt]}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const lang = book.language;
  const stepMessage =
    STEP_MESSAGES[book.currentStep]?.[lang] ||
    STEP_MESSAGES[book.currentStep]?.en ||
    "Processing...";
  const isDone = book.status === "done";

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

        <View style={styles.progressSection}>
          <StepIndicator currentStep={book.currentStep} />

          <View style={styles.progressInfo}>
            <ProgressBar progress={book.progress} height={8} />
            <View style={styles.progressRow}>
              <Text style={styles.stepText}>{stepMessage}</Text>
              <Text style={styles.percentText}>{book.progress}%</Text>
            </View>
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
  progressSection: {
    marginTop: 24,
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  progressInfo: {
    gap: 8,
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stepText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  percentText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
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
});
