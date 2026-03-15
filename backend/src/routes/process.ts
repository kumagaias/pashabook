import { Router, Request, Response } from 'express';
import { ProcessingWorker } from '../services/ProcessingWorker';

const router = Router();
const worker = new ProcessingWorker();

/**
 * POST /process
 * Triggered by Cloud Tasks to process a job
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: 'Missing jobId in request body' });
    }

    console.log(`Processing job: ${jobId}`);

    // Process job asynchronously (don't wait for completion)
    worker.processJob(jobId).catch((error) => {
      console.error(`Job ${jobId} processing failed:`, error);
    });

    // Return immediately to Cloud Tasks
    res.status(200).json({ 
      message: 'Job processing started',
      jobId 
    });
  } catch (error) {
    console.error('Process endpoint error:', error);
    res.status(500).json({ 
      error: 'Failed to start job processing' 
    });
  }
});

export default router;
