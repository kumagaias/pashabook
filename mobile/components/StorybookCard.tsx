import React from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { Storybook } from "@/lib/storage";

function StatusBadge({ status }: { status: Storybook["status"] }) {
  const config = {
    pending: { color: Colors.warning, icon: "time-outline" as const, label: "Pending" },
    processing: { color: Colors.accent, icon: "sync-outline" as const, label: "Processing" },
    done: { color: Colors.success, icon: "checkmark-circle-outline" as const, label: "Complete" },
    error: { color: Colors.error, icon: "alert-circle-outline" as const, label: "Error" },
  };
  const c = config[status];
  return (
    <View style={[styles.badge, { backgroundColor: c.color + "20" }]}>
      <Ionicons name={c.icon} size={12} color={c.color} />
      <Text style={[styles.badgeText, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

interface Props {
  book: Storybook;
  onPress: () => void;
  onDelete?: () => void;
}

export default function StorybookCard({ book, onPress, onDelete }: Props) {
  const timeAgo = getTimeAgo(book.createdAt);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: book.drawingUri }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.imageOverlay}>
          <StatusBadge status={book.status} />
        </View>
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {book.title || (book.language === "ja" ? "えほんを作成中..." : "Creating storybook...")}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {book.pages.length > 0
            ? `${book.pages.length} ${book.language === "ja" ? "ページ" : "pages"}`
            : book.language === "ja"
            ? "準備中"
            : "Preparing"}
        </Text>
        <Text style={styles.time}>{timeAgo}</Text>
      </View>
      {onDelete && (
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
      )}
    </Pressable>
  );
}

function getTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 12,
    gap: 12,
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
  imageContainer: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: Colors.shimmer,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageOverlay: {
    position: "absolute",
    bottom: 4,
    left: 4,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  time: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
  deleteButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});
