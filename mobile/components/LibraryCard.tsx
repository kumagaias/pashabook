import React from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { LibraryBook } from "@/lib/storage";

interface Props {
  book: LibraryBook;
  onPress: () => void;
  onDelete: () => void;
}

export default function LibraryCard({ book, onPress, onDelete }: Props) {
  const date = new Date(book.createdAt);
  const formattedDate = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <View style={styles.container}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.thumbnailContainer}>
          {book.thumbnailUri ? (
            <Image
              source={{ uri: book.thumbnailUri }}
              style={styles.thumbnail}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={styles.placeholderThumbnail}>
              <Ionicons name="book" size={32} color={Colors.primary} />
            </View>
          )}
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <Ionicons name="play" size={20} color="#fff" />
            </View>
          </View>
        </View>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>
            {book.title}
          </Text>
          <Text style={styles.date}>{formattedDate}</Text>
        </View>
      </Pressable>
      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        hitSlop={8}
        style={styles.deleteButton}
      >
        <Ionicons name="trash-outline" size={18} color={Colors.textTertiary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: "50%",
    padding: 6,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  thumbnailContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: Colors.shimmer,
    position: "relative",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  placeholderThumbnail: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary + "12",
  },
  playOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    padding: 12,
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    lineHeight: 18,
  },
  date: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  deleteButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
});
