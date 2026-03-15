import { Router } from 'express';
import { verifyFirebaseToken, AuthRequest } from '../middleware/auth';
import { getFirestore } from '../config/firebase';
import { Job } from '../types/models';
import { CloudTasksClient } from '@google-cloud/tasks';
import { config } from '../config/gcp';

const router = Router();

/**
 * Calculate queue position for a pending job
 * Returns queue position only when queue has 3+ active jobs
 * Returns 0 or undefined when job is processing or queue has < 3 jobs
 */
async function calculateQueuePosition(jobId: string, jobCreatedAt: Date): Promise<number | undefined> {
  try {
    const tasksClient = new CloudTasksClient();
    const queuePath = tasksClient.queuePath(
      config.projectId,
      config.region,
      config.tasksQueue
    );

    // List all tasks in the queue
    const [tasks] = await tasksClient.listTasks({
      parent: queuePath,
    });

    // Filter for active tasks (not completed or failed)
    const activeTasks = tasks.filter(task => task.name); // Tasks with names are active

    // If queue has less than 3 active jobs, don't show queue position
    if (activeTasks.length < 3) {
      return undefined;
    }

    // Count tasks created before this job
    // Tasks are ordered by creation time, so we can count how many are ahead
    let position = 0;
    for (const task of activeTasks) {
      // Extract creation time from task
      // Cloud Tasks doesn't expose creation time directly, so we use scheduleTime
      if (task.scheduleTime) {
        const seconds = typeof task.scheduleTime.seconds === 'number' 
          ? task.scheduleTime.seconds 
          : Number(task.scheduleTime.seconds || 0);
        const taskScheduleTime = new Date(seconds * 1000);
        
        // If task was scheduled before this job was created, it's ahead in queue
        if (taskScheduleTime < jobCreatedAt) {
          position++;
        }
      }
    }

    // Return position (1-indexed for user display)
    // If position is 0, the job is next or currently processing
    return position > 0 ? position : 0;

  } catch (error) {
    console.error('Error calculating queue position:', error);
    // Return undefined on error to gracefully degrade
    return undefined;
  }
}

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

    // Calculate and add queue position if job is pending
    if (job.status === 'pending') {
      const queuePosition = await calculateQueuePosition(
        job.jobId,
        job.createdAt.toDate()
      );
      
      // Only include queuePosition if it's defined and > 0
      if (queuePosition !== undefined && queuePosition > 0) {
        response.queuePosition = queuePosition;
      }
    }

    // Add progress information if job is processing
    if (job.status === 'processing' && job.currentStage && job.progressPercentage !== undefined) {
      response.progress = {
        stage: job.currentStage,
        percentage: job.progressPercentage,
      };
      
      // Add progressDetail if available
      if (job.progressDetail) {
        response.progress.detail = job.progressDetail;
      }
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
