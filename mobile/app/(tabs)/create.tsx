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
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import LanguagePicker from "@/components/LanguagePicker";
import { createStorybook, saveStorybook } from "@/lib/storage";

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [language, setLanguage] = useState<"ja" | "en">("ja");
  const [isCreating, setIsCreating] = useState(false);

  const pickImage = async (useCamera: boolean) => {
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
        setImageUri(result.assets[0].uri);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } else {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });
      if (!result.canceled) {
        setImageUri(result.assets[0].uri);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  const handleCreate = async () => {
    if (!imageUri) {
      Alert.alert("Select Image", "Please upload a drawing first.");
      return;
    }

    setIsCreating(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const book = createStorybook(imageUri, language);
      await saveStorybook(book);
      router.push({ pathname: "/progress/[id]", params: { id: book.id } });
    } catch (error) {
      Alert.alert("Error", "Failed to create storybook. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

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
        <Text style={styles.heading}>Create Storybook</Text>
        <Text style={styles.description}>
          Upload your child's drawing and we'll transform it into a magical animated storybook
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Drawing</Text>
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
                <Text style={styles.uploadLabel}>Gallery</Text>
                <Text style={styles.uploadHint}>Select from photos</Text>
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
                <Text style={styles.uploadLabel}>Camera</Text>
                <Text style={styles.uploadHint}>Take a photo</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Story Language</Text>
          <LanguagePicker selected={language} onSelect={setLanguage} />
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
              {isCreating ? "Creating..." : "Generate Storybook"}
            </Text>
          </LinearGradient>
        </Pressable>
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
});
