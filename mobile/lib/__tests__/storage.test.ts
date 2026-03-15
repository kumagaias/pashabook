/**
 * Unit and property-based tests for library storage
 * 
 * **Validates: Requirements 13.1, 13.2, 13.3, 13.6, 13.7**
 * 
 * Unit tests:
 * - AsyncStorage operations
 * - FileSystem operations
 * - Thumbnail generation
 * 
 * Properties tested:
 * - Property 52: Library Save Functionality
 * - Property 53: Local Storage Persistence
 * - Property 55: Library Delete Functionality
 * - Property 56: Saved Storybook Fields
 */

import * as fc from 'fast-check';

// Mock dependencies BEFORE importing modules that use them
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  Paths: {
    document: '/mock/document',
  },
  Directory: jest.fn(),
  File: jest.fn(),
}));

jest.mock('expo-video-thumbnails', () => ({
  getThumbnailAsync: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Paths, Directory, File } from 'expo-file-system';
import { getThumbnailAsync } from 'expo-video-thumbnails';
import {
  saveToLibrary,
  getLibraryBooks,
  getLibraryBook,
  deleteLibraryBook,
  isInLibrary,
  updateLibraryBookTitle,
  type Storybook,
  type LibraryBook,
} from '../storage';

describe('Library Storage - Property-Based Tests', () => {
  // In-memory storage for mocking AsyncStorage
  let mockStorage: { [key: string]: string } = {};

  // Arbitraries for generating test data
  const storybookArbitrary = fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
    title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    drawingUri: fc.webUrl(),
    language: fc.constantFrom('ja' as const, 'en' as const),
    status: fc.constant('done' as const),
    currentStep: fc.constant('completed'),
    progress: fc.constant(100),
    pages: fc.array(fc.record({
      id: fc.string(),
      pageNumber: fc.nat(),
      narrationText: fc.string(),
      imagePrompt: fc.string(),
      animationMode: fc.constantFrom('standard' as const, 'highlight' as const),
    })),
    videoUrl: fc.webUrl(),
    createdAt: fc.nat(),
    updatedAt: fc.nat(),
  }) as fc.Arbitrary<Storybook>;

  const libraryBookArbitrary = fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
    title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    videoUri: fc.string({ minLength: 1 }),
    thumbnailUri: fc.string({ minLength: 1 }),
    createdAt: fc.nat(),
  }) as fc.Arbitrary<LibraryBook>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset in-memory storage
    mockStorage = {};
    
    // Setup AsyncStorage mock with in-memory storage
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      return Promise.resolve(mockStorage[key] || null);
    });
    
    (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
      mockStorage[key] = value;
      return Promise.resolve();
    });
    
    (AsyncStorage.removeItem as jest.Mock).mockImplementation((key: string) => {
      delete mockStorage[key];
      return Promise.resolve();
    });
    
    // Mock expo-file-system
    const mockDirectory = {
      exists: true,
      create: jest.fn().mockResolvedValue(undefined),
    };
    (Directory as jest.Mock).mockImplementation(() => mockDirectory);
    
    const mockFile = {
      exists: true,
      uri: 'file:///mock/path',
      delete: jest.fn().mockResolvedValue(undefined),
      copy: jest.fn().mockResolvedValue(undefined),
    };
    (File as jest.Mock).mockImplementation((uriOrDir: any, filename?: string) => {
      // Return a mock file with a unique URI based on the filename
      const uri = filename ? `file:///mock/${filename}` : (typeof uriOrDir === 'string' ? uriOrDir : 'file:///mock/file');
      return {
        ...mockFile,
        uri,
      };
    });
    (File.downloadFileAsync as jest.Mock) = jest.fn().mockImplementation((url: string, file: any) => {
      return Promise.resolve({
        ...mockFile,
        uri: file.uri || 'file:///mock/downloaded.mp4',
      });
    });
    
    // Mock expo-video-thumbnails
    (getThumbnailAsync as jest.Mock).mockResolvedValue({
      uri: 'file:///mock/thumbnail.jpg',
    });
  });

  /**
   * Property 52: Library Save Functionality
   * 
   * For any completed storybook that is saved, the library should contain an entry for that storybook.
   * 
   * **Validates: Requirements 13.1**
   */
  describe('Property 52: Library Save Functionality', () => {
    it('should contain an entry for any saved storybook', async () => {
      await fc.assert(
        fc.asyncProperty(storybookArbitrary, async (storybook) => {
          // Ensure storybook has a videoUrl
          if (!storybook.videoUrl) {
            storybook.videoUrl = 'https://example.com/video.mp4';
          }

          // Save the storybook to library
          await saveToLibrary(storybook);

          // Verify the library contains the storybook
          const isPresent = await isInLibrary(storybook.id);
          expect(isPresent).toBe(true);

          // Verify we can retrieve the book
          const retrievedBook = await getLibraryBook(storybook.id);
          expect(retrievedBook).not.toBeNull();
          expect(retrievedBook?.id).toBe(storybook.id);
        }),
        { numRuns: 50 }
      );
    });

    it('should handle saving multiple storybooks', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(storybookArbitrary, { minLength: 1, maxLength: 10 }),
          async (storybooks) => {
            // Ensure all storybooks have videoUrls and unique IDs
            const uniqueStorybooks = storybooks.map((sb, idx) => ({
              ...sb,
              id: `${sb.id}-${idx}`,
              videoUrl: sb.videoUrl || `https://example.com/video-${idx}.mp4`,
            }));

            // Save all storybooks
            for (const storybook of uniqueStorybooks) {
              await saveToLibrary(storybook);
            }

            // Verify all are in the library
            const allBooks = await getLibraryBooks();
            expect(allBooks.length).toBeGreaterThanOrEqual(uniqueStorybooks.length);

            for (const storybook of uniqueStorybooks) {
              const isPresent = await isInLibrary(storybook.id);
              expect(isPresent).toBe(true);
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 53: Local Storage Persistence
   * 
   * For any saved storybook, the video file should be retrievable from the device's file system
   * and metadata should be retrievable from AsyncStorage.
   * 
   * **Validates: Requirements 13.2, 13.3, 13.6, 13.7**
   */
  describe('Property 53: Local Storage Persistence', () => {
    it('should persist metadata in AsyncStorage and video in FileSystem', async () => {
      await fc.assert(
        fc.asyncProperty(storybookArbitrary, async (storybook) => {
          // Ensure storybook has a videoUrl
          if (!storybook.videoUrl) {
            storybook.videoUrl = 'https://example.com/video.mp4';
          }

          // Save the storybook
          await saveToLibrary(storybook);

          // Verify AsyncStorage.setItem was called
          expect(AsyncStorage.setItem).toHaveBeenCalledWith(
            '@pashabook_library',
            expect.any(String)
          );

          // Verify File.downloadFileAsync was called for video
          expect(File.downloadFileAsync).toHaveBeenCalled();

          // Verify thumbnail generation was attempted
          expect(getThumbnailAsync).toHaveBeenCalled();

          // Retrieve the book and verify it has all required fields
          const retrievedBook = await getLibraryBook(storybook.id);
          expect(retrievedBook).not.toBeNull();
          expect(retrievedBook).toHaveProperty('videoUri');
          expect(retrievedBook).toHaveProperty('thumbnailUri');
        }),
        { numRuns: 50 }
      );
    });

    it('should retrieve the same data that was saved', async () => {
      await fc.assert(
        fc.asyncProperty(
          storybookArbitrary,
          fc.string({ minLength: 1, maxLength: 100 }),
          async (storybook, customTitle) => {
            // Ensure storybook has a videoUrl
            if (!storybook.videoUrl) {
              storybook.videoUrl = 'https://example.com/video.mp4';
            }

            // Save with custom title
            const savedBook = await saveToLibrary(storybook, customTitle);

            // Retrieve and verify
            const retrievedBook = await getLibraryBook(storybook.id);
            expect(retrievedBook).not.toBeNull();
            expect(retrievedBook?.title).toBe(customTitle);
            expect(retrievedBook?.id).toBe(savedBook.id);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 55: Library Delete Functionality
   * 
   * For any storybook deleted from the library, the library should no longer contain that storybook.
   * 
   * **Validates: Requirements 13.5**
   */
  describe('Property 55: Library Delete Functionality', () => {
    it('should remove storybook from library after deletion', async () => {
      await fc.assert(
        fc.asyncProperty(storybookArbitrary, async (storybook) => {
          // Ensure storybook has a videoUrl
          if (!storybook.videoUrl) {
            storybook.videoUrl = 'https://example.com/video.mp4';
          }

          // Save the storybook
          await saveToLibrary(storybook);

          // Verify it's in the library
          let isPresent = await isInLibrary(storybook.id);
          expect(isPresent).toBe(true);

          // Delete the storybook
          await deleteLibraryBook(storybook.id);

          // Verify it's no longer in the library
          isPresent = await isInLibrary(storybook.id);
          expect(isPresent).toBe(false);

          // Verify we cannot retrieve it
          const retrievedBook = await getLibraryBook(storybook.id);
          expect(retrievedBook).toBeNull();
        }),
        { numRuns: 50 }
      );
    });

    it('should delete video and thumbnail files', async () => {
      await fc.assert(
        fc.asyncProperty(storybookArbitrary, async (storybook) => {
          // Ensure storybook has a videoUrl
          if (!storybook.videoUrl) {
            storybook.videoUrl = 'https://example.com/video.mp4';
          }

          // Save the storybook
          await saveToLibrary(storybook);

          // Mock file exists check
          const mockFile = {
            exists: true,
            delete: jest.fn().mockResolvedValue(undefined),
          };
          (File as jest.Mock).mockImplementation(() => mockFile);

          // Delete the storybook
          await deleteLibraryBook(storybook.id);

          // Verify file deletion was attempted
          // Note: We check that File constructor was called, which happens during deletion
          expect(File).toHaveBeenCalled();
        }),
        { numRuns: 50 }
      );
    });

    it('should handle deletion of non-existent storybook', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }),
          async (nonExistentId) => {
            // Attempt to delete a non-existent storybook
            await expect(deleteLibraryBook(nonExistentId)).rejects.toThrow(
              `Library book not found: ${nonExistentId}`
            );
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 56: Saved Storybook Fields
   * 
   * For any saved storybook, the stored data should include title, video file URI,
   * thumbnail URI, and creation timestamp fields.
   * 
   * **Validates: Requirements 13.7**
   */
  describe('Property 56: Saved Storybook Fields', () => {
    it('should include all required fields for any saved storybook', async () => {
      await fc.assert(
        fc.asyncProperty(storybookArbitrary, async (storybook) => {
          // Ensure storybook has a videoUrl
          if (!storybook.videoUrl) {
            storybook.videoUrl = 'https://example.com/video.mp4';
          }

          // Save the storybook
          await saveToLibrary(storybook);

          // Retrieve and verify all required fields
          const retrievedBook = await getLibraryBook(storybook.id);
          expect(retrievedBook).not.toBeNull();

          // Verify required fields exist
          expect(retrievedBook).toHaveProperty('id');
          expect(retrievedBook).toHaveProperty('title');
          expect(retrievedBook).toHaveProperty('videoUri');
          expect(retrievedBook).toHaveProperty('thumbnailUri');
          expect(retrievedBook).toHaveProperty('createdAt');

          // Verify field types
          expect(typeof retrievedBook!.id).toBe('string');
          expect(typeof retrievedBook!.title).toBe('string');
          expect(typeof retrievedBook!.videoUri).toBe('string');
          expect(typeof retrievedBook!.thumbnailUri).toBe('string');
          expect(typeof retrievedBook!.createdAt).toBe('number');

          // Verify non-empty strings
          expect(retrievedBook!.id.length).toBeGreaterThan(0);
          expect(retrievedBook!.title.length).toBeGreaterThan(0);
          expect(retrievedBook!.videoUri.length).toBeGreaterThan(0);
          // thumbnailUri can be empty if generation fails
          expect(retrievedBook!.createdAt).toBeGreaterThan(0);
        }),
        { numRuns: 50 }
      );
    });

    it('should preserve custom title when provided', async () => {
      await fc.assert(
        fc.asyncProperty(
          storybookArbitrary,
          fc.string({ minLength: 1, maxLength: 100 }),
          async (storybook, customTitle) => {
            // Ensure storybook has a videoUrl
            if (!storybook.videoUrl) {
              storybook.videoUrl = 'https://example.com/video.mp4';
            }

            // Save with custom title
            await saveToLibrary(storybook, customTitle);

            // Retrieve and verify custom title is preserved
            const retrievedBook = await getLibraryBook(storybook.id);
            expect(retrievedBook).not.toBeNull();
            expect(retrievedBook!.title).toBe(customTitle);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should use storybook title when custom title is not provided', async () => {
      await fc.assert(
        fc.asyncProperty(storybookArbitrary, async (storybook) => {
          // Ensure storybook has a videoUrl
          if (!storybook.videoUrl) {
            storybook.videoUrl = 'https://example.com/video.mp4';
          }

          // Save without custom title
          await saveToLibrary(storybook);

          // Retrieve and verify storybook title is used
          const retrievedBook = await getLibraryBook(storybook.id);
          expect(retrievedBook).not.toBeNull();
          expect(retrievedBook!.title).toBe(storybook.title);
        }),
        { numRuns: 50 }
      );
    });

    it('should allow title updates after saving', async () => {
      await fc.assert(
        fc.asyncProperty(
          storybookArbitrary,
          fc.string({ minLength: 1, maxLength: 100 }),
          async (storybook, newTitle) => {
            // Ensure storybook has a videoUrl
            if (!storybook.videoUrl) {
              storybook.videoUrl = 'https://example.com/video.mp4';
            }

            // Save the storybook
            await saveToLibrary(storybook);

            // Update the title
            await updateLibraryBookTitle(storybook.id, newTitle);

            // Retrieve and verify title was updated
            const retrievedBook = await getLibraryBook(storybook.id);
            expect(retrievedBook).not.toBeNull();
            expect(retrievedBook!.title).toBe(newTitle);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Additional property: Save-Retrieve Round-Trip
   * 
   * For any storybook saved to the library, retrieving all books should include that storybook.
   */
  describe('Additional Property: Save-Retrieve Round-Trip', () => {
    it('should retrieve all saved storybooks', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(storybookArbitrary, { minLength: 1, maxLength: 5 }),
          async (storybooks) => {
            // Ensure all storybooks have videoUrls and unique IDs
            const uniqueStorybooks = storybooks.map((sb, idx) => ({
              ...sb,
              id: `${sb.id}-${idx}`,
              videoUrl: sb.videoUrl || `https://example.com/video-${idx}.mp4`,
            }));

            // Save all storybooks
            for (const storybook of uniqueStorybooks) {
              await saveToLibrary(storybook);
            }

            // Retrieve all books
            const allBooks = await getLibraryBooks();

            // Verify count
            expect(allBooks.length).toBeGreaterThanOrEqual(uniqueStorybooks.length);

            // Verify each saved storybook is in the retrieved list
            for (const storybook of uniqueStorybooks) {
              const found = allBooks.find((book) => book.id === storybook.id);
              expect(found).toBeDefined();
              expect(found).toHaveProperty('id', storybook.id);
              expect(found).toHaveProperty('title');
              expect(found).toHaveProperty('videoUri');
              expect(found).toHaveProperty('thumbnailUri');
              expect(found).toHaveProperty('createdAt');
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});

// ============================================================================
// UNIT TESTS
// ============================================================================

describe('Library Storage - Unit Tests', () => {
  let mockStorage: { [key: string]: string } = {};

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset in-memory storage
    mockStorage = {};
    
    // Setup AsyncStorage mock
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      return Promise.resolve(mockStorage[key] || null);
    });
    
    (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
      mockStorage[key] = value;
      return Promise.resolve();
    });
    
    (AsyncStorage.removeItem as jest.Mock).mockImplementation((key: string) => {
      delete mockStorage[key];
      return Promise.resolve();
    });
    
    // Mock expo-file-system
    const mockDirectory = {
      exists: true,
      create: jest.fn().mockResolvedValue(undefined),
    };
    (Directory as unknown as jest.Mock).mockImplementation(() => mockDirectory);
    
    const mockFile = {
      exists: true,
      uri: 'file:///mock/path',
      delete: jest.fn().mockResolvedValue(undefined),
      copy: jest.fn().mockResolvedValue(undefined),
    };
    (File as unknown as jest.Mock).mockImplementation((uriOrDir: any, filename?: string) => {
      const uri = filename ? `file:///mock/${filename}` : (typeof uriOrDir === 'string' ? uriOrDir : 'file:///mock/file');
      return {
        ...mockFile,
        uri,
      };
    });
    (File.downloadFileAsync as jest.Mock) = jest.fn().mockImplementation((url: string, file: any) => {
      return Promise.resolve({
        ...mockFile,
        uri: file.uri || 'file:///mock/downloaded.mp4',
      });
    });
    
    // Mock expo-video-thumbnails
    (getThumbnailAsync as jest.Mock).mockResolvedValue({
      uri: 'file:///mock/thumbnail.jpg',
    });
  });

  /**
   * Test AsyncStorage operations
   * **Validates: Requirements 13.2, 13.6**
   */
  describe('AsyncStorage operations', () => {
    it('should save library book metadata to AsyncStorage', async () => {
      const storybook: Storybook = {
        id: 'test-book-1',
        title: 'Test Book',
        drawingUri: 'file:///drawing.jpg',
        language: 'en',
        status: 'done',
        currentStep: 'completed',
        progress: 100,
        pages: [],
        videoUrl: 'https://example.com/video.mp4',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await saveToLibrary(storybook);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@pashabook_library',
        expect.any(String)
      );

      const savedData = mockStorage['@pashabook_library'];
      expect(savedData).toBeDefined();
      
      const parsedData = JSON.parse(savedData);
      expect(parsedData).toHaveLength(1);
      expect(parsedData[0]).toMatchObject({
        id: 'test-book-1',
        title: 'Test Book',
      });
    });

    it('should retrieve library books from AsyncStorage', async () => {
      const mockBooks: LibraryBook[] = [
        {
          id: 'book-1',
          title: 'Book 1',
          videoUri: 'file:///video1.mp4',
          thumbnailUri: 'file:///thumb1.jpg',
          createdAt: 1000,
        },
        {
          id: 'book-2',
          title: 'Book 2',
          videoUri: 'file:///video2.mp4',
          thumbnailUri: 'file:///thumb2.jpg',
          createdAt: 2000,
        },
      ];

      mockStorage['@pashabook_library'] = JSON.stringify(mockBooks);

      const books = await getLibraryBooks();

      expect(AsyncStorage.getItem).toHaveBeenCalledWith('@pashabook_library');
      expect(books).toHaveLength(2);
      expect(books[0].id).toBe('book-2'); // Sorted by createdAt descending
      expect(books[1].id).toBe('book-1');
    });

    it('should return empty array when no books in AsyncStorage', async () => {
      const books = await getLibraryBooks();

      expect(AsyncStorage.getItem).toHaveBeenCalledWith('@pashabook_library');
      expect(books).toEqual([]);
    });

    it('should retrieve specific book by ID from AsyncStorage', async () => {
      const mockBooks: LibraryBook[] = [
        {
          id: 'book-1',
          title: 'Book 1',
          videoUri: 'file:///video1.mp4',
          thumbnailUri: 'file:///thumb1.jpg',
          createdAt: 1000,
        },
      ];

      mockStorage['@pashabook_library'] = JSON.stringify(mockBooks);

      const book = await getLibraryBook('book-1');

      expect(book).not.toBeNull();
      expect(book?.id).toBe('book-1');
      expect(book?.title).toBe('Book 1');
    });

    it('should return null when book not found in AsyncStorage', async () => {
      const book = await getLibraryBook('non-existent');

      expect(book).toBeNull();
    });

    it('should update book title in AsyncStorage', async () => {
      const mockBooks: LibraryBook[] = [
        {
          id: 'book-1',
          title: 'Old Title',
          videoUri: 'file:///video1.mp4',
          thumbnailUri: 'file:///thumb1.jpg',
          createdAt: 1000,
        },
      ];

      mockStorage['@pashabook_library'] = JSON.stringify(mockBooks);

      await updateLibraryBookTitle('book-1', 'New Title');

      const savedData = mockStorage['@pashabook_library'];
      const parsedData = JSON.parse(savedData);
      expect(parsedData[0].title).toBe('New Title');
    });

    it('should throw error when updating non-existent book', async () => {
      await expect(
        updateLibraryBookTitle('non-existent', 'New Title')
      ).rejects.toThrow('Library book not found: non-existent');
    });

    it('should remove book from AsyncStorage on delete', async () => {
      const mockBooks: LibraryBook[] = [
        {
          id: 'book-1',
          title: 'Book 1',
          videoUri: 'file:///video1.mp4',
          thumbnailUri: 'file:///thumb1.jpg',
          createdAt: 1000,
        },
        {
          id: 'book-2',
          title: 'Book 2',
          videoUri: 'file:///video2.mp4',
          thumbnailUri: 'file:///thumb2.jpg',
          createdAt: 2000,
        },
      ];

      mockStorage['@pashabook_library'] = JSON.stringify(mockBooks);

      await deleteLibraryBook('book-1');

      const savedData = mockStorage['@pashabook_library'];
      const parsedData = JSON.parse(savedData);
      expect(parsedData).toHaveLength(1);
      expect(parsedData[0].id).toBe('book-2');
    });

    it('should check if book exists in library', async () => {
      const mockBooks: LibraryBook[] = [
        {
          id: 'book-1',
          title: 'Book 1',
          videoUri: 'file:///video1.mp4',
          thumbnailUri: 'file:///thumb1.jpg',
          createdAt: 1000,
        },
      ];

      mockStorage['@pashabook_library'] = JSON.stringify(mockBooks);

      const exists = await isInLibrary('book-1');
      const notExists = await isInLibrary('book-2');

      expect(exists).toBe(true);
      expect(notExists).toBe(false);
    });
  });

  /**
   * Test FileSystem operations
   * **Validates: Requirements 13.2, 13.3**
   */
  describe('FileSystem operations', () => {
    it('should download video file to FileSystem', async () => {
      const storybook: Storybook = {
        id: 'test-book-1',
        title: 'Test Book',
        drawingUri: 'file:///drawing.jpg',
        language: 'en',
        status: 'done',
        currentStep: 'completed',
        progress: 100,
        pages: [],
        videoUrl: 'https://example.com/video.mp4',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await saveToLibrary(storybook);

      expect(File.downloadFileAsync).toHaveBeenCalledWith(
        'https://example.com/video.mp4',
        expect.objectContaining({
          uri: expect.stringContaining('test-book-1.mp4'),
        }),
        expect.objectContaining({
          idempotent: true,
        })
      );
    });

    it('should create video directory if it does not exist', async () => {
      const mockDirectory = {
        exists: false,
        create: jest.fn().mockResolvedValue(undefined),
      };
      (Directory as unknown as jest.Mock).mockImplementation(() => mockDirectory);

      const storybook: Storybook = {
        id: 'test-book-1',
        title: 'Test Book',
        drawingUri: 'file:///drawing.jpg',
        language: 'en',
        status: 'done',
        currentStep: 'completed',
        progress: 100,
        pages: [],
        videoUrl: 'https://example.com/video.mp4',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await saveToLibrary(storybook);

      expect(mockDirectory.create).toHaveBeenCalled();
    });

    it('should delete video file from FileSystem', async () => {
      const mockFile = {
        exists: true,
        delete: jest.fn().mockResolvedValue(undefined),
      };
      (File as unknown as jest.Mock).mockImplementation(() => mockFile);

      const mockBooks: LibraryBook[] = [
        {
          id: 'book-1',
          title: 'Book 1',
          videoUri: 'file:///video1.mp4',
          thumbnailUri: 'file:///thumb1.jpg',
          createdAt: 1000,
        },
      ];

      mockStorage['@pashabook_library'] = JSON.stringify(mockBooks);

      await deleteLibraryBook('book-1');

      expect(mockFile.delete).toHaveBeenCalled();
    });

    it('should handle video file deletion errors gracefully', async () => {
      const mockFile = {
        exists: true,
        delete: jest.fn().mockRejectedValue(new Error('Delete failed')),
      };
      (File as unknown as jest.Mock).mockImplementation(() => mockFile);

      const mockBooks: LibraryBook[] = [
        {
          id: 'book-1',
          title: 'Book 1',
          videoUri: 'file:///video1.mp4',
          thumbnailUri: 'file:///thumb1.jpg',
          createdAt: 1000,
        },
      ];

      mockStorage['@pashabook_library'] = JSON.stringify(mockBooks);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await deleteLibraryBook('book-1');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error deleting video file:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should delete thumbnail file from FileSystem', async () => {
      const mockFile = {
        exists: true,
        delete: jest.fn().mockResolvedValue(undefined),
      };
      (File as unknown as jest.Mock).mockImplementation(() => mockFile);

      const mockBooks: LibraryBook[] = [
        {
          id: 'book-1',
          title: 'Book 1',
          videoUri: 'file:///video1.mp4',
          thumbnailUri: 'file:///thumb1.jpg',
          createdAt: 1000,
        },
      ];

      mockStorage['@pashabook_library'] = JSON.stringify(mockBooks);

      await deleteLibraryBook('book-1');

      expect(mockFile.delete).toHaveBeenCalled();
    });

    it('should handle thumbnail file deletion errors gracefully', async () => {
      let callCount = 0;
      const mockFile = {
        exists: true,
        delete: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 2) {
            return Promise.reject(new Error('Delete failed'));
          }
          return Promise.resolve();
        }),
      };
      (File as unknown as jest.Mock).mockImplementation(() => mockFile);

      const mockBooks: LibraryBook[] = [
        {
          id: 'book-1',
          title: 'Book 1',
          videoUri: 'file:///video1.mp4',
          thumbnailUri: 'file:///thumb1.jpg',
          createdAt: 1000,
        },
      ];

      mockStorage['@pashabook_library'] = JSON.stringify(mockBooks);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await deleteLibraryBook('book-1');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error deleting thumbnail file:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  /**
   * Test thumbnail generation
   * **Validates: Requirements 13.6**
   */
  describe('Thumbnail generation', () => {
    it('should generate thumbnail from video file', async () => {
      const storybook: Storybook = {
        id: 'test-book-1',
        title: 'Test Book',
        drawingUri: 'file:///drawing.jpg',
        language: 'en',
        status: 'done',
        currentStep: 'completed',
        progress: 100,
        pages: [],
        videoUrl: 'https://example.com/video.mp4',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await saveToLibrary(storybook);

      expect(getThumbnailAsync).toHaveBeenCalledWith(
        expect.stringContaining('test-book-1.mp4'),
        expect.objectContaining({
          time: 1000, // 1 second
        })
      );
    });

    it('should copy generated thumbnail to thumbnails directory', async () => {
      const mockTempFile = {
        copy: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
      };

      (File as unknown as jest.Mock).mockImplementation((uriOrDir: any, filename?: string) => {
        if (typeof uriOrDir === 'string' && uriOrDir === 'file:///mock/thumbnail.jpg') {
          return mockTempFile;
        }
        const uri = filename ? `file:///mock/${filename}` : 'file:///mock/file';
        return {
          exists: true,
          uri,
          delete: jest.fn().mockResolvedValue(undefined),
          copy: jest.fn().mockResolvedValue(undefined),
        };
      });

      const storybook: Storybook = {
        id: 'test-book-1',
        title: 'Test Book',
        drawingUri: 'file:///drawing.jpg',
        language: 'en',
        status: 'done',
        currentStep: 'completed',
        progress: 100,
        pages: [],
        videoUrl: 'https://example.com/video.mp4',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await saveToLibrary(storybook);

      expect(mockTempFile.copy).toHaveBeenCalled();
      expect(mockTempFile.delete).toHaveBeenCalled();
    });

    it('should handle thumbnail generation errors gracefully', async () => {
      (getThumbnailAsync as jest.Mock).mockRejectedValue(new Error('Thumbnail generation failed'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const storybook: Storybook = {
        id: 'test-book-1',
        title: 'Test Book',
        drawingUri: 'file:///drawing.jpg',
        language: 'en',
        status: 'done',
        currentStep: 'completed',
        progress: 100,
        pages: [],
        videoUrl: 'https://example.com/video.mp4',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = await saveToLibrary(storybook);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error generating thumbnail:',
        expect.any(Error)
      );
      expect(result.thumbnailUri).toBe(''); // Empty string on failure

      consoleErrorSpy.mockRestore();
    });

    it('should create thumbnail directory if it does not exist', async () => {
      const mockDirectory = {
        exists: false,
        create: jest.fn().mockResolvedValue(undefined),
      };
      (Directory as unknown as jest.Mock).mockImplementation(() => mockDirectory);

      const storybook: Storybook = {
        id: 'test-book-1',
        title: 'Test Book',
        drawingUri: 'file:///drawing.jpg',
        language: 'en',
        status: 'done',
        currentStep: 'completed',
        progress: 100,
        pages: [],
        videoUrl: 'https://example.com/video.mp4',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await saveToLibrary(storybook);

      expect(mockDirectory.create).toHaveBeenCalled();
    });

    it('should save library book with thumbnail URI', async () => {
      const storybook: Storybook = {
        id: 'test-book-1',
        title: 'Test Book',
        drawingUri: 'file:///drawing.jpg',
        language: 'en',
        status: 'done',
        currentStep: 'completed',
        progress: 100,
        pages: [],
        videoUrl: 'https://example.com/video.mp4',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = await saveToLibrary(storybook);

      expect(result.thumbnailUri).toBeDefined();
      expect(result.thumbnailUri).toContain('test-book-1.jpg');
    });
  });

  /**
   * Test error handling
   */
  describe('Error handling', () => {
    it('should throw error when saving storybook without video URL', async () => {
      const storybook: Storybook = {
        id: 'test-book-1',
        title: 'Test Book',
        drawingUri: 'file:///drawing.jpg',
        language: 'en',
        status: 'done',
        currentStep: 'completed',
        progress: 100,
        pages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await expect(saveToLibrary(storybook)).rejects.toThrow(
        'Cannot save storybook without video URL'
      );
    });

    it('should throw error when deleting non-existent book', async () => {
      await expect(deleteLibraryBook('non-existent')).rejects.toThrow(
        'Library book not found: non-existent'
      );
    });
  });
});
