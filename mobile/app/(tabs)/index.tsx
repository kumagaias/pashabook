import React, { useCallback, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  Alert,
  Platform,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import LibraryCard from "@/components/LibraryCard";
import { LibraryBook, getLibraryBooks, deleteLibraryBook } from "@/lib/storage";
import { useAuth } from "@/lib/auth-context";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadBooks = useCallback(async () => {
    const data = await getLibraryBooks();
    setBooks(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBooks();
    }, [loadBooks])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBooks();
    setRefreshing(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      "Delete Storybook",
      "Are you sure you want to delete this storybook? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteLibraryBook(id);
            loadBooks();
          },
        },
      ]
    );
  };

  const handlePress = (book: LibraryBook) => {
    router.push(`/library/${book.id}` as any);
  };

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[Colors.background, Colors.backgroundAlt, Colors.background]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>
            {user ? `Hi, ${user.name}` : "Pashabook"}
          </Text>
          <Text style={styles.subtitle}>AI Storybook Creator</Text>
        </View>
        <Pressable
          onPress={() => {
            Alert.alert("Account", "", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Log Out",
                style: "destructive",
                onPress: async () => {
                  await logout();
                  router.push("/(auth)/login");
                },
              },
            ]);
          }}
          style={({ pressed }) => [styles.avatarButton, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="person-circle-outline" size={32} color={Colors.textSecondary} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/(tabs)/create")}
          style={({ pressed }) => [styles.headerButton, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </Pressable>
      </View>

      {books.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrapper}>
            <Ionicons name="book-outline" size={48} color={Colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No storybooks yet</Text>
          <Text style={styles.emptyText}>
            Upload your child's drawing and watch it transform into an animated storybook
          </Text>
          <Pressable
            onPress={() => router.push("/(tabs)/create")}
            style={({ pressed }) => [styles.ctaButton, pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }]}
          >
            <Ionicons name="sparkles" size={20} color="#fff" />
            <Text style={styles.ctaText}>Create Your First Storybook</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 34 + 84 : 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          ListHeaderComponent={
            <Text style={styles.sectionTitle}>
              Your Library ({books.length})
            </Text>
          }
          renderItem={({ item }) => (
            <LibraryCard
              book={item}
              onPress={() => handlePress(item)}
              onDelete={() => handleDelete(item.id)}
            />
          )}
          columnWrapperStyle={styles.row}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  avatarButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  row: {
    justifyContent: "flex-start",
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    marginBottom: 6,
    marginLeft: 6,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIconWrapper: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: Colors.primary + "12",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginTop: 12,
  },
  ctaText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});
