import rateLimit from 'express-rate-limit';

/**
 * Rate limiter to prevent infinite polling loops and abuse
 * 
 * Limits:
 * - 100 requests per minute per IP
 * - Returns 429 Too Many Requests when exceeded
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Max 100 requests per window per IP
  message: {
    error: 'Too many requests. Please try again later.',
    retryAfter: 60,
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  // Skip rate limiting for health checks
  skip: (req) => req.path === '/health',
});

/**
 * Stricter rate limiter for status polling endpoints
 * Prevents infinite loop scenarios
 * 
 * Calculation:
 * - Normal polling: 2s interval = 30 req/min per user
 * - Allow 10 concurrent users per IP = 300 req/min
 * - Set limit to 200 req/min for safety margin
 */
export const statusPollingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // Max 200 requests per minute (~10 concurrent users)
  message: {
    error: 'Polling rate exceeded. Please slow down.',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});
