import React, { useEffect, useState, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import { Video, ResizeMode } from "expo-av";
import Animated, { FadeIn } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { LibraryBook, getLibraryBook } from "@/lib/storage";

export default function LibraryViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [book, setBook] = useState<LibraryBook | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const videoRef = useRef<Video>(null);

  useEffect(() => {
    if (id) {
      loadBook();
    }
  }, [id]);

  const loadBook = async () => {
    if (!id) return;
    
    const data = await getLibraryBook(id);
    if (!data) {
      setVideoError("Storybook not found");
      return;
    }
    
    setBook(data);
  };

  const handleShare = async () => {
    if (!book) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(book.videoUri, {
          mimeType: "video/mp4",
          dialogTitle: book.title,
        });
      } else {
        Alert.alert("Sharing not available", "Sharing is not available on this device");
      }
    } catch (error) {
      console.error("Share error:", error);
      Alert.alert("Error", "Failed to share video");
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
          onPress={handleShare}
          hitSlop={8}
          style={styles.shareButton}
        >
          <Ionicons name="share-outline" size={22} color={Colors.text} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 24 },
        ]}
      >
        <Animated.View entering={FadeIn.duration(600)} style={styles.titleSection}>
          <Text style={styles.title}>{book.title}</Text>
          <Text style={styles.date}>
            {new Date(book.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </Text>
        </Animated.View>

        <View style={styles.videoSection}>
          {videoError ? (
            <View style={styles.videoError}>
              <Ionicons name="alert-circle-outline" size={32} color={Colors.error} />
              <Text style={styles.videoErrorText}>{videoError}</Text>
            </View>
          ) : (
            <View style={styles.videoPlayer}>
              <Video
                ref={videoRef}
                source={{ uri: book.videoUri }}
                style={styles.video}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                isLooping={false}
                onError={(error) => {
                  console.error("Video playback error:", error);
                  setVideoError("Failed to play video");
                }}
              />
            </View>
          )}
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.infoText}>
              This storybook is saved locally on your device and can be played anytime.
            </Text>
          </View>
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
  titleSection: {
    marginTop: 8,
    marginBottom: 24,
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    lineHeight: 36,
  },
  date: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  videoSection: {
    marginBottom: 24,
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
  videoPlayer: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000",
    aspectRatio: 16 / 9,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  video: {
    width: "100%",
    height: "100%",
  },
  infoSection: {
    gap: 12,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: Colors.primary + "08",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.primary + "20",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    lineHeight: 20,
  },
});
