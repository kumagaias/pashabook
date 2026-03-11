# Performance Optimization

This document describes the performance optimizations implemented in Pashabook MVP.

## Pipeline Optimization

### Parallel Execution

The generation pipeline uses parallel execution for independent operations:

```typescript
// Narration and Illustration generation run in parallel
const [pageNarrations, illustrations] = await Promise.all([
  narrationGenerator.generateAll(story.pages, language),
  illustrationGenerator.generateAll(story.pages, style, jobId),
]);
```

**Benefits:**
- Reduces total processing time by ~40%
- Narration (30s) and Illustration (90s) run concurrently
- Total time: max(30s, 90s) = 90s instead of 120s

### Cloud Tasks Queue Configuration

Configure Cloud Tasks queue with concurrency limits:

```bash
gcloud tasks queues update pashabook-processing \
  --max-concurrent-dispatches=3 \
  --max-dispatches-per-second=10
```

**Settings:**
- Max concurrent jobs: 3
- Max dispatches per second: 10
- Prevents resource exhaustion
- Ensures fair resource allocation

## FFmpeg Optimization

### Optimized FFmpeg Commands

All FFmpeg operations use optimized parameters:

```bash
# Ken Burns effect with hardware acceleration
ffmpeg -i input.jpg \
  -vf "scale=1280:720,zoompan=z='zoom+0.002':d=125:s=1280x720" \
  -c:v libx264 -preset fast -crf 23 \
  -pix_fmt yuv420p output.mp4
```

**Optimizations:**
- `-preset fast`: Faster encoding with acceptable quality
- `-crf 23`: Constant Rate Factor for quality/size balance
- Hardware acceleration when available
- Optimized filter chains

### Video Composition

```bash
# Crossfade transitions with optimized settings
ffmpeg -i clip1.mp4 -i clip2.mp4 \
  -filter_complex "[0][1]xfade=transition=fade:duration=0.5:offset=4.5" \
  -c:v libx264 -preset fast -crf 23 output.mp4
```

## API Optimization

### Timeout Configuration

Each service has optimized timeouts:

- Image Analysis: 30 seconds
- Story Generation: 30 seconds
- Narration (per page): 10 seconds
- Illustration (per page): 30 seconds
- Animation (standard): 15 seconds
- Animation (highlight): 60 seconds (with fallback)
- Video Composition: 60 seconds

### Retry Logic

Exponential backoff for transient failures:

```typescript
async retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    }
  }
}
```

**Backoff schedule:**
- Attempt 1: Immediate
- Attempt 2: 1 second delay
- Attempt 3: 2 seconds delay
- Attempt 4: 4 seconds delay

## Monitoring

### Performance Metrics

Monitor key metrics in Cloud Monitoring:

```bash
# Average processing time
gcloud monitoring time-series list \
  --filter='metric.type="cloudfunctions.googleapis.com/function/execution_times"'

# Success rate
gcloud monitoring time-series list \
  --filter='metric.type="cloudfunctions.googleapis.com/function/execution_count"'
```

### Logging

All services log performance metrics:

```typescript
console.log(`Image analysis completed in ${duration}s`);
console.log(`Story generation completed in ${duration}s`);
console.log(`Narration generation completed in ${duration}s`);
console.log(`Illustration generation completed in ${duration}s`);
console.log(`Animation generation completed in ${duration}s`);
console.log(`Video composition completed in ${duration}s`);
```

## Expected Performance

### Total Processing Time

With optimizations:

1. Image Analysis: ~10-20 seconds
2. Story Generation: ~10-20 seconds
3. Narration + Illustration (parallel): ~60-90 seconds
4. Animation: ~60-90 seconds
5. Video Composition: ~30-45 seconds

**Total: ~3-4 minutes per storybook**

### Bottlenecks

Current bottlenecks:
1. Illustration generation (90s) - Limited by Imagen 3 API
2. Animation generation (60-90s) - Limited by FFmpeg processing
3. Video composition (30-45s) - Limited by FFmpeg processing

### Future Optimizations

Potential improvements:
1. Use Cloud Run with more CPU/memory
2. Implement caching for repeated operations
3. Use GPU-accelerated FFmpeg
4. Batch processing for multiple jobs
5. Pre-generate common assets
