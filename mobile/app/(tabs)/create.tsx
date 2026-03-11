import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Alert,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import LanguagePicker from "@/components/LanguagePicker";
import ProgressBar from "@/components/ProgressBar";
import { createStorybook, saveStorybook } from "@/lib/storage";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { uploadImage } from "@/lib/api";

// Helper function to compress images on web platform
const compressImageForWeb = async (file: File): Promise<string> => {
  console.log("Starting image compression for file:", file.name, file.size);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      console.log("File read complete, creating image");
      const img = new Image();
      img.onload = () => {
        console.log("Image loaded, dimensions:", img.width, "x", img.height);
        try {
          // Create canvas for compression
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Failed to get canvas context"));
            return;
          }

          // Calculate new dimensions (max 2048px on longest side)
          const maxSize = 2048;
          let width = img.width;
          let height = img.height;

          if (width > height && width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          } else if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }

          canvas.width = width;
          canvas.height = height;
          console.log("Canvas dimensions:", width, "x", height);

          // Draw and compress
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to JPEG with 0.8 quality
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.8);
          console.log("Compression complete, data URL length:", compressedDataUrl.length);
          resolve(compressedDataUrl);
        } catch (error) {
          console.error("Error during compression:", error);
          reject(error);
        }
      };
      img.onerror = (error) => {
        console.error("Failed to load image:", error);
        reject(new Error("Failed to load image"));
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = (error) => {
      console.error("Failed to read file:", error);
      reject(new Error("Failed to read file"));
    };
    reader.readAsDataURL(file);
  });
};

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const { language, setLanguage } = useLanguage();
  const { getIdToken } = useAuth();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleLanguageChange = async (lang: "ja" | "en") => {
    try {
      await setLanguage(lang);
    } catch (error) {
      console.error("Failed to save language:", error);
    }
  };

  const pickImage = async (useCamera: boolean) => {
    // Web platform: use HTML5 file input
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      if (useCamera) {
        input.capture = "environment";
      }
      
      input.onchange = async (e: Event) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (file) {
          try {
            // Compress image before displaying
            const compressedDataUrl = await compressImageForWeb(file);
            setImageUri(compressedDataUrl);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch (error) {
            console.error("Image compression error:", error);
            Alert.alert(
              language === "ja" ? "エラー" : "Error",
              language === "ja" 
                ? "画像の処理に失敗しました。別の画像を選択してください。"
                : "Failed to process image. Please select another image."
            );
          }
        }
      };
      
      input.click();
      return;
    }

    // Native platform: use expo-image-picker
    if (useCamera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        if (!permission.canAskAgain && Platform.OS !== "web") {
          Alert.alert(
            "Permission Required",
            "Camera access was denied. Please enable it in Settings.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Open Settings",
                onPress: () => {
                  try {
                    const { Linking } = require("react-native");
                    Linking.openSettings();
                  } catch {}
                },
              },
            ]
          );
        } else {
          Alert.alert(
            "Permission Required",
            "Camera permission is needed to take photos."
          );
        }
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });
      if (!result.canceled) {
        // Convert to JPEG to ensure compatibility (handles HEIC from iPhone)
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        setImageUri(manipulatedImage.uri);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } else {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });
      if (!result.canceled) {
        // Convert to JPEG to ensure compatibility (handles HEIC from iPhone)
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        setImageUri(manipulatedImage.uri);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  const handleCreate = async () => {
    if (!imageUri) {
      Alert.alert(t.selectImage, t.selectImageMessage);
      return;
    }

    setIsCreating(true);
    setUploadProgress(10);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      // Get authentication token
      const idToken = await getIdToken();
      if (!idToken) {
        throw new Error("Authentication required. Please log in again.");
      }

      setUploadProgress(30);

      // Upload image to backend API
      const uploadResponse = await uploadImage(imageUri, language, idToken);

      setUploadProgress(70);

      // Create local storybook record with jobId from backend
      const book = createStorybook(imageUri, language);
      book.id = uploadResponse.jobId; // Use backend jobId
      book.status = "pending";
      book.currentStep = "uploading";
      book.progress = 0;

      await saveStorybook(book);

      setUploadProgress(100);

      // Navigate to progress screen
      router.push({ pathname: "/progress/[id]", params: { id: book.id } });
    } catch (error) {
      console.error("Create storybook error:", error);
      
      // Display user-friendly error message
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Failed to create storybook. Please try again.";
      
      Alert.alert(t.uploadFailed, errorMessage);
    } finally {
      setIsCreating(false);
      setUploadProgress(0);
    }
  };

  const texts = {
    ja: {
      heading: "絵本を作る",
      description: "お子様の絵をアップロードすると、魔法のアニメーション絵本に変身します",
      drawing: "絵",
      gallery: "ギャラリー",
      galleryHint: "写真から選ぶ",
      camera: "カメラ",
      cameraHint: "写真を撮る",
      storyLanguage: "ストーリーの言語",
      creating: "作成中...",
      generate: "絵本を作る",
      selectImage: "画像を選択",
      selectImageMessage: "まず絵をアップロードしてください。",
      uploadFailed: "アップロード失敗",
    },
    en: {
      heading: "Create Storybook",
      description: "Upload your child's drawing and we'll transform it into a magical animated storybook",
      drawing: "Drawing",
      gallery: "Gallery",
      galleryHint: "Select from photos",
      camera: "Camera",
      cameraHint: "Take a photo",
      storyLanguage: "Story Language",
      creating: "Creating...",
      generate: "Generate Storybook",
      selectImage: "Select Image",
      selectImageMessage: "Please upload a drawing first.",
      uploadFailed: "Upload Failed",
    },
  };

  const t = texts[language];

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[Colors.background, Colors.backgroundAlt, Colors.background]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Platform.OS === "web" ? 67 + 12 : insets.top + 12,
            paddingBottom: Platform.OS === "web" ? 34 + 84 : 100,
          },
        ]}
      >
        <Text style={styles.heading}>{t.heading}</Text>
        <Text style={styles.description}>
          {t.description}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t.drawing}</Text>
          {imageUri ? (
            <View style={styles.previewContainer}>
              <Image
                source={{ uri: imageUri }}
                style={styles.previewImage}
                contentFit="cover"
                transition={300}
              />
              <Pressable
                onPress={() => setImageUri(null)}
                style={styles.removeButton}
              >
                <Ionicons name="close" size={20} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <View style={styles.uploadContainer}>
              <Pressable
                onPress={() => pickImage(false)}
                style={({ pressed }) => [
                  styles.uploadOption,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View style={styles.uploadIconWrapper}>
                  <Ionicons
                    name="images-outline"
                    size={28}
                    color={Colors.primary}
                  />
                </View>
                <Text style={styles.uploadLabel}>{t.gallery}</Text>
                <Text style={styles.uploadHint}>{t.galleryHint}</Text>
              </Pressable>
              <Pressable
                onPress={() => pickImage(true)}
                style={({ pressed }) => [
                  styles.uploadOption,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View style={styles.uploadIconWrapper}>
                  <Ionicons
                    name="camera-outline"
                    size={28}
                    color={Colors.accent}
                  />
                </View>
                <Text style={styles.uploadLabel}>{t.camera}</Text>
                <Text style={styles.uploadHint}>{t.cameraHint}</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t.storyLanguage}</Text>
          <LanguagePicker selected={language} onSelect={handleLanguageChange} />
        </View>

        <Pressable
          onPress={handleCreate}
          disabled={!imageUri || isCreating}
          style={({ pressed }) => [
            styles.createButton,
            (!imageUri || isCreating) && styles.createButtonDisabled,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
        >
          <LinearGradient
            colors={
              !imageUri || isCreating
                ? [Colors.shimmer, Colors.shimmer]
                : [Colors.primary, Colors.primaryDark]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.createButtonGradient}
          >
            <Ionicons
              name="sparkles"
              size={22}
              color={!imageUri || isCreating ? Colors.textTertiary : "#fff"}
            />
            <Text
              style={[
                styles.createButtonText,
                (!imageUri || isCreating) && { color: Colors.textTertiary },
              ]}
            >
              {isCreating ? t.creating : t.generate}
            </Text>
          </LinearGradient>
        </Pressable>

        {isCreating && uploadProgress > 0 && (
          <View style={styles.uploadProgressSection}>
            <ProgressBar progress={uploadProgress} height={8} />
            <Text style={styles.uploadProgressText}>
              {language === "ja" ? "アップロード中..." : "Uploading..."}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  heading: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  description: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 22,
    marginTop: 6,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  uploadContainer: {
    flexDirection: "row",
    gap: 12,
  },
  uploadOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 28,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.cardBorder,
    borderStyle: "dashed",
    gap: 8,
  },
  uploadIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  uploadHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
  previewContainer: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: Colors.shimmer,
  },
  previewImage: {
    width: "100%",
    height: 240,
    borderRadius: 16,
  },
  removeButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  createButton: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 8,
  },
  createButtonDisabled: {
    opacity: 0.7,
  },
  createButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  createButtonText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  uploadProgressSection: {
    marginTop: 16,
    gap: 8,
  },
  uploadProgressText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    textAlign: "center",
  },
});
