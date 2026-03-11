import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import {
  getLibraryBooks,
  getLibraryBook,
  saveToLibrary,
  updateLibraryBookTitle,
  deleteLibraryBook,
  isInLibrary,
  type Storybook,
  type LibraryBook,
} from "./storage";

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

// Mock FileSystem
jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///mock/documents/",
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  downloadAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

describe("Library Storage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getLibraryBooks", () => {
    it("should return empty array when no books exist", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const books = await getLibraryBooks();

      expect(books).toEqual([]);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith("@pashabook_library");
    });

    it("should return sorted books by creation date", async () => {
      const mockBooks: LibraryBook[] = [
        {
          id: "1",
          title: "Book 1",
          videoUri: "file:///video1.mp4",
          thumbnailUri: "file:///thumb1.jpg",
          createdAt: 1000,
        },
        {
          id: "2",
          title: "Book 2",
          videoUri: "file:///video2.mp4",
          thumbnailUri: "file:///thumb2.jpg",
          createdAt: 2000,
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(mockBooks)
      );

      const books = await getLibraryBooks();

      expect(books).toHaveLength(2);
      expect(books[0].id).toBe("2"); // Most recent first
      expect(books[1].id).toBe("1");
    });
  });

  describe("getLibraryBook", () => {
    it("should return null when book not found", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([])
      );

      const book = await getLibraryBook("nonexistent");

      expect(book).toBeNull();
    });

    it("should return book when found", async () => {
      const mockBook: LibraryBook = {
        id: "1",
        title: "Book 1",
        videoUri: "file:///video1.mp4",
        thumbnailUri: "file:///thumb1.jpg",
        createdAt: 1000,
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([mockBook])
      );

      const book = await getLibraryBook("1");

      expect(book).toEqual(mockBook);
    });
  });

  describe("saveToLibrary", () => {
    const mockStorybook: Storybook = {
      id: "test-id",
      title: "Test Story",
      drawingUri: "file:///drawing.jpg",
      language: "en",
      status: "done",
      currentStep: "complete",
      progress: 100,
      pages: [],
      videoUrl: "https://example.com/video.mp4",
      createdAt: 1000,
      updatedAt: 1000,
    };

    beforeEach(() => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: false,
      });
      (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(
        undefined
      );
      (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({
        status: 200,
        uri: "file:///mock/documents/videos/test-id.mp4",
      });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    });

    it("should throw error when storybook has no video URL", async () => {
      const storybookNoVideo = { ...mockStorybook, videoUrl: undefined };

      await expect(saveToLibrary(storybookNoVideo)).rejects.toThrow(
        "Cannot save storybook without video URL"
      );
    });

    it("should download video and save to library", async () => {
      const libraryBook = await saveToLibrary(mockStorybook);

      expect(libraryBook.id).toBe("test-id");
      expect(libraryBook.title).toBe("Test Story");
      expect(libraryBook.videoUri).toBe(
        "file:///mock/documents/videos/test-id.mp4"
      );
      expect(FileSystem.downloadAsync).toHaveBeenCalledWith(
        "https://example.com/video.mp4",
        "file:///mock/documents/videos/test-id.mp4"
      );
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it("should use custom title when provided", async () => {
      const libraryBook = await saveToLibrary(mockStorybook, "Custom Title");

      expect(libraryBook.title).toBe("Custom Title");
    });

    it("should update existing book if already in library", async () => {
      const existingBook: LibraryBook = {
        id: "test-id",
        title: "Old Title",
        videoUri: "file:///old-video.mp4",
        thumbnailUri: "file:///old-thumb.jpg",
        createdAt: 500,
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([existingBook])
      );

      const libraryBook = await saveToLibrary(mockStorybook);

      expect(libraryBook.title).toBe("Test Story");
      const setItemCall = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const savedBooks = JSON.parse(setItemCall[1]);
      expect(savedBooks).toHaveLength(1);
      expect(savedBooks[0].id).toBe("test-id");
    });

    it("should throw error when video download fails", async () => {
      (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({
        status: 404,
        uri: "",
      });

      await expect(saveToLibrary(mockStorybook)).rejects.toThrow(
        "Failed to download video: 404"
      );
    });
  });

  describe("updateLibraryBookTitle", () => {
    it("should update book title", async () => {
      const mockBook: LibraryBook = {
        id: "1",
        title: "Old Title",
        videoUri: "file:///video1.mp4",
        thumbnailUri: "file:///thumb1.jpg",
        createdAt: 1000,
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([mockBook])
      );

      await updateLibraryBookTitle("1", "New Title");

      const setItemCall = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const savedBooks = JSON.parse(setItemCall[1]);
      expect(savedBooks[0].title).toBe("New Title");
    });

    it("should throw error when book not found", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([])
      );

      await expect(
        updateLibraryBookTitle("nonexistent", "New Title")
      ).rejects.toThrow("Library book not found: nonexistent");
    });
  });

  describe("deleteLibraryBook", () => {
    const mockBook: LibraryBook = {
      id: "1",
      title: "Book 1",
      videoUri: "file:///video1.mp4",
      thumbnailUri: "file:///thumb1.jpg",
      createdAt: 1000,
    };

    beforeEach(() => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
      });
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);
    });

    it("should delete video, thumbnail, and metadata", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([mockBook])
      );

      await deleteLibraryBook("1");

      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        "file:///video1.mp4"
      );
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        "file:///thumb1.jpg"
      );

      const setItemCall = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const savedBooks = JSON.parse(setItemCall[1]);
      expect(savedBooks).toHaveLength(0);
    });

    it("should throw error when book not found", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([])
      );

      await expect(deleteLibraryBook("nonexistent")).rejects.toThrow(
        "Library book not found: nonexistent"
      );
    });

    it("should continue if file deletion fails", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([mockBook])
      );
      (FileSystem.deleteAsync as jest.Mock).mockRejectedValue(
        new Error("File not found")
      );

      // Should not throw
      await deleteLibraryBook("1");

      // Metadata should still be removed
      const setItemCall = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const savedBooks = JSON.parse(setItemCall[1]);
      expect(savedBooks).toHaveLength(0);
    });
  });

  describe("isInLibrary", () => {
    it("should return false when book not in library", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([])
      );

      const result = await isInLibrary("nonexistent");

      expect(result).toBe(false);
    });

    it("should return true when book is in library", async () => {
      const mockBook: LibraryBook = {
        id: "1",
        title: "Book 1",
        videoUri: "file:///video1.mp4",
        thumbnailUri: "file:///thumb1.jpg",
        createdAt: 1000,
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([mockBook])
      );

      const result = await isInLibrary("1");

      expect(result).toBe(true);
    });
  });
});
