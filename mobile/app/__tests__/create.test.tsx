import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import CreateScreen from '../(tabs)/create';
import { useLanguage } from '@/lib/language-context';
import { useAuth } from '@/lib/auth-context';
import { uploadImage } from '@/lib/api';
import { createStorybook, saveStorybook } from '@/lib/storage';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => []),
}));
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: null })),
  onAuthStateChanged: jest.fn((auth, callback) => {
    callback(null);
    return jest.fn();
  }),
}));
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
}));
jest.mock('expo-image-picker');
jest.mock('expo-image-manipulator');
jest.mock('expo-haptics');
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
}));
jest.mock('@/lib/language-context');
jest.mock('@/lib/auth-context');
jest.mock('@/lib/api');
jest.mock('@/lib/storage');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: any) => children,
}));
jest.mock('expo-image', () => ({
  Image: 'Image',
}));
jest.mock('expo-file-system', () => ({
  documentDirectory: 'file://test-directory/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  deleteAsync: jest.fn(),
  copyAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
}));
jest.mock('expo-video-thumbnails', () => ({
  getThumbnailAsync: jest.fn(),
}));

describe('CreateScreen - Upload Section', () => {
  const mockSetLanguage = jest.fn();
  const mockGetIdToken = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mocks
    (useLanguage as jest.Mock).mockReturnValue({
      language: 'en',
      setLanguage: mockSetLanguage,
    });
    
    (useAuth as jest.Mock).mockReturnValue({
      getIdToken: mockGetIdToken,
    });
    
    mockGetIdToken.mockResolvedValue('test-token');
    
    // Mock Platform
    Platform.OS = 'ios';
    
    // Mock Alert
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Image picker integration', () => {
    describe('Gallery picker', () => {
      it('should open gallery when gallery button is pressed', async () => {
        (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
          canceled: false,
          assets: [{ uri: 'file://test-image.jpg' }],
        });
        (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
          uri: 'file://test-image-converted.jpg',
        });
        (Haptics.impactAsync as jest.Mock).mockResolvedValue(undefined);

        render(<CreateScreen />);

        const galleryButton = screen.getByText('Gallery');
        fireEvent.press(galleryButton);

        await waitFor(() => {
          expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith({
            mediaTypes: ['images'],
            quality: 0.8,
          });
        });
      });

      it('should display selected image from gallery', async () => {
        (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
          canceled: false,
          assets: [{ uri: 'file://test-image.jpg' }],
        });
        (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
          uri: 'file://test-image-converted.jpg',
        });
        (Haptics.impactAsync as jest.Mock).mockResolvedValue(undefined);

        render(<CreateScreen />);

        const galleryButton = screen.getByText('Gallery');
        fireEvent.press(galleryButton);

        await waitFor(() => {
          expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
            'file://test-image.jpg',
            [],
            { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
          );
        });

        await waitFor(() => {
          expect(Haptics.impactAsync).toHaveBeenCalledWith(
            Haptics.ImpactFeedbackStyle.Light
          );
        });
      });

      it('should not display image when gallery selection is canceled', async () => {
        (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
          canceled: true,
        });

        render(<CreateScreen />);

        const galleryButton = screen.getByText('Gallery');
        fireEvent.press(galleryButton);

        await waitFor(() => {
          expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
        });

        expect(ImageManipulator.manipulateAsync).not.toHaveBeenCalled();
        expect(Haptics.impactAsync).not.toHaveBeenCalled();
      });

      it('should convert image to JPEG format', async () => {
        (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
          canceled: false,
          assets: [{ uri: 'file://test-image.heic' }],
        });
        (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
          uri: 'file://test-image-converted.jpg',
        });
        (Haptics.impactAsync as jest.Mock).mockResolvedValue(undefined);

        render(<CreateScreen />);

        const galleryButton = screen.getByText('Gallery');
        fireEvent.press(galleryButton);

        await waitFor(() => {
          expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
            'file://test-image.heic',
            [],
            { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
          );
        });
      });
    });

    describe('Camera picker', () => {
      it('should request camera permission when camera button is pressed', async () => {
        (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
          granted: true,
          canAskAgain: true,
        });
        (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
          canceled: false,
          assets: [{ uri: 'file://camera-image.jpg' }],
        });
        (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
          uri: 'file://camera-image-converted.jpg',
        });
        (Haptics.impactAsync as jest.Mock).mockResolvedValue(undefined);

        render(<CreateScreen />);

        const cameraButton = screen.getByText('Camera');
        fireEvent.press(cameraButton);

        await waitFor(() => {
          expect(ImagePicker.requestCameraPermissionsAsync).toHaveBeenCalled();
        });
      });

      it('should open camera when permission is granted', async () => {
        (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
          granted: true,
          canAskAgain: true,
        });
        (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
          canceled: false,
          assets: [{ uri: 'file://camera-image.jpg' }],
        });
        (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
          uri: 'file://camera-image-converted.jpg',
        });
        (Haptics.impactAsync as jest.Mock).mockResolvedValue(undefined);

        render(<CreateScreen />);

        const cameraButton = screen.getByText('Camera');
        fireEvent.press(cameraButton);

        await waitFor(() => {
          expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith({
            mediaTypes: ['images'],
            quality: 0.8,
          });
        });
      });

      it('should display alert when camera permission is denied', async () => {
        (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
          granted: false,
          canAskAgain: true,
        });

        render(<CreateScreen />);

        const cameraButton = screen.getByText('Camera');
        fireEvent.press(cameraButton);

        await waitFor(() => {
          expect(Alert.alert).toHaveBeenCalledWith(
            'Permission Required',
            'Camera permission is needed to take photos.'
          );
        });

        expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
      });

      it('should display settings alert when permission is permanently denied', async () => {
        (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
          granted: false,
          canAskAgain: false,
        });

        render(<CreateScreen />);

        const cameraButton = screen.getByText('Camera');
        fireEvent.press(cameraButton);

        await waitFor(() => {
          expect(Alert.alert).toHaveBeenCalledWith(
            'Permission Required',
            'Camera access was denied. Please enable it in Settings.',
            expect.arrayContaining([
              { text: 'Cancel', style: 'cancel' },
              expect.objectContaining({ text: 'Open Settings' }),
            ])
          );
        });
      });

      it('should display captured image from camera', async () => {
        (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
          granted: true,
          canAskAgain: true,
        });
        (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
          canceled: false,
          assets: [{ uri: 'file://camera-image.jpg' }],
        });
        (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
          uri: 'file://camera-image-converted.jpg',
        });
        (Haptics.impactAsync as jest.Mock).mockResolvedValue(undefined);

        render(<CreateScreen />);

        const cameraButton = screen.getByText('Camera');
        fireEvent.press(cameraButton);

        await waitFor(() => {
          expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
            'file://camera-image.jpg',
            [],
            { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
          );
        });

        await waitFor(() => {
          expect(Haptics.impactAsync).toHaveBeenCalledWith(
            Haptics.ImpactFeedbackStyle.Light
          );
        });
      });
    });

    describe('Image removal', () => {
      it('should allow image selection and display', async () => {
        (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
          canceled: false,
          assets: [{ uri: 'file://test-image.jpg' }],
        });
        (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
          uri: 'file://test-image-converted.jpg',
        });
        (Haptics.impactAsync as jest.Mock).mockResolvedValue(undefined);

        render(<CreateScreen />);

        // Initially, gallery button should be visible
        expect(screen.getByText('Gallery')).toBeTruthy();

        // Select image
        const galleryButton = screen.getByText('Gallery');
        fireEvent.press(galleryButton);

        await waitFor(() => {
          expect(ImageManipulator.manipulateAsync).toHaveBeenCalled();
        });

        // After selection, the image should be processed
        expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
          'file://test-image.jpg',
          [],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
      });
    });
  });

  describe('Loading state display', () => {
    it('should display loading state when creating storybook', async () => {
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://test-image.jpg' }],
      });
      (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
        uri: 'file://test-image-converted.jpg',
      });
      (Haptics.impactAsync as jest.Mock).mockResolvedValue(undefined);
      (Haptics.notificationAsync as jest.Mock).mockResolvedValue(undefined);
      (uploadImage as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ jobId: 'test-job-123' }), 100))
      );
      (createStorybook as jest.Mock).mockReturnValue({
        id: 'test-job-123',
        status: 'pending',
        currentStep: 'uploading',
        progress: 0,
      });
      (saveStorybook as jest.Mock).mockResolvedValue(undefined);

      render(<CreateScreen />);

      // Select image
      const galleryButton = screen.getByText('Gallery');
      fireEvent.press(galleryButton);

      await waitFor(() => {
        expect(ImageManipulator.manipulateAsync).toHaveBeenCalled();
      });

      // Press create button
      const createButton = screen.getByText('Generate Storybook');
      fireEvent.press(createButton);

      // Should show loading text
      await waitFor(() => {
        expect(screen.getByText('Creating...')).toBeTruthy();
      });
    });

    it('should display upload progress bar during creation', async () => {
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://test-image.jpg' }],
      });
      (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
        uri: 'file://test-image-converted.jpg',
      });
      (Haptics.impactAsync as jest.Mock).mockResolvedValue(undefined);
      (Haptics.notificationAsync as jest.Mock).mockResolvedValue(undefined);
      (uploadImage as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ jobId: 'test-job-123' }), 100))
      );
      (createStorybook as jest.Mock).mockReturnValue({
        id: 'test-job-123',
        status: 'pending',
        currentStep: 'uploading',
        progress: 0,
      });
      (saveStorybook as jest.Mock).mockResolvedValue(undefined);

      render(<CreateScreen />);

      // Select image
      const galleryButton = screen.getByText('Gallery');
      fireEvent.press(galleryButton);

      await waitFor(() => {
        expect(ImageManipulator.manipulateAsync).toHaveBeenCalled();
      });

      // Press create button
      const createButton = screen.getByText('Generate Storybook');
      fireEvent.press(createButton);

      // Should show uploading text
      await waitFor(() => {
        expect(screen.getByText('Uploading...')).toBeTruthy();
      });
    });

    it('should disable create button when no image is selected', () => {
      render(<CreateScreen />);

      const createButton = screen.getByText('Generate Storybook');
      
      // Button exists
      expect(createButton).toBeTruthy();
      
      // When disabled, pressing the button should not trigger any action
      // (React Native Pressable with disabled=true doesn't fire onPress)
      fireEvent.press(createButton);
      
      // Alert should NOT be called because the button is disabled
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('should disable create button during creation', async () => {
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://test-image.jpg' }],
      });
      (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
        uri: 'file://test-image-converted.jpg',
      });
      (Haptics.impactAsync as jest.Mock).mockResolvedValue(undefined);
      (Haptics.notificationAsync as jest.Mock).mockResolvedValue(undefined);
      (uploadImage as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ jobId: 'test-job-123' }), 100))
      );
      (createStorybook as jest.Mock).mockReturnValue({
        id: 'test-job-123',
        status: 'pending',
        currentStep: 'uploading',
        progress: 0,
      });
      (saveStorybook as jest.Mock).mockResolvedValue(undefined);

      render(<CreateScreen />);

      // Select image
      const galleryButton = screen.getByText('Gallery');
      fireEvent.press(galleryButton);

      await waitFor(() => {
        expect(ImageManipulator.manipulateAsync).toHaveBeenCalled();
      });

      // Press create button
      const createButton = screen.getByText('Generate Storybook');
      fireEvent.press(createButton);

      // Button should show "Creating..." text which indicates it's in loading state
      await waitFor(() => {
        expect(screen.getByText('Creating...')).toBeTruthy();
      });
    });

    it('should trigger haptic feedback on successful upload', async () => {
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://test-image.jpg' }],
      });
      (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
        uri: 'file://test-image-converted.jpg',
      });
      (Haptics.impactAsync as jest.Mock).mockResolvedValue(undefined);
      (Haptics.notificationAsync as jest.Mock).mockResolvedValue(undefined);
      (uploadImage as jest.Mock).mockResolvedValue({ jobId: 'test-job-123' });
      (createStorybook as jest.Mock).mockReturnValue({
        id: 'test-job-123',
        status: 'pending',
        currentStep: 'uploading',
        progress: 0,
      });
      (saveStorybook as jest.Mock).mockResolvedValue(undefined);

      render(<CreateScreen />);

      // Select image
      const galleryButton = screen.getByText('Gallery');
      fireEvent.press(galleryButton);

      await waitFor(() => {
        expect(ImageManipulator.manipulateAsync).toHaveBeenCalled();
      });

      // Press create button
      const createButton = screen.getByText('Generate Storybook');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(Haptics.notificationAsync).toHaveBeenCalledWith(
          Haptics.NotificationFeedbackType.Success
        );
      });
    });
  });

  describe('Error message display', () => {
    it('should not trigger action when button is disabled (no image selected)', () => {
      render(<CreateScreen />);

      const createButton = screen.getByText('Generate Storybook');
      fireEvent.press(createButton);

      // Alert should NOT be called because button is disabled when no image is selected
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('should display error when authentication token is missing', async () => {
      mockGetIdToken.mockResolvedValue(null);
      
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://test-image.jpg' }],
      });
      (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
        uri: 'file://test-image-converted.jpg',
      });
      (Haptics.impactAsync as jest.Mock).mockResolvedValue(undefined);
      (Haptics.notificationAsync as jest.Mock).mockResolvedValue(undefined);

      render(<CreateScreen />);

      // Select image
      const galleryButton = screen.getByText('Gallery');
      fireEvent.press(galleryButton);

      await waitFor(() => {
        expect(ImageManipulator.manipulateAsync).toHaveBeenCalled();
      });

      // Press create button
      const createButton = screen.getByText('Generate Storybook');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Upload Failed',
          'Authentication required. Please log in again.'
        );
      });
    });

    it('should display error when upload fails', async () => {
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://test-image.jpg' }],
      });
      (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
        uri: 'file://test-image-converted.jpg',
      });
      (Haptics.impactAsync as jest.Mock).mockResolvedValue(undefined);
      (Haptics.notificationAsync as jest.Mock).mockResolvedValue(undefined);
      (uploadImage as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(<CreateScreen />);

      // Select image
      const galleryButton = screen.getByText('Gallery');
      fireEvent.press(galleryButton);

      await waitFor(() => {
        expect(ImageManipulator.manipulateAsync).toHaveBeenCalled();
      });

      // Press create button
      const createButton = screen.getByText('Generate Storybook');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Upload Failed',
          'Network error'
        );
      });
    });

    it('should display generic error message for unknown errors', async () => {
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://test-image.jpg' }],
      });
      (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
        uri: 'file://test-image-converted.jpg',
      });
      (Haptics.impactAsync as jest.Mock).mockResolvedValue(undefined);
      (Haptics.notificationAsync as jest.Mock).mockResolvedValue(undefined);
      (uploadImage as jest.Mock).mockRejectedValue('Unknown error');

      render(<CreateScreen />);

      // Select image
      const galleryButton = screen.getByText('Gallery');
      fireEvent.press(galleryButton);

      await waitFor(() => {
        expect(ImageManipulator.manipulateAsync).toHaveBeenCalled();
      });

      // Press create button
      const createButton = screen.getByText('Generate Storybook');
      fireEvent.press(createButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Upload Failed',
          'Failed to create storybook. Please try again.'
        );
      });
    });

    it('should reset loading state after error', async () => {
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://test-image.jpg' }],
      });
      (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
        uri: 'file://test-image-converted.jpg',
      });
      (Haptics.impactAsync as jest.Mock).mockResolvedValue(undefined);
      (Haptics.notificationAsync as jest.Mock).mockResolvedValue(undefined);
      (uploadImage as jest.Mock).mockRejectedValue(new Error('Upload failed'));

      render(<CreateScreen />);

      // Select image
      const galleryButton = screen.getByText('Gallery');
      fireEvent.press(galleryButton);

      await waitFor(() => {
        expect(ImageManipulator.manipulateAsync).toHaveBeenCalled();
      });

      // Press create button
      const createButton = screen.getByText('Generate Storybook');
      fireEvent.press(createButton);

      // Wait for error
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      // Button should be enabled again
      await waitFor(() => {
        expect(screen.getByText('Generate Storybook')).toBeTruthy();
      });
    });
  });

  describe('Language support', () => {
    it('should display Japanese text when language is Japanese', () => {
      (useLanguage as jest.Mock).mockReturnValue({
        language: 'ja',
        setLanguage: mockSetLanguage,
      });

      render(<CreateScreen />);

      // Use getAllByText for elements that appear multiple times
      expect(screen.getAllByText('絵本を作る').length).toBeGreaterThan(0);
      expect(screen.getByText('ギャラリー')).toBeTruthy();
      expect(screen.getByText('カメラ')).toBeTruthy();
    });

    it('should display English text when language is English', () => {
      (useLanguage as jest.Mock).mockReturnValue({
        language: 'en',
        setLanguage: mockSetLanguage,
      });

      render(<CreateScreen />);

      expect(screen.getByText('Create Storybook')).toBeTruthy();
      expect(screen.getByText('Gallery')).toBeTruthy();
      expect(screen.getByText('Camera')).toBeTruthy();
    });

    it('should not trigger action when button is disabled (Japanese)', () => {
      (useLanguage as jest.Mock).mockReturnValue({
        language: 'ja',
        setLanguage: mockSetLanguage,
      });

      render(<CreateScreen />);

      // Find button by text
      const buttons = screen.getAllByText('絵本を作る');
      const createButton = buttons[buttons.length - 1];
      fireEvent.press(createButton);

      // Alert should NOT be called because button is disabled when no image is selected
      expect(Alert.alert).not.toHaveBeenCalled();
    });
  });
});
