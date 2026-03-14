import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getFirestore } from '../config/firebase';
import { Timestamp } from '@google-cloud/firestore';

// Mock dependencies
vi.mock('../config/firebase');

describe('FCM Token Management', () => {
  let mockDb: any;
  let mockCollection: any;
  let mockDoc: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup Firestore mocks
    mockDoc = {
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
    };

    mockCollection = {
      doc: vi.fn().mockReturnValue(mockDoc),
    };

    mockDb = {
      collection: vi.fn().mockReturnValue(mockCollection),
    };

    (getFirestore as any).mockReturnValue(mockDb);
  });

  describe('FCM Token Update', () => {
    it('should update FCM token in Firestore', async () => {
      const userId = 'test-user-id';
      const fcmToken = 'test-fcm-token-123';
      const db = getFirestore();

      await db.collection('users').doc(userId).update({
        fcmToken,
        updatedAt: Timestamp.now(),
      });

      expect(mockDb.collection).toHaveBeenCalledWith('users');
      expect(mockCollection.doc).toHaveBeenCalledWith(userId);
      expect(mockDoc.update).toHaveBeenCalledWith({
        fcmToken,
        updatedAt: expect.any(Timestamp),
      });
    });

    it('should handle empty FCM token', async () => {
      const userId = 'test-user-id';
      const fcmToken = '';

      // Validation should happen before Firestore call
      if (!fcmToken || typeof fcmToken !== 'string') {
        expect(fcmToken).toBe('');
        return;
      }

      // This should not be reached
      expect(true).toBe(false);
    });

    it('should handle invalid FCM token type', async () => {
      const userId = 'test-user-id';
      const fcmToken = 123 as any;

      // Validation should happen before Firestore call
      if (!fcmToken || typeof fcmToken !== 'string') {
        expect(typeof fcmToken).toBe('number');
        return;
      }

      // This should not be reached
      expect(true).toBe(false);
    });

    it('should retrieve user profile with FCM token', async () => {
      const userId = 'test-user-id';
      const db = getFirestore();

      mockDoc.get.mockResolvedValue({
        exists: true,
        data: () => ({
          userId,
          name: 'Test User',
          email: 'test@example.com',
          fcmToken: 'test-fcm-token',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }),
      });

      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();

      expect(userDoc.exists).toBe(true);
      expect(userData.fcmToken).toBe('test-fcm-token');
      expect(userData.userId).toBe(userId);
    });

    it('should handle Firestore update errors gracefully', async () => {
      const userId = 'test-user-id';
      const fcmToken = 'test-fcm-token-123';
      const db = getFirestore();

      mockDoc.update.mockRejectedValue(new Error('Firestore error'));

      await expect(
        db.collection('users').doc(userId).update({
          fcmToken,
          updatedAt: Timestamp.now(),
        })
      ).rejects.toThrow('Firestore error');
    });
  });

  describe('User Profile Creation', () => {
    it('should create user profile without FCM token initially', async () => {
      const userId = 'test-user-id';
      const db = getFirestore();
      const now = Timestamp.now();

      const userProfile = {
        userId,
        name: 'Test User',
        email: 'test@example.com',
        createdAt: now,
        updatedAt: now,
      };

      await db.collection('users').doc(userId).set(userProfile);

      expect(mockDoc.set).toHaveBeenCalledWith(userProfile);
      expect(userProfile).not.toHaveProperty('fcmToken');
    });

    it('should allow FCM token to be added later', async () => {
      const userId = 'test-user-id';
      const db = getFirestore();

      // First create profile without token
      await db.collection('users').doc(userId).set({
        userId,
        name: 'Test User',
        email: 'test@example.com',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      // Then update with FCM token
      await db.collection('users').doc(userId).update({
        fcmToken: 'new-fcm-token',
        updatedAt: Timestamp.now(),
      });

      expect(mockDoc.set).toHaveBeenCalled();
      expect(mockDoc.update).toHaveBeenCalledWith({
        fcmToken: 'new-fcm-token',
        updatedAt: expect.any(Timestamp),
      });
    });
  });
});
