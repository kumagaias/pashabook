import { Router } from 'express';
import { verifyFirebaseToken, AuthRequest } from '../middleware/auth';
import { getFirestore, getStorage } from '../config/firebase';
import { config } from '../config/gcp';
import { Job } from '../types/models';

const router = Router();

// GET /api/video/:jobId endpoint
router.get('/:jobId', verifyFirebaseToken, async (req: AuthRequest, res) => {
  try {
    // Verify user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { jobId } = req.params;

    // Validate jobId parameter
    if (!jobId || typeof jobId !== 'string') {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    // Query Job record from Firestore
    const db = getFirestore();
    const jobDoc = await db.collection('jobs').doc(jobId).get();

    // Check if job exists
    if (!jobDoc.exists) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = jobDoc.data() as Job;

    // Check job userId matches authenticated user
    if (job.userId !== req.user.uid) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this job' });
    }

    // Verify job status is "done"
    if (job.status !== 'done') {
      return res.status(404).json({ 
        error: 'Video not available',
        message: `Job status is "${job.status}". Video is only available when status is "done".`
      });
    }

    // Verify finalVideoUrl exists
    if (!job.finalVideoUrl) {
      return res.status(404).json({ 
        error: 'Video not found',
        message: 'Job is marked as done but video URL is missing.'
      });
    }

    // Extract bucket and file path from gs:// URL
    const gsUrlMatch = job.finalVideoUrl.match(/^gs:\/\/([^\/]+)\/(.+)$/);
    if (!gsUrlMatch) {
      console.error('Invalid Cloud Storage URL format:', job.finalVideoUrl);
      return res.status(500).json({ error: 'Internal server error' });
    }

    const bucketName = gsUrlMatch[1];
    const filePath = gsUrlMatch[2];

    // Generate signed URLs for video and download (24-hour expiry)
    const bucket = getStorage().bucket(bucketName);
    const file = bucket.file(filePath);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Generate signed URL for video preview
    const [videoUrl] = await file.getSignedUrl({
      action: 'read',
      expires: expiresAt,
    });

    // Generate signed URL for download with content-disposition header
    const [downloadUrl] = await file.getSignedUrl({
      action: 'read',
      expires: expiresAt,
      responseDisposition: 'attachment',
    });

    return res.status(200).json({
      videoUrl,
      downloadUrl,
      expiresAt: expiresAt.toISOString(),
    });

  } catch (error) {
    console.error('Video endpoint error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
