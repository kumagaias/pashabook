import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { verifyFirebaseToken, AuthRequest } from '../middleware/auth';
import { getFirestore, getStorage } from '../config/firebase';
import { config } from '../config/gcp';
import { Job, Language } from '../types/models';
import { Timestamp } from '@google-cloud/firestore';
import { CloudTasksClient } from '@google-cloud/tasks';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    // Accept JPEG, PNG, and HEIC (iPhone photos)
    // React Native may send 'image/jpg' instead of 'image/jpeg'
    const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif'];
    if (validMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      console.error('Invalid file mimetype:', file.mimetype);
      cb(new Error('Invalid file format. Only JPEG, PNG, and HEIC are allowed.'));
    }
  },
});

// POST /api/upload endpoint
router.post('/', verifyFirebaseToken, upload.single('image'), async (req: AuthRequest, res) => {
  try {
    // Verify user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Verify language parameter
    const language = req.body.language as Language;
    if (!language || (language !== 'ja' && language !== 'en')) {
      return res.status(400).json({ error: 'Invalid language. Must be "ja" or "en"' });
    }

    // Validate image dimensions using sharp
    const metadata = await sharp(req.file.buffer).metadata();
    if (!metadata.width || !metadata.height) {
      return res.status(400).json({ error: 'Unable to read image dimensions' });
    }

    if (metadata.width < 500 || metadata.height < 500) {
      return res.status(400).json({ 
        error: 'Image must be at least 500x500 pixels',
        dimensions: { width: metadata.width, height: metadata.height }
      });
    }

    // Convert HEIC to JPEG if needed
    let imageBuffer = req.file.buffer;
    let mimeType = req.file.mimetype;
    if (req.file.mimetype === 'image/heic' || req.file.mimetype === 'image/heif') {
      imageBuffer = await sharp(req.file.buffer).jpeg({ quality: 90 }).toBuffer();
      mimeType = 'image/jpeg';
    }

    // Generate unique job ID
    const jobId = uuidv4();
    const userId = req.user.uid;

    // Upload image to Cloud Storage
    const bucket = getStorage().bucket(config.storageBucket);
    const fileName = `jobs/${jobId}/uploaded/original.${mimeType === 'image/jpeg' ? 'jpg' : 'png'}`;
    const file = bucket.file(fileName);

    await file.save(imageBuffer, {
      metadata: {
        contentType: mimeType,
        metadata: {
          jobId,
          userId,
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    const uploadedImageUrl = `gs://${config.storageBucket}/${fileName}`;

    // Create Job record in Firestore
    const db = getFirestore();
    const now = Timestamp.now();
    const ttl = Timestamp.fromMillis(now.toMillis() + 24 * 60 * 60 * 1000); // 24 hours from now

    const job: Job = {
      jobId,
      userId,
      status: 'pending',
      language,
      uploadedImageUrl,
      estimatedDurations: [],
      actualDurations: [],
      characterVoiceMap: {},
      createdAt: now,
      updatedAt: now,
      ttl,
    };

    await db.collection('jobs').doc(jobId).set(job);

    // Enqueue processing task to Cloud Tasks
    const tasksClient = new CloudTasksClient();
    const queuePath = tasksClient.queuePath(
      config.projectId,
      config.region,
      config.tasksQueue
    );

    const serviceUrl = process.env.CLOUD_RUN_SERVICE_URL || `http://localhost:${process.env.PORT || 8080}`;
    const taskPayload = {
      jobId,
      userId,
      language,
      uploadedImageUrl,
    };

    const task = {
      httpRequest: {
        httpMethod: 'POST' as const,
        url: `${serviceUrl}/process`,
        headers: {
          'Content-Type': 'application/json',
        },
        body: Buffer.from(JSON.stringify(taskPayload)).toString('base64'),
      },
    };

    await tasksClient.createTask({
      parent: queuePath,
      task,
    });

    // Return response within 2 seconds
    return res.status(200).json({
      jobId,
      status: 'pending',
      createdAt: now.toDate().toISOString(),
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    // Handle specific multer errors
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Image file must be smaller than 10MB' });
      }
      return res.status(400).json({ error: `Upload error: ${error.message}` });
    }

    // Handle validation errors
    if (error instanceof Error && error.message.includes('Invalid file format')) {
      return res.status(400).json({ error: 'Please upload a JPEG, PNG, or HEIC image file' });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
