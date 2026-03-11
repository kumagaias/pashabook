import { Router } from 'express';
import { verifyFirebaseToken, AuthRequest } from '../middleware/auth';
import { getFirestore } from '../config/firebase';
import { Job } from '../types/models';

const router = Router();

// GET /api/status/:jobId endpoint
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

    // Build response based on job status
    const response: any = {
      jobId: job.jobId,
      status: job.status,
      updatedAt: job.updatedAt.toDate().toISOString(),
    };

    // Add progress information if job is processing
    if (job.status === 'processing' && job.currentStage && job.progressPercentage !== undefined) {
      response.progress = {
        stage: job.currentStage,
        percentage: job.progressPercentage,
      };
    }

    // Add result information if job is done
    if (job.status === 'done' && job.story && job.finalVideoUrl) {
      response.result = {
        title: job.story.title,
        videoUrl: job.finalVideoUrl,
        storyText: job.story.pages.map(page => page.narrationText),
      };
    }

    // Add error information if job failed
    if (job.status === 'error' && job.error) {
      response.error = job.error;
    }

    return res.status(200).json(response);

  } catch (error) {
    console.error('Status query error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
