import { Router } from 'express';
import { getFirestore } from '../config/firebase';
import { verifyFirebaseToken, AuthRequest } from '../middleware/auth';
import { UserProfile } from '../types/models';
import { Timestamp } from '@google-cloud/firestore';

const router = Router();

// Register new user - create user profile in Firestore
router.post('/register', verifyFirebaseToken, async (req: AuthRequest, res) => {
  try {
    const { name, email } = req.body;
    const userId = req.user!.uid;

    // Validate input
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const db = getFirestore();
    const now = Timestamp.now();

    const userProfile: UserProfile = {
      userId,
      name,
      email,
      createdAt: now,
      updatedAt: now,
    };

    // Store user profile in Firestore
    await db.collection('users').doc(userId).set(userProfile);

    res.status(201).json({
      userId: userProfile.userId,
      name: userProfile.name,
      email: userProfile.email,
    });
  } catch (error) {
    console.error('User registration error:', error);
    res.status(500).json({ error: 'Failed to create user profile' });
  }
});

// Get user profile
router.get('/profile', verifyFirebaseToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.uid;
    const db = getFirestore();

    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const userProfile = userDoc.data() as UserProfile;

    res.json({
      userId: userProfile.userId,
      name: userProfile.name,
      email: userProfile.email,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

// Update FCM token
router.put('/fcm-token', verifyFirebaseToken, async (req: AuthRequest, res) => {
  try {
    const { fcmToken } = req.body;
    const userId = req.user!.uid;

    // Validate input
    if (!fcmToken || typeof fcmToken !== 'string') {
      return res.status(400).json({ error: 'Valid FCM token is required' });
    }

    const db = getFirestore();
    const now = Timestamp.now();

    // Update user profile with FCM token
    await db.collection('users').doc(userId).update({
      fcmToken,
      updatedAt: now,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Update FCM token error:', error);
    res.status(500).json({ error: 'Failed to update FCM token' });
  }
});

export default router;
