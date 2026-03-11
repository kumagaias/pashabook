import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

export interface StoryPage {
  id: string;
  pageNumber: number;
  narrationText: string;
  imagePrompt: string;
  animationMode: "standard" | "highlight";
  illustrationUrl?: string;
  animationUrl?: string;
  narrationUrl?: string;
}

export interface Storybook {
  id: string;
  title: string;
  drawingUri: string;
  language: "ja" | "en";
  status: "pending" | "processing" | "done" | "error";
  currentStep: string;
  progress: number;
  errorMessage?: string;
  pages: StoryPage[];
  videoUrl?: string;
  createdAt: number;
  updatedAt: number;
}

export interface LibraryBook {
  id: string;
  title: string;
  videoUri: string;
  thumbnailUri: string;
  createdAt: number;
}

const STORYBOOKS_KEY = "@pashabook_storybooks";
const LIBRARY_KEY = "@pashabook_library";

// Directory paths for local storage
const getVideoDirectory = () => `${FileSystem.documentDirectory}videos/`;
const getThumbnailDirectory = () => `${FileSystem.documentDirectory}thumbnails/`;

// Ensure directories exist
async function ensureDirectoriesExist(): Promise<void> {
  const videoDir = getVideoDirectory();
  const thumbnailDir = getThumbnailDirectory();

  const videoDirInfo = await FileSystem.getInfoAsync(videoDir);
  if (!videoDirInfo.exists) {
    await FileSystem.makeDirectoryAsync(videoDir, { intermediates: true });
  }

  const thumbnailDirInfo = await FileSystem.getInfoAsync(thumbnailDir);
  if (!thumbnailDirInfo.exists) {
    await FileSystem.makeDirectoryAsync(thumbnailDir, { intermediates: true });
  }
}

export async function getStorybooks(): Promise<Storybook[]> {
  const data = await AsyncStorage.getItem(STORYBOOKS_KEY);
  if (!data) return [];
  const books: Storybook[] = JSON.parse(data);
  return books.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getStorybook(id: string): Promise<Storybook | null> {
  const books = await getStorybooks();
  return books.find((b) => b.id === id) || null;
}

export async function saveStorybook(book: Storybook): Promise<void> {
  const books = await getStorybooks();
  const index = books.findIndex((b) => b.id === book.id);
  if (index >= 0) {
    books[index] = book;
  } else {
    books.push(book);
  }
  await AsyncStorage.setItem(STORYBOOKS_KEY, JSON.stringify(books));
}

export async function deleteStorybook(id: string): Promise<void> {
  const books = await getStorybooks();
  const filtered = books.filter((b) => b.id !== id);
  await AsyncStorage.setItem(STORYBOOKS_KEY, JSON.stringify(filtered));
}

export function createStorybook(
  drawingUri: string,
  language: "ja" | "en"
): Storybook {
  const id =
    Date.now().toString() + Math.random().toString(36).substr(2, 9);
  return {
    id,
    title: "",
    drawingUri,
    language,
    status: "pending",
    currentStep: "uploading",
    progress: 0,
    pages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// Library management functions

/**
 * Get all saved library books
 */
export async function getLibraryBooks(): Promise<LibraryBook[]> {
  const data = await AsyncStorage.getItem(LIBRARY_KEY);
  if (!data) return [];
  const books: LibraryBook[] = JSON.parse(data);
  return books.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Get a specific library book by ID
 */
export async function getLibraryBook(id: string): Promise<LibraryBook | null> {
  const books = await getLibraryBooks();
  return books.find((b) => b.id === id) || null;
}

/**
 * Download video file from URL and save to local storage
 */
async function downloadVideo(videoUrl: string, bookId: string): Promise<string> {
  await ensureDirectoriesExist();
  const videoUri = `${getVideoDirectory()}${bookId}.mp4`;
  
  const downloadResult = await FileSystem.downloadAsync(videoUrl, videoUri);
  
  if (downloadResult.status !== 200) {
    throw new Error(`Failed to download video: ${downloadResult.status}`);
  }
  
  return downloadResult.uri;
}

/**
 * Generate thumbnail from video file
 * For MVP, we'll create a simple placeholder thumbnail
 * In production, you would use expo-video-thumbnails or similar
 */
async function generateThumbnail(_videoUri: string, bookId: string): Promise<string> {
  await ensureDirectoriesExist();
  const thumbnailUri = `${getThumbnailDirectory()}${bookId}.jpg`;
  
  // For MVP: Just return the thumbnail URI
  // In production, use expo-video-thumbnails:
  // import { getThumbnailAsync } from 'expo-video-thumbnails';
  // const { uri } = await getThumbnailAsync(videoUri, { time: 1000 });
  // Then save the generated thumbnail to our thumbnails directory
  
  return thumbnailUri;
}

/**
 * Save a storybook to the library
 * Downloads video file and generates thumbnail
 */
export async function saveToLibrary(
  storybook: Storybook,
  customTitle?: string
): Promise<LibraryBook> {
  if (!storybook.videoUrl) {
    throw new Error("Cannot save storybook without video URL");
  }

  const bookId = storybook.id;
  
  // Download video file
  const videoUri = await downloadVideo(storybook.videoUrl, bookId);
  
  // Generate thumbnail
  const thumbnailUri = await generateThumbnail(videoUri, bookId);
  
  // Create library book entry
  const libraryBook: LibraryBook = {
    id: bookId,
    title: customTitle || storybook.title,
    videoUri,
    thumbnailUri,
    createdAt: Date.now(),
  };
  
  // Save to AsyncStorage
  const books = await getLibraryBooks();
  const existingIndex = books.findIndex((b) => b.id === bookId);
  
  if (existingIndex >= 0) {
    books[existingIndex] = libraryBook;
  } else {
    books.push(libraryBook);
  }
  
  await AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify(books));
  
  return libraryBook;
}

/**
 * Update library book title
 */
export async function updateLibraryBookTitle(
  bookId: string,
  newTitle: string
): Promise<void> {
  const books = await getLibraryBooks();
  const book = books.find((b) => b.id === bookId);
  
  if (!book) {
    throw new Error(`Library book not found: ${bookId}`);
  }
  
  book.title = newTitle;
  await AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify(books));
}

/**
 * Delete a library book
 * Removes video file, thumbnail, and metadata
 */
export async function deleteLibraryBook(bookId: string): Promise<void> {
  const books = await getLibraryBooks();
  const book = books.find((b) => b.id === bookId);
  
  if (!book) {
    throw new Error(`Library book not found: ${bookId}`);
  }
  
  // Delete video file
  try {
    const videoInfo = await FileSystem.getInfoAsync(book.videoUri);
    if (videoInfo.exists) {
      await FileSystem.deleteAsync(book.videoUri);
    }
  } catch (error) {
    console.error("Error deleting video file:", error);
  }
  
  // Delete thumbnail file
  try {
    const thumbnailInfo = await FileSystem.getInfoAsync(book.thumbnailUri);
    if (thumbnailInfo.exists) {
      await FileSystem.deleteAsync(book.thumbnailUri);
    }
  } catch (error) {
    console.error("Error deleting thumbnail file:", error);
  }
  
  // Remove from AsyncStorage
  const filtered = books.filter((b) => b.id !== bookId);
  await AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify(filtered));
}

/**
 * Check if a storybook is saved in the library
 */
export async function isInLibrary(storybookId: string): Promise<boolean> {
  const books = await getLibraryBooks();
  return books.some((b) => b.id === storybookId);
}
